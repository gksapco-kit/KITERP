# app/api/v1/vendor_orders.py
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from uuid import UUID
from decimal import Decimal
from datetime import datetime
import math

from app.database import get_db
from app.api.deps import get_current_active_user, require_permission
from app.models.user import User
from app.models.order import Order, OrderLine, OrderDelivery, DeliveryLine
from app.models.store import Store
from app.models.pos import POSTransaction
from app.models.booking import Booking
from app.models.vendor_user import VendorUser
from app.schemas.order import (
    OrderStatusUpdate,
    OrderStatsResponse,
    ReturnExchangeRequest,
    ReturnResolveRequest,
    PaymentProofReview,
    VendorOrderCreateRequest,
    GuestCheckoutRequest,
    GuestCustomerInfo,
    GuestCartItem,
    ShippingAddress,
)
from app.services.order_service import OrderService
from app.services.vendor_service import VendorService
from app.repositories.order_repo import OrderRepository
from app.services.order_media import save_order_media_file

router = APIRouter(dependencies=[Depends(require_permission("orders.view"))])


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


def _schedule_to_dict(s) -> dict:
    return {
        "id": _safe(s.id),
        "schedule_no": s.schedule_no,
        "requested_date": s.requested_date.isoformat() if s.requested_date else None,
        "confirmed_date": s.confirmed_date.isoformat() if s.confirmed_date else None,
        "requested_qty": float(s.requested_qty),
        "confirmed_qty": float(s.confirmed_qty),
        "shipped_qty": float(s.shipped_qty),
        "status": s.status,
        "commitment_source": s.commitment_source,
        "notes": s.notes,
    }


def _line_to_dict(line: OrderLine) -> dict:
    return {
        "id": _safe(line.id),
        "line_no": line.line_no,
        "parent_line_id": _safe(line.parent_line_id),
        "product_id": _safe(line.product_id),
        "variant_id": _safe(line.variant_id),
        "service_id": _safe(line.service_id),
        "item_type": line.item_type,
        "item_name": line.item_name,
        "item_sku": line.item_sku,
        "item_image_url": line.item_image_url,
        "line_type": line.line_type,
        "ordered_qty": float(line.ordered_qty),
        "committed_qty": float(line.committed_qty),
        "shipped_qty": float(line.shipped_qty),
        "invoiced_qty": float(line.invoiced_qty),
        "returned_qty": float(line.returned_qty),
        "rejected_qty": float(line.rejected_qty),
        "unit_of_measure": line.unit_of_measure,
        "list_price": float(line.list_price),
        "net_price": float(line.net_price),
        "discount_pct": float(line.discount_pct),
        "discount_amount": float(line.discount_amount),
        "tax_rate": float(line.tax_rate),
        "tax_amount": float(line.tax_amount),
        "line_total": float(line.line_total),
        "plant_id": _safe(line.plant_id),
        "storage_location_id": _safe(line.storage_location_id),
        "cost_center_id": _safe(line.cost_center_id),
        "profit_center_id": _safe(line.profit_center_id),
        "batch_number": line.batch_number,
        "serial_numbers": line.serial_numbers or [],
        "rejection_reason": line.rejection_reason,
        "line_notes": line.line_notes,
        "price_rule_id": _safe(line.price_rule_id),
        "price_rule_type": line.price_rule_type,
        "schedules": [
            _schedule_to_dict(s)
            for s in sorted(getattr(line, "schedules", []) or [], key=lambda x: x.schedule_no)
        ],
        "created_at": _safe(line.created_at),
        "updated_at": _safe(line.updated_at),
    }


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
        "payment_proof": getattr(order, "payment_proof", None),
        # Shipping
        "shipping_address": order.shipping_address,
        "tracking_number": order.tracking_number,
        "tracking_url": order.tracking_url,
        "delivery_staff_id": _safe(getattr(order, "delivery_staff_id", None)),
        "delivery_staff_name": getattr(order, "delivery_staff_name", None),
        "delivery_assigned_at": order.delivery_assigned_at.isoformat() if getattr(order, "delivery_assigned_at", None) else None,
        "delivery_status": getattr(order, "delivery_status", None),
        # Source & location
        "source": getattr(order, "source", "online") or "online",
        "store_id": _safe(getattr(order, "store_id", None)),
        "sales_area_id": _safe(getattr(order, "sales_area_id", None)),
        "delivery_channel_id": _safe(getattr(order, "delivery_channel_id", None)),
        "pos_transaction_id": _safe(getattr(order, "pos_transaction_id", None)),
        # Phase-1 enrichment
        "order_type": getattr(order, "order_type", None) or "standard",
        "payment_terms_code": getattr(order, "payment_terms_code", None),
        "payment_terms_days": getattr(order, "payment_terms_days", None),
        "shipping_terms": getattr(order, "shipping_terms", None),
        "order_reason": getattr(order, "order_reason", None),
        "requested_delivery_date": (
            order.requested_delivery_date.isoformat()
            if getattr(order, "requested_delivery_date", None) else None
        ),
        "pricing_date": (
            order.pricing_date.isoformat()
            if getattr(order, "pricing_date", None) else None
        ),
        "currency": getattr(order, "currency", None) or "INR",
        "exchange_rate": float(order.exchange_rate) if getattr(order, "exchange_rate", None) else 1.0,
        "fulfillment_block": getattr(order, "fulfillment_block", None),
        "billing_block": getattr(order, "billing_block", None),
        "credit_status": getattr(order, "credit_status", None),
        "fulfillment_status": getattr(order, "fulfillment_status", None),
        "billing_status": getattr(order, "billing_status", None),
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
        # Normalized line items (Phase-2)
        "order_lines": [
            _line_to_dict(ln)
            for ln in sorted(getattr(order, "lines", []) or [], key=lambda x: x.line_no)
        ],
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
        # Delivery documents (Phase-4)
        "deliveries": [
            _delivery_to_dict(d)
            for d in sorted(getattr(order, "deliveries", []) or [], key=lambda x: x.created_at or "")
        ] if hasattr(order, "deliveries") and getattr(order, "deliveries", None) is not None else [],
        # Pricing conditions (Phase-7)
        "pricing_conditions": [
            {
                "id": _safe(pc.id),
                "step_no": pc.step_no,
                "condition_type": pc.condition_type,
                "description": pc.description,
                "calc_type": pc.calc_type,
                "value": float(pc.value),
                "base_amount": float(pc.base_amount) if pc.base_amount is not None else None,
                "condition_amount": float(pc.condition_amount),
                "is_manual": bool(pc.is_manual),
                "notes": pc.notes,
                "created_at": _safe(pc.created_at),
            }
            for pc in sorted(getattr(order, "pricing_conditions", []) or [], key=lambda x: x.step_no)
        ],
        # Partner functions (Phase-6)
        "partners": [
            {
                "id": _safe(p.id),
                "role": p.role,
                "customer_id": _safe(p.customer_id),
                "contact_name": p.contact_name,
                "contact_email": p.contact_email,
                "contact_phone": p.contact_phone,
                "company_name": p.company_name,
                "gstin": p.gstin,
                "address": p.address,
                "notes": p.notes,
            }
            for p in sorted(getattr(order, "partners", []) or [], key=lambda x: x.role)
        ],
    }


