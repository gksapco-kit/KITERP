"""Add additional_charges JSONB to rental_asset.

Revision ID: rent018_additional_charges
Revises: rent017_duration_rates
Create Date: 2026-08-20
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "rent018_additional_charges"
down_revision = "rent017_duration_rates"
branch_labels = None
depends_on = None


def _col_exists(conn, table: str, column: str) -> bool:
    insp = sa.inspect(conn)
    return any(c["name"] == column for c in insp.get_columns(table))


def upgrade() -> None:
    conn = op.get_bind()
    if not _col_exists(conn, "rental_asset", "additional_charges"):
        op.add_column(
            "rental_asset",
            sa.Column("additional_charges", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        )


def downgrade() -> None:
    conn = op.get_bind()
    if _col_exists(conn, "rental_asset", "additional_charges"):
        op.drop_column("rental_asset", "additional_charges")
