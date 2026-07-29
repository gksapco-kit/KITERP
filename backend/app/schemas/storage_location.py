# app/schemas/storage_location.py
from pydantic import BaseModel, Field
from typing import Optional, List

from app.schemas.vendor_category import CustomFieldSchema


class StorageLocationCreate(BaseModel):
    store_id: str
    """Business unit or branch id this location belongs to."""
    plant_id: Optional[str] = None
    """Optional plant; omit when the location is under a branch only."""
    name: str = Field(..., min_length=1, max_length=200)
    code: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = None
    parent_id: Optional[str] = None
    sort_order: int = 0
    stock_type: Optional[str] = Field(
        "unrestricted",
        description="unrestricted | quarantine | rejected | returns",
    )
    storage_condition: Optional[str] = Field(
        None,
        description="ambient | refrigerated | frozen | controlled_room",
    )
    temp_min_c: Optional[int] = None
    temp_max_c: Optional[int] = None
    custom_fields: Optional[List[CustomFieldSchema]] = None


class StorageLocationUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    code: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = None
    is_active: Optional[bool] = None
    plant_id: Optional[str] = None
    parent_id: Optional[str] = None
    sort_order: Optional[int] = None
    stock_type: Optional[str] = Field(
        None,
        description="unrestricted | quarantine | rejected | returns",
    )
    storage_condition: Optional[str] = Field(
        None,
        description="ambient | refrigerated | frozen | controlled_room",
    )
    temp_min_c: Optional[int] = None
    temp_max_c: Optional[int] = None
    custom_fields: Optional[List[CustomFieldSchema]] = None
