"""Add all missing columns: offering_type, gst, tax, service_radius, lat/lon, vendor_roles

Revision ID: f3a9c1d2e4b5
Revises: ca70a6a5dd5b
Create Date: 2026-03-08 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'f3a9c1d2e4b5'
down_revision: Union[str, None] = 'ca70a6a5dd5b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # ── Vendor: offering_type ─────────────────────────────────────────
    conn.execute(sa.text("""
        ALTER TABLE vendor
        ADD COLUMN IF NOT EXISTS offering_type VARCHAR(20) NOT NULL DEFAULT 'both'
    """))

    # ── Vendor: GST / tax fields ──────────────────────────────────────
    conn.execute(sa.text("ALTER TABLE vendor ADD COLUMN IF NOT EXISTS gstin VARCHAR(15)"))
    conn.execute(sa.text("ALTER TABLE vendor ADD COLUMN IF NOT EXISTS pan_number VARCHAR(10)"))
    conn.execute(sa.text("ALTER TABLE vendor ADD COLUMN IF NOT EXISTS is_gst_registered BOOLEAN NOT NULL DEFAULT FALSE"))
    conn.execute(sa.text("ALTER TABLE vendor ADD COLUMN IF NOT EXISTS default_tax_rate NUMERIC(5,2) DEFAULT 0"))

    # ── Vendor: location / service radius ────────────────────────────
    conn.execute(sa.text("ALTER TABLE vendor ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 8)"))
    conn.execute(sa.text("ALTER TABLE vendor ADD COLUMN IF NOT EXISTS longitude NUMERIC(11, 8)"))
    conn.execute(sa.text("ALTER TABLE vendor ADD COLUMN IF NOT EXISTS service_radius_km INTEGER NOT NULL DEFAULT 10"))

    # ── Vendor: location indexes ──────────────────────────────────────
    conn.execute(sa.text("""
        CREATE INDEX IF NOT EXISTS idx_vendor_lat_lon
        ON vendor (latitude, longitude)
        WHERE latitude IS NOT NULL AND longitude IS NOT NULL
    """))
    conn.execute(sa.text("""
        CREATE INDEX IF NOT EXISTS idx_vendor_approved_location
        ON vendor (status, latitude, longitude)
        WHERE status = 'approved' AND latitude IS NOT NULL AND longitude IS NOT NULL
    """))

    # ── Product: tax fields ───────────────────────────────────────────
    conn.execute(sa.text("ALTER TABLE product ADD COLUMN IF NOT EXISTS is_taxable BOOLEAN NOT NULL DEFAULT TRUE"))
    conn.execute(sa.text("ALTER TABLE product ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5,2)"))
    conn.execute(sa.text("ALTER TABLE product ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(8)"))

    # ── Service: tax + UOM + mode fields ─────────────────────────────
    conn.execute(sa.text("ALTER TABLE service ADD COLUMN IF NOT EXISTS is_taxable BOOLEAN NOT NULL DEFAULT TRUE"))
    conn.execute(sa.text("ALTER TABLE service ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5,2)"))
    conn.execute(sa.text("ALTER TABLE service ADD COLUMN IF NOT EXISTS sac_code VARCHAR(8)"))
    conn.execute(sa.text("ALTER TABLE service ADD COLUMN IF NOT EXISTS uom VARCHAR(30) NOT NULL DEFAULT 'fixed'"))
    conn.execute(sa.text("ALTER TABLE service ADD COLUMN IF NOT EXISTS service_mode VARCHAR(30) NOT NULL DEFAULT 'in_store'"))

    # ── vendor_role table ─────────────────────────────────────────────
    conn.execute(sa.text("""
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

    # ── vendor_user: role_id column ───────────────────────────────────
    conn.execute(sa.text("""
        ALTER TABLE vendor_user
        ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES vendor_role(id) ON DELETE SET NULL
    """))
    conn.execute(sa.text("""
        ALTER TABLE vendor_user
        ADD COLUMN IF NOT EXISTS role_name VARCHAR(100)
    """))


def downgrade() -> None:
    conn = op.get_bind()

    conn.execute(sa.text("ALTER TABLE vendor_user DROP COLUMN IF EXISTS role_name"))
    conn.execute(sa.text("ALTER TABLE vendor_user DROP COLUMN IF EXISTS role_id"))
    conn.execute(sa.text("DROP TABLE IF EXISTS vendor_role"))
    conn.execute(sa.text("ALTER TABLE service DROP COLUMN IF EXISTS service_mode"))
    conn.execute(sa.text("ALTER TABLE service DROP COLUMN IF EXISTS uom"))
    conn.execute(sa.text("ALTER TABLE service DROP COLUMN IF EXISTS sac_code"))
    conn.execute(sa.text("ALTER TABLE service DROP COLUMN IF EXISTS tax_rate"))
    conn.execute(sa.text("ALTER TABLE service DROP COLUMN IF EXISTS is_taxable"))
    conn.execute(sa.text("ALTER TABLE product DROP COLUMN IF EXISTS hsn_code"))
    conn.execute(sa.text("ALTER TABLE product DROP COLUMN IF EXISTS tax_rate"))
    conn.execute(sa.text("ALTER TABLE product DROP COLUMN IF EXISTS is_taxable"))
    conn.execute(sa.text("DROP INDEX IF EXISTS idx_vendor_approved_location"))
    conn.execute(sa.text("DROP INDEX IF EXISTS idx_vendor_lat_lon"))
    conn.execute(sa.text("ALTER TABLE vendor DROP COLUMN IF EXISTS service_radius_km"))
    conn.execute(sa.text("ALTER TABLE vendor DROP COLUMN IF EXISTS longitude"))
    conn.execute(sa.text("ALTER TABLE vendor DROP COLUMN IF EXISTS latitude"))
    conn.execute(sa.text("ALTER TABLE vendor DROP COLUMN IF EXISTS default_tax_rate"))
    conn.execute(sa.text("ALTER TABLE vendor DROP COLUMN IF EXISTS is_gst_registered"))
    conn.execute(sa.text("ALTER TABLE vendor DROP COLUMN IF EXISTS pan_number"))
    conn.execute(sa.text("ALTER TABLE vendor DROP COLUMN IF EXISTS gstin"))
    conn.execute(sa.text("ALTER TABLE vendor DROP COLUMN IF EXISTS offering_type"))
