// El apartado Salud (paso 63): tu peso, lo que comiste hoy, tus hábitos y tu despensa, con gráficos.
// Va en la barra lateral, a pantalla completa. Paso 65: tres vistas separadas, Ejercicio, Hábitos y Dieta (apartados.js).
// Sus widgets (widgets.js):
//   cifras-ejercicio, cifras-habitos, cifras-dieta   cuatro números con su ícono, en la barra del apartado
//   semana-entreno    los 7 días de esta semana: cuáles tocaba entrenar y si fuiste; un botón marca el de hoy
//   constancia-entreno 13 semanas de entrenos: lo que hiciste, lo que tocaba y lo que no
//   peso         el camino a tu meta de peso: tu línea, lo que pide la fecha y el ritmo sano
//   anillos      cuatro anillos de hoy: calorías, proteína, carbohidratos y grasa contra tu meta diaria
//   habitos-hoy  los hábitos que tocan hoy, en una lista por rutina con un anillo de cuántos llevas: tocar marca o desmarca
//   cada-habito  una fila por hábito con una raya por día (30 o 90), su porcentaje y su mejor racha
//   por-dia      qué días de la semana cumples más tus hábitos
//   despensa     los alimentos que se acabaron o quedan pocos: tocar sube su nivel
// La vista Diario (paso 64) mira un día (ctx.dia; sin nada, hoy):
//   dia-comida   el día: ‹ › para cambiarlo, sus calorías con una barra por macro y tres anillos (proteína, carbos, grasa)
//   comidas      una tarjeta por momento (desayuno, almuerzo, merienda, cena): lo que comiste, con sus kcal; × lo borra
//   plato        de dónde vienen las calorías del día (una dona por macro) y qué fue lo que más aportó
//   anotar       agregar un alimento con sus gramos y su momento, o repetir de un toque lo que más comes
//   semana-comida las calorías de los 7 días hasta el que miras, contra tu meta
//
// De dónde sale cada cosa:
//   peso      el objetivo con unidad "kg" (ej. «Subir 10 kilos»): sus registros "medida" o, si no hay, su "Va en"
//   comida    los registros "comida" de hoy; cada uno apunta a un alimento, que sabe sus kcal y macros por 100 g
//   metas     las que guardes (tabla preferencias, clave "salud"); sin eso, unas sugeridas según tu peso
// Cada hábito cae en una vista: los de entrenar en Ejercicio, el de registrar calorías en Dieta (se cumple solo
// al anotar comida) y el resto en Hábitos.
import { el, db, datos, dia, escribir } from "./base.js";
import { hoyTexto, sumarDias, diasEntre, lunes, sinHoraISO } from "./fechas.js";
import { alternarRegistro, cambiarProps } from "./acciones.js";
import { icono, elegir } from "./dibujos.js";

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
const objetivoDePeso = () => datos.nodos.find((n) => n.tipos.clave === "objetivo" && n.estado !== "Hecho" && n.props?.unidad === "kg" && typeof n.props?.meta === "number");
const pesadas = (o) => datos.registros.filter((r) => r.clase === "medida" && r.nodo_id === o.id).map((r) => ({ d: dia(r.fecha), v: Number(r.valor) }));
function pesoActual(o) {
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
// Días seguidos con algún hábito de la lista cumplido, contando hacia atrás desde hoy (o desde ayer, si hoy aún no marcas nada).
function rachas(lista = habitos()) {
  const dias = diasMarcados(lista);
  let d = dias.has(hoyTexto()) ? hoyTexto() : sumarDias(hoyTexto(), -1), actual = 0;
  while (dias.has(d)) { actual++; d = sumarDias(d, -1); }
  let mejor = 0, corrida = 0, previo = null;
  for (const x of [...dias].sort()) { corrida = previo && diasEntre(previo, x) === 1 ? corrida + 1 : 1; mejor = Math.max(mejor, corrida); previo = x; }
  return { actual, mejor };
}

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
// Una vista de Salud lleva arriba, a todo el ancho, cuatro cifras con su ícono.
// barraDeCifras(tarjetas) arma ese widget: tarjetas() devuelve las cuatro como [ícono, color, título, valor, unidad, pie].
function tarjeta(nombre, color, titulo, valor, unidad, pie) {
  const t = el("div", { className: "cifra-salud vidrio" }, el("span", { className: "insignia" }, icono(nombre)),
    el("div", {}, el("small", { textContent: titulo }), el("b", {}, String(valor), el("i", { textContent: " " + unidad })), el("small", { textContent: pie })));
  t.style.setProperty("--c", color);
  return t;
}
const barraDeCifras = (tarjetas) => (v, ctx) => {
  v.hidden = true; // esta ventana no se ve: pone sus cifras en la barra del apartado
  return () => {
    cargarMetas(() => ctx.cambiar({}));
    ctx.barra.replaceChildren(el("div", { className: "cifras-salud" }, ...tarjetas().map((t) => tarjeta(...t))));
  };
};
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
function cifraDePeso() {
  const o = objetivoDePeso();
  return o ? ["balanza", COLOR.kcal, "Peso", numero(pesoActual(o).v, 1), "kg", `faltan ${numero(Math.abs(o.props.meta - pesoActual(o).v), 1)} para ${numero(o.props.meta, 1)}`]
    : ["balanza", COLOR.kcal, "Peso", "—", "", "crea un objetivo con unidad kg"];
}

export const cifrasEjercicio = barraDeCifras(() => {
  const hoy = hoyTexto(), mes = hoy.slice(0, 8) + "01", hechos = [...diasMarcados(entrenos())].filter((d) => d >= mes && d <= hoy).length;
  let tocaban = 0;
  for (let d = mes; d <= hoy; d = sumarDias(d, 1)) if (tocaEntrenar(d)) tocaban++;
  const r = rachaDeEntrenos(), prox = proximoEntreno(), en = prox && diasEntre(hoy, prox);
  const nombreMes = new Date(hoy + "T12:00").toLocaleDateString("es-CL", { month: "long" });
  return [cifraDePeso(),
    ["pesa", "#1d4ed8", "Entrenos en " + nombreMes, String(hechos), `de ${tocaban}`, tocaban ? "los que tocaban hasta hoy" : "aún no tocaba ninguno"],
    ["fuego", COLOR.proteina, "Racha de entrenos", String(r.actual), r.actual === 1 ? "seguido" : "seguidos", `la mejor: ${r.mejor}`],
    prox ? ["reloj", COLOR.carbos, "Próximo entreno", en === 0 ? "hoy" : en === 1 ? "mañana" : diaCorto(prox), horaDe(entrenos()[0]), en > 1 ? `en ${en} días` : entrenos()[0].props?.dias ?? ""]
      : ["reloj", COLOR.carbos, "Próximo entreno", "—", "", "pon los días en tu hábito «Entrenar»"]];
});

export const cifrasHabitos = barraDeCifras(() => {
  const hoy = hoyTexto(), lista = habitos(), deHoy = lista.filter((h) => tocaEl(h, hoy)), marcados = diasMarcados(lista);
  const hechos = deHoy.filter((h) => marcasDe(h).some((r) => dia(r.fecha) === hoy)).length, r = rachas(lista);
  const mes = cumplido(lista, sumarDias(hoy, -29), hoy), antes = cumplido(lista, sumarDias(hoy, -89), hoy);
  const mejor = lista.map((h) => [h, cumplido([h], sumarDias(hoy, -89), hoy)]).sort((a, b) => b[1] - a[1])[0];
  return [["si", "#7c3aed", "Hoy", String(hechos), `de ${deHoy.length}`, hechos === deHoy.length && hechos ? "¡todo listo!" : "los que tocan hoy"],
    ["fuego", COLOR.proteina, "Racha", String(r.actual), r.actual === 1 ? "día" : "días", `la mejor: ${plural(r.mejor, "día", "días")}`],
    ["calendario", COLOR.carbos, "Cumplido en 30 días", Math.round(mes * 100) + "%", "", `en 90 días: ${Math.round(antes * 100)}%`],
    mejor && mejor[1] ? [temaDe(mejor[0])[0], temaDe(mejor[0])[1], "El más constante", mejor[0].titulo, "", `${Math.round(mejor[1] * 100)}% en 90 días`]
      : ["estrella", COLOR.grasa, "El más constante", "—", "", marcados.size ? "" : "marca tus hábitos y aparecerá"]];
});

export const cifrasDieta = barraDeCifras(() => {
  const hoy = hoyTexto(), t = comidaDe(hoy), m = metas();
  const semana = Array.from({ length: 7 }, (_, i) => comidaDe(sumarDias(hoy, -i)).kcal).filter((k) => k > 0);
  const faltan = datos.nodos.filter((n) => n.tipos.clave === "alimento" && ["Agotado", "Bajo"].includes(n.props?.despensa));
  const agotados = faltan.filter((n) => n.props.despensa === "Agotado").length;
  return [["fuego", COLOR.kcal, "Calorías hoy", numero(t.kcal), `/ ${numero(m.kcal)}`, t.cuantas ? plural(t.cuantas, "cosa anotada", "cosas anotadas") : "nada anotado aún"],
    ["carne", COLOR.proteina, "Proteína hoy", numero(t.proteina), `/ ${m.proteina} g`, "sano: 1,6 a 2,2 g por kilo"],
    ["plato", COLOR.carbos, "Promedio de 7 días", semana.length ? numero(semana.reduce((a, b) => a + b, 0) / semana.length) : "—", "kcal", plural(semana.length, "día anotado", "días anotados")],
    ["caja", COLOR.grasa, "Por comprar", String(faltan.length), "", faltan.length ? `${agotados} agotados · ${faltan.length - agotados} bajos` : "tienes de todo"]];
});

export function peso(v) {
  v.classList.add("w-salud");
  return () => {
    const o = objetivoDePeso();
    if (!o) return v.replaceChildren(el("p", { className: "vacio", textContent: "Crea un objetivo con Meta y unidad «kg» (ej. «Subir 10 kilos») y aquí verás tu camino." }));
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
      el("h3", {}, "Camino a ", String(numero(meta, 1) + " kg"), el("small", { textContent: `${o.titulo}${tope ? " · tope " + new Date(tope + "T12:00").toLocaleDateString("es-CL", { day: "numeric", month: "short" }) : ""}` })),
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
        el("span", { textContent: `La fecha pide ${numero(Math.abs(r.pide), 1)} kg por semana. Lo sano es ${numero(SANO[0], 2)} a ${numero(SANO[1], 1)}: llegarías entre el ${largo(r.sano[1])} y el ${largo(r.sano[0])}. Puedes mover la fecha tope del objetivo.` })) : "",
      anotarPeso(o, ahora),
    );
  };
}
const largo = (d) => new Date(d + "T12:00").toLocaleDateString("es-CL", { day: "numeric", month: "long", year: d.slice(0, 4) === hoyTexto().slice(0, 4) ? undefined : "numeric" });
// Anotar el peso de hoy: un campo y un botón. Una pesada por semana basta.
function anotarPeso(o, ahora) {
  const campo = el("input", { type: "number", step: "0.1", min: "20", max: "300", placeholder: numero(ahora.v, 1), ariaLabel: "Tu peso de hoy en kg" });
  const hace = ahora.d ? diasEntre(ahora.d, hoyTexto()) : null;
  return el("form", { className: "anotar-peso", onsubmit: (e) => {
    e.preventDefault();
    const valor = Number(campo.value.replace(",", "."));
    if (valor > 0) escribir(db.from("registros").insert({ clase: "medida", nodo_id: o.id, valor, unidad: "kg", titulo: "Peso" }));
  } }, el("span", { className: "vacio", textContent: hace === null ? "Aún no te pesas." : hace === 0 ? "Te pesaste hoy." : `Tu última pesada fue hace ${hace} días.` }),
  campo, el("span", { textContent: "kg" }), el("button", { className: "principal", textContent: "Anotar peso" }));
}

