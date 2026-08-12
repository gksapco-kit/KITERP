"""Add currency to rental_asset.

Revision ID: rent011_currency
Revises: rent010_short_description
Create Date: 2026-08-12
"""

from alembic import op
import sqlalchemy as sa

revision = "rent011_currency"
down_revision = "rent010_short_description"
branch_labels = None
depends_on = None


def _col_exists(conn, table: str, column: str) -> bool:
    insp = sa.inspect(conn)
    return any(c["name"] == column for c in insp.get_columns(table))


def upgrade() -> None:
    conn = op.get_bind()
    if not _col_exists(conn, "rental_asset", "currency"):
        op.add_column(
            "rental_asset",
            sa.Column("currency", sa.String(3), nullable=False, server_default="INR"),
        )


def downgrade() -> None:
    conn = op.get_bind()
    if _col_exists(conn, "rental_asset", "currency"):
        op.drop_column("rental_asset", "currency")
