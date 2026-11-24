// ============================================================================
// informeMensual.js — "Informe Mensual" (dentro de "Análisis de la producción").
// Habla con el webhook propio de n8n (CONFIG.informe.webhookUrl, workflow
// CHAJA_BOT_INFORME): "listar" trae los meses con actividad y los informes ya
// guardados; "generar" arma (o actualiza) el informe de un mes.
//
// Reglas: un mes terminado tiene UN solo informe final y no se puede volver a
// generar. Un mes en curso se puede actualizar las veces que haga falta.
//
// Producción + grupo: el informe ahora se pide siempre para UNA producción
// (gallinas/pollos/cerdos/huerta) y, dentro de ella, para UN grupo puntual o
// para "todos los grupos". Esto se manda al backend como tipo_produccion y
// grupo_id — el backend (workflow n8n CHAJA_BOT_INFORME) todavía necesita
// adaptarse para usarlos de verdad (ver CHAJA_BOT_INFORME.json); mientras
// tanto los manda igual, así que no rompe nada si el backend los ignora.
//
// Grupos: se leen de store.grupos (los crea groups.js). El grupo elegido viaja
// en el body ({ nombre, cantidad, edad_semanas }) y el backend calcula la
// etapa de vida con eso. Si groups.js guarda una fecha de creación
// (createdAt), la edad se actualiza sola con el paso del tiempo.
// ============================================================================

import { CONFIG } from "../config.js";
import { getUsuarioId } from "../auth.js";
import { store } from "../state.js";
import { nombreMes, renderInforme, destruirGraficos } from "./informeRender.js";

const S = {
  produccion: "gallinas",
  grupo: "",              // "" = todos los grupos de la producción elegida
  gruposPorTipo: {},      // cache: tipo -> [{id, nombre}]
  combos: {},             // comboKey -> { cargado, mesActual, meses, informes }
  ocupado: false,
};
const $ = (id) => document.getElementById(id);

const comboKey = (tipo, grupo) => `${tipo}::${grupo || "todos"}`;
function comboActual() {
  const k = comboKey(S.produccion, S.grupo);
  if (!S.combos[k]) S.combos[k] = { cargado: false, mesActual: "", meses: [], informes: {} };
  return S.combos[k];
}

const SEMANAS_POR_UNIDAD = { días: 1 / 7, dias: 1 / 7, semanas: 1, meses: 52 / 12 };

/** Tipos que usa el store (state.js / production.js) -> tipo del informe. */
const TIPO_STORE_A_INFORME = {
  ponedoras: "gallinas", gallinas: "gallinas",
  parrilleros: "pollos", pollos: "pollos",
  chanchos: "cerdos", cerdos: "cerdos",
  huerta: "huerta",
};

/** Deduce gallinas/pollos/cerdos/huerta a partir de p.type de la producción de origen. */
function tipoDeProduccion(p) {
  if (!p) return null;
  return TIPO_STORE_A_INFORME[String(p.type ?? "").toLowerCase()] ?? null; // null = desconocido: el grupo se muestra igual en cualquier producción
}

/** Edad del grupo en semanas AL DÍA DE HOY: la edad cargada + el tiempo que pasó desde que se creó el grupo (si guarda fecha). */
function edadHoyEnSemanas(g) {
  const base = Number(g.age) * (SEMANAS_POR_UNIDAD[g.ageUnit] ?? 1);
  if (!Number.isFinite(base)) return null;
  const creado = new Date(g.createdAt ?? NaN).getTime();
  const extra = Number.isFinite(creado) ? Math.max(0, (Date.now() - creado) / (7 * 86400000)) : 0;
  return Math.round((base + extra) * 10) / 10;
}

/** Lee los grupos del panel "Grupos de producción" (groups.js los guarda en store.grupos). */
function leerGrupos(tipo) {
  try {
    const { grupos = [], producciones = [] } = store.get();
    return grupos
      .filter((g) => { const t = tipoDeProduccion(producciones.find((p) => p.id === g.sourceId)); return t === null || t === tipo; })
      .map((g) => ({ id: String(g.id), nombre: String(g.name ?? "Grupo"), cantidad: Number(g.qty) || null, edad_semanas: edadHoyEnSemanas(g) }));
  } catch (err) {
    console.warn("[informe] no se pudieron leer los grupos:", err);
    return [];
  }
}

