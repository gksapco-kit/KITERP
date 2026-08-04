"""Add optional purchase_order_id to consignment_stock.

Revision ID: proc001_cs_po_ref
Revises: car003_career_admin_note
Create Date: 2026-08-04
"""
from alembic import op

revision = "proc001_cs_po_ref"
down_revision = "car003_career_admin_note"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE consignment_stock ADD COLUMN IF NOT EXISTS purchase_order_id UUID"
    )
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'fk_consignment_stock_purchase_order_id'
            ) THEN
                ALTER TABLE consignment_stock
                ADD CONSTRAINT fk_consignment_stock_purchase_order_id
                FOREIGN KEY (purchase_order_id) REFERENCES purchase_order(id) ON DELETE SET NULL;
            END IF;
        END $$;
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_cs_po ON consignment_stock (purchase_order_id)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_cs_po")
    op.execute(
        "ALTER TABLE consignment_stock DROP CONSTRAINT IF EXISTS fk_consignment_stock_purchase_order_id"
    )
    op.execute("ALTER TABLE consignment_stock DROP COLUMN IF EXISTS purchase_order_id")
