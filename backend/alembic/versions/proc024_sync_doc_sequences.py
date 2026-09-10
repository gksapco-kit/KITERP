"""Seed proc_document_sequence from existing procurement document numbers.

Revision ID: proc024_sync_doc_sequences
Revises: proc023_pr_item_tax_code
Create Date: 2026-09-10

Fixes unique-constraint failures when creating POs/PRs/etc. after the
sequence counter lagged behind rows already in the document tables
(e.g. docs created before sequences, or a reset counter).
"""
from alembic import op

revision = "proc024_sync_doc_sequences"
down_revision = "proc023_pr_item_tax_code"
branch_labels = None
depends_on = None

# (prefix, table, column, default width used by the app)
_SOURCES = (
    ("PO", "purchase_order", "po_number", 4),
    ("PR", "purchase_requisition", "pr_number", 6),
    ("RFQ", "rfq", "rfq_number", 6),
    ("SQ", "supplier_quotation", "quotation_number", 6),
    ("GRN", "grn", "grn_number", 6),
    ("GRNR", "grn_reversal", "reversal_number", 5),
    ("PRET", "purchase_return", "return_number", 6),
)


def upgrade() -> None:
    for prefix, table, column, width in _SOURCES:
        op.execute(f"""
            INSERT INTO proc_document_sequence (id, vendor_id, prefix, last_value, width)
            SELECT
                gen_random_uuid(),
                vendor_id,
                '{prefix}',
                COALESCE(MAX(
                    CAST(NULLIF(substring({column} from '{prefix}-([0-9]+)'), '') AS INTEGER)
                ), 0),
                {width}
            FROM {table}
            WHERE {column} ~ '^{prefix}-[0-9]+$'
            GROUP BY vendor_id
            HAVING COALESCE(MAX(
                CAST(NULLIF(substring({column} from '{prefix}-([0-9]+)'), '') AS INTEGER)
            ), 0) > 0
            ON CONFLICT (vendor_id, prefix) DO UPDATE
                SET last_value = GREATEST(
                    proc_document_sequence.last_value,
                    EXCLUDED.last_value
                )
        """)


def downgrade() -> None:
    # Non-destructive: leaving counters raised is safe (only creates gaps).
    pass
