// Los objetivos (paso 37b, 37c): cómo va cada uno. Se muestran en Productividad, en su área, agrupando lo que les aporta;
// la barra es tu avance y la rayita, "hoy" (cuánto tiempo pasó hasta su fecha tope).
//
// Un objetivo se mide solo, según lo que tenga (paso 37a; no hay que elegir):
//   con registros       tiene medidas anotadas (ej. tu peso): va en la última
//   a mano              tiene Meta: va en lo que escribiste en "Va en" (o en "Desde", si aún no escribes nada)
//   por lo que aporta   no tiene Meta: el promedio de lo que le aporta (un proyecto o ramo terminado cuenta entero;
//                       uno en curso, por sus tareas hechas). Así un semestre avanza con las tareas de cada ramo.
import { datos, dia, cajasDe } from "./base.js";
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

// Todo lo que se muestra de un objetivo: cuánto llevas, cuánto tiempo pasó y si vas atrasado
// (el avance más de 10 puntos detrás del tiempo: un poco de holgura antes de marcarlo).
export function comoVa(n) {
  const { avance, texto } = medir(n), t = tiempo(n);
  return { avance, texto, tiempo: t, atrasado: avance !== null && t !== null && avance < t - 0.1 };
}
