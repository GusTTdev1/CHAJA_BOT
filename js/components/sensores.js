// ============================================================================
// sensores.js — "Control de sensores"
//
// 1) Vincula un dispositivo (ESP32 sin pantalla) a la familia con el código de
//    fábrica impreso en su etiqueta (CHJ-XXXX-XXXX-XXXX). El mismo código está
//    escrito en el .ino y viaja en cada lectura: n8n sólo guarda datos de
//    dispositivos que ya fueron vinculados desde acá.
// 2) Muestra un único gráfico de líneas con todas las métricas, los valores
//    actuales con su insignia de estado, y se refresca solo.
// 3) Avisa (toast + notificación del navegador) cuando un medidor entra en
//    estado crítico o el sensor deja de enviar datos.
//
// Habla con un webhook propio de n8n (CONFIG.sensores.webhookUrl), separado
// del "Router de estado" de texto: acciones "datos", "vincular", "desvincular".
// ============================================================================

import { CONFIG } from "../config.js";
import { store } from "../state.js";
import { getUsuarioId } from "../auth.js";
import { showToast } from "./toast.js";

// ----------------------------------------------------------------------------
// Umbrales y comentarios. Es el único lugar que hay que tocar para ajustarlos
// (pensados para aves adultas; los pollitos necesitan bastante más calor).
// Cada banda vale para valor < "hasta". Niveles: ok | info | warn | crit.
// ----------------------------------------------------------------------------
const ADC_MAX = 4095; // ESP32: lectura analógica de 12 bits
const LUZ_BUENA_RAW = 600; // igual que limiteSuperiorLuz del .ino (menor = más luz)
const GAS_UMBRAL_ALERTA = 1.8; // mismo factor que usa el Arduino (base × 1.8)
const GAS_UMBRAL_AVISO = 1.4;
const MIN_AVISO_SIN_DATOS = 20; // minutos sin lecturas → advertencia
const MIN_CRITICO_SIN_DATOS = 60; // minutos sin lecturas → crítico
const REAVISO_MS = 30 * 60 * 1000; // si sigue crítico, se repite el aviso cada 30 min

const BANDAS = {
  temp: [
    { hasta: 8, nivel: "crit", texto: "Temperatura peligrosamente baja: riesgo de hipotermia en las aves" },
    { hasta: 15, nivel: "warn", texto: "Hace frío: abrigá a las aves y evitá corrientes" },
    { hasta: 25, nivel: "ok", texto: "Temperatura adecuada" },
    { hasta: 29, nivel: "info", texto: "Ambiente cálido: vigilá la ventilación" },
    { hasta: 33, nivel: "warn", texto: "Hace calor: ventilá y reforzá el agua fresca" },
    { hasta: Infinity, nivel: "crit", texto: "Temperatura peligrosamente alta: riesgo de golpe de calor" },
  ],
  hum: [
    { hasta: 20, nivel: "crit", texto: "Aire extremadamente seco: riesgo para las vías respiratorias" },
    { hasta: 40, nivel: "warn", texto: "Aire seco: se levanta polvo, revisá los bebederos" },
    { hasta: 70, nivel: "ok", texto: "Humedad ideal" },
    { hasta: 80, nivel: "warn", texto: "Humedad alta: ventilá para que no se moje la cama" },
    { hasta: Infinity, nivel: "crit", texto: "Humedad crítica: urgencia de ventilar" },
  ],
  // Se evalúa sobre la lectura CRUDA (menor número = más luz)
  luz: [
    { hasta: LUZ_BUENA_RAW + 1, nivel: "ok", texto: "Buena iluminación" },
    { hasta: 2000, nivel: "info", texto: "Iluminación media" },
    { hasta: 3500, nivel: "info", texto: "Poca luz" },
    { hasta: Infinity, nivel: "info", texto: "Oscuridad: ambiente sin luz" },
  ],
  horas: [
    { hasta: 14, nivel: "info", texto: "Acumulando horas de luz (ideal para ponedoras: 14 a 16 h)" },
    { hasta: 17, nivel: "ok", texto: "Horas de luz ideales" },
    { hasta: Infinity, nivel: "warn", texto: "Exceso de horas de luz" },
  ],
};

