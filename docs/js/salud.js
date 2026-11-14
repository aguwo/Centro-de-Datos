// El apartado Salud (paso 63): tu peso, lo que comiste hoy, tus hábitos y tu despensa, con gráficos.
// Va en la barra lateral, a pantalla completa. Paso 69: una sola página con tres bloques, Ejercicio, Hábitos y Dieta (apartados.js),
// cada uno con lo de hoy primero y cómo vas después.
// Sus widgets (widgets.js):
//   semana-entreno    los 7 días de esta semana: cuáles tocaba entrenar y si fuiste; un botón marca el de hoy
//   constancia-entreno 13 semanas de entrenos: lo que hiciste, lo que tocaba y lo que no
//   rutina       la rutina del próximo entreno: marcas cada ejercicio, anotas los kilos y ves cómo vas subiendo (paso 68)
//   peso         el camino a tu meta de peso: tu línea, lo que pide la fecha y el ritmo sano
//   habitos-hoy  los hábitos que tocan un día (ctx.diaHabitos; sin nada, hoy), en una lista por rutina con un anillo
//                de cuántos llevas: ‹ › cambia de día (paso 90) y tocar marca o desmarca
//   cada-habito  una fila por hábito con una raya por día (30 o 90), su porcentaje y su mejor racha
//   por-dia      qué días de la semana cumples más tus hábitos
// La Dieta (paso 67, como Samsung Health) mira un día (ctx.dia; sin nada, hoy):
//   calorias-dia  ‹ › para cambiar de día; las calorías contra tu meta y cuánto te queda; ahí se cambian las metas
//   equilibrio    de dónde vienen las calorías (carbos, grasa, proteína) contra lo recomendado
//   comidas-dia   desayuno, almuerzo, merienda y cena: sus kcal y su +, que abre ahí el buscador de alimentos;
//                 tocar una muestra qué comiste
//   semana-comida las calorías de los 7 días hasta el que miras, contra tu meta
//   despensa     los alimentos que se acabaron o quedan pocos: tocar sube su nivel
//
// De dónde sale cada cosa:
//   peso      el objetivo con unidad "kg" (ej. «Subir 10 kilos»): sus registros "medida" o, si no hay, su "Va en"
//   comida    los registros "comida" de hoy; cada uno apunta a un alimento, que sabe sus kcal y macros por 100 g
//   metas     las que guardes (tabla preferencias, clave "salud"); sin eso, unas sugeridas según tu peso
// Cada hábito cae en un bloque: los de entrenar en Ejercicio, los de registrar calorías en Dieta
// (se cumplen solos al anotar comida) y el resto en Hábitos.
import { el, db, datos, dia, escribir, areaDe, flotante } from "./base.js";
import { hoyTexto, sumarDias, diasEntre, lunes, sinHoraISO } from "./fechas.js";
import { alternarRegistro, cambiarProps, crear, dentroDeCaja } from "./acciones.js";
import { icono, elegir } from "./dibujos.js";
import { formulario, mostrarPanel } from "./panel.js";

const SANO = [0.25, 0.5];   // kg por semana que se considera sano subir (o bajar)
const SEMANAS = 13;          // cuántas semanas muestra la constancia
const COLOR = { kcal: "#2f7a4c", proteina: "#c2410c", carbos: "#2563eb", grasa: "#a16207" };
const numero = (x, dec = 0) => Number(x).toLocaleString("es-CL", { maximumFractionDigits: dec });
const svgDe = (viewBox, trazos, clase = "") => {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", viewBox);
  if (clase) s.setAttribute("class", clase);
  s.innerHTML = trazos;
  return s;
};

// ---------- el peso ----------
export const objetivoDePeso = () => datos.nodos.find((n) => n.tipos.clave === "objetivo" && n.estado !== "Hecho" && n.props?.unidad === "kg" && typeof n.props?.meta === "number");
const pesadas = (o) => datos.registros.filter((r) => r.clase === "medida" && r.nodo_id === o.id).map((r) => ({ d: dia(r.fecha), v: Number(r.valor) }));
export function pesoActual(o) {
  const u = pesadas(o).at(-1);
  return u ?? { d: null, v: Number(o.props.actual ?? o.props.inicio) };
}
// Cuánto hay que subir por semana para llegar a la fecha tope, y cuándo llegarías a ritmo sano.
function ritmo(o) {
  const ahora = pesoActual(o).v, falta = o.props.meta - ahora, hoy = hoyTexto();
  const semanas = o.fecha ? Math.max(diasEntre(hoy, dia(o.fecha)), 1) / 7 : null;
  return { ahora, falta, pide: semanas && falta / semanas,
    sano: SANO.map((k) => sumarDias(hoy, Math.ceil(Math.abs(falta) / k * 7))) }; // [la más lejana, la más cercana]
}

// ---------- la comida ----------
// Gramos de un registro: si dice porciones, por el peso de la porción del alimento.
const gramos = (r, a) => (/porci|unidad/i.test(r.unidad ?? "") ? Number(r.valor) * (a.props?.porcion_g ?? 100) : Number(r.valor));
// Lo que comiste un día, cosa por cosa: { r (el registro), a (el alimento), g (gramos), momento, kcal, proteina, carbos, grasa }.
// El momento es el de props.comida (Desayuno, Almuerzo, Merienda o Cena); sin eso, null.
export function comidasDe(d) {
  return datos.registros.filter((r) => r.clase === "comida" && dia(r.fecha) === d).map((r) => {
    const a = datos.nodo.get(r.nodo_id), p = a?.props ?? {}, g = a ? gramos(r, a) : 0, x = g / 100;
    return { r, a, g, momento: r.props?.comida ?? null,
      kcal: x * (p.kcal_100g ?? 0), proteina: x * (p.prot_100g ?? 0), carbos: x * (p.carb_100g ?? 0), grasa: x * (p.grasa_100g ?? 0) };
  });
}
// La suma de una lista de cosas comidas (o de un día entero).
const MACROS = ["kcal", "proteina", "carbos", "grasa"];
export function sumar(lista) {
  const t = { kcal: 0, proteina: 0, carbos: 0, grasa: 0, cuantas: lista.length };
  for (const x of lista) for (const k of MACROS) t[k] += x[k];
  return t;
}
export const comidaDe = (d) => sumar(comidasDe(d));
// Tus metas diarias. Sin guardadas, unas sugeridas para ganar músculo con tu peso: 45 kcal y 1,8 g de proteína por kilo,
// 1 g de grasa por kilo y el resto en carbohidratos. Se cargan una vez (la tabla preferencias, paso 53).
let metasGuardadas = null, cargando = null;
function cargarMetas(alLlegar) {
  cargando ??= db.from("preferencias").select("valor").eq("clave", "salud").maybeSingle()
    .then(({ data }) => { metasGuardadas = data?.valor ?? {}; alLlegar(); });
}
export function metas() {
  const o = objetivoDePeso(), kg = o ? pesoActual(o).v : 60;
  const kcal = Math.round(kg * 45 / 50) * 50, proteina = Math.round(kg * 1.8), grasa = Math.round(kg);
  const sugeridas = { kcal, proteina, grasa, carbos: Math.round((kcal - proteina * 4 - grasa * 9) / 4) };
  const tuyas = metasGuardadas ?? {};
  return { ...sugeridas, ...tuyas, sugeridas: !Object.keys(tuyas).length };
}
const guardarMetas = (m) => { metasGuardadas = m; return escribir(db.from("preferencias").upsert({ clave: "salud", valor: m })); };

// ---------- los hábitos ----------
// ¿Toca hoy? Si su "Días" nombra días de la semana (ej. "Lunes, martes y viernes, 08:00"), solo esos; si no, todos.
const NOMBRES = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
const sinTildes = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
function tocaEl(h, d) {
  const dias = sinTildes(h.props?.dias ?? "");
  const nombra = NOMBRES.filter((n) => dias.includes(n));
  return !nombra.length || nombra.includes(NOMBRES[new Date(d + "T12:00").getDay()]);
}
// Paso 65: en qué vista va cada hábito, según su nombre. Los que no son de Ejercicio ni de Dieta van en Hábitos.
const SECCIONES = [[/entren|gimnasio|ejercicio|correr|deporte/i, "ejercicio"], [/calor[ií]as|kcal|comida|dieta/i, "dieta"]];
const habitos = (seccion = "habitos") => datos.nodos.filter((n) => n.tipos.clave === "habito" && elegir(n.titulo, SECCIONES, "habitos") === seccion);
const marcasDe = (h) => datos.registros.filter((r) => r.clase === "habito" && r.nodo_id === h.id);
const diasMarcados = (lista) => { const ids = new Set(lista.map((h) => h.id)); return new Set(datos.registros.filter((r) => r.clase === "habito" && ids.has(r.nodo_id)).map((r) => dia(r.fecha))); };
// Qué parte de las veces que tocaba lo cumpliste, entre dos días (incluidos).
function cumplido(lista, desde, hasta) {
  let tocaban = 0, hechos = 0;
  for (const h of lista) {
    const marcados = diasMarcados([h]);
    for (let d = desde; d <= hasta; d = sumarDias(d, 1)) if (tocaEl(h, d)) { tocaban++; if (marcados.has(d)) hechos++; }
  }
  return tocaban ? hechos / tocaban : 0;
}
// El ícono y el color de un hábito: el de props.icono o uno adivinado por su nombre.
const TEMAS = [[/creatina|vitamina|pastilla|remedio/i, ["pildora", "#7c3aed"]], [/orden|limpi/i, ["caja", "#0e7490"]],
  [/sistema|revisar|planific/i, ["lista", "#2563eb"]], [/medit|respir/i, ["loto", "#be185d"]],
  [/mañana|piel|sol/i, ["sol", "#c2410c"]], [/noche|dormir/i, ["luna", "#4338ca"]], [/entren|gim|ejercicio|correr/i, ["pesa", "#2f7a4c"]],
  [/le(er|ctura)|libro/i, ["libro", "#a16207"]], [/estudi/i, ["examen", "#0f766e"]], [/calor|comida|kcal/i, ["fuego", "#c2410c"]]];
