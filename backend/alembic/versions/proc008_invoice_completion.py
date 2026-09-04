"""Procurement Phase 8: Purchase Invoice completion

Revision ID: proc008_invoice_completion
Revises: proc007_po_approval
Create Date: 2026-09-01

Adds:
  vendor_invoice.payment_status        – tracks payment state
  vendor_invoice.paid_amount           – amount paid so far
  vendor_invoice.payment_due_date      – due date for payment
  vendor_invoice.tds_rate              – TDS percentage
  vendor_invoice.tds_amount            – TDS deducted
  vendor_invoice.net_payable           – payable after TDS
  vendor_invoice.fin_vendor_bill_id    – link to FinVendorBill for payment tracking
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = 'proc008_invoice_completion'
down_revision = 'proc007_po_approval'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('vendor_invoice',
        sa.Column('payment_status', sa.String(20), server_default='unpaid', nullable=False))
    # unpaid | partial | paid | overdue | cancelled

    op.add_column('vendor_invoice',
        sa.Column('paid_amount', sa.Numeric(14, 2), server_default='0', nullable=False))

    op.add_column('vendor_invoice',
        sa.Column('payment_due_date', sa.Date, nullable=True))

    # TDS
    op.add_column('vendor_invoice',
        sa.Column('tds_rate', sa.Numeric(6, 2), server_default='0', nullable=False))
    op.add_column('vendor_invoice',
        sa.Column('tds_amount', sa.Numeric(12, 2), server_default='0', nullable=False))
    op.add_column('vendor_invoice',
        sa.Column('net_payable', sa.Numeric(14, 2), server_default='0', nullable=False))

    # Link to FinVendorBill for payment lifecycle
    op.add_column('vendor_invoice',
        sa.Column('fin_vendor_bill_id', UUID(as_uuid=True),
                  sa.ForeignKey('fin_vendor_bill.id', ondelete='SET NULL'), nullable=True))

    op.create_index('ix_vi_payment_status', 'vendor_invoice', ['vendor_id', 'payment_status'],
                    postgresql_where=sa.text("payment_status != 'paid'"))
    op.create_index('ix_vi_fin_bill', 'vendor_invoice', ['fin_vendor_bill_id'],
                    postgresql_where=sa.text('fin_vendor_bill_id IS NOT NULL'))


def downgrade():
    op.drop_index('ix_vi_fin_bill', table_name='vendor_invoice')
    op.drop_index('ix_vi_payment_status', table_name='vendor_invoice')
    op.drop_column('vendor_invoice', 'fin_vendor_bill_id')
    op.drop_column('vendor_invoice', 'net_payable')
    op.drop_column('vendor_invoice', 'tds_amount')
    op.drop_column('vendor_invoice', 'tds_rate')
    op.drop_column('vendor_invoice', 'payment_due_date')
    op.drop_column('vendor_invoice', 'paid_amount')
    op.drop_column('vendor_invoice', 'payment_status')
