"""Soft-delete rental assets (bin / history).

Revision ID: rent021_asset_soft_delete
Revises: rent020_registration_forms
Create Date: 2026-08-21
"""

from alembic import op
import sqlalchemy as sa

revision = "rent021_asset_soft_delete"
down_revision = "rent020_registration_forms"
branch_labels = None
depends_on = None


def _has_column(conn, table: str, column: str) -> bool:
    insp = sa.inspect(conn)
    if table not in insp.get_table_names():
        return False
    return column in {c["name"] for c in insp.get_columns(table)}


def upgrade() -> None:
    conn = op.get_bind()
    if not _has_column(conn, "rental_asset", "deleted_at"):
        op.add_column(
            "rental_asset",
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        )
        op.create_index(
            "ix_rental_asset_deleted_at",
            "rental_asset",
            ["deleted_at"],
        )
        op.create_index(
            "ix_rental_asset_vendor_deleted",
            "rental_asset",
            ["vendor_id", "deleted_at"],
        )


def downgrade() -> None:
    conn = op.get_bind()
    if _has_column(conn, "rental_asset", "deleted_at"):
        op.drop_index("ix_rental_asset_vendor_deleted", table_name="rental_asset")
        op.drop_index("ix_rental_asset_deleted_at", table_name="rental_asset")
        op.drop_column("rental_asset", "deleted_at")
