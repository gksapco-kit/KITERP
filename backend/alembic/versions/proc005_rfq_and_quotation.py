"""Procurement Phase 3+4: Request for Quotation and Supplier Quotation

Revision ID: proc005_rfq_and_quotation
Revises: proc004_supplier_management
Create Date: 2026-09-01

Adds:
  rfq              – RFQ header
  rfq_item         – RFQ line items
  rfq_supplier     – Per-supplier invitation / response tracking
  supplier_quotation       – Quote header (response to RFQ or standalone)
  supplier_quotation_item  – Quote line items with pricing, MOQ, lead time
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = 'proc005_rfq_and_quotation'
down_revision = 'proc004_supplier_management'
branch_labels = None
depends_on = None


def upgrade():
    # ── rfq ────────────────────────────────────────────────────────
    op.create_table(
        'rfq',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('vendor_id', UUID(as_uuid=True),
                  sa.ForeignKey('vendor.id', ondelete='CASCADE'), nullable=False),
        sa.Column('rfq_number', sa.String(30), nullable=False),
        sa.Column('title', sa.String(255), nullable=True),
        sa.Column('status', sa.String(30), server_default='draft', nullable=False),
        sa.Column('sourcing_type', sa.String(20), server_default='rfq', nullable=False),
        sa.Column('requisition_id', UUID(as_uuid=True),
                  sa.ForeignKey('purchase_requisition.id', ondelete='SET NULL'), nullable=True),
        sa.Column('store_id', UUID(as_uuid=True),
                  sa.ForeignKey('store.id', ondelete='SET NULL'), nullable=True),
        sa.Column('department', sa.String(100), nullable=True),
        sa.Column('bid_submission_deadline', sa.DateTime(timezone=True), nullable=True),
        sa.Column('delivery_required_by', sa.Date, nullable=True),
        sa.Column('valid_until', sa.Date, nullable=True),
        sa.Column('currency', sa.String(3), server_default='INR', nullable=False),
        sa.Column('payment_terms', sa.String(100), nullable=True),
        sa.Column('delivery_terms', sa.String(100), nullable=True),
        sa.Column('delivery_address', JSONB, nullable=True),
        sa.Column('instructions_to_suppliers', sa.Text, nullable=True),
        sa.Column('internal_notes', sa.Text, nullable=True),
        sa.Column('awarded_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('awarded_by', UUID(as_uuid=True),
                  sa.ForeignKey('vendor_user.id', ondelete='SET NULL'), nullable=True),
        sa.Column('audit_log', JSONB, server_default='[]'),
        sa.Column('created_by', UUID(as_uuid=True),
                  sa.ForeignKey('vendor_user.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('vendor_id', 'rfq_number', name='uq_rfq_vendor_number'),
    )
    op.create_index('ix_rfq_vendor', 'rfq', ['vendor_id'])
    op.create_index('ix_rfq_vendor_status', 'rfq', ['vendor_id', 'status'])
    op.create_index('ix_rfq_requisition', 'rfq', ['requisition_id'])

    # ── rfq_item ───────────────────────────────────────────────────
    op.create_table(
        'rfq_item',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('rfq_id', UUID(as_uuid=True),
                  sa.ForeignKey('rfq.id', ondelete='CASCADE'), nullable=False),
        sa.Column('pr_item_id', UUID(as_uuid=True),
                  sa.ForeignKey('purchase_requisition_item.id', ondelete='SET NULL'), nullable=True),
        sa.Column('line_number', sa.Integer, server_default='1', nullable=False),
        sa.Column('item_type', sa.String(20), server_default='product', nullable=False),
        sa.Column('product_id', UUID(as_uuid=True),
                  sa.ForeignKey('product.id', ondelete='RESTRICT'), nullable=True),
        sa.Column('variant_id', UUID(as_uuid=True),
                  sa.ForeignKey('product_variant.id', ondelete='SET NULL'), nullable=True),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('quantity', sa.Numeric(12, 4), server_default='1', nullable=False),
        sa.Column('unit_of_measure', sa.String(20), server_default='piece', nullable=False),
        sa.Column('target_price', sa.Numeric(14, 4), nullable=True),
        sa.Column('currency', sa.String(3), nullable=True),
        sa.Column('needed_by_date', sa.Date, nullable=True),
        sa.Column('technical_specs', sa.Text, nullable=True),
        sa.Column('notes', sa.Text, nullable=True),
    )
    op.create_index('ix_rfq_item_rfq', 'rfq_item', ['rfq_id'])
    op.create_index('ix_rfq_item_product', 'rfq_item', ['product_id'])

    # ── rfq_supplier ───────────────────────────────────────────────
    op.create_table(
        'rfq_supplier',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('rfq_id', UUID(as_uuid=True),
                  sa.ForeignKey('rfq.id', ondelete='CASCADE'), nullable=False),
        sa.Column('supplier_id', UUID(as_uuid=True),
                  sa.ForeignKey('supplier.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('invite_status', sa.String(30), server_default='invited', nullable=False),
        sa.Column('invited_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('acknowledged_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('access_token', sa.String(64), nullable=True, unique=True),
        sa.Column('token_expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('decline_reason', sa.Text, nullable=True),
        sa.Column('internal_notes', sa.Text, nullable=True),
        sa.UniqueConstraint('rfq_id', 'supplier_id', name='uq_rfq_supplier'),
    )
    op.create_index('ix_rfq_supplier_rfq', 'rfq_supplier', ['rfq_id'])
    op.create_index('ix_rfq_supplier_supplier', 'rfq_supplier', ['supplier_id'])

    # ── supplier_quotation ─────────────────────────────────────────
    op.create_table(
        'supplier_quotation',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('vendor_id', UUID(as_uuid=True),
                  sa.ForeignKey('vendor.id', ondelete='CASCADE'), nullable=False),
        sa.Column('supplier_id', UUID(as_uuid=True),
                  sa.ForeignKey('supplier.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('rfq_id', UUID(as_uuid=True),
                  sa.ForeignKey('rfq.id', ondelete='SET NULL'), nullable=True),
        sa.Column('quotation_number', sa.String(30), nullable=False),
        sa.Column('supplier_reference', sa.String(100), nullable=True),
        sa.Column('status', sa.String(30), server_default='draft', nullable=False),
        sa.Column('quote_type', sa.String(30), server_default='rfq_response', nullable=False),
        sa.Column('source', sa.String(20), server_default='manual', nullable=False),
        sa.Column('quote_date', sa.Date, nullable=False),
        sa.Column('valid_until', sa.Date, nullable=True),
        sa.Column('currency', sa.String(3), server_default='INR', nullable=False),
        sa.Column('exchange_rate', sa.Numeric(12, 6), server_default='1'),
        sa.Column('subtotal', sa.Numeric(14, 2), server_default='0', nullable=False),
        sa.Column('tax_amount', sa.Numeric(14, 2), server_default='0'),
        sa.Column('freight_amount', sa.Numeric(14, 2), server_default='0'),
        sa.Column('other_charges', sa.Numeric(14, 2), server_default='0'),
        sa.Column('total', sa.Numeric(14, 2), server_default='0', nullable=False),
        sa.Column('payment_terms', sa.String(100), nullable=True),
        sa.Column('delivery_terms', sa.String(100), nullable=True),
        sa.Column('delivery_lead_time_days', sa.Integer, nullable=True),
        sa.Column('cgst_amount', sa.Numeric(14, 2), server_default='0'),
        sa.Column('sgst_amount', sa.Numeric(14, 2), server_default='0'),
        sa.Column('igst_amount', sa.Numeric(14, 2), server_default='0'),
        sa.Column('notes', sa.Text, nullable=True),
        sa.Column('terms_and_conditions', sa.Text, nullable=True),
        sa.Column('audit_log', JSONB, server_default='[]'),
        sa.Column('submitted_by', UUID(as_uuid=True),
                  sa.ForeignKey('vendor_user.id', ondelete='SET NULL'), nullable=True),
        sa.Column('reviewed_by', UUID(as_uuid=True),
                  sa.ForeignKey('vendor_user.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('vendor_id', 'quotation_number', name='uq_sq_vendor_number'),
    )
    op.create_index('ix_sq_vendor', 'supplier_quotation', ['vendor_id'])
    op.create_index('ix_sq_vendor_status', 'supplier_quotation', ['vendor_id', 'status'])
    op.create_index('ix_sq_rfq', 'supplier_quotation', ['rfq_id'])
    op.create_index('ix_sq_supplier', 'supplier_quotation', ['vendor_id', 'supplier_id'])

    # ── supplier_quotation_item ────────────────────────────────────
    op.create_table(
        'supplier_quotation_item',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('quotation_id', UUID(as_uuid=True),
                  sa.ForeignKey('supplier_quotation.id', ondelete='CASCADE'), nullable=False),
        sa.Column('rfq_item_id', UUID(as_uuid=True),
                  sa.ForeignKey('rfq_item.id', ondelete='SET NULL'), nullable=True),
        sa.Column('line_number', sa.Integer, server_default='1', nullable=False),
        sa.Column('item_type', sa.String(20), server_default='product', nullable=False),
        sa.Column('product_id', UUID(as_uuid=True),
                  sa.ForeignKey('product.id', ondelete='RESTRICT'), nullable=True),
        sa.Column('variant_id', UUID(as_uuid=True),
                  sa.ForeignKey('product_variant.id', ondelete='SET NULL'), nullable=True),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('quantity', sa.Numeric(12, 4), server_default='1', nullable=False),
        sa.Column('unit_of_measure', sa.String(20), server_default='piece', nullable=False),
        sa.Column('min_order_quantity', sa.Numeric(12, 4), nullable=True),
        sa.Column('unit_price', sa.Numeric(14, 4), server_default='0', nullable=False),
        sa.Column('discount_pct', sa.Numeric(6, 2), server_default='0'),
        sa.Column('discount_amount', sa.Numeric(14, 4), server_default='0'),
        sa.Column('net_unit_price', sa.Numeric(14, 4), server_default='0', nullable=False),
        sa.Column('hsn_code', sa.String(10), nullable=True),
        sa.Column('tax_code', sa.String(20), nullable=True),
        sa.Column('cgst_rate', sa.Numeric(6, 2), server_default='0'),
        sa.Column('sgst_rate', sa.Numeric(6, 2), server_default='0'),
        sa.Column('igst_rate', sa.Numeric(6, 2), server_default='0'),
        sa.Column('cgst_amount', sa.Numeric(12, 2), server_default='0'),
        sa.Column('sgst_amount', sa.Numeric(12, 2), server_default='0'),
        sa.Column('igst_amount', sa.Numeric(12, 2), server_default='0'),
        sa.Column('subtotal', sa.Numeric(14, 2), server_default='0', nullable=False),
        sa.Column('tax_total', sa.Numeric(14, 2), server_default='0'),
        sa.Column('total', sa.Numeric(14, 2), server_default='0', nullable=False),
        sa.Column('lead_time_days', sa.Integer, nullable=True),
        sa.Column('delivery_date', sa.Date, nullable=True),
        sa.Column('notes', sa.Text, nullable=True),
    )
    op.create_index('ix_sqi_quotation', 'supplier_quotation_item', ['quotation_id'])
    op.create_index('ix_sqi_rfq_item', 'supplier_quotation_item', ['rfq_item_id'])
    op.create_index('ix_sqi_product', 'supplier_quotation_item', ['product_id'])


def downgrade():
    op.drop_table('supplier_quotation_item')
    op.drop_table('supplier_quotation')
    op.drop_table('rfq_supplier')
    op.drop_table('rfq_item')
    op.drop_table('rfq')