export function anillos(v, ctx) {
  v.classList.add("w-salud");
  let editando = false;
  return () => {
    cargarMetas(() => ctx.cambiar({}));
    const hoy = comidaDe(hoyTexto()), m = metas();
    const filas = [["kcal", "Calorías", ""], ["proteina", "Proteína", " g"], ["carbos", "Carbohidratos", " g"], ["grasa", "Grasa", " g"]];
    const aros = filas.map(([k], i) => {
      const r = 88 - i * 18, frac = Math.min(1, hoy[k] / (m[k] || 1));
      return `<circle cx="100" cy="100" r="${r}" pathLength="100" class="pista" style="stroke:${COLOR[k]}"/>` +
        (frac > 0 ? `<circle cx="100" cy="100" r="${r}" pathLength="100" class="lleno" style="stroke:${COLOR[k]}" stroke-dasharray="${frac * 100} 100"/>` : "");
    }).join("");
    v.sub.textContent = m.sugeridas ? "metas sugeridas" : "";
    const lista = el("div", { className: "lista-anillos" }, ...filas.map(([k, nombre, u]) => {
      const f = el("div", {}, el("i"), el("span", { textContent: nombre }), el("b", {}, String(numero(hoy[k])), " / ",
        editando ? el("input", { type: "number", value: m[k], name: k, ariaLabel: "Meta de " + nombre.toLowerCase() }) : String(numero(m[k]) + u)));
      f.style.setProperty("--c", COLOR[k]);
      return f;
    }));
    const boton = el("button", { textContent: editando ? "Guardar metas" : "Cambiar metas", className: editando ? "principal" : "" });
    boton.onclick = () => {
      if (editando) guardarMetas(Object.fromEntries([...lista.querySelectorAll("input")].map((i) => [i.name, Number(i.value) || 0])));
      editando = !editando;
      ctx.cambiar({});
    };
    v.replaceChildren(v.firstChild, el("div", { className: "anillos-salud" }, svgDe("0 0 200 200", aros, "aros"), lista), boton);
  };
}

