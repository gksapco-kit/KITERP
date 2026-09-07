"""Add composite indexes for Inventory Analytics report queries.

These are read-only performance indexes — no schema changes.
Chained from inv011_transfer_gst (current inventory head).

Revision ID: inv012_inventory_analytics_indexes
Revises: inv011_transfer_gst
"""
from alembic import op

revision = "inv012_inventory_analytics_indexes"
down_revision = "inv011_transfer_gst"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # inventory_movement: tenant-scoped date-range scans used by every analytics endpoint
    op.create_index(
        "idx_inv_vendor_created",
        "inventory_movement",
        ["vendor_id", "created_at"],
    )
    op.create_index(
        "idx_inv_vendor_type_created",
        "inventory_movement",
        ["vendor_id", "movement_type", "created_at"],
    )
    op.create_index(
        "idx_inv_vendor_product_created",
        "inventory_movement",
        ["vendor_id", "product_id", "created_at"],
    )
    op.create_index(
        "idx_inv_vendor_store_created",
        "inventory_movement",
        ["vendor_id", "store_id", "created_at"],
    )

    # goods_batch: vendor-scoped expiry scan
    op.create_index(
        "ix_gb_vendor_expiry",
        "goods_batch",
        ["vendor_id", "expiry_date"],
    )

    # stock_transfer_order: in-transit and lead-time queries
    op.create_index(
        "idx_sto_vendor_status_dispatched",
        "stock_transfer_order",
        ["vendor_id", "status", "dispatched_at"],
    )

    # stock_reservation: ATP scan
    op.create_index(
        "idx_resv_vendor_status_product",
        "stock_reservation",
        ["vendor_id", "status", "product_id"],
    )

    # store_inventory: vendor-scoped health / ATP scans
    op.create_index(
        "idx_si_vendor_store",
        "store_inventory",
        ["vendor_id", "store_id"],
    )

    # stock_count: accuracy report
    op.create_index(
        "idx_sc_vendor_posted",
        "stock_count",
        ["vendor_id", "status", "posted_at"],
    )


def downgrade() -> None:
    op.drop_index("idx_sc_vendor_posted", table_name="stock_count")
    op.drop_index("idx_si_vendor_store", table_name="store_inventory")
    op.drop_index("idx_resv_vendor_status_product", table_name="stock_reservation")
    op.drop_index("idx_sto_vendor_status_dispatched", table_name="stock_transfer_order")
    op.drop_index("ix_gb_vendor_expiry", table_name="goods_batch")
    op.drop_index("idx_inv_vendor_store_created", table_name="inventory_movement")
    op.drop_index("idx_inv_vendor_product_created", table_name="inventory_movement")
    op.drop_index("idx_inv_vendor_type_created", table_name="inventory_movement")
    op.drop_index("idx_inv_vendor_created", table_name="inventory_movement")
