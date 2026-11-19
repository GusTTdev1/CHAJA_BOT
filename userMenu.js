// ============================================================================
// userMenu.js — círculo de usuario y panel preparado para Auth0
// ============================================================================

import { store } from "../state.js";
import { login, logout } from "../auth.js";
import { showToast } from "./toast.js";

export function initUserMenu() {
  const toggle = document.getElementById("userToggle");
  const panel = document.getElementById("userPanel");
  const initials = document.getElementById("userInitials");
  const avatarBox = document.getElementById("userAvatar");
  const nameEl = document.getElementById("userName");
  const emailEl = document.getElementById("userEmail");
  const loginBtn = document.getElementById("loginBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  // Crea (una sola vez) la <img> que reemplaza a las iniciales cuando hay
  // foto de Google. Queda oculta por defecto y sólo se muestra si
  // user.picture existe y carga bien.
  const orbImg = document.createElement("img");
  orbImg.className = "user-orb__img";
  orbImg.alt = "";
  orbImg.hidden = true;
  toggle.appendChild(orbImg);

  const panelImg = document.createElement("img");
  panelImg.className = "user-panel__avatar-img";
  panelImg.alt = "";
  panelImg.hidden = true;
  avatarBox.appendChild(panelImg);

  function open() {
    panel.hidden = false;
    toggle.setAttribute("aria-expanded", "true");
  }
  function close() {
    panel.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
  }

  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    panel.hidden ? open() : close();
  });
  document.addEventListener("click", (e) => {
    if (!panel.hidden && !panel.contains(e.target) && e.target !== toggle) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panel.hidden) close();
  });

  loginBtn.addEventListener("click", async () => {
    try {
      await login();
      showToast("Sesión iniciada");
      close();
    } catch (err) {
      console.error("[login] Falló el inicio de sesión:", err);
      showToast("No se pudo iniciar sesión. Revisá la consola para más detalle.");
    }
  });
  logoutBtn.addEventListener("click", async () => {
    try {
      await logout();
      showToast("Sesión cerrada");
      close();
    } catch (err) {
      console.error("[logout] Falló el cierre de sesión:", err);
      showToast("No se pudo cerrar sesión. Revisá la consola para más detalle.");
    }
  });

  // Muestra la foto de Google si existe y carga bien; si no, vuelve a las
  // iniciales/placeholder de siempre. `onShow`/`onHide` ajustan lo que haga
  // falta en cada lugar (el orb sólo tiene que ocultar el texto de iniciales;
  // el panel además tiene que sacar el fondo punteado del placeholder).
  function setAvatar(imgEl, pictureUrl, onShow, onHide) {
    if (!pictureUrl) {
      imgEl.hidden = true;
      imgEl.removeAttribute("src");
      onHide();
      return;
    }
    imgEl.onload = () => {
      imgEl.hidden = false;
      onShow();
    };
    imgEl.onerror = () => {
      // Foto rota o bloqueada (ej. por el proxy de Google): no dejamos un
      // ícono roto, volvemos a las iniciales.
      imgEl.hidden = true;
      onHide();
    };
    imgEl.src = pictureUrl;
  }

  function render() {
    const { user } = store.get();
    if (user.isAuthenticated) {
      nameEl.textContent = user.name;
      emailEl.textContent = user.email;
      initials.textContent = user.name.slice(0, 2).toUpperCase();
      loginBtn.hidden = true;
      logoutBtn.hidden = false;
    } else {
      nameEl.textContent = "Invitado";
      emailEl.textContent = "Sin sesión iniciada";
      initials.textContent = "?";
      loginBtn.hidden = false;
      logoutBtn.hidden = true;
    }
    setAvatar(
      orbImg,
      user.picture,
      () => { initials.hidden = true; },
      () => { initials.hidden = false; }
    );
    setAvatar(
      panelImg,
      user.picture,
      () => { avatarBox.classList.add("user-panel__avatar--has-photo"); },
      () => { avatarBox.classList.remove("user-panel__avatar--has-photo"); }
    );
  }

  store.subscribe(render);
  render();
}
