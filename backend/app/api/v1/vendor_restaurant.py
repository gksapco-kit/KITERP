from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.deps import get_current_active_user
from app.models.user import User
from app.services.vendor_service import VendorService
from app.services.restaurant_service import RestaurantService
from app.schemas.restaurant import (
    RestaurantZoneCreate,
    RestaurantZoneUpdate,
    RestaurantTableCreate,
    RestaurantTableUpdate,
    KitchenTicketStatusUpdate,
)

router = APIRouter()


async def _vendor_id(current_user: User = Depends(get_current_active_user), db: AsyncSession = Depends(get_db)) -> UUID:
    svc = VendorService(db)
    vendor = await svc.get_by_user_id(current_user.id)
    if not vendor:
        raise HTTPException(404, "No vendor found")
    return vendor.id


def _zone_dict(z):
    return {
        "id": str(z.id),
        "vendor_id": str(z.vendor_id),
        "name": z.name,
        "sort_order": z.sort_order or 0,
        "created_at": z.created_at.isoformat() if z.created_at else None,
    }


def _table_dict(t, zone_name=None):
    return {
        "id": str(t.id),
        "vendor_id": str(t.vendor_id),
        "zone_id": str(t.zone_id) if t.zone_id else None,
        "zone_name": zone_name,
        "label": t.label,
        "capacity": t.capacity or 4,
        "sort_order": t.sort_order or 0,
        "is_active": t.is_active if t.is_active is not None else True,
        "created_at": t.created_at.isoformat() if t.created_at else None,
    }


@router.get("/zones")
async def list_zones(vid: UUID = Depends(_vendor_id), db: AsyncSession = Depends(get_db)):
    svc = RestaurantService(db)
    zones = await svc.list_zones(vid)
    return JSONResponse(content={"items": [_zone_dict(z) for z in zones]})


@router.post("/zones", status_code=201)
async def create_zone(data: RestaurantZoneCreate, vid: UUID = Depends(_vendor_id), db: AsyncSession = Depends(get_db)):
    svc = RestaurantService(db)
    z = await svc.create_zone(vid, data.name, data.sort_order or 0)
    return JSONResponse(content=_zone_dict(z), status_code=201)


@router.patch("/zones/{zone_id}")
async def update_zone(zone_id: str, data: RestaurantZoneUpdate, vid: UUID = Depends(_vendor_id), db: AsyncSession = Depends(get_db)):
    svc = RestaurantService(db)
    z = await svc.update_zone(vid, UUID(zone_id), name=data.name, sort_order=data.sort_order)
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


@router.get("/tables")
async def list_tables(zone_id: str | None = Query(None), vid: UUID = Depends(_vendor_id), db: AsyncSession = Depends(get_db)):
    svc = RestaurantService(db)
    zid = UUID(zone_id) if zone_id else None
    rows = await svc.list_tables(vid, zone_id=zid)
    return JSONResponse(content={"items": [_table_dict(t, zn) for t, zn in rows]})


@router.post("/tables", status_code=201)
async def create_table(data: RestaurantTableCreate, vid: UUID = Depends(_vendor_id), db: AsyncSession = Depends(get_db)):
    svc = RestaurantService(db)
    try:
        zid = UUID(data.zone_id) if data.zone_id else None
        t = await svc.create_table(
            vid,
            data.label,
            zone_id=zid,
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


@router.delete("/tables/{table_id}")
async def delete_table(table_id: str, vid: UUID = Depends(_vendor_id), db: AsyncSession = Depends(get_db)):
    svc = RestaurantService(db)
    ok = await svc.delete_table(vid, UUID(table_id))
    if not ok:
        raise HTTPException(404, "Table not found")
    return JSONResponse(content={"ok": True})


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
