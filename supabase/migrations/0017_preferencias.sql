-- Paso 53: tus preferencias, guardadas por persona (lo que eliges en Ajustes).
--
-- Cada fila es UNA preferencia de UNA persona, con su valor en JSON. Por ahora hay dos:
--   visual          cómo se ve la web: { "tema": "oscuro", "tono": "#2563a8", "fondo": "aurora", ... }
--   foto-de-fondo   tu foto subida como fondo (una imagen ya achicada, escrita como texto "data:image/jpeg;base64,...")
-- La foto va en su propia fila para que mover un control de Ajustes no vuelva a mandar la imagen entera.
-- Más adelante caben otras (avisos, cómo te habla Martita...) sin tocar la tabla.
-- Si no hay fila, la web usa lo de siempre. La web también las guarda en el navegador, para abrir ya con tu estilo.
create table if not exists public.preferencias (
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  clave       text not null,
  valor       jsonb not null,
  actualizado timestamptz not null default now(),
  primary key (owner_id, clave)                            -- una de cada una por persona
);

-- Solo ves y cambias las tuyas (igual que las disposiciones, paso 34b).
-- (Se puede pegar dos veces sin error: lo que ya existe se salta.)
alter table public.preferencias enable row level security;
drop policy if exists preferencias_dueno on public.preferencias;
create policy preferencias_dueno on public.preferencias for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