// Paso 66: los hábitos de hoy en una lista, agrupados por su rutina (la caja donde están), con un anillo de cuántos llevas.
export function habitosHoy(v) {
  v.classList.add("w-salud");
  return () => {
    const hoy = hoyTexto(), lista = habitos().filter((h) => tocaEl(h, hoy));
    if (!lista.length) return v.replaceChildren(v.firstChild, el("p", { className: "vacio", textContent: "Hoy no te toca ningún hábito." }));
    const deHoy = (h) => marcasDe(h).find((r) => dia(r.fecha) === hoy), hechos = lista.filter(deHoy).length;
    v.sub.textContent = "toca para marcar";
    // Los grupos: una rutina por caja (ej. «Mañana»); los que no están en una rutina van al final.
    const rutinaDe = (h) => { const p = datos.nodo.get(datos.padre.get(h.id)); return p?.tipos.clave === "rutina" ? p : null; };
    const grupos = new Map();
    for (const h of lista) { const r = rutinaDe(h), k = r?.id ?? ""; if (!grupos.has(k)) grupos.set(k, { r, hs: [] }); grupos.get(k).hs.push(h); }
    const orden = [...grupos.values()].sort((a, b) => !a.r - !b.r);
    const fila = (h) => {
      const marca = deHoy(h), [nombre, color] = temaDe(h);
      const b = el("button", { className: "fila-habito" + (marca ? " hecho" : ""), ariaPressed: String(!!marca), onclick: () => alternarRegistro("habito", h, marca) },
        el("span", { className: "insignia" }, icono(nombre)), el("span", { textContent: h.titulo }), el("span", { className: "check" }, marca ? icono("si") : ""));
      b.style.setProperty("--c", color);
      return b;
    };
    v.replaceChildren(v.firstChild,
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
    if (!lista.length) return v.replaceChildren(v.firstChild, el("p", { className: "vacio", textContent: "Aún no tienes hábitos. Créalos con «+ Nuevo»." }));
    const ultimo = [...diasMarcados(lista)].sort().at(-1), sin = ultimo ? diasEntre(ultimo, hoy) : null;
    v.replaceChildren(v.firstChild,
      el("div", { className: "filas-habitos" }, ...lista.map((h) => [h, cumplido([h], desde, hoy)]).sort((a, b) => b[1] - a[1]).map(([h, frac]) => {
        const hechos = diasMarcados([h]), [nombre, color] = temaDe(h), rayas = [];
        for (let d = desde; d <= hoy; d = sumarDias(d, 1))
          rayas.push(el("i", { className: hechos.has(d) ? "si" : tocaEl(h, d) ? "" : "libre", title: `${d.split("-").reverse().join("/")}: ${hechos.has(d) ? "cumplido" : tocaEl(h, d) ? "no" : "no tocaba"}` }));
        const f = el("div", { className: "tira-habito" }, el("span", { className: "insignia" }, icono(nombre)), el("span", { className: "nombre", textContent: h.titulo }),
          el("span", { className: "rayas" }, ...rayas), el("b", {}, String(Math.round(frac * 100) + "%")), el("small", { textContent: "mejor racha " + mejorRacha(h, desde, hoy) }));
        f.style.setProperty("--c", color);
        return f;
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
const dato = (nombre, color, grande, chico) => { const d = el("div", { className: "dato-salud" }, icono(nombre), el("span", {}, el("b", { textContent: grande }), el("br"), chico)); d.style.setProperty("--c", color); return d; };

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
          dato("fuego", COLOR.proteina, plural(r.mejor, "entreno", "entrenos"), "tu mejor racha"),
          sin !== null && sin > 3 ? dato("reloj", "#8a5a00", `${sin} días`, "sin entrenar") : dato("si", COLOR.kcal, plural(r.actual, "entreno", "entrenos"), "racha actual"))));
  };
}

const NIVELES = ["Agotado", "Bajo", "Suficiente"];
const MACRO = { "Proteína": ["carne", COLOR.proteina], "Carbohidrato": ["grano", COLOR.carbos], "Grasa": ["gota", COLOR.grasa] };
export function despensa(v) {
  v.classList.add("w-salud");
  return () => {
    const faltan = datos.nodos.filter((n) => n.tipos.clave === "alimento" && ["Agotado", "Bajo"].includes(n.props?.despensa))
      .sort((a, b) => NIVELES.indexOf(a.props.despensa) - NIVELES.indexOf(b.props.despensa) || a.titulo.localeCompare(b.titulo, "es"));
    const agotados = faltan.filter((n) => n.props.despensa === "Agotado").length;
    v.sub.textContent = faltan.length ? `${agotados} agotados · ${faltan.length - agotados} bajos` : "";
    if (!faltan.length) return v.replaceChildren(v.firstChild, el("p", { className: "vacio", textContent: "Tienes de todo. Bien ahí." }));
    v.replaceChildren(v.firstChild, el("div", { className: "despensa-salud" }, ...faltan.map((a) => {
      const [nombre, color] = MACRO[a.props.macro] ?? ["plato", "#64748b"], nivel = a.props.despensa;
      const b = el("button", { className: "alimento-salud " + nivel.toLowerCase(), title: `${nivel}${a.props.cantidad_compra ? " · comprar " + a.props.cantidad_compra : ""}. Toca cuando compres.`,
        onclick: () => cambiarProps(a, { despensa: NIVELES[NIVELES.indexOf(nivel) + 1] }) },
        el("span", { className: "insignia" }, icono(nombre)),
        el("span", {}, el("span", { textContent: a.titulo }), el("span", { className: "nivel" }, el("i"))),
        a.props.cantidad_compra ? el("small", { textContent: a.props.cantidad_compra }) : "");
      b.style.setProperty("--c", color);
      return b;
    })), el("p", { className: "vacio", textContent: "Tocar uno sube su nivel (Agotado → Bajo → Suficiente)." }));
  };
}

// ---------- el Diario (paso 64) ----------
const MOMENTOS = [["Desayuno", "taza", "#c2410c"], ["Almuerzo", "plato", "#2f7a4c"], ["Merienda", "manzana", "#be185d"], ["Cena", "luna", "#4338ca"]];
const diaDe = (ctx) => ctx.dia ?? hoyTexto();
// El momento que toca ahora, para dejarlo elegido al anotar: hasta las 11 desayuno, hasta las 16 almuerzo, hasta las 19 merienda.
const momentoDeAhora = () => { const h = new Date().getHours(); return h < 11 ? "Desayuno" : h < 16 ? "Almuerzo" : h < 19 ? "Merienda" : "Cena"; };
const nombreDelDia = (d) => {
  const f = diasEntre(hoyTexto(), d), largo = new Date(d + "T12:00").toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "short" });
  return f === 0 ? "Hoy, " + largo : f === -1 ? "Ayer, " + largo : largo;
};
// Una barra con un tramo por macro, del largo de las calorías que aporta cada uno (proteína y carbos 4 kcal/g, grasa 9).
function barraDeMacros(t, total = t.proteina * 4 + t.carbos * 4 + t.grasa * 9) {
  const b = el("span", { className: "barra-macros" }, ...["proteina", "carbos", "grasa"].map((k) => {
    const i = el("i");
    i.style.width = (total ? (t[k] * (k === "grasa" ? 9 : 4)) / total * 100 : 0) + "%";
    i.style.background = COLOR[k];
    return i;
  }));
  return b;
}
// Anotar cosas comidas ([{ a, g }]) en un momento del día d: hoy con la hora de ahora; otro día, sin hora.
// Paso 65: anotar comida cumple ese día el hábito de Dieta (ej. «Registrar calorías»), si lo tienes y aún no está marcado.
function anotarComida(cosas, momento, d) {
  const fecha = d === hoyTexto() ? {} : { fecha: sinHoraISO(d) }, h = habitos("dieta")[0];
  const marcar = h && !marcasDe(h).some((r) => dia(r.fecha) === d) ? [{ clase: "habito", nodo_id: h.id, ...fecha }] : [];
  return escribir(db.from("registros").insert([...cosas.map(({ a, g }) => ({ clase: "comida", nodo_id: a.id, valor: g, unidad: "g",
    titulo: a.titulo, props: { comida: momento }, ...fecha })), ...marcar]));
}