const temaDe = (h) => elegir(h.titulo, TEMAS, ["si", "#2f7a4c"]).map((x, i) => (i === 0 ? h.props?.icono ?? x : x));
// Paso 96: los hábitos que tocan el día d, de cualquier bloque (los usa Hoy). De cada uno: su marca de ese día (o nada),
// su ícono y color, y su hora si «Días» la dice (ej. Entrenar a las 08:00; si no, "").
export const habitosDelDia = (d) => datos.nodos.filter((n) => n.tipos.clave === "habito" && tocaEl(n, d))
  .map((h) => ({ h, marca: marcasDe(h).find((r) => dia(r.fecha) === d), tema: temaDe(h), hora: horaDe(h) }));
// ---------- los entrenos (paso 65) ----------
// Tus entrenos son los hábitos de Ejercicio (ej. «Entrenar», con Días «Lunes, martes, miércoles y viernes, 08:00 a 09:00»).
const entrenos = () => habitos("ejercicio");
const tocaEntrenar = (d) => entrenos().some((h) => tocaEl(h, d));
const entrenoDel = (d) => { const ids = new Set(entrenos().map((h) => h.id)); return datos.registros.find((r) => r.clase === "habito" && ids.has(r.nodo_id) && dia(r.fecha) === d); };
const horaDe = (h) => h?.props?.dias?.match(/\d{1,2}:\d{2}/)?.[0] ?? "";
// El próximo día que toca entrenar: hoy, si aún no entrenas; si no, el siguiente.
function proximoEntreno() {
  for (let d = entrenoDel(hoyTexto()) ? sumarDias(hoyTexto(), 1) : hoyTexto(), i = 0; i < 14; i++, d = sumarDias(d, 1)) if (tocaEntrenar(d)) return d;
  return null;
}
// Entrenos seguidos sin faltar a uno que tocaba (entrenar un día libre suma, pero no corta). Hoy no corta si aún no vas.
function rachaDeEntrenos() {
  const hechos = diasMarcados(entrenos()), primero = [...hechos].sort()[0];
  if (!primero) return { actual: 0, mejor: 0 };
  let actual = null, corrida = 0, mejor = 0;
  for (let d = hoyTexto(); d >= primero; d = sumarDias(d, -1)) {
    if (hechos.has(d)) corrida++;
    else if (tocaEntrenar(d) && d !== hoyTexto()) { actual ??= corrida; corrida = 0; }
    mejor = Math.max(mejor, corrida);
  }
  return { actual: actual ?? corrida, mejor };
}
const diaCorto = (d) => new Date(d + "T12:00").toLocaleDateString("es-CL", { weekday: "short", day: "numeric" });

// ---------- los widgets ----------
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

export function peso(v, ctx) {
  v.classList.add("w-salud");
  return () => {
    const o = objetivoDePeso();
    if (!o) return v.replaceChildren(el("p", { className: "vacio", textContent: "Crea un objetivo de peso (ej. «Subir 10 kilos», con su meta en kg) y aquí verás tu camino." }), nuevoObjetivo());
    const { inicio = pesoActual(o).v, meta } = o.props, ahora = pesoActual(o), r = ritmo(o), hoy = hoyTexto();
    // Los puntos: el inicio (cuando creaste el objetivo) y tus pesadas.
    // (El inicio solo si lo creaste antes de tu primera pesada: los importados de Notion se crearon después.)
    const anotadas = pesadas(o), creado = dia(o.creado_en);
    const puntos = [...(creado && (!anotadas.length || creado < anotadas[0].d) ? [{ d: creado, v: Number(inicio) }] : []), ...anotadas];
    if (!anotadas.length) puntos.push({ d: hoy, v: ahora.v });
    const tope = o.fecha ? dia(o.fecha) : null;
    const desde = puntos[0].d, hasta = [r.sano[0], tope, hoy].filter(Boolean).sort().at(-1);
    const W = 820, H = 240, IZQ = 40, ABAJO = 215, ARRIBA = 20;
    const bajo = Math.min(inicio, meta, ...puntos.map((p) => p.v)) - 0.5, alto = Math.max(inicio, meta, ...puntos.map((p) => p.v)) + 0.5;
    const x = (d) => IZQ + (W - IZQ - 10) * diasEntre(desde, d) / Math.max(diasEntre(desde, hasta), 1);
    const y = (kg) => ABAJO - (ABAJO - ARRIBA) * (kg - bajo) / (alto - bajo);
    const lineas = [];
    for (let k = Math.ceil(bajo); k <= alto; k += Math.max(1, Math.round((alto - bajo) / 4))) lineas.push(`<line x1="${IZQ}" y1="${y(k)}" x2="${W}" y2="${y(k)}" class="guia"/><text x="4" y="${y(k) + 4}">${k}</text>`);
    const meses = [];
    for (let d = desde.slice(0, 8) + "01"; d <= hasta; d = sumarDias(d, 32).slice(0, 8) + "01")
      if (d > desde && Math.abs(x(d) - x(hoyTexto())) > 30) meses.push(`<text x="${x(d)}" y="${H - 4}">${new Date(d + "T12:00").toLocaleDateString("es-CL", { month: "short" })}</text>`);
    // Lo que viene parte de hoy, desde tu peso de ahora.
    const hoyX = x(hoy), hoyY = y(ahora.v);
    const hacia = Math.sign(meta - inicio), pideDemasiado = r.pide !== null && Math.sign(r.falta) === hacia && Math.abs(r.pide) > SANO[1];
    v.replaceChildren(
      el("h3", {}, "Camino a ", String(numero(meta, 1) + " kg"), el("small", {}, `${o.titulo}${tope ? " · tope " + new Date(tope + "T12:00").toLocaleDateString("es-CL", { day: "numeric", month: "short" }) : ""} · `, editar(o, "Editar"))),
      el("div", { className: "leyenda" }, el("span", { className: "l-peso", textContent: "tu peso" }),
        pideDemasiado ? el("span", { className: "l-pide", textContent: "lo que pide la fecha" }) : "", el("span", { className: "l-sano", textContent: "ritmo sano" })),
      svgDe(`0 0 ${W} ${H}`, `${lineas.join("")}${meses.join("")}
        <path d="M${hoyX} ${hoyY} L${x(r.sano[1])} ${y(meta)} L${x(r.sano[0])} ${y(meta)} Z" class="sano"/>
        <line x1="${IZQ}" y1="${y(meta)}" x2="${W}" y2="${y(meta)}" class="meta"/>
        ${pideDemasiado ? `<path d="M${hoyX} ${hoyY} L${x(tope)} ${y(meta)}" class="pide"/><circle cx="${x(tope)}" cy="${y(meta)}" r="5" class="pide-punto"/>` : ""}
        <polyline points="${puntos.map((p) => `${x(p.d)},${y(p.v)}`).join(" ")}" class="linea"/>
        ${puntos.map((p, i) => `<circle cx="${x(p.d)}" cy="${y(p.v)}" r="${i === puntos.length - 1 ? 7 : 4.5}" class="${i === puntos.length - 1 ? "ultimo" : "punto"}"/>`).join("")}
        <line x1="${hoyX}" y1="${ARRIBA - 8}" x2="${hoyX}" y2="${ABAJO + 6}" class="hoy"/><text x="${hoyX}" y="${ABAJO + 18}" class="hoy-texto">hoy</text>`, "grafico-peso"),
      pideDemasiado ? el("p", { className: "aviso-salud" }, icono("alerta"),
        el("span", { textContent: `La fecha pide ${numero(Math.abs(r.pide), 1)} kg por semana. Lo sano es ${numero(SANO[0], 2)} a ${numero(SANO[1], 1)}: llegarías entre el ${largo(r.sano[1])} y el ${largo(r.sano[0])}. ` }), editar(o, "Cambiar la fecha")) : "",
      anotarPeso(o, ahora),
      tusPesadas(o, ctx),
    );
  };
}
// Paso 75: el objetivo se edita con el formulario de siempre (meta, inicio, fecha tope...); sin objetivo, se crea uno de peso.
const editar = (n, texto) => el("button", { className: "enlace", textContent: texto, onclick: () => formulario(n) });
const nuevoObjetivo = () => el("button", { className: "principal", textContent: "+ Objetivo de peso", onclick: () => {
  const area = areaDeSalud();
  formulario(null, { tipo: "objetivo", valores: { unidad: "kg" }, conexion: area && dentroDeCaja("objetivo", area) });
} });
// Paso 75: crear un hábito desde Salud (queda en el área de Salud; en el formulario se elige su rutina y sus días).
const nuevoHabito = () => el("button", { className: "enlace", textContent: "+ Hábito", onclick: () => {
  const area = areaDeSalud();
  formulario(null, { tipo: "habito", conexion: area && dentroDeCaja("habito", area) });
} });
const largo = (d) => new Date(d + "T12:00").toLocaleDateString("es-CL", { day: "numeric", month: "long", year: d.slice(0, 4) === hoyTexto().slice(0, 4) ? undefined : "numeric" });
// Paso 77: tus pesadas, de la más nueva a la más vieja, para corregir el peso (se guarda al salir del campo) o borrar
// una con ×. Va plegada; queda abierta si la abriste (ctx.pesadas), aunque lleguen datos nuevos.
function tusPesadas(o, ctx) {
  const lista = datos.registros.filter((r) => r.clase === "medida" && r.nodo_id === o.id).reverse();
  if (!lista.length) return "";
  const d = el("details", { className: "tus-pesadas", open: !!ctx.pesadas, ontoggle: () => { ctx.pesadas = d.open; } },
    el("summary", { textContent: `Tus pesadas (${lista.length})` }),
    ...lista.map((r) => el("div", { className: "pesada" }, el("span", { textContent: largo(dia(r.fecha)) }),
      el("input", { type: "number", step: "0.1", min: "20", max: "300", value: Number(r.valor), ariaLabel: "Peso del " + largo(dia(r.fecha)),
        onchange: (e) => { const valor = Number(e.target.value); if (valor > 0) escribir(db.from("registros").update({ valor }).eq("id", r.id)); } }),
      el("span", { textContent: "kg" }),
      el("button", { className: "quitar", textContent: "×", ariaLabel: "Borrar la pesada del " + largo(dia(r.fecha)), onclick: () => escribir(db.from("registros").delete().eq("id", r.id)) }))));
  return d;
}
// Anotar el peso de hoy: un campo y un botón. Una pesada por semana basta.
function anotarPeso(o, ahora) {
  const campo = el("input", { type: "number", step: "0.1", min: "20", max: "300", placeholder: numero(ahora.v, 1), ariaLabel: "Tu peso de hoy en kg" });
  const hace = ahora.d ? diasEntre(ahora.d, hoyTexto()) : null;
  return el("form", { className: "anotar-peso", onsubmit: (e) => {
    e.preventDefault();
    const valor = Number(campo.value.replace(",", "."));
    if (valor > 0) escribir(db.from("registros").insert({ clase: "medida", nodo_id: o.id, valor, unidad: "kg", titulo: "Peso" }));
  } }, el("span", { className: "vacio", textContent: hace === null ? "Aún no te pesas." : hace === 0 ? "Te pesaste hoy." : hace === 1 ? "Te pesaste ayer." : `Tu última pesada fue hace ${hace} días.` }),
  campo, el("span", { textContent: "kg" }), el("button", { className: "principal", textContent: "Anotar peso" }));
}

