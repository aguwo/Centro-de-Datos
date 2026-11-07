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
//   suscripciones  las suscripciones activas y cuánto suman al mes
//
// De dónde sale cada cosa:
//   gastos e ingresos   registros "gasto" e "ingreso": nodo_id = la cuenta, otro_id = la categoría (si la tiene)
//   presupuesto         la suma del "Presupuesto semanal" de tus categorías (la semana va de lunes a domingo)
//   saldo de una cuenta su "Saldo inicial" + lo que entró − lo que salió, con las transferencias entre cuentas
//                       (registros "transferencia": de nodo_id hacia otro_id)
import { el, db, datos, dia, escribir, areaDe } from "./base.js";
import { hoyTexto, sumarDias, diasEntre, lunes } from "./fechas.js";
import { icono, elegir } from "./dibujos.js";
import { cambiar, cambiarProps, dentroDeCaja } from "./acciones.js";
import { formulario } from "./panel.js";

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
export function apartar(v, ctx) {
  v.classList.add("w-finanzas");
  return () => {
    const desde = cuentaDiaria(), hacia = cuentaDeAhorro(), meta = objetivoDeAhorro(), o = meta && vaEn(meta) < Number(meta.props.meta) ? meta : null; // uno ya cumplido no suma más
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
        const ok = await escribir(db.from("registros").insert({ clase: "transferencia", titulo: o ? "Apartado para " + o.titulo : "Apartado", valor: monto, unidad: "CLP",
          nodo_id: desde.id, otro_id: hacia.id, props: o ? { objetivo: o.id } : {} }));
        if (ok && o) cambiarProps(o, { actual: vaEn(o) + monto });
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
  const n = activas().length;
  return { dato: plata(totalAlMes()) + " al mes", detalle: n === 1 ? "1 activa" : `${n} activas` };
}

export const BLOQUES = {
  gastos: { bloque: "Gastos", icono: "billetera", color: "#0d9488", resumen: resumenGastos },
  ahorro: { bloque: "Ahorro", icono: "monedas", color: "#d97706", resumen: resumenAhorro },
  suscripciones: { bloque: "Suscripciones", icono: "repetir", color: "#7c3aed", resumen: resumenSuscripciones },
};
