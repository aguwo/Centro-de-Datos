-- Paso 58: cada proyecto puede tener su foto de portada.
--
-- Es el enlace a una foto (https://…). Se ve grande arriba de la página del proyecto y en su tarjeta de la galería.
-- Si no tiene, se usa el dibujo de su tema (dibujos.js). Su tipo es "imagen": se escribe igual que un enlace,
-- pero la web lo muestra como foto y no como botón.
-- Se agrega a todos los tipos "proyecto" (la plantilla y tu copia, si tienes una) que todavía no la tengan.

update public.tipos
set propiedades = propiedades || '[{"clave":"portada","nombre":"Portada","tipo":"imagen"}]'::jsonb
where clave = 'proyecto'
  and not propiedades @> '[{"clave":"portada"}]'::jsonb;
