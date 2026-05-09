"""add gstin, pan, company_name, billing_address, opening_balance to customer and supplier

Revision ID: a1g2s3t4p5b6
Revises: z8b9c0d1e2f3
Create Date: 2026-04-11

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "a1g2s3t4p5b6"
down_revision = "z8b9c0d1e2f3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Customer table
    op.add_column("customer", sa.Column("gstin", sa.String(15), nullable=True))
    op.add_column("customer", sa.Column("pan_number", sa.String(10), nullable=True))
    op.add_column("customer", sa.Column("company_name", sa.String(255), nullable=True))
    op.add_column("customer", sa.Column("billing_address", JSONB, server_default=sa.text("'{}'::jsonb"), nullable=True))
    op.add_column("customer", sa.Column("opening_balance", sa.Numeric(12, 2), server_default="0", nullable=True))

    # Supplier table
    op.add_column("supplier", sa.Column("gstin", sa.String(15), nullable=True))
    op.add_column("supplier", sa.Column("pan_number", sa.String(10), nullable=True))
    op.add_column("supplier", sa.Column("opening_balance", sa.Numeric(12, 2), server_default="0", nullable=True))


def downgrade() -> None:
    op.drop_column("supplier", "opening_balance")
    op.drop_column("supplier", "pan_number")
    op.drop_column("supplier", "gstin")

    op.drop_column("customer", "opening_balance")
    op.drop_column("customer", "billing_address")
    op.drop_column("customer", "company_name")
    op.drop_column("customer", "pan_number")
    op.drop_column("customer", "gstin")
