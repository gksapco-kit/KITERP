"""Stage C GDP + track & trace columns and tables.

Revision ID: pharma002_stage_c
Revises: pharma001_pharma_schema
Create Date: 2026-07-25
"""
from alembic import op

revision = "pharma002_stage_c"
down_revision = "pharma001_pharma_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    stmts = [
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS gtin VARCHAR(14)",
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS ndc VARCHAR(20)",
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS requires_cold_chain BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE product ADD COLUMN IF NOT EXISTS storage_condition VARCHAR(30)",
        "ALTER TABLE storage_location ADD COLUMN IF NOT EXISTS storage_condition VARCHAR(30)",
        "ALTER TABLE storage_location ADD COLUMN IF NOT EXISTS temp_min_c INTEGER",
        "ALTER TABLE storage_location ADD COLUMN IF NOT EXISTS temp_max_c INTEGER",
        "ALTER TABLE goods_batch ADD COLUMN IF NOT EXISTS storage_condition VARCHAR(30)",
        "ALTER TABLE customer ADD COLUMN IF NOT EXISTS wholesale_license_number VARCHAR(80)",
        "ALTER TABLE customer ADD COLUMN IF NOT EXISTS wholesale_license_expires DATE",
        """CREATE TABLE IF NOT EXISTS pharma_temp_excursion (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            storage_location_id UUID REFERENCES storage_location(id) ON DELETE SET NULL,
            goods_batch_id UUID REFERENCES goods_batch(id) ON DELETE SET NULL,
            recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            temp_c NUMERIC(6,2) NOT NULL,
            duration_minutes INTEGER,
            status VARCHAR(30) NOT NULL DEFAULT 'open',
            severity VARCHAR(20) NOT NULL DEFAULT 'minor',
            notes TEXT,
            actions JSONB NOT NULL DEFAULT '[]'::jsonb,
            created_by UUID REFERENCES vendor_user(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ DEFAULT now(),
            closed_at TIMESTAMPTZ
        )""",
        "CREATE INDEX IF NOT EXISTS ix_pharma_excursion_vendor ON pharma_temp_excursion (vendor_id)",
        """CREATE TABLE IF NOT EXISTS pharma_trading_partner (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            name VARCHAR(200) NOT NULL,
            partner_type VARCHAR(40) NOT NULL DEFAULT 'wholesaler',
            gln VARCHAR(20),
            license_number VARCHAR(80),
            license_expires DATE,
            verification_endpoint VARCHAR(500),
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            meta JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        )""",
        "CREATE INDEX IF NOT EXISTS ix_pharma_partner_vendor ON pharma_trading_partner (vendor_id)",
        """CREATE TABLE IF NOT EXISTS pharma_epcis_event (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            event_type VARCHAR(40) NOT NULL DEFAULT 'ObjectEvent',
            action VARCHAR(20) NOT NULL DEFAULT 'ADD',
            biz_step VARCHAR(40) NOT NULL,
            disposition VARCHAR(40),
            event_time TIMESTAMPTZ NOT NULL DEFAULT now(),
            epc_list JSONB NOT NULL DEFAULT '[]'::jsonb,
            parent_epc VARCHAR(200),
            child_epcs JSONB NOT NULL DEFAULT '[]'::jsonb,
            biz_location VARCHAR(120),
            read_point VARCHAR(120),
            goods_batch_id UUID REFERENCES goods_batch(id) ON DELETE SET NULL,
            product_id UUID REFERENCES product(id) ON DELETE SET NULL,
            gtin VARCHAR(14),
            lot_number VARCHAR(50),
            source_type VARCHAR(40),
            source_id UUID,
            partner_id UUID REFERENCES pharma_trading_partner(id) ON DELETE SET NULL,
            meta JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ DEFAULT now()
        )""",
        "CREATE INDEX IF NOT EXISTS ix_pharma_epcis_vendor ON pharma_epcis_event (vendor_id)",
        "CREATE INDEX IF NOT EXISTS ix_pharma_epcis_time ON pharma_epcis_event (vendor_id, event_time)",
    ]
    for s in stmts:
        op.execute(s)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS pharma_epcis_event")
    op.execute("DROP TABLE IF EXISTS pharma_trading_partner")
    op.execute("DROP TABLE IF EXISTS pharma_temp_excursion")
