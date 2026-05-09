"""add invoice_template

Revision ID: h9b0c1d2e3f4
Revises: g8a9b0c1d2e3
Create Date: 2026-03-29 16:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision: str = 'h9b0c1d2e3f4'
down_revision: Union[str, None] = 'g8a9b0c1d2e3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DEFAULT_SECTIONS = {
    "show_logo": True,
    "show_header": True,
    "show_customer_details": True,
    "show_customer_gstin": True,
    "show_shipping_address": True,
    "show_bank_details": True,
    "show_signature": True,
    "show_tax_breakdown": True,
    "show_notes": True,
    "show_terms": True,
}


def upgrade() -> None:
    op.create_table(
        'invoice_template',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('vendor_id', UUID(as_uuid=True), sa.ForeignKey('vendor.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('is_default', sa.Boolean(), server_default=sa.text('false')),
        sa.Column('sections', JSONB, server_default=sa.text(f"'{sa.text(str(DEFAULT_SECTIONS).replace(chr(39), chr(34))).text}'::jsonb") if False else None),
        sa.Column('bank_details', JSONB, nullable=True),
        sa.Column('signature_url', sa.Text(), nullable=True),
        sa.Column('header_text', sa.Text(), nullable=True),
        sa.Column('footer_text', sa.Text(), nullable=True),
        sa.Column('terms_text', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('invoice_template')