// ---------- mirar otro día (paso 90) ----------
// La Dieta y los Hábitos miran un día guardado en ctx[clave] (sin nada, hoy). Cada bloque tiene su clave, así
// retroceder en Hábitos no mueve la Dieta.
const nombreDelDia = (d) => {
  const f = diasEntre(hoyTexto(), d), largo = new Date(d + "T12:00").toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" });
  return f === 0 ? "Hoy, " + largo : f === -1 ? "Ayer, " + largo : largo;
};
// Las flechas ‹ día › para cambiar ese día; no deja pasar de hoy.
function cambiarDia(ctx, clave = "dia") {
  const d = ctx[clave] ?? hoyTexto();
  const mover = (n) => el("button", { className: "mover-dia", textContent: n < 0 ? "‹" : "›", ariaLabel: n < 0 ? "Día anterior" : "Día siguiente",
    disabled: n > 0 && d >= hoyTexto(), onclick: () => { const otro = sumarDias(d, n); ctx.cambiar({ [clave]: otro === hoyTexto() ? null : otro }); } });
  return el("div", { className: "cambiar-dia" }, mover(-1), el("b", { textContent: nombreDelDia(d) }), mover(1));
}
// Para guardar algo en el día d: hoy, con la hora de ahora; otro día, sin hora.
export const fechaDe = (d) => (d === hoyTexto() ? {} : { fecha: sinHoraISO(d) });

// Paso 66: los hábitos de hoy en una lista, agrupados por su rutina (la caja donde están), con un anillo de cuántos llevas.
export function habitosHoy(v, ctx) {
  v.classList.add("w-salud");
  return () => {
    const d = ctx.diaHabitos ?? hoyTexto(), lista = habitos().filter((h) => tocaEl(h, d)), selector = cambiarDia(ctx, "diaHabitos");
    v.sub.replaceChildren(nuevoHabito());
    if (!lista.length) return v.replaceChildren(v.firstChild, selector, el("p", { className: "vacio", textContent: d === hoyTexto() ? "Hoy no te toca ningún hábito." : "Ese día no te tocaba ningún hábito." }));
    const deHoy = (h) => marcasDe(h).find((r) => dia(r.fecha) === d), hechos = lista.filter(deHoy).length;
    // Los grupos: una rutina por caja (ej. «Mañana»); los que no están en una rutina van al final.
    const rutinaDe = (h) => { const p = datos.nodo.get(datos.padre.get(h.id)); return p?.tipos.clave === "rutina" ? p : null; };
    const grupos = new Map();
    for (const h of lista) { const r = rutinaDe(h), k = r?.id ?? ""; if (!grupos.has(k)) grupos.set(k, { r, hs: [] }); grupos.get(k).hs.push(h); }
    const orden = [...grupos.values()].sort((a, b) => !a.r - !b.r);
    const fila = (h) => {
      const marca = deHoy(h), [nombre] = temaDe(h);
      return el("button", { className: "fila-habito" + (marca ? " hecho" : ""), ariaPressed: String(!!marca), onclick: () => alternarRegistro("habito", h, marca, fechaDe(d)) },
        el("span", { className: "insignia" }, icono(nombre)), el("span", { textContent: h.titulo }), el("span", { className: "check" }, marca ? icono("si") : ""));
    };
    v.replaceChildren(v.firstChild, selector,
      el("div", { className: "aro-hoy" }, svgDe("0 0 160 160", `<circle cx="80" cy="80" r="64" pathLength="100" class="pista"/>${hechos ? `<circle cx="80" cy="80" r="64" pathLength="100" class="lleno" stroke-dasharray="${hechos / lista.length * 100} 100"/>` : ""}`),
        el("b", { textContent: `${hechos}/${lista.length}` }), el("small", { textContent: hechos === lista.length ? "¡todo listo!" : "hechos" })),
      ...orden.flatMap(({ r, hs }) => [el("small", { className: "grupo-habitos", textContent: r ? "Rutina " + r.titulo.toLowerCase() : orden.length > 1 ? "Sin rutina" : "" }), ...hs.map(fila)]));
  };
}

// Paso 66: cada hábito en una fila con una raya por día (de color si lo cumpliste, tenue si no tocaba),
// su porcentaje y su mejor racha. Arriba se elige cuántos días mirar.
const RANGOS = [30, 90];
// La racha más larga de días que tocaba y cumpliste (los días que no tocaba no la cortan).
function mejorRacha(h, desde, hasta) {
  const hechos = diasMarcados([h]);
  let mejor = 0, corrida = 0;
  for (let d = desde; d <= hasta; d = sumarDias(d, 1)) if (tocaEl(h, d)) { corrida = hechos.has(d) ? corrida + 1 : 0; mejor = Math.max(mejor, corrida); }
  return mejor;
}
export function cadaHabito(v, ctx) {
  v.classList.add("w-salud");
  return () => {
    const hoy = hoyTexto(), n = ctx.rango ?? RANGOS.at(-1), desde = sumarDias(hoy, 1 - n), lista = habitos();
    v.sub.replaceChildren(el("span", { className: "segmento", role: "group", ariaLabel: "Cuántos días" }, ...RANGOS.map((k) =>
      el("button", { textContent: k + " días", ariaPressed: String(k === n), onclick: () => ctx.cambiar({ rango: k }) }))));
    if (!lista.length) return v.replaceChildren(v.firstChild, el("p", { className: "vacio", textContent: "Aún no tienes hábitos. Crea el primero con «+ Hábito», en Hábitos de hoy." }));
    const ultimo = [...diasMarcados(lista)].sort().at(-1), sin = ultimo ? diasEntre(ultimo, hoy) : null;
    v.replaceChildren(v.firstChild,
      el("div", { className: "filas-habitos" }, ...lista.map((h) => [h, cumplido([h], desde, hoy)]).sort((a, b) => b[1] - a[1]).map(([h, frac]) => {
        const hechos = diasMarcados([h]), [nombre] = temaDe(h), rayas = [];
        for (let d = desde; d <= hoy; d = sumarDias(d, 1))
          rayas.push(el("i", { className: hechos.has(d) ? "si" : tocaEl(h, d) ? "" : "libre", title: `${d.split("-").reverse().join("/")}: ${hechos.has(d) ? "cumplido" : tocaEl(h, d) ? "no" : "no tocaba"}` }));
        return el("div", { className: "tira-habito" }, el("span", { className: "insignia" }, icono(nombre)), el("button", { className: "nombre", textContent: h.titulo, title: "Ver o editar", onclick: () => mostrarPanel(h.id) }),
          el("span", { className: "rayas" }, ...rayas), el("b", {}, String(Math.round(frac * 100) + "%")), el("small", { textContent: "mejor racha " + mejorRacha(h, desde, hoy) }));
      })),
      sin !== null && sin > 2 ? el("p", { className: "aviso-salud" }, icono("reloj"), el("span", { textContent: `Hace ${sin} días que no marcas ningún hábito. ¿Retomas hoy con uno solo?` })) : "");
  };
}