function opcionesDeGrupo() {
  const grupos = leerGrupos(S.produccion);
  S.gruposPorTipo[S.produccion] = grupos;
  const sel = $("informeGrupo");
  const previo = sel.value;
  sel.innerHTML = "";
  sel.append(Object.assign(document.createElement("option"), { value: "", textContent: "Todos los grupos" }));
  for (const g of grupos) sel.append(Object.assign(document.createElement("option"), { value: g.id, textContent: g.nombre }));
  sel.value = grupos.some((g) => g.id === previo) ? previo : "";
  S.grupo = sel.value;
  actualizarRecomendacion();
}

function actualizarRecomendacion() {
  const nota = $("informeRecomendacion");
  const grupos = S.gruposPorTipo[S.produccion] || [];
  if (S.grupo === "" && grupos.length > 1) {
    nota.hidden = false;
    nota.textContent = `Hay ${grupos.length} grupos cargados en esta producción, con edades distintas. Para que la etapa de vida y la curva de postura por edad salgan precisas, conviene generar el informe grupo por grupo en lugar de "Todos los grupos".`;
  } else {
    nota.hidden = true;
  }
}

/** Datos del grupo elegido (nombre, cantidad, edad hoy en semanas) para que el backend calcule la etapa de vida sin depender de una tabla "grupos". */
function grupoElegido() {
  if (!S.grupo) return null;
  const g = (S.gruposPorTipo[S.produccion] || []).find((x) => x.id === S.grupo);
  return g ? { nombre: g.nombre, cantidad: g.cantidad, edad_semanas: g.edad_semanas } : null;
}

async function llamar(accion, extra = {}) {
  const usuarioId = getUsuarioId();
  if (!usuarioId) return { ok: false, mensaje: "Iniciá sesión para ver tus informes." };
  const ctl = new AbortController();
  const corte = setTimeout(() => ctl.abort(), 120000); // la IA puede tardar
  let res;
  try {
    res = await fetch(CONFIG.informe.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion, usuario_id: usuarioId, tipo_produccion: S.produccion, grupo_id: S.grupo || null, grupo: grupoElegido(), ...extra }),
      signal: ctl.signal,
    });
  } catch (err) {
    console.error("[informe] fetch falló:", err);
    return { ok: false, mensaje: err.name === "AbortError" ? "El informe tardó demasiado. Probá de nuevo en un momento." : "No se pudo conectar con el servidor." };
  } finally { clearTimeout(corte); }
  if (!res.ok) { console.error(`[informe] el webhook respondió ${res.status}`); return { ok: false, mensaje: `Error del servidor (${res.status}).` }; }
  const crudo = await res.text();
  try { return JSON.parse(crudo); }
  catch (err) { console.error("[informe] respuesta no es JSON:", err, crudo); return { ok: false, mensaje: "El servidor respondió en un formato inesperado." }; }
}

function estado(msg, error = false) {
  const s = $("informeStatus");
  s.textContent = msg || "";
  s.classList.toggle("is-error", !!error);
}

function opcionesDeMes() {
  const c = comboActual();
  const sel = $("informeMes");
  const previo = sel.value;
  sel.innerHTML = "";
  for (const m of c.meses) {
    const inf = c.informes[m.mes];
    const o = document.createElement("option");
    o.value = m.mes;
    o.textContent = nombreMes(m.mes) + (m.mes === c.mesActual ? " (en curso)" : "") + (inf ? (inf.completo ? " · informe final" : " · con informe") : "");
    sel.append(o);
  }
  sel.value = c.meses.some((m) => m.mes === previo) ? previo : (c.meses[0] ? c.meses[0].mes : "");
}

