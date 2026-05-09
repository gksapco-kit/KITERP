"""add booking_id and booking_number to invoice

Revision ID: y6h7i8j9k0l1
Revises: g7h8i9j0k1l2
Create Date: 2026-04-10

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "y6h7i8j9k0l1"
down_revision = "g7h8i9j0k1l2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("invoice", sa.Column("booking_id", UUID(as_uuid=True), nullable=True))
    op.add_column("invoice", sa.Column("booking_number", sa.String(30), nullable=True))
    op.create_index("ix_invoice_booking_id", "invoice", ["booking_id"])


def downgrade() -> None:
    op.drop_index("ix_invoice_booking_id", table_name="invoice")
    op.drop_column("invoice", "booking_number")
    op.drop_column("invoice", "booking_id")
