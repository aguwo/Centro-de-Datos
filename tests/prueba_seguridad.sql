-- Prueba de los pasos 1 a 5: cada usuario ve solo lo suyo, las plantillas son de todos y vecinos() funciona.
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

do $$ declare n int; begin
  select count(*) into n from tipos; assert n = 8, 'usuario 1 debería ver 8 plantillas, ve ' || n;
  select count(*) into n from vecinos((select id from nodos where titulo = 'Escribir migración'), 2);
  assert n = 2, 'vecinos a profundidad 2 debería dar 2, dio ' || n;
  select count(*) into n from nodos where busqueda @@ plainto_tsquery('spanish', 'migraciones');
  assert n = 1, 'búsqueda en español debería encontrar 1, encontró ' || n;
end $$;

set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$ declare n int; begin
  select count(*) into n from nodos; assert n = 0, 'usuario 2 no debería ver nodos ajenos, ve ' || n;
  select count(*) into n from conexiones; assert n = 0, 'usuario 2 no debería ver conexiones ajenas';
  select count(*) into n from tipos; assert n = 8, 'usuario 2 debería ver las 8 plantillas';
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
\echo 'TODAS LAS PRUEBAS PASARON'
