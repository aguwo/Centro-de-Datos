// Los widgets de Hoy (paso 27): a la izquierda qué hacer, a la derecha cuándo.
//   Tareas de hoy  tus 3 prioridades destacadas, lo demás de hoy y lo atrasado (con Hoy / Mañana / Soltar)
//   El tiempo      clima.js
//   Tu día         la agenda desde ahora (agenda.js). Arrastrar una tarea encima le reserva esa hora.
//   Plan de hoy    (paso 94, la otra vista de Hoy) la semana en anillos y lo de hoy en tarjetas que bajan al marcarlas
// Todo se calcula de los datos cargados y se escribe con acciones.js; el tiempo real redibuja.
// Cómo se arma una ventana con estas funciones: widgets.js.
import { el, datos, dia, hora, colorDe, colorDeSuCaja } from "./base.js";
import { hoyTexto, lunes, sumarDias, corto, sinHoraISO } from "./fechas.js";
import { agendar, completar, reabrir } from "./acciones.js";
import { dibujarAgenda } from "./agenda.js";
import { dibujarClima } from "./clima.js";
import { mostrarPanel, formulario } from "./panel.js";
import { insignia, anillo, icono, elegir, moverConSuavidad } from "./dibujos.js";
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
  // Si esta ventana se quitó (cambió la disposición), su reloj se apaga.
  const reloj = setInterval(() => {
    if (!v.isConnected) return clearInterval(reloj);
    if (!v.closest(".oculto") && datos.nodos.length) dibujar();
  }, 60_000);
  return dibujar;
}

// Paso 94: Plan de hoy, la otra vista de Hoy (se elige en Ajustes). Arriba tu semana: cada día es un anillo con cuánto
// de lo de ese día está hecho. Abajo lo de hoy (y lo atrasado) en tarjetas: al marcar una se apaga y baja al final
// mientras las demás suben (moverConSuavidad); desmarcarla la devuelve a su lugar.
const QUIETO = matchMedia("(prefers-reduced-motion: reduce)");
// El dibujo de cada tarjeta: el ícono propio de la tarea (props.icono) o uno adivinado por su nombre.
const ICONOS_TAREA = [[/correo|mail|respond|escrib|mensaje/i, "dialogo"], [/certamen|prueba|examen|control|quiz/i, "certamen"],
  [/estudi|repas|leer|lectura|apunte/i, "libro"], [/entreg|tarea|informe|trabajo|lab/i, "trabajo"], [/reuni|llamad|junta|clase/i, "persona"],
  [/compr|pag|plata|banco/i, "billetera"], [/gym|entren|correr|ejercicio/i, "pesa"], [/comer|cocin|almuerzo|cena/i, "plato"]];
const iconoDe = (n) => n.props?.icono ?? elegir(n.titulo, ICONOS_TAREA, "lista");

