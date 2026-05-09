"""Add material_type and bom_enabled columns to product table.

Revision ID: mrp003_product_material_type
Revises: mrp002_bom_material_group
Create Date: 2026-04-21
"""

revision = "mrp003_product_material_type"
down_revision = "mrp002_bom_material_group"
branch_labels = None
depends_on = None

from alembic import op


def upgrade() -> None:
    op.execute("""
        ALTER TABLE product
            ADD COLUMN IF NOT EXISTS material_type VARCHAR(30) NOT NULL DEFAULT 'finished',
            ADD COLUMN IF NOT EXISTS bom_enabled   BOOLEAN    NOT NULL DEFAULT FALSE;
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_product_material_type
            ON product(vendor_id, material_type);
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_product_material_type")
    op.execute("""
        ALTER TABLE product
            DROP COLUMN IF EXISTS material_type,
            DROP COLUMN IF EXISTS bom_enabled;
    """)
