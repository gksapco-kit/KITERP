# app/api/v1/vendor_mrp.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, and_, func as sqlfunc
from typing import Optional, List
from uuid import UUID
from decimal import Decimal
from datetime import date, datetime, timezone

from app.database import get_db
from app.api.deps import get_current_active_user, get_current_vendor_id, require_permission
from app.api.v1.production_access import production_view, production_manage
from app.models.user import User
from app.models.mrp import ProductBOMItem, StockReservation
from app.models.production import ProductionOrder
from app.models.store import Store
from app.models.vendor_product import Product
from app.services.production_lifecycle import LIVE_STATUSES
from app.services.vendor_service import VendorService
from app.services.mrp_service import (
    ceil_decimal,
    get_available_stock,
    explode_bom,
    lock_product_scope,
)
from app.schemas.mrp import (
    BOMItemIn, BOMItemOut,
    MRPRequest, MRPResultLine,
    ReservationCreate, ReservationOut,
)

router = APIRouter(dependencies=[Depends(production_view)])


PRODUCTION_ORDER_TYPE = "production_order"
_PRODUCTION_MANAGED_MSG = (
    "These reservations belong to a live production order and follow its status. "
    "Move the order back to draft or cancel it to release them."
)


async def _is_live_production_order(db: AsyncSession, vendor_id: UUID, order_type: str, order_id: str) -> bool:
    """True when the reservations belong to a production order that still holds materials.
    Reservations of draft/cancelled/deleted orders stay releasable (stale-data cleanup)."""
    if order_type != PRODUCTION_ORDER_TYPE:
        return False
    try:
        oid = UUID(str(order_id))
    except (ValueError, TypeError):
        return False
    status = (await db.execute(
        select(ProductionOrder.status).where(ProductionOrder.id == oid, ProductionOrder.vendor_id == vendor_id)
    )).scalar_one_or_none()
    return status in LIVE_STATUSES


# ── BOM helpers ───────────────────────────────────────────────────────────────

def _bom_to_dict(item: ProductBOMItem, component: Product) -> dict:
    return {
        "id": str(item.id),
        "product_id": str(item.product_id),
        "component_id": str(item.component_id),
        "component_name": component.name if component else "Unknown",
        "component_sku": component.sku if component else None,
        "component_uom": component.uom if component else None,
        "qty_per_unit": float(item.qty_per_unit),
        "scrap_pct": float(item.scrap_pct or 0),
        "valid_from": item.valid_from.isoformat() if item.valid_from else None,
        "valid_to": item.valid_to.isoformat() if item.valid_to else None,
        "is_byproduct": bool(item.is_byproduct),
        "cost_share_pct": float(item.cost_share_pct or 0),
        "notes": item.notes,
        "created_at": item.created_at.isoformat() if item.created_at else None,
    }


def _resv_to_dict(r: StockReservation, product_name: Optional[str] = None) -> dict:
    return {
        "id": str(r.id),
        "vendor_id": str(r.vendor_id),
        "order_type": r.order_type,
        "order_id": r.order_id,
        "store_id": str(r.store_id) if r.store_id else None,
        "storage_location_id": str(r.storage_location_id) if r.storage_location_id else None,
        "product_id": str(r.product_id),
        "product_name": product_name,
        "variant_id": str(r.variant_id) if r.variant_id else None,
        "reserved_qty": float(r.reserved_qty),
        "status": r.status,
        "notes": r.notes,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "released_at": r.released_at.isoformat() if r.released_at else None,
        "consumed_at": r.consumed_at.isoformat() if r.consumed_at else None,
    }


# ── GET /products/{product_id}/bom ───────────────────────────────────────────

