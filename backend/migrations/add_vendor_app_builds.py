"""
Migration: Add branded-app build tracking
- Adds app_config JSONB column to vendor table
- Creates vendor_app_build table with indexes
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import asyncio
from sqlalchemy import text
from app.database import engine

STATEMENTS = [
    # 1. Add app_config column to vendor table
    """
    ALTER TABLE vendor
      ADD COLUMN IF NOT EXISTS app_config JSONB NOT NULL DEFAULT '{}'
    """,

    # 2. Create vendor_app_build table
    """
    CREATE TABLE IF NOT EXISTS vendor_app_build (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
        platform VARCHAR(20) NOT NULL DEFAULT 'all',
        build_profile VARCHAR(50) NOT NULL DEFAULT 'vendor-all',
        status VARCHAR(30) NOT NULL DEFAULT 'pending',
        eas_build_id_android VARCHAR(100),
        eas_build_id_ios VARCHAR(100),
        artifact_url_android TEXT,
        artifact_url_ios TEXT,
        play_store_status VARCHAR(30),
        app_store_status VARCHAR(30),
        config_snapshot JSONB NOT NULL DEFAULT '{}',
        error_message TEXT,
        triggered_by UUID REFERENCES "user"(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        built_at TIMESTAMPTZ,
        published_at TIMESTAMPTZ
    )
    """,

    # 3. Indexes (run after table is created)
    "CREATE INDEX IF NOT EXISTS idx_app_build_vendor ON vendor_app_build (vendor_id)",
    "CREATE INDEX IF NOT EXISTS idx_app_build_status ON vendor_app_build (status)",
    "CREATE INDEX IF NOT EXISTS idx_app_build_vendor_status ON vendor_app_build (vendor_id, status)",
]


async def run_migration():
    async with engine.begin() as conn:
        for i, stmt in enumerate(STATEMENTS, 1):
            await conn.execute(text(stmt.strip()))
            print(f"  [{i}/{len(STATEMENTS)}] OK")
    print("[OK] vendor_app_build table created, vendor.app_config column added.")


if __name__ == "__main__":
    asyncio.run(run_migration())
