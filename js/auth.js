// ============================================================================
// auth.js
// Capa de autenticación. Hoy simula login/logout localmente; el día que se
// conecte Auth0 real, sólo hay que reemplazar el cuerpo de estas tres
// funciones por llamadas al Auth0 SPA SDK (createAuth0Client, loginWithRedirect,
// logout, getUser). Nada fuera de este archivo debería cambiar.
// ============================================================================

import { CONFIG } from "./config.js";
import { store } from "./state.js";

const NOMBRE_KEY = "chaja_nombre";

export function getNombre() {
  return localStorage.getItem(NOMBRE_KEY) || "Web";
}

export function setNombre(nombre) {
  if (nombre) localStorage.setItem(NOMBRE_KEY, nombre);
}

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
