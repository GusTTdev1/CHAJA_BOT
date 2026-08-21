// ============================================================================
// sidebar.js — panel lateral desplegable
// ============================================================================

export function initSidebar() {
  const toggle = document.getElementById("menuToggle");
  const sidebar = document.getElementById("sidebar");
  const scrim = document.getElementById("scrim");
  const closeBtn = document.getElementById("sidebarClose");

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
}
