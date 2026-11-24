// ============================================================================
// consultas.js — "Análisis de la producción": informe mensual, resumen de
// producción e historial completo son comandos de un solo mensaje para
// Router de estado (no abren ningún flujo de varios pasos), así que cada
// botón dispara un único enviarTexto por dentro de runComando().
// ============================================================================

import { runComando } from "../flowClient.js";
import { abrirInforme, cerrarInforme } from "./informeMensual.js";

export function initConsultas() {
  const menu = document.querySelector("#consultas .cc-menu");
  const resultBox = document.getElementById("consultasResult");
  if (!menu) return;

  menu.querySelectorAll("[data-consulta]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      // "Informe mensual" tiene su propio panel (informeMensual.js); no pasa por el chat de n8n.
      if (btn.dataset.consulta === "informe") {
        resultBox.hidden = true;
        await abrirInforme();
        return;
      }
      cerrarInforme();
      menu.querySelectorAll("button").forEach((b) => (b.disabled = true));
      resultBox.hidden = false;
      resultBox.classList.remove("is-error");
      resultBox.textContent = "Consultando…";

      const res = await runComando(btn.dataset.consulta);

      resultBox.classList.toggle("is-error", !res.ok);
      resultBox.textContent = res.mensaje;
      menu.querySelectorAll("button").forEach((b) => (b.disabled = false));
    });
  });
}
