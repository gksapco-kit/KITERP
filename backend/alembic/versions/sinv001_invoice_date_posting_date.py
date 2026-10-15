"""sinv001 – add invoice_date and posting_date to invoice

Revision ID: sinv001_invoice_date_posting_date
Revises: z8b9c0d1e2f3
Create Date: 2026-10-15
"""
from alembic import op
import sqlalchemy as sa

revision = 'sinv001_invoice_date_posting_date'
down_revision = 'z8b9c0d1e2f3'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'invoice',
        sa.Column('invoice_date', sa.Date(), nullable=True),
    )
    op.add_column(
        'invoice',
        sa.Column('posting_date', sa.Date(), nullable=True),
    )


def downgrade():
    op.drop_column('invoice', 'posting_date')
    op.drop_column('invoice', 'invoice_date')
