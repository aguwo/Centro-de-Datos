// Paso 102: las formas. Cada categoría (un tipo de la base) dice cómo se ve en su "apariencia" (columna de la tabla tipos):
//   icono     su ícono (un nombre de dibujos.js). Un nodo puede tener el suyo (props.icono) y gana.
//   forma     una de FORMAS (abajo). Sin forma, la tarjeta de siempre.
//   registro  (anillo y medidor) la clase de registro que cuenta, ej. "habito" o "riego"
//   cada      (medidor) la propiedad con cada cuántos días toca, ej. "aguanta_dias"
//   accion    (medidor, opcional) lo que dice su botón, ej. "Regué". Sin esto, «Anotar».
// Ninguna forma sabe de una categoría en particular: todo lo que necesitan lo dice la apariencia.
// Tocar cualquier forma abre la ficha del nodo; su botón (si tiene) hace lo típico sin abrirla.
// Agregar una forma = escribir su función y anotarla en FORMAS.
import { el, datos, dia, hora, colorDe } from "./base.js";
import { hoyTexto, sumarDias, diasEntre, corto } from "./fechas.js";
import { completar, reabrir, alternarRegistro } from "./acciones.js";
import { proximaVez } from "./agenda.js";
import { mostrarPanel } from "./panel.js";
import { icono, insignia } from "./dibujos.js";

export const aparienciaDe = (n) => datos.tipo.get(n.tipos.clave)?.apariencia ?? {};
export const iconoDe = (n) => n.props?.icono ?? aparienciaDe(n).icono ?? "puntos";

// El marco de toda forma: lo de adelante (un botón o un dibujo), y el resto, que abre la ficha.
function marco(n, forma, adelante, ...cuerpo) {
  const m = el("div", { className: "forma f-" + forma }, adelante ?? "",
    el("button", { className: "abrir-forma", onclick: () => mostrarPanel(n.id) }, ...cuerpo));
  m.style.setProperty("--c", colorDe(n.tipos.clave));
  return m;
}
const nombre = (n, detalle) => el("span", { className: "texto-forma" }, el("b", { textContent: n.titulo }), detalle ? el("small", { textContent: detalle }) : "");
const marcasDe = (n, clase) => datos.registros.filter((r) => r.clase === clase && r.nodo_id === n.id);
const deHoyEn = (marcas) => marcas.find((r) => dia(r.fecha) === hoyTexto());
// Cuándo toca algo con fecha, en palabras: «hoy», «mañana», «atrasada», «en 3 días» o «19/11».
function cuando(d) {
  const k = diasEntre(hoyTexto(), d);
  return k < 0 ? "atrasada" : k === 0 ? "hoy" : k === 1 ? "mañana" : k < 7 ? `en ${k} días` : corto(d);
}

