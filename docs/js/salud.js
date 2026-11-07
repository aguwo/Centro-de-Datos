// El apartado Salud (paso 63): tu peso, lo que comiste hoy, tus hábitos y tu despensa, con gráficos.
// Va en la barra lateral, a pantalla completa. Sus widgets (widgets.js):
//   cifras       cuatro números con su ícono: peso, calorías y proteína de hoy, hábitos de hoy. Van en la barra del apartado
//   peso         el camino a tu meta de peso: tu línea, lo que pide la fecha y el ritmo sano
//   anillos      cuatro anillos de hoy: calorías, proteína, carbohidratos y grasa contra tu meta diaria
//   habitos-hoy  los hábitos que tocan hoy, como botones con ícono: tocar marca o desmarca
//   constancia   cuántos hábitos cumpliste cada día de las últimas 13 semanas, y tu mejor racha
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
// Los datos de salud son sensibles (Ley 21.719): «Ocultar números» los difumina en esta pantalla.
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
// Un número que se difumina con «Ocultar números».
const cifra = (texto) => el("span", { className: "cifra", textContent: texto });

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
const habitos = () => datos.nodos.filter((n) => n.tipos.clave === "habito");
const marcasDe = (h) => datos.registros.filter((r) => r.clase === "habito" && r.nodo_id === h.id);
// El ícono y el color de un hábito: el de props.icono o uno adivinado por su nombre.
const TEMAS = [[/creatina|vitamina|pastilla|remedio/i, ["pildora", "#7c3aed"]], [/orden|limpi/i, ["caja", "#0e7490"]],
  [/sistema|revisar|planific/i, ["lista", "#2563eb"]], [/medit|respir/i, ["loto", "#be185d"]],
  [/mañana|piel|sol/i, ["sol", "#c2410c"]], [/noche|dormir/i, ["luna", "#4338ca"]], [/entren|gim|ejercicio|correr/i, ["pesa", "#2f7a4c"]],
  [/le(er|ctura)|libro/i, ["libro", "#a16207"]], [/estudi/i, ["examen", "#0f766e"]], [/calor|comida|kcal/i, ["fuego", "#c2410c"]]];
const temaDe = (h) => elegir(h.titulo, TEMAS, ["si", "#2f7a4c"]).map((x, i) => (i === 0 ? h.props?.icono ?? x : x));
// Días seguidos con algún hábito cumplido, contando hacia atrás desde hoy (o desde ayer, si hoy aún no marcas nada).
function rachas() {
  const dias = new Set(datos.registros.filter((r) => r.clase === "habito").map((r) => dia(r.fecha)));
  let d = dias.has(hoyTexto()) ? hoyTexto() : sumarDias(hoyTexto(), -1), actual = 0;
  while (dias.has(d)) { actual++; d = sumarDias(d, -1); }
  let mejor = 0, corrida = 0, previo = null;
  for (const x of [...dias].sort()) { corrida = previo && diasEntre(previo, x) === 1 ? corrida + 1 : 1; mejor = Math.max(mejor, corrida); previo = x; }
  return { actual, mejor };
}

// ---------- los widgets ----------
// «Ocultar números»: un botón en la barra del apartado que difumina las cifras (se recuerda en este navegador).
function botonPrivado(v) {
  const leer = () => { try { return localStorage.getItem("salud-privado") === "1"; } catch { return false; } };
  const b = el("button", { className: "privado-boton" }, icono("ojo"), el("span"));
  const poner = (si) => { v.closest(".apartado")?.classList.toggle("privado", si); b.lastChild.textContent = si ? "Mostrar números" : "Ocultar números"; b.ariaPressed = String(si); };
  b.onclick = () => { const si = !leer(); try { localStorage.setItem("salud-privado", si ? "1" : "0"); } catch {} poner(si); };
  return { b, poner: () => poner(leer()) };
}

