// Una lista de tareas, igual en Hoy y en Productividad:
//   ✓  marcarla hecha (o desmarcarla)
//   ☆  hacerla una de tus 3 prioridades de hoy
//   a las atrasadas: Hoy / Mañana / Soltar
// Cada fila se puede arrastrar a una agenda ("Tu día") para reservarle una hora.
import { el, avisar, datos, dia, hora, dentroDe } from "./base.js";
import { hoyTexto, sumarDias, corto, sinHoraISO } from "./fechas.js";
import { cambiar, cambiarProps, completar, reabrir, archivar } from "./acciones.js";
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
  const li = el("li", { className: hecha ? "hecha" : "", draggable: !hecha },
    caja, estrella,
    el("a", { className: "nombre", textContent: n.titulo, title: n.titulo, onclick: () => mostrarPanel(n.id) }),
    meta ? el("span", { className: "meta" + (atrasada ? " atrasada" : ""), textContent: meta }) : "",
    atrasada ? el("span", { className: "acciones-fila" },
      boton("Hoy", () => cambiar(n, { fecha: sinHoraISO(hoy) })),
      boton("Mañana", () => cambiar(n, { fecha: sinHoraISO(sumarDias(hoy, 1)) })),
      boton("Soltar", () => archivar(n), "Archivarla: deja de aparecer, pero se puede recuperar")) : "");
  li.ondragstart = (e) => e.dataTransfer.setData("text/plain", n.id);
  return li;
}
const boton = (texto, accion, title = "") => el("button", { textContent: texto, title, onclick: accion });
