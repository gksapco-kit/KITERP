from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from sqlalchemy.orm.attributes import flag_modified
from typing import Optional
from uuid import UUID, uuid4
from datetime import date, datetime, timezone, timedelta
import math

from app.database import get_db
from app.api.deps import get_current_active_user, get_current_vendor_id, require_permission
from app.models.user import User
from app.models.vendor import Vendor
from app.models.vendor_product import Product, ProductVariant
from app.models.storage_location import StorageLocation
from app.models.store import Store
from app.models.procurement_goods import GoodsBatch
from app.models.inventory import InventoryMovement
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


class _MovementContext:
    """Holds batch-resolved lookup maps to avoid N+1 queries in list endpoints."""
    def __init__(
        self,
        location_names: dict[str, str] | None = None,
        store_names: dict[str, str] | None = None,
        user_display: dict[str, dict] | None = None,
        product_names: dict[str, dict] | None = None,
        variant_names: dict[str, str] | None = None,
    ):
        self.location_names = location_names or {}
        self.store_names = store_names or {}
        self.user_display = user_display or {}
        self.product_names = product_names or {}
        self.variant_names = variant_names or {}


def _movement_to_dict(m, ctx: _MovementContext | None = None) -> dict:
    c = ctx or _MovementContext()
    sid = str(m.storage_location_id) if m.storage_location_id else None
    to_sid = str(m.to_storage_location_id) if m.to_storage_location_id else None
    store_sid = str(m.store_id) if m.store_id else None
    to_store_sid = str(m.to_store_id) if m.to_store_id else None
    pb_uid = str(m.performed_by) if m.performed_by else None
    pid = str(m.product_id)
    vid = str(m.variant_id) if m.variant_id else None

    user_info = c.user_display.get(pb_uid) if pb_uid else None
    product_info = c.product_names.get(pid) if pid else None

    # Build a human-readable reference label (e.g. "PO PO-0004")
    ref_label = None
    if m.reference_type and m.reference_id:
        ref_label = f"{m.reference_type.replace('_', ' ').title()} {m.reference_id}"

    return {
        "id": str(m.id),
        "document_number": m.document_number,
        "document_line_no": m.document_line_no,
        "vendor_id": str(m.vendor_id),
        "product_id": pid,
        "product_name": product_info.get("name") if product_info else None,
        "product_sku": product_info.get("sku") if product_info else None,
        "variant_id": vid,
        "variant_name": c.variant_names.get(vid) if vid else None,
        "store_id": store_sid,
        "store_name": c.store_names.get(store_sid) if store_sid else None,
        "to_store_id": to_store_sid,
        "to_store_name": c.store_names.get(to_store_sid) if to_store_sid else None,
        "storage_location_id": sid,
        "storage_location_name": c.location_names.get(sid) if sid else None,
        "to_storage_location_id": to_sid,
        "to_storage_location_name": c.location_names.get(to_sid) if to_sid else None,
        "movement_type": m.movement_type,
        "quantity": m.quantity,
        "quantity_before": m.quantity_before,
        "quantity_after": m.quantity_after,
        "reason": m.reason,
        "reference_type": m.reference_type,
        "reference_id": str(m.reference_id) if m.reference_id else None,
        "reference_label": ref_label,
        "performed_by": pb_uid,
        "performed_by_name": user_info.get("full_name") if user_info else None,
        "performed_by_email": user_info.get("email") if user_info else None,
        "extra_data": m.extra_data or {},
        "created_at": m.created_at.isoformat() if m.created_at else None,
    }


