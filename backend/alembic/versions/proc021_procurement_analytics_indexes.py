"""Add performance indexes for Procurement Report Analytics queries.

Revision ID: proc021_procurement_analytics_indexes
Revises: proc020_po_place_of_supply
Create Date: 2026-09-07

Changes:
- Composite indexes on purchase_order, purchase_order_item, vendor_invoice,
  vendor_invoice_item, grn, purchase_requisition, purchase_return,
  and the three approval tables to support the 11 analytics endpoints.
- All indexes are read-only (no column additions or alterations).
"""
from alembic import op

revision = "proc021_procurement_analytics_indexes"
down_revision = "proc020_po_place_of_supply"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── purchase_order ──────────────────────────────────────────────────────
    op.create_index(
        "idx_po_vendor_created",
        "purchase_order",
        ["vendor_id", "created_at"],
        postgresql_using="btree",
    )
    op.create_index(
        "idx_po_vendor_status_created",
        "purchase_order",
        ["vendor_id", "status", "created_at"],
        postgresql_using="btree",
    )
    op.create_index(
        "idx_po_vendor_supplier_created",
        "purchase_order",
        ["vendor_id", "supplier_id", "created_at"],
        postgresql_using="btree",
    )
    op.create_index(
        "idx_po_vendor_branch_created",
        "purchase_order",
        ["vendor_id", "branch_id", "created_at"],
        postgresql_using="btree",
    )

    # ── purchase_order_item ─────────────────────────────────────────────────
    op.create_index(
        "idx_poi_po_material_type",
        "purchase_order_item",
        ["purchase_order_id", "material_type"],
        postgresql_using="btree",
    )
    op.create_index(
        "idx_poi_po_item_category",
        "purchase_order_item",
        ["purchase_order_id", "item_category"],
        postgresql_using="btree",
    )

    # ── vendor_invoice ──────────────────────────────────────────────────────
    op.create_index(
        "idx_vi_vendor_created",
        "vendor_invoice",
        ["vendor_id", "created_at"],
        postgresql_using="btree",
    )
    op.create_index(
        "idx_vi_vendor_status_created",
        "vendor_invoice",
        ["vendor_id", "status", "created_at"],
        postgresql_using="btree",
    )
    op.create_index(
        "idx_vi_vendor_match_status",
        "vendor_invoice",
        ["vendor_id", "match_status"],
        postgresql_using="btree",
    )
    op.create_index(
        "idx_vi_vendor_supplier_created",
        "vendor_invoice",
        ["vendor_id", "supplier_id", "created_at"],
        postgresql_using="btree",
    )
    op.create_index(
        "idx_vi_vendor_due_date",
        "vendor_invoice",
        ["vendor_id", "status", "due_date"],
        postgresql_using="btree",
    )

    # ── vendor_invoice_item ─────────────────────────────────────────────────
    op.create_index(
        "idx_vii_invoice_product",
        "vendor_invoice_item",
        ["invoice_id", "product_id"],
        postgresql_using="btree",
    )

    # ── grn ─────────────────────────────────────────────────────────────────
    op.create_index(
        "idx_grn_vendor_created",
        "grn",
        ["vendor_id", "created_at"],
        postgresql_using="btree",
    )
    op.create_index(
        "idx_grn_vendor_status_created",
        "grn",
        ["vendor_id", "status", "created_at"],
        postgresql_using="btree",
    )

    # ── purchase_requisition ────────────────────────────────────────────────
    op.create_index(
        "idx_pr_vendor_created",
        "purchase_requisition",
        ["vendor_id", "created_at"],
        postgresql_using="btree",
    )
    op.create_index(
        "idx_pr_vendor_status_created",
        "purchase_requisition",
        ["vendor_id", "status", "created_at"],
        postgresql_using="btree",
    )

    # ── purchase_return ─────────────────────────────────────────────────────
    op.create_index(
        "idx_pret_vendor_created",
        "purchase_return",
        ["vendor_id", "created_at"],
        postgresql_using="btree",
    )
    op.create_index(
        "idx_pret_vendor_supplier_created",
        "purchase_return",
        ["vendor_id", "supplier_id", "created_at"],
        postgresql_using="btree",
    )

    # ── approval tables ─────────────────────────────────────────────────────
    op.create_index(
        "idx_poa_po_status_created",
        "purchase_order_approval",
        ["purchase_order_id", "status", "created_at"],
        postgresql_using="btree",
    )
    op.create_index(
        "idx_pra_req_status_created",
        "purchase_requisition_approval",
        ["requisition_id", "status", "created_at"],
        postgresql_using="btree",
    )
    op.create_index(
        "idx_via_inv_status_created",
        "vendor_invoice_approval",
        ["invoice_id", "status", "created_at"],
        postgresql_using="btree",
    )

    # ── rfq_supplier ────────────────────────────────────────────────────────
    op.create_index(
        "idx_rfqs_rfq_status",
        "rfq_supplier",
        ["rfq_id", "invite_status"],
        postgresql_using="btree",
    )


def downgrade() -> None:
    op.drop_index("idx_po_vendor_created", table_name="purchase_order")
    op.drop_index("idx_po_vendor_status_created", table_name="purchase_order")
    op.drop_index("idx_po_vendor_supplier_created", table_name="purchase_order")
    op.drop_index("idx_po_vendor_branch_created", table_name="purchase_order")
    op.drop_index("idx_poi_po_material_type", table_name="purchase_order_item")
    op.drop_index("idx_poi_po_item_category", table_name="purchase_order_item")
    op.drop_index("idx_vi_vendor_created", table_name="vendor_invoice")
    op.drop_index("idx_vi_vendor_status_created", table_name="vendor_invoice")
    op.drop_index("idx_vi_vendor_match_status", table_name="vendor_invoice")
    op.drop_index("idx_vi_vendor_supplier_created", table_name="vendor_invoice")
    op.drop_index("idx_vi_vendor_due_date", table_name="vendor_invoice")
    op.drop_index("idx_vii_invoice_product", table_name="vendor_invoice_item")
    op.drop_index("idx_grn_vendor_created", table_name="grn")
    op.drop_index("idx_grn_vendor_status_created", table_name="grn")
    op.drop_index("idx_pr_vendor_created", table_name="purchase_requisition")
    op.drop_index("idx_pr_vendor_status_created", table_name="purchase_requisition")
    op.drop_index("idx_pret_vendor_created", table_name="purchase_return")
    op.drop_index("idx_pret_vendor_supplier_created", table_name="purchase_return")
    op.drop_index("idx_poa_po_status_created", table_name="purchase_order_approval")
    op.drop_index("idx_pra_req_status_created", table_name="purchase_requisition_approval")
    op.drop_index("idx_via_inv_status_created", table_name="vendor_invoice_approval")
    op.drop_index("idx_rfqs_rfq_status", table_name="rfq_supplier")
