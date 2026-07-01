"""Live pricing-plan feed for website builder blocks (Plans Manager sync)."""
from __future__ import annotations

from typing import Any, Callable


async def build_plans_live_items(
    db,
    vendor_id,
    limit: int,
    norm_item: Callable[..., dict[str, Any]],
    *,
    include_inactive: bool = False,
) -> list[dict[str, Any]]:
    from sqlalchemy import select

    from app.models.pricing_plan import VendorPricingPlan

    q = select(VendorPricingPlan).where(VendorPricingPlan.vendor_id == vendor_id)
    if not include_inactive:
        q = q.where(VendorPricingPlan.is_active.is_(True))
    q = (
        q.order_by(VendorPricingPlan.sort_order.asc(), VendorPricingPlan.created_at.asc())
        .limit(limit)
    )
    rows = (await db.execute(q)).scalars().all()
    items: list[dict[str, Any]] = []
    for plan in rows:
        price_val = float(plan.price) if plan.price is not None else None
        currency = (plan.currency or "INR").strip()
        price_fmt = (
            f"{currency} {price_val:,.0f}"
            if price_val is not None
            else None
        )
        slug = (plan.slug or "").strip()
        items.append(
            norm_item(
                id=str(plan.id),
                title=plan.name or "",
                subtitle=plan.period,
                description=plan.description or "",
                price=price_val,
                price_formatted=price_fmt,
                url=plan.cta_url,
                meta={
                    "slug": slug,
                    "period": plan.period,
                    "features": plan.features or [],
                    "highlighted": bool(plan.is_featured),
                    "is_featured": bool(plan.is_featured),
                    "cta_label": plan.cta_label,
                    "cta_url": plan.cta_url,
                    "currency": currency,
                    "is_active": bool(plan.is_active),
                },
            )
        )
    return items
