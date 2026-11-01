// Servidor MCP mínimo del centro de datos.
// Habla JSON-RPC sobre HTTP ("Streamable HTTP" sin streaming: cada POST recibe una respuesta JSON).
// No depende de Supabase: recibe un `Repositorio` para poder probarlo con datos falsos.

export type Nodo = {
  id: string;
  tipo: string;
  titulo: string;
  contenido?: string | null;
  estado?: string | null;
  fecha?: string | null;
  props?: Record<string, unknown>;
  ruta?: string; // dónde está, ej. "Universidad / Base de Datos / Proyecto BD"
};

/** Una fila de la vista `arbol` (paso 19): el nodo y la caja donde está. */
export type FilaArbol = {
  id: string;
  titulo: string;
  tipo: string;
  modulo: string;
  orden: number;
  estado?: string | null;
  padre_id: string | null;
};

export type Vecino = { nodo: Nodo; relacion: string; direccion: string; profundidad: number };

/** Algo que pasó, con fecha (paso 16). nodo y otro significan lo que dice la clase (ver CLASES). */
export type Registro = {
  id?: string;
  clase: string;
  fecha?: string;
  titulo?: string | null;
  valor?: number | null;
  unidad?: string | null;
  nodo_id?: string | null;
  otro_id?: string | null;
  props?: Record<string, unknown>;
};
/** Un registro leído desde la vista registros_legibles: trae además los nombres. */
export type RegistroLegible = Registro & { nodo?: string | null; otro?: string | null };

export type FiltroRegistros = { clase?: string; nodo_id?: string; desde?: string; hasta?: string };

export interface Repositorio {
  listarTipos(): Promise<{ clave: string; nombre: string; modulo: string; propiedades: unknown; conexiones: unknown }[]>;
  arbol(desde?: string): Promise<FilaArbol[]>;
  buscarNodos(f: { texto?: string; tipo?: string; estado?: string; limite: number }): Promise<Nodo[]>;
  verNodo(id: string, profundidad: number): Promise<{ nodo: Nodo; vecinos: Vecino[] } | null>;
  crearNodo(n: Omit<Nodo, "id">): Promise<Nodo>;
  actualizarNodo(id: string, cambios: Partial<Omit<Nodo, "id" | "tipo">>): Promise<Nodo>;
  conectar(origenId: string, relacion: string, destinoId: string): Promise<void>;
  agendaDelDia(fechaISO: string): Promise<Nodo[]>;
  anotarRegistro(r: Registro): Promise<Registro>;
  registros(f: FiltroRegistros): Promise<RegistroLegible[]>;
}

// Paso 21: las clases de registro y qué significa "nodo" y "otro" en cada una.
// Es lo mismo que dice la tabla registros (paso 16); aquí se lo explicamos al agente.
export const CLASES: Record<string, string> = {
  gasto: "nodo = cuenta de donde salió, otro = categoría, valor = monto, unidad = CLP",
  ingreso: "nodo = cuenta donde entró, valor = monto, unidad = CLP",
  transferencia: "nodo = cuenta de origen, otro = cuenta destino, valor = monto, unidad = CLP",
  habito: "nodo = el hábito cumplido, valor = 1",
  medida: "nodo = lo que se mide (ej. el hito Peso Objetivo), valor y unidad (ej. 52.2 kg)",
  comida: "nodo = alimento o receta, valor = gramos o porciones (ver unidad)",
  riego: "nodo = la planta",
};

const VERSIONES = ["2025-11-25", "2025-06-18", "2025-03-26"];

type Herramienta = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  ejecutar: (repo: Repositorio, args: any) => Promise<unknown>;
};

const texto = { type: "string" };

/**
 * Convierte las filas del árbol en líneas con sangría, agrupadas por módulo:
 *   # General
 *   Universidad [area] <id>
 *     Base de Datos [topico] <id>
 * Lo Hecho se salta (con todo lo que tiene adentro) salvo que se pida verlo.
 */
