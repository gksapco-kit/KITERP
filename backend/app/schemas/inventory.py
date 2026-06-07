from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum
from datetime import datetime


class MovementType(str, Enum):
    STOCK_IN = "stock_in"
    STOCK_OUT = "stock_out"
    ADJUSTMENT = "adjustment"
    SALE = "sale"
    SALE_RETURN = "sale_return"
    ORDER_CANCEL = "order_cancel"
    TRANSFER = "transfer"
    INITIAL = "initial"
    PURCHASE = "purchase"


class ReferenceType(str, Enum):
    ORDER = "order"
    POS_TRANSACTION = "pos_transaction"
    MANUAL = "manual"
    IMPORT = "import"
    SYSTEM = "system"
    PURCHASE_ORDER = "purchase_order"


class StockAdjustmentCreate(BaseModel):
    product_id: str
    variant_id: Optional[str] = None
    movement_type: MovementType
    quantity: int = Field(..., description="Positive = in, negative = out")
    reason: Optional[str] = None
    reference_type: Optional[ReferenceType] = ReferenceType.MANUAL
    reference_id: Optional[str] = None


class StockInOutCreate(BaseModel):
    product_id: str
    variant_id: Optional[str] = None
    quantity: int = Field(..., gt=0)
    reason: Optional[str] = None
    # Store context
    store_id: Optional[str] = None
    storage_location_id: Optional[str] = None
    # Receiving metadata
    supplier_id: Optional[str] = None
    purchase_order_id: Optional[str] = None
    batch_number: Optional[str] = None
    # Pricing updates
    cost_price: Optional[float] = None
    selling_price: Optional[float] = None
    # Date updates
    expiration_date: Optional[str] = None
    manufacture_date: Optional[str] = None
    best_before_date: Optional[str] = None


class BulkStockUpdate(BaseModel):
    product_id: str
    variant_id: Optional[str] = None
    new_quantity: int = Field(..., ge=0)
    reason: Optional[str] = "Bulk stock update"
    store_id: Optional[str] = None
    storage_location_id: Optional[str] = None


class InventoryMovementResponse(BaseModel):
    id: str
    vendor_id: str
    product_id: str
    variant_id: Optional[str] = None
    movement_type: str
    quantity: int
    quantity_before: int
    quantity_after: int
    reason: Optional[str] = None
    reference_type: Optional[str] = None
    reference_id: Optional[str] = None
    performed_by: Optional[str] = None
    created_at: str


class StockSummary(BaseModel):
    product_id: str
    product_name: str
    sku: Optional[str] = None
    current_quantity: int
    low_stock_threshold: int
    is_low_stock: bool
    total_stock_in: int = 0
    total_stock_out: int = 0
    last_movement_at: Optional[str] = None


class InventoryHistoryResponse(BaseModel):
    items: List[InventoryMovementResponse]
    total: int
    page: int
    size: int
    pages: int


class StockSummaryListResponse(BaseModel):
    items: List[StockSummary]
    total: int
    low_stock_count: int


class LowStockAlert(BaseModel):
    product_id: str
    product_name: str
    sku: Optional[str] = None
    current_quantity: int
    low_stock_threshold: int
    category: Optional[str] = None
