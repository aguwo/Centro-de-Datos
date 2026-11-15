// Paso 121: el buscador. La barra espaciadora (cuando no estás escribiendo) abre una caja
// arriba al centro. Escribes y aparecen los apartados y los nodos que coinciden, o un comando si empiezas con su palabra:
//   tarea comprar pan mañana 10:00   crea la tarea, con fecha y hora si las escribes (como «Agregar tarea»)
//   gasto 5000 almuerzo              abre «Anotar» con el monto y el nombre ya puestos (ingreso, igual)
//   nota idea para Martita           crea la nota y la abre
// Flechas para elegir, Enter para ir, Escape para cerrar. Un comando nuevo = una fila en COMANDOS.
import { el, datos, colorDe, dentroDe, sinTildes } from "./base.js";
import { icono, insignia } from "./dibujos.js";
import { iconoDe } from "./formas.js";
import { leerFecha, fechaLeida, hhmm } from "./fechas.js";
import { crear } from "./acciones.js";
import { mostrarPanel } from "./panel.js";
import { anotar, plata } from "./finanzas.js";
import { entradasDeLaBarra } from "./carcasa.js";

// Cada comando: su palabra, su ícono, un ejemplo (se ve con la caja vacía) y leer(resto), que dice qué hará con lo
// que escribiste después de la palabra: { titulo, detalle, hacer } o nada si todavía falta algo.
const COMANDOS = [
  { palabra: "tarea", icono: "si", ejemplo: "tarea comprar pan mañana 10:00", leer(resto) {
    const l = leerFecha(resto), titulo = (l.titulo || resto).trim();
    const cuando = l.dia ? new Date(l.dia + "T12:00").toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" }) + (l.hora === null ? "" : " · " + hhmm(l.hora)) : "Sin fecha";
    return titulo && { titulo: `Crear tarea «${titulo}»`, detalle: cuando, hacer: () => crear("tarea", { titulo, estado: "Por hacer", fecha: fechaLeida(l) }, { enfocar: false }) };
  } },
  { palabra: "gasto", icono: "billetera", ejemplo: "gasto 5000 almuerzo", leer: (resto) => anotacion("gasto", resto) },
  { palabra: "ingreso", icono: "monedas", ejemplo: "ingreso 20000 pituto", leer: (resto) => anotacion("ingreso", resto) },
  { palabra: "nota", icono: "idea", ejemplo: "nota idea para Martita", leer: (resto) => resto && {
    titulo: `Crear nota «${resto}»`, detalle: "Se abre para que sigas escribiendo", hacer: () => crear("nota", { titulo: resto }) } },
];
// «5000 almuerzo», «$5.000 almuerzo» o solo «almuerzo»: el monto (si viene) y el nombre.
function anotacion(tipo, resto) {
  const [, cifra = "", titulo = resto] = /^\$?\s*([\d.]+)\s*(.*)$/.exec(resto) ?? [];
  const monto = Number(cifra.replace(/\D/g, "")) || 0;
  return { titulo: `Anotar ${tipo}` + (monto ? ` de ${plata(monto)}` : "") + (titulo ? ` · ${titulo}` : ""),
    detalle: "Eliges en qué y la cuenta", hacer: () => anotar(tipo, { monto, titulo }) };
}

// Los apartados (y cajones, como Calendario) cuyo nombre tiene lo que escribiste. Con la caja vacía, los de la barra.
const lugares = (q) => entradasDeLaBarra().filter(({ x }) => (q ? sinTildes(x.nombre).includes(q) : !x.lugar))
  .map(({ x, accion }) => ({ icono: x.icono, titulo: x.nombre, detalle: x.lugar ? "Sección del escritorio" : "Apartado", hacer: accion }));
