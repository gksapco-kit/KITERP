from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.deps import get_current_active_user, get_current_vendor_user, require_permission
from app.models.user import User
from app.models.vendor_plan import VendorPlan
from app.models.vendor_user import VendorUser
from app.services.vendor_service import VendorService
from app.services.restaurant_service import RestaurantService
from app.models.restaurant import Restaurant
from app.schemas.restaurant import (
    RestaurantZoneCreate,
    RestaurantZoneUpdate,
    RestaurantTableCreate,
    RestaurantTableUpdate,
    RestaurantTableStatusUpdate,
    KitchenTicketStatusUpdate,
    RestaurantOrderCreate,
    RestaurantOrderAddItems,
    RestaurantOrderCloseIn,
    RestaurantKOTSendIn,
    RestaurantKOTStatusUpdate,
    RestaurantReservationCreate,
    RestaurantReservationStatusUpdate,
    RestaurantReservationUpdate,
    RestaurantMenuSettingsOut,
    RestaurantMenuSettingsUpdate,
    RestaurantKOTSettingsOut,
    RestaurantKOTSettingsUpdate,
    RestaurantSeatReservationIn,
    RestaurantOrderTransferIn,
    RestaurantOrderMergeIn,
    RestaurantOrderAdjustmentsIn,
)
from datetime import date as date_type

router = APIRouter()


async def _check_restaurant_plan(vendor_id: UUID, db: AsyncSession) -> None:
    from app.models.vendor import Vendor
    vendor = await db.get(Vendor, vendor_id)
    if vendor and vendor.plan_id:
        plan = await db.get(VendorPlan, vendor.plan_id)
        if plan and (plan.features or {}).get("restaurant") is False:
            raise HTTPException(
                403,
                "Restaurant module is not included in your subscription plan",
            )


async def _vendor_id(
    vu: VendorUser = Depends(require_permission("restaurant.view")),
    db: AsyncSession = Depends(get_db),
) -> UUID:
    await _check_restaurant_plan(vu.vendor_id, db)
    return vu.vendor_id


# ── Serialisers ───────────────────────────────────────────────────────

def _zone_dict(z):
    return {
        "id": str(z.id),
        "vendor_id": str(z.vendor_id),
        "restaurant_id": str(z.restaurant_id) if z.restaurant_id else None,
        "name": z.name,
        "floor": getattr(z, "floor", None),
        "sort_order": z.sort_order or 0,
        "created_at": z.created_at.isoformat() if z.created_at else None,
    }


def _table_dict(t, zone_name=None):
    return {
        "id": str(t.id),
        "vendor_id": str(t.vendor_id),
        "restaurant_id": str(t.restaurant_id) if t.restaurant_id else None,
        "zone_id": str(t.zone_id) if t.zone_id else None,
        "zone_name": zone_name,
        "label": t.label,
        "capacity": t.capacity or 4,
        "sort_order": t.sort_order or 0,
        "is_active": t.is_active if t.is_active is not None else True,
        "status": t.status or "free",
        "qr_token": getattr(t, "qr_token", None),
        "created_at": t.created_at.isoformat() if t.created_at else None,
    }


def _order_dict(o, table_label=None, kots=None):
    return {
        "id": str(o.id),
        "vendor_id": str(o.vendor_id),
        "restaurant_id": str(o.restaurant_id) if o.restaurant_id else None,
        "table_id": str(o.table_id) if o.table_id else None,
        "table_label": table_label,
        "status": o.status,
        "covers": o.covers or 1,
        "server_name": o.server_name,
        "items": o.items or [],
        "notes": o.notes,
        "adjustments": getattr(o, "adjustments", None) or {},
        "pos_transaction_id": str(o.pos_transaction_id) if o.pos_transaction_id else None,
        "kots": [_kot_dict(k) for k in (kots or [])],
        "created_at": o.created_at.isoformat() if o.created_at else None,
        "updated_at": o.updated_at.isoformat() if o.updated_at else None,
    }


