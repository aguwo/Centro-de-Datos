// Paso 12 (parte 1): las reglas para traducir tu Notion al centro de datos.
// Recibe las filas tal como las entrega Notion y devuelve dos listas:
//   nodos:      { notion_id, tipo, titulo, contenido, estado, fecha, archivado, props }
//   conexiones: { origen, relacion, destino }   (origen y destino son notion_id)
// No toca la base de datos: solo traduce. Así se puede probar sin internet.

// "https://app.notion.com/p/3be1bc29d5e080fd86b4dc8ea696157b" -> "3be1bc29d5e080fd86b4dc8ea696157b"
const idDe = (url) => url.match(/[0-9a-f]{32}/)[0];

// Notion a veces guarda el título con etiquetas "<p> ... </p>".
const limpiar = (t) => (t ?? "").replace(/<\/?p>/g, "").trim();

// Las relaciones vienen como texto JSON: '["url1","url2"]'.
const lista = (v) => (v ? JSON.parse(v).map(idDe) : []);

// Cada base de Notion tenía sus propios estados. Aquí todos caen en los 5 comunes.
const ESTADOS = {
  "Inbox": "Inbox",
  "por Hacer": "Por hacer", "No empezado": "Por hacer", "Sin fecha": "Por hacer", "Repetitiva": "Por hacer",
  "En progreso": "En curso", "En proceso": "En curso",
  "En pausa": "Esperando", "Esperando": "Esperando",
  "Completada": "Hecho", "Completado": "Hecho",
};

// Copia solo las propiedades que tienen valor, para no llenar props de vacíos.
function sinVacios(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== ""));
}

