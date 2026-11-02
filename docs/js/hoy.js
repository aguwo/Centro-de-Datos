// Hoy (paso 27): a la izquierda qué hacer, a la derecha cuándo.
//   Tareas de hoy  tus 3 prioridades destacadas, lo demás de hoy y lo atrasado (con Hoy / Mañana / Soltar)
//   El tiempo      clima.js
//   Tu día         la agenda desde ahora (agenda.js). Arrastrar una tarea encima le reserva esa hora.
// Todo se calcula de los datos cargados y se escribe con acciones.js; el tiempo real redibuja.
import { $, el, datos, dia } from "./base.js";
import { hoyTexto } from "./fechas.js";
import { agendar } from "./acciones.js";
import { dibujarAgenda } from "./agenda.js";
import { dibujarClima } from "./clima.js";
import { mostrarPanel } from "./panel.js";
import { listaDeTareas, seccion, esPrioridad, porFecha } from "./tareas.js";

export function dibujarHoy() {
  const hoy = hoyTexto();
  const tareas = datos.nodos.filter((n) => n.tipos.clave === "tarea");
  const pendientes = tareas.filter((n) => n.estado !== "Hecho" && !esPrioridad(n));
  const grupos = {
    prioridades: tareas.filter(esPrioridad).sort((a, b) => (a.estado === "Hecho") - (b.estado === "Hecho")),
    hoy: pendientes.filter((n) => dia(n.fecha) === hoy).sort(porFecha),
    atrasadas: pendientes.filter((n) => dia(n.fecha) && dia(n.fecha) < hoy).sort(porFecha),
  };

  $("hoy-fecha").textContent = new Date().toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" });
  const hechas = grupos.prioridades.filter((n) => n.estado === "Hecho").length;
  $("hoy-cuenta").textContent = grupos.prioridades.length ? `${hechas} de ${grupos.prioridades.length} hechas` : "";
  $("hoy-tareas").replaceChildren(
    el("div", { className: "prioridades" }, el("h4", { textContent: "Mis 3 prioridades" }),
      grupos.prioridades.length ? listaDeTareas(grupos.prioridades, { prioridad: true })
        : el("p", { className: "vacio", textContent: "Toca ☆ en una tarea para que sea una de tus 3 prioridades de hoy." })),
    ...seccion("También hoy", listaDeTareas(grupos.hoy)),
    ...seccion("Atrasadas", listaDeTareas(grupos.atrasadas, { atrasada: true }), "alerta"),
    el("p", { className: "pista", textContent: "Arrastra una tarea a «Tu día» para reservarle una hora." }));
  dibujarTuDia();
  dibujarClima($("hoy-clima"));
}

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
