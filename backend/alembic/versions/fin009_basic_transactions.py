"""fin009 – basic transactions table for simple finance module

Revision ID: fin009
Revises:
Create Date: 2026-04-23
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'fin009'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "fin_basic_transaction",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "vendor_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("vendor.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("txn_type", sa.String(20), nullable=False),
        sa.Column("category", sa.String(100), nullable=False),
        sa.Column("amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("txn_date", sa.Date, nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("payment_method", sa.String(50)),
        sa.Column("reference", sa.String(100)),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_fin_basic_txn_vendor", "fin_basic_transaction", ["vendor_id"])
    op.create_index("ix_fin_basic_txn_type",   "fin_basic_transaction", ["txn_type"])
    op.create_index("ix_fin_basic_txn_date",   "fin_basic_transaction", ["txn_date"])


def downgrade() -> None:
    op.drop_table("fin_basic_transaction")
