"""Add service_id column to rfq_item so service lines can be catalogued

Revision ID: proc014_rfq_item_service_id
Revises: proc013_invoice_item_description
Create Date: 2026-09-02

The rfq_item table already supports product_id/variant_id for product lines
and free-text description for non-catalogued items. This migration adds
service_id so that service-type RFQ lines can reference the service catalog
with proper FK traceability, mirroring purchase_requisition_item.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = 'proc014_rfq_item_service_id'
down_revision = 'proc013_invoice_item_description'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'rfq_item',
        sa.Column(
            'service_id',
            UUID(as_uuid=True),
            sa.ForeignKey('service.id', ondelete='RESTRICT'),
            nullable=True,
        ),
    )
    op.create_index('ix_rfq_item_service', 'rfq_item', ['service_id'])


def downgrade():
    op.drop_index('ix_rfq_item_service', table_name='rfq_item')
    op.drop_column('rfq_item', 'service_id')
