from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
import math

from app.database import get_db
from app.api.deps import get_current_active_user
from app.models.user import User
from app.services.vendor_service import VendorService
from app.services.coupon_service import CouponService
from app.schemas.coupon import CouponCreate, CouponUpdate, CouponValidate

router = APIRouter()


async def _vendor_id(current_user: User = Depends(get_current_active_user), db: AsyncSession = Depends(get_db)) -> UUID:
    svc = VendorService(db)
    vendor = await svc.get_by_user_id(current_user.id)
    if not vendor:
        raise HTTPException(404, "No vendor found")
    return vendor.id


def _coupon_dict(c) -> dict:
    return {
        "id": str(c.id), "vendor_id": str(c.vendor_id),
        "store_id": str(c.store_id) if getattr(c, "store_id", None) else None,
        "code": c.code, "title": c.title, "description": c.description,
        "discount_type": c.discount_type, "discount_value": float(c.discount_value or 0),
        "max_discount": float(c.max_discount) if c.max_discount else None,
        "min_order_amount": float(c.min_order_amount or 0),
        "usage_limit": c.usage_limit, "usage_per_customer": c.usage_per_customer,
        "times_used": c.times_used or 0,
        "applicable_to": c.applicable_to, "applicable_ids": c.applicable_ids or [],
        "starts_at": c.starts_at.isoformat() if c.starts_at else None,
        "expires_at": c.expires_at.isoformat() if c.expires_at else None,
        "is_active": c.is_active, "is_public": c.is_public,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }


@router.get("")
async def list_coupons(is_active: bool = None, store_id: str = None, page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), vid: UUID = Depends(_vendor_id), db: AsyncSession = Depends(get_db)):
    svc = CouponService(db)
    items, total = await svc.list_coupons(vid, is_active, page, size, store_id=store_id)
    return JSONResponse(content={"items": [_coupon_dict(c) for c in items], "total": total, "page": page, "size": size, "pages": math.ceil(total / size) if total else 0})


@router.post("", status_code=201)
async def create_coupon(data: CouponCreate, vid: UUID = Depends(_vendor_id), db: AsyncSession = Depends(get_db)):
    svc = CouponService(db)
    try:
        c = await svc.create_coupon(vid, data.model_dump())
        return JSONResponse(content=_coupon_dict(c), status_code=201)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.put("/{coupon_id}")
async def update_coupon(coupon_id: str, data: CouponUpdate, vid: UUID = Depends(_vendor_id), db: AsyncSession = Depends(get_db)):
    svc = CouponService(db)
    try:
        c = await svc.update_coupon(UUID(coupon_id), vid, data.model_dump(exclude_unset=True))
        return JSONResponse(content=_coupon_dict(c))
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.delete("/{coupon_id}", status_code=204)
async def delete_coupon(coupon_id: str, vid: UUID = Depends(_vendor_id), db: AsyncSession = Depends(get_db)):
    svc = CouponService(db)
    try:
        await svc.delete_coupon(UUID(coupon_id), vid)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/validate")
async def validate_coupon(data: CouponValidate, vid: UUID = Depends(_vendor_id), db: AsyncSession = Depends(get_db)):
    svc = CouponService(db)
    result = await svc.validate_coupon(vid, data.code, data.order_total)
    resp = {"valid": result["valid"], "discount_amount": result["discount_amount"], "message": result["message"]}
    if result.get("coupon"):
        resp["coupon"] = _coupon_dict(result["coupon"])
    return JSONResponse(content=resp)
