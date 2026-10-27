// ============================================================================
// config.js
// Constantes de configuración centralizadas. Cuando se conecten Auth0 y el
// backend/n8n reales, sus valores (domain, clientId, endpoints) van acá y
// nada más en el proyecto debería necesitar tocarse.
// ============================================================================

export const CONFIG = {
  auth0: {
    enabled: true,
    domain: "dev-58lqnyqsc68mdqad.us.auth0.com",
    clientId: "hhKo6w02G8NCE6acMyNM5H86D5WtiXbf",
    // Sólo hace falta si en Auth0 se configuró un "API identifier" (audience)
    // para pedir un access token con permisos específicos. Si no existe,
    // dejar vacío: igual se obtiene un id_token válido con el `sub` del
    // usuario, que es lo único que necesitamos acá.
    audience: "",
    redirectUri: "https://gusttdev1.github.io/CHAJA_BOT/",
    // Scopes mínimos para leer nombre, email y el claim "sub" (el que se usa
    // como usuario_id permanente). No hace falta pedir nada más.
    scope: "openid profile email",
    // Los proveedores sociales (Google, Facebook, y los que se sumen) NO se
    // eligen desde acá: se habilitan en el dashboard de Auth0
    // (Authentication > Social) y Auth0 los muestra automáticamente como
    // botones en su Universal Login. Este archivo no necesita saber cuáles
    // están activos.
    //
    // Importante para que "el mismo usuario" no termine con dos `sub`
    // distintos: si alguien entra primero con Google y después con Facebook
    // usando el mismo email verificado, conviene tener activada en Auth0 la
    // vinculación automática por email (Auth0 Action/Rule de account
    // linking). Ver diagnóstico, punto 1.
  },
  api: {
    // Un único webhook de n8n. NO hay un endpoint por acción: todas las
    // solicitudes (registrar, alta, baja, balance, historial, resumen,
    // actividad, grafico, cancelar) se envían acá mismo, con el campo
    // "accion" dentro del body. n8n decide internamente qué hacer
    // (ver nodo Switch sobre {{$json.body.accion}}).
    webhookUrl: "https://n8n2.rededubot.org/webhook/chaja-web-api",
    // Webhook nuevo, SOLO para la Nota de voz: recibe el audio (base64),
    // adentro de n8n lo transcribe y lo interpreta con Groq, y devuelve
    // { ok, transcripcion, interpretado } sin escribir nada todavía en el
    // Sheet — eso pasa recién cuando el usuario confirma (ver js/components/voz.js).
    // Cambiar por la URL real una vez importado y activado el workflow
    // "CHAJA_BOT_WEB_voz.json" en n8n.
    voiceWebhookUrl: "https://n8n2.rededubot.org/webhook/chaja-voice-api",
  },
  // "Control de sensores" (js/components/sensores.js). Webhook propio, separado
  // del de texto: acciones "datos", "vincular" y "desvincular" (ver en n8n el
  // grupo de nodos "S ..." de CHAJA_BOT_WEB). El Arduino NO usa éste: manda sus
  // lecturas a /webhook/sensoresweb con su código de fábrica.
  sensores: {
    webhookUrl: "https://n8n2.rededubot.org/webhook/chaja-sensores-api",
    // Cada cuánto se vuelve a pedir el panel (el Arduino envía cada 5 min).
    refrescoMs: 10 * 1000,
  },
  // Los tipos de producción (gallinas/pollos/cerdos/huerta) y los eventos de
  // cerdos (produccion/celo/parto/destete/sanidad) están hardcodeados en
  // production.js y en el HTML del modal, en vez de vivir acá: tienen que
  // calzar carácter por carácter con lo que valida "Router de estado" en
  // n8n, así que agregar uno nuevo requiere tocar los dos lados a la vez
  // (el flujo de n8n y este formulario).
};