export function dibujarArbol(filas: FilaArbol[], conHechos = false): string[] {
  const ids = new Set(filas.map((f) => f.id));
  const hijos = new Map<string | null, FilaArbol[]>();
  for (const f of filas) {
    const p = f.padre_id && ids.has(f.padre_id) ? f.padre_id : null; // si el padre quedó fuera, es raíz
    hijos.set(p, [...(hijos.get(p) ?? []), f]);
  }
  const enOrden = (a: FilaArbol, b: FilaArbol) => a.orden - b.orden || a.titulo.localeCompare(b.titulo, "es");
  const lineas: string[] = [];
  const bajar = (f: FilaArbol, sangria: number) => {
    if (!conHechos && f.estado === "Hecho") return;
    const detalle = [f.tipo, f.estado].filter(Boolean).join(", ");
    lineas.push(`${"  ".repeat(sangria)}${f.titulo} [${detalle}] ${f.id}`);
    for (const h of (hijos.get(f.id) ?? []).sort(enOrden)) bajar(h, sangria + 1);
  };
  let modulo = "";
  for (const r of (hijos.get(null) ?? []).sort(enOrden)) {
    if (r.modulo !== modulo) lineas.push(`# ${(modulo = r.modulo)}`);
    bajar(r, 0);
  }
  return lineas;
}

type Grupo = { grupo: string; cantidad: number; suma: number };
const AGRUPAR: Record<string, (r: RegistroLegible) => string> = {
  dia: (r) => (r.fecha ?? "").slice(0, 10),
  mes: (r) => (r.fecha ?? "").slice(0, 7),
  nodo: (r) => r.nodo ?? "(sin nodo)",
  otro: (r) => r.otro ?? "(sin otro)",
};

/**
 * Resume registros: cuántos hay y cuánto suman, opcionalmente por grupo (día, mes, nodo u otro),
 * y los últimos 20 para ver el detalle. Así "¿cuánto gasté por categoría?" es una sola llamada.
 */
export function resumirRegistros(filas: RegistroLegible[], agruparPor?: string) {
  const suma = (lista: RegistroLegible[]) => lista.reduce((s, r) => s + Number(r.valor ?? 0), 0);
  const resumen: { cantidad: number; suma: number; grupos?: Grupo[]; ultimos: RegistroLegible[] } = {
    cantidad: filas.length,
    suma: suma(filas),
    ultimos: [...filas].sort((a, b) => (b.fecha ?? "").localeCompare(a.fecha ?? "")).slice(0, 20),
  };
  const clave = agruparPor ? AGRUPAR[agruparPor] : undefined;
  if (clave) {
    const grupos = new Map<string, RegistroLegible[]>();
    for (const r of filas) grupos.set(clave(r), [...(grupos.get(clave(r)) ?? []), r]);
    resumen.grupos = [...grupos].map(([grupo, lista]) => ({ grupo, cantidad: lista.length, suma: suma(lista) }))
      // Por fecha se lee en orden de calendario; por nodo u otro, de mayor a menor.
      .sort((a, b) => (agruparPor === "dia" || agruparPor === "mes" ? 0 : b.suma - a.suma) || a.grupo.localeCompare(b.grupo));
  }
  return resumen;
}

