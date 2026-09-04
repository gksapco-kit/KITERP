"""Add org-dimension FKs (company, branch, plant) to PO, Invoice and PR headers.

Revision ID: proc015_doc_org_dimensions
Revises: proc014_rfq_item_service_id
Create Date: 2026-09-03

Adds:
  purchase_order  : company_id, branch_id (→ store.id), plant_id
  vendor_invoice  : company_id, branch_id (→ store.id), plant_id
  purchase_requisition : company_id, plant_id
    (branch already covered by existing store_id)

All nullable so existing rows are unaffected.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = 'proc015_doc_org_dimensions'
down_revision = 'proc014_rfq_item_service_id'
branch_labels = None
depends_on = None


def upgrade():
    # ── purchase_order ──────────────────────────────────────────────
    op.add_column('purchase_order', sa.Column(
        'company_id', UUID(as_uuid=True),
        sa.ForeignKey('fin_company.id', ondelete='SET NULL'),
        nullable=True,
    ))
    op.add_column('purchase_order', sa.Column(
        'branch_id', UUID(as_uuid=True),
        sa.ForeignKey('store.id', ondelete='SET NULL'),
        nullable=True,
    ))
    op.add_column('purchase_order', sa.Column(
        'plant_id', UUID(as_uuid=True),
        sa.ForeignKey('plant.id', ondelete='SET NULL'),
        nullable=True,
    ))
    op.create_index('ix_po_company', 'purchase_order', ['vendor_id', 'company_id'])
    op.create_index('ix_po_branch',  'purchase_order', ['vendor_id', 'branch_id'])
    op.create_index('ix_po_plant',   'purchase_order', ['vendor_id', 'plant_id'])

    # ── vendor_invoice ───────────────────────────────────────────────
    op.add_column('vendor_invoice', sa.Column(
        'company_id', UUID(as_uuid=True),
        sa.ForeignKey('fin_company.id', ondelete='SET NULL'),
        nullable=True,
    ))
    op.add_column('vendor_invoice', sa.Column(
        'branch_id', UUID(as_uuid=True),
        sa.ForeignKey('store.id', ondelete='SET NULL'),
        nullable=True,
    ))
    op.add_column('vendor_invoice', sa.Column(
        'plant_id', UUID(as_uuid=True),
        sa.ForeignKey('plant.id', ondelete='SET NULL'),
        nullable=True,
    ))
    op.create_index('ix_vi_company', 'vendor_invoice', ['vendor_id', 'company_id'])
    op.create_index('ix_vi_branch',  'vendor_invoice', ['vendor_id', 'branch_id'])
    op.create_index('ix_vi_plant',   'vendor_invoice', ['vendor_id', 'plant_id'])

    # ── purchase_requisition ─────────────────────────────────────────
    # store_id already acts as branch; add company + plant at header level.
    op.add_column('purchase_requisition', sa.Column(
        'company_id', UUID(as_uuid=True),
        sa.ForeignKey('fin_company.id', ondelete='SET NULL'),
        nullable=True,
    ))
    op.add_column('purchase_requisition', sa.Column(
        'plant_id', UUID(as_uuid=True),
        sa.ForeignKey('plant.id', ondelete='SET NULL'),
        nullable=True,
    ))
    op.create_index('ix_pr_company', 'purchase_requisition', ['vendor_id', 'company_id'])
    op.create_index('ix_pr_plant',   'purchase_requisition', ['vendor_id', 'plant_id'])


def downgrade():
    op.drop_index('ix_pr_plant',    table_name='purchase_requisition')
    op.drop_index('ix_pr_company',  table_name='purchase_requisition')
    op.drop_column('purchase_requisition', 'plant_id')
    op.drop_column('purchase_requisition', 'company_id')

    op.drop_index('ix_vi_plant',    table_name='vendor_invoice')
    op.drop_index('ix_vi_branch',   table_name='vendor_invoice')
    op.drop_index('ix_vi_company',  table_name='vendor_invoice')
    op.drop_column('vendor_invoice', 'plant_id')
    op.drop_column('vendor_invoice', 'branch_id')
    op.drop_column('vendor_invoice', 'company_id')

    op.drop_index('ix_po_plant',    table_name='purchase_order')
    op.drop_index('ix_po_branch',   table_name='purchase_order')
    op.drop_index('ix_po_company',  table_name='purchase_order')
    op.drop_column('purchase_order', 'plant_id')
    op.drop_column('purchase_order', 'branch_id')
    op.drop_column('purchase_order', 'company_id')
