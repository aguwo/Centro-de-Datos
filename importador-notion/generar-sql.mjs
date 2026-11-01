// Paso 12 (parte 2): convierte lo traducido en un archivo SQL para pegar en el SQL Editor de Supabase.
// Uso: node importador-notion/generar-sql.mjs notion.json > importar.sql
//
// Por qué SQL y no la API: así todo entra en una sola transacción (o entra todo, o nada)
// y no hace falta guardar ninguna clave secreta en tu computador.
// Se puede correr dos veces sin duplicar: cada nodo guarda su notion_id y se salta si ya existe.

import { readFileSync } from "node:fs";
import { traducir } from "./traducir.mjs";

// Texto seguro para SQL: 'O''Higgins'. null se escribe null.
const q = (v) => (v === null || v === undefined ? "null" : `'${String(v).replaceAll("'", "''")}'`);

export function generarSql(notion, ahora) {
  return armarSql(traducir(notion, ahora), "Importación desde Notion");
}

// Arma el SQL a partir de lo ya traducido. Lo usan los dos importadores (paso 12 y paso 17).
// "registros" es opcional: solo el paso 17 los trae (tabla de la migración 0006).
export function armarSql({ nodos, conexiones, registros = [], descartadas = 0 }, titulo) {
  const filasNodos = nodos.map((n) =>
    `(${[n.notion_id, n.tipo, n.titulo, n.contenido, n.estado, n.fecha].map(q).join(", ")}, ${n.archivado}, ${q(JSON.stringify(n.props))})`);
  const filasCon = conexiones.map((c) => `(${[c.origen, c.relacion, c.destino, JSON.stringify(c.props ?? {})].map(q).join(", ")})`);
  const filasReg = registros.map((r) =>
    `(${[r.notion_id, r.clase, r.fecha, r.titulo].map(q).join(", ")}, ${r.valor ?? "null"}, ${[r.unidad, r.nodo, r.otro, JSON.stringify(r.props)].map(q).join(", ")})`);

  // Sin tablas temporales: el SQL Editor de Supabase no siempre las conserva entre sentencias.
  // Cada INSERT lleva sus datos adentro como una lista VALUES.
  const dueno = "(select id from auth.users order by created_at limit 1)";
  const partes = [`-- ${titulo}: ${nodos.length} nodos, ${conexiones.length} conexiones y ${registros.length} registros (${descartadas} conexiones descartadas).
-- Pégalo completo en Supabase > SQL Editor y presiona Run.
-- El dueño es tu usuario (el único registrado): el SQL Editor no tiene sesión, por eso se busca en auth.users.
begin;

-- 1. Los nodos. Se salta cualquiera que ya exista (mismo notion_id), así se puede correr dos veces.
insert into public.nodos (owner_id, tipo_id, titulo, contenido, estado, fecha, archivado, props)
select ${dueno}, t.id, i.titulo, i.contenido, i.estado, i.fecha::timestamptz, i.archivado, i.props::jsonb
  from (values
${filasNodos.join(",\n")}
  ) as i (notion_id, tipo, titulo, contenido, estado, fecha, archivado, props)
  join public.tipos t on t.clave = i.tipo and t.owner_id is null
 where not exists (select 1 from public.nodos n where n.props->>'notion_id' = i.notion_id);`];

  if (filasCon.length) partes.push(`
-- 2. Las conexiones: se buscan los dos extremos por su notion_id.
insert into public.conexiones (owner_id, origen_id, relacion, destino_id, props)
select ${dueno}, o.id, c.relacion, x.id, c.props::jsonb
  from (values
${filasCon.join(",\n")}
  ) as c (origen, relacion, destino, props)
  join public.nodos o on o.props->>'notion_id' = c.origen
  join public.nodos x on x.props->>'notion_id' = c.destino
on conflict (origen_id, relacion, destino_id) do nothing;`);

  if (filasReg.length) partes.push(`
-- 3. Los registros (gastos, días de hábitos, comidas...). "left join": si el nodo no existe, el registro entra igual.
insert into public.registros (owner_id, clase, fecha, titulo, valor, unidad, nodo_id, otro_id, props)
select ${dueno}, r.clase, r.fecha::timestamptz, r.titulo, r.valor::numeric, r.unidad, a.id, b.id, r.props::jsonb
  from (values
${filasReg.join(",\n")}
  ) as r (notion_id, clase, fecha, titulo, valor, unidad, nodo, otro, props)
  left join public.nodos a on a.props->>'notion_id' = r.nodo
  left join public.nodos b on b.props->>'notion_id' = r.otro
 where not exists (select 1 from public.registros x where x.props->>'notion_id' = r.notion_id);`);

  partes.push(`
commit;

-- Para revisar: cuántos nodos de cada tipo quedaron.
select t.nombre, count(*) from public.nodos n join public.tipos t on t.id = n.tipo_id group by 1 order by 2 desc;
`);
  return partes.join("\n");
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const archivo = process.argv[2];
  if (!archivo) throw new Error("Uso: node importador-notion/generar-sql.mjs notion.json > importar.sql");
  process.stdout.write(generarSql(JSON.parse(readFileSync(archivo, "utf8"))));
}
