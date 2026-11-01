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

## Pruebas

```
npm test                                            # servidor MCP con datos falsos
DB=postgres:///mi_base_de_prueba bash tests/probar_bd.sh   # base de datos y seguridad
```

Crea todo en un Postgres local que imita a Supabase y revisa que cada usuario vea solo lo suyo.