export function diaComida(v, ctx) {
  v.classList.add("w-salud");
  return () => {
    cargarMetas(() => ctx.cambiar({}));
    const d = diaDe(ctx), t = comidaDe(d), m = metas();
    const mover = (n) => el("button", { className: "mover-dia", textContent: n < 0 ? "‹" : "›", ariaLabel: n < 0 ? "Día anterior" : "Día siguiente",
      disabled: n > 0 && d >= hoyTexto(), onclick: () => ctx.cambiar({ dia: sumarDias(d, n) }) });
    const falta = m.kcal - t.kcal;
    const mini = (k, nombre) => {
      const frac = Math.min(1, t[k] / (m[k] || 1));
      const x = el("div", { className: "mini-anillo" }, svgDe("0 0 60 60", `<circle cx="30" cy="30" r="25" pathLength="100" class="pista"/>${frac ? `<circle cx="30" cy="30" r="25" pathLength="100" class="lleno" stroke-dasharray="${frac * 100} 100"/>` : ""}`),
        el("div", {}, el("small", { textContent: nombre }), el("b", {}, String(numero(t[k]) + " g")), el("small", { textContent: `meta ${numero(m[k])} g` })));
      x.style.setProperty("--c", COLOR[k]);
      return x;
    };
    v.replaceChildren(
      el("div", { className: "cambiar-dia" }, mover(-1), el("b", { textContent: nombreDelDia(d) }), mover(1),
        d !== hoyTexto() ? el("button", { className: "ir-hoy", textContent: "Hoy", onclick: () => ctx.cambiar({ dia: null }) }) : ""),
      el("div", { className: "resumen-dia" },
        el("div", { className: "kcal-dia" }, el("small", { textContent: "Calorías del día" }),
          el("b", {}, String(numero(t.kcal)), el("i", { textContent: ` de ${numero(m.kcal)} kcal` })), barraDeMacros(t),
          el("small", { textContent: !t.cuantas ? "Nada anotado este día." : falta > 0 ? `faltan ${numero(falta)} kcal para la meta` : `pasaste la meta por ${numero(-falta)} kcal` })),
        el("div", { className: "minis" }, mini("proteina", "Proteína"), mini("carbos", "Carbohidratos"), mini("grasa", "Grasa"))));
  };
}

