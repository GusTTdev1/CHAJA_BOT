// ============================================================================
// authGate.js
//
// Resuelve el punto 5.3 del informe: hasta ahora el login era opcional a
// nivel de interfaz — se podía navegar y llenar formularios sin sesión, y
// recién al mandar algo enviarTexto() (api.js) cortaba con un mensaje de
// error. Este módulo bloquea el contenido principal por completo hasta que
// haya sesión iniciada, y muestra una pantalla de bienvenida con un único
// botón de login en su lugar.
//
// No decide nada por su cuenta sobre login/logout: sólo llama a login() de
// auth.js, igual que userMenu.js. Los dos links externos del sidebar (CEPT
// 15 y Radio El Chaja) siguen visibles sin sesión — no dependen de una
// cuenta — tanto desde el propio gate como desde el menú lateral (ver
// sidebar.js, que oculta el resto de sus links con la sesión cerrada).
// ============================================================================

import { store } from "../state.js";
import { login } from "../auth.js";
import { showToast } from "./toast.js";

export function initAuthGate() {
  const gate = document.getElementById("authGate");
  const main = document.getElementById("main");
  const footer = document.getElementById("siteFooter");
  const message = document.getElementById("authGateMessage");
  const loginBtn = document.getElementById("authGateLoginBtn");

  loginBtn.addEventListener("click", async () => {
    loginBtn.disabled = true;
    try {
      await login();
      // Con Auth0 real esto casi nunca se alcanza a ver: loginWithRedirect()
      // saca de la página antes. Con Auth0 deshabilitado (modo invitado) sí
      // hace falta: login() resuelve al toque y render() se encarga de
      // ocultar el gate.
    } catch (err) {
      console.error("[authGate] Falló el inicio de sesión:", err);
      showToast("No se pudo iniciar sesión. Revisá la consola para más detalle.");
      loginBtn.disabled = false;
    }
  });

  function render() {
    const { user } = store.get();
    const autenticado = user.isAuthenticated;

    gate.hidden = autenticado;
    main.hidden = !autenticado;
    footer.hidden = !autenticado;

    if (!autenticado) {
      message.textContent =
        "Iniciá sesión para registrar producción, mover stock y consultar tu cuaderno.";
      loginBtn.hidden = false;
      loginBtn.disabled = false;
    }
  }

  store.subscribe(render);
  render();
}
