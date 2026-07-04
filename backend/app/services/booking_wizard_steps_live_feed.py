"""Live booking wizard steps feed for website builder blocks (Booking Wizard sync).

Prefers vendor-configured steps (Sales → Booking Wizard). Falls back to the
original static 5-step template (Service → Date → Time → Details → Review)
when the vendor hasn't configured any yet, so pages that already use this
block keep rendering exactly as before.
"""
from __future__ import annotations

from typing import Any, Callable

_DEFAULT_STEPS: list[dict[str, str]] = [
    {"label": "Service", "description": "What are you booking?"},
    {"label": "Date", "description": "Pick a day"},
    {"label": "Time", "description": "Pick a slot"},
    {"label": "Details", "description": "Your info"},
    {"label": "Review", "description": "Confirm & pay"},
]


async def build_booking_wizard_steps_live_items(
    db,
    vendor_id,
    limit: int,
    norm_item: Callable[..., dict[str, Any]],
    *,
    include_inactive: bool = False,
) -> list[dict[str, Any]]:
    from sqlalchemy import select

    from app.models.vendor_booking_wizard_step import VendorBookingWizardStep

    q = select(VendorBookingWizardStep).where(VendorBookingWizardStep.vendor_id == vendor_id)
    if not include_inactive:
        q = q.where(VendorBookingWizardStep.is_active.is_(True))
    q = (
        q.order_by(VendorBookingWizardStep.sort_order.asc(), VendorBookingWizardStep.created_at.asc())
        .limit(limit)
    )
    rows = (await db.execute(q)).scalars().all()
    if rows:
        return [
            norm_item(
                id=str(s.id),
                title=s.label,
                description=s.description,
                meta={"is_active": bool(s.is_active)},
            )
            for s in rows
        ]

    # No vendor-configured steps yet — preserve the original static default template
    # so existing sites don't lose their wizard content.
    return [
        norm_item(
            id=f"default-{idx}",
            title=step["label"],
            description=step["description"],
            meta={"is_active": True, "is_default_template": True},
        )
        for idx, step in enumerate(_DEFAULT_STEPS)
    ]
