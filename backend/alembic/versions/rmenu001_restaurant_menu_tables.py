"""Add restaurant_menu, restaurant_menu_category, restaurant_menu_zone_link tables

Revision ID: rmenu001_restaurant_menu_tables
Revises: d003_merge_all_heads
Create Date: 2026-07-02

Introduces multi-menu support for restaurant outlets:
- restaurant_menu: named menus per outlet (e.g. "Lunch menu", "Dinner menu")
- restaurant_menu_category: tree of categories/sub-categories per menu, each with
  its own item-selection mode (all_active / curated / by_categories)
- restaurant_menu_zone_link: links a menu to a zone with a unique guest-facing token
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "rmenu001_restaurant_menu_tables"
down_revision = "rest001_restaurant_base_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "restaurant_menu",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("vendor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False),
        sa.Column("restaurant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("restaurant.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_restaurant_menu_vendor", "restaurant_menu", ["vendor_id"])
    op.create_index("ix_restaurant_menu_restaurant", "restaurant_menu", ["restaurant_id"])

    op.create_table(
        "restaurant_menu_category",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("vendor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False),
        sa.Column("menu_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("restaurant_menu.id", ondelete="CASCADE"), nullable=False),
        sa.Column("parent_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("restaurant_menu_category.id", ondelete="CASCADE"), nullable=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("mode", sa.String(20), nullable=False, server_default="all_active"),
        sa.Column("product_ids", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("service_ids", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("vendor_category_ids", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_restaurant_menu_category_menu", "restaurant_menu_category", ["menu_id"])
    op.create_index("ix_restaurant_menu_category_parent", "restaurant_menu_category", ["parent_id"])

    op.create_table(
        "restaurant_menu_zone_link",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("vendor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False),
        sa.Column("menu_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("restaurant_menu.id", ondelete="CASCADE"), nullable=False),
        sa.Column("zone_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("restaurant_zone.id", ondelete="CASCADE"), nullable=False),
        sa.Column("link_token", sa.String(64), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_restaurant_menu_zone_link_menu", "restaurant_menu_zone_link", ["menu_id"])
    op.create_index("ix_restaurant_menu_zone_link_zone", "restaurant_menu_zone_link", ["zone_id"])
    op.create_index("ix_restaurant_menu_zone_link_token", "restaurant_menu_zone_link", ["link_token"], unique=True)


def downgrade() -> None:
    op.drop_table("restaurant_menu_zone_link")
    op.drop_table("restaurant_menu_category")
    op.drop_table("restaurant_menu")