export function cifras(v, ctx) {
  v.hidden = true; // esta ventana no se ve: pone sus cifras a todo el ancho, en la barra del apartado
  const privado = botonPrivado(v);
  const tarjeta = (nombre, color, titulo, valor, unidad, pie) => {
    const t = el("div", { className: "cifra-salud vidrio" }, el("span", { className: "insignia" }, icono(nombre)),
      el("div", {}, el("small", { textContent: titulo }), el("b", {}, cifra(valor), el("i", { textContent: " " + unidad })), el("small", { textContent: pie })));
    t.style.setProperty("--c", color);
    return t;
  };
  return () => {
    cargarMetas(() => ctx.cambiar({}));
    privado.poner();
    const o = objetivoDePeso(), hoy = comidaDe(hoyTexto()), m = metas();
    const deHoy = habitos().filter((h) => tocaEl(h, hoyTexto()));
    const hechos = deHoy.filter((h) => marcasDe(h).some((r) => dia(r.fecha) === hoyTexto())).length, r = rachas();
    ctx.barra.replaceChildren(el("div", { className: "cifras-salud" },
      o ? tarjeta("balanza", COLOR.kcal, "Peso", numero(pesoActual(o).v, 1), "kg", `faltan ${numero(Math.abs(o.props.meta - pesoActual(o).v), 1)} kg`)
        : tarjeta("balanza", COLOR.kcal, "Peso", "—", "", "crea un objetivo con unidad kg"),
      tarjeta("fuego", COLOR.proteina, "Calorías hoy", numero(hoy.kcal), `/ ${numero(m.kcal)}`, hoy.cuantas ? `${hoy.cuantas} cosas anotadas` : "nada anotado aún"),
      tarjeta("carne", COLOR.carbos, "Proteína hoy", numero(hoy.proteina), `/ ${m.proteina} g`, "sano: 1,6 a 2,2 g por kilo"),
      tarjeta("si", COLOR.grasa, "Hábitos hoy", String(hechos), `de ${deHoy.length}`, `racha: ${r.actual} ${r.actual === 1 ? "día" : "días"}`),
    ), privado.b);
  };
}

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
      el("h3", {}, "Camino a ", cifra(numero(meta, 1) + " kg"), el("small", { textContent: `${o.titulo}${tope ? " · tope " + new Date(tope + "T12:00").toLocaleDateString("es-CL", { day: "numeric", month: "short" }) : ""}` })),
      el("div", { className: "leyenda" }, el("span", { className: "l-peso", textContent: "tu peso" }),
        pideDemasiado ? el("span", { className: "l-pide", textContent: "lo que pide la fecha" }) : "", el("span", { className: "l-sano", textContent: "ritmo sano" })),
      svgDe(`0 0 ${W} ${H}`, `${lineas.join("")}${meses.join("")}
        <path d="M${hoyX} ${hoyY} L${x(r.sano[1])} ${y(meta)} L${x(r.sano[0])} ${y(meta)} Z" class="sano"/>
        <line x1="${IZQ}" y1="${y(meta)}" x2="${W}" y2="${y(meta)}" class="meta"/>
        ${pideDemasiado ? `<path d="M${hoyX} ${hoyY} L${x(tope)} ${y(meta)}" class="pide"/><circle cx="${x(tope)}" cy="${y(meta)}" r="5" class="pide-punto"/>` : ""}
        <polyline points="${puntos.map((p) => `${x(p.d)},${y(p.v)}`).join(" ")}" class="linea"/>
        ${puntos.map((p, i) => `<circle cx="${x(p.d)}" cy="${y(p.v)}" r="${i === puntos.length - 1 ? 7 : 4.5}" class="${i === puntos.length - 1 ? "ultimo" : "punto"}"/>`).join("")}
        <line x1="${hoyX}" y1="${ARRIBA - 8}" x2="${hoyX}" y2="${ABAJO + 6}" class="hoy"/><text x="${hoyX}" y="${ABAJO + 18}" class="hoy-texto">hoy</text>`, "grafico-peso cifra"),
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
      const f = el("div", {}, el("i"), el("span", { textContent: nombre }), el("b", {}, cifra(numero(hoy[k])), " / ",
        editando ? el("input", { type: "number", value: m[k], name: k, ariaLabel: "Meta de " + nombre.toLowerCase() }) : cifra(numero(m[k]) + u)));
      f.style.setProperty("--c", COLOR[k]);
      return f;
    }));
    const boton = el("button", { textContent: editando ? "Guardar metas" : "Cambiar metas", className: editando ? "principal" : "" });
    boton.onclick = () => {
      if (editando) guardarMetas(Object.fromEntries([...lista.querySelectorAll("input")].map((i) => [i.name, Number(i.value) || 0])));
      editando = !editando;
      ctx.cambiar({});
    };
    v.replaceChildren(v.firstChild, el("div", { className: "anillos-salud" }, svgDe("0 0 200 200", aros, "aros cifra"), lista), boton);
  };
}

