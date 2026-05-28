from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func as sqlfunc, and_, cast, Date, extract
from uuid import UUID
from datetime import date, timedelta

from app.database import get_db
from app.api.deps import get_current_active_user
from app.models.user import User
from app.models.order import Order
from app.models.vendor_product import Product
from app.models.vendor_service import Service
from app.models.customer import Customer
from app.models.invoice import Invoice
from app.models.pos import POSTransaction
from app.models.restaurant import RestaurantOrder, RestaurantKOT, RestaurantTable, RestaurantReservation
from app.services.vendor_service import VendorService

router = APIRouter()


async def _vendor_id(current_user: User = Depends(get_current_active_user), db: AsyncSession = Depends(get_db)) -> UUID:
    svc = VendorService(db)
    vendor = await svc.get_by_user_id(current_user.id)
    if not vendor:
        raise HTTPException(404, "No vendor found")
    return vendor.id


@router.get("/dashboard")
async def dashboard_stats(vid: UUID = Depends(_vendor_id), db: AsyncSession = Depends(get_db)):
    today = date.today()
    month_start = today.replace(day=1)

    # Orders
    total_orders = (await db.execute(select(sqlfunc.count(Order.id)).where(Order.vendor_id == vid))).scalar_one()
    today_orders = (await db.execute(select(sqlfunc.count(Order.id)).where(and_(Order.vendor_id == vid, cast(Order.created_at, Date) == today)))).scalar_one()

    # Revenue
    total_revenue = (await db.execute(select(sqlfunc.coalesce(sqlfunc.sum(Order.total), 0)).where(and_(Order.vendor_id == vid, Order.status.in_(["delivered", "confirmed", "shipped"]))))).scalar_one()
    today_revenue = (await db.execute(select(sqlfunc.coalesce(sqlfunc.sum(Order.total), 0)).where(and_(Order.vendor_id == vid, Order.status.in_(["delivered", "confirmed", "shipped"]), cast(Order.created_at, Date) == today)))).scalar_one()
    month_revenue = (await db.execute(select(sqlfunc.coalesce(sqlfunc.sum(Order.total), 0)).where(and_(Order.vendor_id == vid, Order.status.in_(["delivered", "confirmed", "shipped"]), cast(Order.created_at, Date) >= month_start)))).scalar_one()

    # POS
    pos_today = (await db.execute(select(sqlfunc.coalesce(sqlfunc.sum(POSTransaction.total), 0)).where(and_(POSTransaction.vendor_id == vid, POSTransaction.transaction_type == "sale", cast(POSTransaction.created_at, Date) == today)))).scalar_one()

    # Customers
    total_customers = (await db.execute(select(sqlfunc.count(Customer.id)).where(Customer.vendor_id == vid))).scalar_one()

    # Products
    total_products = (await db.execute(select(sqlfunc.count(Product.id)).where(and_(Product.vendor_id == vid, Product.status == "active")))).scalar_one()

    # Invoices
    unpaid_invoices = (await db.execute(select(sqlfunc.coalesce(sqlfunc.sum(Invoice.balance_due), 0)).where(and_(Invoice.vendor_id == vid, Invoice.status.in_(["sent", "partially_paid", "overdue"]))))).scalar_one()

    return JSONResponse(content={
        "total_orders": total_orders, "today_orders": today_orders,
        "total_revenue": float(total_revenue), "today_revenue": float(today_revenue),
        "month_revenue": float(month_revenue), "pos_today": float(pos_today),
        "total_customers": total_customers, "total_products": total_products,
        "unpaid_invoices": float(unpaid_invoices),
    })


@router.get("/sales-by-day")
async def sales_by_day(days: int = Query(30, ge=1, le=365), vid: UUID = Depends(_vendor_id), db: AsyncSession = Depends(get_db)):
    start = date.today() - timedelta(days=days)
    q = (
        select(
            cast(Order.created_at, Date).label("day"),
            sqlfunc.count(Order.id).label("count"),
            sqlfunc.coalesce(sqlfunc.sum(Order.total), 0).label("revenue"),
        )
        .where(and_(Order.vendor_id == vid, cast(Order.created_at, Date) >= start))
        .group_by(cast(Order.created_at, Date))
        .order_by(cast(Order.created_at, Date))
    )
    result = await db.execute(q)
    rows = result.all()
    return JSONResponse(content={"data": [{"date": str(r.day), "orders": r.count, "revenue": float(r.revenue)} for r in rows]})


@router.get("/top-products")
async def top_products(limit: int = Query(10, ge=1, le=50), vid: UUID = Depends(_vendor_id), db: AsyncSession = Depends(get_db)):
    q = (
        select(Product.id, Product.name, Product.price, Product.quantity)
        .where(and_(Product.vendor_id == vid, Product.status == "active"))
        .order_by(Product.quantity.desc())
        .limit(limit)
    )
    result = await db.execute(q)
    rows = result.all()
    return JSONResponse(content={"items": [{"id": str(r.id), "name": r.name, "price": float(r.price or 0), "stock": r.quantity or 0} for r in rows]})


@router.get("/top-customers")
async def top_customers(limit: int = Query(10, ge=1, le=50), vid: UUID = Depends(_vendor_id), db: AsyncSession = Depends(get_db)):
    q = (
        select(Customer.id, Customer.full_name, Customer.email, Customer.total_orders, Customer.total_spent)
        .where(Customer.vendor_id == vid)
        .order_by(Customer.total_spent.desc())
        .limit(limit)
    )
    result = await db.execute(q)
    rows = result.all()
    return JSONResponse(content={"items": [{"id": str(r.id), "name": r.full_name, "email": r.email, "orders": r.total_orders or 0, "spent": float(r.total_spent or 0)} for r in rows]})


