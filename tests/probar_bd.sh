#!/usr/bin/env bash
# Prueba las migraciones y la seguridad por fila en un Postgres local (sin Supabase).
# Uso: DB=postgres://usuario@localhost/cdtest bash tests/probar_bd.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB="${DB:-postgres:///cdtest}"
for f in tests/stub_supabase.sql supabase/migrations/*.sql tests/prueba_seguridad.sql; do
  psql -q -v ON_ERROR_STOP=1 "$DB" -f "$f"
done
