-- Paso 25: la web se entera sola cuando cambian tus datos.
--
-- Supabase Realtime lee los cambios de las tablas que están en la "publicación" supabase_realtime
-- y se los manda a la web al instante. Así, si el agente crea una tarea, o marcas un hábito
-- desde el celular, el Inicio abierto en el computador se actualiza sin recargar la página.
-- RLS sigue mandando: a cada uno le llegan solo los cambios de sus propias filas.
do $$
declare tabla text;
begin
  -- En Supabase la publicación ya existe; esto es para la base de prueba local.
  if not exists (select from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  -- Se agrega cada tabla que falte (así se puede correr dos veces sin error).
  foreach tabla in array array['nodos', 'conexiones', 'registros', 'tipos'] loop
    if not exists (select from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = tabla) then
      execute format('alter publication supabase_realtime add table public.%I', tabla);
    end if;
  end loop;
end $$;
