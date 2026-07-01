"""production routing: work centers + operation steps for production orders

Revision ID: ms009_production_routing
Revises: ms008_production_materials
Create Date: 2026-07-01

Adds:
  work_center          — machine/workstation/crew that performs operations,
                          with a per-hour cost rate for labor costing roll-up.
  production_operation — ordered routing steps belonging to a production_order,
                          each optionally run at a work_center, tracking
                          planned vs actual hours and start/completion times.

Both tables are vendor-scoped only (no dependency on a finance company),
matching the existing lightweight scoping of production_order/stock_reservation.

Idempotent: safe to re-run; mirrors app.database.ensure_production_routing_tables.
"""
from alembic import op
import sqlalchemy as sa

revision = 'ms009_production_routing'
down_revision = 'ms008_production_materials'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    op.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS work_center (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            plant_id UUID REFERENCES plant(id) ON DELETE SET NULL,
            code VARCHAR(50) NOT NULL,
            name VARCHAR(200) NOT NULL,
            description TEXT,
            capacity_per_day NUMERIC(10,2),
            cost_per_hour NUMERIC(12,2) NOT NULL DEFAULT 0,
            is_active BOOLEAN DEFAULT TRUE,
            sort_order INTEGER DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now(),
            CONSTRAINT uq_work_center_vendor_code UNIQUE (vendor_id, code)
        );
    """))
    op.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_work_center_vendor ON work_center (vendor_id)"))
    op.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_work_center_plant ON work_center (vendor_id, plant_id)"))

    op.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS production_operation (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            production_order_id UUID NOT NULL REFERENCES production_order(id) ON DELETE CASCADE,
            work_center_id UUID REFERENCES work_center(id) ON DELETE SET NULL,
            sequence INTEGER NOT NULL DEFAULT 0,
            name VARCHAR(200) NOT NULL DEFAULT 'Operation',
            status VARCHAR(20) NOT NULL DEFAULT 'pending',
            planned_hours NUMERIC(10,2) DEFAULT 0,
            actual_hours NUMERIC(10,2),
            planned_start TIMESTAMPTZ,
            planned_end TIMESTAMPTZ,
            started_at TIMESTAMPTZ,
            completed_at TIMESTAMPTZ,
            notes TEXT,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        );
    """))
    op.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS idx_prod_op_order_seq ON production_operation (production_order_id, sequence)"
    ))
    op.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_prod_op_vendor ON production_operation (vendor_id)"))
    op.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_prod_op_work_center ON production_operation (work_center_id)"))


def downgrade():
    op.execute(sa.text("DROP TABLE IF EXISTS production_operation"))
    op.execute(sa.text("DROP TABLE IF EXISTS work_center"))
