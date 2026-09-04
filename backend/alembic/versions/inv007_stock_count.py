"""Add stock_count and stock_count_line tables for Inventory Counting & Audit

Revision ID: inv007_stock_count
Revises: inv006_unique_store_inventory
Create Date: 2026-09-02
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "inv007_stock_count"
down_revision = "inv006_unique_store_inventory"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "stock_count",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("vendor_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False),
        sa.Column("reference_number", sa.String(40), nullable=False),
        sa.Column("count_type", sa.String(20), nullable=False, server_default="cycle_count"),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("store_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("store.id", ondelete="SET NULL"), nullable=True),
        sa.Column("storage_location_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("storage_location.id", ondelete="SET NULL"), nullable=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("count_date", sa.Date, nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("user.id", ondelete="SET NULL"), nullable=True),
        sa.Column("counted_by", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("user.id", ondelete="SET NULL"), nullable=True),
        sa.Column("reviewed_by", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("user.id", ondelete="SET NULL"), nullable=True),
        sa.Column("freeze_stock", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("posted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_sc_vendor", "stock_count", ["vendor_id"])
    op.create_index("idx_sc_status", "stock_count", ["status"])
    op.create_index("idx_sc_store", "stock_count", ["vendor_id", "store_id"])
    op.create_index("idx_sc_ref", "stock_count", ["vendor_id", "reference_number"])

    op.create_table(
        "stock_count_line",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("count_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("stock_count.id", ondelete="CASCADE"), nullable=False),
        sa.Column("vendor_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("product.id", ondelete="CASCADE"), nullable=False),
        sa.Column("variant_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("product_variant.id", ondelete="SET NULL"), nullable=True),
        sa.Column("storage_location_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("storage_location.id", ondelete="SET NULL"), nullable=True),
        sa.Column("system_qty", sa.Integer, nullable=False, server_default="0"),
        sa.Column("counted_qty", sa.Integer, nullable=True),
        sa.Column("variance", sa.Integer, nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("counted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_scl_count", "stock_count_line", ["count_id"])
    op.create_index("idx_scl_product", "stock_count_line", ["product_id"])
    op.create_unique_constraint(
        "uq_scl_count_product_variant_location",
        "stock_count_line",
        ["count_id", "product_id", "variant_id", "storage_location_id"],
    )


def downgrade() -> None:
    op.drop_table("stock_count_line")
    op.drop_table("stock_count")
