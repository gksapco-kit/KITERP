"""Add stock_transfer_order and stock_transfer_order_line tables

Revision ID: inv008_stock_transfer_order
Revises: inv007_stock_count
Create Date: 2026-09-02
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "inv008_stock_transfer_order"
down_revision = "inv007_stock_count"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "stock_transfer_order",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("vendor_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False),
        sa.Column("reference_number", sa.String(40), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("from_store_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("store.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("to_store_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("store.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("from_storage_location_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("storage_location.id", ondelete="SET NULL"), nullable=True),
        sa.Column("to_storage_location_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("storage_location.id", ondelete="SET NULL"), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("expected_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("user.id", ondelete="SET NULL"), nullable=True),
        sa.Column("dispatched_by", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("user.id", ondelete="SET NULL"), nullable=True),
        sa.Column("received_by", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("user.id", ondelete="SET NULL"), nullable=True),
        sa.Column("dispatched_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_sto_vendor", "stock_transfer_order", ["vendor_id"])
    op.create_index("idx_sto_status", "stock_transfer_order", ["vendor_id", "status"])
    op.create_index("idx_sto_ref", "stock_transfer_order", ["vendor_id", "reference_number"])

    op.create_table(
        "stock_transfer_order_line",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("order_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("stock_transfer_order.id", ondelete="CASCADE"), nullable=False),
        sa.Column("vendor_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("product.id", ondelete="CASCADE"), nullable=False),
        sa.Column("variant_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("product_variant.id", ondelete="SET NULL"), nullable=True),
        sa.Column("requested_qty", sa.Integer, nullable=False),
        sa.Column("dispatched_qty", sa.Integer, nullable=True),
        sa.Column("received_qty", sa.Integer, nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_stol_order", "stock_transfer_order_line", ["order_id"])
    op.create_index("idx_stol_product", "stock_transfer_order_line", ["product_id"])


def downgrade() -> None:
    op.drop_table("stock_transfer_order_line")
    op.drop_table("stock_transfer_order")
