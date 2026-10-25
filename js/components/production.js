// ============================================================================
// production.js — "Registrar producción": modal con wizard interno (tipo →
// evento si es cerdos → campos según la rama → observación). No manda nada
// a n8n hasta el submit final: ahí arma la secuencia exacta que espera
// "Router de estado" y la manda de punta a punta con flowClient.runFlow().
//
// Nota: getProductionOptionsHTML() sigue leyendo del store local (datos de
// ejemplo) para alimentar el selector de "producción de origen" del panel
// de Grupos — Chaja Bot todavía no expone un endpoint para listar
// producciones ya registradas, así que ese acople queda pendiente.
// ============================================================================

import { store } from "../state.js";
import { runFlow } from "../flowClient.js";
import { consultarStock } from "../api.js";
import { showToast } from "./toast.js";

let tipo = null;
let evento = null; // solo aplica cuando tipo === "cerdos"
// true/false una vez que se sabe si hay que pedir la cantidad inicial;
// null mientras se está consultando o si la consulta falló (en ese caso no
// se deja enviar el formulario — ver mostrarFormulario()/armarSecuencia()).
let cantidadInicialRequerida = null;

const LABELS_TIPO = { gallinas: "Gallinas", pollos: "Pollos", cerdos: "Cerdos", huerta: "Huerta" };
const LABELS_PRODUCCION = {
  gallinas: "¿Cuántos huevos juntaste hoy?",
  pollos: "¿Cuántos kilos de pollo obtuviste hoy?",
  cerdos: "¿Cuántos kilos pesaron en total hoy?",
  huerta: "¿Cuántos kilos cosechaste hoy?",
};

