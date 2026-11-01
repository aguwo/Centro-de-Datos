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
  const { nodos, conexiones, descartadas } = traducir(notion, ahora);
  const filasNodos = nodos.map((n) =>
    `(${[n.notion_id, n.tipo, n.titulo, n.contenido, n.estado, n.fecha].map(q).join(", ")}, ${n.archivado}, ${q(JSON.stringify(n.props))}::jsonb)`);
  const filasCon = conexiones.map((c) => `(${[c.origen, c.relacion, c.destino].map(q).join(", ")})`);

  return `-- Importación desde Notion: ${nodos.length} nodos y ${conexiones.length} conexiones (${descartadas} descartadas).
-- Pégalo completo en Supabase > SQL Editor y presiona Run.
begin;

-- 1. Dueño: tu usuario (el único registrado). El SQL Editor no tiene sesión, por eso se busca así.
create temp table _dueno on commit drop as select id from auth.users order by created_at limit 1;

-- 2. Los nodos traducidos, en una tabla temporal que desaparece al terminar.
create temp table _nodos (notion_id text, tipo text, titulo text, contenido text, estado text,
                          fecha timestamptz, archivado boolean, props jsonb) on commit drop;
insert into _nodos values
${filasNodos.join(",\n")};

insert into public.nodos (owner_id, tipo_id, titulo, contenido, estado, fecha, archivado, props)
select d.id, t.id, i.titulo, i.contenido, i.estado, i.fecha, i.archivado, i.props
  from _nodos i
  cross join _dueno d
  join public.tipos t on t.clave = i.tipo and t.owner_id is null
 where not exists (select 1 from public.nodos n where n.props->>'notion_id' = i.notion_id);

-- 3. Las conexiones: se buscan los dos extremos por su notion_id.
create temp table _conexiones (origen text, relacion text, destino text) on commit drop;
insert into _conexiones values
${filasCon.join(",\n")};

insert into public.conexiones (owner_id, origen_id, relacion, destino_id)
select d.id, o.id, c.relacion, x.id
  from _conexiones c
  cross join _dueno d
  join public.nodos o on o.props->>'notion_id' = c.origen
  join public.nodos x on x.props->>'notion_id' = c.destino
on conflict (origen_id, relacion, destino_id) do nothing;

commit;

-- Para revisar: cuántos nodos de cada tipo quedaron.
select t.nombre, count(*) from public.nodos n join public.tipos t on t.id = n.tipo_id group by 1 order by 2 desc;
`;
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const archivo = process.argv[2];
  if (!archivo) throw new Error("Uso: node importador-notion/generar-sql.mjs notion.json > importar.sql");
  process.stdout.write(generarSql(JSON.parse(readFileSync(archivo, "utf8"))));
}
