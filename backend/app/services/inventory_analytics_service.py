"""
Inventory Analytics Service
All heavy SQL aggregations for the Inventory Analytics module.
Kept separate from the router so logic can be tested and reused independently.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import and_, case, cast, func, literal_column, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.types import Date as DateType

from app.models.inventory import InventoryMovement
from app.models.inventory_count import StockCount, StockCountLine
from app.models.mrp import StockReservation
from app.models.procurement_goods import GoodsBatch
from app.models.procurement_special import MaterialValuation
from app.models.stock_cost_layer import StockCostLayer
from app.models.stock_transfer_order import StockTransferOrder, StockTransferOrderLine
from app.models.store import Store, StoreInventory
from app.models.vendor_product import Product


# ── Classification helpers ──────────────────────────────────────────────────

INBOUND_TYPES = ("purchase", "stock_in", "sale_return", "initial", "purchase_return")
OUTBOUND_TYPES = ("sale", "stock_out", "write_off")
ADJUSTMENT_TYPES = ("adjustment", "stock_count")
SHRINKAGE_TYPES = ("write_off", "adjustment", "stock_count")


def _default_range(date_from: Optional[date], date_to: Optional[date]) -> tuple[date, date]:
    today = date.today()
    return (
        date_from or (today - timedelta(days=29)),
        date_to or today,
    )


def _to_dt(d: date) -> datetime:
    return datetime(d.year, d.month, d.day, tzinfo=timezone.utc)


# ── 1. Overview KPIs ────────────────────────────────────────────────────────

async def get_overview(
    db: AsyncSession,
    vendor_id: UUID,
    store_id: Optional[UUID],
    date_from: Optional[date],
    date_to: Optional[date],
) -> dict:
    df, dt = _default_range(date_from, date_to)
    prev_df = df - (dt - df + timedelta(days=1))
    prev_dt = df - timedelta(days=1)

    async def _total_stock_value():
        # Stock value: only products where cost_price is set (can't value without it).
        val_q = select(
            func.sum(StoreInventory.quantity * Product.cost_price).label("val"),
        ).join(Product, Product.id == StoreInventory.product_id).where(
            StoreInventory.vendor_id == vendor_id,
            Product.track_inventory.is_(True),
            Product.cost_price.isnot(None),
            StoreInventory.quantity > 0,
        )
        if store_id:
            val_q = val_q.where(StoreInventory.store_id == store_id)

        # Active SKUs: any tracked product with stock, regardless of cost_price.
        sku_q = select(
            func.count(StoreInventory.id).label("skus"),
        ).join(Product, Product.id == StoreInventory.product_id).where(
            StoreInventory.vendor_id == vendor_id,
            Product.track_inventory.is_(True),
            StoreInventory.quantity > 0,
        )
        if store_id:
            sku_q = sku_q.where(StoreInventory.store_id == store_id)

        val_row = (await db.execute(val_q)).one()
        sku_row = (await db.execute(sku_q)).one()
        return float(val_row.val or 0), int(sku_row.skus or 0)

    async def _movement_values(df2: date, dt2: date):
        """Returns (total_in_value, total_out_value) for a date range."""
        q = (
            select(
                func.sum(
                    case(
                        (InventoryMovement.quantity > 0, InventoryMovement.quantity * Product.cost_price),
                        else_=0,
                    )
                ).label("inbound"),
                func.sum(
                    case(
                        (InventoryMovement.quantity < 0, func.abs(InventoryMovement.quantity) * Product.cost_price),
                        else_=0,
                    )
                ).label("outbound"),
            )
            .join(Product, Product.id == InventoryMovement.product_id)
            .where(
                InventoryMovement.vendor_id == vendor_id,
                InventoryMovement.movement_type.in_(OUTBOUND_TYPES + INBOUND_TYPES),
                InventoryMovement.created_at >= _to_dt(df2),
                InventoryMovement.created_at < _to_dt(dt2 + timedelta(days=1)),
                Product.cost_price.isnot(None),
            )
        )
        if store_id:
            q = q.where(InventoryMovement.store_id == store_id)
        row = (await db.execute(q)).one()
        return float(row.inbound or 0), float(row.outbound or 0)

    async def _stockout_count():
        q = select(func.count(StoreInventory.id)).where(
            StoreInventory.vendor_id == vendor_id,
            StoreInventory.quantity <= 0,
            Product.track_inventory.is_(True),
        ).join(Product, Product.id == StoreInventory.product_id)
        if store_id:
            q = q.where(StoreInventory.store_id == store_id)
        return int((await db.execute(q)).scalar() or 0)

    async def _excess_value():
        """Products where on-hand > reorder_point + reorder_quantity."""
        q = select(
            func.sum(
                (StoreInventory.quantity - Product.reorder_point - Product.reorder_quantity)
                * Product.cost_price
            ).label("excess")
        ).join(Product, Product.id == StoreInventory.product_id).where(
            StoreInventory.vendor_id == vendor_id,
            Product.track_inventory.is_(True),
            Product.reorder_point.isnot(None),
            Product.reorder_quantity.isnot(None),
            Product.cost_price.isnot(None),
            StoreInventory.quantity > Product.reorder_point + Product.reorder_quantity,
        )
        if store_id:
            q = q.where(StoreInventory.store_id == store_id)
        return float((await db.execute(q)).scalar() or 0)

    async def _expiry_at_risk():
        """Value of batches expiring within 90 days."""
        horizon = date.today() + timedelta(days=90)
        q = select(
            func.sum(GoodsBatch.quantity_available * Product.cost_price).label("val")
        ).join(Product, Product.id == GoodsBatch.product_id).where(
            GoodsBatch.vendor_id == vendor_id,
            GoodsBatch.expiry_date.isnot(None),
            GoodsBatch.expiry_date <= horizon,
            GoodsBatch.expiry_date >= date.today(),
            GoodsBatch.quantity_available > 0,
            Product.cost_price.isnot(None),
        )
        # GoodsBatch has no store_id; store scoping not supported for batch expiry overview
        return float((await db.execute(q)).scalar() or 0)

    async def _count_accuracy():
        q = select(
            func.count(StockCountLine.id).label("total"),
            func.sum(case((StockCountLine.variance == 0, 1), else_=0)).label("accurate"),
        ).join(StockCount, StockCount.id == StockCountLine.count_id).where(
            StockCountLine.vendor_id == vendor_id,
            StockCount.status == "completed",
            StockCountLine.counted_qty.isnot(None),
        )
        if store_id:
            q = q.where(StockCount.store_id == store_id)
        row = (await db.execute(q)).one()
        total = int(row.total or 0)
        accurate = int(row.accurate or 0)
        return round(accurate / total * 100, 1) if total else None

    total_val, sku_count = await _total_stock_value()
    inbound, outbound = await _movement_values(df, dt)
    prev_in, prev_out = await _movement_values(prev_df, prev_dt)
    stockouts = await _stockout_count()
    excess = await _excess_value()
    expiry_risk = await _expiry_at_risk()
    accuracy = await _count_accuracy()

    def _delta(curr: float, prev: float) -> Optional[float]:
        if prev == 0:
            return None
        return round((curr - prev) / prev * 100, 1)

    days_in_period = max((dt - df).days + 1, 1)
    avg_val = total_val  # simplified — could average opening/closing when snapshot available
    turnover = round(outbound / avg_val, 2) if avg_val else None
    dsi = round(days_in_period / turnover, 1) if turnover else None

    return {
        "period": {"date_from": df.isoformat(), "date_to": dt.isoformat(), "days": days_in_period},
        "stock_value": {"current": round(total_val, 2), "skus": sku_count},
        "inbound_value": {"current": round(inbound, 2), "delta_pct": _delta(inbound, prev_in)},
        "outbound_value": {"current": round(outbound, 2), "delta_pct": _delta(outbound, prev_out)},
        "stockouts": stockouts,
        "excess_value": round(excess, 2),
        "expiry_at_risk_90d": round(expiry_risk, 2),
        "count_accuracy_pct": accuracy,
        "turnover_ratio": turnover,
        "days_sales_of_inventory": dsi,
    }


# ── 2. Inventory Turnover & DSI ─────────────────────────────────────────────

async def get_turnover(
    db: AsyncSession,
    vendor_id: UUID,
    store_id: Optional[UUID],
    date_from: Optional[date],
    date_to: Optional[date],
    basis: str = "all_outbound",
    group_by: str = "category",
) -> dict:
    df, dt = _default_range(date_from, date_to)
    days = max((dt - df).days + 1, 1)

    out_types = ("sale",) if basis == "sales" else OUTBOUND_TYPES

    q = (
        select(
            Product.category.label("grp"),
            func.sum(
                func.abs(InventoryMovement.quantity) * Product.cost_price
            ).label("cogs"),
        )
        .join(Product, Product.id == InventoryMovement.product_id)
        .where(
            InventoryMovement.vendor_id == vendor_id,
            InventoryMovement.movement_type.in_(out_types),
            InventoryMovement.created_at >= _to_dt(df),
            InventoryMovement.created_at < _to_dt(dt + timedelta(days=1)),
            Product.cost_price.isnot(None),
        )
        .group_by(Product.category)
    )
    if store_id:
        q = q.where(InventoryMovement.store_id == store_id)

    rows = (await db.execute(q)).all()

    # Current on-hand value per category
    val_q = (
        select(
            Product.category.label("grp"),
            func.sum(StoreInventory.quantity * Product.cost_price).label("val"),
        )
        .join(Product, Product.id == StoreInventory.product_id)
        .where(
            StoreInventory.vendor_id == vendor_id,
            Product.track_inventory.is_(True),
            Product.cost_price.isnot(None),
            StoreInventory.quantity > 0,
        )
        .group_by(Product.category)
    )
    if store_id:
        val_q = val_q.where(StoreInventory.store_id == store_id)

    val_rows = {r.grp: float(r.val or 0) for r in (await db.execute(val_q)).all()}

    items = []
    total_cogs = 0.0
    for r in rows:
        cogs = float(r.cogs or 0)
        on_hand = val_rows.get(r.grp, 0)
        turnover = round(cogs / on_hand, 2) if on_hand else None
        dsi = round(days / turnover, 1) if turnover else None
        items.append({
            "group": r.grp or "Uncategorised",
            "cogs": round(cogs, 2),
            "inventory_value": round(on_hand, 2),
            "turnover_ratio": turnover,
            "days_sales_of_inventory": dsi,
        })
        total_cogs += cogs

    items.sort(key=lambda x: x["cogs"], reverse=True)
    total_val = sum(val_rows.values())

    return {
        "items": items,
        "total_cogs": round(total_cogs, 2),
        "total_inventory_value": round(total_val, 2),
        "period_days": days,
        "basis": basis,
        "group_by": group_by,
        "date_from": df.isoformat(),
        "date_to": dt.isoformat(),
    }


# ── 3. Movement Trend ───────────────────────────────────────────────────────

async def get_movement_trend(
    db: AsyncSession,
    vendor_id: UUID,
    store_id: Optional[UUID],
    date_from: Optional[date],
    date_to: Optional[date],
    bucket: str = "day",
) -> dict:
    df, dt = _default_range(date_from, date_to)

    trunc = func.date_trunc(bucket, InventoryMovement.created_at).label("period")

    q = (
        select(
            trunc,
            func.sum(
                case(
                    (InventoryMovement.movement_type.in_(list(INBOUND_TYPES)),
                     InventoryMovement.quantity * Product.cost_price),
                    else_=0,
                )
            ).label("inbound_value"),
            func.sum(
                case(
                    (InventoryMovement.movement_type.in_(list(OUTBOUND_TYPES)),
                     func.abs(InventoryMovement.quantity) * Product.cost_price),
                    else_=0,
                )
            ).label("outbound_value"),
            func.sum(
                case(
                    (InventoryMovement.movement_type.in_(list(ADJUSTMENT_TYPES)),
                     func.abs(InventoryMovement.quantity) * Product.cost_price),
                    else_=0,
                )
            ).label("adjustment_value"),
            func.count(InventoryMovement.id).label("movements"),
        )
        .join(Product, Product.id == InventoryMovement.product_id)
        .where(
            InventoryMovement.vendor_id == vendor_id,
            InventoryMovement.created_at >= _to_dt(df),
            InventoryMovement.created_at < _to_dt(dt + timedelta(days=1)),
            Product.cost_price.isnot(None),
        )
        .group_by(text("period"))
        .order_by(text("period"))
    )
    if store_id:
        q = q.where(InventoryMovement.store_id == store_id)

    rows = (await db.execute(q)).all()
    series = [
        {
            "date": r.period.date().isoformat(),
            "inbound_value": round(float(r.inbound_value or 0), 2),
            "outbound_value": round(float(r.outbound_value or 0), 2),
            "adjustment_value": round(float(r.adjustment_value or 0), 2),
            "movements": int(r.movements),
        }
        for r in rows
    ]

    return {
        "series": series,
        "bucket": bucket,
        "date_from": df.isoformat(),
        "date_to": dt.isoformat(),
    }


# ── 4. Stock Health (vs. reorder policy) ───────────────────────────────────

async def get_stock_health(
    db: AsyncSession,
    vendor_id: UUID,
    store_id: Optional[UUID],
    category: Optional[str],
    limit: int,
    offset: int,
) -> dict:
    q = (
        select(
            StoreInventory.id.label("si_id"),
            StoreInventory.store_id,
            StoreInventory.quantity.label("on_hand"),
            StoreInventory.low_stock_threshold,
            Product.id.label("product_id"),
            Product.name,
            Product.sku,
            Product.category,
            Product.cost_price,
            Product.reorder_point,
            Product.reorder_quantity,
        )
        .join(Product, Product.id == StoreInventory.product_id)
        .where(
            StoreInventory.vendor_id == vendor_id,
            Product.track_inventory.is_(True),
        )
    )
    if store_id:
        q = q.where(StoreInventory.store_id == store_id)
    if category:
        q = q.where(Product.category == category)

    rows = (await db.execute(q)).all()

    items = []
    for r in rows:
        rp = r.reorder_point or 0
        rq = r.reorder_quantity or 0
        threshold = r.low_stock_threshold or rp  # prefer bin threshold, fall back to product reorder_point
        on_hand = r.on_hand or 0
        cost = float(r.cost_price or 0)

        if on_hand <= 0:
            status = "stockout"
        elif on_hand < threshold:
            status = "below_reorder"
        elif rq > 0 and on_hand > rp + rq:
            status = "excess"
        else:
            status = "healthy"

        items.append({
            "product_id": str(r.product_id),
            "product_name": r.name,
            "sku": r.sku,
            "category": r.category or "Uncategorised",
            "on_hand": on_hand,
            "reorder_point": rp,
            "reorder_quantity": rq,
            "max_stock": rp + rq if rq else None,
            "stock_value": round(on_hand * cost, 2),
            "status": status,
        })

    summary = {
        s: {"count": sum(1 for i in items if i["status"] == s),
            "value": round(sum(i["stock_value"] for i in items if i["status"] == s), 2)}
        for s in ("stockout", "below_reorder", "healthy", "excess")
    }

    items.sort(key=lambda x: (x["status"] == "stockout", x["status"] == "below_reorder"), reverse=True)
    total = len(items)
    paged = items[offset: offset + limit]

    return {
        "items": paged,
        "total": total,
        "summary": summary,
    }


# ── 5. Expiry / Batch Risk ──────────────────────────────────────────────────

async def get_expiry_risk(
    db: AsyncSession,
    vendor_id: UUID,
    store_id: Optional[UUID],
    category: Optional[str],
    limit: int,
    offset: int,
) -> dict:
    today = date.today()
    buckets = [
        ("expired", None, today),
        ("0_30d", today, today + timedelta(days=30)),
        ("31_90d", today + timedelta(days=30), today + timedelta(days=90)),
        ("91_180d", today + timedelta(days=90), today + timedelta(days=180)),
        ("180d_plus", today + timedelta(days=180), None),
    ]

    q = (
        select(
            GoodsBatch.id,
            GoodsBatch.batch_number,
            GoodsBatch.expiry_date,
            GoodsBatch.quantity_available,
            GoodsBatch.quality_status,
            GoodsBatch.manufacturing_date,
            Product.id.label("product_id"),
            Product.name,
            Product.sku,
            Product.category,
            Product.cost_price,
        )
        .join(Product, Product.id == GoodsBatch.product_id)
        .where(
            GoodsBatch.vendor_id == vendor_id,
            GoodsBatch.expiry_date.isnot(None),
            GoodsBatch.quantity_available > 0,
        )
        .order_by(GoodsBatch.expiry_date.asc())
    )
    # GoodsBatch has no store_id column; store-level scope not available here.
    # Callers can pass plant_id or storage_location_id for location scoping when needed.
    if category:
        q = q.where(Product.category == category)

    rows = (await db.execute(q)).all()

    def _bucket(exp: date) -> str:
        if exp < today:
            return "expired"
        days_left = (exp - today).days
        if days_left <= 30:
            return "0_30d"
        if days_left <= 90:
            return "31_90d"
        if days_left <= 180:
            return "91_180d"
        return "180d_plus"

    items = []
    for r in rows:
        cost = float(r.cost_price or 0)
        qty = float(r.quantity_available or 0)
        items.append({
            "batch_id": str(r.id),
            "batch_number": r.batch_number,
            "product_id": str(r.product_id),
            "product_name": r.name,
            "sku": r.sku,
            "category": r.category or "Uncategorised",
            "expiry_date": r.expiry_date.isoformat() if r.expiry_date else None,
            "manufacturing_date": r.manufacturing_date.isoformat() if r.manufacturing_date else None,
            "days_to_expiry": (r.expiry_date - today).days if r.expiry_date else None,
            "quantity_available": qty,
            "value_at_risk": round(qty * cost, 2),
            "quality_status": r.quality_status,
            "risk_bucket": _bucket(r.expiry_date) if r.expiry_date else "unknown",
        })

    bucket_summary = {
        b[0]: {
            "count": sum(1 for i in items if i["risk_bucket"] == b[0]),
            "value": round(sum(i["value_at_risk"] for i in items if i["risk_bucket"] == b[0]), 2),
        }
        for b in buckets
    }
    total = len(items)
    paged = items[offset: offset + limit]

    return {
        "items": paged,
        "total": total,
        "summary": bucket_summary,
        "total_value_at_risk": round(sum(i["value_at_risk"] for i in items), 2),
    }


# ── 6. Shrinkage & Adjustments ──────────────────────────────────────────────

async def get_shrinkage(
    db: AsyncSession,
    vendor_id: UUID,
    store_id: Optional[UUID],
    date_from: Optional[date],
    date_to: Optional[date],
    group_by: str = "store",
) -> dict:
    df, dt = _default_range(date_from, date_to)

    # Load stores for name enrichment
    store_rows = (await db.execute(
        select(Store.id, Store.name).where(Store.vendor_id == vendor_id)
    )).all()
    store_map = {str(r.id): r.name for r in store_rows}

    q = (
        select(
            InventoryMovement.movement_type,
            InventoryMovement.store_id,
            func.sum(func.abs(InventoryMovement.quantity)).label("total_units"),
            func.sum(func.abs(InventoryMovement.quantity) * Product.cost_price).label("total_value"),
            func.count(InventoryMovement.id).label("events"),
        )
        .join(Product, Product.id == InventoryMovement.product_id)
        .where(
            InventoryMovement.vendor_id == vendor_id,
            InventoryMovement.movement_type.in_(list(SHRINKAGE_TYPES)),
            InventoryMovement.created_at >= _to_dt(df),
            InventoryMovement.created_at < _to_dt(dt + timedelta(days=1)),
            Product.cost_price.isnot(None),
        )
        .group_by(InventoryMovement.movement_type, InventoryMovement.store_id)
    )
    if store_id:
        q = q.where(InventoryMovement.store_id == store_id)

    rows = (await db.execute(q)).all()

    items = []
    for r in rows:
        items.append({
            "movement_type": r.movement_type,
            "store_id": str(r.store_id) if r.store_id else None,
            "store_name": store_map.get(str(r.store_id), "Unknown") if r.store_id else "No Store",
            "total_units": int(r.total_units or 0),
            "total_value": round(float(r.total_value or 0), 2),
            "events": int(r.events or 0),
        })

    # Aggregate by chosen dimension
    agg: dict = {}
    for i in items:
        key = i["store_name"] if group_by == "store" else i["movement_type"]
        if key not in agg:
            agg[key] = {"label": key, "total_units": 0, "total_value": 0.0, "events": 0}
        agg[key]["total_units"] += i["total_units"]
        agg[key]["total_value"] = round(agg[key]["total_value"] + i["total_value"], 2)
        agg[key]["events"] += i["events"]

    grouped = sorted(agg.values(), key=lambda x: x["total_value"], reverse=True)
    total_val = round(sum(i["total_value"] for i in items), 2)
    total_units = sum(i["total_units"] for i in items)

    return {
        "items": items,
        "grouped": grouped,
        "total_value": total_val,
        "total_units": total_units,
        "group_by": group_by,
        "date_from": df.isoformat(),
        "date_to": dt.isoformat(),
    }


# ── 7. Count Accuracy ──────────────────────────────────────────────────────

async def get_count_accuracy(
    db: AsyncSession,
    vendor_id: UUID,
    store_id: Optional[UUID],
    date_from: Optional[date],
    date_to: Optional[date],
) -> dict:
    df, dt = _default_range(date_from, date_to)

    q = (
        select(
            StockCount.id,
            StockCount.reference_number,
            StockCount.count_date,
            StockCount.count_type,
            StockCount.store_id,
            func.count(StockCountLine.id).label("lines_counted"),
            func.sum(case((StockCountLine.variance == 0, 1), else_=0)).label("accurate_lines"),
            func.sum(func.abs(StockCountLine.variance)).label("total_variance"),
        )
        .join(StockCountLine, StockCountLine.count_id == StockCount.id)
        .where(
            StockCount.vendor_id == vendor_id,
            StockCount.status == "completed",
            StockCountLine.counted_qty.isnot(None),
            StockCount.posted_at >= _to_dt(df),
            StockCount.posted_at < _to_dt(dt + timedelta(days=1)),
        )
        .group_by(StockCount.id)
        .order_by(StockCount.count_date.desc().nullslast())
    )
    if store_id:
        q = q.where(StockCount.store_id == store_id)

    rows = (await db.execute(q)).all()

    counts = []
    for r in rows:
        total = int(r.lines_counted or 0)
        accurate = int(r.accurate_lines or 0)
        ira = round(accurate / total * 100, 1) if total else None
        counts.append({
            "count_id": str(r.id),
            "reference": r.reference_number,
            "count_date": r.count_date.isoformat() if r.count_date else None,
            "count_type": r.count_type,
            "lines_counted": total,
            "accurate_lines": accurate,
            "ira_pct": ira,
            "total_variance_units": int(r.total_variance or 0),
        })

    all_lines = sum(c["lines_counted"] for c in counts)
    all_accurate = sum(c["accurate_lines"] for c in counts)
    overall_ira = round(all_accurate / all_lines * 100, 1) if all_lines else None

    return {
        "counts": counts,
        "total_counts": len(counts),
        "overall_ira_pct": overall_ira,
        "total_lines": all_lines,
        "date_from": df.isoformat(),
        "date_to": dt.isoformat(),
    }


# ── 8. Valuation Comparison ─────────────────────────────────────────────────

async def get_valuation_comparison(
    db: AsyncSession,
    vendor_id: UUID,
    store_id: Optional[UUID],
    category: Optional[str],
    limit: int,
    offset: int,
) -> dict:
    # On-hand quantities per product
    si_q = (
        select(
            StoreInventory.product_id,
            func.sum(StoreInventory.quantity).label("on_hand"),
        )
        .where(StoreInventory.vendor_id == vendor_id, StoreInventory.quantity > 0)
        .group_by(StoreInventory.product_id)
    )
    if store_id:
        si_q = si_q.where(StoreInventory.store_id == store_id)
    si_map = {str(r.product_id): int(r.on_hand or 0) for r in (await db.execute(si_q)).all()}

    # Material valuation (MAP / standard)
    mv_q = select(
        MaterialValuation.product_id,
        MaterialValuation.valuation_method,
        MaterialValuation.moving_avg_price,
        MaterialValuation.standard_price,
        MaterialValuation.total_value,
        MaterialValuation.total_stock,
    ).where(MaterialValuation.vendor_id == vendor_id)
    mv_map: dict[str, dict] = {}
    for r in (await db.execute(mv_q)).all():
        pid = str(r.product_id)
        mv_map[pid] = {
            "method": r.valuation_method,
            "map": float(r.moving_avg_price or 0),
            "standard": float(r.standard_price or 0),
            "mv_total_value": float(r.total_value or 0),
            "mv_total_stock": float(r.total_stock or 0),
        }

    # FIFO remaining cost layers
    fifo_q = (
        select(
            StockCostLayer.product_id,
            func.sum(
                (StockCostLayer.received_qty - StockCostLayer.consumed_qty) * StockCostLayer.unit_cost
            ).label("fifo_value"),
            func.sum(StockCostLayer.received_qty - StockCostLayer.consumed_qty).label("fifo_qty"),
        )
        .where(
            StockCostLayer.vendor_id == vendor_id,
            StockCostLayer.is_exhausted.is_(False),
        )
        .group_by(StockCostLayer.product_id)
    )
    fifo_map: dict[str, dict] = {}
    for r in (await db.execute(fifo_q)).all():
        fifo_map[str(r.product_id)] = {
            "fifo_value": float(r.fifo_value or 0),
            "fifo_qty": float(r.fifo_qty or 0),
        }

    # Products
    prod_q = select(Product.id, Product.name, Product.sku, Product.category, Product.cost_price).where(
        Product.vendor_id == vendor_id, Product.track_inventory.is_(True)
    )
    if category:
        prod_q = prod_q.where(Product.category == category)

    prod_rows = (await db.execute(prod_q)).all()

    items = []
    for p in prod_rows:
        pid = str(p.id)
        on_hand = si_map.get(pid, 0)
        if on_hand == 0 and pid not in mv_map and pid not in fifo_map:
            continue
        cp = float(p.cost_price or 0)
        mv = mv_map.get(pid, {})
        fifo = fifo_map.get(pid, {})

        cost_price_value = round(on_hand * cp, 2)
        map_value = round(on_hand * mv.get("map", 0), 2) if mv else None
        standard_value = round(on_hand * mv.get("standard", 0), 2) if mv else None
        fifo_value = round(fifo.get("fifo_value", 0), 2) if fifo else None

        items.append({
            "product_id": pid,
            "product_name": p.name,
            "sku": p.sku,
            "category": p.category or "Uncategorised",
            "on_hand": on_hand,
            "cost_price": cp,
            "cost_price_value": cost_price_value,
            "map_price": mv.get("map") if mv else None,
            "map_value": map_value,
            "standard_price": mv.get("standard") if mv else None,
            "standard_value": standard_value,
            "fifo_value": fifo_value,
            "valuation_method": mv.get("method") if mv else None,
        })

    items.sort(key=lambda x: x["cost_price_value"], reverse=True)
    total = len(items)
    paged = items[offset: offset + limit]

    return {
        "items": paged,
        "total": total,
        "totals": {
            "cost_price_value": round(sum(i["cost_price_value"] for i in items), 2),
            "map_value": round(sum(i["map_value"] or 0 for i in items), 2),
            "standard_value": round(sum(i["standard_value"] or 0 for i in items), 2),
            "fifo_value": round(sum(i["fifo_value"] or 0 for i in items), 2),
        },
    }


# ── 9. In-Transit & Transfer Analytics ─────────────────────────────────────

async def get_in_transit(
    db: AsyncSession,
    vendor_id: UUID,
    date_from: Optional[date],
    date_to: Optional[date],
) -> dict:
    df, dt = _default_range(date_from, date_to)

    # Currently dispatched (in-transit) orders
    in_transit_q = (
        select(
            StockTransferOrder.id,
            StockTransferOrder.reference_number,
            StockTransferOrder.dispatched_at,
            StockTransferOrder.expected_date,
            StockTransferOrder.is_inter_state,
            StockTransferOrder.igst_amount,
            func.sum(StockTransferOrderLine.dispatched_qty * Product.cost_price).label("value"),
        )
        .join(StockTransferOrderLine, StockTransferOrderLine.order_id == StockTransferOrder.id)
        .join(Product, Product.id == StockTransferOrderLine.product_id)
        .where(
            StockTransferOrder.vendor_id == vendor_id,
            StockTransferOrder.status == "dispatched",
            Product.cost_price.isnot(None),
        )
        .group_by(StockTransferOrder.id)
    )
    in_transit_rows = (await db.execute(in_transit_q)).all()

    # Completed transfers in period — lead time
    completed_q = (
        select(
            StockTransferOrder.id,
            StockTransferOrder.reference_number,
            StockTransferOrder.dispatched_at,
            StockTransferOrder.received_at,
            StockTransferOrder.is_inter_state,
            StockTransferOrder.igst_amount,
            func.sum(StockTransferOrderLine.received_qty * Product.cost_price).label("value"),
            func.sum(StockTransferOrderLine.requested_qty).label("requested"),
            func.sum(StockTransferOrderLine.received_qty).label("received"),
        )
        .join(StockTransferOrderLine, StockTransferOrderLine.order_id == StockTransferOrder.id)
        .join(Product, Product.id == StockTransferOrderLine.product_id)
        .where(
            StockTransferOrder.vendor_id == vendor_id,
            StockTransferOrder.status == "received",
            StockTransferOrder.dispatched_at >= _to_dt(df),
            StockTransferOrder.dispatched_at < _to_dt(dt + timedelta(days=1)),
            Product.cost_price.isnot(None),
        )
        .group_by(StockTransferOrder.id)
    )
    completed_rows = (await db.execute(completed_q)).all()

    in_transit = [
        {
            "order_id": str(r.id),
            "reference": r.reference_number,
            "dispatched_at": r.dispatched_at.isoformat() if r.dispatched_at else None,
            "expected_date": r.expected_date.isoformat() if r.expected_date else None,
            "days_in_transit": (datetime.now(timezone.utc) - r.dispatched_at).days if r.dispatched_at else None,
            "value": round(float(r.value or 0), 2),
            "is_inter_state": r.is_inter_state,
            "igst_amount": float(r.igst_amount or 0),
        }
        for r in in_transit_rows
    ]

    completed = []
    lead_times = []
    for r in completed_rows:
        if r.dispatched_at and r.received_at:
            lt = (r.received_at - r.dispatched_at).days
        else:
            lt = None
        req = int(r.requested or 0)
        rec = int(r.received or 0)
        fill_rate = round(rec / req * 100, 1) if req else None
        completed.append({
            "order_id": str(r.id),
            "reference": r.reference_number,
            "dispatched_at": r.dispatched_at.isoformat() if r.dispatched_at else None,
            "received_at": r.received_at.isoformat() if r.received_at else None,
            "lead_time_days": lt,
            "fill_rate_pct": fill_rate,
            "value": round(float(r.value or 0), 2),
            "is_inter_state": r.is_inter_state,
            "igst_amount": float(r.igst_amount or 0),
        })
        if lt is not None:
            lead_times.append(lt)

    avg_lead_time = round(sum(lead_times) / len(lead_times), 1) if lead_times else None

    return {
        "in_transit": in_transit,
        "in_transit_count": len(in_transit),
        "in_transit_value": round(sum(i["value"] for i in in_transit), 2),
        "completed": completed,
        "avg_lead_time_days": avg_lead_time,
        "date_from": df.isoformat(),
        "date_to": dt.isoformat(),
    }


# ── 10. Available-to-Promise (ATP) ──────────────────────────────────────────

async def get_atp(
    db: AsyncSession,
    vendor_id: UUID,
    store_id: Optional[UUID],
    category: Optional[str],
    limit: int,
    offset: int,
) -> dict:
    si_q = (
        select(
            StoreInventory.product_id,
            StoreInventory.store_id,
            StoreInventory.quantity.label("on_hand"),
        )
        .where(StoreInventory.vendor_id == vendor_id)
    )
    if store_id:
        si_q = si_q.where(StoreInventory.store_id == store_id)
    si_rows = (await db.execute(si_q)).all()
    # Group on-hand by product
    on_hand_map: dict[str, int] = {}
    for r in si_rows:
        pid = str(r.product_id)
        on_hand_map[pid] = on_hand_map.get(pid, 0) + (r.on_hand or 0)

    # Active reservations per product
    resv_q = (
        select(
            StockReservation.product_id,
            func.sum(StockReservation.reserved_qty).label("reserved"),
        )
        .where(
            StockReservation.vendor_id == vendor_id,
            StockReservation.status == "active",
        )
        .group_by(StockReservation.product_id)
    )
    if store_id:
        resv_q = resv_q.where(StockReservation.store_id == store_id)
    resv_map = {str(r.product_id): float(r.reserved or 0) for r in (await db.execute(resv_q)).all()}

    # Products
    prod_q = select(
        Product.id, Product.name, Product.sku, Product.category, Product.cost_price, Product.reorder_point
    ).where(Product.vendor_id == vendor_id, Product.track_inventory.is_(True))
    if category:
        prod_q = prod_q.where(Product.category == category)
    prod_rows = (await db.execute(prod_q)).all()

    items = []
    for p in prod_rows:
        pid = str(p.id)
        on_hand = on_hand_map.get(pid, 0)
        reserved = resv_map.get(pid, 0.0)
        atp = on_hand - reserved
        items.append({
            "product_id": pid,
            "product_name": p.name,
            "sku": p.sku,
            "category": p.category or "Uncategorised",
            "on_hand": on_hand,
            "reserved": reserved,
            "atp": round(atp, 4),
            "reorder_point": p.reorder_point,
            "cost_price": float(p.cost_price or 0),
            "atp_value": round(max(atp, 0) * float(p.cost_price or 0), 2),
            "status": "available" if atp > 0 else ("fully_reserved" if atp == 0 else "overcommitted"),
        })

    items.sort(key=lambda x: x["atp"])
    summary = {
        s: {"count": sum(1 for i in items if i["status"] == s)}
        for s in ("available", "fully_reserved", "overcommitted")
    }
    total = len(items)
    paged = items[offset: offset + limit]

    return {
        "items": paged,
        "total": total,
        "summary": summary,
        "total_atp_value": round(sum(max(i["atp"], 0) * i["cost_price"] for i in items), 2),
    }
