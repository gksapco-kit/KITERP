"""CO: GL mapping, cost bookings, manufacturing order settlement columns.

Revision ID: co003_controlling_settlement
Revises: co002_controlling_operations
"""
from alembic import op


revision = "co003_controlling_settlement"
down_revision = "co002_controlling_operations"
branch_labels = None
depends_on = None


def x(sql: str) -> None:
    op.execute(sql.strip())


def upgrade() -> None:
    x("""CREATE TABLE IF NOT EXISTS co_gl_mapping (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
        company_id UUID NOT NULL REFERENCES fin_company(id) ON DELETE CASCADE,
        wip_account_id UUID REFERENCES fin_account(id) ON DELETE SET NULL,
        finished_goods_account_id UUID REFERENCES fin_account(id) ON DELETE SET NULL,
        cogs_account_id UUID REFERENCES fin_account(id) ON DELETE SET NULL,
        production_variance_account_id UUID REFERENCES fin_account(id) ON DELETE SET NULL,
        raw_material_account_id UUID REFERENCES fin_account(id) ON DELETE SET NULL,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now(),
        CONSTRAINT uq_co_gl_mapping_vendor_company UNIQUE (vendor_id, company_id)
    )""")
    x("CREATE INDEX IF NOT EXISTS ix_co_gl_mapping_vendor ON co_gl_mapping(vendor_id)")

    x("""CREATE TABLE IF NOT EXISTS co_cost_booking (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
        company_id UUID NOT NULL REFERENCES fin_company(id) ON DELETE CASCADE,
        order_id UUID NOT NULL REFERENCES co_manufacturing_order(id) ON DELETE CASCADE,
        booking_type VARCHAR(40) NOT NULL,
        amount NUMERIC(18,4) DEFAULT 0,
        qty_basis NUMERIC(18,6),
        unit_cost NUMERIC(18,6),
        journal_entry_id UUID REFERENCES fin_journal_entry(id) ON DELETE SET NULL,
        entry_date DATE,
        narration TEXT,
        extra JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT now()
    )""")
    x("CREATE INDEX IF NOT EXISTS ix_co_cb_order ON co_cost_booking(order_id, booking_type)")

    x(
        "ALTER TABLE co_manufacturing_order ADD COLUMN IF NOT EXISTS "
        "production_completion_journal_id UUID REFERENCES fin_journal_entry(id) ON DELETE SET NULL"
    )
    x(
        "ALTER TABLE co_manufacturing_order ADD COLUMN IF NOT EXISTS "
        "cogs_issue_journal_id UUID REFERENCES fin_journal_entry(id) ON DELETE SET NULL"
    )
    x("ALTER TABLE co_manufacturing_order ADD COLUMN IF NOT EXISTS settlement_status VARCHAR(30) DEFAULT 'none'")


def downgrade() -> None:
    x("ALTER TABLE co_manufacturing_order DROP COLUMN IF EXISTS settlement_status")
    x("ALTER TABLE co_manufacturing_order DROP COLUMN IF EXISTS cogs_issue_journal_id")
    x("ALTER TABLE co_manufacturing_order DROP COLUMN IF EXISTS production_completion_journal_id")
    x("DROP TABLE IF EXISTS co_cost_booking")
    x("DROP TABLE IF EXISTS co_gl_mapping")
