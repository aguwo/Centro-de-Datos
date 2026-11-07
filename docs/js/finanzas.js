// El apartado Finanzas (paso 83): tu plata, en la barra lateral, con el mismo orden que Salud (apartados.js):
// tres bloques, Gastos, Ahorro y Suscripciones, cada uno con lo de ahora a la izquierda y cómo vas a la derecha.
// Sus widgets (widgets.js):
//   semana-gasto   ‹ › para cambiar de semana; cuánto te queda del presupuesto, cuánto por día y si vas bien
//   movimientos    lo que gastaste y te entró esa semana; a los gastos sin categoría se la eliges con un toque
//   por-categoria  cada categoría contra su presupuesto semanal
//   semanas-gasto  las últimas 8 semanas contra el presupuesto (tocar una barra la elige)
//   entra-sale     lo que entró y lo que salió en el mes
//   cuentas        cuánto tienes en cada cuenta
//   suscripciones  las suscripciones activas y cuánto suman al mes
//
// De dónde sale cada cosa:
//   gastos e ingresos   registros "gasto" e "ingreso": nodo_id = la cuenta, otro_id = la categoría (si la tiene)
//   presupuesto         la suma del "Presupuesto semanal" de tus categorías (la semana va de lunes a domingo)
//   saldo de una cuenta su "Saldo inicial" + lo que entró − lo que salió, con las transferencias entre cuentas
//                       (registros "transferencia": de nodo_id hacia otro_id)
import { el, db, datos, dia, escribir } from "./base.js";
import { hoyTexto, sumarDias, diasEntre, lunes } from "./fechas.js";
import { icono, elegir } from "./dibujos.js";

const SEMANAS = 8; // cuántas semanas muestra «Últimas 8 semanas»
export const plata = (x) => (x < 0 ? "−$" : "$") + Math.round(Math.abs(x)).toLocaleString("es-CL");
const deTipo = (clave) => datos.nodos.filter((n) => n.tipos.clave === clave);
const valor = (r) => Number(r.valor) || 0;
const sumar = (lista) => lista.reduce((s, r) => s + valor(r), 0);
const entre = (clase, desde, hasta) => datos.registros.filter((r) => r.clase === clase && dia(r.fecha) >= desde && dia(r.fecha) <= hasta);
const barra = (frac, pasada) => { const b = el("span", { className: "barra-dieta" + (pasada ? " pasada" : "") }, el("i")); b.firstChild.style.width = Math.min(100, frac * 100) + "%"; return b; };
const diaCorto = (d) => new Date(d + "T12:00").toLocaleDateString("es-CL", { weekday: "short", day: "numeric" });

// ---------- las categorías ----------
const categorias = () => deTipo("categoria").sort((a, b) => (b.props?.presupuesto_semanal ?? 0) - (a.props?.presupuesto_semanal ?? 0));
const presupuesto = () => categorias().reduce((s, c) => s + (Number(c.props?.presupuesto_semanal) || 0), 0);
const categoriaDe = (r) => { const c = datos.nodo.get(r.otro_id); return c?.tipos.clave === "categoria" ? c : null; };
// Un ícono por categoría, adivinado por su nombre (como los temas de los ramos).
const ICONOS = [[/comida|almuerzo|super|mercado/i, "plato"], [/transporte|micro|bus|uber|bencina/i, "bus"], [/entreten|juego|cine|salida/i, "control"],
  [/suscrip/i, "repetir"], [/vicio|caf[eé]|copete/i, "taza"], [/salud|farmacia|m[eé]dico/i, "corazon"], [/ropa/i, "estrella"], [/u\b|universidad|estudio/i, "libro"]];
const iconoDe = (c) => (c ? elegir(c.titulo, ICONOS, "caja") : "puntos");