// Paso 66: qué días de la semana cumples más tus hábitos (los últimos 90 días), para ver cuáles te cuestan.
export function porDiaDeSemana(v) {
  v.classList.add("w-salud");
  return () => {
    const hoy = hoyTexto(), lista = habitos(), por = Array.from({ length: 7 }, () => ({ toca: 0, si: 0 }));
    for (const h of lista) {
      const hechos = diasMarcados([h]);
      for (let d = sumarDias(hoy, -89); d <= hoy; d = sumarDias(d, 1)) if (tocaEl(h, d)) {
        const k = (new Date(d + "T12:00").getDay() + 6) % 7; // lunes = 0
        por[k].toca++; if (hechos.has(d)) por[k].si++;
      }
    }
    const pct = por.map((x) => (x.toca ? Math.round(x.si / x.toca * 100) : 0)), peor = pct.indexOf(Math.min(...pct));
    const NOM = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
    v.sub.textContent = pct.some(Boolean) ? `el que más te cuesta: ${NOM[peor].toLowerCase()}` : "últimos 90 días";
    v.replaceChildren(v.firstChild, el("div", { className: "barras-dias" }, ...pct.map((p, i) => {
      const b = el("div", { className: "barra-dia" + (i === peor && p < 50 ? " floja" : "") }, el("small", { textContent: p + "%" }), el("i"), el("span", { textContent: NOM[i] }));
      b.querySelector("i").style.height = Math.max(3, p) + "%";
      return b;
    })));
  };
}

// Un mapa de calor de las últimas SEMANAS semanas, de lunes a domingo hasta hoy. La primera columna dice el día
// de la semana (L, X, V, D); las demás son las semanas. claseDe(d) pinta cada día y tituloDe(d) lo explica.
function mapaCalor(claseDe, tituloDe) {
  const hoy = hoyTexto(), celdas = [];
  for (let d = lunes(sumarDias(hoy, -(SEMANAS - 1) * 7)); d <= hoy; d = sumarDias(d, 1))
    celdas.push(el("span", { className: "celda " + claseDe(d), title: `${d.split("-").reverse().join("/")}: ${tituloDe(d)}` }));
  return el("div", { className: "mapa-calor" }, ..."L M X J V S D".split(" ").map((t, i) => el("span", { className: "dia-calor", textContent: i % 2 ? "" : t })), ...celdas);
}
const dato = (nombre, grande, chico) => el("div", { className: "dato-salud" }, icono(nombre), el("span", {}, el("b", { textContent: grande }), el("br"), chico));

// ---------- Ejercicio (paso 65) ----------
export function semanaEntreno(v) {
  v.classList.add("w-salud");
  return () => {
    const hoy = hoyTexto(), h = entrenos()[0];
    if (!h) return v.replaceChildren(v.firstChild, el("p", { className: "vacio", textContent: "Crea un hábito «Entrenar» con sus Días (ej. «Lunes, miércoles y viernes, 08:00») y aquí verás tu semana." }));
    v.sub.textContent = h.props?.dias ?? "todos los días";
    const deHoy = entrenoDel(hoy);
    const dias = Array.from({ length: 7 }, (_, i) => sumarDias(lunes(hoy), i)).map((d) => {
      const hecho = entrenoDel(d), toca = tocaEntrenar(d);
      const estado = hecho ? "hecho" : !toca ? "libre" : d < hoy ? "falto" : "toca";
      const texto = { hecho: "fuiste", libre: "descanso", falto: "no fuiste", toca: horaDe(h) || "toca" }[estado];
      return el("div", { className: `dia-entreno ${estado}${d === hoy ? " es-hoy" : ""}` },
        el("b", { textContent: diaCorto(d) }), el("span", { className: "aro-entreno" }, toca || hecho ? icono(hecho ? "si" : "pesa") : ""), el("small", { textContent: texto }));
    });
    v.replaceChildren(v.firstChild, el("div", { className: "semana-entreno" }, ...dias),
      tocaEntrenar(hoy) || deHoy ? el("button", { className: deHoy ? "" : "principal", textContent: deHoy ? "Desmarcar el entreno de hoy" : "Marcar el entreno de hoy",
        onclick: () => alternarRegistro("habito", h, deHoy) }) : "");
  };
}

export function constanciaEntreno(v) {
  v.classList.add("w-salud");
  return () => {
    const hoy = hoyTexto(), hechos = diasMarcados(entrenos()), r = rachaDeEntrenos();
    const desde = lunes(sumarDias(hoy, -(SEMANAS - 1) * 7)), cuantos = [...hechos].filter((d) => d >= desde).length;
    const estado = (d) => (hechos.has(d) ? "hecho" : tocaEntrenar(d) && d < hoy ? "falto" : tocaEntrenar(d) ? "toca" : "n0");
    v.sub.textContent = `${plural(cuantos, "entreno", "entrenos")} en ${SEMANAS} semanas`;
    const ultimo = [...hechos].sort().at(-1), sin = ultimo ? diasEntre(ultimo, hoy) : null;
    v.replaceChildren(v.firstChild,
      el("div", { className: "constancia" },
        mapaCalor(estado, (d) => ({ hecho: "entrenaste", falto: "tocaba y no fuiste", toca: "toca entrenar", n0: "descanso" })[estado(d)]),
        el("div", { className: "lado-constancia" },
          el("div", { className: "leyenda-calor" }, el("span", { className: "celda hecho" }), "fuiste", el("span", { className: "celda falto" }), "tocaba", el("span", { className: "celda n0" }), "descanso"),
          dato("fuego", plural(r.mejor, "entreno", "entrenos"), "tu mejor racha"),
          sin !== null && sin > 3 ? dato("reloj", `${sin} días`, "sin entrenar") : dato("si", plural(r.actual, "entreno", "entrenos"), "racha actual"))));
  };
}

// ---------- las rutinas de entreno (paso 68) ----------
// Una rutina de entreno es una caja «rutina» sin hábitos adentro (ej. «Día A», Días «Lunes y jueves»), con sus ejercicios
// (tipo «ejercicio»: series, repeticiones y kilos). Cada vez que terminas un entreno, cada ejercicio hecho queda como un
// registro «medida» con los kilos que levantaste: así se ve si vas subiendo.
const hijosDe = (id) => datos.nodos.filter((n) => datos.padre.get(n.id) === id);
const rutinasDeEntreno = () => datos.nodos.filter((n) => n.tipos.clave === "rutina" && !hijosDe(n.id).some((h) => h.tipos.clave === "habito"));
const ejerciciosDe = (r) => hijosDe(r.id).filter((n) => n.tipos.clave === "ejercicio").sort((a, b) => (a.creado_en ?? "").localeCompare(b.creado_en ?? ""));
const levantadas = (e) => datos.registros.filter((r) => r.clase === "medida" && r.nodo_id === e.id).map((r) => ({ d: dia(r.fecha), kg: Number(r.valor) }));
const kgDe = (e) => levantadas(e).at(-1)?.kg ?? Number(e.props?.kg ?? 0);
const areaDeSalud = () => areaDe((entrenos()[0] ?? habitos()[0] ?? habitos("dieta")[0])?.id ?? "");

