"""CO: order operations (routing), planning fields on manufacturing orders.

Revision ID: co002_controlling_operations
Revises: co001_controlling_core
"""
from alembic import op


revision = "co002_controlling_operations"
down_revision = "co001_controlling_core"
branch_labels = None
depends_on = None


def x(sql: str) -> None:
    op.execute(sql.strip())


def upgrade() -> None:
    x("ALTER TABLE co_manufacturing_order ADD COLUMN IF NOT EXISTS title VARCHAR(200)")
    x("ALTER TABLE co_manufacturing_order ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'medium'")
    x("ALTER TABLE co_manufacturing_order ADD COLUMN IF NOT EXISTS ref_doc_type VARCHAR(40)")
    x("ALTER TABLE co_manufacturing_order ADD COLUMN IF NOT EXISTS ref_doc_id UUID")
    x(
        "ALTER TABLE co_manufacturing_order ADD COLUMN IF NOT EXISTS standard_cost_version_id UUID "
        "REFERENCES co_product_cost_version(id) ON DELETE SET NULL"
    )
    x("CREATE INDEX IF NOT EXISTS ix_co_mo_ref_doc ON co_manufacturing_order(vendor_id, ref_doc_type, ref_doc_id)")

    x("""CREATE TABLE IF NOT EXISTS co_order_operation (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID NOT NULL REFERENCES co_manufacturing_order(id) ON DELETE CASCADE,
        sequence INTEGER NOT NULL DEFAULT 0,
        operation_code VARCHAR(30),
        name VARCHAR(200) NOT NULL DEFAULT 'Operation',
        activity_type_id UUID REFERENCES co_activity_type(id) ON DELETE SET NULL,
        work_center_id UUID REFERENCES fin_cost_center(id) ON DELETE SET NULL,
        planned_qty NUMERIC(18,4) DEFAULT 0,
        confirmed_qty NUMERIC(18,4) DEFAULT 0,
        scrap_qty NUMERIC(18,4) DEFAULT 0,
        planned_hours NUMERIC(18,6) DEFAULT 0,
        actual_hours NUMERIC(18,6) DEFAULT 0,
        planned_rate NUMERIC(18,6) DEFAULT 0,
        actual_rate NUMERIC(18,6) DEFAULT 0,
        status VARCHAR(20) DEFAULT 'pending',
        source VARCHAR(20) DEFAULT 'manual',
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
    )""")
    x("CREATE INDEX IF NOT EXISTS ix_co_oo_order_seq ON co_order_operation(order_id, sequence)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS co_order_operation CASCADE")
    op.execute("DROP INDEX IF EXISTS ix_co_mo_ref_doc")
    op.execute("ALTER TABLE co_manufacturing_order DROP COLUMN IF EXISTS standard_cost_version_id")
    op.execute("ALTER TABLE co_manufacturing_order DROP COLUMN IF EXISTS ref_doc_id")
    op.execute("ALTER TABLE co_manufacturing_order DROP COLUMN IF EXISTS ref_doc_type")
    op.execute("ALTER TABLE co_manufacturing_order DROP COLUMN IF EXISTS priority")
    op.execute("ALTER TABLE co_manufacturing_order DROP COLUMN IF EXISTS title")
