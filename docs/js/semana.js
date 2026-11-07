// Esta semana (paso 61): tus 7 días de un vistazo, en el escritorio infinito arriba de Hoy.
// Sus widgets comparten ctx.semana (widgets.js): el lunes de la semana que se mira (sin nada, la de hoy).
//   lo-importante  una franja: lo que más pesa esta semana con los días que faltan, lo que viene después
//                  y cómo se ve la semana siguiente
//   dias           una columna por día: cuánto tiene, lo de una vez (evaluaciones) pintado, el horario y las tareas
//
// Todo sale de delDia (agenda.js), lo mismo que usa el calendario: eventos (también los que se repiten) y tareas
// abiertas. "De una vez" = un evento que no se repite; "lo que pesa" = su ponderación (props.peso), si la tiene.
import { el, datos, dia, colorDe, colorDeSuCaja, dentroDe, sinLoQueYaSeVe } from "./base.js";
import { hoyTexto, sumarDias, diasEntre, lunes, hhmm, esDia } from "./fechas.js";
import { completar } from "./acciones.js";
import { delDia } from "./agenda.js";
import { mostrarPanel } from "./panel.js";
import { pastilla } from "./dibujos.js";

const LLENO = 8;      // horas ocupadas con que un día se ve lleno
const PESADA = 4;     // desde cuántas cosas de una vez la semana siguiente se avisa como pesada
const PESA = 10;      // desde qué ponderación (%) algo de una vez marca su día como pesado

// ---------- las cuentas ----------
const desdeDe = (ctx) => ctx.semana ?? lunes(hoyTexto());
const diasDe = (desde) => Array.from({ length: 7 }, (_, i) => sumarDias(desde, i));
const deUnaVez = (x) => x.n.tipos.clave === "evento" && !x.n.props?.repite;
const peso = (n) => Number(n.props?.peso) || 0;
const colorDeX = (n) => colorDeSuCaja(n.id) ?? colorDe(n.tipos.clave);
// Lo de una vez entre dos días (incluidos), sin lo que ya pasó, del que más pesa al que menos (y por fecha).
const importantesEntre = (desde, hasta) => diasDe(desde).filter((d) => d <= hasta && d >= hoyTexto())
  .flatMap((d) => delDia(d).filter(deUnaVez)).sort((a, b) => peso(b.n) - peso(a.n) || a.d.localeCompare(b.d));
// Cuánto tiene un día, de 0 a 1: las horas ocupadas, más media hora por cada tarea sin hora.
const carga = (items) => Math.min(1, items.reduce((s, x) => s + (x.ini === null ? 0.5 : x.fin - x.ini), 0) / LLENO);

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const nombreDia = (d) => DIAS[new Date(d + "T12:00").getDay()];
// "hoy", "mañana", "en 3 días", "hace 2 días"
function enCuanto(d) {
  const f = diasEntre(hoyTexto(), d);
  return f === 0 ? "hoy" : f === 1 ? "mañana" : f > 1 ? `en ${f} días` : f === -1 ? "ayer" : `hace ${-f} días`;
}
const cuando = (x) => [nombreDia(x.d) + " " + Number(x.d.slice(8)), x.ini === null ? "" : hhmm(x.ini), peso(x.n) ? `vale ${String(peso(x.n)).replace(".", ",")}%` : ""]
  .filter(Boolean).join(" · ");

