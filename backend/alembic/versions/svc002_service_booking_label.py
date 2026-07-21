"""Add booking_label to service for Business Front display name.

Revision ID: svc002_service_booking_label
Revises: sfq001_storefront_contact_query
Create Date: 2026-07-18

Vendors can rename the "Booking" option so the custom label appears
on the storefront instead of the default.

Idempotent: column may already exist from ensure_service_booking_label_column().
"""
from alembic import op

revision = "svc002_service_booking_label"
down_revision = "sfq001_storefront_contact_query"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE service ADD COLUMN IF NOT EXISTS "
        "booking_label VARCHAR(100) DEFAULT 'Booking'"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE service DROP COLUMN IF EXISTS booking_label")
