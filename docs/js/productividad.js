// Productividad (paso 32): tus proyectos y sus tareas.
//   Áreas      una fila de chips (Todas, Proyectos, Universidad... y Sin proyecto). Elegir una filtra las tareas
//              y muestra debajo solo sus proyectos.
//   Proyectos  cada uno con su color, su avance, cuántas tareas van atrasadas y la próxima.
//              Tocar uno filtra las tareas (tocarlo de nuevo vuelve al área); arrastrar una tarea encima
//              de un proyecto o de un chip la mueve ahí. Un proyecto sin nada pendiente se puede cerrar desde aquí.
//   Tareas     las del filtro, por grupo (atrasadas, hoy, próximas, sin fecha; las hechas, plegadas).
//              "Agregar tarea" entiende fechas escritas ("dentista mañana 10:00") y deja la tarea en lo elegido.
// Lo del Inbox no aparece aquí: son los post-its (postits.js).
import { $, el, datos, dia, cajasDe, proyectoDe, colorDeProyecto } from "./base.js";
import { hoyTexto, corto, hhmm, leerFecha, fechaLeida } from "./fechas.js";
import { crear, cambiar, mover } from "./acciones.js";
import { listaDeTareas, seccion, porFecha } from "./tareas.js";

const TODAS = "todas", SIN = "sin"; // los filtros que no son un proyecto ni un área
let area = TODAS;    // el chip elegido
let elegido = TODAS; // lo que filtra las tareas: el chip, o uno de sus proyectos

const deTipo = (clave) => datos.nodos.filter((n) => n.tipos.clave === clave && n.estado !== "Inbox");
const tareas = () => deTipo("tarea");
// Las tareas de un filtro: todas, las que no están en ningún proyecto, o las que están dentro de esa caja (a cualquier profundidad).
const de = (id) => tareas().filter((n) => (id === TODAS ? true : id === SIN ? !proyectoDe(n.id) : cajasDe(n.id).includes(id)));
const areaDe = (id) => cajasDe(id).findLast((c) => datos.nodo.get(c)?.tipos.clave === "area");

// Cómo va un filtro: cuántas tareas tiene, cuántas hechas y atrasadas, y cuál es la próxima.
function resumen(id) {
  const hoy = hoyTexto(), ts = de(id), abiertas = ts.filter((n) => n.estado !== "Hecho").sort(porFecha);
  return { total: ts.length, hechas: ts.length - abiertas.length, abiertas: abiertas.length,
    atrasadas: abiertas.filter((n) => dia(n.fecha) && dia(n.fecha) < hoy).length, proxima: abiertas.find((n) => n.fecha) ?? abiertas[0] };
}

// Lo de la derecha: los chips (Todas, las áreas con algo activo, Sin proyecto) y los proyectos activos.
function filtros() {
  const fila = (n, clase) => ({ id: n.id, nombre: n.titulo, clase, nodo: n, ...resumen(n.id) });
  const proyectos = deTipo("proyecto").filter((p) => p.estado !== "Hecho").map((p) => fila(p, "proyecto"))
    .sort((a, b) => (a.proxima?.fecha ?? "9").localeCompare(b.proxima?.fecha ?? "9") || a.nombre.localeCompare(b.nombre, "es"));
  const areas = datos.nodos.filter((n) => n.tipos.clave === "area").map((a) => fila(a, "area"))
    .filter((a) => a.abiertas || proyectos.some((p) => areaDe(p.id) === a.id))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const chips = [{ id: TODAS, nombre: "Todas", ...resumen(TODAS) }, ...areas, { id: SIN, nombre: "Sin proyecto", ...resumen(SIN) }];
  return { chips, proyectos };
}

const cuenta = (f) => [f.atrasadas && `${f.atrasadas} atrasada${f.atrasadas > 1 ? "s" : ""}`, `${f.hechas} de ${f.total}`].filter(Boolean).join(" · ");

