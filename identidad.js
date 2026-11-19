// ============================================================================
// identidad.js — el nombre que se guarda como "agente" en cada registro
// (api.js lo manda como first_name en cada request). Antes vivía sólo
// dentro del Centro de comandos; ahora es una franja fija arriba de todo,
// porque todos los formularios reales lo necesitan.
// ============================================================================

import { getNombre, setNombre } from "../auth.js";

export function initIdentidad() {
  const input = document.getElementById("agenteNombre");
  if (!input) return;

  input.value = getNombre() === "Web" ? "" : getNombre();
  input.addEventListener("change", () => setNombre(input.value.trim()));
}
