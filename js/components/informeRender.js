// ============================================================================
// informeRender.js — dibuja un informe mensual (indicadores, gráficos con
// Chart.js y análisis) como UNA sola hoja compacta. No habla con la red ni
// importa nada del proyecto: recibe el informe ya armado por n8n y devuelve
// DOM. Todo el texto (incluido el que escribe la IA) entra con textContent,
// nunca como HTML.
//
// Edad de postura / etapa de vida: si el informe trae `datos.edad_postura`
// (lo arma el backend a partir del grupo elegido — ver CHAJA_BOT_INFORME.json),
// se muestran dos KPI extra y un 4º gráfico con la curva de postura promedio
// por semana de vida, marcando la semana estimada de recambio. Si todavía no
// viene ese dato (grupo sin edad cargada, o backend no actualizado), esas
// partes simplemente no se dibujan — el resto del informe sigue funcionando.
// ============================================================================

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export function nombreMes(ym) {
  const [y, m] = String(ym).split("-").map(Number);
  return MESES[m - 1] ? `${MESES[m - 1]} ${y}` : ym;
}

const NOMBRE_PRODUCCION = { gallinas: "Gallinas (postura)", pollos: "Pollos", cerdos: "Cerdos", huerta: "Huerta" };

const fmt = (n, d = 0) => (n === null || n === undefined || !Number.isFinite(Number(n)))
  ? "—"
  : Number(n).toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d });
const plata = (n, d = 0) => (n === null || n === undefined) ? "—" : "$" + fmt(n, d);

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

const css = (v, fb) => getComputedStyle(document.documentElement).getPropertyValue(v).trim() || fb;
let charts = [];
export function destruirGraficos() { charts.forEach((c) => c.destroy()); charts = []; }

function kpi(valor, etiqueta, nota) {
  const k = el("div", "informe-kpi");
  k.append(el("div", "informe-kpi__valor", valor), el("div", "informe-kpi__etiqueta", etiqueta));
  if (nota) k.append(el("div", "informe-kpi__nota", nota));
  return k;
}

function bloqueGrafico(titulo, subtitulo, hayDatos, vacio, dibujar) {
  const box = el("section", "informe-chart");
  box.append(el("h4", "informe-chart__titulo", titulo));
  if (subtitulo) box.append(el("p", "informe-chart__sub", subtitulo));
  if (!hayDatos) { box.append(el("p", "informe-chart__vacio", vacio)); return box; }
  const wrap = el("div", "informe-chart__lienzo");
  const canvas = document.createElement("canvas");
  wrap.append(canvas); box.append(wrap);
  // Chart.js necesita el canvas ya dentro del documento para medirlo: se dibuja en el siguiente frame.
  requestAnimationFrame(() => { if (window.Chart && canvas.isConnected) charts.push(dibujar(canvas)); });
  return box;
}

const base = (extra = {}) => ({
  responsive: true, maintainAspectRatio: false, spanGaps: true,
  interaction: { mode: "index", intersect: false },
  plugins: { legend: { display: false } },
  ...extra,
});
const ejeX = { title: { display: true, text: "Día del mes" }, grid: { display: false } };

/** Plugin de Chart.js casero para marcar una línea vertical + etiqueta (acá: la semana de recambio). No depende de chartjs-plugin-annotation (no está cargado en la web). */
function pluginLineaVertical(indiceX, color, etiqueta) {
  return {
    id: "lineaVertical",
    afterDraw(chart) {
      if (indiceX === null || indiceX === undefined) return;
      const { ctx, chartArea, scales } = chart;
      const x = scales.x.getPixelForValue(indiceX);
      if (!Number.isFinite(x) || x < chartArea.left || x > chartArea.right) return;
      ctx.save();
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
      ctx.beginPath(); ctx.moveTo(x, chartArea.top); ctx.lineTo(x, chartArea.bottom); ctx.stroke();
      ctx.setLineDash([]);
      if (etiqueta) {
        ctx.fillStyle = color; ctx.font = "600 11px var(--font-body, sans-serif)"; ctx.textBaseline = "top";
        const ancho = ctx.measureText(etiqueta).width;
        const tx = Math.min(Math.max(x - ancho / 2, chartArea.left), chartArea.right - ancho);
        ctx.fillText(etiqueta, tx, chartArea.top + 2);
      }
      ctx.restore();
    },
  };
}

