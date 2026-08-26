// ============================================================================
// flowClient.js
//
// n8n (nodo "Router de estado") no tiene un endpoint de "un solo request"
// para registrar algo: solo entiende una conversación paso a paso, igual
// que si alguien la tipeara en el chat. Los formularios de esta web juntan
// todos los datos de antemano en una sola pantalla; este módulo es el
// puente que traduce eso a la conversación que n8n espera, sin que el
// usuario vea el ida y vuelta.
//
// Mientras no exista en n8n una rama que reciba el registro completo de
// una sola vez, cualquier formulario nuevo que hable con Chaja Bot debería
// pasar por acá.
// ============================================================================

import { enviarTexto } from "./api.js";

const RECHAZADO = /^❗/; // así empiezan todos los mensajes de validación de "Router de estado"

/**
 * Manda una secuencia de textos, en orden, como si el usuario los hubiera
 * tipeado uno por uno. Si n8n rechaza alguno (dato inválido) o falla la
 * conexión, aborta y manda "cancelar" para no dejar un estado a medio
 * completar en la fila del usuario.
 *
 * @param {Array<string|number>} pasos
 * @returns {Promise<{ok: boolean, mensaje: string, grafico_url?: string|null}>}
 */
export async function runFlow(pasos) {
  let ultima = null;

  for (const paso of pasos) {
    ultima = await enviarTexto(String(paso));

    const rechazado = !ultima.ok || RECHAZADO.test((ultima.mensaje || "").trim());
    if (rechazado) {
      await enviarTexto("cancelar");
      return {
        ok: false,
        mensaje: ultima.mensaje || "El servidor rechazó uno de los datos enviados.",
      };
    }
  }

  return ultima ?? { ok: false, mensaje: "No se envió ningún dato." };
}

/** Azúcar sintáctica para comandos de un solo mensaje (balance, resumen, info, gráfico...). */
export async function runComando(texto) {
  return runFlow([texto]);
}

/** Convierte "yyyy-mm-dd" (input type=date) al formato dd/mm/aaaa que espera n8n. */
export function fechaAFormatoBot(iso) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
