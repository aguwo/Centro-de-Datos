-- Paso 4: las conexiones. Esto es lo que convierte tus nodos en un grafo.
-- Una conexión es una flecha con nombre entre dos nodos:
--   "Estudiar cálculo" --pertenece_a--> "Semestre 2026-2"
-- Se guarda UNA sola vez. En Notion la misma relación aparecía en las dos bases
-- (Tareas → Proyecto y Proyecto → Tareas); aquí se lee en ambos sentidos desde la misma fila.

create table public.conexiones (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,

  origen_id    uuid not null references public.nodos (id) on delete cascade,  -- de dónde sale la flecha
  relacion     text not null,                                                 -- 'pertenece_a', 'bloqueado_por'...
  destino_id   uuid not null references public.nodos (id) on delete cascade,  -- a dónde llega

  props        jsonb not null default '{}'::jsonb,

  -- En vez de borrar una conexión que dejó de ser cierta ("esta tarea ya no es de ese proyecto"),
  -- se le pone fecha de término. Así el agente sabe qué era cierto antes y qué lo es ahora.
  valido_desde timestamptz not null default now(),
  valido_hasta timestamptz,

  creado_en    timestamptz not null default now(),

  constraint conexiones_unica unique (origen_id, relacion, destino_id),  -- no repetir la misma flecha
  constraint conexiones_sin_bucle check (origen_id <> destino_id)        -- un nodo no se conecta consigo mismo
);

-- Índices para recorrer el grafo rápido en los dos sentidos.
create index conexiones_owner_idx   on public.conexiones (owner_id);
create index conexiones_origen_idx  on public.conexiones (origen_id, relacion);
create index conexiones_destino_idx on public.conexiones (destino_id, relacion);

-- Regla: solo puedes conectar nodos que son tuyos.
create function public.validar_conexion() returns trigger
language plpgsql as $$
begin
  if exists (
    select 1 from public.nodos n
    where n.id in (new.origen_id, new.destino_id) and n.owner_id <> new.owner_id
  ) then
    raise exception 'La conexión une nodos de otro usuario';
  end if;
  return new;
end;
$$;

create trigger conexiones_validar
  before insert or update on public.conexiones
  for each row execute function public.validar_conexion();

-- vecinos(nodo, profundidad): todo lo que está conectado a un nodo, hasta 3 saltos.
-- Ej: desde una tarea, a 1 salto está su proyecto; a 2 saltos, el área de ese proyecto.
-- Es lo que usarán la vista de grafo de la web y el agente para "navegar".
create function public.vecinos(p_nodo uuid, p_profundidad int default 1)
returns table (nodo_id uuid, relacion text, direccion text, profundidad int)
language sql stable security invoker as $$
  with recursive recorrido as (
    -- Primer salto: flechas que salen del nodo y flechas que llegan a él.
    select c.destino_id as nodo_id, c.relacion, 'saliente'::text as direccion, 1 as profundidad
      from public.conexiones c
     where c.origen_id = p_nodo and c.valido_hasta is null
    union all
    select c.origen_id, c.relacion, 'entrante', 1
      from public.conexiones c
     where c.destino_id = p_nodo and c.valido_hasta is null
    union
    -- Saltos siguientes: desde cada vecino encontrado, sus propios vecinos.
    select case when c.origen_id = r.nodo_id then c.destino_id else c.origen_id end,
           c.relacion,
           case when c.origen_id = r.nodo_id then 'saliente' else 'entrante' end,
           r.profundidad + 1
      from recorrido r
      join public.conexiones c
        on (c.origen_id = r.nodo_id or c.destino_id = r.nodo_id) and c.valido_hasta is null
     where r.profundidad < least(greatest(p_profundidad, 1), 3)
  )
  -- Cada vecino una sola vez, a la menor distancia.
  select distinct on (nodo_id) nodo_id, relacion, direccion, profundidad
    from recorrido
   where nodo_id <> p_nodo
   order by nodo_id, profundidad;
$$;