export function initProduction() {
  const scrim = document.getElementById("productionModalScrim");
  const openBtn = document.getElementById("openProductionModal");
  const closeBtn = document.getElementById("productionModalClose");
  const stepTipo = document.querySelector('[data-step="tipo"]');
  const stepEvento = document.querySelector('[data-step="evento"]');
  const form = document.getElementById("productionForm");
  const stepLabel = document.getElementById("productionStepLabel");
  const backBtn = document.getElementById("productionBack");
  const formType = document.getElementById("productionFormType");
  const status = document.getElementById("productionFormStatus");
  const resultBox = document.getElementById("productionResult");

  const campoEstandar = document.getElementById("campoEstandar");
  const campoCelo = document.getElementById("campoCelo");
  const campoParto = document.getElementById("campoParto");
  const campoDestete = document.getElementById("campoDestete");
  const campoSanidad = document.getElementById("campoSanidad");
  const campoCantidadLabel = document.getElementById("campoCantidadLabel");
  const campoCantidadWrap = document.getElementById("campoCantidadWrap");
  const campoCantidadCargando = document.getElementById("campoCantidadCargando");
  const campoProduccionLabel = document.getElementById("campoProduccionLabel");
  const campoAlimentoWrap = document.getElementById("campoAlimentoWrap");
  const campoPrecioAlimentoWrap = document.getElementById("campoPrecioAlimentoWrap");
  const observacionInput = document.getElementById("productionObservacion");
  const submitBtn = form.querySelector("button[type=submit]");

  function resetWizard() {
    tipo = null;
    evento = null;
    cantidadInicialRequerida = null;
    stepTipo.hidden = false;
    stepEvento.hidden = true;
    form.hidden = true;
    status.textContent = "";
    status.classList.remove("is-error");
    form.reset();
    [campoEstandar, campoCelo, campoParto, campoDestete, campoSanidad].forEach((c) => (c.hidden = true));
    campoCantidadWrap.hidden = true;
    campoCantidadCargando.hidden = true;
    submitBtn.disabled = false;
    stepLabel.textContent = "Paso 1 — Elegí el área";
  }

  function openModal() {
    resultBox.hidden = true;
    scrim.hidden = false;
    resetWizard();
  }
  function closeModal() {
    scrim.hidden = true;
  }

  openBtn.addEventListener("click", openModal);
  closeBtn.addEventListener("click", closeModal);
  scrim.addEventListener("click", (e) => { if (e.target === scrim) closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !scrim.hidden) closeModal(); });

  // --- Paso 1: elegir tipo -------------------------------------------------
  stepTipo.querySelectorAll("[data-tipo]").forEach((card) => {
    card.addEventListener("click", () => {
      tipo = card.dataset.tipo;
      if (tipo === "cerdos") {
        stepTipo.hidden = true;
        stepEvento.hidden = false;
        stepLabel.textContent = "Paso 2 — Elegí el evento";
      } else {
        evento = "produccion";
        mostrarFormulario();
      }
    });
  });

  // --- Paso 2 (solo cerdos): elegir evento --------------------------------
  stepEvento.querySelectorAll("[data-evento]").forEach((card) => {
    card.addEventListener("click", () => {
      evento = card.dataset.evento;
      mostrarFormulario();
    });
  });
  stepEvento.querySelector('[data-back="tipo"]').addEventListener("click", () => {
    tipo = null;
    stepEvento.hidden = true;
    stepTipo.hidden = false;
    stepLabel.textContent = "Paso 1 — Elegí el área";
  });

  // --- Paso 3: formulario final, campos según la rama ---------------------
  async function mostrarFormulario() {
    stepTipo.hidden = true;
    stepEvento.hidden = true;
    form.hidden = false;
    stepLabel.textContent = "Paso 3 — Completá los datos";
    formType.textContent = tipo === "cerdos" ? `${LABELS_TIPO.cerdos} · ${evento}` : LABELS_TIPO[tipo];

    [campoEstandar, campoCelo, campoParto, campoDestete, campoSanidad].forEach((c) => (c.hidden = true));
    campoCantidadWrap.hidden = true;
    campoCantidadCargando.hidden = true;

    if (evento === "celo") {
      campoCelo.hidden = false;
    } else if (evento === "parto") {
      campoParto.hidden = false;
    } else if (evento === "destete") {
      campoDestete.hidden = false;
    } else if (evento === "sanidad") {
      campoSanidad.hidden = false;
    } else {
      // produccion (gallinas/pollos/huerta, o cerdos + evento "produccion"):
      // el Router de estado sólo pide la cantidad total la PRIMERA vez que
      // se registra esta categoría — hay que consultarlo antes de mostrar
      // ese campo, para no mandar un paso de más (o de menos) y desalinear
      // toda la secuencia con lo que el Router espera a continuación.
      campoEstandar.hidden = false;
      campoProduccionLabel.textContent = LABELS_PRODUCCION[tipo] || "Producción de hoy";
      campoCantidadLabel.textContent = tipo === "huerta" ? "Metros cuadrados de huerta (total)" : "Cantidad de animales (total)";
      // La huerta no pasa por alimento balanceado (ver Router de estado).
      const esHuerta = tipo === "huerta";
      campoAlimentoWrap.hidden = esHuerta;
      campoPrecioAlimentoWrap.hidden = esHuerta;

      cantidadInicialRequerida = null;
      campoCantidadCargando.hidden = false;
      submitBtn.disabled = true;

      const { ok, stockActual } = await consultarStock();

      // Si en el medio el usuario volvió atrás o cerró el modal, no pisar
      // nada de lo que esté mostrando ahora.
      if (tipo === null || form.hidden) return;

      campoCantidadCargando.hidden = true;
      submitBtn.disabled = false;

      if (!ok) {
        status.textContent = "No se pudo verificar el stock actual. Probá cerrar y abrir de nuevo el formulario.";
        status.classList.add("is-error");
        submitBtn.disabled = true;
        return;
      }

      const yaTieneStock = Object.prototype.hasOwnProperty.call(stockActual, tipo) && stockActual[tipo] !== null;
      cantidadInicialRequerida = !yaTieneStock;
      campoCantidadWrap.hidden = yaTieneStock;
    }
  }

  backBtn.addEventListener("click", () => {
    if (tipo === "cerdos") {
      form.hidden = true;
      stepEvento.hidden = false;
      stepLabel.textContent = "Paso 2 — Elegí el evento";
    } else {
      resetWizard();
    }
  });

  // --- Armar la secuencia real y mandarla ---------------------------------
  function num(el) {
    const n = Number(el.value.replace(",", "."));
    return Number.isFinite(n) ? n : NaN;
  }

  function armarSecuencia() {
    const pasos = ["registrar", tipo];
    if (tipo === "cerdos") pasos.push(evento);

    if (evento === "celo") {
      const cerda = document.getElementById("campoCerda").value.trim();
      if (!cerda) return { error: "Ingresá la identificación de la cerda." };
      pasos.push(cerda);
    } else if (evento === "parto") {
      const n = num(document.getElementById("campoLechonesVivos"));
      if (isNaN(n) || n < 0) return { error: "Ingresá un número válido de lechones." };
      pasos.push(n);
    } else if (evento === "destete") {
      const n = num(document.getElementById("campoLechonesDestete"));
      if (isNaN(n) || n <= 0) return { error: "Ingresá un número válido de lechones." };
      pasos.push(n);
    } else if (evento === "sanidad") {
      const tratamiento = document.getElementById("campoTratamiento").value.trim();
      const costo = num(document.getElementById("campoCostoSanidad"));
      if (!tratamiento) return { error: "Describí el tratamiento aplicado." };
      if (isNaN(costo) || costo < 0) return { error: "Ingresá un costo válido." };
      pasos.push(tratamiento, costo);
    } else {
      if (cantidadInicialRequerida === null) {
        return { error: "Todavía se está verificando el stock actual, esperá un segundo y volvé a enviar." };
      }
      if (cantidadInicialRequerida) {
        const cantidad = num(document.getElementById("campoCantidad"));
        if (isNaN(cantidad) || cantidad <= 0) return { error: "Ingresá una cantidad total válida." };
        pasos.push(cantidad);
      }
      if (tipo !== "huerta") {
        const alimento = num(document.getElementById("campoAlimentoKg"));
        const precio = num(document.getElementById("campoPrecioAlimento"));
        if (isNaN(alimento) || alimento < 0) return { error: "Ingresá un consumo de alimento válido." };
        if (isNaN(precio) || precio < 0) return { error: "Ingresá un precio de alimento válido." };
        pasos.push(alimento, precio);
      }
      const produccion = num(document.getElementById("campoProduccion"));
      if (isNaN(produccion) || produccion < 0) return { error: "Ingresá una producción de hoy válida." };
      pasos.push(produccion);
    }

    const observacion = observacionInput.value.trim();
    pasos.push(observacion || "no");
    return { pasos };
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const { pasos, error } = armarSecuencia();
    if (error) {
      status.textContent = error;
      status.classList.add("is-error");
      return;
    }

    const submitBtn = form.querySelector("button[type=submit]");
    submitBtn.disabled = true;
    status.classList.remove("is-error");
    status.textContent = "Guardando en Chaja Bot…";

    const res = await runFlow(pasos);

    submitBtn.disabled = false;
    status.textContent = "";

    resultBox.hidden = false;
    resultBox.classList.toggle("is-error", !res.ok);
    resultBox.textContent = res.mensaje;

    if (res.ok) {
      showToast("Registro guardado");
      closeModal();
      // Sólo para que el selector de "producción de origen" en Grupos (demo
      // local) tenga algo reciente para mostrar — no es un reflejo real de
      // lo que quedó guardado en Chaja Bot.
      store.addProduccion({ type: tipo, name: `${LABELS_TIPO[tipo] || tipo} — ${new Date().toLocaleDateString("es-AR")}`, qty: 0, age: null });
    }
  });
}

export function getProductionOptionsHTML() {
  const { producciones } = store.get();
  return producciones
    .map((p) => `<option value="${p.id}">${p.name} (${p.qty} animales)</option>`)
    .join("");
}
