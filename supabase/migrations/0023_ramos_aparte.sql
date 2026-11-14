-- Paso 110: los ramos dejan de ser tópicos y pasan a su propia categoría, «Ramo». Así «Tópico» queda general
-- (cualquier tema: Botánica, Música, Conocimiento Personal...) y lo de la U (semestre, resultado, curso en EV@)
-- solo lo tienen los ramos.
--
-- 1. La categoría Ramo: una copia de cómo era Tópico (sus propiedades, dónde va y con qué se conecta), para la
--    plantilla y para tu copia, si tienes una. Ícono: el libro de siempre.
insert into public.tipos (owner_id, clave, nombre, descripcion, modulo, orden, color, nivel, subcaja, propiedades, conexiones, apariencia)
select owner_id, 'ramo', 'Ramo', 'Un ramo de la U: sus clases, evaluaciones, notas y asistencia', 'General', 4, color, nivel, '{}'::jsonb,
       propiedades, conexiones, '{"icono":"libro"}'::jsonb
from public.tipos where clave = 'topico'
on conflict (owner_id, clave) do nothing;

-- 2. Tus ramos (los tópicos con semestre o con curso en EV@) se cambian a Ramo. Son los mismos nodos, con sus
--    mismas conexiones, tareas, eventos y notas: solo cambia su categoría.
update public.nodos n set tipo_id = r.id
from public.tipos t
join public.tipos r on r.clave = 'ramo' and r.owner_id is not distinct from t.owner_id
where n.tipo_id = t.id and t.clave = 'topico'
  and (n.props ? 'semestre' or n.props ? 'eva');

-- 3. Tópico queda general: estado, color y una descripción, con un ícono de etiqueta.
update public.tipos set
  propiedades = '[{"clave":"estado","nombre":"Estado","tipo":"estado"},
                  {"clave":"color","nombre":"Color","tipo":"seleccion","opciones":["Azul","Verde","Rosado","Naranjo","Morado","Turquesa","Rojo","Café"]},
                  {"clave":"descripcion","nombre":"Descripción","tipo":"texto"}]'::jsonb,
  descripcion = 'Un tema que te interesa: junta notas, recursos, proyectos y tareas sobre lo mismo',
  apariencia = apariencia || '{"icono":"etiqueta"}'::jsonb
where clave = 'topico';

-- 4. Lo que podía ir «sobre» un tópico (notas, tareas, eventos, proyectos, recursos) ahora también puede ir sobre
--    un ramo. Y dentro de un ramo, los eventos se agrupan en «Evaluaciones» (antes era dentro de un tópico).
update public.tipos set conexiones = (
  select jsonb_agg(case when c->'hacia' ? 'topico' and not c->'hacia' ? 'ramo'
                        then jsonb_set(c, '{hacia}', (c->'hacia') || '"ramo"') else c end)
  from jsonb_array_elements(conexiones) c)
where conexiones @> '[{"hacia":["topico"]}]'::jsonb;

update public.tipos set subcaja = (subcaja - 'topico') || '{"ramo":"Evaluaciones"}'::jsonb
where subcaja ? 'topico';
