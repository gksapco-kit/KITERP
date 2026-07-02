# app/schemas/vendor_category.py
from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum


class AppliesTo(str, Enum):
    PRODUCT = "product"
    SERVICE = "service"
    BOTH = "both"


class CustomFieldSchema(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    type: str = Field(default="text")  # text, number, select, multiselect, boolean
    options: Optional[List[str]] = None
    required: bool = False


class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    image_url: Optional[str] = Field(None, max_length=2000)
    applies_to: AppliesTo = AppliesTo.BOTH
    parent_id: Optional[str] = None
    sort_order: int = 0
    is_visible: bool = True
    custom_fields: Optional[List[CustomFieldSchema]] = None


class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    image_url: Optional[str] = Field(None, max_length=2000)
    applies_to: Optional[AppliesTo] = None
    is_active: Optional[bool] = None
    is_visible: Optional[bool] = None
    parent_id: Optional[str] = None
    sort_order: Optional[int] = None
    custom_fields: Optional[List[CustomFieldSchema]] = None


class CategoryResponse(BaseModel):
    id: str
    vendor_id: str
    name: str
    slug: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    applies_to: str
    is_active: bool
    is_visible: bool = True
    parent_id: Optional[str] = None
    sort_order: int = 0
    custom_fields: Optional[list] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
