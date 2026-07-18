# app/schemas/cart.py
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from typing import Optional, List, Any
from datetime import datetime
from uuid import UUID


class CartItemAdd(BaseModel):
    product_id: Optional[str] = None
    service_id: Optional[str] = None
    variant_id: Optional[str] = None
    name: str
    qty: int = Field(..., ge=1, le=100)
    price: float = Field(..., ge=0)
    image_url: Optional[str] = None
    item_type: Optional[str] = None  # product | service

    @model_validator(mode="after")
    def require_item_ref(self) -> "CartItemAdd":
        if not self.product_id and not self.service_id:
            raise ValueError("product_id or service_id is required")
        if not self.item_type:
            self.item_type = "service" if self.service_id and not self.product_id else "product"
        return self


class CartItemUpdate(BaseModel):
    qty: int = Field(..., ge=1, le=100)


class CartItemResponse(BaseModel):
    product_id: Optional[str] = None
    service_id: Optional[str] = None
    variant_id: Optional[str] = None
    name: str
    qty: int
    price: float
    image_url: Optional[str] = None
    item_type: Optional[str] = None


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
    def ensure_items_list(cls, v: Any):
        if not v:
            return []
        # Normalize JSONB rows so missing product_id does not break response validation
        out = []
        for raw in v:
            if isinstance(raw, dict):
                row = dict(raw)
                if row.get("product_id") in ("", None) and row.get("service_id"):
                    row["item_type"] = row.get("item_type") or "service"
                out.append(row)
            else:
                out.append(raw)
        return out

    @field_validator("item_count", mode="before")
    @classmethod
    def compute_item_count(cls, v, info):
        items = info.data.get("items", [])
        if not items:
            return 0
        total = 0
        for i in items:
            if isinstance(i, dict):
                total += int(i.get("qty", 0) or 0)
            else:
                total += int(getattr(i, "qty", 0) or 0)
        return total

    @field_validator("subtotal", mode="before")
    @classmethod
    def compute_subtotal(cls, v, info):
        items = info.data.get("items", [])
        if not items:
            return 0.0
        total = 0.0
        for i in items:
            if isinstance(i, dict):
                total += float(i.get("price", 0) or 0) * int(i.get("qty", 0) or 0)
            else:
                total += float(getattr(i, "price", 0) or 0) * int(getattr(i, "qty", 0) or 0)
        return total