@router.get("/orders-by-status")
async def orders_by_status(vid: UUID = Depends(_vendor_id), db: AsyncSession = Depends(get_db)):
    q = (
        select(Order.status, sqlfunc.count(Order.id).label("count"))
        .where(Order.vendor_id == vid)
        .group_by(Order.status)
    )
    result = await db.execute(q)
    rows = result.all()
    return JSONResponse(content={"data": {r.status: r.count for r in rows}})


@router.get("/revenue-summary")
async def revenue_summary(vid: UUID = Depends(_vendor_id), db: AsyncSession = Depends(get_db)):
    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    month_start = today.replace(day=1)
    year_start = today.replace(month=4, day=1) if today.month >= 4 else today.replace(year=today.year - 1, month=4, day=1)

    async def _sum(start_date):
        r = await db.execute(
            select(sqlfunc.coalesce(sqlfunc.sum(Order.total), 0))
            .where(and_(Order.vendor_id == vid, Order.status.in_(["delivered", "confirmed", "shipped"]), cast(Order.created_at, Date) >= start_date))
        )
        return float(r.scalar_one())

    return JSONResponse(content={
        "today": await _sum(today),
        "this_week": await _sum(week_start),
        "this_month": await _sum(month_start),
        "this_fy": await _sum(year_start),
    })


# ── Restaurant Reports ───────────────────────────────────────────

@router.get("/restaurant")
async def restaurant_dashboard(vid: UUID = Depends(_vendor_id), db: AsyncSession = Depends(get_db)):
    today = date.today()

    # Active (open/billed) orders today
    open_orders = (await db.execute(
        select(sqlfunc.count(RestaurantOrder.id))
        .where(and_(
            RestaurantOrder.vendor_id == vid,
            RestaurantOrder.status.in_(["open", "billed"]),
            cast(RestaurantOrder.created_at, Date) == today,
        ))
    )).scalar_one()

    # Total orders today
    total_orders_today = (await db.execute(
        select(sqlfunc.count(RestaurantOrder.id))
        .where(and_(
            RestaurantOrder.vendor_id == vid,
            cast(RestaurantOrder.created_at, Date) == today,
        ))
    )).scalar_one()

    # Total covers today
    total_covers = (await db.execute(
        select(sqlfunc.coalesce(sqlfunc.sum(RestaurantOrder.covers), 0))
        .where(and_(
            RestaurantOrder.vendor_id == vid,
            cast(RestaurantOrder.created_at, Date) == today,
        ))
    )).scalar_one()

    # KOTs by status today
    kot_status_rows = (await db.execute(
        select(RestaurantKOT.status, sqlfunc.count(RestaurantKOT.id).label("cnt"))
        .where(and_(
            RestaurantKOT.vendor_id == vid,
            cast(RestaurantKOT.created_at, Date) == today,
        ))
        .group_by(RestaurantKOT.status)
    )).all()
    kots_by_status = {r.status: r.cnt for r in kot_status_rows}

    # POS revenue from restaurant tables today
    restaurant_revenue = (await db.execute(
        select(sqlfunc.coalesce(sqlfunc.sum(POSTransaction.total), 0))
        .where(and_(
            POSTransaction.vendor_id == vid,
            POSTransaction.transaction_type == "sale",
            POSTransaction.restaurant_table_id.isnot(None),
            cast(POSTransaction.created_at, Date) == today,
        ))
    )).scalar_one()

    # Total tables
    total_tables = (await db.execute(
        select(sqlfunc.count(RestaurantTable.id))
        .where(and_(RestaurantTable.vendor_id == vid, RestaurantTable.is_active == True))
    )).scalar_one()

    # Tables by status
    table_status_rows = (await db.execute(
        select(RestaurantTable.status, sqlfunc.count(RestaurantTable.id).label("cnt"))
        .where(and_(RestaurantTable.vendor_id == vid, RestaurantTable.is_active == True))
        .group_by(RestaurantTable.status)
    )).all()
    tables_by_status = {r.status: r.cnt for r in table_status_rows}

    # Upcoming reservations (today + next 7 days)
    upcoming_reservations = (await db.execute(
        select(sqlfunc.count(RestaurantReservation.id))
        .where(and_(
            RestaurantReservation.vendor_id == vid,
            RestaurantReservation.reservation_date >= today,
            RestaurantReservation.reservation_date <= today + timedelta(days=7),
            RestaurantReservation.status.in_(["pending", "confirmed"]),
        ))
    )).scalar_one()

    return JSONResponse(content={
        "today": {
            "open_orders": open_orders,
            "total_orders": total_orders_today,
            "total_covers": int(total_covers),
            "restaurant_revenue": float(restaurant_revenue),
        },
        "kots_by_status": kots_by_status,
        "tables": {
            "total": total_tables,
            "by_status": tables_by_status,
        },
        "upcoming_reservations": upcoming_reservations,
    })


@router.get("/restaurant/kots-by-hour")
async def restaurant_kots_by_hour(
    days: int = Query(1, ge=1, le=7),
    vid: UUID = Depends(_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """KOT volume by hour of day for the past N days."""
    start = date.today() - timedelta(days=days - 1)
    rows = (await db.execute(
        select(
            extract("hour", RestaurantKOT.created_at).label("hour"),
            sqlfunc.count(RestaurantKOT.id).label("count"),
        )
        .where(and_(
            RestaurantKOT.vendor_id == vid,
            cast(RestaurantKOT.created_at, Date) >= start,
        ))
        .group_by(extract("hour", RestaurantKOT.created_at))
        .order_by(extract("hour", RestaurantKOT.created_at))
    )).all()
    return JSONResponse(content={"data": [{"hour": int(r.hour), "kots": r.count} for r in rows]})
