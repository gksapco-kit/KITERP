"""Rental asset change history columns.

Revision ID: rent022_asset_change_history
Revises: rent021_asset_soft_delete
Create Date: 2026-08-21
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "rent022_asset_change_history"
down_revision = "rent021_asset_soft_delete"
branch_labels = None
depends_on = None


def _has_column(conn, table: str, column: str) -> bool:
    insp = sa.inspect(conn)
    if table not in insp.get_table_names():
        return False
    return column in {c["name"] for c in insp.get_columns(table)}


def upgrade() -> None:
    conn = op.get_bind()
    if not _has_column(conn, "rental_asset", "change_history"):
        op.add_column(
            "rental_asset",
            sa.Column("change_history", JSONB, nullable=True, server_default=sa.text("'[]'::jsonb")),
        )
    if not _has_column(conn, "rental_asset", "version_number"):
        op.add_column(
            "rental_asset",
            sa.Column("version_number", sa.Integer(), nullable=True, server_default="1"),
        )


def downgrade() -> None:
    conn = op.get_bind()
    if _has_column(conn, "rental_asset", "version_number"):
        op.drop_column("rental_asset", "version_number")
    if _has_column(conn, "rental_asset", "change_history"):
        op.drop_column("rental_asset", "change_history")
