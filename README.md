# Centro de datos

Un sistema propio para reemplazar Notion: un centro de datos de tu vida en forma de grafo, con un asistente de IA que lo usa para ayudarte.

Se construye paso a paso. Cada paso es un commit con su explicación.

| Paso | Qué agrega | Archivo |
| --- | --- | --- |
| 1 | Tabla de tipos: qué clases de cosas existen | `supabase/migrations/0001_tipos.sql` |
| 2 | Los 8 tipos de productividad (simplificados desde Notion) como plantilla | `supabase/migrations/0002_plantillas_productividad.sql` |
| 3 | Tabla de nodos: cada cosa concreta, con estados comunes y búsqueda en español | `supabase/migrations/0003_nodos.sql` |
| 4 | Conexiones entre nodos y la función vecinos() para navegar el grafo | `supabase/migrations/0004_conexiones.sql` |
| 5 | Seguridad por usuario: cada uno (y su agente) ve solo lo suyo | `supabase/migrations/0005_seguridad.sql` |
| 6 | Servidor MCP: la puerta por donde Claude y la web entran a tus datos | `supabase/functions/mcp/` |
| 7 | Pantalla de permiso OAuth para conectar Claude (publicada con GitHub Pages) | `docs/oauth/consent/index.html` |
| 9 | Web con el mapa de tu grafo: https://aguwo.github.io/Centro-de-Datos/ | `docs/index.html` |
| 10 | Clic en un nodo: panel con sus datos y vecinos, y el mapa ilumina su vecindario | `docs/index.html` |
| 11 | Crear, editar y archivar nodos desde la web | `docs/index.html` |
| 12 | Importador de Notion: traduce tus bases a nodos y conexiones y genera un SQL para pegar en Supabase | `importador-notion/` |
| 13 | Mapa ordenado: esconde lo hecho, filtros por tipo en la leyenda, nombres según el zoom y caja "Sin conectar" (desde el paso 20, cajas por módulo) | `docs/index.html` |
| 14 | Cajas dentro de cajas: cada materia, proyecto y área es un espacio propio con todo lo suyo adentro | `docs/index.html` |
| 15 | Inicio: menú, captura rápida, Hoy, próximos 7 días, Inbox y proyectos en curso | `docs/index.html` |
| 16 | Tipos nuevos (cuenta, hábito, planta, alimento, receta, libro...) y tabla `registros` para lo que pasa con fecha (gastos, hábitos cumplidos, comidas, riegos) | `supabase/migrations/0006_vida_y_registros.sql` |
| 17 | Importador del resto de Notion: finanzas, hábitos, plantas, dieta, biblioteca y rutinas | `importador-notion/traducir-resto.mjs` |
| 18 | Dentro de cada ramo, las evaluaciones van en su propia caja "Evaluaciones" | `docs/js/mapa.js` |
| 19 | La jerarquía vive en la base: cada tipo tiene módulo, orden, color, nivel y subcajas. Vistas `arbol` (ruta completa de cada nodo) y `registros_legibles`. El agente gana `ver_arbol` y la ruta en cada búsqueda | `supabase/migrations/0007_jerarquia.sql` |
| 20 | Web ordenada en archivos: lee la jerarquía de la base, agrupa la leyenda por módulo y junta lo suelto en la caja de su módulo | `docs/js/` |
| 21 | El agente anota y consulta registros: `anotar_registro` ("gasté 5.000 en comida") y `consultar_registros` (cuenta, suma y agrupa por día, mes, nodo u otro) | `supabase/functions/mcp/servidor.ts` |
| 22 | Control total del agente: archivar, recuperar, cambiar de tipo y borrar (solo lo archivado) nodos; desconectar (queda la historia) y mover varios nodos de caja; editar y borrar registros; crear o personalizar tipos | `supabase/functions/mcp/` |
| 23 | Cada propiedad de un tipo tiene su clave exacta: el agente solo puede usar las del tipo (con valores válidos) y la web las muestra con su nombre y deja editarlas | `supabase/migrations/0008_propiedades.sql` |
| 24 | Publicación automática: al subir cambios del agente a GitHub, se corren las pruebas y se publica en Supabase | `.github/workflows/publicar-agente.yml` |
| 25 | Inicio por tarjetas (Hacer · Cuidarme · Mi vida) con señales arriba, y la web en tiempo real: se actualiza sola cuando algo cambia (tú, otra pestaña o el agente) | `supabase/migrations/0009_tiempo_real.sql`, `docs/js/tarjetas.js` |

## Cómo está ordenada la web

```
docs/index.html    solo la estructura de la página
docs/estilos.css   cómo se ve
docs/js/main.js    punto de partida: sesión, menú y qué se dibuja al llegar los datos
docs/js/base.js    conexión a Supabase, atajos, los datos cargados y el tiempo real
docs/js/mapa.js    el mapa de cajas, la leyenda y los filtros
docs/js/panel.js   el panel de un nodo y el formulario para crear o editar
docs/js/inicio.js  el Inicio: dibuja las señales y las tarjetas
docs/js/tarjetas.js  qué muestra cada tarjeta (agregar una = agregar un objeto a TARJETAS)
```

## Pruebas

```
npm test                                            # servidor MCP con datos falsos
DB=postgres:///mi_base_de_prueba bash tests/probar_bd.sh   # base de datos y seguridad
```

Crea todo en un Postgres local que imita a Supabase y revisa que cada usuario vea solo lo suyo.
