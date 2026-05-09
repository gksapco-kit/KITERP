"""cat002 create review table

Revision ID: cat002
Revises: cat001
Create Date: 2026-04-24

Creates the review table for product/service ratings.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = 'cat002'
down_revision = 'cat001'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'review',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('vendor_id', UUID(as_uuid=True), sa.ForeignKey('vendor.id', ondelete='CASCADE'), nullable=False),
        sa.Column('customer_id', UUID(as_uuid=True), sa.ForeignKey('customer.id', ondelete='CASCADE'), nullable=False),
        sa.Column('review_type', sa.String(20), nullable=False),
        sa.Column('product_id', UUID(as_uuid=True), sa.ForeignKey('product.id', ondelete='CASCADE'), nullable=True),
        sa.Column('service_id', UUID(as_uuid=True), sa.ForeignKey('service.id', ondelete='CASCADE'), nullable=True),
        sa.Column('order_id', UUID(as_uuid=True), sa.ForeignKey('order.id', ondelete='SET NULL'), nullable=True),
        sa.Column('rating', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(255)),
        sa.Column('comment', sa.Text()),
        sa.Column('reply', sa.Text()),
        sa.Column('replied_at', sa.DateTime(timezone=True)),
        sa.Column('is_verified_purchase', sa.Boolean(), default=False),
        sa.Column('is_visible', sa.Boolean(), default=True),
        sa.Column('is_flagged', sa.Boolean(), default=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint('rating >= 1 AND rating <= 5', name='ck_review_rating_range'),
    )
    op.create_index('ix_review_vendor', 'review', ['vendor_id'])
    op.create_index('ix_review_product', 'review', ['product_id'])
    op.create_index('ix_review_service', 'review', ['service_id'])
    op.create_index('ix_review_customer', 'review', ['customer_id'])
    op.create_index('ix_review_type_target', 'review', ['review_type', 'product_id', 'service_id'])


def downgrade():
    op.drop_index('ix_review_type_target', table_name='review')
    op.drop_index('ix_review_customer', table_name='review')
    op.drop_index('ix_review_service', table_name='review')
    op.drop_index('ix_review_product', table_name='review')
    op.drop_index('ix_review_vendor', table_name='review')
    op.drop_table('review')
