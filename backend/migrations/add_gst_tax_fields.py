"""
Migration: Add GST, tax, and service fields
- Vendor: gstin, pan_number, is_gst_registered, default_tax_rate
- Product: is_taxable, tax_rate, hsn_code
- Service: is_taxable, tax_rate, sac_code, uom, service_mode
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import asyncio
from sqlalchemy import text
from app.database import engine

STATEMENTS = [
    # Vendor GST fields
    "ALTER TABLE vendor ADD COLUMN IF NOT EXISTS gstin VARCHAR(15)",
    "ALTER TABLE vendor ADD COLUMN IF NOT EXISTS pan_number VARCHAR(10)",
    "ALTER TABLE vendor ADD COLUMN IF NOT EXISTS is_gst_registered BOOLEAN NOT NULL DEFAULT FALSE",
    "ALTER TABLE vendor ADD COLUMN IF NOT EXISTS default_tax_rate NUMERIC(5,2) DEFAULT 0",

    # Product tax fields
    "ALTER TABLE product ADD COLUMN IF NOT EXISTS is_taxable BOOLEAN NOT NULL DEFAULT TRUE",
    "ALTER TABLE product ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5,2)",
    "ALTER TABLE product ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(8)",

    # Service tax + UOM + mode fields
    "ALTER TABLE service ADD COLUMN IF NOT EXISTS is_taxable BOOLEAN NOT NULL DEFAULT TRUE",
    "ALTER TABLE service ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5,2)",
    "ALTER TABLE service ADD COLUMN IF NOT EXISTS sac_code VARCHAR(8)",
    "ALTER TABLE service ADD COLUMN IF NOT EXISTS uom VARCHAR(30) NOT NULL DEFAULT 'fixed'",
    "ALTER TABLE service ADD COLUMN IF NOT EXISTS service_mode VARCHAR(30) NOT NULL DEFAULT 'in_store'",
]


async def run_migration():
    async with engine.begin() as conn:
        for i, stmt in enumerate(STATEMENTS, 1):
            await conn.execute(text(stmt.strip()))
            print(f"  [{i}/{len(STATEMENTS)}] OK")
    print("[OK] GST, tax, UOM, and service_mode fields added.")


if __name__ == "__main__":
    asyncio.run(run_migration())
