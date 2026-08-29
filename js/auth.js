// ============================================================================
// auth.js
// Capa de autenticación. Usa el Auth0 SPA SDK (cargado como script global en
// index.html, expone `window.createAuth0Client`) cuando
// CONFIG.auth0.enabled === true.
//
// El claim `sub` que devuelve Auth0 (ej. "google-oauth2|1029384756") pasa a
// ser el usuario_id real y permanente de la familia: es el valor que api.js
// manda en cada request a n8n, sea cual sea el dispositivo o navegador desde
// el que se entre. Nada fuera de este archivo necesita saber que existe
// Auth0 — el resto del proyecto sigue llamando a getNombre()/login()/
// logout() como antes, y api.js pide el usuario_id vía getUsuarioId().
//
// Con CONFIG.auth0.enabled = false se mantiene el modo invitado de siempre
// (UUID al azar en localStorage), para poder seguir demostrando la interfaz
// sin backend ni cuenta de Auth0.
// ============================================================================

import { CONFIG } from "./config.js";
import { store } from "./state.js";

const NOMBRE_KEY = "chaja_nombre";
const GUEST_ID_KEY = "chaja_usuario_id"; // sólo se usa con Auth0 deshabilitado

let auth0Client = null;

export function getNombre() {
  return localStorage.getItem(NOMBRE_KEY) || "Web";
}

export function setNombre(nombre) {
  if (nombre) localStorage.setItem(NOMBRE_KEY, nombre);
}

/**
 * El usuario_id "real" para esta sesión:
 *  - con Auth0 habilitado y sesión activa → el `sub` de Auth0 (permanente).
 *  - con Auth0 habilitado pero sin sesión → null (no hay identidad estable
 *    todavía; quien llame a esto — api.js — no debe inventar una).
 *  - con Auth0 deshabilitado → el UUID de invitado de siempre.
 */
export function getUsuarioId() {
  const { user } = store.get();
  if (user.isAuthenticated && user.usuarioId) return user.usuarioId;
  if (!CONFIG.auth0.enabled) return getGuestId();
  return null;
}

function getGuestId() {
  let id = localStorage.getItem(GUEST_ID_KEY);
  if (!id) {
    id = "web-" + crypto.randomUUID();
    localStorage.setItem(GUEST_ID_KEY, id);
  }
  return id;
}

export async function initAuth() {
  if (!CONFIG.auth0.enabled) {
    return; // sin Auth0 configurado todavía: queda como invitado
  }
  if (typeof createAuth0Client !== "function") {
    console.error(
      "[auth] El Auth0 SPA SDK no está cargado. Falta el <script> de " +
        "cdn.auth0.com en index.html (ver comentario junto a js/main.js)."
    );
    return;
  }

  auth0Client = await createAuth0Client({
    domain: CONFIG.auth0.domain,
    clientId: CONFIG.auth0.clientId,
    authorizationParams: {
      redirect_uri: CONFIG.auth0.redirectUri,
      scope: CONFIG.auth0.scope,
      ...(CONFIG.auth0.audience ? { audience: CONFIG.auth0.audience } : {}),
    },
    cacheLocation: "localstorage", // sobrevive a cerrar la pestaña
    useRefreshTokens: true,
  });

  // Volvemos de loginWithRedirect(): la URL trae ?code=...&state=...
  const params = new URLSearchParams(window.location.search);
  if (params.has("code") && params.has("state")) {
    try {
      await auth0Client.handleRedirectCallback();
    } catch (err) {
      console.error("[auth] Error procesando el redirect de Auth0:", err);
    }
    // Limpiamos el querystring para no dejarlo pegado en la URL ni
    // reprocesarlo si se refresca la página.
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  const isAuthenticated = await auth0Client.isAuthenticated();
  if (isAuthenticated) {
    await aplicarUsuarioAutenticado();
  }
}

async function aplicarUsuarioAutenticado() {
  const profile = await auth0Client.getUser();
  store.setUser({
    isAuthenticated: true,
    usuarioId: profile.sub, // ej: "google-oauth2|1029384756" → usuario_id real
    name: profile.name || profile.nickname || "Productor/a",
    email: profile.email || null,
    picture: profile.picture || null,
  });
  // "agenteNombre" (identidad.js) se pre-completa con el nombre de pila la
  // primera vez, pero sigue siendo editable a mano por sesión: es el nombre
  // que queda como "agente" en cada registro, no necesariamente el nombre
  // de la cuenta.
  if (getNombre() === "Web" && profile.given_name) setNombre(profile.given_name);
}

export async function login() {
  if (!CONFIG.auth0.enabled) {
    // Simulación local para poder demostrar el panel de usuario sin backend.
    store.setUser({
      isAuthenticated: true,
      usuarioId: getGuestId(),
      name: "Productor de ejemplo",
      email: "productor@chajabot.demo",
    });
    return;
  }
  if (!auth0Client) {
    throw new Error(
      "auth0Client no se inicializó (initAuth() falló o no corrió). " +
        "Revisá el error anterior en la consola."
    );
  }
  await auth0Client.loginWithRedirect();
}

export async function logout() {
  if (!CONFIG.auth0.enabled) {
    store.setUser({ isAuthenticated: false, usuarioId: null, name: null, email: null });
    return;
  }
  await auth0Client.logout({ logoutParams: { returnTo: CONFIG.auth0.redirectUri } });
}
