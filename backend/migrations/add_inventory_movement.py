"""
Migration: Create inventory_movement table for stock tracking.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import asyncio
from sqlalchemy import text
from app.database import engine

STATEMENTS = [
    """
    CREATE TABLE IF NOT EXISTS inventory_movement (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
        product_id UUID NOT NULL REFERENCES product(id) ON DELETE CASCADE,
        variant_id UUID REFERENCES product_variant(id) ON DELETE SET NULL,
        movement_type VARCHAR(30) NOT NULL,
        quantity INTEGER NOT NULL,
        quantity_before INTEGER NOT NULL,
        quantity_after INTEGER NOT NULL,
        reason TEXT,
        reference_type VARCHAR(30),
        reference_id UUID,
        performed_by UUID REFERENCES "user"(id),
        metadata JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_inv_vendor ON inventory_movement (vendor_id)",
    "CREATE INDEX IF NOT EXISTS idx_inv_product ON inventory_movement (product_id)",
    "CREATE INDEX IF NOT EXISTS idx_inv_variant ON inventory_movement (variant_id)",
    "CREATE INDEX IF NOT EXISTS idx_inv_type ON inventory_movement (movement_type)",
    "CREATE INDEX IF NOT EXISTS idx_inv_created ON inventory_movement (created_at)",
    "CREATE INDEX IF NOT EXISTS idx_inv_ref ON inventory_movement (reference_type, reference_id)",
]


async def run_migration():
    async with engine.begin() as conn:
        for i, stmt in enumerate(STATEMENTS, 1):
            await conn.execute(text(stmt.strip()))
            print(f"  [{i}/{len(STATEMENTS)}] OK")
    print("[OK] inventory_movement table created.")


if __name__ == "__main__":
    asyncio.run(run_migration())
