# Centro de datos

Un sistema propio para reemplazar Notion: un centro de datos de tu vida en forma de grafo, con un asistente de IA que lo usa para ayudarte.

Se construye paso a paso. Cada paso es un commit con su explicación.

## Lo hecho

Agrupado por módulo. «SQL N» es el archivo que se pegó en el editor SQL de Supabase (todos aplicados). Los pasos 1 al 25 fueron directo a `main`, sin PR.

### Base y agente

| Paso | Qué agrega | PR | SQL | Archivo |
| --- | --- | --- | --- | --- |
| 1 | Tabla de tipos: qué clases de cosas existen | — | — | `supabase/migrations/0001_tipos.sql` |
| 2 | Los 8 tipos de productividad (simplificados desde Notion) como plantilla | — | — | `supabase/migrations/0002_plantillas_productividad.sql` |
| 3 | Tabla de nodos: cada cosa concreta, con estados comunes y búsqueda en español | — | — | `supabase/migrations/0003_nodos.sql` |
| 4 | Conexiones entre nodos y la función vecinos() para navegar el grafo | — | — | `supabase/migrations/0004_conexiones.sql` |
| 5 | Seguridad por usuario: cada uno (y su agente) ve solo lo suyo | — | — | `supabase/migrations/0005_seguridad.sql` |
| 6 | Servidor MCP: la puerta por donde Claude y la web entran a tus datos | — | — | `supabase/functions/mcp/` |
| 7 | Pantalla de permiso OAuth para conectar Claude (publicada con GitHub Pages) | — | — | `docs/oauth/consent/index.html` |
| 12 | Importador de Notion: traduce tus bases a nodos y conexiones y genera un SQL para pegar en Supabase | — | SQL 2 | `importador-notion/` |
| 16 | Tipos nuevos (cuenta, hábito, planta, alimento, receta, libro...) y tabla `registros` para lo que pasa con fecha (gastos, hábitos cumplidos, comidas, riegos) | — | SQL 1 | `supabase/migrations/0006_vida_y_registros.sql` |
| 17 | Importador del resto de Notion: finanzas, hábitos, plantas, dieta, biblioteca y rutinas | — | — | `importador-notion/traducir-resto.mjs` |
| 19 | La jerarquía vive en la base: cada tipo tiene módulo, orden, color, nivel y subcajas. Vistas `arbol` (ruta completa de cada nodo) y `registros_legibles`. El agente gana `ver_arbol` y la ruta en cada búsqueda | — | SQL 3 | `supabase/migrations/0007_jerarquia.sql` |
| 21 | El agente anota y consulta registros: `anotar_registro` ("gasté 5.000 en comida") y `consultar_registros` (cuenta, suma y agrupa por día, mes, nodo u otro) | — | — | `supabase/functions/mcp/servidor.ts` |
| 22 | Control total del agente: archivar, recuperar, cambiar de tipo y borrar (solo lo archivado) nodos; desconectar (queda la historia) y mover varios nodos de caja; editar y borrar registros; crear o personalizar tipos | — | — | `supabase/functions/mcp/` |
| 23 | Cada propiedad de un tipo tiene su clave exacta: el agente solo puede usar las del tipo (con valores válidos) y la web las muestra con su nombre y deja editarlas | — | SQL 4 | `supabase/migrations/0008_propiedades.sql` |
| 24 | Publicación automática: al subir cambios del agente a GitHub, se corren las pruebas y se publica en Supabase | — | — | `.github/workflows/publicar-agente.yml` |

### Mapa

| Paso | Qué agrega | PR | SQL | Archivo |
| --- | --- | --- | --- | --- |
| 9 | Web con el mapa de tu grafo: https://aguwo.github.io/Centro-de-Datos/ | — | — | `docs/index.html` |
| 10 | Clic en un nodo: panel con sus datos y vecinos, y el mapa ilumina su vecindario | — | — | `docs/index.html` |
| 11 | Crear, editar y archivar nodos desde la web | — | — | `docs/index.html` |
| 13 | Mapa ordenado: esconde lo hecho, filtros por tipo en la leyenda, nombres según el zoom y caja "Sin conectar" (desde el paso 20, cajas por módulo) | — | — | `docs/index.html` |
| 14 | Cajas dentro de cajas: cada materia, proyecto y área es un espacio propio con todo lo suyo adentro | — | — | `docs/index.html` |
| 18 | Dentro de cada ramo, las evaluaciones van en su propia caja "Evaluaciones" | — | — | `docs/js/mapa.js` |
| 20 | Web ordenada en archivos: lee la jerarquía de la base, agrupa la leyenda por módulo y junta lo suelto en la caja de su módulo | — | — | `docs/js/` |

