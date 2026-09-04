"""Procurement Phase 11: PO approver_message + approval created_at

Revision ID: proc011_po_approver_message
Revises: proc010_invoice_payment_ledger
Create Date: 2026-09-02

Adds:
  purchase_order.approver_message      – message from requester to approver(s)
  purchase_order_approval.created_at   – timestamp when the approval step was created
"""
from alembic import op
import sqlalchemy as sa

revision = 'proc011_po_approver_message'
down_revision = 'proc010_invoice_payment_ledger'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('purchase_order',
        sa.Column('approver_message', sa.Text, nullable=True))
    op.add_column('purchase_order_approval',
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=True))


def downgrade():
    op.drop_column('purchase_order_approval', 'created_at')
    op.drop_column('purchase_order', 'approver_message')