function pintar() {
  const c = comboActual();
  const mes = $("informeMes").value;
  const aviso = $("informeAviso"), btn = $("informeBtn"), cuerpo = $("informeBody");
  destruirGraficos();
  cuerpo.replaceChildren();
  if (!mes) { aviso.hidden = true; btn.hidden = true; cuerpo.append(Object.assign(document.createElement("p"), { className: "informe__vacio", textContent: "Todavía no hay registros para armar un informe." })); return; }

  const inf = c.informes[mes];
  const cerrado = mes < c.mesActual;
  const info = c.meses.find((m) => m.mes === mes);

  let texto = "", tipo = "";
  if (!cerrado) { texto = "Este mes todavía está en curso: aún no están todos los datos, así que el informe puede quedar incompleto o fallar. Podés actualizarlo cuando quieras."; tipo = "is-warn"; }
  else if (inf && inf.completo) { texto = "Informe final: el mes ya terminó, por eso no se puede generar de nuevo."; tipo = "is-ok"; }
  else if (inf) { texto = "Este informe se armó cuando el mes seguía en curso. Generá el informe final ahora que terminó: después ya no se podrá modificar."; tipo = "is-warn"; }
  else if (info && info.registros === 0) { texto = "Todavía no hay registros cargados en este mes."; tipo = "is-warn"; }
  aviso.hidden = !texto;
  aviso.textContent = texto;
  aviso.className = "informe__aviso " + tipo;

  btn.hidden = !!(inf && inf.completo);
  btn.textContent = !inf ? "Armar informe mensual" : cerrado ? "Generar informe final" : "Actualizar informe";
  btn.disabled = S.ocupado || (info && info.registros === 0);

  const grupoNombre = S.grupo ? (S.gruposPorTipo[S.produccion] || []).find((g) => g.id === S.grupo)?.nombre || null : null;
  const contexto = { tipoProduccion: S.produccion, grupoNombre };
  if (inf) cuerpo.append(renderInforme({ ...inf, mes, contexto }));
  else cuerpo.append(Object.assign(document.createElement("p"), { className: "informe__vacio", textContent: `Todavía no hay informe de ${nombreMes(mes)}.` }));
}

async function cargar() {
  estado("Cargando…");
  const r = await llamar("listar");
  if (!r.ok) { estado(r.mensaje || "No se pudo cargar.", true); return false; }
  const c = comboActual();
  c.mesActual = r.mes_actual;
  c.meses = r.meses || [];
  c.informes = Object.fromEntries((r.informes || []).map((i) => [i.mes, i]));
  c.cargado = true;
  estado("");
  opcionesDeMes();
  pintar();
  return true;
}

async function generar() {
  const mes = $("informeMes").value;
  if (!mes || S.ocupado) return;
  S.ocupado = true;
  $("informeBtn").disabled = true;
  estado("Armando el informe… puede tardar hasta un minuto.");
  const r = await llamar("generar", { mes });
  S.ocupado = false;
  if (!r.ok) { estado(r.mensaje || "No se pudo armar el informe.", true); pintar(); return; }
  comboActual().informes[mes] = { ...r.informe, mes };
  estado(r.mensaje || "");
  opcionesDeMes();
  $("informeMes").value = mes;
  pintar();
}

async function cambiarProduccionOGrupo() {
  estado("");
  const c = comboActual();
  if (!c.cargado) await cargar();
  else { opcionesDeMes(); pintar(); }
}

/** Muestra el panel del informe; la primera vez trae los datos. */
export async function abrirInforme() {
  $("informe").hidden = false;
  opcionesDeGrupo();
  if (!comboActual().cargado) await cargar(); else pintar();
}
export function cerrarInforme() { const p = $("informe"); if (p) p.hidden = true; destruirGraficos(); }

export function initInformeMensual() {
  if (!$("informe")) return;
  $("informeProduccion").addEventListener("change", (e) => { S.produccion = e.target.value; opcionesDeGrupo(); cambiarProduccionOGrupo(); });
  $("informeGrupo").addEventListener("change", (e) => { S.grupo = e.target.value; actualizarRecomendacion(); cambiarProduccionOGrupo(); });
  $("informeMes").addEventListener("change", () => { estado(""); pintar(); });
  $("informeBtn").addEventListener("click", generar);
  // Si se crea un grupo con el informe abierto, el selector se actualiza solo.
  store.subscribe(() => { if (!$("informe").hidden) opcionesDeGrupo(); });
}
