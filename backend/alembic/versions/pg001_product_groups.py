"""Product Groups: many-to-many grouping of products & services for
merchandising bundles, group-level pricing/discounts, and reporting tags.

Revision ID: pg001_product_groups
Revises: pharma004_complaints_and_oos
Create Date: 2026-07-28
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "pg001_product_groups"
down_revision = "pharma004_complaints_and_oos"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "product_group",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("vendor_id", UUID(as_uuid=True),
                  sa.ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("slug", sa.String(170), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("image_url", sa.String(2000), nullable=True),
        sa.Column("group_types", JSONB, nullable=False, server_default='["general"]'),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true()),
        sa.Column("sort_order", sa.Integer(), server_default="0"),
        sa.Column("discount_type", sa.String(20), server_default="none"),
        sa.Column("discount_value", sa.Numeric(12, 2), server_default="0"),
        sa.Column("bundle_price", sa.Numeric(12, 2), nullable=True),
        sa.Column("bundle_discount_type", sa.String(20), server_default="none"),
        sa.Column("bundle_discount_value", sa.Numeric(12, 2), server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_product_group_vendor", "product_group", ["vendor_id"])
    op.create_index("idx_product_group_slug", "product_group", ["vendor_id", "slug"], unique=True)
    op.create_index("idx_product_group_active", "product_group", ["vendor_id", "is_active"])

    op.create_table(
        "product_group_item",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("group_id", UUID(as_uuid=True),
                  sa.ForeignKey("product_group.id", ondelete="CASCADE"), nullable=False),
        sa.Column("item_type", sa.String(10), nullable=False),
        sa.Column("product_id", UUID(as_uuid=True),
                  sa.ForeignKey("product.id", ondelete="CASCADE"), nullable=True),
        sa.Column("service_id", UUID(as_uuid=True),
                  sa.ForeignKey("service.id", ondelete="CASCADE"), nullable=True),
        sa.Column("quantity", sa.Numeric(12, 3), server_default="1"),
        sa.Column("sort_order", sa.Integer(), server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint(
            "(item_type = 'product' AND product_id IS NOT NULL AND service_id IS NULL) OR "
            "(item_type = 'service' AND service_id IS NOT NULL AND product_id IS NULL)",
            name="ck_product_group_item_type",
        ),
    )
    op.create_index("idx_product_group_item_group", "product_group_item", ["group_id"])
    op.create_index(
        "idx_product_group_item_unique_product", "product_group_item", ["group_id", "product_id"],
        unique=True, postgresql_where=sa.text("product_id IS NOT NULL"),
    )
    op.create_index(
        "idx_product_group_item_unique_service", "product_group_item", ["group_id", "service_id"],
        unique=True, postgresql_where=sa.text("service_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_table("product_group_item")
    op.drop_table("product_group")
