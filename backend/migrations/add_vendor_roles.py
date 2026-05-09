"""Add vendor_role table and update vendor_user table with role_id column."""
import asyncio
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from app.database import engine


async def migrate():
    async with engine.begin() as conn:
        # Create vendor_role table
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS vendor_role (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
                name VARCHAR(100) NOT NULL,
                slug VARCHAR(100) NOT NULL,
                description TEXT,
                permissions JSONB DEFAULT '[]'::jsonb NOT NULL,
                is_system BOOLEAN DEFAULT FALSE NOT NULL,
                is_active BOOLEAN DEFAULT TRUE NOT NULL,
                created_at TIMESTAMPTZ DEFAULT now(),
                updated_at TIMESTAMPTZ DEFAULT now()
            )
        """))
        print("[OK] Created vendor_role table")

        # Add role_id column to vendor_user if not exists
        await conn.execute(text("""
            ALTER TABLE vendor_user
            ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES vendor_role(id) ON DELETE SET NULL
        """))
        print("[OK] Added role_id column to vendor_user")

        # Add index on vendor_role
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_vendor_role_vendor ON vendor_role(vendor_id)
        """))
        print("[OK] Created index on vendor_role")

        # Add index on vendor_user role
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_vendor_user_role ON vendor_user(vendor_id, role)
        """))
        print("[OK] Created index on vendor_user role")

        # Create VendorUser entries for existing vendor owners who don't have one
        await conn.execute(text("""
            INSERT INTO vendor_user (id, vendor_id, user_id, role, permissions, is_active, created_at, updated_at)
            SELECT
                gen_random_uuid(),
                vo.vendor_id,
                vo.user_id,
                'owner',
                '[]'::jsonb,
                TRUE,
                now(),
                now()
            FROM vendor_owner vo
            WHERE NOT EXISTS (
                SELECT 1 FROM vendor_user vu
                WHERE vu.vendor_id = vo.vendor_id AND vu.user_id = vo.user_id
            )
        """))
        print("[OK] Created VendorUser entries for existing owners")


if __name__ == "__main__":
    asyncio.run(migrate())
