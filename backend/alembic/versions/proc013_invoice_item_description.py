"""Allow free-text vendor invoice lines (optional product_id + description/uom)

Revision ID: proc013_invoice_item_description
Revises: proc012_invoice_approval
Create Date: 2026-09-02

Makes vendor_invoice_item.product_id nullable so AP invoices can be created
from description-only lines (no catalog product). Adds description, uom,
and line_number columns expected by the vendor-web create form.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = 'proc013_invoice_item_description'
down_revision = 'proc012_invoice_approval'
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column(
        'vendor_invoice_item',
        'product_id',
        existing_type=UUID(as_uuid=True),
        nullable=True,
    )
    op.add_column(
        'vendor_invoice_item',
        sa.Column('line_number', sa.Integer(), server_default='1', nullable=False),
    )
    op.add_column(
        'vendor_invoice_item',
        sa.Column('description', sa.String(500), nullable=True),
    )
    op.add_column(
        'vendor_invoice_item',
        sa.Column('uom', sa.String(20), server_default='PCS', nullable=True),
    )


def downgrade():
    op.drop_column('vendor_invoice_item', 'uom')
    op.drop_column('vendor_invoice_item', 'description')
    op.drop_column('vendor_invoice_item', 'line_number')
    op.alter_column(
        'vendor_invoice_item',
        'product_id',
        existing_type=UUID(as_uuid=True),
        nullable=False,
    )