const bandaDe = (id, valor) => BANDAS[id].find((b) => valor < b.hasta);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const numero = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

// ----------------------------------------------------------------------------
// Métricas: cómo se muestra, cómo se normaliza en el gráfico y cómo se evalúa.
// En el gráfico todas van de 0 a 100 para poder compararlas en un solo eje;
// el valor real (con su unidad) aparece en el tooltip y en las tarjetas.
// ----------------------------------------------------------------------------
const luzPct = (raw) => clamp(100 - (raw / ADC_MAX) * 100, 0, 100); // INVERTIDA: más luz → número más alto
const gasUmbral = (l) => (numero(l.gas_base) ? Math.max(l.gas_base * GAS_UMBRAL_ALERTA, 200) : null);

const METRICAS = [
  {
    id: "temp", nombre: "Temperatura", unidad: "°C", decimales: 1, icono: "termometro", colorVar: "--clay", color: "#9B4A3B",
    real: (l) => numero(l.temp),
    norm: (l) => clamp((l.temp / 50) * 100, 0, 100), // rango 0–50 °C
    evaluar: (l) => bandaDe("temp", l.temp),
    sub: () => "",
  },
  {
    id: "hum", nombre: "Humedad", unidad: "%", decimales: 0, icono: "gota", colorVar: "--sky", color: "#2F6B8A",
    real: (l) => numero(l.hum),
    norm: (l) => clamp(l.hum, 0, 100),
    evaluar: (l) => bandaDe("hum", l.hum),
    sub: () => "",
  },
  {
    id: "luz", nombre: "Luz", etiquetaGrafico: "Luz (invertida)", unidad: "%", decimales: 0, icono: "sol", colorVar: "--wheat", color: "#B9862E",
    real: (l) => (numero(l.luz) === null ? null : luzPct(l.luz)),
    norm: (l) => luzPct(l.luz),
    evaluar: (l) => bandaDe("luz", l.luz),
    sub: (l) => `Lectura cruda: ${Math.round(l.luz)} de ${ADC_MAX} (menor = más luz)`,
  },
  {
    id: "gas", nombre: "Gas", etiquetaGrafico: "Gas (100 % = alerta)", unidad: "ADC", decimales: 0, icono: "viento", colorVar: "--plum", color: "#7A4B78",
    real: (l) => numero(l.gas),
    norm: (l) => clamp((l.gas / (gasUmbral(l) || ADC_MAX)) * 100, 0, 130),
    evaluar: (l) => {
      const ratio = numero(l.gas_base) ? l.gas / l.gas_base : null;
      if (l.gas_alerta) return { nivel: "crit", texto: "Gas detectado: ventilá el galpón ya y revisá la fuente" };
      if (ratio !== null && ratio >= GAS_UMBRAL_AVISO) return { nivel: "warn", texto: "Están subiendo los gases: ventilá y revisá" };
      return { nivel: "ok", texto: "Aire limpio, sin gases detectados" };
    },
    sub: (l) => (numero(l.gas_base) ? `${(l.gas / l.gas_base).toFixed(1).replace(".", ",")}× el nivel de aire limpio` : ""),
  },
  {
    id: "horas", nombre: "Horas de luz", etiquetaGrafico: "Horas de luz (de 24)", unidad: "h", decimales: 1, icono: "reloj", colorVar: "--leaf", color: "#3F8B4A", dash: [6, 4],
    real: (l) => numero(l.horas),
    norm: (l) => clamp((l.horas / 24) * 100, 0, 100),
    evaluar: (l) => bandaDe("horas", l.horas),
    sub: () => "Acumuladas en el día",
  },
];

