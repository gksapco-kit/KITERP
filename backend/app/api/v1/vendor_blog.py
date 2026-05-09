"""
Vendor Blog — CRUD for vendor-authored blog posts.
Routes: /vendors/me/blog
"""
from __future__ import annotations
import re
import uuid
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.deps import get_current_active_user
from app.models.user import User
from app.models.blog import VendorBlogPost
from app.services.vendor_service import VendorService

router = APIRouter()


# ── helpers ──────────────────────────────────────────────────────────────────

async def _get_vendor_id(user: User, db: AsyncSession):
    svc = VendorService(db)
    vendor = await svc.get_by_user_id(user.id)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return vendor.id


def _slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text)
    return text[:180]


def _utc_naive() -> datetime:
    """DB columns use naive UTC (matches model defaults); avoid asyncpg errors mixing tz-aware datetimes."""
    return datetime.utcnow()


def _parse_post_id(post_id: str) -> UUID:
    try:
        return UUID(post_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid blog post id")


def _post_to_dict(p: VendorBlogPost) -> dict:
    return {
        "id": str(p.id),
        "vendor_id": str(p.vendor_id),
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
        "is_published": p.is_published,
        "published_at": p.published_at.isoformat() if p.published_at else None,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


# ── schemas ───────────────────────────────────────────────────────────────────

class BlogPostCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=300)
    slug: Optional[str] = None
    excerpt: Optional[str] = None
    content: Optional[str] = None
    cover_url: Optional[str] = None
    author_name: Optional[str] = None
    author_avatar_url: Optional[str] = None
    category: Optional[str] = None
    tags: List[str] = []
    reading_minutes: Optional[int] = None
    is_published: bool = False


class BlogPostUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=300)
    slug: Optional[str] = None
    excerpt: Optional[str] = None
    content: Optional[str] = None
    cover_url: Optional[str] = None
    author_name: Optional[str] = None
    author_avatar_url: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    reading_minutes: Optional[int] = None
    is_published: Optional[bool] = None


# ── endpoints ────────────────────────────────────────────────────────────────

@router.get("", summary="List blog posts")
async def list_posts(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    is_published: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor_id = await _get_vendor_id(user, db)
    q = select(VendorBlogPost).where(VendorBlogPost.vendor_id == vendor_id)
    if search:
        q = q.where(VendorBlogPost.title.ilike(f"%{search}%"))
    if is_published is not None:
        q = q.where(VendorBlogPost.is_published == is_published)

    total_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(total_q)).scalar_one()

    q = q.order_by(VendorBlogPost.created_at.desc()).offset((page - 1) * size).limit(size)
    rows = (await db.execute(q)).scalars().all()
    return {
        "items": [_post_to_dict(r) for r in rows],
        "total": total,
        "page": page,
        "size": size,
        "pages": max(1, -(-total // size)),
    }


@router.post("", status_code=201, summary="Create blog post")
async def create_post(
    body: BlogPostCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor_id = await _get_vendor_id(user, db)
    slug = body.slug or _slugify(body.title)

    # ensure slug unique within vendor
    existing = (await db.execute(
        select(VendorBlogPost).where(
            VendorBlogPost.vendor_id == vendor_id,
            VendorBlogPost.slug == slug,
        )
    )).scalar_one_or_none()
    if existing:
        slug = f"{slug}-{str(uuid.uuid4())[:8]}"

    post = VendorBlogPost(
        vendor_id=vendor_id,
        slug=slug,
        title=body.title,
        excerpt=body.excerpt,
        content=body.content,
        cover_url=body.cover_url,
        author_name=body.author_name,
        author_avatar_url=body.author_avatar_url,
        category=body.category,
        tags=body.tags or [],
        reading_minutes=body.reading_minutes,
        is_published=body.is_published,
        published_at=_utc_naive() if body.is_published else None,
    )
    db.add(post)
    await db.commit()
    await db.refresh(post)
    return _post_to_dict(post)


@router.get("/{post_id}", summary="Get blog post")
async def get_post(
    post_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor_id = await _get_vendor_id(user, db)
    pid = _parse_post_id(post_id)
    post = (await db.execute(
        select(VendorBlogPost).where(
            VendorBlogPost.id == pid,
            VendorBlogPost.vendor_id == vendor_id,
        )
    )).scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Blog post not found")
    return _post_to_dict(post)


@router.patch("/{post_id}", summary="Update blog post")
async def update_post(
    post_id: str,
    body: BlogPostUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor_id = await _get_vendor_id(user, db)
    pid = _parse_post_id(post_id)
    post = (await db.execute(
        select(VendorBlogPost).where(
            VendorBlogPost.id == pid,
            VendorBlogPost.vendor_id == vendor_id,
        )
    )).scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Blog post not found")

    data = body.model_dump(exclude_unset=True)
    for key, val in data.items():
        setattr(post, key, val)

    # auto-set published_at on first publish (naive UTC for PostgreSQL without timestamptz)
    if body.is_published is True and post.published_at is None:
        post.published_at = _utc_naive()

    post.updated_at = _utc_naive()
    await db.commit()
    await db.refresh(post)
    return _post_to_dict(post)


@router.delete("/{post_id}", status_code=204, summary="Delete blog post")
async def delete_post(
    post_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    vendor_id = await _get_vendor_id(user, db)
    pid = _parse_post_id(post_id)
    result = await db.execute(
        delete(VendorBlogPost).where(
            VendorBlogPost.id == pid,
            VendorBlogPost.vendor_id == vendor_id,
        )
    )
    await db.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Blog post not found")
