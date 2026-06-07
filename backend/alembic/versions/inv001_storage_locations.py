"""storage locations per business unit

Revision ID: inv001_storage_locations
Revises: cat002_catalog_store_scope
Create Date: 2026-06-06

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = 'inv001_storage_locations'
down_revision = 'cat002_catalog_store_scope'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'storage_location',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('vendor_id', UUID(as_uuid=True), sa.ForeignKey('vendor.id', ondelete='CASCADE'), nullable=False),
        sa.Column('store_id', UUID(as_uuid=True), sa.ForeignKey('store.id', ondelete='CASCADE'), nullable=False),
        sa.Column('parent_id', UUID(as_uuid=True), sa.ForeignKey('storage_location.id', ondelete='CASCADE'), nullable=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('code', sa.String(50), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('sort_order', sa.Integer(), server_default='0', nullable=False),
        sa.Column('custom_fields', JSONB(), server_default='[]', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('idx_storage_location_vendor', 'storage_location', ['vendor_id'])
    op.create_index('idx_storage_location_store', 'storage_location', ['vendor_id', 'store_id'])
    op.create_index('idx_storage_location_parent', 'storage_location', ['vendor_id', 'store_id', 'parent_id'])
    op.create_index('idx_storage_location_store_code', 'storage_location', ['store_id', 'code'], unique=True)


def downgrade():
    op.drop_index('idx_storage_location_store_code', table_name='storage_location')
    op.drop_index('idx_storage_location_parent', table_name='storage_location')
    op.drop_index('idx_storage_location_store', table_name='storage_location')
    op.drop_index('idx_storage_location_vendor', table_name='storage_location')
    op.drop_table('storage_location')