### Escritorio y navegación

| Paso | Qué agrega | PR | SQL | Archivo |
| --- | --- | --- | --- | --- |
| 26 | La carcasa del escritorio: tu foto de fondo, paneles de vidrio, barra arriba y un dock escondido que aparece al acercarte abajo. Cada sección es un apartado anotado en una lista: agregar uno no obliga a tocar la carcasa | #2 | — | `docs/js/carcasa.js`, `docs/js/apartados.js` |
| 28 | El escritorio movible: los apartados con lugar quedan juntos en un lienzo que se arrastra, se acerca con Ctrl + rueda y tiene un minimapa para saltar. La foto de fondo se mueve un poco (parallax). En el teléfono, cada apartado a pantalla completa | #4 | — | `docs/js/escritorio.js` |
| 29 | "+ Nuevo" según dónde estás: en el escritorio, un menú con lo que se crea en sus secciones; en otro apartado, el formulario directo. Los campos salen de las propiedades de cada tipo en la base (las primeras a la vista, el resto en "Más detalles") | #5 | — | `docs/js/nuevo.js`, `docs/js/panel.js` |
| — | Arreglo: volver a entrar con el enlace del correo | #6 | — | `docs/js/main.js` |
| 31 | Los post-its: lo que está en el Inbox queda pegado alrededor de las secciones del escritorio. Se arrastran (el lugar se guarda), se escribe encima, ✓ lo marca hecho, × lo suelta y "Pasar a…" abre el formulario ya lleno para ponerle fecha, proyecto o cambiarlo de tipo. "+ Nuevo → Post-it" crea uno. En el celular van en una fila arriba de Hoy | #9 | — | `docs/js/postits.js` |
| 34a | Las ventanas como widgets: cada una es una pieza registrada (título, si crece, si filtra, cómo se dibuja) y cada apartado dice en qué columnas van. Las ventanas de un apartado comparten lo elegido (`ctx`) | #13 | — | `docs/js/widgets.js` |
| 34b | La disposición de cada apartado se guarda por persona (tabla `disposiciones`); si lo guardado no sirve, vuelve a la de siempre | #14 | SQL 8 | `supabase/migrations/0012_disposiciones.sql`, `docs/js/widgets.js` |
| 35c | En el computador, el dock es una barra lateral pegada al borde; el escritorio infinito se recorre con ← →, Esc (ver todo) y clic en una sección | #18 | — | `docs/js/carcasa.js`, `docs/js/escritorio.js` |
| 35d | El escritorio infinito sin barra de secciones: solo el minimapa, flechas, Esc, arrastrar y doble clic | #19 | — | `docs/js/escritorio.js` |

### Hoy y calendario

| Paso | Qué agrega | PR | SQL | Archivo |
| --- | --- | --- | --- | --- |
| 15 | Inicio: menú, captura rápida, Hoy, próximos 7 días, Inbox y proyectos en curso | — | — | `docs/index.html` |
| 25 | Inicio por tarjetas (Hacer · Cuidarme · Mi vida) con señales arriba, y la web en tiempo real: se actualiza sola cuando algo cambia (tú, otra pestaña o el agente) | — | SQL 5 | `supabase/migrations/0009_tiempo_real.sql`, `docs/js/tarjetas.js` |
| 27 | Hoy: tus 3 prioridades destacadas, lo demás de hoy y lo atrasado (Hoy / Mañana / Soltar); el tiempo con un consejo; y "Tu día" por horas, donde arrastrar una tarea le reserva esa hora. Las tarjetas de antes quedan en "Resumen" | #3 | SQL 6 | `supabase/migrations/0010_prioridad_del_dia.sql`, `docs/js/hoy.js`, `docs/js/agenda.js` |
| 30 | El calendario: un cajón al final del dock con vista de día, semana y mes. Tocar un hueco crea un evento; los eventos se repiten (cada día, semana, días hábiles, mes o año, con fecha de término) y se borran "solo este" o "todos". "Mis calendarios" son tus áreas. "Tu día" también muestra las repeticiones | #8 | SQL 7 | `supabase/migrations/0011_eventos_repetidos.sql`, `docs/js/calendario.js`, `docs/js/agenda.js` |

### Productividad y Proyectos

