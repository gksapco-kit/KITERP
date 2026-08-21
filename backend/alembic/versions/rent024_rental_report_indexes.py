"""Add composite indexes for rental reporting analytics queries.

Revision ID: rent024_rental_report_indexes
Revises: rent023_registration_submission_soft_delete
Create Date: 2026-08-21
"""
import sqlalchemy as sa
from alembic import op

revision = "rent024_rental_report_indexes"
down_revision = "rent023_registration_submission_soft_delete"
branch_labels = None
depends_on = None

_BOOKING_INDEXES = [
    ("ix_rental_booking_vendor_start_date", ["vendor_id", "start_date"]),
    ("ix_rental_booking_vendor_created_at", ["vendor_id", "created_at"]),
    ("ix_rental_booking_vendor_status", ["vendor_id", "status"]),
]
_RETURN_INDEXES = [
    ("ix_rental_return_vendor_returned_at", ["vendor_id", "returned_at"]),
]


def _existing_index_names(conn, table: str) -> set[str]:
    insp = sa.inspect(conn)
    if table not in insp.get_table_names():
        return set()
    return {ix["name"] for ix in insp.get_indexes(table)}


def upgrade() -> None:
    conn = op.get_bind()

    booking_existing = _existing_index_names(conn, "rental_booking")
    for name, cols in _BOOKING_INDEXES:
        if name not in booking_existing:
            op.create_index(name, "rental_booking", cols)

    return_existing = _existing_index_names(conn, "rental_return")
    for name, cols in _RETURN_INDEXES:
        if name not in return_existing:
            op.create_index(name, "rental_return", cols)


def downgrade() -> None:
    for name, _ in _RETURN_INDEXES:
        op.drop_index(name, table_name="rental_return")
    for name, _ in _BOOKING_INDEXES:
        op.drop_index(name, table_name="rental_booking")
