"""Add subscription_label and quote_request_label to service.

Revision ID: svc003_service_storefront_labels
Revises: svc002_service_booking_label
Create Date: 2026-07-18

Vendors can rename Subscription and Quote Requests options so custom
labels appear on the storefront (same pattern as booking_label).

Idempotent: columns may already exist from ensure_service_storefront_label_columns().
"""
from alembic import op

revision = "svc003_service_storefront_labels"
down_revision = "svc002_service_booking_label"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE service ADD COLUMN IF NOT EXISTS "
        "subscription_label VARCHAR(100) DEFAULT 'Subscription'"
    )
    op.execute(
        "ALTER TABLE service ADD COLUMN IF NOT EXISTS "
        "quote_request_label VARCHAR(100) DEFAULT 'Quote Requests'"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE service DROP COLUMN IF EXISTS quote_request_label")
    op.execute("ALTER TABLE service DROP COLUMN IF EXISTS subscription_label")
