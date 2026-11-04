// El apartado Universidad (paso 46a): tus ramos del semestre, con sus notas, tu asistencia y lo que se viene.
// Sus widgets comparten ctx.ramo (widgets.js): el ramo abierto, o nada para ver todos.
//   ramos         una tarjeta por ramo: cómo va, tu nota, cuánto necesitas, tu asistencia y lo próximo
//   ramo          el ramo abierto: sus evaluaciones (ponderación y nota se escriben ahí), tu asistencia y sus tareas
//   lo-que-viene  las evaluaciones y tareas de tus ramos que vienen, de la más cercana a la más lejana
//
// Un ramo es un tópico con semestre (se muestran los del semestre más reciente). Sus evaluaciones son los eventos
// que tiene adentro y no se repiten (las clases sí se repiten). Las cuentas están en notas.js.
import { el, db, datos, dia, hora, cajasDe, colorDeProyecto, escribir, escribiendoEn, avisar } from "./base.js";
import { hoyTexto, diasEntre, corto } from "./fechas.js";
import { cambiarProps, dentroDeCaja } from "./acciones.js";
import { mostrarPanel, formulario } from "./panel.js";
import { listaDeTareas, agregarTarea, porFecha } from "./tareas.js";
import { aportesDe, comoVa, esObjetivo } from "./objetivos.js";
import { calcular, estado, asistencia, nota, formativa, MINIMA, MAXIMA } from "./notas.js";

const PROXIMOS = 8; // cuántas cosas muestra "Lo que viene" (las atrasadas van siempre)
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

// ---------- los datos de un ramo ----------
export const semestreActual = () => datos.nodos.map((n) => n.tipos.clave === "topico" && n.props?.semestre).filter(Boolean).sort().at(-1);
const ramos = () => datos.nodos.filter((n) => n.tipos.clave === "topico" && n.props?.semestre === semestreActual())
  .sort((a, b) => (a.estado === "Hecho") - (b.estado === "Hecho") || a.titulo.localeCompare(b.titulo, "es"));
const dentro = (clave, ramo) => datos.nodos.filter((n) => n.tipos.clave === clave && cajasDe(n.id).includes(ramo.id));
const evaluacionesDe = (ramo) => dentro("evento", ramo).filter((e) => !e.props?.repite).sort(porFecha);
const asistenciasDe = (ramo) => datos.registros.filter((r) => r.clase === "asistencia" && r.nodo_id === ramo.id);
const pendientes = (ramo) => dentro("tarea", ramo).filter((t) => t.estado !== "Hecho" && t.estado !== "Inbox").sort(porFecha);
const evaluar = (evals) => calcular(evals.map((e) => ({ nota: e.props?.nota, peso: e.props?.peso })));

// Lo que viene de un ramo: sus evaluaciones sin nota y sus tareas pendientes, con fecha de hoy en adelante
// (las tareas atrasadas también, porque siguen pendientes).
function queViene(ramo) {
  const hoy = hoyTexto();
  return [...evaluacionesDe(ramo).filter((e) => typeof e.props?.nota !== "number" && dia(e.fecha) >= hoy),
    ...pendientes(ramo).filter((t) => t.fecha)]
    .map((n) => ({ n, ramo, d: dia(n.fecha) })).sort((a, b) => porFecha(a.n, b.n));
}
// "hoy", "mañana", "el jueves" (esta semana), "en 12 días" o la fecha; con la hora, si tiene.
function cuando(n) {
  const d = dia(n.fecha), faltan = diasEntre(hoyTexto(), d), h = hora(n.fecha);
  const texto = faltan < 0 ? `atrasada (${corto(d)})` : faltan === 0 ? "hoy" : faltan === 1 ? "mañana"
    : faltan < 7 ? "el " + DIAS[new Date(d + "T12:00").getDay()] : faltan < 15 ? `en ${faltan} días` : corto(d);
  return h ? `${texto} ${h}` : texto;
}

