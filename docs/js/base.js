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

// Un texto que se escribe encima (un título, un post-it). Enter o salir guarda; Escape deshace.
// alTerminar(texto) recibe lo escrito, ya sin espacios sobrantes.
// ¿Estás escribiendo dentro de este elemento? (un campo o un texto editable con el cursor adentro).
// Mientras escribes no se redibuja, para no pisarte; un botón apretado no cuenta.
export const escribiendoEn = (caja) => caja.contains(document.activeElement) && document.activeElement.matches("input, textarea, [contenteditable]");

export function escribible(tag, inicial, alTerminar, className = "") {
  const t = el(tag, { className, textContent: inicial, contentEditable: "plaintext-only", spellcheck: false });
  t.onkeydown = (e) => {
    if (e.key === "Escape") t.textContent = inicial;
    if (e.key === "Enter" || e.key === "Escape") { e.preventDefault(); e.stopPropagation(); t.blur(); }
  };
  t.onblur = () => alTerminar(t.textContent.trim());
  return t;
}

// Ir a otro apartado y, de paso, decirle qué mostrar (ej. irA("proyectos", { caja: id })). Lo atiende carcasa.js.
export const irA = (apartado, ctx) => document.dispatchEvent(new CustomEvent("ir", { detail: { apartado, ctx } }));

// Los datos cargados. Los llena recargar(); el resto de la web solo los lee.
export const datos = {
  tipos: [],              // los tipos disponibles, en el orden de la leyenda (tus propios tipos ganan sobre las plantillas)
  tipo: new Map(),        // clave -> tipo, ej. tipo.get("tarea").color
  nodos: [],
  nodo: new Map(),        // id -> nodo
  conexiones: [],
  padre: new Map(),       // id -> id de la caja donde está (lo calcula la vista "arbol" de la base, paso 19)
  registros: [],          // lo que pasó en los últimos DIAS_REGISTROS días (gastos, hábitos, riegos...), del más viejo al más nuevo
  disposiciones: new Map(), // id del apartado -> sus columnas de widgets, si las cambiaste (paso 34b)
};

// Cuántos días de registros se traen. Alcanza para rachas, el gasto del mes y las plantas.
const DIAS_REGISTROS = 90;

// El día de una fecha, como texto "2026-11-01".
// Las fechas sin hora (las de Notion, guardadas a medianoche UTC) se leen tal cual, sin zona horaria,
// para que no se corran un día. Las que tienen hora se pasan a tu hora local.
export const sinHora = (d) => d.getUTCHours() === 0 && d.getUTCMinutes() === 0;
export function dia(fecha) {
  if (!fecha) return null;
  const d = new Date(fecha);
  return sinHora(d) ? fecha.slice(0, 10) : d.toLocaleDateString("sv-SE"); // "sv-SE" escribe AAAA-MM-DD
}
export const hora = (fecha) => {
  const d = new Date(fecha);
  return sinHora(d) ? "" : d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
};

export const colorDe = (clave) => datos.tipo.get(clave)?.color ?? "#78716c";
// Dentro de qué proyecto, área o materia está un nodo (su caja), para mostrarlo al lado.
export const dentroDe = (id) => datos.nodo.get(datos.padre.get(id))?.titulo;
// Todas las cajas que contienen a un nodo, de la más cercana a la más general (tarea → proyecto → área).
export function cajasDe(id) {
  const cajas = [];
  for (let p = datos.padre.get(id); p && !cajas.includes(p); p = datos.padre.get(p)) cajas.push(p);
  return cajas;
}
// El proyecto donde está algo (el más cercano), o nada.
export const proyectoDe = (id) => cajasDe(id).find((c) => datos.nodo.get(c)?.tipos.clave === "proyecto");

// Colores para distinguir cosas del mismo tipo (proyectos, calendarios).
export const PALETA = ["#3b82f6", "#22c55e", "#ec4899", "#f97316", "#8b5cf6", "#14b8a6", "#ef4444", "#a16207"];
const suyo = (id) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0) % PALETA.length;
// Un color por proyecto, distinto entre los activos mientras alcance la paleta. Cada uno parte de "su" color
// (sale de su id) y, si ya lo tiene otro, toma el siguiente libre: así casi nunca cambian.
let colores = { de: null, mapa: new Map() };
export function colorDeProyecto(id) {
  if (colores.de !== datos.nodos) { // se calcula una vez por cada carga de datos
    const usados = new Set(), mapa = new Map();
    const activos = datos.nodos.filter((n) => n.tipos.clave === "proyecto" && n.estado !== "Hecho").sort((a, b) => a.id.localeCompare(b.id));
    for (const p of activos) {
      let i = suyo(p.id);
      for (let k = 0; k < PALETA.length && usados.has(i); k++) i = (i + 1) % PALETA.length;
      usados.add(i);
      mapa.set(p.id, PALETA[i]);
    }
    colores = { de: datos.nodos, mapa };
  }
  return colores.mapa.get(id) ?? PALETA[suyo(id)];
}

