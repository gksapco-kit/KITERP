"""ord006: link invoice to outbound delivery + tighten billing status

Revision ID: ord006_invoice_delivery_link
Revises: ord005_delivery_documents
Create Date: 2026-08-07

Phase-5 of sales-order maturity uplift.

Changes:
  1. Add delivery_id (nullable FK → delivery) to the existing invoice table.
     Allows tracing which delivery triggered each billing document.
  2. Add index on (order_id, delivery_id) for fast billing-status look-ups.

The Order.billing_block and Order.billing_status columns already exist from
ord002_order_header_enrichment.  No schema changes needed there.
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "ord006_invoice_delivery_link"
down_revision = "ord005_delivery_documents"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # Add delivery_id FK (nullable — existing invoices won't have one)
    conn.execute(sa.text("""
        ALTER TABLE invoice
        ADD COLUMN IF NOT EXISTS delivery_id UUID
            REFERENCES delivery(id) ON DELETE SET NULL;
    """))

    conn.execute(sa.text("""
        CREATE INDEX IF NOT EXISTS ix_invoice_delivery
            ON invoice (delivery_id)
            WHERE delivery_id IS NOT NULL;
    """))

    conn.execute(sa.text("""
        CREATE INDEX IF NOT EXISTS ix_invoice_order_delivery
            ON invoice (order_id, delivery_id)
            WHERE order_id IS NOT NULL;
    """))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_invoice_order_delivery;"))
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_invoice_delivery;"))
    conn.execute(sa.text("ALTER TABLE invoice DROP COLUMN IF EXISTS delivery_id;"))
