// El apartado Finanzas (paso 83): tu plata, en la barra lateral, con el mismo orden que Salud (apartados.js):
// tres bloques, Gastos, Ahorro y Suscripciones, cada uno con lo de ahora a la izquierda y cómo vas a la derecha.
// Sus widgets (widgets.js):
//   semana-gasto   ‹ › para cambiar de semana; cuánto te queda del presupuesto, cuánto por día y si vas bien
//   movimientos    lo que gastaste y te entró esa semana; a los gastos sin categoría se la eliges con un toque
//   por-categoria  cada categoría contra su presupuesto semanal
//   semanas-gasto  las últimas 8 semanas contra el presupuesto (tocar una barra la elige)
//   entra-sale     lo que entró y lo que salió en el mes
//   cuentas        cuánto tienes en cada cuenta; «Ajustar» corrige el saldo con lo que dice el banco (paso 84)
//   apartar        mover plata de tu cuenta del día a día a la de ahorro (y sumarla a tu objetivo de ahorro)
//   objetivo-ahorro cómo va tu objetivo en pesos: cuánto falta y cuánto apartar por semana; al cumplirlo, usar la plata
//   historial-ahorro lo que entró y salió de la cuenta de ahorro
//   este-mes       lo que se va al mes en suscripciones, el calendario con los días de cobro y cuál viene (paso 85)
//   suscripciones  las activas: precio, día de cobro y último cobro; «Pausar» la desactiva
//   detectadas     cobros de tus gastos que parecen suscripción y no están en tu lista: «Agregar» o «No es»
//   en-un-ano      lo que se va en un año y qué parte es de cada una
//   pausadas       las que no cobran ahora; «Activar» la vuelve a sumar
//
// De dónde sale cada cosa:
//   gastos e ingresos   registros "gasto" e "ingreso": nodo_id = la cuenta, otro_id = la categoría (si la tiene)
//   presupuesto         la suma del "Presupuesto semanal" de tus categorías (la semana va de lunes a domingo)
//   saldo de una cuenta su "Saldo inicial" + lo que entró − lo que salió, con las transferencias entre cuentas
//                       (registros "transferencia": de nodo_id hacia otro_id)
import { el, db, datos, dia, escribir, areaDe, flotante } from "./base.js";
import { hoyTexto, sumarDias, diasEntre, lunes } from "./fechas.js";
import { icono, elegir } from "./dibujos.js";
import { cambiar, cambiarProps, dentroDeCaja } from "./acciones.js";
import { formulario } from "./panel.js";

const BLOQUE_GASTOS = "#0d9488", BLOQUE_AHORRO = "#d97706", BLOQUE_SUSCRIPCIONES = "#7c3aed";
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
      el("p", { className: "frase-finanzas" + (s.quedan < 0 || (esta && frac > s.pasado) ? " mal" : "") }, frase),
      esta ? el("button", { className: "principal", textContent: "Anotar gasto", ariaHasPopup: "dialog", onclick: () => anotar("gasto") }) : "");
  };
}

