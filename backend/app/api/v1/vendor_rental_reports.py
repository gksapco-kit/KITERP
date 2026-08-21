"""
Rental Reporting Manager — date-range-aware analytics for the Rentals module.

Every endpoint accepts:
  - date_from / date_to (ISO date, inclusive). Defaults to the last 30 days.
  - store_id (optional — not yet implemented; reserved for future per-store scoping).
  - category (optional — asset category filter, e.g. 'furniture', 'vehicles').
  - basis (booking | rental_period). Default: booking.
      booking:       revenue / count attributed to created_at (when the booking was placed).
      rental_period: revenue / count attributed to start_date (when the asset goes out).

The primary endpoint is GET /overview which returns one rich payload powering
the entire Rental Reporting Manager dashboard.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func as sqlfunc, and_, cast, Date, extract
from uuid import UUID
from datetime import date, datetime, timedelta

from app.database import get_db
from app.api.deps import get_current_active_user, require_permission
from app.models.user import User
from app.models.rental import RentalBooking, RentalAsset, RentalReturn
from app.services.vendor_service import VendorService

router = APIRouter(dependencies=[Depends(require_permission("reports.view"))])

CANCELLED_STATUSES = ("cancelled", "rejected")
ACTIVE_STATUSES = ("approved", "confirmed", "active")
REVENUE_STATUSES = ("approved", "confirmed", "active", "completed")

DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]


async def _vendor_id(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> UUID:
    svc = VendorService(db)
    vendor = await svc.get_by_user_id(current_user.id)
    if not vendor:
        raise HTTPException(404, "No vendor found")
    return vendor.id


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
    return {
        "value": round(float(curr), 2),
        "prev": round(float(prev), 2),
        "delta_pct": _pct(float(curr), float(prev)),
    }


@router.get("/overview")
async def rental_overview(
    date_from: str | None = Query(None, description="ISO date (inclusive). Default: 30 days ago"),
    date_to: str | None = Query(None, description="ISO date (inclusive). Default: today"),
    category: str | None = Query(None, description="Filter by asset category (e.g. 'furniture')"),
    basis: str = Query(
        "booking",
        description="booking = attribute to created_at; rental_period = attribute to start_date",
    ),
    vid: UUID = Depends(_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    df, dt = _parse_range(date_from, date_to)
    days = (dt - df).days + 1
    prev_to = df - timedelta(days=1)
    prev_from = prev_to - timedelta(days=days - 1)

    # Date column used for attributing bookings to periods
    date_col = (
        cast(RentalBooking.created_at, Date)
        if basis != "rental_period"
        else RentalBooking.start_date
    )

    async def _scalar(stmt):
        return (await db.execute(stmt)).scalar_one()

    # ── Period aggregation helper ─────────────────────────────────────────────
    def _base_conds(start: date, end: date, *extra):
        conds = [
            RentalBooking.vendor_id == vid,
            date_col >= start,
            date_col <= end,
            *extra,
        ]
        return conds

    async def _agg(start: date, end: date):
        not_cancelled = RentalBooking.status.notin_(CANCELLED_STATUSES)
        base = and_(*_base_conds(start, end))

        q = select(
            sqlfunc.count(RentalBooking.id).label("bookings"),
            sqlfunc.coalesce(sqlfunc.sum(RentalBooking.total_amount), 0).label("revenue"),
            sqlfunc.coalesce(sqlfunc.sum(RentalBooking.deposit_amount), 0).label("deposits"),
            sqlfunc.coalesce(sqlfunc.sum(RentalBooking.late_fee), 0).label("late_fees"),
            sqlfunc.coalesce(sqlfunc.sum(RentalBooking.damage_charge), 0).label("damage"),
            sqlfunc.count(sqlfunc.distinct(RentalBooking.customer_id)).label("customers"),
        ).where(and_(base, not_cancelled))

        if category:
            q = q.join(RentalAsset, RentalAsset.id == RentalBooking.asset_id).where(
                RentalAsset.category == category
            )

        row = (await db.execute(q)).one()

        outstanding = await _scalar(
            select(sqlfunc.coalesce(sqlfunc.sum(RentalBooking.total_amount), 0)).where(
                and_(base, not_cancelled, RentalBooking.payment_status.in_(["unpaid", "partial"]))
            )
        )
        deposits_refunded = await _scalar(
            select(sqlfunc.coalesce(sqlfunc.sum(RentalBooking.deposit_refunded), 0)).where(base)
        )
        cancelled_count = await _scalar(
            select(sqlfunc.count(RentalBooking.id)).where(
                and_(base, RentalBooking.status.in_(CANCELLED_STATUSES))
            )
        )
        total_count = await _scalar(
            select(sqlfunc.count(RentalBooking.id)).where(base)
        )

        return {
            "bookings": int(row.bookings or 0),
            "revenue": float(row.revenue or 0),
            "deposits": float(row.deposits or 0),
            "late_fees": float(row.late_fees or 0),
            "damage": float(row.damage or 0),
            "customers": int(row.customers or 0),
            "outstanding": float(outstanding or 0),
            "deposits_refunded": float(deposits_refunded or 0),
            "cancelled": int(cancelled_count or 0),
            "total": int(total_count or 0),
        }

    cur = await _agg(df, dt)
    prev = await _agg(prev_from, prev_to)

    cur_abv = cur["revenue"] / cur["bookings"] if cur["bookings"] else 0
    prev_abv = prev["revenue"] / prev["bookings"] if prev["bookings"] else 0
    cur_cancel_rate = round(cur["cancelled"] / cur["total"] * 100, 1) if cur["total"] else 0
    prev_cancel_rate = round(prev["cancelled"] / prev["total"] * 100, 1) if prev["total"] else 0

    # Deposits currently held on active/confirmed bookings (not period-scoped)
    deposits_held = await _scalar(
        select(sqlfunc.coalesce(sqlfunc.sum(RentalBooking.deposit_amount), 0)).where(
            and_(
                RentalBooking.vendor_id == vid,
                RentalBooking.status.in_(ACTIVE_STATUSES),
            )
        )
    )

    # New customers (first booking in window)
    first_booking_subq = (
        select(
            RentalBooking.customer_id.label("cid"),
            sqlfunc.min(date_col).label("first_day"),
        )
        .where(
            and_(RentalBooking.vendor_id == vid, RentalBooking.customer_id.isnot(None))
        )
        .group_by(RentalBooking.customer_id)
        .subquery()
    )
    new_customers = await _scalar(
        select(sqlfunc.count())
        .select_from(first_booking_subq)
        .where(
            and_(first_booking_subq.c.first_day >= df, first_booking_subq.c.first_day <= dt)
        )
    )
    prev_new_customers = await _scalar(
        select(sqlfunc.count())
        .select_from(first_booking_subq)
        .where(
            and_(
                first_booking_subq.c.first_day >= prev_from,
                first_booking_subq.c.first_day <= prev_to,
            )
        )
    )

    kpis = {
        "revenue": _kpi(cur["revenue"], prev["revenue"]),
        "bookings": _kpi(cur["bookings"], prev["bookings"]),
        "avg_booking_value": _kpi(cur_abv, prev_abv),
        "net_revenue": _kpi(
            cur["revenue"] - cur["late_fees"] - cur["damage"],
            prev["revenue"] - prev["late_fees"] - prev["damage"],
        ),
        "deposits_held": {"value": round(float(deposits_held), 2), "prev": 0, "delta_pct": None},
        "deposits_refunded": _kpi(cur["deposits_refunded"], prev["deposits_refunded"]),
        "late_fees": _kpi(cur["late_fees"], prev["late_fees"]),
        "damage_charges": _kpi(cur["damage"], prev["damage"]),
        "outstanding": _kpi(cur["outstanding"], prev["outstanding"]),
        "customers": _kpi(cur["customers"], prev["customers"]),
        "new_customers": _kpi(new_customers or 0, prev_new_customers or 0),
        "cancellation_rate": _kpi(cur_cancel_rate, prev_cancel_rate),
    }

    # ── Daily trend (zero-filled) ─────────────────────────────────────────────
    not_cancelled = RentalBooking.status.notin_(CANCELLED_STATUSES)
    trend_rows = (
        await db.execute(
            select(
                date_col.label("day"),
                sqlfunc.count(RentalBooking.id).label("bookings"),
                sqlfunc.coalesce(sqlfunc.sum(RentalBooking.total_amount), 0).label("revenue"),
            )
            .where(
                and_(RentalBooking.vendor_id == vid, date_col >= df, date_col <= dt, not_cancelled)
            )
            .group_by(date_col)
            .order_by(date_col)
        )
    ).all()
    by_day = {str(r.day): r for r in trend_rows}
    trend = []
    cursor = df
    while cursor <= dt:
        key = str(cursor)
        r = by_day.get(key)
        trend.append({
            "date": key,
            "bookings": int(r.bookings) if r else 0,
            "revenue": float(r.revenue) if r else 0.0,
        })
        cursor += timedelta(days=1)

    # ── By booking status ─────────────────────────────────────────────────────
    status_rows = (
        await db.execute(
            select(
                RentalBooking.status,
                sqlfunc.count(RentalBooking.id).label("bookings"),
                sqlfunc.coalesce(sqlfunc.sum(RentalBooking.total_amount), 0).label("revenue"),
            )
            .where(and_(RentalBooking.vendor_id == vid, date_col >= df, date_col <= dt))
            .group_by(RentalBooking.status)
            .order_by(sqlfunc.count(RentalBooking.id).desc())
        )
    ).all()
    by_status = [
        {"status": r.status, "bookings": int(r.bookings), "revenue": float(r.revenue)}
        for r in status_rows
    ]

    # ── By payment status ─────────────────────────────────────────────────────
    pay_status_rows = (
        await db.execute(
            select(
                RentalBooking.payment_status,
                sqlfunc.count(RentalBooking.id).label("bookings"),
                sqlfunc.coalesce(sqlfunc.sum(RentalBooking.total_amount), 0).label("revenue"),
            )
            .where(
                and_(RentalBooking.vendor_id == vid, date_col >= df, date_col <= dt, not_cancelled)
            )
            .group_by(RentalBooking.payment_status)
            .order_by(sqlfunc.count(RentalBooking.id).desc())
        )
    ).all()
    by_payment_status = [
        {
            "status": r.payment_status or "unknown",
            "bookings": int(r.bookings),
            "revenue": float(r.revenue),
        }
        for r in pay_status_rows
    ]

    # ── By payment method ─────────────────────────────────────────────────────
    pay_method_rows = (
        await db.execute(
            select(
                RentalBooking.payment_method,
                sqlfunc.count(RentalBooking.id).label("bookings"),
                sqlfunc.coalesce(sqlfunc.sum(RentalBooking.total_amount), 0).label("revenue"),
            )
            .where(
                and_(
                    RentalBooking.vendor_id == vid,
                    date_col >= df,
                    date_col <= dt,
                    not_cancelled,
                    RentalBooking.payment_method.isnot(None),
                )
            )
            .group_by(RentalBooking.payment_method)
            .order_by(sqlfunc.sum(RentalBooking.total_amount).desc())
        )
    ).all()
    by_payment_method = [
        {"method": r.payment_method, "bookings": int(r.bookings), "revenue": float(r.revenue)}
        for r in pay_method_rows
    ]

    # ── By pricing plan ───────────────────────────────────────────────────────
    plan_rows = (
        await db.execute(
            select(
                RentalBooking.pricing_plan,
                sqlfunc.count(RentalBooking.id).label("bookings"),
                sqlfunc.coalesce(sqlfunc.sum(RentalBooking.total_amount), 0).label("revenue"),
            )
            .where(
                and_(RentalBooking.vendor_id == vid, date_col >= df, date_col <= dt, not_cancelled)
            )
            .group_by(RentalBooking.pricing_plan)
            .order_by(sqlfunc.sum(RentalBooking.total_amount).desc())
        )
    ).all()
    by_pricing_plan = [
        {"plan": r.pricing_plan or "daily", "bookings": int(r.bookings), "revenue": float(r.revenue)}
        for r in plan_rows
    ]

    # ── By asset category ─────────────────────────────────────────────────────
    cat_rows = (
        await db.execute(
            select(
                RentalAsset.category,
                sqlfunc.count(RentalBooking.id).label("bookings"),
                sqlfunc.coalesce(sqlfunc.sum(RentalBooking.total_amount), 0).label("revenue"),
            )
            .join(RentalAsset, RentalAsset.id == RentalBooking.asset_id)
            .where(
                and_(RentalBooking.vendor_id == vid, date_col >= df, date_col <= dt, not_cancelled)
            )
            .group_by(RentalAsset.category)
            .order_by(sqlfunc.sum(RentalBooking.total_amount).desc())
        )
    ).all()
    by_category = [
        {"category": r.category or "other", "bookings": int(r.bookings), "revenue": float(r.revenue)}
        for r in cat_rows
    ]

    # ── Top assets (by revenue, with utilization %) ───────────────────────────
    top_asset_rows = (
        await db.execute(
            select(
                RentalAsset.id,
                RentalAsset.name,
                RentalAsset.category,
                sqlfunc.count(RentalBooking.id).label("bookings"),
                sqlfunc.coalesce(sqlfunc.sum(RentalBooking.total_amount), 0).label("revenue"),
                sqlfunc.coalesce(
                    sqlfunc.sum(
                        sqlfunc.least(RentalBooking.end_date, dt)
                        - sqlfunc.greatest(RentalBooking.start_date, df)
                        + 1
                    ),
                    0,
                ).label("booked_days"),
            )
            .join(RentalBooking, RentalBooking.asset_id == RentalAsset.id)
            .where(
                and_(RentalBooking.vendor_id == vid, date_col >= df, date_col <= dt, not_cancelled)
            )
            .group_by(RentalAsset.id, RentalAsset.name, RentalAsset.category)
            .order_by(sqlfunc.sum(RentalBooking.total_amount).desc())
            .limit(20)
        )
    ).all()
    top_assets = [
        {
            "id": str(r.id),
            "name": r.name,
            "category": r.category or "other",
            "bookings": int(r.bookings),
            "revenue": float(r.revenue),
            "utilization_pct": min(100, round(max(0, int(r.booked_days or 0)) / days * 100)),
        }
        for r in top_asset_rows
    ]

    # ── Top customers ─────────────────────────────────────────────────────────
    top_customer_rows = (
        await db.execute(
            select(
                RentalBooking.customer_id,
                RentalBooking.customer_name,
                RentalBooking.customer_email,
                sqlfunc.count(RentalBooking.id).label("bookings"),
                sqlfunc.coalesce(sqlfunc.sum(RentalBooking.total_amount), 0).label("spent"),
            )
            .where(
                and_(RentalBooking.vendor_id == vid, date_col >= df, date_col <= dt, not_cancelled)
            )
            .group_by(
                RentalBooking.customer_id,
                RentalBooking.customer_name,
                RentalBooking.customer_email,
            )
            .order_by(sqlfunc.sum(RentalBooking.total_amount).desc())
            .limit(20)
        )
    ).all()
    top_customers = [
        {
            "id": str(r.customer_id) if r.customer_id else None,
            "name": r.customer_name,
            "email": r.customer_email or "",
            "bookings": int(r.bookings),
            "spent": float(r.spent),
        }
        for r in top_customer_rows
    ]

    # ── Return conditions (from RentalReturn events) ──────────────────────────
    return_rows = (
        await db.execute(
            select(
                RentalReturn.return_condition,
                sqlfunc.count(RentalReturn.id).label("cnt"),
                sqlfunc.coalesce(sqlfunc.sum(RentalReturn.damage_charge), 0).label("damage"),
                sqlfunc.coalesce(sqlfunc.sum(RentalReturn.late_fee), 0).label("late"),
            )
            .where(
                and_(
                    RentalReturn.vendor_id == vid,
                    cast(RentalReturn.returned_at, Date) >= df,
                    cast(RentalReturn.returned_at, Date) <= dt,
                )
            )
            .group_by(RentalReturn.return_condition)
            .order_by(sqlfunc.count(RentalReturn.id).desc())
        )
    ).all()
    return_conditions = [
        {
            "condition": r.return_condition or "good",
            "count": int(r.cnt),
            "damage_charge": float(r.damage),
            "late_fee": float(r.late),
        }
        for r in return_rows
    ]

    # ── By hour of day ────────────────────────────────────────────────────────
    hour_rows = (
        await db.execute(
            select(
                extract("hour", RentalBooking.created_at).label("hr"),
                sqlfunc.count(RentalBooking.id).label("bookings"),
                sqlfunc.coalesce(sqlfunc.sum(RentalBooking.total_amount), 0).label("revenue"),
            )
            .where(and_(RentalBooking.vendor_id == vid, date_col >= df, date_col <= dt, not_cancelled))
            .group_by(extract("hour", RentalBooking.created_at))
            .order_by(extract("hour", RentalBooking.created_at))
        )
    ).all()
    hour_map = {int(r.hr): r for r in hour_rows}
    by_hour = [
        {
            "hour": h,
            "bookings": int(hour_map[h].bookings) if h in hour_map else 0,
            "revenue": float(hour_map[h].revenue) if h in hour_map else 0.0,
        }
        for h in range(24)
    ]

    # ── By day of week ────────────────────────────────────────────────────────
    dow_rows = (
        await db.execute(
            select(
                extract("dow", RentalBooking.created_at).label("dow"),
                sqlfunc.count(RentalBooking.id).label("bookings"),
                sqlfunc.coalesce(sqlfunc.sum(RentalBooking.total_amount), 0).label("revenue"),
            )
            .where(and_(RentalBooking.vendor_id == vid, date_col >= df, date_col <= dt, not_cancelled))
            .group_by(extract("dow", RentalBooking.created_at))
            .order_by(extract("dow", RentalBooking.created_at))
        )
    ).all()
    dow_map = {int(r.dow): r for r in dow_rows}
    by_dow = [
        {
            "dow": d,
            "label": DOW_LABELS[d],
            "bookings": int(dow_map[d].bookings) if d in dow_map else 0,
            "revenue": float(dow_map[d].revenue) if d in dow_map else 0.0,
        }
        for d in range(7)
    ]

    # ── Overdue bookings (active past their end_date) ─────────────────────────
    today_date = date.today()
    overdue_rows = (
        await db.execute(
            select(
                RentalBooking.end_date,
                sqlfunc.count(RentalBooking.id).label("cnt"),
            )
            .where(
                and_(
                    RentalBooking.vendor_id == vid,
                    RentalBooking.status.in_(["active", "approved", "confirmed"]),
                    RentalBooking.end_date < today_date,
                )
            )
            .group_by(RentalBooking.end_date)
        )
    ).all()
    overdue_total = b_1_7 = b_8_30 = b_30_plus = 0
    for r in overdue_rows:
        age = (today_date - r.end_date).days
        cnt = int(r.cnt)
        overdue_total += cnt
        if age <= 7:
            b_1_7 += cnt
        elif age <= 30:
            b_8_30 += cnt
        else:
            b_30_plus += cnt
    overdue = {
        "total": overdue_total,
        "bucket_1_7": b_1_7,
        "bucket_8_30": b_8_30,
        "bucket_30_plus": b_30_plus,
    }

    # ── Delivery performance ──────────────────────────────────────────────────
    delivery_row = (
        await db.execute(
            select(
                sqlfunc.count(RentalBooking.id).label("total"),
                sqlfunc.count(RentalBooking.delivered_at).label("delivered"),
            )
            .where(
                and_(
                    RentalBooking.vendor_id == vid,
                    date_col >= df,
                    date_col <= dt,
                    RentalBooking.delivery_status.notin_(["not_required"]),
                    RentalBooking.delivery_status.isnot(None),
                )
            )
        )
    ).one()
    on_time_count = await _scalar(
        select(sqlfunc.count(RentalBooking.id)).where(
            and_(
                RentalBooking.vendor_id == vid,
                date_col >= df,
                date_col <= dt,
                RentalBooking.delivered_at.isnot(None),
                RentalBooking.estimated_delivery_at.isnot(None),
                RentalBooking.delivered_at <= RentalBooking.estimated_delivery_at,
            )
        )
    )
    delivery_done = int(delivery_row.delivered or 0)
    delivery = {
        "total_with_delivery": int(delivery_row.total or 0),
        "delivered": delivery_done,
        "on_time": int(on_time_count or 0),
        "on_time_pct": (
            round(int(on_time_count or 0) / delivery_done * 100, 1) if delivery_done else 0
        ),
    }

    # ── Current asset status mix (snapshot — not date-scoped) ─────────────────
    asset_status_rows = (
        await db.execute(
            select(
                RentalAsset.status,
                sqlfunc.count(RentalAsset.id).label("cnt"),
            )
            .where(
                and_(
                    RentalAsset.vendor_id == vid,
                    RentalAsset.deleted_at.is_(None),
                    RentalAsset.is_active == True,
                )
            )
            .group_by(RentalAsset.status)
            .order_by(sqlfunc.count(RentalAsset.id).desc())
        )
    ).all()
    asset_status_mix = [{"status": r.status, "count": int(r.cnt)} for r in asset_status_rows]

    return JSONResponse(
        content={
            "range": {
                "from": str(df),
                "to": str(dt),
                "days": days,
                "prev_from": str(prev_from),
                "prev_to": str(prev_to),
            },
            "basis": basis,
            "generated_at": datetime.utcnow().isoformat(),
            "kpis": kpis,
            "trend": trend,
            "by_status": by_status,
            "by_payment_status": by_payment_status,
            "by_payment_method": by_payment_method,
            "by_pricing_plan": by_pricing_plan,
            "by_category": by_category,
            "top_assets": top_assets,
            "top_customers": top_customers,
            "return_conditions": return_conditions,
            "by_hour": by_hour,
            "by_dow": by_dow,
            "overdue": overdue,
            "delivery": delivery,
            "asset_status_mix": asset_status_mix,
        }
    )