// ----------------------------------------------------------------------------
// Íconos (trazos simples, heredan el color del contenedor)
// ----------------------------------------------------------------------------
const SVG_NS = "http://www.w3.org/2000/svg";
const ICONOS = {
  termometro: ["M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"],
  gota: ["M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"],
  sol: ["M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z", "M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"],
  viento: ["M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"],
  reloj: ["M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z", "M12 6v6l4 2"],
  ok: ["M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z", "M8 12.5l3 3 5-6"],
  info: ["M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z", "M12 16v-4M12 8h.01"],
  warn: ["M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z", "M12 9v4M12 17h.01"],
  crit: ["M7.86 2h8.28L22 7.86v8.28L16.14 22H7.86L2 16.14V7.86z", "M12 8v4M12 16h.01"],
};

function icono(nombre, clase = "") {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  if (clase) svg.setAttribute("class", clase);
  for (const d of ICONOS[nombre]) {
    const p = document.createElementNS(SVG_NS, "path");
    p.setAttribute("d", d);
    svg.appendChild(p);
  }
  return svg;
}

function el(tag, clase, texto) {
  const e = document.createElement(tag);
  if (clase) e.className = clase;
  if (texto !== undefined) e.textContent = texto;
  return e;
}

// ----------------------------------------------------------------------------
// Estado del módulo
// ----------------------------------------------------------------------------
const S = {
  dispositivos: [], // [{ ref, nombre, vinculado_en }]
  lecturas: {}, // ref → [lectura] dentro del período elegido
  ultima: {}, // ref → última lectura conocida (aunque sea más vieja que el período)
  ref: null, // sensor seleccionado
  horas: 24,
  skew: 0, // reloj del navegador − reloj del servidor (ms)
  timer: null,
  cargaId: 0,
  cargado: false,
  verVinculo: false,
  chart: null,
  actualizado: null,
};

const $ = (id) => document.getElementById(id);
const ahoraServidor = () => Date.now() - S.skew;

// ----------------------------------------------------------------------------
// Red
// ----------------------------------------------------------------------------
async function llamar(accion, extra = {}) {
  const usuarioId = getUsuarioId();
  if (!usuarioId) return { ok: false, mensaje: "Iniciá sesión para ver tus sensores." };
  let res;
  try {
    res = await fetch(CONFIG.sensores.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion, usuario_id: usuarioId, ...extra }),
    });
  } catch (err) {
    console.error("[sensores] fetch falló:", err);
    return { ok: false, mensaje: "No se pudo conectar con el servidor." };
  }
  if (!res.ok) {
    console.error(`[sensores] el webhook respondió ${res.status}`);
    return { ok: false, mensaje: `Error del servidor (${res.status}).` };
  }
  const crudo = await res.text();
  try {
    return JSON.parse(crudo);
  } catch (err) {
    console.error("[sensores] respuesta no es JSON:", err, crudo);
    return { ok: false, mensaje: "El servidor respondió en un formato inesperado." };
  }
}

// ----------------------------------------------------------------------------
// Formato
// ----------------------------------------------------------------------------
const fmtNum = (v, dec) => v.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
const fmtHora = (t) => new Date(t).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
const fmtFecha = (t) =>
  new Date(t).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });

function hace(min) {
  if (min < 1) return "hace instantes";
  if (min < 60) return `hace ${Math.round(min)} min`;
  const h = min / 60;
  if (h < 48) return `hace ${fmtNum(h, h < 10 ? 1 : 0)} h`;
  return `hace ${Math.round(h / 24)} días`;
}

