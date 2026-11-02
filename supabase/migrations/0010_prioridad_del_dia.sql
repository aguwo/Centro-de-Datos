-- Paso 27: tus 3 prioridades del día.
--
-- Una tarea es prioridad de un día cuando su propiedad prioridad_dia tiene esa fecha.
-- Así no hace falta borrar nada al día siguiente: la de ayer ya no coincide con hoy y deja de serlo sola.
-- Se agrega a todos los tipos "tarea" (la plantilla y tu copia, si tienes una) que todavía no la tengan.

update public.tipos
set propiedades = propiedades || '[{"clave":"prioridad_dia","nombre":"Prioridad del día","tipo":"fecha"}]'::jsonb
where clave = 'tarea'
  and not propiedades @> '[{"clave":"prioridad_dia"}]'::jsonb;
