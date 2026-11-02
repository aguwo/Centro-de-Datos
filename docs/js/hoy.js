// Hoy (paso 27): a la izquierda qué hacer, a la derecha cuándo.
//   Tareas de hoy  tus 3 prioridades destacadas, lo demás de hoy y lo atrasado (con Hoy / Mañana / Soltar)
//   El tiempo      clima.js
//   Tu día         la agenda desde ahora (agenda.js). Arrastrar una tarea encima le reserva esa hora.
// Todo se calcula de los datos cargados y se escribe con acciones.js; el tiempo real redibuja.
import { $, el, avisar, datos, dia, hora, dentroDe } from "./base.js";
import { hoyTexto, sumarDias, corto, sinHoraISO } from "./fechas.js";
import { cambiar, cambiarProps, completar, reabrir, archivar, agendar } from "./acciones.js";
import { dibujarAgenda } from "./agenda.js";
import { dibujarClima } from "./clima.js";
import { mostrarPanel } from "./panel.js";

const MAX_PRIORIDADES = 3;

export function dibujarHoy() {
  const hoy = hoyTexto();
  const tareas = datos.nodos.filter((n) => n.tipos.clave === "tarea");
  const esPrioridad = (n) => n.props?.prioridad_dia === hoy;
  const pendientes = tareas.filter((n) => n.estado !== "Hecho" && !esPrioridad(n));
  const porFecha = (a, b) => (a.fecha ?? "").localeCompare(b.fecha ?? "");
  const grupos = {
    prioridades: tareas.filter(esPrioridad).sort((a, b) => (a.estado === "Hecho") - (b.estado === "Hecho")),
    hoy: pendientes.filter((n) => dia(n.fecha) === hoy).sort(porFecha),
    atrasadas: pendientes.filter((n) => dia(n.fecha) && dia(n.fecha) < hoy).sort(porFecha),
  };
  const lleno = grupos.prioridades.length >= MAX_PRIORIDADES;

  $("hoy-fecha").textContent = new Date().toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" });
  const hechas = grupos.prioridades.filter((n) => n.estado === "Hecho").length;
  $("hoy-cuenta").textContent = grupos.prioridades.length ? `${hechas} de ${grupos.prioridades.length} hechas` : "";
  $("hoy-tareas").replaceChildren(
    el("div", { className: "prioridades" }, el("h4", { textContent: "Mis 3 prioridades" }),
      grupos.prioridades.length ? lista(grupos.prioridades, { hoy, prioridad: true })
        : el("p", { className: "vacio", textContent: "Toca ☆ en una tarea para que sea una de tus 3 prioridades de hoy." })),
    ...seccion("También hoy", lista(grupos.hoy, { hoy, lleno })),
    ...seccion("Atrasadas", lista(grupos.atrasadas, { hoy, lleno, atrasada: true }), "alerta"),
    el("p", { className: "pista", textContent: "Arrastra una tarea a «Tu día» para reservarle una hora." }));
  dibujarTuDia();
  dibujarClima($("hoy-clima"));
}

const seccion = (titulo, ul, clase = "") => (ul.children.length ? [el("h4", { className: clase, textContent: titulo }), ul] : []);
const lista = (nodos, opciones) => el("ul", { className: "tareas" }, ...nodos.map((n) => fila(n, opciones)));

function fila(n, { hoy, prioridad, lleno, atrasada }) {
  const hecha = n.estado === "Hecho", d = dia(n.fecha);
  const caja = el("input", { type: "checkbox", className: "caja", checked: hecha, title: hecha ? "Desmarcar" : "Marcar como hecha" });
  caja.onchange = () => { caja.disabled = true; (hecha ? reabrir : completar)(n); };
  const estrella = el("button", { className: "estrella" + (prioridad ? " puesta" : ""), textContent: prioridad ? "★" : "☆",
    title: prioridad ? "Quitar de mis prioridades" : "Hacer una de mis 3 prioridades" });
  estrella.onclick = () => {
    if (!prioridad && lleno) return avisar(`Ya tienes ${MAX_PRIORIDADES} prioridades hoy. Quita una antes.`);
    cambiarProps(n, { prioridad_dia: prioridad ? null : hoy });
  };
  const meta = [dentroDe(n.id), atrasada ? corto(d) : "", hora(n.fecha)].filter(Boolean).join(" · ");
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

// Tu día: de la hora actual en adelante (lo que ya pasó no ocupa espacio).
// Lo que no tiene hora ya está en la lista de la izquierda, así que aquí no se repite.
function dibujarTuDia() {
  dibujarAgenda($("hoy-agenda"), [hoyTexto()], {
    desde: Math.min(new Date().getHours(), 22), alto: 44, todoElDia: false,
    alTocar: (n) => mostrarPanel(n.id),
    // Soltar una tarea a una hora: queda agendada hoy a esa hora, por una hora.
    alSoltar: (id, d, h) => datos.nodo.has(id) && agendar(datos.nodo.get(id), d, h),
  });
}
// La línea de "ahora" avanza sola, y a medianoche "hoy" cambia de día.
setInterval(() => { if (!$("hoy").classList.contains("oculto") && datos.nodos.length) dibujarHoy(); }, 60_000);
