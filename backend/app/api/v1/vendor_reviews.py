# app/api/v1/vendor_reviews.py
"""Vendor-facing review management endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import Optional
from pydantic import BaseModel, Field
from datetime import datetime, timezone
import math

from app.database import get_db
from app.api.deps import get_current_active_user
from app.models.user import User
from app.models.review import Review
from app.repositories.review_repo import ReviewRepository
from app.services.vendor_service import VendorService

router = APIRouter()


def _review_to_dict(r: Review) -> dict:
    customer = getattr(r, "customer", None)
    return {
        "id": str(r.id),
        "vendor_id": str(r.vendor_id),
        "customer_id": str(r.customer_id),
        "customer_name": customer.full_name if customer else None,
        "review_type": r.review_type,
        "product_id": str(r.product_id) if r.product_id else None,
        "service_id": str(r.service_id) if r.service_id else None,
        "order_id": str(r.order_id) if r.order_id else None,
        "rating": r.rating,
        "title": r.title,
        "comment": r.comment,
        "reply": r.reply,
        "replied_at": r.replied_at.isoformat() if r.replied_at else None,
        "is_verified_purchase": r.is_verified_purchase,
        "is_visible": r.is_visible,
        "is_flagged": r.is_flagged,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
    }


async def _get_vendor_id(user: User, db: AsyncSession) -> UUID:
    svc = VendorService(db)
    vendor = await svc.get_by_user_id(user.id)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return vendor.id


class VendorReplyRequest(BaseModel):
    reply: str = Field(..., min_length=1, max_length=2000)


class ReviewVisibilityRequest(BaseModel):
    is_visible: bool


@router.get("")
async def list_reviews(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    review_type: Optional[str] = Query(None, pattern="^(product|service)$"),
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """List all reviews for vendor's products/services."""
    vendor_id = await _get_vendor_id(user, db)
    repo = ReviewRepository(db)
    skip = (page - 1) * size
    items, total = await repo.list_by_vendor(vendor_id, skip, size, review_type=review_type)

    return JSONResponse(content={
        "items": [_review_to_dict(r) for r in items],
        "total": total,
        "page": page,
        "size": size,
        "pages": math.ceil(total / size) if total > 0 else 0,
    })


@router.get("/stats")
async def review_stats(
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Get overall review statistics for the vendor."""
    vendor_id = await _get_vendor_id(user, db)
    repo = ReviewRepository(db)

    product_stats = await repo.get_avg_rating("product")
    service_stats = await repo.get_avg_rating("service")

    _, product_total = await repo.list_by_vendor(vendor_id, 0, 1, review_type="product")
    _, service_total = await repo.list_by_vendor(vendor_id, 0, 1, review_type="service")

    return JSONResponse(content={
        "product_reviews": product_total,
        "service_reviews": service_total,
        "total_reviews": product_total + service_total,
    })


@router.get("/{review_id}")
async def get_review(
    review_id: UUID,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single review by ID."""
    vendor_id = await _get_vendor_id(user, db)
    repo = ReviewRepository(db)
    review = await repo.get_by_id_with_customer(review_id)
    if not review or review.vendor_id != vendor_id:
        raise HTTPException(status_code=404, detail="Review not found")
    return JSONResponse(content=_review_to_dict(review))


@router.post("/{review_id}/reply")
async def reply_to_review(
    review_id: UUID,
    data: VendorReplyRequest,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Add or update a reply to a review."""
    vendor_id = await _get_vendor_id(user, db)
    repo = ReviewRepository(db)
    review = await repo.get_by_id_with_customer(review_id)
    if not review or review.vendor_id != vendor_id:
        raise HTTPException(status_code=404, detail="Review not found")

    review.reply = data.reply
    review.replied_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(review)
    review = await repo.get_by_id_with_customer(review.id)

    return JSONResponse(content=_review_to_dict(review))


@router.patch("/{review_id}/visibility")
async def toggle_review_visibility(
    review_id: UUID,
    data: ReviewVisibilityRequest,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Show/hide a review from storefront."""
    vendor_id = await _get_vendor_id(user, db)
    repo = ReviewRepository(db)
    review = await repo.get_by_id_with_customer(review_id)
    if not review or review.vendor_id != vendor_id:
        raise HTTPException(status_code=404, detail="Review not found")

    review.is_visible = data.is_visible
    await db.commit()
    await db.refresh(review)
    review = await repo.get_by_id_with_customer(review.id)

    return JSONResponse(content=_review_to_dict(review))
