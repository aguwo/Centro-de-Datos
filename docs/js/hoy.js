// Los widgets de Hoy (paso 27): a la izquierda qué hacer, a la derecha cuándo.
//   Tareas de hoy  tus 3 prioridades destacadas, lo demás de hoy y lo atrasado (con Hoy / Mañana / Soltar)
//   El tiempo      clima.js
//   Tu día         la agenda desde ahora (agenda.js). Arrastrar una tarea encima le reserva esa hora.
// Todo se calcula de los datos cargados y se escribe con acciones.js; el tiempo real redibuja.
// Cómo se arma una ventana con estas funciones: widgets.js.
import { el, datos, dia } from "./base.js";
import { hoyTexto } from "./fechas.js";
import { agendar } from "./acciones.js";
import { dibujarAgenda } from "./agenda.js";
import { dibujarClima } from "./clima.js";
import { mostrarPanel } from "./panel.js";
import { listaDeTareas, seccion, esPrioridad, porFecha } from "./tareas.js";

export function tareasDeHoy(v) {
  const lista = el("div", { className: "desliza grupos" });
  v.append(lista);
  return () => {
    const hoy = hoyTexto();
    const tareas = datos.nodos.filter((n) => n.tipos.clave === "tarea");
    const pendientes = tareas.filter((n) => n.estado !== "Hecho" && !esPrioridad(n));
    const prioridades = tareas.filter(esPrioridad).sort((a, b) => (a.estado === "Hecho") - (b.estado === "Hecho"));
    const hechas = prioridades.filter((n) => n.estado === "Hecho").length;
    v.sub.textContent = prioridades.length ? `${hechas} de ${prioridades.length} hechas` : "";
    lista.replaceChildren(
      el("div", { className: "prioridades" }, el("h4", { textContent: "Mis 3 prioridades" }),
        prioridades.length ? listaDeTareas(prioridades, { prioridad: true })
          : el("p", { className: "vacio", textContent: "Toca ☆ en una tarea para que sea una de tus 3 prioridades de hoy." })),
      ...seccion("También hoy", listaDeTareas(pendientes.filter((n) => dia(n.fecha) === hoy).sort(porFecha))),
      ...seccion("Atrasadas", listaDeTareas(pendientes.filter((n) => dia(n.fecha) && dia(n.fecha) < hoy).sort(porFecha), { atrasada: true }), "alerta"),
      el("p", { className: "pista", textContent: "Arrastra una tarea a «Tu día» para reservarle una hora." }));
  };
}

export function elTiempo(v) {
  const cont = el("div");
  v.append(cont);
  return () => dibujarClima(cont);
}

// Tu día: de la hora actual en adelante (lo que ya pasó no ocupa espacio).
// Lo que no tiene hora ya está en "Tareas de hoy", así que aquí no se repite.
export function tuDia(v) {
  const agenda = el("div", { className: "desliza agenda" });
  v.append(agenda);
  const dibujar = () => dibujarAgenda(agenda, [hoyTexto()], {
    desde: Math.min(new Date().getHours(), 22), alto: 44, todoElDia: false,
    alTocar: (n) => mostrarPanel(n.id),
    // Soltar una tarea a una hora: queda agendada hoy a esa hora, por una hora.
    alSoltar: (id, d, h) => datos.nodo.has(id) && agendar(datos.nodo.get(id), d, h),
  });
  // La línea de "ahora" avanza sola, y a medianoche "hoy" cambia de día.
  setInterval(() => { if (!v.closest(".oculto") && datos.nodos.length) dibujar(); }, 60_000);
  return dibujar;
}
