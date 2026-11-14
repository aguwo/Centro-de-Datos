// Paso 97: la revisión de la noche. Una ventana que te lleva paso a paso para dejar la base al día antes de dormir.
// Desde las 21:00 aparece el botón «Revisar el día» (abajo a la derecha, sobre «+ Nuevo»). Cada paso hace una
// pregunta; si no tiene nada que revisar, se salta solo. Al terminar se marca tu hábito de revisar (el que tenga
// «revis» en el nombre, ej. «Revisar el sistema»), así la revisión lleva su racha como cualquier hábito.
// Pasada la medianoche (hasta las 5:00) todavía revisas el día que terminó.
//
// Los pasos están en PASOS: agregar uno = agregar un objeto ahí. Cada paso tiene:
//   titulo, pregunta  lo que dice arriba
//   cosas(d)          lo que hay que revisar del día d (se mira al entrar al paso). Sin cosas, el paso se salta
//   fila(cosa, r)     la tarjeta de una cosa. r.listo(cosa, frase) la saca de la lista y la cuenta en el resumen
//                     con esa frase (ver FRASES); r.pintar() la vuelve a dibujar. Cuando no queda ninguna, sigue solo
//   cuerpo(r)         (en vez de cosas y fila) lo que se muestra; este paso nunca se salta
// Lo que se anota usa lo mismo que el resto de la web: la ventana de comida de Salud, la de «Anotar» de Finanzas...
// Al cerrarse esas ventanas, la revisión mira si quedó anotado y sigue.
import { $, el, datos, dia, hora, dentroDe, flotante } from "./base.js";
import { hoyTexto, sumarDias, diasEntre, sinHoraISO, corto, ocurreEl } from "./fechas.js";
import { cambiar, cambiarProps, completar, archivar, anotar } from "./acciones.js";
import { MAX_PRIORIDADES, porFecha } from "./tareas.js";
import { habitosDelDia, comidasDe, MOMENTOS, agregarA, objetivoDePeso, pesoActual, fechaDe } from "./salud.js";
import { anotar as anotarPlata, plata } from "./finanzas.js";
import { icono } from "./dibujos.js";

const DESDE = 21, HASTA = 5;     // a qué hora aparece el botón y hasta qué hora de la madrugada sigue contando el día anterior
const VIENE = 7;                  // cuántos días hacia adelante se miran para elegir las prioridades de mañana
const PESARSE = 7;                // cada cuántos días se pide el peso
const NOTAS = 14;                 // cuántos días atrás se buscan evaluaciones sin nota
const diaDeRevision = () => (new Date().getHours() < HASTA ? sumarDias(hoyTexto(), -1) : hoyTexto());
const esDeNoche = () => { const h = new Date().getHours(); return h >= DESDE || h < HASTA; };

const abiertas = () => datos.nodos.filter((n) => n.tipos.clave === "tarea" && n.estado !== "Hecho" && n.estado !== "Inbox").sort(porFecha);
const habitoDeRevisar = () => datos.nodos.find((n) => n.tipos.clave === "habito" && /revis/i.test(n.titulo));
const revisado = (h, d) => datos.registros.some((r) => r.clase === "habito" && r.nodo_id === h.id && dia(r.fecha) === d);
// Cuántas noches seguidas revisaste, contando hacia atrás desde d.
function racha(h, d) {
  let n = 0;
  while (revisado(h, sumarDias(d, -n))) n++;
  return n;
}

// Lo que se cuenta en el resumen, en singular y plural.
const FRASES = { hecha: ["tarea hecha", "tareas hechas"], movida: ["tarea movida", "tareas movidas"], soltada: ["tarea soltada", "tareas soltadas"],
  asistencia: ["clase anotada", "clases anotadas"], habito: ["hábito cumplido", "hábitos cumplidos"], comida: ["comida anotada", "comidas anotadas"],
  gasto: ["gasto anotado", "gastos anotados"], peso: ["pesada", "pesadas"], nota: ["nota nueva", "notas nuevas"], ordenada: ["post-it ordenado", "post-its ordenados"] };
const contar = (n, [uno, varios]) => `${n} ${n === 1 ? uno : varios}`;

// De qué se trata una tarea: dónde está, qué día y a qué hora (lo que tenga).
const detalle = (n) => [dentroDe(n.id), dia(n.fecha) && corto(dia(n.fecha)), hora(n.fecha)].filter(Boolean).join(" · ");
// Una tarjeta: qué es (título y una línea chica) y, al lado o debajo, lo que se puede hacer con ella.
const tarjeta = (titulo, sub, ...lado) => el("li", { className: "tarjeta-revision" },
  el("div", { className: "que" }, el("b", { textContent: titulo }), sub ? el("small", { textContent: sub }) : ""), ...lado);