export function comidas(v, ctx) {
  v.classList.add("w-comidas");
  return () => {
    const d = diaDe(ctx), lista = comidasDe(d);
    const grupos = [...MOMENTOS.map(([nombre, ic, color]) => ({ nombre, ic, color, cosas: lista.filter((x) => x.momento === nombre) })),
      { nombre: "Sin momento", ic: "reloj", color: "#64748b", cosas: lista.filter((x) => !MOMENTOS.some(([n]) => n === x.momento)) }]
      .filter((grupo) => grupo.nombre !== "Sin momento" || grupo.cosas.length);
    v.replaceChildren(...grupos.map((grupo) => {
      const t = sumar(grupo.cosas);
      const tarjeta = el("section", { className: "tarjeta-comida vidrio" },
        el("div", { className: "cabeza-comida" }, el("span", { className: "insignia" }, icono(grupo.ic)),
          el("div", {}, el("h4", { textContent: grupo.nombre }), el("small", { textContent: grupo.cosas.length ? `${numero(t.kcal)} kcal · ${numero(t.proteina)} g proteína` : "nada anotado" })),
          grupo.nombre !== "Sin momento" ? el("button", { className: "agregar", textContent: "+", ariaLabel: "Agregar a " + grupo.nombre.toLowerCase(),
            onclick: () => ctx.cambiar({ momento: grupo.nombre, enfocar: Date.now() }) }) : ""),
        barraDeMacros(t),
        el("ul", { className: "cosas-comida" }, ...grupo.cosas.sort((a, b) => b.kcal - a.kcal).map((x) => {
          const mayor = ["proteina", "carbos", "grasa"].reduce((a, b) => (x[a] * (a === "grasa" ? 9 : 4) >= x[b] * (b === "grasa" ? 9 : 4) ? a : b));
          const punto = el("i");
          punto.style.background = COLOR[mayor];
          return el("li", {}, punto, el("span", { textContent: x.a?.titulo.replace(/\s+[—-]\s+estimaci[oó]n.*$/i, "").replace(/\s*\(estimad[oa]\)/i, "") ?? "(alimento borrado)" }),
            el("small", { textContent: numero(x.g) + " g" }), el("b", {}, String(numero(x.kcal))),
            el("button", { className: "quitar", textContent: "×", ariaLabel: "Borrar " + (x.a?.titulo ?? ""), onclick: () => escribir(db.from("registros").delete().eq("id", x.r.id)) }));
        })),
        grupo.nombre === "Sin momento" ? el("p", { className: "vacio", textContent: "Anotadas sin desayuno, almuerzo, merienda ni cena." }) : "");
      tarjeta.style.setProperty("--c", grupo.color);
      return tarjeta;
    }));
  };
}

