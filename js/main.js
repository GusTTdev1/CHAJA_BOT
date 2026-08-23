// ============================================================================
// main.js — punto de entrada. Sólo orquesta: inicializa auth y cada
// componente de la interfaz. La lógica de cada sección vive en su propio
// módulo dentro de js/components/.
// ============================================================================

import { initAuth } from "./auth.js";
import { initSidebar } from "./components/sidebar.js";
import { initUserMenu } from "./components/userMenu.js";
import { initProduction } from "./components/production.js";
import { initStock } from "./components/stock.js";
import { initGroups } from "./components/groups.js";
import { initCommandCenter } from "./components/commandCenter.js";

async function bootstrap() {
  await initAuth();
  initSidebar();
  initUserMenu();
  initProduction();
  initStock();
  initGroups();
}

bootstrap();
