"""add product configuration engine (attributes, options, rules)

Revision ID: cfg001_product_config_engine
Revises: var002_min_qty_per_order
Create Date: 2026-07-08
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "cfg001_product_config_engine"
down_revision: Union[str, None] = "var002_min_qty_per_order"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "product_config_attribute",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("vendor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("product.id", ondelete="CASCADE"), nullable=False),
        sa.Column("parent_attribute_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("product_config_attribute.id", ondelete="CASCADE"), nullable=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("display_name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("input_type", sa.String(30), nullable=False, server_default="dropdown"),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_required", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("is_multiple", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("default_value", postgresql.JSONB(), nullable=True),
        sa.Column("visibility_rule", postgresql.JSONB(), nullable=True),
        sa.Column("validation_rule", postgresql.JSONB(), nullable=True),
        sa.Column("labels_i18n", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("version_number", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("user.id", ondelete="SET NULL"), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("user.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_cfg_attr_product", "product_config_attribute", ["product_id"])
    op.create_index("ix_cfg_attr_parent", "product_config_attribute", ["parent_attribute_id"])
    op.create_index("ix_cfg_attr_vendor", "product_config_attribute", ["vendor_id"])

    op.create_table(
        "product_config_option",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("vendor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False),
        sa.Column("attribute_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("product_config_attribute.id", ondelete="CASCADE"), nullable=False),
        sa.Column("parent_option_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("product_config_option.id", ondelete="CASCADE"), nullable=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("display_name", sa.String(200), nullable=False),
        sa.Column("image_url", sa.Text(), nullable=True),
        sa.Column("icon", sa.String(80), nullable=True),
        sa.Column("color_code", sa.String(20), nullable=True),
        sa.Column("price_delta", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("labels_i18n", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_cfg_opt_attribute", "product_config_option", ["attribute_id"])
    op.create_index("ix_cfg_opt_parent", "product_config_option", ["parent_option_id"])
    op.create_index("ix_cfg_opt_vendor", "product_config_option", ["vendor_id"])

    op.create_table(
        "product_config_rule",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("vendor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("product.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("priority", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("execution_mode", sa.String(20), nullable=False, server_default="always"),
        sa.Column("conditions", postgresql.JSONB(), nullable=False),
        sa.Column("actions", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("version_number", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("user.id", ondelete="SET NULL"), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("user.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_cfg_rule_product", "product_config_rule", ["product_id"])
    op.create_index("ix_cfg_rule_vendor", "product_config_rule", ["vendor_id"])
    op.create_index("ix_cfg_rule_active", "product_config_rule", ["is_active"])


def downgrade() -> None:
    op.drop_table("product_config_rule")
    op.drop_table("product_config_option")
    op.drop_table("product_config_attribute")
