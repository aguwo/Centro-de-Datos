// Los widgets de Hoy (paso 27): a la izquierda qué hacer, a la derecha cuándo.
//   Tareas de hoy  tus 3 prioridades destacadas, lo demás de hoy y lo atrasado (con Hoy / Mañana / Soltar)
//   El tiempo      clima.js
//   Tu día         la agenda desde ahora (agenda.js). Arrastrar una tarea encima le reserva esa hora.
//   Plan de hoy    (paso 94; la vista de siempre desde el paso 96) la semana en anillos y TODO lo de hoy (tareas,
//                  hábitos y eventos) en una lista de tarjetas que bajan al marcarlas
// Todo se calcula de los datos cargados y se escribe con acciones.js; el tiempo real redibuja.
// Cómo se arma una ventana con estas funciones: widgets.js.
import { el, datos, dia, hora, colorDe, colorDeSuCaja, dentroDe } from "./base.js";
import { hoyTexto, lunes, sumarDias, corto, sinHoraISO, hhmm, aHora, horaDecimal } from "./fechas.js";
import { agendar, completar, reabrir, alternarRegistro } from "./acciones.js";
import { dibujarAgenda, delDia } from "./agenda.js";
import { habitosDelDia } from "./salud.js";
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
  cadaMinuto(v, dibujar); // la línea de "ahora" avanza sola
  return dibujar;
}

// Redibuja una ventana cada minuto (así a medianoche "hoy" cambia de día). Si la ventana se quitó (cambió la
// disposición), su reloj se apaga; si está escondida, espera.
function cadaMinuto(v, dibujar) {
  const reloj = setInterval(() => {
    if (!v.isConnected) return clearInterval(reloj);
    if (!v.closest(".oculto") && datos.nodos.length) dibujar();
  }, 60_000);
}

// Paso 94: Plan de hoy, la otra vista de Hoy (se elige en Ajustes). Arriba tu semana: cada día es un anillo con cuánto
// de lo de ese día está hecho. Abajo lo de hoy (y lo atrasado) en tarjetas: al marcar una se apaga y baja al final
// mientras las demás suben (moverConSuavidad); desmarcarla la devuelve a su lugar.
// Paso 96: es una sola lista con TODO lo de hoy, no solo tareas: tus tareas, los hábitos que te tocan y tus eventos
// (las clases también). Lo que tiene hora va en orden de hora; un evento que ya terminó se apaga y baja solo.
const QUIETO = matchMedia("(prefers-reduced-motion: reduce)");
// El dibujo de cada tarjeta: el ícono propio (props.icono) o uno adivinado por su nombre.
const ICONOS_TAREA = [[/correo|mail|respond|escrib|mensaje/i, "dialogo"], [/certamen|prueba|examen|control|quiz/i, "certamen"], [/\btest\b/i, "test"],
  [/estudi|repas|leer|lectura|apunte/i, "libro"], [/entreg|tarea|informe|trabajo|lab/i, "trabajo"], [/reuni|llamad|junta|clase/i, "persona"],
  [/compr|pag|plata|banco/i, "billetera"], [/gym|entren|correr|ejercicio/i, "pesa"], [/comer|cocin|almuerzo|cena/i, "plato"]];
const iconoDe = (n, otro) => n.props?.icono ?? elegir(n.titulo, ICONOS_TAREA, otro);
const ORDEN = { tarea: 0, habito: 1, evento: 2 }; // sin hora: primero las tareas, después los hábitos

