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
| 47 | Cierre del día con Martita: `cierre_del_dia` le da al agente las clases de hoy (y si marcaste asistencia), tus tareas de hoy y atrasadas, las evaluaciones sin nota y lo de mañana, con los pasos de la conversación. `agenda_de_hoy` ahora ve las clases que se repiten, cuenta los días en hora de Chile, ya no trae eventos pasados y puede mostrar varios días. La regla de repetición queda en un solo lugar de la web (`fechas.js`) y una prueba revisa que el conector diga lo mismo | #30 | — | `supabase/functions/mcp/dias.ts`, `supabase/functions/mcp/servidor.ts`, `tests/dias.test.ts` |

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
| 53 | Ajustes: modo claro, oscuro o automático, color de acento, fondo de pantalla (tu paisaje, degradados o una foto tuya), cuánto se oscurece y si se mueve, vidrio (transparencia y desenfoque), esquinas y letra. Se aplica al tiro, abre ya con tu estilo y te sigue a otros equipos (tabla `preferencias`). Sin barra arriba: «Salir» está en Ajustes y «+ Nuevo» abajo a la izquierda | — | SQL 13 | `supabase/migrations/0017_preferencias.sql`, `docs/js/apariencia.js`, `docs/js/ajustes.js`, `estilos.css` |

### Hoy y calendario

