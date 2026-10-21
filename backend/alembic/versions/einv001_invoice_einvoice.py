"""einv001 – store GST e-invoice (IRN) result on the sales invoice

Revision ID: einv001_invoice_einvoice
Revises: sinv001_invoice_date_posting_date
Create Date: 2026-10-21
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "einv001_invoice_einvoice"
down_revision = "sinv001_invoice_date_posting_date"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("invoice", sa.Column("einvoice", JSONB(), nullable=True))


def downgrade():
    op.drop_column("invoice", "einvoice")
