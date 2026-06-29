"""fin012 – Financial Statement Versions (FSV)

Adds three tables that allow users to define configurable report layouts for
Income Statement and Balance Sheet — equivalent to SAP's FSV (Financial
Statement Version) concept.

  fin_statement_version   — header: name, type, default flag
  fin_statement_node      — tree node within a version (self-referential)
  fin_statement_node_acct — assigns GL accounts to leaf nodes

Revision ID: fin012_financial_statement_versions
Revises: fin011_open_item_management
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "fin012_financial_statement_versions"
down_revision = "fin011_open_item_management"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "fin_statement_version",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "vendor_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("vendor.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("name", sa.String(200), nullable=False),
        # income_statement | balance_sheet | custom
        sa.Column("statement_type", sa.String(30), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("is_default", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("vendor_id", "name", "statement_type", name="uq_fin_fsv_vendor_name_type"),
    )

    op.create_table(
        "fin_statement_node",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "version_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("fin_statement_version.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "vendor_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("vendor.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "parent_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("fin_statement_node.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("name", sa.String(200), nullable=False),
        # group = can contain children | item = leaf (assigned accounts) | subtotal = computed total | separator = visual divider
        sa.Column("node_type", sa.String(20), nullable=False, server_default="group"),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
        # When true, negate the computed balance (credit accounts shown as positive revenue)
        sa.Column("sign_flip", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("bold", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("indent_level", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_fin_stmt_node_version", "fin_statement_node", ["version_id", "sort_order"])

    op.create_table(
        "fin_statement_node_acct",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "node_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("fin_statement_node.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "vendor_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("vendor.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        # Either a specific account or a code range (from/to)
        sa.Column(
            "account_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("fin_account.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("code_from", sa.String(20), nullable=True),
        sa.Column("code_to", sa.String(20), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_fin_stmt_node_acct_node", "fin_statement_node_acct", ["node_id"])


def downgrade() -> None:
    op.drop_index("ix_fin_stmt_node_acct_node", table_name="fin_statement_node_acct")
    op.drop_table("fin_statement_node_acct")
    op.drop_index("ix_fin_stmt_node_version", table_name="fin_statement_node")
    op.drop_table("fin_statement_node")
    op.drop_table("fin_statement_version")