const CLASE = { "Seguro": "bien", "Va bien": "va", "En riesgo": "riesgo", "No alcanza": "riesgo", "Sin notas": "nada" };
const chip = (palabra) => el("span", { className: "como " + CLASE[palabra], textContent: palabra });
const punto = (ramo) => { const i = el("i", { className: "punto" }); i.style.setProperty("--c", colorDeProyecto(ramo.id)); return i; };
const porcentaje = (a) => (a.porcentaje === null ? "—" : Math.round(a.porcentaje * 100) + "%");
function necesitasTexto(c) {
  if (c.sinPeso) return c.actual === null ? "Sin notas todavía" : `Falta la ponderación de ${c.sinPeso}`;
  if (c.necesitas === null) return c.actual === null ? "Sin notas todavía" : "Ramo terminado";
  if (c.necesitas > MAXIMA) return "Ni con 7 llegas al 4";
  if (c.necesitas <= MINIMA) return "Apruebas aunque te saques un 1";
  return `Necesitas ${nota(c.necesitas)} en lo que falta`;
}
function barraAsistencia(a) {
  const b = el("div", { className: "barra-asis" + (a.porcentaje !== null && a.porcentaje < 0.75 ? " baja" : "") }, el("i"));
  b.style.setProperty("--p", (a.porcentaje ?? 0) * 100 + "%");
  return b;
}

// ---------- ramos (las tarjetas) ----------
export function tarjetasDeRamos(v, ctx) {
  const resumen = el("p", { className: "sobre-foto resumen" }), grilla = el("div", { className: "tarjetas-ramos" });
  v.append(resumen, grilla);
  return function dibujar() {
    v.hidden = !!datos.nodo.get(ctx.ramo);
    const lista = ramos();
    // El objetivo al que aportan los ramos (ej. "Aprobar el semestre 2026-2"), si lo hay.
    const objetivo = datos.nodos.find((o) => esObjetivo(o) && aportesDe(o.id).some((a) => lista.includes(a)));
    const faltan = objetivo?.fecha && diasEntre(hoyTexto(), dia(objetivo.fecha));
    resumen.textContent = objetivo ? `${objetivo.titulo}: ${comoVa(objetivo).texto}` + (faltan > 0 ? ` · quedan ${faltan} días` : "") : "";
    if (!lista.length) return grilla.replaceChildren(el("p", { className: "vacio vidrio ventana", textContent: "No hay ramos todavía: son los tópicos que tienen semestre." }));
    grilla.replaceChildren(...lista.map((r) => {
      const c = evaluar(evaluacionesDe(r)), a = asistencia(asistenciasDe(r)), prox = queViene(r)[0];
      return el("button", { className: "tarjeta-ramo vidrio", onclick: () => ctx.cambiar({ ramo: r.id }) },
        el("span", { className: "cabeza" }, punto(r), el("b", { textContent: r.titulo }), chip(r.estado === "Hecho" ? (r.props?.resultado === "Reprobado" ? "No alcanza" : "Seguro") : estado(c))),
        el("span", { className: "cifra" }, el("strong", { textContent: nota(c.actual) }), el("small", { textContent: necesitasTexto(c) })),
        el("span", { className: "asis" }, el("span", {}, "Asistencia", el("b", { textContent: porcentaje(a) })), barraAsistencia(a)),
        el("span", { className: "prox" }, ...(prox ? ["Próximo: ", el("b", { textContent: prox.n.titulo }), " · " + cuando(prox.n)] : ["Nada pendiente con fecha"])));
    }));
  };
}

