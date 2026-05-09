from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import datetime


class RestaurantZoneCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    sort_order: int = 0


class RestaurantZoneUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=120)
    sort_order: Optional[int] = None


class RestaurantZoneOut(BaseModel):
    id: str
    vendor_id: str
    name: str
    sort_order: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class RestaurantTableCreate(BaseModel):
    zone_id: Optional[str] = None
    label: str = Field(min_length=1, max_length=40)
    capacity: int = Field(default=4, ge=1, le=99)
    sort_order: int = 0
    is_active: bool = True


class RestaurantTableUpdate(BaseModel):
    zone_id: Optional[str] = None
    label: Optional[str] = Field(None, min_length=1, max_length=40)
    capacity: Optional[int] = Field(None, ge=1, le=99)
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class RestaurantTableOut(BaseModel):
    id: str
    vendor_id: str
    zone_id: Optional[str] = None
    zone_name: Optional[str] = None
    label: str
    capacity: int
    sort_order: int
    is_active: bool
    created_at: Optional[datetime] = None


class KitchenTicketStatusUpdate(BaseModel):
    kitchen_ticket_status: Literal["new", "preparing", "ready", "done"]


class KitchenTicketOut(BaseModel):
    transaction_id: str
    transaction_number: str
    table_id: Optional[str] = None
    table_label: Optional[str] = None
    kitchen_ticket_status: str
    items: List[dict]
    total: float
    notes: Optional[str] = None
    created_at: Optional[str] = None
