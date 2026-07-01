# app/schemas/sales_area.py
from pydantic import BaseModel, Field
from typing import Optional


class DivisionCreate(BaseModel):
    code: str = Field(..., min_length=1, max_length=20)
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    is_default: Optional[bool] = False
    sort_order: int = 0


class DivisionUpdate(BaseModel):
    code: Optional[str] = Field(None, min_length=1, max_length=20)
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    is_active: Optional[bool] = None
    is_default: Optional[bool] = None
    sort_order: Optional[int] = None


class DistributionChannelCreate(BaseModel):
    code: str = Field(..., min_length=1, max_length=20)
    name: str = Field(..., min_length=1, max_length=200)
    channel_type: str = "retail"  # retail | wholesale | online | pos | b2b | marketplace | other
    description: Optional[str] = None
    is_default: Optional[bool] = False
    sort_order: int = 0


class DistributionChannelUpdate(BaseModel):
    code: Optional[str] = Field(None, min_length=1, max_length=20)
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    channel_type: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    is_default: Optional[bool] = None
    sort_order: Optional[int] = None


class DeliveryChannelCreate(BaseModel):
    code: str = Field(..., min_length=1, max_length=20)
    name: str = Field(..., min_length=1, max_length=200)
    mode: str = "own_fleet"  # own_fleet | courier | pickup | third_party | postal | other
    description: Optional[str] = None
    lead_time_days: Optional[int] = None
    base_charge: Optional[float] = 0
    settings: Optional[dict] = None
    is_default: Optional[bool] = False
    sort_order: int = 0


class DeliveryChannelUpdate(BaseModel):
    code: Optional[str] = Field(None, min_length=1, max_length=20)
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    mode: Optional[str] = None
    description: Optional[str] = None
    lead_time_days: Optional[int] = None
    base_charge: Optional[float] = None
    settings: Optional[dict] = None
    is_active: Optional[bool] = None
    is_default: Optional[bool] = None
    sort_order: Optional[int] = None


class SalesAreaCreate(BaseModel):
    business_unit_id: str
    branch_id: Optional[str] = None
    distribution_channel_id: str
    division_id: str
    code: Optional[str] = None
    name: Optional[str] = None
    is_default: Optional[bool] = False


class SalesAreaUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    is_active: Optional[bool] = None
    is_default: Optional[bool] = None
