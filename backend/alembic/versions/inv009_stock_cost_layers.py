"""Add stock_cost_layer table for FIFO valuation

Revision ID: inv009_stock_cost_layers
Revises: inv008_stock_transfer_order
Create Date: 2026-09-02
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "inv009_stock_cost_layers"
down_revision = "inv008_stock_transfer_order"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "stock_cost_layer",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("vendor_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("product.id", ondelete="CASCADE"), nullable=False),
        sa.Column("variant_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("product_variant.id", ondelete="SET NULL"), nullable=True),
        sa.Column("movement_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("inventory_movement.id", ondelete="SET NULL"), nullable=True),
        sa.Column("received_qty", sa.Numeric(12, 4), nullable=False),
        sa.Column("consumed_qty", sa.Numeric(12, 4), nullable=False, server_default="0"),
        sa.Column("unit_cost", sa.Numeric(14, 6), nullable=False),
        sa.Column("total_cost", sa.Numeric(18, 6), nullable=False),
        sa.Column("is_exhausted", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("source_type", sa.String(30), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_scl_vendor_product", "stock_cost_layer", ["vendor_id", "product_id"])
    op.create_index("idx_scl_fifo", "stock_cost_layer",
                    ["vendor_id", "product_id", "variant_id", "is_exhausted", "created_at"])
    op.create_index("idx_scl_movement", "stock_cost_layer", ["movement_id"])


def downgrade() -> None:
    op.drop_table("stock_cost_layer")
