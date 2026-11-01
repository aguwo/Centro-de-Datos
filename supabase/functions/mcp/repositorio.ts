// Implementación del Repositorio sobre Supabase.
// El cliente se crea con el token del usuario, así que Row Level Security filtra todo:
// el agente nunca puede leer ni escribir datos de otra persona.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { FilaArbol, Nodo, Registro, RegistroLegible, Repositorio, Tipo, Vecino } from "./servidor.ts";

const COLUMNAS = "id, titulo, contenido, estado, fecha, props, archivado, tipos!inner(clave)";
const COLUMNAS_TIPO = "clave, nombre, modulo, orden, color, nivel, subcaja, propiedades, conexiones";

function aNodo(fila: any): Nodo {
  const { tipos, ...resto } = fila;
  return { ...resto, tipo: tipos?.clave };
}

function revisar<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data;
}

// usuario: el id de quien llama. Hace falta solo para crear tipos, porque en tipos un dueño vacío
// significa "plantilla para todos" (en las demás tablas el dueño se pone solo).
export function crearRepositorio(db: SupabaseClient, usuario: string): Repositorio {
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
      return revisar(await db.from("tipos").select(COLUMNAS_TIPO).order("orden"));
    },

    async arbol(desde) {
      let q = db.from("arbol").select("id, titulo, tipo, modulo, orden, estado, padre_id");
      if (desde) q = q.contains("camino", [desde]); // el nodo y todo lo que tiene adentro
      return (revisar(await q) ?? []) as FilaArbol[];
    },

    async buscarNodos({ texto, tipo, estado, archivados = false, limite }) {
      let q = db.from("nodos").select(COLUMNAS).eq("archivado", archivados);
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

    async actualizarNodo(id, { tipo, ...cambios }) {
      const fila = tipo ? { ...cambios, tipo_id: await idDeTipo(tipo) } : cambios;
      return aNodo(revisar(await db.from("nodos").update(fila).eq("id", id).select(COLUMNAS).single()));
    },

    async borrarNodo(id) {
      const filas = revisar(await db.from("nodos").delete().eq("id", id).eq("archivado", true).select("id"));
      return (filas ?? []).length > 0;
    },

    async conectar(origen_id, relacion, destino_id) {
      // Si la conexión existía y se había quitado, vuelve a estar vigente.
      revisar(
        await db.from("conexiones").upsert({ origen_id, relacion, destino_id, valido_hasta: null }, {
          onConflict: "origen_id,relacion,destino_id",
        }),
      );
    },

    async desconectar(origen_id, relacion, destino_id) {
      let q = db.from("conexiones").update({ valido_hasta: new Date().toISOString() })
        .eq("origen_id", origen_id).eq("relacion", relacion).is("valido_hasta", null);
      if (destino_id) q = q.eq("destino_id", destino_id);
      return (revisar(await q.select("id")) ?? []).length;
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

    async anotarRegistro(r) {
      return revisar(await db.from("registros").insert(r).select("id, clase, fecha, titulo, valor, unidad, nodo_id, otro_id, props").single()) as Registro;
    },

    async registros({ clase, nodo_id, desde, hasta }) {
      let q = db.from("registros_legibles").select("fecha, clase, titulo, valor, unidad, nodo, otro, nodo_id, otro_id, props");
      if (clase) q = q.eq("clase", clase);
      if (nodo_id) q = q.or(`nodo_id.eq.${nodo_id},otro_id.eq.${nodo_id}`); // ej. una categoría está en "otro"
      if (desde) q = q.gte("fecha", desde);
      if (hasta) q = q.lt("fecha", new Date(new Date(hasta + "T00:00:00Z").getTime() + 86_400_000).toISOString()); // incluye ese día
      return (revisar(await q.order("fecha", { ascending: false }).limit(5000)) ?? []) as RegistroLegible[];
    },

    async editarRegistro(id, cambios) {
      return revisar(await db.from("registros").update(cambios).eq("id", id).select().single()) as Registro;
    },

    async borrarRegistro(id) {
      return (revisar(await db.from("registros").delete().eq("id", id).select("id")) ?? []).length > 0;
    },

    async guardarTipo({ clave, ...cambios }) {
      const filas = revisar(await db.from("tipos").select("id, owner_id, " + COLUMNAS_TIPO).eq("clave", clave)) ?? [];
      const mio = filas.find((t: any) => t.owner_id);
      const plantilla = filas.find((t: any) => !t.owner_id);
      if (mio) return revisar(await db.from("tipos").update(cambios).eq("id", mio.id).select(COLUMNAS_TIPO).single()) as Tipo;

      // No tienes uno propio: se crea tu versión (partiendo de la plantilla, si hay) y tus nodos pasan a usarla.
      const { id: _id, owner_id: _o, ...base } = (plantilla ?? {}) as any;
      if (!plantilla && !cambios.nombre) throw new Error(`El tipo '${clave}' es nuevo: falta su nombre.`);
      const nuevo = revisar(await db.from("tipos").insert({ ...base, ...cambios, clave, owner_id: usuario }).select("id, " + COLUMNAS_TIPO).single()) as any;
      if (plantilla) revisar(await db.from("nodos").update({ tipo_id: nuevo.id }).eq("tipo_id", plantilla.id));
      const { id: _n, ...tipo } = nuevo;
      return tipo as Tipo;
    },
  };
}
