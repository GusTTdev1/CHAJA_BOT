// ============================================================================
// onboarding.js
//
// Alta automática: la primera vez que hay sesión (Auth0, o el login de
// invitado si Auth0 está apagado) y todavía no existe una fila en
// "Familias" para ese usuario_id, se manda "alta <nombre de la cuenta de
// Google>" sin pedirle nada a la persona — nada de confirm()/prompt().
//
// No agrega ningún endpoint nuevo: reusa el protocolo de texto que ya
// existe ("alta <nombre>", vía runFlow — ver flowClient.js). Como
// "Guardar Nueva familia" en CHAJA_BOT_WEB.json matchea por
// usuario_id/telegram_id (que acá son el mismo valor), volver a mandar
// "alta ..." con el mismo usuario_id es idempotente: si la fila ya existe
// la pisa, no la duplica. Eso es lo que permite que, si quien administra
// el Sheet borra la fila a mano, la próxima vez que esa persona entre se
// vuelva a crear sola, con el mismo usuario_id de siempre.
//
// El chequeo de "¿tengo familia?" se hace mandando un comando inofensivo
// ("info") y mirando si n8n contesta con el mensaje fijo que devuelve el
// nodo "Armar respuesta sin familia" cuando el usuario_id no matchea
// ninguna fila. Es un poco frágil (depende de un string exacto del lado de
// n8n) pero es lo único que el protocolo actual permite sin agregar una
// rama nueva al workflow.
//
// IMPORTANTE: a diferencia de la versión anterior, acá NO se le pregunta a
// la persona si ya tenía una familia por Discord — se da de alta directo.
// Esto significa que alguien que ya tenía cuenta por Discord y entra por
// primera vez a la Web con Google va a terminar con DOS filas en
// "Familias" (una por Discord, otra por esta alta automática), hasta que
// se resuelva la vinculación real entre canales (punto 5.2 del informe).
// Es un trade-off consciente: se prioriza que la Web funcione sola, sin
// fricción, a costa de ese caso puntual, que hay que resolver aparte.
//
// El chequeo se repite en cada carga de página (no se guarda un flag
// permanente en localStorage) para no confiar en un estado local que
// puede quedar desactualizado si alguien borra la fila del Sheet a mano.
// Dentro de la misma carga de página sí se evita repetir el chequeo si ya
// se hizo una vez para ese usuario_id.
// ============================================================================

import { store } from "../state.js";
import { runComando, runFlow } from "../flowClient.js";
import { showToast } from "./toast.js";

// Así arranca siempre el mensaje del nodo "Armar respuesta sin familia".
// Si ese texto cambia en n8n, este chequeo hay que actualizarlo acá.
const SIN_FAMILIA = /no está vinculada a ninguna familia/i;

let enCurso = false;
const yaChequeadosEnEstaCarga = new Set(); // se reinicia solo al refrescar la página

export function initOnboarding() {
  store.subscribe((state) => chequear(state));
  chequear(store.get());
}

async function chequear(state) {
  const { user } = state;
  if (!user.isAuthenticated || !user.usuarioId || enCurso) return;
  if (yaChequeadosEnEstaCarga.has(user.usuarioId)) return;

  enCurso = true;
  try {
    const resp = await runComando("info");
    const sinFamilia = !resp.ok && SIN_FAMILIA.test(resp.mensaje || "");

    if (sinFamilia) {
      await altaAutomatica(user);
    }
    // Ya sea que tenía familia, se la acabamos de crear, o el intento de
    // alta falló: no volvemos a chequear en esta misma carga de página.
    // Si falló el alta, el próximo refresh/login reintenta solo.
    yaChequeadosEnEstaCarga.add(user.usuarioId);
  } finally {
    enCurso = false;
  }
}

async function altaAutomatica(user) {
  const nombre = (user.name || "").trim() || "Productor/a sin nombre";
  const resultado = await runFlow([`alta ${nombre}`]);
  if (resultado.ok) {
    showToast(`¡Listo! Te registramos en el cuaderno como "${nombre}".`);
  } else {
    console.error("[onboarding] Falló el alta automática:", resultado.mensaje);
    showToast(
      resultado.mensaje ||
        "No pudimos crear tu registro automáticamente. Probá recargar la página."
    );
  }
}
