// El apartado Universidad (paso 46a): tus ramos del semestre, con sus notas, tu asistencia y lo que se viene.
// Sus widgets comparten ctx.ramo (widgets.js): el ramo abierto, o nada para ver todos.
//   ramos         una tarjeta por ramo: cómo va, tu nota, cuánto necesitas, tu asistencia y lo próximo
//   ramo          el ramo abierto: sus evaluaciones (ponderación y nota se escriben ahí), tu asistencia y sus tareas
//   lo-que-viene  las evaluaciones y tareas de tus ramos que vienen, de la más cercana a la más lejana
//
// Un ramo es un tópico con semestre (se muestran los del semestre más reciente). Sus evaluaciones son los eventos
// que tiene adentro y no se repiten (las clases sí se repiten). Las cuentas están en notas.js.
// Paso 52: cada ramo tiene su tema (ícono y portada ilustrada, de dibujos.js) y cada evaluación su ícono según el tipo.
import { el, db, datos, dia, hora, cajasDe, colorDeProyecto, escribir, escribiendoEn, avisar, fijas, FIJA } from "./base.js";
import { hoyTexto, diasEntre, corto } from "./fechas.js";
import { cambiarProps, dentroDeCaja } from "./acciones.js";
import { mostrarPanel, formulario } from "./panel.js";
import { listaDeTareas, agregarTarea, porFecha } from "./tareas.js";
import { aportesDe, comoVa, esObjetivo } from "./objetivos.js";
import { calcular, estado, asistencia, nota, formativa, MINIMA, MAXIMA } from "./notas.js";
import { icono, insignia, portada, elegir, anillo } from "./dibujos.js";

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

// El tema de un ramo (su ícono y su dibujo): el que le pongas en props.icono o, si no, uno adivinado por su nombre.
const TEMAS = [[/arquitect|comput|electr|circuit/i, "chip"], [/dato|sql/i, "base"], [/ambient|energ|ecolog|biolog|quím/i, "hoja"],
  [/ingl|idioma|franc|alem|portug|comunica/i, "dialogo"], [/sistema|red(es)?\b/i, "red"]];
const temaDe = (ramo) => ramo.props?.icono ?? elegir(ramo.titulo, TEMAS, "libro");
// El ícono de una evaluación, por cómo se llama. Las tareas llevan siempre el de tarea.
const TIPOS = [[/certamen|prueba|control/i, "certamen"], [/lab|tarea/i, "lab"], [/test|quiz/i, "test"],
  [/oral|presenta|exposici|entrevista|role/i, "oral"], [/infograf|visual|p[óo]ster/i, "imagen"], [/proyecto|etapa/i, "proyecto"],
  [/examen|integradora/i, "examen"]];
