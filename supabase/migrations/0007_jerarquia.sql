-- Paso 19: la jerarquía vive en la base, no escrita a mano en la web.
--
-- Hasta ahora la web tenía sus propias listas (qué color tiene cada tipo, cuál puede contener a cuál,
-- qué subcajas armar). El agente no las veía, y agregar un tipo obligaba a tocar el código.
-- Ahora cada tipo dice dónde va, y dos vistas te dan todo ya ordenado:
--   * arbol:              cada nodo con su caja padre y su ruta completa ("Universidad / Base de Datos / Proyecto BD").
--   * registros_legibles: cada registro con los nombres de lo que toca, en vez de ids.

-- 1. Cada tipo dice:
--    modulo  en qué parte de tu vida va (General, Productividad, Finanzas, Salud...): ordena la leyenda
--            y listar_tipos, y lo que no está dentro de ninguna caja se junta en la caja de su módulo.
--    orden   su lugar en la leyenda y en las listas (de diez en diez por módulo).
--    color   su color en el mapa.
--    nivel   si puede contener a otros, qué tan general es (0 = lo más general). Un nodo solo queda
--            dentro de algo de nivel MENOR, así nunca hay una caja dentro de sí misma. Vacío = no contiene.
--    subcaja dentro de qué cajas los nodos de este tipo se juntan en su propia subcaja.
--            Ej. en "evento": {"topico": "Evaluaciones"} = dentro de un tópico, los eventos van en "Evaluaciones".
alter table public.tipos
  add column modulo  text not null default 'Otros',
  add column orden   int  not null default 100,
  add column color   text not null default '#78716c',
  add column nivel   int,
  add column subcaja jsonb not null default '{}'::jsonb;

update public.tipos t set modulo = v.modulo, orden = v.orden, color = v.color, nivel = v.nivel, subcaja = v.subcaja::jsonb
from (values
  ('area',        'General',         1, '#2563eb', 0,    '{}'),
  ('topico',      'General',         2, '#64748b', 1,    '{}'),
  ('nota',        'General',         3, '#ca8a04', null, '{}'),
  ('objetivo',    'Productividad',  11, '#7c3aed', 2,    '{}'),
  ('hito',        'Productividad',  12, '#db2777', null, '{}'),
  ('proyecto',    'Productividad',  13, '#ea580c', 2,    '{}'),
  ('tarea',       'Productividad',  14, '#16a34a', null, '{}'),
  ('evento',      'Productividad',  15, '#0891b2', null, '{"topico": "Evaluaciones"}'),
  ('cuenta',      'Finanzas',       21, '#0d9488', null, '{}'),
  ('categoria',   'Finanzas',       22, '#14b8a6', 2,    '{}'),
  ('suscripcion', 'Finanzas',       23, '#5eead4', null, '{}'),
  ('rutina',      'Salud',          31, '#4d7c0f', 2,    '{}'),
  ('habito',      'Salud',          32, '#65a30d', null, '{}'),
  ('alimento',    'Dieta',          41, '#f59e0b', null, '{}'),
  ('receta',      'Dieta',          42, '#d97706', null, '{}'),
  ('planta',      'Plantas',        51, '#22c55e', null, '{}'),
  ('recurso',     'Biblioteca',     61, '#9333ea', null, '{}')
) as v (clave, modulo, orden, color, nivel, subcaja)
where t.clave = v.clave and t.owner_id is null;

-- 2. El árbol. Para cada nodo se elige UNA caja padre: de todo lo que "pertenece a" o "trata sobre",
--    lo más específico (el nivel más alto) que siga siendo más general que el propio nodo.
--    Ej: "Transformar MER" pertenece al proyecto y trata sobre la materia: queda en el proyecto,
--    el proyecto en la materia y la materia en Universidad.
--    security_invoker hace que la vista respete RLS: cada uno ve solo su árbol.
create view public.arbol with (security_invoker = true) as
with recursive
vivos as (
  select n.id, n.titulo, n.estado, n.fecha, t.clave as tipo, t.modulo, t.orden, t.nivel
  from public.nodos n join public.tipos t on t.id = n.tipo_id
  where not n.archivado
),
padres as (
  select distinct on (c.origen_id) c.origen_id as id, c.destino_id as padre_id
  from public.conexiones c
  join vivos o on o.id = c.origen_id
  join vivos d on d.id = c.destino_id
  where c.valido_hasta is null
    and c.relacion in ('pertenece_a', 'trata_sobre')
    and d.nivel < coalesce(o.nivel, 99)          -- d.nivel vacío = no es caja, y la comparación lo descarta
  order by c.origen_id, d.nivel desc, d.titulo
),
r as (
  -- Las raíces: lo que no está dentro de nada.
  select v.id, v.titulo, v.tipo, v.modulo, v.orden, v.estado, v.fecha, null::uuid as padre_id,
         0 as profundidad, v.titulo as ruta, array[v.id] as camino
  from vivos v
  where not exists (select 1 from padres p where p.id = v.id)
  union all
  -- Cada vuelta baja un nivel: los hijos de lo que ya está en el árbol.
  select v.id, v.titulo, v.tipo, v.modulo, v.orden, v.estado, v.fecha, p.padre_id,
         r.profundidad + 1, r.ruta || ' / ' || v.titulo, r.camino || v.id
  from r
  join padres p on p.padre_id = r.id
  join vivos v on v.id = p.id
)
-- camino: los ids desde la raíz hasta el nodo. Sirve para pedir "todo lo que está dentro de X".
select id, titulo, tipo, modulo, orden, estado, fecha, padre_id, profundidad, ruta, camino from r;

-- 3. Los registros con nombres. "nodo" y "otro" significan lo que dice la clase (ver paso 16):
--    en un gasto, nodo = la cuenta y otro = la categoría; en una comida, nodo = el alimento o receta.
create view public.registros_legibles with (security_invoker = true) as
select r.id, r.fecha, r.clase, coalesce(r.titulo, n.titulo) as titulo, r.valor, r.unidad,
       n.titulo as nodo, o.titulo as otro, r.nodo_id, r.otro_id, r.props
from public.registros r
left join public.nodos n on n.id = r.nodo_id
left join public.nodos o on o.id = r.otro_id;