export function rutina(v, ctx) {
  v.classList.add("w-salud");
  return () => {
    if (!datos.tipo.has("ejercicio")) return v.replaceChildren(v.firstChild, el("p", { className: "vacio", textContent: "Para armar tus rutinas falta pegar en Supabase el SQL del paso 68 (17-paso68-ejercicios.sql)." }));
    const rutinas = rutinasDeEntreno(), area = areaDeSalud();
    const nuevaRutina = el("button", { textContent: "+ Rutina", onclick: () => formulario(null, { tipo: "rutina", conexion: area && dentroDeCaja("rutina", area) }) });
    if (!rutinas.length) return v.replaceChildren(v.firstChild,
      el("p", { className: "vacio", textContent: "Arma una rutina por día de entreno (ej. «Día A», Días «Lunes y jueves») y agrégale sus ejercicios con series, repeticiones y kilos. Durante el entreno marcas cada uno y anotas el peso." }), nuevaRutina);
    // La rutina que se muestra: la elegida, o la del próximo día de entreno, o la primera.
    const prox = proximoEntreno() ?? hoyTexto();
    const r = rutinas.find((x) => x.id === ctx.rutina) ?? rutinas.find((x) => x.props?.dias && tocaEl(x, prox)) ?? rutinas[0];
    const ejercicios = ejerciciosDe(r), hechos = (ctx.hechos ??= new Map());
    v.sub.replaceChildren(rutinas.length > 1 ? el("span", { className: "segmento", role: "group", ariaLabel: "Rutina" }, ...rutinas.map((x) =>
      el("button", { textContent: x.titulo, ariaPressed: String(x === r), onclick: () => ctx.cambiar({ rutina: x.id }) }))) : r.titulo);
    const series = ejercicios.reduce((s, e) => s + (Number(e.props?.series) || 0), 0);
    const ultima = ejercicios.flatMap(levantadas).map((x) => x.d).sort().at(-1);
    const fila = (e) => {
      const hecho = hechos.has(e.id), kg = hechos.get(e.id) ?? kgDe(e);
      return el("div", { className: "ejercicio" + (hecho ? " hecho" : "") },
        el("input", { type: "checkbox", checked: hecho, ariaLabel: "Hecho: " + e.titulo, onchange: () => { if (hecho) hechos.delete(e.id); else hechos.set(e.id, kg); ctx.cambiar({}); } }),
        el("button", { className: "nombre", textContent: e.titulo, title: "Ver o editar", onclick: () => mostrarPanel(e.id) }),
        el("small", { textContent: [e.props?.series, e.props?.reps].filter(Boolean).join(" × ") }),
        el("input", { type: "number", min: "0", step: "0.5", value: kg || "", placeholder: "kg", ariaLabel: "Kilos de " + e.titulo,
          onchange: (ev) => { hechos.set(e.id, Number(ev.target.value) || 0); ctx.cambiar({}); } }), el("small", { textContent: "kg" }));
    };
    const terminar = () => {
      const filas = [...hechos].map(([id, kg]) => ({ e: datos.nodo.get(id), kg })).filter((x) => x.e);
      const h = entrenos()[0], marcar = h && !entrenoDel(hoyTexto()) ? [{ clase: "habito", nodo_id: h.id }] : [];
      escribir(db.from("registros").insert([...filas.map(({ e, kg }) => ({ clase: "medida", nodo_id: e.id, valor: kg, unidad: "kg", titulo: e.titulo,
        props: { series: e.props?.series ?? null, reps: e.props?.reps ?? null } })), ...marcar], SIN_NULOS));
      hechos.clear();
    };
    v.replaceChildren(v.firstChild,
      el("p", { className: "vacio", textContent: `${r.props?.dias || "Sin días: ponle Días para que salga sola el día que toca"}${ultima ? ` · la última vez: ${diaCorto(ultima)}` : ""}` }),
      ejercicios.length ? el("div", { className: "ejercicios" }, ...ejercicios.map(fila)) : el("p", { className: "vacio", textContent: "Esta rutina aún no tiene ejercicios." }),
      el("div", { className: "datos-rutina" }, ...[["Ejercicios", ejercicios.length], ["Series", series], ["Hechos hoy", `${hechos.size} de ${ejercicios.length}`]]
        .map(([t, n]) => el("div", {}, el("small", { textContent: t }), el("b", { textContent: String(n) })))),
      el("div", { className: "botones-rutina" },
        el("button", { textContent: "+ Ejercicio", onclick: () => formulario(null, { tipo: "ejercicio", conexion: dentroDeCaja("ejercicio", r.id) }) }), nuevaRutina,
        el("button", { className: "principal", disabled: !hechos.size, textContent: hechos.size ? `Terminar entreno (${hechos.size})` : "Marca lo que hiciste", onclick: terminar })),
      progresoDe(ejercicios, ctx));
  };
}
// Cómo vas subiendo de peso en un ejercicio de la rutina (el elegido o el primero con al menos dos entrenos anotados).
function progresoDe(ejercicios, ctx) {
  const conDatos = ejercicios.filter((e) => levantadas(e).length >= 2);
  if (!conDatos.length) return ejercicios.length ? el("p", { className: "vacio", textContent: "Después de dos entrenos verás aquí cómo vas subiendo de peso en cada ejercicio." }) : "";
  const e = conDatos.find((x) => x.id === ctx.ejercicio) ?? conDatos[0], puntos = levantadas(e);
  const W = 400, H = 120, bajo = Math.min(...puntos.map((p) => p.kg)), alto = Math.max(...puntos.map((p) => p.kg), bajo + 1);
  const x = (i) => 10 + (W - 20) * i / Math.max(puntos.length - 1, 1), y = (kg) => H - 14 - (H - 34) * (kg - bajo) / (alto - bajo);
  return el("div", { className: "progreso-ejercicio" },
    el("h4", {}, el("select", { ariaLabel: "Ejercicio", onchange: (ev) => ctx.cambiar({ ejercicio: ev.target.value }) },
      ...conDatos.map((x) => el("option", { value: x.id, textContent: x.titulo, selected: x === e }))), " en el tiempo",
      el("small", { textContent: ` ${numero(puntos[0].kg, 1)} → ${numero(puntos.at(-1).kg, 1)} kg` })),
    svgDe(`0 0 ${W} ${H}`, `<polyline points="${puntos.map((p, i) => `${x(i)},${y(p.kg)}`).join(" ")}" class="linea"/>` +
      puntos.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.kg)}" r="${i === puntos.length - 1 ? 5 : 3.5}"><title>${p.d.split("-").reverse().join("/")}: ${numero(p.kg, 1)} kg</title></circle>`).join(""), "grafico-ejercicio"));
}

const NIVELES = ["Agotado", "Bajo", "Suficiente"];
const MACRO = { "Proteína": "carne", "Carbohidrato": "grano", "Grasa": "gota" };
export function despensa(v) {
  v.classList.add("w-salud");
  return () => {
    const faltan = datos.nodos.filter((n) => n.tipos.clave === "alimento" && ["Agotado", "Bajo"].includes(n.props?.despensa))
      .sort((a, b) => NIVELES.indexOf(a.props.despensa) - NIVELES.indexOf(b.props.despensa) || a.titulo.localeCompare(b.titulo, "es"));
    const agotados = faltan.filter((n) => n.props.despensa === "Agotado").length;
    v.sub.textContent = faltan.length ? `${agotados} agotados · ${faltan.length - agotados} bajos` : "";
    if (!faltan.length) return v.replaceChildren(v.firstChild, el("p", { className: "vacio", textContent: "Tienes de todo. Bien ahí." }));
    v.replaceChildren(v.firstChild, el("div", { className: "despensa-salud" }, ...faltan.map((a) => {
      const nivel = a.props.despensa;
      return el("button", { className: "alimento-salud " + nivel.toLowerCase(), title: `${nivel}${a.props.cantidad_compra ? " · comprar " + a.props.cantidad_compra : ""}. Toca cuando compres.`,
        onclick: () => cambiarProps(a, { despensa: NIVELES[NIVELES.indexOf(nivel) + 1] }) },
        el("span", { className: "insignia" }, icono(MACRO[a.props.macro] ?? "plato")),
        el("span", {}, el("span", { textContent: a.titulo }), el("span", { className: "nivel" }, el("i"))),
        a.props.cantidad_compra ? el("small", { textContent: a.props.cantidad_compra }) : "");
    })));
  };
}

// ---------- la Dieta (paso 67, como Samsung Health) ----------
// Toda la vista mira un día (ctx.dia; sin nada, hoy). Paso 69: solo las cuatro comidas, y se agrega con el + de cada una.
export const MOMENTOS = [["Desayuno", "taza", "al desayuno"], ["Almuerzo", "plato", "al almuerzo"], ["Merienda", "manzana", "a la merienda"], ["Cena", "luna", "a la cena"]];
const diaDe = (ctx) => ctx.dia ?? hoyTexto();
// El hábito de Dieta que se cumple solo: registrar calorías (al anotar comida).
const habitoDe = (palabras) => habitos("dieta").find((h) => palabras.test(h.titulo));
const REGISTRAR = /calor[ií]as|kcal/i;
// Anotar cosas comidas ([{ a, g }]) en un momento del día d: hoy con la hora de ahora; otro día, sin hora.
// También cumple ese día el hábito de registrar calorías, si lo tienes y aún no está marcado.
// Al guardar varias filas de una vez, las que no traen una columna (ej. la marca del hábito, sin props) toman el valor
// por defecto de la tabla en vez de null (props no acepta null).
const SIN_NULOS = { defaultToNull: false };
function anotarComida(cosas, momento, d) {
  const fecha = fechaDe(d), h = habitoDe(REGISTRAR);
  const marcar = h && !marcasDe(h).some((r) => dia(r.fecha) === d) ? [{ clase: "habito", nodo_id: h.id, ...fecha }] : [];
  return escribir(db.from("registros").insert([...cosas.map(({ a, g }) => ({ clase: "comida", nodo_id: a.id, valor: g, unidad: "g",
    titulo: a.titulo, props: { comida: momento }, ...fecha })), ...marcar], SIN_NULOS));
}
const sinEstimacion = (t) => t.replace(/\s+[—-]\s+estimaci[oó]n.*$/i, "").replace(/\s*\(estimad[oa]\)/i, "");
const barra = (frac, color, pasada) => { const b = el("span", { className: "barra-dieta" + (pasada ? " pasada" : "") }, el("i")); b.style.setProperty("--c", color); b.firstChild.style.width = Math.min(100, frac * 100) + "%"; return b; };

