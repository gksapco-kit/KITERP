# app/api/v1/store_reviews.py
"""Customer-facing review endpoints for the storefront."""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import Optional
from pydantic import BaseModel, Field
from datetime import datetime, timezone
import math

from app.database import get_db
from app.api.deps import get_store_vendor_id, get_current_active_customer
from app.models.customer import Customer
from app.models.review import Review
from app.repositories.review_repo import ReviewRepository
from app.repositories.product_repo import ProductRepository
from app.repositories.service_repo import ServiceRepository

router = APIRouter()


class ReviewCreate(BaseModel):
    review_type: str = Field(..., pattern="^(product|service)$")
    product_id: Optional[str] = None
    service_id: Optional[str] = None
    order_id: Optional[str] = None
    rating: int = Field(..., ge=1, le=5)
    title: Optional[str] = Field(None, max_length=255)
    comment: Optional[str] = Field(None, max_length=2000)


class ReviewUpdate(BaseModel):
    rating: Optional[int] = Field(None, ge=1, le=5)
    title: Optional[str] = Field(None, max_length=255)
    comment: Optional[str] = Field(None, max_length=2000)


def _review_to_dict(r: Review) -> dict:
    customer = getattr(r, "customer", None)
    return {
        "id": str(r.id),
        "vendor_id": str(r.vendor_id),
        "customer_id": str(r.customer_id),
        "customer_name": customer.full_name if customer else None,
        "customer_avatar": customer.avatar_url if customer else None,
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
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
    }


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_review(
    data: ReviewCreate,
    customer: Customer = Depends(get_current_active_customer),
    vendor_id: UUID = Depends(get_store_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Submit a review for a product or service."""
    repo = ReviewRepository(db)

    product_id = UUID(data.product_id) if data.product_id else None
    service_id = UUID(data.service_id) if data.service_id else None
    order_id = UUID(data.order_id) if data.order_id else None

    # Validate target exists
    if data.review_type == "product":
        if not product_id:
            raise HTTPException(status_code=400, detail="product_id required for product review")
        prod_repo = ProductRepository(db)
        product = await prod_repo.get_by_vendor_and_id(vendor_id, product_id)
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
    elif data.review_type == "service":
        if not service_id:
            raise HTTPException(status_code=400, detail="service_id required for service review")
        svc_repo = ServiceRepository(db)
        service = await svc_repo.get_by_vendor_and_id(vendor_id, service_id)
        if not service:
            raise HTTPException(status_code=404, detail="Service not found")

    # Check if already reviewed
    already = await repo.customer_already_reviewed(
        customer.id, data.review_type,
        product_id=product_id, service_id=service_id,
    )
    if already:
        raise HTTPException(status_code=400, detail="You have already reviewed this item")

    # Check verified purchase (customer has an order containing this product)
    is_verified = False
    if order_id:
        from app.repositories.order_repo import OrderRepository
        order_repo = OrderRepository(db)
        order = await order_repo.get_by_vendor_and_id(vendor_id, order_id)
        if order and order.customer_id == customer.id:
            is_verified = True

    review = Review(
        vendor_id=vendor_id,
        customer_id=customer.id,
        review_type=data.review_type,
        product_id=product_id,
        service_id=service_id,
        order_id=order_id,
        rating=data.rating,
        title=data.title,
        comment=data.comment,
        is_verified_purchase=is_verified,
    )
    db.add(review)
    await db.commit()
    await db.refresh(review)

    # Re-fetch with customer
    review = await repo.get_by_id_with_customer(review.id)

    return JSONResponse(content=_review_to_dict(review), status_code=201)


@router.get("/product/{product_id}")
async def list_product_reviews(
    product_id: UUID,
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=50),
    vendor_id: UUID = Depends(get_store_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Get reviews for a product (public)."""
    repo = ReviewRepository(db)
    skip = (page - 1) * size
    items, total = await repo.list_by_product(product_id, skip, size)
    stats = await repo.get_avg_rating("product", product_id=product_id)
    distribution = await repo.get_rating_distribution("product", product_id=product_id)

    return JSONResponse(content={
        "items": [_review_to_dict(r) for r in items],
        "total": total,
        "page": page,
        "size": size,
        "pages": math.ceil(total / size) if total > 0 else 0,
        "avg_rating": stats["avg_rating"],
        "review_count": stats["review_count"],
        "distribution": distribution,
    })


@router.get("/service/{service_id}")
async def list_service_reviews(
    service_id: UUID,
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=50),
    vendor_id: UUID = Depends(get_store_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Get reviews for a service (public)."""
    repo = ReviewRepository(db)
    skip = (page - 1) * size
    items, total = await repo.list_by_service(service_id, skip, size)
    stats = await repo.get_avg_rating("service", service_id=service_id)
    distribution = await repo.get_rating_distribution("service", service_id=service_id)

    return JSONResponse(content={
        "items": [_review_to_dict(r) for r in items],
        "total": total,
        "page": page,
        "size": size,
        "pages": math.ceil(total / size) if total > 0 else 0,
        "avg_rating": stats["avg_rating"],
        "review_count": stats["review_count"],
        "distribution": distribution,
    })