// ---------- la semana ----------
// Cómo va la semana que empieza el lunes l: lo gastado, el presupuesto, lo que queda y para cuántos días alcanza.
function semana(l) {
  const hasta = sumarDias(l, 6), hoy = hoyTexto(), gastos = entre("gasto", l, hasta), gastado = sumar(gastos), tope = presupuesto();
  // Días que quedan contando hoy (si la semana ya pasó, ninguno; si no empieza, los 7).
  const dias = hoy > hasta ? 0 : hoy < l ? 7 : diasEntre(hoy, hasta) + 1;
  return { desde: l, hasta, gastos, gastado, tope, quedan: tope - gastado, dias, pasado: hoy < l ? 0 : Math.min(7, diasEntre(l, hoy) + 1) / 7 };
}
const lunesDe = (ctx) => ctx.semana ?? lunes(hoyTexto());
const nombreDeSemana = (l) => {
  const h = sumarDias(l, 6), mes = (d) => new Date(d + "T12:00").toLocaleDateString("es-CL", { month: "long" });
  return l === lunes(hoyTexto()) ? "Esta semana" : `${Number(l.slice(8))}${mes(l) === mes(h) ? "" : " de " + mes(l)} al ${Number(h.slice(8))} de ${mes(h)}`;
};

export function semanaGasto(v, ctx) {
  v.classList.add("w-finanzas");
  return () => {
    const l = lunesDe(ctx), s = semana(l), esta = l === lunes(hoyTexto());
    const mover = (n) => el("button", { className: "mover-dia", textContent: n < 0 ? "‹" : "›", ariaLabel: n < 0 ? "Semana anterior" : "Semana siguiente",
      disabled: n > 0 && esta, onclick: () => ctx.cambiar({ semana: sumarDias(l, 7 * n) === lunes(hoyTexto()) ? null : sumarDias(l, 7 * n) }) });
    const linea = barra(s.gastado / (s.tope || 1), s.quedan < 0);
    if (esta) linea.append(el("b", { className: "marca-hoy", title: "hoy" }));
    linea.style.setProperty("--hoy", s.pasado * 100 + "%");
    // Vas bien si llevas gastada una parte igual o menor que la parte de la semana que ya pasó.
    const frac = s.gastado / (s.tope || 1);
    const frase = !s.tope ? "Ponle «Presupuesto semanal» a tus categorías para ver cuánto te queda."
      : s.quedan < 0 ? `Te pasaste por ${plata(-s.quedan)}.`
      : !esta ? `Sobraron ${plata(s.quedan)}.`
      : frac <= s.pasado ? `Vas bien: llevas el ${Math.round(frac * 100)}% y ya pasó el ${Math.round(s.pasado * 100)}% de la semana.`
      : `Vas rápido: llevas el ${Math.round(frac * 100)}% y solo ha pasado el ${Math.round(s.pasado * 100)}% de la semana.`;
    v.replaceChildren(
      el("div", { className: "cambiar-dia" }, mover(-1), el("b", { textContent: nombreDeSemana(l) }), mover(1)),
      el("div", { className: "kcal-grande" }, el("b", { className: s.quedan < 0 ? "pasada" : "", textContent: plata(Math.abs(s.quedan)) }),
        el("span", { textContent: s.quedan < 0 ? "te pasaste" : `te ${esta ? "quedan" : "sobraron"} de ${plata(s.tope)}` })),
      linea,
      el("div", { className: "pie-kcal" }, el("span", {}, "Gastado ", el("b", { textContent: plata(s.gastado) })),
        esta && s.quedan > 0 && s.dias ? el("span", {}, s.dias === 1 ? "Para hoy " : `Para ${s.dias} días `, el("b", { textContent: plata(s.quedan / s.dias) + (s.dias === 1 ? "" : " al día") })) : ""),
      el("p", { className: "frase-finanzas" + (s.quedan < 0 || (esta && frac > s.pasado) ? " mal" : "") }, frase));
  };
}

