"""ord002: order header enrichment — order type, payment/shipping terms, dates, blocks, statuses

Revision ID: ord002_order_header_enrichment
Revises: pm003_ap_project_tagging
Create Date: 2026-08-07

Phase-1 of sales-order maturity uplift.  All columns are nullable (or have a
safe default) so existing rows are unaffected and any in-flight requests keep
working without changes.

New columns on `order`:
  order_type           – document class: standard | quotation | return |
                         credit_note | debit_note | sample   (default 'standard')
  payment_terms_code   – free-text code like 'NET30', 'IMMEDIATE'
  payment_terms_days   – integer net days (0 = immediate)
  shipping_terms       – delivery / Incoterm-style string ('FOB Mumbai', 'CIF')
  order_reason         – why the order was placed ('promotional', 'replacement' …)
  requested_delivery_date – customer-requested delivery date (DATE)
  pricing_date         – date used for price determination (DATE, defaults to
                         order creation date at application layer)
  currency             – 3-char ISO currency code (default 'INR')
  exchange_rate        – rate against vendor base currency (NUMERIC 12,6, default 1)
  fulfillment_block    – if set, no shipment may be created (free-text reason)
  billing_block        – if set, no invoice may be raised (free-text reason)
  credit_status        – ok | watch | blocked | not_checked (nullable)
  fulfillment_status   – open | partial | complete | not_relevant (nullable)
  billing_status       – open | partial | complete | not_relevant (nullable)
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "ord002_order_header_enrichment"
down_revision = "pm003_ap_project_tagging"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    conn.execute(sa.text("""
        ALTER TABLE "order"
            ADD COLUMN IF NOT EXISTS order_type           VARCHAR(30)    NOT NULL DEFAULT 'standard',
            ADD COLUMN IF NOT EXISTS payment_terms_code   VARCHAR(50),
            ADD COLUMN IF NOT EXISTS payment_terms_days   INTEGER,
            ADD COLUMN IF NOT EXISTS shipping_terms       VARCHAR(50),
            ADD COLUMN IF NOT EXISTS order_reason         VARCHAR(100),
            ADD COLUMN IF NOT EXISTS requested_delivery_date DATE,
            ADD COLUMN IF NOT EXISTS pricing_date         DATE,
            ADD COLUMN IF NOT EXISTS currency             VARCHAR(3)     NOT NULL DEFAULT 'INR',
            ADD COLUMN IF NOT EXISTS exchange_rate        NUMERIC(12, 6) NOT NULL DEFAULT 1.0,
            ADD COLUMN IF NOT EXISTS fulfillment_block    VARCHAR(100),
            ADD COLUMN IF NOT EXISTS billing_block        VARCHAR(100),
            ADD COLUMN IF NOT EXISTS credit_status        VARCHAR(20),
            ADD COLUMN IF NOT EXISTS fulfillment_status   VARCHAR(20),
            ADD COLUMN IF NOT EXISTS billing_status       VARCHAR(20);
    """))

    conn.execute(sa.text("""
        CREATE INDEX IF NOT EXISTS ix_order_type
            ON "order" (vendor_id, order_type);
    """))
    conn.execute(sa.text("""
        CREATE INDEX IF NOT EXISTS ix_order_credit_status
            ON "order" (vendor_id, credit_status)
            WHERE credit_status IS NOT NULL;
    """))
    conn.execute(sa.text("""
        CREATE INDEX IF NOT EXISTS ix_order_fulfillment_status
            ON "order" (vendor_id, fulfillment_status)
            WHERE fulfillment_status IS NOT NULL;
    """))
    conn.execute(sa.text("""
        CREATE INDEX IF NOT EXISTS ix_order_billing_status
            ON "order" (vendor_id, billing_status)
            WHERE billing_status IS NOT NULL;
    """))
    conn.execute(sa.text("""
        CREATE INDEX IF NOT EXISTS ix_order_requested_delivery_date
            ON "order" (vendor_id, requested_delivery_date)
            WHERE requested_delivery_date IS NOT NULL;
    """))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text('DROP INDEX IF EXISTS ix_order_type;'))
    conn.execute(sa.text('DROP INDEX IF EXISTS ix_order_credit_status;'))
    conn.execute(sa.text('DROP INDEX IF EXISTS ix_order_fulfillment_status;'))
    conn.execute(sa.text('DROP INDEX IF EXISTS ix_order_billing_status;'))
    conn.execute(sa.text('DROP INDEX IF EXISTS ix_order_requested_delivery_date;'))
    conn.execute(sa.text("""
        ALTER TABLE "order"
            DROP COLUMN IF EXISTS order_type,
            DROP COLUMN IF EXISTS payment_terms_code,
            DROP COLUMN IF EXISTS payment_terms_days,
            DROP COLUMN IF EXISTS shipping_terms,
            DROP COLUMN IF EXISTS order_reason,
            DROP COLUMN IF EXISTS requested_delivery_date,
            DROP COLUMN IF EXISTS pricing_date,
            DROP COLUMN IF EXISTS currency,
            DROP COLUMN IF EXISTS exchange_rate,
            DROP COLUMN IF EXISTS fulfillment_block,
            DROP COLUMN IF EXISTS billing_block,
            DROP COLUMN IF EXISTS credit_status,
            DROP COLUMN IF EXISTS fulfillment_status,
            DROP COLUMN IF EXISTS billing_status;
    """))
