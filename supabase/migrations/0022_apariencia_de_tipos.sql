-- Paso 102: cada categoría (tipo) dice cómo se ve en Archivos.
--
-- apariencia es un objeto con:
--   icono     su ícono (un nombre de docs/js/dibujos.js, ej. "lista")
--   forma     tarjeta, check, anillo, calendario, hoja, medidor o portada (docs/js/formas.js). Sin forma: tarjeta.
--   registro  (anillo y medidor) la clase de registro que cuenta, ej. "habito"
--   cada      (medidor) la propiedad con cada cuántos días toca
--   accion    (medidor) lo que dice su botón, ej. "Regué"
-- Ninguna forma sabe de una categoría en particular: todo sale de aquí. Las tuyas (como Plantas) las eliges tú
-- en el creador de categorías (paso siguiente). Aquí solo se le pone ícono a todas y forma a las de base que
-- tienen una obvia. Se aplica a la plantilla y a tu copia, si tienes una, solo si todavía no tienen apariencia.

alter table public.tipos add column if not exists apariencia jsonb not null default '{}'::jsonb;

update public.tipos t set apariencia = v.apariencia::jsonb
from (values
  ('area',        '{"icono":"carpeta"}'),
  ('topico',      '{"icono":"libro"}'),
  ('proyecto',    '{"icono":"proyecto"}'),
  ('objetivo',    '{"icono":"objetivo"}'),
  ('categoria',   '{"icono":"monedas"}'),
  ('rutina',      '{"icono":"reloj"}'),
  ('cuenta',      '{"icono":"billetera"}'),
  ('suscripcion', '{"icono":"repetir"}'),
  ('alimento',    '{"icono":"manzana"}'),
  ('receta',      '{"icono":"plato"}'),
  ('hito',        '{"icono":"estrella"}'),
  ('tarea',       '{"icono":"si","forma":"check"}'),
  ('nota',        '{"icono":"lista","forma":"hoja"}'),
  ('evento',      '{"icono":"calendario","forma":"calendario"}'),
  ('habito',      '{"icono":"repetir","forma":"anillo","registro":"habito"}'),
  ('recurso',     '{"icono":"libro","forma":"portada"}')
) as v (clave, apariencia)
where t.clave = v.clave and t.apariencia = '{}'::jsonb;
