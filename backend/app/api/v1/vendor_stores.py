# app/api/v1/vendor_stores.py
"""Multi-store management — create stores, manage per-store inventory, assign staff."""
from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.user import User
from app.models.store import Store, StoreInventory
from app.models.vendor import Vendor
from app.models.vendor_user import VendorUser
from app.models.vendor_product import Product
from app.api.deps import get_current_active_user
from app.services.vendor_service import VendorService
from app.utils.store_codes import (
    allocate_default_business_store_code,
    allocate_unique_store_code,
    ensure_default_store_if_missing,
)

router = APIRouter()


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _get_vendor_id(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> UUID:
    svc = VendorService(db)
    vendor = await svc.get_by_user_id(current_user.id)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return vendor.id


async def _get_store_or_404(store_id: UUID, vendor_id: UUID, db: AsyncSession) -> Store:
    result = await db.execute(
        select(Store)
        .where(Store.id == store_id, Store.vendor_id == vendor_id)
        .options(selectinload(Store.staff).selectinload(VendorUser.user))
    )
    store = result.scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    return store


def _store_to_dict(s: Store, include_staff: bool = False) -> dict:
    d = {
        "id": str(s.id),
        "vendor_id": str(s.vendor_id),
        "name": s.name,
        "code": s.code,
        "description": s.description,
        "phone": s.phone,
        "email": s.email,
        "address": s.address or {},
        "manager_id": str(s.manager_id) if s.manager_id else None,
        "is_active": s.is_active,
        "is_default": s.is_default,
        "settings": s.settings or {},
        "created_at": s.created_at.isoformat() if s.created_at else None,
        "updated_at": s.updated_at.isoformat() if s.updated_at else None,
    }
    if include_staff and hasattr(s, "staff") and s.staff:
        d["staff"] = [
            {
                "id": str(vu.id),
                "user_id": str(vu.user_id),
                "role": vu.role,
                "is_active": vu.is_active,
                "name": vu.user.full_name if vu.user else None,
                "email": vu.user.email if vu.user else None,
            }
            for vu in s.staff
        ]
    return d


# ── Schemas ───────────────────────────────────────────────────────────────────

class AddressSchema(BaseModel):
    street: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    country: Optional[str] = "India"
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class StoreCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    code: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = None
    phone: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = None
    address: Optional[AddressSchema] = None
    manager_id: Optional[str] = None
    is_default: Optional[bool] = False
    settings: Optional[dict] = {}


class StoreUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=200)
    code: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[AddressSchema] = None
    manager_id: Optional[str] = None
    is_active: Optional[bool] = None
    is_default: Optional[bool] = None
    settings: Optional[dict] = None


class StoreInventoryUpdate(BaseModel):
    quantity: int = Field(..., ge=0)
    low_stock_threshold: Optional[int] = Field(5, ge=0)


class StockTransferCreate(BaseModel):
    from_store_id: str
    to_store_id: str
    product_id: str
    variant_id: Optional[str] = None
    quantity: int = Field(..., gt=0)
    reason: Optional[str] = None


class AssignStaffStore(BaseModel):
    staff_id: str       # vendor_user.id
    store_id: Optional[str] = None   # None = unassign


# ── Store CRUD ────────────────────────────────────────────────────────────────

@router.get("/stores")
async def list_stores(
    vendor_id: UUID = Depends(_get_vendor_id),
    db: AsyncSession = Depends(get_db),
    is_active: Optional[bool] = Query(None),
):
    vrow = await db.execute(select(Vendor).where(Vendor.id == vendor_id))
    vendor = vrow.scalar_one_or_none()
    loc = (
        (vendor.display_name or vendor.business_name or "Main location")[:200]
        if vendor
        else "Main location"
    )
    if await ensure_default_store_if_missing(db, vendor_id, loc):
        await db.commit()

    q = select(Store).where(Store.vendor_id == vendor_id)
    if is_active is not None:
        q = q.where(Store.is_active == is_active)
    q = q.order_by(Store.is_default.desc(), Store.name)

    result = await db.execute(q)
    stores = result.scalars().all()

    # enrich with inventory counts
    out = []
    for s in stores:
        inv_count = (await db.execute(
            select(func.count()).where(StoreInventory.store_id == s.id, StoreInventory.quantity > 0)
        )).scalar() or 0
        staff_count = (await db.execute(
            select(func.count()).where(VendorUser.store_id == s.id, VendorUser.is_active == True)
        )).scalar() or 0
        d = _store_to_dict(s)
        d["inventory_count"] = inv_count
        d["staff_count"] = staff_count
        out.append(d)

    return {"stores": out, "total": len(out)}


