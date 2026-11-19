// ============================================================================
// actividad.js — "Actividad por fecha": Router de estado abre el flujo con
// "/actividad" y en el siguiente mensaje espera la fecha en dd/mm/aaaa.
// ============================================================================

import { runFlow, fechaAFormatoBot } from "../flowClient.js";

export function initActividad() {
  const form = document.getElementById("actividadForm");
  const fechaInput = document.getElementById("actividadFecha");
  const status = document.getElementById("actividadFormStatus");
  const resultBox = document.getElementById("actividadResult");
  if (!form) return;

  fechaInput.valueAsDate = new Date();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!fechaInput.value) return;

    const submitBtn = form.querySelector("button[type=submit]");
    submitBtn.disabled = true;
    status.textContent = "Consultando…";

    const res = await runFlow(["/actividad", fechaAFormatoBot(fechaInput.value)]);

    submitBtn.disabled = false;
    status.textContent = "";
    resultBox.hidden = false;
    resultBox.classList.toggle("is-error", !res.ok);
    resultBox.textContent = res.mensaje;
  });
}
