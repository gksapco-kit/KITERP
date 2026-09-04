"""Procurement Phase 9: Purchase Return document

Revision ID: proc009_purchase_return
Revises: proc008_invoice_completion
Create Date: 2026-09-01

Creates:
  purchase_return       – return header
  purchase_return_line  – per-product line
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = 'proc009_purchase_return'
down_revision = 'proc008_invoice_completion'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'purchase_return',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('vendor_id', UUID(as_uuid=True),
                  sa.ForeignKey('vendor.id', ondelete='CASCADE'), nullable=False),
        sa.Column('return_number', sa.String(30), nullable=False),
        sa.Column('status', sa.String(30), nullable=False, server_default='draft'),
        sa.Column('purchase_order_id', UUID(as_uuid=True),
                  sa.ForeignKey('purchase_order.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('grn_id', UUID(as_uuid=True),
                  sa.ForeignKey('grn.id', ondelete='SET NULL'), nullable=True),
        sa.Column('supplier_id', UUID(as_uuid=True),
                  sa.ForeignKey('supplier.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('return_date', sa.Date, nullable=False),
        sa.Column('return_reason', sa.String(50), nullable=False, server_default='quality_rejection'),
        sa.Column('supplier_return_authorization', sa.String(100), nullable=True),
        sa.Column('debit_note_reference', sa.String(100), nullable=True),
        sa.Column('currency', sa.String(3), nullable=False, server_default='INR'),
        sa.Column('subtotal', sa.Numeric(14, 2), server_default='0'),
        sa.Column('tax_amount', sa.Numeric(14, 2), server_default='0'),
        sa.Column('total', sa.Numeric(14, 2), server_default='0'),
        sa.Column('journal_entry_id', UUID(as_uuid=True),
                  sa.ForeignKey('fin_journal_entry.id', ondelete='SET NULL'), nullable=True),
        sa.Column('dispatched_via', sa.String(100), nullable=True),
        sa.Column('dispatch_date', sa.Date, nullable=True),
        sa.Column('tracking_number', sa.String(100), nullable=True),
        sa.Column('notes', sa.Text, nullable=True),
        sa.Column('audit_log', JSONB, server_default='[]'),
        sa.Column('approved_by', UUID(as_uuid=True),
                  sa.ForeignKey('vendor_user.id', ondelete='SET NULL'), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by', UUID(as_uuid=True),
                  sa.ForeignKey('vendor_user.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('vendor_id', 'return_number', name='uq_pret_vendor_number'),
    )
    op.create_index('ix_pret_vendor', 'purchase_return', ['vendor_id'])
    op.create_index('ix_pret_po', 'purchase_return', ['purchase_order_id'])
    op.create_index('ix_pret_status', 'purchase_return', ['vendor_id', 'status'])
    op.create_index('ix_pret_supplier', 'purchase_return', ['vendor_id', 'supplier_id'])

    op.create_table(
        'purchase_return_line',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('purchase_return_id', UUID(as_uuid=True),
                  sa.ForeignKey('purchase_return.id', ondelete='CASCADE'), nullable=False),
        sa.Column('grn_line_id', UUID(as_uuid=True),
                  sa.ForeignKey('grn_line.id', ondelete='SET NULL'), nullable=True),
        sa.Column('po_item_id', UUID(as_uuid=True),
                  sa.ForeignKey('purchase_order_item.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('product_id', UUID(as_uuid=True),
                  sa.ForeignKey('product.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('variant_id', UUID(as_uuid=True),
                  sa.ForeignKey('product_variant.id', ondelete='SET NULL'), nullable=True),
        sa.Column('batch_number', sa.String(100), nullable=True),
        sa.Column('serial_number', sa.String(100), nullable=True),
        sa.Column('line_number', sa.Integer, server_default='1', nullable=False),
        sa.Column('unit_of_measure', sa.String(20), nullable=False, server_default='piece'),
        sa.Column('return_qty', sa.Numeric(12, 4), nullable=False),
        sa.Column('unit_price', sa.Numeric(14, 4), nullable=False, server_default='0'),
        sa.Column('cgst_rate', sa.Numeric(6, 2), server_default='0'),
        sa.Column('sgst_rate', sa.Numeric(6, 2), server_default='0'),
        sa.Column('igst_rate', sa.Numeric(6, 2), server_default='0'),
        sa.Column('cgst_amount', sa.Numeric(12, 2), server_default='0'),
        sa.Column('sgst_amount', sa.Numeric(12, 2), server_default='0'),
        sa.Column('igst_amount', sa.Numeric(12, 2), server_default='0'),
        sa.Column('subtotal', sa.Numeric(14, 2), nullable=False, server_default='0'),
        sa.Column('tax_total', sa.Numeric(14, 2), server_default='0'),
        sa.Column('total', sa.Numeric(14, 2), nullable=False, server_default='0'),
        sa.Column('plant_id', UUID(as_uuid=True),
                  sa.ForeignKey('plant.id', ondelete='SET NULL'), nullable=True),
        sa.Column('storage_location_id', UUID(as_uuid=True),
                  sa.ForeignKey('storage_location.id', ondelete='SET NULL'), nullable=True),
        sa.Column('reason', sa.Text, nullable=True),
    )
    op.create_index('ix_pret_line_return', 'purchase_return_line', ['purchase_return_id'])
    op.create_index('ix_pret_line_product', 'purchase_return_line', ['product_id'])


def downgrade():
    op.drop_index('ix_pret_line_product', table_name='purchase_return_line')
    op.drop_index('ix_pret_line_return', table_name='purchase_return_line')
    op.drop_table('purchase_return_line')

    op.drop_index('ix_pret_supplier', table_name='purchase_return')
    op.drop_index('ix_pret_status', table_name='purchase_return')
    op.drop_index('ix_pret_po', table_name='purchase_return')
    op.drop_index('ix_pret_vendor', table_name='purchase_return')
    op.drop_table('purchase_return')
