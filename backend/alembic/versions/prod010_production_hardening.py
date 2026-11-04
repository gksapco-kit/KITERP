"""production hardening: posting snapshot and related columns

Revision ID: prod010_production_hardening
Revises: ms009_production_routing
Create Date: 2026-10-26

Adds:
  production_order.inventory_posting — JSONB record of exactly what the completion
    posting moved (store, per-bin component allocations, finished-goods lines).
    The re-open reversal replays this instead of re-deriving from current fields.

Idempotent: mirrors app.database.ensure_production_hardening_columns.
"""
from alembic import op
import sqlalchemy as sa

revision = 'prod010_production_hardening'
down_revision = 'ms009_production_routing'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    op.execute(sa.text("ALTER TABLE production_order ADD COLUMN IF NOT EXISTS inventory_posting JSONB"))
    op.execute(sa.text("ALTER TABLE production_operation ADD COLUMN IF NOT EXISTS rate_applied NUMERIC(12,2)"))
    op.execute(sa.text(
        "ALTER TABLE product_bom_item ADD COLUMN IF NOT EXISTS scrap_pct NUMERIC(6,2) NOT NULL DEFAULT 0"
    ))


def downgrade():
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    op.execute(sa.text("ALTER TABLE product_bom_item DROP COLUMN IF EXISTS scrap_pct"))
    op.execute(sa.text("ALTER TABLE production_operation DROP COLUMN IF EXISTS rate_applied"))
    op.execute(sa.text("ALTER TABLE production_order DROP COLUMN IF EXISTS inventory_posting"))
