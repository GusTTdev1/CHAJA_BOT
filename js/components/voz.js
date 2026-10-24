// ============================================================================
// voz.js — "Nota de voz": graba audio corto, lo manda a un webhook nuevo de
// n8n (CONFIG.api.voiceWebhookUrl) que lo transcribe y lo interpreta con
// Groq, y muestra el resultado para que el usuario lo CONFIRME antes de
// guardar nada.
//
// Punto clave de diseño: Groq/n8n acá sólo INTERPRETAN. El guardado real
// sigue pasando por flowClient.runFlow() -> el mismo "Router de estado" de
// siempre, armando exactamente la misma secuencia de pasos que ya arman
// production.js / stock.js / actividad.js / consultas.js / graficos.js a
// mano. Así:
//   - no hace falta tocar el Router de estado ni cómo se guarda en el Sheet
//   - si Groq entiende mal algo, el usuario lo ve y lo corrige ANTES de que
//     se escriba una fila mala en el cuaderno
//
// Formato que se espera de vuelta del webhook de voz:
//   { ok: true, transcripcion: "...", interpretado: { intento: "...", ... } }
//   { ok: false, mensaje: "..." }
// Ver armarPasos() más abajo para el detalle exacto de "interpretado".
// ============================================================================

import { CONFIG } from "../config.js";
import { getUsuarioId, getNombre } from "../auth.js";
import { runFlow } from "../flowClient.js";
import { showToast } from "./toast.js";

const MAX_MS = 60_000; // tope de grabación: 60s, para no mandar audios eternos a Groq

export function initVoz() {
  const btn = document.getElementById("recorderBtn");
  const statusEl = document.getElementById("recorderStatus");
  const timerEl = document.getElementById("recorderTimer");
  const review = document.getElementById("recorderReview");
  const transcriptEl = document.getElementById("recorderTranscript");
  const interpretList = document.getElementById("recorderInterpretList");
  const confirmBtn = document.getElementById("recorderConfirmBtn");
  const retryBtn = document.getElementById("recorderRetryBtn");
  const formStatus = document.getElementById("recorderFormStatus");
  const resultBox = document.getElementById("recorderResult");
  if (!btn) return;

  let mediaRecorder = null;
  let chunks = [];
  let startedAt = 0;
  let timerInterval = null;
  let interpretado = null; // última interpretación recibida, pendiente de confirmar

  function setStatus(text) { statusEl.textContent = text; }

  function resetRecorder() {
    review.hidden = true;
    resultBox.hidden = true;
    interpretado = null;
    btn.classList.remove("is-recording", "is-processing");
    btn.disabled = false;
    timerEl.hidden = true;
    setStatus("Tocá para grabar");
  }

  async function startRecording() {
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      console.error("[voz] no se pudo acceder al micrófono:", err);
      setStatus("No se pudo acceder al micrófono. Revisá los permisos del navegador.");
      return;
    }

    chunks = [];
    const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
    mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    mediaRecorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      clearInterval(timerInterval);
      const blob = new Blob(chunks, { type: mediaRecorder.mimeType || "audio/webm" });
      procesarAudio(blob);
    };

    mediaRecorder.start();
    startedAt = Date.now();
    btn.classList.add("is-recording");
    setStatus("Grabando… tocá de nuevo para terminar");
    timerEl.hidden = false;
    timerEl.textContent = "00:00";
    timerInterval = setInterval(() => {
      const ms = Date.now() - startedAt;
      if (ms >= MAX_MS) { stopRecording(); return; }
      const s = Math.floor(ms / 1000);
      timerEl.textContent = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
    }, 250);
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
  }

  btn.addEventListener("click", () => {
    if (btn.classList.contains("is-processing")) return;
    if (!mediaRecorder || mediaRecorder.state === "inactive") startRecording();
    else stopRecording();
  });

  retryBtn.addEventListener("click", resetRecorder);

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result).split(",")[1] || "");
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  async function procesarAudio(blob) {
    btn.classList.remove("is-recording");
    btn.classList.add("is-processing");
    btn.disabled = true;
    timerEl.hidden = true;
    setStatus("Escuchando y entendiendo…");

    const usuarioId = getUsuarioId();
    if (!usuarioId) {
      setStatus("Iniciá sesión para poder usar la nota de voz.");
      btn.classList.remove("is-processing");
      btn.disabled = false;
      return;
    }

    let audioBase64;
    try {
      audioBase64 = await blobToBase64(blob);
    } catch (err) {
      console.error("[voz] no se pudo leer el audio grabado:", err);
      setStatus("No se pudo procesar el audio grabado. Probá de nuevo.");
      btn.classList.remove("is-processing");
      btn.disabled = false;
      return;
    }

    let res;
    try {
      res = await fetch(CONFIG.api.voiceWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audio_base64: audioBase64,
          mime_type: blob.type || "audio/webm",
          usuario_id: usuarioId,
          first_name: getNombre(),
          origen: "web",
        }),
      });
    } catch (err) {
      console.error("[voz] fetch al webhook de voz falló:", err);
      setStatus("No se pudo conectar con el servidor.");
      btn.classList.remove("is-processing");
      btn.disabled = false;
      return;
    }

    let data;
    try {
      data = JSON.parse(await res.text());
    } catch (err) {
      console.error("[voz] la respuesta no es JSON válido:", err);
      setStatus("El servidor respondió en un formato inesperado.");
      btn.classList.remove("is-processing");
      btn.disabled = false;
      return;
    }

    btn.classList.remove("is-processing");
    btn.disabled = false;

    if (!res.ok || !data.ok) {
      setStatus(data.mensaje || "No se pudo entender el audio. Probá de nuevo.");
      return;
    }

    interpretado = data.interpretado || {};
    transcriptEl.textContent = data.transcripcion || "(no se transcribió texto)";
    mostrarInterpretacion(interpretado);
    review.hidden = false;
    setStatus("Tocá para grabar");
  }

  function mostrarInterpretacion(d) {
    interpretList.innerHTML = "";
    const filas = describirInterpretacion(d);
    confirmBtn.disabled = filas.length === 0;
    if (!filas.length) {
      const li = document.createElement("li");
      li.textContent = "No se entendió ningún dato claro. Probá grabar de nuevo, más despacio y con los números bien dichos.";
      interpretList.appendChild(li);
      return;
    }
    filas.forEach((f) => {
      const li = document.createElement("li");
      li.textContent = f;
      interpretList.appendChild(li);
    });
  }

  confirmBtn.addEventListener("click", async () => {
    if (!interpretado) return;
    const { pasos, error } = armarPasos(interpretado);
    if (error) {
      formStatus.textContent = error;
      formStatus.classList.add("is-error");
      return;
    }

    confirmBtn.disabled = true;
    retryBtn.disabled = true;
    formStatus.classList.remove("is-error");
    formStatus.textContent = "Guardando en Chaja Bot…";

    const res = await runFlow(pasos);

    confirmBtn.disabled = false;
    retryBtn.disabled = false;
    formStatus.textContent = "";

    resultBox.hidden = false;
    resultBox.classList.toggle("is-error", !res.ok);
    resultBox.textContent = res.mensaje;

    if (res.ok) {
      showToast("Registro guardado");
      resetRecorder();
    }
  });
}