async def _build_movement_context(db: AsyncSession, movements: list) -> _MovementContext:
    """Batch-resolve all lookup maps for a list of movement rows (no N+1)."""
    loc_ids: set[UUID] = set()
    store_ids: set[UUID] = set()
    user_ids: set[UUID] = set()
    product_ids: set[UUID] = set()
    variant_ids: set[UUID] = set()

    for m in movements:
        if m.storage_location_id:
            loc_ids.add(m.storage_location_id)
        if m.to_storage_location_id:
            loc_ids.add(m.to_storage_location_id)
        if m.store_id:
            store_ids.add(m.store_id)
        if m.to_store_id:
            store_ids.add(m.to_store_id)
        if m.performed_by:
            user_ids.add(m.performed_by)
        if m.product_id:
            product_ids.add(m.product_id)
        if m.variant_id:
            variant_ids.add(m.variant_id)

    loc_map: dict[str, str] = {}
    if loc_ids:
        rows = (await db.execute(
            select(StorageLocation.id, StorageLocation.name)
            .where(StorageLocation.id.in_(loc_ids))
        )).all()
        loc_map = {str(r[0]): r[1] for r in rows}

    store_map: dict[str, str] = {}
    if store_ids:
        rows = (await db.execute(
            select(Store.id, Store.name).where(Store.id.in_(store_ids))
        )).all()
        store_map = {str(r[0]): r[1] for r in rows}

    user_map: dict[str, dict] = {}
    if user_ids:
        rows = (await db.execute(
            select(User.id, User.full_name, User.email)
            .where(User.id.in_(user_ids))
        )).all()
        user_map = {str(r[0]): {"full_name": r[1], "email": r[2]} for r in rows}

    product_map: dict[str, dict] = {}
    if product_ids:
        rows = (await db.execute(
            select(Product.id, Product.name, Product.sku)
            .where(Product.id.in_(product_ids))
        )).all()
        product_map = {str(r[0]): {"name": r[1], "sku": r[2]} for r in rows}

    variant_map: dict[str, str] = {}
    if variant_ids:
        from app.models.vendor_product import ProductVariant
        rows = (await db.execute(
            select(ProductVariant.id, ProductVariant.name)
            .where(ProductVariant.id.in_(variant_ids))
        )).all()
        variant_map = {str(r[0]): r[1] for r in rows}

    return _MovementContext(
        location_names=loc_map,
        store_names=store_map,
        user_display=user_map,
        product_names=product_map,
        variant_names=variant_map,
    )


