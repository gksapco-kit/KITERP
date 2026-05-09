"""Sales Commission — add primary_payee_id to orders, pos_transactions, bookings.

Revision ID: comm002_sale_payee_columns
Revises: comm001_commission_core
Create Date: 2026-04-22
"""

revision = "comm002_sale_payee_columns"
down_revision = "comm001_commission_core"
branch_labels = None
depends_on = None

from alembic import op


def upgrade() -> None:
    op.execute("""
        ALTER TABLE "order"
            ADD COLUMN IF NOT EXISTS primary_payee_id UUID
                REFERENCES commission_payee(id) ON DELETE SET NULL;
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_order_payee
            ON "order"(primary_payee_id)
            WHERE primary_payee_id IS NOT NULL;
    """)

    op.execute("""
        ALTER TABLE pos_transaction
            ADD COLUMN IF NOT EXISTS primary_payee_id UUID
                REFERENCES commission_payee(id) ON DELETE SET NULL;
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_pos_txn_payee
            ON pos_transaction(primary_payee_id)
            WHERE primary_payee_id IS NOT NULL;
    """)

    op.execute("""
        ALTER TABLE booking
            ADD COLUMN IF NOT EXISTS primary_payee_id UUID
                REFERENCES commission_payee(id) ON DELETE SET NULL;
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_booking_payee
            ON booking(primary_payee_id)
            WHERE primary_payee_id IS NOT NULL;
    """)


def downgrade() -> None:
    op.execute('DROP INDEX IF EXISTS idx_order_payee')
    op.execute('ALTER TABLE "order" DROP COLUMN IF EXISTS primary_payee_id')

    op.execute('DROP INDEX IF EXISTS idx_pos_txn_payee')
    op.execute('ALTER TABLE pos_transaction DROP COLUMN IF EXISTS primary_payee_id')

    op.execute('DROP INDEX IF EXISTS idx_booking_payee')
    op.execute('ALTER TABLE booking DROP COLUMN IF EXISTS primary_payee_id')
