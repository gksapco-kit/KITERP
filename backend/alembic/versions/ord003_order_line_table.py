"""ord003: order_line — normalized order line items

Revision ID: ord003_order_line_table
Revises: ord002_order_header_enrichment
Create Date: 2026-08-07

Phase-2 of sales-order maturity uplift.

Creates the `order_line` table so each order item becomes a first-class row
instead of a slot in the JSONB `order.items` array.  The JSONB cache is kept
in place — the two are kept in sync at the application layer, so existing
storefront, POS and mobile clients continue working without changes.

Columns:
  id                – UUID PK
  order_id          – FK → order
  vendor_id         – FK → vendor (for fast vendor-scoped queries)
  line_no           – integer sequence 10 / 20 / 30 … (insertion order)
  parent_line_id    – FK → order_line (for kit / BOM child lines)
  product_id        – FK → product (nullable)
  variant_id        – FK → product_variant (nullable)
  service_id        – FK → service (nullable)
  item_type         – product | service
  item_name         – frozen snapshot of name at time of order
  item_sku          – frozen snapshot of SKU
  item_image_url    – frozen snapshot
  line_type         – standard | free_of_charge | return | text_line
  ordered_qty       – customer-requested quantity
  committed_qty     – ATP-confirmed quantity (Phase-3)
  shipped_qty       – accumulated from shipment lines (Phase-5)
  invoiced_qty      – accumulated from billing (Phase-5)
  returned_qty      – accumulated from return lines
  rejected_qty      – quantity rejected / cancelled on this line
  unit_of_measure   – UoM code e.g. EA, KG, M
  list_price        – catalogue price before any discount
  net_price         – effective unit price after discount / rules
  discount_pct      – discount percentage applied
  discount_amount   – monetary discount per unit
  tax_rate          – GST / VAT rate %
  tax_amount        – monetary tax on this line
  line_total        – net_price * ordered_qty (gross of tax)
  plant_id          – FK → plant (nullable)
  storage_location_id – FK → storage_location (nullable)
  cost_center_id    – FK → fin_cost_center (nullable)
  profit_center_id  – FK → fin_profit_center (nullable)
  batch_number      – batch / lot reference
  serial_numbers    – JSONB array of serial number strings
  rejection_reason  – reason if rejected_qty > 0
  line_notes        – free-text note on this line
  price_rule_id     – UUID of the ProductPriceRule that determined the price
  price_rule_type   – type label from that rule
  created_at / updated_at
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "ord003_order_line_table"
down_revision = "ord002_order_header_enrichment"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS order_line (
            id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            order_id            UUID NOT NULL
                                    REFERENCES "order"(id) ON DELETE CASCADE,
            vendor_id           UUID NOT NULL
                                    REFERENCES vendor(id) ON DELETE CASCADE,

            line_no             INTEGER NOT NULL DEFAULT 10,
            parent_line_id      UUID REFERENCES order_line(id) ON DELETE SET NULL,

            -- Item reference (at least one of product_id / service_id required)
            product_id          UUID REFERENCES product(id) ON DELETE SET NULL,
            variant_id          UUID REFERENCES product_variant(id) ON DELETE SET NULL,
            service_id          UUID REFERENCES service(id) ON DELETE SET NULL,
            item_type           VARCHAR(20) NOT NULL DEFAULT 'product',

            -- Frozen snapshot
            item_name           VARCHAR(500) NOT NULL,
            item_sku            VARCHAR(100),
            item_image_url      TEXT,

            -- Line classification
            line_type           VARCHAR(30) NOT NULL DEFAULT 'standard',

            -- Quantities
            ordered_qty         NUMERIC(12, 3) NOT NULL DEFAULT 1,
            committed_qty       NUMERIC(12, 3) NOT NULL DEFAULT 0,
            shipped_qty         NUMERIC(12, 3) NOT NULL DEFAULT 0,
            invoiced_qty        NUMERIC(12, 3) NOT NULL DEFAULT 0,
            returned_qty        NUMERIC(12, 3) NOT NULL DEFAULT 0,
            rejected_qty        NUMERIC(12, 3) NOT NULL DEFAULT 0,
            unit_of_measure     VARCHAR(20) NOT NULL DEFAULT 'EA',

            -- Pricing
            list_price          NUMERIC(12, 2) NOT NULL DEFAULT 0,
            net_price           NUMERIC(12, 2) NOT NULL DEFAULT 0,
            discount_pct        NUMERIC(7, 4) NOT NULL DEFAULT 0,
            discount_amount     NUMERIC(12, 2) NOT NULL DEFAULT 0,
            tax_rate            NUMERIC(7, 4) NOT NULL DEFAULT 0,
            tax_amount          NUMERIC(12, 2) NOT NULL DEFAULT 0,
            line_total          NUMERIC(12, 2) NOT NULL DEFAULT 0,

            -- Plant / storage dimensions
            plant_id            UUID REFERENCES plant(id) ON DELETE SET NULL,
            storage_location_id UUID REFERENCES storage_location(id) ON DELETE SET NULL,

            -- CO / GL dimensions
            cost_center_id      UUID REFERENCES fin_cost_center(id) ON DELETE SET NULL,
            profit_center_id    UUID REFERENCES fin_profit_center(id) ON DELETE SET NULL,

            -- Batch / serial traceability
            batch_number        VARCHAR(100),
            serial_numbers      JSONB NOT NULL DEFAULT '[]'::jsonb,

            -- Rejection
            rejection_reason    VARCHAR(255),

            -- Text
            line_notes          TEXT,

            -- Price rule applied
            price_rule_id       UUID,
            price_rule_type     VARCHAR(30),

            created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

            CONSTRAINT uq_order_line_no UNIQUE (order_id, line_no)
        );
    """))

    # Core access patterns
    conn.execute(sa.text("""
        CREATE INDEX IF NOT EXISTS ix_order_line_order
            ON order_line (order_id);
    """))
    conn.execute(sa.text("""
        CREATE INDEX IF NOT EXISTS ix_order_line_vendor
            ON order_line (vendor_id, created_at DESC);
    """))
    conn.execute(sa.text("""
        CREATE INDEX IF NOT EXISTS ix_order_line_product
            ON order_line (product_id)
            WHERE product_id IS NOT NULL;
    """))
    conn.execute(sa.text("""
        CREATE INDEX IF NOT EXISTS ix_order_line_service
            ON order_line (service_id)
            WHERE service_id IS NOT NULL;
    """))
    conn.execute(sa.text("""
        CREATE INDEX IF NOT EXISTS ix_order_line_plant
            ON order_line (plant_id)
            WHERE plant_id IS NOT NULL;
    """))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("DROP TABLE IF EXISTS order_line CASCADE;"))
