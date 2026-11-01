# Centro de datos

Un sistema propio para reemplazar Notion: un centro de datos de tu vida en forma de grafo, con un asistente de IA que lo usa para ayudarte.

Se construye paso a paso. Cada paso es un commit con su explicación.

| Paso | Qué agrega | Archivo |
| --- | --- | --- |
| 1 | Tabla de tipos: qué clases de cosas existen | `supabase/migrations/0001_tipos.sql` |
| 2 | Los 8 tipos de productividad (simplificados desde Notion) como plantilla | `supabase/migrations/0002_plantillas_productividad.sql` |
| 3 | Tabla de nodos: cada cosa concreta, con estados comunes y búsqueda en español | `supabase/migrations/0003_nodos.sql` |
