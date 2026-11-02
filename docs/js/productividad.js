// Productividad (paso 32): tus proyectos y sus tareas.
//   Proyectos  los que están activos, con su avance, cuántas tareas van atrasadas y cuál es la próxima.
//              Elegir uno filtra las tareas; "Todas" y "Sin proyecto" también se pueden elegir.
//   Tareas     las del filtro, por grupo (atrasadas, hoy, próximas, sin fecha; las hechas, plegadas).
//              Lo que escribes en "Agregar tarea" queda en el proyecto elegido.
// Lo del Inbox no aparece aquí: son los post-its (postits.js).
import { $, el, datos, dia } from "./base.js";
import { hoyTexto, corto } from "./fechas.js";
import { crear } from "./acciones.js";
import { listaDeTareas, seccion, porFecha } from "./tareas.js";

const TODAS = "todas", SIN = "sin"; // los filtros que no son un proyecto
let elegido = TODAS;

// El proyecto donde está algo, subiendo por sus cajas (tarea → hito → proyecto). Sin proyecto: SIN.
function proyectoDe(id) {
  for (let p = datos.padre.get(id); p; p = datos.padre.get(p)) if (datos.nodo.get(p)?.tipos.clave === "proyecto") return p;
  return SIN;
}

export function dibujarProductividad() {
  const hoy = hoyTexto();
  const deTipo = (clave) => datos.nodos.filter((n) => n.tipos.clave === clave && n.estado !== "Inbox");
  const tareas = deTipo("tarea"), dondeEsta = new Map(tareas.map((n) => [n.id, proyectoDe(n.id)]));
  const de = (id) => tareas.filter((n) => id === TODAS || dondeEsta.get(n.id) === id);
  const resumen = (id) => {
    const ts = de(id), abiertas = ts.filter((n) => n.estado !== "Hecho").sort(porFecha);
    return { total: ts.length, hechas: ts.length - abiertas.length, atrasadas: abiertas.filter((n) => dia(n.fecha) && dia(n.fecha) < hoy).length,
      proxima: abiertas.find((n) => n.fecha) ?? abiertas[0] };
  };
  // Los proyectos activos: primero los que tienen algo con fecha más pronto.
  const proyectos = deTipo("proyecto").filter((p) => p.estado !== "Hecho")
    .map((p) => ({ id: p.id, nombre: p.titulo, ...resumen(p.id) }))
    .sort((a, b) => (a.proxima?.fecha ?? "9").localeCompare(b.proxima?.fecha ?? "9") || a.nombre.localeCompare(b.nombre, "es"));
  const filtros = [{ id: TODAS, nombre: "Todas las tareas", ...resumen(TODAS) }, ...proyectos, { id: SIN, nombre: "Sin proyecto", ...resumen(SIN) }];
  if (!filtros.some((f) => f.id === elegido)) elegido = TODAS; // el proyecto elegido se cerró o se borró
  const actual = filtros.find((f) => f.id === elegido);

  $("prod-proyectos").replaceChildren(...filtros.map((f) => filtro(f, proyectos.includes(f))));
  $("prod-filtro").textContent = actual.nombre;
  $("prod-agregar").elements.titulo.placeholder = proyectos.includes(actual) ? `Agregar tarea a ${actual.nombre}…` : "Agregar tarea…";

  const ts = de(elegido), abiertas = ts.filter((n) => n.estado !== "Hecho").sort(porFecha);
  const cuando = (n) => (dia(n.fecha) ? (dia(n.fecha) < hoy ? "atrasadas" : dia(n.fecha) === hoy ? "hoy" : "proximas") : "sinFecha");
  const grupo = (g) => abiertas.filter((n) => cuando(n) === g);
  const opciones = { sinCaja: proyectos.includes(actual), conFecha: true }; // dentro de un proyecto no hace falta decir cuál
  const hechas = ts.filter((n) => n.estado === "Hecho");
  $("prod-tareas").replaceChildren(
    ...seccion("Atrasadas", listaDeTareas(grupo("atrasadas"), { ...opciones, atrasada: true }), "alerta"),
    ...seccion("Hoy", listaDeTareas(grupo("hoy"), { ...opciones, conFecha: false })),
    ...seccion("Próximas", listaDeTareas(grupo("proximas"), opciones)),
    ...seccion("Sin fecha", listaDeTareas(grupo("sinFecha"), opciones)),
    hechas.length ? el("details", { className: "hechas" }, el("summary", { textContent: `Hechas (${hechas.length})` }), listaDeTareas(hechas, opciones)) : "",
    abiertas.length || hechas.length ? "" : el("p", { className: "vacio", textContent: "No hay tareas aquí. Agrega la primera arriba." }));
}

// Una fila de la lista de proyectos: se toca para filtrar. Los proyectos muestran además su avance y la próxima tarea.
function filtro(f, esProyecto) {
  const cuenta = [f.atrasadas && `${f.atrasadas} atrasada${f.atrasadas > 1 ? "s" : ""}`, `${f.hechas} de ${f.total}`].filter(Boolean).join(" · ");
  const b = el("button", { className: "filtro", ariaPressed: String(f.id === elegido), onclick: () => { elegido = f.id; dibujarProductividad(); } },
    el("span", { className: "nombre", textContent: f.nombre }),
    el("span", { className: "meta" + (f.atrasadas ? " atrasada" : ""), textContent: cuenta }));
  if (esProyecto) b.append(
    el("span", { className: "barra-p" }, el("span", { style: `width: ${f.total ? (f.hechas / f.total) * 100 : 0}%` })),
    f.proxima ? el("span", { className: "proxima", textContent: `Próxima: ${f.proxima.titulo}${f.proxima.fecha ? " · " + corto(dia(f.proxima.fecha)) : ""}` }) : "");
  return el("li", {}, b);
}

// "Agregar tarea": queda por hacer, y si hay un proyecto elegido, dentro de él.
export function iniciarProductividad() {
  $("prod-agregar").onsubmit = async (e) => {
    e.preventDefault();
    const campo = e.target.elements.titulo, titulo = campo.value.trim();
    if (!titulo) return;
    const enProyecto = elegido !== TODAS && elegido !== SIN;
    if (await crear("tarea", { titulo, estado: "Por hacer" }, { conexion: enProyecto && { relacion: "pertenece_a", destino_id: elegido }, enfocar: false }))
      campo.value = "";
  };
}
