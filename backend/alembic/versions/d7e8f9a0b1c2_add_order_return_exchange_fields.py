"""add order return exchange fields

Revision ID: d7e8f9a0b1c2
Revises: e8f1a2b3c4d5
Create Date: 2026-03-14

"""
from alembic import op
import sqlalchemy as sa

revision = "d7e8f9a0b1c2"
down_revision = "e8f1a2b3c4d5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("order", sa.Column("return_type", sa.String(20), nullable=True))
    op.add_column("order", sa.Column("return_reason", sa.Text(), nullable=True))
    op.add_column("order", sa.Column("return_status", sa.String(30), nullable=True))
    op.add_column("order", sa.Column("return_requested_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("order", sa.Column("return_resolved_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("order", sa.Column("return_notes", sa.Text(), nullable=True))
    op.add_column("order", sa.Column("refund_amount", sa.Numeric(12, 2), server_default="0", nullable=True))


def downgrade() -> None:
    op.drop_column("order", "refund_amount")
    op.drop_column("order", "return_notes")
    op.drop_column("order", "return_resolved_at")
    op.drop_column("order", "return_requested_at")
    op.drop_column("order", "return_status")
    op.drop_column("order", "return_reason")
    op.drop_column("order", "return_type")
