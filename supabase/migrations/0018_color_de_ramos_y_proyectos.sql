-- Paso 54: cada ramo o proyecto puede tener su color fijo.
--
-- Hasta ahora el color salía solo (de su id), así que no se podía elegir. Ahora tópicos y proyectos tienen
-- la propiedad "Color", con los mismos colores de la paleta de la web (base.js, PALETA). Si no eliges, sigue
-- saliendo solo, y nunca repite uno que ya elegiste para otro.
-- Se agrega a todos los tipos "tópico" y "proyecto" (la plantilla y tu copia, si tienes una) que no la tengan.

update public.tipos
set propiedades = propiedades || '[{"clave":"color","nombre":"Color","tipo":"seleccion","opciones":["Azul","Verde","Rosado","Naranjo","Morado","Turquesa","Rojo","Café"]}]'::jsonb
where clave in ('topico', 'proyecto')
  and not propiedades @> '[{"clave":"color"}]'::jsonb;
