"""Add duration_rates JSONB to rental_asset.

Revision ID: rent017_duration_rates
Revises: rent016_asset_tax_rate
Create Date: 2026-08-20
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "rent017_duration_rates"
down_revision = "rent016_asset_tax_rate"
branch_labels = None
depends_on = None


def _col_exists(conn, table: str, column: str) -> bool:
    insp = sa.inspect(conn)
    return any(c["name"] == column for c in insp.get_columns(table))


def upgrade() -> None:
    conn = op.get_bind()
    if not _col_exists(conn, "rental_asset", "duration_rates"):
        op.add_column(
            "rental_asset",
            sa.Column("duration_rates", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        )


def downgrade() -> None:
    conn = op.get_bind()
    if _col_exists(conn, "rental_asset", "duration_rates"):
        op.drop_column("rental_asset", "duration_rates")