async def _location_name_map(db: AsyncSession, movements) -> dict[str, str]:
    """Legacy thin helper — kept for callers that only need location names."""
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
                # Route the incoming cost to the right field based on the product's method
                prod_method = getattr(
                    entity if isinstance(entity, Product) else (
                        await db.get(Product, product_id)  # type: ignore[arg-type]
                    ),
                    "valuation_method",
                    "moving_average",
                ) or "moving_average"

                if prod_method == "fixed":
                    # For fixed method: write directly to cost_price_fixed and cost_price
                    entity.cost_price_fixed = data.cost_price
                    entity.cost_price = data.cost_price
                else:
                    # For moving_average / standard: update MAP and refresh cached cost
                    from app.services.procurement_service import ProcurementService
                    from app.services.fifo_cost_service import FifoCostService
                    from app.services.cost_resolution import refresh_product_cost

                    proc_svc = ProcurementService(db)
                    await proc_svc._upsert_material_valuation(
                        vendor_id=vendor_id,
                        product_id=product_id,
                        variant_id=variant_id,
                        plant_id=None,
                        qty_signed=float(data.quantity),
                        unit_cost=float(data.cost_price),
                    )
                    fifo = FifoCostService(db)
                    await fifo.create_layer(
                        vendor_id=vendor_id,
                        product_id=product_id,
                        unit_cost=float(data.cost_price),
                        quantity=float(data.quantity),
                        variant_id=variant_id,
                        movement_id=m.id if m else None,
                        source_type="stock_in",
                        auto_commit=False,
                    )
                    await refresh_product_cost(db, vendor_id, product_id, variant_id)

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
        ctx = await _build_movement_context(db, [m])
        return JSONResponse(content=_movement_to_dict(m, ctx), status_code=201)
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
        ctx = await _build_movement_context(db, [m])
        return JSONResponse(content=_movement_to_dict(m, ctx), status_code=201)
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
        ctx = await _build_movement_context(db, [m])
        return JSONResponse(content=_movement_to_dict(m, ctx), status_code=201)
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
    document_number: Optional[str] = None,
    performed_by: Optional[str] = None,
    date_from: Optional[str] = Query(None, description="ISO date YYYY-MM-DD"),
    date_to: Optional[str] = Query(None, description="ISO date YYYY-MM-DD"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """List inventory movement history with enriched audit data."""
    svc = InventoryService(db)
    try:
        pid = UUID(product_id) if product_id else None
        sid = UUID(store_id) if store_id else None
        lid = UUID(storage_location_id) if storage_location_id else None
        pb_uid = UUID(performed_by) if performed_by else None
        dt_from = datetime.fromisoformat(date_from).replace(tzinfo=timezone.utc) if date_from else None
        dt_to = datetime.fromisoformat(date_to).replace(hour=23, minute=59, second=59, tzinfo=timezone.utc) if date_to else None
    except ValueError:
        raise HTTPException(400, "Invalid filter parameter")

    items, total = await svc.get_movement_history(
        vendor_id=vendor_id,
        product_id=pid,
        movement_type=movement_type,
        store_id=sid,
        storage_location_id=lid,
        page=page,
        size=size,
        document_number=document_number,
        performed_by=pb_uid,
        date_from=dt_from,
        date_to=dt_to,
    )
    ctx = await _build_movement_context(db, items)
    return JSONResponse(content={
        "items": [_movement_to_dict(m, ctx) for m in items],
        "total": total,
        "page": page,
        "size": size,
        "pages": math.ceil(total / size) if total > 0 else 0,
    })


# ── Movement Detail ────────────────────────────────────────────────

@router.get("/history/{movement_id}")
async def get_movement_detail(
    movement_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Full audit detail for a single inventory movement."""
    result = await db.execute(
        select(InventoryMovement).where(
            InventoryMovement.id == movement_id,
            InventoryMovement.vendor_id == vendor_id,
        )
    )
    m = result.scalar_one_or_none()
    if not m:
        raise HTTPException(404, "Movement not found")

    ctx = await _build_movement_context(db, [m])

    # Also fetch sibling lines that share the same document number
    siblings: list[dict] = []
    if m.document_number:
        sib_result = await db.execute(
            select(InventoryMovement).where(
                InventoryMovement.vendor_id == vendor_id,
                InventoryMovement.document_number == m.document_number,
                InventoryMovement.id != movement_id,
            ).order_by(InventoryMovement.document_line_no)
        )
        sib_rows = sib_result.scalars().all()
        if sib_rows:
            sib_ctx = await _build_movement_context(db, sib_rows)
            siblings = [_movement_to_dict(s, sib_ctx) for s in sib_rows]

    detail = _movement_to_dict(m, ctx)
    detail["document_siblings"] = siblings
    return JSONResponse(content=detail)


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
    """Get products that are at or below their low stock threshold or reorder point."""
    svc = InventoryService(db)
    sid = None
    if store_id:
        try:
            sid = UUID(store_id)
        except ValueError:
            raise HTTPException(400, "Invalid store_id")
    alerts = await svc.get_low_stock_alerts(vendor_id, store_id=sid)
    return JSONResponse(content={"items": alerts, "total": len(alerts)})


# ── Reorder Alerts ────────────────────────────────────────────────

@router.get("/reorder-alerts")
async def get_reorder_alerts(
    store_id: Optional[str] = None,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Get products whose quantity has reached or dropped below their configured
    reorder_point. Only returns items where reorder_point is explicitly set.
    """
    svc = InventoryService(db)
    sid = None
    if store_id:
        try:
            sid = UUID(store_id)
        except ValueError:
            raise HTTPException(400, "Invalid store_id")
    alerts = await svc.get_reorder_alerts(vendor_id, store_id=sid)
    return JSONResponse(content={"items": alerts, "total": len(alerts)})


# ── Expiry Alerts ─────────────────────────────────────────────────

def _expiry_urgency(expiry: date) -> str:
    today = date.today()
    if expiry < today:
        return "expired"
    delta = (expiry - today).days
    if delta <= 7:
        return "critical"
    if delta <= 30:
        return "warning"
    return "caution"


@router.get("/expiry-alerts")
async def get_expiry_alerts(
    days_ahead: int = Query(90, ge=1, le=365),
    store_id: Optional[str] = None,
    include_batches: bool = True,
    include_products: bool = True,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns products / variants / batches with an expiry or best-before date
    within the next `days_ahead` days (or already expired).

    Covers two sources:
    - Product / ProductVariant.expiration_date  (non-pharma products)
    - GoodsBatch.expiry_date  (procurement batch tracking)
    """
    cutoff = date.today() + timedelta(days=days_ahead)
    today = date.today()
    items: list[dict] = []

    # ── Source 1: Product / Variant-level expiry dates ────────────────────────
    if include_products:
        p_stmt = select(Product).where(
            Product.vendor_id == vendor_id,
            Product.track_inventory == True,
            Product.status == "active",
            or_(
                Product.expiration_date <= cutoff,
                Product.best_before_date <= cutoff,
            ),
        )
        products = (await db.execute(p_stmt)).scalars().all()

        for p in products:
            exp = p.expiration_date or p.best_before_date
            if not exp:
                continue
            days_left = (exp - today).days
            items.append({
                "source": "product",
                "product_id": str(p.id),
                "variant_id": None,
                "batch_id": None,
                "batch_number": None,
                "product_name": p.name,
                "sku": p.sku,
                "expiry_date": exp.isoformat(),
                "best_before_date": p.best_before_date.isoformat() if p.best_before_date else None,
                "days_remaining": days_left,
                "urgency": _expiry_urgency(exp),
                "quantity_available": p.quantity or 0,
                "storage_location_id": None,
                "storage_location_name": None,
                "store_id": None,
            })

        # Also check variants (tenant via parent product — variants have no vendor_id)
        v_stmt = (
            select(ProductVariant)
            .join(Product, Product.id == ProductVariant.product_id)
            .where(
                Product.vendor_id == vendor_id,
                or_(
                    ProductVariant.expiration_date <= cutoff,
                    ProductVariant.best_before_date <= cutoff,
                ),
            )
        )
        variants = (await db.execute(v_stmt)).scalars().all()
        p_ids = {v.product_id for v in variants}
        p_map: dict[UUID, Product] = {}
        if p_ids:
            res = await db.execute(select(Product).where(Product.id.in_(p_ids)))
            p_map = {p.id: p for p in res.scalars().all()}

        for v in variants:
            exp = v.expiration_date or v.best_before_date
            if not exp:
                continue
            prod = p_map.get(v.product_id)
            days_left = (exp - today).days
            items.append({
                "source": "variant",
                "product_id": str(v.product_id),
                "variant_id": str(v.id),
                "batch_id": None,
                "batch_number": None,
                "product_name": f"{prod.name} — {v.name}" if prod else v.name,
                "sku": v.sku or (prod.sku if prod else None),
                "expiry_date": exp.isoformat(),
                "best_before_date": v.best_before_date.isoformat() if v.best_before_date else None,
                "days_remaining": days_left,
                "urgency": _expiry_urgency(exp),
                "quantity_available": v.quantity or 0,
                "storage_location_id": None,
                "storage_location_name": None,
                "store_id": None,
            })

    # ── Source 2: GoodsBatch expiry ───────────────────────────────────────────
    if include_batches:
        b_stmt = select(GoodsBatch).where(
            GoodsBatch.vendor_id == vendor_id,
            GoodsBatch.is_active == True,
            GoodsBatch.quantity_available > 0,
            or_(
                GoodsBatch.expiry_date <= cutoff,
                GoodsBatch.best_before_date <= cutoff,
            ),
        )
        batches = (await db.execute(b_stmt)).scalars().all()

        batch_p_ids = {b.product_id for b in batches}
        batch_p_map: dict[UUID, Product] = {}
        if batch_p_ids:
            res = await db.execute(select(Product).where(Product.id.in_(batch_p_ids)))
            batch_p_map = {p.id: p for p in res.scalars().all()}

        # Fetch storage location names
        loc_ids = {b.storage_location_id for b in batches if b.storage_location_id}
        loc_map: dict[UUID, str] = {}
        if loc_ids:
            res = await db.execute(
                select(StorageLocation.id, StorageLocation.name).where(
                    StorageLocation.id.in_(loc_ids)
                )
            )
            loc_map = {row[0]: row[1] for row in res.all()}

        for b in batches:
            exp = b.expiry_date or b.best_before_date
            if not exp:
                continue
            prod = batch_p_map.get(b.product_id)
            days_left = (exp - today).days
            items.append({
                "source": "batch",
                "product_id": str(b.product_id),
                "variant_id": str(b.variant_id) if b.variant_id else None,
                "batch_id": str(b.id),
                "batch_number": b.batch_number,
                "product_name": prod.name if prod else "",
                "sku": prod.sku if prod else None,
                "expiry_date": exp.isoformat(),
                "best_before_date": b.best_before_date.isoformat() if b.best_before_date else None,
                "days_remaining": days_left,
                "urgency": _expiry_urgency(exp),
                "quantity_available": float(b.quantity_available),
                "storage_location_id": str(b.storage_location_id) if b.storage_location_id else None,
                "storage_location_name": loc_map.get(b.storage_location_id) if b.storage_location_id else None,
                "store_id": None,
            })

    # Sort: expired first, then by days_remaining ascending
    items.sort(key=lambda x: x["days_remaining"])

    # Urgency summary counts
    summary = {
        "expired": sum(1 for i in items if i["urgency"] == "expired"),
        "critical": sum(1 for i in items if i["urgency"] == "critical"),
        "warning": sum(1 for i in items if i["urgency"] == "warning"),
        "caution": sum(1 for i in items if i["urgency"] == "caution"),
    }

    return JSONResponse(content={
        "items": items,
        "total": len(items),
        "summary": summary,
        "days_ahead": days_ahead,
    })


# ── Write-Off Expired Stock ───────────────────────────────────────

class WriteOffRequest(BaseModel):
    product_id: str
    variant_id: Optional[str] = None
    batch_id: Optional[str] = None   # when writing off a specific goods batch
    quantity: int
    store_id: Optional[str] = None
    storage_location_id: Optional[str] = None
    reason: Optional[str] = None


@router.post("/write-off", status_code=201)
async def write_off_stock(
    data: WriteOffRequest,
    current_user: User = Depends(get_current_active_user),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Write off a quantity of expired / near-expiry stock.
    Creates a stock_out InventoryMovement and adjusts StoreInventory (or
    Product.quantity in global mode).
    When batch_id is provided the GoodsBatch.quantity_available is also decremented
    and the batch is marked exhausted if it reaches zero.
    """
    if data.quantity <= 0:
        raise HTTPException(400, "Quantity must be positive")

    product_id = UUID(data.product_id)
    variant_id = UUID(data.variant_id) if data.variant_id else None
    store_id = UUID(data.store_id) if data.store_id else None
    loc_id = UUID(data.storage_location_id) if data.storage_location_id else None
    reason = data.reason or "Write-off: expired / near-expiry stock"

    # Validate + lock the batch when provided
    batch = None
    if data.batch_id:
        from app.models.procurement_goods import GoodsBatch
        batch_res = await db.execute(
            select(GoodsBatch).where(
                GoodsBatch.id == UUID(data.batch_id),
                GoodsBatch.vendor_id == vendor_id,
            ).with_for_update()
        )
        batch = batch_res.scalar_one_or_none()
        if not batch:
            raise HTTPException(404, "Batch not found")
        if batch.quantity_available < data.quantity:
            raise HTTPException(
                400,
                f"Batch only has {batch.quantity_available} units available, cannot write off {data.quantity}"
            )

    svc = InventoryService(db)
    try:
        if store_id:
            await apply_store_inventory_delta(
                db, vendor_id, store_id, product_id, variant_id,
                -data.quantity, loc_id,
            )
            m = await svc.record_movement(
                vendor_id=vendor_id,
                product_id=product_id,
                variant_id=variant_id,
                movement_type="write_off",
                quantity=-data.quantity,
                reason=reason,
                performed_by=current_user.id,
                reference_type="write_off",
                auto_commit=False,
            )
            await sync_product_quantity_from_stores(db, vendor_id, product_id, variant_id)
            m.store_id = store_id
            if loc_id:
                m.storage_location_id = loc_id
            m.extra_data = {"write_off": True, "batch_id": data.batch_id}
        else:
            m = await svc.record_movement(
                vendor_id=vendor_id,
                product_id=product_id,
                variant_id=variant_id,
                movement_type="write_off",
                quantity=-data.quantity,
                reason=reason,
                performed_by=current_user.id,
                reference_type="write_off",
            )
            m.extra_data = {"write_off": True, "batch_id": data.batch_id}

        # Decrement batch quantity if provided
        if batch is not None:
            batch.quantity_available -= data.quantity
            if batch.quantity_available <= 0:
                batch.quantity_available = 0
                batch.is_active = False

        await db.commit()
        return JSONResponse(content={
            "message": "Stock written off",
            "quantity_written_off": data.quantity,
            "movement_id": str(m.id),
        }, status_code=201)
    except ValueError as e:
        await db.rollback()
        raise HTTPException(400, str(e))
