"""Add vendor.show_in_community for Our Partners / Community directory

Revision ID: com001_show_in_community
Revises: crm007_number_ranges, hrtrack001_employee_geo_tracking,
         ord008_pricing_conditions, pharma011_wholesale_license_documents,
         prod001_valuation_method, rbac001_backfill, rent007_extended_rates,
         sfq003_query_ticket_actions
Create Date: 2026-08-11

When true (and vendor is approved/active), the business appears on the public
Our Partners page and landing Community mosaic.
"""
from alembic import op
import sqlalchemy as sa

revision = "com001_show_in_community"
down_revision = (
    "crm007_number_ranges",
    "hrtrack001_employee_geo_tracking",
    "ord008_pricing_conditions",
    "pharma011_wholesale_license_documents",
    "prod001_valuation_method",
    "rbac001_backfill",
    "rent007_extended_rates",
    "sfq003_query_ticket_actions",
)
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Idempotent: startup ensure_* may have already added this column.
    op.execute(
        sa.text(
            "ALTER TABLE vendor ADD COLUMN IF NOT EXISTS "
            "show_in_community BOOLEAN NOT NULL DEFAULT FALSE"
        )
    )
    op.execute(
        sa.text(
            "CREATE INDEX IF NOT EXISTS ix_vendor_show_in_community "
            "ON vendor (show_in_community)"
        )
    )


def downgrade() -> None:
    op.execute(sa.text("DROP INDEX IF EXISTS ix_vendor_show_in_community"))
    op.execute(sa.text("ALTER TABLE vendor DROP COLUMN IF EXISTS show_in_community"))
