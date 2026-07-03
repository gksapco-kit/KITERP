"""Live fitness-class feed for website builder blocks (Fitness Schedule sync)."""
from __future__ import annotations

from typing import Any, Callable


async def build_fitness_classes_live_items(
    db,
    vendor_id,
    limit: int,
    norm_item: Callable[..., dict[str, Any]],
    *,
    include_inactive: bool = False,
) -> list[dict[str, Any]]:
    from sqlalchemy import select

    from app.models.vendor_fitness_class import VendorFitnessClass

    q = select(VendorFitnessClass).where(VendorFitnessClass.vendor_id == vendor_id)
    if not include_inactive:
        q = q.where(VendorFitnessClass.is_active.is_(True))
    q = (
        q.order_by(VendorFitnessClass.sort_order.asc(), VendorFitnessClass.created_at.desc())
        .limit(limit)
    )
    rows = (await db.execute(q)).scalars().all()
    items: list[dict[str, Any]] = []
    for cls in rows:
        price_val = float(cls.price) if cls.price is not None else None
        currency = (cls.currency or "USD").strip()
        price_fmt = (
            f"{currency} {price_val:,.0f}"
            if price_val is not None
            else None
        )
        items.append(
            norm_item(
                id=str(cls.id),
                title=cls.name or "",
                subtitle=cls.instructor,
                description=None,
                image_url=None,
                price=price_val,
                price_formatted=price_fmt,
                url=None,
                meta={
                    "slug": cls.slug,
                    "instructor": cls.instructor,
                    "type": cls.class_type,
                    "duration": cls.duration,
                    "intensity": cls.intensity,
                    "date": cls.date,
                    "time": cls.time,
                    "capacity": cls.capacity,
                    "booked": cls.booked,
                    "studio": cls.studio,
                    "currency": currency,
                    "cta_label": cls.cta_label,
                    "is_active": bool(cls.is_active),
                },
            )
        )
    return items
