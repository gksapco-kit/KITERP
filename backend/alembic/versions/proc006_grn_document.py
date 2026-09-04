"""Procurement Phase 7: GRN as first-class document

Revision ID: proc006_grn_document
Revises: proc005_rfq_and_quotation
Create Date: 2026-09-01

Adds:
  grn                – GRN header (replaces JSONB receipt approach)
  grn_line           – Relational GRN lines with QC quantity tracking
  grn_qc_inspection  – Per-line QC inspection results
  grn_reversal       – Reversal / cancellation document
  grn_reversal_line  – Reversal line quantities
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = 'proc006_grn_document'
down_revision = 'proc005_rfq_and_quotation'
branch_labels = None
depends_on = None


def upgrade():
    # ── grn ────────────────────────────────────────────────────────
    op.create_table(
        'grn',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('vendor_id', UUID(as_uuid=True),
                  sa.ForeignKey('vendor.id', ondelete='CASCADE'), nullable=False),
        sa.Column('grn_number', sa.String(30), nullable=False),
        sa.Column('purchase_order_id', UUID(as_uuid=True),
                  sa.ForeignKey('purchase_order.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('legacy_receipt_id', UUID(as_uuid=True),
                  sa.ForeignKey('purchase_order_receipt.id', ondelete='SET NULL'), nullable=True),
        sa.Column('status', sa.String(30), server_default='draft', nullable=False),
        sa.Column('posting_date', sa.Date, nullable=True),
        sa.Column('document_date', sa.Date, nullable=True),
        sa.Column('supplier_delivery_number', sa.String(100), nullable=True),
        sa.Column('supplier_invoice_reference', sa.String(100), nullable=True),
        sa.Column('plant_id', UUID(as_uuid=True),
                  sa.ForeignKey('plant.id', ondelete='SET NULL'), nullable=True),
        sa.Column('storage_location_id', UUID(as_uuid=True),
                  sa.ForeignKey('storage_location.id', ondelete='SET NULL'), nullable=True),
        sa.Column('requires_qc', sa.Boolean, server_default='false'),
        sa.Column('qc_completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('qc_completed_by', UUID(as_uuid=True),
                  sa.ForeignKey('vendor_user.id', ondelete='SET NULL'), nullable=True),
        sa.Column('total_ordered_qty', sa.Numeric(12, 4), server_default='0'),
        sa.Column('total_received_qty', sa.Numeric(12, 4), server_default='0'),
        sa.Column('total_accepted_qty', sa.Numeric(12, 4), server_default='0'),
        sa.Column('total_rejected_qty', sa.Numeric(12, 4), server_default='0'),
        sa.Column('notes', sa.Text, nullable=True),
        sa.Column('audit_log', JSONB, server_default='[]'),
        sa.Column('received_by', UUID(as_uuid=True),
                  sa.ForeignKey('vendor_user.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('vendor_id', 'grn_number', name='uq_grn_vendor_number'),
    )
    op.create_index('ix_grn_vendor', 'grn', ['vendor_id'])
    op.create_index('ix_grn_po', 'grn', ['purchase_order_id'])
    op.create_index('ix_grn_status', 'grn', ['vendor_id', 'status'])

    # ── grn_line ───────────────────────────────────────────────────
    op.create_table(
        'grn_line',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('grn_id', UUID(as_uuid=True),
                  sa.ForeignKey('grn.id', ondelete='CASCADE'), nullable=False),
        sa.Column('po_item_id', UUID(as_uuid=True),
                  sa.ForeignKey('purchase_order_item.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('product_id', UUID(as_uuid=True),
                  sa.ForeignKey('product.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('variant_id', UUID(as_uuid=True),
                  sa.ForeignKey('product_variant.id', ondelete='SET NULL'), nullable=True),
        sa.Column('batch_number', sa.String(100), nullable=True),
        sa.Column('supplier_batch_number', sa.String(100), nullable=True),
        sa.Column('serial_number', sa.String(100), nullable=True),
        sa.Column('manufacturing_date', sa.Date, nullable=True),
        sa.Column('expiry_date', sa.Date, nullable=True),
        sa.Column('line_number', sa.Integer, server_default='1', nullable=False),
        sa.Column('unit_of_measure', sa.String(20), server_default='piece', nullable=False),
        sa.Column('ordered_qty', sa.Numeric(12, 4), server_default='0', nullable=False),
        sa.Column('received_qty', sa.Numeric(12, 4), server_default='0', nullable=False),
        sa.Column('accepted_qty', sa.Numeric(12, 4), nullable=True),
        sa.Column('rejected_qty', sa.Numeric(12, 4), server_default='0'),
        sa.Column('pending_qc_qty', sa.Numeric(12, 4), nullable=True),
        sa.Column('unit_price', sa.Numeric(14, 4), nullable=True),
        sa.Column('plant_id', UUID(as_uuid=True),
                  sa.ForeignKey('plant.id', ondelete='SET NULL'), nullable=True),
        sa.Column('storage_location_id', UUID(as_uuid=True),
                  sa.ForeignKey('storage_location.id', ondelete='SET NULL'), nullable=True),
        sa.Column('goods_batch_id', UUID(as_uuid=True),
                  sa.ForeignKey('goods_batch.id', ondelete='SET NULL'), nullable=True),
        sa.Column('qc_status', sa.String(20), server_default='not_required', nullable=False),
        sa.Column('notes', sa.Text, nullable=True),
    )
    op.create_index('ix_grn_line_grn', 'grn_line', ['grn_id'])
    op.create_index('ix_grn_line_po_item', 'grn_line', ['po_item_id'])
    op.create_index('ix_grn_line_product', 'grn_line', ['product_id'])

    # ── grn_qc_inspection ─────────────────────────────────────────
    op.create_table(
        'grn_qc_inspection',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('grn_line_id', UUID(as_uuid=True),
                  sa.ForeignKey('grn_line.id', ondelete='CASCADE'), nullable=False, unique=True),
        sa.Column('result', sa.String(20), server_default='pending', nullable=False),
        sa.Column('inspected_qty', sa.Numeric(12, 4), nullable=True),
        sa.Column('accepted_qty', sa.Numeric(12, 4), nullable=True),
        sa.Column('rejected_qty', sa.Numeric(12, 4), nullable=True),
        sa.Column('defect_code', sa.String(50), nullable=True),
        sa.Column('defect_description', sa.Text, nullable=True),
        sa.Column('defect_photos', JSONB, nullable=True),
        sa.Column('inspector_id', UUID(as_uuid=True),
                  sa.ForeignKey('vendor_user.id', ondelete='SET NULL'), nullable=True),
        sa.Column('inspected_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('notes', sa.Text, nullable=True),
    )
    op.create_index('ix_grn_qc_line', 'grn_qc_inspection', ['grn_line_id'])

    # ── grn_reversal ──────────────────────────────────────────────
    op.create_table(
        'grn_reversal',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('vendor_id', UUID(as_uuid=True),
                  sa.ForeignKey('vendor.id', ondelete='CASCADE'), nullable=False),
        sa.Column('grn_id', UUID(as_uuid=True),
                  sa.ForeignKey('grn.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('reversal_number', sa.String(30), nullable=False),
        sa.Column('reversal_type', sa.String(20), server_default='partial', nullable=False),
        sa.Column('reversal_date', sa.Date, nullable=False),
        sa.Column('reason', sa.Text, nullable=True),
        sa.Column('status', sa.String(20), server_default='draft', nullable=False),
        sa.Column('notes', sa.Text, nullable=True),
        sa.Column('audit_log', JSONB, server_default='[]'),
        sa.Column('reversed_by', UUID(as_uuid=True),
                  sa.ForeignKey('vendor_user.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('vendor_id', 'reversal_number', name='uq_grn_rev_vendor_number'),
    )
    op.create_index('ix_grn_rev_vendor', 'grn_reversal', ['vendor_id'])
    op.create_index('ix_grn_rev_grn', 'grn_reversal', ['grn_id'])

    # ── grn_reversal_line ─────────────────────────────────────────
    op.create_table(
        'grn_reversal_line',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('reversal_id', UUID(as_uuid=True),
                  sa.ForeignKey('grn_reversal.id', ondelete='CASCADE'), nullable=False),
        sa.Column('grn_line_id', UUID(as_uuid=True),
                  sa.ForeignKey('grn_line.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('reversed_qty', sa.Numeric(12, 4), nullable=False),
        sa.Column('reason', sa.Text, nullable=True),
    )
    op.create_index('ix_grn_rev_line_reversal', 'grn_reversal_line', ['reversal_id'])
    op.create_index('ix_grn_rev_line_grn_line', 'grn_reversal_line', ['grn_line_id'])


def downgrade():
    op.drop_table('grn_reversal_line')
    op.drop_table('grn_reversal')
    op.drop_table('grn_qc_inspection')
    op.drop_table('grn_line')
    op.drop_table('grn')
