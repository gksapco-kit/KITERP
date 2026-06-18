"""add store_id to order, pos_transaction, invoice (+ backfill to default store)

Revision ID: ms003_txn_store_id
Revises: cat003_category_image
Create Date: 2026-06-18

Attributes transactional records (orders, POS sales, invoices) to a business
unit so dashboard / reports can be scoped per store or across all units.
Existing rows are backfilled to each vendor's default (or oldest active) store.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

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
    op.add_column('order', sa.Column('store_id', UUID(as_uuid=True), nullable=True))
    op.add_column('pos_transaction', sa.Column('store_id', UUID(as_uuid=True), nullable=True))
    op.add_column('invoice', sa.Column('store_id', UUID(as_uuid=True), nullable=True))

    op.create_foreign_key('fk_order_store', 'order', 'store', ['store_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key('fk_pos_txn_store', 'pos_transaction', 'store', ['store_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key('fk_invoice_store', 'invoice', 'store', ['store_id'], ['id'], ondelete='SET NULL')

    op.create_index('ix_order_vendor_store', 'order', ['vendor_id', 'store_id'])
    op.create_index('ix_pos_txn_vendor_store', 'pos_transaction', ['vendor_id', 'store_id'])
    op.create_index('ix_invoice_vendor_store', 'invoice', ['vendor_id', 'store_id'])

    # Backfill existing rows to the vendor's default store.
    op.execute(_BACKFILL.format(table='"order"'))
    op.execute(_BACKFILL.format(table='pos_transaction'))
    op.execute(_BACKFILL.format(table='invoice'))


def downgrade():
    op.drop_index('ix_invoice_vendor_store', table_name='invoice')
    op.drop_index('ix_pos_txn_vendor_store', table_name='pos_transaction')
    op.drop_index('ix_order_vendor_store', table_name='order')

    op.drop_constraint('fk_invoice_store', 'invoice', type_='foreignkey')
    op.drop_constraint('fk_pos_txn_store', 'pos_transaction', type_='foreignkey')
    op.drop_constraint('fk_order_store', 'order', type_='foreignkey')

    op.drop_column('invoice', 'store_id')
    op.drop_column('pos_transaction', 'store_id')
    op.drop_column('order', 'store_id')