| Paso | Qué agrega | PR | SQL | Archivo |
| --- | --- | --- | --- | --- |
| 15 | Inicio: menú, captura rápida, Hoy, próximos 7 días, Inbox y proyectos en curso | — | — | `docs/index.html` |
| 25 | Inicio por tarjetas (Hacer · Cuidarme · Mi vida) con señales arriba, y la web en tiempo real: se actualiza sola cuando algo cambia (tú, otra pestaña o el agente) | — | SQL 5 | `supabase/migrations/0009_tiempo_real.sql`, `docs/js/tarjetas.js` |
| 27 | Hoy: tus 3 prioridades destacadas, lo demás de hoy y lo atrasado (Hoy / Mañana / Soltar); el tiempo con un consejo; y "Tu día" por horas, donde arrastrar una tarea le reserva esa hora. Las tarjetas de antes quedan en "Resumen" | #3 | SQL 6 | `supabase/migrations/0010_prioridad_del_dia.sql`, `docs/js/hoy.js`, `docs/js/agenda.js` |
| 30 | El calendario: un cajón al final del dock con vista de día, semana y mes. Tocar un hueco crea un evento; los eventos se repiten (cada día, semana, días hábiles, mes o año, con fecha de término) y se borran "solo este" o "todos". "Mis calendarios" son tus áreas. "Tu día" también muestra las repeticiones | #8 | SQL 7 | `supabase/migrations/0011_eventos_repetidos.sql`, `docs/js/calendario.js`, `docs/js/agenda.js` |
| 61 | Esta semana: una sección nueva del escritorio infinito, arriba de Hoy. Arriba, lo que más pesa en la semana con los días que faltan, lo que viene después y un aviso si la semana siguiente viene pesada. Abajo, una columna por día con cuánto tiene, las evaluaciones pintadas del color de su ramo, el horario y las tareas (se marcan ahí mismo). ‹ › cambia de semana | — | — | `docs/js/semana.js`, `docs/js/apartados.js`, `estilos.css` |

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
| 57 | Proyectos se abre con una galería: una tarjeta por proyecto con su portada ilustrada (adivinada por el nombre), si va «Al día», «Atrasado», «Sin plazo» o «En pausa», un anillo con lo hecho, su siguiente tarea y una barra con la rayita de dónde deberías ir según el plazo. Arriba, un resumen en pastillas, buscador y filtros. Tocar una tarjeta abre el proyecto (con «‹ Proyectos» para volver). Animaciones suaves al entrar, al pasar el mouse y al abrir; se apagan si tu equipo pide menos movimiento. El índice del costado ya no está | — | — | `docs/js/proyectos.js` (`galeria`, `ritmo`), `dibujos.js` (`anillo`, `pastilla`), `apartados.js`, `widgets.js`, `estilos.css` |
| 58 | Cada proyecto puede tener su foto de portada (propiedad «Portada», de un tipo nuevo: imagen). Arriba de la página del proyecto va grande, con el título, dónde está y sus datos encima; al abrirlo entra con un zoom suave. Sin foto, se ve el dibujo de su tema sobre su color. «Cambiar portada» pide el enlace de la foto (o la quita). La foto también sale en su tarjeta de la galería | — | SQL 16 | `supabase/migrations/0020_portada_de_proyectos.sql`, `docs/js/proyectos.js` (`cabecera`, `elegirFoto`), `dibujos.js` (`portada` con foto), `panel.js`, `estilos.css` |
| 59 | Bajo la portada del proyecto, tres tarjetas: **Siguiente paso** (la tarea pendiente más cercana, para marcarla con un toque), **Ritmo** (anillo con lo hecho, si vas al día y cuánto plazo pasó) y **Plazo** (una línea del inicio al fin con «hoy» y un punto por cada tarea con fecha: hecha, por venir o atrasada). Sin fecha de inicio, el plazo cuenta desde que creaste el proyecto | — | — | `docs/js/proyectos.js` (`avance`, `siguientePaso`, `ritmoDe`, `plazoDe`), `dibujos.js`, `estilos.css` |
| — | Arreglo: las animaciones de Proyectos (tarjetas, anillos, barras, portada) se ven solo al llegar o al abrir un proyecto; ya no se repiten cada vez que llegan los datos (ej. al volver a la pestaña) | — | — | `docs/js/proyectos.js`, `estilos.css` |
| — | Arreglo: el tablero de tareas ya no se corta. Mide lo que su contenido y cada columna (Por hacer, En curso, Esperando, Hecho) se desliza por dentro solo si no cabe, con una barra de desplazamiento delgada y discreta | — | — | `docs/js/proyectos.js` (`enTablero`), `widgets.js`, `estilos.css` |
| 60 | El tablero de un proyecto se mueve con suavidad: al arrastrar una tarea a otra columna se cambia al tiro (sin esperar a la base) y viaja hasta su lugar; lo mismo si cambia de estado desde otro lado (el panel, Martita). Mientras la arrastras se ve más tenue. Usa View Transitions del navegador; sin soporte o con «reducir movimiento», cambia sin animación | — | — | `docs/js/dibujos.js` (`moverConSuavidad`), `proyectos.js` (`tablero`, `enTablero`), `estilos.css` |
| — | Arreglo: el porcentaje del anillo de avance es más chico para que quede dentro del anillo (galería y tarjeta Ritmo) | — | — | `estilos.css` |
| — | Arreglo: el anillo de las tarjetas de la galería es un poco más grande y de trazo más fino, para que el porcentaje no toque el borde | — | — | `estilos.css` |

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
| 48 | El syllabus de cada ramo (sacado de EV@) se ve en la página del ramo, en «Syllabus», que se abre al tocarlo. Una evaluación con ponderación 0 es formativa (un diagnóstico, una guía): aparece en la tabla pero no cuenta en la nota | #31 | — | `docs/js/universidad.js`, `docs/js/notas.js`, `tests/notas.test.mjs` |
| 49 | Tus notas y tu asistencia reales desde el sistema de la U (intranet7, que se abre desde «Ficha del curso» del portal). Corre en tu PC porque la U bloquea la nube: entra con tu RUT y clave guardados cifrados en Windows y deja todo en un archivo en tu PC. Todavía no los sube al centro de datos | #32 | — | `universidad-pc/`, `tests/universidad-pc.test.mjs` |
| 50 | Lo que lee el paso 49 se sube solo al centro de datos cada vez que prendes el PC: notas nuevas y la asistencia de cada clase (sin duplicar; lo que no encuentra pareja se avisa). Tu PC se conecta una vez con el correo de siempre y guarda la sesión cifrada. La web ahora trae la asistencia de todo el semestre. Arreglo: no sube las clases de hoy en adelante (el portal ya las lista como faltas) y borra las que subió de más | #33, #34 | — | `universidad-pc/`, `docs/js/base.js` |
| 51 | Las notas que sube el portal de la U quedan fijas (en verde y con candado): en la web no se pueden editar (ni en la tabla del ramo ni en «Editar») y Martita tampoco las cambia. Se actualizan solas con la próxima subida | #35, #36 | — | `docs/js/base.js` (`fijas`), `estilos.css`, `universidad.js`, `panel.js`, `universidad-pc/subir.mjs`, conector (redeploy) |
| 52 | Rediseño del apartado Universidad: cada ramo tiene su portada ilustrada y su ícono (adivinados por el nombre, o `props.icono`), el profe y la asistencia mínima salen del syllabus, el anillo muestra cuánto del ramo ya está evaluado (no la nota), cada evaluación lleva un ícono según su tipo y la asistencia se ve en un anillo con la marca del mínimo y un ✓/✗ por clase | — | — | `docs/js/dibujos.js` (nuevo: íconos, portadas, anillo), `universidad.js`, `notas.js` (`evaluado`), `estilos.css` |
| 54 | Cada ramo o proyecto puede tener su color fijo (propiedad «Color» en tópicos y proyectos, se elige en «Editar»); los que no tienen siguen con uno automático que no repite los elegidos | — | 14 | `docs/js/base.js` (`colorDeProyecto`), migración `0018` |
| — | Arreglo: las tarjetas de los ramos ya no muestran el anillo de «evaluado» (el porcentaje sigue en la página del ramo) | — | — | `universidad.js`, `estilos.css` |
| — | Arreglo: la asistencia de los ramos se ve con una barra delgada con la rayita del mínimo (en las tarjetas y en la página del ramo), en vez del anillo | — | — | `dibujos.js` (`progreso`), `universidad.js`, `estilos.css` |
| — | Arreglo: Universidad sin el texto «mínimo X%» (queda solo la rayita en la barra); las pastillas de aviso pasan a una barra bajo el título del apartado (`ctx.barra`), así «Lo que viene» parte a la altura de las tarjetas | — | — | `widgets.js`, `universidad.js`, `estilos.css` |
| — | Arreglo: «+ Nuevo» pasa abajo a la derecha (píldora en el computador, redonda en el teléfono); su menú se abre hacia arriba desde ahí y el minimapa sube para no chocar | — | — | `estilos.css`, `nuevo.js`, `index.html` |
| 55 | Barra lateral personalizable en Ajustes: cinco estilos (Clásica, Solo íconos, Ancha, Flotante, Isla), mostrar u ocultar cada botón y cambiar su orden; Ajustes queda siempre abajo y el elegido se marca con un fondo suave y una rayita | — | — | `apariencia.js` (`BARRAS`), `carcasa.js` (`entradasDeLaBarra`), `ajustes.js` (`barra`), `estilos.css` |
| — | Arreglo: barra lateral casi sólida (sin transparencias que se mezclan), el costado de Proyectos ya no pasa por debajo de la barra al esconderse, la barra se puede retraer (‹ al pie, › en el borde para sacarla; se recuerda), el minimapa pasa abajo a la izquierda y en Ajustes los botones se ordenan arrastrándolos | — | — | `estilos.css`, `carcasa.js`, `apariencia.js` (`retraida`), `ajustes.js` (`arrastrable`) |
| — | Arreglo: animaciones suaves en la barra lateral: fundido al pasar el mouse, ícono que se levanta y se hunde al apretar, rayita del elegido que crece, barra y contenido que se deslizan al retraer, botones que aparecen uno tras otro, cambio de estilo gradual y globos que entran deslizándose (respeta «reducir movimiento» del equipo) | — | — | `estilos.css`, `carcasa.js` (`--i`) |
| — | Arreglo: el escritorio infinito pasa por debajo de la barra (ya no se corta en seco a su lado) y centra lo que miras en el espacio libre; el calendario ya no tapa la barra; el botón para retraer queda al lado de Ajustes | — | — | `escritorio.js` (`libre`), `carcasa.js`, `estilos.css` |
| — | Arreglo: con barra Flotante o Isla, el costado de Proyectos también flota como tarjeta; los nombres que salen al pasar el mouse (Solo íconos e Isla) se ven enteros | — | — | `estilos.css` |
| — | Arreglo: en el calendario y en «Tu día», lo que está dentro de un ramo o proyecto toma su color (`colorDeSuCaja`), y los títulos no repiten el día que ya se ve (`sinLoQueYaSeVe`: «Clase Inglés II (jueves)» → «Clase Inglés II») | — | — | `base.js`, `fechas.js` (`esDia`), `agenda.js`, `calendario.js` |
| — | Arreglo: en el calendario, lo que cae a la misma hora se escalona (encima va lo de una vez, como una evaluación, sobre lo que se repite, como una clase), lo de una vez va lleno de color y los nombres usan hasta 3 líneas | — | — | `agenda.js` (`columnas`), `estilos.css` |
| — | Arreglo: en el calendario la hora va siempre debajo del nombre; en los bloques cortos el texto se aprieta, y solo si ni así cabe va al lado | — | — | `agenda.js`, `estilos.css` |
| — | Arreglo: al tocar un ícono de la barra ya no queda una franja oscura sobre las ventanas del escritorio infinito (Chrome/Brave no redibujaban el vidrio al terminar el viaje) | — | — | `escritorio.js` |
| — | Arreglo: la franja oscura volvía cuando la cámara no viajaba; ahora el escritorio infinito redibuja el vidrio después de cualquier toque en la barra | — | — | `escritorio.js` |
| — | Arreglo: la cámara del escritorio infinito se mueve en píxeles enteros de la pantalla (con medio píxel Chromium dibujaba mal el vidrio); se quita el redibujo forzado, que no servía | — | — | `escritorio.js` |
| — | Revisión del escritorio infinito: al volver de otro apartado la cámara se enfocaba dos veces (ir() con viaje y el ResizeObserver de golpe, que cortaba el viaje); ahora el observador solo reacciona a cambios de tamaño reales. Se quita la transición duplicada de `main` | — | — | `escritorio.js`, `estilos.css` |
| 56 | EV@ automático: dos veces al día (8:00 y 20:00) la base llama sola a la función `eva`, que copia tus entregas de EV@ como tareas dentro de cada ramo, mueve la fecha si la cambian y las marca «Hecho» cuando entregas. Solo lee EV@. Cada ramo dice su curso en la propiedad «Curso en EV@» | #53 | 15 | `supabase/functions/eva/`, `supabase/migrations/0019_eva.sql`, `tests/eva.test.ts` |

