// ============================================================================
// config.js
// Constantes de configuración centralizadas. Cuando se conecten Auth0 y el
// backend/n8n reales, sus valores (domain, clientId, endpoints) van acá y
// nada más en el proyecto debería necesitar tocarse.
// ============================================================================

export const CONFIG = {
  auth0: {
    enabled: false, // pasar a true cuando exista una app Auth0 real
    domain: "TU_DOMINIO.auth0.com",
    clientId: "TU_CLIENT_ID",
    audience: "",
    redirectUri: window.location.origin,
  },
  api: {
    // Endpoint base de la futura API propia / webhooks de n8n
    baseUrl: "https://n8n2.rededubot.org/webhook/chaja-web-api",
    endpoints: {
      producciones: "/producciones",
      stock: "/stock",
      grupos: "/grupos",
    },
  },
  productionTypes: {
    ponedoras: {
      label: "Gallinas ponedoras",
      icon: "🥚",
      fields: ["qty"],
    },
    chanchos: {
      label: "Chanchos",
      icon: "🐖",
      fields: ["qty"],
    },
    parrilleros: {
      label: "Pollos parrilleros",
      icon: "🐔",
      fields: ["qty", "age"],
    },
    // Para agregar un nuevo tipo de producción en el futuro, alcanza con
    // sumar una entrada acá: la UI (modal, formulario, ícono) se genera sola.
  },
  stockTypes: {
    kg_pollo: { label: "Kg de pollo", unit: "kg" },
    huevos: { label: "Huevos", unit: "u." },
    kg_chancho: { label: "Kg de chancho", unit: "kg" },
  },
};
