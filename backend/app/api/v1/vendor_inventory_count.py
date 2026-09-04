"""
Inventory Counting & Audit API
Endpoint prefix: /vendors/me/inventory/stock-counts
"""
from __future__ import annotations

from datetime import datetime, date as date_type, timezone
from typing import Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.api.deps import get_current_active_user, get_current_vendor_id, require_permission
from app.models.user import User
from app.models.inventory_count import StockCount, StockCountLine
from app.models.inventory import InventoryMovement
from app.models.store import StoreInventory
from app.models.vendor_product import Product, ProductVariant
from app.services.inventory_service import InventoryService
from app.services.store_inventory_service import (
    set_store_inventory_quantity,
    sync_product_quantity_from_stores,
)

router = APIRouter(dependencies=[Depends(require_permission("inventory.view"))])


# ── Pydantic Schemas ──────────────────────────────────────────────────────────

class StockCountCreate(BaseModel):
    count_type: str = Field(default="cycle_count", pattern="^(cycle_count|full_count|spot_check)$")
    description: Optional[str] = None
    store_id: Optional[str] = None
    storage_location_id: Optional[str] = None
    count_date: Optional[str] = None  # ISO date
    freeze_stock: bool = False
    # Optional list of specific product_ids to include; empty = all active tracked products
    product_ids: list[str] = Field(default_factory=list)


class StockCountUpdate(BaseModel):
    description: Optional[str] = None
    notes: Optional[str] = None
    count_date: Optional[str] = None


class StockCountLineUpdate(BaseModel):
    counted_qty: int = Field(ge=0)
    notes: Optional[str] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _next_reference_number(seq: int) -> str:
    y = datetime.now(tz=timezone.utc).year
    return f"SC-{y}-{seq:04d}"


async def _get_seq(db: AsyncSession, vendor_id: UUID) -> int:
    result = await db.execute(
        select(func.count()).select_from(StockCount).where(StockCount.vendor_id == vendor_id)
    )
    return (result.scalar() or 0) + 1


def _line_to_dict(line: StockCountLine, product_name: str = "", sku: str = "", variant_name: str = "") -> dict:
    return {
        "id": str(line.id),
        "count_id": str(line.count_id),
        "product_id": str(line.product_id),
        "variant_id": str(line.variant_id) if line.variant_id else None,
        "storage_location_id": str(line.storage_location_id) if line.storage_location_id else None,
        "product_name": product_name,
        "sku": sku,
        "variant_name": variant_name,
        "system_qty": line.system_qty,
        "counted_qty": line.counted_qty,
        "variance": line.variance,
        "status": line.status,
        "notes": line.notes,
        "counted_at": line.counted_at.isoformat() if line.counted_at else None,
        "created_at": line.created_at.isoformat() if line.created_at else None,
    }


def _count_to_dict(count: StockCount, include_lines: bool = False, lines_data: list | None = None) -> dict:
    d = {
        "id": str(count.id),
        "vendor_id": str(count.vendor_id),
        "reference_number": count.reference_number,
        "count_type": count.count_type,
        "status": count.status,
        "store_id": str(count.store_id) if count.store_id else None,
        "storage_location_id": str(count.storage_location_id) if count.storage_location_id else None,
        "description": count.description,
        "notes": count.notes,
        "count_date": count.count_date.isoformat() if count.count_date else None,
        "created_by": str(count.created_by) if count.created_by else None,
        "counted_by": str(count.counted_by) if count.counted_by else None,
        "reviewed_by": str(count.reviewed_by) if count.reviewed_by else None,
        "freeze_stock": count.freeze_stock,
        "started_at": count.started_at.isoformat() if count.started_at else None,
        "posted_at": count.posted_at.isoformat() if count.posted_at else None,
        "created_at": count.created_at.isoformat() if count.created_at else None,
        "updated_at": count.updated_at.isoformat() if count.updated_at else None,
    }
    if include_lines:
        d["lines"] = lines_data or []
    return d


