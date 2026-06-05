"""Tier C+ — notification prefs, 2FA, rentals, order disputes

Revision ID: c001_tier_c_plus
Revises: b001_wishlist_customer_subscription
Create Date: 2026-06-05
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "c001_tier_c_plus"
down_revision = "b001_wishlist_customer_subscription"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "customer",
        sa.Column(
            "notification_preferences",
            JSONB,
            server_default=sa.text(
                """'{"orderUpdates"\:true,"promotions"\:false,"newsletters"\:true,"bookingReminders"\:true,"smsEnabled"\:true}'::jsonb"""
            ),
        ),
    )
    op.add_column("user", sa.Column("totp_secret", sa.String(64), nullable=True))
    op.add_column("user", sa.Column("is_2fa_enabled", sa.Boolean(), server_default="false", nullable=False))

    op.create_table(
        "rental_asset",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("vendor_id", UUID(as_uuid=True), sa.ForeignKey("vendor.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("sku", sa.String(100), nullable=True),
        sa.Column("product_id", UUID(as_uuid=True), sa.ForeignKey("product.id"), nullable=True),
        sa.Column("daily_rate", sa.Numeric(12, 2), server_default="0"),
        sa.Column("deposit_amount", sa.Numeric(12, 2), server_default="0"),
        sa.Column("status", sa.String(20), server_default="available"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_rental_asset_vendor", "rental_asset", ["vendor_id"])

    op.create_table(
        "rental_booking",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("vendor_id", UUID(as_uuid=True), sa.ForeignKey("vendor.id"), nullable=False),
        sa.Column("customer_id", UUID(as_uuid=True), sa.ForeignKey("customer.id"), nullable=True),
        sa.Column("asset_id", UUID(as_uuid=True), sa.ForeignKey("rental_asset.id"), nullable=False),
        sa.Column("customer_name", sa.String(255), nullable=False),
        sa.Column("customer_email", sa.String(255), nullable=True),
        sa.Column("customer_phone", sa.String(20), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(20), server_default="pending"),
        sa.Column("total_amount", sa.Numeric(12, 2), server_default="0"),
        sa.Column("deposit_amount", sa.Numeric(12, 2), server_default="0"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_rental_booking_vendor", "rental_booking", ["vendor_id"])

    op.create_table(
        "order_dispute",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("order_id", UUID(as_uuid=True), sa.ForeignKey("order.id"), nullable=False),
        sa.Column("vendor_id", UUID(as_uuid=True), sa.ForeignKey("vendor.id"), nullable=False),
        sa.Column("customer_id", UUID(as_uuid=True), sa.ForeignKey("customer.id"), nullable=True),
        sa.Column("dispute_type", sa.String(30), server_default="general"),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("status", sa.String(20), server_default="open"),
        sa.Column("amount", sa.Numeric(12, 2), nullable=True),
        sa.Column("resolution_notes", sa.Text(), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_order_dispute_status", "order_dispute", ["status"])
    op.create_index("ix_order_dispute_vendor", "order_dispute", ["vendor_id"])


def downgrade() -> None:
    op.drop_index("ix_order_dispute_vendor", table_name="order_dispute")
    op.drop_index("ix_order_dispute_status", table_name="order_dispute")
    op.drop_table("order_dispute")
    op.drop_index("ix_rental_booking_vendor", table_name="rental_booking")
    op.drop_table("rental_booking")
    op.drop_index("ix_rental_asset_vendor", table_name="rental_asset")
    op.drop_table("rental_asset")
    op.drop_column("user", "is_2fa_enabled")
    op.drop_column("user", "totp_secret")
    op.drop_column("customer", "notification_preferences")