const deNodo = (n, ...lado) => tarjeta(n.titulo, detalle(n), ...lado);
// Una fila de botones: [texto, qué hace]. El primero es el principal.
const botones = (...lista) => el("div", { className: "opciones-revision" },
  ...lista.map(([texto, hacer], i) => (texto instanceof Node ? texto : el("button", { className: i ? "" : "principal", textContent: texto, onclick: hacer }))));
// Abre otra ventana (la de comida, la de gastos) y, cuando se cierra, llama a despues.
const yDespues = (ventana, despues) => ventana.addEventListener("close", despues, { once: true });
// Un número escrito con coma o punto; null si no es un número.
const numero = (campo) => { const x = Number(campo.value.replace(",", ".")); return campo.value && x > 0 ? x : null; };

// Las clases del día d: los eventos que se repiten dentro de un ramo (tópico), uno por ramo.
const ramoDe = (e) => { const r = datos.nodo.get(datos.padre.get(e.id)); return r?.tipos.clave === "topico" ? r : null; };
function clasesDel(d) {
  const ramos = new Map();
  for (const e of datos.nodos) if (e.tipos.clave === "evento" && e.props?.repite && e.fecha && ramoDe(e) && ocurreEl(dia(e.fecha), e.props, d)) ramos.set(ramoDe(e).id, { e, ramo: ramoDe(e) });
  return [...ramos.values()];
}
const gastosDel = (d) => datos.registros.filter((r) => r.clase === "gasto" && dia(r.fecha) === d);
const anotadoEl = (clase, d, nodo_id) => datos.registros.some((r) => r.clase === clase && dia(r.fecha) === d && (!nodo_id || r.nodo_id === nodo_id));

// «Otro día»: el botón se vuelve un calendario; al elegir el día, la tarea se mueve ahí.
function otroDia(n, d, listo) {
  const b = el("button", { textContent: "Otro día" });
  b.onclick = () => {
    const fecha = el("input", { type: "date", min: sumarDias(d, 1), ariaLabel: "¿Para qué día?",
      onchange: () => fecha.value && (cambiar(n, { fecha: sinHoraISO(fecha.value) }), listo(n, "movida")) });
    b.replaceWith(fecha);
    fecha.focus();
    try { fecha.showPicker(); } catch { /* algunos navegadores no lo abren solo: queda el campo para tocarlo */ }
  };
  return b;
}

