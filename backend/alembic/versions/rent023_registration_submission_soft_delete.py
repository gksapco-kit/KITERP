"""Soft-delete rental registration submissions (discarded bin).

Revision ID: rent023_registration_submission_soft_delete
Revises: rent022_asset_change_history
Create Date: 2026-08-21
"""

from alembic import op
import sqlalchemy as sa

revision = "rent023_registration_submission_soft_delete"
down_revision = "rent022_asset_change_history"
branch_labels = None
depends_on = None


def _has_column(conn, table: str, column: str) -> bool:
    insp = sa.inspect(conn)
    if table not in insp.get_table_names():
        return False
    return column in {c["name"] for c in insp.get_columns(table)}


def upgrade() -> None:
    conn = op.get_bind()
    if not _has_column(conn, "rental_registration_submission", "deleted_at"):
        op.add_column(
            "rental_registration_submission",
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        )
        op.create_index(
            "ix_rental_registration_submission_deleted_at",
            "rental_registration_submission",
            ["deleted_at"],
        )
        op.create_index(
            "ix_rental_registration_submission_vendor_deleted",
            "rental_registration_submission",
            ["vendor_id", "deleted_at"],
        )


def downgrade() -> None:
    conn = op.get_bind()
    if _has_column(conn, "rental_registration_submission", "deleted_at"):
        op.drop_index(
            "ix_rental_registration_submission_vendor_deleted",
            table_name="rental_registration_submission",
        )
        op.drop_index(
            "ix_rental_registration_submission_deleted_at",
            table_name="rental_registration_submission",
        )
        op.drop_column("rental_registration_submission", "deleted_at")
