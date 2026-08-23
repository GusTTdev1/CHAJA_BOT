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
  const nameEl = document.getElementById("userName");
  const emailEl = document.getElementById("userEmail");
  const loginBtn = document.getElementById("loginBtn");
  const logoutBtn = document.getElementById("logoutBtn");

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
    await login();
    showToast("Sesión iniciada");
    close();
  });
  logoutBtn.addEventListener("click", async () => {
    await logout();
    showToast("Sesión cerrada");
    close();
  });

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
  }

  store.subscribe(render);
  render();
}
