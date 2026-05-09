import math
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.database import get_db
from app.api.deps import get_current_active_user
from app.models.user import User
from app.services.vendor_service import VendorService
from app.services.loyalty_service import LoyaltyService
from app.schemas.loyalty import LoyaltyProgramUpdate, LoyaltyRedeemRequest, LoyaltyAdjustRequest

router = APIRouter()


async def _vendor_id(current_user: User = Depends(get_current_active_user), db: AsyncSession = Depends(get_db)) -> UUID:
    svc = VendorService(db)
    vendor = await svc.get_by_user_id(current_user.id)
    if not vendor:
        raise HTTPException(404, "No vendor found")
    return vendor.id


def _program_dict(p) -> dict:
    return {
        "id": str(p.id),
        "vendor_id": str(p.vendor_id),
        "is_active": p.is_active,
        "name": p.name,
        "points_per_currency": float(p.points_per_currency or 1),
        "currency_per_point": float(p.currency_per_point or 1),
        "min_redeem_points": p.min_redeem_points or 100,
        "max_redeem_percent": p.max_redeem_percent or 50,
        "signup_bonus": p.signup_bonus or 0,
        "tier_config": p.tier_config or [],
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


def _account_dict(a) -> dict:
    return {
        "id": str(a.id),
        "vendor_id": str(a.vendor_id),
        "customer_id": str(a.customer_id),
        "points_balance": a.points_balance or 0,
        "lifetime_earned": a.lifetime_earned or 0,
        "lifetime_redeemed": a.lifetime_redeemed or 0,
        "tier": a.tier or "standard",
        "created_at": a.created_at.isoformat() if a.created_at else None,
    }


def _txn_dict(t) -> dict:
    return {
        "id": str(t.id),
        "type": t.type,
        "points": t.points,
        "balance_after": t.balance_after,
        "description": t.description,
        "reference_type": t.reference_type,
        "reference_id": str(t.reference_id) if t.reference_id else None,
        "created_at": t.created_at.isoformat() if t.created_at else None,
    }


# ── Program ──────────────────────────────────────────────────────

@router.get("/program")
async def get_program(vid: UUID = Depends(_vendor_id), db: AsyncSession = Depends(get_db)):
    svc = LoyaltyService(db)
    prog = await svc.get_or_create_program(vid)
    return JSONResponse(content=_program_dict(prog))


@router.put("/program")
async def update_program(data: LoyaltyProgramUpdate, vid: UUID = Depends(_vendor_id), db: AsyncSession = Depends(get_db)):
    svc = LoyaltyService(db)
    prog = await svc.update_program(vid, data.model_dump(exclude_unset=True))
    return JSONResponse(content=_program_dict(prog))


# ── Accounts ─────────────────────────────────────────────────────

@router.get("/accounts")
async def list_accounts(
    page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100),
    vid: UUID = Depends(_vendor_id), db: AsyncSession = Depends(get_db),
):
    svc = LoyaltyService(db)
    items, total = await svc.list_accounts(vid, page, size)
    return JSONResponse(content={
        "items": [_account_dict(a) for a in items],
        "total": total, "page": page, "size": size,
        "pages": math.ceil(total / size) if total else 0,
    })


@router.get("/accounts/{customer_id}")
async def get_customer_account(customer_id: str, vid: UUID = Depends(_vendor_id), db: AsyncSession = Depends(get_db)):
    svc = LoyaltyService(db)
    acct = await svc.get_or_create_account(vid, UUID(customer_id))
    return JSONResponse(content=_account_dict(acct))


@router.get("/accounts/{customer_id}/transactions")
async def get_customer_transactions(
    customer_id: str, page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100),
    vid: UUID = Depends(_vendor_id), db: AsyncSession = Depends(get_db),
):
    svc = LoyaltyService(db)
    items, total = await svc.get_customer_transactions(vid, UUID(customer_id), page, size)
    return JSONResponse(content={
        "items": [_txn_dict(t) for t in items],
        "total": total, "page": page, "size": size,
        "pages": math.ceil(total / size) if total else 0,
    })


# ── Redeem / Adjust ──────────────────────────────────────────────

@router.post("/redeem")
async def redeem_points(data: LoyaltyRedeemRequest, vid: UUID = Depends(_vendor_id), db: AsyncSession = Depends(get_db)):
    svc = LoyaltyService(db)
    try:
        txn, discount = await svc.redeem_points(vid, UUID(data.customer_id), data.points)
        return JSONResponse(content={"transaction": _txn_dict(txn), "discount_value": discount})
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/adjust")
async def adjust_points(data: LoyaltyAdjustRequest, vid: UUID = Depends(_vendor_id), db: AsyncSession = Depends(get_db)):
    svc = LoyaltyService(db)
    txn = await svc.adjust_points(vid, UUID(data.customer_id), data.points, data.description)
    return JSONResponse(content=_txn_dict(txn))
