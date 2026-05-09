# app/api/v1/vendor_orders.py
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from uuid import UUID
from decimal import Decimal
from datetime import datetime
import math

from app.database import get_db
from app.api.deps import get_current_active_user
from app.models.user import User
from app.models.order import Order
from app.schemas.order import (
    OrderStatusUpdate,
    OrderStatsResponse,
    ReturnExchangeRequest,
    ReturnResolveRequest,
)
from app.services.order_service import OrderService
from app.services.vendor_service import VendorService
from app.repositories.order_repo import OrderRepository
from app.services.order_media import save_order_media_file

router = APIRouter()


def _safe(v):
    """Convert non-JSON-serializable types."""
    if v is None:
        return None
    if isinstance(v, UUID):
        return str(v)
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, datetime):
        return v.isoformat()
    return v


def _order_to_dict(order: Order) -> dict:
    """Convert an Order model to a JSON-safe dict including customer info."""
    customer = getattr(order, "customer", None)
    return {
        "id": _safe(order.id),
        "order_number": order.order_number,
        "vendor_id": _safe(order.vendor_id),
        "customer_id": _safe(order.customer_id),
        # Customer details
        "customer_name": customer.full_name if customer else None,
        "customer_email": customer.email if customer else None,
        "customer_phone": customer.phone if customer else None,
        # Items
        "items": order.items or [],
        "item_count": order.item_count or 0,
        # Pricing
        "subtotal": _safe(order.subtotal),
        "tax_amount": _safe(order.tax_amount),
        "discount_amount": _safe(order.discount_amount),
        "shipping_amount": _safe(order.shipping_amount),
        "total": _safe(order.total),
        # Status
        "status": order.status,
        "payment_status": order.payment_status,
        "payment_method": order.payment_method,
        "payment_reference": order.payment_reference,
        # Shipping
        "shipping_address": order.shipping_address,
        "tracking_number": order.tracking_number,
        "tracking_url": order.tracking_url,
        # Source
        "source": getattr(order, "source", "online") or "online",
        "pos_transaction_id": _safe(getattr(order, "pos_transaction_id", None)),
        # Coupon / discount
        "coupon_code": getattr(order, "coupon_code", None),
        # Notes
        "notes": order.notes,
        "cancel_reason": order.cancel_reason,
        "cancel_attachments": getattr(order, "cancel_attachments", None) or [],
        # Return / Exchange
        "return_type": order.return_type,
        "return_reason": order.return_reason,
        "return_status": order.return_status,
        "return_notes": order.return_notes,
        "return_attachments": getattr(order, "return_attachments", None) or [],
        "refund_amount": _safe(order.refund_amount),
        "return_tracking_number": order.return_tracking_number,
        "return_tracking_url": order.return_tracking_url,
        "return_requested_at": _safe(order.return_requested_at),
        "return_resolved_at": _safe(order.return_resolved_at),
        # Timestamps
        "created_at": _safe(order.created_at),
        "updated_at": _safe(order.updated_at),
        "confirmed_at": _safe(order.confirmed_at),
        "shipped_at": _safe(order.shipped_at),
        "delivered_at": _safe(order.delivered_at),
        # Audit log
        "status_history": [
            {
                "id": _safe(h.id),
                "from_status": h.from_status,
                "to_status": h.to_status,
                "changed_by": _safe(h.changed_by),
                "changed_by_role": h.changed_by_role,
                "notes": h.notes,
                "timestamp": _safe(h.timestamp),
            }
            for h in getattr(order, "status_history", []) or []
        ],
    }


async def _get_vendor_id(user: User, db: AsyncSession) -> UUID:
    service = VendorService(db)
    vendor = await service.get_by_user_id(user.id)
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found",
        )
    return vendor.id


@router.get("")
async def list_orders(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = Query(None, alias="status"),
    source: Optional[str] = Query(None),
    search: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """List all orders for the vendor."""
    vendor_id = await _get_vendor_id(current_user, db)
    repo = OrderRepository(db)
    skip = (page - 1) * size

    items, total = await repo.list_by_vendor(
        vendor_id=vendor_id,
        skip=skip,
        limit=size,
        status=status_filter,
        search=search,
        source=source,
    )

    return JSONResponse(content={
        "items": [_order_to_dict(o) for o in items],
        "total": total,
        "page": page,
        "size": size,
        "pages": math.ceil(total / size) if total > 0 else 0,
    })


@router.get("/stats", response_model=OrderStatsResponse)
async def get_order_stats(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Get order statistics for the vendor."""
    vendor_id = await _get_vendor_id(current_user, db)
    repo = OrderRepository(db)
    stats = await repo.get_vendor_stats(vendor_id)
    return OrderStatsResponse(**stats)


@router.post("/{order_id}/upload-media")
async def upload_order_media(
    order_id: UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload an image or video as evidence for cancel/return (vendor)."""
    vendor_id = await _get_vendor_id(current_user, db)
    repo = OrderRepository(db)
    order = await repo.get_by_vendor_and_id(vendor_id, order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )
    payload = await save_order_media_file(file, vendor_id, order_id)
    return JSONResponse(content=payload)


@router.get("/{order_id}")
async def get_order(
    order_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific order."""
    vendor_id = await _get_vendor_id(current_user, db)
    repo = OrderRepository(db)
    order = await repo.get_by_vendor_and_id(vendor_id, order_id)

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )

    return JSONResponse(content=_order_to_dict(order))


@router.put("/{order_id}/status")
async def update_order_status(
    order_id: UUID,
    data: OrderStatusUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Update order status (confirm, ship, deliver)."""
    vendor_id = await _get_vendor_id(current_user, db)
    service = OrderService(db)
    order = await service.update_status(vendor_id, order_id, data, user_id=current_user.id)

    # Re-fetch with customer loaded
    repo = OrderRepository(db)
    order = await repo.get_by_vendor_and_id(vendor_id, order_id)

    return JSONResponse(content=_order_to_dict(order))


@router.post("/{order_id}/return-resolve")
async def resolve_return(
    order_id: UUID,
    data: ReturnResolveRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Approve or reject a return/exchange request."""
    vendor_id = await _get_vendor_id(current_user, db)
    service = OrderService(db)
    order = await service.resolve_return(vendor_id, order_id, data, user_id=current_user.id)

    repo = OrderRepository(db)
    order = await repo.get_by_vendor_and_id(vendor_id, order_id)
    return JSONResponse(content=_order_to_dict(order))


@router.post("/{order_id}/return-request")
async def request_return_exchange(
    order_id: UUID,
    data: ReturnExchangeRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Initiate a return/exchange request from vendor side."""
    vendor_id = await _get_vendor_id(current_user, db)
    repo = OrderRepository(db)
    order = await repo.get_by_vendor_and_id(vendor_id, order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )

    service = OrderService(db)
    # Reuse existing service transition logic for return/exchange initiation.
    await service.request_return_exchange(
        vendor_id=vendor_id,
        customer_id=order.customer_id,
        order_id=order_id,
        data=data,
        user_id=current_user.id,
        initiated_by_role="vendor",
    )

    order = await repo.get_by_vendor_and_id(vendor_id, order_id)
    return JSONResponse(content=_order_to_dict(order))
