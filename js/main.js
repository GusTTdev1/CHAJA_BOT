// ============================================================================
// main.js — punto de entrada. Sólo orquesta: inicializa auth y cada
// componente de la interfaz. La lógica de cada sección vive en su propio
// módulo dentro de js/components/.
// ============================================================================

import { initAuth } from "./auth.js";
import { initSidebar } from "./components/sidebar.js";
import { initUserMenu } from "./components/userMenu.js";
import { initOnboarding } from "./components/onboarding.js";
import { initIdentidad } from "./components/identidad.js";
import { initProduction } from "./components/production.js";
import { initStock } from "./components/stock.js";
import { initConsultas } from "./components/consultas.js";
import { initActividad } from "./components/actividad.js";
import { initGraficos } from "./components/graficos.js";
import { initGroups } from "./components/groups.js";

async function bootstrap() {
  await initAuth();
  initSidebar();
  initUserMenu();
  initOnboarding(); // alta automática la primera vez que hay sesión sin familia
  initIdentidad();
  initProduction();
  initStock();
  initConsultas();
  initActividad();
  initGraficos();
  initGroups();
}

bootstrap();
