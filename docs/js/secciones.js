// Paso 116: las vistas por carpeta. Cada carpeta de Archivos se puede armar por secciones, de arriba hacia abajo.
// En cada sección eliges qué muestra (eso lo sabe archivos.js: sus carpetas, lo suelto, todas las tareas de
// adentro...) y cómo se ve (eso está aquí, en COMO).
// Se guardan en tu cuenta, en la tabla disposiciones (la misma de los apartados), con la llave carpeta:<id> para
// una carpeta o tipo:<clave> para todas las de una categoría. Una carpeta sin vista propia usa la de su categoría
// y, si tampoco hay, la de siempre. Todo es genérico: ninguna carpeta tiene código propio, y una manera nueva de
// verse es una entrada más en COMO.
import { el, datos, db, escribir, dia } from "./base.js";
import { hoyTexto } from "./fechas.js";

// ---------- Cómo se ve una sección ----------
// dibujar(cosas, { pieza, esCarpeta }): pieza(x) es la tarjeta o la forma de la cosa, y pieza(x, "lista") su fila.
const ESTADOS = ["Inbox", "Por hacer", "En curso", "Esperando", "Hecho"]; // el orden de las columnas del tablero
export const COMO = {
  tarjetas: { nombre: "Tarjetas", dibujar: (cosas, { pieza, esCarpeta }) => el("div", { className: "tarjetas-seccion" },
    ...[cosas.filter(esCarpeta), cosas.filter((x) => !esCarpeta(x))].filter((xs) => xs.length)
      .map((xs) => el("div", { className: esCarpeta(xs[0]) ? "carpetas" : "archivos" }, ...xs.map((x) => pieza(x))))) },
  fila: { nombre: "Fila que se desliza", dibujar: (cosas, { pieza }) => el("div", { className: "fila-seccion" }, ...cosas.map((x) => pieza(x))) },
  lista: { nombre: "Lista", dibujar: (cosas, { pieza }) => el("div", { className: "lista-archivos" }, ...cosas.map((x) => pieza(x, "lista"))) },
  tablero: { nombre: "Tablero por estado", dibujar: tablero },
  calendario: { nombre: "Calendario", dibujar: calendario },
};

// Una columna por estado, en el orden de siempre (los estados raros al final).
function tablero(cosas, { pieza }) {
  const grupos = Map.groupBy(cosas, (x) => x.estado ?? "Sin estado");
  const lugar = (e) => (ESTADOS.includes(e) ? ESTADOS.indexOf(e) : ESTADOS.length);
  return el("div", { className: "tablero-seccion" }, ...[...grupos.keys()].sort((a, b) => lugar(a) - lugar(b)).map((e) =>
    el("div", { className: "columna-seccion" }, el("h5", {}, e, el("small", { textContent: grupos.get(e).length })), ...grupos.get(e).map((x) => pieza(x, "lista")))));
}

// Cinco semanas desde el lunes de esta, con cada cosa en su día. Lo que tiene fecha fuera de ellas se cuenta abajo.
const SEMANAS = 5;
function calendario(cosas, { pieza }) {
  const hoy = hoyTexto(), lunes = new Date(hoy + "T12:00:00");
  lunes.setDate(lunes.getDate() - (lunes.getDay() + 6) % 7);
  const dias = Array.from({ length: SEMANAS * 7 }, (_, i) => new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + i).toLocaleDateString("sv-SE"));
  const porDia = Map.groupBy(cosas.filter((x) => dia(x.fecha)), (x) => dia(x.fecha));
  const fuera = [...porDia.keys()].filter((d) => d < dias[0] || d > dias.at(-1)).reduce((k, d) => k + porDia.get(d).length, 0);
  return el("div", {}, el("div", { className: "calendario-seccion" },
    ...["lu", "ma", "mi", "ju", "vi", "sá", "do"].map((d) => el("b", { textContent: d })),
    ...dias.map((d) => el("div", { className: "dia-seccion" + (d === hoy ? " hoy" : d < hoy ? " pasado" : "") },
      el("small", { textContent: Number(d.slice(8)) }), ...(porDia.get(d) ?? []).map((x) => pieza(x, "lista"))))),
    fuera ? el("p", { className: "fuera-seccion", textContent: `${fuera} más con fecha fuera de estas ${SEMANAS} semanas` }) : "");
}

// Una sección con su título y cuántas tiene.
export const seccion = (titulo, cosas, como, ayuda) => el("section", { className: "grupo-carpeta" },
  el("h4", {}, titulo, el("small", { textContent: cosas.length })),
  cosas.length ? COMO[como].dibujar(cosas, ayuda) : el("p", { className: "nada-seccion", textContent: "Nada todavía." }));