async def _user_via_vendor_user(db: AsyncSession, vendor_user_id: UUID) -> Optional[User]:
    """Resolve the platform User behind a VendorUser in a single joined query."""
    result = await db.execute(
        select(User).join(VendorUser, VendorUser.user_id == User.id).where(VendorUser.id == vendor_user_id)
    )
    return result.scalar_one_or_none()


async def _enrich_order_dict(db: AsyncSession, order: Order, d: dict) -> dict:
    """Resolve store name and who placed the order (channel-specific).

    Note: lookups run sequentially (not via asyncio.gather) because they share
    a single AsyncSession, which SQLAlchemy does not allow concurrent use of.
    Each branch is collapsed to at most one round-trip via joined queries.
    """
    store_id = getattr(order, "store_id", None)
    if store_id:
        store = await db.get(Store, store_id)
        d["store_name"] = store.name if store else None
        d["store_code"] = store.code if store else None
    else:
        d["store_name"] = None
        d["store_code"] = None

    source = (d.get("source") or "online").lower()
    placed_by_name: str | None = None
    placed_by_type: str | None = None

    if source == "pos" and d.get("pos_transaction_id"):
        try:
            txn = await db.get(POSTransaction, UUID(d["pos_transaction_id"]))
        except ValueError:
            txn = None
        if txn:
            if txn.sales_person_vendor_user_id:
                sp_user = await _user_via_vendor_user(db, txn.sales_person_vendor_user_id)
                if sp_user:
                    placed_by_name = (sp_user.full_name or sp_user.email or "").strip() or None
                    placed_by_type = "staff"
            if not placed_by_name and txn.cashier_id:
                cashier = await db.get(User, txn.cashier_id)
                if cashier:
                    placed_by_name = (cashier.full_name or cashier.email or "").strip() or None
                    placed_by_type = "cashier"
    elif source == "booking":
        booking_id = None
        items = d.get("items") or []
        if items and isinstance(items[0], dict):
            booking_id = items[0].get("booking_id")
        if booking_id:
            try:
                booking = await db.get(Booking, UUID(str(booking_id)))
            except ValueError:
                booking = None
            if booking:
                history = booking.status_history or []
                first = history[0] if history and isinstance(history[0], dict) else None
                if first and first.get("changed_by_name"):
                    placed_by_name = str(first["changed_by_name"]).strip() or None
                    placed_by_type = "staff"
                elif booking.assigned_staff_name:
                    placed_by_name = booking.assigned_staff_name
                    placed_by_type = "staff"
        if not placed_by_name:
            placed_by_name = d.get("customer_name")
            placed_by_type = "customer"
    else:
        placed_by_name = d.get("customer_name")
        placed_by_type = "customer"

    d["placed_by_name"] = placed_by_name
    d["placed_by_type"] = placed_by_type

    delivery_staff_id = getattr(order, "delivery_staff_id", None)
    delivery_staff_user = await _user_via_vendor_user(db, delivery_staff_id) if delivery_staff_id else None
    d["delivery_staff_email"] = delivery_staff_user.email if delivery_staff_user else None
    d["delivery_staff_phone"] = delivery_staff_user.phone if delivery_staff_user else None

    return d


