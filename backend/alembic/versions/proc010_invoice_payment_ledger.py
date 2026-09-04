"""Procurement Phase 10: Invoice payment ledger

Revision ID: proc010_invoice_payment_ledger
Revises: proc009_purchase_return
Create Date: 2026-09-02

Creates:
  vendor_invoice_payment  – one row per payment event against a vendor invoice.
    Each row gets its own UUID which is used as the GL journal entry source_id,
    making partial payments idempotent and individually reversible.

Also updates vendor_invoice:
  - adds payments relationship FK index
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = 'proc010_invoice_payment_ledger'
down_revision = 'proc009_purchase_return'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'vendor_invoice_payment',
        sa.Column('id', UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('vendor_id', UUID(as_uuid=True),
                  sa.ForeignKey('vendor.id', ondelete='CASCADE'), nullable=False),
        sa.Column('invoice_id', UUID(as_uuid=True),
                  sa.ForeignKey('vendor_invoice.id', ondelete='CASCADE'), nullable=False),
        sa.Column('supplier_id', UUID(as_uuid=True),
                  sa.ForeignKey('supplier.id', ondelete='RESTRICT'), nullable=True),

        # Payment detail
        sa.Column('amount', sa.Numeric(14, 2), nullable=False),
        sa.Column('payment_date', sa.Date, nullable=False),
        sa.Column('payment_mode', sa.String(30), nullable=True),   # bank_transfer | cheque | upi | cash | rtgs
        sa.Column('payment_reference', sa.String(100), nullable=True),  # UTR / cheque no / etc.

        # GL link — set when journal entry is successfully posted
        sa.Column('journal_entry_id', UUID(as_uuid=True),
                  sa.ForeignKey('fin_journal_entry.id', ondelete='SET NULL'), nullable=True),

        sa.Column('created_by', UUID(as_uuid=True),
                  sa.ForeignKey('vendor_user.id', ondelete='SET NULL'), nullable=True),
        sa.Column('notes', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.text('now()'), nullable=False),
    )

    op.create_index('ix_vip_invoice', 'vendor_invoice_payment', ['invoice_id'])
    op.create_index('ix_vip_vendor',  'vendor_invoice_payment', ['vendor_id'])
    op.create_index('ix_vip_supplier','vendor_invoice_payment', ['supplier_id'])


def downgrade():
    op.drop_index('ix_vip_supplier', table_name='vendor_invoice_payment')
    op.drop_index('ix_vip_vendor',   table_name='vendor_invoice_payment')
    op.drop_index('ix_vip_invoice',  table_name='vendor_invoice_payment')
    op.drop_table('vendor_invoice_payment')
