// ============================================================================
// menuGrid.js — menú de inicio en celdas cuadradas.
//
// Cada celda es un link a "#<id de sección>". Con el hash en blanco se ve el
// inicio (celdas; el campo "Tu nombre" queda siempre visible); con un hash válido se muestra sólo esa sección,
// con el botón "← Inicio". Al ser hash, el botón "atrás" del navegador y el
// brand del header (href="#") funcionan sin código extra.
// ============================================================================

export function initMenuGrid() {
  const home = document.getElementById("homeMenu");
  const hero = document.getElementById("hero");
  const back = document.getElementById("sectionBack");
  const panels = [...document.querySelectorAll("main > section.panel[data-section]")];
  if (!home || !panels.length) return;

  // Dentro de una sección el <details> queda siempre abierto (ya no hay lista
  // de la que desplegar), así que anulamos el toggle del <summary>.
  panels.forEach((p) => {
    const d = p.querySelector("details");
    if (!d) return;
    d.open = true;
    d.querySelector("summary")?.addEventListener("click", (e) => e.preventDefault());
  });

  function route() {
    const id = decodeURIComponent(location.hash.slice(1));
    const target = panels.find((p) => p.id === id);
    home.hidden = hero.hidden = !!target;
    back.hidden = !target;
    panels.forEach((p) => (p.hidden = p !== target));
    window.scrollTo({ top: 0 });
  }

  window.addEventListener("hashchange", route);
  route();
}
