from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.database import get_db
from app.services.coupon_service import CouponService
from app.schemas.coupon import CouponValidate

router = APIRouter()


def _coupon_public(c) -> dict:
    return {
        "id": str(c.id), "code": c.code, "title": c.title, "description": c.description,
        "discount_type": c.discount_type, "discount_value": float(c.discount_value or 0),
        "max_discount": float(c.max_discount) if c.max_discount else None,
        "min_order_amount": float(c.min_order_amount or 0),
        "applicable_to": c.applicable_to,
        "expires_at": c.expires_at.isoformat() if c.expires_at else None,
    }


def _get_vendor_id(request: Request) -> UUID:
    vid = request.headers.get("X-Vendor-Id")
    if not vid:
        raise HTTPException(400, "Vendor context required")
    return UUID(vid)


@router.get("")
async def list_public_coupons(request: Request, db: AsyncSession = Depends(get_db)):
    vid = _get_vendor_id(request)
    svc = CouponService(db)
    coupons = await svc.get_public_coupons(vid)
    return JSONResponse(content={"items": [_coupon_public(c) for c in coupons]})


@router.post("/validate")
async def validate_coupon(data: CouponValidate, request: Request, db: AsyncSession = Depends(get_db)):
    vid = _get_vendor_id(request)
    svc = CouponService(db)
    result = await svc.validate_coupon(vid, data.code, data.order_total)
    resp = {"valid": result["valid"], "discount_amount": result["discount_amount"], "message": result["message"]}
    if result.get("coupon"):
        resp["coupon"] = _coupon_public(result["coupon"])
    return JSONResponse(content=resp)
