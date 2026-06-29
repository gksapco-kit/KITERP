# app/schemas/plant.py
from pydantic import BaseModel, Field
from typing import Optional


class PlantCreate(BaseModel):
    store_id: str
    name: str = Field(..., min_length=1, max_length=200)
    code: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = None
    address: Optional[dict] = None
    sort_order: int = 0


class PlantUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    code: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = None
    address: Optional[dict] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None