// Lo del día d, todo con la misma forma, para dibujarlo y contarlo igual:
//   n        el nodo (tocar el nombre lo abre)
//   clase    "tarea", "habito" o "evento"
//   ini, fin a qué hora parte y termina (14.5 = 14:30), o null si no tiene hora
//   hecha    si ya está: la tarea marcada, el hábito anotado ese día o el evento que ya terminó
//   alternar (las que se marcan) lo marca o lo desmarca; los eventos no tienen
//   icono, color, meta  cómo se ve: su dibujo, su color y lo que dice debajo del nombre
// marcadas: las tareas que marcaste hoy (una que se repite no queda "Hecho": su fecha salta, pero aquí cuenta hecha).
function loDelDia(d, hoy, marcadas = []) {
  const ahora = d < hoy ? 24 : d > hoy ? -1 : horaDecimal(new Date());
  const lugar = (id) => [dentroDe(id)];
  const tareas = datos.nodos.filter((n) => n.tipos.clave === "tarea").map((n) => {
    const fd = dia(n.fecha), hecha = n.estado === "Hecho" || (d === hoy && marcadas.includes(n.id) && fd > hoy);
    const entra = d !== hoy ? fd === d : hecha ? marcadas.includes(n.id) || fd === hoy || esPrioridad(n) : esPrioridad(n) || (!!fd && fd <= hoy);
    if (!entra) return null;
    const atrasada = !hecha && fd < d, h = hora(n.fecha);
    return { n, clase: "tarea", ini: h ? horaDecimal(n.fecha) : null, hecha, atrasada, prioridad: esPrioridad(n),
      alternar: (marcar) => (marcar ? completar : reabrir)(n), icono: iconoDe(n, "lista"), color: colorDeSuCaja(n.id) ?? colorDe("tarea"),
      meta: [esPrioridad(n) ? "estrella" : "reloj", atrasada ? "Atrasada · " + corto(fd) : h || "Sin hora", ...lugar(n.id)] };
  }).filter(Boolean);
  const habitos = habitosDelDia(d).map(({ h, marca, tema: [dibujo, color], hora: hh }) => ({
    n: h, clase: "habito", ini: hh ? aHora(hh) : null, hecha: !!marca, alternar: () => alternarRegistro("habito", h, marca, d === hoy ? {} : { fecha: sinHoraISO(d) }),
    icono: dibujo, color, meta: ["repetir", hh || "Hábito", dentroDe(h.id)] }));
  const eventos = delDia(d).filter((x) => !x.tarea).map(({ n, ini, fin }) => ({
    n, clase: "evento", ini, fin, hecha: ini === null ? d < hoy : fin <= ahora, ahora: ini !== null && ini <= ahora && ahora < fin,
    icono: iconoDe(n, n.props?.repite ? "persona" : "calendario"), color: colorDeSuCaja(n.id) ?? colorDe("evento"),
    meta: ["calendario", ini === null ? "Todo el día" : `${hhmm(ini)} – ${hhmm(fin)}`, ...lugar(n.id)] }));
  return [...tareas, ...habitos, ...eventos];
}
// El orden de lo pendiente: tus prioridades, lo atrasado, lo que tiene hora (en orden) y al final lo que no.
const porHacer = (a, b) => (b.prioridad ?? false) - (a.prioridad ?? false) || (b.atrasada ?? false) - (a.atrasada ?? false)
  || (a.ini ?? 99) - (b.ini ?? 99) || ORDEN[a.clase] - ORDEN[b.clase] || porFecha(a.n, b.n);