export const HERRAMIENTAS: Herramienta[] = [
  {
    name: "listar_tipos",
    description: "Lista los tipos de nodo disponibles, ordenados por módulo (General, Productividad, Finanzas...), con sus propiedades y conexiones esperadas.",
    inputSchema: { type: "object", properties: {} },
    ejecutar: (repo) => repo.listarTipos(),
  },
  {
    name: "ver_arbol",
    description:
      "Muestra todo como un árbol (área > tópico > proyecto > tarea), agrupado por módulo y con el id de cada nodo. " +
      "Úsala primero para orientarte. Con 'desde' muestra solo lo que está dentro de ese nodo.",
    inputSchema: {
      type: "object",
      properties: {
        desde: { ...texto, description: "id de un nodo, ej. un área" },
        con_hechos: { type: "boolean", default: false, description: "Incluir lo que ya está Hecho" },
      },
    },
    ejecutar: async (repo, a) => dibujarArbol(await repo.arbol(a.desde), a.con_hechos ?? false),
  },
  {
    name: "buscar_nodos",
    description: "Busca nodos por texto (en español), tipo o estado. Úsala antes de crear algo para no duplicarlo.",
    inputSchema: {
      type: "object",
      properties: {
        texto,
        tipo: { ...texto, description: "Clave del tipo, ej. 'tarea'" },
        estado: texto,
        limite: { type: "integer", minimum: 1, maximum: 50, default: 20 },
      },
    },
    ejecutar: (repo, a) =>
      repo.buscarNodos({ texto: a.texto, tipo: a.tipo, estado: a.estado, limite: Math.min(a.limite ?? 20, 50) }),
  },
  {
    name: "ver_nodo",
    description: "Muestra un nodo y sus vecinos en el grafo (hasta 3 saltos).",
    inputSchema: {
      type: "object",
      properties: { id: texto, profundidad: { type: "integer", minimum: 1, maximum: 3, default: 1 } },
      required: ["id"],
    },
    ejecutar: async (repo, a) => {
      const r = await repo.verNodo(a.id, Math.min(Math.max(a.profundidad ?? 1, 1), 3));
      if (!r) throw new ErrorHerramienta(`No existe el nodo ${a.id}`);
      return r;
    },
  },
  {
    name: "crear_nodo",
    description: "Crea un nodo nuevo (tarea, nota, proyecto...) y opcionalmente lo conecta con otros.",
    inputSchema: {
      type: "object",
      properties: {
        tipo: texto,
        titulo: texto,
        contenido: texto,
        estado: texto,
        fecha: { ...texto, description: "Fecha ISO 8601" },
        props: { type: "object" },
        conectar_a: {
          type: "array",
          items: {
            type: "object",
            properties: { relacion: texto, destino_id: texto },
            required: ["relacion", "destino_id"],
          },
        },
      },
      required: ["tipo", "titulo"],
    },
    ejecutar: async (repo, a) => {
      const nodo = await repo.crearNodo({
        tipo: a.tipo, titulo: a.titulo, contenido: a.contenido, estado: a.estado, fecha: a.fecha, props: a.props ?? {},
      });
      for (const c of a.conectar_a ?? []) await repo.conectar(nodo.id, c.relacion, c.destino_id);
      return nodo;
    },
  },
  {
    name: "actualizar_nodo",
    description: "Cambia el título, contenido, estado, fecha o propiedades de un nodo.",
    inputSchema: {
      type: "object",
      properties: { id: texto, titulo: texto, contenido: texto, estado: texto, fecha: texto, props: { type: "object" } },
      required: ["id"],
    },
    ejecutar: (repo, a) => {
      const { id, ...cambios } = a;
      return repo.actualizarNodo(id, cambios);
    },
  },
  {
    name: "conectar_nodos",
    description: "Crea una conexión dirigida entre dos nodos, ej. tarea --pertenece_a--> proyecto.",
    inputSchema: {
      type: "object",
      properties: { origen_id: texto, relacion: texto, destino_id: texto },
      required: ["origen_id", "relacion", "destino_id"],
    },
    ejecutar: async (repo, a) => {
      await repo.conectar(a.origen_id, a.relacion, a.destino_id);
      return { ok: true };
    },
  },
  {
    name: "agenda_de_hoy",
    description: "Tareas y eventos con fecha de hoy o atrasados que no están completados.",
    inputSchema: { type: "object", properties: { fecha: { ...texto, description: "YYYY-MM-DD, por defecto hoy" } } },
    ejecutar: (repo, a) => repo.agendaDelDia(a.fecha ?? new Date().toISOString().slice(0, 10)),
  },
  {
    name: "anotar_registro",
    description:
      "Anota algo que pasó, con fecha: un gasto, un hábito cumplido, una comida, un riego, una medida. " +
      "Busca primero el nodo (cuenta, hábito, planta...) para usar su id. Qué es 'nodo' y 'otro' en cada clase:\n" +
      Object.entries(CLASES).map(([c, d]) => `- ${c}: ${d}`).join("\n"),
    inputSchema: {
      type: "object",
      properties: {
        clase: { type: "string", enum: Object.keys(CLASES) },
        nodo_id: texto,
        otro_id: texto,
        valor: { type: "number" },
        unidad: texto,
        titulo: { ...texto, description: "Ej. 'Almuerzo', 'Compra Spotify'" },
        fecha: { ...texto, description: "Fecha ISO 8601, por defecto ahora" },
        props: { type: "object" },
      },
      required: ["clase"],
    },
    ejecutar: (repo, a) => {
      if (!(a.clase in CLASES)) throw new ErrorHerramienta(`Clase desconocida: ${a.clase}`);
      const { clase, nodo_id, otro_id, valor, unidad, titulo, fecha, props } = a;
      return repo.anotarRegistro({ clase, nodo_id, otro_id, valor, unidad, titulo, fecha, props: props ?? {} });
    },
  },
  {
    name: "consultar_registros",
    description:
      "Responde preguntas sobre lo que pasó: '¿cuánto gasté en comida este mes?', '¿cuántos días medité?'. " +
      "Devuelve cantidad, suma, grupos (si pides agrupar) y los últimos 20 registros.",
    inputSchema: {
      type: "object",
      properties: {
        clase: { type: "string", enum: Object.keys(CLASES) },
        nodo_id: { ...texto, description: "Solo los registros de este nodo (como nodo o como otro), ej. la categoría Comida" },
        desde: { ...texto, description: "YYYY-MM-DD, incluido" },
        hasta: { ...texto, description: "YYYY-MM-DD, incluido" },
        agrupar_por: { type: "string", enum: Object.keys(AGRUPAR) },
      },
    },
    ejecutar: async (repo, a) =>
      resumirRegistros(await repo.registros({ clase: a.clase, nodo_id: a.nodo_id, desde: a.desde, hasta: a.hasta }), a.agrupar_por),
  },
];

