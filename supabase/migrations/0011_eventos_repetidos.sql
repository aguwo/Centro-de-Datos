-- Paso 30: eventos que se repiten (como en Google Calendar).
--
-- Un evento repetido es un solo nodo: su fecha es la primera vez, y estas propiedades dicen cómo sigue.
--   repite        cada cuánto: Cada día, Cada semana, Días hábiles, Cada mes o Cada año
--   repite_hasta  el último día en que se repite (vacío = sin fin)
--   excepto       los días en que NO ocurre ("eliminar solo este"), como texto: 2026-11-09,2026-11-16
--                 La marca "oculta" dice que no se muestra en los formularios: la maneja el calendario.
-- Se agregan a todos los tipos "evento" (la plantilla y tu copia, si tienes una) que todavía no las tengan.

update public.tipos
set propiedades = propiedades || '[
  {"clave":"repite","nombre":"Se repite","tipo":"seleccion","opciones":["Cada día","Cada semana","Días hábiles","Cada mes","Cada año"]},
  {"clave":"repite_hasta","nombre":"Hasta","tipo":"fecha"},
  {"clave":"excepto","nombre":"Excepto","tipo":"texto","oculta":true}]'::jsonb
where clave = 'evento'
  and not propiedades @> '[{"clave":"repite"}]'::jsonb;
