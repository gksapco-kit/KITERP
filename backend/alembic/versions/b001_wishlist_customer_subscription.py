"""wishlist and customer_subscription tables

Revision ID: b001_wishlist_customer_subscription
Revises: p2a3d4d5o6n7
Create Date: 2026-06-05
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "b001_wishlist_customer_subscription"
down_revision = "p2a3d4d5o6n7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "wishlist",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("vendor_id", UUID(as_uuid=True), sa.ForeignKey("vendor.id"), nullable=False),
        sa.Column("customer_id", UUID(as_uuid=True), sa.ForeignKey("customer.id"), nullable=False),
        sa.Column("items", JSONB, server_default="[]"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_wishlist_vendor_id", "wishlist", ["vendor_id"])
    op.create_index("ix_wishlist_customer_id", "wishlist", ["customer_id"])
    op.create_index("ix_wishlist_vendor_customer", "wishlist", ["vendor_id", "customer_id"], unique=True)

    op.create_table(
        "customer_subscription",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("vendor_id", UUID(as_uuid=True), sa.ForeignKey("vendor.id"), nullable=False),
        sa.Column("customer_id", UUID(as_uuid=True), sa.ForeignKey("customer.id"), nullable=False),
        sa.Column("item_type", sa.String(20), nullable=False),
        sa.Column("product_id", UUID(as_uuid=True), sa.ForeignKey("product.id"), nullable=True),
        sa.Column("variant_id", UUID(as_uuid=True), sa.ForeignKey("product_variant.id"), nullable=True),
        sa.Column("service_id", UUID(as_uuid=True), sa.ForeignKey("service.id"), nullable=True),
        sa.Column("item_name", sa.String(500), nullable=False),
        sa.Column("interval", sa.String(30), nullable=False),
        sa.Column("price_per_cycle", sa.Numeric(12, 2), nullable=False),
        sa.Column("qty", sa.Integer(), server_default="1"),
        sa.Column("currency", sa.String(10), server_default="INR"),
        sa.Column("status", sa.String(20), server_default="active"),
        sa.Column("schedule_config", JSONB, server_default="{}"),
        sa.Column("trial_ends_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("current_period_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("current_period_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("next_billing_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_customer_subscription_vendor_id", "customer_subscription", ["vendor_id"])
    op.create_index("ix_customer_subscription_customer_id", "customer_subscription", ["customer_id"])
    op.create_index(
        "ix_customer_subscription_vendor_status",
        "customer_subscription",
        ["vendor_id", "status"],
    )
    op.create_index(
        "ix_customer_subscription_customer",
        "customer_subscription",
        ["customer_id", "status"],
    )


def downgrade() -> None:
    op.drop_index("ix_customer_subscription_customer", table_name="customer_subscription")
    op.drop_index("ix_customer_subscription_vendor_status", table_name="customer_subscription")
    op.drop_index("ix_customer_subscription_customer_id", table_name="customer_subscription")
    op.drop_index("ix_customer_subscription_vendor_id", table_name="customer_subscription")
    op.drop_table("customer_subscription")
    op.drop_index("ix_wishlist_vendor_customer", table_name="wishlist")
    op.drop_index("ix_wishlist_customer_id", table_name="wishlist")
    op.drop_index("ix_wishlist_vendor_id", table_name="wishlist")
    op.drop_table("wishlist")
