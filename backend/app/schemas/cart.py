# app/schemas/cart.py
from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Optional, List
from datetime import datetime
from uuid import UUID


class CartItemAdd(BaseModel):
    product_id: str
    variant_id: Optional[str] = None
    name: str
    qty: int = Field(..., ge=1, le=100)
    price: float = Field(..., ge=0)
    image_url: Optional[str] = None


class CartItemUpdate(BaseModel):
    qty: int = Field(..., ge=1, le=100)


class CartItemResponse(BaseModel):
    product_id: str
    variant_id: Optional[str] = None
    name: str
    qty: int
    price: float
    image_url: Optional[str] = None


class CartResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    vendor_id: str
    customer_id: str
    items: List[CartItemResponse] = []
    coupon_code: Optional[str] = None
    discount_amount: float = 0
    item_count: int = 0
    subtotal: float = 0

    @field_validator("id", "vendor_id", "customer_id", mode="before")
    @classmethod
    def coerce_uuid(cls, v):
        return str(v) if isinstance(v, UUID) else v

    @field_validator("discount_amount", mode="before")
    @classmethod
    def coerce_decimal(cls, v):
        return float(v) if v is not None else 0

    @field_validator("items", mode="before")
    @classmethod
    def ensure_items_list(cls, v):
        return v if v else []

    @field_validator("item_count", mode="before")
    @classmethod
    def compute_item_count(cls, v, info):
        items = info.data.get("items", [])
        return sum(i.get("qty", 0) if isinstance(i, dict) else i.qty for i in items) if items else 0

    @field_validator("subtotal", mode="before")
    @classmethod
    def compute_subtotal(cls, v, info):
        items = info.data.get("items", [])
        return sum(
            (i.get("price", 0) * i.get("qty", 0)) if isinstance(i, dict) else (i.price * i.qty)
            for i in items
        ) if items else 0