// ---------- lo-importante (la franja) ----------
export function loImportante(v, ctx) {
  v.classList.add("franja-semana");
  return function dibujar() {
    const desde = desdeDe(ctx), hasta = sumarDias(desde, 6);
    const lista = importantesEntre(desde, hasta), primero = lista[0];
    const despues = lista.filter((x) => x !== primero).sort((a, b) => a.d.localeCompare(b.d) || (a.ini ?? 0) - (b.ini ?? 0))[0];
    const siguiente = diasDe(sumarDias(desde, 7)).flatMap((d) => delDia(d).filter(deUnaVez));
    const mayor = [...siguiente].sort((a, b) => peso(b.n) - peso(a.n))[0];

    const principal = primero
      ? tarjeta("principal", primero.n, el("span", { className: "cuenta-grande" }, el("b", { textContent: Math.max(0, diasEntre(hoyTexto(), primero.d)) }), el("small", { textContent: diasEntre(hoyTexto(), primero.d) === 1 ? "día" : "días" })),
        "Lo más importante", primero.n.titulo, [dentroDe(primero.n.id), cuando(primero)].filter(Boolean).join(" · "))
      : tarjeta("principal tranquila", null, "", "Lo más importante", "Nada de una vez esta semana", "Sin evaluaciones ni eventos especiales");
    v.replaceChildren(principal,
      despues ? tarjeta("", despues.n, "", "Después", despues.n.titulo, `${cuando(despues)} · ${enCuanto(despues.d)}`)
        : tarjeta("", null, "", "Después", "Nada más", "No hay otra cosa de una vez"),
      tarjeta(siguiente.length >= PESADA ? "aviso" : "", mayor?.n, "", siguiente.length >= PESADA ? "Ojo: la próxima viene pesada" : "La semana siguiente",
        siguiente.length ? `${siguiente.length} ${siguiente.length === 1 ? "cosa" : "cosas"} de una vez` : "Sin nada de una vez",
        mayor ? `${mayor.n.titulo}${peso(mayor.n) ? " vale " + String(peso(mayor.n)).replace(".", ",") + "%" : ""} · ${nombreDia(mayor.d)} ${Number(mayor.d.slice(8))}` : ""));
  };
}
// Una tarjeta de la franja: arriba qué es, al medio el nombre y abajo el detalle. Con un nodo, tocarla lo abre.
function tarjeta(clase, n, adelante, etiqueta, titulo, detalle) {
  const t = el(n ? "button" : "div", { className: "tarjeta-semana " + clase, onclick: n ? () => mostrarPanel(n.id) : null },
    adelante, el("span", { className: "texto" }, el("small", { textContent: etiqueta }), el("b", { textContent: titulo }), el("span", { textContent: detalle })));
  if (n && clase.includes("principal")) t.style.setProperty("--c", colorDeX(n));
  return t;
}

// ---------- dias (las columnas) ----------
export function diasDeLaSemana(v, ctx) {
  const grilla = el("div", { className: "dias-semana" });
  v.append(grilla);
  return function dibujar() {
    const hoy = hoyTexto(), desde = desdeDe(ctx), dias = diasDe(desde), items = dias.map(delDia);
    barraDeLaSemana(ctx, items.flat());
    // De lunes a viernes, una columna cada uno; el fin de semana comparte la última, uno encima del otro.
    const columna = (d, i) => columnaDelDia(d, items[i], hoy);
    grilla.replaceChildren(...dias.slice(0, 5).map(columna), el("div", { className: "finde" }, ...dias.slice(5).map((d, i) => columna(d, i + 5))));
  };
}

// Arriba del apartado: ‹ Esta semana › para moverse y unas pastillas con la cuenta.
function barraDeLaSemana(ctx, enLaSemana) {
  const hoy = hoyTexto(), desde = desdeDe(ctx), hasta = sumarDias(desde, 6);
  const atrasadas = datos.nodos.filter((n) => n.tipos.clave === "tarea" && n.estado !== "Hecho" && dia(n.fecha) && dia(n.fecha) < hoy).length;
  const evaluaciones = enLaSemana.filter((x) => deUnaVez(x) && peso(x.n)).length, tareas = enLaSemana.filter((x) => x.tarea).length;
  const nombreSemana = desde === lunes(hoy) ? "Esta semana" : desde === sumarDias(lunes(hoy), 7) ? "La semana siguiente"
    : desde === sumarDias(lunes(hoy), -7) ? "La semana pasada" : "Semana del " + Number(desde.slice(8));
  const ir = (n) => ctx.cambiar({ semana: n === 0 ? null : sumarDias(desde, n) });
  ctx.barra.replaceChildren(
    el("span", { className: "mover-semana" },
      el("button", { textContent: "‹", title: "Semana anterior", ariaLabel: "Semana anterior", onclick: () => ir(-7) }),
      el("button", { textContent: nombreSemana, title: "Volver a esta semana", ariaPressed: String(desde === lunes(hoy)), onclick: () => ir(0) }),
      el("button", { textContent: "›", title: "Semana siguiente", ariaLabel: "Semana siguiente", onclick: () => ir(7) })),
    pastilla("calendario", `${Number(desde.slice(8))} – ${new Date(hasta + "T12:00").toLocaleDateString("es-CL", { day: "numeric", month: "short" })}`),
    evaluaciones ? pastilla("certamen", `${evaluaciones} ${evaluaciones === 1 ? "evaluación" : "evaluaciones"}`) : "",
    tareas ? pastilla("si", `${tareas} ${tareas === 1 ? "tarea" : "tareas"}`) : "",
    atrasadas ? pastilla("alerta", `${atrasadas} ${atrasadas === 1 ? "atrasada" : "atrasadas"}`, "alerta") : "");
}

