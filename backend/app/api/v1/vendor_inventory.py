from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from uuid import UUID
from datetime import date
import math

from app.database import get_db
from app.api.deps import get_current_active_user
from app.models.user import User
from app.models.vendor_product import Product, ProductVariant
from app.models.store import StoreInventory
from app.services.vendor_service import VendorService
from app.services.inventory_service import InventoryService
from app.schemas.inventory import (
    StockAdjustmentCreate, StockInOutCreate, BulkStockUpdate, MovementType,
)

router = APIRouter()


async def get_current_vendor_id(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> UUID:
    service = VendorService(db)
    vendor = await service.get_by_user_id(current_user.id)
    if not vendor:
        raise HTTPException(status_code=404, detail="No vendor found for this user")
    return vendor.id


def _movement_to_dict(m) -> dict:
    return {
        "id": str(m.id),
        "vendor_id": str(m.vendor_id),
        "product_id": str(m.product_id),
        "variant_id": str(m.variant_id) if m.variant_id else None,
        "store_id": str(m.store_id) if m.store_id else None,
        "movement_type": m.movement_type,
        "quantity": m.quantity,
        "quantity_before": m.quantity_before,
        "quantity_after": m.quantity_after,
        "reason": m.reason,
        "reference_type": m.reference_type,
        "reference_id": str(m.reference_id) if m.reference_id else None,
        "performed_by": str(m.performed_by) if m.performed_by else None,
        "extra_data": m.extra_data or {},
        "created_at": m.created_at.isoformat() if m.created_at else None,
    }


# ── Stock In ──────────────────────────────────────────────────────

@router.post("/stock-in", status_code=201)
async def stock_in(
    data: StockInOutCreate,
    current_user: User = Depends(get_current_active_user),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Add stock to a product."""
    svc = InventoryService(db)
    variant_id = UUID(data.variant_id) if data.variant_id else None
    product_id = UUID(data.product_id)
    store_id = UUID(data.store_id) if data.store_id else None

    # Build extra_data to store on the movement
    extra: dict = {}
    if data.supplier_id:
        extra["supplier_id"] = data.supplier_id
    if data.purchase_order_id:
        extra["purchase_order_id"] = data.purchase_order_id
    if data.batch_number:
        extra["batch_number"] = data.batch_number
    if data.store_id:
        extra["store_id"] = data.store_id

    # Reference the PO on the movement when provided
    ref_type = "purchase_order" if data.purchase_order_id else "manual"
    ref_id = UUID(data.purchase_order_id) if data.purchase_order_id else None

    try:
        m = await svc.record_movement(
            vendor_id=vendor_id,
            product_id=product_id,
            movement_type="stock_in",
            quantity=abs(data.quantity),
            reason=data.reason or "Stock received",
            performed_by=current_user.id,
            variant_id=variant_id,
            reference_type=ref_type,
            reference_id=ref_id,
            metadata=extra,
            auto_commit=False,
        )
        # Set store_id directly on the movement row
        if store_id:
            m.store_id = store_id

        # Update StoreInventory when a specific store is given
        if store_id:
            si_stmt = select(StoreInventory).where(
                StoreInventory.store_id == store_id,
                StoreInventory.product_id == product_id,
                StoreInventory.variant_id == variant_id,
            )
            si_result = await db.execute(si_stmt)
            si = si_result.scalar_one_or_none()
            if si:
                si.quantity = (si.quantity or 0) + abs(data.quantity)
            else:
                db.add(StoreInventory(
                    store_id=store_id,
                    vendor_id=vendor_id,
                    product_id=product_id,
                    variant_id=variant_id,
                    quantity=abs(data.quantity),
                ))

        # Update cost_price / selling_price / dates on the variant or product
        if variant_id:
            entity_stmt = select(ProductVariant).where(ProductVariant.id == variant_id)
        else:
            entity_stmt = select(Product).where(Product.id == product_id, Product.vendor_id == vendor_id)

        entity_result = await db.execute(entity_stmt)
        entity = entity_result.scalar_one_or_none()

        if entity:
            if data.cost_price is not None:
                entity.cost_price = data.cost_price
            if data.selling_price is not None:
                entity.price = data.selling_price
            if data.expiration_date:
                try:
                    entity.expiration_date = date.fromisoformat(data.expiration_date)
                except ValueError:
                    pass
            if data.manufacture_date:
                try:
                    entity.manufacture_date = date.fromisoformat(data.manufacture_date)
                except ValueError:
                    pass
            if data.best_before_date:
                try:
                    entity.best_before_date = date.fromisoformat(data.best_before_date)
                except ValueError:
                    pass

        await db.commit()
        return JSONResponse(content=_movement_to_dict(m), status_code=201)
    except ValueError as e:
        await db.rollback()
        raise HTTPException(400, str(e))


# ── Stock Out ─────────────────────────────────────────────────────

@router.post("/stock-out", status_code=201)
async def stock_out(
    data: StockInOutCreate,
    current_user: User = Depends(get_current_active_user),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Remove stock from a product."""
    svc = InventoryService(db)
    try:
        m = await svc.stock_out(
            vendor_id=vendor_id,
            product_id=UUID(data.product_id),
            quantity=data.quantity,
            reason=data.reason or "Stock removed",
            performed_by=current_user.id,
            variant_id=UUID(data.variant_id) if data.variant_id else None,
        )
        return JSONResponse(content=_movement_to_dict(m), status_code=201)
    except ValueError as e:
        raise HTTPException(400, str(e))


# ── Adjust (set absolute quantity) ────────────────────────────────

@router.post("/adjust", status_code=201)
async def adjust_stock(
    data: BulkStockUpdate,
    current_user: User = Depends(get_current_active_user),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Set a product's stock to an absolute value."""
    svc = InventoryService(db)
    try:
        m = await svc.adjust_stock(
            vendor_id=vendor_id,
            product_id=UUID(data.product_id),
            new_quantity=data.new_quantity,
            reason=data.reason or "Manual adjustment",
            performed_by=current_user.id,
            variant_id=UUID(data.variant_id) if data.variant_id else None,
        )
        return JSONResponse(content=_movement_to_dict(m), status_code=201)
    except ValueError as e:
        raise HTTPException(400, str(e))


# ── Movement History ──────────────────────────────────────────────

@router.get("/history")
async def get_movement_history(
    product_id: Optional[str] = None,
    movement_type: Optional[str] = None,
    store_id: Optional[str] = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """List inventory movement history."""
    svc = InventoryService(db)
    try:
        pid = UUID(product_id) if product_id else None
        sid = UUID(store_id) if store_id else None
    except ValueError:
        raise HTTPException(400, "Invalid product_id or store_id")
    items, total = await svc.get_movement_history(
        vendor_id=vendor_id,
        product_id=pid,
        movement_type=movement_type,
        store_id=sid,
        page=page,
        size=size,
    )
    return JSONResponse(content={
        "items": [_movement_to_dict(m) for m in items],
        "total": total,
        "page": page,
        "size": size,
        "pages": math.ceil(total / size) if total > 0 else 0,
    })


# ── Stock Summary ─────────────────────────────────────────────────

@router.get("/summary")
async def get_stock_summary(
    store_id: Optional[str] = None,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Get stock summary for all tracked products, with per-store breakdown."""
    svc = InventoryService(db)
    summaries = await svc.get_stock_summary(vendor_id)

    # If store_id filter is applied, replace current_quantity with store-specific quantity
    if store_id:
        for s in summaries:
            sq = next((x for x in s.get("store_quantities", []) if x["store_id"] == store_id), None)
            s["current_quantity"] = sq["quantity"] if sq else 0
            s["is_low_stock"] = s["current_quantity"] <= s["low_stock_threshold"]

    low_count = sum(1 for s in summaries if s["is_low_stock"])
    return JSONResponse(content={
        "items": summaries,
        "total": len(summaries),
        "low_stock_count": low_count,
        "store_id": store_id,
    })


# ── Low Stock Alerts ──────────────────────────────────────────────

@router.get("/low-stock")
async def get_low_stock_alerts(
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Get products that are at or below their low stock threshold."""
    svc = InventoryService(db)
    alerts = await svc.get_low_stock_alerts(vendor_id)
    return JSONResponse(content={"items": alerts, "total": len(alerts)})
