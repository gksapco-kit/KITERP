"""fin013 – Posting Keys, Field Status Groups, Tolerance Groups

Adds:
  fin_posting_key          – debit/credit side + which fields are req/opt/suppressed
  fin_field_status_group   – named template attached to a GL account
  fin_field_status_rule    – per-field override within a group
  fin_tolerance_group      – per-user / company-wide amount limits

Also adds:
  fin_account.field_status_group_id  FK → fin_field_status_group
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "fin013_posting_keys_fsgs_tolerances"
down_revision = "fin012_financial_statement_versions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Posting Keys ────────────────────────────────────────────────────────
    op.create_table(
        "fin_posting_key",
        sa.Column("id",          sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("vendor_id",   sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("store.id", ondelete="CASCADE"), nullable=False),
        sa.Column("code",        sa.String(4),   nullable=False),      # e.g. "40", "50"
        sa.Column("name",        sa.String(120), nullable=False),
        sa.Column("side",        sa.String(6),   nullable=False),      # 'debit' | 'credit'
        sa.Column("account_type",sa.String(20),  nullable=True),       # asset | liability | income | expense
        sa.Column("reversal_key",sa.String(4),   nullable=True),       # counterpart posting key
        sa.Column("is_active",   sa.Boolean(),   server_default="true", nullable=False),
        sa.Column("created_at",  sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("vendor_id", "code", name="uq_fin_posting_key_vendor_code"),
    )

    # ── Field Status Groups ─────────────────────────────────────────────────
    op.create_table(
        "fin_field_status_group",
        sa.Column("id",         sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("vendor_id",  sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("store.id", ondelete="CASCADE"), nullable=False),
        sa.Column("code",       sa.String(10),  nullable=False),       # e.g. "G001"
        sa.Column("name",       sa.String(120), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("vendor_id", "code", name="uq_fin_fsg_vendor_code"),
    )

    op.create_table(
        "fin_field_status_rule",
        sa.Column("id",       sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("group_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("fin_field_status_group.id", ondelete="CASCADE"), nullable=False),
        # field_name: 'cost_center' | 'project' | 'assignment' | 'text' | 'payment_terms' | 'tax_code'
        sa.Column("field_name", sa.String(40), nullable=False),
        # status: 'required' | 'optional' | 'suppressed'
        sa.Column("status",     sa.String(15), nullable=False, server_default="optional"),
        sa.UniqueConstraint("group_id", "field_name", name="uq_fin_fsr_group_field"),
    )

    # ── Tolerance Groups ────────────────────────────────────────────────────
    op.create_table(
        "fin_tolerance_group",
        sa.Column("id",                    sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("vendor_id",             sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("store.id", ondelete="CASCADE"), nullable=False),
        sa.Column("code",                  sa.String(10),       nullable=False),     # "" = default group
        sa.Column("name",                  sa.String(120),      nullable=False),
        # Maximum amount per single document line
        sa.Column("max_line_amount",       sa.Numeric(18, 4),   nullable=True),
        # Maximum amount per whole document
        sa.Column("max_document_amount",   sa.Numeric(18, 4),   nullable=True),
        # Maximum cash-discount difference allowed when clearing (absolute)
        sa.Column("payment_diff_abs",      sa.Numeric(18, 4),   nullable=True),
        # Maximum cash-discount difference allowed when clearing (% of line)
        sa.Column("payment_diff_pct",      sa.Numeric(7, 4),    nullable=True),
        sa.Column("currency",              sa.String(3),        server_default="INR", nullable=False),
        sa.Column("created_at",            sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("vendor_id", "code", name="uq_fin_tg_vendor_code"),
    )

    # ── Link tolerance group to vendor_user ────────────────────────────────
    # We add a nullable FK column on vendor_user; NULL = apply the default group
    op.add_column(
        "vendor_user",
        sa.Column("fin_tolerance_group_id", sa.dialects.postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("fin_tolerance_group.id", ondelete="SET NULL"), nullable=True),
    )

    # ── Link field status group to fin_account ─────────────────────────────
    op.add_column(
        "fin_account",
        sa.Column("field_status_group_id", sa.dialects.postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("fin_field_status_group.id", ondelete="SET NULL"), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("fin_account", "field_status_group_id")
    op.drop_column("vendor_user", "fin_tolerance_group_id")
    op.drop_table("fin_tolerance_group")
    op.drop_table("fin_field_status_rule")
    op.drop_table("fin_field_status_group")
    op.drop_table("fin_posting_key")