// Las calorías del día contra tu meta, como la tarjeta de comida de Samsung Health. «Metas» las deja cambiar.
export function caloriasDia(v, ctx) {
  v.classList.add("w-salud");
  let editando = false;
  return () => {
    cargarMetas(() => ctx.cambiar({}));
    const d = diaDe(ctx), t = comidaDe(d), m = metas(), falta = m.kcal - t.kcal;
    const filas = [["kcal", "Calorías", "kcal"], ["proteina", "Proteína", "g"], ["carbos", "Carbohidratos", "g"], ["grasa", "Grasa", "g"]];
    const form = el("form", { className: "metas-dieta", onsubmit: (e) => {
      e.preventDefault();
      guardarMetas(Object.fromEntries(filas.map(([k]) => [k, Number(form.elements[k].value) || 0])));
      editando = false; ctx.cambiar({});
    } }, ...filas.map(([k, nombre, u]) => el("label", {}, nombre, el("input", { type: "number", name: k, value: m[k], min: "0" }), u)),
      el("button", { className: "principal", textContent: "Guardar" }));
    v.replaceChildren(
      cambiarDia(ctx),
      el("div", { className: "kcal-grande" }, el("b", { textContent: numero(t.kcal) }), el("span", { textContent: `/ ${numero(m.kcal)} kcal` })),
      barra(t.kcal / (m.kcal || 1), COLOR.kcal, t.kcal > m.kcal * 1.1),
      el("div", { className: "pie-kcal" }, el("span", {}, "Comidas ", el("b", { textContent: numero(t.kcal) })),
        el("span", {}, falta >= 0 ? "Te quedan " : "Te pasaste por ", el("b", { textContent: numero(Math.abs(falta)) + " kcal" }))),
      el("div", { className: "pie-kcal" }, el("small", { className: "vacio", textContent: m.sugeridas ? "Metas sugeridas según tu peso." : "" }),
        el("button", { className: "enlace", textContent: editando ? "Cancelar" : "Cambiar metas", onclick: () => { editando = !editando; ctx.cambiar({}); } })),
      editando ? form : "");
  };
}

// El equilibrio de nutrientes: de dónde vienen las calorías (carbos, grasa, proteína) contra lo recomendado por tus metas.
export function equilibrio(v, ctx) {
  v.classList.add("w-salud");
  return () => {
    const t = comidaDe(diaDe(ctx)), m = metas();
    const filas = [["carbos", "Carbohidratos", 4], ["grasa", "Grasa", 9], ["proteina", "Proteína", 4]];
    const total = filas.reduce((s, [k, , f]) => s + t[k] * f, 0);
    const pct = (k, f, x = t) => Math.round(x[k] * f / ((x === t ? total : m.kcal) || 1) * 100);
    const lejos = filas.map(([k, n, f]) => [n, pct(k, f) - pct(k, f, m)]).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0];
    v.sub.replaceChildren(!total ? "" : Math.abs(lejos[1]) < 10 ? el("span", { className: "etiqueta-dieta bien", textContent: "equilibrado" })
      : el("span", { className: "etiqueta-dieta", textContent: (lejos[1] > 0 ? "mucha " : "poca ") + lejos[0].toLowerCase().replace("carbohidratos", "carbohidrato") }));
    // Pasarse de la meta solo es malo en grasa y carbohidratos: más proteína no es problema para ganar músculo.
    v.replaceChildren(v.firstChild, ...filas.map(([k, nombre, f]) => {
      const pasada = k !== "proteina" && t[k] > m[k] * 1.1;
      const fila = el("div", { className: "nutriente" },
        el("div", {}, el("i"), el("span", { textContent: nombre }), el("b", { className: pasada ? "pasada" : "", textContent: `${numero(t[k])} g` }), el("small", { textContent: ` / ${numero(m[k])} g` })),
        barra(t[k] / (m[k] || 1), COLOR[k], pasada),
        el("small", { textContent: `${total ? pct(k, f) : 0}% de las calorías · recomendado ${pct(k, f, m)}%` }));
      fila.style.setProperty("--c", COLOR[k]);
      return fila;
    }));
  };
}

// Las comidas del día, una fila por comida con sus kcal y su +. Tocar una fila la abre para ver qué comiste (× lo borra).
// El + abre una ventana flotante con el buscador de alimentos (paso 76).
export function comidasDia(v, ctx) {
  v.classList.add("w-salud");
  return () => {
    const lista = comidasDe(diaDe(ctx)), sueltas = lista.filter((x) => !MOMENTOS.some(([n]) => n === x.momento));
    const grupos = [...MOMENTOS, ...(sueltas.length ? [["Sin comida asignada", "reloj"]] : [])];
    v.replaceChildren(v.firstChild, ...grupos.map(([nombre, ic, alMomento]) => {
      const cosas = nombre === "Sin comida asignada" ? sueltas : lista.filter((x) => x.momento === nombre), t = sumar(cosas);
      const abierta = ctx.abierta === nombre && cosas.length;
      const fila = el("div", { className: "momento" + (abierta ? " abierta" : "") },
        el("button", { className: "cabeza-momento", ariaExpanded: String(!!abierta), disabled: !cosas.length, onclick: () => ctx.cambiar({ abierta: abierta ? null : nombre }) },
          el("span", { className: "insignia" }, icono(ic)),
          el("span", {}, el("b", { textContent: nombre }), el("small", { textContent: cosas.length ? plural(cosas.length, "alimento", "alimentos") : "sin registro" })),
          cosas.length ? el("b", { className: "kcal", textContent: numero(t.kcal) + " kcal" }) : ""),
        alMomento ? el("button", { className: "mas", textContent: "+", ariaLabel: "Agregar " + alMomento, ariaHasPopup: "dialog", onclick: () => agregarA(nombre, alMomento, ctx) }) : "",
        abierta ? el("ul", { className: "cosas-momento" }, ...cosas.sort((a, b) => b.kcal - a.kcal).map((x) => el("li", {},
          el("span", { textContent: x.a ? sinEstimacion(x.a.titulo) : "(alimento borrado)" }), el("small", { textContent: numero(x.g) + " g" }), el("b", { textContent: numero(x.kcal) + " kcal" }),
          el("button", { className: "quitar", textContent: "×", ariaLabel: "Borrar " + (x.a?.titulo ?? ""), onclick: () => escribir(db.from("registros").delete().eq("id", x.r.id)) })))) : "");
      return fila;
    }));
  };
}

// Los alimentos que más anotas, del más al menos.
function masAnotados() {
  const n = new Map();
  for (const r of datos.registros) if (r.clase === "comida" && datos.nodo.has(r.nodo_id)) n.set(r.nodo_id, (n.get(r.nodo_id) ?? 0) + 1);
  return [...n].sort((a, b) => b[1] - a[1]).map(([id]) => datos.nodo.get(id));
}
// Los gramos de siempre de un alimento: los de la última vez que lo anotaste, o su porción, o 100.
function gramosDeSiempre(a) {
  const r = datos.registros.findLast((x) => x.clase === "comida" && x.nodo_id === a.id);
  return Math.round(r ? gramos(r, a) : a.props?.porcion_g ?? 100);
}

// Paso 76: el + de una comida abre una ventana flotante con el buscador. Lo que agregas queda anotado y la ventana sigue
// abierta (abajo dice qué agregaste), para sumar varias cosas seguidas; se cierra con la ×, Esc o tocando fuera.
// Devuelve la ventana (la revisión de la noche, paso 97, mira cuándo se cierra).
export function agregarA(momento, alMomento, ctx) {
  ctx.texto = "";
  const listo = el("p", { className: "agregado", ariaLive: "polite" });
  const d = flotante("Agregar " + alMomento, buscador(momento, ctx, (nombre, g) => { listo.textContent = `✓ ${nombre} · ${numero(g)} g`; }), listo);
  d.querySelector(".buscar-alimento input").focus();
  return d;
}