// Lo que gastaste y te entró en la semana, del más nuevo al más viejo. Un gasto sin categoría muestra las categorías
// para elegir la suya con un toque (así se ordenan los que llegan solos del banco).
export function movimientos(v, ctx) {
  v.classList.add("w-finanzas");
  return () => {
    const s = semana(lunesDe(ctx)), lista = [...s.gastos, ...entre("ingreso", s.desde, s.hasta)].sort((a, b) => b.fecha.localeCompare(a.fecha));
    const sinCategoria = s.gastos.filter((r) => !categoriaDe(r));
    v.sub.textContent = sinCategoria.length ? `${sinCategoria.length} por revisar` : "";
    if (!lista.length) return v.replaceChildren(v.firstChild, el("p", { className: "vacio", textContent: "Nada anotado esta semana." }));
    v.replaceChildren(v.firstChild, el("ul", { className: "movimientos" }, ...lista.map((r) => {
      const entra = r.clase === "ingreso", c = categoriaDe(r), cuenta = datos.nodo.get(r.nodo_id);
      const revisar = !entra && !c;
      return el("li", { className: "movimiento" + (revisar ? " por-revisar" : "") + (entra ? " entra" : "") },
        el("span", { className: "insignia" }, icono(entra ? "flecha" : revisar ? "alerta" : iconoDe(c))),
        el("span", {}, el("b", { textContent: r.titulo || (entra ? "Ingreso" : "Gasto") }),
          el("small", { textContent: [diaCorto(dia(r.fecha)), entra ? "entró" : c?.titulo ?? "sin categoría", cuenta?.titulo].filter(Boolean).join(" · ") })),
        el("b", { className: "monto", textContent: (entra ? "+" : "−") + plata(valor(r)) }),
        revisar ? el("div", { className: "elegir-categoria", role: "group", ariaLabel: "Elegir categoría" }, ...categorias().map((cat) =>
          el("button", { textContent: cat.titulo, onclick: () => escribir(db.from("registros").update({ otro_id: cat.id }).eq("id", r.id)) }))) : "");
    })));
  };
}

// Cada categoría contra su presupuesto de la semana. Las que no tienen presupuesto salen solo si gastaste en ellas.
export function porCategoria(v, ctx) {
  v.classList.add("w-finanzas");
  return () => {
    const s = semana(lunesDe(ctx)), suma = new Map();
    for (const r of s.gastos) suma.set(categoriaDe(r)?.id ?? null, (suma.get(categoriaDe(r)?.id ?? null) ?? 0) + valor(r));
    const filas = categorias().map((c) => ({ c, gastado: suma.get(c.id) ?? 0, tope: Number(c.props?.presupuesto_semanal) || 0 }))
      .filter((f) => f.tope || f.gastado);
    if (suma.get(null)) filas.push({ c: null, gastado: suma.get(null), tope: 0 });
    const pasadas = filas.filter((f) => f.tope && f.gastado > f.tope);
    v.sub.replaceChildren(pasadas.length ? el("span", { className: "etiqueta-dieta", textContent: pasadas.length === 1 ? pasadas[0].c.titulo + " se pasó" : `${pasadas.length} se pasaron` }) : "");
    if (!filas.length) return v.replaceChildren(v.firstChild, el("p", { className: "vacio", textContent: "Crea categorías con su «Presupuesto semanal» para verlas aquí." }));
    v.replaceChildren(v.firstChild, el("div", { className: "categorias" }, ...filas.map(({ c, gastado, tope }) => {
      const pasada = tope && gastado > tope;
      return el("div", { className: "categoria" + (c ? "" : " sin") },
        el("div", {}, el("span", { className: "insignia" }, icono(iconoDe(c))), el("span", { textContent: c?.titulo ?? "Sin categoría" }),
          el("b", { className: pasada ? "pasada" : "", textContent: plata(gastado) }), tope ? el("small", { textContent: " / " + plata(tope) }) : ""),
        tope ? barra(gastado / tope, pasada) : el("span", { className: "barra-dieta vacia" }),
        el("small", { className: pasada ? "pasada" : "", textContent: !tope ? "por revisar" : pasada ? `te pasaste ${plata(gastado - tope)}` : `quedan ${plata(tope - gastado)}` }));
    })));
  };
}

