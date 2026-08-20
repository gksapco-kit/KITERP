"""Add delivery_info to rental_asset for storefront booking message.

Revision ID: rent012_delivery_info
Revises: rent011_currency
Create Date: 2026-08-19
"""

from alembic import op
import sqlalchemy as sa

revision = "rent012_delivery_info"
down_revision = "rent011_currency"
branch_labels = None
depends_on = None


def _col_exists(conn, table: str, column: str) -> bool:
    insp = sa.inspect(conn)
    return any(c["name"] == column for c in insp.get_columns(table))


def upgrade() -> None:
    conn = op.get_bind()
    if not _col_exists(conn, "rental_asset", "delivery_info"):
        op.add_column(
            "rental_asset",
            sa.Column("delivery_info", sa.String(500), nullable=True),
        )


def downgrade() -> None:
    conn = op.get_bind()
    if _col_exists(conn, "rental_asset", "delivery_info"):
        op.drop_column("rental_asset", "delivery_info")
