// ============================================================================
// empleados.js — panel de configuración "¿tenés empleados contratados?",
// por tipo de producción. Apagado por defecto: no afecta ningún cálculo
// hasta que se activa para esa producción.
//
// Cada tipo configurado se manda como su propia mini-conversación al mismo
// Router de estado de siempre (flujo "empleados": tipo -> activar -> sueldo
// si corresponde), reusando flowClient.runFlow() igual que el resto de los
// formularios. Se guarda en una hoja de configuración aparte (no en los
// registros de producción), y "preparar registro" la lee para sumar el
// costo de mano de obra al precio sugerido.
// ============================================================================

import { runFlow } from "../flowClient.js";

const TIPOS = ["gallinas", "pollos", "cerdos", "huerta"];

export function initEmpleados() {
  const lista = document.getElementById("empleadosList");
  const guardarBtn = document.getElementById("empleadosGuardar");
  const status = document.getElementById("empleadosStatus");
  const resultBox = document.getElementById("empleadosResult");
  if (!lista) return;

  const filas = {};
  TIPOS.forEach((tipo) => {
    const row = lista.querySelector(`.empleados-row[data-tipo="${tipo}"]`);
    if (!row) return;
    const toggle = row.querySelector(".empleados-row__toggle");
    const sueldoWrap = row.querySelector(".empleados-row__sueldo");
    const sueldoInput = sueldoWrap.querySelector("input");
    toggle.addEventListener("change", () => {
      sueldoWrap.hidden = !toggle.checked;
      if (!toggle.checked) sueldoInput.value = "";
    });
    filas[tipo] = { toggle, sueldoInput };
  });

  guardarBtn.addEventListener("click", async () => {
    // Validar sueldos antes de mandar nada: si alguno está activado sin
    // sueldo válido, mejor frenar todo que guardar 3 de 4 y confundir.
    for (const tipo of TIPOS) {
      const { toggle, sueldoInput } = filas[tipo];
      if (toggle.checked) {
        const n = Number(sueldoInput.value.replace(",", "."));
        if (!Number.isFinite(n) || n < 0) {
          status.textContent = `Ingresá un sueldo válido para ${tipo}.`;
          status.classList.add("is-error");
          return;
        }
      }
    }

    guardarBtn.disabled = true;
    status.classList.remove("is-error");
    resultBox.hidden = true;

    const mensajes = [];
    let huboError = false;

    for (const tipo of TIPOS) {
      const { toggle, sueldoInput } = filas[tipo];
      status.textContent = `Guardando ${tipo}…`;
      const pasos = toggle.checked
        ? ["empleados", tipo, "si", Number(sueldoInput.value.replace(",", "."))]
        : ["empleados", tipo, "no"];

      const res = await runFlow(pasos);
      if (!res.ok) huboError = true;
      mensajes.push(`${tipo}: ${res.mensaje}`);
    }

    guardarBtn.disabled = false;
    status.textContent = "";

    resultBox.hidden = false;
    resultBox.classList.toggle("is-error", huboError);
    resultBox.textContent = mensajes.join("\n");
  });
}
