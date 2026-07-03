"""Live event feed for website builder blocks (Ticket Picker sync)."""
from __future__ import annotations

from typing import Any, Callable


async def build_events_live_items(
    db,
    vendor_id,
    limit: int,
    norm_item: Callable[..., dict[str, Any]],
    *,
    include_inactive: bool = False,
) -> list[dict[str, Any]]:
    from sqlalchemy import select

    from app.models.vendor_event import VendorEvent

    q = select(VendorEvent).where(VendorEvent.vendor_id == vendor_id)
    if not include_inactive:
        q = q.where(VendorEvent.is_active.is_(True))
    q = (
        q.order_by(VendorEvent.sort_order.asc(), VendorEvent.created_at.desc())
        .limit(limit)
    )
    rows = (await db.execute(q)).scalars().all()
    items: list[dict[str, Any]] = []
    for e in rows:
        tiers = e.tiers or []
        from_price = min((float(t.get("price", 0)) for t in tiers), default=None) if tiers else None
        items.append(
            norm_item(
                id=str(e.id),
                title=e.title,
                subtitle=e.tagline,
                image_url=e.image_url,
                price=from_price,
                price_formatted=None,
                url=None,
                meta={
                    "slug": e.slug,
                    "tagline": e.tagline,
                    "event_date": e.event_date,
                    "doors_time": e.doors_time,
                    "start_time": e.start_time,
                    "venue": e.venue,
                    "address": e.address,
                    "age_note": e.age_note,
                    "order_title": e.order_title,
                    "seating_title": e.seating_title,
                    "show_seating": bool(e.show_seating),
                    "max_per_order": e.max_per_order,
                    "cta_label": e.cta_label,
                    "tiers": tiers,
                    "is_active": bool(e.is_active),
                },
            )
        )
    return items
