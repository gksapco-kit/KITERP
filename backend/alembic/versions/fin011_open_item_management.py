"""fin011 – open-item management & GL clearing

Adds:
  fin_journal_line:
    - open_item_status  varchar(20) nullable: open | cleared | partial
      Only set for lines posted to accounts with is_reconcilable=true or
      is_reconciliation_account=true.  NULL means "not tracked".
    - clearing_batch_id  UUID FK → fin_gl_clearing_batch.id
    - clearing_date      Date

  New table fin_gl_clearing_batch:
    Header record for each clearing event.  One or more journal lines are
    linked to a batch; the selected lines must net to zero on the same account.

Revision ID: fin011_open_item_management
Revises: fin010_reconciliation_accounts
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "fin011_open_item_management"
down_revision = "fin010_reconciliation_accounts"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "fin_gl_clearing_batch",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "vendor_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("vendor.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "account_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("fin_account.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
        sa.Column("clearing_ref", sa.String(30), nullable=False),
        sa.Column("clearing_date", sa.Date, nullable=False),
        sa.Column("party_type", sa.String(20), nullable=True),
        sa.Column("party_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("line_count", sa.Integer, default=0),
        sa.Column("total_debit", sa.Numeric(18, 4), default=0),
        sa.Column("total_credit", sa.Numeric(18, 4), default=0),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column(
            "created_by_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("vendor_user.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
        ),
    )
    op.create_index(
        "ix_fin_clr_batch_vendor_account",
        "fin_gl_clearing_batch",
        ["vendor_id", "account_id"],
    )
    op.create_index(
        "ix_fin_clr_batch_party",
        "fin_gl_clearing_batch",
        ["vendor_id", "party_type", "party_id"],
    )

    # Add columns to fin_journal_line
    op.add_column(
        "fin_journal_line",
        sa.Column("open_item_status", sa.String(20), nullable=True),
    )
    op.add_column(
        "fin_journal_line",
        sa.Column(
            "clearing_batch_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("fin_gl_clearing_batch.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "fin_journal_line",
        sa.Column("clearing_date", sa.Date, nullable=True),
    )

    op.create_index(
        "ix_fin_jl_open_items",
        "fin_journal_line",
        ["vendor_id", "account_id", "open_item_status"],
    )
    op.create_index(
        "ix_fin_jl_clearing_batch",
        "fin_journal_line",
        ["clearing_batch_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_fin_jl_clearing_batch", table_name="fin_journal_line")
    op.drop_index("ix_fin_jl_open_items", table_name="fin_journal_line")
    op.drop_column("fin_journal_line", "clearing_date")
    op.drop_column("fin_journal_line", "clearing_batch_id")
    op.drop_column("fin_journal_line", "open_item_status")

    op.drop_index("ix_fin_clr_batch_party", table_name="fin_gl_clearing_batch")
    op.drop_index("ix_fin_clr_batch_vendor_account", table_name="fin_gl_clearing_batch")
    op.drop_table("fin_gl_clearing_batch")
