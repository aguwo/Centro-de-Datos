-- Paso 37a: los objetivos se miden solos y los hitos desaparecen.
--
-- Antes, para medir un objetivo había que colgarle un "hito" con los números (ej. el hito "Peso Objetivo"
-- medía el objetivo de subir de peso). Eran dos cosas para una sola idea. Ahora el objetivo lleva sus números:
--   Desde → Va en → Meta  (y la unidad: kg, CLP...)
-- Un objetivo se mide de una de tres formas, sin tener que elegirla (la web se da cuenta sola):
--   con registros        si tiene medidas anotadas (ej. tu peso), "Va en" es la última
--   a mano               si tiene Meta, "Va en" es lo que escribas
--   por lo que aporta    si no tiene Meta, cuenta cuántos de los proyectos y ramos que aportan ya terminaron

-- 1. El objetivo gana "Va en" (actual), entre Desde y Meta.
update public.tipos
set propiedades = jsonb_insert(propiedades,
  array[(select i - 1 from jsonb_array_elements(propiedades) with ordinality as e(p, i) where p->>'clave' = 'inicio')::text],
  '{"clave":"actual","nombre":"Va en","tipo":"numero"}', true)   -- true = queda justo después de "Desde"
where clave = 'objetivo'
  and propiedades @> '[{"clave":"inicio"}]'::jsonb
  and not propiedades @> '[{"clave":"actual"}]'::jsonb;

-- 2. Los ramos pueden aportar a un objetivo (ej. los 5 ramos aportan a "Aprobar el semestre 2026-2").
update public.tipos
set conexiones = conexiones || '[{"relacion":"aporta_a","hacia":["objetivo"]}]'::jsonb
where clave = 'topico'
  and not conexiones @> '[{"relacion":"aporta_a"}]'::jsonb;

-- 3. Cada hito le pasa sus números al objetivo que medía (si ese objetivo no tenía los suyos)
--    y sus medidas anotadas pasan a ser del objetivo. Así no se pierde nada.
update public.nodos o
set props = o.props || jsonb_strip_nulls(jsonb_build_object(
      'inicio', h.props->'inicio', 'actual', h.props->'actual', 'meta', h.props->'meta', 'unidad', h.props->'unidad'))
from public.nodos h
join public.tipos th on th.id = h.tipo_id and th.clave = 'hito'
join public.conexiones c on c.origen_id = h.id and c.relacion = 'mide'
where o.id = c.destino_id
  and not o.props ? 'meta';

update public.registros r
set nodo_id = c.destino_id
from public.nodos h
join public.tipos th on th.id = h.tipo_id and th.clave = 'hito'
join public.conexiones c on c.origen_id = h.id and c.relacion = 'mide'
where r.nodo_id = h.id;

-- 4. Un hito que no medía nada se vuelve objetivo él mismo (ya tiene inicio, actual, meta y unidad).
update public.nodos h
set tipo_id = (select o.id from public.tipos o where o.clave = 'objetivo' and (o.owner_id = th.owner_id or o.owner_id is null)
               order by o.owner_id nulls last limit 1)   -- tu copia del tipo objetivo, o la plantilla
from public.tipos th
where th.id = h.tipo_id and th.clave = 'hito'
  and not exists (select 1 from public.conexiones c where c.origen_id = h.id and c.relacion = 'mide');

-- 5. Se borran los hitos que ya pasaron sus números (sus conexiones se van con ellos) y el tipo "hito".
delete from public.nodos h using public.tipos th where th.id = h.tipo_id and th.clave = 'hito';
delete from public.tipos where clave = 'hito';
