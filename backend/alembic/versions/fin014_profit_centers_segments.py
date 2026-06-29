"""fin014 – Profit Centers & Segments

Adds two new dimension tables and extends fin_journal_line with
profit_center_id and segment_id — equivalent to SAP EC-PCA / segment reporting.

  fin_profit_center  — internal P&L reporting unit (below company / cost centre)
  fin_segment        — top-level segment for IFRS 8 segment reporting
  fin_journal_line   — two new nullable FK columns
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "fin014_profit_centers_segments"
down_revision = "fin013_posting_keys_fsgs_tolerances"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Profit Centers ───────────────────────────────────────────────────────
    op.create_table(
        "fin_profit_center",
        sa.Column("id",          UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("vendor_id",   UUID(as_uuid=True), sa.ForeignKey("store.id", ondelete="CASCADE"), nullable=False),
        sa.Column("code",        sa.String(20),  nullable=False),
        sa.Column("name",        sa.String(120), nullable=False),
        sa.Column("description", sa.Text,        nullable=True),
        # Optional hierarchy parent
        sa.Column("parent_id",   UUID(as_uuid=True), sa.ForeignKey("fin_profit_center.id", ondelete="SET NULL"), nullable=True),
        # Responsible person / manager
        sa.Column("manager",     sa.String(120), nullable=True),
        sa.Column("is_active",   sa.Boolean(), server_default="true", nullable=False),
        sa.Column("created_at",  sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("vendor_id", "code", name="uq_fin_pc_vendor_code"),
    )

    # ── Segments ─────────────────────────────────────────────────────────────
    op.create_table(
        "fin_segment",
        sa.Column("id",          UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("vendor_id",   UUID(as_uuid=True), sa.ForeignKey("store.id", ondelete="CASCADE"), nullable=False),
        sa.Column("code",        sa.String(20),  nullable=False),
        sa.Column("name",        sa.String(120), nullable=False),
        sa.Column("description", sa.Text,        nullable=True),
        sa.Column("is_active",   sa.Boolean(), server_default="true", nullable=False),
        sa.Column("created_at",  sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("vendor_id", "code", name="uq_fin_seg_vendor_code"),
    )

    # ── Extend journal line ───────────────────────────────────────────────────
    op.add_column(
        "fin_journal_line",
        sa.Column("profit_center_id", UUID(as_uuid=True),
                  sa.ForeignKey("fin_profit_center.id", ondelete="SET NULL"), nullable=True),
    )
    op.add_column(
        "fin_journal_line",
        sa.Column("segment_id", UUID(as_uuid=True),
                  sa.ForeignKey("fin_segment.id", ondelete="SET NULL"), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("fin_journal_line", "segment_id")
    op.drop_column("fin_journal_line", "profit_center_id")
    op.drop_table("fin_segment")
    op.drop_table("fin_profit_center")