// Lo que gastaste y te entró en la semana, del más nuevo al más viejo. Un gasto sin categoría muestra las categorías
// para elegir la suya con un toque (así se ordenan los que llegan solos del banco).
export function movimientos(v, ctx) {
  v.classList.add("w-finanzas");
  return () => {
    const s = semana(lunesDe(ctx)), lista = [...s.gastos, ...entre("ingreso", s.desde, s.hasta)].sort((a, b) => b.fecha.localeCompare(a.fecha));
    const sinCategoria = s.gastos.filter((r) => !categoriaDe(r));
    v.sub.replaceChildren(sinCategoria.length ? `${sinCategoria.length} por revisar · ` : "", botonAnotar());
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
const esAhorro = (c) => /ahorro/i.test(c.titulo);
const cuentaDeAhorro = () => deTipo("cuenta").find(esAhorro);
// La cuenta del día a día: la primera que no es de ahorro ni la Junaeb (que solo sirve para comida).
const cuentaDiaria = () => deTipo("cuenta").find((c) => !esAhorro(c) && !/junaeb/i.test(c.titulo)) ?? deTipo("cuenta").find((c) => !esAhorro(c));
const areaDeFinanzas = () => areaDe(deTipo("cuenta")[0]?.id ?? deTipo("categoria")[0]?.id ?? "");

// Cada cuenta con su saldo. «Ajustar» deja escribir lo que dice el banco: se corrige el saldo inicial para que cuadre
// (así no se inventa ningún movimiento).
export function cuentas(v, ctx) {
  v.classList.add("w-finanzas");
  return () => {
    const lista = deTipo("cuenta");
    v.sub.textContent = lista.length ? "en total " + plata(lista.reduce((s, c) => s + saldo(c), 0)) : "";
    if (!lista.length) return v.replaceChildren(v.firstChild, el("p", { className: "vacio", textContent: "Crea tus cuentas (débito, ahorro...) con «+ Nuevo» para ver aquí cuánto tienes." }));
    v.replaceChildren(v.firstChild, el("div", { className: "cuentas" }, ...lista.map((c) => {
      const ajustando = ctx.ajustando === c.id;
      const campo = el("input", { type: "number", step: "1", value: Math.round(saldo(c)), ariaLabel: "Saldo real de " + c.titulo });
      const guardar = (e) => {
        e.preventDefault();
        const real = Number(campo.value);
        ctx.ajustando = null;
        if (Number.isFinite(real)) cambiarProps(c, { saldo_inicial: (Number(c.props?.saldo_inicial) || 0) + real - saldo(c) });
        else ctx.cambiar({});
      };
      return el("div", { className: "cuenta" },
        el("span", { className: "insignia" }, icono(elegir(c.titulo, ICONOS_CUENTA, "billetera"))), el("b", { textContent: c.titulo }),
        ajustando ? el("form", { className: "ajustar-saldo", onsubmit: guardar }, campo, el("button", { className: "principal", textContent: "Listo" }))
          : el("span", { className: "monto" + (saldo(c) < 0 ? " pasada" : ""), textContent: plata(saldo(c)) }),
        ajustando ? "" : el("button", { className: "enlace", textContent: "Ajustar", onclick: () => ctx.cambiar({ ajustando: c.id }) }));
    })));
    v.querySelector(".ajustar-saldo input")?.focus();
  };
}

// Apartar: una transferencia de tu cuenta del día a día a la de ahorro. Si tienes un objetivo de ahorro, se le suma.
const MONTOS = [5000, 10000, 15000];
const objetivoAbierto = () => { const o = objetivoDeAhorro(); return o && vaEn(o) < Number(o.props.meta) ? o : null; }; // uno ya cumplido no suma más
async function moverAAhorro(monto, desde, fecha) {
  const o = objetivoAbierto();
  const ok = await escribir(db.from("registros").insert({ clase: "transferencia", titulo: o ? "Apartado para " + o.titulo : "Apartado", valor: monto, unidad: "CLP",
    nodo_id: desde.id, otro_id: cuentaDeAhorro().id, props: o ? { objetivo: o.id } : {}, ...(fecha && { fecha }) }));
  if (ok && o) cambiarProps(o, { actual: vaEn(o) + monto });
  return ok;
}
export function apartar(v, ctx) {
  v.classList.add("w-finanzas");
  return () => {
    const desde = cuentaDiaria(), hacia = cuentaDeAhorro(), o = objetivoAbierto();
    if (!desde || !hacia) return v.replaceChildren(v.firstChild, el("p", { className: "vacio", textContent: "Para apartar necesitas una cuenta «Ahorro» y otra para el día a día." }));
    v.sub.textContent = `de ${desde.titulo} a ${hacia.titulo}`;
    const monto = ctx.monto ?? MONTOS[0];
    const otro = el("input", { type: "number", min: "1", step: "1", placeholder: "Otro monto", value: MONTOS.includes(monto) ? "" : monto, ariaLabel: "Otro monto",
      onchange: (e) => ctx.cambiar({ monto: Number(e.target.value) || MONTOS[0] }) });
    // Lo que más apartas (el monto que más se repite), como recordatorio.
    const veces = new Map();
    for (const r of datos.registros) if (r.clase === "transferencia" && r.otro_id === hacia.id) veces.set(valor(r), (veces.get(valor(r)) ?? 0) + 1);
    const costumbre = [...veces].sort((a, b) => b[1] - a[1])[0];
    v.replaceChildren(v.firstChild,
      el("div", { className: "montos", role: "group", ariaLabel: "Cuánto apartar" }, ...MONTOS.map((x) =>
        el("button", { textContent: plata(x), ariaPressed: String(x === monto), onclick: () => ctx.cambiar({ monto: x }) })), otro),
      costumbre ? el("p", { className: "vacio", textContent: `Lo que más apartas: ${plata(costumbre[0])} (${costumbre[1]} ${costumbre[1] === 1 ? "vez" : "veces"}).` }) : "",
      el("button", { className: "principal", textContent: `Apartar ${plata(monto)}` + (o ? ` para «${o.titulo}»` : ""), onclick: async () => {
        await moverAAhorro(monto, desde);
        ctx.monto = null;
      } }));
  };
}

// El objetivo de ahorro: cuánto llevas, cuánto falta y cuánto apartar por semana para llegar a la fecha.
// Cumplido, ofrece usar la plata (sale de la cuenta de ahorro y el objetivo queda Hecho) o crear otro.
// Abajo, los que ya lograste.
const vaEn = (o) => Number(o.props?.actual ?? o.props?.inicio) || 0;
const enPesos = (n) => n.tipos.clave === "objetivo" && /^(clp|\$|pesos)$/i.test(n.props?.unidad ?? "");
const nuevoObjetivo = (texto) => el("button", { className: "enlace", textContent: texto, onclick: () => {
  const area = areaDeFinanzas();
  formulario(null, { tipo: "objetivo", valores: { unidad: "CLP" }, conexion: area && dentroDeCaja("objetivo", area) });
} });
export function objetivoAhorro(v) {
  v.classList.add("w-finanzas");
  return () => {
    const o = objetivoDeAhorro(), logrados = datos.nodos.filter((n) => enPesos(n) && n.estado === "Hecho");
    v.sub.replaceChildren(nuevoObjetivo("+ Objetivo de ahorro"));
    const lista = logrados.length ? el("div", { className: "logrados" }, el("b", { textContent: "Logrados" }),
      ...logrados.map((n) => el("span", {}, icono("si"), n.titulo, el("small", { textContent: plata(Number(n.props?.meta) || vaEn(n)) })))) : "";
    if (!o) return v.replaceChildren(v.firstChild, el("p", { className: "vacio", textContent: "No tienes un objetivo de ahorro. Crea uno con «+ Objetivo de ahorro» (unidad CLP)." }), lista);
    const meta = Number(o.props.meta), va = vaEn(o), falta = meta - va, hoy = hoyTexto(), tope = o.fecha && dia(o.fecha);
    const semanas = tope ? diasEntre(hoy, tope) / 7 : null, logrado = falta <= 0;
    const fila = (nombre, x) => el("div", { className: "pie-kcal" }, el("span", { textContent: nombre }), el("b", { textContent: x }));
    const ahorro = cuentaDeAhorro();
    v.replaceChildren(v.firstChild,
      el("h4", { className: "titulo-objetivo" }, o.titulo, tope ? el("small", { textContent: " · hasta el " + new Date(tope + "T12:00").toLocaleDateString("es-CL", { day: "numeric", month: "long" }) }) : ""),
      el("div", { className: "kcal-grande" }, el("b", { textContent: plata(va) }), el("span", { textContent: "de " + plata(meta) })),
      barra(va / (meta || 1)),
      ...(logrado ? [el("p", { className: "frase-finanzas" }, `¡Lo lograste! Juntaste ${plata(va)}.`),
        el("div", { className: "botones" },
          el("button", { className: "principal", textContent: "Usar la plata", onclick: async () => {
            // La plata sale de la cuenta de ahorro (una transferencia sin destino) y el objetivo queda Hecho, no se borra.
            const ok = !ahorro || await escribir(db.from("registros").insert({ clase: "transferencia", titulo: "Usé: " + o.titulo, valor: va, unidad: "CLP", nodo_id: ahorro.id, props: { objetivo: o.id } }));
            if (ok) cambiar(o, { estado: "Hecho" });
          } }),
          el("button", { textContent: "Ya está, sin usarla", onclick: () => cambiar(o, { estado: "Hecho" }) }))]
        : [fila("Te faltan", plata(falta)),
          semanas === null ? "" : semanas <= 0 ? fila("La fecha", "ya pasó")
            : [fila("Quedan", Math.ceil(semanas) === 1 ? "1 semana" : Math.ceil(semanas) + " semanas"), fila("Para llegar, aparta", plata(falta / Math.max(1, semanas)) + " por semana")]].flat()),
      el("div", { className: "botones" }, el("button", { className: "enlace", textContent: "Editar", onclick: () => formulario(o) })),
      lista);
  };
}

// Lo que entró y salió de la cuenta de ahorro, del más nuevo al más viejo (los últimos 8), y el total de cada cosa.
export function historialAhorro(v) {
  v.classList.add("w-finanzas");
  return () => {
    const a = cuentaDeAhorro();
    if (!a) return v.replaceChildren(v.firstChild, el("p", { className: "vacio", textContent: "Crea una cuenta «Ahorro» para ver aquí lo que apartas." }));
    const lista = datos.registros.filter((r) => r.clase === "transferencia" && (r.nodo_id === a.id || r.otro_id === a.id) || ["ingreso", "gasto"].includes(r.clase) && r.nodo_id === a.id);
    const entra = (r) => r.otro_id === a.id || r.clase === "ingreso";
    const aparte = sumar(lista.filter(entra)), saque = sumar(lista.filter((r) => !entra(r)));
    v.sub.textContent = lista.length ? `apartaste ${plata(aparte)} · sacaste ${plata(saque)}` : "";
    v.replaceChildren(v.firstChild, lista.length ? el("ul", { className: "movimientos" }, ...lista.slice(-8).reverse().map((r) => el("li", { className: "movimiento" + (entra(r) ? " entra" : "") },
      el("span", { className: "insignia" }, icono(entra(r) ? "monedas" : "flecha")),
      el("span", {}, el("b", { textContent: r.titulo || (entra(r) ? "Apartado" : "Sacado") }), el("small", { textContent: diaCorto(dia(r.fecha)) })),
      el("b", { className: "monto", textContent: (entra(r) ? "+" : "−") + plata(valor(r)) }))))
      : el("p", { className: "vacio", textContent: "Todavía no apartas nada." }));
  };
}

// ---------- la ventana «Anotar» (paso 86) ----------
// Una ventana flotante para anotar en segundos: un gasto (cuánto, en qué categoría, con qué cuenta), un ingreso
// o plata que mueves al ahorro. Abajo te dice cómo quedarías antes de anotar. Anotado, la ventana se cierra.
const TIPOS_ANOTAR = { gasto: ["Gasto", BLOQUE_GASTOS], ingreso: ["Ingreso", BLOQUE_GASTOS], ahorro: ["Mover a ahorro", BLOQUE_AHORRO] };
export function anotar(tipo = "gasto") {
  const f = { tipo, monto: 0, categoria: null, cuenta: null, titulo: "", ayer: false };
  const cuerpo = el("div", { className: "anotar" });
  const d = flotante("Anotar", cuerpo);
  d.classList.add("w-finanzas");
  const campoMonto = el("input", { type: "text", inputMode: "numeric", placeholder: "$0", ariaLabel: "¿Cuánto?", autocomplete: "off",
    oninput: () => { f.monto = Number(campoMonto.value.replace(/\D/g, "")) || 0; campoMonto.value = f.monto ? plata(f.monto) : ""; pie(); } });
  const campoTitulo = el("input", { type: "text", placeholder: "Ej. almuerzo casino", oninput: () => { f.titulo = campoTitulo.value; } });
  const linea = el("p", { className: "frase-finanzas", ariaLive: "polite" }), boton = el("button", { className: "principal anotar-boton", onclick: guardar });
  const cuentasPara = () => deTipo("cuenta").filter((c) => f.tipo !== "ahorro" || !esAhorro(c));
  function pie() {
    const s = semana(lunes(hoyTexto())), c = f.categoria, cuenta = datos.nodo.get(f.cuenta);
    const enCat = c ? sumar(s.gastos.filter((r) => r.otro_id === c.id)) + f.monto : 0, tope = Number(c?.props?.presupuesto_semanal) || 0;
    linea.className = "frase-finanzas" + (f.tipo === "gasto" && s.quedan - f.monto < 0 ? " mal" : "");
    linea.textContent = f.tipo === "gasto" ? `Te quedarían ${plata(s.quedan - f.monto)} esta semana` + (tope ? ` · ${c.titulo} ${plata(enCat)} de ${plata(tope)}` : "")
      : f.tipo === "ingreso" ? (cuenta ? `${cuenta.titulo} quedaría en ${plata(saldo(cuenta) + f.monto)}` : "")
      : objetivoAbierto() ? `«${objetivoAbierto().titulo}» quedaría en ${plata(vaEn(objetivoAbierto()) + f.monto)} de ${plata(Number(objetivoAbierto().props.meta))}`
      : `Tu ahorro quedaría en ${plata(saldo(cuentaDeAhorro()) + f.monto)}`;
    const falta = !f.monto ? "Escribe cuánto" : f.tipo === "gasto" && !f.categoria ? "Elige en qué" : !f.cuenta ? "Elige la cuenta" : "";
    boton.disabled = !!falta;
    boton.textContent = falta || `Anotar ${plata(f.monto)}`;
  }
  function dibujar() {
    const [, color] = TIPOS_ANOTAR[f.tipo];
    d.style.setProperty("--bloque", color);
    if (!cuentasPara().some((c) => c.id === f.cuenta)) f.cuenta = cuentaDiaria()?.id ?? cuentasPara()[0]?.id ?? null;
    if (f.tipo === "ahorro" && !cuentaDeAhorro()) return cuerpo.replaceChildren(el("p", { className: "vacio", textContent: "Crea una cuenta «Ahorro» para mover plata a ella." }));
    const opcion = (activa, texto, alTocar, hijos = []) => el("button", { type: "button", ariaPressed: String(activa), onclick: () => { alTocar(); dibujar(); } }, ...hijos, texto);
    cuerpo.replaceChildren(
      el("div", { className: "segmento tipos-anotar", role: "group", ariaLabel: "Qué anotas" }, ...Object.entries(TIPOS_ANOTAR).map(([k, [nombre]]) =>
        opcion(f.tipo === k, nombre, () => { f.tipo = k; }))),
      el("label", { className: "monto-grande" }, el("span", { textContent: "¿Cuánto?" }), campoMonto),
      f.tipo === "gasto" ? el("div", { className: "grupo-anotar" }, el("b", { textContent: "¿En qué?" }),
        el("div", { className: "baldosas", role: "group", ariaLabel: "Categoría" }, ...categorias().map((c) =>
          opcion(f.categoria?.id === c.id, c.titulo, () => { f.categoria = c; }, [icono(iconoDe(c))])))) : "",
      el("div", { className: "grupo-anotar" }, el("b", { textContent: f.tipo === "gasto" ? "¿Con qué pagaste?" : f.tipo === "ingreso" ? "¿A qué cuenta?" : "¿Desde qué cuenta?" }),
        el("div", { className: "montos", role: "group", ariaLabel: "Cuenta" }, ...cuentasPara().map((c) => opcion(f.cuenta === c.id, c.titulo, () => { f.cuenta = c.id; })))),
      f.tipo === "ahorro" ? "" : el("label", { className: "grupo-anotar" }, el("b", {}, "¿Qué fue? ", el("small", { textContent: "(opcional)" })), campoTitulo),
      linea,
      el("div", { className: "pie-anotar" }, el("div", { className: "segmento", role: "group", ariaLabel: "Cuándo" },
        opcion(!f.ayer, "Hoy", () => { f.ayer = false; }), opcion(f.ayer, "Ayer", () => { f.ayer = true; })), boton));
    pie();
  }
  async function guardar() {
    boton.disabled = true;
    const fecha = f.ayer ? new Date(Date.now() - 864e5).toISOString() : undefined, cuenta = datos.nodo.get(f.cuenta);
    const ok = f.tipo === "ahorro" ? await moverAAhorro(f.monto, cuenta, fecha)
      : await escribir(db.from("registros").insert({ clase: f.tipo, titulo: f.titulo.trim() || (f.tipo === "gasto" ? f.categoria.titulo : "Ingreso"), valor: f.monto, unidad: "CLP",
        nodo_id: cuenta.id, otro_id: f.tipo === "gasto" ? f.categoria.id : null, ...(fecha && { fecha }) }));
    ok ? d.close() : pie();
  }
  dibujar();
  campoMonto.focus();
}
const botonAnotar = (texto = "+ Anotar", tipo) => el("button", { className: "enlace", textContent: texto, ariaHasPopup: "dialog", onclick: () => anotar(tipo) });

// ---------- las suscripciones (paso 85) ----------
// El día de cobro y el último cobro salen de tus gastos: el más nuevo cuyo título nombra la suscripción
// (ej. «Compra Spotify Las Condes» es de Spotify).
const activas = () => deTipo("suscripcion").filter((s) => s.props?.activa !== false);
const pausadas = () => deTipo("suscripcion").filter((s) => s.props?.activa === false);
const alMes = (s) => (Number(s.props?.precio) || 0) / (s.props?.periodo === "Anual" ? 12 : 1);
export const totalAlMes = () => activas().reduce((t, s) => t + alMes(s), 0);
const sinTildes = (t) => (t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const palabra = (s) => sinTildes(s.titulo).split(/\s+/)[0];
const esDe = (s, r) => r.clase === "gasto" && sinTildes(r.titulo).includes(palabra(s));
const ultimoCobro = (s) => datos.registros.findLast((r) => esDe(s, r));
// El próximo día de cobro (desde hoy), si sabemos qué día del mes cobra.
function proximoCobro(s) {
  const u = ultimoCobro(s);
  if (!u) return null;
  const n = Number(dia(u.fecha).slice(8)), hoy = hoyTexto();
  const en = (mes) => { const fin = Number(sumarDias(sumarDias(mes + "-01", 32).slice(0, 8) + "01", -1).slice(8)); return `${mes}-${String(Math.min(n, fin)).padStart(2, "0")}`; };
  const este = en(hoy.slice(0, 7));
  return este >= hoy ? este : en(sumarDias(hoy.slice(0, 8) + "01", 32).slice(0, 7));
}
const letra = (s) => el("span", { className: "insignia letra", textContent: s.titulo.trim()[0]?.toUpperCase() ?? "?" });

// Este mes: lo que se va al mes, el calendario con los días de cobro y cuál viene.
export function esteMes(v) {
  v.classList.add("w-finanzas");
  return () => {
    const hoy = hoyTexto(), inicio = hoy.slice(0, 8) + "01", lista = activas();
    const cobros = new Map(lista.map((s) => [proximoCobro(s), s]).filter(([d]) => d?.startsWith(hoy.slice(0, 7))));
    const pasados = new Map(lista.map((s) => [ultimoCobro(s), s]).filter(([r]) => r && dia(r.fecha).startsWith(hoy.slice(0, 7))).map(([r, s]) => [dia(r.fecha), s]));
    const siguiente = lista.map((s) => [proximoCobro(s), s]).filter(([d]) => d).sort()[0];
    const dias = Number(sumarDias(sumarDias(inicio, 32).slice(0, 8) + "01", -1).slice(8)), vacios = (new Date(inicio + "T12:00").getDay() + 6) % 7;
    v.replaceChildren(
      el("div", { className: "kcal-grande" }, el("b", { textContent: plata(totalAlMes()) }), el("span", { textContent: `al mes · unos ${plata(totalAlMes() * 12 / 52)} por semana` })),
      el("div", { className: "mes-cobros", role: "img", ariaLabel: "Días de cobro de este mes" },
        ...["L", "M", "M", "J", "V", "S", "D"].map((x) => el("small", { textContent: x })),
        ...Array.from({ length: vacios }, () => el("span")),
        ...Array.from({ length: dias }, (_, i) => {
          const d = inicio.slice(0, 8) + String(i + 1).padStart(2, "0"), s = cobros.get(d) ?? pasados.get(d);
          return el("span", { className: [s && (d < hoy ? "cobrado" : "cobro"), d === hoy && "es-hoy"].filter(Boolean).join(" "), title: s ? s.titulo : "", textContent: i + 1 });
        })),
      siguiente ? el("p", { className: "frase-finanzas" }, `El próximo cobro es ${siguiente[1].titulo}, el ${diaCorto(siguiente[0])}: unos ${plata(Number(siguiente[1].props?.precio) || 0)}.`)
        : el("p", { className: "vacio", textContent: "Cuando aparezca un cobro en tus gastos, aquí sale su día." }));
  };
}

// Las activas: cuánto cuesta cada una, qué día cobra y, si el último cobro fue distinto, cuánto fue. «Pausar» la desactiva.
export function suscripciones(v) {
  v.classList.add("w-finanzas");
  return () => {
    const lista = activas().sort((a, b) => alMes(b) - alMes(a));
    v.sub.replaceChildren(el("button", { className: "enlace", textContent: "+ Suscripción", onclick: () => formulario(null, { tipo: "suscripcion", valores: { activa: true, periodo: "Mensual" }, conexion: categoriaDeSuscripciones() }) }));
    v.replaceChildren(v.firstChild, lista.length ? el("ul", { className: "movimientos" }, ...lista.map((s) => {
      const u = ultimoCobro(s), precio = Number(s.props?.precio) || 0;
      const detalle = [u ? `el ${Number(dia(u.fecha).slice(8))} de cada ${s.props?.periodo === "Anual" ? "año" : "mes"}` : s.props?.periodo ?? "Mensual",
        u && Math.round(valor(u)) !== precio ? `el último cobro fue ${plata(valor(u))}` : ""].filter(Boolean).join(" · ");
      return el("li", { className: "movimiento" }, letra(s),
        el("span", {}, el("b", { textContent: s.titulo }), el("small", { textContent: detalle })),
        el("span", { className: "monto-y-boton" }, el("b", { className: "monto", textContent: plata(precio) }),
          el("button", { className: "enlace", textContent: "Pausar", onclick: () => cambiarProps(s, { activa: false }) })));
    })) : el("p", { className: "vacio", textContent: "No tienes suscripciones activas." }));
  };
}
const categoriaDeSuscripciones = () => { const c = categorias().find((x) => /suscrip/i.test(x.titulo)); return c && dentroDeCaja("suscripcion", c.id); };

// Cobros de tus gastos que parecen suscripción y no están en tu lista: los que dicen SUB (suscripción, en el aviso del banco)
// o los que se repiten con el mismo nombre en dos meses distintos. «Agregar» la crea; «No es» la olvida (en este navegador).
const OLVIDADAS = "suscripciones-olvidadas";
const olvidadas = () => { try { return JSON.parse(localStorage.getItem(OLVIDADAS) || "[]"); } catch { return []; } };
const nombreDe = (r) => (r.titulo ?? "").replace(/^(compra|pago|cargo)\s+/i, "").replace(/^(dl|ks|flow)\*\s*/i, "").trim();
function detectadas() {
  const tuyas = deTipo("suscripcion"), fuera = new Set([...olvidadas(), ...categorias().map((c) => sinTildes(c.titulo)), "transferencia"]), grupos = new Map();
  for (const r of datos.registros) if (r.clase === "gasto" && !tuyas.some((s) => esDe(s, r))) {
    const k = sinTildes(nombreDe(r)).split(/\s+/).slice(0, 2).join(" ");
    if (k && !fuera.has(k)) grupos.set(k, [...(grupos.get(k) ?? []), r]);
  }
  // Parece suscripción si el banco dice SUB, o si cobra lo mismo (±15%) una sola vez al mes, en dos meses o más.
  const parece = (rs) => {
    if (rs.some((r) => /\bsub\b|suscrip/i.test(`${r.titulo} ${r.props?.notas ?? ""}`))) return true;
    const meses = new Set(rs.map((r) => dia(r.fecha).slice(0, 7))), montos = rs.map(valor);
    return meses.size >= 2 && meses.size === rs.length && Math.max(...montos) <= Math.min(...montos) * 1.15;
  };
  return [...grupos].filter(([, rs]) => parece(rs)).map(([k, rs]) => ({ k, r: rs.at(-1) }));
}
export function suscripcionesDetectadas(v, ctx) {
  v.classList.add("w-finanzas");
  return () => {
    const lista = detectadas();
    v.replaceChildren(v.firstChild, lista.length ? el("ul", { className: "movimientos" }, ...lista.map(({ k, r }) => el("li", { className: "movimiento detectada" },
      el("span", { className: "insignia letra", textContent: nombreDe(r)[0]?.toUpperCase() ?? "?" }),
      el("span", {}, el("b", { textContent: `${nombreDe(r)} · ${plata(valor(r))}` }), el("small", { textContent: `cobrado el ${diaCorto(dia(r.fecha))}. ¿Es una suscripción?` })),
      el("span", { className: "botones" },
        el("button", { className: "principal", textContent: "Agregar", onclick: () => formulario(null, { tipo: "suscripcion",
          valores: { titulo: nombreDe(r).replace(/\s+sub$/i, ""), precio: Math.round(valor(r)), periodo: "Mensual", activa: true }, conexion: categoriaDeSuscripciones() }) }),
        el("button", { textContent: "No es", onclick: () => { try { localStorage.setItem(OLVIDADAS, JSON.stringify([...olvidadas(), k])); } catch {} ctx.cambiar({}); } })))))
      : el("p", { className: "vacio", textContent: "Nada nuevo: todos los cobros que se repiten ya están en tu lista." }));
  };
}

// En un año: lo que se va si nada cambia, y qué parte es de cada una.
const TONOS = [100, 70, 45, 28, 16]; // de la más cara a la más barata, el color del bloque cada vez más suave
export function enUnAno(v) {
  v.classList.add("w-finanzas");
  return () => {
    const lista = activas().sort((a, b) => alMes(b) - alMes(a)), total = totalAlMes() * 12;
    if (!lista.length) return v.replaceChildren(v.firstChild, el("p", { className: "vacio", textContent: "Sin suscripciones activas." }));
    const parte = (s, i) => { const x = el("span"); x.style.width = alMes(s) * 12 / total * 100 + "%"; x.style.setProperty("--tono", TONOS[Math.min(i, TONOS.length - 1)] + "%"); return x; };
    v.replaceChildren(v.firstChild,
      el("div", { className: "kcal-grande izquierda" }, el("b", { textContent: plata(total) }), el("span", { textContent: "al año" })),
      el("div", { className: "partes" }, ...lista.map(parte)),
      el("div", { className: "leyenda-partes" }, ...lista.map((s, i) => { const x = el("span", {}, el("i"), `${s.titulo} ${Math.round(alMes(s) * 12 / total * 100)}%`); x.style.setProperty("--tono", TONOS[Math.min(i, TONOS.length - 1)] + "%"); return x; })));
  };
}

// Pausadas: las que no cobran ahora. «Activar» la vuelve a sumar.
export function suscripcionesPausadas(v) {
  v.classList.add("w-finanzas");
  return () => {
    const lista = pausadas();
    v.sub.textContent = lista.length ? `si las activas: +${plata(lista.reduce((t, s) => t + alMes(s), 0))} al mes` : "";
    v.replaceChildren(v.firstChild, lista.length ? el("ul", { className: "movimientos" }, ...lista.map((s) => el("li", { className: "movimiento pausada" }, letra(s),
      el("span", {}, el("b", { textContent: s.titulo }), el("small", { textContent: `${plata(Number(s.props?.precio) || 0)} ${s.props?.periodo === "Anual" ? "al año" : "al mes"}` })),
      el("button", { className: "enlace", textContent: "Activar", onclick: () => cambiarProps(s, { activa: true }) }))))
      : el("p", { className: "vacio", textContent: "Ninguna pausada." }));
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
export const objetivoDeAhorro = () => datos.nodos.find((n) => enPesos(n) && n.estado !== "Hecho" && Number(n.props?.meta) > 0);
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
  const n = activas().length, prox = activas().map((s) => [proximoCobro(s), s]).filter(([d]) => d).sort()[0];
  return { dato: plata(totalAlMes()) + " al mes", detalle: prox ? `Próximo: ${prox[1].titulo} · ${diaCorto(prox[0])}` : n === 1 ? "1 activa" : `${n} activas` };
}

export const BLOQUES = {
  gastos: { bloque: "Gastos", icono: "billetera", color: BLOQUE_GASTOS, resumen: resumenGastos },
  ahorro: { bloque: "Ahorro", icono: "monedas", color: BLOQUE_AHORRO, resumen: resumenAhorro },
  suscripciones: { bloque: "Suscripciones", icono: "repetir", color: BLOQUE_SUSCRIPCIONES, resumen: resumenSuscripciones },
};
