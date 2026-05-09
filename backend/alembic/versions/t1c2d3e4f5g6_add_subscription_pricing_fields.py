"""add subscription pricing fields

Revision ID: t1c2d3e4f5g6
Revises: s0b1c2d3e4f5
Create Date: 2026-04-09
"""
from alembic import op
import sqlalchemy as sa

revision = "t1c2d3e4f5g6"
down_revision = "s0b1c2d3e4f5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("product", sa.Column("subscription_trial_days", sa.Integer(), nullable=True))
    op.add_column("product", sa.Column("subscription_setup_fee", sa.Numeric(12, 2), nullable=True))
    op.add_column("product", sa.Column("subscription_billing_cycles", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("product", "subscription_billing_cycles")
    op.drop_column("product", "subscription_setup_fee")
    op.drop_column("product", "subscription_trial_days")