// ---------- Dónde se guarda ----------
const LLAVE = { carpeta: (n) => "carpeta:" + (n?.id ?? "todo"), tipo: (n) => "tipo:" + n?.tipos.clave };
// Lo guardado se revisa: solo secciones con qué mostrar y una manera de verse que existe.
const limpia = (x) => (Array.isArray(x) ? x.filter((s) => typeof s?.muestra === "string" && COMO[s?.como]).map(({ muestra, como }) => ({ muestra, como })) : []);
// La vista de una carpeta y de dónde sale ({ secciones, de: "carpeta" | "tipo" }), o null: la de siempre.
export function vistaDe(n) {
  for (const de of n ? ["carpeta", "tipo"] : ["carpeta"]) {
    const secciones = limpia(datos.disposiciones.get(LLAVE[de](n)));
    if (secciones.length) return { secciones, de };
  }
  return null;
}
// Guarda la vista para esta carpeta o para todas las de su categoría. Al guardarla para la categoría se quita la
// propia de esta carpeta (si no, la taparía). Sin secciones, se borra: vuelve a la de siempre (o a la de su categoría).
export function guardarVista(n, de, secciones) {
  if (de === "tipo") borrar(LLAVE.carpeta(n));
  const llave = LLAVE[de](n);
  if (!secciones?.length) return borrar(llave);
  return escribir(db.from("disposiciones").upsert({ apartado: llave, columnas: secciones }, { onConflict: "owner_id,apartado" }),
    () => datos.disposiciones.set(llave, secciones));
}
const borrar = (llave) => datos.disposiciones.has(llave) && escribir(db.from("disposiciones").delete().eq("apartado", llave), () => datos.disposiciones.delete(llave));

// ---------- Editar la vista ----------
// Cada sección con qué muestra, cómo se ve, subir, bajar y quitar; abajo «+ Sección» y dónde guardarla.
// muestras: [[valor, nombre]] lo que puede mostrar esta carpeta. cambiar(borrador) redibuja con el borrador nuevo.
export function editorDeVista(borrador, { muestras, tipo, actual, cambiar, guardar, cancelar }) {
  const selector = (nombre, opciones, valor, alCambiar) => el("label", {}, el("span", { textContent: nombre }),
    el("select", { onchange: (e) => alCambiar(e.target.value) },
      ...(opciones.some(([v]) => v === valor) ? opciones : [[valor, "(ya no está)"], ...opciones]).map(([v, t]) => el("option", { value: v, textContent: t, selected: v === valor }))));
  const con = (i, cambio) => cambiar(borrador.map((s, j) => (j === i ? { ...s, ...cambio } : s)));
  const mover = (i, a) => { const b = [...borrador]; [b[i], b[i + a]] = [b[i + a], b[i]]; cambiar(b); };
  const boton = (texto, titulo, hacer, apagado) => el("button", { type: "button", className: "boton-icono", textContent: texto, title: titulo, ariaLabel: titulo, disabled: !!apagado, onclick: hacer });
  return el("div", { className: "editor-vista" },
    ...borrador.map((s, i) => el("div", { className: "seccion-editada" },
      el("span", { className: "numero-seccion", textContent: i + 1 }),
      selector("Muestra", muestras, s.muestra, (v) => con(i, { muestra: v })),
      selector("Cómo", Object.entries(COMO).map(([k, c]) => [k, c.nombre]), s.como, (v) => con(i, { como: v })),
      el("span", { className: "mover-seccion" }, boton("↑", "Subir", () => mover(i, -1), i === 0),
        boton("↓", "Bajar", () => mover(i, 1), i === borrador.length - 1), boton("×", "Quitar", () => cambiar(borrador.filter((_, j) => j !== i)))))),
    el("button", { type: "button", className: "mas-seccion", textContent: "+ Sección", onclick: () => cambiar([...borrador, { muestra: muestras[0][0], como: "tarjetas" }]) }),
    el("footer", {},
      el("span", { textContent: "Guardar para" }),
      el("button", { type: "button", className: "principal", textContent: "Solo esta carpeta", disabled: !borrador.length, onclick: () => guardar("carpeta") }),
      tipo ? el("button", { type: "button", textContent: `Todas: ${tipo}`, disabled: !borrador.length, onclick: () => guardar("tipo") }) : "",
      el("span", { className: "relleno" }),
      actual ? el("button", { type: "button", textContent: actual.de === "tipo" ? `Quitarla de todas: ${tipo}` : "Volver a la de siempre", onclick: () => guardar(actual.de, null) }) : "",
      el("button", { type: "button", textContent: "Cancelar", onclick: cancelar })));
}
