# app/schemas/storage_location.py
from pydantic import BaseModel, Field
from typing import Optional, List

from app.schemas.vendor_category import CustomFieldSchema


class StorageLocationCreate(BaseModel):
    store_id: str
    name: str = Field(..., min_length=1, max_length=200)
    code: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = None
    parent_id: Optional[str] = None
    sort_order: int = 0
    custom_fields: Optional[List[CustomFieldSchema]] = None


class StorageLocationUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    code: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = None
    is_active: Optional[bool] = None
    parent_id: Optional[str] = None
    sort_order: Optional[int] = None
    custom_fields: Optional[List[CustomFieldSchema]] = None