// ---------- ramo (la página de uno) ----------
export function paginaDeRamo(v, ctx) {
  let simulada = ""; // la nota que escribiste en "¿y si me saco…?"
  // Mientras escribes no se redibuja (abajo); al salir de la página del ramo, sí, con lo que guardaste.
  v.addEventListener("focusout", (e) => { if (!v.contains(e.relatedTarget)) dibujar(); });
  return dibujar;
  function dibujar() {
    const ramo = datos.nodo.get(ctx.ramo);
    v.hidden = !ramo;
    if (!ramo || escribiendoEn(v)) return; // mientras escribes una nota no se redibuja, para no pisarte
    const evals = evaluacionesDe(ramo), c = evaluar(evals), regs = asistenciasDe(ramo).sort((x, y) => x.fecha.localeCompare(y.fecha)), a = asistencia(regs);

    const cabeza = el("section", { className: "ventana vidrio cabeza-ramo" },
      el("div", { className: "titulo" },
        el("button", { className: "volver", textContent: "‹ Todos los ramos", onclick: () => ctx.cambiar({ ramo: null }) }),
        el("h3", {}, punto(ramo), ramo.titulo, chip(estado(c))),
        el("p", { textContent: necesitasTexto(c) + (c.falta ? ` (queda el ${Math.round(c.falta)}% del ramo)` : "") })),
      el("div", { className: "grande" }, el("strong", { textContent: nota(c.actual) }), el("small", { textContent: "nota hasta ahora" })),
      el("div", { className: "grande" }, el("strong", { textContent: porcentaje(a) }), el("small", { textContent: "asistencia" })),
      el("button", { textContent: "Editar ramo", onclick: () => mostrarPanel(ramo.id) }));

    // Las evaluaciones: la ponderación y la nota se escriben directo en la tabla.
    const numero = (e, clave, etiqueta, min, max) => {
      const i = el("input", { type: "number", inputMode: "decimal", min, max, step: clave === "nota" ? 0.1 : 1, value: e.props?.[clave] ?? "",
        ariaLabel: `${etiqueta} de ${e.titulo}`, placeholder: "—" });
      i.onchange = () => {
        const x = i.value === "" ? null : Number(i.value);
        if (x !== null && !(x >= min && x <= max)) return avisar(`${etiqueta}: entre ${min} y ${max}.`);
        cambiarProps(e, { [clave]: x });
      };
      return i;
    };
    const tabla = el("table", { className: "evaluaciones" },
      el("thead", {}, el("tr", {}, ...["Evaluación", "Fecha", "Pondera", "Nota"].map((t) => el("th", { textContent: t })))),
      el("tbody", {}, ...evals.map((e) => el("tr", { className: typeof e.props?.nota === "number" && e.props.nota < 4 ? "roja" : "" },
        el("td", {}, el("a", { className: "nombre", textContent: e.titulo, onclick: () => mostrarPanel(e.id) })),
        el("td", { className: "meta", textContent: e.fecha ? corto(dia(e.fecha)) : "" }),
        el("td", {}, numero(e, "peso", "Ponderación", 0, 100), el("span", { className: "meta", textContent: " %" })),
        el("td", {}, numero(e, "nota", "Nota", MINIMA, MAXIMA))))));
    const nueva = el("button", { textContent: "+ Evaluación", onclick: () => formulario(null, { tipos: ["evento"], conexion: dentroDeCaja("evento", ramo.id) }) });

    // ¿Y si me saco…? Prueba una nota en la próxima evaluación que cuenta, sin guardarla.
    const proxima = evals.find((e) => typeof e.props?.nota !== "number" && !formativa(e.props ?? {}));
    let simulador = "";
    if (proxima) {
      const salida = el("output");
      const campo = el("input", { type: "number", inputMode: "decimal", min: MINIMA, max: MAXIMA, step: 0.1, value: simulada, placeholder: "5,0", ariaLabel: "Nota de prueba" });
      const probar = () => {
        simulada = campo.value;
        const x = Number(campo.value);
        if (campo.value === "" || !(x >= MINIMA && x <= MAXIMA)) return (salida.textContent = "");
        const s = evaluar(evals.map((e) => (e === proxima ? { ...e, props: { ...e.props, nota: x } } : e)));
        salida.textContent = `→ quedarías con ${nota(s.actual)}` + (s.necesitas === null || s.sinPeso ? "" : ` · ${necesitasTexto(s).toLowerCase()}`);
      };
      campo.oninput = probar;
      probar();
      simulador = el("div", { className: "simulador" }, el("label", { textContent: `¿Y si en ${proxima.titulo} me saco…?` }), campo, salida);
    }

    // La asistencia: un punto por clase y los botones para anotar la de hoy (tocar el mismo otra vez la borra).
    const hoy = hoyTexto(), deHoy = regs.find((r) => dia(r.fecha) === hoy);
    const anotar = (valor) => escribir(deHoy?.valor === valor ? db.from("registros").delete().eq("id", deHoy.id)
      : deHoy ? db.from("registros").update({ valor }).eq("id", deHoy.id)
      : db.from("registros").insert({ clase: "asistencia", nodo_id: ramo.id, valor }));
    const boton = (texto, valor) => el("button", { textContent: texto, ariaPressed: String(deHoy?.valor === valor), onclick: () => anotar(valor) });
    const asis = el("section", { className: "ventana vidrio" },
      el("h3", {}, "Asistencia", el("small", { textContent: a.total ? `${a.fui} de ${a.total} clases` : "" })),
      regs.length ? el("div", { className: "puntos" }, ...regs.map((r) => el("i", { className: Number(r.valor) === 1 ? "fui" : "falte",
        title: `${corto(dia(r.fecha))}: ${Number(r.valor) === 1 ? "fuiste" : "faltaste"}` })))
        : el("p", { className: "vacio", textContent: "Todavía no anotas ninguna clase." }),
      el("div", { className: "hoy" }, el("span", { textContent: "Hoy:" }), boton("Fui", 1), boton("Falté", 0)));

    const agregar = agregarTarea(() => ramo.id);
    const tareas = el("section", { className: "ventana vidrio" }, el("h3", { textContent: "Tareas" }),
      pendientes(ramo).length ? listaDeTareas(pendientes(ramo), { conFecha: true, sinCaja: true }) : el("p", { className: "vacio", textContent: "Nada pendiente." }),
      agregar.form, agregar.cuando);

    // Lo que dice el syllabus (paso 48): son las notas del ramo, y se cambian con «Editar ramo».
    const syllabus = ramo.contenido ? el("details", { className: "ventana vidrio syllabus" },
      el("summary", {}, el("h3", { textContent: "Syllabus" })), el("p", { className: "contenido", textContent: ramo.contenido })) : "";

    v.replaceChildren(cabeza, el("div", { className: "cuerpo-ramo" },
      el("div", { className: "lado" },
        el("section", { className: "ventana vidrio" }, el("h3", {}, "Evaluaciones", nueva),
          evals.length ? tabla : el("p", { className: "vacio", textContent: "Sin evaluaciones. Agrégalas con «+ Evaluación»." }), simulador),
        syllabus),
      el("div", { className: "lado" }, asis, tareas)));
  }
}

