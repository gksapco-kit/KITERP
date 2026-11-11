"""Soft-delete sales invoices (trash bin with restore).

Revision ID: sinv002_invoice_soft_delete
Revises: einv001_invoice_einvoice
Create Date: 2026-11-11
"""

from alembic import op
import sqlalchemy as sa

revision = "sinv002_invoice_soft_delete"
down_revision = "einv001_invoice_einvoice"
branch_labels = None
depends_on = None


def _has_column(conn, table: str, column: str) -> bool:
    insp = sa.inspect(conn)
    if table not in insp.get_table_names():
        return False
    return column in {c["name"] for c in insp.get_columns(table)}


def upgrade() -> None:
    conn = op.get_bind()
    if not _has_column(conn, "invoice", "deleted_at"):
        op.add_column(
            "invoice",
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        )
        op.create_index("ix_invoice_deleted_at", "invoice", ["deleted_at"])
        op.create_index("ix_invoice_vendor_deleted", "invoice", ["vendor_id", "deleted_at"])


def downgrade() -> None:
    conn = op.get_bind()
    if _has_column(conn, "invoice", "deleted_at"):
        op.drop_index("ix_invoice_vendor_deleted", table_name="invoice")
        op.drop_index("ix_invoice_deleted_at", table_name="invoice")
        op.drop_column("invoice", "deleted_at")