// ----------------------------------------------------------------------------
// Traducción: lo que devuelve Groq (JSON "interpretado") -> texto legible
// para la revisión, y -> la MISMA secuencia de pasos que arman los
// formularios a mano (ver production.js / stock.js / actividad.js /
// consultas.js / graficos.js) para pasar por "Router de estado" tal cual
// como si se hubiera tipeado paso a paso.
//
// Forma esperada de "interpretado" (todos los campos opcionales salvo
// "intento"; el prompt de Groq en n8n define exactamente este contrato):
//   intento: "registrar_produccion" | "ajuste_stock" | "actividad"
//            | "consulta" | "grafico" | "desconocido"
//   tipo_produccion: "gallinas" | "pollos" | "cerdos" | "huerta"
//   evento: "produccion" | "celo" | "parto" | "destete" | "sanidad"  (sólo cerdos)
//   cantidad_animales, alimento_kg, precio_alimento_kg, produccion_hoy: number
//   cerda_id: string               (evento celo)
//   lechones_vivos: number         (evento parto)
//   lechones_destete: number       (evento destete)
//   tratamiento: string, costo_sanidad: number   (evento sanidad)
//   direccion_stock: "alta" | "baja", cantidad_stock: number
//   fecha: "dd/mm/aaaa"            (actividad)
//   consulta: "balance" | "resumen" | "info"
//   grafico_tipo: "barras" | "torta" | "linea", grafico_categoria: "produccion" | "economia"
//   observacion: string | null
// ----------------------------------------------------------------------------

