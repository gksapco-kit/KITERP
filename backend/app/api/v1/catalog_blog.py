"""
Public Blog Catalog — unauthenticated, tenant-aware blog post endpoints.
Routes: /catalog/blog
"""
from __future__ import annotations
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.blog import VendorBlogPost
from app.api.v1.catalog import get_vendor_id_from_tenant

router = APIRouter()


@router.get("", summary="List published blog posts (public)")
async def list_published_posts(
    request: Request,
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=50),
    category: Optional[str] = None,
    tag: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    vendor_id = await get_vendor_id_from_tenant(request, db)
    q = select(VendorBlogPost).where(
        VendorBlogPost.vendor_id == vendor_id,
        VendorBlogPost.is_published == True,  # noqa: E712
    )
    if category:
        q = q.where(VendorBlogPost.category == category)
    if tag:
        q = q.where(VendorBlogPost.tags.contains([tag]))

    total_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(total_q)).scalar_one()

    q = q.order_by(VendorBlogPost.published_at.desc()).offset((page - 1) * size).limit(size)
    rows = (await db.execute(q)).scalars().all()

    return {
        "items": [_public_post(r) for r in rows],
        "total": total,
        "page": page,
        "size": size,
        "pages": max(1, -(-total // size)),
    }


@router.get("/{slug}", summary="Get single published blog post (public)")
async def get_published_post(
    slug: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    vendor_id = await get_vendor_id_from_tenant(request, db)
    post = (await db.execute(
        select(VendorBlogPost).where(
            VendorBlogPost.vendor_id == vendor_id,
            VendorBlogPost.slug == slug,
            VendorBlogPost.is_published == True,  # noqa: E712
        )
    )).scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return _public_post(post)


def _public_post(p: VendorBlogPost) -> dict:
    return {
        "id": str(p.id),
        "slug": p.slug,
        "title": p.title,
        "excerpt": p.excerpt,
        "content": p.content,
        "cover_url": p.cover_url,
        "author_name": p.author_name,
        "author_avatar_url": p.author_avatar_url,
        "category": p.category,
        "tags": p.tags or [],
        "reading_minutes": p.reading_minutes,
        "published_at": p.published_at.isoformat() if p.published_at else None,
    }
