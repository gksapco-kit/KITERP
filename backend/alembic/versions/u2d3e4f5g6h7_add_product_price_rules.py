"""add product price rules table

Revision ID: u2d3e4f5g6h7
Revises: t1c2d3e4f5g6
Create Date: 2026-04-09
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "u2d3e4f5g6h7"
down_revision = "t1c2d3e4f5g6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "product_price_rule",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("vendor_id", UUID(as_uuid=True), sa.ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False),
        sa.Column("product_id", UUID(as_uuid=True), sa.ForeignKey("product.id", ondelete="CASCADE"), nullable=False),
        sa.Column("variant_id", UUID(as_uuid=True), sa.ForeignKey("product_variant.id", ondelete="SET NULL"), nullable=True),
        sa.Column("rule_type", sa.String(20), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        # Party-wise
        sa.Column("customer_id", UUID(as_uuid=True), nullable=True),
        sa.Column("customer_group", sa.String(100), nullable=True),
        # Location-wise
        sa.Column("state", sa.String(100), nullable=True),
        sa.Column("city", sa.String(100), nullable=True),
        sa.Column("pincode", sa.String(20), nullable=True),
        sa.Column("region", sa.String(100), nullable=True),
        sa.Column("country", sa.String(100), nullable=True),
        # Scheduled
        sa.Column("start_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("end_date", sa.DateTime(timezone=True), nullable=True),
        # Quantity tiers
        sa.Column("min_quantity", sa.Integer(), nullable=True),
        sa.Column("max_quantity", sa.Integer(), nullable=True),
        # Channel
        sa.Column("channel", sa.String(50), nullable=True),
        # Pricing
        sa.Column("price", sa.Numeric(12, 2), nullable=True),
        sa.Column("discount_percentage", sa.Numeric(5, 2), nullable=True),
        sa.Column("discount_amount", sa.Numeric(12, 2), nullable=True),
        sa.Column("priority", sa.Integer(), server_default="0"),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_price_rule_product", "product_price_rule", ["product_id"])
    op.create_index("idx_price_rule_vendor", "product_price_rule", ["vendor_id"])
    op.create_index("idx_price_rule_type", "product_price_rule", ["rule_type"])
    op.create_index("idx_price_rule_active", "product_price_rule", ["is_active"])


def downgrade() -> None:
    op.drop_index("idx_price_rule_active")
    op.drop_index("idx_price_rule_type")
    op.drop_index("idx_price_rule_vendor")
    op.drop_index("idx_price_rule_product")
    op.drop_table("product_price_rule")