function num(v) {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

function describirInterpretacion(d) {
  const filas = [];
  if (d.intento === "registrar_produccion") {
    const nombresTipo = { gallinas: "Gallinas", pollos: "Pollos", cerdos: "Cerdos", huerta: "Huerta" };
    filas.push(`Registrar producción · ${nombresTipo[d.tipo_produccion] || "?"}${d.evento && d.evento !== "produccion" ? " · " + d.evento : ""}`);
    if (d.cantidad_animales != null) filas.push(`Cantidad: ${d.cantidad_animales}`);
    if (d.alimento_kg != null) filas.push(`Alimento consumido: ${d.alimento_kg} kg`);
    if (d.precio_alimento_kg != null) filas.push(`Precio del alimento: $${d.precio_alimento_kg}/kg`);
    if (d.produccion_hoy != null) filas.push(`Producción de hoy: ${d.produccion_hoy}`);
    if (d.cerda_id) filas.push(`Cerda: ${d.cerda_id}`);
    if (d.lechones_vivos != null) filas.push(`Lechones nacidos vivos: ${d.lechones_vivos}`);
    if (d.lechones_destete != null) filas.push(`Lechones a destetar: ${d.lechones_destete}`);
    if (d.tratamiento) filas.push(`Tratamiento: ${d.tratamiento}`);
    if (d.costo_sanidad != null) filas.push(`Costo del tratamiento: $${d.costo_sanidad}`);
  } else if (d.intento === "ajuste_stock") {
    filas.push(`${d.direccion_stock === "baja" ? "Baja" : "Alta"} de stock · ${d.tipo_produccion || "?"}`);
    if (d.cantidad_stock != null) filas.push(`Cantidad: ${d.cantidad_stock}`);
  } else if (d.intento === "actividad") {
    filas.push(`Consultar actividad del ${d.fecha || "?"}`);
  } else if (d.intento === "consulta") {
    const nombres = { balance: "Balance financiero", resumen: "Resumen de producción", info: "Historial completo" };
    filas.push(`Consulta: ${nombres[d.consulta] || d.consulta || "?"}`);
  } else if (d.intento === "grafico") {
    filas.push(`Gráfico de ${d.grafico_categoria || "?"} (${d.grafico_tipo || "?"})`);
  } else {
    return [];
  }
  if (d.observacion) filas.push(`Nota: "${d.observacion}"`);
  return filas;
}

function armarPasos(d) {
  if (d.intento === "registrar_produccion") {
    const tiposValidos = ["gallinas", "pollos", "cerdos", "huerta"];
    if (!tiposValidos.includes(d.tipo_produccion)) {
      return { error: "No quedó claro el tipo de producción (gallinas, pollos, cerdos o huerta)." };
    }

    const pasos = ["registrar", d.tipo_produccion];
    const eventosValidos = ["produccion", "celo", "parto", "destete", "sanidad"];
    const evento = d.tipo_produccion === "cerdos"
      ? (eventosValidos.includes(d.evento) ? d.evento : "produccion")
      : "produccion";
    if (d.tipo_produccion === "cerdos") pasos.push(evento);

    if (evento === "celo") {
      if (!d.cerda_id) return { error: "No quedó claro qué cerda está en celo." };
      pasos.push(d.cerda_id);
    } else if (evento === "parto") {
      const n = num(d.lechones_vivos);
      if (isNaN(n) || n < 0) return { error: "No quedó claro cuántos lechones nacieron." };
      pasos.push(n);
    } else if (evento === "destete") {
      const n = num(d.lechones_destete);
      if (isNaN(n) || n <= 0) return { error: "No quedó claro cuántos lechones se destetan." };
      pasos.push(n);
    } else if (evento === "sanidad") {
      if (!d.tratamiento) return { error: "No quedó claro el tratamiento aplicado." };
      const costo = num(d.costo_sanidad ?? 0);
      pasos.push(d.tratamiento, isNaN(costo) ? 0 : costo);
    } else {
      const cantidad = num(d.cantidad_animales);
      const alimento = num(d.alimento_kg ?? 0);
      const precio = num(d.precio_alimento_kg ?? 0);
      const produccion = num(d.produccion_hoy);
      if (isNaN(cantidad) || cantidad <= 0) return { error: "No quedó clara la cantidad de animales." };
      if (isNaN(alimento) || alimento < 0) return { error: "No quedó claro el alimento consumido." };
      if (isNaN(precio) || precio < 0) return { error: "No quedó claro el precio del alimento." };
      if (isNaN(produccion) || produccion < 0) return { error: "No quedó clara la producción de hoy." };
      pasos.push(cantidad, alimento, precio, produccion);
    }

    pasos.push(d.observacion ? d.observacion : "no");
    return { pasos };
  }

  if (d.intento === "ajuste_stock") {
    const tiposValidos = ["gallinas", "pollos", "cerdos", "huerta"];
    if (!tiposValidos.includes(d.tipo_produccion)) return { error: "No quedó claro el tipo de producción." };
    if (d.direccion_stock !== "alta" && d.direccion_stock !== "baja") return { error: "No quedó claro si es alta o baja de stock." };
    const cantidad = num(d.cantidad_stock);
    if (isNaN(cantidad) || cantidad <= 0) return { error: "No quedó clara la cantidad." };
    return { pasos: [d.direccion_stock, d.tipo_produccion, cantidad, d.observacion || "no"] };
  }

  if (d.intento === "actividad") {
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(d.fecha || "")) return { error: "No quedó clara la fecha (necesita dd/mm/aaaa)." };
    return { pasos: ["/actividad", d.fecha] };
  }

  if (d.intento === "consulta") {
    const validos = { balance: "balance", resumen: "resumen", info: "info" };
    if (!validos[d.consulta]) return { error: "No quedó claro qué consulta querés." };
    return { pasos: [validos[d.consulta]] };
  }

  if (d.intento === "grafico") {
    const tipos = ["barras", "torta", "linea"];
    const categorias = ["produccion", "economia"];
    const tipo = tipos.includes(d.grafico_tipo) ? d.grafico_tipo : "barras";
    const categoria = categorias.includes(d.grafico_categoria) ? d.grafico_categoria : "produccion";
    return { pasos: [`grafico ${tipo} ${categoria}`] };
  }

  return { error: "No quedó claro qué querías hacer. Probá de nuevo, por ejemplo: «junté 12 huevos hoy»." };
}