def _kot_dict(k, table_label=None, covers=None, order_status=None):
    d = {
        "id": str(k.id),
        "order_id": str(k.order_id),
        "table_id": str(k.table_id) if k.table_id else None,
        "table_label": table_label,
        "kot_number": k.kot_number,
        "status": k.status,
        "items": k.items or [],
        "notes": k.notes,
        "covers": covers,
        "order_status": order_status,
        "created_at": k.created_at.isoformat() if k.created_at else None,
    }
    return d


# ── Zones ─────────────────────────────────────────────────────────────

@router.get("/zones")
async def list_zones(
    restaurant_id: str | None = Query(None),
    vid: UUID = Depends(_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    svc = RestaurantService(db)
    rid = UUID(restaurant_id) if restaurant_id else None
    zones = await svc.list_zones(vid, restaurant_id=rid)
    return JSONResponse(content={"items": [_zone_dict(z) for z in zones]})


@router.post("/zones", status_code=201)
async def create_zone(data: RestaurantZoneCreate, vid: UUID = Depends(_vendor_id), db: AsyncSession = Depends(get_db)):
    svc = RestaurantService(db)
    rid = UUID(data.restaurant_id) if getattr(data, "restaurant_id", None) else None
    z = await svc.create_zone(vid, data.name, data.sort_order or 0, restaurant_id=rid, floor=getattr(data, "floor", None))
    return JSONResponse(content=_zone_dict(z), status_code=201)


@router.patch("/zones/{zone_id}")
async def update_zone(zone_id: str, data: RestaurantZoneUpdate, vid: UUID = Depends(_vendor_id), db: AsyncSession = Depends(get_db)):
    svc = RestaurantService(db)
    z = await svc.update_zone(vid, UUID(zone_id), name=data.name, sort_order=data.sort_order, floor=getattr(data, "floor", None))
    if not z:
        raise HTTPException(404, "Zone not found")
    return JSONResponse(content=_zone_dict(z))


@router.delete("/zones/{zone_id}")
async def delete_zone(zone_id: str, vid: UUID = Depends(_vendor_id), db: AsyncSession = Depends(get_db)):
    svc = RestaurantService(db)
    ok = await svc.delete_zone(vid, UUID(zone_id))
    if not ok:
        raise HTTPException(404, "Zone not found")
    return JSONResponse(content={"ok": True})


# ── Tables ────────────────────────────────────────────────────────────

@router.get("/tables")
async def list_tables(
    zone_id: str | None = Query(None),
    restaurant_id: str | None = Query(None),
    vid: UUID = Depends(_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    svc = RestaurantService(db)
    zid = UUID(zone_id) if zone_id else None
    rid = UUID(restaurant_id) if restaurant_id else None
    rows = await svc.list_tables(vid, zone_id=zid, restaurant_id=rid)
    return JSONResponse(content={"items": [_table_dict(t, zn) for t, zn in rows]})


@router.post("/tables", status_code=201)
async def create_table(data: RestaurantTableCreate, vid: UUID = Depends(_vendor_id), db: AsyncSession = Depends(get_db)):
    svc = RestaurantService(db)
    try:
        zid = UUID(data.zone_id) if data.zone_id else None
        rid = UUID(data.restaurant_id) if getattr(data, "restaurant_id", None) else None
        t = await svc.create_table(
            vid,
            data.label,
            zone_id=zid,
            restaurant_id=rid,
            capacity=data.capacity,
            sort_order=data.sort_order or 0,
            is_active=data.is_active,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))
    rows = await svc.list_tables(vid)
    zone_name = next((zn for tt, zn in rows if tt.id == t.id), None)
    return JSONResponse(content=_table_dict(t, zone_name), status_code=201)


@router.patch("/tables/{table_id}")
async def patch_table(table_id: str, data: RestaurantTableUpdate, vid: UUID = Depends(_vendor_id), db: AsyncSession = Depends(get_db)):
    svc = RestaurantService(db)
    payload = data.model_dump(exclude_unset=True)
    try:
        t = await svc.patch_table(vid, UUID(table_id), payload)
    except ValueError as e:
        raise HTTPException(400, str(e))
    if not t:
        raise HTTPException(404, "Table not found")
    rows = await svc.list_tables(vid)
    zone_name = next((zn for tt, zn in rows if tt.id == t.id), None)
    return JSONResponse(content=_table_dict(t, zone_name))


@router.patch("/tables/{table_id}/status")
async def set_table_status(table_id: str, data: RestaurantTableStatusUpdate, vid: UUID = Depends(_vendor_id), db: AsyncSession = Depends(get_db)):
    svc = RestaurantService(db)
    try:
        t = await svc.set_table_status(vid, UUID(table_id), data.status)
    except ValueError as e:
        raise HTTPException(400, str(e))
    if not t:
        raise HTTPException(404, "Table not found")
    return JSONResponse(content={"id": str(t.id), "status": t.status})


@router.delete("/tables/{table_id}")
async def delete_table(table_id: str, vid: UUID = Depends(_vendor_id), db: AsyncSession = Depends(get_db)):
    svc = RestaurantService(db)
    ok = await svc.delete_table(vid, UUID(table_id))
    if not ok:
        raise HTTPException(404, "Table not found")
    return JSONResponse(content={"ok": True})


# ── Orders ────────────────────────────────────────────────────────────

@router.post("/orders", status_code=201)
async def create_order(data: RestaurantOrderCreate, vid: UUID = Depends(_vendor_id), db: AsyncSession = Depends(get_db)):
    svc = RestaurantService(db)
    try:
        o = await svc.create_order(
            vid,
            UUID(data.table_id),
            covers=data.covers,
            server_name=data.server_name,
            notes=data.notes,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))
    rows = await svc.list_tables(vid)
    table_label = next((t.label for t, _ in rows if str(t.id) == str(o.table_id)), None)
    return JSONResponse(content=_order_dict(o, table_label, []), status_code=201)


@router.get("/orders")
async def list_orders(
    status: str | None = Query(None),
    restaurant_id: str | None = Query(None),
    vid: UUID = Depends(_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    svc = RestaurantService(db)
    rid = UUID(restaurant_id) if restaurant_id else None
    rows = await svc.list_orders(vid, status=status, restaurant_id=rid)
    kots_by_order = await svc.get_kots_for_orders(vid, [o.id for o, _ in rows])
    return JSONResponse(content={
        "items": [_order_dict(o, tl, kots_by_order.get(o.id, [])) for o, tl in rows],
    })


@router.get("/orders/{order_id}")
async def get_order(order_id: str, vid: UUID = Depends(_vendor_id), db: AsyncSession = Depends(get_db)):
    svc = RestaurantService(db)
    o = await svc.get_order(vid, UUID(order_id))
    if not o:
        raise HTTPException(404, "Order not found")
    kots = await svc.get_kots_for_order(vid, UUID(order_id))
    table_rows = await svc.list_tables(vid)
    table_label = next((t.label for t, _ in table_rows if o.table_id and str(t.id) == str(o.table_id)), None)
    return JSONResponse(content=_order_dict(o, table_label, kots))


@router.post("/orders/{order_id}/items")
async def add_items(order_id: str, data: RestaurantOrderAddItems, vid: UUID = Depends(_vendor_id), db: AsyncSession = Depends(get_db)):
    svc = RestaurantService(db)
    try:
        o = await svc.add_items_to_order(vid, UUID(order_id), data.items)
    except ValueError as e:
        raise HTTPException(400, str(e))
    if not o:
        raise HTTPException(404, "Order not found")
    return JSONResponse(content={"id": str(o.id), "items": o.items or []})


@router.put("/orders/{order_id}/items")
async def replace_items(order_id: str, data: RestaurantOrderAddItems, vid: UUID = Depends(_vendor_id), db: AsyncSession = Depends(get_db)):
    svc = RestaurantService(db)
    try:
        o = await svc.update_order_items(vid, UUID(order_id), data.items)
    except ValueError as e:
        raise HTTPException(400, str(e))
    if not o:
        raise HTTPException(404, "Order not found")
    return JSONResponse(content={"id": str(o.id), "items": o.items or []})


@router.post("/orders/{order_id}/send-kot", status_code=201)
async def send_kot(order_id: str, data: RestaurantKOTSendIn, vid: UUID = Depends(_vendor_id), db: AsyncSession = Depends(get_db)):
    svc = RestaurantService(db)
    try:
        kot = await svc.send_kot(vid, UUID(order_id), data.items, notes=data.notes)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return JSONResponse(content=_kot_dict(kot), status_code=201)


@router.patch("/orders/{order_id}/request-bill")
async def request_bill(order_id: str, vid: UUID = Depends(_vendor_id), db: AsyncSession = Depends(get_db)):
    svc = RestaurantService(db)
    try:
        o = await svc.request_bill(vid, UUID(order_id))
    except ValueError as e:
        raise HTTPException(400, str(e))
    if not o:
        raise HTTPException(404, "Order not found")
    return JSONResponse(content={"id": str(o.id), "status": o.status})


@router.patch("/orders/{order_id}/close")
async def close_order(order_id: str, data: RestaurantOrderCloseIn, vid: UUID = Depends(_vendor_id), db: AsyncSession = Depends(get_db)):
    svc = RestaurantService(db)
    try:
        o = await svc.close_order(vid, UUID(order_id), UUID(data.pos_transaction_id))
    except ValueError as e:
        raise HTTPException(400, str(e))
    if not o:
        raise HTTPException(404, "Order not found")
    return JSONResponse(content={"id": str(o.id), "status": o.status})


@router.patch("/orders/{order_id}/void")
async def void_order(order_id: str, vid: UUID = Depends(_vendor_id), db: AsyncSession = Depends(get_db)):
    svc = RestaurantService(db)
    try:
        o = await svc.void_order(vid, UUID(order_id))
    except ValueError as e:
        raise HTTPException(400, str(e))
    if not o:
        raise HTTPException(404, "Order not found")
    return JSONResponse(content={"id": str(o.id), "status": o.status})


@router.post("/orders/{order_id}/transfer")
async def transfer_order(
    order_id: str,
    data: RestaurantOrderTransferIn,
    vid: UUID = Depends(_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Move an open order to a different free table."""
    svc = RestaurantService(db)
    try:
        o = await svc.transfer_order(vid, UUID(order_id), UUID(data.table_id))
    except ValueError as e:
        raise HTTPException(400, str(e))
    if not o:
        raise HTTPException(404, "Order not found")
    rows = await svc.list_tables(vid)
    table_label = next((t.label for t, _ in rows if o.table_id and str(t.id) == str(o.table_id)), None)
    kots = await svc.get_kots_for_order(vid, o.id)
    return JSONResponse(content=_order_dict(o, table_label, kots))


@router.post("/orders/{order_id}/merge")
async def merge_orders(
    order_id: str,
    data: RestaurantOrderMergeIn,
    vid: UUID = Depends(_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Merge this order into a target order. This order is voided and its table freed."""
    svc = RestaurantService(db)
    try:
        o = await svc.merge_orders(vid, UUID(order_id), UUID(data.target_order_id))
    except ValueError as e:
        raise HTTPException(400, str(e))
    if not o:
        raise HTTPException(404, "Order not found")
    rows = await svc.list_tables(vid)
    table_label = next((t.label for t, _ in rows if o.table_id and str(t.id) == str(o.table_id)), None)
    kots = await svc.get_kots_for_order(vid, o.id)
    return JSONResponse(content=_order_dict(o, table_label, kots))


@router.patch("/orders/{order_id}/adjustments")
async def set_order_adjustments(
    order_id: str,
    data: RestaurantOrderAdjustmentsIn,
    vid: UUID = Depends(_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Set service charge, tip, or discount on an open order."""
    svc = RestaurantService(db)
    o = await svc.get_order(vid, UUID(order_id))
    if not o:
        raise HTTPException(404, "Order not found")
    if o.status not in ("open", "billed"):
        raise HTTPException(400, "Order is not open")
    adj = dict(o.adjustments or {}) if hasattr(o, "adjustments") else {}
    if data.service_charge_pct is not None:
        adj["service_charge_pct"] = data.service_charge_pct
    if data.tip_amount is not None:
        adj["tip_amount"] = data.tip_amount
    if data.discount_amount is not None:
        adj["discount_amount"] = data.discount_amount
    if data.discount_pct is not None:
        adj["discount_pct"] = data.discount_pct
    from sqlalchemy import update as sqla_update
    from datetime import datetime, timezone
    from app.models.restaurant import RestaurantOrder as _RO
    await db.execute(
        sqla_update(_RO)
        .where(_RO.id == o.id)
        .values(adjustments=adj, updated_at=datetime.now(timezone.utc))
    )
    await db.commit()
    await db.refresh(o)
    return JSONResponse(content={"id": str(o.id), "adjustments": adj})


# ── KOTs ──────────────────────────────────────────────────────────────

@router.get("/kots")
async def list_kots(
    include_done: bool = Query(False),
    restaurant_id: str | None = Query(None),
    vid: UUID = Depends(_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    svc = RestaurantService(db)
    rid = UUID(restaurant_id) if restaurant_id else None
    rows = await svc.list_kots(vid, include_done=include_done, restaurant_id=rid)
    items = [_kot_dict(k, tl, cov, ost) for k, tl, cov, ost in rows]
    return JSONResponse(content={"items": items})


@router.patch("/kots/{kot_id}")
async def patch_kot(kot_id: str, data: RestaurantKOTStatusUpdate, vid: UUID = Depends(_vendor_id), db: AsyncSession = Depends(get_db)):
    svc = RestaurantService(db)
    try:
        kot = await svc.update_kot_status(vid, UUID(kot_id), data.status)
    except ValueError as e:
        raise HTTPException(400, str(e))
    if not kot:
        raise HTTPException(404, "KOT not found")
    return JSONResponse(content={"id": str(kot.id), "status": kot.status})


# ── Legacy kitchen tickets (POS-based) ───────────────────────────────

@router.get("/kitchen-tickets")
async def kitchen_tickets(
    include_done: bool = Query(False),
    vid: UUID = Depends(_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    svc = RestaurantService(db)
    rows = await svc.list_kitchen_tickets(vid, include_done=include_done)
    items = []
    for txn, table_label in rows:
        items.append({
            "transaction_id": str(txn.id),
            "transaction_number": txn.transaction_number,
            "table_id": str(txn.restaurant_table_id) if txn.restaurant_table_id else None,
            "table_label": table_label,
            "kitchen_ticket_status": txn.kitchen_ticket_status,
            "items": txn.items or [],
            "total": float(txn.total or 0),
            "notes": txn.notes,
            "created_at": txn.created_at.isoformat() if txn.created_at else None,
        })
    return JSONResponse(content={"items": items})


def _reservation_dict(r, table_label=None):
    return {
        "id": str(r.id),
        "vendor_id": str(r.vendor_id),
        "restaurant_id": str(r.restaurant_id) if r.restaurant_id else None,
        "table_id": str(r.table_id) if r.table_id else None,
        "table_label": table_label,
        "guest_name": r.guest_name,
        "guest_phone": r.guest_phone,
        "guest_email": r.guest_email,
        "reservation_date": r.reservation_date.isoformat() if r.reservation_date else None,
        "reservation_time": r.reservation_time,
        "party_size": r.party_size,
        "status": r.status,
        "notes": r.notes,
        "source": r.source,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


@router.get("/reservations")
async def list_reservations(
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    status: str | None = Query(None),
    restaurant_id: str | None = Query(None),
    vid: UUID = Depends(_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    from datetime import date as date_type
    svc = RestaurantService(db)
    df = date_type.fromisoformat(date_from) if date_from else None
    dt = date_type.fromisoformat(date_to) if date_to else None
    rid = UUID(restaurant_id) if restaurant_id else None
    rows = await svc.list_reservations(vid, date_from=df, date_to=dt, status=status, restaurant_id=rid)
    return JSONResponse(content={"items": [_reservation_dict(r, tl) for r, tl in rows]})


@router.post("/reservations", status_code=201)
async def create_reservation(data: RestaurantReservationCreate, vid: UUID = Depends(_vendor_id), db: AsyncSession = Depends(get_db)):
    svc = RestaurantService(db)
    try:
        r = await svc.create_reservation(
            vid,
            data.guest_name,
            data.reservation_date,
            data.reservation_time,
            data.party_size,
            table_id=UUID(data.table_id) if data.table_id else None,
            restaurant_id=UUID(data.restaurant_id) if data.restaurant_id else None,
            guest_phone=data.guest_phone,
            guest_email=data.guest_email,
            notes=data.notes,
            source=data.source,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))
    return JSONResponse(content=_reservation_dict(r), status_code=201)


@router.patch("/reservations/{reservation_id}")
async def update_reservation(
    reservation_id: str,
    data: RestaurantReservationUpdate,
    vid: UUID = Depends(_vendor_id),
    db: AsyncSession = Depends(get_db),
    _vu: VendorUser = Depends(require_permission("restaurant.reservations")),
):
    svc = RestaurantService(db)
    r = await svc.update_reservation(
        vid, UUID(reservation_id),
        guest_name=data.guest_name,
        guest_phone=data.guest_phone,
        guest_email=data.guest_email,
        reservation_date=data.reservation_date,
        reservation_time=data.reservation_time,
        party_size=data.party_size,
        table_id=UUID(data.table_id) if data.table_id else None,
        notes=data.notes,
        status=data.status,
    )
    if not r:
        raise HTTPException(404, "Reservation not found")
    tl = None
    if r.table_id:
        from app.models.restaurant import RestaurantTable
        t = await db.get(RestaurantTable, r.table_id)
        tl = t.label if t else None
    return JSONResponse(content=_reservation_dict(r, tl))


@router.patch("/reservations/{reservation_id}/status")
async def update_reservation_status(
    reservation_id: str,
    data: RestaurantReservationStatusUpdate,
    vid: UUID = Depends(_vendor_id),
    db: AsyncSession = Depends(get_db),
    _vu: VendorUser = Depends(require_permission("restaurant.reservations")),
):
    svc = RestaurantService(db)
    r = await svc.update_reservation_status(
        vid,
        UUID(reservation_id),
        data.status,
        table_id=UUID(data.table_id) if data.table_id else None,
    )
    if not r:
        raise HTTPException(404, "Reservation not found")
    tl = None
    if r.table_id:
        from app.models.restaurant import RestaurantTable
        t = await db.get(RestaurantTable, r.table_id)
        tl = t.label if t else None
    return JSONResponse(content=_reservation_dict(r, tl))


@router.post("/reservations/{reservation_id}/seat", status_code=201)
async def seat_reservation(
    reservation_id: str,
    data: RestaurantSeatReservationIn,
    vid: UUID = Depends(_vendor_id),
    db: AsyncSession = Depends(get_db),
    _vu: VendorUser = Depends(require_permission("restaurant.reservations")),
):
    svc = RestaurantService(db)
    try:
        r, order = await svc.seat_reservation(
            vid, UUID(reservation_id), UUID(data.table_id), covers=data.covers,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))
    tl = None
    if r.table_id:
        from app.models.restaurant import RestaurantTable
        t = await db.get(RestaurantTable, r.table_id)
        tl = t.label if t else None
    return JSONResponse(content={
        "reservation": _reservation_dict(r, tl),
        "order_id": str(order.id),
        "table_id": str(order.table_id) if order.table_id else None,
    }, status_code=201)


@router.get("/menu")
async def get_restaurant_menu_settings(vid: UUID = Depends(_vendor_id), db: AsyncSession = Depends(get_db)):
    svc = RestaurantService(db)
    settings = await svc.get_menu_settings(vid)
    products = await svc.list_dine_in_catalog(vid)
    return JSONResponse(content={
        **settings,
        "items": [
            {
                "id": str(p.id),
                "name": p.name,
                "category": p.category,
                "price": float(p.price or 0),
                "status": p.status,
            }
            for p in products
        ],
    })


@router.get("/dine-in-products")
async def list_dine_in_products(vid: UUID = Depends(_vendor_id), db: AsyncSession = Depends(get_db)):
    """Active products included on QR / staff dine-in catalog per menu settings."""
    svc = RestaurantService(db)
    products = await svc.list_dine_in_catalog(vid)
    return JSONResponse(content={
        "items": [
            {
                "id": str(p.id),
                "name": p.name,
                "sku": p.sku,
                "price": float(p.price or 0),
                "tax_rate": float(p.tax_rate or p.gst_rate or 0),
                "category": p.category,
                "item_type": "product",
            }
            for p in products
        ],
    })


@router.put("/menu")
async def update_restaurant_menu_settings(
    data: RestaurantMenuSettingsUpdate,
    vid: UUID = Depends(_vendor_id),
    db: AsyncSession = Depends(get_db),
    _vu: VendorUser = Depends(require_permission("restaurant.setup")),
):
    svc = RestaurantService(db)
    try:
        out = await svc.set_menu_settings(vid, data.mode, data.product_ids)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return JSONResponse(content=out)


@router.get("/kot-settings")
async def get_kot_settings(
    restaurant_id: str = Query(...),
    vid: UUID = Depends(_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    svc = RestaurantService(db)
    try:
        out = await svc.get_kot_settings(vid, UUID(restaurant_id))
    except ValueError as e:
        raise HTTPException(404, str(e))
    return JSONResponse(content=out)


@router.patch("/kot-settings")
async def update_kot_settings(
    data: RestaurantKOTSettingsUpdate,
    restaurant_id: str = Query(...),
    vid: UUID = Depends(_vendor_id),
    db: AsyncSession = Depends(get_db),
    _vu: VendorUser = Depends(require_permission("restaurant.setup")),
):
    svc = RestaurantService(db)
    try:
        out = await svc.set_kot_settings(
            vid,
            UUID(restaurant_id),
            mode=data.mode,
            start_number=data.start_number,
            end_number=data.end_number,
            reset=data.reset,
            next_number=data.next_number,
            reset_counter_now=data.reset_counter_now,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))
    return JSONResponse(content=out)


@router.delete("/reservations/{reservation_id}")
async def delete_reservation(reservation_id: str, vid: UUID = Depends(_vendor_id), db: AsyncSession = Depends(get_db)):
    svc = RestaurantService(db)
    ok = await svc.delete_reservation(vid, UUID(reservation_id))
    if not ok:
        raise HTTPException(404, "Reservation not found")
    return JSONResponse(content={"ok": True})


@router.post("/tables/{table_id}/generate-qr")
async def generate_table_qr(table_id: str, vid: UUID = Depends(_vendor_id), db: AsyncSession = Depends(get_db)):
    svc = RestaurantService(db)
    t = await svc.generate_qr_token(vid, UUID(table_id))
    if not t:
        raise HTTPException(404, "Table not found")
    return JSONResponse(content={"id": str(t.id), "qr_token": t.qr_token})


@router.patch("/kitchen-tickets/{txn_id}")
async def patch_kitchen_ticket(
    txn_id: str,
    data: KitchenTicketStatusUpdate,
    vid: UUID = Depends(_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    svc = RestaurantService(db)
    try:
        txn = await svc.update_kitchen_ticket_status(vid, UUID(txn_id), data.kitchen_ticket_status)
    except ValueError as e:
        raise HTTPException(400, str(e))
    if not txn:
        raise HTTPException(404, "Kitchen ticket not found")
    return JSONResponse(content={
        "transaction_id": str(txn.id),
        "kitchen_ticket_status": txn.kitchen_ticket_status,
    })
