"""ord007: order_partner — named partner functions per sales order

Revision ID: ord007_order_partners
Revises: ord006_invoice_delivery_link
Create Date: 2026-08-07

Phase-6 of sales-order maturity uplift.

In B2B commerce a single order can involve several distinct parties:

  buyer          — who placed the order        (sold-to)
  ship_to        — where goods are delivered   (ship-to / WE in SAP)
  bill_to        — who receives the invoice    (bill-to / RE in SAP)
  payer          — who settles the payment     (payer  / RG in SAP)
  contact        — general contact person at the buyer
  other          — any additional party

Most consumer orders will have only a `buyer` row (auto-seeded from the
customer record).  B2B orders can override ship_to / bill_to / payer
with different addresses or customer records.

Each (order_id, role) pair is unique — there is exactly one party per role
per order.  The customer_id FK is optional; the partner can also be a
free-form contact stored in contact_* columns.
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "ord007_order_partners"
down_revision = "ord006_invoice_delivery_link"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS order_partner (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            order_id        UUID NOT NULL
                                REFERENCES "order"(id) ON DELETE CASCADE,
            vendor_id       UUID NOT NULL
                                REFERENCES vendor(id) ON DELETE CASCADE,

            -- buyer | ship_to | bill_to | payer | contact | other
            role            VARCHAR(30) NOT NULL,

            -- Optional link to a known customer record
            customer_id     UUID REFERENCES customer(id) ON DELETE SET NULL,

            -- Free-form contact snapshot (filled from customer or entered manually)
            contact_name    VARCHAR(255),
            contact_email   VARCHAR(255),
            contact_phone   VARCHAR(30),
            company_name    VARCHAR(255),
            gstin           VARCHAR(15),
            address         JSONB,

            notes           TEXT,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

            CONSTRAINT uq_order_partner_role UNIQUE (order_id, role)
        );
    """))

    conn.execute(sa.text("""
        CREATE INDEX IF NOT EXISTS ix_op_order
            ON order_partner (order_id);
    """))
    conn.execute(sa.text("""
        CREATE INDEX IF NOT EXISTS ix_op_vendor
            ON order_partner (vendor_id);
    """))
    conn.execute(sa.text("""
        CREATE INDEX IF NOT EXISTS ix_op_customer
            ON order_partner (customer_id)
            WHERE customer_id IS NOT NULL;
    """))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("DROP TABLE IF EXISTS order_partner CASCADE;"))
