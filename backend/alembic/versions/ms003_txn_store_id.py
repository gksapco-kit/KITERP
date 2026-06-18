"""add store_id to order, pos_transaction, invoice, booking (+ backfill to default store)

Revision ID: ms003_txn_store_id
Revises: cat003_category_image
Create Date: 2026-06-18

Attributes transactional records (orders, POS sales, invoices, bookings) to a
business unit so dashboard / reports can be scoped per store or across all units.
Existing rows are backfilled to each vendor's default (or oldest active) store.

Idempotent: safe when app.database.ensure_txn_store_id_columns already ran.
"""
from alembic import op
import sqlalchemy as sa

revision = 'ms003_txn_store_id'
down_revision = 'cat003_category_image'
branch_labels = None
depends_on = None


# Picks the default store per vendor (is_default first, then oldest active).
_BACKFILL = """
UPDATE {table} AS t
SET store_id = sub.store_id
FROM (
    SELECT DISTINCT ON (s.vendor_id) s.vendor_id, s.id AS store_id
    FROM store s
    WHERE s.is_active = true
    ORDER BY s.vendor_id, s.is_default DESC, s.created_at ASC
) AS sub
WHERE t.vendor_id = sub.vendor_id AND t.store_id IS NULL;
"""


def upgrade():
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    column_stmts = [
        'ALTER TABLE "order" ADD COLUMN IF NOT EXISTS store_id UUID',
        "ALTER TABLE pos_transaction ADD COLUMN IF NOT EXISTS store_id UUID",
        "ALTER TABLE invoice ADD COLUMN IF NOT EXISTS store_id UUID",
        "ALTER TABLE booking ADD COLUMN IF NOT EXISTS store_id UUID",
    ]
    for stmt in column_stmts:
        op.execute(sa.text(stmt))

    fk_specs = (
        ("fk_order_store", '"order"', "store_id"),
        ("fk_pos_txn_store", "pos_transaction", "store_id"),
        ("fk_invoice_store", "invoice", "store_id"),
        ("fk_booking_store", "booking", "store_id"),
    )
    for fk_name, table, column in fk_specs:
        op.execute(
            sa.text(
                f"""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = '{fk_name}'
                    ) THEN
                        ALTER TABLE {table}
                        ADD CONSTRAINT {fk_name}
                        FOREIGN KEY ({column}) REFERENCES store(id) ON DELETE SET NULL;
                    END IF;
                END $$;
                """
            )
        )

    index_stmts = [
        'CREATE INDEX IF NOT EXISTS ix_order_vendor_store ON "order" (vendor_id, store_id)',
        "CREATE INDEX IF NOT EXISTS ix_pos_txn_vendor_store ON pos_transaction (vendor_id, store_id)",
        "CREATE INDEX IF NOT EXISTS ix_invoice_vendor_store ON invoice (vendor_id, store_id)",
        "CREATE INDEX IF NOT EXISTS ix_booking_vendor_store ON booking (vendor_id, store_id)",
    ]
    for stmt in index_stmts:
        op.execute(sa.text(stmt))

    for table in ('"order"', "pos_transaction", "invoice", "booking"):
        op.execute(sa.text(_BACKFILL.format(table=table)))


def downgrade():
    op.drop_index('ix_booking_vendor_store', table_name='booking')
    op.drop_index('ix_invoice_vendor_store', table_name='invoice')
    op.drop_index('ix_pos_txn_vendor_store', table_name='pos_transaction')
    op.drop_index('ix_order_vendor_store', table_name='order')

    op.drop_constraint('fk_booking_store', 'booking', type_='foreignkey')
    op.drop_constraint('fk_invoice_store', 'invoice', type_='foreignkey')
    op.drop_constraint('fk_pos_txn_store', 'pos_transaction', type_='foreignkey')
    op.drop_constraint('fk_order_store', 'order', type_='foreignkey')

    op.drop_column('booking', 'store_id')
    op.drop_column('invoice', 'store_id')
    op.drop_column('pos_transaction', 'store_id')
    op.drop_column('order', 'store_id')
