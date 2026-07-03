"""Live vehicle feed for website builder blocks (Auto Inventory / Vehicle Detail sync)."""
from __future__ import annotations

from typing import Any, Callable


async def build_vehicles_live_items(
    db,
    vendor_id,
    limit: int,
    norm_item: Callable[..., dict[str, Any]],
    *,
    include_inactive: bool = False,
) -> list[dict[str, Any]]:
    from sqlalchemy import select

    from app.models.vendor_vehicle import VendorVehicle

    q = select(VendorVehicle).where(VendorVehicle.vendor_id == vendor_id)
    if not include_inactive:
        q = q.where(VendorVehicle.is_active.is_(True))
    q = (
        q.order_by(VendorVehicle.sort_order.asc(), VendorVehicle.created_at.desc())
        .limit(limit)
    )
    rows = (await db.execute(q)).scalars().all()
    items: list[dict[str, Any]] = []
    for v in rows:
        price_val = float(v.price) if v.price is not None else None
        currency = (v.currency or "USD").strip()
        price_fmt = f"{currency} {price_val:,.0f}" if price_val is not None else None
        title = f"{v.year} {v.make} {v.model}".strip()
        items.append(
            norm_item(
                id=str(v.id),
                title=title,
                subtitle=v.trim,
                description=v.location_note,
                image_url=v.image_url,
                price=price_val,
                price_formatted=price_fmt,
                url=None,
                meta={
                    "slug": v.slug,
                    "year": v.year,
                    "make": v.make,
                    "model": v.model,
                    "trim": v.trim,
                    "condition": v.condition,
                    "currency": currency,
                    "mileage": v.mileage,
                    "fuel": v.fuel,
                    "transmission": v.transmission,
                    "body_style": v.body_style,
                    "exterior_color": v.exterior_color,
                    "stock_number": v.stock_number,
                    "location_note": v.location_note,
                    "cta_label": v.cta_label,
                    "highlights": v.highlights or [],
                    "is_active": bool(v.is_active),
                },
            )
        )
    return items
