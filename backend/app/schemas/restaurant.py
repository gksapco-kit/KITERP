from pydantic import BaseModel, Field
from typing import Optional, List, Literal, Any
from datetime import datetime, date


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


class RestaurantTableStatusUpdate(BaseModel):
    status: Literal["free", "seated", "ordering", "billed", "dirty"]


class RestaurantTableOut(BaseModel):
    id: str
    vendor_id: str
    zone_id: Optional[str] = None
    zone_name: Optional[str] = None
    label: str
    capacity: int
    sort_order: int
    is_active: bool
    status: str = "free"
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


# ── Restaurant Orders (open tabs) ──────────────────────────────────────

class RestaurantOrderCreate(BaseModel):
    table_id: str
    covers: int = Field(default=1, ge=1, le=99)
    server_name: Optional[str] = Field(None, max_length=120)
    notes: Optional[str] = None


class RestaurantOrderAddItems(BaseModel):
    items: List[dict] = Field(min_length=1)


class RestaurantOrderOut(BaseModel):
    id: str
    vendor_id: str
    table_id: Optional[str] = None
    table_label: Optional[str] = None
    status: str
    covers: int
    server_name: Optional[str] = None
    items: List[Any] = []
    notes: Optional[str] = None
    pos_transaction_id: Optional[str] = None
    kots: List[Any] = []
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class RestaurantOrderCloseIn(BaseModel):
    pos_transaction_id: str


# ── KOT ────────────────────────────────────────────────────────────────

class RestaurantKOTSendIn(BaseModel):
    items: List[dict] = Field(min_length=1)
    notes: Optional[str] = None


class RestaurantKOTStatusUpdate(BaseModel):
    status: Literal["new", "preparing", "ready", "done"]


class RestaurantKOTOut(BaseModel):
    id: str
    order_id: str
    table_id: Optional[str] = None
    table_label: Optional[str] = None
    kot_number: int
    status: str
    items: List[Any] = []
    notes: Optional[str] = None
    created_at: Optional[str] = None


# ── Reservations ───────────────────────────────────────────────────

class RestaurantReservationCreate(BaseModel):
    guest_name: str = Field(min_length=1, max_length=200)
    guest_phone: Optional[str] = Field(None, max_length=30)
    guest_email: Optional[str] = Field(None, max_length=200)
    reservation_date: date
    reservation_time: str = Field(min_length=4, max_length=10)
    party_size: int = Field(default=2, ge=1, le=50)
    table_id: Optional[str] = None
    notes: Optional[str] = None
    source: str = "online"


class RestaurantReservationStatusUpdate(BaseModel):
    status: Literal["pending", "confirmed", "seated", "cancelled", "no_show"]
    table_id: Optional[str] = None
