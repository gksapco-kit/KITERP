#!/bin/sh
set -e

echo "=========================================="
echo " KITERP Backend - Entrypoint"
echo "=========================================="

# ---- Wait for Postgres ----
if [ -n "$DATABASE_URL" ]; then
  DB_HOST=$(echo "$DATABASE_URL" | sed -E 's|.*@([^:/]+).*|\1|')
  DB_PORT=$(echo "$DATABASE_URL" | sed -E 's|.*:([0-9]+)/.*|\1|')
  DB_PORT=${DB_PORT:-5432}

  echo "[1/4] Waiting for PostgreSQL at $DB_HOST:$DB_PORT ..."
  retries=0
  max_retries=30
  while ! nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; do
    retries=$((retries + 1))
    if [ $retries -ge $max_retries ]; then
      echo "ERROR: PostgreSQL not reachable after ${max_retries}s. Starting anyway..."
      break
    fi
    sleep 1
  done
  echo "       PostgreSQL is up."
else
  echo "[1/4] No DATABASE_URL set, skipping Postgres wait."
fi

# ---- Run Alembic Migrations ----
if [ "${SKIP_MIGRATIONS:-false}" = "true" ]; then
  echo "[2/4] SKIP_MIGRATIONS=true, skipping Alembic."
else
  echo "[2/4] Running Alembic migrations ..."
  # Default Alembic uses VARCHAR(32) for version_num; this repo uses longer revision ids.
  python <<'PY'
import asyncio
import os

import asyncpg

url = os.environ.get("DATABASE_URL", "")
if not url:
    raise SystemExit(0)
# asyncpg expects postgresql:// (not sqlalchemy's +asyncpg scheme)
dsn = url.replace("postgresql+asyncpg://", "postgresql://")


async def main() -> None:
    conn = await asyncpg.connect(dsn)
    try:
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS alembic_version (
                version_num VARCHAR(255) NOT NULL,
                CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
            )
            """
        )
        await conn.execute(
            "ALTER TABLE alembic_version "
            "ALTER COLUMN version_num TYPE VARCHAR(255)"
        )
    finally:
        await conn.close()


asyncio.run(main())
PY
  # Multiple parallel branches exist in this repo; upgrade every head
  alembic upgrade heads
  echo "       Migrations complete."
fi

# ---- Upload directory (Docker volume is often root-owned; app runs as appuser) ----
echo "[3/3] Ensuring upload directories ..."
mkdir -p /app/uploads/products /app/uploads/services /app/uploads/media \
  /app/uploads/vendors /app/uploads/hr /app/uploads/crm /app/uploads/orders \
  /app/uploads/websites
if id appuser >/dev/null 2>&1; then
  chown -R appuser:appgroup /app/uploads
fi

# ---- Start the application ----
echo "[4/4] Starting application ..."
echo "=========================================="
if id appuser >/dev/null 2>&1 && [ "$(id -u)" = "0" ]; then
  exec gosu appuser "$@"
fi
exec "$@"