@router.post("/stores", status_code=201)
async def create_store(
    data: StoreCreate,
    vendor_id: UUID = Depends(_get_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    count_res = await db.execute(
        select(func.count()).select_from(Store).where(Store.vendor_id == vendor_id)
    )
    store_count_before = count_res.scalar_one() or 0

    raw_code = (data.code or "").strip()
    if raw_code:
        code = raw_code
    elif store_count_before == 0:
        code = await allocate_default_business_store_code(db, vendor_id)
    else:
        code = await allocate_unique_store_code(db, vendor_id, data.name)

    is_default = bool(data.is_default)
    if store_count_before == 0:
        is_default = True

    # If set as default, unset others
    if is_default:
        await db.execute(
            update(Store).where(Store.vendor_id == vendor_id).values(is_default=False)
        )

    store = Store(
        vendor_id=vendor_id,
        name=data.name,
        code=code,
        description=data.description,
        phone=data.phone,
        email=data.email,
        address=data.address.model_dump(exclude_none=True) if data.address else {},
        manager_id=UUID(data.manager_id) if data.manager_id else None,
        is_default=is_default,
        settings=data.settings or {},
    )
    db.add(store)
    await db.commit()
    await db.refresh(store)
    return {"store": _store_to_dict(store), "message": "Store created"}


@router.get("/stores/{store_id}")
async def get_store(
    store_id: UUID,
    vendor_id: UUID = Depends(_get_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    store = await _get_store_or_404(store_id, vendor_id, db)
    return {"store": _store_to_dict(store, include_staff=True)}


@router.put("/stores/{store_id}")
async def update_store(
    store_id: UUID,
    data: StoreUpdate,
    vendor_id: UUID = Depends(_get_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    store = await _get_store_or_404(store_id, vendor_id, db)

    if data.is_default:
        await db.execute(
            update(Store).where(Store.vendor_id == vendor_id, Store.id != store_id).values(is_default=False)
        )

    update_data = data.model_dump(exclude_unset=True)
    if "address" in update_data and update_data["address"]:
        update_data["address"] = {k: v for k, v in update_data["address"].items() if v is not None}
    if "settings" in update_data and update_data["settings"] is not None:
        merged_settings = dict(store.settings or {})
        merged_settings.update(update_data["settings"])
        update_data["settings"] = merged_settings
    if "manager_id" in update_data and update_data["manager_id"]:
        update_data["manager_id"] = UUID(update_data["manager_id"])

    for k, v in update_data.items():
        setattr(store, k, v)

    await db.commit()
    await db.refresh(store)
    return {"store": _store_to_dict(store), "message": "Store updated"}


@router.delete("/stores/{store_id}", status_code=204)
async def delete_store(
    store_id: UUID,
    vendor_id: UUID = Depends(_get_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    store = await _get_store_or_404(store_id, vendor_id, db)
    if store.is_default:
        raise HTTPException(status_code=400, detail="Cannot delete the default store. Set another store as default first.")
    await db.delete(store)
    await db.commit()


# ── Store Inventory ───────────────────────────────────────────────────────────

@router.get("/stores/{store_id}/inventory")
async def get_store_inventory(
    store_id: UUID,
    vendor_id: UUID = Depends(_get_vendor_id),
    db: AsyncSession = Depends(get_db),
    search: Optional[str] = Query(None),
    low_stock_only: bool = Query(False),
    page: int = Query(1, ge=1),
    size: int = Query(30, ge=1, le=100),
):
    await _get_store_or_404(store_id, vendor_id, db)

    q = (
        select(StoreInventory, Product)
        .join(Product, StoreInventory.product_id == Product.id)
        .where(StoreInventory.store_id == store_id, StoreInventory.vendor_id == vendor_id)
    )
    if search:
        q = q.where(Product.name.ilike(f"%{search}%"))
    if low_stock_only:
        q = q.where(StoreInventory.quantity <= StoreInventory.low_stock_threshold)

    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar() or 0
    q = q.order_by(Product.name).offset((page - 1) * size).limit(size)
    rows = (await db.execute(q)).all()

    items = [
        {
            "id": str(inv.id),
            "product_id": str(inv.product_id),
            "variant_id": str(inv.variant_id) if inv.variant_id else None,
            "quantity": inv.quantity,
            "low_stock_threshold": inv.low_stock_threshold,
            "product_name": prod.name,
            "product_sku": prod.sku,
            "updated_at": inv.updated_at.isoformat() if inv.updated_at else None,
        }
        for inv, prod in rows
    ]
    return {"items": items, "total": total, "page": page, "size": size}


@router.put("/stores/{store_id}/inventory/{product_id}")
async def set_store_inventory(
    store_id: UUID,
    product_id: UUID,
    data: StoreInventoryUpdate,
    vendor_id: UUID = Depends(_get_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    await _get_store_or_404(store_id, vendor_id, db)

    result = await db.execute(
        select(StoreInventory).where(
            StoreInventory.store_id == store_id,
            StoreInventory.product_id == product_id,
            StoreInventory.variant_id == None,
        )
    )
    inv = result.scalar_one_or_none()
    if inv:
        inv.quantity = data.quantity
        inv.low_stock_threshold = data.low_stock_threshold or 5
    else:
        inv = StoreInventory(
            store_id=store_id,
            vendor_id=vendor_id,
            product_id=product_id,
            quantity=data.quantity,
            low_stock_threshold=data.low_stock_threshold or 5,
        )
        db.add(inv)

    await db.flush()

    # Sync product.quantity to the sum of all store inventories for this product
    # so the Products list and Inventory summary reflect the correct total
    total_result = await db.execute(
        select(func.coalesce(func.sum(StoreInventory.quantity), 0)).where(
            StoreInventory.product_id == product_id,
            StoreInventory.vendor_id == vendor_id,
            StoreInventory.variant_id == None,
        )
    )
    total_qty = total_result.scalar() or 0

    product_row = await db.get(Product, product_id)
    if product_row:
        product_row.quantity = total_qty
        if total_qty > 0 and product_row.stock_status == 'out_of_stock':
            product_row.stock_status = 'in_stock'

    await db.commit()
    return {"message": "Inventory updated", "quantity": data.quantity}


# ── Stock Transfer Between Stores ─────────────────────────────────────────────

@router.post("/stores/transfer")
async def transfer_stock(
    data: StockTransferCreate,
    vendor_id: UUID = Depends(_get_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    from_id = UUID(data.from_store_id)
    to_id = UUID(data.to_store_id)
    prod_id = UUID(data.product_id)
    var_id = UUID(data.variant_id) if data.variant_id else None

    if from_id == to_id:
        raise HTTPException(status_code=400, detail="Source and destination stores must be different")

    # validate both stores belong to this vendor
    for sid in [from_id, to_id]:
        s = (await db.execute(select(Store).where(Store.id == sid, Store.vendor_id == vendor_id))).scalar_one_or_none()
        if not s:
            raise HTTPException(status_code=404, detail=f"Store {sid} not found")

    # get source inventory
    q = select(StoreInventory).where(
        StoreInventory.store_id == from_id,
        StoreInventory.product_id == prod_id,
        StoreInventory.variant_id == var_id,
    )
    from_inv = (await db.execute(q)).scalar_one_or_none()
    if not from_inv or from_inv.quantity < data.quantity:
        raise HTTPException(status_code=400, detail=f"Insufficient stock. Available: {from_inv.quantity if from_inv else 0}")

    # deduct from source
    from_inv.quantity -= data.quantity

    # add to destination
    q2 = select(StoreInventory).where(
        StoreInventory.store_id == to_id,
        StoreInventory.product_id == prod_id,
        StoreInventory.variant_id == var_id,
    )
    to_inv = (await db.execute(q2)).scalar_one_or_none()
    if to_inv:
        to_inv.quantity += data.quantity
    else:
        to_inv = StoreInventory(
            store_id=to_id,
            vendor_id=vendor_id,
            product_id=prod_id,
            variant_id=var_id,
            quantity=data.quantity,
        )
        db.add(to_inv)

    await db.commit()
    return {
        "message": "Stock transferred successfully",
        "transferred_qty": data.quantity,
        "from_store_remaining": from_inv.quantity,
    }


# ── Staff Assignment ──────────────────────────────────────────────────────────

@router.post("/stores/assign-staff")
async def assign_staff_to_store(
    data: AssignStaffStore,
    vendor_id: UUID = Depends(_get_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    vu = (await db.execute(
        select(VendorUser).where(VendorUser.id == UUID(data.staff_id), VendorUser.vendor_id == vendor_id)
    )).scalar_one_or_none()
    if not vu:
        raise HTTPException(status_code=404, detail="Team member not found")

    if data.store_id:
        store = (await db.execute(
            select(Store).where(Store.id == UUID(data.store_id), Store.vendor_id == vendor_id)
        )).scalar_one_or_none()
        if not store:
            raise HTTPException(status_code=404, detail="Store not found")
        vu.store_id = UUID(data.store_id)
    else:
        vu.store_id = None  # unassign

    await db.commit()
    return {"message": "Staff assignment updated", "store_id": data.store_id}


@router.get("/stores/{store_id}/staff")
async def get_store_staff(
    store_id: UUID,
    vendor_id: UUID = Depends(_get_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    await _get_store_or_404(store_id, vendor_id, db)

    result = await db.execute(
        select(VendorUser)
        .where(VendorUser.store_id == store_id, VendorUser.vendor_id == vendor_id)
        .options(selectinload(VendorUser.user))
    )
    members = result.scalars().all()

    return {
        "staff": [
            {
                "id": str(vu.id),
                "user_id": str(vu.user_id),
                "role": vu.role,
                "is_active": vu.is_active,
                "name": vu.user.full_name if vu.user else None,
                "email": vu.user.email if vu.user else None,
                "phone": vu.user.phone if vu.user else None,
            }
            for vu in members
        ]
    }
