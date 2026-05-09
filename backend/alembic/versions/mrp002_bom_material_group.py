"""BOM material group, uom override and sequence fields.

Revision ID: mrp002_bom_material_group
Revises: cust002_fix_linked_customer_id
Create Date: 2026-04-21
"""

revision = "mrp002_bom_material_group"
down_revision = "cust002_fix_linked_customer_id"
branch_labels = None
depends_on = None

from alembic import op


def upgrade() -> None:
    op.execute("""
        ALTER TABLE product_bom_item
            ADD COLUMN IF NOT EXISTS material_group VARCHAR(40) NOT NULL DEFAULT 'raw_material',
            ADD COLUMN IF NOT EXISTS uom_override   VARCHAR(30),
            ADD COLUMN IF NOT EXISTS sequence        INTEGER NOT NULL DEFAULT 0;
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_bom_material_group
            ON product_bom_item(product_id, material_group);
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_bom_material_group")
    op.execute("""
        ALTER TABLE product_bom_item
            DROP COLUMN IF EXISTS material_group,
            DROP COLUMN IF EXISTS uom_override,
            DROP COLUMN IF EXISTS sequence;
    """)
