from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Optional, List
from uuid import UUID


class WishlistItemAdd(BaseModel):
    product_id: str
    variant_id: Optional[str] = None
    name: str
    price: float = Field(..., ge=0)
    image_url: Optional[str] = None
    slug: Optional[str] = None


class WishlistItemResponse(BaseModel):
    product_id: str
    variant_id: Optional[str] = None
    name: str
    price: float
    image_url: Optional[str] = None
    slug: Optional[str] = None
    saved_at: Optional[str] = None


class WishlistResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    vendor_id: str
    customer_id: str
    items: List[WishlistItemResponse] = []
    item_count: int = 0

    @field_validator("id", "vendor_id", "customer_id", mode="before")
    @classmethod
    def coerce_uuid(cls, v):
        return str(v) if isinstance(v, UUID) else v

    @field_validator("items", mode="before")
    @classmethod
    def ensure_items(cls, v):
        return v or []

    @field_validator("item_count", mode="before")
    @classmethod
    def count_items(cls, v, info):
        items = info.data.get("items", [])
        return len(items) if items else 0