// El buscador de una comida: escribes y salen tus alimentos (sin escribir, los que más anotas primero).
// Cada uno con sus gramos de siempre, que puedes cambiar, y su +. Lo que agregas queda en la comida y el buscador sigue abierto.
// Paso 72: desde 3 letras también busca en Open Food Facts (la función "alimentos" de Supabase); tocar el + de uno de esos
// lo guarda como alimento tuyo, con sus macros, y lo anota.
const RESULTADOS = 8;
function buscador(momento, ctx, alAgregar) {
  const tuyos = el("div", { className: "opciones" }), deAfuera = el("div", { className: "opciones de-afuera" });
  const campo = el("input", { type: "search", placeholder: "Buscar alimento", ariaLabel: "Buscar alimento", value: ctx.texto ?? "",
    oninput: () => { ctx.texto = campo.value; mostrar(); } }); // solo cambian las listas: el campo no pierde el foco
  const anotar = (a, g) => { anotarComida([{ a, g }], momento, diaDe(ctx)); ctx.abierta = momento; alAgregar?.(sinEstimacion(a.titulo), g); };
  let espera;
  const mostrar = () => {
    const texto = sinTildes(campo.value.trim()), alimentos = datos.nodos.filter((n) => n.tipos.clave === "alimento");
    const usados = masAnotados(), resto = alimentos.filter((a) => !usados.includes(a)).sort((a, b) => a.titulo.localeCompare(b.titulo, "es"));
    const lista = [...usados, ...resto].filter((a) => !texto || sinTildes(a.titulo).includes(texto)).slice(0, RESULTADOS);
    tuyos.replaceChildren(...lista.map((a) => filaParaAgregar(sinEstimacion(a.titulo), "", a.props ?? {}, gramosDeSiempre(a), (g) => anotar(a, g))));
    clearTimeout(espera);
    if (texto.length < 3) return deAfuera.replaceChildren(lista.length ? "" : el("p", { className: "vacio", textContent: "Escribe para buscar también fuera de tus alimentos." }));
    deAfuera.replaceChildren(el("small", { className: "titulo-afuera", textContent: "Buscando en Open Food Facts…" }));
    espera = setTimeout(() => buscarAfuera(campo.value.trim()).then((hallados) => {
      if (campo.value.trim() !== ctx.texto?.trim()) return; // ya escribiste otra cosa
      const nuevos = hallados.filter((x) => !alimentos.some((a) => a.props?.off === x.codigo));
      deAfuera.replaceChildren(el("small", { className: "titulo-afuera", textContent: nuevos.length ? "En Open Food Facts" : "Nada más en Open Food Facts." }),
        ...nuevos.map((x) => filaParaAgregar(x.nombre, x.marca ?? "", x, x.porcion_g ?? 100, (g) => guardarDeAfuera(x).then((a) => a && anotar(a, g)))));
    }, () => deAfuera.replaceChildren(el("small", { className: "titulo-afuera", textContent: "No se pudo buscar en Open Food Facts." }))), 400);
  };
  mostrar();
  return el("div", { className: "buscador-comida" }, el("div", { className: "buscar-alimento" }, icono("lupa"), campo), tuyos, deAfuera);
}
// Una fila del buscador: nombre, marca, kcal de esos gramos, los gramos y su +. macros = { kcal_100g, ... }.
function filaParaAgregar(nombre, marca, macros, gramosIniciales, alAgregar) {
  const kcalDeG = () => numero((Number(g.value) || 0) / 100 * (macros.kcal_100g ?? 0)) + " kcal";
  const g = el("input", { type: "number", min: "1", value: Math.round(gramosIniciales), ariaLabel: "Gramos de " + nombre, oninput: () => { kcal.textContent = kcalDeG(); } });
  const kcal = el("small", { textContent: kcalDeG() });
  return el("div", { className: "opcion-alimento" }, el("span", {}, el("span", { textContent: nombre }), marca ? el("small", { textContent: marca }) : "", kcal),
    g, el("small", { textContent: "g" }),
    el("button", { className: "principal", textContent: "+", ariaLabel: `Agregar ${nombre}`, onclick: (e) => { e.currentTarget.disabled = true; alAgregar(Math.max(1, Number(g.value) || 1)); } }));
}
// Buscar en Open Food Facts por la función "alimentos" (una vez por texto: lo ya buscado se recuerda).
const buscados = new Map();
function buscarAfuera(q) {
  if (!buscados.has(q)) buscados.set(q, Promise.resolve().then(() => db.functions.invoke("alimentos", { body: { q } })).then(({ data, error }) => {
    if (error || !Array.isArray(data)) { buscados.delete(q); throw error ?? new Error("respuesta rara"); }
    return data;
  }));
  return buscados.get(q);
}
// Guardar un alimento de Open Food Facts como tuyo, en la misma área que tus otros alimentos. Devuelve el nodo.
async function guardarDeAfuera(x) {
  const otro = datos.nodos.find((n) => n.tipos.clave === "alimento"), area = otro ? areaDe(otro.id) : areaDeSalud();
  const props = { kcal_100g: x.kcal_100g, prot_100g: x.prot_100g, carb_100g: x.carb_100g, grasa_100g: x.grasa_100g, off: x.codigo, ...(x.porcion_g ? { porcion_g: x.porcion_g } : {}) };
  const id = await crear("alimento", { titulo: x.marca ? `${x.nombre} (${x.marca})` : x.nombre, props }, { enfocar: false, conexion: area && dentroDeCaja("alimento", area) });
  return id && datos.nodo.get(id);
}

export function semanaComida(v, ctx) {
  v.classList.add("w-salud");
  return () => {
    cargarMetas(() => ctx.cambiar({}));
    const hasta = diaDe(ctx), m = metas(), dias = Array.from({ length: 7 }, (_, i) => sumarDias(hasta, i - 6));
    const kcal = dias.map((d) => comidaDe(d).kcal), tope = Math.max(m.kcal * 1.4, ...kcal);
    const anotados = kcal.filter((k) => k > 0);
    v.sub.textContent = anotados.length ? `promedio ${numero(anotados.reduce((s, k) => s + k, 0) / anotados.length)} kcal` : "";
    const meta = el("i", { className: "linea-meta" });
    meta.style.bottom = m.kcal / tope * 100 + "%";
    v.replaceChildren(v.firstChild,
      el("div", { className: "barras-semana" }, meta, ...dias.map((d, i) => {
        const b = el("button", { className: "dia-barra" + (d === hasta ? " elegido" : ""), title: `${nombreDelDia(d)}: ${numero(kcal[i])} kcal`, onclick: () => ctx.cambiar({ dia: d === hoyTexto() ? null : d }) },
          el("small", { textContent: kcal[i] ? numero(kcal[i] / 1000, 1) + "k" : "—" }), el("i"),
          el("span", { textContent: new Date(d + "T12:00").toLocaleDateString("es-CL", { weekday: "narrow" }) + " " + Number(d.slice(8)) }));
        b.querySelector("i").style.height = Math.max(2, kcal[i] / tope * 100) + "%";
        return b;
      })));
  };
}

// ---------- las tarjetas de los bloques (paso 70) ----------
// Lo que dice cada tarjeta del selector: un dato de hoy, un detalle y el avance para su anillo.
export function resumenEjercicio() {
  const hoy = hoyTexto(), mes = hoy.slice(0, 8) + "01", hechos = [...diasMarcados(entrenos())].filter((d) => d >= mes && d <= hoy).length;
  let tocaban = 0;
  for (let d = mes; d <= hoy; d = sumarDias(d, 1)) if (tocaEntrenar(d)) tocaban++;
  const prox = proximoEntreno(), en = prox && diasEntre(hoy, prox), hora = horaDe(entrenos()[0]);
  return { dato: !prox ? "Sin días de entreno" : (en === 0 ? "Entrenas hoy" : en === 1 ? "Entrenas mañana" : "Próximo: " + diaCorto(prox)) + (prox && hora ? " · " + hora : ""),
    detalle: `${hechos} de ${tocaban} entrenos este mes`, avance: tocaban ? hechos / tocaban : 0, cifra: `${hechos}/${tocaban}` };
}
export function resumenHabitos() {
  const hoy = hoyTexto(), deHoy = habitos().filter((h) => tocaEl(h, hoy));
  const hechos = deHoy.filter((h) => marcasDe(h).some((r) => dia(r.fecha) === hoy)).length;
  return { dato: deHoy.length ? `${hechos} de ${deHoy.length} hechos` : "Nada para hoy", detalle: hechos === deHoy.length && hechos ? "¡todo listo hoy!" : "los hábitos de hoy",
    avance: deHoy.length ? hechos / deHoy.length : 0, cifra: `${hechos}/${deHoy.length}`, faltan: deHoy.length - hechos };
}
export function resumenDieta() {
  const t = comidaDe(hoyTexto()), m = metas();
  return { dato: `${numero(t.kcal)} kcal`, detalle: `de ${numero(m.kcal)} · ${numero(t.proteina)} g de proteína`, avance: t.kcal / (m.kcal || 1),
    cifra: numero(t.kcal), quedan: Math.round(m.kcal - t.kcal), meta: m.kcal };
}
// Los tres bloques del apartado (apartados.js) con su ícono, color y resumen. Los usa también el resumen del escritorio.
export const BLOQUES = {
  ejercicio: { bloque: "Ejercicio", icono: "pesa", color: "#2563eb", resumen: resumenEjercicio },
  habitos: { bloque: "Hábitos", icono: "si", color: "#7c3aed", resumen: resumenHabitos },
  dieta: { bloque: "Dieta", icono: "plato", color: "#2f7a4c", resumen: resumenDieta },
};

// ---------- el resumen de Salud en el escritorio infinito (pasos 73, 78 y 81) ----------
// Lo clave de cada bloque, con su color, para ver cómo vas sin entrar a Salud. Se arman en dos vistas (apartados.js):
// dieta-hoy       el anillo de calorías de hoy contra tu meta, cuánto llevas de cada nutriente y cada comida
// macros-hoy      solo los nutrientes (la vista Anillos ya muestra las calorías arriba)
// entreno-hoy     qué toca hoy (o cuándo es el próximo), la semana en puntos y tu racha
// habitos-rapidos los hábitos de hoy en una lista: tocar marca o desmarca
// medidor-peso    tu peso de ahora en grande y una barra del peso de inicio a la meta; abajo, para anotar el de hoy
// anillos-salud   cuatro anillos (dieta, hábitos, ejercicio y peso) para ver todo de un vistazo
const conColor = (v, b) => { v.classList.add("w-salud", "con-color-bloque"); v.style.setProperty("--color-bloque", b.color); };
const quedanTexto = (q) => (q >= 0 ? el("span", {}, "Te quedan ", el("b", { textContent: numero(q) + " kcal" })) : el("span", {}, "Te pasaste por ", el("b", { textContent: numero(-q) + " kcal" })));
// Un anillo: lo recorrido de frac (0 a 1) y, al centro, una cifra grande con lo que es debajo.
const anillo = (frac, grande, chico) => el("div", { className: "anillo-kcal" },
  svgDe("0 0 120 120", `<circle cx="60" cy="60" r="50" pathLength="100" class="pista"/>${frac > 0 ? `<circle cx="60" cy="60" r="50" pathLength="100" class="lleno" stroke-dasharray="${Math.min(1, frac) * 100} 100"/>` : ""}`),
  el("b", { textContent: grande }), el("small", { textContent: chico }));
