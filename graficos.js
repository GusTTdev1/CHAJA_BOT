// ============================================================================
// graficos.js — "Gráficos": "grafico <tipo> <categoria>" es, para Router de
// estado, un comando de un solo mensaje (no abre ningún flujo), así que
// alcanza con un runComando(). La respuesta trae grafico_url (QuickChart)
// cuando corresponde.
// ============================================================================

import { runComando } from "../flowClient.js";

export function initGraficos() {
  const form = document.getElementById("graficosForm");
  const categoriaSelect = document.getElementById("graficoCategoria");
  const tipoSelect = document.getElementById("graficoTipo");
  const status = document.getElementById("graficosFormStatus");
  const resultBox = document.getElementById("graficosResult");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const comando = `grafico ${tipoSelect.value} ${categoriaSelect.value}`;

    const submitBtn = form.querySelector("button[type=submit]");
    submitBtn.disabled = true;
    status.textContent = "Generando gráfico…";

    const res = await runComando(comando);

    submitBtn.disabled = false;
    status.textContent = "";
    resultBox.hidden = false;
    resultBox.classList.toggle("is-error", !res.ok);
    resultBox.innerHTML = "";
    resultBox.appendChild(document.createTextNode(res.mensaje || ""));

    if (res.ok && res.grafico_url) {
      const img = document.createElement("img");
      img.className = "result-box__img";
      img.src = res.grafico_url;
      img.alt = "Gráfico generado";
      resultBox.appendChild(img);
    }
  });
}