export function renderInforme(inf) {
  destruirGraficos();
  const d = inf.datos || {}, k = d.kpis || {}, a = inf.analisis || {}, c = d.correlacion || {};
  const ep = d.edad_postura || null;
  const ctx = inf.contexto || {};
  const raiz = el("article", "informe-doc");

  // Encabezado
  const cab = el("header", "informe-doc__cab");
  const t = el("h3", "informe-doc__titulo", `Informe de ${nombreMes(inf.mes)}`);
  const estado = el("span", "informe-badge " + (inf.completo ? "is-final" : "is-parcial"), inf.completo ? "Informe final" : "Datos parciales");
  cab.append(t, estado);
  if (ep && ep.etapa) cab.append(el("span", "informe-badge is-etapa", ep.etapa));
  raiz.append(cab);

  const metaBits = [];
  if (ctx.tipoProduccion) metaBits.push(NOMBRE_PRODUCCION[ctx.tipoProduccion] || ctx.tipoProduccion);
  metaBits.push(ctx.grupoNombre ? `Grupo: ${ctx.grupoNombre}` : "Todos los grupos");
  raiz.append(el("p", "informe-doc__contexto", metaBits.join(" · ")));

  if (inf.generado_en) {
    const f = new Date(inf.generado_en);
    raiz.append(el("p", "informe-doc__meta", `Generado el ${f.toLocaleDateString("es-AR")} a las ${f.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}` + (a.fuente === "automatico" ? " · sin análisis de IA" : "")));
  }

  // Indicadores
  const grid = el("div", "informe-kpis");
  grid.append(
    kpi(fmt(k.total_huevos), "Huevos en el mes", `${fmt(k.dias_con_registro)} días con registro`),
    kpi(fmt(k.promedio_diario, 1), "Promedio por día", k.tendencia_pct == null ? null : `${k.tendencia_pct > 0 ? "▲" : k.tendencia_pct < 0 ? "▼" : "="} ${fmt(Math.abs(k.tendencia_pct), 1)}% 2ª mitad vs 1ª`),
    kpi(k.mejor_dia ? fmt(k.mejor_dia.huevos) : "—", "Mejor día", k.mejor_dia ? `día ${Number(k.mejor_dia.fecha.slice(8))}` : null),
    kpi(plata(k.gasto_alimento_total), "Gasto en alimento", `${fmt(k.alimento_kg_total, 1)} kg consumidos`),
    kpi(plata(k.precio_kg_promedio), "Precio del alimento", k.precio_kg_min != null ? `por kg · entre ${plata(k.precio_kg_min)} y ${plata(k.precio_kg_max)}` : "por kg"),
    kpi(plata(k.costo_por_docena), "Costo por docena", "alimento / huevos")
  );
  if (ep) {
    grid.append(
      kpi(ep.semana_actual != null ? `sem. ${fmt(ep.semana_actual)}` : "—", "Edad del grupo", ep.etapa || null),
      kpi(ep.semana_recambio_estimada != null ? `sem. ${fmt(ep.semana_recambio_estimada)}` : "—", "Recambio estimado", ep.semana_actual != null && ep.semana_recambio_estimada != null ? `faltan ${fmt(Math.max(0, ep.semana_recambio_estimada - ep.semana_actual))} semanas` : null)
    );
  }
  raiz.append(grid);

  const verde = css("--forest", "#1F4D33"), trigo = css("--wheat", "#B9862E"), cielo = css("--sky", "#2F6B8A"), linea = css("--line", "#DED7C6"), clay = css("--clay", "#9B4A3B");
  const dias = d.dias || [];
  const hay = (arr) => Array.isArray(arr) && arr.some((v) => v !== null && v !== undefined);

  const charts3 = el("div", "informe-charts-grid");

  // 1) Curva de postura
  charts3.append(bloqueGrafico("Curva de postura", "Huevos recolectados por día", hay(d.postura), "No hay huevos registrados este mes.", (cv) =>
    new window.Chart(cv, { type: "line",
      data: { labels: dias, datasets: [{ label: "Huevos", data: d.postura, borderColor: verde, backgroundColor: verde + "22", fill: true, tension: 0.3, pointRadius: 3 }] },
      options: base({ scales: { x: ejeX, y: { beginAtZero: true, title: { display: true, text: "Huevos" }, grid: { color: linea } } } }) })));

  // 2) Precio del alimento
  charts3.append(bloqueGrafico("Precio del alimento", "Pesos por kilo, según lo cargado cada día", hay(d.precio_kg), "No hay precio del alimento cargado este mes.", (cv) =>
    new window.Chart(cv, { type: "line",
      data: { labels: dias, datasets: [{ label: "$ por kg", data: d.precio_kg, borderColor: trigo, backgroundColor: trigo, stepped: true, pointRadius: 3 }] },
      options: base({ scales: { x: ejeX, y: { beginAtZero: true, title: { display: true, text: "$ por kg" }, grid: { color: linea } } } }) })));

  // 3) Postura vs horas de luz
  const hayLuz = hay(d.horas_luz) && hay(d.postura);
  const sub3 = c.r != null ? `Relación ${c.lectura} · r = ${fmt(c.r, 2)} con ${c.n} días` : "Horas de luz por día (barras) junto a la postura (línea)";
  charts3.append(bloqueGrafico("Postura y horas de luz", sub3, hayLuz, "No hay lecturas de horas de luz del sensor para este mes.", (cv) =>
    new window.Chart(cv, {
      data: { labels: dias, datasets: [
        { type: "bar", label: "Horas de luz", data: d.horas_luz, backgroundColor: cielo + "55", borderColor: cielo, borderWidth: 1, yAxisID: "y1", order: 2 },
        { type: "line", label: "Huevos", data: d.postura, borderColor: verde, backgroundColor: verde, tension: 0.3, pointRadius: 3, yAxisID: "y", order: 1 } ] },
      options: base({ plugins: { legend: { display: true, position: "bottom" } }, scales: {
        x: ejeX,
        y: { beginAtZero: true, position: "left", title: { display: true, text: "Huevos" }, grid: { color: linea } },
        y1: { beginAtZero: true, position: "right", title: { display: true, text: "Horas de luz" }, grid: { drawOnChartArea: false } } } }) })));

  // 4) Postura por edad del grupo (semanas de vida), con la semana de recambio marcada
  const serie = ep && Array.isArray(ep.serie_semanal) ? ep.serie_semanal : [];
  const hayEdad = serie.length > 0;
  const semanas = serie.map((s) => s.semana);
  const valores = serie.map((s) => s.postura_pct ?? s.postura_promedio ?? null);
  const idxRecambio = hayEdad && ep.semana_recambio_estimada != null
    ? semanas.reduce((mejorI, s, i) => Math.abs(s - ep.semana_recambio_estimada) < Math.abs(semanas[mejorI] - ep.semana_recambio_estimada) ? i : mejorI, 0)
    : null;
  charts3.append(bloqueGrafico(
    "Postura por edad del grupo", hayEdad ? "Postura promedio por semana de vida · línea punteada = recambio sugerido" : null,
    hayEdad, "Todavía no hay edad cargada para este grupo: completala en Grupos de producción para ver esta curva.",
    (cv) => new window.Chart(cv, { type: "line",
      data: { labels: semanas.map(String), datasets: [{ label: "Postura %", data: valores, borderColor: clay, backgroundColor: clay + "22", fill: true, tension: 0.3, pointRadius: 2 }] },
      options: base({ scales: {
        x: { title: { display: true, text: "Semana de vida" }, grid: { display: false } },
        y: { beginAtZero: true, max: 100, title: { display: true, text: "Postura %" }, grid: { color: linea } } } }),
      plugins: idxRecambio !== null ? [pluginLineaVertical(idxRecambio, clay, `recambio · sem. ${fmt(ep.semana_recambio_estimada)}`)] : [] })));

  raiz.append(charts3);

  // Análisis
  const an = el("section", "informe-analisis");
  an.append(el("h4", "informe-chart__titulo", "Análisis"));
  if (a.resumen) an.append(el("p", "informe-analisis__resumen", a.resumen));
  const seccion = (titulo, items, cls) => {
    if (!items || !items.length) return;
    an.append(el("h5", "informe-analisis__sub", titulo));
    const ul = el("ul", "informe-analisis__lista " + (cls || ""));
    items.forEach((x) => ul.append(el("li", null, x)));
    an.append(ul);
  };
  seccion("Lo que se ve en los datos", a.hallazgos);
  seccion("Qué podrías hacer", a.recomendaciones);
  seccion("Ojo con estos límites", [...(a.limitaciones || []), ...(d.avisos || [])].filter((x, i, arr) => arr.indexOf(x) === i), "is-aviso");
  raiz.append(an);
  return raiz;
}
