"""Live recurring-plan feed for website builder blocks (Recurring Booking sync)."""
from __future__ import annotations

from typing import Any, Callable


async def build_recurring_plans_live_items(
    db,
    vendor_id,
    limit: int,
    norm_item: Callable[..., dict[str, Any]],
    *,
    include_inactive: bool = False,
) -> list[dict[str, Any]]:
    from sqlalchemy import select

    from app.models.vendor_recurring_plan import VendorRecurringPlan

    q = select(VendorRecurringPlan).where(VendorRecurringPlan.vendor_id == vendor_id)
    if not include_inactive:
        q = q.where(VendorRecurringPlan.is_active.is_(True))
    q = (
        q.order_by(VendorRecurringPlan.sort_order.asc(), VendorRecurringPlan.created_at.desc())
        .limit(limit)
    )
    rows = (await db.execute(q)).scalars().all()
    items: list[dict[str, Any]] = []
    for p in rows:
        items.append(
            norm_item(
                id=str(p.id),
                title=p.title,
                subtitle=None,
                image_url=p.image_url,
                price=p.price_per_session,
                price_formatted=None,
                url=None,
                meta={
                    "slug": p.slug,
                    "start_date": p.start_date,
                    "start_time": p.start_time,
                    "duration_minutes": p.duration_minutes,
                    "price_per_session": p.price_per_session,
                    "currency": p.currency,
                    "default_session_count": p.default_session_count,
                    "min_sessions": p.min_sessions,
                    "max_sessions": p.max_sessions,
                    "show_upcoming": bool(p.show_upcoming),
                    "cta_label": p.cta_label,
                    "presets": p.presets or [],
                    "is_active": bool(p.is_active),
                },
            )
        )
    return items