function columnaDelDia(d, items, hoy) {
  const unicos = items.filter(deUnaVez), fijos = items.filter((x) => x.n.props?.repite), tareas = items.filter((x) => x.tarea);
  const c = carga(items), pesado = unicos.some((x) => peso(x.n) >= PESA);
  const barra = el("span", { className: "carga" + (pesado ? " pesada" : ""), title: `Ocupado: ${Math.round(c * LLENO)} de ${LLENO} horas` }, el("i"));
  barra.firstChild.style.width = c * 100 + "%";
  const titulo = (t) => el("h4", { textContent: t });
  const col = el("div", { className: ["dia-semana", d === hoy && "es-hoy", d < hoy && "pasado"].filter(Boolean).join(" ") },
    el("div", { className: "cabeza" }, el("span", { textContent: nombreDia(d) + (d === hoy ? " · hoy" : "") }), el("b", { textContent: Number(d.slice(8)) })),
    barra,
    ...unicos.map(evento),
    ...(fijos.length ? [titulo("Horario"), ...fijos.map(fijo)] : []),
    ...(tareas.length ? [titulo("Tareas"), ...tareas.map(tarea)] : []),
    items.length ? "" : el("p", { className: "vacio", textContent: "Libre" }));
  return col;
}

// Lo de una vez: lleno de su color, con su hora y lo que vale.
function evento(x) {
  const b = el("button", { className: "unico", onclick: () => mostrarPanel(x.n.id) }, el("b", { textContent: x.n.titulo }),
    el("small", { textContent: [dentroDe(x.n.id), x.ini === null ? "" : hhmm(x.ini), peso(x.n) ? String(peso(x.n)).replace(".", ",") + "%" : ""].filter(Boolean).join(" · ") }));
  b.style.setProperty("--c", colorDeX(x.n));
  return b;
}
// Lo que se repite (las clases): un punto de su color, el nombre (sin el día, que ya se ve arriba) y la hora.
function fijo(x) {
  const b = el("button", { className: "fijo", onclick: () => mostrarPanel(x.n.id) }, el("i"),
    el("span", {}, sinLoQueYaSeVe(x.n.titulo, esDia).replace(/^Clase\s+/, ""), el("small", { textContent: x.ini === null ? "todo el día" : `${hhmm(x.ini)} – ${hhmm(x.fin)}` })));
  b.style.setProperty("--c", colorDeX(x.n));
  return b;
}
// Una tarea: su casilla para marcarla hecha y, abajo, dónde está y hasta cuándo (si tiene plazo).
function tarea(x) {
  const n = x.n, caja = el("input", { type: "checkbox", className: "caja", title: "Marcar como hecha", ariaLabel: "Marcar como hecha" });
  caja.onchange = () => { caja.disabled = true; completar(n); };
  const hasta = n.props?.fecha_fin && dia(n.props.fecha_fin) !== x.d ? "hasta " + nombreDia(dia(n.props.fecha_fin)).toLowerCase() + " " + Number(dia(n.props.fecha_fin).slice(8)) : "";
  return el("div", { className: "tarea-dia" }, caja,
    el("span", {}, el("a", { textContent: n.titulo, onclick: () => mostrarPanel(n.id) }),
      el("small", { textContent: [dentroDe(n.id), x.ini === null ? "" : hhmm(x.ini), hasta].filter(Boolean).join(" · ") })));
}
