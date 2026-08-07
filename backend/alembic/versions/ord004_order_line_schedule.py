"""ord004: order_line_schedule — per-line delivery commitments and ATP

Revision ID: ord004_order_line_schedule
Revises: ord003_order_line_table
Create Date: 2026-08-07

Phase-3 of sales-order maturity uplift.

Creates `order_line_schedule` — one or more dated delivery commitments per
order line (SAP-style schedule lines / VBEP).  Each row records how many units
are promised on what date and tracks progress through to shipment.

The companion commitment service runs at order creation:
  - Checks on-hand stock at the order's business unit (store_inventory).
  - Subtracts active reservations (stock_reservation).
  - Creates committed schedule lines for available qty + a stock_reservation.
  - Leaves any un-coverable qty as an "open" schedule line.

Columns:
  id                – UUID PK
  order_line_id     – FK → order_line
  order_id          – FK → order (for fast order-level queries)
  vendor_id         – FK → vendor
  schedule_no       – 1-based integer per line (allows gaps for insertions)
  requested_date    – date the customer wants delivery
  confirmed_date    – date the vendor has committed to deliver
  requested_qty     – customer-requested quantity for this schedule slot
  confirmed_qty     – vendor-committed quantity (may be < requested if partial)
  shipped_qty       – fulfilled from this schedule line so far
  status            – open | committed | partial | shipped | closed | cancelled
  commitment_source – in_stock | purchase_order | lead_time | manual | none
  notes
  created_at / updated_at
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "ord004_order_line_schedule"
down_revision = "ord003_order_line_table"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS order_line_schedule (
            id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            order_line_id    UUID NOT NULL
                                 REFERENCES order_line(id) ON DELETE CASCADE,
            order_id         UUID NOT NULL
                                 REFERENCES "order"(id) ON DELETE CASCADE,
            vendor_id        UUID NOT NULL
                                 REFERENCES vendor(id) ON DELETE CASCADE,

            schedule_no      INTEGER NOT NULL DEFAULT 1,
            requested_date   DATE,
            confirmed_date   DATE,
            requested_qty    NUMERIC(12, 3) NOT NULL DEFAULT 0,
            confirmed_qty    NUMERIC(12, 3) NOT NULL DEFAULT 0,
            shipped_qty      NUMERIC(12, 3) NOT NULL DEFAULT 0,

            -- open | committed | partial | shipped | closed | cancelled
            status           VARCHAR(20) NOT NULL DEFAULT 'open',
            -- in_stock | purchase_order | lead_time | manual | none
            commitment_source VARCHAR(30) NOT NULL DEFAULT 'none',

            notes            TEXT,
            created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

            CONSTRAINT uq_order_line_schedule_no UNIQUE (order_line_id, schedule_no)
        );
    """))

    conn.execute(sa.text("""
        CREATE INDEX IF NOT EXISTS ix_ols_order_line
            ON order_line_schedule (order_line_id);
    """))
    conn.execute(sa.text("""
        CREATE INDEX IF NOT EXISTS ix_ols_order
            ON order_line_schedule (order_id);
    """))
    conn.execute(sa.text("""
        CREATE INDEX IF NOT EXISTS ix_ols_confirmed_date
            ON order_line_schedule (vendor_id, confirmed_date)
            WHERE confirmed_date IS NOT NULL;
    """))
    conn.execute(sa.text("""
        CREATE INDEX IF NOT EXISTS ix_ols_status
            ON order_line_schedule (vendor_id, status);
    """))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("DROP TABLE IF EXISTS order_line_schedule CASCADE;"))
