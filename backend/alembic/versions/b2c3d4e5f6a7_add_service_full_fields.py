"""Add full service fields: brand, discounts, lifecycle, booking, advanced, audit

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-03-11 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    stmts = [
        # Basic Info
        "ALTER TABLE service ADD COLUMN IF NOT EXISTS brand VARCHAR(255)",
        "ALTER TABLE service ADD COLUMN IF NOT EXISTS service_type VARCHAR(30) DEFAULT 'one_time'",

        # Pricing & Discounts
        "ALTER TABLE service ADD COLUMN IF NOT EXISTS discount_percentage NUMERIC(5,2)",
        "ALTER TABLE service ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12,2)",
        "ALTER TABLE service ADD COLUMN IF NOT EXISTS discount_start_date TIMESTAMPTZ",
        "ALTER TABLE service ADD COLUMN IF NOT EXISTS discount_end_date TIMESTAMPTZ",
        "ALTER TABLE service ADD COLUMN IF NOT EXISTS offer_label VARCHAR(100)",

        # Tax
        "ALTER TABLE service ADD COLUMN IF NOT EXISTS gst_rate NUMERIC(5,2)",

        # Service Configuration
        "ALTER TABLE service ADD COLUMN IF NOT EXISTS service_capacity INTEGER DEFAULT 1",

        # Booking & Scheduling
        "ALTER TABLE service ADD COLUMN IF NOT EXISTS booking_lead_time_hours INTEGER",
        "ALTER TABLE service ADD COLUMN IF NOT EXISTS cancellation_hours INTEGER",
        "ALTER TABLE service ADD COLUMN IF NOT EXISTS rescheduling_policy TEXT",
        "ALTER TABLE service ADD COLUMN IF NOT EXISTS no_show_policy TEXT",

        # Service Lifecycle
        "ALTER TABLE service ADD COLUMN IF NOT EXISTS service_expiry_date DATE",
        "ALTER TABLE service ADD COLUMN IF NOT EXISTS validity_period_days INTEGER",
        "ALTER TABLE service ADD COLUMN IF NOT EXISTS renewal_required BOOLEAN DEFAULT FALSE",

        # Visibility & Marketing
        "ALTER TABLE service ADD COLUMN IF NOT EXISTS is_popular BOOLEAN DEFAULT FALSE",
        "ALTER TABLE service ADD COLUMN IF NOT EXISTS is_new_service BOOLEAN DEFAULT FALSE",

        # SEO
        "ALTER TABLE service ADD COLUMN IF NOT EXISTS meta_keywords JSONB DEFAULT '[]'::jsonb",

        # Advanced Features
        "ALTER TABLE service ADD COLUMN IF NOT EXISTS service_packages JSONB DEFAULT '[]'::jsonb",
        "ALTER TABLE service ADD COLUMN IF NOT EXISTS addons JSONB DEFAULT '[]'::jsonb",
        "ALTER TABLE service ADD COLUMN IF NOT EXISTS prerequisites TEXT",
        "ALTER TABLE service ADD COLUMN IF NOT EXISTS whats_included JSONB DEFAULT '[]'::jsonb",
        "ALTER TABLE service ADD COLUMN IF NOT EXISTS whats_not_included JSONB DEFAULT '[]'::jsonb",
        "ALTER TABLE service ADD COLUMN IF NOT EXISTS service_areas JSONB DEFAULT '[]'::jsonb",

        # Audit & Tracking
        'ALTER TABLE service ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES "user"(id) ON DELETE SET NULL',
        'ALTER TABLE service ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES "user"(id) ON DELETE SET NULL',
        "ALTER TABLE service ADD COLUMN IF NOT EXISTS version_number INTEGER DEFAULT 1",
        "ALTER TABLE service ADD COLUMN IF NOT EXISTS change_history JSONB DEFAULT '[]'::jsonb",
        "ALTER TABLE service ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0",
        "ALTER TABLE service ADD COLUMN IF NOT EXISTS booking_count INTEGER DEFAULT 0",
    ]

    for stmt in stmts:
        conn.execute(sa.text(stmt))

    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_service_type ON service (service_type)"))


def downgrade() -> None:
    cols = [
        "brand", "service_type",
        "discount_percentage", "discount_amount", "discount_start_date", "discount_end_date",
        "offer_label", "gst_rate", "service_capacity",
        "booking_lead_time_hours", "cancellation_hours", "rescheduling_policy", "no_show_policy",
        "service_expiry_date", "validity_period_days", "renewal_required",
        "is_popular", "is_new_service", "meta_keywords",
        "service_packages", "addons", "prerequisites",
        "whats_included", "whats_not_included", "service_areas",
        "created_by", "updated_by", "version_number", "change_history",
        "view_count", "booking_count",
    ]
    conn = op.get_bind()
    for col in cols:
        conn.execute(sa.text(f"ALTER TABLE service DROP COLUMN IF EXISTS {col}"))
    conn.execute(sa.text("DROP INDEX IF EXISTS idx_service_type"))
