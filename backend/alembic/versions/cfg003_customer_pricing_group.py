"""add customer_group to customer (drives party price-rule matching)

Revision ID: cfg003_customer_pricing_group
Revises: cfg002_variant_generator_columns
Create Date: 2026-07-10
"""
from alembic import op
import sqlalchemy as sa

revision = "cfg003_customer_pricing_group"
down_revision = "cfg002_variant_generator_columns"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "customer",
        sa.Column("customer_group", sa.String(50), server_default="retail", nullable=True),
    )
    op.create_index("ix_customer_group", "customer", ["vendor_id", "customer_group"])


def downgrade() -> None:
    op.drop_index("ix_customer_group", table_name="customer")
    op.drop_column("customer", "customer_group")
