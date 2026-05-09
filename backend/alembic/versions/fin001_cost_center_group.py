"""Add group column to fin_cost_center table.

Revision ID: fin001_cost_center_group
Revises: mrp003_product_material_type
Create Date: 2026-04-21
"""

revision = "fin001_cost_center_group"
down_revision = "mrp003_product_material_type"
branch_labels = None
depends_on = None

from alembic import op


def upgrade() -> None:
    op.execute("""
        ALTER TABLE fin_cost_center
            ADD COLUMN IF NOT EXISTS cc_group VARCHAR(100),
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_fin_cc_group
            ON fin_cost_center(vendor_id, cc_group);
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_fin_cc_group")
    op.execute("""
        ALTER TABLE fin_cost_center
            DROP COLUMN IF EXISTS cc_group,
            DROP COLUMN IF EXISTS updated_at;
    """)
