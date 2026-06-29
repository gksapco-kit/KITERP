"""Live blog post feed for website builder blocks (Blog Manager sync)."""
from __future__ import annotations

from typing import Any, Callable


async def build_blog_live_items(
    db,
    vendor_id,
    limit: int,
    norm_item: Callable[..., dict[str, Any]],
    *,
    include_drafts: bool = False,
) -> list[dict[str, Any]]:
    from sqlalchemy import select

    from app.models.blog import VendorBlogPost

    q = select(VendorBlogPost).where(VendorBlogPost.vendor_id == vendor_id)
    if not include_drafts:
        q = q.where(VendorBlogPost.is_published.is_(True))
    q = (
        q.order_by(VendorBlogPost.published_at.desc().nullslast(), VendorBlogPost.created_at.desc())
        .limit(limit)
    )
    rows = (await db.execute(q)).scalars().all()
    items: list[dict[str, Any]] = []
    for post in rows:
        slug = (post.slug or "").strip()
        items.append(
            norm_item(
                id=str(post.id),
                title=post.title or "",
                subtitle=post.author_name or post.category,
                description=post.excerpt or "",
                image_url=post.cover_url,
                url=f"/blog/{slug}" if slug else None,
                meta={
                    "slug": slug,
                    "category": post.category,
                    "tags": post.tags or [],
                    "reading_minutes": post.reading_minutes,
                    "published_at": post.published_at.isoformat() if post.published_at else None,
                    "is_published": bool(post.is_published),
                    "author_name": post.author_name,
                },
            )
        )
    return items