| Paso | Qué agrega | PR | SQL | Archivo |
| --- | --- | --- | --- | --- |
| 32a | Productividad, a la izquierda de Hoy en el escritorio: tus proyectos activos con su avance, cuántas tareas van atrasadas y la próxima; elegir uno filtra las tareas (atrasadas, hoy, próximas, sin fecha y hechas plegadas), y "Agregar tarea" la deja en ese proyecto. La lista de tareas ahora es una sola pieza que comparten Hoy y Productividad | #10 | — | `docs/js/productividad.js`, `docs/js/tareas.js` |
| 32b | Mejoras de Productividad: los proyectos se agrupan en su área (Kulpem › Crear Pagina Web), cada proyecto tiene su color (también en las tareas y el calendario), arrastrar una tarea encima de un área o proyecto la mueve ahí, "Agregar tarea" entiende fechas escritas ("dentista mañana 10:00", "informe el viernes 18h", "15/11") y un proyecto sin pendientes se cierra desde la lista | #11 | — | `docs/js/productividad.js`, `docs/js/fechas.js`, `tests/fechas.test.mjs` |
| 32c | Las áreas como chips arriba de Productividad: elegir una muestra solo sus proyectos y filtra las tareas | #12 | — | `docs/js/productividad.js` |
| 35 | La página Proyectos: el índice por área con buscador, la cabecera editable (título, datos, descripción, avance vs plazo), el tablero o lista de tareas por estado, y sus notas y próximos eventos. «Abrir ↗» desde Productividad | #15 | — | `docs/js/proyectos.js` |
| 35b | Proyectos muestra solo proyectos (los ramos y objetivos tendrán su propia vista) | #17 | — | `docs/js/proyectos.js` |
| 36b | Los ramos vuelven a Productividad, bajo su área y con su color, junto a los proyectos | #20 | — | `docs/js/productividad.js` |
| 38a | Tus áreas en tu orden: los chips de Productividad empiezan por tu primera área (Todas y Sin proyecto al final) y se reordenan arrastrando; Proyectos agrupa en ese mismo orden | #22 | — | `docs/js/productividad.js`, `docs/js/base.js` |
| 38b | El índice de Proyectos pegado al costado, a todo el alto, y escondible con su botón ‹ › (se acuerda de cómo lo dejaste). Sirve para cualquier apartado: una columna con `costado: true` | #23 | — | `docs/js/widgets.js`, `docs/js/apartados.js` |
| 38c | Cada proyecto puede llevar el enlace a su proyecto en Claude: en la página Proyectos aparece «Proyecto en Claude ↗». Cualquier propiedad de tipo enlace se muestra así, como botón | #25 | SQL 11 | `supabase/migrations/0015_proyecto_en_claude.sql`, `docs/js/proyectos.js` |

### Objetivos

| Paso | Qué agrega | PR | SQL | Archivo |
| --- | --- | --- | --- | --- |
| 36 | Los tópicos (ramos) se terminan: estado (En curso / Hecho) y resultado (Aprobado / Reprobado) | #16 | SQL 9 | `supabase/migrations/0013_estado_de_topicos.sql` |
| 37a | Los objetivos llevan sus números (Desde → Va en → Meta) y se miden solos (con registros, a mano o por lo que aporta); los hitos se funden en su objetivo y desaparecen; los ramos pueden aportar a un objetivo | #21 | SQL 10 | `supabase/migrations/0014_objetivos_sin_hitos.sql` |
| 37b | Los objetivos en el escritorio infinito: una franja arriba de Productividad con una tarjeta por objetivo (cuánto llevas, y una rayita en "hoy" para ver si vas atrasado contra la fecha tope). Tocar una filtra las tareas de lo que le aporta. Sirve para cualquier apartado: una columna con `arriba: true` | #24 | — | `docs/js/objetivos.js`, `docs/js/widgets.js` |
| 37c | Los objetivos pasan de la franja a la lista de Productividad, dentro de su área: cada uno (con su anillo, su avance y la rayita de hoy) agrupa los proyectos y ramos que le aportan; lo demás queda en "Sin objetivo". Se quita la franja | #26 | — | `docs/js/productividad.js`, `docs/js/objetivos.js` |
| 37d | Un objetivo sin meta (ej. aprobar el semestre) avanza solo con lo que le aporta y termina bien: cada ramo Aprobado o proyecto cerrado suma; las tareas no. Los hábitos ayudan pero no se cuentan, y solo los objetivos con números pueden marcarse atrasados | #27 | — | `docs/js/objetivos.js` |

### Universidad

