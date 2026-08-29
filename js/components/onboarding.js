// ============================================================================
// onboarding.js
//
// Resuelve el punto 2 del pedido: la primera vez que alguien se loguea (con
// Auth0, o con el login de invitado si Auth0 está apagado), chequea si su
// usuario_id ya tiene una fila en "Familias" y, si no, dispara el alta.
//
// No agrega ningún endpoint nuevo: reusa el protocolo de texto que ya existe
// (comando "alta <nombre>", vía runFlow — ver flowClient.js), tal como
// plantea la opción (b) del informe. Esto es intencional: así el punto 2 no
// depende de tocar CHAJA_BOT_WEB.json para funcionar.
//
// El chequeo de "¿tengo familia?" se hace mandando un comando inofensivo
// ("info") y mirando si n8n contesta con el mensaje fijo que devuelve el
// nodo "Armar respuesta sin familia" cuando el usuario_id no matchea
// ninguna fila. Es un poco frágil (depende de un string exacto del lado de
// n8n) pero es lo único que el protocolo actual permite sin agregar una
// rama nueva al workflow.
//
// La vinculación con familias creadas por Discord (punto 3 del informe) NO
// se resuelve acá: si la persona indica que ya tenía cuenta por Discord, se
// la frena y se le pide que se contacte con quien administra el bot, en vez
// de arriesgarse a crear una familia duplicada. Ver el informe, sección de
// vinculación, para la propuesta de cómo cerrar esto del lado de n8n.
// ============================================================================

import { store } from "../state.js";
import { runComando, runFlow } from "../flowClient.js";
import { showToast } from "./toast.js";

// Así arranca siempre el mensaje del nodo "Armar respuesta sin familia".
// Si ese texto cambia en n8n, este chequeo hay que actualizarlo acá.
const SIN_FAMILIA = /no está vinculada a ninguna familia/i;

const CONFIRMADA_KEY_PREFIX = "chaja_familia_confirmada:";

let enCurso = false;

export function initOnboarding() {
  store.subscribe((state) => chequear(state));
  chequear(store.get());
}

async function chequear(state) {
  const { user } = state;
  if (!user.isAuthenticated || !user.usuarioId || enCurso) return;
  if (localStorage.getItem(CONFIRMADA_KEY_PREFIX + user.usuarioId) === "1") return;

  enCurso = true;
  try {
    const resp = await runComando("info");
    const sinFamilia = !resp.ok && SIN_FAMILIA.test(resp.mensaje || "");

    if (!sinFamilia) {
      // Ya existe una fila para este usuario_id (o la respuesta fue otra
      // cosa, como un error de red pasajero): no insistimos.
      localStorage.setItem(CONFIRMADA_KEY_PREFIX + user.usuarioId, "1");
      return;
    }

    await ofrecerAlta(user);
  } finally {
    enCurso = false;
  }
}

async function ofrecerAlta(user) {
  const yaEnDiscord = window.confirm(
    "Todavía no encontramos una familia vinculada a tu cuenta.\n\n" +
      "¿Ya tenías una familia registrada antes por Discord?\n\n" +
      "Aceptar = Sí, ya tengo una — no crear una nueva todavía\n" +
      "Cancelar = No, es la primera vez que me registro"
  );

  if (yaEnDiscord) {
    showToast(
      "Por ahora la web no puede vincular sola una cuenta de Discord ya " +
        "existente. Escribile a quien administra ChajaBot para unificar tu " +
        "cuenta antes de seguir usando la web."
    );
    return;
  }

  const nombre = window.prompt(
    "¿Cómo se llama tu familia? (esto crea tu registro en el cuaderno)"
  );
  if (!nombre || !nombre.trim()) {
    showToast("No se creó ninguna familia todavía. Podés intentarlo de nuevo cuando quieras.");
    return;
  }

  const resultado = await runFlow([`alta ${nombre.trim()}`]);
  if (resultado.ok) {
    localStorage.setItem(CONFIRMADA_KEY_PREFIX + user.usuarioId, "1");
    showToast("¡Familia creada! Ya podés registrar producción.");
  } else {
    showToast(resultado.mensaje || "No se pudo crear la familia. Probá de nuevo.");
  }
}
