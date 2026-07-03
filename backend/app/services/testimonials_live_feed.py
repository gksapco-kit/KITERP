"""Live testimonials feed for website builder blocks (Testimonials sync).

Prefers vendor-curated testimonials (Sales → Testimonials). Falls back to the
pre-existing verified-review feed (rating >= 4, visible, with a comment) when
the vendor hasn't curated any yet, so sites that already relied on real
reviews keep working exactly as before.
"""
from __future__ import annotations

from typing import Any, Callable


async def build_testimonials_live_items(
    db,
    vendor_id,
    limit: int,
    norm_item: Callable[..., dict[str, Any]],
    *,
    include_inactive: bool = False,
) -> list[dict[str, Any]]:
    from sqlalchemy import select

    from app.models.vendor_testimonial import VendorTestimonial

    q = select(VendorTestimonial).where(VendorTestimonial.vendor_id == vendor_id)
    if not include_inactive:
        q = q.where(VendorTestimonial.is_active.is_(True))
    q = (
        q.order_by(VendorTestimonial.sort_order.asc(), VendorTestimonial.created_at.desc())
        .limit(limit)
    )
    rows = (await db.execute(q)).scalars().all()
    if rows:
        return [
            norm_item(
                id=str(t.id),
                title=t.name,
                subtitle=", ".join(filter(None, [t.role, t.company])) or None,
                description=t.quote,
                image_url=t.avatar_url,
                rating=int(t.rating) if t.rating is not None else None,
                meta={
                    "role": t.role,
                    "company": t.company,
                    "is_active": bool(t.is_active),
                },
            )
            for t in rows
        ]

    # No curated testimonials yet — preserve the original behavior of surfacing
    # real, verified customer reviews so existing sites don't go blank.
    return await _build_review_fallback_items(db, vendor_id, limit, norm_item)


async def _build_review_fallback_items(
    db,
    vendor_id,
    limit: int,
    norm_item: Callable[..., dict[str, Any]],
) -> list[dict[str, Any]]:
    from sqlalchemy import select

    from app.models.review import Review
    from app.models.customer import Customer

    q = (
        select(Review, Customer)
        .join(Customer, Customer.id == Review.customer_id)
        .where(
            Review.vendor_id == vendor_id,
            Review.is_visible.is_(True),
            Review.rating >= 4,
            Review.comment.isnot(None),
        )
        .order_by(Review.rating.desc(), Review.created_at.desc())
        .limit(limit)
    )
    rows = (await db.execute(q)).all()
    return [
        norm_item(
            id=str(rv.id),
            title=cust.full_name or "Customer",
            subtitle=cust.company_name or None,
            description=rv.comment or rv.title or "",
            image_url=cust.avatar_url,
            rating=int(rv.rating) if rv.rating is not None else None,
            meta={
                "review_title": rv.title,
                "review_type": rv.review_type,
                "is_verified_purchase": bool(rv.is_verified_purchase),
                "created_at": rv.created_at.isoformat() if rv.created_at else None,
                "is_active": True,
            },
        )
        for rv, cust in rows
    ]