async def _enrich_lines(db: AsyncSession, lines: list[StockCountLine]) -> list[dict]:
    """Attach product name / sku / variant name to each line dict."""
    product_ids = {line.product_id for line in lines}
    variant_ids = {line.variant_id for line in lines if line.variant_id}

    products: dict[UUID, Product] = {}
    if product_ids:
        res = await db.execute(select(Product).where(Product.id.in_(product_ids)))
        for p in res.scalars().all():
            products[p.id] = p

    variants: dict[UUID, ProductVariant] = {}
    if variant_ids:
        res = await db.execute(select(ProductVariant).where(ProductVariant.id.in_(variant_ids)))
        for v in res.scalars().all():
            variants[v.id] = v

    result = []
    for line in lines:
        p = products.get(line.product_id)
        v = variants.get(line.variant_id) if line.variant_id else None
        result.append(_line_to_dict(
            line,
            product_name=p.name if p else "",
            sku=((v.sku if v else None) or (p.sku if p else None) or ""),
            variant_name=v.name if v else "",
        ))
    return result


async def _fetch_count_or_404(
    db: AsyncSession, vendor_id: UUID, count_id: UUID
) -> StockCount:
    result = await db.execute(
        select(StockCount)
        .where(StockCount.id == count_id, StockCount.vendor_id == vendor_id)
        .options(selectinload(StockCount.lines))
    )
    sc = result.scalar_one_or_none()
    if not sc:
        raise HTTPException(404, "Stock count not found")
    return sc


# ── POST /stock-counts — Create a new count session ──────────────────────────

