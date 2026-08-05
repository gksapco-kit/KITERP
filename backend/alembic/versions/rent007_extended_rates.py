"""Add hourly_rate, per_minute_rate, yearly_rate to rental_asset.

Revision ID: rent007_extended_rates
Revises: rent006_price_per_unit
Create Date: 2026-08-06
"""

from alembic import op
import sqlalchemy as sa

revision = "rent007_extended_rates"
down_revision = "rent006_price_per_unit"
branch_labels = None
depends_on = None


def _col_exists(conn, table: str, column: str) -> bool:
    insp = sa.inspect(conn)
    return any(c["name"] == column for c in insp.get_columns(table))


def upgrade() -> None:
    conn = op.get_bind()
    for col in ("hourly_rate", "per_minute_rate", "yearly_rate"):
        if not _col_exists(conn, "rental_asset", col):
            op.add_column(
                "rental_asset",
                sa.Column(col, sa.Numeric(12, 2), nullable=True, server_default="0"),
            )


def downgrade() -> None:
    for col in ("yearly_rate", "per_minute_rate", "hourly_rate"):
        op.drop_column("rental_asset", col)