export const PASOS = [
  {
    titulo: "Lo de hoy", pregunta: "¿Qué pasó con estas tareas?",
    cosas: (d) => abiertas().filter((n) => dia(n.fecha) && dia(n.fecha) <= d),
    fila: (n, { d, listo }) => deNodo(n, botones(
      ["Hecha", () => { completar(n); listo(n, "hecha"); }],
      ["Mañana", () => { cambiar(n, { fecha: sinHoraISO(sumarDias(d, 1)) }); listo(n, "movida"); }],
      [otroDia(n, d, listo)],
      ["Soltar", () => { archivar(n); listo(n, "soltada"); }])),
  },
  {
    titulo: "Asistencia", pregunta: "¿Fuiste a estas clases?",
    cosas: (d) => clasesDel(d).filter(({ ramo }) => !anotadoEl("asistencia", d, ramo.id)),
    fila: (c, { d, listo }) => {
      const fue = (valor) => () => { anotar({ clase: "asistencia", nodo_id: c.ramo.id, valor, fecha: sinHoraISO(d) }); listo(c, "asistencia"); };
      return tarjeta(c.ramo.titulo, [c.e.titulo, hora(c.e.fecha)].join(" · "), botones(["Fui", fue(1)], ["Falté", fue(0)]));
    },
  },
  {
    titulo: "Hábitos", pregunta: "¿Cuáles hiciste hoy?",
    cosas: (d) => habitosDelDia(d).filter((x) => !x.marca && x.h !== habitoDeRevisar()),
    fila: (x, { d, listo }) => tarjeta(x.h.titulo, x.hora, botones(
      ["Lo hice", () => { anotar({ clase: "habito", nodo_id: x.h.id, ...fechaDe(d) }); listo(x, "habito"); }],
      ["Hoy no", () => listo(x)])),
  },
  {
    titulo: "Comidas", pregunta: "¿Qué comiste? Anota lo que falte.",
    cosas: (d) => MOMENTOS.filter(([nombre]) => !comidasDe(d).some((x) => x.momento === nombre)),
    fila: (m, { d, listo }) => {
      const [nombre, , alMomento] = m;
      return tarjeta(nombre, "sin registro", botones(
        ["Anotar", () => yDespues(agregarA(nombre, alMomento, { dia: d }), () => comidasDe(d).some((x) => x.momento === nombre) && listo(m, "comida"))],
        ["No comí", () => listo(m)]));
    },
  },
  {
    titulo: "Gastos", pregunta: "¿Gastaste plata hoy?",
    cosas: (d) => [d],
    fila: (_, { d, listo, pintar, cuenta }) => {
      const hoy = gastosDel(d), total = hoy.reduce((t, g) => t + Number(g.valor), 0);
      return tarjeta(hoy.length ? `Llevas ${plata(total)} hoy` : "Nada anotado hoy", hoy.map((g) => g.titulo).join(", "), botones(
        ["Anotar un gasto", () => yDespues(anotarPlata("gasto"), () => { cuenta.gasto = (cuenta.gasto ?? 0) + gastosDel(d).length - hoy.length; pintar(); })],
        [hoy.length ? "Eso es todo" : "Nada hoy", () => listo(d)]));
    },
  },
  {
    titulo: "Peso", pregunta: `Hace más de ${PESARSE} días que no te pesas.`,
    cosas: (d) => { const o = objetivoDePeso(), u = o && pesoActual(o); return o && (!u.d || diasEntre(u.d, d) >= PESARSE) ? [o] : []; },
    fila: (o, { listo }) => {
      const campo = el("input", { type: "text", inputMode: "decimal", placeholder: String(pesoActual(o).v || ""), ariaLabel: "Tu peso en kg" });
      return tarjeta(o.titulo, "Tu peso en kg", campo, botones(
        ["Anotar", () => { const valor = numero(campo); if (valor) { anotar({ clase: "medida", nodo_id: o.id, valor, unidad: "kg", titulo: "Peso" }); listo(o, "peso"); } else campo.focus(); }],
        ["Hoy no", () => listo(o)]));
    },
  },
  {
    titulo: "Notas", pregunta: "¿Salió alguna de estas notas? (en EV@ o en el portal)",
    cosas: (d) => datos.nodos.filter((e) => e.tipos.clave === "evento" && !e.props?.repite && ramoDe(e) && typeof e.props?.nota !== "number"
      && dia(e.fecha) <= d && dia(e.fecha) > sumarDias(d, -NOTAS)).sort(porFecha),
    fila: (e, { listo }) => {
      const campo = el("input", { type: "text", inputMode: "decimal", placeholder: "Nota", ariaLabel: "Nota de " + e.titulo });
      return deNodo(e, campo, botones(
        ["Guardar", () => { const nota = numero(campo); if (nota && nota <= 7) { cambiarProps(e, { nota }); listo(e, "nota"); } else campo.focus(); }],
        ["Todavía no sale", () => listo(e)]));
    },
  },
  {
    titulo: "Inbox", pregunta: "Ordena lo que anotaste al vuelo.",
    cosas: () => datos.nodos.filter((n) => n.estado === "Inbox"),
    fila: (n, { d, listo }) => deNodo(n, botones(
      ["Mañana", () => { cambiar(n, { estado: "Por hacer", fecha: sinHoraISO(sumarDias(d, 1)) }); listo(n, "ordenada"); }],
      ["Algún día", () => { cambiar(n, { estado: "Por hacer" }); listo(n, "ordenada"); }],
      ["Hecha", () => { cambiar(n, { estado: "Hecho" }); listo(n, "ordenada"); }],
      ["Soltar", () => { archivar(n); listo(n, "ordenada"); }])),
  },
  {
    titulo: "Mañana", pregunta: `Elige hasta ${MAX_PRIORIDADES} prioridades para mañana.`,
    cosas: (d) => abiertas().filter((n) => dia(n.fecha) && dia(n.fecha) <= sumarDias(d, VIENE)),
    fila: (n, { d, pintar }) => {
      const manana = sumarDias(d, 1), puesta = n.props?.prioridad_dia === manana;
      const lleno = abiertas().filter((x) => x.props?.prioridad_dia === manana).length >= MAX_PRIORIDADES;
      return deNodo(n, el("button", { className: "estrella" + (puesta ? " puesta" : ""), textContent: puesta ? "★" : "☆", disabled: !puesta && lleno,
        ariaPressed: String(puesta), ariaLabel: puesta ? "Quitar de las prioridades de mañana" : "Hacerla prioridad de mañana",
        onclick: () => { cambiarProps(n, { prioridad_dia: puesta ? null : manana }); pintar(); } }));
    },
  },
  {
    titulo: "Listo", pregunta: "Así quedó tu día.",
    cuerpo: ({ d, cuenta }) => {
      const manana = abiertas().filter((n) => n.props?.prioridad_dia === sumarDias(d, 1)), h = habitoDeRevisar();
      const hecho = Object.entries(FRASES).filter(([k]) => cuenta[k]).map(([k, f]) => contar(cuenta[k], f));
      return el("div", { className: "resumen-revision" },
        el("p", { textContent: hecho.length ? hecho.join(", ") + "." : "No cambiaste nada: estaba todo al día." }),
        manana.length ? el("div", {}, el("h4", { textContent: "Mañana" }), el("ul", {}, ...manana.map((n) => el("li", { textContent: "★ " + n.titulo }))))
          : el("p", { className: "vacio", textContent: "Mañana no tiene prioridades todavía." }),
        h ? el("p", { className: "racha", textContent: `Al terminar se marca «${h.titulo}»: ${contar(racha(h, sumarDias(d, -1)) + 1, ["noche seguida", "noches seguidas"])}.` }) : "");
    },
  },
];