export function plato(v, ctx) {
  v.classList.add("w-salud");
  return () => {
    const d = diaDe(ctx), lista = comidasDe(d), t = sumar(lista);
    v.sub.textContent = "de dónde vienen las calorías";
    const kc = { proteina: t.proteina * 4, carbos: t.carbos * 4, grasa: t.grasa * 9 }, total = kc.proteina + kc.carbos + kc.grasa;
    if (!total) return v.replaceChildren(v.firstChild, el("p", { className: "vacio", textContent: "Cuando anotes algo, aquí verás de qué está hecho tu día." }));
    let va = 0;
    const tramos = ["proteina", "carbos", "grasa"].map((k) => {
      const p = kc[k] / total * 100, c = `<circle cx="70" cy="70" r="52" pathLength="100" style="stroke:${COLOR[k]}" stroke-dasharray="${p} ${100 - p}" stroke-dashoffset="${-va}"/>`;
      va += p;
      return c;
    }).join("");
    const pct = (k) => Math.round(kc[k] / total * 100), mayor = ["proteina", "carbos", "grasa"].sort((a, b) => kc[b] - kc[a])[0];
    const NOMBRE = { proteina: "proteína", carbos: "carbohidratos", grasa: "grasa" };
    const top = [...lista].sort((a, b) => b.kcal - a.kcal)[0], o = objetivoDePeso(), kg = o ? pesoActual(o).v : null;
    const consejo = [top && `Lo que más aportó: ${top.a?.titulo.replace(/\s+[—-]\s+.*$/, "")} (${numero(top.kcal)} kcal, ${Math.round(top.kcal / t.kcal * 100)}% del día).`,
      kg && t.proteina / kg < 1.6 ? `Llevas ${numero(t.proteina / kg, 1)} g de proteína por kilo; para ganar músculo conviene 1,6 a 2,2 (${Math.round(kg * 1.6)}–${Math.round(kg * 2.2)} g).` : ""].filter(Boolean).join(" ");
    v.replaceChildren(v.firstChild,
      el("div", { className: "plato" }, svgDe("0 0 140 140", `<g transform="rotate(-90 70 70)">${tramos}</g><text x="70" y="68" class="grande">${pct(mayor)}%</text><text x="70" y="86">${mayor === "carbos" ? "carbos" : NOMBRE[mayor]}</text>`, "dona"),
        el("div", { className: "lista-anillos" }, ...["proteina", "carbos", "grasa"].map((k) => {
          const f = el("div", {}, el("i"), el("span", { textContent: NOMBRE[k][0].toUpperCase() + NOMBRE[k].slice(1) }), el("b", {}, String(pct(k) + "%")));
          f.style.setProperty("--c", COLOR[k]);
          return f;
        }))),
      consejo ? el("p", { className: "consejo", textContent: consejo }) : "");
  };
}

