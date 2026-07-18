"""Add booking_label to service for Business Front display name.

Revision ID: svc002_service_booking_label
Revises: sfq001_storefront_contact_query
Create Date: 2026-07-18

Vendors can rename the "Booking" option so the custom label appears
on the storefront instead of the default.
"""
from alembic import op
import sqlalchemy as sa

revision = "svc002_service_booking_label"
down_revision = "sfq001_storefront_contact_query"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "service",
        sa.Column("booking_label", sa.String(100), server_default="Booking", nullable=True),
    )


def downgrade() -> None:
    op.drop_column("service", "booking_label")
