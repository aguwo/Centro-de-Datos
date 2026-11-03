// Los objetivos (paso 37b): una franja arriba de Productividad con una tarjeta por objetivo activo.
// Cada tarjeta muestra cuánto llevas contra cuánto tiempo ha pasado: la barra es tu avance y la rayita, "hoy".
// Si el avance va detrás del tiempo, la tarjeta se marca. Tocar una filtra las tareas de lo que le aporta.
//
// Un objetivo se mide solo, según lo que tenga (paso 37a; no hay que elegir):
//   con registros       tiene medidas anotadas (ej. tu peso): va en la última
//   a mano              tiene Meta: va en lo que escribiste en "Va en" (o en "Desde", si aún no escribes nada)
//   por lo que aporta   no tiene Meta: el promedio de lo que le aporta (un proyecto o ramo terminado cuenta entero;
//                       uno en curso, por sus tareas hechas). Así un semestre avanza con las tareas de cada ramo.
import { el, datos, dia, cajasDe } from "./base.js";
import { hoyTexto } from "./fechas.js";

const numero = (x) => Number(x).toLocaleString("es-CL", { maximumFractionDigits: 1 });
export const esObjetivo = (n) => n?.tipos.clave === "objetivo" && n.estado !== "Hecho" && n.estado !== "Inbox";
// Lo que le aporta a un objetivo: proyectos, ramos, hábitos, libros...
export const aportesDe = (id) => datos.conexiones.filter((c) => c.relacion === "aporta_a" && c.destino_id === id).map((c) => datos.nodo.get(c.origen_id));

// Cuánto lleva algo que aporta: terminado = 1; si no, la parte de sus tareas que está hecha.
function avanceDe(a) {
  if (a.estado === "Hecho") return 1;
  const tareas = datos.nodos.filter((t) => t.tipos.clave === "tarea" && t.estado !== "Inbox" && cajasDe(t.id).includes(a.id));
  return tareas.length ? tareas.filter((t) => t.estado === "Hecho").length / tareas.length : 0;
}

// Cuánto llevas: { avance: 0..1 (o null si no se puede medir), texto }.
export function medir(n) {
  const { inicio = 0, meta, unidad = "" } = n.props ?? {};
  const ultima = datos.registros.filter((r) => r.clase === "medida" && r.nodo_id === n.id).at(-1);
  if (typeof meta === "number") {
    const va = Number(ultima?.valor ?? n.props.actual ?? inicio);
    return { avance: (va - inicio) / (meta - inicio || 1), texto: `${numero(va)} de ${numero(meta)} ${unidad}`.trim() };
  }
  const aportes = aportesDe(n.id);
  if (!aportes.length) return { avance: null, texto: "Conéctale lo que le aporta" };
  const hechos = aportes.filter((a) => a.estado === "Hecho").length;
  const avance = aportes.reduce((suma, a) => suma + avanceDe(a), 0) / aportes.length;
  return { avance, texto: `${hechos} de ${aportes.length} listos · ${Math.round(avance * 100)} %` };
}

// Cuánto tiempo ha pasado, de 0 a 1: desde que lo creaste hasta su fecha tope. Sin fecha tope, null.
export function tiempo(n) {
  const desde = dia(n.creado_en), hasta = dia(n.fecha), hoy = hoyTexto();
  if (!hasta || !desde) return null;
  const total = Date.parse(hasta) - Date.parse(desde);
  return total > 0 ? Math.min(1, Math.max(0, (Date.parse(hoy) - Date.parse(desde)) / total)) : 1;
}

// ---------- la franja ----------
// ctx.filtro es lo que muestra "tareas" (productividad.js): elegir un objetivo lo pone ahí; tocarlo de nuevo vuelve al área.
export function franjaDeObjetivos(v, ctx) {
  const fila = el("div", { className: "franja", role: "group", ariaLabel: "Objetivos" });
  v.append(fila);

  const tarjeta = (n) => {
    const { avance, texto } = medir(n), t = tiempo(n);
    const atrasado = avance !== null && t !== null && avance < t - 0.1; // un poco de holgura antes de marcarlo
    const b = el("button", { className: "objetivo" + (atrasado ? " atrasado" : ""), ariaPressed: String(ctx.filtro === n.id),
      title: t === null ? texto : `${texto} · pasó el ${Math.round(t * 100)} % del tiempo`,
      onclick: () => ctx.cambiar({ filtro: ctx.filtro === n.id ? ctx.area : n.id }) },
      el("span", { className: "nombre", textContent: n.titulo }),
      el("span", { className: "meta", textContent: texto }),
      el("span", { className: "barra-p" }, el("span", { style: `width: ${Math.min(1, Math.max(0, avance ?? 0)) * 100}%` })));
    if (t !== null) b.querySelector(".barra-p").append(el("i", { className: "hoy", style: `left: ${t * 100}%` }));
    return b;
  };

  return () => {
    // Primero los que vencen antes; los sin fecha tope, al final.
    const activos = datos.nodos.filter(esObjetivo).sort((a, b) => (a.fecha ?? "9").localeCompare(b.fecha ?? "9") || a.titulo.localeCompare(b.titulo, "es"));
    v.hidden = !activos.length; // sin objetivos, la franja no ocupa lugar
    fila.replaceChildren(...activos.map(tarjeta));
  };
}
