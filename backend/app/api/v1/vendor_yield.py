# app/api/v1/vendor_yield.py
"""Cutting yield profiles, yield products for the cutting sheet, and the daily yield close."""
from datetime import date as date_type, datetime, timezone
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_active_user, get_current_vendor_id, require_permission
from app.database import get_db
from app.models.user import User
from app.models.vendor_product import Product
from app.models.yield_management import YieldDayClose, YieldProfile, YieldProfileLine
from app.services.shared_stock import (
    resolved_base_kg,
    shared_pool_unit,
    uses_shared_weight_stock,
)
from app.services.yield_service import (
    close_to_dict,
    compute_day,
    output_per_sale,
    post_count_adjustment,
)

router = APIRouter()

_view_products = [Depends(require_permission("products.view"))]
_edit_products = [Depends(require_permission("products.edit"))]
_view_inventory = [Depends(require_permission("inventory.view"))]
_manage_inventory = [Depends(require_permission("inventory.manage"))]

# Typical raw input per 1 kg of finished cut. Starting points only — every shop tunes them.
PROFILE_TEMPLATES = [
    {
        "name": "Chicken", "category": "Chicken", "input_uom": "kg",
        "lines": [
            {"cut_name": "Whole with skin", "input_per_output": 1.0},
            {"cut_name": "Skinless curry cut", "input_per_output": 1.5, "byproduct": "Skin"},
            {"cut_name": "Boneless", "input_per_output": 1.3, "byproduct": "Bones", "part_per_raw": 0.25, "part_uom": "kg"},
            {"cut_name": "Bone", "input_per_output": 2, "part_per_raw": 0.5, "part_uom": "kg"},
            {"cut_name": "Leg pieces", "input_per_output": 1.25, "part_per_raw": 1, "part_uom": "piece"},
            {"cut_name": "Breast", "input_per_output": 1.35},
            {"cut_name": "Wings", "input_per_output": 1.15},
        ],
    },
    {
        "name": "Mutton", "category": "Mutton", "input_uom": "kg",
        "lines": [
            {"cut_name": "Curry cut", "input_per_output": 1.1},
            {"cut_name": "Boneless", "input_per_output": 1.45, "byproduct": "Bones"},
            {"cut_name": "Keema (mince)", "input_per_output": 1.5},
            {"cut_name": "Chops", "input_per_output": 1.15},
        ],
    },
    {
        "name": "Fish", "category": "Fish", "input_uom": "kg",
        "lines": [
            {"cut_name": "Cleaned, curry cut", "input_per_output": 1.3, "byproduct": "Head & scales"},
            {"cut_name": "Steaks", "input_per_output": 1.4},
            {"cut_name": "Fillet", "input_per_output": 2.0, "byproduct": "Head & bones"},
        ],
    },
    {
        "name": "Prawns", "category": "Seafood", "input_uom": "kg",
        "lines": [
            {"cut_name": "Peeled", "input_per_output": 1.6, "byproduct": "Shells"},
            {"cut_name": "Peeled & deveined", "input_per_output": 1.8, "byproduct": "Shells"},
        ],
    },
]


# ── Schemas ──────────────────────────────────────────────────────

class YieldLineIn(BaseModel):
    cut_name: str = Field(..., min_length=1, max_length=100)
    input_per_output: float = Field(..., gt=0, le=1_000_000)
    input_uom: Optional[str] = Field(None, max_length=30)
    part_per_raw: Optional[float] = Field(None, gt=0, le=1_000_000)
    part_uom: Optional[str] = Field(None, max_length=30)
    rounding_step: Optional[float] = Field(None, gt=0)
    byproduct: Optional[str] = Field(None, max_length=150)


class YieldProfileIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    category: Optional[str] = Field(None, max_length=100)
    input_uom: str = Field("kg", max_length=30)
    description: Optional[str] = None
    is_active: bool = True
    lines: List[YieldLineIn] = []


class DayCloseIn(BaseModel):
    product_id: UUID
    business_date: date_type
    closing_physical_qty: float = Field(..., ge=0)
    raw_cost_per_unit: Optional[float] = Field(None, ge=0)
    tz_offset: int = Field(330, ge=-720, le=840)
    adjust_stock: bool = True
    notes: Optional[str] = None


# ── Helpers ──────────────────────────────────────────────────────

