"""add merchandising tables (bundle, bundle_item, upsell_mapping)

Revision ID: p7h8i9j0k1l2
Revises: o6g7h8i9j0k1
Create Date: 2026-04-08
"""
from typing import Sequence, Union
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = 'p7h8i9j0k1l2'
down_revision: Union[str, None] = 'o6g7h8i9j0k1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    tables = insp.get_table_names()

    if "bundle" not in tables:
        op.create_table(
            "bundle",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("vendor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("slug", sa.String(255), nullable=False),
            sa.Column("description", sa.Text, nullable=True),
            sa.Column("discount_type", sa.String(20), server_default="none"),
            sa.Column("discount_value", sa.Numeric(12, 2), server_default="0"),
            sa.Column("is_active", sa.Boolean, server_default=sa.text("true")),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.create_index("idx_bundle_vendor", "bundle", ["vendor_id"])
        op.create_index("idx_bundle_slug", "bundle", ["vendor_id", "slug"], unique=True)
        op.create_index("idx_bundle_active", "bundle", ["vendor_id", "is_active"])

    if "bundle_item" not in tables:
        op.create_table(
            "bundle_item",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("bundle_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("bundle.id", ondelete="CASCADE"), nullable=False),
            sa.Column("product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("product.id", ondelete="CASCADE"), nullable=False),
            sa.Column("quantity", sa.Integer, server_default="1", nullable=False),
            sa.Column("sort_order", sa.Integer, server_default="0"),
        )
        op.create_index("idx_bundle_item_bundle", "bundle_item", ["bundle_id"])
        op.execute("ALTER TABLE bundle_item ADD CONSTRAINT uq_bundle_product UNIQUE (bundle_id, product_id)")

    if "upsell_mapping" not in tables:
        op.create_table(
            "upsell_mapping",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("vendor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False),
            sa.Column("source_product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("product.id", ondelete="CASCADE"), nullable=False),
            sa.Column("target_product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("product.id", ondelete="CASCADE"), nullable=False),
            sa.Column("relation_type", sa.String(20), nullable=False),
            sa.Column("bundle_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("bundle.id", ondelete="SET NULL"), nullable=True),
            sa.Column("trigger_stage", sa.String(20), nullable=False, server_default="PDP"),
            sa.Column("priority", sa.Integer, server_default="0"),
            sa.Column("is_active", sa.Boolean, server_default=sa.text("true")),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.execute("ALTER TABLE upsell_mapping ADD CONSTRAINT uq_upsell_src_tgt_type UNIQUE (source_product_id, target_product_id, relation_type)")
        op.execute("ALTER TABLE upsell_mapping ADD CONSTRAINT ck_no_self_link CHECK (source_product_id != target_product_id)")
        op.execute("ALTER TABLE upsell_mapping ADD CONSTRAINT ck_relation_type CHECK (relation_type IN ('cross_sell', 'upsell'))")
        op.execute("ALTER TABLE upsell_mapping ADD CONSTRAINT ck_trigger_stage CHECK (trigger_stage IN ('PDP', 'CART', 'CHECKOUT'))")
        op.create_index("idx_upsell_lookup", "upsell_mapping", ["vendor_id", "source_product_id", "relation_type", "trigger_stage"])
        op.create_index("idx_upsell_target", "upsell_mapping", ["target_product_id"])
        op.create_index("idx_upsell_bundle", "upsell_mapping", ["bundle_id"])
        op.create_index("idx_upsell_priority", "upsell_mapping", ["source_product_id", "relation_type", "priority"])


def downgrade() -> None:
    op.drop_table("upsell_mapping")
    op.drop_table("bundle_item")
    op.drop_table("bundle")