// Las últimas semanas contra el presupuesto. La elegida (la de «‹ ›») va marcada; tocar otra la elige.
export function semanasGasto(v, ctx) {
  v.classList.add("w-finanzas");
  return () => {
    // Terminan en esta semana; si elegiste una más vieja, en la que haga falta para que se vea.
    const elegida = lunesDe(ctx), esta = lunes(hoyTexto()), atras = 7 * (SEMANAS - 1);
    const fin = elegida < sumarDias(esta, -atras) ? sumarDias(elegida, atras) : esta;
    const semanas = Array.from({ length: SEMANAS }, (_, i) => semana(sumarDias(fin, 7 * (i - SEMANAS + 1))));
    const tope = presupuesto(), alto = Math.max(tope * 1.3, ...semanas.map((s) => s.gastado), 1);
    const enteras = semanas.filter((s) => s.dias === 0);
    v.sub.textContent = enteras.length ? `promedio ${plata(sumar(enteras.flatMap((s) => s.gastos)) / enteras.length)}` : "";
    const meta = el("i", { className: "linea-meta", title: "presupuesto " + plata(tope) });
    meta.style.bottom = tope / alto * 100 + "%";
    v.replaceChildren(v.firstChild, el("div", { className: "barras-semana" }, tope ? meta : "", ...semanas.map((s) => {
      const b = el("button", { className: "dia-barra" + (s.desde === elegida ? " elegido" : "") + (tope && s.gastado > tope ? " pasada" : ""),
        title: `${nombreDeSemana(s.desde)}: ${plata(s.gastado)}`, onclick: () => ctx.cambiar({ semana: s.desde === lunes(hoyTexto()) ? null : s.desde }) },
        el("small", { textContent: s.gastado ? Math.round(s.gastado / 1000) + "k" : "—" }), el("i"),
        el("span", { textContent: `${Number(s.desde.slice(8))} ${new Date(s.desde + "T12:00").toLocaleDateString("es-CL", { month: "short" }).replace(".", "")}` }));
      b.querySelector("i").style.height = Math.max(2, s.gastado / alto * 100) + "%";
      return b;
    })));
  };
}

// Lo que entró y lo que salió en el mes de la semana elegida (hasta hoy, si es este mes).
export function entraSale(v, ctx) {
  v.classList.add("w-finanzas");
  return () => {
    const ref = sumarDias(lunesDe(ctx), 6) > hoyTexto() ? hoyTexto() : sumarDias(lunesDe(ctx), 6);
    const desde = ref.slice(0, 8) + "01", hasta = ref.slice(0, 7) === hoyTexto().slice(0, 7) ? hoyTexto() : sumarDias(sumarDias(desde, 32).slice(0, 8) + "01", -1);
    const entro = sumar(entre("ingreso", desde, hasta)), salio = sumar(entre("gasto", desde, hasta)), mayor = Math.max(entro, salio, 1);
    v.sub.textContent = new Date(desde + "T12:00").toLocaleDateString("es-CL", { month: "long" }) + (hasta === hoyTexto() ? " hasta hoy" : "");
    const fila = (nombre, x, clase) => el("div", { className: "entra-sale " + clase }, el("span", { textContent: nombre }), barra(x / mayor), el("b", { textContent: plata(x) }));
    v.replaceChildren(v.firstChild, fila("Entró", entro, "entra"), fila("Salió", salio, "sale"),
      el("p", { className: "frase-finanzas" + (entro < salio ? " mal" : "") }, entro >= salio ? `Te quedaron ${plata(entro - salio)}.` : `Salió ${plata(salio - entro)} más de lo que entró.`));
  };
}

// ---------- las cuentas ----------
export function saldo(c) {
  const de = (clase, campo) => sumar(datos.registros.filter((r) => r.clase === clase && r[campo] === c.id));
  return (Number(c.props?.saldo_inicial) || 0) + de("ingreso", "nodo_id") - de("gasto", "nodo_id") - de("transferencia", "nodo_id") + de("transferencia", "otro_id");
}
const ICONOS_CUENTA = [[/ahorro/i, "monedas"], [/junaeb|beca|alimenta/i, "plato"]];
export function cuentas(v) {
  v.classList.add("w-finanzas");
  return () => {
    const lista = deTipo("cuenta");
    v.sub.textContent = lista.length ? "en total " + plata(lista.reduce((s, c) => s + saldo(c), 0)) : "";
    v.replaceChildren(v.firstChild, lista.length ? el("div", { className: "cuentas" }, ...lista.map((c) => el("div", { className: "cuenta" },
      el("span", { className: "insignia" }, icono(elegir(c.titulo, ICONOS_CUENTA, "billetera"))), el("b", { textContent: c.titulo }), el("span", { className: "monto", textContent: plata(saldo(c)) }))))
      : el("p", { className: "vacio", textContent: "Crea tus cuentas (débito, ahorro...) con su «Saldo inicial» para ver aquí cuánto tienes." }));
  };
}

