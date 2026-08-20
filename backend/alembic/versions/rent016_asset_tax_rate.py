"""Add tax_rate to rental_asset.

Revision ID: rent016_asset_tax_rate
Revises: rent015_booking_unit_assignments
Create Date: 2026-08-20
"""

from alembic import op
import sqlalchemy as sa

revision = "rent016_asset_tax_rate"
down_revision = "rent015_booking_unit_assignments"
branch_labels = None
depends_on = None


def _col_exists(conn, table: str, column: str) -> bool:
    insp = sa.inspect(conn)
    return any(c["name"] == column for c in insp.get_columns(table))


def upgrade() -> None:
    conn = op.get_bind()
    if not _col_exists(conn, "rental_asset", "tax_rate"):
        op.add_column(
            "rental_asset",
            sa.Column("tax_rate", sa.Numeric(5, 2), nullable=False, server_default="0"),
        )


def downgrade() -> None:
    conn = op.get_bind()
    if _col_exists(conn, "rental_asset", "tax_rate"):
        op.drop_column("rental_asset", "tax_rate")
