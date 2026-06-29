"""Full SAP-style procurement extension

Revision ID: proc001_full_procurement
Revises: inv004_production_plant
Create Date: 2026-06-28

Covers:
  Phase 1 – purchasing_info_record, source_list
  Phase 2 – purchase_requisition, purchase_requisition_item, purchase_requisition_approval
  Phase 3 – enrich purchase_order + purchase_order_item; add po_delivery_schedule;
             add movement_type / quality_status / plant_id / storage_location_id to purchase_order_receipt
  Phase 4 – vendor_invoice, vendor_invoice_item
  Phase 5 – goods_batch, goods_movement_document
  Phase 6 – material_valuation, subcontracting_order, consignment_stock, service_entry_sheet
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = 'proc001_full_procurement'
down_revision = 'inv004_production_plant'
branch_labels = None
depends_on = None


# ---------------------------------------------------------------------------
# UPGRADE
# ---------------------------------------------------------------------------

def upgrade():

    # ── Phase 1: Purchasing Info Record ────────────────────────────────────
    op.create_table(
        'purchasing_info_record',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('vendor_id', UUID(as_uuid=True), sa.ForeignKey('vendor.id', ondelete='CASCADE'), nullable=False),
        sa.Column('supplier_id', UUID(as_uuid=True), sa.ForeignKey('supplier.id', ondelete='CASCADE'), nullable=False),
        sa.Column('product_id', UUID(as_uuid=True), sa.ForeignKey('product.id', ondelete='CASCADE'), nullable=False),
        sa.Column('variant_id', UUID(as_uuid=True), sa.ForeignKey('product_variant.id', ondelete='SET NULL'), nullable=True),
        sa.Column('plant_id', UUID(as_uuid=True), sa.ForeignKey('plant.id', ondelete='SET NULL'), nullable=True),
        sa.Column('currency', sa.String(3), nullable=False, server_default='INR'),
        sa.Column('price', sa.Numeric(14, 4), nullable=False, server_default='0'),
        sa.Column('price_unit', sa.Integer(), server_default='1'),
        sa.Column('min_order_qty', sa.Numeric(12, 4), server_default='1'),
        sa.Column('max_order_qty', sa.Numeric(12, 4), nullable=True),
        sa.Column('order_unit', sa.String(20), server_default='PCS'),
        sa.Column('lead_time_days', sa.Integer(), server_default='0'),
        sa.Column('planned_delivery_days', sa.Integer(), server_default='0'),
        sa.Column('valid_from', sa.Date(), nullable=True),
        sa.Column('valid_to', sa.Date(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_pir_vendor', 'purchasing_info_record', ['vendor_id'])
    op.create_index('ix_pir_supplier', 'purchasing_info_record', ['vendor_id', 'supplier_id'])
    op.create_index('ix_pir_product', 'purchasing_info_record', ['vendor_id', 'product_id'])
    op.create_index('ix_pir_supplier_product', 'purchasing_info_record', ['vendor_id', 'supplier_id', 'product_id'])

    # ── Phase 1: Source List ────────────────────────────────────────────────
    op.create_table(
        'source_list',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('vendor_id', UUID(as_uuid=True), sa.ForeignKey('vendor.id', ondelete='CASCADE'), nullable=False),
        sa.Column('product_id', UUID(as_uuid=True), sa.ForeignKey('product.id', ondelete='CASCADE'), nullable=False),
        sa.Column('variant_id', UUID(as_uuid=True), sa.ForeignKey('product_variant.id', ondelete='SET NULL'), nullable=True),
        sa.Column('supplier_id', UUID(as_uuid=True), sa.ForeignKey('supplier.id', ondelete='CASCADE'), nullable=False),
        sa.Column('plant_id', UUID(as_uuid=True), sa.ForeignKey('plant.id', ondelete='SET NULL'), nullable=True),
        sa.Column('valid_from', sa.Date(), nullable=True),
        sa.Column('valid_to', sa.Date(), nullable=True),
        sa.Column('is_fixed', sa.Boolean(), server_default='false'),
        sa.Column('is_blocked', sa.Boolean(), server_default='false'),
        sa.Column('priority', sa.Integer(), server_default='0'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_sl_vendor', 'source_list', ['vendor_id'])
    op.create_index('ix_sl_product', 'source_list', ['vendor_id', 'product_id'])
    op.create_index('ix_sl_supplier', 'source_list', ['vendor_id', 'supplier_id'])
    op.create_index('ix_sl_product_supplier', 'source_list', ['vendor_id', 'product_id', 'supplier_id'])

    # ── Phase 2: Purchase Requisition ──────────────────────────────────────
    op.create_table(
        'purchase_requisition',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('vendor_id', UUID(as_uuid=True), sa.ForeignKey('vendor.id', ondelete='CASCADE'), nullable=False),
        sa.Column('pr_number', sa.String(30), nullable=False),
        sa.Column('status', sa.String(30), nullable=False, server_default='draft'),
        sa.Column('requested_by', UUID(as_uuid=True), sa.ForeignKey('vendor_user.id', ondelete='SET NULL'), nullable=True),
        sa.Column('department', sa.String(100), nullable=True),
        sa.Column('priority', sa.String(20), server_default='medium'),
        sa.Column('requisition_type', sa.String(20), server_default='product'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('approver_message', sa.Text(), nullable=True),
        sa.Column('audit_log', JSONB, server_default='[]'),
        sa.Column('submitted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('vendor_id', 'pr_number', name='uq_pr_vendor_number'),
    )
    op.create_index('ix_pr_vendor', 'purchase_requisition', ['vendor_id'])
    op.create_index('ix_pr_vendor_status', 'purchase_requisition', ['vendor_id', 'status'])

    op.create_table(
        'purchase_requisition_item',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('requisition_id', UUID(as_uuid=True), sa.ForeignKey('purchase_requisition.id', ondelete='CASCADE'), nullable=False),
        sa.Column('item_type', sa.String(20), server_default='product'),
        sa.Column('product_id', UUID(as_uuid=True), sa.ForeignKey('product.id', ondelete='RESTRICT'), nullable=True),
        sa.Column('service_id', UUID(as_uuid=True), sa.ForeignKey('service.id', ondelete='RESTRICT'), nullable=True),
        sa.Column('variant_id', UUID(as_uuid=True), sa.ForeignKey('product_variant.id', ondelete='SET NULL'), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('asset_category_id', UUID(as_uuid=True), sa.ForeignKey('fin_asset_category.id', ondelete='SET NULL'), nullable=True),
        sa.Column('quantity', sa.Numeric(12, 4), nullable=False),
        sa.Column('unit_of_measure', sa.String(20), server_default='PCS'),
        sa.Column('needed_by_date', sa.Date(), nullable=True),
        sa.Column('plant_id', UUID(as_uuid=True), sa.ForeignKey('plant.id', ondelete='SET NULL'), nullable=True),
        sa.Column('storage_location_id', UUID(as_uuid=True), sa.ForeignKey('storage_location.id', ondelete='SET NULL'), nullable=True),
        sa.Column('estimated_price', sa.Numeric(12, 2), server_default='0'),
        sa.Column('suggested_supplier_id', UUID(as_uuid=True), sa.ForeignKey('supplier.id', ondelete='SET NULL'), nullable=True),
        sa.Column('quantity_ordered', sa.Numeric(12, 4), server_default='0'),
        sa.Column('purchase_order_id', UUID(as_uuid=True), sa.ForeignKey('purchase_order.id', ondelete='SET NULL'), nullable=True),
        sa.Column('is_converted', sa.Boolean(), server_default='false'),
        sa.Column('notes', sa.Text(), nullable=True),
    )
    op.create_index('ix_pri_requisition', 'purchase_requisition_item', ['requisition_id'])
    op.create_index('ix_pri_product', 'purchase_requisition_item', ['product_id'])

    op.create_table(
        'purchase_requisition_approval',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('requisition_id', UUID(as_uuid=True), sa.ForeignKey('purchase_requisition.id', ondelete='CASCADE'), nullable=False),
        sa.Column('level', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('approver_id', UUID(as_uuid=True), sa.ForeignKey('vendor_user.id', ondelete='SET NULL'), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('comments', sa.Text(), nullable=True),
        sa.Column('actioned_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_pra_requisition', 'purchase_requisition_approval', ['requisition_id'])
    op.create_index('ix_pra_approver', 'purchase_requisition_approval', ['approver_id'])

    # ── Phase 3a: Enrich purchase_order header ─────────────────────────────
    op.add_column('purchase_order', sa.Column('currency', sa.String(3), server_default='INR', nullable=False))
    op.add_column('purchase_order', sa.Column('exchange_rate', sa.Numeric(12, 6), server_default='1'))
    op.add_column('purchase_order', sa.Column('cgst_amount', sa.Numeric(14, 2), server_default='0'))
    op.add_column('purchase_order', sa.Column('sgst_amount', sa.Numeric(14, 2), server_default='0'))
    op.add_column('purchase_order', sa.Column('igst_amount', sa.Numeric(14, 2), server_default='0'))
    op.add_column('purchase_order', sa.Column('payment_terms', sa.String(50), nullable=True))
    op.add_column('purchase_order', sa.Column('delivery_terms', sa.String(50), nullable=True))
    op.add_column('purchase_order', sa.Column('requisition_id', UUID(as_uuid=True), sa.ForeignKey('purchase_requisition.id', ondelete='SET NULL'), nullable=True))
    op.add_column('purchase_order', sa.Column('audit_log', JSONB, server_default='[]'))

    # ── Phase 3b: Enrich purchase_order_item ───────────────────────────────
    op.add_column('purchase_order_item', sa.Column('unit_of_measure', sa.String(20), server_default='PCS'))
    op.add_column('purchase_order_item', sa.Column('plant_id', UUID(as_uuid=True), sa.ForeignKey('plant.id', ondelete='SET NULL'), nullable=True))
    op.add_column('purchase_order_item', sa.Column('storage_location_id', UUID(as_uuid=True), sa.ForeignKey('storage_location.id', ondelete='SET NULL'), nullable=True))
    op.add_column('purchase_order_item', sa.Column('item_category', sa.String(20), server_default='standard'))
    op.add_column('purchase_order_item', sa.Column('account_assignment', sa.String(20), nullable=True))
    op.add_column('purchase_order_item', sa.Column('hsn_code', sa.String(10), nullable=True))
    op.add_column('purchase_order_item', sa.Column('tax_code', sa.String(20), nullable=True))
    op.add_column('purchase_order_item', sa.Column('cgst_rate', sa.Numeric(6, 2), server_default='0'))
    op.add_column('purchase_order_item', sa.Column('sgst_rate', sa.Numeric(6, 2), server_default='0'))
    op.add_column('purchase_order_item', sa.Column('igst_rate', sa.Numeric(6, 2), server_default='0'))
    op.add_column('purchase_order_item', sa.Column('cgst_amount', sa.Numeric(12, 2), server_default='0'))
    op.add_column('purchase_order_item', sa.Column('sgst_amount', sa.Numeric(12, 2), server_default='0'))
    op.add_column('purchase_order_item', sa.Column('igst_amount', sa.Numeric(12, 2), server_default='0'))

    # ── Phase 3c: Enrich purchase_order_receipt ────────────────────────────
    op.add_column('purchase_order_receipt', sa.Column('movement_type', sa.String(10), server_default='101'))
    op.add_column('purchase_order_receipt', sa.Column('plant_id', UUID(as_uuid=True), sa.ForeignKey('plant.id', ondelete='SET NULL'), nullable=True))
    op.add_column('purchase_order_receipt', sa.Column('storage_location_id', UUID(as_uuid=True), sa.ForeignKey('storage_location.id', ondelete='SET NULL'), nullable=True))
    op.add_column('purchase_order_receipt', sa.Column('quality_status', sa.String(30), server_default='unrestricted'))
    op.add_column('purchase_order_receipt', sa.Column('posting_date', sa.Date(), nullable=True))
    op.create_index('ix_por_movement', 'purchase_order_receipt', ['movement_type'])

    # ── Phase 3d: PO Delivery Schedule ─────────────────────────────────────
    op.create_table(
        'po_delivery_schedule',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('po_item_id', UUID(as_uuid=True), sa.ForeignKey('purchase_order_item.id', ondelete='CASCADE'), nullable=False),
        sa.Column('delivery_date', sa.Date(), nullable=False),
        sa.Column('scheduled_qty', sa.Numeric(12, 4), nullable=False),
        sa.Column('delivered_qty', sa.Numeric(12, 4), server_default='0'),
        sa.Column('notes', sa.Text(), nullable=True),
    )
    op.create_index('ix_pods_item', 'po_delivery_schedule', ['po_item_id'])
    op.create_index('ix_pods_date', 'po_delivery_schedule', ['delivery_date'])

    # ── Phase 4: Vendor Invoice ─────────────────────────────────────────────
    op.create_table(
        'vendor_invoice',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('vendor_id', UUID(as_uuid=True), sa.ForeignKey('vendor.id', ondelete='CASCADE'), nullable=False),
        sa.Column('supplier_id', UUID(as_uuid=True), sa.ForeignKey('supplier.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('purchase_order_id', UUID(as_uuid=True), sa.ForeignKey('purchase_order.id', ondelete='RESTRICT'), nullable=True),
        sa.Column('invoice_number', sa.String(50), nullable=False),
        sa.Column('supplier_invoice_number', sa.String(50), nullable=True),
        sa.Column('invoice_date', sa.Date(), nullable=False),
        sa.Column('due_date', sa.Date(), nullable=True),
        sa.Column('posting_date', sa.Date(), nullable=True),
        sa.Column('status', sa.String(30), nullable=False, server_default='draft'),
        sa.Column('match_status', sa.String(30), nullable=False, server_default='unmatched'),
        sa.Column('currency', sa.String(3), server_default='INR'),
        sa.Column('subtotal', sa.Numeric(14, 2), server_default='0'),
        sa.Column('cgst_amount', sa.Numeric(14, 2), server_default='0'),
        sa.Column('sgst_amount', sa.Numeric(14, 2), server_default='0'),
        sa.Column('igst_amount', sa.Numeric(14, 2), server_default='0'),
        sa.Column('tax_amount', sa.Numeric(14, 2), server_default='0'),
        sa.Column('total', sa.Numeric(14, 2), server_default='0'),
        sa.Column('amount_paid', sa.Numeric(14, 2), server_default='0'),
        sa.Column('amount_due', sa.Numeric(14, 2), server_default='0'),
        sa.Column('payment_terms', sa.String(50), nullable=True),
        sa.Column('block_reason', sa.Text(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('audit_log', JSONB, server_default='[]'),
        sa.Column('posted_by', UUID(as_uuid=True), sa.ForeignKey('vendor_user.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('vendor_id', 'invoice_number', name='uq_vendor_invoice_number'),
    )
    op.create_index('ix_vi_vendor', 'vendor_invoice', ['vendor_id'])
    op.create_index('ix_vi_supplier', 'vendor_invoice', ['vendor_id', 'supplier_id'])
    op.create_index('ix_vi_po', 'vendor_invoice', ['purchase_order_id'])
    op.create_index('ix_vi_status', 'vendor_invoice', ['vendor_id', 'status'])
    op.create_index('ix_vi_match', 'vendor_invoice', ['vendor_id', 'match_status'])

    op.create_table(
        'vendor_invoice_item',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('invoice_id', UUID(as_uuid=True), sa.ForeignKey('vendor_invoice.id', ondelete='CASCADE'), nullable=False),
        sa.Column('po_item_id', UUID(as_uuid=True), sa.ForeignKey('purchase_order_item.id', ondelete='RESTRICT'), nullable=True),
        sa.Column('product_id', UUID(as_uuid=True), sa.ForeignKey('product.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('variant_id', UUID(as_uuid=True), sa.ForeignKey('product_variant.id', ondelete='SET NULL'), nullable=True),
        sa.Column('ordered_qty', sa.Numeric(12, 4), server_default='0'),
        sa.Column('received_qty', sa.Numeric(12, 4), server_default='0'),
        sa.Column('invoiced_qty', sa.Numeric(12, 4), nullable=False),
        sa.Column('po_unit_price', sa.Numeric(14, 4), server_default='0'),
        sa.Column('unit_price', sa.Numeric(14, 4), nullable=False),
        sa.Column('hsn_code', sa.String(10), nullable=True),
        sa.Column('tax_code', sa.String(20), nullable=True),
        sa.Column('cgst_rate', sa.Numeric(6, 2), server_default='0'),
        sa.Column('sgst_rate', sa.Numeric(6, 2), server_default='0'),
        sa.Column('igst_rate', sa.Numeric(6, 2), server_default='0'),
        sa.Column('cgst_amount', sa.Numeric(12, 2), server_default='0'),
        sa.Column('sgst_amount', sa.Numeric(12, 2), server_default='0'),
        sa.Column('igst_amount', sa.Numeric(12, 2), server_default='0'),
        sa.Column('subtotal', sa.Numeric(14, 2), server_default='0'),
        sa.Column('tax_total', sa.Numeric(14, 2), server_default='0'),
        sa.Column('total', sa.Numeric(14, 2), server_default='0'),
        sa.Column('qty_variance', sa.Numeric(12, 4), server_default='0'),
        sa.Column('price_variance', sa.Numeric(14, 4), server_default='0'),
        sa.Column('match_status', sa.String(20), server_default='unmatched'),
        sa.Column('notes', sa.Text(), nullable=True),
    )
    op.create_index('ix_vii_invoice', 'vendor_invoice_item', ['invoice_id'])
    op.create_index('ix_vii_po_item', 'vendor_invoice_item', ['po_item_id'])
    op.create_index('ix_vii_product', 'vendor_invoice_item', ['product_id'])

    # ── Phase 5: Goods Batch ────────────────────────────────────────────────
    op.create_table(
        'goods_batch',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('vendor_id', UUID(as_uuid=True), sa.ForeignKey('vendor.id', ondelete='CASCADE'), nullable=False),
        sa.Column('product_id', UUID(as_uuid=True), sa.ForeignKey('product.id', ondelete='CASCADE'), nullable=False),
        sa.Column('variant_id', UUID(as_uuid=True), sa.ForeignKey('product_variant.id', ondelete='SET NULL'), nullable=True),
        sa.Column('batch_number', sa.String(50), nullable=False),
        sa.Column('serial_numbers', JSONB, server_default='[]'),
        sa.Column('manufacturing_date', sa.Date(), nullable=True),
        sa.Column('expiry_date', sa.Date(), nullable=True),
        sa.Column('best_before_date', sa.Date(), nullable=True),
        sa.Column('plant_id', UUID(as_uuid=True), sa.ForeignKey('plant.id', ondelete='SET NULL'), nullable=True),
        sa.Column('storage_location_id', UUID(as_uuid=True), sa.ForeignKey('storage_location.id', ondelete='SET NULL'), nullable=True),
        sa.Column('quantity_received', sa.Numeric(12, 4), nullable=False, server_default='0'),
        sa.Column('quantity_available', sa.Numeric(12, 4), nullable=False, server_default='0'),
        sa.Column('quantity_reserved', sa.Numeric(12, 4), server_default='0'),
        sa.Column('quantity_consumed', sa.Numeric(12, 4), server_default='0'),
        sa.Column('source_type', sa.String(20), nullable=True),
        sa.Column('source_id', UUID(as_uuid=True), nullable=True),
        sa.Column('quality_status', sa.String(30), nullable=False, server_default='unrestricted'),
        sa.Column('supplier_batch_number', sa.String(50), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_gb_vendor', 'goods_batch', ['vendor_id'])
    op.create_index('ix_gb_product', 'goods_batch', ['vendor_id', 'product_id'])
    op.create_index('ix_gb_batch', 'goods_batch', ['vendor_id', 'product_id', 'batch_number'])
    op.create_index('ix_gb_expiry', 'goods_batch', ['expiry_date'])
    op.create_index('ix_gb_location', 'goods_batch', ['vendor_id', 'plant_id', 'storage_location_id'])

    # ── Phase 5: Goods Movement Document ───────────────────────────────────
    op.create_table(
        'goods_movement_document',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('vendor_id', UUID(as_uuid=True), sa.ForeignKey('vendor.id', ondelete='CASCADE'), nullable=False),
        sa.Column('document_number', sa.String(30), nullable=False),
        sa.Column('movement_type', sa.String(10), nullable=False),
        sa.Column('po_receipt_id', UUID(as_uuid=True), sa.ForeignKey('purchase_order_receipt.id', ondelete='SET NULL'), nullable=True),
        sa.Column('production_order_id', UUID(as_uuid=True), sa.ForeignKey('production_order.id', ondelete='SET NULL'), nullable=True),
        sa.Column('plant_id', UUID(as_uuid=True), sa.ForeignKey('plant.id', ondelete='SET NULL'), nullable=True),
        sa.Column('from_storage_location_id', UUID(as_uuid=True), sa.ForeignKey('storage_location.id', ondelete='SET NULL'), nullable=True),
        sa.Column('to_storage_location_id', UUID(as_uuid=True), sa.ForeignKey('storage_location.id', ondelete='SET NULL'), nullable=True),
        sa.Column('lines', JSONB, nullable=False, server_default='[]'),
        sa.Column('posting_date', sa.Date(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('performed_by', UUID(as_uuid=True), sa.ForeignKey('vendor_user.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_gmd_vendor', 'goods_movement_document', ['vendor_id'])
    op.create_index('ix_gmd_type', 'goods_movement_document', ['vendor_id', 'movement_type'])
    op.create_index('ix_gmd_po_receipt', 'goods_movement_document', ['po_receipt_id'])
    op.create_index('ix_gmd_production_order', 'goods_movement_document', ['production_order_id'])

    # ── Phase 6: Material Valuation ─────────────────────────────────────────
    op.create_table(
        'material_valuation',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('vendor_id', UUID(as_uuid=True), sa.ForeignKey('vendor.id', ondelete='CASCADE'), nullable=False),
        sa.Column('product_id', UUID(as_uuid=True), sa.ForeignKey('product.id', ondelete='CASCADE'), nullable=False),
        sa.Column('variant_id', UUID(as_uuid=True), sa.ForeignKey('product_variant.id', ondelete='SET NULL'), nullable=True),
        sa.Column('plant_id', UUID(as_uuid=True), sa.ForeignKey('plant.id', ondelete='SET NULL'), nullable=True),
        sa.Column('valuation_method', sa.String(20), nullable=False, server_default='moving_average'),
        sa.Column('currency', sa.String(3), server_default='INR'),
        sa.Column('standard_price', sa.Numeric(14, 4), server_default='0'),
        sa.Column('moving_avg_price', sa.Numeric(14, 4), server_default='0'),
        sa.Column('total_stock', sa.Numeric(14, 4), server_default='0'),
        sa.Column('total_value', sa.Numeric(16, 2), server_default='0'),
        sa.Column('last_po_price', sa.Numeric(14, 4), server_default='0'),
        sa.Column('last_purchase_date', sa.Date(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('vendor_id', 'product_id', 'variant_id', 'plant_id', name='uq_mat_val_product_plant'),
    )
    op.create_index('ix_mv_vendor', 'material_valuation', ['vendor_id'])
    op.create_index('ix_mv_product', 'material_valuation', ['vendor_id', 'product_id'])

    # ── Phase 6: Subcontracting Order ───────────────────────────────────────
    op.create_table(
        'subcontracting_order',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('vendor_id', UUID(as_uuid=True), sa.ForeignKey('vendor.id', ondelete='CASCADE'), nullable=False),
        sa.Column('purchase_order_id', UUID(as_uuid=True), sa.ForeignKey('purchase_order.id', ondelete='CASCADE'), nullable=False),
        sa.Column('supplier_id', UUID(as_uuid=True), sa.ForeignKey('supplier.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('plant_id', UUID(as_uuid=True), sa.ForeignKey('plant.id', ondelete='SET NULL'), nullable=True),
        sa.Column('ref', sa.String(30), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='open'),
        sa.Column('components', JSONB, nullable=False, server_default='[]'),
        sa.Column('finished_product_id', UUID(as_uuid=True), sa.ForeignKey('product.id', ondelete='RESTRICT'), nullable=True),
        sa.Column('finished_variant_id', UUID(as_uuid=True), sa.ForeignKey('product_variant.id', ondelete='SET NULL'), nullable=True),
        sa.Column('qty_expected', sa.Numeric(12, 4), server_default='0'),
        sa.Column('qty_received', sa.Numeric(12, 4), server_default='0'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_sc_vendor', 'subcontracting_order', ['vendor_id'])
    op.create_index('ix_sc_po', 'subcontracting_order', ['purchase_order_id'])
    op.create_index('ix_sc_supplier', 'subcontracting_order', ['vendor_id', 'supplier_id'])

    # ── Phase 6: Consignment Stock ──────────────────────────────────────────
    op.create_table(
        'consignment_stock',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('vendor_id', UUID(as_uuid=True), sa.ForeignKey('vendor.id', ondelete='CASCADE'), nullable=False),
        sa.Column('supplier_id', UUID(as_uuid=True), sa.ForeignKey('supplier.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('product_id', UUID(as_uuid=True), sa.ForeignKey('product.id', ondelete='CASCADE'), nullable=False),
        sa.Column('variant_id', UUID(as_uuid=True), sa.ForeignKey('product_variant.id', ondelete='SET NULL'), nullable=True),
        sa.Column('plant_id', UUID(as_uuid=True), sa.ForeignKey('plant.id', ondelete='SET NULL'), nullable=True),
        sa.Column('storage_location_id', UUID(as_uuid=True), sa.ForeignKey('storage_location.id', ondelete='SET NULL'), nullable=True),
        sa.Column('quantity_available', sa.Numeric(12, 4), nullable=False, server_default='0'),
        sa.Column('quantity_withdrawn', sa.Numeric(12, 4), nullable=False, server_default='0'),
        sa.Column('unit_price', sa.Numeric(12, 4), server_default='0'),
        sa.Column('currency', sa.String(3), server_default='INR'),
        sa.Column('last_replenished_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_cs_vendor', 'consignment_stock', ['vendor_id'])
    op.create_index('ix_cs_supplier_product', 'consignment_stock', ['vendor_id', 'supplier_id', 'product_id'])
    op.create_index('ix_cs_plant', 'consignment_stock', ['vendor_id', 'plant_id'])

    # ── Phase 6: Service Entry Sheet ────────────────────────────────────────
    op.create_table(
        'service_entry_sheet',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('vendor_id', UUID(as_uuid=True), sa.ForeignKey('vendor.id', ondelete='CASCADE'), nullable=False),
        sa.Column('purchase_order_id', UUID(as_uuid=True), sa.ForeignKey('purchase_order.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('supplier_id', UUID(as_uuid=True), sa.ForeignKey('supplier.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('entry_number', sa.String(30), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='draft'),
        sa.Column('service_period_from', sa.Date(), nullable=True),
        sa.Column('service_period_to', sa.Date(), nullable=True),
        sa.Column('lines', JSONB, nullable=False, server_default='[]'),
        sa.Column('total_amount', sa.Numeric(14, 2), server_default='0'),
        sa.Column('currency', sa.String(3), server_default='INR'),
        sa.Column('accepted_by', UUID(as_uuid=True), sa.ForeignKey('vendor_user.id', ondelete='SET NULL'), nullable=True),
        sa.Column('accepted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('vendor_id', 'entry_number', name='uq_ses_vendor_entry_number'),
    )
    op.create_index('ix_ses_vendor', 'service_entry_sheet', ['vendor_id'])
    op.create_index('ix_ses_po', 'service_entry_sheet', ['purchase_order_id'])
    op.create_index('ix_ses_status', 'service_entry_sheet', ['vendor_id', 'status'])


# ---------------------------------------------------------------------------
# DOWNGRADE
# ---------------------------------------------------------------------------

def downgrade():
    # Drop in reverse dependency order

    # Phase 6
    op.drop_table('service_entry_sheet')
    op.drop_table('consignment_stock')
    op.drop_table('subcontracting_order')
    op.drop_table('material_valuation')

    # Phase 5
    op.drop_table('goods_movement_document')
    op.drop_table('goods_batch')

    # Phase 4
    op.drop_table('vendor_invoice_item')
    op.drop_table('vendor_invoice')

    # Phase 3d
    op.drop_table('po_delivery_schedule')

    # Phase 3c
    op.drop_index('ix_por_movement', table_name='purchase_order_receipt')
    op.drop_column('purchase_order_receipt', 'posting_date')
    op.drop_column('purchase_order_receipt', 'quality_status')
    op.drop_column('purchase_order_receipt', 'storage_location_id')
    op.drop_column('purchase_order_receipt', 'plant_id')
    op.drop_column('purchase_order_receipt', 'movement_type')

    # Phase 3b
    for col in ['igst_amount', 'sgst_amount', 'cgst_amount', 'igst_rate', 'sgst_rate', 'cgst_rate',
                'tax_code', 'hsn_code', 'account_assignment', 'item_category',
                'storage_location_id', 'plant_id', 'unit_of_measure']:
        op.drop_column('purchase_order_item', col)

    # Phase 3a
    for col in ['audit_log', 'requisition_id', 'delivery_terms', 'payment_terms',
                'igst_amount', 'sgst_amount', 'cgst_amount', 'exchange_rate', 'currency']:
        op.drop_column('purchase_order', col)

    # Phase 2
    op.drop_table('purchase_requisition_approval')
    op.drop_table('purchase_requisition_item')
    op.drop_table('purchase_requisition')

    # Phase 1
    op.drop_table('source_list')
    op.drop_table('purchasing_info_record')
