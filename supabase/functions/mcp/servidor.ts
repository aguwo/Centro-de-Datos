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
};

export type Vecino = { nodo: Nodo; relacion: string; direccion: string; profundidad: number };

export interface Repositorio {
  listarTipos(): Promise<{ clave: string; nombre: string; propiedades: unknown; conexiones: unknown }[]>;
  buscarNodos(f: { texto?: string; tipo?: string; estado?: string; limite: number }): Promise<Nodo[]>;
  verNodo(id: string, profundidad: number): Promise<{ nodo: Nodo; vecinos: Vecino[] } | null>;
  crearNodo(n: Omit<Nodo, "id">): Promise<Nodo>;
  actualizarNodo(id: string, cambios: Partial<Omit<Nodo, "id" | "tipo">>): Promise<Nodo>;
  conectar(origenId: string, relacion: string, destinoId: string): Promise<void>;
  agendaDelDia(fechaISO: string): Promise<Nodo[]>;
}

const VERSIONES = ["2025-11-25", "2025-06-18", "2025-03-26"];

type Herramienta = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  ejecutar: (repo: Repositorio, args: any) => Promise<unknown>;
};

const texto = { type: "string" };

export const HERRAMIENTAS: Herramienta[] = [
  {
    name: "listar_tipos",
    description: "Lista los tipos de nodo disponibles (tarea, proyecto, área, etc.) con sus propiedades y conexiones esperadas.",
    inputSchema: { type: "object", properties: {} },
    ejecutar: (repo) => repo.listarTipos(),
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
          "Centro de datos personal en forma de grafo. Busca antes de crear para no duplicar, " +
          "y conecta cada tarea a su proyecto o área.",
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
