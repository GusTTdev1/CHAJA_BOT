// ============================================================================
// commandCenter.js — "Centro de comandos": la interfaz real conectada a n8n.
//
// A diferencia de production.js/stock.js/groups.js (formularios de un solo
// submit, en modo demo), este componente habla el protocolo REAL: cada
// interacción del usuario se manda como "texto" (igual que si lo tipeara en
// Discord) y n8n contesta con el siguiente mensaje/pregunta. Esto cubre las
// funciones pedidas originalmente: Registrar, Alta, Baja, Balance, Historial,
// Resumen, Actividad, Gráficos, Cancelar y Reiniciar — sin que la web
// necesite saber nada de la máquina de estados (eso lo decide n8n).
// ============================================================================

import { api, enviarTexto } from "../api.js";
import { getNombre, setNombre } from "../auth.js";

// Opciones conocidas para mostrar como botones en vez de pedir texto libre.
// Esto es solo UI: el valor que se manda a n8n es siempre texto plano, igual
// que si el usuario lo hubiera tipeado. Si n8n pide algo que no está en este
// mapa, se muestra un campo de texto/numero genérico.
const OPCIONES_POR_PISTA = [
  { test: (m) => /gallinas.*pollos.*cerdos.*huerta/i.test(m) || /qu[eé] [aá]rea/i.test(m),
    opciones: [["🐔", "Gallinas", "gallinas"], ["🐓", "Pollos", "pollos"], ["🐖", "Cerdos", "cerdos"], ["🥬", "Huerta", "huerta"]] },
  { test: (m) => /produccion.*celo.*parto.*destete.*sanidad/i.test(m),
    opciones: [["🏭", "Producción", "produccion"], ["❤️", "Celo", "celo"], ["🍼", "Parto", "parto"], ["🐖", "Destete", "destete"], ["💉", "Sanidad", "sanidad"]] },
  { test: (m) => /observaci[oó]n|tarea pendiente|nota.*libre|no hay nada/i.test(m),
    opciones: [["📝", "Agregar observación", "__texto_libre__"], ["⏭️", "Continuar sin observación", "no"]] },
];

function detectarOpciones(mensaje) {
  const hit = OPCIONES_POR_PISTA.find((o) => o.test(mensaje || ""));
  return hit ? hit.opciones : null;
}

function esPasoFecha(mensaje) {
  return /ingres[aá] una fecha/i.test(mensaje || "");
}

let flujoActivo = false; // solo UI: hay una conversación en curso, mostrar "Cancelar"

