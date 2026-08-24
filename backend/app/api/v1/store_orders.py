# app/api/v1/store_orders.py
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from decimal import Decimal
from datetime import datetime
import math

from app.database import get_db
from app.api.deps import get_store_vendor_id, get_current_active_customer
from app.models.customer import Customer
from app.models.order import Order
from app.schemas.order import (
    CheckoutRequest, GuestCheckoutRequest,
    OrderCancelRequest, ReturnExchangeRequest, QuoteRequest,
    PaymentProofSubmit,
)
from app.services.order_service import OrderService
from app.services.invoice_service import InvoiceService
from app.repositories.order_repo import OrderRepository
from app.services.order_media import save_order_media_file

router = APIRouter()


def _safe(v):
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
    return {
        "id": _safe(order.id),
        "order_number": order.order_number,
        "vendor_id": _safe(order.vendor_id),
        "customer_id": _safe(order.customer_id),
        "items": order.items or [],
        "item_count": order.item_count or 0,
        "subtotal": _safe(order.subtotal),
        "tax_amount": _safe(order.tax_amount),
        "discount_amount": _safe(order.discount_amount),
        "shipping_amount": _safe(order.shipping_amount),
        "total": _safe(order.total),
        "status": order.status,
        "payment_status": order.payment_status,
        "payment_method": order.payment_method,
        "payment_reference": order.payment_reference,
        "payment_proof": getattr(order, "payment_proof", None),
        "shipping_address": order.shipping_address,
        "tracking_number": order.tracking_number,
        "tracking_url": order.tracking_url,
        "notes": order.notes,
        "cancel_reason": order.cancel_reason,
        "return_type": order.return_type,
        "return_reason": order.return_reason,
        "return_status": order.return_status,
        "return_notes": order.return_notes,
        "return_attachments": order.return_attachments or [],
        "refund_amount": _safe(order.refund_amount),
        "return_tracking_number": order.return_tracking_number,
        "return_tracking_url": order.return_tracking_url,
        "return_requested_at": _safe(order.return_requested_at),
        "return_resolved_at": _safe(order.return_resolved_at),
        "created_at": _safe(order.created_at),
        "updated_at": _safe(order.updated_at),
        "confirmed_at": _safe(order.confirmed_at),
        "shipped_at": _safe(order.shipped_at),
        "delivered_at": _safe(order.delivered_at),
        "cancel_attachments": getattr(order, "cancel_attachments", None) or [],
        "source": getattr(order, "source", "online") or "online",
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


@router.post("/guest-checkout", status_code=status.HTTP_201_CREATED)
async def guest_checkout(
    data: GuestCheckoutRequest,
    vendor_id: UUID = Depends(get_store_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Place an order without a logged-in account (guest checkout)."""
    from app.repositories.customer_repo import CustomerRepository
    from app.repositories.vendor_repo import VendorRepository
    from app.core.security import create_access_token, create_refresh_token
    from app.services.checkout_service import is_sign_in_mandatory, item_kinds_for_sign_in

    vendor_repo = VendorRepository(db)
    vendor = await vendor_repo.get_by_id(vendor_id)
    if not vendor:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Store not found")
    if is_sign_in_mandatory(vendor, item_kinds_for_sign_in([i.model_dump() for i in data.items])):
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Sign in is required to place an order at this store",
        )

    service = OrderService(db)
    order = await service.guest_checkout(vendor_id, data)

    repo = CustomerRepository(db)
    customer = await repo.get_by_vendor_and_id(vendor_id, order.customer_id)
    token_data = {
        "sub": str(order.customer_id),
        "vendor_id": str(vendor_id),
        "role": "customer",
        "email": customer.email if customer else data.customer.email,
    }
    payload = _order_to_dict(order)
    payload["access_token"] = create_access_token(data=token_data)
    payload["refresh_token"] = create_refresh_token(data=token_data)
    if customer:
        payload["customer"] = {
            "id": str(customer.id),
            "full_name": customer.full_name,
            "email": customer.email,
            "phone": customer.phone,
        }
    return JSONResponse(content=payload, status_code=201)


@router.post("/checkout", status_code=status.HTTP_201_CREATED)
async def checkout(
    data: CheckoutRequest,
    customer: Customer = Depends(get_current_active_customer),
    vendor_id: UUID = Depends(get_store_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Place an order from the current cart."""
    service = OrderService(db)
    order = await service.checkout(vendor_id, customer.id, data)
    return JSONResponse(content=_order_to_dict(order), status_code=201)


@router.post("/quote-request", status_code=status.HTTP_201_CREATED)
async def request_quote(
    data: QuoteRequest,
    customer: Customer = Depends(get_current_active_customer),
    vendor_id: UUID = Depends(get_store_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Submit a quote request for a service. Creates an order with source=quote."""
    repo = OrderRepository(db)
    order_number = await repo.get_next_order_number(vendor_id)

    # Build notes from form_data or legacy fields
    notes_parts = []
    fd = data.form_data or {}
    if fd.get("message") or data.message:
        notes_parts.append(fd.get("message") or data.message)
    if fd.get("preferred_date") or data.preferred_date:
        notes_parts.append(f"Preferred date: {fd.get('preferred_date') or data.preferred_date}")
    if fd.get("preferred_time") or data.preferred_time:
        notes_parts.append(f"Preferred time: {fd.get('preferred_time') or data.preferred_time}")
    for k, v in fd.items():
        if k not in ("message", "preferred_date", "preferred_time") and v:
            notes_parts.append(f"{k.replace('_', ' ').title()}: {v}")

    is_product = data.item_type == "product" or data.product_id
    item_id_key = "product_id" if is_product else "service_id"
    item_id_val = data.product_id if is_product else data.service_id
    item_name = data.product_name if is_product else data.service_name

    from app.services.store_resolver import resolve_store_id as _resolve_txn_store_id
    quote_store_id = await _resolve_txn_store_id(db, vendor_id)

    order = Order(
        order_number=order_number,
        vendor_id=vendor_id,
        customer_id=customer.id,
        store_id=quote_store_id,
        items=[{
            item_id_key: item_id_val,
            "name": item_name,
            "qty": 1,
            "price": 0,
            "item_type": "product" if is_product else "service",
            "form_data": fd,
        }],
        item_count=1,
        subtotal=0,
        tax_amount=0,
        discount_amount=0,
        shipping_amount=0,
        total=0,
        status="quote_requested",
        payment_status="pending",
        source="quote",
        notes="\n".join(notes_parts) if notes_parts else None,
    )
    db.add(order)
    await db.commit()
    await db.refresh(order)

    return JSONResponse(content=_order_to_dict(order), status_code=201)


@router.get("")
async def list_my_orders(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    customer: Customer = Depends(get_current_active_customer),
    vendor_id: UUID = Depends(get_store_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Get the customer's order history."""
    repo = OrderRepository(db)
    skip = (page - 1) * size
    items, total = await repo.list_by_customer(vendor_id, customer.id, skip, size)

    return JSONResponse(content={
        "items": [_order_to_dict(o) for o in items],
        "total": total,
        "page": page,
        "size": size,
        "pages": math.ceil(total / size) if total > 0 else 0,
    })


@router.post("/{order_id}/upload-media")
async def upload_order_media(
    order_id: UUID,
    file: UploadFile = File(...),
    customer: Customer = Depends(get_current_active_customer),
    vendor_id: UUID = Depends(get_store_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Upload an image or video as evidence for cancel/return (customer)."""
    repo = OrderRepository(db)
    order = await repo.get_by_vendor_and_id(vendor_id, order_id)
    if not order or order.customer_id != customer.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )
    payload = await save_order_media_file(file, vendor_id, order_id)
    return JSONResponse(content=payload)


@router.post("/{order_id}/payment-proof")
async def submit_payment_proof(
    order_id: UUID,
    data: PaymentProofSubmit,
    customer: Customer = Depends(get_current_active_customer),
    vendor_id: UUID = Depends(get_store_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Submit UTR and payment screenshot for manual UPI orders."""
    service = OrderService(db)
    order = await service.submit_payment_proof(vendor_id, customer.id, order_id, data)
    return JSONResponse(content=_order_to_dict(order))


@router.get("/{order_id}")
async def get_order(
    order_id: UUID,
    customer: Customer = Depends(get_current_active_customer),
    vendor_id: UUID = Depends(get_store_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific order."""
    repo = OrderRepository(db)
    order = await repo.get_by_vendor_and_id(vendor_id, order_id)

    if not order or order.customer_id != customer.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )

    return JSONResponse(content=_order_to_dict(order))


@router.post("/{order_id}/cancel")
async def cancel_order(
    order_id: UUID,
    data: OrderCancelRequest,
    customer: Customer = Depends(get_current_active_customer),
    vendor_id: UUID = Depends(get_store_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Cancel an order."""
    service = OrderService(db)
    order = await service.cancel_order(vendor_id, customer.id, order_id, data)
    return JSONResponse(content=_order_to_dict(order))


@router.post("/{order_id}/return")
async def request_return(
    order_id: UUID,
    data: ReturnExchangeRequest,
    customer: Customer = Depends(get_current_active_customer),
    vendor_id: UUID = Depends(get_store_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Request a return or exchange for a delivered order."""
    service = OrderService(db)
    order = await service.request_return_exchange(vendor_id, customer.id, order_id, data)
    return JSONResponse(content=_order_to_dict(order))


@router.get("/{order_id}/invoice")
async def get_order_invoice(
    order_id: UUID,
    customer: Customer = Depends(get_current_active_customer),
    vendor_id: UUID = Depends(get_store_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Get the invoice for a specific order."""
    repo = OrderRepository(db)
    order = await repo.get_by_vendor_and_id(vendor_id, order_id)
    if not order or order.customer_id != customer.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    svc = InvoiceService(db)
    inv = await svc.get_by_order_id(order_id, vendor_id)
    if not inv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not yet generated")

    return JSONResponse(content={
        "id": str(inv.id),
        "invoice_number": inv.invoice_number,
        "invoice_type": inv.invoice_type,
        "document_type": inv.document_type,
        "vendor_name": inv.vendor_name,
        "vendor_gstin": inv.vendor_gstin,
        "customer_name": inv.customer_name,
        "billing_address": inv.billing_address,
        "shipping_address": inv.shipping_address,
        "items": inv.items or [],
        "item_count": inv.item_count or 0,
        "subtotal": float(inv.subtotal or 0),
        "discount_amount": float(inv.discount_amount or 0),
        "taxable_amount": float(inv.taxable_amount or 0),
        "cgst_amount": float(inv.cgst_amount or 0),
        "sgst_amount": float(inv.sgst_amount or 0),
        "igst_amount": float(inv.igst_amount or 0),
        "total_tax": float(inv.total_tax or 0),
        "total": float(inv.total or 0),
        "amount_paid": float(inv.amount_paid or 0),
        "balance_due": float(inv.balance_due or 0),
        "status": inv.status,
        "is_gst": inv.is_gst,
        "created_at": inv.created_at.isoformat() if inv.created_at else None,
    })


@router.post("/{order_id}/dispute", status_code=status.HTTP_201_CREATED)
async def file_order_dispute(
    order_id: UUID,
    body: dict,
    customer: Customer = Depends(get_current_active_customer),
    vendor_id: UUID = Depends(get_store_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Customer files a dispute on an order (routed to platform admin)."""
    from app.models.order_dispute import OrderDispute

    repo = OrderRepository(db)
    order = await repo.get_by_vendor_and_id(vendor_id, order_id)
    if not order or order.customer_id != customer.id:
        raise HTTPException(404, "Order not found")
    reason = (body.get("reason") or "").strip()
    if not reason:
        raise HTTPException(400, "reason is required")
    dispute = OrderDispute(
        order_id=order.id,
        vendor_id=vendor_id,
        customer_id=customer.id,
        dispute_type=body.get("dispute_type") or "general",
        reason=reason,
        amount=body.get("amount"),
        status="open",
    )
    db.add(dispute)
    await db.commit()
    await db.refresh(dispute)
    return {"ok": True, "dispute_id": str(dispute.id), "status": dispute.status}
