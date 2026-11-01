// Paso 17 (parte 1): las reglas para traducir el resto de tu Notion.
// Igual que traducir.mjs (paso 12), pero además de nodos y conexiones devuelve "registros":
// las cosas que pasaron en una fecha (gastos, días de hábitos, comidas, riegos). Ver la migración 0006.
//
// Recibe:
//   resto:  las filas de Notion de finanzas, hábitos, plantas, dieta, biblioteca y rutinas
//   previo: el export del paso 12 (áreas, objetivos...), para conectar lo nuevo con lo que ya existe
// Devuelve: { nodos, conexiones, registros, saltados }

const idDe = (url) => url.match(/[0-9a-f]{32}/)[0];
const lista = (v) => (v ? JSON.parse(v).map(idDe) : []);
const primero = (v) => lista(v)[0] ?? null;
const si = (v) => v === "__YES__";

// Notion guarda textos con etiquetas y escapes de Markdown: "<p>Compra [SHEIN.COM](http://SHEIN.COM) \*</p>".
const limpiar = (t) => (t ?? "")
  .replace(/<br\s*\/?>/g, "\n")
  .replace(/<\/?p>/g, "")
  .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")   // [texto](enlace) -> texto
  .replace(/\\([*$|_~])/g, "$1")              // \* -> *
  .trim();

function sinVacios(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== ""));
}

// Los 10 hábitos eran columnas de casillas en "Seguimiento de hábitos". Aquí cada uno es un nodo.
// "rutina": está en tu checklist de la mañana. "area" y "objetivo": a qué parte de tu vida aportan.
export const HABITOS = [
  { columna: "Orden",         titulo: "Ordenar",               rutina: true },
  { columna: "Piel AM",       titulo: "Cuidado de piel (mañana)", area: "Salud y Ejercicio" },
  { columna: "Piel PM",       titulo: "Cuidado de piel (noche)",  area: "Salud y Ejercicio" },
  { columna: "Meditar",       titulo: "Meditar",               rutina: true, area: "Salud y Ejercicio" },
  { columna: "Creatina",      titulo: "Tomar creatina",        rutina: true, area: "Salud y Ejercicio", objetivo: "Subir 10 kilos" },
  { columna: "Entrenamiento", titulo: "Entrenar",              rutina: true, area: "Salud y Ejercicio", objetivo: "Subir 10 kilos",
    dias: "Lunes, martes, miércoles y viernes, 08:00 a 09:00" },
  { columna: "Medir Kcal",    titulo: "Registrar calorías",    area: "Salud y Ejercicio", objetivo: "Subir 10 kilos" },
  { columna: "Estudio",       titulo: "Estudiar",              area: "Universidad" },
  { columna: "Lectura",       titulo: "Leer",                  area: "Conocimiento Personal" },
  { columna: "Notion",        titulo: "Revisar el sistema",    rutina: true,
    descripcion: "Revisar el sistema y organizar tareas, proyectos y notas." },
];

// Las listas de compras repetían los mismos alimentos con otro nombre.
const SINONIMOS = {
  "salsa de tomate": "salsa", "crema de leche": "crema", "carne molida": "vacuno",
  "atún en aceite": "atún", "huevos (feria)": "huevo", "platanos (feria)": "platano",
};
const DESPENSA = { "Falta": "Agotado", "queda un poco": "Bajo", "Listo": "Suficiente" };
const ESTADO_RECURSO = { "Inbox": "Inbox", "Backlog": "Por hacer", "Up Next": "Por hacer", "In Progress": "En curso", "Completed": "Hecho" };
const FORMATO = { Book: "Libro", Film: "Película", Article: "Artículo", Video: "Video", Podcast: "Podcast" };

