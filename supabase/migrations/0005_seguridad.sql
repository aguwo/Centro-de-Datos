-- Paso 5: seguridad por usuario (Row Level Security, "RLS").
-- Sin esto, cualquier usuario con sesión iniciada podría leer los nodos de todos.
-- Con RLS, Postgres agrega solo a cada consulta un filtro invisible: "y que el dueño sea quien pregunta".
-- Como el agente entra con TU sesión, también queda limitado a tus datos.

alter table public.tipos      enable row level security;
alter table public.nodos      enable row level security;
alter table public.conexiones enable row level security;

-- auth.uid() = el usuario que hace la consulta (Supabase lo saca de su sesión).
-- Se escribe "(select auth.uid())" para que Postgres lo calcule una vez por consulta
-- y no una vez por cada fila: con miles de nodos es muchísimo más rápido.

-- TIPOS: puedes ver las plantillas (sin dueño) y los tuyos; solo puedes crear, editar o borrar los tuyos.
create policy tipos_leer on public.tipos for select to authenticated
  using (owner_id is null or owner_id = (select auth.uid()));
create policy tipos_crear on public.tipos for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy tipos_editar on public.tipos for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy tipos_borrar on public.tipos for delete to authenticated
  using (owner_id = (select auth.uid()));

-- NODOS y CONEXIONES: todo (leer, crear, editar, borrar) solo sobre lo tuyo.
-- "using" filtra lo que puedes ver; "with check" impide guardar algo a nombre de otro.
create policy nodos_dueno on public.nodos for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy conexiones_dueno on public.conexiones for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
