"""Add material_code column to product and service tables.

Adds a unique (per-vendor) human-readable material/item code that is
auto-assigned when a product or service is created.

Revision ID: mat001_material_code
Revises: ms005_bu_scope_more
Create Date: 2026-06-19
"""

revision = "mat001_material_code"
down_revision = "ms005_bu_scope_more"
branch_labels = None
depends_on = None

from alembic import op


def upgrade() -> None:
    op.execute("ALTER TABLE product ADD COLUMN IF NOT EXISTS material_code VARCHAR(40)")
    op.execute("ALTER TABLE service ADD COLUMN IF NOT EXISTS material_code VARCHAR(40)")
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS idx_product_material_code
            ON product(vendor_id, material_code)
            WHERE material_code IS NOT NULL
    """)
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS idx_service_material_code
            ON service(vendor_id, material_code)
            WHERE material_code IS NOT NULL
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_product_material_code")
    op.execute("DROP INDEX IF EXISTS idx_service_material_code")
    op.execute("ALTER TABLE product DROP COLUMN IF EXISTS material_code")
    op.execute("ALTER TABLE service DROP COLUMN IF EXISTS material_code")
