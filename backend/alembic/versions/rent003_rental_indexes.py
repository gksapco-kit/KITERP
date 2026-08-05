"""Add composite indexes to rental tables for query performance.

Revision ID: rent003_rental_indexes
Revises: rent002_rental_return_fields
Create Date: 2026-08-05

Adds:
  - rental_booking(asset_id, start_date, end_date)  — overlap / calendar queries
  - rental_booking(vendor_id, status, start_date)   — list + status filter queries
  - rental_asset(vendor_id, category)               — category-filtered asset lists
  - rental_asset(vendor_id, status)                 — status-filtered asset lists
"""
from alembic import op
from sqlalchemy import inspect

revision = "rent003_rental_indexes"
down_revision = "rent002_rental_return_fields"
branch_labels = None
depends_on = None


def _index_exists(conn, index_name: str, table_name: str) -> bool:
    insp = inspect(conn)
    return any(ix["name"] == index_name for ix in insp.get_indexes(table_name))


def upgrade() -> None:
    conn = op.get_bind()

    if not _index_exists(conn, "ix_rental_booking_asset_dates", "rental_booking"):
        op.create_index(
            "ix_rental_booking_asset_dates",
            "rental_booking",
            ["asset_id", "start_date", "end_date"],
        )

    if not _index_exists(conn, "ix_rental_booking_vendor_status_date", "rental_booking"):
        op.create_index(
            "ix_rental_booking_vendor_status_date",
            "rental_booking",
            ["vendor_id", "status", "start_date"],
        )

    if not _index_exists(conn, "ix_rental_asset_vendor_category", "rental_asset"):
        op.create_index(
            "ix_rental_asset_vendor_category",
            "rental_asset",
            ["vendor_id", "category"],
        )

    if not _index_exists(conn, "ix_rental_asset_vendor_status", "rental_asset"):
        op.create_index(
            "ix_rental_asset_vendor_status",
            "rental_asset",
            ["vendor_id", "status"],
        )


def downgrade() -> None:
    op.drop_index("ix_rental_booking_asset_dates", table_name="rental_booking")
    op.drop_index("ix_rental_booking_vendor_status_date", table_name="rental_booking")
    op.drop_index("ix_rental_asset_vendor_category", table_name="rental_asset")
    op.drop_index("ix_rental_asset_vendor_status", table_name="rental_asset")
