"""fin023 - GL posting failure queue

Revision ID: fin023_posting_failure
Revises: fin022_phase8_schema_hardening
Create Date: 2026-10-27
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "fin023_posting_failure"
down_revision = "fin022_phase8_schema_hardening"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if sa.inspect(bind).has_table("fin_posting_failure"):
        return
    op.create_table(
        "fin_posting_failure",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("vendor_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source_type", sa.String(40), nullable=False),
        sa.Column("source_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("reference", sa.String(255)),
        sa.Column("amount", sa.Numeric(18, 2), server_default="0"),
        sa.Column("error", sa.Text()),
        sa.Column("payload", postgresql.JSONB()),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("status", sa.String(15), nullable=False, server_default="open"),
        sa.Column("journal_entry_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("fin_journal_entry.id", ondelete="SET NULL")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("last_attempt_at", sa.DateTime(timezone=True)),
        sa.Column("resolved_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("vendor_id", "source_type", "source_id", name="uq_fin_posting_failure_source"),
    )
    op.create_index("ix_fin_posting_failure_vendor_id", "fin_posting_failure", ["vendor_id"])
    op.create_index("ix_fin_posting_failure_status", "fin_posting_failure", ["status"])


def downgrade() -> None:
    op.drop_table("fin_posting_failure")