/** Formatea lo que se tipea al estilo CHJ-XXXX-XXXX-XXXX (acepta pegado con o sin guiones). */
export function formatearCodigo(crudo) {
  let s = String(crudo || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (s.length === 12 && !s.startsWith("CHJ")) s = "CHJ" + s; // pegaron sólo las 3 partes
  s = s.slice(0, 15);
  return [s.slice(0, 3), s.slice(3, 7), s.slice(7, 11), s.slice(11, 15)].filter(Boolean).join("-");
}
const CODIGO_OK = /^CHJ-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

// ----------------------------------------------------------------------------
// Evaluación de estado
// ----------------------------------------------------------------------------
const ORDEN = { ok: 0, info: 1, warn: 2, crit: 3 };

/** Antigüedad de la última lectura de un sensor (minutos), o null si nunca mandó nada. */
function edadMin(ref) {
  const u = S.ultima[ref];
  return u ? Math.max(0, (ahoraServidor() - u.t) / 60000) : null;
}

function estadoConexion(ref) {
  const edad = edadMin(ref);
  if (edad === null) return { nivel: "info", texto: "Esperando la primera lectura…" };
  if (edad >= MIN_CRITICO_SIN_DATOS) return { nivel: "crit", texto: `Sin conexión: última lectura ${hace(edad)}` };
  if (edad >= MIN_AVISO_SIN_DATOS) return { nivel: "warn", texto: `Sin datos nuevos: última lectura ${hace(edad)}` };
  return { nivel: "ok", texto: `En línea · última lectura ${hace(edad)}` };
}

/** Evalúa cada métrica sobre la última lectura. Devuelve [{ metrica, valor, nivel, texto, sub }]. */
function evaluarUltima(ref) {
  const l = S.ultima[ref];
  if (!l) return [];
  return METRICAS.map((m) => {
    const real = m.real(l);
    if (real === null) return { metrica: m, valor: null, nivel: "info", texto: "Sin lectura de este sensor", sub: "" };
    const ev = m.evaluar(l);
    return { metrica: m, valor: real, nivel: ev.nivel, texto: ev.texto, sub: m.sub(l) };
  });
}

/** Alertas críticas vigentes de un sensor (incluye "sin conexión"). */
function alertasCriticas(ref) {
  const nombre = (S.dispositivos.find((d) => d.ref === ref) || {}).nombre || "Sensor";
  const lista = [];
  const con = estadoConexion(ref);
  if (con.nivel === "crit") lista.push({ clave: `${ref}:conexion`, nombre, titulo: "Sin conexión", detalle: con.texto });
  // Si la lectura es vieja ya no tiene sentido alertar por sus valores
  if ((edadMin(ref) ?? Infinity) < MIN_CRITICO_SIN_DATOS) {
    for (const e of evaluarUltima(ref)) {
      if (e.nivel === "crit") {
        lista.push({
          clave: `${ref}:${e.metrica.id}`,
          nombre,
          titulo: e.metrica.nombre,
          detalle: `${fmtNum(e.valor, e.metrica.decimales)} ${e.metrica.unidad} — ${e.texto}`,
        });
      }
    }
  }
  return lista;
}

// ----------------------------------------------------------------------------
// Avisos
// ----------------------------------------------------------------------------
const AVISOS_KEY = "chaja_sensor_avisos_v1";
const leerAvisos = () => {
  try { return JSON.parse(localStorage.getItem(AVISOS_KEY)) || {}; } catch { return {}; }
};
const guardarAvisos = (o) => {
  try { localStorage.setItem(AVISOS_KEY, JSON.stringify(o)); } catch { /* sin storage: se avisa igual, sólo sin memoria */ }
};

async function avisoDelSistema(titulo, cuerpo, tag) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const opciones = { body: cuerpo, tag, icon: "assets/logo.png", badge: "assets/logo.png", requireInteraction: true, data: { url: "#sensores" } };
  try {
    const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : null;
    if (reg) await reg.showNotification(titulo, opciones);
    else new Notification(titulo, opciones);
  } catch (err) {
    console.warn("[sensores] no se pudo mostrar la notificación:", err);
  }
}

