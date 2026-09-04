"""Procurement Phase 0: document sequences + invoice journal_entry_id

Revision ID: proc003_doc_sequences
Revises: proc002_pr_header_bu
Create Date: 2026-09-01

Changes:
  1. proc_document_sequence – per-tenant, per-prefix counter table with
     a UNIQUE (vendor_id, prefix) constraint so SELECT FOR UPDATE gives
     serialisable, gap-free numbering.
  2. vendor_invoice.journal_entry_id – links a posted AP invoice to the
     finance journal entry created by post_event("vendor_bill", …).
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = 'proc003_doc_sequences'
down_revision = 'proc002_pr_header_bu'
branch_labels = None
depends_on = None


def upgrade():
    # ── 1. Document sequence table ─────────────────────────────────
    op.create_table(
        'proc_document_sequence',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('vendor_id', UUID(as_uuid=True), nullable=False),
        sa.Column('prefix', sa.String(20), nullable=False),
        sa.Column('last_value', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('width', sa.Integer(), nullable=False, server_default='6'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True),
                  server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.UniqueConstraint('vendor_id', 'prefix', name='uq_proc_seq_vendor_prefix'),
    )
    op.create_index('ix_proc_seq_vendor', 'proc_document_sequence', ['vendor_id'])

    # ── 2. Journal entry link on vendor_invoice ────────────────────
    op.add_column(
        'vendor_invoice',
        sa.Column(
            'journal_entry_id',
            UUID(as_uuid=True),
            sa.ForeignKey('fin_journal_entry.id', ondelete='SET NULL'),
            nullable=True,
        ),
    )
    op.create_index(
        'ix_vi_journal_entry',
        'vendor_invoice',
        ['journal_entry_id'],
        postgresql_where=sa.text('journal_entry_id IS NOT NULL'),
    )


def downgrade():
    op.drop_index('ix_vi_journal_entry', table_name='vendor_invoice')
    op.drop_column('vendor_invoice', 'journal_entry_id')
    op.drop_index('ix_proc_seq_vendor', table_name='proc_document_sequence')
    op.drop_table('proc_document_sequence')
