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
import { showToast } from "./toast.js";

let tipo = null;
let evento = null; // solo aplica cuando tipo === "cerdos"

const LABELS_TIPO = { gallinas: "🥚 Gallinas", pollos: "🐔 Pollos", cerdos: "🐖 Cerdos", huerta: "🥬 Huerta" };
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
  const campoProduccionLabel = document.getElementById("campoProduccionLabel");
  const observacionInput = document.getElementById("productionObservacion");

  function resetWizard() {
    tipo = null;
    evento = null;
    stepTipo.hidden = false;
    stepEvento.hidden = true;
    form.hidden = true;
    status.textContent = "";
    status.classList.remove("is-error");
    form.reset();
    [campoEstandar, campoCelo, campoParto, campoDestete, campoSanidad].forEach((c) => (c.hidden = true));
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
  function mostrarFormulario() {
    stepTipo.hidden = true;
    stepEvento.hidden = true;
    form.hidden = false;
    stepLabel.textContent = "Paso 3 — Completá los datos";
    formType.textContent = tipo === "cerdos" ? `${LABELS_TIPO.cerdos} · ${evento}` : LABELS_TIPO[tipo];

    [campoEstandar, campoCelo, campoParto, campoDestete, campoSanidad].forEach((c) => (c.hidden = true));

    if (evento === "celo") {
      campoCelo.hidden = false;
    } else if (evento === "parto") {
      campoParto.hidden = false;
    } else if (evento === "destete") {
      campoDestete.hidden = false;
    } else if (evento === "sanidad") {
      campoSanidad.hidden = false;
    } else {
      // produccion (gallinas/pollos/huerta, o cerdos + evento "produccion")
      campoEstandar.hidden = false;
      campoCantidadLabel.textContent = tipo === "huerta" ? "Metros cuadrados de huerta" : "Cantidad de animales";
      campoProduccionLabel.textContent = LABELS_PRODUCCION[tipo] || "Producción de hoy";
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
      const cantidad = num(document.getElementById("campoCantidad"));
      const alimento = num(document.getElementById("campoAlimentoKg"));
      const precio = num(document.getElementById("campoPrecioAlimento"));
      const produccion = num(document.getElementById("campoProduccion"));
      if (isNaN(cantidad) || cantidad <= 0) return { error: "Ingresá una cantidad de animales válida." };
      if (isNaN(alimento) || alimento < 0) return { error: "Ingresá un consumo de alimento válido." };
      if (isNaN(precio) || precio < 0) return { error: "Ingresá un precio de alimento válido." };
      if (isNaN(produccion) || produccion < 0) return { error: "Ingresá una producción de hoy válida." };
      pasos.push(cantidad, alimento, precio, produccion);
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
