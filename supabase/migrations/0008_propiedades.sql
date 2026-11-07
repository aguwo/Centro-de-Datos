-- Paso 23: cada propiedad con su clave exacta.
--
-- Antes, un tipo decía "Prioridad" o "Aguanta sin agua (días)", pero los nodos guardaban `prioridad`
-- o `aguanta_dias`, y nada unía un nombre con el otro. El agente inventaba nombres y la web no podía
-- mostrar ni editar las propiedades.
--
-- Ahora cada propiedad dice:
--   clave   cómo se guarda. Si es "estado" o "fecha" va en esa columna del nodo; si no, en props.<clave>.
--   nombre  cómo se muestra.
--   tipo    texto, numero, fecha, fecha_hora, seleccion, booleano, enlace, imagen (el enlace a una foto, paso 58) o estado.
--   opciones (solo en seleccion) los valores permitidos.

update public.tipos t set propiedades = v.propiedades::jsonb
from (values
('area', '[
  {"clave":"tipo","nombre":"Tipo","tipo":"seleccion","opciones":["Personal","Académico","Empresa"]}]'),
('topico', '[
  {"clave":"semestre","nombre":"Semestre","tipo":"texto"}]'),
('nota', '[
  {"clave":"tipo","nombre":"Tipo","tipo":"seleccion","opciones":["Nota rápida","Apuntes clase","Resumen"]},
  {"clave":"enlace","nombre":"Enlace","tipo":"enlace"},
  {"clave":"favorito","nombre":"Favorito","tipo":"booleano"}]'),
('objetivo', '[
  {"clave":"estado","nombre":"Estado","tipo":"estado"},
  {"clave":"fecha","nombre":"Fecha tope","tipo":"fecha"},
  {"clave":"inicio","nombre":"Desde","tipo":"numero"},
  {"clave":"meta","nombre":"Meta","tipo":"numero"},
  {"clave":"unidad","nombre":"Unidad","tipo":"texto"}]'),
('hito', '[
  {"clave":"estado","nombre":"Estado","tipo":"estado"},
  {"clave":"inicio","nombre":"Inicio","tipo":"numero"},
  {"clave":"actual","nombre":"Actual","tipo":"numero"},
  {"clave":"meta","nombre":"Meta","tipo":"numero"},
  {"clave":"unidad","nombre":"Unidad","tipo":"texto"}]'),
('proyecto', '[
  {"clave":"estado","nombre":"Estado","tipo":"estado"},
  {"clave":"prioridad","nombre":"Prioridad","tipo":"seleccion","opciones":["Urgente","Alta","Media","Baja"]},
  {"clave":"fecha","nombre":"Inicio","tipo":"fecha"},
  {"clave":"fecha_fin","nombre":"Fin","tipo":"fecha"}]'),
('tarea', '[
  {"clave":"estado","nombre":"Estado","tipo":"estado"},
  {"clave":"fecha","nombre":"Fecha","tipo":"fecha"},
  {"clave":"fecha_fin","nombre":"Hasta","tipo":"fecha"},
  {"clave":"repeticion","nombre":"Repetición","tipo":"seleccion","opciones":["Ninguna","Diaria","Semanal","Mensual"]}]'),
('evento', '[
  {"clave":"fecha","nombre":"Fecha y hora","tipo":"fecha_hora"},
  {"clave":"fecha_fin","nombre":"Termina","tipo":"fecha_hora"},
  {"clave":"tipo","nombre":"Tipo","tipo":"seleccion","opciones":["Individual","Parejas","Grupal"]}]'),
('cuenta', '[
  {"clave":"saldo_inicial","nombre":"Saldo inicial","tipo":"numero"}]'),
('categoria', '[
  {"clave":"presupuesto_semanal","nombre":"Presupuesto semanal","tipo":"numero"}]'),
('suscripcion', '[
  {"clave":"precio","nombre":"Precio","tipo":"numero"},
  {"clave":"periodo","nombre":"Período","tipo":"seleccion","opciones":["Mensual","Anual"]},
  {"clave":"activa","nombre":"Activa","tipo":"booleano"}]'),
('rutina', '[]'),
('habito', '[
  {"clave":"descripcion","nombre":"Descripción","tipo":"texto"},
  {"clave":"dias","nombre":"Días","tipo":"texto"}]'),
('alimento', '[
  {"clave":"macro","nombre":"Macro principal","tipo":"seleccion","opciones":["Proteína","Carbohidrato","Grasa"]},
  {"clave":"kcal_100g","nombre":"kcal/100g","tipo":"numero"},
  {"clave":"prot_100g","nombre":"Proteína/100g","tipo":"numero"},
  {"clave":"carb_100g","nombre":"Carbohidratos/100g","tipo":"numero"},
  {"clave":"grasa_100g","nombre":"Grasa/100g","tipo":"numero"},
  {"clave":"porcion","nombre":"Porción","tipo":"texto"},
  {"clave":"porcion_g","nombre":"Porción (g)","tipo":"numero"},
  {"clave":"despensa","nombre":"Despensa","tipo":"seleccion","opciones":["Agotado","Bajo","Suficiente"]},
  {"clave":"compra","nombre":"Compra","tipo":"seleccion","opciones":["Semanal","Mensual"]},
  {"clave":"cantidad_compra","nombre":"Cuánto comprar","tipo":"texto"}]'),
('receta', '[
  {"clave":"comida","nombre":"Comida","tipo":"seleccion","opciones":["Desayuno","Almuerzo","Merienda","Cena"]},
  {"clave":"rinde","nombre":"Rinde (porciones)","tipo":"numero"}]'),
('planta', '[
  {"clave":"especie","nombre":"Especie","tipo":"texto"},
  {"clave":"salud","nombre":"Salud","tipo":"seleccion","opciones":["Saludable","En observación","Enferma / plaga","Por comprar","Q.E.P.D."]},
  {"clave":"luz","nombre":"Luz","tipo":"seleccion","opciones":["Indirecta brillante","Media","Sombra","Sol directo"]},
  {"clave":"aguanta_dias","nombre":"Aguanta sin agua (días)","tipo":"numero"},
  {"clave":"obtenida","nombre":"Fecha de obtención","tipo":"fecha"}]'),
('recurso', '[
  {"clave":"estado","nombre":"Estado","tipo":"estado"},
  {"clave":"formato","nombre":"Formato","tipo":"seleccion","opciones":["Libro","Película","Artículo","Video","Podcast"]},
  {"clave":"plataforma","nombre":"Dónde","tipo":"texto"},
  {"clave":"enlace","nombre":"Enlace","tipo":"enlace"}]')
) as v (clave, propiedades)
where t.clave = v.clave and t.owner_id is null;

-- Los pocos datos que no calzaban con su tipo se ajustan:
-- el objetivo de ahorro guardaba la meta como meta_clp y el punto de partida como saldo_inicial.
update public.nodos n
set props = (n.props - 'meta_clp' - 'saldo_inicial')
  || jsonb_strip_nulls(jsonb_build_object('meta', n.props->'meta_clp', 'inicio', n.props->'saldo_inicial'))
  || '{"unidad": "CLP"}'
from public.tipos t
where t.id = n.tipo_id and t.clave = 'objetivo' and n.props ? 'meta_clp';

-- "Proteina" pasa a escribirse con tilde, igual que la opción.
update public.nodos set props = jsonb_set(props, '{macro}', '"Proteína"') where props->>'macro' = 'Proteina';