export function habitosHoy(v) {
  v.classList.add("w-salud");
  return () => {
    const hoy = hoyTexto(), lista = habitos().filter((h) => tocaEl(h, hoy));
    v.sub.textContent = "toca para marcar";
    if (!lista.length) return v.replaceChildren(v.firstChild, el("p", { className: "vacio", textContent: "Hoy no te toca ningún hábito." }));
    const hace30 = sumarDias(hoy, -29);
    v.replaceChildren(v.firstChild, el("div", { className: "habitos-salud" }, ...lista.map((h) => {
      const marcas = marcasDe(h), deHoy = marcas.find((r) => dia(r.fecha) === hoy), [nombre, color] = temaDe(h);
      let tocaban = 0;
      for (let d = hace30; d <= hoy; d = sumarDias(d, 1)) if (tocaEl(h, d)) tocaban++;
      const frac = new Set(marcas.map((r) => dia(r.fecha)).filter((d) => d >= hace30)).size / (tocaban || 1);
      const b = el("button", { className: "habito-salud" + (deHoy ? " hecho" : ""), ariaPressed: String(!!deHoy), title: `${Math.round(frac * 100)}% de las veces en los últimos 30 días`,
        onclick: () => alternarRegistro("habito", h, deHoy) },
        el("span", { className: "aro-habito" }, svgDe("0 0 64 64", `<circle cx="32" cy="32" r="28" pathLength="100" class="pista"/>${frac ? `<circle cx="32" cy="32" r="28" pathLength="100" class="lleno" stroke-dasharray="${Math.min(1, frac) * 100} 100"/>` : ""}`),
          el("span", { className: "insignia" }, icono(deHoy ? "si" : nombre))),
        el("span", { textContent: h.titulo }), el("small", { className: "cifra", textContent: Math.round(frac * 100) + "%" }));
      b.style.setProperty("--c", color);
      return b;
    })), el("p", { className: "vacio", textContent: "El anillo = cuántas veces lo cumpliste en los últimos 30 días." }));
  };
}

