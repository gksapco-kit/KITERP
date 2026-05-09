"""add order_number to invoice

Revision ID: z8b9c0d1e2f3
Revises: y6h7i8j9k0l1
Create Date: 2026-04-10

"""
from alembic import op
import sqlalchemy as sa

revision = "z8b9c0d1e2f3"
down_revision = "y6h7i8j9k0l1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("invoice", sa.Column("order_number", sa.String(30), nullable=True))


def downgrade() -> None:
    op.drop_column("invoice", "order_number")
