-- Imita lo mínimo de Supabase para probar las migraciones en un Postgres local.
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, created_at timestamptz not null default now());
create or replace function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end $$;
grant usage on schema public, auth to authenticated;
