"""ord008: order_pricing_condition — header-level pricing adjustments

Revision ID: ord008_pricing_conditions
Revises: ord007_order_partners
Create Date: 2026-08-07

Phase-7 of sales-order maturity uplift.

Creates `order_pricing_condition` — header-level pricing steps applied on
top of the per-line product price rules already stored in order_line.

Examples of header-level conditions:
  header_discount   — negotiated % or amount off the whole order
  freight           — freight/shipping surcharge
  surcharge         — any additional surcharge
  special           — one-off manual adjustment (e.g. loyalty reward, rebate)
  tax_override      — override tax calculation for specific jurisdictions

Each row has:
  step_no           — ordering (lower = applied first)
  condition_type    — header_discount | freight | surcharge | special | tax_override
  description       — human label ("10% project discount approved by GM")
  calc_type         — percent | fixed
  value             — the percent or fixed amount
  base_amount       — amount the condition was applied to (for audit)
  condition_amount  — final monetary impact (+ for surcharge, - for discount)
  is_manual         — true if added by a user; false if auto-applied
  applied_by        — FK → user who added/approved it
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "ord008_pricing_conditions"
down_revision = "ord007_order_partners"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS order_pricing_condition (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            order_id        UUID NOT NULL
                                REFERENCES "order"(id) ON DELETE CASCADE,
            vendor_id       UUID NOT NULL
                                REFERENCES vendor(id) ON DELETE CASCADE,

            step_no         INTEGER NOT NULL DEFAULT 1,

            -- header_discount | freight | surcharge | special | tax_override
            condition_type  VARCHAR(30) NOT NULL,

            description     VARCHAR(255) NOT NULL,

            -- percent | fixed
            calc_type       VARCHAR(20) NOT NULL DEFAULT 'percent',

            value           NUMERIC(12, 4) NOT NULL DEFAULT 0,  -- % or amount
            base_amount     NUMERIC(14, 2),                     -- subtotal applied against
            condition_amount NUMERIC(14, 2) NOT NULL DEFAULT 0, -- net monetary impact

            is_manual       BOOLEAN NOT NULL DEFAULT true,
            applied_by      UUID REFERENCES "user"(id) ON DELETE SET NULL,

            notes           TEXT,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
        );
    """))

    conn.execute(sa.text("""
        CREATE INDEX IF NOT EXISTS ix_opc_order
            ON order_pricing_condition (order_id);
    """))
    conn.execute(sa.text("""
        CREATE INDEX IF NOT EXISTS ix_opc_vendor
            ON order_pricing_condition (vendor_id);
    """))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("DROP TABLE IF EXISTS order_pricing_condition CASCADE;"))
