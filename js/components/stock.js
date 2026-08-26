// ============================================================================
// stock.js — "Alta / Baja de stock": un solo formulario, un solo submit.
// Por dentro manda la secuencia real que espera el flujo "ajuste_stock" de
// Router de estado: [alta|baja, tipo_produccion, cantidad, observación].
// ============================================================================

import { runFlow } from "../flowClient.js";
import { showToast } from "./toast.js";

let direction = "alta";

export function initStock() {
  const toggle = document.getElementById("stockDirectionToggle");
  const form = document.getElementById("stockForm");
  const typeSelect = document.getElementById("stockType");
  const qtyInput = document.getElementById("stockQty");
  const qtyLabel = document.getElementById("stockQtyLabel");
  const noteInput = document.getElementById("stockNote");
  const submitLabel = document.getElementById("stockSubmitLabel");
  const status = document.getElementById("stockFormStatus");
  const resultBox = document.getElementById("stockResult");

  function setDirection(dir) {
    direction = dir;
    toggle.querySelectorAll(".segmented__btn").forEach((btn) => {
      const active = btn.dataset.direction === dir;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", String(active));
    });
    submitLabel.textContent = dir === "alta" ? "Registrar alta" : "Registrar baja";
  }

  toggle.addEventListener("click", (e) => {
    const btn = e.target.closest(".segmented__btn");
    if (btn) setDirection(btn.dataset.direction);
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const tipo = typeSelect.value;
    const qty = Number(qtyInput.value);

    if (!tipo || !qty || qty <= 0) {
      status.textContent = "Completá tipo y cantidad.";
      status.classList.add("is-error");
      return;
    }

    const submitBtn = form.querySelector("button[type=submit]");
    submitBtn.disabled = true;
    status.classList.remove("is-error");
    status.textContent = "Guardando en Chaja Bot…";

    const observacion = noteInput.value.trim();
    const res = await runFlow([direction, tipo, qty, observacion || "no"]);

    submitBtn.disabled = false;
    status.textContent = "";

    resultBox.hidden = false;
    resultBox.classList.toggle("is-error", !res.ok);
    resultBox.textContent = res.mensaje;

    if (res.ok) {
      showToast(direction === "alta" ? "Alta registrada" : "Baja registrada");
      form.reset();
      qtyLabel.textContent = "Cantidad";
      setDirection("alta");
    }
  });

  setDirection("alta");
}
