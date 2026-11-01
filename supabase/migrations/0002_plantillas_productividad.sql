-- Paso 2: los tipos de productividad, cargados como plantillas.
-- Vienen de tu Notion, simplificados para no repetir nada:
--   * Bloque de notas se fusionó con Tópico (los dos agrupaban notas).
--   * Todo lo que se puede "hacer" usa los mismos estados: Inbox, Por hacer, En curso, Esperando, Hecho.
--   * "Sin fecha" no es un estado: basta con dejar la fecha vacía.
--   * "Repetitiva" es una propiedad (Repetición), no un estado.
--   * El evento no tiene estado: ocurre en una fecha. Lo que hay que hacer antes es una tarea conectada.
--   * "Archivo" no está aquí porque será una columna común de todos los nodos (paso 3).
-- owner_id NULL = plantilla global: cualquier usuario puede leerlos y usarlos.

insert into public.tipos (owner_id, clave, nombre, propiedades, conexiones) values
(null, 'area', 'Área',
 '[{"nombre":"Tipo","tipo":"seleccion","opciones":["Empresa","Personal","Académico"]}]',
 '[]'),

(null, 'objetivo', 'Objetivo',
 '[{"nombre":"Estado","tipo":"estado"},
   {"nombre":"Fecha tope","tipo":"fecha"}]',
 '[{"relacion":"pertenece_a","hacia":["area"]}]'),

(null, 'hito', 'Hito',
 '[{"nombre":"Estado","tipo":"estado"},
   {"nombre":"Inicio","tipo":"numero"},
   {"nombre":"Actual","tipo":"numero"},
   {"nombre":"Meta","tipo":"numero"}]',
 '[{"relacion":"mide","hacia":["objetivo"]}]'),

(null, 'proyecto', 'Proyecto',
 '[{"nombre":"Estado","tipo":"estado"},
   {"nombre":"Prioridad","tipo":"seleccion","opciones":["Urgente","Alta","Media","Baja"]},
   {"nombre":"Línea de tiempo","tipo":"rango_fechas"}]',
 '[{"relacion":"pertenece_a","hacia":["area"]},
   {"relacion":"aporta_a","hacia":["objetivo"]},
   {"relacion":"bloqueado_por","hacia":["proyecto"]},
   {"relacion":"trata_sobre","hacia":["topico"]}]'),

(null, 'tarea', 'Tarea',
 '[{"nombre":"Estado","tipo":"estado"},
   {"nombre":"Fecha","tipo":"fecha"},
   {"nombre":"Repetición","tipo":"seleccion","opciones":["Ninguna","Diaria","Semanal","Mensual"]}]',
 '[{"relacion":"pertenece_a","hacia":["proyecto","area","objetivo","evento"]},
   {"relacion":"trata_sobre","hacia":["topico"]}]'),

(null, 'evento', 'Evento',
 '[{"nombre":"Fecha y hora","tipo":"fecha_hora"},
   {"nombre":"Tipo","tipo":"seleccion","opciones":["Grupal","Individual","Parejas"]}]',
 '[{"relacion":"pertenece_a","hacia":["area","proyecto"]},
   {"relacion":"trata_sobre","hacia":["topico"]}]'),

(null, 'nota', 'Nota',
 '[{"nombre":"Tipo","tipo":"seleccion","opciones":["Nota rápida","Apuntes clase","Resumen"]},
   {"nombre":"Enlace","tipo":"enlace"},
   {"nombre":"Favorito","tipo":"booleano"}]',
 '[{"relacion":"pertenece_a","hacia":["area","proyecto","objetivo"]},
   {"relacion":"trata_sobre","hacia":["topico"]}]'),

(null, 'topico', 'Tópico',
 '[{"nombre":"Descripción","tipo":"texto"},
   {"nombre":"Semestre","tipo":"texto"}]',
 '[{"relacion":"pertenece_a","hacia":["area"]}]');

-- Los estados comunes, en un solo lugar. Cualquier propiedad de tipo "estado" usa esta lista.
comment on table public.tipos is
  'Estados comunes para propiedades de tipo "estado": Inbox, Por hacer, En curso, Esperando, Hecho';