export function init_CommandCenter() {
  const log = document.getElementById("ccLog");
  const inputArea = document.getElementById("ccInputArea");
  const menu = document.getElementById("ccMenu");
  const cancelBtn = document.getElementById("ccCancel");
  const nombreInput = document.getElementById("ccNombre");

  nombreInput.value = getNombre() === "Web" ? "" : getNombre();
  nombreInput.addEventListener("change", () => setNombre(nombreInput.value.trim()));

  function scrollToEnd() {
    log.scrollTop = log.scrollHeight;
  }

  function addBubble(text, from = "bot") {
    const div = document.createElement("div");
    div.className = `cc-bubble cc-bubble--${from}`;
    div.textContent = text;
    log.appendChild(div);
    scrollToEnd();
    return div;
  }

  function addImage(url) {
    const img = document.createElement("img");
    img.className = "cc-bubble__img";
    img.src = url;
    img.alt = "Gráfico generado";
    log.appendChild(img);
    scrollToEnd();
  }

  function setActivo(activo) {
    flujoActivo = activo;
    cancelBtn.hidden = !activo;
    menu.classList.toggle("is-disabled", activo);
  }

  async function procesarRespuesta(res) {
    if (!res.ok) {
      addBubble(res.mensaje || "Ocurrió un error.", "error");
      renderInput(null);
      return;
    }
    if (res.mensaje) addBubble(res.mensaje, "bot");
    if (res.grafico_url) addImage(res.grafico_url);
    renderInput(res.mensaje);
  }

  function renderInput(mensaje) {
    inputArea.innerHTML = "";

    // Si el mensaje suena a "operación terminada / registro exitoso / cancelado",
    // no mostramos más input: se cierra el flujo.
    const pareceFinal = /registro exitoso|operaci[oó]n cancelad|no hay ninguna acci[oó]n activa|limpieza completada|registro creado correctamente/i.test(mensaje || "");
    if (!mensaje || pareceFinal) {
      setActivo(false);
      return;
    }

    setActivo(true);
    const opciones = detectarOpciones(mensaje);

    if (opciones) {
      const wrap = document.createElement("div");
      wrap.className = "cc-options";
      opciones.forEach(([icon, label, valor]) => {
        const btn = document.createElement("button");
        btn.className = "btn btn--outline";
        btn.type = "button";
        btn.textContent = `${icon} ${label}`;
        btn.addEventListener("click", () => {
          if (valor === "__texto_libre__") {
            renderTextInput("Escribí tu observación…", "text");
          } else {
            enviarPaso(valor);
          }
        });
        wrap.appendChild(btn);
      });
      inputArea.appendChild(wrap);
      return;
    }

    if (esPasoFecha(mensaje)) {
      renderDateInput();
      return;
    }

    const esNumerico = /¿cu[aá]nt|costo|precio|peso|kilos/i.test(mensaje);
    renderTextInput(esNumerico ? "Ingresá un número…" : "Escribí tu respuesta…", esNumerico ? "number" : "text");
  }

  function renderTextInput(placeholder, type) {
    const form = document.createElement("form");
    form.className = "cc-input-form";
    form.innerHTML = `
      <input class="field__input" type="${type}" ${type === "number" ? 'step="any"' : ""} placeholder="${placeholder}" required>
      <button class="btn btn--primary" type="submit">Enviar</button>`;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const val = form.querySelector("input").value.trim();
      if (!val) return;
      enviarPaso(val);
    });
    inputArea.appendChild(form);
    form.querySelector("input").focus();
  }

  function renderDateInput() {
    const form = document.createElement("form");
    form.className = "cc-input-form";
    form.innerHTML = `
      <input class="field__input" type="date" required>
      <button class="btn btn--primary" type="submit">Consultar</button>`;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const iso = form.querySelector("input").value; // yyyy-mm-dd
      if (!iso) return;
      const [y, m, d] = iso.split("-");
      enviarPaso(`${d}/${m}/${y}`); // n8n espera dd/mm/aaaa, ver Router de estado
    });
    inputArea.appendChild(form);
  }

  async function enviarPaso(texto) {
    addBubble(texto, "user");
    inputArea.innerHTML = "";
    const res = await enviarTexto(texto);
    await procesarRespuesta(res);
  }

  // --------------------------------------------------------------------
  // Menú de comandos iniciales
  // --------------------------------------------------------------------
  menu.querySelectorAll("[data-comando]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (flujoActivo) return;
      const comando = btn.dataset.comando;
      log.innerHTML = "";

      if (comando === "graficos") {
        renderGraficosMenu();
        return;
      }
      if (comando === "reiniciar") {
        if (!confirm("Esto borra TODOS los registros y estados. ¿Confirmás?")) return;
      }

      addBubble(btn.textContent.trim(), "user");
      const res = await enviarTexto(comando);
      await procesarRespuesta(res);
    });
  });

  function renderGraficosMenu() {
    addBubble("📈 Elegí qué querés graficar", "bot");
    const wrap = document.createElement("div");
    wrap.className = "cc-options";
    [
      ["📊 Barras · Producción", "grafico barras produccion"],
      ["🥧 Torta · Producción", "grafico torta produccion"],
      ["📊 Barras · Economía", "grafico barras economia"],
      ["🥧 Torta · Economía", "grafico torta economia"],
    ].forEach(([label, comando]) => {
      const btn = document.createElement("button");
      btn.className = "btn btn--outline";
      btn.type = "button";
      btn.textContent = label;
      btn.addEventListener("click", async () => {
        inputArea.innerHTML = "";
        addBubble(label, "user");
        const res = await enviarTexto(comando);
        await procesarRespuesta(res);
      });
      wrap.appendChild(btn);
    });
    inputArea.innerHTML = "";
    inputArea.appendChild(wrap);
  }

  cancelBtn.addEventListener("click", async () => {
    addBubble("Cancelar", "user");
    const res = await enviarTexto("cancelar");
    await procesarRespuesta(res);
  });

  setActivo(false);
}
