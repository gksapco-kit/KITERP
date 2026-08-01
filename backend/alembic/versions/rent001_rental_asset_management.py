"""Expand rental_asset / rental_booking for full rental asset management.

Revision ID: rent001_rental_asset_management
Revises: rmenu001_restaurant_menu_tables
Create Date: 2026-08-01

Adds capacity, pricing tiers, location, payment, and delivery-van tracking fields.
Idempotent column adds so it is safe on partially migrated databases.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect
from sqlalchemy.dialects.postgresql import JSONB

revision = "rent001_rental_asset_management"
down_revision = "rmenu001_restaurant_menu_tables"
branch_labels = None
depends_on = None


def _has_column(insp, table: str, column: str) -> bool:
    if not insp.has_table(table):
        return False
    return any(c["name"] == column for c in insp.get_columns(table))


def _add(insp, table: str, column: str, col):
    if not _has_column(insp, table, column):
        op.add_column(table, col)


def upgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)

    if not insp.has_table("rental_asset"):
        return

    # --- rental_asset ---
    _add(insp, "rental_asset", "asset_code", sa.Column("asset_code", sa.String(50), nullable=True))
    _add(insp, "rental_asset", "category", sa.Column("category", sa.String(50), server_default="milk_dairy"))
    _add(insp, "rental_asset", "asset_type", sa.Column("asset_type", sa.String(80), server_default="storage_rack"))
    _add(insp, "rental_asset", "description", sa.Column("description", sa.Text(), nullable=True))
    _add(insp, "rental_asset", "capacity_max", sa.Column("capacity_max", sa.Numeric(12, 2), server_default="1"))
    _add(insp, "rental_asset", "capacity_unit", sa.Column("capacity_unit", sa.String(40), server_default="units"))
    _add(insp, "rental_asset", "current_occupancy", sa.Column("current_occupancy", sa.Numeric(12, 2), server_default="0"))
    _add(insp, "rental_asset", "max_weight", sa.Column("max_weight", sa.Numeric(12, 2), nullable=True))
    _add(insp, "rental_asset", "weight_unit", sa.Column("weight_unit", sa.String(20), server_default="kg"))
    _add(insp, "rental_asset", "weekly_rate", sa.Column("weekly_rate", sa.Numeric(12, 2), server_default="0"))
    _add(insp, "rental_asset", "monthly_rate", sa.Column("monthly_rate", sa.Numeric(12, 2), server_default="0"))
    _add(insp, "rental_asset", "extra_qty_charge", sa.Column("extra_qty_charge", sa.Numeric(12, 2), server_default="0"))
    _add(insp, "rental_asset", "extra_weight_charge", sa.Column("extra_weight_charge", sa.Numeric(12, 2), server_default="0"))
    _add(insp, "rental_asset", "location", sa.Column("location", sa.String(255), nullable=True))
    _add(insp, "rental_asset", "section", sa.Column("section", sa.String(100), nullable=True))
    _add(insp, "rental_asset", "row_label", sa.Column("row_label", sa.String(100), nullable=True))
    _add(insp, "rental_asset", "rack_number", sa.Column("rack_number", sa.String(50), nullable=True))
    _add(insp, "rental_asset", "image_url", sa.Column("image_url", sa.String(500), nullable=True))
    _add(insp, "rental_asset", "is_active", sa.Column("is_active", sa.Boolean(), server_default="true"))
    _add(insp, "rental_asset", "display_start_date", sa.Column("display_start_date", sa.Date(), nullable=True))
    _add(insp, "rental_asset", "display_end_date", sa.Column("display_end_date", sa.Date(), nullable=True))

    # Widen status column if needed (was String(20))
    try:
        op.alter_column("rental_asset", "status", type_=sa.String(30), existing_type=sa.String(20), existing_nullable=True)
    except Exception:
        pass

    if not insp.has_table("rental_booking"):
        return

    insp = inspect(bind)
    _add(insp, "rental_booking", "booking_number", sa.Column("booking_number", sa.String(40), nullable=True))
    _add(insp, "rental_booking", "quantity", sa.Column("quantity", sa.Numeric(12, 2), server_default="1"))
    _add(insp, "rental_booking", "weight_requested", sa.Column("weight_requested", sa.Numeric(12, 2), nullable=True))
    _add(insp, "rental_booking", "pricing_plan", sa.Column("pricing_plan", sa.String(20), server_default="daily"))
    _add(insp, "rental_booking", "rental_amount", sa.Column("rental_amount", sa.Numeric(12, 2), server_default="0"))
    _add(insp, "rental_booking", "payment_status", sa.Column("payment_status", sa.String(20), server_default="unpaid"))
    _add(insp, "rental_booking", "payment_method", sa.Column("payment_method", sa.String(40), nullable=True))
    _add(insp, "rental_booking", "payment_reference", sa.Column("payment_reference", sa.String(100), nullable=True))
    _add(insp, "rental_booking", "paid_at", sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True))
    _add(insp, "rental_booking", "delivery_status", sa.Column("delivery_status", sa.String(30), server_default="not_required"))
    _add(insp, "rental_booking", "van_number", sa.Column("van_number", sa.String(50), nullable=True))
    _add(insp, "rental_booking", "van_driver_name", sa.Column("van_driver_name", sa.String(120), nullable=True))
    _add(insp, "rental_booking", "van_driver_phone", sa.Column("van_driver_phone", sa.String(20), nullable=True))
    _add(insp, "rental_booking", "van_vehicle_type", sa.Column("van_vehicle_type", sa.String(80), nullable=True))
    _add(insp, "rental_booking", "estimated_delivery_at", sa.Column("estimated_delivery_at", sa.DateTime(timezone=True), nullable=True))
    _add(insp, "rental_booking", "delivered_at", sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True))
    _add(insp, "rental_booking", "delivery_notes", sa.Column("delivery_notes", sa.Text(), nullable=True))
    _add(insp, "rental_booking", "delivery_address", sa.Column("delivery_address", sa.Text(), nullable=True))
    _add(insp, "rental_booking", "timeline", sa.Column("timeline", JSONB(), server_default="[]"))


def downgrade() -> None:
    # Non-destructive: keep expanded columns.
    pass
