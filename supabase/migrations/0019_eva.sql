-- Paso 56: EV@ automático. La base llama sola, dos veces al día, a la función "eva", que copia tus entregas de EV@
-- como tareas dentro de cada ramo (supabase/functions/eva). Solo lee EV@: nunca entrega ni cambia nada allá.
--
-- 1. Cada ramo dice cuál es su curso en EV@ (el número que sale en la dirección del curso: course/view.php?id=91906).
update public.tipos
set propiedades = propiedades || '[{"clave":"eva","nombre":"Curso en EV@","tipo":"numero"}]'::jsonb
where clave = 'topico'
  and not propiedades @> '[{"clave":"eva"}]'::jsonb;

-- 2. Una clave al azar que solo conoce la base, guardada cifrada en Vault. La función solo trabaja si la recibe,
--    así nadie más puede hacerla correr. eva_clave_ok la revisa sin mostrarla, y solo la puede usar la función.
create extension if not exists pg_cron;
create extension if not exists pg_net;
select vault.create_secret(encode(extensions.gen_random_bytes(24), 'hex'), 'eva_clave')
where not exists (select 1 from vault.secrets where name = 'eva_clave');

create or replace function public.eva_clave_ok(clave text) returns boolean
language sql security definer set search_path = '' as $$
  select exists (select 1 from vault.decrypted_secrets where name = 'eva_clave' and decrypted_secret = clave);
$$;
revoke execute on function public.eva_clave_ok(text) from public, anon, authenticated;
grant execute on function public.eva_clave_ok(text) to service_role;

-- 3. Todos los días a las 8:00 y a las 20:00 de Chile en verano (11:00 y 23:00 UTC; en invierno queda a las 7 y 19).
select cron.unschedule('eva') where exists (select 1 from cron.job where jobname = 'eva');
select cron.schedule('eva', '0 11,23 * * *', $$
  select net.http_post(
    url := 'https://fugvincuaakcnvujtqlt.supabase.co/functions/v1/eva',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-clave', (select decrypted_secret from vault.decrypted_secrets where name = 'eva_clave')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000);
$$);
