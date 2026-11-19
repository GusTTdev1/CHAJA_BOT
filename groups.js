// ============================================================================
// groups.js — "Grupos de producción": separar animales de una producción en
// camadas de seguimiento independiente. El elemento distintivo es el
// "anillo de edad": un anillo de progreso que ubica la edad del grupo dentro
// de un ciclo productivo típico, como los anillos de crecimiento de un árbol.
// ============================================================================

import { store } from "../state.js";
import { api } from "../api.js";
import { showToast } from "./toast.js";
import { getProductionOptionsHTML } from "./production.js";

// Referencia aproximada de "ciclo completo" por unidad, sólo para dibujar el
// anillo de forma proporcional. No es un dato productivo real.
const CYCLE_REFERENCE = { días: 180, semanas: 30, meses: 24 };

function ringSVG(age, unit) {
  const ref = CYCLE_REFERENCE[unit] ?? 24;
  const pct = Math.max(0.04, Math.min(age / ref, 1));
  const r = 24;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct);
  return `
    <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
      <circle cx="28" cy="28" r="${r}" fill="none" stroke="var(--line)" stroke-width="5"/>
      <circle cx="28" cy="28" r="${r}" fill="none" stroke="var(--moss)" stroke-width="5"
        stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${offset}"
        transform="rotate(-90 28 28)"/>
      <text x="28" y="32" text-anchor="middle" font-family="var(--font-mono)" font-size="11" fill="var(--forest-dark)">${age}</text>
    </svg>`;
}

export function initGroups() {
  const grid = document.getElementById("groupsGrid");
  const scrim = document.getElementById("groupModalScrim");
  const openBtn = document.getElementById("openGroupModal");
  const closeBtn = document.getElementById("groupModalClose");
  const form = document.getElementById("groupForm");
  const sourceSelect = document.getElementById("groupSource");
  const nameInput = document.getElementById("groupName");
  const qtyInput = document.getElementById("groupQty");
  const ageInput = document.getElementById("groupAge");
  const unitSelect = document.getElementById("groupAgeUnit");
  const status = document.getElementById("groupFormStatus");

  function openModal() {
    sourceSelect.innerHTML = `<option value="" disabled selected>Elegir producción…</option>${getProductionOptionsHTML()}`;
    scrim.hidden = false;
  }
  function closeModal() {
    scrim.hidden = true;
    form.reset();
    status.textContent = "";
  }

  openBtn.addEventListener("click", openModal);
  closeBtn.addEventListener("click", closeModal);
  scrim.addEventListener("click", (e) => { if (e.target === scrim) closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !scrim.hidden) closeModal(); });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const sourceId = sourceSelect.value;
    const name = nameInput.value.trim();
    const qty = Number(qtyInput.value);
    const age = Number(ageInput.value);
    const ageUnit = unitSelect.value;

    if (!sourceId || !name || !qty || ageInput.value === "" || Number.isNaN(age) || age < 0) {
      status.textContent = "Completá todos los campos.";
      status.classList.add("is-error");
      return;
    }

    const submitBtn = form.querySelector("button[type=submit]");
    submitBtn.disabled = true;
    status.classList.remove("is-error");
    status.textContent = "Creando grupo…";

    try {
      await api.crearGrupo({ sourceId, name, qty, age, ageUnit });
      showToast("Grupo creado");
      closeModal();
    } catch (err) {
      status.textContent = "No se pudo crear el grupo.";
      status.classList.add("is-error");
    } finally {
      submitBtn.disabled = false;
    }
  });

  function renderGrid() {
    const { grupos, producciones } = store.get();
    if (!grupos.length) {
      grid.innerHTML = `
        <div class="group-card group-card--empty">
          <p>Todavía no armaste ningún grupo.</p>
          <button class="btn btn--outline" id="groupsEmptyCta">+ Nuevo grupo</button>
        </div>`;
      document.getElementById("groupsEmptyCta")?.addEventListener("click", openModal);
      return;
    }
    grid.innerHTML = grupos
      .map((g) => {
        const source = producciones.find((p) => p.id === g.sourceId);
        return `
          <div class="group-card">
            <span class="group-card__ring">${ringSVG(g.age, g.ageUnit)}</span>
            <div class="group-card__body">
              <p class="group-card__name">${g.name}</p>
              <p class="group-card__source">${source ? source.name : "Producción eliminada"}</p>
              <div class="group-card__stats">
                <span class="group-card__stat"><b>${g.qty}</b><span>animales</span></span>
                <span class="group-card__stat"><b>${g.age}</b><span>${g.ageUnit}</span></span>
              </div>
            </div>
          </div>`;
      })
      .join("");
  }

  store.subscribe(renderGrid);
  renderGrid();
}
