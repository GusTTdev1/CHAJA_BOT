// ============================================================================
// production.js — "Registrar nuevas producciones": modal, formulario dinámico
// y listado. Agregar un nuevo tipo de producción sólo requiere una entrada
// en CONFIG.productionTypes (config.js); esta vista no necesita cambios.
// ============================================================================

import { CONFIG } from "../config.js";
import { store } from "../state.js";
import { api } from "../api.js";
import { showToast } from "./toast.js";

let selectedType = null;

function fieldNeeded(field) {
  return CONFIG.productionTypes[selectedType]?.fields.includes(field);
}

export function initProduction() {
  const scrim = document.getElementById("productionModalScrim");
  const openBtn = document.getElementById("openProductionModal");
  const closeBtn = document.getElementById("productionModalClose");
  const typeSelect = document.getElementById("productionTypeSelect");
  const form = document.getElementById("productionForm");
  const stepLabel = document.getElementById("productionStepLabel");
  const backLink = document.getElementById("productionBack");
  const formType = document.getElementById("productionFormType");
  const ageField = document.getElementById("productionAgeField");
  const ageInput = document.getElementById("productionAge");
  const qtyInput = document.getElementById("productionQty");
  const nameInput = document.getElementById("productionName");
  const status = document.getElementById("productionFormStatus");
  const list = document.getElementById("productionList");

  function openModal() {
    scrim.hidden = false;
    showStep1();
  }
  function closeModal() {
    scrim.hidden = true;
    form.reset();
    status.textContent = "";
    selectedType = null;
  }
  function showStep1() {
    typeSelect.hidden = false;
    form.hidden = true;
    stepLabel.textContent = "Paso 1 — Elegí el tipo";
  }
  function showStep2(type) {
    selectedType = type;
    const def = CONFIG.productionTypes[type];
    typeSelect.hidden = true;
    form.hidden = false;
    stepLabel.textContent = "Paso 2 — Completá los datos";
    formType.textContent = `${def.icon} ${def.label}`;
    ageField.hidden = !fieldNeeded("age");
    ageInput.required = fieldNeeded("age");
  }

  openBtn.addEventListener("click", openModal);
  closeBtn.addEventListener("click", closeModal);
  scrim.addEventListener("click", (e) => { if (e.target === scrim) closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !scrim.hidden) closeModal(); });
  backLink.addEventListener("click", showStep1);

  typeSelect.querySelectorAll(".type-card").forEach((card) => {
    card.addEventListener("click", () => showStep2(card.dataset.type));
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const def = CONFIG.productionTypes[selectedType];
    const qty = Number(qtyInput.value);
    const age = fieldNeeded("age") ? Number(ageInput.value) : null;

    if (!qty || qty < 1) {
      status.textContent = "Ingresá una cantidad válida.";
      status.classList.add("is-error");
      return;
    }

    const submitBtn = form.querySelector("button[type=submit]");
    submitBtn.disabled = true;
    status.classList.remove("is-error");
    status.textContent = "Guardando…";

    const name = nameInput.value.trim() || `${def.label} — ${new Date().toLocaleDateString("es-AR")}`;
    const result = await api.crearProduccion({ type: selectedType, name, qty, age });

    if (!result.ok) {
      status.textContent = result.mensaje || "No se pudo guardar. Probá de nuevo.";
      status.classList.add("is-error");
      submitBtn.disabled = false;
      return;
    }

    // TODO: mientras no exista la vista real de Historial/Balance (spec
    // secciones 15-17) conectada a n8n, agregamos el registro también acá
    // localmente para poder ver algo en la lista. El dato de verdad queda
    // en Google Sheets vía n8n, esto es solo un espejo provisorio en UI.
    store.addProduccion({ type: selectedType, name, qty, age });
    showToast(result.mensaje || "Producción registrada");
    closeModal();
    submitBtn.disabled = false;
  });

  function renderList() {
    const { producciones } = store.get();
    if (!producciones.length) {
      list.innerHTML = `<p class="panel__desc">Todavía no registraste ninguna producción.</p>`;
      return;
    }
    list.innerHTML = producciones
      .map((p) => {
        const def = CONFIG.productionTypes[p.type];
        const ageText = p.age != null ? ` · ${p.age} sem.` : "";
        return `
          <div class="production-item">
            <span class="production-item__icon">${def.icon}</span>
            <p class="production-item__name">${p.name}</p>
            <p class="production-item__meta"><span class="production-item__count">${p.qty}</span> animales${ageText}</p>
          </div>`;
      })
      .join("");
  }

  store.subscribe(renderList);
  renderList();
}

export function getProductionOptionsHTML() {
  const { producciones } = store.get();
  return producciones
    .map((p) => `<option value="${p.id}">${p.name} (${p.qty} animales)</option>`)
    .join("");
}
