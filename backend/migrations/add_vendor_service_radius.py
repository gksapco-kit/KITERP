"""Add service_radius_km column to vendor table."""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from app.database import engine


async def migrate():
    async with engine.begin() as conn:
        # Add service_radius_km column (default 10 km)
        await conn.execute(text("""
            ALTER TABLE vendor
            ADD COLUMN IF NOT EXISTS service_radius_km INTEGER NOT NULL DEFAULT 10
        """))
        print("[OK] Added service_radius_km column to vendor")

        # Ensure latitude/longitude columns exist (they should already)
        await conn.execute(text("""
            ALTER TABLE vendor
            ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 8)
        """))
        await conn.execute(text("""
            ALTER TABLE vendor
            ADD COLUMN IF NOT EXISTS longitude NUMERIC(11, 8)
        """))
        print("[OK] Ensured latitude/longitude columns exist")

        # Create index for location-based queries
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_vendor_lat_lon
            ON vendor (latitude, longitude)
            WHERE latitude IS NOT NULL AND longitude IS NOT NULL
        """))
        print("[OK] Created partial index on vendor(latitude, longitude)")

        # Create index for approved vendors with location (used by nearby search)
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_vendor_approved_location
            ON vendor (status, latitude, longitude)
            WHERE status = 'approved'
            AND latitude IS NOT NULL
            AND longitude IS NOT NULL
        """))
        print("[OK] Created composite index for nearby vendor lookups")


if __name__ == "__main__":
    asyncio.run(migrate())
