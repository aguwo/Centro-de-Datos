-- Paso 68: las rutinas de entreno, con sus ejercicios.
--
-- Una rutina de entreno es una caja «rutina» (la misma que agrupa hábitos, como «Mañana») que dice qué Días toca
-- (ej. «Lunes y jueves»). Adentro van sus ejercicios: el tipo nuevo «ejercicio», con sus series, repeticiones y kilos.
-- Cada vez que terminas un entreno, cada ejercicio hecho queda como un registro «medida» (nodo = el ejercicio,
-- valor = los kilos que levantaste): así la web dibuja cómo vas subiendo, sin tablas nuevas.

-- 1. El tipo «ejercicio» (plantilla para todos, como en los pasos 2 y 16), en el módulo Salud.
insert into public.tipos (owner_id, clave, nombre, propiedades, conexiones, modulo, orden, color, nivel, subcaja)
select null, 'ejercicio', 'Ejercicio',
  '[{"clave":"series","nombre":"Series","tipo":"numero"},
    {"clave":"reps","nombre":"Repeticiones","tipo":"texto"},
    {"clave":"kg","nombre":"Kilos","tipo":"numero"}]'::jsonb,
  '[{"relacion":"pertenece_a","hacia":["rutina"]}]'::jsonb,
  'Salud', 33, '#1d4ed8', null, '{}'::jsonb
where not exists (select 1 from public.tipos where clave = 'ejercicio' and owner_id is null);

-- 2. La rutina gana «Días» (en qué días de la semana toca), escrito igual que en un hábito.
--    A todos los tipos «rutina» (la plantilla y tu copia, si tienes una) que todavía no lo tengan.
update public.tipos
set propiedades = propiedades || '[{"clave":"dias","nombre":"Días","tipo":"texto"}]'::jsonb
where clave = 'rutina'
  and not propiedades @> '[{"clave":"dias"}]'::jsonb;