export function dibujarProductividad() {
  const { chips, proyectos } = filtros();
  if (!chips.some((c) => c.id === area)) area = TODAS; // el área se quedó sin nada activo
  const visibles = area === TODAS ? proyectos : proyectos.filter((p) => areaDe(p.id) === area);
  if (elegido !== area && !visibles.some((p) => p.id === elegido)) elegido = area; // el proyecto se cerró o se borró
  const actual = [...chips, ...visibles].find((f) => f.id === elegido), enCaja = actual.nodo !== undefined;

  $("prod-areas").replaceChildren(...chips.map(chip));
  $("prod-proyectos").replaceChildren(...visibles.map(filtro));
  if (!visibles.length) $("prod-proyectos").append(el("li", { className: "vacio", textContent: area === SIN
    ? "Aquí están las tareas que no son de ningún proyecto." : "Esta área no tiene proyectos activos." }));
  $("prod-filtro").textContent = `${actual.nombre} · ${cuenta(actual)}`;
  $("prod-agregar").elements.titulo.placeholder = enCaja ? `Agregar tarea a ${actual.nombre}…` : "Agregar tarea…";

  const hoy = hoyTexto(), ts = de(elegido), abiertas = ts.filter((n) => n.estado !== "Hecho").sort(porFecha);
  const cuando = (n) => (dia(n.fecha) ? (dia(n.fecha) < hoy ? "atrasadas" : dia(n.fecha) === hoy ? "hoy" : "proximas") : "sinFecha");
  const grupo = (g) => abiertas.filter((n) => cuando(n) === g);
  const opciones = { sinCaja: actual.clase === "proyecto", conFecha: true }; // dentro de un proyecto no hace falta decir cuál
  const hechas = ts.filter((n) => n.estado === "Hecho");
  $("prod-tareas").replaceChildren(
    ...seccion("Atrasadas", listaDeTareas(grupo("atrasadas"), { ...opciones, atrasada: true }), "alerta"),
    ...seccion("Hoy", listaDeTareas(grupo("hoy"), { ...opciones, conFecha: false })),
    ...seccion("Próximas", listaDeTareas(grupo("proximas"), opciones)),
    ...seccion("Sin fecha", listaDeTareas(grupo("sinFecha"), opciones)),
    hechas.length ? el("details", { className: "hechas" }, el("summary", { textContent: `Hechas (${hechas.length})` }), listaDeTareas(hechas, opciones)) : "",
    abiertas.length || hechas.length ? "" : el("p", { className: "vacio", textContent: "No hay tareas aquí. Agrega la primera arriba." }));
}

// Un chip: elige el área (y con eso, qué proyectos se ven y qué tareas).
function chip(c) {
  const b = el("button", { textContent: c.nombre, title: cuenta(c), ariaPressed: String(c.id === area),
    onclick: () => { area = elegido = c.id; dibujarProductividad(); } });
  if (c.atrasadas) b.classList.add("con-atrasadas");
  if (c.nodo) recibir(b, c);
  return b;
}

// Un proyecto: su color, su avance y la próxima tarea. Tocarlo filtra; tocarlo otra vez vuelve al área.
// Si no le queda nada pendiente, "Cerrar proyecto".
function filtro(f) {
  const b = el("button", { className: "filtro", ariaPressed: String(f.id === elegido),
    onclick: () => { elegido = elegido === f.id ? area : f.id; dibujarProductividad(); } },
    el("span", { className: "nombre" }, el("i", { className: "punto" }), f.nombre),
    el("span", { className: "meta" + (f.atrasadas ? " atrasada" : ""), textContent: cuenta(f) }),
    el("span", { className: "barra-p" }, el("span", { style: `width: ${f.total ? (f.hechas / f.total) * 100 : 0}%` })));
  if (f.proxima) b.append(el("span", { className: "proxima", textContent: `Próxima: ${f.proxima.titulo}${f.proxima.fecha ? " · " + corto(dia(f.proxima.fecha)) : ""}` }));
  const li = el("li", { className: "proyecto" }, b);
  li.style.setProperty("--c", colorDeProyecto(f.id));
  if (!f.abiertas) li.append(el("button", { className: "cerrar", textContent: "✓ Cerrar proyecto",
    title: "No le queda nada pendiente: marcarlo como hecho", onclick: () => cambiar(f.nodo, { estado: "Hecho" }) }));
  recibir(li, f);
  return li;
}

// Soltar una tarea encima de un área o proyecto la mueve ahí.
function recibir(destino, f) {
  const tarea = (e) => datos.nodo.get(e.dataTransfer.getData("text/plain"));
  destino.ondragover = (e) => { e.preventDefault(); destino.classList.add("soltar"); };
  destino.ondragleave = () => destino.classList.remove("soltar");
  destino.ondrop = (e) => {
    e.preventDefault();
    destino.classList.remove("soltar");
    const n = tarea(e);
    if (n?.tipos.clave === "tarea" && datos.padre.get(n.id) !== f.id) mover(n, f.id);
  };
}

// "Agregar tarea": queda por hacer, con la fecha que hayas escrito, y dentro de lo que tengas elegido.
export function iniciarProductividad() {
  const form = $("prod-agregar"), campo = form.elements.titulo;
  // Mientras escribes, abajo se ve la fecha que entendió.
  campo.oninput = () => {
    const l = leerFecha(campo.value);
    $("prod-cuando").textContent = l.dia ? "Fecha: " + new Date(l.dia + "T12:00").toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" })
      + (l.hora === null ? "" : " · " + hhmm(l.hora)) : "";
  };
  form.onsubmit = async (e) => {
    e.preventDefault();
    const l = leerFecha(campo.value.trim()), titulo = l.titulo || campo.value.trim();
    if (!titulo) return;
    const enCaja = elegido !== TODAS && elegido !== SIN;
    if (await crear("tarea", { titulo, estado: "Por hacer", fecha: fechaLeida(l) }, { conexion: enCaja && { relacion: "pertenece_a", destino_id: elegido }, enfocar: false })) {
      campo.value = "";
      campo.oninput();
    }
  };
}