// ---------- lo que viene ----------
export function loQueViene(v, ctx) {
  const lista = el("div", { className: "que-viene" });
  v.append(lista);
  return function dibujar() {
    const abierto = datos.nodo.get(ctx.ramo), hoy = hoyTexto();
    v.sub.textContent = abierto ? abierto.titulo : "";
    const todo = (abierto ? [abierto] : ramos().filter((r) => r.estado !== "Hecho")).flatMap(queViene).sort((a, b) => porFecha(a.n, b.n));
    const grupo = ({ d }) => { const f = diasEntre(hoy, d); return f < 0 ? "Atrasado" : f === 0 ? "Hoy" : f === 1 ? "Mañana" : f < 7 ? "Esta semana" : "Más adelante"; };
    const mostrar = [...todo.filter((x) => grupo(x) === "Atrasado"), ...todo.filter((x) => grupo(x) !== "Atrasado").slice(0, PROXIMOS)];
    if (!mostrar.length) return lista.replaceChildren(el("p", { className: "vacio", textContent: "Nada con fecha por delante." }));
    const grupos = new Map();
    for (const x of mostrar) grupos.set(grupo(x), [...(grupos.get(grupo(x)) ?? []), x]);
    lista.replaceChildren(...[...grupos].flatMap(([titulo, xs]) => [
      el("h4", { className: titulo === "Atrasado" || titulo === "Hoy" || titulo === "Mañana" ? "urgente" : "", textContent: titulo }),
      el("ul", {}, ...xs.map(({ n, ramo }) => el("li", {}, punto(ramo),
        el("a", { className: "nombre", textContent: n.titulo, onclick: () => mostrarPanel(n.id) }),
        el("span", { className: "meta", textContent: (abierto ? "" : ramo.titulo + " · ") + cuando(n) + (n.tipos.clave === "evento" ? " · evaluación" : "") }))))]));
  };
}