export class ErrorHerramienta extends Error {}

type Peticion = { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: any };

function respuesta(id: Peticion["id"], result: unknown) {
  return { jsonrpc: "2.0", id, result };
}
function error(id: Peticion["id"], code: number, message: string) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

/** Procesa un mensaje JSON-RPC. Devuelve null para notificaciones (no llevan respuesta). */
export async function procesar(msg: Peticion, repo: Repositorio): Promise<object | null> {
  if (!msg || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") {
    return error(msg?.id, -32600, "Petición inválida");
  }
  if (msg.id === undefined) return null; // notificación, ej. notifications/initialized

  switch (msg.method) {
    case "initialize": {
      const pedida = msg.params?.protocolVersion;
      return respuesta(msg.id, {
        protocolVersion: VERSIONES.includes(pedida) ? pedida : VERSIONES[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "centro-de-datos", version: "0.1.0" },
        instructions:
          "Centro de datos personal en forma de grafo. Usa ver_arbol para orientarte, busca antes de crear " +
          "para no duplicar, y conecta cada tarea a su proyecto o área.",
      });
    }
    case "ping":
      return respuesta(msg.id, {});
    case "tools/list":
      return respuesta(msg.id, {
        tools: HERRAMIENTAS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
      });
    case "tools/call": {
      const h = HERRAMIENTAS.find((x) => x.name === msg.params?.name);
      if (!h) return error(msg.id, -32602, `Herramienta desconocida: ${msg.params?.name}`);
      try {
        const resultado = await h.ejecutar(repo, msg.params?.arguments ?? {});
        return respuesta(msg.id, {
          content: [{ type: "text", text: JSON.stringify(resultado, null, 2) }],
          structuredContent: { resultado },
        });
      } catch (e) {
        // Los errores de herramienta van como resultado con isError para que el modelo pueda corregirse.
        return respuesta(msg.id, {
          content: [{ type: "text", text: e instanceof Error ? e.message : String(e) }],
          isError: true,
        });
      }
    }
    default:
      return error(msg.id, -32601, `Método no soportado: ${msg.method}`);
  }
}

/** Atiende un POST HTTP con uno o varios mensajes JSON-RPC. */
export async function atenderPost(req: Request, repo: Repositorio): Promise<Response> {
  let cuerpo: unknown;
  try {
    cuerpo = await req.json();
  } catch {
    return Response.json(error(null, -32700, "JSON inválido"), { status: 400 });
  }
  const mensajes = Array.isArray(cuerpo) ? cuerpo : [cuerpo];
  const salidas = (await Promise.all(mensajes.map((m) => procesar(m as Peticion, repo)))).filter((x) => x !== null);
  if (salidas.length === 0) return new Response(null, { status: 202 });
  return Response.json(Array.isArray(cuerpo) ? salidas : salidas[0]);
}
