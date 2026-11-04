"""production extensions: partial output, BOM validity/versions, by-products, planning links

Revision ID: prod011_production_extensions
Revises: re001_realestate_baseline
Create Date: 2026-10-27

(Chained after the real-estate baseline, which already branches from prod010, so the
migration history keeps a single head.)

Idempotent: mirrors app.database.ensure_production_hardening_columns.
"""
from alembic import op
import sqlalchemy as sa

revision = 'prod011_production_extensions'
down_revision = 're001_realestate_baseline'
branch_labels = None
depends_on = None

_UP = [
    "ALTER TABLE production_order ADD COLUMN IF NOT EXISTS partial_outputs JSONB NOT NULL DEFAULT '[]'::jsonb",
    "ALTER TABLE product_bom_item ADD COLUMN IF NOT EXISTS valid_from DATE",
    "ALTER TABLE product_bom_item ADD COLUMN IF NOT EXISTS valid_to DATE",
    "ALTER TABLE product_bom_item ADD COLUMN IF NOT EXISTS is_byproduct BOOLEAN NOT NULL DEFAULT FALSE",
    "ALTER TABLE product_bom_item ADD COLUMN IF NOT EXISTS cost_share_pct NUMERIC(5,2) NOT NULL DEFAULT 0",
    """
    CREATE TABLE IF NOT EXISTS product_routing_step (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
        product_id UUID NOT NULL REFERENCES product(id) ON DELETE CASCADE,
        work_center_id UUID REFERENCES work_center(id) ON DELETE SET NULL,
        sequence INTEGER NOT NULL DEFAULT 0,
        name VARCHAR(200) NOT NULL,
        setup_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
        hours_per_unit NUMERIC(10,4) NOT NULL DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_routing_step_product ON product_routing_step (vendor_id, product_id, sequence)",
]
_DOWN = [
    "DROP TABLE IF EXISTS product_routing_step",
    "ALTER TABLE product_bom_item DROP COLUMN IF EXISTS cost_share_pct",
    "ALTER TABLE product_bom_item DROP COLUMN IF EXISTS is_byproduct",
    "ALTER TABLE product_bom_item DROP COLUMN IF EXISTS valid_to",
    "ALTER TABLE product_bom_item DROP COLUMN IF EXISTS valid_from",
    "ALTER TABLE production_order DROP COLUMN IF EXISTS partial_outputs",
]


def upgrade():
    if op.get_bind().dialect.name != "postgresql":
        return
    for stmt in _UP:
        op.execute(sa.text(stmt))


def downgrade():
    if op.get_bind().dialect.name != "postgresql":
        return
    for stmt in reversed(_DOWN):
        op.execute(sa.text(stmt))
