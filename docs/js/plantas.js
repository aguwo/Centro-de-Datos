// Las plantas con sed (paso 99, antes una tarjeta del Resumen): las que ya pasaron los días que aguantan sin agua
// desde su último riego (o que nunca regaste), y las que regaste hoy. Tocar una anota el riego (o lo borra).
import { el, datos, dia } from "./base.js";
import { hoyTexto, sumarDias } from "./fechas.js";
import { alternarRegistro } from "./acciones.js";
import { icono } from "./dibujos.js";

const VERDE = "#16a34a";
// Las vivas que dicen cuánto aguantan sin agua (las muertas o por comprar no cuentan).
const vivas = () => datos.nodos.filter((p) => p.tipos.clave === "planta" && p.props?.aguanta_dias && !["Q.E.P.D.", "Por comprar"].includes(p.props.salud));
const riegosDe = (p) => datos.registros.filter((r) => r.clase === "riego" && r.nodo_id === p.id);

export function plantasConSed(v) {
  v.style.setProperty("--bloque", VERDE); // el color de la casilla marcada (usa los botones de «Hábitos de hoy»)
  return () => {
    const hoy = hoyTexto(), todas = vivas();
    const lista = todas.map((p) => {
      const riegos = riegosDe(p), ultimo = riegos.at(-1) && dia(riegos.at(-1).fecha);
      return { p, deHoy: riegos.find((r) => dia(r.fecha) === hoy), toca: ultimo ? sumarDias(ultimo, p.props.aguanta_dias) : "" };
    }).filter((x) => x.deHoy || x.toca <= hoy).sort((a, b) => a.toca.localeCompare(b.toca));
    v.sub.textContent = todas.length ? `${lista.filter((x) => !x.deHoy).length} de ${todas.length}` : "";
    v.replaceChildren(v.firstChild, lista.length ? el("div", { className: "habitos-rapidos" }, ...lista.map(({ p, deHoy }) =>
      el("button", { className: "habito-rapido" + (deHoy ? " hecho" : ""), ariaPressed: String(!!deHoy), onclick: () => alternarRegistro("riego", p, deHoy) },
        el("span", { className: "check" }, deHoy ? icono("si") : ""), el("span", { textContent: p.titulo }))))
      : el("p", { className: "vacio", textContent: "Todas tus plantas están bien regadas." }));
  };
}