def _profile_to_dict(p: YieldProfile) -> dict:
    return {
        "id": str(p.id),
        "name": p.name,
        "category": p.category,
        "input_uom": p.input_uom or "kg",
        "description": p.description,
        "is_active": bool(p.is_active),
        "lines": [
            {
                "id": str(l.id),
                "cut_name": l.cut_name,
                "input_uom": l.input_uom or p.input_uom or "kg",
                "input_per_output": float(l.input_per_output),
                "part_per_raw": float(l.part_per_raw) if l.part_per_raw is not None else None,
                "part_uom": l.part_uom,
                "yield_pct": round(100 / float(l.input_per_output), 1) if l.input_per_output else None,
                "rounding_step": float(l.rounding_step) if l.rounding_step is not None else None,
                "byproduct": l.byproduct,
                "sort_order": l.sort_order or 0,
            }
            for l in (p.lines or [])
        ],
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


def _set_lines(profile: YieldProfile, lines: List[YieldLineIn]) -> None:
    profile.lines = [
        YieldProfileLine(
            cut_name=l.cut_name.strip(),
            input_uom=(l.input_uom or "kg").strip() or "kg",
            input_per_output=Decimal(str(l.input_per_output)),
            part_per_raw=Decimal(str(l.part_per_raw)) if l.part_per_raw else None,
            part_uom=(l.part_uom or "").strip() or None,
            rounding_step=Decimal(str(l.rounding_step)) if l.rounding_step else None,
            byproduct=(l.byproduct or "").strip() or None,
            sort_order=i,
        )
        for i, l in enumerate(lines)
    ]


async def _get_profile(db: AsyncSession, vendor_id: UUID, profile_id: UUID) -> YieldProfile:
    p = (await db.execute(
        select(YieldProfile).where(and_(YieldProfile.id == profile_id, YieldProfile.vendor_id == vendor_id))
    )).scalar_one_or_none()
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Yield profile not found")
    return p


async def _yield_products(db: AsyncSession, vendor_id: UUID) -> list[Product]:
    return list((await db.execute(
        select(Product)
        .options(selectinload(Product.variants))
        .where(and_(
            Product.vendor_id == vendor_id,
            Product.yield_enabled.is_(True),
            Product.deleted_at.is_(None),
        ))
        .order_by(Product.category, Product.name)
    )).scalars().all())


# ── Profiles ─────────────────────────────────────────────────────

@router.get("/templates", dependencies=_view_products)
async def list_templates():
    return PROFILE_TEMPLATES


@router.get("/profiles", dependencies=_view_products)
async def list_profiles(
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    rows = (await db.execute(
        select(YieldProfile).where(YieldProfile.vendor_id == vendor_id).order_by(YieldProfile.name)
    )).scalars().all()
    return [_profile_to_dict(p) for p in rows]


@router.post("/profiles", status_code=201, dependencies=_edit_products)
async def create_profile(
    body: YieldProfileIn,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    p = YieldProfile(
        vendor_id=vendor_id,
        name=body.name.strip(),
        category=(body.category or "").strip() or None,
        input_uom=(body.input_uom or "kg").strip() or "kg",
        description=body.description,
        is_active=body.is_active,
    )
    _set_lines(p, body.lines)
    db.add(p)
    await db.commit()
    return _profile_to_dict(await _get_profile(db, vendor_id, p.id))


@router.put("/profiles/{profile_id}", dependencies=_edit_products)
async def update_profile(
    profile_id: UUID,
    body: YieldProfileIn,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    p = await _get_profile(db, vendor_id, profile_id)
    p.name = body.name.strip()
    p.category = (body.category or "").strip() or None
    p.input_uom = (body.input_uom or "kg").strip() or "kg"
    p.description = body.description
    p.is_active = body.is_active
    _set_lines(p, body.lines)
    await db.commit()
    db.expire_all()
    return _profile_to_dict(await _get_profile(db, vendor_id, profile_id))


@router.delete("/profiles/{profile_id}", status_code=204, dependencies=_edit_products)
async def delete_profile(
    profile_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    p = await _get_profile(db, vendor_id, profile_id)
    await db.delete(p)
    await db.commit()


# ── Yield products (cutting sheet) ───────────────────────────────

@router.get("/products", dependencies=_view_products)
async def list_yield_products(
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Products sold after cutting, with each cut's output and raw input per sale."""
    out = []
    for p in await _yield_products(db, vendor_id):
        variants = list(p.variants or [])
        pool = shared_pool_unit(variants, p.stock_uom)
        shared = uses_shared_weight_stock(p.shared_stock, variants)
        base = resolved_base_kg(p, variants) if shared else None
        out.append({
            "id": str(p.id),
            "name": p.name,
            "category": p.category,
            "pool_uom": pool,
            "shared_stock": shared,
            "stock_on_hand": float(base) if base is not None else None,
            "yield_profile_id": str(p.yield_profile_id) if p.yield_profile_id else None,
            "cuts": [
                {
                    "variant_id": str(v.id),
                    "name": v.name,
                    "cut": v.yield_cut,
                    "price": float(v.price or 0),
                    "uom": v.uom,
                    "uom_quantity": float(v.uom_quantity) if v.uom_quantity is not None else None,
                    "output_per_sale": float(output_per_sale(pool, v)),
                    "yield_factor": float(v.yield_factor) if v.yield_factor else None,
                }
                for v in variants
                if v.is_active is not False
            ],
        })
    return out


# ── Day close ────────────────────────────────────────────────────

@router.get("/day", dependencies=_view_inventory)
async def get_day(
    business_date: date_type = Query(..., alias="date"),
    tz_offset: int = Query(330, ge=-720, le=840),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """End-of-day yield figures for every yield product: frozen when closed, live otherwise."""
    products = await _yield_products(db, vendor_id)
    closes = {
        c.product_id: c
        for c in (await db.execute(
            select(YieldDayClose).where(and_(
                YieldDayClose.vendor_id == vendor_id,
                YieldDayClose.business_date == business_date,
            ))
        )).scalars().all()
    }
    rows = []
    for p in products:
        c = closes.get(p.id)
        rows.append(close_to_dict(c, p) if c else await compute_day(db, vendor_id, p, business_date, tz_offset))
    return {"business_date": business_date.isoformat(), "products": rows}


@router.post("/day/close", dependencies=_manage_inventory)
async def close_day(
    body: DayCloseIn,
    current_user: User = Depends(get_current_active_user),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    product = (await db.execute(
        select(Product).where(and_(Product.id == body.product_id, Product.vendor_id == vendor_id))
    )).scalar_one_or_none()
    if not product:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    existing = (await db.execute(
        select(YieldDayClose).where(and_(
            YieldDayClose.vendor_id == vendor_id,
            YieldDayClose.product_id == product.id,
            YieldDayClose.business_date == body.business_date,
        ))
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "This day is already closed for the product")

    d = await compute_day(db, vendor_id, product, body.business_date, body.tz_offset, body.raw_cost_per_unit)
    if not d["shared_stock"]:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Turn on product-level stock for this product so raw stock is counted in one balance",
        )
    def dec(key: str) -> Decimal | None:
        value = d.get(key)
        return Decimal(str(value)) if value is not None else None

    physical = Decimal(str(body.closing_physical_qty))
    system = dec("closing_system_qty")
    variance = system - physical

    c = YieldDayClose(
        vendor_id=vendor_id,
        product_id=product.id,
        business_date=body.business_date,
        pool_uom=d["pool_uom"],
        opening_qty=dec("opening_qty"),
        purchased_qty=dec("purchased_qty"),
        raw_cut_qty=dec("raw_cut_qty"),
        returned_qty=dec("returned_qty"),
        wastage_qty=dec("wastage_qty"),
        other_qty=dec("other_qty"),
        closing_system_qty=system,
        closing_physical_qty=physical,
        variance_qty=variance,
        output_sold_qty=dec("output_sold_qty"),
        cutting_loss_qty=dec("cutting_loss_qty"),
        sales_amount=dec("sales_amount"),
        raw_cost_per_unit=dec("raw_cost_per_unit"),
        cogs_amount=dec("cogs_amount"),
        cuts=d["cuts"],
        notes=body.notes,
        closed_by=current_user.id,
        closed_at=datetime.now(timezone.utc),
    )
    db.add(c)
    if body.adjust_stock and variance != 0:
        await post_count_adjustment(db, vendor_id, product.id, -variance, body.business_date, current_user.id)
    await db.commit()
    await db.refresh(c)
    return close_to_dict(c, product)


@router.delete("/day/close/{close_id}", status_code=204, dependencies=_manage_inventory)
async def reopen_day(
    close_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Reopen a closed day. A stock-count adjustment posted at close stays; post a new count to undo it."""
    c = (await db.execute(
        select(YieldDayClose).where(and_(YieldDayClose.id == close_id, YieldDayClose.vendor_id == vendor_id))
    )).scalar_one_or_none()
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Day close not found")
    await db.delete(c)
    await db.commit()
