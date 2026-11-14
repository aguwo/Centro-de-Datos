// Servidor MCP mínimo del centro de datos.
// Habla JSON-RPC sobre HTTP ("Streamable HTTP" sin streaming: cada POST recibe una respuesta JSON).
// No depende de Supabase: recibe un `Repositorio` para poder probarlo con datos falsos.
import { diaDe, hoy, ocurreEl, sumarDias } from "./dias.ts";

export type Nodo = {
  id: string;
  tipo: string;
  titulo: string;
  contenido?: string | null;
  estado?: string | null;
  fecha?: string | null;
  props?: Record<string, unknown>;
  archivado?: boolean;
  ruta?: string; // dónde está, ej. "Universidad / Base de Datos / Proyecto BD"
  caja?: { id: string; titulo: string; tipo: string }; // la caja donde está directamente (paso 47), ej. el ramo de una clase
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

/** Una propiedad de un tipo (paso 23). Si la clave es "estado" o "fecha" vive en esa columna; si no, en props. */
export type Propiedad = { clave: string; nombre: string; tipo: string; opciones?: string[] };

/** Un tipo (molde de nodo) con su lugar en la jerarquía (paso 19). */
export type Tipo = {
  clave: string;
  nombre?: string;
  modulo?: string;
  orden?: number;
  color?: string;
  nivel?: number | null;
  subcaja?: Record<string, string>;
  propiedades?: Propiedad[];
  conexiones?: unknown[];
};

export interface Repositorio {
  /** Un tipo por clave: si tienes tu propia versión, esa en vez de la plantilla. */
  listarTipos(): Promise<Tipo[]>;
  tipoDeNodo(id: string): Promise<string | null>;
  arbol(desde?: string): Promise<FilaArbol[]>;
  buscarNodos(f: { texto?: string; tipo?: string; estado?: string; archivados?: boolean; limite: number }): Promise<Nodo[]>;
  verNodo(id: string, profundidad: number): Promise<{ nodo: Nodo; vecinos: Vecino[] } | null>;
  crearNodo(n: Omit<Nodo, "id">): Promise<Nodo>;
  /** Las props que vengan se mezclan con las que ya tiene; una prop en null se borra. */
  actualizarNodo(id: string, cambios: Partial<Omit<Nodo, "id">>): Promise<Nodo>;
  /** Borra de verdad, pero solo si el nodo ya está archivado. Devuelve false si no borró nada. */
  borrarNodo(id: string): Promise<boolean>;
  conectar(origenId: string, relacion: string, destinoId: string): Promise<void>;
  /** Cierra conexiones (les pone fecha de término). Sin destino, cierra todas las de esa relación. Devuelve cuántas. */
  desconectar(origenId: string, relacion: string, destinoId?: string): Promise<number>;
  /** Tareas abiertas y eventos que empiezan a más tardar ese día (AAAA-MM-DD), con su caja. agenda() elige cuáles van. */
  conFechaHasta(dia: string): Promise<Nodo[]>;
  anotarRegistro(r: Registro): Promise<Registro>;
  registros(f: FiltroRegistros): Promise<RegistroLegible[]>;
  editarRegistro(id: string, cambios: Partial<Omit<Registro, "id">>): Promise<Registro>;
  borrarRegistro(id: string): Promise<boolean>;
  /** Crea o cambia uno de TUS tipos. Si la clave es de una plantilla, hace tu copia y pasa tus nodos a ella. */
  guardarTipo(t: Tipo): Promise<Tipo>;
}

// Paso 21: las clases de registro y qué significa "nodo" y "otro" en cada una.
// Es lo mismo que dice la tabla registros (paso 16); aquí se lo explicamos al agente.
export const CLASES: Record<string, string> = {
  gasto: "nodo = cuenta de donde salió, otro = categoría, valor = monto, unidad = CLP",
  ingreso: "nodo = cuenta donde entró, valor = monto, unidad = CLP",
  transferencia: "nodo = cuenta de origen, otro = cuenta destino, valor = monto, unidad = CLP",
  habito: "nodo = el hábito cumplido, valor = 1",
  medida: "nodo = lo que se mide (ej. el objetivo de subir de peso), valor y unidad (ej. 52.2 kg)",
  comida: "nodo = alimento o receta, valor = gramos o porciones (ver unidad)",
  riego: "nodo = la planta",
  asistencia: "nodo = el ramo, valor = 1 si fue a clases y 0 si faltó; fecha = el día de la clase",
};

// ---------- Agenda (paso 47) ----------
export type DiaDeAgenda = { dia: string; eventos: Nodo[]; tareas: Nodo[] };

/**
 * Reparte en días lo que devuelve conFechaHasta: los eventos van cada día en que ocurren (también los que se
 * repiten, como las clases) y las tareas abiertas el día de su fecha; las de antes de "desde" son atrasadas.
 */
export function agenda(nodos: Nodo[], desde: string, dias: number): { atrasadas: Nodo[]; dias: DiaDeAgenda[] } {
  const conFecha = nodos.filter((n) => n.fecha);
  const tareas = conFecha.filter((n) => n.tipo === "tarea" && n.estado !== "Hecho");
  const eventos = conFecha.filter((n) => n.tipo === "evento");
  return {
    atrasadas: tareas.filter((t) => diaDe(t.fecha!) < desde),
    dias: Array.from({ length: dias }, (_, i) => {
      const dia = sumarDias(desde, i);
      return {
        dia,
        eventos: eventos.filter((e) => ocurreEl(diaDe(e.fecha!), e.props as any, dia)),
        tareas: tareas.filter((t) => diaDe(t.fecha!) === dia),
      };
    }),
  };
}

// Lo que Martita hace en el cierre del día. Va dentro de la respuesta de cierre_del_dia, así cualquier cliente lo sigue.
// Paso 97: el mismo orden que la revisión de la noche de la web (docs/js/revision.js). Un paso sin nada que revisar se salta.
export const PASOS_CIERRE = [
  "Habla como Martita: corto, cercano, en español de Chile, una pregunta a la vez. Empieza preguntando cómo estuvo el día.",
  "Lo de hoy: repasa tareas_de_hoy y atrasadas. Lo que hizo pásalo a Hecho con actualizar_nodo; lo demás, pregunta si va a mañana, a otro día o lo suelta (archivado).",
  "Asistencia: por cada clase con asistencia null, pregunta si fue y anótalo con anotar_registro (clase asistencia, nodo_id = ramo_id, valor 1 si fue y 0 si faltó, fecha = dia).",
  "Hábitos: pregunta cuáles de los hábitos que tocan hoy hizo (búscalos con buscar_nodos tipo habito) y anótalos con anotar_registro (clase habito).",
  "Comidas y gastos: pregunta qué comió y si gastó plata hoy; anota cada cosa como registro (clase comida o gasto). Si no gastó nada, sigue.",
  "Peso: si lleva 7 días o más sin pesarse (consultar_registros clase medida), pregunta cuánto pesa y anótalo.",
  "Notas: pregunta si salió alguna de evaluaciones_sin_nota (puede estar en EV@ o el portal) y guárdala en props.nota del evento con actualizar_nodo.",
  "Inbox: si hay cosas en estado Inbox (buscar_nodos estado Inbox), pregunta si van para mañana, algún día, ya están hechas o se sueltan.",
  "Mañana: con lo que viene en manana y proximas_evaluaciones, propón hasta 3 prioridades y, si está de acuerdo, ponles props.prioridad_dia = la fecha de mañana.",
  "Termina con un resumen de tres líneas de lo que quedó anotado y lo importante de mañana, y marca su hábito de revisar (el que tenga «revis» en el nombre) con anotar_registro.",
];

const RAMO = "ramo"; // sus clases son los eventos que se repiten y sus evaluaciones los que no (paso 110: los ramos ya no son tópicos)
const deRamo = (e: Nodo) => e.caja?.tipo === RAMO;
const corto = ({ id, titulo, fecha, estado, props, caja }: Nodo) => ({ id, titulo, fecha, estado, props, caja: caja?.titulo });

/** Lo que Martita necesita para el cierre del día d: clases y su asistencia, tareas, notas pendientes y mañana. */
async function cierreDelDia(repo: Repositorio, d: string) {
  const SEMANA = 7;
  const [nodos, asistencias] = await Promise.all([
    repo.conFechaHasta(sumarDias(d, SEMANA)),
    repo.registros({ clase: "asistencia", desde: d, hasta: d }),
  ]);
  const { atrasadas, dias: [deHoy, manana, ...resto] } = agenda(nodos, d, SEMANA + 1);
  const evaluaciones = nodos.filter((e) => e.tipo === "evento" && deRamo(e) && !e.props?.repite && typeof e.props?.nota !== "number");
  return {
    dia: d,
    pasos: PASOS_CIERRE,
    clases: deHoy.eventos.filter((e) => deRamo(e) && e.props?.repite).map((e) => ({
      clase: e.titulo, ramo: e.caja!.titulo, ramo_id: e.caja!.id, fecha: e.fecha,
      asistencia: asistencias.find((r) => r.nodo_id === e.caja!.id)?.valor ?? null,
    })),
    tareas_de_hoy: deHoy.tareas.map(corto),
    atrasadas: atrasadas.map(corto),
    evaluaciones_sin_nota: evaluaciones.filter((e) => diaDe(e.fecha!) <= d && diaDe(e.fecha!) > sumarDias(d, -30)).map(corto),
    manana: { dia: manana.dia, eventos: manana.eventos.map(corto), tareas: manana.tareas.map(corto) },
    proximas_evaluaciones: [manana, ...resto].flatMap((x) => x.eventos.filter((e) => evaluaciones.includes(e)).map(corto)),
  };
}

const VERSIONES = ["2025-11-25", "2025-06-18", "2025-03-26"];

type Herramienta = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  ejecutar: (repo: Repositorio, args: any) => Promise<unknown>;
};

