"""Add base restaurant outlet tables (restaurant, zone, table, order, kot, reservation)

Revision ID: rest001_restaurant_base_tables
Revises: d003_merge_all_heads
Create Date: 2026-07-04

These tables existed in SQLAlchemy models but were never migrated; rmenu001 depends on them.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "rest001_restaurant_base_tables"
down_revision = "d003_merge_all_heads"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "restaurant",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("vendor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False),
        sa.Column("store_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("store.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("code", sa.String(50), nullable=True),
        sa.Column("cuisine", sa.String(120), nullable=True),
        sa.Column("phone", sa.String(20), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("address", postgresql.JSONB(), nullable=True, server_default="{}"),
        sa.Column("settings", postgresql.JSONB(), nullable=True, server_default="{}"),
        sa.Column("is_active", sa.Boolean(), nullable=True, server_default=sa.true()),
        sa.Column("is_default", sa.Boolean(), nullable=True, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_restaurant_vendor", "restaurant", ["vendor_id"])
    op.create_index("ix_restaurant_store", "restaurant", ["store_id"])

    op.create_table(
        "restaurant_zone",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("vendor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False),
        sa.Column("restaurant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("restaurant.id", ondelete="CASCADE"), nullable=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("floor", sa.String(40), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index(op.f("ix_restaurant_zone_vendor_id"), "restaurant_zone", ["vendor_id"])
    op.create_index(op.f("ix_restaurant_zone_restaurant_id"), "restaurant_zone", ["restaurant_id"])

    op.create_table(
        "restaurant_table",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("vendor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False),
        sa.Column("restaurant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("restaurant.id", ondelete="CASCADE"), nullable=True),
        sa.Column("zone_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("restaurant_zone.id", ondelete="SET NULL"), nullable=True),
        sa.Column("label", sa.String(40), nullable=False),
        sa.Column("capacity", sa.Integer(), nullable=False, server_default="4"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("status", sa.String(20), nullable=False, server_default="free"),
        sa.Column("qr_token", sa.String(80), nullable=True, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index(op.f("ix_restaurant_table_vendor_id"), "restaurant_table", ["vendor_id"])
    op.create_index(op.f("ix_restaurant_table_restaurant_id"), "restaurant_table", ["restaurant_id"])

    op.create_table(
        "restaurant_order",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("vendor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False),
        sa.Column("restaurant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("restaurant.id", ondelete="CASCADE"), nullable=True),
        sa.Column("table_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("restaurant_table.id", ondelete="SET NULL"), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="open"),
        sa.Column("covers", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("server_name", sa.String(120), nullable=True),
        sa.Column("items", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("adjustments", postgresql.JSONB(), nullable=True, server_default="{}"),
        sa.Column("pos_transaction_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("pos_transaction.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index(op.f("ix_restaurant_order_vendor_id"), "restaurant_order", ["vendor_id"])
    op.create_index(op.f("ix_restaurant_order_restaurant_id"), "restaurant_order", ["restaurant_id"])
    op.create_index(op.f("ix_restaurant_order_table_id"), "restaurant_order", ["table_id"])

    op.create_table(
        "restaurant_kot",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("vendor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False),
        sa.Column("restaurant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("restaurant.id", ondelete="CASCADE"), nullable=True),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("restaurant_order.id", ondelete="CASCADE"), nullable=False),
        sa.Column("table_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("restaurant_table.id", ondelete="SET NULL"), nullable=True),
        sa.Column("kot_number", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("status", sa.String(20), nullable=False, server_default="new"),
        sa.Column("items", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index(op.f("ix_restaurant_kot_vendor_id"), "restaurant_kot", ["vendor_id"])
    op.create_index(op.f("ix_restaurant_kot_restaurant_id"), "restaurant_kot", ["restaurant_id"])
    op.create_index(op.f("ix_restaurant_kot_order_id"), "restaurant_kot", ["order_id"])

    op.create_table(
        "restaurant_reservation",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("vendor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False),
        sa.Column("restaurant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("restaurant.id", ondelete="CASCADE"), nullable=True),
        sa.Column("table_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("restaurant_table.id", ondelete="SET NULL"), nullable=True),
        sa.Column("guest_name", sa.String(200), nullable=False),
        sa.Column("guest_phone", sa.String(30), nullable=True),
        sa.Column("guest_email", sa.String(200), nullable=True),
        sa.Column("reservation_date", sa.Date(), nullable=False),
        sa.Column("reservation_time", sa.String(10), nullable=False),
        sa.Column("party_size", sa.Integer(), nullable=False, server_default="2"),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("source", sa.String(20), nullable=False, server_default="online"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index(op.f("ix_restaurant_reservation_vendor_id"), "restaurant_reservation", ["vendor_id"])
    op.create_index(op.f("ix_restaurant_reservation_restaurant_id"), "restaurant_reservation", ["restaurant_id"])
    op.create_index("ix_restaurant_reservation_vendor_date", "restaurant_reservation", ["vendor_id", "reservation_date"])


def downgrade() -> None:
    op.drop_table("restaurant_reservation")
    op.drop_table("restaurant_kot")
    op.drop_table("restaurant_order")
    op.drop_table("restaurant_table")
    op.drop_table("restaurant_zone")
    op.drop_table("restaurant")