// La ventana: un paso a la vez, con una barra que avanza, «Atrás» y «Siguiente» (lo que no respondas queda como estaba).
export function abrirRevision() {
  const d = diaDeRevision(), cuenta = {};
  let i = -1, cosas = [], fuera = new Set();
  const avance = el("div", { className: "barra-revision", role: "progressbar", ariaValueMin: 0, ariaValueMax: PASOS.length });
  const pregunta = el("p", { className: "pregunta" }), lista = el("div", { className: "lista-revision desliza" });
  const atras = el("button", { textContent: "Atrás", onclick: () => ir(-1) }), seguir = el("button", { className: "principal", onclick: () => ir(1) });
  const ventana = flotante("", avance, pregunta, lista, el("div", { className: "pie" }, atras, seguir));
  ventana.classList.add("revision");
  const titulo = ventana.querySelector("h3");

  // Al cambiar de paso las tarjetas entran animadas; al responder una, las demás se quedan quietas.
  const r = {
    d, cuenta,
    pintar: () => { lista.classList.remove("entrando"); pintar(); },
    listo(cosa, frase) {
      lista.classList.remove("entrando");
      fuera.add(cosa);
      if (frase) cuenta[frase] = (cuenta[frase] ?? 0) + 1;
      if (cosas.every((c) => fuera.has(c))) ir(1); else pintar();
    },
  };
  function pintar() {
    const p = PASOS[i], quedan = p.cuerpo ? [] : cosas.filter((c) => !fuera.has(c));
    lista.replaceChildren(p.cuerpo ? p.cuerpo(r) : el("ul", {}, ...quedan.map((c) => p.fila(c, r))));
  }
  // Avanza (o retrocede) hasta el próximo paso que tenga algo que revisar.
  function ir(paso) {
    if (paso > 0 && i === PASOS.length - 1) return terminar();
    let j = i + paso;
    while (PASOS[j] && !PASOS[j].cuerpo && !PASOS[j].cosas(d).length) j += paso;
    if (!PASOS[j]) return;
    i = j; cosas = PASOS[i].cosas?.(d) ?? []; fuera = new Set();
    lista.classList.add("entrando");
    titulo.textContent = PASOS[i].titulo;
    pregunta.textContent = PASOS[i].pregunta;
    avance.style.setProperty("--avance", (i + 1) / PASOS.length);
    avance.ariaValueNow = i + 1;
    atras.disabled = !PASOS.slice(0, i).some((p) => p.cuerpo || p.cosas(d).length);
    seguir.textContent = i === PASOS.length - 1 ? "Terminar" : "Siguiente";
    pintar();
  }
  function terminar() {
    const h = habitoDeRevisar();
    if (h && !revisado(h, d)) anotar({ clase: "habito", nodo_id: h.id, fecha: sinHoraISO(d) });
    ventana.close();
  }
  ir(1);
}

// El botón «Revisar el día»: se ve de noche y, si ya revisaste, se apaga (pero se puede abrir igual).
export function iniciarRevision() {
  const b = $("revisar");
  b.prepend(icono("luna"));
  b.onclick = abrirRevision;
  const mirar = () => {
    const h = habitoDeRevisar(), listo = h && revisado(h, diaDeRevision());
    b.hidden = !esDeNoche();
    b.classList.toggle("hecha", !!listo);
    b.title = listo ? "Ya revisaste hoy. Puedes abrirla otra vez." : "Repasa tu día y deja todo al día";
  };
  mirar();
  setInterval(mirar, 60_000);
  document.addEventListener("datos", mirar);
}
