"""Procurement Phase 6: PO approval workflow

Revision ID: proc007_po_approval
Revises: proc006_grn_document
Create Date: 2026-09-01

Adds:
  purchase_order.approval_status      – tracks approval state
  purchase_order.approved_by          – who approved
  purchase_order.approved_at          – when approved
  purchase_order.approval_required_above – threshold amount that triggers approval
  purchase_order_approval             – multi-step approval log (like PR)
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = 'proc007_po_approval'
down_revision = 'proc006_grn_document'
branch_labels = None
depends_on = None


def upgrade():
    # ── Extend purchase_order with approval columns ────────────────
    op.add_column('purchase_order',
        sa.Column('approval_status', sa.String(30), server_default='not_required', nullable=False))
    # not_required | pending | approved | rejected

    op.add_column('purchase_order',
        sa.Column('approved_by', UUID(as_uuid=True),
                  sa.ForeignKey('vendor_user.id', ondelete='SET NULL'), nullable=True))
    op.add_column('purchase_order',
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('purchase_order',
        sa.Column('approval_required_above', sa.Numeric(14, 2), nullable=True))

    op.create_index('ix_po_approval_status', 'purchase_order', ['vendor_id', 'approval_status'])

    # ── PO approval steps ─────────────────────────────────────────
    op.create_table(
        'purchase_order_approval',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('purchase_order_id', UUID(as_uuid=True),
                  sa.ForeignKey('purchase_order.id', ondelete='CASCADE'), nullable=False),
        sa.Column('level', sa.Integer, server_default='1', nullable=False),
        sa.Column('approver_id', UUID(as_uuid=True),
                  sa.ForeignKey('vendor_user.id', ondelete='SET NULL'), nullable=True),
        sa.Column('status', sa.String(20), server_default='pending', nullable=False),
        # pending | approved | rejected
        sa.Column('comments', sa.Text, nullable=True),
        sa.Column('actioned_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_po_approval_po', 'purchase_order_approval', ['purchase_order_id'])
    op.create_index('ix_po_approval_approver', 'purchase_order_approval', ['approver_id', 'status'])


def downgrade():
    op.drop_table('purchase_order_approval')
    op.drop_index('ix_po_approval_status', table_name='purchase_order')
    op.drop_column('purchase_order', 'approval_required_above')
    op.drop_column('purchase_order', 'approved_at')
    op.drop_column('purchase_order', 'approved_by')
    op.drop_column('purchase_order', 'approval_status')