// ---------- las suscripciones ----------
const activas = () => deTipo("suscripcion").filter((s) => s.props?.activa !== false);
const alMes = (s) => (Number(s.props?.precio) || 0) / (s.props?.periodo === "Anual" ? 12 : 1);
export const totalAlMes = () => activas().reduce((t, s) => t + alMes(s), 0);
export function suscripciones(v) {
  v.classList.add("w-finanzas");
  return () => {
    const lista = activas().sort((a, b) => alMes(b) - alMes(a));
    v.sub.textContent = lista.length ? plata(totalAlMes()) + " al mes" : "";
    v.replaceChildren(v.firstChild, lista.length ? el("ul", { className: "movimientos" }, ...lista.map((s) => el("li", { className: "movimiento" },
      el("span", { className: "insignia letra", textContent: s.titulo.trim()[0]?.toUpperCase() ?? "?" }),
      el("span", {}, el("b", { textContent: s.titulo }), el("small", { textContent: s.props?.periodo ?? "Mensual" })),
      el("b", { className: "monto", textContent: plata(Number(s.props?.precio) || 0) }))))
      : el("p", { className: "vacio", textContent: "No tienes suscripciones activas." }));
  };
}

// ---------- las tarjetas de los bloques ----------
// Lo que dice cada tarjeta del selector (bloques.js): un dato, un detalle y el avance para su anillo.
export function resumenGastos() {
  const s = semana(lunes(hoyTexto()));
  return { dato: s.quedan >= 0 ? "Te quedan " + plata(s.quedan) : "Te pasaste " + plata(-s.quedan),
    detalle: `de ${plata(s.tope)} esta semana`, avance: s.tope ? s.gastado / s.tope : 0 };
}
// El objetivo de ahorro: un objetivo en pesos (unidad CLP o $) que no esté hecho.
export const objetivoDeAhorro = () => datos.nodos.find((n) => n.tipos.clave === "objetivo" && n.estado !== "Hecho" && /^(clp|\$|pesos)$/i.test(n.props?.unidad ?? "") && Number(n.props?.meta) > 0);
export function resumenAhorro() {
  const o = objetivoDeAhorro();
  if (!o) {
    const ahorro = deTipo("cuenta").filter((c) => /ahorro/i.test(c.titulo));
    return { dato: plata(ahorro.reduce((t, c) => t + saldo(c), 0)), detalle: "en ahorro" };
  }
  const va = Number(o.props.actual ?? o.props.inicio) || 0, fecha = o.fecha && new Date(dia(o.fecha) + "T12:00").toLocaleDateString("es-CL", { day: "numeric", month: "short" });
  return { dato: `${plata(va)} de ${plata(o.props.meta)}`, detalle: [o.titulo, fecha].filter(Boolean).join(" · "), avance: va / o.props.meta };
}
export function resumenSuscripciones() {
  const n = activas().length;
  return { dato: plata(totalAlMes()) + " al mes", detalle: n === 1 ? "1 activa" : `${n} activas` };
}

export const BLOQUES = {
  gastos: { bloque: "Gastos", icono: "billetera", color: "#0d9488", resumen: resumenGastos },
  ahorro: { bloque: "Ahorro", icono: "monedas", color: "#d97706", resumen: resumenAhorro },
  suscripciones: { bloque: "Suscripciones", icono: "repetir", color: "#7c3aed", resumen: resumenSuscripciones },
};
