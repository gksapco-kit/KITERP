"""Add delivery_enabled flag to rental_asset.

Revision ID: rent014_delivery_enabled
Revises: rent013_booking_times
Create Date: 2026-08-19
"""

from alembic import op
import sqlalchemy as sa

revision = "rent014_delivery_enabled"
down_revision = "rent013_booking_times"
branch_labels = None
depends_on = None


def _col_exists(conn, table: str, column: str) -> bool:
    insp = sa.inspect(conn)
    return any(c["name"] == column for c in insp.get_columns(table))


def upgrade() -> None:
    conn = op.get_bind()
    if not _col_exists(conn, "rental_asset", "delivery_enabled"):
        op.add_column(
            "rental_asset",
            sa.Column("delivery_enabled", sa.Boolean(), nullable=False, server_default="false"),
        )


def downgrade() -> None:
    conn = op.get_bind()
    if _col_exists(conn, "rental_asset", "delivery_enabled"):
        op.drop_column("rental_asset", "delivery_enabled")
