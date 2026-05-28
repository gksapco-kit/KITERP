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
from app.models.vendor_product import Product
from app.services.restaurant_service import RestaurantService
from app.schemas.restaurant import RestaurantReservationCreate

router = APIRouter()


async def _resolve_vendor(vendor_slug: str, db: AsyncSession):
    repo = VendorRepository(db)
    vendor = await repo.find_by_slug(vendor_slug)
    if not vendor:
        raise HTTPException(404, f"Vendor '{vendor_slug}' not found")
    return vendor


def _product_dict(p: Product) -> dict:
    return {
        "id": str(p.id),
        "name": p.name,
        "description": p.short_description or p.description,
        "price": float(p.price or 0),
        "category": p.category,
        "tax_rate": float(p.tax_rate or p.gst_rate or 0),
        "image_url": None,  # images loaded separately if needed
        "is_available": p.status == "active",
    }


# ── Table info + menu by QR token ────────────────────────────────

@router.get("/{vendor_slug}/table/{qr_token}")
async def get_table_by_qr(vendor_slug: str, qr_token: str, db: AsyncSession = Depends(get_db)):
    vendor = await _resolve_vendor(vendor_slug, db)
    svc = RestaurantService(db)
    table = await svc.get_table_by_qr_token(qr_token)
    if not table or table.vendor_id != vendor.id:
        raise HTTPException(404, "Table not found or QR code invalid")

    # Load menu (active products)
    products_r = await db.execute(
        select(Product)
        .where(and_(Product.vendor_id == vendor.id, Product.status == "active"))
        .order_by(Product.category, Product.name)
        .limit(200)
    )
    products = list(products_r.scalars().all())

    # Group by category
    menu: dict = {}
    for p in products:
        cat = p.category or "Menu"
        menu.setdefault(cat, []).append(_product_dict(p))

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

class GuestOrderItem(BaseModel):
    product_id: str
    name: str
    qty: int = Field(ge=1)
    unit_price: float
    notes: Optional[str] = None


class GuestOrderCreate(BaseModel):
    items: List[GuestOrderItem] = Field(min_length=1)
    guest_name: Optional[str] = None
    notes: Optional[str] = None


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
        new_items = [
            {
                "product_id": str(i.product_id),
                "name": i.name,
                "qty": i.qty,
                "unit_price": i.unit_price,
                "notes": i.notes,
                "item_type": "product",
            }
            for i in data.items
        ]
        order = await svc.add_items_to_order(vendor.id, existing.id, new_items)
        created = False
    else:
        # Create new order
        order = await svc.create_order(
            vendor.id,
            table.id,
            covers=1,
            notes=data.notes or (f"QR order by {data.guest_name}" if data.guest_name else None),
        )
        new_items = [
            {
                "product_id": str(i.product_id),
                "name": i.name,
                "qty": i.qty,
                "unit_price": i.unit_price,
                "notes": i.notes,
                "item_type": "product",
            }
            for i in data.items
        ]
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
