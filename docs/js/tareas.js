// Una lista de tareas, igual en Hoy y en Productividad:
//   ✓  marcarla hecha (o desmarcarla)
//   ☆  hacerla una de tus 3 prioridades de hoy
//   a las atrasadas: Hoy / Mañana / Soltar
// Cada fila se puede arrastrar a una agenda ("Tu día") para reservarle una hora.
import { el, avisar, datos, dia, hora, dentroDe, proyectoDe, colorDeProyecto } from "./base.js";
import { hoyTexto, sumarDias, corto, sinHoraISO, hhmm, leerFecha, fechaLeida } from "./fechas.js";
import { cambiar, cambiarProps, completar, reabrir, archivar, crear, dentroDeCaja } from "./acciones.js";
import { mostrarPanel } from "./panel.js";

export const MAX_PRIORIDADES = 3;
export const esPrioridad = (n) => n.props?.prioridad_dia === hoyTexto();
export const porFecha = (a, b) => (a.fecha ?? "").localeCompare(b.fecha ?? "");

// Un título con su lista debajo; si la lista está vacía, no aparece nada.
export const seccion = (titulo, ul, clase = "") => (ul.children.length ? [el("h4", { className: clase, textContent: titulo }), ul] : []);

// opciones: prioridad (son las destacadas), atrasada (con sus botones), conFecha (mostrar el día), sinCaja (no decir dónde está)
export function listaDeTareas(nodos, opciones = {}) {
  const lleno = datos.nodos.filter(esPrioridad).length >= MAX_PRIORIDADES;
  return el("ul", { className: "tareas" }, ...nodos.map((n) => fila(n, { ...opciones, lleno })));
}

function fila(n, { prioridad, atrasada, conFecha, sinCaja, lleno }) {
  const hoy = hoyTexto(), hecha = n.estado === "Hecho", d = dia(n.fecha);
  const caja = el("input", { type: "checkbox", className: "caja", checked: hecha, title: hecha ? "Desmarcar" : "Marcar como hecha" });
  caja.onchange = () => { caja.disabled = true; (hecha ? reabrir : completar)(n); };
  const destacada = prioridad ?? esPrioridad(n);
  const estrella = el("button", { className: "estrella" + (destacada ? " puesta" : ""), textContent: destacada ? "★" : "☆",
    title: destacada ? "Quitar de mis prioridades" : "Hacer una de mis 3 prioridades de hoy" });
  estrella.onclick = () => {
    if (!destacada && lleno) return avisar(`Ya tienes ${MAX_PRIORIDADES} prioridades hoy. Quita una antes.`);
    cambiarProps(n, { prioridad_dia: destacada ? null : hoy });
  };
  const meta = [!sinCaja && dentroDe(n.id), (atrasada || conFecha) && d && corto(d), hora(n.fecha)].filter(Boolean).join(" · ");
  // Si está en un proyecto, un punto con el color del proyecto (el mismo de Productividad y el calendario).
  const proyecto = !sinCaja && proyectoDe(n.id), punto = proyecto ? el("i", { className: "punto" }) : "";
  if (punto) punto.style.setProperty("--c", colorDeProyecto(proyecto));
  const li = el("li", { className: hecha ? "hecha" : "", draggable: !hecha },
    caja, estrella,
    el("a", { className: "nombre", textContent: n.titulo, title: n.titulo, onclick: () => mostrarPanel(n.id) }),
    meta ? el("span", { className: "meta" + (atrasada ? " atrasada" : "") }, punto, meta) : "",
    atrasada ? el("span", { className: "acciones-fila" },
      boton("Hoy", () => cambiar(n, { fecha: sinHoraISO(hoy) })),
      boton("Mañana", () => cambiar(n, { fecha: sinHoraISO(sumarDias(hoy, 1)) })),
      boton("Soltar", () => archivar(n), "Archivarla: deja de aparecer, pero se puede recuperar")) : "");
  li.ondragstart = (e) => e.dataTransfer.setData("text/plain", n.id);
  return li;
}
// "Agregar tarea" (Productividad, Proyectos): entiende fechas escritas ("dentista mañana 10:00"), muestra abajo
// la fecha que entendió y deja la tarea "Por hacer" dentro de la caja que diga destino() (un id, o nada).
// Devuelve el formulario, la línea de la fecha y el campo (para cambiarle el texto de ayuda).
export function agregarTarea(destino) {
  const campo = el("input", { name: "titulo", ariaLabel: "Nueva tarea", placeholder: "Agregar tarea…" });
  const form = el("form", { className: "agregar", autocomplete: "off" }, campo, el("button", { className: "principal", textContent: "Agregar" }));
  const cuando = el("small", { className: "cuando", ariaLive: "polite" });
  campo.oninput = () => {
    const l = leerFecha(campo.value);
    cuando.textContent = l.dia ? "Fecha: " + new Date(l.dia + "T12:00").toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" })
      + (l.hora === null ? "" : " · " + hhmm(l.hora)) : "";
  };
  form.onsubmit = async (e) => {
    e.preventDefault();
    const l = leerFecha(campo.value.trim()), titulo = l.titulo || campo.value.trim();
    if (!titulo) return;
    if (await crear("tarea", { titulo, estado: "Por hacer", fecha: fechaLeida(l) }, { conexion: dentroDeCaja("tarea", destino()), enfocar: false })) {
      campo.value = "";
      campo.oninput();
    }
  };
  return { form, cuando, campo };
}

const boton = (texto, accion, title = "") => el("button", { textContent: texto, title, onclick: accion });
