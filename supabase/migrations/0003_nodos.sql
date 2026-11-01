-- Paso 3: la tabla de nodos.
-- Un nodo es cada cosa concreta de tu vida: "Estudiar cálculo", "Proyecto Centro de datos", "Área Personal".
-- Cada nodo es de un tipo (paso 1 y 2) y tiene un dueño.

create table public.nodos (
  id             uuid primary key default gen_random_uuid(),

  -- Dueño del nodo. Por defecto, el usuario que lo crea (auth.uid() lo da Supabase).
  owner_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,

  -- De qué tipo es: tarea, proyecto, nota...
  tipo_id        uuid not null references public.tipos (id),

  titulo         text not null,
  contenido      text,                                -- el cuerpo de la página, en Markdown

  -- Propiedades propias del tipo (prioridad, repetición, enlace...) en JSON flexible.
  props          jsonb not null default '{}'::jsonb,

  -- Estado y fecha se usan en casi todos los tipos y se filtran todo el rato
  -- ("¿qué tengo por hacer esta semana?"), así que van como columnas propias y no dentro de props.
  estado         text check (estado in ('Inbox', 'Por hacer', 'En curso', 'Esperando', 'Hecho')),
  fecha          timestamptz,

  -- Reemplaza la propiedad "Archivo" que tenías en casi todas las bases de Notion.
  archivado      boolean not null default false,

  -- Índice de búsqueda en español: Postgres lo calcula solo a partir del título y el contenido.
  -- Gracias a esto, buscar "estudiar" también encuentra "estudiando".
  busqueda       tsvector generated always as (
                   to_tsvector('spanish', coalesce(titulo, '') || ' ' || coalesce(contenido, ''))
                 ) stored,

  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

-- Índices: como el índice de un libro, hacen que las búsquedas frecuentes sean rápidas.
-- Todos parten por owner_id porque siempre se consulta "mis" nodos.
create index nodos_owner_tipo_idx   on public.nodos (owner_id, tipo_id);
create index nodos_owner_estado_idx on public.nodos (owner_id, estado);
create index nodos_owner_fecha_idx  on public.nodos (owner_id, fecha);
create index nodos_busqueda_idx     on public.nodos using gin (busqueda);

-- Cada vez que se edita un nodo, actualizado_en se pone al día solo.
create function public.tocar_actualizado_en() returns trigger
language plpgsql as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

create trigger nodos_actualizado_en
  before update on public.nodos
  for each row execute function public.tocar_actualizado_en();
