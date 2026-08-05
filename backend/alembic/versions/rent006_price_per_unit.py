"""Add price_per_unit and pricing_uom to rental_asset.

Revision ID: rent006_price_per_unit
Revises: rent005_sub_assets_return_history
Create Date: 2026-08-05
"""

from alembic import op
import sqlalchemy as sa

revision = "rent006_price_per_unit"
down_revision = "rent005_sub_assets_return_history"
branch_labels = None
depends_on = None


def _col_exists(conn, table: str, column: str) -> bool:
    insp = sa.inspect(conn)
    return any(c["name"] == column for c in insp.get_columns(table))


def upgrade() -> None:
    conn = op.get_bind()
    if not _col_exists(conn, "rental_asset", "price_per_unit"):
        op.add_column(
            "rental_asset",
            sa.Column("price_per_unit", sa.Numeric(12, 2), nullable=True, server_default="0"),
        )
    if not _col_exists(conn, "rental_asset", "pricing_uom"):
        op.add_column(
            "rental_asset",
            sa.Column("pricing_uom", sa.String(40), nullable=True),
        )


def downgrade() -> None:
    op.drop_column("rental_asset", "pricing_uom")
    op.drop_column("rental_asset", "price_per_unit")
