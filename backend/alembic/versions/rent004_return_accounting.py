"""Phase 1 — return accounting correctness.

Adds damaged_qty and lost_qty tracking columns to rental_asset so that
units returned in damaged or missing condition are properly accounted for
separately from units that are simply occupied by active bookings.

Revision ID: rent004_return_accounting
Revises: rent003_rental_indexes
Create Date: 2026-08-05
"""

from alembic import op
import sqlalchemy as sa

revision = "rent004_return_accounting"
down_revision = "rent003_rental_indexes"
branch_labels = None
depends_on = None


def _col_exists(conn, table: str, column: str) -> bool:
    insp = sa.inspect(conn)
    return any(c["name"] == column for c in insp.get_columns(table))


def upgrade() -> None:
    conn = op.get_bind()

    if not _col_exists(conn, "rental_asset", "damaged_qty"):
        op.add_column(
            "rental_asset",
            sa.Column("damaged_qty", sa.Numeric(12, 2), nullable=True, server_default="0"),
        )

    if not _col_exists(conn, "rental_asset", "lost_qty"):
        op.add_column(
            "rental_asset",
            sa.Column("lost_qty", sa.Numeric(12, 2), nullable=True, server_default="0"),
        )


def downgrade() -> None:
    op.drop_column("rental_asset", "lost_qty")
    op.drop_column("rental_asset", "damaged_qty")
