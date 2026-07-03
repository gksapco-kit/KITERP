"""Live property-listing feed for website builder blocks (Property Listings sync)."""
from __future__ import annotations

from typing import Any, Callable


async def build_properties_live_items(
    db,
    vendor_id,
    limit: int,
    norm_item: Callable[..., dict[str, Any]],
    *,
    include_inactive: bool = False,
) -> list[dict[str, Any]]:
    from sqlalchemy import select

    from app.models.vendor_property import VendorProperty

    q = select(VendorProperty).where(VendorProperty.vendor_id == vendor_id)
    if not include_inactive:
        q = q.where(VendorProperty.is_active.is_(True))
    q = (
        q.order_by(VendorProperty.sort_order.asc(), VendorProperty.created_at.desc())
        .limit(limit)
    )
    rows = (await db.execute(q)).scalars().all()
    items: list[dict[str, Any]] = []
    for prop in rows:
        price_val = float(prop.price) if prop.price is not None else None
        currency = (prop.currency or "USD").strip()
        price_fmt = (
            f"{currency} {price_val:,.0f}"
            if price_val is not None
            else None
        )
        items.append(
            norm_item(
                id=str(prop.id),
                title=prop.title or "",
                subtitle=prop.address,
                description=prop.description or "",
                image_url=prop.image_url,
                price=price_val,
                price_formatted=price_fmt,
                url=None,
                meta={
                    "slug": prop.slug,
                    "address": prop.address,
                    "currency": currency,
                    "beds": prop.beds,
                    "baths": prop.baths,
                    "sqft": prop.sqft,
                    "type": prop.property_type,
                    "status": prop.status,
                    "gallery": prop.gallery or [],
                    "agent_name": prop.agent_name,
                    "agent_phone": prop.agent_phone,
                    "agent_email": prop.agent_email,
                    "cta_label": prop.cta_label,
                    "is_active": bool(prop.is_active),
                },
            )
        )
    return items
