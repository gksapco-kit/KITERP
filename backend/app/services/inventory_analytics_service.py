"""
Inventory Analytics Service
All heavy SQL aggregations for the Inventory Analytics module.
Kept separate from the router so logic can be tested and reused independently.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import and_, case, cast, func, literal_column, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.types import Date as DateType

from app.models.inventory import InventoryMovement
from app.models.inventory_count import StockCount, StockCountLine
from app.models.mrp import StockReservation
from app.models.procurement_goods import GoodsBatch
from app.models.procurement_special import MaterialValuation
from app.models.plant import Plant
from app.models.storage_location import StorageLocation
from app.models.stock_cost_layer import StockCostLayer
from app.models.stock_transfer_order import StockTransferOrder, StockTransferOrderLine
from app.models.store import Store, StoreInventory
from app.models.vendor_product import Product


# ── Classification helpers ──────────────────────────────────────────────────

# Movement types that move stock in or out of the business. The *direction* of
# every flow is taken from the sign of ``InventoryMovement.quantity`` (so a
# purchase_return, which is negative, counts as outbound), the type list only
# decides which rows are "real" flows rather than adjustments or internal moves.
INBOUND_TYPES = (
    "purchase", "stock_in", "sale_return", "initial",
    "production_receipt", "production_consumption_reversal",
)
OUTBOUND_TYPES = (
    "sale", "stock_out", "write_off", "purchase_return",
    "production_consumption", "production_receipt_reversal",
)
FLOW_TYPES = INBOUND_TYPES + OUTBOUND_TYPES
ADJUSTMENT_TYPES = ("adjustment", "stock_count")
SHRINKAGE_TYPES = ("write_off", "adjustment", "stock_count")
# Consumption that counts as cost-of-goods for turnover / DSI.
COGS_TYPES = ("sale", "stock_out", "write_off", "production_consumption")

# Business timezone: report day boundaries follow IST, not UTC.
_REPORT_TZ_NAME = "Asia/Kolkata"
_REPORT_TZ = timezone(timedelta(hours=5, minutes=30))

# Stock edited on the product form (opening stock, "Product stock updated") is
# recorded as a manual adjustment with no business unit. It is a genuine
# stock-in / stock-out, not shrinkage, so it is treated as a flow.
_PRODUCT_EDIT = and_(
    InventoryMovement.movement_type == "adjustment",
    InventoryMovement.reference_type == "manual",
    InventoryMovement.store_id.is_(None),
)


def _flow_filter(store_id: Optional[UUID] = None):
    """SQL condition: movement is a stock flow (in or out of the business).

    Store-to-store transfers net to zero company-wide, so they are only treated
    as flows when a single business unit is selected.
    """
    types = list(FLOW_TYPES)
    if store_id:
        types.append("transfer")
    return or_(InventoryMovement.movement_type.in_(types), _PRODUCT_EDIT)


def _adjustment_filter():
    """SQL condition: a true stock adjustment / count correction."""
    return and_(
        InventoryMovement.movement_type.in_(list(ADJUSTMENT_TYPES)),
        ~_PRODUCT_EDIT,
    )


def _scope_batches_to_store(q, store_id: UUID):
    """Restrict a GoodsBatch query to one business unit.

    Batches have no store_id of their own; the unit comes from the batch's storage
    location, or from its plant when no location is set. Batches with neither are
    excluded when a unit is selected (their unit is unknown).
    """
    return (
        q.outerjoin(StorageLocation, StorageLocation.id == GoodsBatch.storage_location_id)
        .outerjoin(Plant, Plant.id == GoodsBatch.plant_id)
        .where(
            or_(
                StorageLocation.store_id == store_id,
                and_(StorageLocation.id.is_(None), Plant.store_id == store_id),
            )
        )
    )


async def _value_change_since(
    db: AsyncSession,
    vendor_id: UUID,
    store_id: Optional[UUID],
    since: datetime,
    by_category: bool = False,
):
    """Net stock value (qty x cost) moved by every movement at or after ``since``.

    Subtracting this from today's stock value gives the stock value at ``since``.
    Returns a float, or a {category: float} dict when ``by_category`` is set.
    """
    cols = [func.sum(InventoryMovement.quantity * Product.cost_price).label("chg")]
    if by_category:
        cols.insert(0, Product.category.label("grp"))
    q = (
        select(*cols)
        .select_from(InventoryMovement)
        .join(Product, Product.id == InventoryMovement.product_id)
        .where(
            InventoryMovement.vendor_id == vendor_id,
            InventoryMovement.created_at >= since,
            Product.track_inventory.is_(True),
            Product.cost_price.isnot(None),
        )
    )
    if store_id:
        q = q.where(InventoryMovement.store_id == store_id)
    if by_category:
        q = q.group_by(Product.category)
        return {r.grp: float(r.chg or 0) for r in (await db.execute(q)).all()}
    return float((await db.execute(q)).scalar() or 0)


async def _cogs_value(
    db: AsyncSession, vendor_id: UUID, store_id: Optional[UUID], df: date, dt: date,
    types: tuple = COGS_TYPES,
) -> float:
    """Cost of goods consumed (sales, stock-outs, write-offs, production use) in the period."""
    q = (
        select(func.sum(func.abs(InventoryMovement.quantity) * Product.cost_price))
        .select_from(InventoryMovement)
        .join(Product, Product.id == InventoryMovement.product_id)
        .where(
            InventoryMovement.vendor_id == vendor_id,
            InventoryMovement.movement_type.in_(types),
            InventoryMovement.created_at >= _to_dt(df),
            InventoryMovement.created_at < _to_dt(dt + timedelta(days=1)),
            Product.cost_price.isnot(None),
        )
    )
    if store_id:
        q = q.where(InventoryMovement.store_id == store_id)
    return float((await db.execute(q)).scalar() or 0)


def _average_stock(current: float, change_since_start: float, change_since_end: float) -> float:
    """Average of opening and closing stock value for the period.

    Falls back to the current value when the movement history can't reconstruct a
    sensible opening/closing figure (e.g. stock that predates movement tracking).
    """
    opening = current - change_since_start
    closing = current - change_since_end
    if opening > 0 and closing > 0:
        return (opening + closing) / 2
    return current


def _default_range(date_from: Optional[date], date_to: Optional[date]) -> tuple[date, date]:
    today = datetime.now(_REPORT_TZ).date()
    return (
        date_from or (today - timedelta(days=29)),
        date_to or today,
    )


def _to_dt(d: date) -> datetime:
    return datetime(d.year, d.month, d.day, tzinfo=_REPORT_TZ)


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
                _flow_filter(store_id),
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
        q = (
            select(
                func.sum(
                    (StoreInventory.quantity - Product.reorder_point - Product.reorder_quantity)
                    * Product.cost_price
                ).label("excess")
            )
            .select_from(StoreInventory)
            .join(Product, Product.id == StoreInventory.product_id)
            .where(
            StoreInventory.vendor_id == vendor_id,
            Product.track_inventory.is_(True),
            Product.reorder_point.isnot(None),
            Product.reorder_quantity.isnot(None),
            Product.cost_price.isnot(None),
            StoreInventory.quantity > Product.reorder_point + Product.reorder_quantity,
            )
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
        if store_id:
            q = _scope_batches_to_store(q, store_id)
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
        # Same window as the Count Accuracy tab so the KPI and the tab agree.
        q = q.where(
            StockCount.posted_at >= _to_dt(df),
            StockCount.posted_at < _to_dt(dt + timedelta(days=1)),
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
    avg_val = _average_stock(
        total_val,
        await _value_change_since(db, vendor_id, store_id, _to_dt(df)),
        await _value_change_since(db, vendor_id, store_id, _to_dt(dt + timedelta(days=1))),
    )
    cogs = await _cogs_value(db, vendor_id, store_id, df, dt)
    # No consumption in the period -> turnover is "not meaningful" (None), not 0x.
    turnover = round(cogs / avg_val, 2) if avg_val and cogs else None
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

    out_types = ("sale",) if basis == "sales" else COGS_TYPES

    q = (
        select(
            Product.category.label("grp"),
            func.sum(
                func.abs(InventoryMovement.quantity) * Product.cost_price
            ).label("cogs"),
        )
        .select_from(InventoryMovement)
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

    # Average of opening and closing stock per category (falls back to current stock).
    chg_start = await _value_change_since(db, vendor_id, store_id, _to_dt(df), by_category=True)
    chg_end = await _value_change_since(db, vendor_id, store_id, _to_dt(dt + timedelta(days=1)), by_category=True)

    items = []
    total_cogs = 0.0
    for r in rows:
        cogs = float(r.cogs or 0)
        on_hand = val_rows.get(r.grp, 0)
        avg_stock = _average_stock(on_hand, chg_start.get(r.grp, 0.0), chg_end.get(r.grp, 0.0))
        turnover = round(cogs / avg_stock, 2) if avg_stock and cogs else None
        dsi = round(days / turnover, 1) if turnover else None
        items.append({
            "group": r.grp or "Uncategorised",
            "cogs": round(cogs, 2),
            "inventory_value": round(on_hand, 2),
            "average_inventory_value": round(avg_stock, 2),
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

    # Always aggregate per IST calendar day in SQL (not UTC, so late-night movements land on
    # the right day); week / month buckets are rolled up from the daily rows in Python.
    if db.bind is not None and db.bind.dialect.name == "sqlite":
        day_expr = func.date(InventoryMovement.created_at, "+330 minutes")
    else:
        day_expr = cast(func.timezone(_REPORT_TZ_NAME, InventoryMovement.created_at), DateType)
    trunc = day_expr.label("period")

    flow = _flow_filter(store_id)
    adj = _adjustment_filter()
    qty = InventoryMovement.quantity
    # Products without a cost price still moved stock: they count as movements and
    # quantities, but contribute zero value (reported separately as "uncosted").
    cost = func.coalesce(Product.cost_price, 0)

    q = (
        select(
            trunc,
            func.sum(case((and_(flow, qty > 0), qty * cost), else_=0)).label("inbound_value"),
            func.sum(case((and_(flow, qty < 0), func.abs(qty) * cost), else_=0)).label("outbound_value"),
            func.sum(case((adj, func.abs(qty) * cost), else_=0)).label("adjustment_value"),
            func.sum(case((and_(flow, qty > 0), qty), else_=0)).label("inbound_qty"),
            func.sum(case((and_(flow, qty < 0), func.abs(qty)), else_=0)).label("outbound_qty"),
            func.sum(case((adj, func.abs(qty)), else_=0)).label("adjustment_qty"),
            func.sum(case((Product.cost_price.is_(None), 1), else_=0)).label("uncosted"),
            func.count(InventoryMovement.id).label("movements"),
        )
        .join(Product, Product.id == InventoryMovement.product_id)
        .where(
            InventoryMovement.vendor_id == vendor_id,
            or_(flow, adj),
            InventoryMovement.created_at >= _to_dt(df),
            InventoryMovement.created_at < _to_dt(dt + timedelta(days=1)),
        )
        .group_by(day_expr)
        .order_by(day_expr)
    )
    if store_id:
        q = q.where(InventoryMovement.store_id == store_id)

    rows = (await db.execute(q)).all()

    def _bucket_start(d: date) -> date:
        if bucket == "week":
            return d - timedelta(days=d.weekday())  # Monday, same as date_trunc('week')
        if bucket == "month":
            return d.replace(day=1)
        return d

    def _blank() -> dict:
        return {
            "inbound_value": 0.0, "outbound_value": 0.0, "adjustment_value": 0.0,
            "inbound_qty": 0.0, "outbound_qty": 0.0, "adjustment_qty": 0.0,
            "movements": 0,
        }

    def _next_bucket(d: date) -> date:
        if bucket == "week":
            return d + timedelta(days=7)
        if bucket == "month":
            return date(d.year + 1, 1, 1) if d.month == 12 else date(d.year, d.month + 1, 1)
        return d + timedelta(days=1)

    # Pre-fill every bucket in the range so quiet periods show as zero, not as gaps.
    rolled: dict[date, dict] = {}
    cursor, last = _bucket_start(df), _bucket_start(dt)
    while cursor <= last:
        rolled[cursor] = _blank()
        cursor = _next_bucket(cursor)

    uncosted = 0
    for r in rows:
        day = r.period if isinstance(r.period, date) else date.fromisoformat(str(r.period)[:10])
        agg = rolled.setdefault(_bucket_start(day), _blank())
        for field in ("inbound_value", "outbound_value", "adjustment_value",
                      "inbound_qty", "outbound_qty", "adjustment_qty"):
            agg[field] += float(getattr(r, field) or 0)
        agg["movements"] += int(r.movements)
        uncosted += int(r.uncosted or 0)

    series = [
        {
            "date": k.isoformat(),
            "inbound_value": round(v["inbound_value"], 2),
            "outbound_value": round(v["outbound_value"], 2),
            "adjustment_value": round(v["adjustment_value"], 2),
            "inbound_qty": round(v["inbound_qty"], 3),
            "outbound_qty": round(v["outbound_qty"], 3),
            "adjustment_qty": round(v["adjustment_qty"], 3),
            "movements": v["movements"],
        }
        for k, v in sorted(rolled.items())
    ]

    totals = {
        "movements": sum(p["movements"] for p in series),
        "uncosted_movements": uncosted,
    }
    for field in ("inbound_value", "outbound_value", "adjustment_value",
                  "inbound_qty", "outbound_qty", "adjustment_qty"):
        totals[field] = round(sum(p[field] for p in series), 3 if field.endswith("qty") else 2)

    return {
        "series": series,
        "totals": totals,
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
        # The product's reorder policy wins; the bin-level threshold (which defaults to 5
        # in the DB) is only a fallback for products with no reorder point.
        threshold = rp if rp > 0 else (r.low_stock_threshold or 0)
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
            "store_id": str(r.store_id) if r.store_id else None,
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
    if store_id:
        q = _scope_batches_to_store(q, store_id)
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
            # Only stock *lost*: gains (count surpluses, positive adjustments) are not shrinkage,
            # and product-form stock edits are plain stock changes, not write-offs.
            InventoryMovement.quantity < 0,
            ~_PRODUCT_EDIT,
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
    store_id: Optional[UUID] = None,
) -> dict:
    df, dt = _default_range(date_from, date_to)

    # A transfer belongs to a business unit if it is the source or the destination.
    store_scope = (
        or_(
            StockTransferOrder.from_store_id == store_id,
            StockTransferOrder.to_store_id == store_id,
        )
        if store_id else None
    )

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
    if store_scope is not None:
        in_transit_q = in_transit_q.where(store_scope)
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
    if store_scope is not None:
        completed_q = completed_q.where(store_scope)
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

def _atp_status(on_hand: float, reserved: float, atp: float) -> str:
    """Nothing on hand and nothing reserved is 'out_of_stock', not 'fully_reserved'."""
    if on_hand <= 0 and reserved <= 0:
        return "out_of_stock"
    if atp > 0:
        return "available"
    if atp == 0:
        return "fully_reserved"
    return "overcommitted"


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
            "status": _atp_status(on_hand, reserved, atp),
        })

    items.sort(key=lambda x: x["atp"])
    summary = {
        s: {"count": sum(1 for i in items if i["status"] == s)}
        for s in ("available", "fully_reserved", "overcommitted", "out_of_stock")
    }
    total = len(items)
    paged = items[offset: offset + limit]

    return {
        "items": paged,
        "total": total,
        "summary": summary,
        "total_atp_value": round(sum(max(i["atp"], 0) * i["cost_price"] for i in items), 2),
    }