/** Dispara avisos sólo cuando algo ENTRA en crítico (o sigue crítico pasado el tiempo de re-aviso). */
function procesarAlertas() {
  const registro = leerAvisos();
  const vigentes = new Set();
  const ahora = Date.now();
  let hayCritico = false;

  for (const d of S.dispositivos) {
    for (const a of alertasCriticas(d.ref)) {
      hayCritico = true;
      vigentes.add(a.clave);
      const previo = registro[a.clave];
      if (!previo || ahora - previo.ts >= REAVISO_MS) {
        registro[a.clave] = { ts: ahora };
        const titulo = `🚨 ${a.nombre}: ${a.titulo} crítica`;
        showToast(`${a.nombre} · ${a.titulo}: ${a.detalle}`, { type: "error" });
        avisoDelSistema(titulo, a.detalle, `sensor-${a.clave}`);
      }
    }
  }
  // Lo que ya volvió a la normalidad se olvida: si vuelve a fallar, avisa de nuevo
  for (const k of Object.keys(registro)) if (!vigentes.has(k)) delete registro[k];
  guardarAvisos(registro);

  document.title = document.title.replace(/^\(!\) /, "");
  if (hayCritico) document.title = `(!) ${document.title}`;
  document.querySelectorAll('.tile[href="#sensores"]').forEach((t) => t.classList.toggle("has-alert", hayCritico));
}

// ----------------------------------------------------------------------------
// Render
// ----------------------------------------------------------------------------
function mostrarVista() {
  const hayDisp = S.dispositivos.length > 0;
  $("sensCargando").hidden = S.cargado;
  $("sensVincular").hidden = !S.cargado || (hayDisp && !S.verVinculo);
  $("sensDashboard").hidden = !S.cargado || !hayDisp || S.verVinculo;
  $("sensVolver").hidden = !hayDisp;
}

function renderSelector() {
  const wrap = $("sensDevWrap");
  const sel = $("sensDevSelect");
  wrap.hidden = S.dispositivos.length < 2;
  sel.replaceChildren(
    ...S.dispositivos.map((d) => {
      const o = el("option", "", d.nombre);
      o.value = d.ref;
      return o;
    })
  );
  sel.value = S.ref;
}

function renderConexion() {
  const c = estadoConexion(S.ref);
  const chip = $("sensConexion");
  chip.className = `sens-chip sens-chip--${c.nivel}`;
  chip.replaceChildren(icono(c.nivel === "ok" ? "ok" : c.nivel), el("span", "", c.texto));
}

function renderAlertas() {
  const box = $("sensAlertas");
  const todas = S.dispositivos.flatMap((d) => alertasCriticas(d.ref));
  box.hidden = todas.length === 0;
  box.replaceChildren(
    ...todas.map((a) => {
      const row = el("div", "sens-alertas__item");
      row.appendChild(icono("crit"));
      const t = el("div");
      t.appendChild(el("strong", "", `${a.nombre} · ${a.titulo}`));
      t.appendChild(el("span", "", a.detalle));
      row.appendChild(t);
      return row;
    })
  );
}

function renderTarjetas() {
  const cont = $("sensCards");
  const evals = evaluarUltima(S.ref);
  if (!evals.length) {
    cont.replaceChildren(el("p", "sens-vacio", "Todavía no llegó ninguna lectura de este sensor. Con el dispositivo encendido y con WiFi, la primera aparece en unos minutos."));
    $("sensActualizado").textContent = "";
    return;
  }
  cont.replaceChildren(
    ...evals.map((e) => {
      const card = el("article", `sens-card sens-card--${e.nivel}`);
      const cab = el("header", "sens-card__head");
      cab.appendChild(icono(e.metrica.icono, "sens-card__icon"));
      cab.appendChild(el("h4", "sens-card__name", e.metrica.nombre));
      card.appendChild(cab);

      const val = el("p", "sens-card__value");
      if (e.valor === null) {
        val.appendChild(el("span", "sens-card__num", "—"));
      } else {
        val.appendChild(el("span", "sens-card__num", fmtNum(e.valor, e.metrica.decimales)));
        val.appendChild(el("span", "sens-card__unit", e.metrica.unidad));
      }
      card.appendChild(val);
      if (e.sub) card.appendChild(el("p", "sens-card__sub", e.sub));

      const badge = el("p", `sens-badge sens-badge--${e.nivel}`);
      badge.appendChild(icono(e.nivel));
      badge.appendChild(el("span", "", e.texto));
      card.appendChild(badge);
      return card;
    })
  );
  const u = S.ultima[S.ref];
  $("sensActualizado").textContent = `Lectura de las ${fmtHora(u.t)}`;
}