// Lee todo de Supabase. No hace falta filtrar por dueño: RLS ya lo hace.
// Cuando termina avisa con el evento "datos", y cada vista (mapa, inicio, panel) se vuelve a dibujar.
// enfocarId: si viene, se abre ese nodo después de dibujar (útil tras crear o editar).
export async function recargar(enfocarId) {
  if (!datos.nodos.length) avisar("Cargando tu grafo…"); // solo la primera vez; después se actualiza sin parpadear
  const desde = new Date(Date.now() - DIAS_REGISTROS * 864e5).toISOString();
  const [nodos, conexiones, tipos, arbol, registros, disposiciones] = await Promise.all([
    db.from("nodos").select("id, titulo, contenido, estado, fecha, props, tipos!inner(clave, nombre)").eq("archivado", false),
    db.from("conexiones").select("id, origen_id, relacion, destino_id").is("valido_hasta", null),
    db.from("tipos").select("id, owner_id, clave, nombre, modulo, orden, color, nivel, subcaja, propiedades, conexiones").order("orden"),
    db.from("arbol").select("id, padre_id"),
    db.from("registros").select("id, fecha, clase, valor, nodo_id, otro_id").gte("fecha", desde).order("fecha"),
    db.from("disposiciones").select("apartado, columnas"),
  ]);
  const error = nodos.error || conexiones.error || tipos.error || arbol.error || registros.error;
  if (error) return avisar(error.message);

  datos.tipo = new Map();
  for (const t of tipos.data) if (!datos.tipo.has(t.clave) || t.owner_id) datos.tipo.set(t.clave, t);
  datos.tipos = [...datos.tipo.values()];
  datos.nodos = nodos.data;
  datos.nodo = new Map(nodos.data.map((n) => [n.id, n]));
  datos.conexiones = conexiones.data.filter((c) => datos.nodo.has(c.origen_id) && datos.nodo.has(c.destino_id)); // por si alguna apunta a un archivado
  datos.padre = new Map(arbol.data.filter((f) => f.padre_id).map((f) => [f.id, f.padre_id]));
  datos.registros = registros.data;
  // Si la tabla todavía no existe (falta pegar el SQL 8), no pasa nada: se usa la disposición de siempre.
  datos.disposiciones = new Map((disposiciones.data ?? []).map((d) => [d.apartado, d.columnas]));

  avisar(nodos.data.length ? "" : "Todavía no tienes nodos. Crea el primero con «+ Nuevo».");
  document.dispatchEvent(new CustomEvent("datos", { detail: { enfocarId } }));
}

// Pide una recarga, pero espera un momento por si llegan más cambios juntos
// (ej. el agente crea un nodo y lo conecta: son 2 avisos, y se recarga 1 sola vez).
let espera;
export function pedirRecarga() {
  clearTimeout(espera);
  espera = setTimeout(() => recargar(), 300);
}

// Escribe en la base y, si salió bien, pide recargar. Lo usan los botones del Inicio.
// consulta: cualquier db.from(...).insert/update/delete(...).
export async function escribir(consulta) {
  const { error } = await consulta;
  if (error) avisar(error.message);
  else pedirRecarga();
  return !error;
}

// Tiempo real (paso 25): Supabase avisa cada vez que cambia una de estas tablas, venga el cambio
// de esta pestaña, de otra, del celular o del agente. RLS también aplica aquí: solo llegan tus cambios.
const TABLAS = ["nodos", "conexiones", "registros", "tipos"];
let canal;
export function escucharCambios() {
  if (canal) return;
  canal = db.channel("cambios");
  for (const table of TABLAS) canal.on("postgres_changes", { event: "*", schema: "public", table }, pedirRecarga);
  canal.subscribe();
}
// Si la pestaña estuvo dormida (el celular bloqueado, otra pestaña), al volver se recarga
// por si se perdió algún aviso, y de paso "hoy" pasa a ser el día correcto.
document.addEventListener("visibilitychange", () => { if (canal && !document.hidden) pedirRecarga(); });
export function dejarDeEscuchar() {
  if (canal) db.removeChannel(canal);
  canal = null;
}
