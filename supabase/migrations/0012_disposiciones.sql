-- Paso 34b: la disposición de cada apartado, guardada por persona.
--
-- Cada fila dice cómo se arma UN apartado de la web para UNA persona: qué widgets tiene, en qué
-- columnas y en qué orden. Ej. Hoy = [{ "ancho": 3, "widgets": ["tareas-de-hoy"] },
--                                     { "ancho": 2, "widgets": ["el-tiempo", "tu-dia"] }]
-- Si no hay fila, la web usa la disposición de siempre (la que está escrita en apartados.js).
-- Los nombres de los widgets son los de widgets.js; uno que la web no conozca simplemente no se muestra.
create table if not exists public.disposiciones (
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  apartado    text not null,                               -- el id del apartado: "hoy", "productividad"...
  columnas    jsonb not null check (jsonb_typeof(columnas) = 'array'),
  actualizado timestamptz not null default now(),
  primary key (owner_id, apartado)                         -- una disposición por apartado y por persona
);

-- Solo ves y cambias las tuyas (igual que los nodos, paso 5).
-- (Se puede pegar dos veces sin error: lo que ya existe se salta.)
alter table public.disposiciones enable row level security;
drop policy if exists disposiciones_dueno on public.disposiciones;
create policy disposiciones_dueno on public.disposiciones for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

