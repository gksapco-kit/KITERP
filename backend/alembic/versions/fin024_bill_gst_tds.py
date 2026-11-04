"""fin024 - vendor bill GST split + TDS columns

Revision ID: fin024_bill_gst_tds
Revises: fin023_posting_failure
Create Date: 2026-10-27
"""
from __future__ import annotations

from alembic import op

revision = "fin024_bill_gst_tds"
down_revision = "fin023_posting_failure"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE fin_vendor_bill
            ADD COLUMN IF NOT EXISTS cgst_amount NUMERIC(18,2),
            ADD COLUMN IF NOT EXISTS sgst_amount NUMERIC(18,2),
            ADD COLUMN IF NOT EXISTS igst_amount NUMERIC(18,2),
            ADD COLUMN IF NOT EXISTS tds_section VARCHAR(10),
            ADD COLUMN IF NOT EXISTS tds_rate NUMERIC(6,3),
            ADD COLUMN IF NOT EXISTS tds_amount NUMERIC(18,2) DEFAULT 0
    """)
    # Existing open bills keep balance_due == total (no TDS was ever deducted on them).
    op.execute("CREATE INDEX IF NOT EXISTS ix_fin_vendor_bill_tds ON fin_vendor_bill (vendor_id, tds_section) "
               "WHERE tds_section IS NOT NULL")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_fin_vendor_bill_tds")
    op.execute("""
        ALTER TABLE fin_vendor_bill
            DROP COLUMN IF EXISTS tds_amount, DROP COLUMN IF EXISTS tds_rate,
            DROP COLUMN IF EXISTS tds_section, DROP COLUMN IF EXISTS igst_amount,
            DROP COLUMN IF EXISTS sgst_amount, DROP COLUMN IF EXISTS cgst_amount
    """)
