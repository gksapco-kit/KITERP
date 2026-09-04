"""
Inventory Analytics & Reports API
Prefix: /vendors/me/inventory/reports
"""
from __future__ import annotations

from datetime import date, datetime, timezone, timedelta
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy import select, func, and_, case, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.deps import get_current_vendor_id, require_permission
from app.models.vendor_product import Product
from app.models.inventory import InventoryMovement
from app.models.store import StoreInventory
from app.models.stock_cost_layer import StockCostLayer
from app.services.fifo_cost_service import FifoCostService

router = APIRouter(dependencies=[Depends(require_permission("inventory.view"))])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _days_ago(n: int) -> datetime:
    return datetime.now(tz=timezone.utc) - timedelta(days=n)


# ── Stock Value Summary ────────────────────────────────────────────────────────

@router.get("/reports/stock-value")
async def stock_value_report(
    group_by: str = Query("category", regex="^(category|store|all)$"),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Current stock value = product.quantity * product.cost_price.
    Grouped by category (default), store, or flattened.
    """
    stmt = (
        select(
            Product.category,
            Product.id.label("product_id"),
            Product.name,
            Product.sku,
            Product.quantity,
            Product.cost_price,
            (Product.quantity * Product.cost_price).label("stock_value"),
        )
        .where(
            Product.vendor_id == vendor_id,
            Product.track_inventory == True,
            Product.cost_price.isnot(None),
            Product.quantity > 0,
        )
        .order_by(Product.category, Product.name)
    )
    rows = (await db.execute(stmt)).all()

    items = [
        {
            "product_id": str(r.product_id),
            "product_name": r.name,
            "sku": r.sku,
            "category": r.category or "Uncategorised",
            "quantity": r.quantity,
            "cost_price": float(r.cost_price),
            "stock_value": float(r.stock_value or 0),
        }
        for r in rows
    ]

    # Group
    if group_by == "category":
        groups: dict[str, dict] = {}
        for item in items:
            cat = item["category"]
            if cat not in groups:
                groups[cat] = {"category": cat, "items": [], "total_value": 0, "total_qty": 0}
            groups[cat]["items"].append(item)
            groups[cat]["total_value"] = round(groups[cat]["total_value"] + item["stock_value"], 2)
            groups[cat]["total_qty"] += item["quantity"]
        data = sorted(groups.values(), key=lambda g: g["total_value"], reverse=True)
    else:
        data = items

    total_value = round(sum(i["stock_value"] for i in items), 2)
    return JSONResponse(content={
        "data": data,
        "total_value": total_value,
        "total_skus": len(items),
        "group_by": group_by,
    })


# ── ABC Analysis ──────────────────────────────────────────────────────────────

@router.get("/reports/abc-analysis")
async def abc_analysis(
    days: int = Query(90, ge=7, le=365, description="Look-back window for movement value"),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """
    ABC classification:
      A  — top 10 % products by cumulative outbound movement value
      B  — next 40 %
      C  — remaining 50 %

    Value = |quantity| * product.cost_price  (for outbound movements only)
    """
    cutoff = _days_ago(days)

    # Outbound movements with cost
    stmt = (
        select(
            InventoryMovement.product_id,
            func.sum(func.abs(InventoryMovement.quantity)).label("total_units"),
        )
        .where(
            InventoryMovement.vendor_id == vendor_id,
            InventoryMovement.quantity < 0,
            InventoryMovement.created_at >= cutoff,
        )
        .group_by(InventoryMovement.product_id)
    )
    movement_rows = (await db.execute(stmt)).all()
    if not movement_rows:
        return JSONResponse(content={"items": [], "total_items": 0, "days": days})

    # Enrich with product data
    pids = [r.product_id for r in movement_rows]
    prod_res = await db.execute(
        select(Product.id, Product.name, Product.sku, Product.category, Product.cost_price)
        .where(Product.id.in_(pids))
    )
    prods = {p.id: p for p in prod_res.all()}

    items = []
    for r in movement_rows:
        p = prods.get(r.product_id)
        cost = float(p.cost_price or 0) if p else 0
        items.append({
            "product_id": str(r.product_id),
            "product_name": p.name if p else "",
            "sku": p.sku if p else None,
            "category": p.category if p else None,
            "total_units_out": int(r.total_units),
            "cost_price": cost,
            "movement_value": round(int(r.total_units) * cost, 2),
            "abc_class": None,
        })

    # Sort descending by value
    items.sort(key=lambda x: x["movement_value"], reverse=True)

    # Assign ABC
    total_val = sum(i["movement_value"] for i in items)
    cumulative = 0.0
    a_threshold = total_val * 0.70
    b_threshold = total_val * 0.95

    for item in items:
        cumulative += item["movement_value"]
        if cumulative <= a_threshold:
            item["abc_class"] = "A"
        elif cumulative <= b_threshold:
            item["abc_class"] = "B"
        else:
            item["abc_class"] = "C"
        item["cumulative_pct"] = round(cumulative / total_val * 100, 1) if total_val else 0

    summary = {
        "A": {"count": sum(1 for i in items if i["abc_class"] == "A"), "value": round(sum(i["movement_value"] for i in items if i["abc_class"] == "A"), 2)},
        "B": {"count": sum(1 for i in items if i["abc_class"] == "B"), "value": round(sum(i["movement_value"] for i in items if i["abc_class"] == "B"), 2)},
        "C": {"count": sum(1 for i in items if i["abc_class"] == "C"), "value": round(sum(i["movement_value"] for i in items if i["abc_class"] == "C"), 2)},
    }

    return JSONResponse(content={
        "items": items,
        "summary": summary,
        "total_items": len(items),
        "total_movement_value": round(total_val, 2),
        "days": days,
    })


# ── Stock Aging ───────────────────────────────────────────────────────────────

@router.get("/reports/stock-aging")
async def stock_aging(
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Days since last outbound movement per product.
    Products with no movement (ever) are included as 'never moved'.
    """
    # Latest outbound movement per product
    sub = (
        select(
            InventoryMovement.product_id,
            func.max(InventoryMovement.created_at).label("last_moved"),
        )
        .where(
            InventoryMovement.vendor_id == vendor_id,
            InventoryMovement.quantity < 0,
        )
        .group_by(InventoryMovement.product_id)
        .subquery()
    )

    stmt = (
        select(
            Product.id,
            Product.name,
            Product.sku,
            Product.category,
            Product.quantity,
            Product.cost_price,
            sub.c.last_moved,
        )
        .outerjoin(sub, Product.id == sub.c.product_id)
        .where(
            Product.vendor_id == vendor_id,
            Product.track_inventory == True,
            Product.quantity > 0,
        )
        .order_by(sub.c.last_moved.asc().nullsfirst())
    )
    rows = (await db.execute(stmt)).all()
    today = datetime.now(tz=timezone.utc)

    items = []
    for r in rows:
        days_idle = None
        if r.last_moved:
            lm = r.last_moved if r.last_moved.tzinfo else r.last_moved.replace(tzinfo=timezone.utc)
            days_idle = (today - lm).days

        bucket = (
            "never_moved" if days_idle is None
            else "over_180d" if days_idle > 180
            else "91_180d" if days_idle > 90
            else "31_90d" if days_idle > 30
            else "0_30d"
        )

        items.append({
            "product_id": str(r.id),
            "product_name": r.name,
            "sku": r.sku,
            "category": r.category or "Uncategorised",
            "quantity_on_hand": r.quantity,
            "cost_price": float(r.cost_price or 0),
            "stock_value": float((r.quantity or 0) * (r.cost_price or 0)),
            "last_moved": r.last_moved.isoformat() if r.last_moved else None,
            "days_since_movement": days_idle,
            "aging_bucket": bucket,
        })

    # Bucket summary
    buckets = ["never_moved", "over_180d", "91_180d", "31_90d", "0_30d"]
    summary = {
        b: {
            "count": sum(1 for i in items if i["aging_bucket"] == b),
            "stock_value": round(sum(i["stock_value"] for i in items if i["aging_bucket"] == b), 2),
        }
        for b in buckets
    }

    return JSONResponse(content={
        "items": items,
        "summary": summary,
        "total_items": len(items),
    })


# ── Slow Movers ───────────────────────────────────────────────────────────────

@router.get("/reports/slow-movers")
async def slow_movers(
    days: int = Query(90, ge=7, le=365, description="Products with no outbound movement in this many days"),
    min_qty: int = Query(1, ge=0, description="Minimum quantity on hand to include"),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Products with on-hand stock but no outbound movements in `days` days."""
    cutoff = _days_ago(days)

    # Products that had at least one outbound movement after cutoff
    active_sub = (
        select(InventoryMovement.product_id)
        .where(
            InventoryMovement.vendor_id == vendor_id,
            InventoryMovement.quantity < 0,
            InventoryMovement.created_at >= cutoff,
        )
        .distinct()
        .subquery()
    )

    stmt = (
        select(Product)
        .where(
            Product.vendor_id == vendor_id,
            Product.track_inventory == True,
            Product.quantity >= min_qty,
            Product.id.not_in(select(active_sub.c.product_id)),
        )
        .order_by(Product.quantity.desc())
    )
    products = (await db.execute(stmt)).scalars().all()

    items = [
        {
            "product_id": str(p.id),
            "product_name": p.name,
            "sku": p.sku,
            "category": p.category or "Uncategorised",
            "quantity_on_hand": p.quantity,
            "cost_price": float(p.cost_price or 0),
            "stock_value": float((p.quantity or 0) * (p.cost_price or 0)),
            "reorder_point": p.reorder_point,
        }
        for p in products
    ]

    return JSONResponse(content={
        "items": items,
        "total": len(items),
        "days_threshold": days,
        "total_stock_value_at_risk": round(sum(i["stock_value"] for i in items), 2),
    })


# ── FIFO Valuation ─────────────────────────────────────────────────────────────

@router.get("/reports/fifo-valuation")
async def fifo_valuation(
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """
    FIFO-based inventory valuation.
    Returns remaining cost layers per product, with FIFO value and WAC.
    Requires stock to be received via the cost-layer flow.
    """
    svc = FifoCostService(db)
    layers = await svc.get_stock_valuation(vendor_id)

    # Enrich with product names
    pids = list({UUID(l["product_id"]) for l in layers})
    prod_map: dict[UUID, Product] = {}
    if pids:
        res = await db.execute(select(Product.id, Product.name, Product.sku, Product.category).where(Product.id.in_(pids)))
        prod_map = {p.id: p for p in res.all()}

    enriched = []
    for l in layers:
        pid = UUID(l["product_id"])
        p = prod_map.get(pid)
        enriched.append({
            **l,
            "product_name": p.name if p else "",
            "sku": p.sku if p else None,
            "category": p.category if p else None,
        })

    enriched.sort(key=lambda x: x.get("fifo_value", 0), reverse=True)
    total_fifo_value = round(sum(e["fifo_value"] for e in enriched), 4)

    return JSONResponse(content={
        "items": enriched,
        "total_products": len(enriched),
        "total_fifo_value": total_fifo_value,
    })


@router.post("/reports/fifo-valuation/create-layer")
async def create_cost_layer(
    product_id: str,
    quantity: float,
    unit_cost: float,
    variant_id: Optional[str] = None,
    source_type: str = "stock_in",
    notes: Optional[str] = None,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Manually create a FIFO cost layer for a product.
    In production this is called automatically by stock_in / purchase receipt flows.
    """
    svc = FifoCostService(db)
    layer = await svc.create_layer(
        vendor_id=vendor_id,
        product_id=UUID(product_id),
        unit_cost=unit_cost,
        quantity=quantity,
        variant_id=UUID(variant_id) if variant_id else None,
        source_type=source_type,
        notes=notes,
        auto_commit=True,
    )
    return JSONResponse(content={
        "id": str(layer.id),
        "product_id": product_id,
        "received_qty": float(layer.received_qty),
        "unit_cost": float(layer.unit_cost),
        "total_cost": float(layer.total_cost),
        "source_type": layer.source_type,
    }, status_code=201)