export function traducirResto(resto, previo) {
  const nodos = [], conexiones = [], registros = [], saltados = [];
  const nodo = (notion_id, tipo, titulo, extra = {}) => {
    const n = { notion_id, tipo, titulo, contenido: null, estado: null, fecha: null, archivado: false, ...extra };
    n.props = sinVacios({ notion_id, ...(extra.props ?? {}) });
    nodos.push(n);
    return n;
  };
  const conectar = (origen, relacion, destino, props) => {
    if (destino) conexiones.push({ origen, relacion, destino, props: props ?? {} });
  };
  const registrar = (notion_id, clase, fecha, extra) => {
    if (!fecha) return saltados.push(`${clase} sin fecha: ${extra.titulo ?? notion_id}`);
    registros.push({ notion_id, clase, fecha, titulo: null, valor: null, unidad: null, nodo: null, otro: null, ...extra,
                     props: sinVacios({ notion_id, ...(extra.props ?? {}) }) });
  };

  // Lo que ya importó el paso 12, buscado por nombre (los nombres venían con "<p>" a veces).
  const porNombre = (filas) => new Map(filas.map((f) => [limpiar(f.Nombre).toLowerCase(), idDe(f.url)]));
  const areas = porNombre(previo.areas), objetivos = porNombre(previo.objetivos);
  const area = (nombre) => areas.get(nombre.toLowerCase()) ?? null;
  const objetivo = (nombre) => objetivos.get(nombre.toLowerCase()) ?? null;
  const finanzas = area("Finanzas Personales");

  // ---------- FINANZAS ----------
  // En Notion, Finanzas tenía su propia "Vista de Áreas" (Platita, Ahorros) aparte de tus Áreas.
  // Aquí las cuentas cuelgan directo de tu área "Finanzas Personales".
  for (const c of resto.cuentas) {
    const n = nodo(idDe(c.url), "cuenta", limpiar(c.Nombre), { props: { saldo_inicial: c["Saldo Inicial"] } });
    conectar(n.notion_id, "pertenece_a", finanzas);
  }
  for (const c of resto.categorias) {
    const n = nodo(idDe(c.url), "categoria", limpiar(c.Name), { props: { presupuesto_semanal: c["Gasto Semanal"] } });
    conectar(n.notion_id, "pertenece_a", finanzas);
  }
  const categoriaSuscripciones = resto.categorias.find((c) => limpiar(c.Name) === "Suscripciones");
  for (const s of resto.suscripciones) {
    const n = nodo(idDe(s.url), "suscripcion", limpiar(s.Nombre), {
      props: { precio: s.Precio, periodo: s["Período"], activa: s.Estatus === "Activa" },
    });
    conectar(n.notion_id, "pertenece_a", categoriaSuscripciones && idDe(categoriaSuscripciones.url));
  }
  // "Objetivos financieros" era una base aparte; aquí es un objetivo más, con su meta en pesos.
  for (const o of resto.objetivos_fin) {
    const n = nodo(idDe(o.url), "objetivo", limpiar(o.Nombre), {
      estado: si(o.Completado) ? "Hecho" : "Por hacer",
      fecha: o["date:Fecha Límite:start"] ?? null,
      props: { meta_clp: o.Objetivo, saldo_inicial: o["Saldo Inicial"] },
    });
    conectar(n.notion_id, "pertenece_a", finanzas);
  }

  const dinero = (fila, clase, titulo, nodoId, otroId, props = {}) =>
    registrar(idDe(fila.url), clase, fila["date:Fecha:start"], {
      titulo: limpiar(titulo), valor: fila.Cantidad, unidad: "CLP", nodo: nodoId, otro: otroId,
      props: { notas: limpiar(fila.Notas), ...props },
    });
  for (const g of resto.gastos) dinero(g, "gasto", g["Gasto específico"], primero(g.Cuenta), primero(g["Categoría"]));
  for (const i of resto.ingresos) dinero(i, "ingreso", i["Ingreso específico"], primero(i.Cuenta), null);
  // Ojo: en Notion las columnas "Transferencias recibidas/realizadas" de Cuentas estaban al revés.
  // Aquí manda lo que dice cada transferencia: "De la cuenta" -> "A la cuenta".
  for (const t of resto.transferencias) dinero(t, "transferencia", t.Nombre, primero(t["De la cuenta"]), primero(t["A la cuenta"]));

  // ---------- METAS QUE SE MIDEN (Resultados clave = Hito) ----------
  for (const h of resto.hitos) {
    const obj = primero(h.Objetivo);
    if (!obj && h.Meta == null) { saltados.push(`resultado clave vacío: ${h.Nombre}`); continue; }
    const n = nodo(idDe(h.url), "hito", limpiar(h.Nombre), {
      estado: h.Estado === "Cerrado" ? "Hecho" : "En curso",
      props: { inicio: h.Inicio, actual: h.Actual, meta: h.Meta },
    });
    conectar(n.notion_id, "mide", obj);
    // El último valor anotado queda también como medida con fecha, para poder graficar el avance.
    if (h.Actual != null) registrar(`${n.notion_id}:actual`, "medida", h.Editado, { titulo: n.titulo, valor: h.Actual, nodo: n.notion_id });
  }

  // ---------- RUTINAS Y HÁBITOS ----------
  let manana = null;
  for (const r of resto.rutinas) {
    if (!r.Contenido) { saltados.push(`rutina vacía: ${limpiar(r.Nombre) || "(sin nombre)"}`); continue; }
    manana = nodo(idDe(r.url), "rutina", limpiar(r.Nombre), { contenido: r.Contenido }).notion_id;
  }
  for (const h of HABITOS) {
    const id = `habito:${h.columna}`;   // no eran páginas en Notion, así que se inventa un id estable
    nodo(id, "habito", h.titulo, { props: { descripcion: h.descripcion, dias: h.dias } });
    if (h.rutina) conectar(id, "pertenece_a", manana);
    if (h.area) conectar(id, "pertenece_a", area(h.area));
    if (h.objetivo) conectar(id, "aporta_a", objetivo(h.objetivo));
  }
  // Cada día de Notion tenía 10 casillas: cada casilla marcada es un registro.
  for (const dia of resto.habitos) {
    for (const h of HABITOS) {
      if (si(dia[h.columna])) registrar(`${idDe(dia.url)}:${h.columna}`, "habito", dia["date:Fecha:start"], { titulo: h.titulo, valor: 1, nodo: `habito:${h.columna}` });
    }
    if (dia["Peso (kg)"]) registrar(`${idDe(dia.url)}:peso`, "medida", dia["date:Fecha:start"], { titulo: "Peso", valor: dia["Peso (kg)"], unidad: "kg" });
  }

  // ---------- PLANTAS ----------
  const botanica = area("botánica");
  for (const p of resto.plantas) {
    if (!limpiar(p.Nombre)) { saltados.push("planta sin nombre"); continue; }
    const n = nodo(idDe(p.url), "planta", limpiar(p.Nombre), {
      archivado: p.Estado === "Q.E.P.D.",
      props: { especie: limpiar(p.Especie), salud: p.Estado, luz: p.Luz,
               aguanta_dias: p["Aguanta sin agua (días)"], obtenida: p["date:Fecha de obtención:start"] },
    });
    conectar(n.notion_id, "pertenece_a", botanica);
    if (p["date:Último riego:start"]) registrar(`${n.notion_id}:riego`, "riego", p["date:Último riego:start"], { titulo: "Riego", nodo: n.notion_id });
  }

  // ---------- BIBLIOTECA ----------
  for (const r of resto.referencias) {
    if (r.Archive === "__YES__") continue;
    if (!limpiar(r.Name) || limpiar(r.Name) === "Nueva Referencia") { saltados.push(`referencia vacía: ${limpiar(r.Name) || "(sin nombre)"}`); continue; }
    nodo(idDe(r.url), "recurso", limpiar(r.Name), {
      estado: ESTADO_RECURSO[r.Status] ?? "Inbox",
      fecha: r["date:Completed Date:start"] ?? null,
      contenido: limpiar(r["Descripción"]) || null,
      props: { formato: FORMATO[r.Tipo], enlace: r["userDefined:URL"], autor: limpiar(r.Fuente),
               plataforma: r.Plataforma ? JSON.parse(r.Plataforma).join(", ") : null, favorito: si(r.Favorite) || undefined },
    });
  }

  // ---------- DIETA ----------
  // "Alimentos" y las dos listas de compras eran tres bases con los mismos ingredientes.
  // Aquí queda UN alimento con sus macros, cuánto queda en la despensa y en qué compra se repone.
  const alimentoPorNombre = new Map();
  for (const a of resto.alimentos) {
    const n = nodo(idDe(a.url), "alimento", limpiar(a.Nombre), {
      props: { kcal_100g: a["kcal/100g"], prot_100g: a["Prot/100g"], carb_100g: a["Carb/100g"], grasa_100g: a["Grasa/100g"],
               porcion: limpiar(a["Porción"]), porcion_g: a["Porción (g)"], despensa: a.Estado, macro: a["Macro Principal"] },
    });
    alimentoPorNombre.set(n.titulo.toLowerCase(), n);
  }
  const comprar = (fila, compra) => {
    const nombre = limpiar(fila.Nombre);
    const clave = SINONIMOS[nombre.toLowerCase()] ?? nombre.toLowerCase();
    const n = alimentoPorNombre.get(clave) ?? nodo(idDe(fila.url), "alimento", nombre);
    Object.assign(n.props, sinVacios({ compra, cantidad_compra: fila.cantidad ?? fila.Cantidad,
                                       despensa: n.props.despensa ?? DESPENSA[fila.Estado] }));
  };
  for (const c of resto.compras_mensuales) comprar(c, "Mensual");
  for (const c of resto.compras_semanales) comprar(c, "Semanal");

  // La tabla intermedia "Ingredientes de recetas" se vuelve la conexión receta --usa--> alimento,
  // con los gramos guardados en la conexión misma.
  const ingredientes = new Map();
  for (const i of resto.ingredientes) {
    const receta = primero(i.Receta);
    (ingredientes.get(receta) ?? ingredientes.set(receta, []).get(receta)).push(i);
  }
  for (const r of resto.recetas) {
    const n = nodo(idDe(r.url), "receta", limpiar(r.Nombre), {
      contenido: limpiar(r["Ingredientes (nota)"]).replace(/^\s*•\s*/gm, "- ") || null,
      props: { comida: r.Tipo, rinde: r["Rinde (porciones)"] },
    });
    for (const i of ingredientes.get(n.notion_id) ?? []) conectar(n.notion_id, "usa", primero(i.Alimento), { gramos: i.Gramos });
  }

  // Cada fila de "Registrar comida" era un alimento comido: es un registro, no un nodo.
  for (const c of resto.comidas) {
    const que = primero(c.Alimento) ?? primero(c.Receta);
    const gramos = c.Gramos != null;
    registrar(idDe(c.url), "comida", c["date:Fecha:start"] ?? c.Creado, {
      titulo: limpiar(c.Nota), nodo: que,
      valor: gramos ? c.Gramos : (c.Porciones ?? 1), unidad: gramos ? "g" : "porción",
      props: { comida: c.Comida, kcal_extra: c["kcal rápidas"] },
    });
  }

  // Igual que en el paso 12: fuera las conexiones a páginas que no existen y las repetidas.
  const existe = new Set([...nodos.map((n) => n.notion_id), ...areas.values(), ...objetivos.values()]);
  const vistas = new Set();
  const buenas = conexiones.filter((c) => {
    const clave = `${c.origen} ${c.relacion} ${c.destino}`;
    if (!existe.has(c.destino) || c.origen === c.destino || vistas.has(clave)) return false;
    vistas.add(clave);
    return true;
  });
  for (const r of registros) {
    if (r.nodo && !existe.has(r.nodo)) r.nodo = null;
    if (r.otro && !existe.has(r.otro)) r.otro = null;
  }
  return { nodos, conexiones: buenas, registros, saltados, descartadas: conexiones.length - buenas.length };
}
