-- Paso 36: los tópicos (tus ramos) también se terminan.
--
-- Un tópico ahora tiene el mismo estado que un proyecto, y un resultado para cuando termina:
--   En curso            lo estás cursando
--   Hecho + Resultado   lo terminaste: Aprobado o Reprobado
-- Así un ramo aprobado se pliega solo con lo terminado (página Proyectos, mapa), igual que un proyecto cerrado,
-- y no hace falta nada escrito solo para la universidad.
-- Se agrega a todos los tipos "tópico" (la plantilla y tu copia, si tienes una) que todavía no lo tengan.

update public.tipos
set propiedades = propiedades || '[{"clave":"estado","nombre":"Estado","tipo":"estado"}]'::jsonb
where clave = 'topico'
  and not propiedades @> '[{"clave":"estado"}]'::jsonb;

update public.tipos
set propiedades = propiedades || '[{"clave":"resultado","nombre":"Resultado","tipo":"seleccion","opciones":["Aprobado","Reprobado"]}]'::jsonb
where clave = 'topico'
  and not propiedades @> '[{"clave":"resultado"}]'::jsonb;

-- Los ramos que ya tienes (los tópicos con semestre y sin estado) quedan "En curso".
update public.nodos n
set estado = 'En curso'
from public.tipos t
where n.tipo_id = t.id
  and t.clave = 'topico'
  and n.props ? 'semestre'
  and n.estado is null;
