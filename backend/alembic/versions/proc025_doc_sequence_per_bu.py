"""Procurement doc sequences: per-business-unit support.

Revision ID: proc025_doc_sequence_per_bu
Revises: proc024_sync_doc_sequences
Create Date: 2026-09-11

Changes:
  1. Add store_id (nullable FK → store) — NULL = vendor-wide default.
  2. Add number_from / number_to — range bounds for UI display & enforcement.
  3. Add generated column store_scope (TEXT) = COALESCE(store_id::TEXT, '').
  4. Replace old (vendor_id, prefix) unique constraint with a new one on
     (vendor_id, store_scope, prefix) so NULL and non-NULL store_id rows
     each have exactly one counter per prefix.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "proc025_doc_sequence_per_bu"
down_revision = "proc024_sync_doc_sequences"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add store_id (nullable FK)
    op.add_column(
        "proc_document_sequence",
        sa.Column(
            "store_id",
            UUID(as_uuid=True),
            sa.ForeignKey("store.id", ondelete="CASCADE"),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_proc_seq_store",
        "proc_document_sequence",
        ["store_id"],
        postgresql_where=sa.text("store_id IS NOT NULL"),
    )

    # 2. Add range-bound columns (populated from existing last_value via defaults)
    op.add_column(
        "proc_document_sequence",
        sa.Column("number_from", sa.Integer(), nullable=False, server_default="1"),
    )
    op.add_column(
        "proc_document_sequence",
        sa.Column("number_to", sa.Integer(), nullable=False, server_default="999999"),
    )

    # 3. Add a generated column that collapses NULL store_id to '' so the
    #    unique constraint below treats all vendor-level rows as a single scope.
    op.execute(
        """
        ALTER TABLE proc_document_sequence
          ADD COLUMN store_scope TEXT
            GENERATED ALWAYS AS (COALESCE(store_id::TEXT, '')) STORED
        """
    )

    # 4. Swap unique constraint
    op.drop_constraint("uq_proc_seq_vendor_prefix", "proc_document_sequence")
    op.create_unique_constraint(
        "uq_proc_seq_vendor_scope_prefix",
        "proc_document_sequence",
        ["vendor_id", "store_scope", "prefix"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_proc_seq_vendor_scope_prefix", "proc_document_sequence")
    op.create_unique_constraint(
        "uq_proc_seq_vendor_prefix", "proc_document_sequence", ["vendor_id", "prefix"]
    )
    op.execute(
        "ALTER TABLE proc_document_sequence DROP COLUMN store_scope"
    )
    op.drop_column("proc_document_sequence", "number_to")
    op.drop_column("proc_document_sequence", "number_from")
    op.drop_index("ix_proc_seq_store", table_name="proc_document_sequence")
    op.drop_column("proc_document_sequence", "store_id")
