// ============================================================================
// api.js
// Capa de datos. Hoy delega todo al store en memoria (state.js) para poder
// demostrar la interfaz con datos de ejemplo. Cuando exista un backend o
// flujos de n8n reales, cada función pasa a hacer fetch(`${CONFIG.api.baseUrl}...`)
// y devolver una Promise — las vistas que la consumen (components/*.js) ya
// están escritas con async/await, así que no deberían necesitar cambios.
//
// enviarTexto() sí es real: le habla al webhook de n8n. Antes generaba su
// propio usuario_id (UUID al azar en localStorage); ahora ese usuario_id
// sale de auth.js — no cambia nada de cómo se llama a enviarTexto() desde
// flowClient.js ni desde los componentes.
// ============================================================================

import { CONFIG } from "./config.js";
import { store } from "./state.js";
import { getNombre, getUsuarioId } from "./auth.js";

const SIMULATED_LATENCY_MS = 250;

function simulate(fn) {
  return new Promise((resolve) => setTimeout(() => resolve(fn()), SIMULATED_LATENCY_MS));
}

export async function enviarTexto(texto) {
  const usuarioId = getUsuarioId();
  if (!usuarioId) {
    // Sólo puede pasar con Auth0 habilitado y todavía sin sesión: no hay
    // identidad estable para mandarle a n8n. Mejor frenar acá con un
    // mensaje claro que mandar un usuario_id que después no se puede
    // recuperar (o, peor, uno vacío que pisaría filas de otra familia).
    return { ok: false, mensaje: "Iniciá sesión para poder registrar datos." };
  }

  try {
    const res = await fetch(CONFIG.api.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        texto,
        usuario_id: usuarioId,
        first_name: getNombre(),
        origen: "web",
      }),
    });
    if (!res.ok) return { ok: false, mensaje: `Error del servidor (${res.status})` };
    return await res.json();
  } catch (err) {
    return { ok: false, mensaje: "No se pudo conectar con el servidor." };
  }
}

export const api = {
  async crearProduccion(payload) {
    // futuro: return fetch(`${CONFIG.api.baseUrl}${CONFIG.api.endpoints.producciones}`, { method: "POST", body: JSON.stringify(payload) })
    return simulate(() => store.addProduccion(payload));
  },
  async crearGrupo(payload) {
    return simulate(() => store.addGrupo(payload));
  },
  async registrarMovimiento(payload) {
    return simulate(() => store.addMovimiento(payload));
  },
};
