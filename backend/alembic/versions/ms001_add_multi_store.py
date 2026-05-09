"""add multi-store tables and columns

Revision ID: ms001_add_multi_store
Revises: ee1ff2gg3hh4
Create Date: 2026-04-15

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = 'ms001_add_multi_store'
down_revision = 'ee1ff2gg3hh4'
branch_labels = None
depends_on = None


def upgrade():
    # ── 1. store table ────────────────────────────────────────────
    op.create_table(
        'store',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('vendor_id', UUID(as_uuid=True), sa.ForeignKey('vendor.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('code', sa.String(50)),
        sa.Column('description', sa.Text()),
        sa.Column('phone', sa.String(20)),
        sa.Column('email', sa.String(255)),
        sa.Column('address', JSONB, server_default='{}'),
        sa.Column('manager_id', UUID(as_uuid=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('is_default', sa.Boolean(), server_default='false'),
        sa.Column('settings', JSONB, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('idx_store_vendor', 'store', ['vendor_id'])

    # ── 2. Add store_id to vendor_user ────────────────────────────
    op.add_column('vendor_user', sa.Column('store_id', UUID(as_uuid=True), nullable=True))
    op.create_index('idx_vendor_user_store', 'vendor_user', ['store_id'])

    # ── 3. FK from store.manager_id → vendor_user.id ──────────────
    op.create_foreign_key('fk_store_manager', 'store', 'vendor_user', ['manager_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key('fk_vendor_user_store', 'vendor_user', 'store', ['store_id'], ['id'], ondelete='SET NULL')

    # ── 4. store_inventory table ──────────────────────────────────
    op.create_table(
        'store_inventory',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('store_id', UUID(as_uuid=True), sa.ForeignKey('store.id', ondelete='CASCADE'), nullable=False),
        sa.Column('vendor_id', UUID(as_uuid=True), sa.ForeignKey('vendor.id', ondelete='CASCADE'), nullable=False),
        sa.Column('product_id', UUID(as_uuid=True), sa.ForeignKey('product.id', ondelete='CASCADE'), nullable=False),
        sa.Column('variant_id', UUID(as_uuid=True), sa.ForeignKey('product_variant.id', ondelete='CASCADE'), nullable=True),
        sa.Column('quantity', sa.Integer(), server_default='0'),
        sa.Column('low_stock_threshold', sa.Integer(), server_default='5'),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('idx_store_inv_store', 'store_inventory', ['store_id'])
    op.create_index('idx_store_inv_product', 'store_inventory', ['store_id', 'product_id'])

    # ── 5. Add store columns to inventory_movement ────────────────
    op.add_column('inventory_movement', sa.Column('store_id', UUID(as_uuid=True), sa.ForeignKey('store.id', ondelete='SET NULL'), nullable=True))
    op.add_column('inventory_movement', sa.Column('to_store_id', UUID(as_uuid=True), sa.ForeignKey('store.id', ondelete='SET NULL'), nullable=True))


def downgrade():
    op.drop_column('inventory_movement', 'to_store_id')
    op.drop_column('inventory_movement', 'store_id')
    op.drop_table('store_inventory')
    op.drop_constraint('fk_vendor_user_store', 'vendor_user', type_='foreignkey')
    op.drop_constraint('fk_store_manager', 'store', type_='foreignkey')
    op.drop_index('idx_vendor_user_store', table_name='vendor_user')
    op.drop_column('vendor_user', 'store_id')
    op.drop_index('idx_store_vendor', table_name='store')
    op.drop_table('store')
