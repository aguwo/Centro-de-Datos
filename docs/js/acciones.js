// Lo que la web le cambia a tus datos. Todas escriben en la base y el tiempo real redibuja todo solo.
// Así cada vista solo dice QUÉ hacer (completar, posponer...) y nunca cómo se escribe.
// Paso 89: cambiar un nodo y anotar o borrar un registro se ven al instante (escribir con alTiro, base.js).
import { db, escribir, datos, avisar, recargar, cajasDe } from "./base.js";
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
// Paso 105: mover algo a otra carpeta (destino_id; null = afuera de todo), como en el Explorador.
// Se cierran sus conexiones con las cajas donde estaba (las de "dentro de", hacia su camino) y se conecta al destino con
// la relación que pida su tipo (una tarea pertenece_a un proyecto, pero trata_sobre un ramo). Las viejas no se borran:
// se cierran (valido_hasta), así queda la historia. Se ve movido al tiro.
const DENTRO = ["pertenece_a", "trata_sobre"]; // las relaciones que meten algo en una caja (las mismas de la vista arbol)
export function mover(n, destino_id = null) {
  const camino = cajasDe(n.id), viejas = datos.conexiones.filter((c) => c.origen_id === n.id && DENTRO.includes(c.relacion) && camino.includes(c.destino_id));
  const conexion = destino_id && dentroDeCaja(n.tipos.clave, destino_id);
  const escribe = async () => {
    if (viejas.length) {
      const { error } = await db.from("conexiones").update({ valido_hasta: new Date().toISOString() }).in("id", viejas.map((c) => c.id));
      if (error) return { error };
    }
    if (!conexion) return {};
    // La nueva queda en los datos al tiro, así «Deshacer» la puede cerrar antes de que llegue la recarga.
    const r = await db.from("conexiones").insert({ origen_id: n.id, ...conexion }).select("id, origen_id, relacion, destino_id").single();
    if (r.data) datos.conexiones.push(r.data);
    return r;
  };
  return escribir(escribe(), () => {
    datos.conexiones = datos.conexiones.filter((c) => !viejas.includes(c));
    if (destino_id) datos.padre.set(n.id, destino_id); else datos.padre.delete(n.id);
  });
}
// ¿Puede n ir dentro de destino_id? Devuelve por qué no (un texto) o nada si puede.
// Una caja va solo dentro de una más general (un proyecto dentro de un área, no de otro proyecto), nada va dentro
// de sí misma ni de lo suyo, y cada tipo dice dónde puede estar (sus conexiones).
export function porQueNoVa(n, destino_id) {
  if (!destino_id) return;
  const d = datos.nodo.get(destino_id), nivel = datos.tipo.get(n.tipos.clave)?.nivel, suyo = datos.tipo.get(d?.tipos.clave)?.nivel;
  if (!d || destino_id === n.id || cajasDe(destino_id).includes(n.id)) return `«${n.titulo}» no puede ir dentro de sí misma.`;
  if (suyo == null) return `«${d.titulo}» no es una carpeta: no puede contener cosas.`;
  if ((nivel != null && suyo >= nivel) || !dentroDeCaja(n.tipos.clave, destino_id))
    return `«${n.titulo}» (${n.tipos.nombre}) no puede ir dentro de «${d.titulo}» (${d.tipos.nombre}).`;
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
