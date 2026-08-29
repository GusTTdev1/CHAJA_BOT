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
    // Sólo hace falta si en Auth0 se configuró un "API identifier" (audience)
    // para pedir un access token con permisos específicos. Si no existe,
    // dejar vacío: igual se obtiene un id_token válido con el `sub` del
    // usuario, que es lo único que necesitamos acá.
    audience: "",
    redirectUri: window.location.origin,
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
  },
  // Los tipos de producción (gallinas/pollos/cerdos/huerta) y los eventos de
  // cerdos (produccion/celo/parto/destete/sanidad) están hardcodeados en
  // production.js y en el HTML del modal, en vez de vivir acá: tienen que
  // calzar carácter por carácter con lo que valida "Router de estado" en
  // n8n, así que agregar uno nuevo requiere tocar los dos lados a la vez
  // (el flujo de n8n y este formulario).
};
