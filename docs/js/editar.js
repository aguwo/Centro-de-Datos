// Paso 117: editar un apartado. Cada apartado (Salud, Finanzas, Universidad...) es una plantilla: sus columnas de
// widgets en apartados.js. Con «Editar apartado» se arma un borrador de esas columnas y se cambia a gusto:
// subir, bajar o cambiar de columna cada pieza, quitarla, agregar cualquier otra widget, cambiar el ancho de una
// columna o sumar columnas. Al guardar va a tu cuenta (tabla disposiciones, llave apartado:<id>); sin cambios, o con
// «Volver a la de siempre», se borra y vale la de apartados.js. Aquí no hay nada de un apartado en particular.
import { el, db, datos, escribir } from "./base.js";
import { icono } from "./dibujos.js";

export const llaveEditada = (a) => "apartado:" + a.id;

// ---------- Los cambios al borrador (cada uno devuelve un borrador nuevo; ci = columna, pi = pieza) ----------
const conColumna = (b, ci, cambio) => b.map((c, j) => (j === ci ? { ...c, ...cambio(c) } : c));
// Una pieza solo pasa a la columna de al lado si es de las normales (no un título de bloque ni el costado).
export const puedeIrA = (b, j) => !!b[j] && !b[j].bloque && !b[j].costado;
export const CAMBIOS = {
  mover: (b, ci, pi, d) => conColumna(b, ci, (c) => { const w = [...c.widgets]; [w[pi], w[pi + d]] = [w[pi + d], w[pi]]; return { widgets: w }; }),
  cambiarDeColumna: (b, ci, pi, d) => conColumna(conColumna(b, ci + d, (c) => ({ widgets: [...c.widgets, b[ci].widgets[pi]] })),
    ci, (c) => ({ widgets: c.widgets.filter((_, k) => k !== pi) })),
  quitar: (b, ci, pi) => conColumna(b, ci, (c) => ({ widgets: c.widgets.filter((_, k) => k !== pi) })),
  agregar: (b, ci, id) => conColumna(b, ci, (c) => ({ widgets: [...c.widgets, id] })),
  ancho: (b, ci, d) => conColumna(b, ci, (c) => ({ ancho: Math.max(0.5, Math.round(((c.ancho ?? 1) + d) * 4) / 4) })),
  columna: (b, ci) => [...b.slice(0, ci + 1), { ancho: 1, widgets: [] }, ...b.slice(ci + 1)],
};

// ---------- Los controles ----------
const boton = (texto, titulo, hacer, apagado) => el("button", { type: "button", className: "boton-icono", textContent: texto, title: titulo,
  ariaLabel: titulo, disabled: !!apagado, onclick: hacer });

// Sobre cada pieza: ↑ ↓ ← → ×. editar(cambio, ...datos) aplica uno de CAMBIOS al borrador.
export function controlesDePieza(b, ci, pi, editar) {
  const n = b[ci].widgets.length;
  return el("div", { className: "controles-pieza" },
    boton("↑", "Subir", () => editar("mover", ci, pi, -1), pi === 0),
    boton("↓", "Bajar", () => editar("mover", ci, pi, 1), pi === n - 1),
    boton("←", "A la columna de la izquierda", () => editar("cambiarDeColumna", ci, pi, -1), !puedeIrA(b, ci - 1)),
    boton("→", "A la columna de la derecha", () => editar("cambiarDeColumna", ci, pi, 1), !puedeIrA(b, ci + 1)),
    boton("×", "Quitar", () => editar("quitar", ci, pi)));
}

// Arriba de cada columna: su ancho y sumar una columna a su derecha.
export const controlesDeColumna = (b, ci, editar) => el("div", { className: "controles-columna" },
  el("span", { textContent: "Ancho" }),
  boton("−", "Más angosta", () => editar("ancho", ci, -0.25), (b[ci].ancho ?? 1) <= 0.5),
  boton("+", "Más ancha", () => editar("ancho", ci, 0.25)),
  el("span", { className: "relleno" }),
  boton("⊞", "Columna nueva a la derecha", () => editar("columna", ci)));

// Abajo de cada columna: agregar cualquier widget, agrupadas por el apartado donde vive cada una (la caja de bloques).
// grupos = [[nombre del grupo, [[id, nombre], ...]], ...]
export const agregarEn = (ci, grupos, editar) => el("select", { className: "agregar-pieza", ariaLabel: "Agregar una pieza",
  onchange: (e) => e.target.value && editar("agregar", ci, e.target.value) },
  el("option", { value: "", textContent: "+ Agregar pieza…" }),
  ...grupos.map(([g, ws]) => el("optgroup", { label: g }, ...ws.map(([id, nombre]) => el("option", { value: id, textContent: nombre })))));

// La barra de arriba mientras editas: cancelar, volver a la de siempre (si guardaste una tuya) y guardar.
export function barraDeEdicion(a, { tuya, guardar, cancelar }) {
  return el("div", { className: "editor-vista editor-apartado" }, el("footer", {},
    icono("secciones"), el("span", { textContent: `Editando «${a.nombre}»` }),
    el("span", { className: "relleno" }),
    tuya ? el("button", { type: "button", textContent: "Volver a la de siempre", onclick: () => guardar(null) }) : "",
    el("button", { type: "button", textContent: "Cancelar", onclick: cancelar }),
    el("button", { type: "button", className: "principal", textContent: "Guardar", onclick: () => guardar() })));
}

// Guarda tus columnas, o las borra si son las de siempre (o si columnas es null).
export function guardarEditada(a, columnas, deSiempre) {
  const llave = llaveEditada(a);
  if (!columnas || JSON.stringify(columnas) === JSON.stringify(deSiempre))
    return datos.disposiciones.has(llave) && escribir(db.from("disposiciones").delete().eq("apartado", llave), () => datos.disposiciones.delete(llave));
  return escribir(db.from("disposiciones").upsert({ apartado: llave, columnas }, { onConflict: "owner_id,apartado" }),
    () => datos.disposiciones.set(llave, columnas));
}
