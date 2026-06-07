"""Per-bin inventory: storage_location_id on store_inventory and inventory_movement

Revision ID: inv002_storage_location_inventory
Revises: inv001_storage_locations
Create Date: 2026-06-06

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = 'inv002_storage_location_inventory'
down_revision = 'inv001_storage_locations'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'store_inventory',
        sa.Column('storage_location_id', UUID(as_uuid=True), sa.ForeignKey('storage_location.id', ondelete='SET NULL'), nullable=True),
    )
    op.add_column(
        'inventory_movement',
        sa.Column('storage_location_id', UUID(as_uuid=True), sa.ForeignKey('storage_location.id', ondelete='SET NULL'), nullable=True),
    )
    op.add_column(
        'inventory_movement',
        sa.Column('to_storage_location_id', UUID(as_uuid=True), sa.ForeignKey('storage_location.id', ondelete='SET NULL'), nullable=True),
    )
    op.create_index('idx_store_inv_location', 'store_inventory', ['store_id', 'storage_location_id'])
    op.create_index('idx_inv_storage_location', 'inventory_movement', ['storage_location_id'])


def downgrade():
    op.drop_index('idx_inv_storage_location', table_name='inventory_movement')
    op.drop_index('idx_store_inv_location', table_name='store_inventory')
    op.drop_column('inventory_movement', 'to_storage_location_id')
    op.drop_column('inventory_movement', 'storage_location_id')
    op.drop_column('store_inventory', 'storage_location_id')