| Paso | Qué agrega | PR | SQL | Archivo |
| --- | --- | --- | --- | --- |
| 46a | El apartado Universidad: una tarjeta por ramo del semestre (cómo va, tu nota, cuánto necesitas para el 4, tu asistencia y lo próximo) y, al tocarla, la página del ramo: evaluaciones con ponderación y nota (se escriben ahí), "¿y si me saco…?", asistencia con Fui / Falté y sus tareas. Al lado, "Lo que viene" de todos tus ramos. Los eventos ganan Ponderación y Nota, y hay un registro nuevo: asistencia | #28 | SQL 12 | `supabase/migrations/0016_universidad.sql`, `docs/js/universidad.js`, `docs/js/notas.js`, `tests/notas.test.mjs` |

## Hoja de ruta

Lo que viene va con nombre, sin número: el número se pone recién al empezar el paso (el siguiente es el 47, sin letras; un paso = un PR). Los pendientes viven como tareas del proyecto «Proyecto Martita» en el centro de datos.

| Cuándo | Qué |
| --- | --- |
| Ahora | Cierre del día con Martita: asistencia, notas de Ucampus y plan de mañana |
| Ahora | EV@ automático: copia diaria (solo lectura) de fechas, notas, material y entregas |
| Siguiente | Respaldos semanales de la base |
| Siguiente | Esta semana: 7 días con horario y evaluaciones con cuenta regresiva |
| Siguiente | Salud con Dieta |
| Siguiente | Finanzas |
| Después | Chat con Martita en la web |
| Después | Google Calendar en los dos sentidos |
| Después | Modo editar la interfaz |
| Después | Varios usuarios |

## Cómo está ordenada la web

```
docs/index.html      solo la estructura de la página (una <section> por apartado)
docs/estilos.css     cómo se ve; los colores están arriba, en un solo lugar
docs/fondo.jpg       la foto de fondo
docs/js/main.js      punto de partida: la sesión y qué se dibuja al llegar los datos
docs/js/carcasa.js   la barra, el dock escondido y el cambio de apartado (no sabe de ningún apartado en particular)
docs/js/escritorio.js el lienzo movible con los apartados que tienen lugar, y su minimapa
docs/js/apartados.js la lista de apartados: agregar uno = sumarlo ahí y poner su <section>
docs/js/base.js      conexión a Supabase, atajos, los datos cargados y el tiempo real
docs/js/mapa.js      el mapa de cajas, la leyenda y los filtros
docs/js/panel.js     el panel de un nodo y el formulario para crear o editar
docs/js/nuevo.js     el botón "+ Nuevo": qué se crea según el apartado (lista "nuevo" de cada apartado)
docs/js/calendario.js el cajón del calendario (día, semana, mes) y su editor de eventos
docs/js/postits.js   lo del Inbox como post-its alrededor de las secciones del escritorio
docs/js/widgets.js   las ventanas como piezas (widgets) y cómo se arma un apartado con sus columnas
docs/js/productividad.js tus proyectos y sus tareas
docs/js/proyectos.js la página Proyectos: índice, cabecera, tablero y lo de adentro
docs/js/objetivos.js cómo se mide cada objetivo (cuánto llevas, cuánto tiempo pasó, si vas atrasado)
docs/js/tareas.js    la lista de tareas (✓, ☆, Hoy/Mañana/Soltar) que comparten Hoy y Productividad
docs/js/hoy.js       el apartado Hoy: tareas, el tiempo y tu día
docs/js/agenda.js    la agenda por horas (un día o varios); la usan Hoy y el calendario
docs/js/clima.js     el tiempo de Open-Meteo y el consejo del día
docs/js/acciones.js  lo que la web le cambia a tus datos (completar, posponer, soltar, agendar...)
docs/js/fechas.js    ayudas de fechas (hoy, sumar días, horas)
docs/js/universidad.js  el apartado Universidad: tarjetas de ramos, la página de un ramo y lo que viene
docs/js/notas.js     las cuentas de un ramo: nota hasta ahora, cuánto necesitas, cómo va, asistencia
docs/js/inicio.js    el Resumen: dibuja las señales y las tarjetas
docs/js/tarjetas.js  qué muestra cada tarjeta (agregar una = agregar un objeto a TARJETAS)
```

## Pruebas

```
npm test                                            # servidor MCP con datos falsos
DB=postgres:///mi_base_de_prueba bash tests/probar_bd.sh   # base de datos y seguridad
```

Crea todo en un Postgres local que imita a Supabase y revisa que cada usuario vea solo lo suyo.
