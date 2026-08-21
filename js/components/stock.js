// ============================================================================
// stock.js — "Entrada y salida de stock": alterna dirección, formulario y
// libro de movimientos (ledger).
// ============================================================================

import { CONFIG } from "../config.js";
import { store } from "../state.js";
import { api } from "../api.js";
import { showToast } from "./toast.js";

let direction = "entrada";

export function initStock() {
  const toggle = document.getElementById("stockDirectionToggle");
  const form = document.getElementById("stockForm");
  const typeSelect = document.getElementById("stockType");
  const qtyInput = document.getElementById("stockQty");
  const qtyLabel = document.getElementById("stockQtyLabel");
  const dateInput = document.getElementById("stockDate");
  const noteInput = document.getElementById("stockNote");
  const submitLabel = document.getElementById("stockSubmitLabel");
  const status = document.getElementById("stockFormStatus");
  const ledger = document.getElementById("stockLedger");

  Object.entries(CONFIG.stockTypes).forEach(([value, def]) => {
    const opt = typeSelect.querySelector(`option[value="${value}"]`);
    if (opt) opt.textContent = def.label;
  });

  dateInput.valueAsDate = new Date();

  function setDirection(dir) {
    direction = dir;
    toggle.querySelectorAll(".segmented__btn").forEach((btn) => {
      const active = btn.dataset.direction === dir;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", String(active));
    });
    submitLabel.textContent = dir === "entrada" ? "Registrar entrada" : "Registrar salida";
  }

  toggle.addEventListener("click", (e) => {
    const btn = e.target.closest(".segmented__btn");
    if (btn) setDirection(btn.dataset.direction);
  });

  typeSelect.addEventListener("change", () => {
    const def = CONFIG.stockTypes[typeSelect.value];
    qtyLabel.textContent = def ? `Cantidad (${def.unit})` : "Cantidad";
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const type = typeSelect.value;
    const qty = Number(qtyInput.value);

    if (!type || !qty || qty <= 0) {
      status.textContent = "Completá tipo y cantidad.";
      status.classList.add("is-error");
      return;
    }

    const submitBtn = form.querySelector("button[type=submit]");
    submitBtn.disabled = true;
    status.classList.remove("is-error");
    status.textContent = "Guardando…";

    try {
      await api.registrarMovimiento({
        direction,
        type,
        qty,
        date: dateInput.value,
        note: noteInput.value.trim(),
      });
      showToast(direction === "entrada" ? "Entrada registrada" : "Salida registrada");
      form.reset();
      dateInput.valueAsDate = new Date();
      qtyLabel.textContent = "Cantidad";
      status.textContent = "";
    } catch (err) {
      status.textContent = "No se pudo registrar el movimiento.";
      status.classList.add("is-error");
    } finally {
      submitBtn.disabled = false;
    }
  });

  function renderLedger() {
    const { movimientos } = store.get();
    if (!movimientos.length) {
      ledger.innerHTML = `<p class="panel__desc">Sin movimientos todavía.</p>`;
      return;
    }
    ledger.innerHTML = movimientos
      .slice(0, 8)
      .map((m) => {
        const def = CONFIG.stockTypes[m.type];
        const sign = m.direction === "entrada" ? "+" : "−";
        const date = new Date(m.date + "T00:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
        return `
          <div class="ledger__row ledger__row--${m.direction}">
            <span class="ledger__dot"></span>
            <span>
              <span class="ledger__label">${def?.label ?? m.type}</span>
              ${m.note ? `<span class="ledger__note">${m.note}</span>` : ""}
            </span>
            <span class="ledger__amount">${sign}${m.qty} ${def?.unit ?? ""}</span>
            <span class="ledger__date">${date}</span>
          </div>`;
      })
      .join("");
  }

  store.subscribe(renderLedger);
  setDirection("entrada");
  renderLedger();
}
