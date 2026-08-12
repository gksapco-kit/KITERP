"""ord009: per-line condition scope + order_line_history

Revision ID: ord009_line_conditions_schedules
Revises: ord008_pricing_conditions
Create Date: 2026-08-12

Adds:
  1. order_pricing_condition.order_line_id — nullable FK so a condition can be
     scoped to a single line instead of the whole order (NULL = header-level).
  2. order_line_history — lightweight change log per order line (field-level
     before/after, changed_by, timestamp).  Powers the per-line History tab.
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "ord009_line_conditions_schedules"
down_revision = "ord008_pricing_conditions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # ── 1. Scope pricing conditions to a line ────────────────────────────────
    conn.execute(sa.text("""
        ALTER TABLE order_pricing_condition
            ADD COLUMN IF NOT EXISTS order_line_id UUID
                REFERENCES order_line(id) ON DELETE CASCADE;
    """))
    conn.execute(sa.text("""
        CREATE INDEX IF NOT EXISTS ix_opc_line
            ON order_pricing_condition (order_line_id)
            WHERE order_line_id IS NOT NULL;
    """))

    # ── 2. Per-line change history ────────────────────────────────────────────
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS order_line_history (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            order_line_id   UUID NOT NULL
                                REFERENCES order_line(id) ON DELETE CASCADE,
            order_id        UUID NOT NULL
                                REFERENCES "order"(id) ON DELETE CASCADE,
            vendor_id       UUID NOT NULL
                                REFERENCES vendor(id) ON DELETE CASCADE,
            field_name      VARCHAR(100) NOT NULL,
            old_value       TEXT,
            new_value       TEXT,
            changed_by      UUID REFERENCES "user"(id) ON DELETE SET NULL,
            changed_by_role VARCHAR(20),
            notes           TEXT,
            timestamp       TIMESTAMPTZ NOT NULL DEFAULT now()
        );
    """))
    conn.execute(sa.text("""
        CREATE INDEX IF NOT EXISTS ix_olh_order_line
            ON order_line_history (order_line_id);
    """))
    conn.execute(sa.text("""
        CREATE INDEX IF NOT EXISTS ix_olh_order
            ON order_line_history (order_id);
    """))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("DROP TABLE IF EXISTS order_line_history CASCADE;"))
    conn.execute(sa.text("""
        ALTER TABLE order_pricing_condition
            DROP COLUMN IF EXISTS order_line_id;
    """))
