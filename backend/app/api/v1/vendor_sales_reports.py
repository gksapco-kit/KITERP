"""
Sales Manager analytics — date-range-aware reporting for the Sales module.

Every endpoint accepts:
  - date_from / date_to (ISO date, inclusive). Defaults to the last 30 days.
  - store_id (optional business-unit scope; omit for all units).

The primary endpoint is GET /overview which returns one rich payload that powers
the entire Sales Manager dashboard (KPIs + previous-period deltas + every chart
series + drill-down rows), so the screen renders all summary cards from a single
request while detail modals reuse the same data.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func as sqlfunc, and_, cast, Date, text, extract
from uuid import UUID
from datetime import date, datetime, timedelta

from app.database import get_db
from app.api.deps import get_current_active_user
from app.models.user import User
from app.models.order import Order
from app.models.customer import Customer
from app.models.store import Store
from app.services.vendor_service import VendorService

router = APIRouter()

# Statuses that count as realised sales (everything except cancelled/refunded/returned).
CANCELLED_STATUSES = ("cancelled", "refunded", "returned")


async def _vendor_id(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> UUID:
    svc = VendorService(db)
    vendor = await svc.get_by_user_id(current_user.id)
    if not vendor:
        raise HTTPException(404, "No vendor found")
    return vendor.id


def _store_uuid(store_id: str | None) -> UUID | None:
    if not store_id:
        return None
    try:
        return UUID(store_id)
    except ValueError:
        raise HTTPException(400, "Invalid store_id")


def _parse_range(date_from: str | None, date_to: str | None) -> tuple[date, date]:
    today = date.today()
    try:
        df = date.fromisoformat(date_from) if date_from else (today - timedelta(days=29))
        dt = date.fromisoformat(date_to) if date_to else today
    except ValueError:
        raise HTTPException(400, "Invalid date_from / date_to (use YYYY-MM-DD)")
    if df > dt:
        df, dt = dt, df
    return df, dt


def _pct(curr: float, prev: float) -> float | None:
    if prev == 0:
        return None if curr == 0 else 100.0
    return round((curr - prev) / prev * 100.0, 1)


def _kpi(curr: float, prev: float) -> dict:
    return {"value": round(float(curr), 2), "prev": round(float(prev), 2), "delta_pct": _pct(float(curr), float(prev))}


@router.get("/overview")
async def sales_overview(
    date_from: str | None = Query(None, description="ISO date (inclusive). Default: 30 days ago"),
    date_to: str | None = Query(None, description="ISO date (inclusive). Default: today"),
    store_id: str | None = Query(None, description="Scope to a business unit; omit for all units"),
    vid: UUID = Depends(_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    df, dt = _parse_range(date_from, date_to)
    sid = _store_uuid(store_id)
    days = (dt - df).days + 1
    prev_to = df - timedelta(days=1)
    prev_from = prev_to - timedelta(days=days - 1)

    def order_where(start: date, end: date, *extra):
        conds = [
            Order.vendor_id == vid,
            cast(Order.created_at, Date) >= start,
            cast(Order.created_at, Date) <= end,
            *extra,
        ]
        if sid is not None:
            conds.append(Order.store_id == sid)
        return and_(*conds)

    not_cancelled = Order.status.notin_(CANCELLED_STATUSES)

    async def _scalar(stmt):
        return (await db.execute(stmt)).scalar_one()

    # ── Period KPI aggregates (current vs previous) ───────────────────────────
    async def _agg(start: date, end: date):
        row = (await db.execute(
            select(
                sqlfunc.count(Order.id).label("orders"),
                sqlfunc.coalesce(sqlfunc.sum(Order.total), 0).label("revenue"),
                sqlfunc.coalesce(sqlfunc.sum(Order.subtotal), 0).label("subtotal"),
                sqlfunc.coalesce(sqlfunc.sum(Order.tax_amount), 0).label("tax"),
                sqlfunc.coalesce(sqlfunc.sum(Order.discount_amount), 0).label("discount"),
                sqlfunc.coalesce(sqlfunc.sum(Order.shipping_amount), 0).label("shipping"),
                sqlfunc.coalesce(sqlfunc.sum(Order.item_count), 0).label("units"),
                sqlfunc.count(sqlfunc.distinct(Order.customer_id)).label("customers"),
            ).where(order_where(start, end, not_cancelled))
        )).one()
        refunds = await _scalar(
            select(sqlfunc.coalesce(sqlfunc.sum(Order.refund_amount), 0)).where(order_where(start, end))
        )
        return {
            "orders": int(row.orders or 0),
            "revenue": float(row.revenue or 0),
            "subtotal": float(row.subtotal or 0),
            "tax": float(row.tax or 0),
            "discount": float(row.discount or 0),
            "shipping": float(row.shipping or 0),
            "units": int(row.units or 0),
            "customers": int(row.customers or 0),
            "refunds": float(refunds or 0),
        }

    cur = await _agg(df, dt)
    prev = await _agg(prev_from, prev_to)

    cur_aov = cur["revenue"] / cur["orders"] if cur["orders"] else 0
    prev_aov = prev["revenue"] / prev["orders"] if prev["orders"] else 0

    # New customers: those whose first-ever order falls inside the window.
    first_order_subq = (
        select(
            Order.customer_id.label("cid"),
            sqlfunc.min(cast(Order.created_at, Date)).label("first_day"),
        )
        .where(Order.vendor_id == vid)
        .group_by(Order.customer_id)
        .subquery()
    )
    new_customers = await _scalar(
        select(sqlfunc.count())
        .select_from(first_order_subq)
        .where(and_(first_order_subq.c.first_day >= df, first_order_subq.c.first_day <= dt))
    )
    prev_new_customers = await _scalar(
        select(sqlfunc.count())
        .select_from(first_order_subq)
        .where(and_(first_order_subq.c.first_day >= prev_from, first_order_subq.c.first_day <= prev_to))
    )

    kpis = {
        "revenue": _kpi(cur["revenue"], prev["revenue"]),
        "orders": _kpi(cur["orders"], prev["orders"]),
        "units": _kpi(cur["units"], prev["units"]),
        "avg_order_value": _kpi(cur_aov, prev_aov),
        "customers": _kpi(cur["customers"], prev["customers"]),
        "new_customers": _kpi(new_customers or 0, prev_new_customers or 0),
        "discount": _kpi(cur["discount"], prev["discount"]),
        "tax": _kpi(cur["tax"], prev["tax"]),
        "shipping": _kpi(cur["shipping"], prev["shipping"]),
        "refunds": _kpi(cur["refunds"], prev["refunds"]),
        "net_sales": _kpi(cur["revenue"] - cur["refunds"], prev["revenue"] - prev["refunds"]),
        "gross_sales": _kpi(cur["subtotal"], prev["subtotal"]),
    }

    # ── Trend over time (daily) ───────────────────────────────────────────────
    trend_rows = (await db.execute(
        select(
            cast(Order.created_at, Date).label("day"),
            sqlfunc.count(Order.id).label("orders"),
            sqlfunc.coalesce(sqlfunc.sum(Order.total), 0).label("revenue"),
            sqlfunc.coalesce(sqlfunc.sum(Order.item_count), 0).label("units"),
        )
        .where(order_where(df, dt, not_cancelled))
        .group_by(cast(Order.created_at, Date))
        .order_by(cast(Order.created_at, Date))
    )).all()
    by_day = {str(r.day): r for r in trend_rows}
    trend = []
    cursor = df
    while cursor <= dt:
        key = str(cursor)
        r = by_day.get(key)
        trend.append({
            "date": key,
            "orders": int(r.orders) if r else 0,
            "revenue": float(r.revenue) if r else 0.0,
            "units": int(r.units) if r else 0,
        })
        cursor += timedelta(days=1)

    # ── Orders by status (all orders incl. cancelled) ─────────────────────────
    status_rows = (await db.execute(
        select(
            Order.status,
            sqlfunc.count(Order.id).label("orders"),
            sqlfunc.coalesce(sqlfunc.sum(Order.total), 0).label("revenue"),
        )
        .where(order_where(df, dt))
        .group_by(Order.status)
        .order_by(sqlfunc.count(Order.id).desc())
    )).all()
    by_status = [{"status": r.status or "unknown", "orders": int(r.orders), "revenue": float(r.revenue)} for r in status_rows]

    # ── By source / channel ───────────────────────────────────────────────────
    source_rows = (await db.execute(
        select(
            Order.source,
            sqlfunc.count(Order.id).label("orders"),
            sqlfunc.coalesce(sqlfunc.sum(Order.total), 0).label("revenue"),
        )
        .where(order_where(df, dt, not_cancelled))
        .group_by(Order.source)
        .order_by(sqlfunc.coalesce(sqlfunc.sum(Order.total), 0).desc())
    )).all()
    by_source = [{"source": r.source or "online", "orders": int(r.orders), "revenue": float(r.revenue)} for r in source_rows]

    # ── By payment method ─────────────────────────────────────────────────────
    pay_rows = (await db.execute(
        select(
            Order.payment_method,
            sqlfunc.count(Order.id).label("orders"),
            sqlfunc.coalesce(sqlfunc.sum(Order.total), 0).label("revenue"),
        )
        .where(order_where(df, dt, not_cancelled))
        .group_by(Order.payment_method)
        .order_by(sqlfunc.coalesce(sqlfunc.sum(Order.total), 0).desc())
    )).all()
    by_payment_method = [
        {"method": r.payment_method or "unspecified", "orders": int(r.orders), "revenue": float(r.revenue)}
        for r in pay_rows
    ]

    # ── By business unit ──────────────────────────────────────────────────────
    store_rows = (await db.execute(
        select(
            Order.store_id,
            Store.name,
            sqlfunc.count(Order.id).label("orders"),
            sqlfunc.coalesce(sqlfunc.sum(Order.total), 0).label("revenue"),
        )
        .outerjoin(Store, Store.id == Order.store_id)
        .where(order_where(df, dt, not_cancelled))
        .group_by(Order.store_id, Store.name)
        .order_by(sqlfunc.coalesce(sqlfunc.sum(Order.total), 0).desc())
    )).all()
    by_store = [
        {
            "store_id": str(r.store_id) if r.store_id else None,
            "store_name": r.name or "Unassigned",
            "orders": int(r.orders),
            "revenue": float(r.revenue),
        }
        for r in store_rows
    ]

    # ── Payment status breakdown ──────────────────────────────────────────────
    paystatus_rows = (await db.execute(
        select(
            Order.payment_status,
            sqlfunc.count(Order.id).label("orders"),
            sqlfunc.coalesce(sqlfunc.sum(Order.total), 0).label("revenue"),
        )
        .where(order_where(df, dt))
        .group_by(Order.payment_status)
    )).all()
    by_payment_status = [
        {"status": r.payment_status or "pending", "orders": int(r.orders), "revenue": float(r.revenue)}
        for r in paystatus_rows
    ]

    # ── Top customers (by spend in the window) ────────────────────────────────
    cust_rows = (await db.execute(
        select(
            Customer.id,
            Customer.full_name,
            Customer.email,
            sqlfunc.count(Order.id).label("orders"),
            sqlfunc.coalesce(sqlfunc.sum(Order.total), 0).label("spent"),
        )
        .join(Order, Order.customer_id == Customer.id)
        .where(order_where(df, dt, not_cancelled))
        .group_by(Customer.id, Customer.full_name, Customer.email)
        .order_by(sqlfunc.coalesce(sqlfunc.sum(Order.total), 0).desc())
        .limit(50)
    )).all()
    top_customers = [
        {
            "customer_id": str(r.id),
            "name": r.full_name or "—",
            "email": r.email,
            "orders": int(r.orders),
            "spent": float(r.spent),
        }
        for r in cust_rows
    ]

    # ── Hour-of-day & day-of-week heat data ───────────────────────────────────
    hour_rows = (await db.execute(
        select(
            extract("hour", Order.created_at).label("hour"),
            sqlfunc.count(Order.id).label("orders"),
            sqlfunc.coalesce(sqlfunc.sum(Order.total), 0).label("revenue"),
        )
        .where(order_where(df, dt, not_cancelled))
        .group_by(extract("hour", Order.created_at))
        .order_by(extract("hour", Order.created_at))
    )).all()
    hour_map = {int(r.hour): r for r in hour_rows}
    hourly = [
        {
            "hour": h,
            "orders": int(hour_map[h].orders) if h in hour_map else 0,
            "revenue": float(hour_map[h].revenue) if h in hour_map else 0.0,
        }
        for h in range(24)
    ]

    dow_rows = (await db.execute(
        select(
            extract("dow", Order.created_at).label("dow"),
            sqlfunc.count(Order.id).label("orders"),
            sqlfunc.coalesce(sqlfunc.sum(Order.total), 0).label("revenue"),
        )
        .where(order_where(df, dt, not_cancelled))
        .group_by(extract("dow", Order.created_at))
        .order_by(extract("dow", Order.created_at))
    )).all()
    dow_names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    dow_map = {int(r.dow): r for r in dow_rows}
    by_dow = [
        {
            "dow": i,
            "label": dow_names[i],
            "orders": int(dow_map[i].orders) if i in dow_map else 0,
            "revenue": float(dow_map[i].revenue) if i in dow_map else 0.0,
        }
        for i in range(7)
    ]

    # ── Coupons / discounts ───────────────────────────────────────────────────
    coupon_rows = (await db.execute(
        select(
            Order.coupon_code,
            sqlfunc.count(Order.id).label("orders"),
            sqlfunc.coalesce(sqlfunc.sum(Order.discount_amount), 0).label("discount"),
        )
        .where(order_where(df, dt, not_cancelled, Order.coupon_code.isnot(None)))
        .group_by(Order.coupon_code)
        .order_by(sqlfunc.coalesce(sqlfunc.sum(Order.discount_amount), 0).desc())
        .limit(50)
    )).all()
    coupons = [
        {"coupon": r.coupon_code, "orders": int(r.orders), "discount": float(r.discount)}
        for r in coupon_rows
    ]
    orders_with_discount = await _scalar(
        select(sqlfunc.count(Order.id)).where(order_where(df, dt, not_cancelled, Order.discount_amount > 0))
    )

    # ── Fulfillment timing ────────────────────────────────────────────────────
    ship_secs = sqlfunc.avg(
        extract("epoch", Order.shipped_at) - extract("epoch", Order.created_at)
    )
    deliver_secs = sqlfunc.avg(
        extract("epoch", Order.delivered_at) - extract("epoch", Order.created_at)
    )
    avg_ship = await _scalar(
        select(sqlfunc.coalesce(ship_secs, 0)).where(order_where(df, dt, Order.shipped_at.isnot(None)))
    )
    avg_deliver = await _scalar(
        select(sqlfunc.coalesce(deliver_secs, 0)).where(order_where(df, dt, Order.delivered_at.isnot(None)))
    )
    delivered_cnt = await _scalar(
        select(sqlfunc.count(Order.id)).where(order_where(df, dt, Order.status == "delivered"))
    )
    cancelled_cnt = await _scalar(
        select(sqlfunc.count(Order.id)).where(order_where(df, dt, Order.status == "cancelled"))
    )
    returned_cnt = await _scalar(
        select(sqlfunc.count(Order.id)).where(order_where(df, dt, Order.return_status.isnot(None)))
    )
    fulfillment = {
        "avg_ship_hours": round(float(avg_ship or 0) / 3600, 1),
        "avg_delivery_hours": round(float(avg_deliver or 0) / 3600, 1),
        "delivered_orders": int(delivered_cnt or 0),
        "cancelled_orders": int(cancelled_cnt or 0),
        "returned_orders": int(returned_cnt or 0),
        "total_orders": cur["orders"],
        "cancellation_rate": round((cancelled_cnt or 0) / cur["orders"] * 100, 1) if cur["orders"] else 0.0,
    }

    # ── Item-level: top products + by category (JSONB unnest) ─────────────────
    top_products: list[dict] = []
    by_category: list[dict] = []
    try:
        store_clause = "AND o.store_id = :sid" if sid is not None else ""
        params = {"vid": str(vid), "df": df, "dt": dt}
        if sid is not None:
            params["sid"] = str(sid)
        cancelled_list = "', '".join(CANCELLED_STATUSES)

        prod_sql = text(f"""
            SELECT
                i->>'product_id' AS product_id,
                MAX(i->>'name') AS name,
                COALESCE(SUM(NULLIF(i->>'qty','')::numeric), 0) AS qty,
                COALESCE(SUM(NULLIF(i->>'qty','')::numeric * NULLIF(i->>'price','')::numeric), 0) AS revenue
            FROM "order" o, jsonb_array_elements(COALESCE(o.items, '[]'::jsonb)) i
            WHERE o.vendor_id = :vid
              AND o.created_at::date >= :df
              AND o.created_at::date <= :dt
              AND o.status NOT IN ('{cancelled_list}')
              {store_clause}
            GROUP BY i->>'product_id'
            ORDER BY revenue DESC
            LIMIT 50
        """)
        prod_res = (await db.execute(prod_sql, params)).all()
        top_products = [
            {
                "product_id": r.product_id,
                "name": r.name or "—",
                "qty": float(r.qty or 0),
                "revenue": float(r.revenue or 0),
            }
            for r in prod_res
        ]

        cat_sql = text(f"""
            SELECT
                COALESCE(p.category, 'Uncategorised') AS category,
                COALESCE(SUM(NULLIF(i->>'qty','')::numeric), 0) AS qty,
                COALESCE(SUM(NULLIF(i->>'qty','')::numeric * NULLIF(i->>'price','')::numeric), 0) AS revenue
            FROM "order" o,
                 jsonb_array_elements(COALESCE(o.items, '[]'::jsonb)) i
                 LEFT JOIN product p
                   ON i->>'product_id' ~ '^[0-9a-fA-F-]{{36}}$'
                  AND p.id = (i->>'product_id')::uuid
            WHERE o.vendor_id = :vid
              AND o.created_at::date >= :df
              AND o.created_at::date <= :dt
              AND o.status NOT IN ('{cancelled_list}')
              {store_clause}
            GROUP BY COALESCE(p.category, 'Uncategorised')
            ORDER BY revenue DESC
            LIMIT 50
        """)
        cat_res = (await db.execute(cat_sql, params)).all()
        by_category = [
            {"category": r.category, "qty": float(r.qty or 0), "revenue": float(r.revenue or 0)}
            for r in cat_res
        ]
    except Exception:
        # JSONB shape can vary on legacy rows — degrade gracefully.
        top_products = top_products or []
        by_category = by_category or []

    return JSONResponse(content={
        "range": {
            "from": str(df),
            "to": str(dt),
            "days": days,
            "prev_from": str(prev_from),
            "prev_to": str(prev_to),
        },
        "generated_at": datetime.utcnow().isoformat(),
        "kpis": kpis,
        "trend": trend,
        "by_status": by_status,
        "by_source": by_source,
        "by_payment_method": by_payment_method,
        "by_payment_status": by_payment_status,
        "by_store": by_store,
        "top_customers": top_customers,
        "top_products": top_products,
        "by_category": by_category,
        "hourly": hourly,
        "by_dow": by_dow,
        "coupons": coupons,
        "discounts": {
            "orders_with_discount": int(orders_with_discount or 0),
            "total_discount": cur["discount"],
        },
        "fulfillment": fulfillment,
    })
