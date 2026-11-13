"""Add additional_charges JSONB to invoice (freight, packing, etc.).

Revision ID: sinv003_invoice_additional_charges
Revises: sinv002_invoice_soft_delete
Create Date: 2026-11-12
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "sinv003_invoice_additional_charges"
down_revision = "sinv002_invoice_soft_delete"
branch_labels = None
depends_on = None


def _has_column(conn, table: str, column: str) -> bool:
    insp = sa.inspect(conn)
    if table not in insp.get_table_names():
        return False
    return column in {c["name"] for c in insp.get_columns(table)}


def upgrade() -> None:
    conn = op.get_bind()
    if not _has_column(conn, "invoice", "additional_charges"):
        op.add_column(
            "invoice",
            sa.Column(
                "additional_charges",
                JSONB,
                nullable=False,
                server_default=sa.text("'[]'::jsonb"),
            ),
        )


def downgrade() -> None:
    conn = op.get_bind()
    if _has_column(conn, "invoice", "additional_charges"):
        op.drop_column("invoice", "additional_charges")