// Los nodos que tienen todas las palabras: primero los que empiezan así, después los que no están hechos, después los cortos.
function nodos(q) {
  const palabras = q.split(/\s+/).filter(Boolean);
  return datos.nodos.map((n) => ({ n, t: sinTildes(n.titulo) })).filter(({ t }) => palabras.every((p) => t.includes(p)))
    .sort((a, b) => b.t.startsWith(q) - a.t.startsWith(q) || (a.n.estado === "Hecho") - (b.n.estado === "Hecho") || a.t.length - b.t.length)
    .slice(0, 7).map(({ n }) => ({ dibujo: insignia(iconoDe(n), colorDe(n.tipos.clave), "chica"), titulo: n.titulo,
      detalle: n.tipos.nombre + (dentroDe(n.id) ? " · en " + dentroDe(n.id) : ""), hacer: () => mostrarPanel(n.id) }));
}
function resultados(texto) {
  const t = texto.trim();
  if (!t) return [...lugares(""), ...COMANDOS.map((c) => ({ icono: c.icono, titulo: c.ejemplo, detalle: "Comando: empieza con «" + c.palabra + "»", completar: c.palabra + " " }))];
  const [palabra, ...resto] = t.split(/\s+/), q = sinTildes(t);
  const c = COMANDOS.find((c) => c.palabra === sinTildes(palabra)), orden = c?.leer(resto.join(" "));
  return [...(orden ? [{ icono: c.icono, ...orden }] : []), ...lugares(q), ...nodos(q)].slice(0, 9);
}

let abierto = null;
export function abrirBuscador() {
  if (abierto) return abierto.querySelector("input").focus();
  const campo = el("input", { type: "text", placeholder: "Busca o escribe un comando…", ariaLabel: "Buscar", autocomplete: "off", spellcheck: false });
  campo.setAttribute("role", "combobox");
  campo.setAttribute("aria-controls", "buscador-lista");
  const lista = el("ul", { id: "buscador-lista", className: "resultados" });
  lista.setAttribute("role", "listbox");
  const d = el("dialog", { className: "buscador vidrio", ariaLabel: "Buscador", onclose: () => { d.remove(); abierto = null; },
    onclick: (e) => { if (e.target === d) d.close(); } }, // tocar afuera la cierra
  el("label", { className: "campo" }, icono("lupa"), campo), lista,
  el("p", { className: "pista", textContent: "↑ ↓ para elegir · Enter para ir · Esc para cerrar" }));
  let filas = [], elegida = 0;
  const marcar = () => {
    [...lista.children].forEach((li, i) => li.setAttribute("aria-selected", String(i === elegida)));
    campo.setAttribute("aria-activedescendant", filas.length ? "buscado-" + elegida : "");
    lista.children[elegida]?.scrollIntoView({ block: "nearest" });
  };
  const usar = (f) => {
    if (!f) return;
    if (f.completar) { campo.value = f.completar; campo.focus(); return pintar(); } // un ejemplo: deja escrita su palabra
    d.close();
    f.hacer();
  };
  const fila = (f, i) => {
    const li = el("li", { id: "buscado-" + i, onclick: () => usar(f), onpointermove: () => { if (elegida !== i) { elegida = i; marcar(); } } },
      f.dibujo ?? icono(f.icono), el("div", {}, el("b", { textContent: f.titulo }), el("span", { textContent: f.detalle ?? "" })));
    li.setAttribute("role", "option");
    li.style.setProperty("--i", i); // entran uno tras otro (estilos.css)
    return li;
  };
  function pintar() {
    filas = resultados(campo.value);
    elegida = 0;
    lista.replaceChildren(...(filas.length ? filas.map(fila) : [el("li", { className: "nada", textContent: `Nada con «${campo.value.trim()}»` })]));
    marcar();
  }
  campo.oninput = pintar;
  campo.onkeydown = (e) => {
    if ((e.key === "ArrowDown" || e.key === "ArrowUp") && filas.length) {
      e.preventDefault();
      elegida = (elegida + (e.key === "ArrowDown" ? 1 : -1) + filas.length) % filas.length;
      marcar();
    } else if (e.key === "Enter") { e.preventDefault(); usar(filas[elegida]); }
  };
  document.body.append(d);
  d.showModal();
  abierto = d;
  pintar();
  campo.focus();
}

// La barra espaciadora la abre, salvo que estés escribiendo, haya otra ventana abierta o tengas un botón elegido con el
// teclado (ahí el espacio lo aprieta, como siempre). Un botón que tocaste con el mouse no cuenta: no se ve elegido.
export function iniciarBuscador() {
  addEventListener("keydown", (e) => {
    if (e.code !== "Space" || e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || document.querySelector("dialog[open]")) return;
    const a = document.activeElement;
    if (a && (a.isContentEditable || a.matches("input, textarea, select, :focus-visible"))) return;
    e.preventDefault();
    abrirBuscador();
  });
}
