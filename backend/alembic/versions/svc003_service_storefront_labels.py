"""Add subscription_label and quote_request_label to service.

Revision ID: svc003_service_storefront_labels
Revises: svc002_service_booking_label
Create Date: 2026-07-18

Vendors can rename Subscription and Quote Requests options so custom
labels appear on the storefront (same pattern as booking_label).
"""
from alembic import op
import sqlalchemy as sa

revision = "svc003_service_storefront_labels"
down_revision = "svc002_service_booking_label"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "service",
        sa.Column("subscription_label", sa.String(100), server_default="Subscription", nullable=True),
    )
    op.add_column(
        "service",
        sa.Column("quote_request_label", sa.String(100), server_default="Quote Requests", nullable=True),
    )


def downgrade() -> None:
    op.drop_column("service", "quote_request_label")
    op.drop_column("service", "subscription_label")