async def _get_vendor_id(user: User, db: AsyncSession) -> UUID:
    service = VendorService(db)
    vendor = await service.get_by_user_id(user.id)
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found",
        )
    return vendor.id


@router.post("", dependencies=[Depends(require_permission("orders.manage"))])
async def create_vendor_order(
    body: VendorOrderCreateRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a manual / counter-sale order from the vendor dashboard."""
    vendor_id = await _get_vendor_id(current_user, db)
    service = OrderService(db)

    # Build a shipping address (use placeholders for counter / phone sales with no address)
    if body.shipping_street and body.shipping_city and body.shipping_state and body.shipping_postal_code:
        shipping_addr = ShippingAddress(
            street_address=body.shipping_street,
            city=body.shipping_city,
            state=body.shipping_state,
            postal_code=body.shipping_postal_code,
            country=body.shipping_country,
        )
    else:
        shipping_addr = ShippingAddress(
            street_address="-",
            city=body.shipping_city or "-",
            state=body.shipping_state or "-",
            postal_code=body.shipping_postal_code or "000000",
            country=body.shipping_country,
        )

    if body.customer_id:
        # Existing customer — resolve name/email from DB for the guest_checkout path
        from sqlalchemy import select as _select
        from app.models.customer import Customer
        try:
            cust_uuid = UUID(body.customer_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid customer_id")
        cust_row = await db.execute(_select(Customer).where(Customer.id == cust_uuid))
        customer_obj = cust_row.scalar_one_or_none()
        if not customer_obj:
            raise HTTPException(status_code=404, detail="Customer not found")
        guest_customer = GuestCustomerInfo(
            full_name=customer_obj.full_name,
            email=customer_obj.email,
            phone=customer_obj.phone or None,
        )
    else:
        guest_customer = GuestCustomerInfo(
            full_name=body.customer_name,
            email=body.customer_email,
            phone=body.customer_phone or None,
        )

    guest_items = [
        GuestCartItem(
            product_id=i.product_id,
            service_id=i.service_id,
            item_type=i.item_type,
            variant_id=i.variant_id,
            name=i.name,
            qty=i.qty,
            price=i.price,
            image_url=i.image_url,
        )
        for i in body.items
    ]

    guest_req = GuestCheckoutRequest(
        customer=guest_customer,
        items=guest_items,
        shipping_address=shipping_addr,
        payment_method=body.payment_method,
        shipping_method_id=body.shipping_method_id,
        notes=body.notes,
        coupon_code=body.coupon_code,
        store_id=body.store_id,
        order_type=body.order_type,
        payment_terms_code=body.payment_terms_code,
        payment_terms_days=body.payment_terms_days,
        shipping_terms=body.shipping_terms,
        order_reason=body.order_reason,
        requested_delivery_date=body.requested_delivery_date,
        pricing_date=body.pricing_date,
        currency=body.currency,
        exchange_rate=body.exchange_rate,
    )

    order = await service.guest_checkout(vendor_id, guest_req)

    # Mark as vendor / counter-sale source
    order.source = "pos"
    await db.commit()
    await db.refresh(order)

    repo = OrderRepository(db)
    order = await repo.get_by_vendor_and_id(vendor_id, order.id)
    return JSONResponse(
        status_code=201,
        content=await _enrich_order_dict(db, order, _order_to_dict(order)),
    )


@router.get("")
async def list_orders(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=200),
    status_filter: Optional[str] = Query(None, alias="status"),
    source: Optional[str] = Query(None),
    search: Optional[str] = None,
    store_id: Optional[str] = Query(None),
    sales_area_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """List all orders for the vendor."""
    vendor_id = await _get_vendor_id(current_user, db)
    repo = OrderRepository(db)
    skip = (page - 1) * size

    store_uuid = None
    if store_id:
        try:
            store_uuid = UUID(store_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid store_id")

    sales_area_uuid = None
    if sales_area_id:
        try:
            sales_area_uuid = UUID(sales_area_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid sales_area_id")

    items, total = await repo.list_by_vendor(
        vendor_id=vendor_id,
        skip=skip,
        limit=size,
        status=status_filter,
        search=search,
        source=source,
        store_id=store_uuid,
        sales_area_id=sales_area_uuid,
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

    return JSONResponse(content=await _enrich_order_dict(db, order, _order_to_dict(order)))


@router.put("/{order_id}/assign-delivery")
async def assign_order_delivery(
    order_id: UUID,
    body: dict,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Assign a delivery staff member to an order."""
    vendor_id = await _get_vendor_id(current_user, db)
    service = OrderService(db)
    order = await service.assign_delivery(
        vendor_id,
        order_id,
        staff_id=body.get("staff_id"),
        staff_name=body.get("staff_name"),
    )
    return JSONResponse(content=await _enrich_order_dict(db, order, _order_to_dict(order)))


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

    return JSONResponse(content=await _enrich_order_dict(db, order, _order_to_dict(order)))


@router.post("/{order_id}/approve-payment")
async def approve_manual_payment(
    order_id: UUID,
    data: PaymentProofReview = PaymentProofReview(),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Approve a submitted manual UPI payment proof."""
    vendor_id = await _get_vendor_id(current_user, db)
    service = OrderService(db)
    order = await service.approve_manual_payment(vendor_id, order_id, data, user_id=current_user.id)
    repo = OrderRepository(db)
    order = await repo.get_by_vendor_and_id(vendor_id, order_id)
    return JSONResponse(content=await _enrich_order_dict(db, order, _order_to_dict(order)))


@router.post("/{order_id}/reject-payment")
async def reject_manual_payment(
    order_id: UUID,
    data: PaymentProofReview = PaymentProofReview(),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Reject a submitted manual UPI payment proof."""
    vendor_id = await _get_vendor_id(current_user, db)
    service = OrderService(db)
    order = await service.reject_manual_payment(vendor_id, order_id, data, user_id=current_user.id)
    repo = OrderRepository(db)
    order = await repo.get_by_vendor_and_id(vendor_id, order_id)
    return JSONResponse(content=await _enrich_order_dict(db, order, _order_to_dict(order)))


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
    return JSONResponse(content=await _enrich_order_dict(db, order, _order_to_dict(order)))


# ── Order line backfill ────────────────────────────────────────────────────────
# Migrates JSONB items → order_line rows for orders placed before Phase-2.
# Safe to call multiple times; skips orders that already have lines.

@router.post(
    "/admin/backfill-lines",
    dependencies=[Depends(require_permission("orders.manage"))],
)
async def backfill_order_lines(
    limit: int = 500,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Backfill order_line rows from JSONB order.items for pre-Phase-2 orders.

    Run once after deploying the migration. Pass `limit` to process in batches.
    """
    from sqlalchemy import not_

    vendor_id = await _get_vendor_id(current_user, db)

    subq = (
        select(OrderLine.order_id)
        .where(OrderLine.order_id == Order.id)
        .correlate(Order)
        .exists()
    )
    result = await db.execute(
        select(Order)
        .where(Order.vendor_id == vendor_id, not_(subq))
        .order_by(Order.created_at.asc())
        .limit(limit)
    )
    orders = result.scalars().all()

    processed = skipped = errored = 0
    for order in orders:
        items = order.items or []
        if not items:
            skipped += 1
            continue
        try:
            for idx, item in enumerate(items):
                line_no = (idx + 1) * 10
                list_p = float(item.get("list_price") or item.get("price") or 0)
                net_p = float(item.get("price") or 0)
                qty = float(item.get("qty") or 1)
                tax_r = float(item.get("tax_rate") or 0)
                tax_a = float(item.get("tax_amount") or 0)
                discount_a = round(max(0.0, list_p - net_p), 2)
                discount_pct = round((discount_a / list_p * 100) if list_p > 0 else 0.0, 4)
                rule = item.get("price_rule") or {}
                rule_id = None
                if rule.get("id"):
                    try:
                        rule_id = UUID(rule["id"])
                    except (ValueError, TypeError):
                        pass
                product_id = None
                if item.get("product_id"):
                    try:
                        product_id = UUID(str(item["product_id"]))
                    except (ValueError, TypeError):
                        pass
                variant_id = None
                if item.get("variant_id"):
                    try:
                        variant_id = UUID(str(item["variant_id"]))
                    except (ValueError, TypeError):
                        pass
                service_id = None
                if item.get("service_id"):
                    try:
                        service_id = UUID(str(item["service_id"]))
                    except (ValueError, TypeError):
                        pass
                line = OrderLine(
                    order_id=order.id,
                    vendor_id=order.vendor_id,
                    line_no=line_no,
                    product_id=product_id,
                    variant_id=variant_id,
                    service_id=service_id,
                    item_type=item.get("item_type") or ("service" if service_id else "product"),
                    item_name=str(item.get("name") or ""),
                    item_sku=item.get("sku") or None,
                    item_image_url=item.get("image_url") or None,
                    line_type="standard",
                    ordered_qty=qty,
                    unit_of_measure=item.get("uom") or "EA",
                    list_price=list_p,
                    net_price=net_p,
                    discount_pct=discount_pct,
                    discount_amount=discount_a,
                    tax_rate=tax_r,
                    tax_amount=tax_a,
                    line_total=round(net_p * qty, 2),
                    price_rule_id=rule_id,
                    price_rule_type=rule.get("type") or None,
                )
                db.add(line)
            processed += 1
        except Exception as exc:
            import logging as _logging
            _logging.getLogger(__name__).warning(
                "backfill_order_lines: error on order %s: %s", order.id, exc
            )
            errored += 1

    await db.commit()
    return JSONResponse(content={
        "processed": processed,
        "skipped": skipped,
        "errored": errored,
        "remaining_hint": "Call again if processed == limit",
    })


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
    return JSONResponse(content=await _enrich_order_dict(db, order, _order_to_dict(order)))


# --- Delivery document endpoints (Phase-4) ------------------------------------

def _delivery_line_to_dict(dl: DeliveryLine) -> dict:
    return {
        "id": _safe(dl.id),
        "delivery_id": _safe(dl.delivery_id),
        "order_line_id": _safe(dl.order_line_id),
        "line_no": dl.line_no,
        "product_id": _safe(dl.product_id),
        "variant_id": _safe(dl.variant_id),
        "product_name": dl.product_name,
        "sku": dl.sku,
        "unit": dl.unit,
        "planned_qty": float(dl.planned_qty),
        "picked_qty": float(dl.picked_qty),
        "packed_qty": float(dl.packed_qty),
        "issued_qty": float(dl.issued_qty),
        "status": dl.status,
        "batch_number": dl.batch_number,
        "serial_number": dl.serial_number,
        "notes": dl.notes,
    }


def _delivery_to_dict(d: OrderDelivery) -> dict:
    return {
        "id": _safe(d.id),
        "delivery_number": d.delivery_number,
        "order_id": _safe(d.order_id),
        "delivery_type": d.delivery_type,
        "status": d.status,
        "planned_gi_date": d.planned_gi_date.isoformat() if d.planned_gi_date else None,
        "actual_gi_date": d.actual_gi_date.isoformat() if d.actual_gi_date else None,
        "carrier": d.carrier,
        "tracking_number": d.tracking_number,
        "shipping_address": d.shipping_address,
        "notes": d.notes,
        "created_at": _safe(d.created_at),
        "updated_at": _safe(d.updated_at),
        "lines": [_delivery_line_to_dict(l) for l in sorted(getattr(d, "lines", []) or [], key=lambda x: x.line_no)],
    }


@router.post(
    "/{order_id}/deliveries",
    dependencies=[Depends(require_permission("orders.manage"))],
    status_code=201,
)
async def create_delivery(
    order_id: UUID,
    body: dict,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    from app.services.delivery_service import create_delivery as svc_create
    from datetime import date as _date

    vendor_id = await _get_vendor_id(current_user, db)
    items = body.get("items", [])
    planned_gi_raw = body.get("planned_gi_date")
    planned_gi = _date.fromisoformat(planned_gi_raw) if planned_gi_raw else None

    delivery = await svc_create(
        db=db,
        vendor_id=vendor_id,
        order_id=order_id,
        items=items,
        planned_gi_date=planned_gi,
        shipping_address=body.get("shipping_address"),
        carrier=body.get("carrier"),
        tracking_number=body.get("tracking_number"),
        notes=body.get("notes"),
        created_by=current_user.id,
    )
    await db.commit()
    await db.refresh(delivery)
    return JSONResponse(status_code=201, content=_delivery_to_dict(delivery))


@router.get("/{order_id}/deliveries")
async def list_deliveries(
    order_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    vendor_id = await _get_vendor_id(current_user, db)
    result = await db.execute(
        select(OrderDelivery).where(
            OrderDelivery.order_id == order_id,
            OrderDelivery.vendor_id == vendor_id,
        ).order_by(OrderDelivery.created_at)
    )
    deliveries = result.scalars().all()
    return [_delivery_to_dict(d) for d in deliveries]


@router.get("/{order_id}/deliveries/{delivery_id}")
async def get_delivery(
    order_id: UUID,
    delivery_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    vendor_id = await _get_vendor_id(current_user, db)
    result = await db.execute(
        select(OrderDelivery).where(
            OrderDelivery.id == delivery_id,
            OrderDelivery.order_id == order_id,
            OrderDelivery.vendor_id == vendor_id,
        )
    )
    d = result.scalar_one_or_none()
    if not d:
        raise HTTPException(404, "Delivery not found")
    return _delivery_to_dict(d)


@router.patch(
    "/{order_id}/deliveries/{delivery_id}",
    dependencies=[Depends(require_permission("orders.manage"))],
)
async def update_delivery(
    order_id: UUID,
    delivery_id: UUID,
    body: dict,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    from app.services.delivery_service import update_delivery_lines

    vendor_id = await _get_vendor_id(current_user, db)
    delivery = await update_delivery_lines(
        db=db,
        vendor_id=vendor_id,
        delivery_id=delivery_id,
        line_updates=body.get("line_updates", []),
    )
    await db.commit()
    await db.refresh(delivery)
    return _delivery_to_dict(delivery)


@router.post(
    "/{order_id}/deliveries/{delivery_id}/goods-issue",
    dependencies=[Depends(require_permission("orders.manage"))],
)
async def post_goods_issue(
    order_id: UUID,
    delivery_id: UUID,
    body: dict | None = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    from app.services.delivery_service import post_goods_issue as svc_gi
    from datetime import date as _date

    vendor_id = await _get_vendor_id(current_user, db)
    gi_date_raw = (body or {}).get("actual_gi_date")
    gi_date = _date.fromisoformat(gi_date_raw) if gi_date_raw else None

    delivery = await svc_gi(
        db=db,
        vendor_id=vendor_id,
        delivery_id=delivery_id,
        actual_gi_date=gi_date,
    )
    await db.commit()
    await db.refresh(delivery)
    return _delivery_to_dict(delivery)


@router.post(
    "/{order_id}/deliveries/{delivery_id}/cancel",
    dependencies=[Depends(require_permission("orders.manage"))],
)
async def cancel_delivery(
    order_id: UUID,
    delivery_id: UUID,
    body: dict | None = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    from app.services.delivery_service import cancel_delivery as svc_cancel

    vendor_id = await _get_vendor_id(current_user, db)
    delivery = await svc_cancel(
        db=db,
        vendor_id=vendor_id,
        delivery_id=delivery_id,
        reason=(body or {}).get("reason"),
    )
    await db.commit()
    await db.refresh(delivery)
    return _delivery_to_dict(delivery)


# --- Billing document endpoint (Phase-5) -------------------------------------

@router.post(
    "/{order_id}/deliveries/{delivery_id}/bill",
    dependencies=[Depends(require_permission("orders.manage"))],
    status_code=201,
)
async def bill_from_delivery(
    order_id: UUID,
    delivery_id: UUID,
    body: dict | None = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a billing document (invoice) from a goods-issued delivery.

    Optional body: {due_date: "YYYY-MM-DD", notes: str}

    Returns the created Invoice object.
    """
    from app.services.invoice_service import InvoiceService
    from datetime import date as _date

    vendor_id = await _get_vendor_id(current_user, db)
    body = body or {}
    due_date_raw = body.get("due_date")
    due_date = _date.fromisoformat(due_date_raw) if due_date_raw else None

    svc = InvoiceService(db)
    try:
        invoice = await svc.bill_from_delivery(
            vendor_id=vendor_id,
            order_id=order_id,
            delivery_id=delivery_id,
            created_by=current_user.id,
            due_date=due_date,
            notes=body.get("notes"),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return JSONResponse(
        status_code=201,
        content={
            "id": str(invoice.id),
            "invoice_number": invoice.invoice_number,
            "invoice_type": invoice.invoice_type,
            "status": invoice.status,
            "total": float(invoice.total),
            "due_date": invoice.due_date.isoformat() if invoice.due_date else None,
            "delivery_id": str(delivery_id),
            "order_id": str(order_id),
            "created_at": str(invoice.created_at),
        },
    )


# --- Partner function endpoints (Phase-6) ------------------------------------

@router.get("/{order_id}/partners")
async def list_partners(
    order_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """List all partner functions for an order."""
    from app.services.partner_service import list_partners as svc_list, partner_to_dict
    vendor_id = await _get_vendor_id(current_user, db)
    partners = await svc_list(db, vendor_id, order_id)
    return [partner_to_dict(p) for p in partners]


@router.put(
    "/{order_id}/partners/{role}",
    dependencies=[Depends(require_permission("orders.manage"))],
)
async def upsert_partner(
    order_id: UUID,
    role: str,
    body: dict,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Create or replace the partner for a given role.

    Body: {
      customer_id?: UUID,
      contact_name?: str,
      contact_email?: str,
      contact_phone?: str,
      company_name?: str,
      gstin?: str,
      address?: {line1, city, state, postal_code, country},
      notes?: str
    }
    """
    from app.services.partner_service import upsert_partner as svc_upsert, partner_to_dict

    vendor_id = await _get_vendor_id(current_user, db)
    cid_raw = body.get("customer_id")
    partner = await svc_upsert(
        db=db,
        vendor_id=vendor_id,
        order_id=order_id,
        role=role,
        customer_id=UUID(str(cid_raw)) if cid_raw else None,
        contact_name=body.get("contact_name"),
        contact_email=body.get("contact_email"),
        contact_phone=body.get("contact_phone"),
        company_name=body.get("company_name"),
        gstin=body.get("gstin"),
        address=body.get("address"),
        notes=body.get("notes"),
    )
    await db.commit()
    await db.refresh(partner)
    return partner_to_dict(partner)


@router.delete(
    "/{order_id}/partners/{role}",
    dependencies=[Depends(require_permission("orders.manage"))],
    status_code=204,
)
async def delete_partner(
    order_id: UUID,
    role: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a partner function (cannot remove buyer)."""
    from app.services.partner_service import delete_partner as svc_delete

    vendor_id = await _get_vendor_id(current_user, db)
    await svc_delete(db, vendor_id, order_id, role)
    await db.commit()


# --- Pricing condition endpoints (Phase-7) ------------------------------------

@router.get("/{order_id}/pricing-conditions")
async def list_pricing_conditions(
    order_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """List header-level pricing conditions for an order."""
    from app.services.pricing_condition_service import condition_to_dict
    from app.models.order import OrderPricingCondition

    vendor_id = await _get_vendor_id(current_user, db)
    result = await db.execute(
        select(OrderPricingCondition).where(
            OrderPricingCondition.order_id == order_id,
            OrderPricingCondition.vendor_id == vendor_id,
        ).order_by(OrderPricingCondition.step_no)
    )
    conditions = result.scalars().all()
    return [condition_to_dict(c) for c in conditions]


@router.post(
    "/{order_id}/pricing-conditions",
    dependencies=[Depends(require_permission("orders.manage"))],
    status_code=201,
)
async def add_pricing_condition(
    order_id: UUID,
    body: dict,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a header-level pricing condition (discount, freight, surcharge, etc.).

    Body: {
      condition_type: "header_discount" | "freight" | "surcharge" | "special",
      description: str,
      calc_type?: "percent" | "fixed",
      value: float,
      notes?: str,
      step_no?: int
    }
    """
    from app.services.pricing_condition_service import apply_header_condition, condition_to_dict

    vendor_id = await _get_vendor_id(current_user, db)
    cond = await apply_header_condition(
        db=db,
        vendor_id=vendor_id,
        order_id=order_id,
        condition_type=body.get("condition_type", "header_discount"),
        description=body.get("description", ""),
        calc_type=body.get("calc_type", "percent"),
        value=float(body.get("value", 0)),
        notes=body.get("notes"),
        applied_by=current_user.id,
        step_no=body.get("step_no"),
    )
    await db.commit()
    await db.refresh(cond)
    return JSONResponse(status_code=201, content=condition_to_dict(cond))


@router.delete(
    "/{order_id}/pricing-conditions/{condition_id}",
    dependencies=[Depends(require_permission("orders.manage"))],
    status_code=204,
)
async def remove_pricing_condition(
    order_id: UUID,
    condition_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a header pricing condition and recalculate order totals."""
    from app.services.pricing_condition_service import remove_header_condition

    vendor_id = await _get_vendor_id(current_user, db)
    await remove_header_condition(db, vendor_id, order_id, condition_id)
    await db.commit()


@router.post(
    "/{order_id}/reprice",
    dependencies=[Depends(require_permission("orders.manage"))],
)
async def reprice_order(
    order_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Re-run the pricing engine on all order lines and recalculate totals.

    Uses the order pricing_date (falls back to today).
    Returns the updated order dict.
    """
    from app.services.pricing_condition_service import reprice_order as svc_reprice
    from app.repositories.order_repo import OrderRepository

    vendor_id = await _get_vendor_id(current_user, db)
    await svc_reprice(db=db, vendor_id=vendor_id, order_id=order_id)
    await db.commit()

    repo = OrderRepository(db)
    order = await repo.get_by_vendor_and_id(vendor_id, order_id)
    return JSONResponse(content=await _enrich_order_dict(db, order, _order_to_dict(order)))


# --- Credit management endpoints (Phase-8) ------------------------------------

@router.post(
    "/{order_id}/credit-release",
    dependencies=[Depends(require_permission("orders.manage"))],
)
async def release_credit_block(
    order_id: UUID,
    body: dict | None = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Release a credit block on an order.

    Clears Order.credit_status to 'ok' and removes any fulfillment_block
    that was set to 'credit_block'.  Logs the release to status history.

    Optional body: {reason: str}
    """
    from app.models.order import OrderStatusHistory

    vendor_id = await _get_vendor_id(current_user, db)
    result = await db.execute(
        select(Order).where(Order.id == order_id, Order.vendor_id == vendor_id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(404, "Order not found")

    reason = (body or {}).get("reason", "Credit block released by vendor")

    # Clear credit block
    order.credit_status = "ok"
    if (order.fulfillment_block or "").lower() in ("credit_block", "credit block", "credit"):
        order.fulfillment_block = None

    # Audit log
    history = OrderStatusHistory(
        order_id=order.id,
        from_status=order.status,
        to_status=order.status,
        changed_by=current_user.id,
        changed_by_role="vendor",
        notes=f"Credit block released: {reason}",
    )
    db.add(history)

    await db.commit()
    await db.refresh(order)

    repo = __import__("app.repositories.order_repo", fromlist=["OrderRepository"]).OrderRepository
    order_repo = repo(db)
    order = await order_repo.get_by_vendor_and_id(vendor_id, order_id)
    return JSONResponse(content=await _enrich_order_dict(db, order, _order_to_dict(order)))


@router.get("/{order_id}/credit-status")
async def get_credit_status(
    order_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the customer credit position for this order.

    Shows credit limit, current outstanding, available credit, and status.
    """
    from app.services.crm.credit_gate import find_credit_control, evaluate_credit
    from decimal import Decimal

    vendor_id = await _get_vendor_id(current_user, db)
    result = await db.execute(
        select(Order).where(Order.id == order_id, Order.vendor_id == vendor_id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(404, "Order not found")

    credit_row = await find_credit_control(db, vendor_id, customer_id=order.customer_id)
    check = evaluate_credit(credit_row, Decimal(str(order.total or 0)))

    return {
        "order_id": str(order_id),
        "order_credit_status": order.credit_status,
        "payment_method": order.payment_method,
        "order_total": float(order.total or 0),
        "credit_control_id": str(credit_row.id) if credit_row else None,
        "credit_limit": float(check["credit_limit"]) if check["credit_limit"] is not None else None,
        "current_outstanding": float(check["current_outstanding"]) if check["current_outstanding"] is not None else None,
        "available_credit": float(check["available_credit"]) if check["available_credit"] is not None else None,
        "payment_blocked": check["payment_blocked"],
        "allowed": check["allowed"],
        "reason": check["reason"],
        "utilization_pct": (
            round(float(check["current_outstanding"]) / float(check["credit_limit"]) * 100, 1)
            if check.get("credit_limit") and float(check["credit_limit"]) > 0
            else None
        ),
    }
