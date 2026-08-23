// ============================================================================
// auth.js
// Capa de autenticación. Hoy simula login/logout localmente; el día que se
// conecte Auth0 real, sólo hay que reemplazar el cuerpo de estas tres
// funciones por llamadas al Auth0 SPA SDK (createAuth0Client, loginWithRedirect,
// logout, getUser). Nada fuera de este archivo debería cambiar.
// ============================================================================

import { CONFIG } from "./config.js";
import { store } from "./state.js";

export async function initAuth() {
  if (!CONFIG.auth0.enabled) {
    return; // sin Auth0 configurado todavía: queda como invitado
  }
  // Acá iría, por ejemplo:
  // const auth0Client = await createAuth0Client({ domain, client_id, redirect_uri });
  // const isAuthenticated = await auth0Client.isAuthenticated();
  // if (isAuthenticated) store.setUser({ isAuthenticated: true, ...await auth0Client.getUser() });
}

export async function login() {
  if (!CONFIG.auth0.enabled) {
    // Simulación local para poder demostrar el panel de usuario sin backend.
    store.setUser({
      isAuthenticated: true,
      name: "Productor de ejemplo",
      email: "productor@chajabot.demo",
    });
    return;
  }
  // await auth0Client.loginWithRedirect();
}

export async function logout() {
  if (!CONFIG.auth0.enabled) {
    store.setUser({ isAuthenticated: false, name: null, email: null });
    return;
  }
  // await auth0Client.logout({ returnTo: CONFIG.auth0.redirectUri });
}

// ----------------------------------------------------------------------------
// Identificador de usuario para la web (sección 22 del spec).
// NO es un sistema de autenticación: es solo un identificador estable que
// viaja en cada request como "usuario_id" para que n8n pueda asociar las
// operaciones (igual que el ID de Discord identifica al usuario en esa
// interfaz). Vive en localStorage porque es solo una etiqueta del cliente —
// n8n sigue siendo la fuente de verdad del estado (spec sección 25).
// Cuando haya Auth0 real, este valor puede reemplazarse por el "sub" del
// usuario autenticado sin tocar nada más del sistema (api.js ya lo consume
// a través de esta única función).
// ----------------------------------------------------------------------------
const USUARIO_ID_KEY = "chaja_usuario_id";

export function getUsuarioId() {
  const { user } = store.get();
  if (CONFIG.auth0.enabled && user?.isAuthenticated && user?.email) {
    return user.email; // o el "sub" de Auth0 cuando esté conectado
  }

  let id = localStorage.getItem(USUARIO_ID_KEY);
  if (!id) {
    id = `web_${crypto.randomUUID()}`;
    localStorage.setItem(USUARIO_ID_KEY, id);
  }
  return id;
}

// Nombre para "first_name" (usado por el flujo de alta de familia en n8n,
// que arma el mensaje con el nombre de quien se registra). Sin Auth0, se le
// pregunta una sola vez al usuario y se guarda local.
const NOMBRE_KEY = "chaja_nombre";

export function getNombre() {
  const { user } = store.get();
  if (CONFIG.auth0.enabled && user?.isAuthenticated && user?.name) {
    return user.name;
  }
  return localStorage.getItem(NOMBRE_KEY) || "Web";
}

export function setNombre(nombre) {
  localStorage.setItem(NOMBRE_KEY, nombre || "Web");
}