const FORMAS = {
  // La de siempre: su ícono, su nombre y su estado (o su categoría).
  tarjeta: (n) => marco(n, "tarjeta", insignia(iconoDe(n), colorDe(n.tipos.clave)), nombre(n, n.estado ?? n.tipos.nombre)),

  // Lo que tiene estado: un círculo para marcarlo hecho (o volver a abrirlo) y cuándo toca.
  check(n) {
    const hecha = n.estado === "Hecho", d = dia(n.fecha);
    const boton = el("button", { className: "marcar", ariaPressed: String(hecha), title: hecha ? "Volver a abrir" : "Marcar hecho",
      onclick: () => (hecha ? reabrir(n) : completar(n)) }, hecha ? icono("si") : "");
    const m = marco(n, "check", boton, nombre(n, [!hecha && d && cuando(d), n.estado].filter(Boolean).join(" · ")));
    m.classList.toggle("hecha", hecha);
    m.classList.toggle("atrasada", !hecha && !!d && d < hoyTexto());
    return m;
  },

  // Lo que se repite: un anillo con la racha (días seguidos con su registro). Tocarlo marca o desmarca hoy.
  anillo(n) {
    const clase = aparienciaDe(n).registro;
    if (!clase) return FORMAS.tarjeta(n);
    const marcas = marcasDe(n, clase), dias = new Set(marcas.map((r) => dia(r.fecha))), deHoy = deHoyEn(marcas);
    let racha = 0;
    for (let d = deHoy ? hoyTexto() : sumarDias(hoyTexto(), -1); dias.has(d); d = sumarDias(d, -1)) racha++;
    const boton = el("button", { className: "anillo-forma", ariaPressed: String(!!deHoy), title: deHoy ? "Desmarcar hoy" : "Marcar hoy",
      onclick: () => alternarRegistro(clase, n, deHoy) }, el("span", { textContent: racha }));
    boton.style.setProperty("--p", Math.min(racha, 7) / 7); // el anillo se llena en una semana
    return marco(n, "anillo", boton, nombre(n, racha ? `${racha} ${racha === 1 ? "día seguido" : "días seguidos"}` : "Sin racha"));
  },

  // Lo que tiene fecha: una hojita de calendario con su próxima vez (contando los que se repiten).
  calendario(n) {
    const d = proximaVez(n) ?? dia(n.fecha);
    if (!d) return FORMAS.tarjeta(n);
    const [, mes, num] = d.split("-");
    const hoja = el("span", { className: "hojita" }, el("i", { textContent: new Date(2000, mes - 1).toLocaleDateString("es-CL", { month: "short" }).replace(".", "") }), el("b", { textContent: +num }));
    return marco(n, "calendario", hoja, nombre(n, [cuando(d), hora(n.fecha)].filter(Boolean).join(" · ")));
  },

  // Lo que es texto: sus primeras líneas.
  hoja: (n) => marco(n, "hoja", null, el("b", { textContent: n.titulo }), n.contenido ? el("p", { textContent: n.contenido.slice(0, 160) }) : el("small", { textContent: n.tipos.nombre })),

  // Algo que se gasta con el tiempo: los días desde su último registro contra cada cuánto toca (props[cada]).
  // Su botón anota el registro de hoy (o lo borra).
  medidor(n) {
    const { registro: clase, cada, accion = "Anotar" } = aparienciaDe(n), plazo = Number(n.props?.[cada]);
    if (!clase || !plazo) return FORMAS.tarjeta(n);
    const marcas = marcasDe(n, clase), ultimo = marcas.at(-1) && dia(marcas.at(-1).fecha), deHoy = deHoyEn(marcas);
    const quedan = ultimo ? plazo - diasEntre(ultimo, hoyTexto()) : 0;
    const gota = el("span", { className: "gota-forma" }, el("i"));
    gota.style.setProperty("--p", Math.max(0, Math.min(1, quedan / plazo)));
    const texto = !ultimo ? "Nunca anotado" : quedan > 1 ? `Toca en ${quedan} días` : quedan === 1 ? "Toca mañana" : quedan === 0 ? "Toca hoy" : `Atrasado ${-quedan} ${quedan === -1 ? "día" : "días"}`;
    const m = marco(n, "medidor", gota, nombre(n, texto));
    m.classList.toggle("atrasada", quedan < 0 || !ultimo);
    m.append(el("button", { className: "accion-forma", ariaPressed: String(!!deHoy), textContent: deHoy ? "✓ " + accion : accion,
      onclick: () => alternarRegistro(clase, n, deHoy) }));
    return m;
  },

  // Lo que tiene imagen (una propiedad de tipo imagen) o es un libro o película: su portada o un lomo de color, y su estado.
  portada(n) {
    const foto = (datos.tipo.get(n.tipos.clave)?.propiedades ?? []).filter((p) => p.tipo === "imagen").map((p) => n.props?.[p.clave]).find((u) => /^https?:\/\//.test(u ?? ""));
    const tapa = foto ? el("img", { className: "tapa-forma", src: foto, alt: "", loading: "lazy" }) : el("span", { className: "tapa-forma" });
    return marco(n, "portada", tapa, nombre(n, n.estado ?? n.tipos.nombre));
  },
};

// La forma de un nodo, según su categoría.
export const formaDe = (n) => (FORMAS[aparienciaDe(n).forma] ?? FORMAS.tarjeta)(n);
