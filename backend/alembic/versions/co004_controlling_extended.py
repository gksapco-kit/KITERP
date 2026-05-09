"""CO: activity confirmations, goods movements, cost allocations, budget lines, variance runs.

Revision ID: co004_controlling_extended
Revises: co003_controlling_settlement
"""
from alembic import op


revision = "co004_controlling_extended"
down_revision = "co003_controlling_settlement"
branch_labels = None
depends_on = None


def x(sql: str) -> None:
    op.execute(sql.strip())


def upgrade() -> None:
    x("""CREATE TABLE IF NOT EXISTS co_activity_confirmation (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
        company_id UUID NOT NULL REFERENCES fin_company(id) ON DELETE CASCADE,
        order_id UUID NOT NULL REFERENCES co_manufacturing_order(id) ON DELETE CASCADE,
        operation_id UUID REFERENCES co_order_operation(id) ON DELETE SET NULL,
        activity_type_id UUID REFERENCES co_activity_type(id) ON DELETE SET NULL,
        cost_center_id UUID REFERENCES fin_cost_center(id) ON DELETE SET NULL,
        confirmation_date DATE NOT NULL,
        confirmation_type VARCHAR(20) DEFAULT 'labor',
        qty_confirmed NUMERIC(18,4) DEFAULT 0,
        hours_confirmed NUMERIC(18,6) DEFAULT 0,
        rate_per_hour NUMERIC(18,6) DEFAULT 0,
        total_cost NUMERIC(18,4) DEFAULT 0,
        scrap_qty NUMERIC(18,4) DEFAULT 0,
        yield_pct NUMERIC(7,4) DEFAULT 100,
        status VARCHAR(20) DEFAULT 'posted',
        narration TEXT,
        journal_entry_id UUID REFERENCES fin_journal_entry(id) ON DELETE SET NULL,
        extra JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
    )""")
    x("CREATE INDEX IF NOT EXISTS ix_co_ac_order_date ON co_activity_confirmation(order_id, confirmation_date)")
    x("CREATE INDEX IF NOT EXISTS ix_co_ac_vendor ON co_activity_confirmation(vendor_id, confirmation_date)")

    x("""CREATE TABLE IF NOT EXISTS co_goods_movement (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
        company_id UUID NOT NULL REFERENCES fin_company(id) ON DELETE CASCADE,
        order_id UUID NOT NULL REFERENCES co_manufacturing_order(id) ON DELETE CASCADE,
        movement_type VARCHAR(10) NOT NULL,
        posting_date DATE NOT NULL,
        document_no VARCHAR(40),
        product_id UUID REFERENCES product(id) ON DELETE SET NULL,
        description VARCHAR(500),
        uom VARCHAR(20) DEFAULT 'EA',
        qty NUMERIC(18,6) DEFAULT 0,
        unit_cost NUMERIC(18,6) DEFAULT 0,
        total_cost NUMERIC(18,4) DEFAULT 0,
        cost_center_id UUID REFERENCES fin_cost_center(id) ON DELETE SET NULL,
        storage_location VARCHAR(50),
        batch_no VARCHAR(50),
        status VARCHAR(20) DEFAULT 'posted',
        reversal_reason TEXT,
        journal_entry_id UUID REFERENCES fin_journal_entry(id) ON DELETE SET NULL,
        extra JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
    )""")
    x("CREATE INDEX IF NOT EXISTS ix_co_gm_order_type ON co_goods_movement(order_id, movement_type)")
    x("CREATE INDEX IF NOT EXISTS ix_co_gm_vendor_date ON co_goods_movement(vendor_id, posting_date)")

    x("""CREATE TABLE IF NOT EXISTS co_cost_allocation (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
        company_id UUID NOT NULL REFERENCES fin_company(id) ON DELETE CASCADE,
        period_year INTEGER NOT NULL,
        period_month INTEGER NOT NULL,
        allocation_cycle VARCHAR(40),
        sender_cost_center_id UUID REFERENCES fin_cost_center(id) ON DELETE SET NULL,
        receiver_cost_center_id UUID REFERENCES fin_cost_center(id) ON DELETE SET NULL,
        receiver_order_id UUID REFERENCES co_manufacturing_order(id) ON DELETE SET NULL,
        sender_account_id UUID REFERENCES fin_account(id) ON DELETE SET NULL,
        receiver_account_id UUID REFERENCES fin_account(id) ON DELETE SET NULL,
        allocation_method VARCHAR(30) DEFAULT 'percentage',
        allocation_value NUMERIC(18,6) DEFAULT 0,
        allocated_amount NUMERIC(18,4) DEFAULT 0,
        status VARCHAR(20) DEFAULT 'planned',
        posting_date DATE,
        narration TEXT,
        journal_entry_id UUID REFERENCES fin_journal_entry(id) ON DELETE SET NULL,
        extra JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
    )""")
    x("CREATE INDEX IF NOT EXISTS ix_co_ca_vendor_period ON co_cost_allocation(vendor_id, period_year, period_month)")
    x("CREATE INDEX IF NOT EXISTS ix_co_ca_sender_cc ON co_cost_allocation(sender_cost_center_id)")

    x("""CREATE TABLE IF NOT EXISTS co_budget_line (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
        company_id UUID NOT NULL REFERENCES fin_company(id) ON DELETE CASCADE,
        order_id UUID NOT NULL REFERENCES co_manufacturing_order(id) ON DELETE CASCADE,
        budget_type VARCHAR(20) DEFAULT 'original',
        category VARCHAR(30) NOT NULL,
        description VARCHAR(500),
        fiscal_year INTEGER,
        period_month INTEGER,
        amount_budgeted NUMERIC(18,4) DEFAULT 0,
        currency VARCHAR(10) DEFAULT 'USD',
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
    )""")
    x("CREATE INDEX IF NOT EXISTS ix_co_bl_order ON co_budget_line(order_id)")
    x("CREATE INDEX IF NOT EXISTS ix_co_bl_vendor_year ON co_budget_line(vendor_id, fiscal_year)")

    x("""CREATE TABLE IF NOT EXISTS co_variance_run (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
        company_id UUID NOT NULL REFERENCES fin_company(id) ON DELETE CASCADE,
        period_year INTEGER NOT NULL,
        period_month INTEGER NOT NULL,
        run_type VARCHAR(30) DEFAULT 'production_variance',
        run_date DATE NOT NULL,
        total_planned NUMERIC(18,4) DEFAULT 0,
        total_actual NUMERIC(18,4) DEFAULT 0,
        total_variance NUMERIC(18,4) DEFAULT 0,
        price_variance NUMERIC(18,4) DEFAULT 0,
        usage_variance NUMERIC(18,4) DEFAULT 0,
        overhead_variance NUMERIC(18,4) DEFAULT 0,
        scrap_variance NUMERIC(18,4) DEFAULT 0,
        order_count INTEGER DEFAULT 0,
        status VARCHAR(20) DEFAULT 'open',
        narration TEXT,
        journal_entry_id UUID REFERENCES fin_journal_entry(id) ON DELETE SET NULL,
        extra JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
    )""")
    x("CREATE INDEX IF NOT EXISTS ix_co_vr_vendor_period ON co_variance_run(vendor_id, period_year, period_month)")


def downgrade() -> None:
    x("DROP TABLE IF EXISTS co_variance_run")
    x("DROP TABLE IF EXISTS co_budget_line")
    x("DROP TABLE IF EXISTS co_cost_allocation")
    x("DROP TABLE IF EXISTS co_goods_movement")
    x("DROP TABLE IF EXISTS co_activity_confirmation")
