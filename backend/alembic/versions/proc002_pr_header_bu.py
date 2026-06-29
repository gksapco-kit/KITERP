"""PR header: business unit, supplier/internal, cross-BU scope

Revision ID: proc002_pr_header_bu
Revises: proc001_full_procurement
Create Date: 2026-06-29
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = 'proc002_pr_header_bu'
down_revision = 'proc001_full_procurement'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('purchase_requisition', sa.Column('store_id', UUID(as_uuid=True), sa.ForeignKey('store.id', ondelete='SET NULL'), nullable=True))
    op.add_column('purchase_requisition', sa.Column('procurement_source', sa.String(20), server_default='supplier', nullable=False))
    op.add_column('purchase_requisition', sa.Column('bu_scope', sa.String(20), nullable=True))
    op.add_column('purchase_requisition', sa.Column('from_store_id', UUID(as_uuid=True), sa.ForeignKey('store.id', ondelete='SET NULL'), nullable=True))
    op.add_column('purchase_requisition', sa.Column('to_store_id', UUID(as_uuid=True), sa.ForeignKey('store.id', ondelete='SET NULL'), nullable=True))
    op.add_column('purchase_requisition', sa.Column('header_supplier_id', UUID(as_uuid=True), sa.ForeignKey('supplier.id', ondelete='SET NULL'), nullable=True))
    op.create_index('ix_pr_store', 'purchase_requisition', ['store_id'])


def downgrade():
    op.drop_index('ix_pr_store', table_name='purchase_requisition')
    op.drop_column('purchase_requisition', 'header_supplier_id')
    op.drop_column('purchase_requisition', 'to_store_id')
    op.drop_column('purchase_requisition', 'from_store_id')
    op.drop_column('purchase_requisition', 'bu_scope')
    op.drop_column('purchase_requisition', 'procurement_source')
    op.drop_column('purchase_requisition', 'store_id')
