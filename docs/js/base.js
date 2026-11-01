// Lo que usan todas las partes de la web: la conexión a Supabase, atajos para el HTML
// y los datos cargados (que viven aquí, en un solo lugar, para que todas las vistas lean lo mismo).
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/+esm";
import { SUPABASE_URL, SUPABASE_KEY } from "../config.js";

export const db = createClient(SUPABASE_URL, SUPABASE_KEY);
export const $ = (id) => document.getElementById(id);
export const avisar = (t) => ($("mensaje").textContent = t);

// Atajo para crear elementos HTML: el("span", { textContent: "hola" }, ...hijos)
export function el(tag, props = {}, ...hijos) {
  const x = Object.assign(document.createElement(tag), props);
  x.append(...hijos);
  return x;
}

// Los datos cargados. Los llena recargar(); el resto de la web solo los lee.
export const datos = {
  tipos: [],              // los tipos disponibles, en el orden de la leyenda (tus propios tipos ganan sobre las plantillas)
  tipo: new Map(),        // clave -> tipo, ej. tipo.get("tarea").color
  nodos: [],
  nodo: new Map(),        // id -> nodo
  conexiones: [],
  padre: new Map(),       // id -> id de la caja donde está (lo calcula la vista "arbol" de la base, paso 19)
};

export const colorDe = (clave) => datos.tipo.get(clave)?.color ?? "#78716c";

// Lee todo de Supabase. No hace falta filtrar por dueño: RLS ya lo hace.
// Cuando termina avisa con el evento "datos", y cada vista (mapa, inicio) se vuelve a dibujar.
// enfocarId: si viene, se abre ese nodo después de dibujar (útil tras crear o editar).
export async function recargar(enfocarId) {
  avisar("Cargando tu grafo…");
  const [nodos, conexiones, tipos, arbol] = await Promise.all([
    db.from("nodos").select("id, titulo, contenido, estado, fecha, props, tipos!inner(clave, nombre)").eq("archivado", false),
    db.from("conexiones").select("id, origen_id, relacion, destino_id").is("valido_hasta", null),
    db.from("tipos").select("id, owner_id, clave, nombre, modulo, orden, color, nivel, subcaja, propiedades, conexiones").order("orden"),
    db.from("arbol").select("id, padre_id"),
  ]);
  const error = nodos.error || conexiones.error || tipos.error || arbol.error;
  if (error) return avisar(error.message);

  datos.tipo = new Map();
  for (const t of tipos.data) if (!datos.tipo.has(t.clave) || t.owner_id) datos.tipo.set(t.clave, t);
  datos.tipos = [...datos.tipo.values()];
  datos.nodos = nodos.data;
  datos.nodo = new Map(nodos.data.map((n) => [n.id, n]));
  datos.conexiones = conexiones.data.filter((c) => datos.nodo.has(c.origen_id) && datos.nodo.has(c.destino_id)); // por si alguna apunta a un archivado
  datos.padre = new Map(arbol.data.filter((f) => f.padre_id).map((f) => [f.id, f.padre_id]));

  avisar(nodos.data.length ? "" : "Todavía no tienes nodos. Crea el primero con «+ Nuevo».");
  document.dispatchEvent(new CustomEvent("datos", { detail: { enfocarId } }));
}