export function planDeHoy(v) {
  const semana = el("div", { className: "semana-anillos" }), lista = el("ul", { className: "plan desliza" });
  const cuenta = el("small", { className: "cuenta-plan" });
  const agregar = el("button", { className: "pildora", onclick: () => formulario(null, { tipos: ["tarea", "evento", "habito"], valores: { fecha: sinHoraISO(hoyTexto()) } }) }, "Agregar +");
  v.append(semana, el("div", { className: "plan-cabeza" }, el("h4", {}, "Plan de hoy ", cuenta), agregar), lista);
  // Lo que marcaste aquí sigue a la vista hasta mañana (aunque fuera de otro día), en el orden en que lo marcaste.
  let diaDe = "", marcadas = [], firma = "";

  const dibujar = () => {
    const hoy = hoyTexto();
    if (diaDe !== hoy) { diaDe = hoy; marcadas = []; }
    const yaHecha = (x) => (marcadas.includes(x.n.id) ? marcadas.indexOf(x.n.id) : -1);
    const plan = loDelDia(hoy, hoy, marcadas).sort((a, b) => a.hecha - b.hecha || (a.hecha ? yaHecha(a) - yaHecha(b) || (a.ini ?? 99) - (b.ini ?? 99) : porHacer(a, b)));
    const hechas = plan.filter((x) => x.hecha).length;
    cuenta.textContent = plan.length ? `${hechas} de ${plan.length}` : "";

    // La semana, de lunes a domingo: cada día cuenta lo mismo que esta lista (tareas, hábitos y eventos de ese día).
    semana.replaceChildren(...Array.from({ length: 7 }, (_, i) => {
      const d = sumarDias(lunes(hoy), i), f = new Date(d + "T12:00");
      const deEse = d === hoy ? plan : loDelDia(d, hoy), listas = deEse.filter((x) => x.hecha).length;
      const avance = deEse.length ? listas / deEse.length : 0;
      const aro = anillo(avance, "");
      aro.style.setProperty("--c", avance === 1 ? "var(--bien)" : d === hoy ? "var(--acento)" : "var(--alerta)"); // lo que quedó a medias, en rojo
      return el("span", { className: "dia-anillo" + (d === hoy ? " actual" : d > hoy ? " futuro" : ""), title: deEse.length ? `${listas} de ${deEse.length} hechas` : "Nada ese día" },
        el("small", { textContent: f.toLocaleDateString("es-CL", { weekday: "narrow" }) }), aro, el("b", { textContent: f.getDate() }));
    }));

    const pintar = () => lista.replaceChildren(...(plan.length ? plan.map(tarjeta)
      : [el("p", { className: "vacio", textContent: "Nada para hoy. Toca «Agregar» para planear algo." })]));
    // Si solo cambió el orden o el estado, las tarjetas viajan a su lugar nuevo; si no, se dibuja directo.
    const nueva = plan.map((x) => x.n.id + x.hecha).join();
    if (firma && nueva !== firma && plan.length) moverConSuavidad(lista, pintar); else pintar();
    firma = nueva;
  };
  cadaMinuto(v, dibujar); // así un evento que termina se apaga y baja solo
  return dibujar;

  // Una tarjeta: su dibujo, el nombre, lo de debajo (hora, dónde está) y la casilla (o «Ahora», en un evento que está pasando).
  // Las tareas se arrastran a «Tu día» para reservarles una hora.
  function tarjeta(x) {
    const { n, hecha } = x, [simbolo, ...textos] = x.meta;
    const caja = x.alternar && el("input", { type: "checkbox", className: "caja", checked: hecha, ariaLabel: (hecha ? "Desmarcar " : "Marcar como hecho ") + n.titulo });
    const li = el("li", { className: [x.clase, hecha && "hecha"].filter(Boolean).join(" "), draggable: x.clase === "tarea" && !hecha },
      insignia(x.icono, x.color),
      el("div", { className: "que" },
        el("a", { className: "nombre", textContent: n.titulo, title: n.titulo, onclick: () => mostrarPanel(n.id) }),
        el("span", { className: "meta" + (x.atrasada ? " atrasada" : "") }, icono(simbolo), el("span", { textContent: textos.filter(Boolean).join(" · ") }))),
      caja || (x.ahora ? el("span", { className: "en-curso", textContent: "Ahora" }) : ""));
    li.dataset.id = n.id;
    li.ondragstart = (e) => e.dataTransfer.setData("text/plain", n.id);
    // Primero se ve el ✓ y la tarjeta se apaga; un instante después baja (o sube, si la desmarcas).
    if (caja) caja.onchange = () => {
      caja.disabled = true;
      li.classList.toggle("hecha", caja.checked);
      caja.classList.add("recien");
      marcadas = marcadas.filter((id) => id !== n.id).concat(caja.checked ? [n.id] : []);
      setTimeout(() => x.alternar(caja.checked), QUIETO.matches ? 0 : 280);
    };
    return li;
  }
}