// Cuánto llevas de cada nutriente contra su meta, en barras.
const macros = (t, m) => el("div", { className: "macros-hoy" }, ...[["proteina", "Proteína"], ["carbos", "Carbohidratos"], ["grasa", "Grasa"]].map(([k, nombre]) =>
  el("div", { className: "macro-hoy" }, el("span", {}, el("span", { textContent: nombre }), el("b", { textContent: numero(t[k]) }), el("small", { textContent: " / " + numero(m[k]) + " g" })),
    barra(t[k] / (m[k] || 1), "var(--bloque)"))));

export function dietaHoy(v, ctx) {
  conColor(v, BLOQUES.dieta);
  return () => {
    cargarMetas(() => ctx.cambiar({})); // la meta de calorías llega una vez, de la base
    const hoy = hoyTexto(), t = comidaDe(hoy), m = metas(), lista = comidasDe(hoy);
    const porMomento = MOMENTOS.map(([momento]) => [momento, lista.filter((x) => x.momento === momento)]);
    const anotadas = porMomento.filter(([, xs]) => xs.length).length;
    v.sub.textContent = `${anotadas} de ${MOMENTOS.length} comidas`;
    v.replaceChildren(v.firstChild,
      el("div", { className: "resumen-dieta" }, anillo(t.kcal / (m.kcal || 1), numero(t.kcal), "de " + numero(m.kcal) + " kcal"), macros(t, m)),
      el("div", { className: "momentos-hoy" }, ...porMomento.map(([momento, xs]) => el("span", { className: "momento-hoy" + (xs.length ? " lleno" : "") },
        el("small", { textContent: momento }), el("b", { textContent: xs.length ? numero(sumar(xs).kcal) + " kcal" : "—" })))),
      el("p", { className: "pie-resumen" }, quedanTexto(Math.round(m.kcal - t.kcal))));
  };
}
export function macrosHoy(v, ctx) {
  conColor(v, BLOQUES.dieta);
  return () => {
    cargarMetas(() => ctx.cambiar({}));
    v.replaceChildren(v.firstChild, macros(comidaDe(hoyTexto()), metas()));
  };
}

export function entrenoHoy(v) {
  conColor(v, BLOQUES.ejercicio);
  return () => {
    const hoy = hoyTexto(), h = entrenos()[0];
    if (!h) return v.replaceChildren(v.firstChild, el("p", { className: "vacio", textContent: "Crea un hábito «Entrenar» con sus Días para ver aquí tu semana." }));
    const hecho = entrenoDel(hoy), prox = proximoEntreno(), hora = horaDe(h), r = rachaDeEntrenos();
    const rutinaDel = (d) => rutinasDeEntreno().find((x) => x.props?.dias && tocaEl(x, d));
    const [titulo, detalle] = hecho ? ["Entrenaste hoy", "bien ahí"]
      : tocaEntrenar(hoy) ? ["Hoy toca entrenar", [rutinaDel(hoy)?.titulo, hora].filter(Boolean).join(" · ")]
      : ["Hoy descansas", prox ? "próximo: " + [diaCorto(prox), rutinaDel(prox)?.titulo, hora].filter(Boolean).join(" · ") : ""];
    v.sub.textContent = r.actual ? "racha de " + plural(r.actual, "entreno", "entrenos") : resumenEjercicio().detalle.replace(" entrenos", "");
    v.replaceChildren(v.firstChild,
      el("div", { className: "hoy-entreno" + (hecho ? " hecho" : "") }, el("b", { textContent: titulo }), el("small", { textContent: detalle })),
      el("div", { className: "puntos-semana" }, ...Array.from({ length: 7 }, (_, i) => sumarDias(lunes(hoy), i)).map((d) => {
        const estado = entrenoDel(d) ? "hecho" : !tocaEntrenar(d) ? "libre" : d < hoy ? "falto" : "toca";
        return el("span", { className: `punto-dia ${estado}${d === hoy ? " es-hoy" : ""}`, title: `${diaCorto(d)}: ${{ hecho: "entrenaste", libre: "descanso", falto: "no fuiste", toca: "toca" }[estado]}` },
          el("i"), el("small", { textContent: new Date(d + "T12:00").toLocaleDateString("es-CL", { weekday: "narrow" }) }));
      })));
  };
}
export function habitosRapidos(v) {
  conColor(v, BLOQUES.habitos);
  return () => {
    const hoy = hoyTexto(), lista = habitos().filter((h) => tocaEl(h, hoy));
    const marcaDe = (h) => marcasDe(h).find((r) => dia(r.fecha) === hoy);
    const hechos = lista.filter(marcaDe).length;
    v.sub.textContent = lista.length ? `${hechos} de ${lista.length}` : "";
    v.replaceChildren(v.firstChild, lista.length ? barra(hechos / lista.length, "var(--bloque)") : "", lista.length ? el("div", { className: "habitos-rapidos" }, ...lista.map((h) => {
      const marca = marcaDe(h);
      return el("button", { className: "habito-rapido" + (marca ? " hecho" : ""), ariaPressed: String(!!marca), onclick: () => alternarRegistro("habito", h, marca) },
        el("span", { className: "check" }, marca ? icono("si") : ""), el("span", { textContent: h.titulo }));
    })) : el("p", { className: "vacio", textContent: "Hoy no te toca ningún hábito." }));
  };
}
// Dónde vas en tu objetivo de peso: de dónde partiste, la meta, lo de ahora y qué parte del camino llevas (0 a 1).
function avancePeso(o) {
  const ahora = pesoActual(o), { inicio = ahora.v, meta } = o.props;
  return { ahora, inicio, meta, frac: Math.max(0, Math.min(1, (ahora.v - inicio) / ((meta - inicio) || 1))) };
}
export function medidorPeso(v) {
  conColor(v, BLOQUES.ejercicio); // el peso vive en el bloque Ejercicio
  return () => {
    const o = objetivoDePeso();
    if (!o) return v.replaceChildren(v.firstChild, el("p", { className: "vacio", textContent: "Crea un objetivo con unidad «kg» para ver tu peso aquí." }));
    const { ahora, inicio, meta, frac } = avancePeso(o), cambio = ahora.v - inicio;
    v.sub.textContent = o.titulo;
    const pista = el("div", { className: "pista-peso" }, el("i"), el("b"));
    pista.style.setProperty("--avance", frac * 100 + "%");
    v.replaceChildren(v.firstChild,
      el("div", { className: "peso-ahora" }, el("b", { textContent: numero(ahora.v, 1) }), el("span", { textContent: "kg" }),
        cambio ? el("small", { textContent: (cambio > 0 ? "+" : "−") + numero(Math.abs(cambio), 1) + " kg desde el inicio" }) : ""),
      el("div", { className: "medidor" }, pista, el("span", { className: "extremos" }, el("small", { textContent: numero(inicio, 1) + " kg" }),
        el("small", { textContent: Math.round(frac * 100) + "% del camino" }), el("small", { textContent: numero(meta, 1) + " kg" }))),
      anotarPeso(o, ahora));
  };
}
export function anillosSalud(v) {
  v.classList.add("w-salud");
  return () => {
    const d = resumenDieta(), h = resumenHabitos(), e = resumenEjercicio(), o = objetivoDePeso(), p = o && avancePeso(o);
    const uno = (b, nombre, frac, grande, chico, frase) => {
      const x = el("div", { className: "anillo-salud con-color-bloque" }, anillo(frac, grande, chico), el("b", { textContent: nombre }), el("small", { textContent: frase }));
      x.style.setProperty("--color-bloque", b.color);
      return x;
    };
    v.replaceChildren(el("div", { className: "anillos-salud" },
      uno(BLOQUES.dieta, "Dieta", d.avance, d.cifra, "kcal", d.quedan >= 0 ? `Te quedan ${numero(d.quedan)} de ${numero(d.meta)}` : `Te pasaste por ${numero(-d.quedan)}`),
      uno(BLOQUES.habitos, "Hábitos", h.avance, h.cifra, "hechos", h.faltan > 0 ? `Te ${h.faltan === 1 ? "falta" : "faltan"} ${h.faltan} hoy` : h.dato),
      uno(BLOQUES.ejercicio, "Ejercicio", e.avance, e.cifra, "este mes", e.dato),
      p ? uno(BLOQUES.ejercicio, "Peso", p.frac, numero(p.ahora.v, 1), "kg", `${Math.round(p.frac * 100)}% hacia ${numero(p.meta, 1)} kg`) : ""));
  };
}
