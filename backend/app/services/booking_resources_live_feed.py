"""Live booking resources feed for website builder blocks (Resource Picker sync).

Prefers vendor-configured resources (Sales → Resources). Falls back to the original
static demo resources (Studio A, Studio B, Court 3, Boardroom) when the vendor hasn't
configured any yet, so pages that already use this block keep rendering exactly as before.
"""
from __future__ import annotations

from typing import Any, Callable

_DEFAULT_RESOURCES: list[dict[str, Any]] = [
    {
        "name": "Studio A — North light",
        "resource_type": "room",
        "capacity": 8,
        "description": "Bright corner studio with 14ft ceilings and a roll-up door.",
        "features": ["Natural light", "Sound system", "Whiteboard", "Wi-Fi 6"],
        "price_per_hour": 95,
        "currency": "USD",
        "is_available": True,
    },
    {
        "name": "Studio B — Photo cyc",
        "resource_type": "room",
        "capacity": 6,
        "description": "9ft white cyc, Profoto strobes, and a tethering station.",
        "features": ["Cyc wall", "Strobes", "Tethering", "Hair & makeup"],
        "price_per_hour": 140,
        "currency": "USD",
        "is_available": True,
    },
    {
        "name": "Court 3 — Indoor",
        "resource_type": "court",
        "capacity": 4,
        "description": "Climate-controlled hard court with LED lighting.",
        "features": ["Air conditioned", "Pro net", "Ball hopper", "Towels"],
        "price_per_hour": 48,
        "currency": "USD",
        "is_available": False,
    },
    {
        "name": "Boardroom — Walnut",
        "resource_type": "room",
        "capacity": 12,
        "description": "Walnut conference table, video conferencing, catering ready.",
        "features": ["Video conf", "Catering", "Privacy glass"],
        "price_per_hour": 75,
        "currency": "USD",
        "is_available": True,
    },
]


async def build_booking_resources_live_items(
    db,
    vendor_id,
    limit: int,
    norm_item: Callable[..., dict[str, Any]],
    *,
    include_inactive: bool = False,
) -> list[dict[str, Any]]:
    from sqlalchemy import select

    from app.models.vendor_booking_resource import VendorBookingResource

    q = select(VendorBookingResource).where(VendorBookingResource.vendor_id == vendor_id)
    if not include_inactive:
        q = q.where(VendorBookingResource.is_active.is_(True))
    q = (
        q.order_by(VendorBookingResource.sort_order.asc(), VendorBookingResource.created_at.asc())
        .limit(limit)
    )
    rows = (await db.execute(q)).scalars().all()
    if rows:
        return [
            norm_item(
                id=str(r.id),
                title=r.name,
                description=r.description,
                price=r.price_per_hour,
                meta={
                    "resource_type": r.resource_type,
                    "capacity": r.capacity,
                    "features": r.features or [],
                    "price_per_hour": r.price_per_hour,
                    "currency": r.currency,
                    "is_available": bool(r.is_available),
                    "is_active": bool(r.is_active),
                },
            )
            for r in rows
        ]

    # No vendor-configured resources yet — preserve the original static demo resources
    # so existing sites don't lose their content.
    return [
        norm_item(
            id=f"default-{idx}",
            title=res["name"],
            description=res["description"],
            price=res["price_per_hour"],
            meta={
                "resource_type": res["resource_type"],
                "capacity": res["capacity"],
                "features": res["features"],
                "price_per_hour": res["price_per_hour"],
                "currency": res["currency"],
                "is_available": res["is_available"],
                "is_active": True,
                "is_default_template": True,
            },
        )
        for idx, res in enumerate(_DEFAULT_RESOURCES)
    ]
