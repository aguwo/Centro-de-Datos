-- Paso 16: el resto de tu Notion (finanzas, hábitos, plantas, dieta, biblioteca y rutinas).
--
-- La idea para ordenarlo: separar COSAS de COSAS QUE PASAN.
--   * Una cosa (una cuenta, un hábito, una planta, un alimento, un libro) dura en el tiempo
--     y se relaciona con otras. Va al mapa como nodo, igual que tus tareas y proyectos.
--   * Algo que pasa (un gasto, el día que marcaste "meditar", una comida, un riego, tu peso de hoy)
--     es un dato con fecha. Si fueran nodos, el mapa tendría cientos de puntos sueltos.
--     Van a la tabla nueva "registros", donde sumar ("¿cuánto gasté en comida esta semana?")
--     o graficar ("¿cuántos días entrené?") es una sola consulta.

-- 1. Tipos nuevos (plantillas para todos, igual que en el paso 2).
insert into public.tipos (owner_id, clave, nombre, propiedades, conexiones) values
(null, 'cuenta', 'Cuenta',
 '[{"nombre":"Saldo inicial","tipo":"numero"}]',
 '[{"relacion":"pertenece_a","hacia":["area"]}]'),

(null, 'categoria', 'Categoría de gasto',
 '[{"nombre":"Presupuesto semanal","tipo":"numero"}]',
 '[{"relacion":"pertenece_a","hacia":["area"]}]'),

(null, 'suscripcion', 'Suscripción',
 '[{"nombre":"Precio","tipo":"numero"},
   {"nombre":"Período","tipo":"seleccion","opciones":["Mensual","Anual"]},
   {"nombre":"Activa","tipo":"booleano"}]',
 '[{"relacion":"pertenece_a","hacia":["categoria"]}]'),

(null, 'habito', 'Hábito',
 '[{"nombre":"Descripción","tipo":"texto"},
   {"nombre":"Días","tipo":"texto"}]',
 '[{"relacion":"pertenece_a","hacia":["area","rutina"]},
   {"relacion":"aporta_a","hacia":["objetivo"]}]'),

(null, 'rutina', 'Rutina',
 '[]',
 '[{"relacion":"pertenece_a","hacia":["area"]}]'),

(null, 'planta', 'Planta',
 '[{"nombre":"Especie","tipo":"texto"},
   {"nombre":"Salud","tipo":"seleccion","opciones":["Saludable","En observación","Enferma / plaga","Por comprar","Q.E.P.D."]},
   {"nombre":"Luz","tipo":"seleccion","opciones":["Indirecta brillante","Media","Sombra","Sol directo"]},
   {"nombre":"Aguanta sin agua (días)","tipo":"numero"},
   {"nombre":"Fecha de obtención","tipo":"fecha"}]',
 '[{"relacion":"pertenece_a","hacia":["area"]}]'),

(null, 'recurso', 'Libro o recurso',
 '[{"nombre":"Estado","tipo":"estado"},
   {"nombre":"Formato","tipo":"seleccion","opciones":["Libro","Película","Artículo","Video","Podcast"]},
   {"nombre":"Enlace","tipo":"enlace"}]',
 '[{"relacion":"trata_sobre","hacia":["topico","area"]},
   {"relacion":"aporta_a","hacia":["objetivo","proyecto"]}]'),

(null, 'alimento', 'Alimento',
 '[{"nombre":"kcal/100g","tipo":"numero"},
   {"nombre":"Proteína/100g","tipo":"numero"},
   {"nombre":"Carbohidratos/100g","tipo":"numero"},
   {"nombre":"Grasa/100g","tipo":"numero"},
   {"nombre":"Porción","tipo":"texto"},
   {"nombre":"Porción (g)","tipo":"numero"},
   {"nombre":"Despensa","tipo":"seleccion","opciones":["Agotado","Bajo","Suficiente"]},
   {"nombre":"Compra","tipo":"seleccion","opciones":["Semanal","Mensual"]}]',
 '[{"relacion":"pertenece_a","hacia":["area"]}]'),

(null, 'receta', 'Receta',
 '[{"nombre":"Comida","tipo":"seleccion","opciones":["Desayuno","Almuerzo","Merienda","Cena"]},
   {"nombre":"Rinde (porciones)","tipo":"numero"}]',
 '[{"relacion":"usa","hacia":["alimento"]}]');

-- 2. La tabla de registros: una fila por cada cosa que pasó, con su fecha.
--    "clase" dice qué tipo de registro es, y de ella depende qué significan nodo_id y otro_id:
--      gasto         nodo = cuenta de donde salió     otro = categoría       valor = monto
--      ingreso       nodo = cuenta donde entró                               valor = monto
--      transferencia nodo = cuenta de origen          otro = cuenta destino  valor = monto
--      habito        nodo = el hábito cumplido                               valor = 1
--      medida        nodo = lo que se mide (ej. el hito "Peso objetivo")     valor = 52.2, unidad = kg
--      comida        nodo = alimento o receta         valor = gramos o porciones (ver unidad)
--      riego         nodo = la planta
create table public.registros (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,

  clase      text not null check (clase in ('gasto','ingreso','transferencia','habito','medida','comida','riego')),
  fecha      timestamptz not null default now(),
  titulo     text,                          -- "Compra Spotify", "Almuerzo"...
  valor      numeric,                       -- el número que importa (pesos, gramos, kilos, 1 = hecho)
  unidad     text,                          -- 'CLP', 'g', 'porción', 'kg'

  -- Si se borra la cuenta o el hábito, el registro queda (con el nodo vacío): la historia no se pierde.
  nodo_id    uuid references public.nodos (id) on delete set null,
  otro_id    uuid references public.nodos (id) on delete set null,

  props      jsonb not null default '{}'::jsonb,   -- lo demás: notas, tipo de comida, etc.
  creado_en  timestamptz not null default now()
);

-- Las dos preguntas más comunes: "mis registros de X entre tal y tal fecha" y "todo lo de este nodo".
create index registros_owner_clase_fecha_idx on public.registros (owner_id, clase, fecha);
create index registros_nodo_idx              on public.registros (nodo_id, fecha);

-- 3. Misma seguridad que nodos y conexiones (paso 5): cada uno ve y toca solo lo suyo.
alter table public.registros enable row level security;
create policy registros_dueno on public.registros for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
