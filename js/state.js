// ============================================================================
// state.js
// Store en memoria muy simple, con datos de ejemplo. El día que haya una API
// real, las funciones "add*" son el único lugar que necesita empezar a hacer
// fetch/await en lugar de mutar el array local (ver api.js).
// ============================================================================

let idCounter = 100;
const nextId = () => String(idCounter++);

const listeners = new Set();

const state = {
  producciones: [
    { id: "p1", type: "ponedoras", name: "Ponedoras — lote A", qty: 40, age: null, createdAt: "2026-06-02" },
    { id: "p2", type: "chanchos", name: "Chanchos — corral 2", qty: 12, age: null, createdAt: "2026-07-14" },
    { id: "p3", type: "parrilleros", name: "Parrilleros — galpón 1", qty: 150, age: 5, createdAt: "2026-08-10" },
  ],
  grupos: [
    { id: "g1", sourceId: "p1", name: "Ponedoras 1", qty: 5, age: 9, ageUnit: "meses" },
    { id: "g2", sourceId: "p3", name: "Parrilleros 1A", qty: 60, age: 5, ageUnit: "semanas" },
  ],
  movimientos: [
    { id: "m1", direction: "entrada", type: "huevos", qty: 38, date: "2026-08-18", note: "Recolección diaria" },
    { id: "m2", direction: "salida", type: "kg_pollo", qty: 22.5, date: "2026-08-17", note: "Venta a distribuidor" },
    { id: "m3", direction: "entrada", type: "kg_chancho", qty: 60, date: "2026-08-15", note: "" },
  ],
  user: {
    isAuthenticated: false,
    name: null,
    email: null,
  },
};

function emit() {
  listeners.forEach((fn) => fn(state));
}

export const store = {
  get() {
    return state;
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  addProduccion({ type, name, qty, age }) {
    const item = {
      id: nextId(),
      type,
      name,
      qty,
      age: age ?? null,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    state.producciones.unshift(item);
    emit();
    return item;
  },
  addGrupo({ sourceId, name, qty, age, ageUnit }) {
    const item = { id: nextId(), sourceId, name, qty, age, ageUnit };
    state.grupos.unshift(item);
    emit();
    return item;
  },
  addMovimiento({ direction, type, qty, date, note }) {
    const item = { id: nextId(), direction, type, qty, date, note };
    state.movimientos.unshift(item);
    emit();
    return item;
  },
  setUser(user) {
    state.user = { ...state.user, ...user };
    emit();
  },
};
