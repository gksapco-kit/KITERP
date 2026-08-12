"""Add short_description to rental_asset.

Revision ID: rent010_short_description
Revises: rent009_rental_media_category
Create Date: 2026-08-12
"""

from alembic import op
import sqlalchemy as sa

revision = "rent010_short_description"
down_revision = "rent009_rental_media_category"
branch_labels = None
depends_on = None


def _col_exists(conn, table: str, column: str) -> bool:
    insp = sa.inspect(conn)
    return any(c["name"] == column for c in insp.get_columns(table))


def upgrade() -> None:
    conn = op.get_bind()
    if not _col_exists(conn, "rental_asset", "short_description"):
        op.add_column(
            "rental_asset",
            sa.Column("short_description", sa.String(500), nullable=True),
        )


def downgrade() -> None:
    conn = op.get_bind()
    if _col_exists(conn, "rental_asset", "short_description"):
        op.drop_column("rental_asset", "short_description")
