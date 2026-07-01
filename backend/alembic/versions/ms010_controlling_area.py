"""controlling area: CO-level org unit grouping fin_company rows

Revision ID: ms010_controlling_area
Revises: ms009_production_routing
Create Date: 2026-07-01

Adds:
  co_controlling_area          — the CO scope (SAP KOKRS equivalent); a vendor
                                  starts with one "Standard" area and can split
                                  it out when legal entities need separate CO.
  fin_company.controlling_area_id — nullable link, many companies : one area.

Vendor-scoped, not company-scoped (it sits one level above fin_company).
Idempotent: safe to re-run; mirrors app.database.ensure_controlling_area_tables.
"""
from alembic import op
import sqlalchemy as sa

revision = 'ms010_controlling_area'
down_revision = 'ms009_production_routing'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    op.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS co_controlling_area (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            code VARCHAR(20) NOT NULL,
            name VARCHAR(200) NOT NULL,
            description TEXT,
            currency VARCHAR(3) DEFAULT 'INR',
            is_active BOOLEAN DEFAULT TRUE,
            is_default BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now(),
            CONSTRAINT uq_co_controlling_area_vendor_code UNIQUE (vendor_id, code)
        );
    """))
    op.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_co_controlling_area_vendor ON co_controlling_area (vendor_id, is_active)"
    ))

    op.execute(sa.text("ALTER TABLE fin_company ADD COLUMN IF NOT EXISTS controlling_area_id UUID"))
    op.execute(sa.text("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'fk_fin_company_controlling_area'
            ) THEN
                ALTER TABLE fin_company
                ADD CONSTRAINT fk_fin_company_controlling_area
                FOREIGN KEY (controlling_area_id) REFERENCES co_controlling_area(id) ON DELETE SET NULL;
            END IF;
        END $$;
    """))
    op.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_fin_company_controlling_area ON fin_company (controlling_area_id)"
    ))


def downgrade():
    op.execute(sa.text("ALTER TABLE fin_company DROP CONSTRAINT IF EXISTS fk_fin_company_controlling_area"))
    op.execute(sa.text("ALTER TABLE fin_company DROP COLUMN IF EXISTS controlling_area_id"))
    op.execute(sa.text("DROP TABLE IF EXISTS co_controlling_area"))
