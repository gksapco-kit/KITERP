from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm.attributes import flag_modified
from typing import Optional
from uuid import UUID
from datetime import date
import math

from app.database import get_db
from app.api.deps import get_current_active_user, get_current_vendor_id, require_permission
from app.models.user import User
from app.models.vendor import Vendor
from app.models.vendor_product import Product, ProductVariant
from app.models.storage_location import StorageLocation
from app.services.vendor_service import VendorService
from app.services.inventory_service import InventoryService
from app.services.inventory_settings import (
    INVENTORY_SETTINGS_KEY,
    get_inventory_settings,
)
from app.services.store_inventory_service import (
    apply_store_inventory_delta,
    set_store_inventory_quantity,
    sync_product_quantity_from_stores,
)
from app.schemas.inventory import (
    StockAdjustmentCreate, StockInOutCreate, BulkStockUpdate, MovementType,
)

router = APIRouter(dependencies=[Depends(require_permission("inventory.view"))])


# ── Inventory / catalog coding settings ─────────────────────────────
# Declared before dynamic routes so /settings is never captured elsewhere.

@router.get("/settings")
async def get_inventory_coding_settings(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    svc = VendorService(db)
    vendor = await svc.get_by_user_id(current_user.id)
    if not vendor:
        raise HTTPException(404, "Vendor not found")
    return JSONResponse(content=get_inventory_settings(vendor.settings))


@router.put("/settings")
async def update_inventory_coding_settings(
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    data = await request.json()
    if not isinstance(data, dict):
        raise HTTPException(400, "Settings payload must be an object")

    svc = VendorService(db)
    vendor = await svc.get_by_user_id(current_user.id)
    if not vendor:
        raise HTTPException(404, "Vendor not found")

    result = await db.execute(select(Vendor).where(Vendor.id == vendor.id))
    db_vendor = result.scalar_one_or_none()
    if not db_vendor:
        raise HTTPException(404, "Vendor record not found")

    current = dict(db_vendor.settings or {})
    existing = get_inventory_settings(current)
    if "auto_generate_barcode" in data:
        existing["auto_generate_barcode"] = bool(data["auto_generate_barcode"])
    current[INVENTORY_SETTINGS_KEY] = existing
    db_vendor.settings = current
    flag_modified(db_vendor, "settings")
    await db.commit()
    return JSONResponse(content=existing)


def _movement_to_dict(m, location_names: dict[str, str] | None = None) -> dict:
    loc_names = location_names or {}
    sid = str(m.storage_location_id) if m.storage_location_id else None
    return {
        "id": str(m.id),
        "vendor_id": str(m.vendor_id),
        "product_id": str(m.product_id),
        "variant_id": str(m.variant_id) if m.variant_id else None,
        "store_id": str(m.store_id) if m.store_id else None,
        "storage_location_id": sid,
        "storage_location_name": loc_names.get(sid) if sid else None,
        "to_storage_location_id": str(m.to_storage_location_id) if m.to_storage_location_id else None,
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


async def _location_name_map(db: AsyncSession, movements) -> dict[str, str]:
    ids = {str(m.storage_location_id) for m in movements if m.storage_location_id}
    if not ids:
        return {}
    result = await db.execute(
        select(StorageLocation.id, StorageLocation.name).where(
            StorageLocation.id.in_([UUID(i) for i in ids])
        )
    )
    return {str(row[0]): row[1] for row in result.all()}


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
    storage_location_id = UUID(data.storage_location_id) if data.storage_location_id else None

    if storage_location_id and not store_id:
        raise HTTPException(400, "store_id is required when storage_location_id is set")

    extra: dict = {}
    if data.supplier_id:
        extra["supplier_id"] = data.supplier_id
    if data.purchase_order_id:
        extra["purchase_order_id"] = data.purchase_order_id
    if data.batch_number:
        extra["batch_number"] = data.batch_number
    if data.store_id:
        extra["store_id"] = data.store_id
    if data.storage_location_id:
        extra["storage_location_id"] = data.storage_location_id

    ref_type = "purchase_order" if data.purchase_order_id else "manual"
    ref_id = UUID(data.purchase_order_id) if data.purchase_order_id else None

    try:
        if store_id:
            await apply_store_inventory_delta(
                db, vendor_id, store_id, product_id, variant_id,
                abs(data.quantity), storage_location_id,
            )
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
            await sync_product_quantity_from_stores(db, vendor_id, product_id, variant_id)
        else:
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

        if store_id:
            m.store_id = store_id
        if storage_location_id:
            m.storage_location_id = storage_location_id

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

        # Pharma: create GoodsBatch when stock-in is for a batch-managed product.
        product_for_lot = entity if isinstance(entity, Product) else (
            await db.get(Product, product_id) if product_id else None
        )
        if product_for_lot and getattr(product_for_lot, "batch_managed", False):
            from decimal import Decimal
            from app.services.pharma_batch import create_receipt_batch
            mfg = None
            exp = None
            if data.manufacture_date:
                try:
                    mfg = date.fromisoformat(data.manufacture_date)
                except ValueError:
                    pass
            if data.expiration_date:
                try:
                    exp = date.fromisoformat(data.expiration_date)
                except ValueError:
                    pass
            await create_receipt_batch(
                db,
                vendor_id=vendor_id,
                product_id=product_id,
                quantity=Decimal(abs(data.quantity)),
                source_id=ref_id,
                source_type="stock_in" if not ref_id else "purchase",
                variant_id=variant_id,
                storage_location_id=storage_location_id,
                batch_number=data.batch_number,
                manufacturing_date=mfg,
                expiry_date=exp,
                qc_required=bool(getattr(product_for_lot, "qc_required_on_receipt", False)),
            )

        await db.commit()
        loc_map = await _location_name_map(db, [m])
        return JSONResponse(content=_movement_to_dict(m, loc_map), status_code=201)
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
    variant_id = UUID(data.variant_id) if data.variant_id else None
    product_id = UUID(data.product_id)
    store_id = UUID(data.store_id) if data.store_id else None
    storage_location_id = UUID(data.storage_location_id) if data.storage_location_id else None

    if storage_location_id and not store_id:
        raise HTTPException(400, "store_id is required when storage_location_id is set")

    extra: dict = {}
    if data.store_id:
        extra["store_id"] = data.store_id
    if data.storage_location_id:
        extra["storage_location_id"] = data.storage_location_id

    try:
        if store_id:
            await apply_store_inventory_delta(
                db, vendor_id, store_id, product_id, variant_id,
                -abs(data.quantity), storage_location_id,
            )
            m = await svc.record_movement(
                vendor_id=vendor_id,
                product_id=product_id,
                movement_type="stock_out",
                quantity=-abs(data.quantity),
                reason=data.reason or "Stock removed",
                performed_by=current_user.id,
                variant_id=variant_id,
                reference_type="manual",
                metadata=extra,
                auto_commit=False,
            )
            await sync_product_quantity_from_stores(db, vendor_id, product_id, variant_id)
            m.store_id = store_id
            if storage_location_id:
                m.storage_location_id = storage_location_id
            await db.commit()
        else:
            m = await svc.stock_out(
                vendor_id=vendor_id,
                product_id=product_id,
                quantity=data.quantity,
                reason=data.reason or "Stock removed",
                performed_by=current_user.id,
                variant_id=variant_id,
            )
        loc_map = await _location_name_map(db, [m])
        return JSONResponse(content=_movement_to_dict(m, loc_map), status_code=201)
    except ValueError as e:
        await db.rollback()
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
    variant_id = UUID(data.variant_id) if data.variant_id else None
    product_id = UUID(data.product_id)
    store_id = UUID(data.store_id) if data.store_id else None
    storage_location_id = UUID(data.storage_location_id) if data.storage_location_id else None

    if storage_location_id and not store_id:
        raise HTTPException(400, "store_id is required when storage_location_id is set")

    try:
        if store_id:
            _, delta = await set_store_inventory_quantity(
                db, vendor_id, store_id, product_id, variant_id,
                data.new_quantity, storage_location_id,
            )
            m = await svc.record_movement(
                vendor_id=vendor_id,
                product_id=product_id,
                movement_type="adjustment",
                quantity=delta,
                reason=data.reason or "Manual adjustment",
                performed_by=current_user.id,
                variant_id=variant_id,
                reference_type="manual",
                metadata={
                    **({"store_id": data.store_id} if data.store_id else {}),
                    **({"storage_location_id": data.storage_location_id} if data.storage_location_id else {}),
                },
                auto_commit=False,
            )
            await sync_product_quantity_from_stores(db, vendor_id, product_id, variant_id)
            m.store_id = store_id
            if storage_location_id:
                m.storage_location_id = storage_location_id
            await db.commit()
        else:
            m = await svc.adjust_stock(
                vendor_id=vendor_id,
                product_id=product_id,
                new_quantity=data.new_quantity,
                reason=data.reason or "Manual adjustment",
                performed_by=current_user.id,
                variant_id=variant_id,
            )
        loc_map = await _location_name_map(db, [m])
        return JSONResponse(content=_movement_to_dict(m, loc_map), status_code=201)
    except ValueError as e:
        await db.rollback()
        raise HTTPException(400, str(e))


# ── Movement History ──────────────────────────────────────────────

@router.get("/history")
async def get_movement_history(
    product_id: Optional[str] = None,
    movement_type: Optional[str] = None,
    store_id: Optional[str] = None,
    storage_location_id: Optional[str] = None,
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
        lid = UUID(storage_location_id) if storage_location_id else None
    except ValueError:
        raise HTTPException(400, "Invalid product_id, store_id, or storage_location_id")
    items, total = await svc.get_movement_history(
        vendor_id=vendor_id,
        product_id=pid,
        movement_type=movement_type,
        store_id=sid,
        storage_location_id=lid,
        page=page,
        size=size,
    )
    loc_map = await _location_name_map(db, items)
    return JSONResponse(content={
        "items": [_movement_to_dict(m, loc_map) for m in items],
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
    sid = None
    if store_id:
        try:
            sid = UUID(store_id)
        except ValueError:
            raise HTTPException(400, "Invalid store_id")
    summaries = await svc.get_stock_summary(vendor_id, store_id=sid)

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
    store_id: Optional[str] = None,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Get products that are at or below their low stock threshold."""
    svc = InventoryService(db)
    sid = None
    if store_id:
        try:
            sid = UUID(store_id)
        except ValueError:
            raise HTTPException(400, "Invalid store_id")
    alerts = await svc.get_low_stock_alerts(vendor_id, store_id=sid)
    return JSONResponse(content={"items": alerts, "total": len(alerts)})