@router.get("/products/{product_id}/bom")
async def get_product_bom(
    product_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """List BOM items for a finished product."""
    result = await db.execute(
        select(ProductBOMItem)
        .where(
            ProductBOMItem.vendor_id == vendor_id,
            ProductBOMItem.product_id == product_id,
        )
        .order_by(ProductBOMItem.created_at)
    )
    items = result.scalars().all()

    # Component details in one query
    comps = {}
    if items:
        comps = {
            p.id: p for p in (await db.execute(
                select(Product).where(Product.id.in_([i.component_id for i in items]))
            )).scalars().all()
        }
    return [_bom_to_dict(item, comps.get(item.component_id)) for item in items]


def _validate_bom_lines(items: List[BOMItemIn]) -> None:
    """A component may repeat only as successive revisions: lines for the same component and
    role must have non-overlapping validity windows. By-product cost shares cannot exceed 100%."""
    far_past, far_future = date.min, date.max
    seen: dict = {}
    for i in items:
        lo, hi = i.valid_from or far_past, i.valid_to or far_future
        if hi < lo:
            raise HTTPException(400, "A BOM line's 'valid to' date cannot be before its 'valid from' date")
        seen.setdefault((i.component_id, bool(i.is_byproduct)), []).append((lo, hi))
    for (cid, _), windows in seen.items():
        windows.sort()
        for (a_lo, a_hi), (b_lo, _b_hi) in zip(windows, windows[1:]):
            if b_lo <= a_hi:
                raise HTTPException(
                    400,
                    "A component can appear more than once only with non-overlapping validity dates; "
                    "otherwise combine the quantities into one line",
                )
    today = date.today()
    shares = sum((i.cost_share_pct for i in items
                  if i.is_byproduct and (i.valid_from or far_past) <= today <= (i.valid_to or far_future)), Decimal("0"))
    if shares > 100:
        raise HTTPException(400, "By-product cost shares add up to more than 100%")


async def _bom_cycle_path(
    db: AsyncSession, vendor_id: UUID, product_id: UUID, component_ids: List[UUID],
) -> Optional[List[UUID]]:
    """Return a path product -> ... -> product if giving ``product_id`` these components
    would make a product (indirectly) a component of itself, else None.

    The product's current BOM is ignored (it is being replaced); every other
    product's BOM is read in a single query."""
    edges = (await db.execute(
        select(ProductBOMItem.product_id, ProductBOMItem.component_id).where(
            ProductBOMItem.vendor_id == vendor_id, ProductBOMItem.product_id != product_id,
            ProductBOMItem.is_byproduct.is_(False),  # outputs are not material flow
        )
    )).all()
    children: dict = {}
    for parent, child in edges:
        children.setdefault(parent, []).append(child)

    for start in component_ids:
        # Iterative DFS looking for product_id below `start`.
        stack = [(start, [product_id, start])]
        seen = {start}
        while stack:
            node, path = stack.pop()
            if node == product_id:
                return path
            for nxt in children.get(node, []):
                if nxt == product_id:
                    return path + [nxt]
                if nxt not in seen:
                    seen.add(nxt)
                    stack.append((nxt, path + [nxt]))
    return None


# ── PUT /products/{product_id}/bom ───────────────────────────────────────────

@router.put("/products/{product_id}/bom", status_code=200, dependencies=[Depends(production_manage)])
async def replace_product_bom(
    product_id: UUID,
    items: List[BOMItemIn],
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Replace all BOM items for a product (full replace / upsert)."""
    # Verify product belongs to vendor
    prod_result = await db.execute(
        select(Product).where(Product.id == product_id, Product.vendor_id == vendor_id)
    )
    if not prod_result.scalar_one_or_none():
        raise HTTPException(404, "Product not found")

    # ── Validate everything before touching the existing BOM ──
    component_ids = [i.component_id for i in items]
    if product_id in component_ids:
        raise HTTPException(400, "A product cannot be a component or by-product of itself")
    _validate_bom_lines(items)
    material_ids = [i.component_id for i in items if not i.is_byproduct]

    comps = {}
    if component_ids:
        comps = {
            p.id: p for p in (await db.execute(
                select(Product).where(Product.id.in_(component_ids), Product.vendor_id == vendor_id)
            )).scalars().all()
        }
    for cid in component_ids:
        if cid not in comps:
            raise HTTPException(404, f"Component product {cid} not found")

    cycle = await _bom_cycle_path(db, vendor_id, product_id, material_ids)
    if cycle:
        names = {
            p.id: p.name for p in (await db.execute(select(Product).where(Product.id.in_(cycle)))).scalars().all()
        }
        raise HTTPException(
            400,
            "This BOM would make a product a component of itself: "
            + " → ".join(names.get(pid, str(pid)) for pid in cycle),
        )

    # Delete existing BOM
    await db.execute(
        delete(ProductBOMItem).where(
            ProductBOMItem.vendor_id == vendor_id,
            ProductBOMItem.product_id == product_id,
        )
    )

    # Insert new rows
    new_items = []
    for item in items:
        comp = comps[item.component_id]

        bom_item = ProductBOMItem(
            vendor_id=vendor_id,
            product_id=product_id,
            component_id=item.component_id,
            qty_per_unit=item.qty_per_unit,
            scrap_pct=item.scrap_pct,
            valid_from=item.valid_from,
            valid_to=item.valid_to,
            is_byproduct=item.is_byproduct,
            cost_share_pct=item.cost_share_pct if item.is_byproduct else 0,
            notes=item.notes,
        )
        db.add(bom_item)
        new_items.append((bom_item, comp))

    await db.commit()

    out = []
    for bom_item, comp in new_items:
        await db.refresh(bom_item)
        out.append(_bom_to_dict(bom_item, comp))

    return out


# ── POST /mrp/calculate ───────────────────────────────────────────────────────

@router.post("/mrp/calculate")  # read-only calculation: view permission is enough
async def calculate_mrp(
    body: MRPRequest,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Given a list of finished-product line items, recursively explode their BOMs
    down to raw materials (multi-level, cycle-safe), and return material
    availability per leaf component — scoped to a business unit's StoreInventory
    when store_id is provided, else the global Product.quantity rollup.
    """
    component_requirements = await explode_bom(
        db, vendor_id,
        [{"product_id": i.product_id, "qty": i.qty, "name": i.name} for i in body.items],
    )

    result_lines = []
    for cid, entry in component_requirements.items():
        comp = entry["product_obj"]
        in_stock = await get_available_stock(db, vendor_id, UUID(cid), body.store_id)

        resv_scope = [
            StockReservation.vendor_id == vendor_id,
            StockReservation.product_id == UUID(cid),
            StockReservation.status == "active",
        ]
        if body.store_id:
            resv_scope.append(StockReservation.store_id == body.store_id)
        else:
            resv_scope.append(StockReservation.store_id.is_(None))

        resv_result = await db.execute(
            select(sqlfunc.coalesce(sqlfunc.sum(StockReservation.reserved_qty), 0)).where(*resv_scope)
        )
        total_reserved = Decimal(str(resv_result.scalar() or 0))

        order_resv_result = await db.execute(
            select(sqlfunc.coalesce(sqlfunc.sum(StockReservation.reserved_qty), 0)).where(
                *resv_scope,
                StockReservation.order_type == body.order_type,
                StockReservation.order_id == body.order_id,
            )
        )
        order_reserved = Decimal(str(order_resv_result.scalar() or 0))

        reserved_by_others = total_reserved - order_reserved
        available = in_stock - reserved_by_others
        required = entry["required_qty"]
        reserve_qty = ceil_decimal(required)
        shortage = max(Decimal("0"), reserve_qty - available)

        if entry["no_bom"]:
            status = "no_bom"
        elif available >= reserve_qty:
            status = "ok"
        elif available > 0:
            status = "partial"
        else:
            status = "short"

        result_lines.append({
            "component_id": cid,
            "component_name": comp.name if comp else "Unknown",
            "component_sku": comp.sku if comp else None,
            "component_uom": comp.uom if comp else None,
            "is_leaf": True,
            "bom_depth": entry["max_depth"],
            "required_qty": float(required),
            "reserve_qty": float(reserve_qty),
            "in_stock": float(in_stock),
            "reserved_by_others": float(reserved_by_others),
            "already_reserved_for_order": float(order_reserved),
            "available": float(available),
            "shortage": float(shortage),
            "status": status,
            "source_items": sorted(entry["source_items"]),
        })

    return result_lines


# ── GET /stock-reservations ───────────────────────────────────────────────────

@router.get("/stock-reservations")
async def list_reservations(
    order_type: Optional[str] = None,
    order_id: Optional[str] = None,
    status: Optional[str] = None,
    store_id: Optional[UUID] = None,
    limit: int = Query(500, ge=1, le=2000),
    offset: int = Query(0, ge=0),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """List stock reservations, optionally filtered by order."""
    q = select(StockReservation).where(StockReservation.vendor_id == vendor_id)
    if order_type:
        q = q.where(StockReservation.order_type == order_type)
    if order_id:
        q = q.where(StockReservation.order_id == order_id)
    if status:
        q = q.where(StockReservation.status == status)
    if store_id:
        q = q.where(StockReservation.store_id == store_id)
    q = q.order_by(StockReservation.created_at.desc())

    result = await db.execute(q.limit(limit).offset(offset))
    reservations = result.scalars().all()

    names = {}
    if reservations:
        names = dict((await db.execute(
            select(Product.id, Product.name).where(Product.id.in_({r.product_id for r in reservations}))
        )).all())
    return [_resv_to_dict(r, names.get(r.product_id)) for r in reservations]


# ── POST /stock-reservations ──────────────────────────────────────────────────

@router.post("/stock-reservations", status_code=201, dependencies=[Depends(production_manage)])
async def create_reservations(
    body: ReservationCreate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Create stock reservations for an order."""
    if not body.items:
        raise HTTPException(400, "No items to reserve")
    if body.order_type == PRODUCTION_ORDER_TYPE:
        raise HTTPException(
            409,
            "Production order materials are reserved automatically when the order is confirmed "
            "and released when it is moved back to draft or cancelled.",
        )

    if body.store_id:
        if not (await db.execute(
            select(Store.id).where(Store.id == body.store_id, Store.vendor_id == vendor_id)
        )).scalar_one_or_none():
            raise HTTPException(400, "Invalid business unit for this vendor")
    product_ids = {i.product_id for i in body.items}
    found = set((await db.execute(
        select(Product.id).where(Product.id.in_(product_ids), Product.vendor_id == vendor_id)
    )).scalars().all())
    if missing := product_ids - found:
        raise HTTPException(404, f"Product not found: {', '.join(str(m) for m in sorted(missing, key=str))}")

    created = []
    for item in body.items:
        await lock_product_scope(db, vendor_id, body.store_id, item.product_id)
        resv = StockReservation(
            vendor_id=vendor_id,
            order_type=body.order_type,
            order_id=body.order_id,
            store_id=body.store_id,
            storage_location_id=body.storage_location_id,
            product_id=item.product_id,
            variant_id=item.variant_id,
            reserved_qty=item.reserved_qty,
            notes=item.notes,
            status="active",
        )
        db.add(resv)
        created.append((resv, item.product_id))

    await db.commit()

    out = []
    for resv, product_id in created:
        await db.refresh(resv)
        prod_result = await db.execute(select(Product).where(Product.id == product_id))
        prod = prod_result.scalar_one_or_none()
        out.append(_resv_to_dict(resv, prod.name if prod else None))

    return out


# ── DELETE /stock-reservations/{id} ──────────────────────────────────────────

@router.delete("/stock-reservations/{reservation_id}", status_code=200, dependencies=[Depends(production_manage)])
async def release_reservation(
    reservation_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Release a single stock reservation."""
    result = await db.execute(
        select(StockReservation).where(
            StockReservation.id == reservation_id,
            StockReservation.vendor_id == vendor_id,
        )
    )
    resv = result.scalar_one_or_none()
    if not resv:
        raise HTTPException(404, "Reservation not found")
    if resv.status == "active" and await _is_live_production_order(db, vendor_id, resv.order_type, resv.order_id):
        raise HTTPException(409, _PRODUCTION_MANAGED_MSG)

    resv.status = "released"
    resv.released_at = datetime.now(timezone.utc)
    await db.commit()
    return {"message": "Reservation released", "id": str(reservation_id)}


# ── DELETE /stock-reservations (bulk by order) ───────────────────────────────

@router.delete("/stock-reservations", status_code=200, dependencies=[Depends(production_manage)])
async def release_all_reservations(
    order_type: str = Query(...),
    order_id: str = Query(...),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Release all active reservations for a given order."""
    if await _is_live_production_order(db, vendor_id, order_type, order_id):
        raise HTTPException(409, _PRODUCTION_MANAGED_MSG)
    result = await db.execute(
        select(StockReservation).where(
            StockReservation.vendor_id == vendor_id,
            StockReservation.order_type == order_type,
            StockReservation.order_id == order_id,
            StockReservation.status == "active",
        )
    )
    reservations = result.scalars().all()
    now = datetime.now(timezone.utc)
    count = 0
    for r in reservations:
        r.status = "released"
        r.released_at = now
        count += 1

    await db.commit()
    return {"message": f"{count} reservation(s) released", "count": count}
