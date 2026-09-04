"""
Stock Transfer Orders API
Prefix: /vendors/me/inventory/transfer-orders

Workflow:
  draft → submitted → dispatched (stock leaves source; in-transit)
        → received  (stock arrives at destination; complete)
        | cancelled (before dispatched)
"""
from __future__ import annotations

import math
import uuid as _uuid
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.api.deps import get_current_active_user, get_current_vendor_id, require_permission
from app.models.user import User
from app.models.store import Store, StoreInventory
from app.models.vendor_product import Product, ProductVariant
from app.models.inventory import InventoryMovement
from app.models.stock_transfer_order import StockTransferOrder, StockTransferOrderLine
from app.services.store_inventory_service import (
    get_store_inventory_row,
    apply_store_inventory_delta,
    sync_product_quantity_from_stores,
)

router = APIRouter(dependencies=[Depends(require_permission("inventory.view"))])


# ── Pydantic Schemas ──────────────────────────────────────────────────────────

class TransferLine(BaseModel):
    product_id: str
    variant_id: Optional[str] = None
    requested_qty: int = Field(gt=0)
    notes: Optional[str] = None


class TransferOrderCreate(BaseModel):
    from_store_id: str
    to_store_id: str
    from_storage_location_id: Optional[str] = None
    to_storage_location_id: Optional[str] = None
    notes: Optional[str] = None
    expected_date: Optional[str] = None  # ISO datetime
    lines: list[TransferLine] = Field(min_length=1)


class TransferOrderUpdate(BaseModel):
    notes: Optional[str] = None
    expected_date: Optional[str] = None


class ReceiveLine(BaseModel):
    line_id: str
    received_qty: int = Field(ge=0)


class ReceivePayload(BaseModel):
    lines: list[ReceiveLine] = Field(min_length=1)


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _seq(db: AsyncSession, vendor_id: UUID) -> int:
    res = await db.execute(
        select(func.count()).select_from(StockTransferOrder).where(StockTransferOrder.vendor_id == vendor_id)
    )
    return (res.scalar() or 0) + 1


def _ref(seq: int) -> str:
    y = datetime.now(tz=timezone.utc).year
    return f"STO-{y}-{seq:04d}"


async def _enrich_lines(db: AsyncSession, lines: list[StockTransferOrderLine]) -> list[dict]:
    pids = {l.product_id for l in lines}
    vids = {l.variant_id for l in lines if l.variant_id}
    products: dict[UUID, Product] = {}
    variants: dict[UUID, ProductVariant] = {}
    if pids:
        res = await db.execute(select(Product).where(Product.id.in_(pids)))
        products = {p.id: p for p in res.scalars().all()}
    if vids:
        res = await db.execute(select(ProductVariant).where(ProductVariant.id.in_(vids)))
        variants = {v.id: v for v in res.scalars().all()}

    out = []
    for l in lines:
        p = products.get(l.product_id)
        v = variants.get(l.variant_id) if l.variant_id else None
        out.append({
            "id": str(l.id),
            "order_id": str(l.order_id),
            "product_id": str(l.product_id),
            "variant_id": str(l.variant_id) if l.variant_id else None,
            "product_name": (f"{p.name} — {v.name}" if v else p.name) if p else "",
            "sku": ((v.sku if v else None) or (p.sku if p else None) or ""),
            "requested_qty": l.requested_qty,
            "dispatched_qty": l.dispatched_qty,
            "received_qty": l.received_qty,
            "notes": l.notes,
        })
    return out


def _order_to_dict(o: StockTransferOrder, lines_data: list | None = None) -> dict:
    d = {
        "id": str(o.id),
        "vendor_id": str(o.vendor_id),
        "reference_number": o.reference_number,
        "status": o.status,
        "from_store_id": str(o.from_store_id),
        "to_store_id": str(o.to_store_id),
        "from_storage_location_id": str(o.from_storage_location_id) if o.from_storage_location_id else None,
        "to_storage_location_id": str(o.to_storage_location_id) if o.to_storage_location_id else None,
        "notes": o.notes,
        "expected_date": o.expected_date.isoformat() if o.expected_date else None,
        "created_by": str(o.created_by) if o.created_by else None,
        "dispatched_by": str(o.dispatched_by) if o.dispatched_by else None,
        "received_by": str(o.received_by) if o.received_by else None,
        "dispatched_at": o.dispatched_at.isoformat() if o.dispatched_at else None,
        "received_at": o.received_at.isoformat() if o.received_at else None,
        "created_at": o.created_at.isoformat() if o.created_at else None,
    }
    if lines_data is not None:
        d["lines"] = lines_data
    return d


async def _fetch_order(db: AsyncSession, vendor_id: UUID, order_id: UUID) -> StockTransferOrder:
    res = await db.execute(
        select(StockTransferOrder)
        .where(StockTransferOrder.id == order_id, StockTransferOrder.vendor_id == vendor_id)
        .options(selectinload(StockTransferOrder.lines))
    )
    o = res.scalar_one_or_none()
    if not o:
        raise HTTPException(404, "Transfer order not found")
    return o


