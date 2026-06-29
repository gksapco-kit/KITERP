"""fin017 – Document Splitting

Adds:
  fin_split_rule         — configuration: which account types trigger splitting and on which dimension
  fin_split_rule_base    — which account types are the "base" for proportional allocation
  fin_journal_split_item — exploded sub-ledger items after splitting
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "fin017_document_splitting"
down_revision = "fin016b_fix_vendor_fkeys"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Split Rule configuration ──────────────────────────────────────────────
    op.create_table(
        "fin_split_rule",
        sa.Column("id",              UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("vendor_id",       UUID(as_uuid=True), sa.ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name",            sa.String(120), nullable=False),
        # dimension: 'profit_center' | 'segment' | 'cost_center'
        sa.Column("dimension",       sa.String(30), nullable=False),
        # split_method: 'proportional' (based on base-line amounts) | 'equal'
        sa.Column("split_method",    sa.String(20), server_default="proportional", nullable=False),
        sa.Column("is_active",       sa.Boolean(), server_default="true", nullable=False),
        sa.Column("created_at",      sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    op.create_table(
        "fin_split_rule_base",
        sa.Column("id",           UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("rule_id",      UUID(as_uuid=True), sa.ForeignKey("fin_split_rule.id", ondelete="CASCADE"), nullable=False),
        # account_type that acts as the allocation basis: 'expense' | 'income' | 'asset' etc.
        sa.Column("account_type", sa.String(20), nullable=False),
    )

    # ── Exploded split items (result of splitting) ────────────────────────────
    op.create_table(
        "fin_journal_split_item",
        sa.Column("id",              UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("journal_line_id", UUID(as_uuid=True), sa.ForeignKey("fin_journal_line.id", ondelete="CASCADE"), nullable=False),
        # Which dimension value this slice belongs to
        sa.Column("profit_center_id", UUID(as_uuid=True), sa.ForeignKey("fin_profit_center.id", ondelete="SET NULL"), nullable=True),
        sa.Column("segment_id",      UUID(as_uuid=True), sa.ForeignKey("fin_segment.id", ondelete="SET NULL"), nullable=True),
        sa.Column("cost_center_id",  UUID(as_uuid=True), sa.ForeignKey("fin_cost_center.id", ondelete="SET NULL"), nullable=True),
        sa.Column("debit",           sa.Numeric(18, 4), server_default="0"),
        sa.Column("credit",          sa.Numeric(18, 4), server_default="0"),
        sa.Column("split_pct",       sa.Numeric(7, 4),  nullable=False),    # 0–100
        sa.Column("created_at",      sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )


def downgrade() -> None:
    op.drop_table("fin_journal_split_item")
    op.drop_table("fin_split_rule_base")
    op.drop_table("fin_split_rule")
