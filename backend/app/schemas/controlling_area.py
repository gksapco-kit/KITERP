# app/schemas/controlling_area.py
from pydantic import BaseModel, Field
from typing import Optional


class ControllingAreaCreate(BaseModel):
    code: str = Field(..., min_length=1, max_length=20)
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    currency: str = "INR"
    is_default: Optional[bool] = False


class ControllingAreaUpdate(BaseModel):
    code: Optional[str] = Field(None, min_length=1, max_length=20)
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    currency: Optional[str] = None
    is_active: Optional[bool] = None
    is_default: Optional[bool] = None
