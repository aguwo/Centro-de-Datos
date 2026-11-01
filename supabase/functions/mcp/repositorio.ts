// Implementación del Repositorio sobre Supabase.
// El cliente se crea con el token del usuario, así que Row Level Security filtra todo:
// el agente nunca puede leer ni escribir datos de otra persona.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { FilaArbol, Nodo, Repositorio, Vecino } from "./servidor.ts";

const COLUMNAS = "id, titulo, contenido, estado, fecha, props, tipos!inner(clave)";

function aNodo(fila: any): Nodo {
  const { tipos, ...resto } = fila;
  return { ...resto, tipo: tipos?.clave };
}

function revisar<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data;
}

export function crearRepositorio(db: SupabaseClient): Repositorio {
  async function idDeTipo(clave: string): Promise<string> {
    // Si el usuario tiene su propia versión del tipo, gana sobre la plantilla global.
    const filas = revisar(
      await db.from("tipos").select("id, owner_id").eq("clave", clave).order("owner_id", { nullsFirst: false }).limit(1),
    );
    if (!filas?.length) throw new Error(`No existe el tipo '${clave}'. Usa listar_tipos para ver los disponibles.`);
    return filas[0].id;
  }

  // Le agrega a cada nodo su ruta en el árbol (paso 19), para que el agente sepa dónde está cada cosa.
  async function conRuta(nodos: Nodo[]): Promise<Nodo[]> {
    if (!nodos.length) return nodos;
    const filas = revisar(await db.from("arbol").select("id, ruta").in("id", nodos.map((n) => n.id))) ?? [];
    const rutas = new Map(filas.map((f: any) => [f.id, f.ruta]));
    return nodos.map((n) => ({ ...n, ruta: rutas.get(n.id) }));
  }

  return {
    async listarTipos() {
      return revisar(await db.from("tipos").select("clave, nombre, modulo, propiedades, conexiones").order("orden"));
    },

    async arbol(desde) {
      let q = db.from("arbol").select("id, titulo, tipo, modulo, orden, estado, padre_id");
      if (desde) q = q.contains("camino", [desde]); // el nodo y todo lo que tiene adentro
      return (revisar(await q) ?? []) as FilaArbol[];
    },

    async buscarNodos({ texto, tipo, estado, limite }) {
      let q = db.from("nodos").select(COLUMNAS).eq("archivado", false);
      if (texto) q = q.textSearch("busqueda", texto, { type: "websearch", config: "spanish" });
      if (tipo) q = q.eq("tipos.clave", tipo);
      if (estado) q = q.eq("estado", estado);
      const filas = revisar(await q.order("actualizado_en", { ascending: false }).limit(limite));
      return conRuta((filas ?? []).map(aNodo));
    },

    async verNodo(id, profundidad) {
      const fila = revisar(await db.from("nodos").select(COLUMNAS).eq("id", id).maybeSingle());
      if (!fila) return null;
      const vecinos = revisar(await db.rpc("vecinos", { p_nodo: id, p_profundidad: profundidad })) as any[];
      const ids = (vecinos ?? []).map((v) => v.nodo_id);
      const nodos = ids.length ? revisar(await db.from("nodos").select(COLUMNAS).in("id", ids)) : [];
      const porId = new Map((nodos ?? []).map((n: any) => [n.id, aNodo(n)]));
      return {
        nodo: (await conRuta([aNodo(fila)]))[0],
        vecinos: (vecinos ?? [])
          .filter((v) => porId.has(v.nodo_id))
          .map((v): Vecino => ({ nodo: porId.get(v.nodo_id)!, relacion: v.relacion, direccion: v.direccion, profundidad: v.profundidad })),
      };
    },

    async crearNodo({ tipo, ...datos }) {
      const tipo_id = await idDeTipo(tipo);
      return aNodo(revisar(await db.from("nodos").insert({ ...datos, tipo_id }).select(COLUMNAS).single()));
    },

    async actualizarNodo(id, cambios) {
      return aNodo(revisar(await db.from("nodos").update(cambios).eq("id", id).select(COLUMNAS).single()));
    },

    async conectar(origen_id, relacion, destino_id) {
      revisar(
        await db.from("conexiones").upsert({ origen_id, relacion, destino_id }, {
          onConflict: "origen_id,relacion,destino_id",
          ignoreDuplicates: true,
        }),
      );
    },

    async agendaDelDia(fechaISO) {
      const manana = new Date(new Date(fechaISO + "T00:00:00Z").getTime() + 86_400_000).toISOString();
      const filas = revisar(
        await db.from("nodos").select(COLUMNAS)
          .in("tipos.clave", ["tarea", "evento"])
          .eq("archivado", false)
          .lt("fecha", manana)
          .or("estado.is.null,estado.neq.Hecho") // los eventos no tienen estado
          .order("fecha"),
      );
      return (filas ?? []).map(aNodo);
    },
  };
}
