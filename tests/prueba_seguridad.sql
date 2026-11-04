-- Prueba de los pasos 1 a 5, 16 y 19: cada usuario ve solo lo suyo, las plantillas son de todos y vecinos() funciona.
-- Se corre con tests/probar_bd.sh
grant select, insert, update, delete on all tables in schema public to authenticated;
insert into auth.users values ('11111111-1111-1111-1111-111111111111'), ('22222222-2222-2222-2222-222222222222');

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into nodos (tipo_id, titulo, estado) select id, 'Centro de datos', 'En curso' from tipos where clave = 'proyecto';
insert into nodos (tipo_id, titulo, estado) select id, 'Escribir migración', 'Por hacer' from tipos where clave = 'tarea';
insert into nodos (tipo_id, titulo) select id, 'Personal' from tipos where clave = 'area';
insert into conexiones (origen_id, relacion, destino_id)
  select t.id, 'pertenece_a', p.id from nodos t, nodos p where t.titulo = 'Escribir migración' and p.titulo = 'Centro de datos';
insert into conexiones (origen_id, relacion, destino_id)
  select p.id, 'pertenece_a', a.id from nodos p, nodos a where p.titulo = 'Centro de datos' and a.titulo = 'Personal';
insert into nodos (tipo_id, titulo) select id, 'Meditar' from tipos where clave = 'habito';
insert into registros (clase, valor, nodo_id) select 'habito', 1, id from nodos where titulo = 'Meditar';
-- Paso 46a: la asistencia a un ramo (1 = fui) es una clase de registro más.
insert into registros (clase, valor, nodo_id) select 'asistencia', 1, id from nodos where titulo = 'Personal';
-- Paso 34b: una disposición propia; la segunda vez reemplaza a la primera (upsert, como la web).
insert into disposiciones (apartado, columnas) values ('hoy', '[{"widgets": ["tu-dia"]}]');
insert into disposiciones (apartado, columnas) values ('hoy', '[{"widgets": ["el-tiempo"]}]')
  on conflict (owner_id, apartado) do update set columnas = excluded.columnas, actualizado = now();
do $$ begin
  assert (select columnas->0->'widgets'->>0 from disposiciones where apartado = 'hoy') = 'el-tiempo', 'la disposición debería haberse reemplazado';
  begin
    insert into disposiciones (apartado, columnas) values ('mapa', '{"no": "es lista"}');
    raise exception 'debería rechazar columnas que no son una lista';
  exception when check_violation then null;
  end;
end $$;

do $$ declare n int; begin
  select count(*) into n from tipos; assert n = 16, 'usuario 1 debería ver 16 plantillas, ve ' || n;
  select count(*) into n from vecinos((select id from nodos where titulo = 'Escribir migración'), 2);
  assert n = 2, 'vecinos a profundidad 2 debería dar 2, dio ' || n;
  select count(*) into n from nodos where busqueda @@ plainto_tsquery('spanish', 'migraciones');
  assert n = 1, 'búsqueda en español debería encontrar 1, encontró ' || n;
end $$;

-- Paso 19: el árbol arma la ruta completa y los registros muestran nombres.
do $$ declare r text; begin
  select ruta into r from arbol where titulo = 'Escribir migración';
  assert r = 'Personal / Centro de datos / Escribir migración', 'ruta inesperada: ' || coalesce(r, '(nada)');
  select nodo into r from registros_legibles where clase = 'habito';
  assert r = 'Meditar', 'registros_legibles debería mostrar el nombre del hábito, muestra ' || coalesce(r, '(nada)');
  select subcaja->>'topico' into r from tipos where clave = 'evento';
  assert r = 'Evaluaciones', 'evento debería agruparse en Evaluaciones dentro de un tópico';
  assert (select propiedades @> '[{"clave":"estado"},{"clave":"resultado"}]'::jsonb from tipos where clave = 'topico'),
    'tópico debería tener estado y resultado (paso 36)';
  assert (select propiedades->3->>'clave' = 'actual' from tipos where clave = 'objetivo'), 'objetivo debería tener "Va en" después de "Desde" (paso 37a)';
  assert (select conexiones @> '[{"relacion":"aporta_a","hacia":["objetivo"]}]'::jsonb from tipos where clave = 'topico'), 'un ramo debería poder aportar a un objetivo (paso 37a)';
  assert (select propiedades @> '[{"clave":"claude","tipo":"enlace"}]'::jsonb from tipos where clave = 'proyecto'), 'proyecto debería tener su enlace a Claude (paso 38c)';
  assert (select propiedades @> '[{"clave":"peso"},{"clave":"nota"}]'::jsonb from tipos where clave = 'evento'), 'evento debería tener ponderación y nota (paso 46a)';
end $$;
-- Paso 53: una preferencia propia; guardarla de nuevo la reemplaza (upsert, como la web).
insert into preferencias (clave, valor) values ('visual', '{"tema": "claro"}');
insert into preferencias (clave, valor) values ('visual', '{"tema": "oscuro"}')
  on conflict (owner_id, clave) do update set valor = excluded.valor, actualizado = now();
do $$ begin
  assert (select valor->>'tema' from preferencias where clave = 'visual') = 'oscuro', 'la preferencia debería haberse reemplazado';
end $$;

set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$ declare n int; begin
  select count(*) into n from nodos; assert n = 0, 'usuario 2 no debería ver nodos ajenos, ve ' || n;
  select count(*) into n from conexiones; assert n = 0, 'usuario 2 no debería ver conexiones ajenas';
  select count(*) into n from tipos; assert n = 16, 'usuario 2 debería ver las 16 plantillas (paso 37a: sin hito)';
  select count(*) into n from registros; assert n = 0, 'usuario 2 no debería ver registros ajenos';
  select count(*) into n from disposiciones; assert n = 0, 'usuario 2 no debería ver disposiciones ajenas';
  select count(*) into n from preferencias; assert n = 0, 'usuario 2 no debería ver preferencias ajenas';
end $$;

do $$ begin
  begin
    insert into nodos (owner_id, tipo_id, titulo)
      select '11111111-1111-1111-1111-111111111111', id, 'intruso' from tipos limit 1;
    raise exception 'RLS permitió crear un nodo a nombre de otro usuario';
  exception when insufficient_privilege then null;
  end;
  begin
    update tipos set nombre = 'hackeado' where clave = 'tarea';
    if found then raise exception 'RLS permitió editar una plantilla global'; end if;
  end;
end $$;
reset role;

-- Paso 25: las 4 tablas avisan sus cambios en tiempo real.
do $$ begin
  if (select count(*) from pg_publication_tables where pubname = 'supabase_realtime'
      and tablename in ('nodos', 'conexiones', 'registros', 'tipos')) <> 4 then
    raise exception 'Faltan tablas en la publicación de tiempo real';
  end if;
end $$;
\echo 'TODAS LAS PRUEBAS PASARON'
