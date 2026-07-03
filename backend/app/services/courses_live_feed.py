"""Live course feed for website builder blocks (Course Catalog / Course Detail sync)."""
from __future__ import annotations

from typing import Any, Callable


async def build_courses_live_items(
    db,
    vendor_id,
    limit: int,
    norm_item: Callable[..., dict[str, Any]],
    *,
    include_inactive: bool = False,
) -> list[dict[str, Any]]:
    from sqlalchemy import select

    from app.models.vendor_course import VendorCourse

    q = select(VendorCourse).where(VendorCourse.vendor_id == vendor_id)
    if not include_inactive:
        q = q.where(VendorCourse.is_active.is_(True))
    q = (
        q.order_by(VendorCourse.sort_order.asc(), VendorCourse.created_at.desc())
        .limit(limit)
    )
    rows = (await db.execute(q)).scalars().all()
    items: list[dict[str, Any]] = []
    for course in rows:
        price_val = float(course.price) if course.price is not None else None
        currency = (course.currency or "USD").strip()
        price_fmt = (
            f"{currency} {price_val:,.0f}"
            if price_val is not None
            else None
        )
        items.append(
            norm_item(
                id=str(course.id),
                title=course.title or "",
                subtitle=course.instructor,
                description=course.description or "",
                image_url=course.image_url,
                price=price_val,
                price_formatted=price_fmt,
                url=None,
                meta={
                    "slug": course.slug,
                    "instructor": course.instructor,
                    "level": course.level,
                    "category": course.category,
                    "currency": currency,
                    "duration": course.duration,
                    "lessons": course.lessons,
                    "rating": float(course.rating) if course.rating is not None else 0,
                    "reviews": course.reviews,
                    "syllabus": course.syllabus or [],
                    "outcomes": course.outcomes or [],
                    "perks": course.perks or [],
                    "enrolled_label": course.enrolled_label,
                    "cta_label": course.cta_label,
                    "preview_cta_label": course.preview_cta_label,
                    "is_active": bool(course.is_active),
                },
            )
        )
    return items