@router.post("/stock-counts", status_code=201)
async def create_stock_count(
    data: StockCountCreate,
    current_user: User = Depends(get_current_active_user),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a stock-count session and auto-populate lines from active inventory.

    Scope rules:
    - If store_id provided: loads StoreInventory rows for that store.
    - If storage_location_id also provided: further filters to that location.
    - If neither: loads Product-level quantities (global mode).
    - If product_ids list provided: restricts to those products only.
    """
    store_id = UUID(data.store_id) if data.store_id else None
    loc_id = UUID(data.storage_location_id) if data.storage_location_id else None
    if loc_id and not store_id:
        raise HTTPException(400, "store_id is required when storage_location_id is provided")

    # Parse count_date
    count_date = None
    if data.count_date:
        try:
            count_date = date_type.fromisoformat(data.count_date)
        except ValueError:
            raise HTTPException(400, "Invalid count_date — expected ISO format YYYY-MM-DD")

    seq = await _get_seq(db, vendor_id)
    ref = _next_reference_number(seq)

    sc = StockCount(
        id=uuid4(),
        vendor_id=vendor_id,
        reference_number=ref,
        count_type=data.count_type,
        status="draft",
        store_id=store_id,
        storage_location_id=loc_id,
        description=data.description,
        count_date=count_date,
        created_by=current_user.id,
        freeze_stock=data.freeze_stock,
    )
    db.add(sc)
    await db.flush()  # get sc.id before creating lines

    # ── Populate lines from current inventory ─────────────────────────────────
    product_filter = [UUID(pid) for pid in data.product_ids] if data.product_ids else []

    if store_id:
        q = select(StoreInventory).where(
            StoreInventory.vendor_id == vendor_id,
            StoreInventory.store_id == store_id,
        )
        if loc_id:
            q = q.where(StoreInventory.storage_location_id == loc_id)
        if product_filter:
            q = q.where(StoreInventory.product_id.in_(product_filter))
        rows = (await db.execute(q)).scalars().all()

        for row in rows:
            line = StockCountLine(
                id=uuid4(),
                count_id=sc.id,
                vendor_id=vendor_id,
                product_id=row.product_id,
                variant_id=row.variant_id,
                storage_location_id=row.storage_location_id,
                system_qty=row.quantity or 0,
                status="pending",
            )
            db.add(line)
    else:
        # Global: load all tracked products
        q = select(Product).where(
            Product.vendor_id == vendor_id,
            Product.track_inventory == True,
            Product.status == "active",
        )
        if product_filter:
            q = q.where(Product.id.in_(product_filter))
        products = (await db.execute(q)).scalars().all()

        for p in products:
            line = StockCountLine(
                id=uuid4(),
                count_id=sc.id,
                vendor_id=vendor_id,
                product_id=p.id,
                variant_id=None,
                storage_location_id=None,
                system_qty=p.quantity or 0,
                status="pending",
            )
            db.add(line)

    await db.commit()
    await db.refresh(sc)

    return JSONResponse(content=_count_to_dict(sc), status_code=201)


# ── GET /stock-counts — List sessions ────────────────────────────────────────

@router.get("/stock-counts")
async def list_stock_counts(
    status: Optional[str] = None,
    store_id: Optional[str] = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    q = select(StockCount).where(StockCount.vendor_id == vendor_id)
    if status:
        q = q.where(StockCount.status == status)
    if store_id:
        q = q.where(StockCount.store_id == UUID(store_id))

    total_res = await db.execute(select(func.count()).select_from(q.subquery()))
    total = total_res.scalar() or 0

    q = q.order_by(StockCount.created_at.desc()).offset((page - 1) * size).limit(size)
    counts = (await db.execute(q)).scalars().all()

    import math
    return JSONResponse(content={
        "items": [_count_to_dict(c) for c in counts],
        "total": total,
        "page": page,
        "size": size,
        "pages": math.ceil(total / size) if total > 0 else 0,
    })


# ── GET /stock-counts/{count_id} — Get with lines ────────────────────────────

@router.get("/stock-counts/{count_id}")
async def get_stock_count(
    count_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    sc = await _fetch_count_or_404(db, vendor_id, count_id)
    lines_data = await _enrich_lines(db, sc.lines)

    # Line summary
    total_lines = len(sc.lines)
    counted_lines = sum(1 for line in sc.lines if line.counted_qty is not None)
    variance_lines = sum(1 for line in sc.lines if line.variance and line.variance != 0)

    d = _count_to_dict(sc, include_lines=True, lines_data=lines_data)
    d["summary"] = {
        "total_lines": total_lines,
        "counted_lines": counted_lines,
        "uncounted_lines": total_lines - counted_lines,
        "variance_lines": variance_lines,
        "completion_pct": round(counted_lines / total_lines * 100, 1) if total_lines else 0,
    }
    return JSONResponse(content=d)


# ── PATCH /stock-counts/{count_id} — Update metadata ────────────────────────

@router.patch("/stock-counts/{count_id}")
async def update_stock_count(
    count_id: UUID,
    data: StockCountUpdate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    sc = await _fetch_count_or_404(db, vendor_id, count_id)
    if sc.status in ("completed", "cancelled"):
        raise HTTPException(400, f"Cannot update a {sc.status} stock count")

    if data.description is not None:
        sc.description = data.description
    if data.notes is not None:
        sc.notes = data.notes
    if data.count_date is not None:
        try:
            sc.count_date = date_type.fromisoformat(data.count_date)
        except ValueError:
            raise HTTPException(400, "Invalid count_date")

    await db.commit()
    return JSONResponse(content=_count_to_dict(sc))


# ── POST /stock-counts/{count_id}/start — Start counting ─────────────────────

@router.post("/stock-counts/{count_id}/start")
async def start_stock_count(
    count_id: UUID,
    current_user: User = Depends(get_current_active_user),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Transition draft → in_progress.
    Re-snaps system_qty from current inventory so the baseline is accurate
    at the moment counting begins.
    """
    sc = await _fetch_count_or_404(db, vendor_id, count_id)
    if sc.status != "draft":
        raise HTTPException(400, f"Only draft counts can be started (current: {sc.status})")

    # Re-snap system quantities to current stock
    if sc.store_id:
        for line in sc.lines:
            q = select(StoreInventory).where(
                StoreInventory.vendor_id == vendor_id,
                StoreInventory.store_id == sc.store_id,
                StoreInventory.product_id == line.product_id,
            )
            if line.variant_id:
                q = q.where(StoreInventory.variant_id == line.variant_id)
            else:
                q = q.where(StoreInventory.variant_id.is_(None))
            if line.storage_location_id:
                q = q.where(StoreInventory.storage_location_id == line.storage_location_id)
            else:
                q = q.where(StoreInventory.storage_location_id.is_(None))
            row = (await db.execute(q)).scalar_one_or_none()
            line.system_qty = row.quantity if row else 0
    else:
        for line in sc.lines:
            if line.variant_id:
                entity = await db.get(ProductVariant, line.variant_id)
            else:
                entity = await db.get(Product, line.product_id)
            line.system_qty = entity.quantity or 0 if entity else 0

    sc.status = "in_progress"
    sc.counted_by = current_user.id
    sc.started_at = datetime.now(tz=timezone.utc)
    await db.commit()
    return JSONResponse(content={"message": "Stock count started", "status": sc.status})


# ── PUT /stock-counts/{count_id}/lines/{line_id} — Enter counted qty ─────────

@router.put("/stock-counts/{count_id}/lines/{line_id}")
async def update_count_line(
    count_id: UUID,
    line_id: UUID,
    data: StockCountLineUpdate,
    current_user: User = Depends(get_current_active_user),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    sc = await _fetch_count_or_404(db, vendor_id, count_id)
    if sc.status not in ("in_progress", "counting"):
        raise HTTPException(400, f"Count lines can only be updated when status is in_progress or counting")

    line = next((l for l in sc.lines if l.id == line_id), None)
    if not line:
        raise HTTPException(404, "Count line not found")

    line.counted_qty = data.counted_qty
    line.variance = data.counted_qty - line.system_qty
    line.status = "counted"
    line.notes = data.notes
    line.counted_at = datetime.now(tz=timezone.utc)

    # Auto-advance session status to 'counting' once first line is entered
    if sc.status == "in_progress":
        sc.status = "counting"

    await db.commit()

    lines_data = await _enrich_lines(db, [line])
    return JSONResponse(content=lines_data[0])


# ── POST /stock-counts/{count_id}/review — Submit for review ─────────────────

@router.post("/stock-counts/{count_id}/review")
async def submit_for_review(
    count_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    sc = await _fetch_count_or_404(db, vendor_id, count_id)
    if sc.status not in ("in_progress", "counting"):
        raise HTTPException(400, f"Count must be in_progress or counting to submit for review")

    sc.status = "under_review"
    await db.commit()
    return JSONResponse(content={"message": "Stock count submitted for review", "status": sc.status})


# ── POST /stock-counts/{count_id}/post — Post variances to stock ──────────────

@router.post("/stock-counts/{count_id}/post")
async def post_stock_count(
    count_id: UUID,
    current_user: User = Depends(get_current_active_user),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Apply all non-zero variances to inventory.
    For each line where counted_qty != system_qty:
      - Adjust StoreInventory (or Product.quantity) to counted_qty
      - Create an InventoryMovement of type 'stock_count'
    Marks session as 'completed'.
    """
    sc = await _fetch_count_or_404(db, vendor_id, count_id)
    if sc.status not in ("counting", "under_review"):
        raise HTTPException(
            400,
            f"Count must be in counting or under_review status to post (current: {sc.status})"
        )

    # Check at least one line has been counted
    counted = [line for line in sc.lines if line.counted_qty is not None]
    if not counted:
        raise HTTPException(400, "No lines have been counted yet")

    svc = InventoryService(db)
    adjustments_made = 0

    for line in sc.lines:
        if line.counted_qty is None:
            # Treat uncounted lines as no change — skip
            continue

        variance = line.counted_qty - line.system_qty
        line.variance = variance
        line.status = "accepted"

        if variance == 0:
            continue

        adjustments_made += 1

        if sc.store_id:
            # Adjust store-level inventory
            inv_q = select(StoreInventory).where(
                StoreInventory.vendor_id == vendor_id,
                StoreInventory.store_id == sc.store_id,
                StoreInventory.product_id == line.product_id,
            )
            if line.variant_id:
                inv_q = inv_q.where(StoreInventory.variant_id == line.variant_id)
            else:
                inv_q = inv_q.where(StoreInventory.variant_id.is_(None))
            if line.storage_location_id:
                inv_q = inv_q.where(StoreInventory.storage_location_id == line.storage_location_id)
            else:
                inv_q = inv_q.where(StoreInventory.storage_location_id.is_(None))
            inv_row = (await db.execute(inv_q)).scalar_one_or_none()

            before = inv_row.quantity if inv_row else 0
            if inv_row:
                inv_row.quantity = line.counted_qty
            else:
                inv_row = StoreInventory(
                    store_id=sc.store_id,
                    vendor_id=vendor_id,
                    product_id=line.product_id,
                    variant_id=line.variant_id,
                    storage_location_id=line.storage_location_id,
                    quantity=line.counted_qty,
                )
                db.add(inv_row)

            await sync_product_quantity_from_stores(db, vendor_id, line.product_id, line.variant_id)
        else:
            # Global mode: adjust product quantity directly
            if line.variant_id:
                entity = await db.get(ProductVariant, line.variant_id)
            else:
                entity = await db.get(Product, line.product_id)
            if not entity:
                continue
            before = entity.quantity or 0
            entity.quantity = line.counted_qty

        # Record movement
        movement = InventoryMovement(
            id=uuid4(),
            vendor_id=vendor_id,
            product_id=line.product_id,
            variant_id=line.variant_id,
            movement_type="stock_count",
            quantity=variance,
            quantity_before=line.system_qty,
            quantity_after=line.counted_qty,
            reason=f"Stock count {sc.reference_number}",
            reference_type="stock_count",
            reference_id=sc.id,
            store_id=sc.store_id,
            storage_location_id=line.storage_location_id,
            performed_by=current_user.id,
            extra_data={"count_id": str(sc.id), "reference_number": sc.reference_number},
        )
        db.add(movement)

    sc.status = "completed"
    sc.reviewed_by = current_user.id
    sc.posted_at = datetime.now(tz=timezone.utc)

    await db.commit()
    return JSONResponse(content={
        "message": "Stock count posted successfully",
        "adjustments_made": adjustments_made,
        "reference_number": sc.reference_number,
        "status": sc.status,
    })


# ── POST /stock-counts/{count_id}/cancel — Cancel session ────────────────────

@router.post("/stock-counts/{count_id}/cancel")
async def cancel_stock_count(
    count_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    sc = await _fetch_count_or_404(db, vendor_id, count_id)
    if sc.status == "completed":
        raise HTTPException(400, "Completed counts cannot be cancelled")
    if sc.status == "cancelled":
        raise HTTPException(400, "Count is already cancelled")

    sc.status = "cancelled"
    await db.commit()
    return JSONResponse(content={"message": "Stock count cancelled", "status": sc.status})


# ── GET /stock-counts/{count_id}/variance-report ─────────────────────────────

@router.get("/stock-counts/{count_id}/variance-report")
async def get_variance_report(
    count_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Return lines with non-zero variance for reporting / export."""
    sc = await _fetch_count_or_404(db, vendor_id, count_id)
    variance_lines = [l for l in sc.lines if l.variance is not None and l.variance != 0]
    lines_data = await _enrich_lines(db, variance_lines)

    total_surplus = sum(l["variance"] for l in lines_data if l["variance"] > 0)
    total_shortage = sum(abs(l["variance"]) for l in lines_data if l["variance"] < 0)

    return JSONResponse(content={
        "count_id": str(sc.id),
        "reference_number": sc.reference_number,
        "status": sc.status,
        "posted_at": sc.posted_at.isoformat() if sc.posted_at else None,
        "total_variance_lines": len(variance_lines),
        "total_surplus_qty": total_surplus,
        "total_shortage_qty": total_shortage,
        "lines": lines_data,
    })