// Lo que más repites: las comidas (un momento de un día) que se repiten igual, de la más repetida a la menos.
function frecuentes() {
  const veces = new Map();
  const porComida = new Map();
  for (const r of datos.registros) if (r.clase === "comida" && r.props?.comida) {
    const k = dia(r.fecha) + "|" + r.props.comida;
    if (!porComida.has(k)) porComida.set(k, []);
    porComida.get(k).push(r);
  }
  for (const [k, rs] of porComida) {
    const firma = k.split("|")[1] + "|" + rs.map((r) => r.nodo_id).sort().join(",");
    if (!veces.has(firma)) veces.set(firma, { momento: k.split("|")[1], rs, n: 0 });
    veces.get(firma).n++;
    veces.get(firma).rs = rs; // la última vez, con sus cantidades
  }
  return [...veces.values()].filter((f) => f.n >= 2 && f.rs.every((r) => datos.nodo.has(r.nodo_id))).sort((a, b) => b.n - a.n).slice(0, 4);
}

export function anotar(v, ctx) {
  v.classList.add("w-salud");
  const lista = el("datalist", { id: "alimentos-salud" });
  const alimento = el("input", { type: "text", placeholder: "Busca un alimento", ariaLabel: "Alimento", autocomplete: "off" });
  alimento.setAttribute("list", lista.id);
  const g = el("input", { type: "number", min: "1", step: "1", placeholder: "g", ariaLabel: "Gramos" });
  const momento = el("select", { ariaLabel: "Momento" }, ...MOMENTOS.map(([n]) => el("option", { value: n, textContent: n })));
  const aviso = el("small", { className: "vacio" });
  // Al elegir un alimento, se proponen los gramos de su porción.
  alimento.oninput = () => { const a = buscar(alimento.value); if (a && !g.value) g.value = a.props?.porcion_g ?? ""; };
  const buscar = (texto) => datos.nodos.find((n) => n.tipos.clave === "alimento" && n.titulo.toLowerCase() === texto.trim().toLowerCase());
  const form = el("form", { className: "anotar-comida", onsubmit: (e) => {
    e.preventDefault();
    const a = buscar(alimento.value), gramos = Number(g.value);
    if (!a) return (aviso.textContent = "Elige un alimento de la lista (o créalo con «+ Nuevo»).");
    if (!(gramos > 0)) return (aviso.textContent = "Escribe cuántos gramos.");
    anotarComida([{ a, g: gramos }], momento.value, diaDe(ctx));
    alimento.value = g.value = aviso.textContent = "";
  } }, alimento, g, momento, el("button", { className: "principal", textContent: "Anotar" }), lista, aviso);
  let enfocado = null;
  return () => {
    lista.replaceChildren(...datos.nodos.filter((n) => n.tipos.clave === "alimento").map((n) => el("option", { value: n.titulo })));
    if (ctx.momento && document.activeElement?.closest(".anotar-comida") !== form) momento.value = ctx.momento;
    else if (!ctx.momento) momento.value = momentoDeAhora();
    if (ctx.enfocar && ctx.enfocar !== enfocado) { enfocado = ctx.enfocar; alimento.focus(); }
    const repetir = frecuentes().map((f) => {
      const cosas = f.rs.map((r) => ({ a: datos.nodo.get(r.nodo_id), g: gramos(r, datos.nodo.get(r.nodo_id)) }));
      const kcal = cosas.reduce((s, x) => s + x.g / 100 * (x.a.props?.kcal_100g ?? 0), 0);
      const [, ic, color] = MOMENTOS.find(([n]) => n === f.momento);
      const b = el("button", { className: "repetir", title: cosas.map((x) => `${x.a.titulo} ${numero(x.g)} g`).join(", "),
        onclick: () => anotarComida(cosas, f.momento, diaDe(ctx)) },
        el("span", { className: "insignia" }, icono(ic)),
        el("span", {}, el("b", { textContent: `${f.momento} de siempre` }), el("small", { textContent: `${cosas.map((x) => x.a.titulo.split(/\s+[—(-]/)[0].toLowerCase()).join(", ")} · ${numero(kcal)} kcal` })));
      b.style.setProperty("--c", color);
      return b;
    });
    v.replaceChildren(v.firstChild, form, repetir.length ? el("div", { className: "frecuentes" }, el("small", { className: "vacio", textContent: "Lo que más repites (un toque lo anota entero)" }), ...repetir) : "");
  };
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
      })),
      el("p", { className: "vacio", textContent: "La línea es tu meta. Para subir de peso importa el promedio de la semana, no un día." }));
  };
}
