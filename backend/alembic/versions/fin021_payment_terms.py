"""fin021 – Payment Terms master data

Creates three tables that form the payment-terms feature in the Finance module:
  fin_payment_term         – header: code, name, clock-start rules
  fin_payment_term_stage   – child: scheduled portions (must total 100%)
  fin_payment_term_discount – child: early-payment reductions

Revision ID: fin021_payment_terms
Revises: fin020_tax_code_unique_constraint
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "fin021_payment_terms"
down_revision = "fin020_tax_code_unique_constraint"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "fin_payment_term",
        sa.Column("id",         UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("vendor_id",  UUID(as_uuid=True), sa.ForeignKey("vendor.id",      ondelete="CASCADE"), nullable=False),
        sa.Column("company_id", UUID(as_uuid=True), sa.ForeignKey("fin_company.id", ondelete="CASCADE"), nullable=True),

        sa.Column("code",        sa.String(20),  nullable=False),
        sa.Column("name",        sa.String(120), nullable=False),
        sa.Column("description", sa.Text,        nullable=True),

        # which side of the business may use this term
        sa.Column("usage", sa.String(10), nullable=False, server_default="both"),

        # clock-start configuration
        sa.Column("starts_from",        sa.String(25), nullable=False, server_default="invoice_date"),
        sa.Column("start_offset_days",  sa.Integer,    nullable=False, server_default="0"),
        sa.Column("start_on_day",       sa.Integer,    nullable=True),
        sa.Column("start_shift_months", sa.Integer,    nullable=False, server_default="0"),

        sa.Column("round_to_month_end", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("grace_days",         sa.Integer, nullable=False, server_default="0"),

        sa.Column("is_active",  sa.Boolean, nullable=False, server_default="true"),
        sa.Column("is_default", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),

        sa.UniqueConstraint("vendor_id", "company_id", "code", name="uq_fin_payment_term_code"),
    )
    op.create_index("ix_fin_payment_term_vendor", "fin_payment_term", ["vendor_id"])

    op.create_table(
        "fin_payment_term_stage",
        sa.Column("id",         UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("term_id",    UUID(as_uuid=True), sa.ForeignKey("fin_payment_term.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="1"),
        sa.Column("label",      sa.String(80), nullable=True),
        sa.Column("share_pct",  sa.Numeric(7, 4), nullable=False),
        sa.Column("due_days",   sa.Integer, nullable=False, server_default="0"),
        sa.Column("due_on_day", sa.Integer, nullable=True),

        sa.UniqueConstraint("term_id", "sort_order", name="uq_fin_pt_stage_order"),
    )
    op.create_index("ix_fin_payment_term_stage_term", "fin_payment_term_stage", ["term_id"])

    op.create_table(
        "fin_payment_term_discount",
        sa.Column("id",           UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("term_id",      UUID(as_uuid=True), sa.ForeignKey("fin_payment_term.id",       ondelete="CASCADE"), nullable=False),
        sa.Column("stage_id",     UUID(as_uuid=True), sa.ForeignKey("fin_payment_term_stage.id", ondelete="CASCADE"), nullable=True),
        sa.Column("within_days",  sa.Integer,      nullable=False),
        sa.Column("discount_pct", sa.Numeric(7, 4), nullable=False),

        sa.UniqueConstraint("term_id", "within_days", name="uq_fin_pt_discount_days"),
    )
    op.create_index("ix_fin_payment_term_discount_term", "fin_payment_term_discount", ["term_id"])


def downgrade() -> None:
    op.drop_table("fin_payment_term_discount")
    op.drop_table("fin_payment_term_stage")
    op.drop_table("fin_payment_term")
