"""add MRP tables: product_bom_item and stock_reservation

Revision ID: ee1ff2gg3hh4
Revises: dd5ee6ff7gg8
Create Date: 2026-04-14

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "ee1ff2gg3hh4"
down_revision = "dd5ee6ff7gg8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── product_bom_item ─────────────────────────────────────────────────────
    op.create_table(
        "product_bom_item",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("vendor_id", UUID(as_uuid=True), sa.ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False),
        sa.Column("product_id", UUID(as_uuid=True), sa.ForeignKey("product.id", ondelete="CASCADE"), nullable=False),
        sa.Column("component_id", UUID(as_uuid=True), sa.ForeignKey("product.id", ondelete="CASCADE"), nullable=False),
        sa.Column("qty_per_unit", sa.Numeric(12, 4), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_bom_vendor", "product_bom_item", ["vendor_id"])
    op.create_index("idx_bom_product", "product_bom_item", ["product_id"])
    op.create_index("idx_bom_component", "product_bom_item", ["component_id"])

    # ── stock_reservation ────────────────────────────────────────────────────
    op.create_table(
        "stock_reservation",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("vendor_id", UUID(as_uuid=True), sa.ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False),
        sa.Column("order_type", sa.String(30), nullable=False),
        sa.Column("order_id", sa.String(100), nullable=False),
        sa.Column("product_id", UUID(as_uuid=True), sa.ForeignKey("product.id", ondelete="CASCADE"), nullable=False),
        sa.Column("variant_id", UUID(as_uuid=True), sa.ForeignKey("product_variant.id", ondelete="SET NULL"), nullable=True),
        sa.Column("reserved_qty", sa.Numeric(12, 4), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("released_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_resv_vendor", "stock_reservation", ["vendor_id"])
    op.create_index("idx_resv_order", "stock_reservation", ["order_type", "order_id"])
    op.create_index("idx_resv_product", "stock_reservation", ["product_id"])
    op.create_index("idx_resv_status", "stock_reservation", ["status"])


def downgrade() -> None:
    op.drop_index("idx_resv_status", "stock_reservation")
    op.drop_index("idx_resv_product", "stock_reservation")
    op.drop_index("idx_resv_order", "stock_reservation")
    op.drop_index("idx_resv_vendor", "stock_reservation")
    op.drop_table("stock_reservation")

    op.drop_index("idx_bom_component", "product_bom_item")
    op.drop_index("idx_bom_product", "product_bom_item")
    op.drop_index("idx_bom_vendor", "product_bom_item")
    op.drop_table("product_bom_item")