const texto = { type: "string" };

const EN_COLUMNA = ["estado", "fecha"]; // estas propiedades se guardan en su columna, no en props
const INTERNAS = ["notion_id", "postit", "orden", "portal", "eva"]; // props que pone el sistema, no el usuario (postit: dónde está pegado en el escritorio; orden: el de tus áreas; portal: el nombre de la evaluación en el portal de la U; eva: la entrega de EV@ de una tarea)

/**
 * Paso 23: revisa que las props calcen con las propiedades del tipo (clave conocida, número donde va número,
 * una de las opciones donde hay opciones). Devuelve la lista de problemas; vacía si está todo bien.
 */
export function revisarProps(tipo: Tipo, props: Record<string, unknown> = {}): string[] {
  const propias = (tipo.propiedades ?? []).filter((p) => !EN_COLUMNA.includes(p.clave));
  const problemas: string[] = [];
  for (const [clave, valor] of Object.entries(props)) {
    if (valor === null || INTERNAS.includes(clave)) continue; // null = borrar esa propiedad
    const p = propias.find((x) => x.clave === clave);
    const esperado = !p ? null
      : p.tipo === "numero" ? typeof valor === "number"
      : p.tipo === "booleano" ? typeof valor === "boolean"
      : p.tipo === "seleccion" ? (p.opciones ?? []).includes(valor as string)
      : typeof valor === "string";
    if (!p) problemas.push(`'${clave}' no es una propiedad de ${tipo.clave}`);
    else if (!esperado) problemas.push(`'${clave}' debe ser ${p.tipo === "seleccion" ? "una de: " + p.opciones?.join(", ") : p.tipo}`);
  }
  if (problemas.length) {
    const lista = propias.map((p) => `${p.clave} (${p.tipo}${p.opciones ? ": " + p.opciones.join("/") : ""})`).join(", ");
    problemas.push(`Propiedades de ${tipo.clave}: ${lista || "ninguna"}. Estado y fecha van como campos aparte.`);
  }
  return problemas;
}