function colorDe(m) {
  const css = getComputedStyle(document.documentElement).getPropertyValue(m.colorVar).trim();
  return css || m.color;
}

function renderGrafico() {
  const canvas = $("sensChart");
  const vacio = $("sensChartVacio");
  const lecturas = (S.lecturas[S.ref] || []).filter((l) => numero(l.t) !== null);

  if (typeof window.Chart !== "function") {
    vacio.hidden = false;
    vacio.textContent = "No se pudo cargar la librería del gráfico. Revisá tu conexión y recargá la página.";
    canvas.hidden = true;
    return;
  }
  canvas.hidden = false;
  vacio.hidden = lecturas.length > 0;
  if (!lecturas.length) vacio.textContent = "No hay lecturas en este período. Probá con uno más largo.";

  const pocos = lecturas.length <= 3;
  const datasets = METRICAS.map((m) => ({
    label: m.etiquetaGrafico || m.nombre,
    metricaId: m.id,
    borderColor: colorDe(m),
    backgroundColor: colorDe(m),
    borderWidth: 2,
    borderDash: m.dash || [],
    tension: 0.25,
    pointRadius: pocos ? 3 : 0,
    pointHoverRadius: 5,
    spanGaps: 30 * 60 * 1000, // si pasan más de 30 min sin lecturas, la línea se corta (se nota el apagón)
    data: lecturas
      .filter((l) => m.real(l) !== null)
      .map((l) => ({ x: l.t, y: m.norm(l), real: m.real(l) })),
  }));

  const xs = lecturas.map((l) => l.t);
  const xMin = xs.length ? Math.min(...xs) : undefined;
  const xMax = xs.length ? Math.max(...xs) : undefined;
  const rango = xs.length ? xMax - xMin : 0;
  const conFecha = S.horas > 24 || rango > 24 * 3600 * 1000;

  if (S.chart) {
    S.chart.data.datasets = datasets;
    S.chart.options.scales.x.min = xMin === xMax ? xMin - 60000 : xMin;
    S.chart.options.scales.x.max = xMin === xMax ? xMax + 60000 : xMax;
    S.chart.options.scales.x.ticks.callback = (v) => (conFecha ? fmtFecha(v) : fmtHora(v));
    S.chart.update("none");
    return;
  }

  window.Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  window.Chart.defaults.color = getComputedStyle(document.documentElement).getPropertyValue("--ink-soft").trim() || "#4E5C51";

  S.chart = new window.Chart(canvas, {
    type: "line",
    data: { datasets },
    options: {
      parsing: false,
      normalized: true,
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { position: "bottom", labels: { usePointStyle: true, boxWidth: 8, padding: 14 } },
        tooltip: {
          callbacks: {
            title: (items) => (items.length ? fmtFecha(items[0].raw.x) : ""),
            label: (ctx) => {
              const m = METRICAS.find((x) => x.id === ctx.dataset.metricaId);
              return ` ${m.nombre}: ${fmtNum(ctx.raw.real, m.decimales)} ${m.unidad}`;
            },
          },
        },
      },
      scales: {
        x: {
          type: "linear",
          min: xMin === xMax ? xMin - 60000 : xMin,
          max: xMin === xMax ? xMax + 60000 : xMax,
          ticks: { maxTicksLimit: 7, maxRotation: 0, callback: (v) => (conFecha ? fmtFecha(v) : fmtHora(v)) },
          grid: { display: false },
        },
        y: {
          min: 0,
          max: 100,
          title: { display: true, text: "Nivel (% del rango de cada sensor)" },
          ticks: { stepSize: 25, callback: (v) => `${v}%` },
        },
      },
    },
  });
}

