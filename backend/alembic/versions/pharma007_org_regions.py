"""Pharma per-org Track & Trace region overrides (BU / branch / plant).

Revision ID: pharma007_org_regions
Revises: pharma006_approval_rules
Create Date: 2026-07-29

New table:
  pharma_org_region — one row per store (BU/branch) or plant with a region
                      that overrides the vendor-wide track_trace_region setting.

Resolution order: plant > store > vendor default.
"""
from alembic import op

revision = "pharma007_org_regions"
down_revision = "pharma006_approval_rules"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS pharma_org_region (
            id         UUID PRIMARY KEY,
            vendor_id  UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
            store_id   UUID REFERENCES store(id) ON DELETE CASCADE,
            plant_id   UUID REFERENCES plant(id) ON DELETE CASCADE,
            track_trace_region VARCHAR(10) NOT NULL DEFAULT 'none',
            CONSTRAINT chk_pharma_org_region_one_fk
                CHECK (
                    (store_id IS NOT NULL AND plant_id IS NULL) OR
                    (plant_id IS NOT NULL AND store_id IS NULL)
                )
        )
    """)
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_pharma_org_region_vendor "
        "ON pharma_org_region (vendor_id)"
    )
    # Partial unique indexes — one override per (vendor, store) and per (vendor, plant)
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS ix_pharma_org_region_store
        ON pharma_org_region (vendor_id, store_id)
        WHERE store_id IS NOT NULL
    """)
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS ix_pharma_org_region_plant
        ON pharma_org_region (vendor_id, plant_id)
        WHERE plant_id IS NOT NULL
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_pharma_org_region_plant")
    op.execute("DROP INDEX IF EXISTS ix_pharma_org_region_store")
    op.execute("DROP INDEX IF EXISTS ix_pharma_org_region_vendor")
    op.execute("DROP TABLE IF EXISTS pharma_org_region")