// Busca el tipo y revisa las props; si algo no calza, el agente recibe el error con la lista correcta.
async function validar(repo: Repositorio, clave: string, props?: Record<string, unknown>) {
  const tipo = (await repo.listarTipos()).find((t) => t.clave === clave);
  if (!tipo) throw new ErrorHerramienta(`No existe el tipo '${clave}'. Usa listar_tipos para ver los disponibles.`);
  const problemas = revisarProps(tipo, props);
  if (problemas.length) throw new ErrorHerramienta(problemas.join("\n"));
}

/**
 * Convierte las filas del árbol en líneas con sangría, agrupadas por módulo:
 *   # General
 *   Universidad [area] <id>
 *     Base de Datos [ramo] <id>
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
        archivados: { type: "boolean", default: false, description: "Buscar en el archivo en vez de en lo activo" },
        limite: { type: "integer", minimum: 1, maximum: 50, default: 20 },
      },
    },
    ejecutar: (repo, a) =>
      repo.buscarNodos({ texto: a.texto, tipo: a.tipo, estado: a.estado, archivados: a.archivados ?? false, limite: Math.min(a.limite ?? 20, 50) }),
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
    description:
      "Crea un nodo nuevo (tarea, nota, proyecto...) y opcionalmente lo conecta con otros. " +
      "En props usa solo las claves de las propiedades de su tipo (listar_tipos); estado y fecha van aparte.",
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
      await validar(repo, a.tipo, a.props);
      const nodo = await repo.crearNodo({
        tipo: a.tipo, titulo: a.titulo, contenido: a.contenido, estado: a.estado, fecha: a.fecha, props: a.props ?? {},
      });
      for (const c of a.conectar_a ?? []) await repo.conectar(nodo.id, c.relacion, c.destino_id);
      return nodo;
    },
  },
  {
    name: "actualizar_nodo",
    description:
      "Cambia lo que quieras de un nodo: título, contenido, estado, fecha, propiedades o tipo. " +
      "archivado: true lo saca de la vista (se puede recuperar con false); es la forma normal de 'borrar'. " +
      "Las props se suman a las que ya tiene (una en null se borra) y deben ser propiedades de su tipo.",
    inputSchema: {
      type: "object",
      properties: {
        id: texto, titulo: texto, contenido: texto, estado: texto, fecha: texto, props: { type: "object" },
        tipo: { ...texto, description: "Clave del tipo nuevo, ej. 'proyecto'" },
        archivado: { type: "boolean" },
      },
      required: ["id"],
    },
    ejecutar: async (repo, a) => {
      const { id, ...cambios } = a;
      const tipo = cambios.tipo ?? (await repo.tipoDeNodo(id));
      if (!tipo) throw new ErrorHerramienta(`No existe el nodo ${id}`);
      await validar(repo, tipo, cambios.props);
      return repo.actualizarNodo(id, cambios);
    },
  },
  {
    name: "borrar_nodo",
    description:
      "Borra un nodo para siempre, con sus conexiones. Solo funciona si ya está archivado: " +
      "archívalo primero con actualizar_nodo y confirma con el usuario antes de borrar.",
    inputSchema: { type: "object", properties: { id: texto }, required: ["id"] },
    ejecutar: async (repo, a) => {
      if (!(await repo.borrarNodo(a.id))) {
        throw new ErrorHerramienta("No se borró: el nodo no existe o no está archivado. Archívalo primero.");
      }
      return { ok: true };
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
    name: "desconectar_nodos",
    description:
      "Quita una conexión. No se pierde: queda con fecha de término, como historia. " +
      "Sin destino_id quita todas las de esa relación (ej. sacar una tarea de cualquier proyecto).",
    inputSchema: {
      type: "object",
      properties: { origen_id: texto, relacion: texto, destino_id: texto },
      required: ["origen_id", "relacion"],
    },
    ejecutar: async (repo, a) => ({ desconectadas: await repo.desconectar(a.origen_id, a.relacion, a.destino_id) }),
  },
  {
    name: "mover_nodos",
    description:
      "Mueve uno o varios nodos a otra caja de una vez: les quita su conexión anterior de esa relación " +
      "y los conecta al destino. Ej. mover 5 tareas a otro proyecto.",
    inputSchema: {
      type: "object",
      properties: {
        ids: { type: "array", items: texto },
        destino_id: texto,
        relacion: { ...texto, default: "pertenece_a" },
      },
      required: ["ids", "destino_id"],
    },
    ejecutar: async (repo, a) => {
      const relacion = a.relacion ?? "pertenece_a";
      for (const id of a.ids) {
        await repo.desconectar(id, relacion);
        await repo.conectar(id, relacion, a.destino_id);
      }
      return { movidos: a.ids.length };
    },
  },
  {
    name: "agenda_de_hoy",
    description:
      "La agenda día por día: eventos (también los que se repiten, como las clases) y tareas abiertas, " +
      "más las tareas atrasadas. Por defecto solo hoy (hora de Chile); con dias=7, la semana.",
    inputSchema: {
      type: "object",
      properties: {
        fecha: { ...texto, description: "YYYY-MM-DD, por defecto hoy" },
        dias: { type: "integer", minimum: 1, maximum: 31, default: 1 },
      },
    },
    ejecutar: async (repo, a) => {
      const desde = a.fecha ?? hoy(), dias = Math.min(Math.max(a.dias ?? 1, 1), 31);
      return agenda(await repo.conFechaHasta(sumarDias(desde, dias - 1)), desde, dias);
    },
  },
  {
    name: "cierre_del_dia",
    description:
      "Úsala cuando el usuario pida el cierre del día (o en la noche, para repasar el día). Devuelve las clases de hoy " +
      "y si ya marcó asistencia, las tareas de hoy y atrasadas, las evaluaciones sin nota, lo de mañana y los pasos a seguir.",
    inputSchema: { type: "object", properties: { fecha: { ...texto, description: "YYYY-MM-DD, por defecto hoy" } } },
    ejecutar: (repo, a) => cierreDelDia(repo, a.fecha ?? hoy()),
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
  {
    name: "editar_registro",
    description: "Corrige un registro (usa el id que devuelve consultar_registros): monto, fecha, cuenta, categoría, etc.",
    inputSchema: {
      type: "object",
      properties: {
        id: texto, clase: { type: "string", enum: Object.keys(CLASES) }, fecha: texto, titulo: texto,
        valor: { type: "number" }, unidad: texto, nodo_id: texto, otro_id: texto, props: { type: "object" },
      },
      required: ["id"],
    },
    ejecutar: (repo, a) => {
      const { id, ...cambios } = a;
      return repo.editarRegistro(id, cambios);
    },
  },
  {
    name: "borrar_registro",
    description: "Borra un registro anotado por error. Confirma con el usuario antes.",
    inputSchema: { type: "object", properties: { id: texto }, required: ["id"] },
    ejecutar: async (repo, a) => {
      if (!(await repo.borrarRegistro(a.id))) throw new ErrorHerramienta(`No existe el registro ${a.id}`);
      return { ok: true };
    },
  },
  {
    name: "guardar_tipo",
    description:
      "Crea un tipo nuevo o personaliza uno existente: nombre, módulo (General, Finanzas...), orden en la leyenda, " +
      "color, nivel (0 = caja más general; vacío = no contiene a otros), subcaja ({clave_caja: nombre}), " +
      "propiedades y conexiones. Solo cambia lo que mandes. Mira listar_tipos para ver cómo están hoy.",
    inputSchema: {
      type: "object",
      properties: {
        clave: { ...texto, description: "Sin tildes ni espacios, ej. 'viaje'" },
        nombre: texto, modulo: texto, orden: { type: "integer" }, color: { ...texto, description: "Ej. '#2563eb'" },
        nivel: { type: ["integer", "null"] }, subcaja: { type: "object" },
        propiedades: { type: "array", items: { type: "object" } },
        conexiones: { type: "array", items: { type: "object" } },
      },
      required: ["clave"],
    },
    ejecutar: (repo, a) => repo.guardarTipo(a),
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
          "para no duplicar, y conecta cada tarea a su proyecto o área. Si pide el cierre del día, usa cierre_del_dia.",
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
