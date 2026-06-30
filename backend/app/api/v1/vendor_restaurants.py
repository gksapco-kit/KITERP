"""CRUD for restaurant outlets — each restaurant is tagged under a Store (Business Unit)."""
from uuid import UUID
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.deps import require_permission
from app.models.vendor_user import VendorUser
from app.models.restaurant import Restaurant
from app.models.store import Store

router = APIRouter()


# ── Pydantic schemas ────────────────────────────────────────────────────────

class RestaurantCreate(BaseModel):
    store_id: str
    name: str
    code: Optional[str] = None
    cuisine: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[dict] = None
    settings: Optional[dict] = None
    is_active: bool = True


class RestaurantUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    cuisine: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[dict] = None
    settings: Optional[dict] = None
    is_active: Optional[bool] = None
    is_default: Optional[bool] = None


# ── Helpers ─────────────────────────────────────────────────────────────────

def _restaurant_dict(r: Restaurant) -> dict:
    return {
        "id": str(r.id),
        "vendor_id": str(r.vendor_id),
        "store_id": str(r.store_id),
        "name": r.name,
        "code": r.code,
        "cuisine": r.cuisine,
        "phone": r.phone,
        "email": r.email,
        "address": r.address or {},
        "settings": r.settings or {},
        "is_active": r.is_active,
        "is_default": r.is_default,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
    }


async def _get_vendor_id(
    vu: VendorUser = Depends(require_permission("restaurant.view")),
) -> UUID:
    return vu.vendor_id


# ── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/restaurants")
async def list_restaurants(
    store_id: Optional[str] = Query(None),
    vid: UUID = Depends(_get_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    q = select(Restaurant).where(Restaurant.vendor_id == vid).order_by(Restaurant.is_default.desc(), Restaurant.name)
    if store_id:
        q = q.where(Restaurant.store_id == UUID(store_id))
    r = await db.execute(q)
    items = r.scalars().all()
    return JSONResponse(content={"items": [_restaurant_dict(x) for x in items]})


@router.post("/restaurants", status_code=201)
async def create_restaurant(
    data: RestaurantCreate,
    vu: VendorUser = Depends(require_permission("restaurant.setup")),
    db: AsyncSession = Depends(get_db),
):
    vid = vu.vendor_id
    # Validate store belongs to vendor
    store = await db.get(Store, UUID(data.store_id))
    if not store or store.vendor_id != vid:
        raise HTTPException(400, "Invalid store")

    # First restaurant for vendor+store is default
    existing = await db.execute(
        select(Restaurant).where(Restaurant.vendor_id == vid, Restaurant.store_id == UUID(data.store_id)).limit(1)
    )
    is_first = existing.scalar_one_or_none() is None

    r = Restaurant(
        vendor_id=vid,
        store_id=UUID(data.store_id),
        name=data.name.strip(),
        code=data.code,
        cuisine=data.cuisine,
        phone=data.phone,
        email=data.email,
        address=data.address or {},
        settings=data.settings or {},
        is_active=data.is_active,
        is_default=is_first,
    )
    db.add(r)
    await db.commit()
    await db.refresh(r)
    return JSONResponse(content=_restaurant_dict(r), status_code=201)


@router.get("/restaurants/{restaurant_id}")
async def get_restaurant(
    restaurant_id: str,
    vid: UUID = Depends(_get_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    r = await db.get(Restaurant, UUID(restaurant_id))
    if not r or r.vendor_id != vid:
        raise HTTPException(404, "Restaurant not found")
    return JSONResponse(content=_restaurant_dict(r))


@router.patch("/restaurants/{restaurant_id}")
async def update_restaurant(
    restaurant_id: str,
    data: RestaurantUpdate,
    vu: VendorUser = Depends(require_permission("restaurant.setup")),
    db: AsyncSession = Depends(get_db),
):
    vid = vu.vendor_id
    r = await db.get(Restaurant, UUID(restaurant_id))
    if not r or r.vendor_id != vid:
        raise HTTPException(404, "Restaurant not found")

    if data.name is not None:
        r.name = data.name.strip()
    if data.code is not None:
        r.code = data.code
    if data.cuisine is not None:
        r.cuisine = data.cuisine
    if data.phone is not None:
        r.phone = data.phone
    if data.email is not None:
        r.email = data.email
    if data.address is not None:
        r.address = data.address
    if data.settings is not None:
        r.settings = data.settings
    if data.is_active is not None:
        r.is_active = data.is_active
    if data.is_default is True:
        # Unset all others for this store
        others = await db.execute(
            select(Restaurant).where(
                Restaurant.vendor_id == vid,
                Restaurant.store_id == r.store_id,
                Restaurant.id != r.id,
            )
        )
        for other in others.scalars().all():
            other.is_default = False
        r.is_default = True

    await db.commit()
    await db.refresh(r)
    return JSONResponse(content=_restaurant_dict(r))


@router.delete("/restaurants/{restaurant_id}")
async def delete_restaurant(
    restaurant_id: str,
    vu: VendorUser = Depends(require_permission("restaurant.setup")),
    db: AsyncSession = Depends(get_db),
):
    vid = vu.vendor_id
    r = await db.get(Restaurant, UUID(restaurant_id))
    if not r or r.vendor_id != vid:
        raise HTTPException(404, "Restaurant not found")
    if r.is_default:
        raise HTTPException(400, "Cannot delete the default restaurant. Set another as default first.")
    await db.delete(r)
    await db.commit()
    return JSONResponse(content={"ok": True})
