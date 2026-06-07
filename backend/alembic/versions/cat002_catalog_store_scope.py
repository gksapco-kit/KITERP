"""catalog store scope for products and services

Revision ID: cat002_catalog_store_scope
Revises: crm004_contact_merge
Create Date: 2026-06-06

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = 'cat002_catalog_store_scope'
down_revision = 'crm004_contact_merge'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('product', sa.Column('store_scope', sa.String(20), server_default='all', nullable=False))
    op.add_column('service', sa.Column('store_scope', sa.String(20), server_default='all', nullable=False))

    op.create_table(
        'product_store',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('vendor_id', UUID(as_uuid=True), sa.ForeignKey('vendor.id', ondelete='CASCADE'), nullable=False),
        sa.Column('product_id', UUID(as_uuid=True), sa.ForeignKey('product.id', ondelete='CASCADE'), nullable=False),
        sa.Column('store_id', UUID(as_uuid=True), sa.ForeignKey('store.id', ondelete='CASCADE'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.UniqueConstraint('product_id', 'store_id', name='uq_product_store'),
    )
    op.create_index('idx_product_store_product', 'product_store', ['product_id'])
    op.create_index('idx_product_store_store', 'product_store', ['store_id'])

    op.create_table(
        'service_store',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('vendor_id', UUID(as_uuid=True), sa.ForeignKey('vendor.id', ondelete='CASCADE'), nullable=False),
        sa.Column('service_id', UUID(as_uuid=True), sa.ForeignKey('service.id', ondelete='CASCADE'), nullable=False),
        sa.Column('store_id', UUID(as_uuid=True), sa.ForeignKey('store.id', ondelete='CASCADE'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.UniqueConstraint('service_id', 'store_id', name='uq_service_store'),
    )
    op.create_index('idx_service_store_service', 'service_store', ['service_id'])
    op.create_index('idx_service_store_store', 'service_store', ['store_id'])


def downgrade():
    op.drop_index('idx_service_store_store', table_name='service_store')
    op.drop_index('idx_service_store_service', table_name='service_store')
    op.drop_table('service_store')
    op.drop_index('idx_product_store_store', table_name='product_store')
    op.drop_index('idx_product_store_product', table_name='product_store')
    op.drop_table('product_store')
    op.drop_column('service', 'store_scope')
    op.drop_column('product', 'store_scope')
