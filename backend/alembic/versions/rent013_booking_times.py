"""Add start_time and end_time to rental_booking.

Revision ID: rent013_booking_times
Revises: rent012_delivery_info
Create Date: 2026-08-19
"""

from alembic import op
import sqlalchemy as sa

revision = "rent013_booking_times"
down_revision = "rent012_delivery_info"
branch_labels = None
depends_on = None


def _col_exists(conn, table: str, column: str) -> bool:
    insp = sa.inspect(conn)
    return any(c["name"] == column for c in insp.get_columns(table))


def upgrade() -> None:
    conn = op.get_bind()
    if not _col_exists(conn, "rental_booking", "start_time"):
        op.add_column("rental_booking", sa.Column("start_time", sa.Time(), nullable=True))
    if not _col_exists(conn, "rental_booking", "end_time"):
        op.add_column("rental_booking", sa.Column("end_time", sa.Time(), nullable=True))


def downgrade() -> None:
    conn = op.get_bind()
    if _col_exists(conn, "rental_booking", "end_time"):
        op.drop_column("rental_booking", "end_time")
    if _col_exists(conn, "rental_booking", "start_time"):
        op.drop_column("rental_booking", "start_time")