export function traducir(notion, ahora = new Date()) {
  const nodos = [];
  const conexiones = [];
  const nodo = (fila, tipo, extra = {}) => {
    const n = {
      notion_id: idDe(fila.url),
      tipo,
      titulo: limpiar(fila.Nombre),
      contenido: fila["Descripción"] || null,
      estado: null,
      fecha: null,
      archivado: fila.Archivo === "__YES__",
      props: {},
      ...extra,
    };
    n.props = sinVacios({ notion_id: n.notion_id, ...n.props });
    nodos.push(n);
    return n;
  };
  const conectar = (origen, relacion, destinos) => {
    for (const destino of destinos) conexiones.push({ origen, relacion, destino });
  };

  for (const a of notion.areas) nodo(a, "area", { props: { tipo: a.Tipo } });

  for (const o of notion.objetivos) {
    const n = nodo(o, "objetivo", { estado: ESTADOS[o.Estado], fecha: o["date:fecha tope:start"] ?? null });
    conectar(n.notion_id, "pertenece_a", lista(o["Área"]));
  }

  for (const p of notion.proyectos) {
    // Las páginas "Nuevo proyecto" vacías quedaron de pruebas en Notion: no se traen.
    if (limpiar(p.Nombre) === "Nuevo proyecto" && !p.Tareas && !p["Área"]) continue;
    const n = nodo(p, "proyecto", {
      estado: ESTADOS[p.Estado],
      fecha: p["date:Línea tiempo:start"] ?? p["date:Fecha de inicio:start"] ?? null,
      props: { prioridad: p.Prioridad, fecha_fin: p["date:Línea tiempo:end"] },
    });
    conectar(n.notion_id, "pertenece_a", lista(p["Área"]));
    conectar(n.notion_id, "aporta_a", lista(p.Objetivo));
    conectar(n.notion_id, "bloqueado_por", lista(p["Bloqueado por"]));
    conectar(n.notion_id, "trata_sobre", lista(p["Tópicos"]));
  }

  // Tareas repetitivas: en Notion había una copia por cada día ("Entrenamiento en casa — Torso" x20).
  // Aquí queda UNA tarea con Repetición = Semanal y la fecha de la próxima vez que toca.
  const repetitivas = new Map();
  for (const t of notion.tareas) {
    const esRepetitiva = t.Tipo === "Repetitiva" || t.Estado === "Repetitiva";
    if (!esRepetitiva) continue;
    const titulo = limpiar(t.Nombre);
    (repetitivas.get(titulo) ?? repetitivas.set(titulo, []).get(titulo)).push(t);
  }

  for (const t of notion.tareas) {
    const titulo = limpiar(t.Nombre);
    const grupo = repetitivas.get(titulo);
    let extra = {
      estado: ESTADOS[t.Estado],
      fecha: t["date:Fecha:start"] ?? null,
      props: { fecha_fin: t["date:Fecha:end"] },
    };
    if (grupo) {
      if (grupo[0] !== t) continue; // solo la primera copia representa al grupo
      const futuras = grupo.map((x) => x["date:Fecha:start"]).filter((f) => f && new Date(f) >= ahora).sort();
      const descripcion = grupo.map((x) => x["Descripción"]).find(Boolean) || null;
      extra = { estado: "Por hacer", fecha: futuras[0] ?? null, contenido: descripcion,
                props: { repeticion: "Semanal" } };
    }
    const n = nodo(t, "tarea", extra);
    // Las relaciones de todas las copias se juntan en la tarea que queda.
    for (const x of grupo ?? [t]) {
      conectar(n.notion_id, "pertenece_a", [...lista(x.Proyecto), ...lista(x["Área"]), ...lista(x.Objetivo), ...lista(x.Evento)]);
      conectar(n.notion_id, "trata_sobre", lista(x["Tópicos"]));
    }
  }

  for (const e of notion.eventos) {
    const n = nodo(e, "evento", {
      fecha: e["date:Fecha:start"] ?? null,
      props: { tipo: e.Tipo, fecha_fin: e["date:Fecha:end"] },
    });
    conectar(n.notion_id, "pertenece_a", [...lista(e["Área"]), ...lista(e["Relacionado con proyectos (reuniones)"])]);
    conectar(n.notion_id, "trata_sobre", lista(e["Tópicos"]));
  }

  for (const t of notion.topicos) {
    const n = nodo(t, t.Semestre ? "ramo" : "topico", { props: { semestre: t.Semestre } }); // paso 110: con semestre es un ramo
    conectar(n.notion_id, "pertenece_a", lista(t["Área"]));
  }

  // Bloque de notas se fusionó con Tópico (paso 2): cada bloque apunta al tópico del mismo nombre.
  const topicoPorNombre = new Map(nodos.filter((n) => ["topico", "ramo"].includes(n.tipo)).map((n) => [n.titulo.toLowerCase(), n.notion_id]));
  const bloqueATopico = new Map();
  for (const b of notion.bloques) {
    const existente = topicoPorNombre.get(limpiar(b.Nombre).toLowerCase());
    bloqueATopico.set(idDe(b.url), existente ?? nodo(b, "topico").notion_id);
  }

  const TIPO_NOTA = { "Nota Rapida": "Nota rápida", "Apuntes Clase": "Apuntes clase", "Resumen": "Resumen" };
  for (const x of notion.notas) {
    const n = nodo(x, "nota", {
      props: { tipo: TIPO_NOTA[x.Tipo], enlace: x.Info?.trim(), favorito: x.Favorito === "__YES__" || undefined },
    });
    conectar(n.notion_id, "pertenece_a", [...lista(x["Área"]), ...lista(x.Proyectos), ...lista(x.Objetivos)]);
    conectar(n.notion_id, "trata_sobre", [...lista(x["Tópicos"]), ...lista(x["Bloques de notas"]).map((b) => bloqueATopico.get(b) ?? b)]);
  }

  // Se descartan las conexiones a páginas que no vinieron (borradas o fuera de estas bases)
  // y las repetidas (dos copias de una tarea repetitiva apuntando al mismo objetivo).
  const existe = new Set(nodos.map((n) => n.notion_id));
  const vistas = new Set();
  const buenas = conexiones.filter((c) => {
    const clave = `${c.origen} ${c.relacion} ${c.destino}`;
    if (!existe.has(c.destino) || c.origen === c.destino || vistas.has(clave)) return false;
    vistas.add(clave);
    return true;
  });

  return { nodos, conexiones: buenas, descartadas: conexiones.length - buenas.length };
}
