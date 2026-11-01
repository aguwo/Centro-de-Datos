-- Paso 2: los 9 tipos de productividad que hoy usas en Notion, cargados como plantillas.
-- owner_id NULL = plantilla global: cualquier usuario puede leerlos y usarlos.
-- Cada fila tiene: dueño, clave, nombre, propiedades (columnas de Notion) y conexiones
-- (las relaciones de Notion: una tarea pertenece a un proyecto, un hito mide un objetivo...).

insert into public.tipos (owner_id, clave, nombre, propiedades, conexiones) values
(null, 'tarea', 'Tarea',
 '[{"nombre":"Descripción","tipo":"texto"},
   {"nombre":"Estado","tipo":"estado","opciones":["Inbox","Por hacer","Esperando","Sin fecha","Repetitiva","Completada"]},
   {"nombre":"Fecha","tipo":"fecha"},
   {"nombre":"Tipo","tipo":"seleccion","opciones":["Normal","Repetitiva"]}]',
 '[{"relacion":"pertenece_a","hacia":["proyecto","area","objetivo","evento"]},
   {"relacion":"trata_sobre","hacia":["topico"]}]'),

(null, 'proyecto', 'Proyecto',
 '[{"nombre":"Estado","tipo":"estado","opciones":["Inbox","No empezado","En pausa","En progreso","Completado"]},
   {"nombre":"Prioridad","tipo":"seleccion","opciones":["Urgente","Alta","Media","Baja"]},
   {"nombre":"Fecha de inicio","tipo":"fecha"},
   {"nombre":"Línea de tiempo","tipo":"rango_fechas"}]',
 '[{"relacion":"pertenece_a","hacia":["area"]},
   {"relacion":"aporta_a","hacia":["objetivo"]},
   {"relacion":"trata_sobre","hacia":["topico"]},
   {"relacion":"relacionado_con","hacia":["proyecto"]},
   {"relacion":"bloqueado_por","hacia":["proyecto"]}]'),

(null, 'area', 'Área',
 '[{"nombre":"Tipo","tipo":"seleccion","opciones":["Empresa","Personal","Académico"]}]',
 '[]'),

(null, 'objetivo', 'Objetivo',
 '[{"nombre":"Estado","tipo":"estado","opciones":["No empezado","En progreso","Completado"]},
   {"nombre":"Fecha tope","tipo":"fecha"}]',
 '[{"relacion":"pertenece_a","hacia":["area"]}]'),

(null, 'evento', 'Evento',
 '[{"nombre":"Descripción","tipo":"texto"},
   {"nombre":"Estado","tipo":"estado","opciones":["Inbox","En proceso","Esperando","Sin fecha","Completada"]},
   {"nombre":"Fecha y hora","tipo":"fecha_hora"},
   {"nombre":"Tipo","tipo":"seleccion","opciones":["Grupal","Individual","Parejas"]}]',
 '[{"relacion":"pertenece_a","hacia":["area","proyecto"]},
   {"relacion":"trata_sobre","hacia":["topico"]}]'),

(null, 'nota', 'Nota',
 '[{"nombre":"Tipo","tipo":"seleccion","opciones":["Nota rápida","Apuntes clase","Resumen"]},
   {"nombre":"Info","tipo":"enlace"},
   {"nombre":"Favorito","tipo":"booleano"}]',
 '[{"relacion":"pertenece_a","hacia":["area","proyecto","objetivo","bloque_notas"]},
   {"relacion":"trata_sobre","hacia":["topico"]}]'),

(null, 'bloque_notas', 'Bloque de notas',
 '[{"nombre":"Descripción","tipo":"texto"}]',
 '[{"relacion":"pertenece_a","hacia":["area"]}]'),

(null, 'topico', 'Tópico',
 '[{"nombre":"Semestre","tipo":"texto"}]',
 '[{"relacion":"pertenece_a","hacia":["area"]}]'),

(null, 'hito', 'Hito',
 '[{"nombre":"Estado","tipo":"estado","opciones":["Abierto","Cerrado"]},
   {"nombre":"Inicio","tipo":"numero"},
   {"nombre":"Actual","tipo":"numero"},
   {"nombre":"Meta","tipo":"numero"}]',
 '[{"relacion":"mide","hacia":["objetivo"]}]');