# ── POST /transfer-orders ─────────────────────────────────────────────────────

@router.post("/transfer-orders", status_code=201)
async def create_transfer_order(
    data: TransferOrderCreate,
    current_user: User = Depends(get_current_active_user),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    from_id = UUID(data.from_store_id)
    to_id = UUID(data.to_store_id)
    if from_id == to_id:
        raise HTTPException(400, "Source and destination stores must be different")

    for sid in [from_id, to_id]:
        s = (await db.execute(select(Store).where(Store.id == sid, Store.vendor_id == vendor_id))).scalar_one_or_none()
        if not s:
            raise HTTPException(404, f"Store {sid} not found")

    seq = await _seq(db, vendor_id)
    order = StockTransferOrder(
        id=_uuid.uuid4(),
        vendor_id=vendor_id,
        reference_number=_ref(seq),
        status="draft",
        from_store_id=from_id,
        to_store_id=to_id,
        from_storage_location_id=UUID(data.from_storage_location_id) if data.from_storage_location_id else None,
        to_storage_location_id=UUID(data.to_storage_location_id) if data.to_storage_location_id else None,
        notes=data.notes,
        created_by=current_user.id,
    )
    if data.expected_date:
        try:
            order.expected_date = datetime.fromisoformat(data.expected_date).replace(tzinfo=timezone.utc)
        except ValueError:
            pass
    db.add(order)
    await db.flush()

    for line in data.lines:
        l = StockTransferOrderLine(
            id=_uuid.uuid4(),
            order_id=order.id,
            vendor_id=vendor_id,
            product_id=UUID(line.product_id),
            variant_id=UUID(line.variant_id) if line.variant_id else None,
            requested_qty=line.requested_qty,
            notes=line.notes,
        )
        db.add(l)

    await db.commit()
    await db.refresh(order)
    return JSONResponse(content=_order_to_dict(order), status_code=201)


# ── GET /transfer-orders ──────────────────────────────────────────────────────

@router.get("/transfer-orders")
async def list_transfer_orders(
    status: Optional[str] = None,
    from_store_id: Optional[str] = None,
    to_store_id: Optional[str] = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    q = select(StockTransferOrder).where(StockTransferOrder.vendor_id == vendor_id)
    if status:
        q = q.where(StockTransferOrder.status == status)
    if from_store_id:
        q = q.where(StockTransferOrder.from_store_id == UUID(from_store_id))
    if to_store_id:
        q = q.where(StockTransferOrder.to_store_id == UUID(to_store_id))

    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar() or 0
    q = q.order_by(StockTransferOrder.created_at.desc()).offset((page - 1) * size).limit(size)
    orders = (await db.execute(q)).scalars().all()

    return JSONResponse(content={
        "items": [_order_to_dict(o) for o in orders],
        "total": total,
        "page": page,
        "pages": math.ceil(total / size) if total else 0,
    })


# ── GET /transfer-orders/{id} ─────────────────────────────────────────────────

@router.get("/transfer-orders/{order_id}")
async def get_transfer_order(
    order_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    o = await _fetch_order(db, vendor_id, order_id)
    lines_data = await _enrich_lines(db, o.lines)
    return JSONResponse(content=_order_to_dict(o, lines_data))


# ── PATCH /transfer-orders/{id} ───────────────────────────────────────────────

@router.patch("/transfer-orders/{order_id}")
async def update_transfer_order(
    order_id: UUID,
    data: TransferOrderUpdate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    o = await _fetch_order(db, vendor_id, order_id)
    if o.status not in ("draft", "submitted"):
        raise HTTPException(400, f"Cannot update a {o.status} transfer order")
    if data.notes is not None:
        o.notes = data.notes
    if data.expected_date is not None:
        try:
            o.expected_date = datetime.fromisoformat(data.expected_date).replace(tzinfo=timezone.utc)
        except ValueError:
            raise HTTPException(400, "Invalid expected_date")
    await db.commit()
    return JSONResponse(content=_order_to_dict(o))


# ── POST /transfer-orders/{id}/submit ────────────────────────────────────────

@router.post("/transfer-orders/{order_id}/submit")
async def submit_transfer_order(
    order_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    o = await _fetch_order(db, vendor_id, order_id)
    if o.status != "draft":
        raise HTTPException(400, f"Only draft orders can be submitted (current: {o.status})")
    o.status = "submitted"
    await db.commit()
    return JSONResponse(content={"message": "Transfer order submitted", "status": o.status})


# ── POST /transfer-orders/{id}/dispatch ──────────────────────────────────────

@router.post("/transfer-orders/{order_id}/dispatch")
async def dispatch_transfer_order(
    order_id: UUID,
    current_user: User = Depends(get_current_active_user),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Dispatch: deduct qty from source store and put stock 'in-transit'.
    Creates InventoryMovement(type='transfer', direction='out') for each line.
    """
    o = await _fetch_order(db, vendor_id, order_id)
    if o.status not in ("draft", "submitted"):
        raise HTTPException(400, f"Cannot dispatch a {o.status} transfer order")
    if not o.lines:
        raise HTTPException(400, "Transfer order has no lines")

    now = datetime.now(tz=timezone.utc)
    reason = f"Transfer order {o.reference_number}"

    for line in o.lines:
        inv = await get_store_inventory_row(
            db, o.from_store_id, line.product_id, line.variant_id,
            o.from_storage_location_id, for_update=True,
        )
        available = inv.quantity if inv else 0
        if available < line.requested_qty:
            raise HTTPException(
                400,
                f"Insufficient stock for product {line.product_id}: available {available}, requested {line.requested_qty}"
            )

        # Deduct from source
        inv.quantity -= line.requested_qty
        line.dispatched_qty = line.requested_qty

        # Movement ledger (out from source)
        db.add(InventoryMovement(
            id=_uuid.uuid4(),
            vendor_id=vendor_id,
            product_id=line.product_id,
            variant_id=line.variant_id,
            movement_type="transfer",
            quantity=-line.requested_qty,
            quantity_before=available,
            quantity_after=inv.quantity,
            reason=reason,
            reference_type="transfer_order",
            reference_id=o.id,
            store_id=o.from_store_id,
            to_store_id=o.to_store_id,
            storage_location_id=o.from_storage_location_id,
            to_storage_location_id=o.to_storage_location_id,
            performed_by=current_user.id,
            extra_data={"direction": "out", "transfer_order_ref": o.reference_number},
        ))

        # Sync product rollup
        await sync_product_quantity_from_stores(db, vendor_id, line.product_id, line.variant_id)

    o.status = "dispatched"
    o.dispatched_by = current_user.id
    o.dispatched_at = now
    await db.commit()
    return JSONResponse(content={"message": "Transfer order dispatched — stock is in transit", "status": o.status})


# ── POST /transfer-orders/{id}/receive ───────────────────────────────────────

@router.post("/transfer-orders/{order_id}/receive")
async def receive_transfer_order(
    order_id: UUID,
    body: ReceivePayload,
    current_user: User = Depends(get_current_active_user),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Receive: add stock to destination store.
    Received qty may differ from dispatched (short-shipment / over-shipment).
    Creates InventoryMovement(type='transfer', direction='in') for each line.
    """
    o = await _fetch_order(db, vendor_id, order_id)
    if o.status != "dispatched":
        raise HTTPException(400, f"Only dispatched orders can be received (current: {o.status})")

    receive_map = {item.line_id: item.received_qty for item in body.lines}
    now = datetime.now(tz=timezone.utc)
    reason = f"Transfer order {o.reference_number} — receipt"

    for line in o.lines:
        received_qty = receive_map.get(str(line.id), line.dispatched_qty or line.requested_qty)
        if received_qty <= 0:
            continue

        # Add to destination store
        inv = await get_store_inventory_row(
            db, o.to_store_id, line.product_id, line.variant_id,
            o.to_storage_location_id,
        )
        if inv:
            before = inv.quantity
            inv.quantity += received_qty
        else:
            from app.models.store import StoreInventory
            before = 0
            inv = StoreInventory(
                store_id=o.to_store_id,
                vendor_id=vendor_id,
                product_id=line.product_id,
                variant_id=line.variant_id,
                storage_location_id=o.to_storage_location_id,
                quantity=received_qty,
            )
            db.add(inv)

        line.received_qty = received_qty

        # Movement ledger (in to destination)
        db.add(InventoryMovement(
            id=_uuid.uuid4(),
            vendor_id=vendor_id,
            product_id=line.product_id,
            variant_id=line.variant_id,
            movement_type="transfer",
            quantity=received_qty,
            quantity_before=before,
            quantity_after=before + received_qty,
            reason=reason,
            reference_type="transfer_order",
            reference_id=o.id,
            store_id=o.to_store_id,
            to_store_id=o.from_store_id,
            storage_location_id=o.to_storage_location_id,
            performed_by=current_user.id,
            extra_data={"direction": "in", "transfer_order_ref": o.reference_number},
        ))

        await sync_product_quantity_from_stores(db, vendor_id, line.product_id, line.variant_id)

    o.status = "received"
    o.received_by = current_user.id
    o.received_at = now
    await db.commit()
    return JSONResponse(content={"message": "Transfer order received — stock updated at destination", "status": o.status})


# ── POST /transfer-orders/{id}/cancel ────────────────────────────────────────

@router.post("/transfer-orders/{order_id}/cancel")
async def cancel_transfer_order(
    order_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    o = await _fetch_order(db, vendor_id, order_id)
    if o.status in ("received", "cancelled"):
        raise HTTPException(400, f"Cannot cancel a {o.status} transfer order")
    if o.status == "dispatched":
        raise HTTPException(
            400,
            "Order is already dispatched and stock is in-transit. Receive it first, then manually adjust if needed."
        )
    o.status = "cancelled"
    await db.commit()
    return JSONResponse(content={"message": "Transfer order cancelled", "status": o.status})
