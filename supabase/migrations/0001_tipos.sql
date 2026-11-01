-- Paso 1: la tabla de tipos.
-- Un "tipo" describe una clase de cosa que existe en tu vida: Tarea, Proyecto, Área, Nota...
-- No guarda tus tareas; guarda la definición de qué es una tarea y qué datos tiene.

create table public.tipos (
  -- Identificador único. Postgres lo genera solo al crear la fila.
  id          uuid primary key default gen_random_uuid(),

  -- Dueño del tipo. Vacío (NULL) = plantilla que todos los usuarios pueden usar.
  -- Si se borra el usuario, se borran también sus tipos (on delete cascade).
  owner_id    uuid references auth.users (id) on delete cascade,

  -- Nombre corto para programas, sin tildes ni espacios: 'tarea', 'proyecto'.
  clave       text not null,

  -- Nombre para mostrar a personas: 'Tarea', 'Proyecto'.
  nombre      text not null,

  descripcion text,

  -- Lista de propiedades que tiene este tipo, en formato JSON.
  -- Ej: [{"nombre":"Estado","tipo":"estado","opciones":["Inbox","Completada"]}]
  propiedades jsonb not null default '[]'::jsonb,

  -- Con qué otros tipos suele conectarse. Ej: una tarea pertenece a un proyecto.
  conexiones  jsonb not null default '[]'::jsonb,

  creado_en   timestamptz not null default now(),

  -- Un mismo dueño no puede tener dos tipos con la misma clave.
  -- "nulls not distinct" hace que esto aplique también a las plantillas (dueño NULL).
  constraint tipos_clave_unica unique nulls not distinct (owner_id, clave)
);