export function constancia(v) {
  v.classList.add("w-salud");
  return () => {
    const hoy = hoyTexto(), desde = lunes(sumarDias(hoy, -(SEMANAS - 1) * 7));
    const porDia = new Map();
    for (const r of datos.registros) if (r.clase === "habito") porDia.set(dia(r.fecha), (porDia.get(dia(r.fecha)) ?? 0) + 1);
    const mas = Math.max(1, ...porDia.values());
    const celdas = [];
    for (let d = desde; d <= hoy; d = sumarDias(d, 1)) {
      const k = porDia.get(d) ?? 0;
      celdas.push(el("span", { className: "celda n" + (k ? Math.min(3, Math.ceil(k / mas * 3)) : 0), title: `${d.split("-").reverse().join("/")}: ${k} ${k === 1 ? "hábito" : "hábitos"}` }));
    }
    const ultimo = [...porDia.keys()].sort().at(-1), sin = ultimo ? diasEntre(ultimo, hoy) : null, r = rachas();
    v.sub.textContent = `hábitos cumplidos por día · ${SEMANAS} semanas`;
    const dato = (nombre, color, grande, chico) => { const d = el("div", { className: "dato-salud" }, icono(nombre), el("span", {}, el("b", { textContent: grande }), el("br"), chico)); d.style.setProperty("--c", color); return d; };
    v.replaceChildren(v.firstChild,
      // La primera columna dice el día de la semana (L, X, V, D); las demás son las semanas, de lunes a domingo.
      el("div", { className: "constancia" },
        el("div", { className: "mapa-calor" }, ..."L M X J V S D".split(" ").map((t, i) => el("span", { className: "dia-calor", textContent: i % 2 ? "" : t })), ...celdas),
        el("div", { className: "lado-constancia" },
          el("div", { className: "leyenda-calor" }, "menos", ...[0, 1, 2, 3].map((n) => el("span", { className: "celda n" + n })), "más"),
          dato("fuego", COLOR.proteina, `${r.mejor} días`, "tu mejor racha"),
          sin !== null && sin > 1 ? dato("reloj", "#8a5a00", `${sin} días`, "sin marcar hábitos") : dato("si", COLOR.kcal, `${r.actual} días`, "racha actual"))));
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
// Anotar algo comido el día d: hoy con la hora de ahora; otro día, sin hora.
const anotarComida = (a, g, momento, d) => escribir(db.from("registros").insert({ clase: "comida", nodo_id: a.id, valor: g, unidad: "g",
  titulo: a.titulo, props: { comida: momento }, ...(d === hoyTexto() ? {} : { fecha: sinHoraISO(d) }) }));

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
      const x = el("div", { className: "mini-anillo" }, svgDe("0 0 60 60", `<circle cx="30" cy="30" r="25" pathLength="100" class="pista"/>${frac ? `<circle cx="30" cy="30" r="25" pathLength="100" class="lleno" stroke-dasharray="${frac * 100} 100"/>` : ""}`, "cifra"),
        el("div", {}, el("small", { textContent: nombre }), el("b", {}, cifra(numero(t[k]) + " g")), el("small", { textContent: `meta ${numero(m[k])} g` })));
      x.style.setProperty("--c", COLOR[k]);
      return x;
    };
    v.replaceChildren(
      el("div", { className: "cambiar-dia" }, mover(-1), el("b", { textContent: nombreDelDia(d) }), mover(1),
        d !== hoyTexto() ? el("button", { className: "ir-hoy", textContent: "Hoy", onclick: () => ctx.cambiar({ dia: null }) }) : ""),
      el("div", { className: "resumen-dia" },
        el("div", { className: "kcal-dia" }, el("small", { textContent: "Calorías del día" }),
          el("b", {}, cifra(numero(t.kcal)), el("i", { textContent: ` de ${numero(m.kcal)} kcal` })), barraDeMacros(t),
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
            el("small", { textContent: numero(x.g) + " g" }), el("b", {}, cifra(numero(x.kcal))),
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
      el("div", { className: "plato" }, svgDe("0 0 140 140", `<g transform="rotate(-90 70 70)">${tramos}</g><text x="70" y="68" class="grande">${pct(mayor)}%</text><text x="70" y="86">${mayor === "carbos" ? "carbos" : NOMBRE[mayor]}</text>`, "dona cifra"),
        el("div", { className: "lista-anillos" }, ...["proteina", "carbos", "grasa"].map((k) => {
          const f = el("div", {}, el("i"), el("span", { textContent: NOMBRE[k][0].toUpperCase() + NOMBRE[k].slice(1) }), el("b", {}, cifra(pct(k) + "%")));
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
    anotarComida(a, gramos, momento.value, diaDe(ctx));
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
        onclick: () => cosas.forEach((x) => anotarComida(x.a, x.g, f.momento, diaDe(ctx))) },
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
      el("div", { className: "barras-semana cifra" }, meta, ...dias.map((d, i) => {
        const b = el("button", { className: "dia-barra" + (d === hasta ? " elegido" : ""), title: `${nombreDelDia(d)}: ${numero(kcal[i])} kcal`, onclick: () => ctx.cambiar({ dia: d === hoyTexto() ? null : d }) },
          el("small", { textContent: kcal[i] ? numero(kcal[i] / 1000, 1) + "k" : "—" }), el("i"),
          el("span", { textContent: new Date(d + "T12:00").toLocaleDateString("es-CL", { weekday: "narrow" }) + " " + Number(d.slice(8)) }));
        b.querySelector("i").style.height = Math.max(2, kcal[i] / tope * 100) + "%";
        return b;
      })),
      el("p", { className: "vacio", textContent: "La línea es tu meta. Para subir de peso importa el promedio de la semana, no un día." }));
  };
}