function renderTodo() {
  mostrarVista();
  if (!S.dispositivos.length || S.verVinculo) return;
  if (!S.ref || !S.dispositivos.some((d) => d.ref === S.ref)) S.ref = S.dispositivos[0].ref;
  renderSelector();
  renderConexion();
  renderAlertas();
  renderGrafico();
  renderTarjetas();
  $("sensRango").value = String(S.horas);
}

// ----------------------------------------------------------------------------
// Carga y refresco automático
// ----------------------------------------------------------------------------
async function cargar({ manual = false } = {}) {
  const id = ++S.cargaId;
  const btn = $("sensRefrescar");
  if (manual) btn.disabled = true;
  const res = await llamar("datos", { horas: S.horas });
  if (id !== S.cargaId) return; // llegó una respuesta más nueva
  if (manual) btn.disabled = false;

  const err = $("sensError");
  if (!res.ok) {
    // Si ya había datos, no los tapamos: sólo avisamos que no se pudo refrescar
    err.hidden = false;
    err.textContent = res.mensaje || "No se pudieron obtener los datos del sensor.";
    $("sensCargando").hidden = true;
    $("sensReintentar").hidden = S.cargado; // sin datos previos: ofrecemos reintentar a mano
    mostrarVista();
    return;
  }
  err.hidden = true;
  $("sensReintentar").hidden = true;

  S.skew = Date.now() - (res.ahora || Date.now());
  S.dispositivos = res.dispositivos || [];
  S.lecturas = res.lecturas || {};
  S.ultima = res.ultima || {};
  S.cargado = true;
  S.actualizado = Date.now();
  if (!S.dispositivos.length) S.verVinculo = false;

  renderTodo();
  procesarAlertas();

  // Sin sensores vinculados no hace falta seguir consultando
  if (!S.dispositivos.length) detener();
  else if (!S.timer) iniciarTimer();
}

function iniciarTimer() {
  detener();
  S.timer = setInterval(() => cargar(), CONFIG.sensores.refrescoMs);
}
function detener() {
  if (S.timer) clearInterval(S.timer);
  S.timer = null;
}

function reiniciar() {
  detener();
  S.cargaId++;
  Object.assign(S, { dispositivos: [], lecturas: {}, ultima: {}, ref: null, cargado: false, verVinculo: false });
  if (S.chart) { S.chart.destroy(); S.chart = null; }
  document.querySelectorAll('.tile[href="#sensores"]').forEach((t) => t.classList.remove("has-alert"));
  document.title = document.title.replace(/^\(!\) /, "");
}

// ----------------------------------------------------------------------------
// Permiso de notificaciones
// ----------------------------------------------------------------------------
function renderPermiso() {
  const btn = $("sensAvisos");
  const nota = $("sensAvisosNota");
  if (!("Notification" in window)) {
    btn.hidden = true;
    nota.textContent = "Este navegador no permite notificaciones; igual vas a ver las alertas en pantalla.";
    return;
  }
  btn.hidden = Notification.permission !== "default";
  nota.textContent =
    Notification.permission === "granted"
      ? "Avisos del navegador activados. Llegan mientras esta página esté abierta, aunque sea en segundo plano."
      : Notification.permission === "denied"
        ? "Los avisos del navegador están bloqueados para este sitio; habilitalos desde el candado de la barra de direcciones."
        : "Activá los avisos para recibir una notificación cuando un medidor llegue a estado crítico (con la página abierta).";
}

