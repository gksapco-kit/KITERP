"""add plan override columns to service_plan

Revision ID: a1b2c3d4e5f6
Revises: z7a8b9c0d1e2
Create Date: 2026-04-10
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "b2p3l4n5o6v7"
down_revision = "z7a8b9c0d1e2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("service_plan", sa.Column("service_frequency", sa.String(20), server_default="once"))
    op.add_column("service_plan", sa.Column("service_mode", sa.String(30), server_default="in_store"))
    op.add_column("service_plan", sa.Column("buffer_minutes", sa.Integer(), server_default="0"))
    op.add_column("service_plan", sa.Column("service_capacity", sa.Integer(), server_default="1"))
    # Pricing overrides
    op.add_column("service_plan", sa.Column("plan_price_type", sa.String(20), nullable=True))
    op.add_column("service_plan", sa.Column("price_min", sa.Numeric(12, 2), nullable=True))
    op.add_column("service_plan", sa.Column("price_max", sa.Numeric(12, 2), nullable=True))
    op.add_column("service_plan", sa.Column("currency", sa.String(3), server_default="INR"))
    op.add_column("service_plan", sa.Column("discount_percentage", sa.Numeric(5, 2), nullable=True))
    op.add_column("service_plan", sa.Column("discount_amount", sa.Numeric(12, 2), nullable=True))
    op.add_column("service_plan", sa.Column("offer_label", sa.String(100), nullable=True))
    op.add_column("service_plan", sa.Column("discount_start_date", sa.Text(), nullable=True))
    op.add_column("service_plan", sa.Column("discount_end_date", sa.Text(), nullable=True))
    # Tax overrides
    op.add_column("service_plan", sa.Column("is_taxable", sa.Boolean(), nullable=True))
    op.add_column("service_plan", sa.Column("tax_rate", sa.Numeric(5, 2), nullable=True))
    op.add_column("service_plan", sa.Column("sac_code", sa.String(8), nullable=True))
    op.add_column("service_plan", sa.Column("gst_rate", sa.Numeric(5, 2), nullable=True))
    # Booking overrides
    op.add_column("service_plan", sa.Column("requires_booking", sa.Boolean(), nullable=True))
    op.add_column("service_plan", sa.Column("max_bookings_per_slot", sa.Integer(), nullable=True))
    op.add_column("service_plan", sa.Column("advance_booking_days", sa.Integer(), nullable=True))
    op.add_column("service_plan", sa.Column("booking_lead_time_hours", sa.Integer(), nullable=True))
    op.add_column("service_plan", sa.Column("cancellation_policy", sa.Text(), nullable=True))
    op.add_column("service_plan", sa.Column("cancellation_hours", sa.Integer(), nullable=True))
    op.add_column("service_plan", sa.Column("rescheduling_policy", sa.Text(), nullable=True))
    op.add_column("service_plan", sa.Column("no_show_policy", sa.Text(), nullable=True))
    # Availability overrides
    op.add_column("service_plan", sa.Column("availability", JSONB, nullable=True))
    # Lifecycle overrides
    op.add_column("service_plan", sa.Column("service_expiry_date", sa.Text(), nullable=True))
    op.add_column("service_plan", sa.Column("validity_period_days", sa.Integer(), nullable=True))
    op.add_column("service_plan", sa.Column("renewal_required", sa.Boolean(), nullable=True))
    # is_on_sale on service table
    op.add_column("service", sa.Column("is_on_sale", sa.Boolean(), server_default="false", nullable=True))


def downgrade() -> None:
    op.drop_column("service", "is_on_sale")
    op.drop_column("service_plan", "renewal_required")
    op.drop_column("service_plan", "validity_period_days")
    op.drop_column("service_plan", "service_expiry_date")
    op.drop_column("service_plan", "availability")
    op.drop_column("service_plan", "no_show_policy")
    op.drop_column("service_plan", "rescheduling_policy")
    op.drop_column("service_plan", "cancellation_hours")
    op.drop_column("service_plan", "cancellation_policy")
    op.drop_column("service_plan", "booking_lead_time_hours")
    op.drop_column("service_plan", "advance_booking_days")
    op.drop_column("service_plan", "max_bookings_per_slot")
    op.drop_column("service_plan", "requires_booking")
    op.drop_column("service_plan", "gst_rate")
    op.drop_column("service_plan", "sac_code")
    op.drop_column("service_plan", "tax_rate")
    op.drop_column("service_plan", "is_taxable")
    op.drop_column("service_plan", "discount_end_date")
    op.drop_column("service_plan", "discount_start_date")
    op.drop_column("service_plan", "offer_label")
    op.drop_column("service_plan", "discount_amount")
    op.drop_column("service_plan", "discount_percentage")
    op.drop_column("service_plan", "currency")
    op.drop_column("service_plan", "price_max")
    op.drop_column("service_plan", "price_min")
    op.drop_column("service_plan", "plan_price_type")
    op.drop_column("service_plan", "service_capacity")
    op.drop_column("service_plan", "buffer_minutes")
    op.drop_column("service_plan", "service_mode")
    op.drop_column("service_plan", "service_frequency")