export function planDeHoy(v) {
  const semana = el("div", { className: "semana-anillos" }), lista = el("ul", { className: "plan desliza" });
  const agregar = el("button", { className: "pildora", onclick: () => formulario(null, { tipos: ["tarea", "evento"], valores: { fecha: sinHoraISO(hoyTexto()) } }) }, "Agregar +");
  v.append(semana, el("div", { className: "plan-cabeza" }, el("h4", { textContent: "Plan de hoy" }), agregar), lista);
  // Lo que marcaste aquí sigue a la vista hasta mañana (aunque fuera de otro día), en el orden en que lo marcaste.
  let diaDe = "", marcadas = [], firma = "";

  return () => {
    const hoy = hoyTexto();
    if (diaDe !== hoy) { diaDe = hoy; marcadas = []; }
    // Una tarea que se repite no queda "Hecho": su fecha salta a la próxima vez. Si la marcaste hoy, cuenta como hecha.
    const hecha = (n) => n.estado === "Hecho" || (marcadas.includes(n.id) && dia(n.fecha) > hoy);
    const entra = (n) => (hecha(n) ? marcadas.includes(n.id) || dia(n.fecha) === hoy || esPrioridad(n) : esPrioridad(n) || (!!dia(n.fecha) && dia(n.fecha) <= hoy));
    const tareas = datos.nodos.filter((n) => n.tipos.clave === "tarea");
    const plan = tareas.filter(entra).sort((a, b) => hecha(a) - hecha(b) || (hecha(a) ? marcadas.indexOf(a.id) - marcadas.indexOf(b.id)
      : esPrioridad(b) - esPrioridad(a) || porFecha(a, b)));

    // La semana, de lunes a domingo. Hoy cuenta lo mismo que la lista de abajo; los otros días, sus tareas.
    semana.replaceChildren(...Array.from({ length: 7 }, (_, i) => {
      const d = sumarDias(lunes(hoy), i), f = new Date(d + "T12:00");
      const delDia = d === hoy ? plan : tareas.filter((n) => dia(n.fecha) === d);
      const avance = delDia.length ? delDia.filter(hecha).length / delDia.length : 0;
      const aro = anillo(avance, "");
      aro.style.setProperty("--c", avance === 1 ? "var(--bien)" : d === hoy ? "var(--acento)" : "var(--alerta)"); // lo que quedó a medias, en rojo
      return el("span", { className: "dia-anillo" + (d === hoy ? " actual" : d > hoy ? " futuro" : ""), title: delDia.length ? `${delDia.filter(hecha).length} de ${delDia.length} hechas` : "Nada ese día" },
        el("small", { textContent: f.toLocaleDateString("es-CL", { weekday: "narrow" }) }), aro, el("b", { textContent: f.getDate() }));
    }));

    const pintar = () => lista.replaceChildren(...(plan.length ? plan.map((n) => tarjeta(n, hecha(n), hoy))
      : [el("p", { className: "vacio", textContent: "Nada para hoy. Toca «Agregar» para planear algo." })]));
    // Si solo cambió el orden o el estado, las tarjetas viajan a su lugar nuevo; si no, se dibuja directo.
    const nueva = plan.map((n) => n.id + hecha(n)).join();
    if (firma && nueva !== firma && plan.length) moverConSuavidad(lista, pintar); else pintar();
    firma = nueva;
  };

  // Una tarjeta: su dibujo, el nombre, la hora (o el día, si está atrasada) y la casilla. Se arrastra a «Tu día».
  function tarjeta(n, hecha, hoy) {
    const d = dia(n.fecha), atrasada = !hecha && d < hoy;
    const caja = el("input", { type: "checkbox", className: "caja", checked: hecha, ariaLabel: (hecha ? "Desmarcar " : "Marcar como hecha ") + n.titulo });
    const li = el("li", { className: hecha ? "hecha" : "", draggable: !hecha },
      insignia(iconoDe(n), colorDeSuCaja(n.id) ?? colorDe("tarea")),
      el("div", { className: "que" },
        el("a", { className: "nombre", textContent: n.titulo, title: n.titulo, onclick: () => mostrarPanel(n.id) }),
        el("span", { className: "meta" + (atrasada ? " atrasada" : "") }, icono(esPrioridad(n) ? "estrella" : "reloj"),
          atrasada ? "Atrasada · " + corto(d) : hora(n.fecha) || "Sin hora")),
      caja);
    li.dataset.id = n.id;
    li.ondragstart = (e) => e.dataTransfer.setData("text/plain", n.id);
    // Primero se ve el ✓ y la tarjeta se apaga; un instante después baja (o sube, si la desmarcas).
    caja.onchange = () => {
      caja.disabled = true;
      li.classList.toggle("hecha", caja.checked);
      caja.classList.add("recien");
      marcadas = marcadas.filter((id) => id !== n.id).concat(caja.checked ? [n.id] : []);
      setTimeout(() => (caja.checked ? completar : reabrir)(n), QUIETO.matches ? 0 : 280);
    };
    return li;
  }
}
