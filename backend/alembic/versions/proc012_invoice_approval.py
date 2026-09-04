"""Procurement Phase 12: Vendor invoice approval workflow

Revision ID: proc012_invoice_approval
Revises: proc011_po_approver_message
Create Date: 2026-09-02

Adds:
  vendor_invoice.approval_status         – not_required | pending | approved | rejected
  vendor_invoice.approved_by             – FK to vendor_user.id
  vendor_invoice.approved_at
  vendor_invoice.approval_required_above – threshold amount
  vendor_invoice.approver_message        – message from requester to approver
  vendor_invoice_approval                – multi-step approval log (mirrors purchase_order_approval)
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = 'proc012_invoice_approval'
down_revision = 'proc011_po_approver_message'
branch_labels = None
depends_on = None


def upgrade():
    # ── Extend vendor_invoice with approval columns ────────────────
    op.add_column('vendor_invoice',
        sa.Column('approval_status', sa.String(30), server_default='not_required', nullable=False))
    # not_required | pending | approved | rejected

    op.add_column('vendor_invoice',
        sa.Column('approved_by', UUID(as_uuid=True),
                  sa.ForeignKey('vendor_user.id', ondelete='SET NULL'), nullable=True))
    op.add_column('vendor_invoice',
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('vendor_invoice',
        sa.Column('approval_required_above', sa.Numeric(14, 2), nullable=True))
    op.add_column('vendor_invoice',
        sa.Column('approver_message', sa.Text, nullable=True))

    op.create_index('ix_vi_approval_status', 'vendor_invoice', ['vendor_id', 'approval_status'])

    # ── vendor_invoice_approval: per-step approval log ─────────────
    op.create_table(
        'vendor_invoice_approval',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('invoice_id', UUID(as_uuid=True),
                  sa.ForeignKey('vendor_invoice.id', ondelete='CASCADE'), nullable=False),
        sa.Column('level', sa.Integer, server_default='1', nullable=False),
        sa.Column('approver_id', UUID(as_uuid=True),
                  sa.ForeignKey('vendor_user.id', ondelete='SET NULL'), nullable=True),
        sa.Column('status', sa.String(20), server_default='pending', nullable=False),
        # pending | approved | rejected
        sa.Column('comments', sa.Text, nullable=True),
        sa.Column('actioned_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=True),
    )
    op.create_index('ix_via_invoice', 'vendor_invoice_approval', ['invoice_id'])
    op.create_index('ix_via_approver', 'vendor_invoice_approval', ['approver_id', 'status'])


def downgrade():
    op.drop_table('vendor_invoice_approval')
    op.drop_index('ix_vi_approval_status', table_name='vendor_invoice')
    op.drop_column('vendor_invoice', 'approver_message')
    op.drop_column('vendor_invoice', 'approval_required_above')
    op.drop_column('vendor_invoice', 'approved_at')
    op.drop_column('vendor_invoice', 'approved_by')
    op.drop_column('vendor_invoice', 'approval_status')
