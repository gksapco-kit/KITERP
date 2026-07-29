# app/schemas/product_group.py
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List

from app.models.product_group import PRODUCT_GROUP_TYPES

DISCOUNT_TYPES = ("none", "percentage", "fixed")


def _validate_group_types(value: List[str]) -> List[str]:
    if not value:
        return ["general"]
    invalid = [v for v in value if v not in PRODUCT_GROUP_TYPES]
    if invalid:
        raise ValueError(f"Invalid group type(s): {', '.join(invalid)}. Allowed: {', '.join(PRODUCT_GROUP_TYPES)}")
    return value


def _validate_discount_type(value: Optional[str]) -> Optional[str]:
    if value is not None and value not in DISCOUNT_TYPES:
        raise ValueError(f"Invalid discount type '{value}'. Allowed: {', '.join(DISCOUNT_TYPES)}")
    return value


class ProductGroupCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=150)
    description: Optional[str] = Field(None, max_length=2000)
    image_url: Optional[str] = Field(None, max_length=2000)
    code: Optional[str] = Field(None, max_length=30)
    parent_id: Optional[str] = None
    group_types: List[str] = Field(default_factory=lambda: ["general"])
    sort_order: int = 0
    is_active: bool = True
    discount_type: str = "none"
    discount_value: float = 0
    bundle_price: Optional[float] = None
    bundle_discount_type: str = "none"
    bundle_discount_value: float = 0

    _v_group_types = field_validator("group_types")(_validate_group_types)
    _v_discount_type = field_validator("discount_type")(_validate_discount_type)
    _v_bundle_discount_type = field_validator("bundle_discount_type")(_validate_discount_type)


class ProductGroupUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=150)
    description: Optional[str] = Field(None, max_length=2000)
    image_url: Optional[str] = Field(None, max_length=2000)
    code: Optional[str] = Field(None, max_length=30)
    parent_id: Optional[str] = None
    group_types: Optional[List[str]] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None
    discount_type: Optional[str] = None
    discount_value: Optional[float] = None
    bundle_price: Optional[float] = None
    bundle_discount_type: Optional[str] = None
    bundle_discount_value: Optional[float] = None

    _v_group_types = field_validator("group_types")(_validate_group_types)
    _v_discount_type = field_validator("discount_type")(_validate_discount_type)
    _v_bundle_discount_type = field_validator("bundle_discount_type")(_validate_discount_type)


class ProductGroupReparent(BaseModel):
    """Dedicated reparent payload — used by drag-drop in the tree UI."""
    parent_id: Optional[str] = None  # null = promote to root


class ProductGroupItemInput(BaseModel):
    item_type: str = Field(..., pattern="^(product|service)$")
    item_id: str
    quantity: float = 1


class ProductGroupItemsAdd(BaseModel):
    items: List[ProductGroupItemInput]


class ProductGroupItemUpdate(BaseModel):
    quantity: Optional[float] = None
    sort_order: Optional[int] = None
