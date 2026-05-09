"""add_procurement_tables

Revision ID: b197344ca7b8
Revises: 754f17487775
Create Date: 2026-03-15 23:42:46.274163

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'b197344ca7b8'
down_revision: Union[str, None] = '754f17487775'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('supplier',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('vendor_id', sa.UUID(), nullable=False),
    sa.Column('name', sa.String(length=255), nullable=False),
    sa.Column('contact_name', sa.String(length=255), nullable=True),
    sa.Column('email', sa.String(length=255), nullable=True),
    sa.Column('phone', sa.String(length=30), nullable=True),
    sa.Column('address', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('notes', sa.Text(), nullable=True),
    sa.Column('is_active', sa.Boolean(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.ForeignKeyConstraint(['vendor_id'], ['vendor.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_supplier_vendor', 'supplier', ['vendor_id'], unique=False)
    op.create_index('ix_supplier_vendor_name', 'supplier', ['vendor_id', 'name'], unique=False)

    op.create_table('purchase_order',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('vendor_id', sa.UUID(), nullable=False),
    sa.Column('supplier_id', sa.UUID(), nullable=False),
    sa.Column('po_number', sa.String(length=20), nullable=False),
    sa.Column('status', sa.String(length=30), nullable=False),
    sa.Column('order_date', sa.Date(), nullable=True),
    sa.Column('expected_delivery_date', sa.Date(), nullable=True),
    sa.Column('notes', sa.Text(), nullable=True),
    sa.Column('subtotal', sa.Numeric(precision=12, scale=2), nullable=False),
    sa.Column('tax_amount', sa.Numeric(precision=12, scale=2), nullable=True),
    sa.Column('total', sa.Numeric(precision=12, scale=2), nullable=False),
    sa.Column('created_by', sa.UUID(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.Column('received_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('closed_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['created_by'], ['user.id'], ),
    sa.ForeignKeyConstraint(['supplier_id'], ['supplier.id'], ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['vendor_id'], ['vendor.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_po_supplier', 'purchase_order', ['supplier_id'], unique=False)
    op.create_index('ix_po_vendor', 'purchase_order', ['vendor_id'], unique=False)
    op.create_index('ix_po_vendor_status', 'purchase_order', ['vendor_id', 'status'], unique=False)
    op.create_index('uq_po_vendor_number', 'purchase_order', ['vendor_id', 'po_number'], unique=True)

    op.create_table('purchase_order_item',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('purchase_order_id', sa.UUID(), nullable=False),
    sa.Column('product_id', sa.UUID(), nullable=False),
    sa.Column('variant_id', sa.UUID(), nullable=True),
    sa.Column('quantity_ordered', sa.Integer(), nullable=False),
    sa.Column('quantity_received', sa.Integer(), nullable=False),
    sa.Column('unit_cost', sa.Numeric(precision=12, scale=2), nullable=False),
    sa.Column('total_cost', sa.Numeric(precision=12, scale=2), nullable=False),
    sa.Column('notes', sa.Text(), nullable=True),
    sa.ForeignKeyConstraint(['product_id'], ['product.id'], ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['purchase_order_id'], ['purchase_order.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['variant_id'], ['product_variant.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_poi_po', 'purchase_order_item', ['purchase_order_id'], unique=False)
    op.create_index('ix_poi_product', 'purchase_order_item', ['product_id'], unique=False)

    op.create_table('purchase_order_receipt',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('purchase_order_id', sa.UUID(), nullable=False),
    sa.Column('received_by', sa.UUID(), nullable=True),
    sa.Column('received_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.Column('notes', sa.Text(), nullable=True),
    sa.Column('items', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.ForeignKeyConstraint(['purchase_order_id'], ['purchase_order.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['received_by'], ['user.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_por_po', 'purchase_order_receipt', ['purchase_order_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_por_po', table_name='purchase_order_receipt')
    op.drop_table('purchase_order_receipt')
    op.drop_index('ix_poi_product', table_name='purchase_order_item')
    op.drop_index('ix_poi_po', table_name='purchase_order_item')
    op.drop_table('purchase_order_item')
    op.drop_index('uq_po_vendor_number', table_name='purchase_order')
    op.drop_index('ix_po_vendor_status', table_name='purchase_order')
    op.drop_index('ix_po_vendor', table_name='purchase_order')
    op.drop_index('ix_po_supplier', table_name='purchase_order')
    op.drop_table('purchase_order')
    op.drop_index('ix_supplier_vendor_name', table_name='supplier')
    op.drop_index('ix_supplier_vendor', table_name='supplier')
    op.drop_table('supplier')
