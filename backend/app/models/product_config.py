# app/models/product_config.py
"""
Metadata-driven Product Configuration Engine.

No hardcoded variant levels (no Color1/Size1 columns). A product's configurable
shape is fully described by ProductConfigAttribute rows (which can nest to any
depth via parent_attribute_id — e.g. Voltage -> Phase -> Cooling -> Oil Grade),
each holding ProductConfigOption choices, plus ProductConfigRule rows that
encode visual IF/THEN logic (no SQL) evaluated in real time by app.services.rule_engine.

Variant generation/business data (SKU, price, stock, etc.) intentionally lives on
the existing Product / ProductVariant / ProductPriceRule models (app/models/vendor_product.py)
rather than a parallel set of tables — this module only defines configuration metadata.
"""
from sqlalchemy import Column, String, Text, Boolean, DateTime, ForeignKey, Numeric, Integer, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship, backref
from sqlalchemy.sql import func
import uuid
from app.database import Base


class ProductConfigAttribute(Base):
    """A configurable dimension of a product (e.g. Voltage, Cooling, Subscription).

    Unlimited nesting/dependency depth via ``parent_attribute_id`` — a child attribute
    is only relevant once its parent has a value (e.g. Cooling only matters after
    Voltage is chosen). Actual show/hide/require logic is driven by ProductConfigRule;
    ``visibility_rule`` / ``validation_rule`` hold an optional inline condition tree
    for simple per-attribute cases that don't need a full named rule.
    """
    __tablename__ = "product_config_attribute"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("product.id", ondelete="CASCADE"), nullable=False)
    parent_attribute_id = Column(UUID(as_uuid=True), ForeignKey("product_config_attribute.id", ondelete="CASCADE"), nullable=True)

    name = Column(String(120), nullable=False)          # machine code, e.g. "voltage"
    display_name = Column(String(200), nullable=False)  # e.g. "Voltage"
    description = Column(Text, nullable=True)

    input_type = Column(String(30), nullable=False, default="dropdown")
    # dropdown | radio | checkbox | multiselect | color | image | text | number | date | boolean
    display_order = Column(Integer, nullable=False, default=0)

    is_required = Column(Boolean, nullable=False, default=False)
    is_multiple = Column(Boolean, nullable=False, default=False)
    default_value = Column(JSONB, nullable=True)

    visibility_rule = Column(JSONB, nullable=True)   # optional inline condition tree
    validation_rule = Column(JSONB, nullable=True)   # optional inline validation spec
    labels_i18n = Column(JSONB, nullable=False, default=dict)  # {"en": "Voltage", "ar": "..."}

    is_active = Column(Boolean, nullable=False, default=True)
    version_number = Column(Integer, nullable=False, default=1)  # optimistic concurrency

    created_by = Column(UUID(as_uuid=True), ForeignKey("user.id", ondelete="SET NULL"), nullable=True)
    updated_by = Column(UUID(as_uuid=True), ForeignKey("user.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    options = relationship(
        "ProductConfigOption",
        cascade="all, delete-orphan",
        back_populates="attribute",
        order_by="ProductConfigOption.sort_order",
    )
    children = relationship(
        "ProductConfigAttribute",
        cascade="all, delete-orphan",
        backref=backref("parent", remote_side=[id]),
    )

    __table_args__ = (
        Index("ix_cfg_attr_product", "product_id"),
        Index("ix_cfg_attr_parent", "parent_attribute_id"),
        Index("ix_cfg_attr_vendor", "vendor_id"),
    )


class ProductConfigOption(Base):
    """A selectable choice inside an attribute (e.g. "220V" under Voltage).

    ``parent_option_id`` allows optional *option*-level nesting for cases like
    Brand -> Series -> Generation packed inside a single attribute, independent
    of attribute-level nesting.
    """
    __tablename__ = "product_config_option"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    attribute_id = Column(UUID(as_uuid=True), ForeignKey("product_config_attribute.id", ondelete="CASCADE"), nullable=False)
    parent_option_id = Column(UUID(as_uuid=True), ForeignKey("product_config_option.id", ondelete="CASCADE"), nullable=True)

    name = Column(String(120), nullable=False)          # machine code, e.g. "220v"
    display_name = Column(String(200), nullable=False)  # e.g. "220V"
    image_url = Column(Text, nullable=True)
    icon = Column(String(80), nullable=True)
    color_code = Column(String(20), nullable=True)
    price_delta = Column(Numeric(12, 2), nullable=False, default=0)
    sort_order = Column(Integer, nullable=False, default=0)
    labels_i18n = Column(JSONB, nullable=False, default=dict)

    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    attribute = relationship("ProductConfigAttribute", back_populates="options")
    children = relationship(
        "ProductConfigOption",
        cascade="all, delete-orphan",
        backref=backref("parent", remote_side=[id]),
    )

    __table_args__ = (
        Index("ix_cfg_opt_attribute", "attribute_id"),
        Index("ix_cfg_opt_parent", "parent_option_id"),
        Index("ix_cfg_opt_vendor", "vendor_id"),
    )


class ProductConfigRule(Base):
    """Visual IF/THEN rule — no SQL. ``conditions`` is a nested AND/OR/NOT tree of
    leaf comparisons; ``actions`` is an ordered list of effects. See
    app.services.rule_engine for the evaluator and the exact JSON shape.
    """
    __tablename__ = "product_config_rule"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("product.id", ondelete="CASCADE"), nullable=False)

    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    priority = Column(Integer, nullable=False, default=0)  # higher runs later, can override earlier actions
    # first_match = only apply once per session until the triggering condition changes (good for auto-select);
    # always = re-apply every time the rule's conditions are true (good for show/hide/require)
    execution_mode = Column(String(20), nullable=False, default="always")

    conditions = Column(JSONB, nullable=False)  # {"op": "AND", "children": [...]} or a single leaf node
    actions = Column(JSONB, nullable=False, default=list)

    is_active = Column(Boolean, nullable=False, default=True)
    version_number = Column(Integer, nullable=False, default=1)

    created_by = Column(UUID(as_uuid=True), ForeignKey("user.id", ondelete="SET NULL"), nullable=True)
    updated_by = Column(UUID(as_uuid=True), ForeignKey("user.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_cfg_rule_product", "product_id"),
        Index("ix_cfg_rule_vendor", "vendor_id"),
        Index("ix_cfg_rule_active", "is_active"),
    )