const tipoDe = (n) => (n.tipos.clave === "tarea" ? "test" : elegir(n.titulo, TIPOS, "trabajo"));
// Del syllabus (paso 48), si lo dice: quién hace el ramo y la asistencia mínima. Si no, el mínimo habitual (75%).
const profeDe = (ramo) => ramo.contenido?.match(/^Profesora?(?:\s+S\d)?:\s*([^(\n]+)/m)?.[1].trim();
const minimoDe = (ramo) => Number(ramo.contenido?.match(/asistencia m[ií]nima:\s*(\d+)\s*%/i)?.[1] ?? 75) / 100;
const bajo = (a, ramo) => a.porcentaje !== null && a.porcentaje < minimoDe(ramo);

const CLASE = { "Seguro": "bien", "Va bien": "va", "En riesgo": "riesgo", "No alcanza": "riesgo", "Sin notas": "nada" };
const chip = (palabra) => el("span", { className: "como " + CLASE[palabra], textContent: palabra });
const porcentaje = (a) => (a.porcentaje === null ? "—" : Math.round(a.porcentaje * 100) + "%");
function necesitasTexto(c) {
  if (c.sinPeso) return c.actual === null ? "Sin notas todavía" : `Falta la ponderación de ${c.sinPeso}`;
  if (c.necesitas === null) return c.actual === null ? "Sin notas todavía" : "Ramo terminado";
  if (c.necesitas > MAXIMA) return "Ni con 7 llegas al 4";
  if (c.necesitas <= MINIMA) return "Apruebas aunque te saques un 1";
  return `Necesitas ${nota(c.necesitas)} en lo que falta`;
}
// Cuánto falta, corto: "hoy", "mañana", "en 8 días" o "atrasada".
function cuenta(n) {
  const faltan = diasEntre(hoyTexto(), dia(n.fecha));
  return faltan < 0 ? "atrasada" : faltan === 0 ? "hoy" : faltan === 1 ? "mañana" : `en ${faltan} días`;
}
const pastilla = (nombre, texto, clase = "") => el("span", { className: "pastilla " + clase }, icono(nombre), texto);

// ---------- ramos (las tarjetas) ----------
// Arriba, unas pastillas con el objetivo del semestre, los días que quedan y los ramos con poca asistencia.
// Cada tarjeta: su portada, tu nota, cuánto necesitas, tu asistencia y lo próximo.
export function tarjetasDeRamos(v, ctx) {
  const resumen = el("div", { className: "resumen-ramos" }), grilla = el("div", { className: "tarjetas-ramos" });
  v.append(resumen, grilla);
  return function dibujar() {
    v.hidden = !!datos.nodo.get(ctx.ramo);
    const lista = ramos(), enCurso = lista.filter((r) => r.estado !== "Hecho");
    // El objetivo al que aportan los ramos (ej. "Aprobar el semestre 2026-2"), si lo hay.
    const objetivo = datos.nodos.find((o) => esObjetivo(o) && aportesDe(o.id).some((a) => lista.includes(a)));
    const faltan = objetivo?.fecha && diasEntre(hoyTexto(), dia(objetivo.fecha));
    const bajos = enCurso.filter((r) => bajo(asistencia(asistenciasDe(r)), r)).length;
    resumen.replaceChildren(...[
      objetivo && pastilla("objetivo", `${objetivo.titulo}: ${comoVa(objetivo).texto}`),
      faltan > 0 && pastilla("calendario", `Quedan ${faltan} días`),
      bajos && pastilla("alerta", `Asistencia baja en ${bajos} ${bajos === 1 ? "ramo" : "ramos"}`, "alerta"),
    ].filter(Boolean));
    if (!lista.length) return grilla.replaceChildren(el("p", { className: "vacio vidrio ventana", textContent: "No hay ramos todavía: son los tópicos que tienen semestre." }));
    grilla.replaceChildren(...lista.map((r) => {
      const c = evaluar(evaluacionesDe(r)), a = asistencia(asistenciasDe(r)), prox = queViene(r)[0], color = colorDeProyecto(r.id);
      const como = r.estado === "Hecho" ? (r.props?.resultado === "Reprobado" ? "No alcanza" : "Seguro") : estado(c);
      const tapa = portada(temaDe(r), color);
      if (r.estado !== "Hecho" && bajo(a, r)) tapa.append(pastilla("alerta", "Asistencia", "aviso"));
      else if (como === "En riesgo" || como === "No alcanza") tapa.append(pastilla("alerta", como, "aviso"));
      const t = el("button", { className: "tarjeta-ramo", onclick: () => ctx.cambiar({ ramo: r.id }) }, tapa,
        el("span", { className: "cuerpo" },
          el("span", { className: "nombre" }, el("b", { textContent: r.titulo }), el("small", { textContent: profeDe(r) ?? "" })),
          el("span", { className: "nota" }, el("strong", { textContent: nota(c.actual) }), el("small", { textContent: r.estado === "Hecho" ? como === "Seguro" ? "Aprobado" : "Reprobado" : necesitasTexto(c) })),
          el("span", { className: "asis" + (bajo(a, r) ? " baja" : "") }, icono("persona"),
            el("span", {}, "Asistencia ", el("b", { textContent: porcentaje(a) }), a.porcentaje === null ? "" : ` · mínimo ${Math.round(minimoDe(r) * 100)}%`)),
          el("span", { className: "prox" }, ...(prox
            ? [insignia(tipoDe(prox.n), color, "chica"), el("span", { textContent: prox.n.titulo }), el("span", { className: "cuenta", textContent: cuenta(prox.n) })]
            : [el("span", { className: "meta", textContent: "Nada pendiente con fecha" })]))));
      t.style.setProperty("--c", color);
      return t;
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

    const color = colorDeProyecto(ramo.id), profe = profeDe(ramo), minimo = minimoDe(ramo);
    v.style.setProperty("--c", color);
    // Un dato de la cabeza: su ícono, qué es y cuánto. alerta: se pinta de advertencia.
    const dato = (nombre, etiqueta, valor, detalle, alerta) => el("div", { className: "dato" + (alerta ? " alerta" : "") },
      insignia(nombre, alerta ? "var(--alerta)" : color), el("span", {}, el("small", { textContent: etiqueta }), el("strong", { textContent: valor }), el("small", { textContent: detalle })));
    const cabeza = el("section", { className: "ventana vidrio cabeza-ramo" }, portada(temaDe(ramo), color, "ancha"),
      el("div", { className: "titulo" },
        el("button", { className: "volver", textContent: "‹ Todos los ramos", onclick: () => ctx.cambiar({ ramo: null }) }),
        el("h3", {}, ramo.titulo, chip(estado(c))),
        profe ? el("p", {}, icono("persona"), profe) : "",
        el("button", { className: "editar", textContent: "Editar ramo", onclick: () => mostrarPanel(ramo.id) })),
      el("div", { className: "datos-ramo" },
        dato("estrella", "Nota hasta ahora", nota(c.actual), c.evaluado === null ? "" : `con el ${Math.round(c.evaluado * 100)}% evaluado`),
        dato("objetivo", "Para aprobar", c.necesitas !== null && !c.sinPeso && c.necesitas > MINIMA && c.necesitas <= MAXIMA ? nota(c.necesitas) : "—",
          c.necesitas !== null && !c.sinPeso && c.necesitas > MINIMA && c.necesitas <= MAXIMA ? `en el ${Math.round(c.falta)}% que falta` : necesitasTexto(c), estado(c) === "No alcanza"),
        dato(bajo(a, ramo) ? "alerta" : "persona", "Asistencia", porcentaje(a), `mínimo ${Math.round(minimo * 100)}%`, bajo(a, ramo))));

    // Las evaluaciones: la ponderación y la nota se escriben directo en la tabla.
    const numero = (e, clave, etiqueta, min, max) => {
      const i = el("input", { type: "number", inputMode: "decimal", min, max, step: clave === "nota" ? 0.1 : 1, value: e.props?.[clave] ?? "",
        ariaLabel: `${etiqueta} de ${e.titulo}`, placeholder: "—", disabled: fijas(e).includes(clave) });
      if (i.disabled) i.title = FIJA;
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
        el("td", {}, el("span", { className: "con-insignia" }, insignia(tipoDe(e), color, "chica"), el("a", { className: "nombre", textContent: e.titulo, onclick: () => mostrarPanel(e.id) }))),
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
      simulador = el("div", { className: "simulador" }, icono("idea"), el("label", { textContent: `¿Y si en ${proxima.titulo} me saco…?` }), campo, salida);
    }

    // La asistencia: un punto por clase y los botones para anotar la de hoy (tocar el mismo otra vez la borra).
    const hoy = hoyTexto(), deHoy = regs.find((r) => dia(r.fecha) === hoy);
    const anotar = (valor) => escribir(deHoy?.valor === valor ? db.from("registros").delete().eq("id", deHoy.id)
      : deHoy ? db.from("registros").update({ valor }).eq("id", deHoy.id)
      : db.from("registros").insert({ clase: "asistencia", nodo_id: ramo.id, valor }));
    const boton = (texto, valor) => el("button", { ariaPressed: String(deHoy?.valor === valor), onclick: () => anotar(valor) }, icono(valor ? "si" : "no"), texto);
    // Un cuadrito por clase (✓ fuiste, ✗ faltaste) y un anillo con tu porcentaje; la rayita del anillo es el mínimo del ramo.
    const asis = el("section", { className: "ventana vidrio asistencia" + (bajo(a, ramo) ? " baja" : "") },
      el("h3", {}, "Asistencia", el("small", { textContent: a.total ? `${a.fui} de ${a.total} clases` : "" })),
      regs.length ? el("div", { className: "resumen-asis" }, anillo(a.porcentaje, porcentaje(a), minimo),
        el("div", { className: "puntos" }, ...regs.map((r) => el("i", { className: Number(r.valor) === 1 ? "fui" : "falte",
          title: `${corto(dia(r.fecha))}: ${Number(r.valor) === 1 ? "fuiste" : "faltaste"}` }, icono(Number(r.valor) === 1 ? "si" : "no")))))
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
      el("ul", {}, ...xs.map(({ n, ramo }) => el("li", {}, insignia(tipoDe(n), colorDeProyecto(ramo.id), "chica"),
        el("a", { className: "nombre", textContent: n.titulo, onclick: () => mostrarPanel(n.id) }),
        el("span", { className: "meta", textContent: (abierto ? "" : ramo.titulo + " · ") + cuando(n) + (n.tipos.clave === "evento" ? " · evaluación" : "") }))))]));
  };
}
