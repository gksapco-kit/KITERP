"""Create platform_career_application if missing (no Alembic required)."""
from __future__ import annotations

import asyncio
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

# Load backend/.env without requiring full app import (greenlet may be broken in some envs)
env_path = ROOT / ".env"
if env_path.exists():
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, val = line.split("=", 1)
        key = key.strip()
        val = val.strip().strip('"').strip("'")
        os.environ.setdefault(key, val)


async def main() -> None:
    import asyncpg

    url = os.environ.get("DATABASE_URL") or ""
    if not url:
        raise SystemExit("DATABASE_URL not set in backend/.env")

    # postgresql+asyncpg://user:pass@host:port/db -> asyncpg DSN
    dsn = re.sub(r"^postgresql\+asyncpg://", "postgresql://", url)

    conn = await asyncpg.connect(dsn)
    try:
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS platform_career_application (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                full_name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL,
                phone VARCHAR(40),
                college VARCHAR(255),
                course VARCHAR(255),
                graduation_year INTEGER,
                city VARCHAR(120),
                linkedin_url VARCHAR(500),
                cover_note TEXT,
                cv_url VARCHAR(500) NOT NULL,
                cv_filename VARCHAR(255),
                photo_url VARCHAR(500),
                photo_filename VARCHAR(255),
                status VARCHAR(20) NOT NULL DEFAULT 'new',
                ip_address VARCHAR(64),
                user_agent TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
            """
        )
        await conn.execute(
            "ALTER TABLE platform_career_application ADD COLUMN IF NOT EXISTS photo_url VARCHAR(500)"
        )
        await conn.execute(
            "ALTER TABLE platform_career_application ADD COLUMN IF NOT EXISTS photo_filename VARCHAR(255)"
        )
        await conn.execute(
            "CREATE INDEX IF NOT EXISTS ix_platform_career_application_status ON platform_career_application(status)"
        )
        await conn.execute(
            "CREATE INDEX IF NOT EXISTS ix_platform_career_application_created ON platform_career_application(created_at DESC)"
        )
        await conn.execute(
            "CREATE INDEX IF NOT EXISTS ix_platform_career_application_email ON platform_career_application(email)"
        )
        print("OK: platform_career_application is ready")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
