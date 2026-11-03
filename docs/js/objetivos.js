// Los objetivos (paso 37b, 37c): cómo va cada uno. Se muestran en Productividad, en su área, agrupando lo que les aporta;
// la barra es tu avance y la rayita, "hoy" (cuánto tiempo pasó hasta su fecha tope).
//
// Un objetivo se mide solo, según lo que tenga (paso 37a; no hay que elegir):
//   con registros       tiene medidas anotadas (ej. tu peso): va en la última
//   a mano              tiene Meta: va en lo que escribiste en "Va en" (o en "Desde", si aún no escribes nada)
//   por lo que aporta   no tiene Meta: cuántos de los proyectos y ramos que le aportan ya terminaron bien
//                       (un ramo Reprobado no cuenta). Las tareas no suman: el semestre avanza con cada ramo aprobado.
//                       Lo que nunca termina (ej. un hábito) ayuda, pero no se cuenta.
// Solo lo que se mide con números puede ir "atrasado": un semestre no se aprueba de a poco.
import { datos, dia } from "./base.js";
import { hoyTexto } from "./fechas.js";

const numero = (x) => Number(x).toLocaleString("es-CL", { maximumFractionDigits: 1 });
export const esObjetivo = (n) => n?.tipos.clave === "objetivo" && n.estado !== "Hecho" && n.estado !== "Inbox";
// Lo que le aporta a un objetivo: proyectos, ramos, hábitos, libros...
export const aportesDe = (id) => datos.conexiones.filter((c) => c.relacion === "aporta_a" && c.destino_id === id).map((c) => datos.nodo.get(c.origen_id));

const terminable = (a) => datos.tipo.get(a.tipos.clave)?.propiedades?.some((p) => p.clave === "estado");
const plural = (k, palabra) => `${k} ${palabra}${k === 1 ? "" : "s"}`;

// Cuánto llevas: { avance: 0..1 (o null si no se puede medir), texto, continuo: si se mide con números }.
export function medir(n) {
  const { inicio = 0, meta, unidad = "" } = n.props ?? {};
  const ultima = datos.registros.filter((r) => r.clase === "medida" && r.nodo_id === n.id).at(-1);
  if (typeof meta === "number") {
    const va = Number(ultima?.valor ?? n.props.actual ?? inicio);
    return { avance: (va - inicio) / (meta - inicio || 1), texto: `${numero(va)} de ${numero(meta)} ${unidad}`.trim(), continuo: true };
  }
  const cuentan = aportesDe(n.id).filter(terminable);
  if (!cuentan.length) return { avance: null, texto: "Conéctale lo que le aporta" };
  const hechos = cuentan.filter((a) => a.estado === "Hecho");
  const malos = hechos.filter((a) => a.props?.resultado === "Reprobado").length, buenos = hechos.length - malos;
  return { avance: buenos / cuentan.length, continuo: false,
    texto: `${buenos} de ${cuentan.length} listos` + (malos ? ` · ${plural(malos, "reprobado")}` : "") };
}

// Cuánto tiempo ha pasado, de 0 a 1: desde que lo creaste hasta su fecha tope. Sin fecha tope, null.
export function tiempo(n) {
  const desde = dia(n.creado_en), hasta = dia(n.fecha), hoy = hoyTexto();
  if (!hasta || !desde) return null;
  const total = Date.parse(hasta) - Date.parse(desde);
  return total > 0 ? Math.min(1, Math.max(0, (Date.parse(hoy) - Date.parse(desde)) / total)) : 1;
}

// Todo lo que se muestra de un objetivo: cuánto llevas, cuánto tiempo pasó y si vas atrasado
// (solo si se mide con números y el avance va más de 10 puntos detrás del tiempo: un poco de holgura).
export function comoVa(n) {
  const { avance, texto, continuo } = medir(n), t = tiempo(n);
  return { avance, texto, tiempo: t, atrasado: continuo && t !== null && avance < t - 0.1 };
}
