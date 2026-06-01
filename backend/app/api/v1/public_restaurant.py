"""
Public restaurant endpoints — no vendor-user JWT required.
Used by the storefront QR table-order and reservation pages.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date as date_type

from app.database import get_db
from app.repositories.vendor_repo import VendorRepository
from app.models.vendor_product import Product, ProductModifierGroup, ProductModifierOption
from app.services.restaurant_service import RestaurantService
from app.utils.restaurant_menu import load_dine_in_products
from app.schemas.restaurant import RestaurantReservationCreate

router = APIRouter()


async def _resolve_vendor(vendor_slug: str, db: AsyncSession):
    repo = VendorRepository(db)
    vendor = await repo.find_by_slug(vendor_slug)
    if not vendor:
        raise HTTPException(404, f"Vendor '{vendor_slug}' not found")
    return vendor


def _product_dict(p: Product, modifier_groups: Optional[list] = None) -> dict:
    return {
        "id": str(p.id),
        "name": p.name,
        "description": p.short_description or p.description,
        "price": float(p.price or 0),
        "category": p.category,
        "tax_rate": float(p.tax_rate or p.gst_rate or 0),
        "image_url": None,
        "is_available": p.status == "active",
        "modifier_groups": modifier_groups or [],
    }


async def _load_modifier_groups_by_product(db: AsyncSession, vendor_id, product_ids: list) -> dict:
    if not product_ids:
        return {}
    groups_r = await db.execute(
        select(ProductModifierGroup)
        .where(and_(
            ProductModifierGroup.vendor_id == vendor_id,
            ProductModifierGroup.product_id.in_(product_ids),
            ProductModifierGroup.is_active == True,
        ))
        .order_by(ProductModifierGroup.sort_order)
    )
    groups = list(groups_r.scalars().all())
    if not groups:
        return {}
    group_ids = [g.id for g in groups]
    opts_r = await db.execute(
        select(ProductModifierOption)
        .where(and_(
            ProductModifierOption.group_id.in_(group_ids),
            ProductModifierOption.is_active == True,
        ))
        .order_by(ProductModifierOption.sort_order)
    )
    opts_by_group: dict = {}
    for o in opts_r.scalars().all():
        opts_by_group.setdefault(o.group_id, []).append(o)

    by_product: dict = {}
    for g in groups:
        opts = opts_by_group.get(g.id, [])
        if not opts:
            continue
        by_product.setdefault(str(g.product_id), []).append({
            "id": str(g.id),
            "name": g.name,
            "selection_type": g.selection_type,
            "is_required": g.is_required,
            "min_select": g.min_select or (1 if g.is_required else 0),
            "options": [
                {
                    "id": str(o.id),
                    "name": o.name,
                    "price_delta": float(o.price_delta or 0),
                    "is_default": o.is_default,
                }
                for o in opts
            ],
        })
    return by_product


# ── Table info + menu by QR token ────────────────────────────────

@router.get("/{vendor_slug}/table/{qr_token}")
async def get_table_by_qr(vendor_slug: str, qr_token: str, db: AsyncSession = Depends(get_db)):
    vendor = await _resolve_vendor(vendor_slug, db)
    svc = RestaurantService(db)
    table = await svc.get_table_by_qr_token(qr_token)
    if not table or table.vendor_id != vendor.id:
        raise HTTPException(404, "Table not found or QR code invalid")

    products = await load_dine_in_products(
        db, vendor.id, vendor.settings or {}, limit=200,
    )
    mod_map = await _load_modifier_groups_by_product(
        db, vendor.id, [p.id for p in products],
    )

    menu: dict = {}
    for p in products:
        cat = p.category or "Menu"
        menu.setdefault(cat, []).append(
            _product_dict(p, mod_map.get(str(p.id), [])),
        )

    return JSONResponse(content={
        "vendor": {
            "id": str(vendor.id),
            "name": vendor.business_name,
            "slug": vendor.slug,
        },
        "table": {
            "id": str(table.id),
            "label": table.label,
            "capacity": table.capacity,
            "zone_name": None,  # we don't load zone here for simplicity
        },
        "menu": [{"category": cat, "items": items} for cat, items in menu.items()],
    })


# ── Guest dine-in order submission via QR ─────────────────────────

class GuestOrderModifier(BaseModel):
    group_id: str
    group_name: str
    option_id: str
    option_name: str
    price_delta: float = 0


class GuestOrderItem(BaseModel):
    product_id: str
    name: str
    qty: int = Field(ge=1)
    unit_price: float
    notes: Optional[str] = None
    modifiers: Optional[List[GuestOrderModifier]] = None


def _guest_item_dict(i: GuestOrderItem) -> dict:
    mods = [
        {
            "group_id": m.group_id,
            "group_name": m.group_name,
            "option_id": m.option_id,
            "option_name": m.option_name,
            "price_delta": m.price_delta,
        }
        for m in (i.modifiers or [])
    ]
    return {
        "product_id": str(i.product_id),
        "name": i.name,
        "qty": i.qty,
        "unit_price": i.unit_price,
        "notes": i.notes,
        "item_type": "product",
        "modifiers": mods if mods else None,
    }


class GuestOrderCreate(BaseModel):
    items: List[GuestOrderItem] = Field(min_length=1)
    guest_name: Optional[str] = None
    guest_phone: Optional[str] = None
    notes: Optional[str] = None


def _guest_order_notes(data: GuestOrderCreate) -> str:
    parts: list[str] = []
    if data.notes:
        parts.append(data.notes)
    if data.guest_name:
        parts.append(f"QR order by {data.guest_name}")
    if data.guest_phone:
        parts.append(f"Phone: {data.guest_phone}")
    return "\n".join(parts) if parts else "QR order"


@router.post("/{vendor_slug}/table/{qr_token}/order", status_code=201)
async def guest_create_order(
    vendor_slug: str,
    qr_token: str,
    data: GuestOrderCreate,
    db: AsyncSession = Depends(get_db),
):
    vendor = await _resolve_vendor(vendor_slug, db)
    svc = RestaurantService(db)
    table = await svc.get_table_by_qr_token(qr_token)
    if not table or table.vendor_id != vendor.id:
        raise HTTPException(404, "Table not found or QR code invalid")

    from uuid import UUID
    # Check if there's already an open order for this table
    existing = await svc._get_open_order_for_table(vendor.id, table.id)
    if existing:
        # Add items to existing order
        new_items = [_guest_item_dict(i) for i in data.items]
        order = await svc.add_items_to_order(vendor.id, existing.id, new_items)
        await svc.send_kot(
            vendor.id,
            existing.id,
            new_items,
            notes=_guest_order_notes(data) if (data.notes or data.guest_name or data.guest_phone) else "QR add-on order",
        )
        created = False
    else:
        # Create new order
        order = await svc.create_order(
            vendor.id,
            table.id,
            covers=1,
            notes=_guest_order_notes(data),
        )
        new_items = [_guest_item_dict(i) for i in data.items]
        order = await svc.add_items_to_order(vendor.id, order.id, new_items)

        # Auto-send KOT
        await svc.send_kot(vendor.id, order.id, new_items, notes="QR order")
        created = True

    if not order:
        raise HTTPException(500, "Could not create order")

    return JSONResponse(content={
        "order_id": str(order.id),
        "table_label": table.label,
        "status": order.status,
        "items": order.items or [],
        "created": created,
    }, status_code=201)


# ── Online reservation submission ─────────────────────────────────

@router.post("/{vendor_slug}/reserve", status_code=201)
async def guest_reserve(
    vendor_slug: str,
    data: RestaurantReservationCreate,
    db: AsyncSession = Depends(get_db),
):
    vendor = await _resolve_vendor(vendor_slug, db)
    svc = RestaurantService(db)
    from uuid import UUID
    r = await svc.create_reservation(
        vendor.id,
        data.guest_name,
        data.reservation_date,
        data.reservation_time,
        data.party_size,
        table_id=UUID(data.table_id) if data.table_id else None,
        guest_phone=data.guest_phone,
        guest_email=data.guest_email,
        notes=data.notes,
        source="online",
    )
    return JSONResponse(content={
        "id": str(r.id),
        "status": r.status,
        "guest_name": r.guest_name,
        "reservation_date": r.reservation_date.isoformat(),
        "reservation_time": r.reservation_time,
        "party_size": r.party_size,
    }, status_code=201)
