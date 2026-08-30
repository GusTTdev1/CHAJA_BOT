// ============================================================================
// sidebar.js — panel lateral desplegable
//
// Con el login obligatorio (5.3), los links internos (los que apuntan a
// secciones de <main>, que ahora vive oculto sin sesión — ver authGate.js)
// no sirven de nada sin estar logueado, así que se ocultan. Los dos links
// externos (CEPT 15, Radio El Chaja) no dependen de una cuenta y quedan
// siempre visibles.
// ============================================================================

import { store } from "../state.js";

export function initSidebar() {
  const toggle = document.getElementById("menuToggle");
  const sidebar = document.getElementById("sidebar");
  const scrim = document.getElementById("scrim");
  const closeBtn = document.getElementById("sidebarClose");
  const list = document.getElementById("sidebarList");
  const lockedHint = document.getElementById("sidebarLockedHint");

  function open() {
    sidebar.hidden = false;
    scrim.hidden = false;
    toggle.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
    closeBtn.focus();
  }

  function close() {
    sidebar.hidden = true;
    scrim.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
    toggle.focus();
  }

  toggle.addEventListener("click", () => {
    sidebar.hidden ? open() : close();
  });
  closeBtn.addEventListener("click", close);
  scrim.addEventListener("click", close);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !sidebar.hidden) close();
  });

  // Cerrar al navegar a una sección (útil en mobile)
  sidebar.querySelectorAll(".sidebar__link:not(.sidebar__link--disabled)").forEach((link) => {
    link.addEventListener("click", close);
  });

  function renderLock() {
    const autenticado = store.get().user.isAuthenticated;
    list.classList.toggle("sidebar__list--locked", !autenticado);
    lockedHint.hidden = autenticado;
  }
  store.subscribe(renderLock);
  renderLock();
}
