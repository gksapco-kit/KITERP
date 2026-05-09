"""add variant subscription fields

Revision ID: v3e4f5g6h7i8
Revises: u2d3e4f5g6h7
Create Date: 2026-04-10

"""
from alembic import op
import sqlalchemy as sa

revision = "v3e4f5g6h7i8"
down_revision = "u2d3e4f5g6h7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("product_variant", sa.Column("subscription_interval", sa.String(20), nullable=True))
    op.add_column("product_variant", sa.Column("subscription_trial_days", sa.Integer(), nullable=True))
    op.add_column("product_variant", sa.Column("subscription_setup_fee", sa.Numeric(12, 2), nullable=True))
    op.add_column("product_variant", sa.Column("subscription_billing_cycles", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("product_variant", "subscription_billing_cycles")
    op.drop_column("product_variant", "subscription_setup_fee")
    op.drop_column("product_variant", "subscription_trial_days")
    op.drop_column("product_variant", "subscription_interval")
