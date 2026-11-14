// Lo que la web le cambia a tus datos. Todas escriben en la base y el tiempo real redibuja todo solo.
// Así cada vista solo dice QUÉ hacer (completar, posponer...) y nunca cómo se escribe.
// Paso 89: cambiar un nodo y anotar o borrar un registro se ven al instante (escribir con alTiro, base.js).
import { db, escribir, datos, avisar, recargar } from "./base.js";
import { conHoraISO } from "./fechas.js";

const nodos = () => db.from("nodos");

// Crea un nodo del tipo dado ("evento", "tarea"...) y, si viene, su primera conexión { relacion, destino_id }.
// Al terminar recarga y abre el nodo nuevo en el panel (enfocar: false para no abrirlo, como un post-it).
// Devuelve su id (o nada si falló).
export async function crear(clave, campos, { conexion, enfocar = true } = {}) {
  const { data, error } = await nodos().insert({ ...campos, tipo_id: datos.tipo.get(clave).id }).select("id").single();
  if (error) return avisar(error.message);
  await conectar(data.id, conexion);
  await recargar(enfocar ? data.id : undefined);
  return data.id;
}
// Conecta un nodo con otro: conexion = { relacion, destino_id }. Sin destino no hace nada.
export async function conectar(origen_id, conexion) {
  if (!conexion?.destino_id) return;
  const { error } = await db.from("conexiones").insert({ origen_id, ...conexion });
  if (error) avisar("La conexión falló: " + error.message);
}
// Con qué conexión algo de tipo "clave" queda dentro de una caja, según lo que permite su tipo:
// una tarea pertenece_a un proyecto, pero trata_sobre un tópico. Devuelve { relacion, destino_id } o nada.
export function dentroDeCaja(clave, destino_id) {
  const caja = datos.nodo.get(destino_id);
  const regla = caja && datos.tipo.get(clave)?.conexiones?.find((c) => c.hacia.includes(caja.tipos.clave));
  return regla ? { relacion: regla.relacion, destino_id } : undefined;
}
// Mover algo a otra caja (como mover_nodos del agente): deja de pertenecer a lo de antes y pasa a pertenecer al destino.
// Las conexiones viejas no se borran: se cierran (valido_hasta), así queda la historia.
export async function mover(n, destino_id, relacion = "pertenece_a") {
  const { error } = await db.from("conexiones").update({ valido_hasta: new Date().toISOString() })
    .eq("origen_id", n.id).eq("relacion", relacion).is("valido_hasta", null);
  if (error) return avisar(error.message);
  return escribir(db.from("conexiones").insert({ origen_id: n.id, relacion, destino_id }));
}
// Quitar una conexión: no se borra, se cierra (valido_hasta), así queda la historia. Se deja de ver al tiro.
export const desconectar = (c) => escribir(db.from("conexiones").update({ valido_hasta: new Date().toISOString() }).eq("id", c.id),
  () => { datos.conexiones = datos.conexiones.filter((x) => x.id !== c.id); });
export const cambiar = (n, cambios) => escribir(nodos().update(cambios).eq("id", n.id), () => {
  if (!cambios.archivado) return Object.assign(datos.nodo.get(n.id) ?? n, cambios);
  datos.nodos = datos.nodos.filter((x) => x.id !== n.id); // archivado: deja de verse
  datos.nodo.delete(n.id);
});

// Cambia solo algunas propiedades (props) y deja las demás. Un valor null borra esa propiedad.
export function cambiarProps(n, cambios) {
  const props = { ...n.props, ...cambios };
  for (const k in props) if (props[k] === null) delete props[k];
  return cambiar(n, { props });
}

// Una tarea repetitiva no se cierra: su fecha salta a la próxima vez que toca.
const SALTO = { Diaria: 1, Semanal: 7, Mensual: 30 };
export function completar(n) {
  const salto = SALTO[n.props?.repeticion];
  return cambiar(n, salto && n.fecha ? { fecha: new Date(new Date(n.fecha).getTime() + salto * 864e5).toISOString() } : { estado: "Hecho" });
}
// Reservarle una hora a algo: el día d desde la hora h (14.5 = 14:30), por "horas" horas.
export const agendar = (n, d, h, horas = 1) =>
  cambiar(n, { fecha: conHoraISO(d, h), props: { ...n.props, fecha_fin: conHoraISO(d, h + horas) } });
export const reabrir = (n) => cambiar(n, { estado: "Por hacer" });
// Soltar = archivar: deja de aparecer, pero se puede recuperar (el agente sabe hacerlo).
export const archivar = (n) => cambiar(n, { archivado: true });

// Anotar un registro (fila = { clase, nodo_id, fecha?, ... }) o borrarlo, al instante.
// El id se inventa aquí (como lo haría la base) para poder borrarlo aunque la base todavía no conteste.
export function anotar(fila) {
  const r = { id: crypto.randomUUID(), fecha: new Date().toISOString(), ...fila };
  return escribir(db.from("registros").insert(r), () =>
    datos.registros.splice(datos.registros.findLastIndex((x) => x.fecha <= r.fecha) + 1, 0, r)); // en su lugar: van del más viejo al más nuevo
}
export const borrarRegistro = (r) =>
  escribir(db.from("registros").delete().eq("id", r.id), () => (datos.registros = datos.registros.filter((x) => x.id !== r.id)));

// Anotar que algo pasó hoy (un hábito cumplido, una planta regada), o borrar esa anotación si ya estaba.
// fecha (opcional, paso 90): ej. { fecha: sinHoraISO("2026-11-08") } lo anota en otro día; sin nada, ahora.
export const alternarRegistro = (clase, nodo, deHoy, fecha) => deHoy ? borrarRegistro(deHoy) : anotar({ clase, nodo_id: nodo.id, ...fecha });
