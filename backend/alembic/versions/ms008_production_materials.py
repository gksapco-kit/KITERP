"""production materials: store-scoped stock reservations + production order tracking

Revision ID: ms008_production_materials
Revises: ms007_sales_area
Create Date: 2026-07-01

Foundational schema for wiring BOM/MRP into Production Orders:

  stock_reservation  + store_id, storage_location_id, consumed_at
                        (reservations now scoped to the business unit /
                        location holding the physical stock — StoreInventory
                        stays the source of truth for on-hand quantity)

  production_order    + material_requirements  (JSONB snapshot of exploded
                          BOM components taken at confirm time)
                        + materials_reserved_at / materials_released_at
                        + inventory_posted_at   (idempotency guard for the
                          completion stock postings)
                        + planned/actual material & labor cost columns

All additive and nullable — no existing behaviour changes.

Idempotent: safe to re-run; mirrors app.database.ensure_production_materials_columns.
"""
from alembic import op
import sqlalchemy as sa

revision = 'ms008_production_materials'
down_revision = 'ms007_sales_area'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    op.execute(sa.text("ALTER TABLE stock_reservation ADD COLUMN IF NOT EXISTS store_id UUID"))
    op.execute(sa.text("ALTER TABLE stock_reservation ADD COLUMN IF NOT EXISTS storage_location_id UUID"))
    op.execute(sa.text("ALTER TABLE stock_reservation ADD COLUMN IF NOT EXISTS consumed_at TIMESTAMPTZ"))

    op.execute(sa.text(
        "ALTER TABLE production_order ADD COLUMN IF NOT EXISTS material_requirements JSONB NOT NULL DEFAULT '[]'::jsonb"
    ))
    op.execute(sa.text("ALTER TABLE production_order ADD COLUMN IF NOT EXISTS materials_reserved_at TIMESTAMPTZ"))
    op.execute(sa.text("ALTER TABLE production_order ADD COLUMN IF NOT EXISTS materials_released_at TIMESTAMPTZ"))
    op.execute(sa.text("ALTER TABLE production_order ADD COLUMN IF NOT EXISTS inventory_posted_at TIMESTAMPTZ"))
    op.execute(sa.text("ALTER TABLE production_order ADD COLUMN IF NOT EXISTS planned_material_cost NUMERIC(14,2)"))
    op.execute(sa.text("ALTER TABLE production_order ADD COLUMN IF NOT EXISTS planned_labor_cost NUMERIC(14,2)"))
    op.execute(sa.text("ALTER TABLE production_order ADD COLUMN IF NOT EXISTS actual_material_cost NUMERIC(14,2)"))
    op.execute(sa.text("ALTER TABLE production_order ADD COLUMN IF NOT EXISTS actual_labor_cost NUMERIC(14,2)"))

    fk_specs = (
        ("fk_stock_reservation_store", "stock_reservation", "store_id", "store", "SET NULL"),
        ("fk_stock_reservation_location", "stock_reservation", "storage_location_id", "storage_location", "SET NULL"),
    )
    for fk_name, table, column, ref_table, on_delete in fk_specs:
        op.execute(sa.text(f"""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = '{fk_name}'
                ) THEN
                    ALTER TABLE {table}
                    ADD CONSTRAINT {fk_name}
                    FOREIGN KEY ({column}) REFERENCES {ref_table}(id) ON DELETE {on_delete};
                END IF;
            END $$;
        """))

    op.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_resv_store ON stock_reservation (vendor_id, store_id)"))


def downgrade():
    op.execute(sa.text("ALTER TABLE production_order DROP COLUMN IF EXISTS actual_labor_cost"))
    op.execute(sa.text("ALTER TABLE production_order DROP COLUMN IF EXISTS actual_material_cost"))
    op.execute(sa.text("ALTER TABLE production_order DROP COLUMN IF EXISTS planned_labor_cost"))
    op.execute(sa.text("ALTER TABLE production_order DROP COLUMN IF EXISTS planned_material_cost"))
    op.execute(sa.text("ALTER TABLE production_order DROP COLUMN IF EXISTS inventory_posted_at"))
    op.execute(sa.text("ALTER TABLE production_order DROP COLUMN IF EXISTS materials_released_at"))
    op.execute(sa.text("ALTER TABLE production_order DROP COLUMN IF EXISTS materials_reserved_at"))
    op.execute(sa.text("ALTER TABLE production_order DROP COLUMN IF EXISTS material_requirements"))
    op.execute(sa.text("ALTER TABLE stock_reservation DROP COLUMN IF EXISTS consumed_at"))
    op.execute(sa.text("ALTER TABLE stock_reservation DROP COLUMN IF EXISTS storage_location_id"))
    op.execute(sa.text("ALTER TABLE stock_reservation DROP COLUMN IF EXISTS store_id"))
