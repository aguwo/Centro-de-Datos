-- Paso 38c: cada proyecto puede llevar el enlace a su proyecto en Claude.
--
-- Así se cruzan los dos lados: desde la página Proyectos, «Proyecto en Claude ↗» abre la conversación de ese proyecto;
-- y en las instrucciones del proyecto de Claude va el nombre (y el id) del proyecto en tu centro de datos.
-- No todos los proyectos tienen uno: el campo queda vacío hasta que lo pegues.
-- Se agrega a todos los tipos "proyecto" (la plantilla y tu copia, si tienes una) que todavía no lo tengan.

update public.tipos
set propiedades = propiedades || '[{"clave":"claude","nombre":"Proyecto en Claude","tipo":"enlace"}]'::jsonb
where clave = 'proyecto'
  and not propiedades @> '[{"clave":"claude"}]'::jsonb;
