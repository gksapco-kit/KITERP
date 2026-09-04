"""Unique constraint on store_inventory (store_id, product_id, variant_id, storage_location_id)

Revision ID: inv006_unique_store_inventory
Revises: inv005_storage_loc_plant_nullable
Create Date: 2026-09-01

Concurrent writes to the same store/product/location row can create duplicate rows
because the previous code used a plain SELECT before INSERT with no uniqueness guard.
This migration deduplicates by summing quantities into the oldest surviving row,
then adds the unique constraint so future races are handled at the DB level.

NULL values in variant_id and storage_location_id are treated as distinct grouping
keys — two rows with different product_ids but both NULL variant_ids are different
groups.  PostgreSQL unique constraints treat NULL = NULL as NOT equal by default,
which would allow multiple NULL-variant rows per product/store.  We use a unique
index with COALESCE to treat NULLs as a sentinel UUID instead.
"""
from alembic import op
import sqlalchemy as sa

revision = "inv006_unique_store_inventory"
down_revision = "inv005_storage_loc_plant_nullable"
branch_labels = None
depends_on = None

# Sentinel UUIDs used in place of NULL in the partial unique index.
_NULL_UUID = "00000000-0000-0000-0000-000000000000"


def upgrade() -> None:
    # ── Step 1: deduplicate existing rows ────────────────────────────────────
    # For each (store_id, product_id, coalesced_variant_id, coalesced_storage_location_id)
    # group, keep the row with the smallest id (oldest) and sum all quantities into it,
    # then delete the duplicates.
    op.execute(
        """
        WITH grouped AS (
            SELECT
                MIN(id::text)::uuid AS keep_id,
                store_id,
                product_id,
                COALESCE(variant_id::text, '{null_uuid}') AS v_key,
                COALESCE(storage_location_id::text, '{null_uuid}') AS s_key,
                SUM(COALESCE(quantity, 0)) AS total_qty
            FROM store_inventory
            GROUP BY
                store_id,
                product_id,
                COALESCE(variant_id::text, '{null_uuid}'),
                COALESCE(storage_location_id::text, '{null_uuid}')
            HAVING COUNT(*) > 1
        ),
        updated AS (
            UPDATE store_inventory si
            SET quantity = g.total_qty
            FROM grouped g
            WHERE si.id = g.keep_id
        )
        DELETE FROM store_inventory si
        USING grouped g
        WHERE COALESCE(si.variant_id::text, '{null_uuid}') = g.v_key
          AND COALESCE(si.storage_location_id::text, '{null_uuid}') = g.s_key
          AND si.store_id = g.store_id
          AND si.product_id = g.product_id
          AND si.id <> g.keep_id;
        """.format(null_uuid=_NULL_UUID)
    )

    # ── Step 2: add the unique index ─────────────────────────────────────────
    # Using a functional index with COALESCE so that NULL values in variant_id
    # and storage_location_id are treated as equal within their group.
    op.execute(
        """
        CREATE UNIQUE INDEX uq_store_inv_product_variant_location
        ON store_inventory (
            store_id,
            product_id,
            COALESCE(variant_id::text,          '{null_uuid}'),
            COALESCE(storage_location_id::text,  '{null_uuid}')
        );
        """.format(null_uuid=_NULL_UUID)
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_store_inv_product_variant_location;")
