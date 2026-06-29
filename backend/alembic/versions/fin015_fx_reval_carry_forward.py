"""fin015 – FX Revaluation & Year-End Carry-Forward

Adds:
  fin_fx_reval_run        — header record for each revaluation batch
  fin_fx_reval_line       — one adjustment line per revalued journal line
  fin_balance_carryforward — year-end carry-forward log per account / fiscal year

Extends:
  fin_exchange_rate  — adds rate_type column (fin_exchange_rate already exists)
  fin_journal_line   — adds currency, amount_fc, exchange_rate columns
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "fin015_fx_reval_carry_forward"
down_revision = "fin014b_fix_vendor_fkeys"
branch_labels = None
depends_on = None


def _col_exists(table: str, column: str) -> bool:
    bind = op.get_bind()
    result = bind.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name = :t AND column_name = :c"
    ), {"t": table, "c": column})
    return result.fetchone() is not None


def _table_exists(table: str) -> bool:
    bind = op.get_bind()
    result = bind.execute(sa.text(
        "SELECT 1 FROM information_schema.tables WHERE table_name = :t"
    ), {"t": table})
    return result.fetchone() is not None


def upgrade() -> None:
    # ── Extend existing fin_exchange_rate with rate_type ──────────────────────
    if not _col_exists("fin_exchange_rate", "rate_type"):
        op.add_column("fin_exchange_rate",
            sa.Column("rate_type", sa.String(2), server_default="M", nullable=False))

    # ── FX Revaluation Run ────────────────────────────────────────────────────
    if not _table_exists("fin_fx_reval_run"):
        op.create_table(
            "fin_fx_reval_run",
            sa.Column("id",           UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
            sa.Column("vendor_id",    UUID(as_uuid=True), sa.ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False),
            sa.Column("run_date",     sa.Date,  nullable=False),
            sa.Column("currency",     sa.String(3), nullable=False),
            sa.Column("rate_used",    sa.Numeric(20, 8), nullable=False),
            sa.Column("total_gain",   sa.Numeric(18, 4), server_default="0", nullable=False),
            sa.Column("total_loss",   sa.Numeric(18, 4), server_default="0", nullable=False),
            sa.Column("status",       sa.String(15), server_default="simulated", nullable=False),
            sa.Column("journal_entry_id", UUID(as_uuid=True),
                      sa.ForeignKey("fin_journal_entry.id", ondelete="SET NULL"), nullable=True),
            sa.Column("created_by",   sa.String(120), nullable=True),
            sa.Column("created_at",   sa.DateTime(timezone=True), server_default=sa.text("now()")),
        )

    if not _table_exists("fin_fx_reval_line"):
        op.create_table(
            "fin_fx_reval_line",
            sa.Column("id",              UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
            sa.Column("reval_run_id",    UUID(as_uuid=True), sa.ForeignKey("fin_fx_reval_run.id", ondelete="CASCADE"), nullable=False),
            sa.Column("journal_line_id", UUID(as_uuid=True), sa.ForeignKey("fin_journal_line.id", ondelete="CASCADE"), nullable=False),
            sa.Column("original_amount_fc", sa.Numeric(18, 4), nullable=False),
            sa.Column("original_amount_lc", sa.Numeric(18, 4), nullable=False),
            sa.Column("revalued_amount_lc", sa.Numeric(18, 4), nullable=False),
            sa.Column("adjustment",      sa.Numeric(18, 4),  nullable=False),
        )

    # ── Balance Carry-Forward Log ─────────────────────────────────────────────
    if not _table_exists("fin_balance_carryforward"):
        op.create_table(
            "fin_balance_carryforward",
            sa.Column("id",              UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
            sa.Column("vendor_id",       UUID(as_uuid=True), sa.ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False),
            sa.Column("account_id",      UUID(as_uuid=True), sa.ForeignKey("fin_account.id", ondelete="CASCADE"), nullable=False),
            sa.Column("from_fiscal_year",sa.Integer, nullable=False),
            sa.Column("to_fiscal_year",  sa.Integer, nullable=False),
            sa.Column("closing_balance", sa.Numeric(18, 4), nullable=False),
            sa.Column("carried_forward_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
            sa.Column("carried_by",      sa.String(120), nullable=True),
            sa.UniqueConstraint("vendor_id", "account_id", "from_fiscal_year",
                                name="uq_fin_bcf_vendor_acct_fy"),
        )

    # ── Extend journal line with FX columns ───────────────────────────────────
    if not _col_exists("fin_journal_line", "currency"):
        op.add_column("fin_journal_line",
            sa.Column("currency", sa.String(3), nullable=True))
    if not _col_exists("fin_journal_line", "amount_fc"):
        op.add_column("fin_journal_line",
            sa.Column("amount_fc", sa.Numeric(18, 4), nullable=True))
    if not _col_exists("fin_journal_line", "exchange_rate"):
        op.add_column("fin_journal_line",
            sa.Column("exchange_rate", sa.Numeric(20, 8), nullable=True))


def downgrade() -> None:
    op.drop_column("fin_journal_line", "exchange_rate")
    op.drop_column("fin_journal_line", "amount_fc")
    op.drop_column("fin_journal_line", "currency")
    op.drop_table("fin_balance_carryforward")
    op.drop_table("fin_fx_reval_line")
    op.drop_table("fin_fx_reval_run")
    op.drop_column("fin_exchange_rate", "rate_type")

