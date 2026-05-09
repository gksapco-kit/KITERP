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

  echo "[1/3] Waiting for PostgreSQL at $DB_HOST:$DB_PORT ..."
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
  echo "[1/3] No DATABASE_URL set, skipping Postgres wait."
fi

# ---- Run Alembic Migrations ----
if [ "${SKIP_MIGRATIONS:-false}" = "true" ]; then
  echo "[2/3] SKIP_MIGRATIONS=true, skipping Alembic."
else
  echo "[2/3] Running Alembic migrations ..."
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
            "ALTER TABLE IF EXISTS alembic_version "
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

# ---- Start the application ----
echo "[3/3] Starting application ..."
echo "=========================================="
exec "$@"