// ----------------------------------------------------------------------------
// Inicialización
// ----------------------------------------------------------------------------
export function initSensores() {
  const form = $("sensForm");
  if (!form) return;

  const inputCodigo = $("sensCodigo");
  const inputNombre = $("sensNombre");
  const status = $("sensFormStatus");
  let swRegistrado = false;

  inputCodigo.addEventListener("input", () => {
    inputCodigo.value = formatearCodigo(inputCodigo.value);
    status.textContent = "";
    status.classList.remove("is-error");
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const codigo = formatearCodigo(inputCodigo.value);
    if (!CODIGO_OK.test(codigo)) {
      status.textContent = "El código debe verse así: CHJ-XXXX-XXXX-XXXX.";
      status.classList.add("is-error");
      return;
    }
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    status.classList.remove("is-error");
    status.textContent = "Verificando código…";
    const res = await llamar("vincular", { codigo, nombre: inputNombre.value.trim() });
    btn.disabled = false;

    if (!res.ok) {
      status.textContent = res.mensaje || "No se pudo vincular el dispositivo.";
      status.classList.add("is-error");
      return;
    }
    status.textContent = "";
    showToast(res.mensaje || "Sensor vinculado");
    form.reset();
    S.verVinculo = false;
    S.cargado = false;
    mostrarVista();
    cargar();
  });

  $("sensOtro").addEventListener("click", () => { S.verVinculo = true; mostrarVista(); });
  $("sensVolver").addEventListener("click", () => { S.verVinculo = false; renderTodo(); });
  $("sensRefrescar").addEventListener("click", () => cargar({ manual: true }));
  $("sensReintentar").addEventListener("click", () => { $("sensCargando").hidden = false; cargar(); });
  $("sensDevSelect").addEventListener("change", (e) => { S.ref = e.target.value; renderConexion(); renderGrafico(); renderTarjetas(); });
  $("sensRango").addEventListener("change", (e) => { S.horas = Number(e.target.value) || 24; cargar({ manual: true }); });

  $("sensAvisos").addEventListener("click", async () => {
    try { await Notification.requestPermission(); } catch { /* Safari viejo con callback: se ignora */ }
    renderPermiso();
    if (Notification.permission === "granted") showToast("Avisos activados");
  });

  // Desvincular con doble toque (sin confirm(): la acción no se puede deshacer sola)
  const btnDes = $("sensDesvincular");
  let armado = null;
  btnDes.addEventListener("click", async () => {
    if (!armado) {
      btnDes.textContent = "¿Seguro? Tocá de nuevo para desvincular";
      armado = setTimeout(() => { armado = null; btnDes.textContent = "Desvincular este sensor"; }, 4000);
      return;
    }
    clearTimeout(armado);
    armado = null;
    btnDes.textContent = "Desvincular este sensor";
    btnDes.disabled = true;
    const res = await llamar("desvincular", { ref: S.ref });
    btnDes.disabled = false;
    showToast(res.mensaje || (res.ok ? "Sensor desvinculado" : "No se pudo desvincular"), { type: res.ok ? "success" : "error" });
    if (res.ok) { S.ref = null; S.cargado = false; mostrarVista(); cargar(); }
  });

  // Al volver a la pestaña, si pasó más de un minuto desde la última carga, refrescamos
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && S.timer && Date.now() - (S.actualizado || 0) > 60000) cargar();
  });
  // Cada tanto se reevalúa la antigüedad de la última lectura aunque no haya datos nuevos
  setInterval(() => { if (S.cargado && S.dispositivos.length && !S.verVinculo) { renderConexion(); renderAlertas(); procesarAlertas(); } }, 60000);

  let usuarioActual = null;
  function alCambiarSesion() {
    const { user } = store.get();
    const id = user.isAuthenticated ? user.usuarioId : null;
    if (id === usuarioActual) return;
    usuarioActual = id;
    reiniciar();
    mostrarVista();
    if (!id) return;
    renderPermiso();
    if (!swRegistrado && "serviceWorker" in navigator) {
      swRegistrado = true;
      navigator.serviceWorker.register("sw.js").catch((err) => console.warn("[sensores] sin service worker:", err));
    }
    cargar();
  }
  store.subscribe(alCambiarSesion);
  alCambiarSesion();
}
