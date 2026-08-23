// ============================================================================
// api.js
// Única puerta de entrada a n8n.
//
// IMPORTANTE — este es el contrato REAL, según cómo está armado el workflow
// (Normalizar entrada → Router de estado → ... ver CHAJA_BOT_WEB.json):
// n8n guarda el estado (flujo/paso/datos) en la hoja "estados" indexado por
// usuario_id. La web NO necesita mandar flujo/paso/datos — solo manda,
// en cada paso, el equivalente a lo que un usuario de Discord tipearía:
//
//   request:  { usuario_id, texto, first_name, origen: "web" }
//   response: { ok, mensaje, accion, grafico_url }
//
// "texto" es genérico: puede ser un comando ("registrar", "balance",
// "cancelar", "reiniciar"), una opción de un paso ("gallinas", "produccion"),
// un número, una fecha (dd/mm/aaaa) o una observación en texto libre. n8n
// decide qué significa según el paso en el que esté el usuario — la web NO
// interpreta nada de esto, solo junta la respuesta del usuario y la manda.
// ============================================================================

import { CONFIG } from "./config.js";
import { getUsuarioId, getNombre } from "./auth.js";

/**
 * Envía el "texto" del paso actual a n8n y devuelve la respuesta parseada.
 * @param {string} texto
 * @returns {Promise<{ok:boolean, mensaje:string, accion:?string, grafico_url:?string}>}
 */
export async function enviarTexto(texto) {
  const body = {
    usuario_id: getUsuarioId(),
    first_name: getNombre(),
    origen: "web",
    texto: String(texto ?? ""),
  };

  let response;
  try {
    response = await fetch(CONFIG.api.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (networkErr) {
    return { ok: false, mensaje: "No se pudo conectar con Chaja Bot. Intentá nuevamente." };
  }

  if (!response.ok) {
    return { ok: false, mensaje: `Chaja Bot respondió con un error (HTTP ${response.status}). Intentá nuevamente.` };
  }

  try {
    const data = await response.json();
    return {
      ok: data.ok !== false,
      mensaje: data.mensaje ?? "",
      accion: data.accion ?? null,
      grafico_url: data.grafico_url ?? null,
      raw: data,
    };
  } catch (parseErr) {
    return { ok: false, mensaje: "Chaja Bot devolvió una respuesta inesperada. Intentá nuevamente." };
  }
}

// Atajos para los comandos de un solo tiro (no abren un wizard de pasos).
export const api = {
  balance: () => enviarTexto("balance"),
  historial: () => enviarTexto("info"),
  resumen: () => enviarTexto("resumen"),
  cancelar: () => enviarTexto("cancelar"),
  reiniciar: () => enviarTexto("reiniciar"),
  // Comandos que ABREN un wizard de varios pasos (ver components/wizard.js):
  registrar: () => enviarTexto("registrar"),
  alta: () => enviarTexto("alta"),
  baja: () => enviarTexto("baja"),
// ----------------------------------------------------------------------------
// Compatibilidad con los paneles "demo" (production.js, stock.js, groups.js).
// Esos formularios juntan varios campos en un solo submit, lo cual NO calza
// con el motor real de n8n (que espera un "texto" por paso, ver arriba).
// Hasta que se decida si esos paneles se reemplazan por el Centro de
// comandos (components/commandCenter.js, que sí habla el protocolo real),
// quedan operando en modo demo local, sin pegarle a n8n, para no mandar
// datos truchos. El registro/alta/baja REAL ya funciona desde ahí.
// ----------------------------------------------------------------------------
import { store } from "./state.js";

Object.assign(api, {
  async crearProduccion(payload) {
    return { ok: true, mensaje: "", datos: store.addProduccion(payload) };
  },
  async registrarMovimiento(payload) {
    return { ok: true, mensaje: "", datos: store.addMovimiento(payload) };
  },
  async crearGrupo(payload) {
    return { ok: true, mensaje: "", datos: store.addGrupo(payload) };
  },
});
