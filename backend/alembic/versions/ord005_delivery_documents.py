"""ord005: delivery documents — outbound delivery header + lines

Revision ID: ord005_delivery_documents
Revises: ord004_order_line_schedule
Create Date: 2026-08-07

Phase-4 of sales-order maturity uplift.

Creates two tables:

  delivery
    Outbound delivery document (SAP-equivalent VL01N / LIKP).
    Tracks picking → packing → goods-issue lifecycle.
    delivery_number is generated from a PostgreSQL sequence (DEL-00001 …).

  delivery_line
    One row per order-line included in this delivery (LIPS equivalent).
    Records planned, picked, packed and issued quantities.

Goods issue does NOT re-deduct inventory (stock was already deducted at order
confirmation / payment verification).  GI posting only:
  • sets delivery status to goods_issued
  • propagates shipped_qty back to order_line and order_line_schedule
  • updates Order.fulfillment_status / shipped_at
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "ord005_delivery_documents"
down_revision = "ord004_order_line_schedule"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # Counter sequence for DEL numbers (global, not per-vendor — simpler)
    conn.execute(sa.text(
        "CREATE SEQUENCE IF NOT EXISTS del_number_seq START 1 INCREMENT 1;"
    ))

    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS delivery (
            id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            delivery_number  VARCHAR(30) NOT NULL
                                 DEFAULT ('DEL-' || lpad(nextval('del_number_seq')::text, 5, '0')),
            order_id         UUID NOT NULL
                                 REFERENCES "order"(id) ON DELETE RESTRICT,
            vendor_id        UUID NOT NULL
                                 REFERENCES vendor(id) ON DELETE CASCADE,
            store_id         UUID
                                 REFERENCES store(id) ON DELETE SET NULL,

            -- standard | returns
            delivery_type    VARCHAR(20) NOT NULL DEFAULT 'standard',

            -- draft | picking | packed | goods_issued | cancelled
            status           VARCHAR(20) NOT NULL DEFAULT 'draft',

            planned_gi_date  DATE,
            actual_gi_date   DATE,

            carrier          VARCHAR(100),
            tracking_number  VARCHAR(100),
            shipping_address JSONB,

            notes            TEXT,
            created_by       UUID REFERENCES "user"(id) ON DELETE SET NULL,
            created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

            CONSTRAINT uq_delivery_number UNIQUE (delivery_number)
        );
    """))

    conn.execute(sa.text("""
        CREATE INDEX IF NOT EXISTS ix_delivery_order
            ON delivery (order_id);
    """))
    conn.execute(sa.text("""
        CREATE INDEX IF NOT EXISTS ix_delivery_vendor
            ON delivery (vendor_id);
    """))
    conn.execute(sa.text("""
        CREATE INDEX IF NOT EXISTS ix_delivery_status
            ON delivery (vendor_id, status);
    """))

    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS delivery_line (
            id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            delivery_id      UUID NOT NULL
                                 REFERENCES delivery(id) ON DELETE CASCADE,
            order_id         UUID NOT NULL
                                 REFERENCES "order"(id) ON DELETE CASCADE,
            order_line_id    UUID
                                 REFERENCES order_line(id) ON DELETE SET NULL,
            vendor_id        UUID NOT NULL
                                 REFERENCES vendor(id) ON DELETE CASCADE,

            line_no          INTEGER NOT NULL DEFAULT 1,
            product_id       UUID REFERENCES product(id) ON DELETE SET NULL,
            variant_id       UUID REFERENCES product_variant(id) ON DELETE SET NULL,
            product_name     VARCHAR(300),
            sku              VARCHAR(100),
            unit             VARCHAR(30) DEFAULT 'pcs',

            planned_qty      NUMERIC(12, 3) NOT NULL DEFAULT 0,
            picked_qty       NUMERIC(12, 3) NOT NULL DEFAULT 0,
            packed_qty       NUMERIC(12, 3) NOT NULL DEFAULT 0,
            issued_qty       NUMERIC(12, 3) NOT NULL DEFAULT 0,

            -- open | picking | picked | packed | issued
            status           VARCHAR(20) NOT NULL DEFAULT 'open',

            batch_number     VARCHAR(100),
            serial_number    VARCHAR(100),
            notes            TEXT,
            created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

            CONSTRAINT uq_delivery_line_no UNIQUE (delivery_id, line_no)
        );
    """))

    conn.execute(sa.text("""
        CREATE INDEX IF NOT EXISTS ix_dl_delivery
            ON delivery_line (delivery_id);
    """))
    conn.execute(sa.text("""
        CREATE INDEX IF NOT EXISTS ix_dl_order_line
            ON delivery_line (order_line_id);
    """))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("DROP TABLE IF EXISTS delivery_line CASCADE;"))
    conn.execute(sa.text("DROP TABLE IF EXISTS delivery CASCADE;"))
    conn.execute(sa.text("DROP SEQUENCE IF EXISTS del_number_seq;"))
