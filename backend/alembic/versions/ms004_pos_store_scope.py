"""per-business-unit POS: pos_session.store_id + seed store_inventory from product stock

Revision ID: ms004_pos_store_scope
Revises: ms003_txn_store_id
Create Date: 2026-06-18

Makes the POS business-unit aware:
  * pos_session gets a store_id (one open register per vendor+store), backfilled
    to each vendor's default (or oldest active) store.
  * store_inventory becomes the source of truth for POS stock. Existing
    product / variant quantities are seeded into the vendor's default store so
    no stock is lost when POS starts deducting per-store.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = 'ms004_pos_store_scope'
down_revision = 'ms003_txn_store_id'
branch_labels = None
depends_on = None


# Default store per vendor (is_default first, then oldest active).
_DEFAULT_STORE = """
SELECT DISTINCT ON (s.vendor_id) s.vendor_id, s.id AS store_id
FROM store s
WHERE s.is_active = true
ORDER BY s.vendor_id, s.is_default DESC, s.created_at ASC
"""

_BACKFILL_SESSION = f"""
UPDATE pos_session AS t
SET store_id = sub.store_id
FROM ({_DEFAULT_STORE}) AS sub
WHERE t.vendor_id = sub.vendor_id AND t.store_id IS NULL;
"""

# Seed product-level rows only for products WITHOUT active variants (variant
# products are seeded at the variant level below) to avoid double counting.
_SEED_PRODUCTS = f"""
INSERT INTO store_inventory (id, store_id, vendor_id, product_id, variant_id, quantity, low_stock_threshold, updated_at)
SELECT gen_random_uuid(), ds.store_id, p.vendor_id, p.id, NULL, COALESCE(p.quantity, 0), 5, now()
FROM product p
JOIN ({_DEFAULT_STORE}) ds ON ds.vendor_id = p.vendor_id
WHERE p.track_inventory = true
  AND NOT EXISTS (
    SELECT 1 FROM product_variant v2 WHERE v2.product_id = p.id AND v2.is_active = true
  )
  AND NOT EXISTS (
    SELECT 1 FROM store_inventory si
    WHERE si.product_id = p.id AND si.store_id = ds.store_id
      AND si.variant_id IS NULL AND si.storage_location_id IS NULL
  );
"""

_SEED_VARIANTS = f"""
INSERT INTO store_inventory (id, store_id, vendor_id, product_id, variant_id, quantity, low_stock_threshold, updated_at)
SELECT gen_random_uuid(), ds.store_id, p.vendor_id, p.id, v.id, COALESCE(v.quantity, 0), 5, now()
FROM product_variant v
JOIN product p ON p.id = v.product_id
JOIN ({_DEFAULT_STORE}) ds ON ds.vendor_id = p.vendor_id
WHERE p.track_inventory = true AND v.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM store_inventory si
    WHERE si.product_id = p.id AND si.store_id = ds.store_id
      AND si.variant_id = v.id AND si.storage_location_id IS NULL
  );
"""


def upgrade():
    op.add_column('pos_session', sa.Column('store_id', UUID(as_uuid=True), nullable=True))
    op.create_foreign_key('fk_pos_session_store', 'pos_session', 'store', ['store_id'], ['id'], ondelete='SET NULL')
    op.create_index('ix_pos_session_vendor_store_status', 'pos_session', ['vendor_id', 'store_id', 'status'])

    op.execute(_BACKFILL_SESSION)
    op.execute(_SEED_PRODUCTS)
    op.execute(_SEED_VARIANTS)


def downgrade():
    op.drop_index('ix_pos_session_vendor_store_status', table_name='pos_session')
    op.drop_constraint('fk_pos_session_store', 'pos_session', type_='foreignkey')
    op.drop_column('pos_session', 'store_id')
    # store_inventory seed rows are left in place (non-destructive).