## Hoja de ruta

Lo que viene va con nombre, sin número: el número se pone recién al empezar el paso (el siguiente es el 62, sin letras; un paso = un PR). Los pendientes viven como tareas del proyecto «Proyecto Martita» en el centro de datos.

| Cuándo | Qué |
| --- | --- |
| Ahora | Respaldos semanales de la base |
| Siguiente | EV@: material de cada ramo (lista con enlaces) y cuestionarios con fecha |
| Ahora | Esta semana: la vista «Horario» (por horas, con cuenta regresiva) y elegir la vista de cada apartado |
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
docs/js/apariencia.js cómo se ve la web (modo, color, fondo, vidrio, letra): se aplica y se guarda
docs/js/ajustes.js   el apartado Ajustes: los controles que la cambian y tu cuenta
docs/js/universidad.js  el apartado Universidad: tarjetas de ramos, la página de un ramo y lo que viene
docs/js/notas.js     las cuentas de un ramo: nota hasta ahora, cuánto necesitas, cómo va, asistencia
docs/js/dibujos.js   íconos y portadas ilustradas (trazos SVG propios, se tiñen con el color del ramo o proyecto)
universidad-pc/      corre en tu PC: lee notas y asistencia del portal de la U y las sube (una vez: guardar-clave.ps1, conectar.ps1 e instalar.ps1)
docs/js/inicio.js    el Resumen: dibuja las señales y las tarjetas
docs/js/tarjetas.js  qué muestra cada tarjeta (agregar una = agregar un objeto a TARJETAS)
```

## Pruebas

```
npm test                                            # servidor MCP con datos falsos
DB=postgres:///mi_base_de_prueba bash tests/probar_bd.sh   # base de datos y seguridad
```

Crea todo en un Postgres local que imita a Supabase y revisa que cada usuario vea solo lo suyo.
