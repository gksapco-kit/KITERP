"""fin016 – Validations, Substitutions, and Number Ranges

Adds:
  fin_validation_rule   — posting-time validation conditions (SAP GGB0)
  fin_substitution_rule — field-value substitution rules (SAP GGB1)
  fin_number_range      — document number series per transaction type (SAP FBN1)
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "fin016_validations_subs_numranges"
down_revision = "fin015_fx_reval_carry_forward"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Validation Rules ──────────────────────────────────────────────────────
    op.create_table(
        "fin_validation_rule",
        sa.Column("id",          UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("vendor_id",   UUID(as_uuid=True), sa.ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name",        sa.String(120), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        # call_point: 'document' (whole JE) | 'line' (each JE line)
        sa.Column("call_point",  sa.String(10), server_default="document", nullable=False),
        # prerequisite_expr: Python-safe boolean expression evaluated first
        sa.Column("prerequisite_expr", sa.Text, nullable=True),
        # check_expr: Boolean expression that MUST be True for the JE to be accepted
        sa.Column("check_expr",  sa.Text, nullable=False),
        # error_message shown to user when check fails
        sa.Column("error_message", sa.String(500), nullable=False),
        sa.Column("is_active",   sa.Boolean(), server_default="true", nullable=False),
        sa.Column("sort_order",  sa.Integer, server_default="10", nullable=False),
        sa.Column("created_at",  sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # ── Substitution Rules ────────────────────────────────────────────────────
    op.create_table(
        "fin_substitution_rule",
        sa.Column("id",             UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("vendor_id",      UUID(as_uuid=True), sa.ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name",           sa.String(120), nullable=False),
        sa.Column("description",    sa.Text, nullable=True),
        sa.Column("call_point",     sa.String(10), server_default="line", nullable=False),
        # prerequisite_expr: when True, apply the substitution
        sa.Column("prerequisite_expr", sa.Text, nullable=True),
        # target_field: the journal-line field to overwrite (e.g. 'cost_center_id')
        sa.Column("target_field",   sa.String(60), nullable=False),
        # substitution_expr: Python expression that resolves to the replacement value
        sa.Column("substitution_expr", sa.Text, nullable=False),
        sa.Column("is_active",      sa.Boolean(), server_default="true", nullable=False),
        sa.Column("sort_order",     sa.Integer, server_default="10", nullable=False),
        sa.Column("created_at",     sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # ── Number Ranges ─────────────────────────────────────────────────────────
    op.create_table(
        "fin_number_range",
        sa.Column("id",            UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("vendor_id",     UUID(as_uuid=True), sa.ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False),
        # document_type: 'SA' (GL doc) | 'DR' (customer) | 'KR' (vendor) | 'AB' (accounting) etc.
        sa.Column("document_type", sa.String(4), nullable=False),
        sa.Column("fiscal_year",   sa.Integer, nullable=False),
        sa.Column("number_from",   sa.BigInteger, nullable=False),
        sa.Column("number_to",     sa.BigInteger, nullable=False),
        sa.Column("current_number",sa.BigInteger, nullable=False),
        sa.Column("prefix",        sa.String(10), nullable=True),   # optional string prefix
        sa.Column("is_external",   sa.Boolean(), server_default="false", nullable=False),  # user-assigned vs auto
        sa.Column("created_at",    sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("vendor_id", "document_type", "fiscal_year",
                            name="uq_fin_nr_vendor_type_fy"),
    )


def downgrade() -> None:
    op.drop_table("fin_number_range")
    op.drop_table("fin_substitution_rule")
    op.drop_table("fin_validation_rule")
