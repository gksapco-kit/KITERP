"""fin018 – Parallel Ledgers / Multi-GAAP

Adds:
  fin_ledger               — named ledger (Leading/GAAP, IFRS, Tax, …)
  fin_ledger_assignment    — assigns a ledger to a company entity
  fin_journal_line_ledger  — per-ledger override amounts on each journal line
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "fin018_parallel_ledgers"
down_revision = "fin017b_fix_split_rule_fkeys"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Ledger definition ─────────────────────────────────────────────────────
    op.create_table(
        "fin_ledger",
        sa.Column("id",          UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("vendor_id",   UUID(as_uuid=True), sa.ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False),
        sa.Column("code",        sa.String(10), nullable=False),
        sa.Column("name",        sa.String(120), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("is_leading",  sa.Boolean(), server_default="false", nullable=False),
        sa.Column("currency",    sa.String(3), server_default="INR"),
        sa.Column("is_active",   sa.Boolean(), server_default="true", nullable=False),
        sa.Column("created_at",  sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("vendor_id", "code", name="uq_fin_ledger_vendor_code"),
    )
    op.create_index("ix_fin_ledger_vendor", "fin_ledger", ["vendor_id"])

    # ── Ledger → Company assignment ───────────────────────────────────────────
    op.create_table(
        "fin_ledger_assignment",
        sa.Column("id",         UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("vendor_id",  UUID(as_uuid=True), sa.ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ledger_id",  UUID(as_uuid=True), sa.ForeignKey("fin_ledger.id", ondelete="CASCADE"), nullable=False),
        sa.Column("company_id", UUID(as_uuid=True), sa.ForeignKey("fin_company.id", ondelete="CASCADE"), nullable=False),
        sa.Column("is_active",  sa.Boolean(), server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("ledger_id", "company_id", name="uq_fin_ledger_assignment"),
    )
    op.create_index("ix_fin_ledger_assignment_ledger", "fin_ledger_assignment", ["ledger_id"])
    op.create_index("ix_fin_ledger_assignment_company", "fin_ledger_assignment", ["company_id"])

    # ── Per-line ledger override amounts ──────────────────────────────────────
    op.create_table(
        "fin_journal_line_ledger",
        sa.Column("id",              UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("journal_line_id", UUID(as_uuid=True), sa.ForeignKey("fin_journal_line.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ledger_id",       UUID(as_uuid=True), sa.ForeignKey("fin_ledger.id", ondelete="CASCADE"), nullable=False),
        sa.Column("debit",           sa.Numeric(18, 4), server_default="0"),
        sa.Column("credit",          sa.Numeric(18, 4), server_default="0"),
        sa.Column("amount_fc",       sa.Numeric(18, 4)),
        sa.Column("narration",       sa.Text),
        sa.Column("created_at",      sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("journal_line_id", "ledger_id", name="uq_fin_jll_line_ledger"),
    )
    op.create_index("ix_fin_jll_line",   "fin_journal_line_ledger", ["journal_line_id"])
    op.create_index("ix_fin_jll_ledger", "fin_journal_line_ledger", ["ledger_id"])


def downgrade() -> None:
    op.drop_table("fin_journal_line_ledger")
    op.drop_table("fin_ledger_assignment")
    op.drop_table("fin_ledger")
