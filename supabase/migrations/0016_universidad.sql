-- Paso 46a: el apartado Universidad. Tus ramos con sus notas y tu asistencia.
--
-- No hace falta nada nuevo para los ramos: ya son tópicos con semestre, y sus evaluaciones ya son eventos
-- dentro del ramo (Certamen 1, Laboratorio 3...). Solo faltan dos números y una forma de anotar si fuiste a clases:
--   1. Cada evento puede llevar su Ponderación (cuánto vale, en %) y su Nota (de 1 a 7).
--      Con eso la web calcula tu nota hasta ahora y cuánto necesitas en lo que falta para aprobar.
--   2. Un registro nuevo, "asistencia": nodo = el ramo, valor = 1 si fuiste y 0 si faltaste.
--      Lo anotas desde la página del ramo (y, más adelante, te lo pregunta Martita en la noche).

-- 1. Ponderación y nota en los eventos (la plantilla y tu copia, si tienes una), si todavía no las tienen.
update public.tipos
set propiedades = propiedades || '[{"clave":"peso","nombre":"Ponderación (%)","tipo":"numero"}]'::jsonb
where clave = 'evento'
  and not propiedades @> '[{"clave":"peso"}]'::jsonb;

update public.tipos
set propiedades = propiedades || '[{"clave":"nota","nombre":"Nota","tipo":"numero"}]'::jsonb
where clave = 'evento'
  and not propiedades @> '[{"clave":"nota"}]'::jsonb;

-- 2. La clase de registro "asistencia". La lista de clases permitidas se vuelve a escribir con la nueva al final.
alter table public.registros drop constraint if exists registros_clase_check;
alter table public.registros add constraint registros_clase_check
  check (clase in ('gasto','ingreso','transferencia','habito','medida','comida','riego','asistencia'));
