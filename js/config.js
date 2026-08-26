// ============================================================================
// config.js
// Constantes de configuración centralizadas. Cuando se conecten Auth0 y el
// backend/n8n reales, sus valores (domain, clientId, endpoints) van acá y
// nada más en el proyecto debería necesitar tocarse.
// ============================================================================

export const CONFIG = {
  auth0: {
    enabled: false, // pasar a true cuando exista una app Auth0 real
    domain: "TU_DOMINIO.auth0.com",
    clientId: "TU_CLIENT_ID",
    audience: "",
    redirectUri: window.location.origin,
  },
  api: {
    // Un único webhook de n8n. NO hay un endpoint por acción: todas las
    // solicitudes (registrar, alta, baja, balance, historial, resumen,
    // actividad, grafico, cancelar) se envían acá mismo, con el campo
    // "accion" dentro del body. n8n decide internamente qué hacer
    // (ver nodo Switch sobre {{$json.body.accion}}).
    webhookUrl: "https://n8n2.rededubot.org/webhook/chaja-web-api",
  },
  // Los tipos de producción (gallinas/pollos/cerdos/huerta) y los eventos de
  // cerdos (produccion/celo/parto/destete/sanidad) están hardcodeados en
  // production.js y en el HTML del modal, en vez de vivir acá: tienen que
  // calzar carácter por carácter con lo que valida "Router de estado" en
  // n8n, así que agregar uno nuevo requiere tocar los dos lados a la vez
  // (el flujo de n8n y este formulario).
};
