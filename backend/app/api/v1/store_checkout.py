"""Store checkout preview and payment gateway endpoints."""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_customer, get_store_vendor_id
from app.database import get_db
from app.models.customer import Customer
from app.models.vendor import Vendor
from app.repositories.cart_repo import CartRepository
from app.repositories.vendor_repo import VendorRepository
from app.schemas.checkout import (
    CheckoutPreviewRequest, GuestCheckoutPreviewRequest,
    RazorpayCreateRequest, RazorpayVerifyRequest,
)
from app.services.checkout_service import CheckoutService
from app.services.payment_gateway_service import PaymentGatewayService
from app.services.payment_integration_service import build_checkout_payment_info
from app.config import settings

router = APIRouter()


@router.post("/guest-preview")
async def guest_checkout_preview(
    data: GuestCheckoutPreviewRequest,
    vendor_id: UUID = Depends(get_store_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Compute checkout totals for guest cart items (no auth)."""
    vendor_repo = VendorRepository(db)
    vendor = await vendor_repo.get_by_id(vendor_id)
    if not vendor:
        raise HTTPException(404, "Store not found")

    items = [i.model_dump() for i in data.items]
    preview = await CheckoutService(db).preview(
        vendor=vendor,
        items=items,
        shipping_method_id=data.shipping_method_id,
        coupon_code=data.coupon_code,
        customer_id=None,
        shipping_state=data.shipping_state,
    )
    payment_info = await build_checkout_payment_info(db, vendor)
    preview.update(payment_info)
    return JSONResponse(content=preview)


@router.post("/preview")
async def checkout_preview(
    data: CheckoutPreviewRequest,
    customer: Customer = Depends(get_current_active_customer),
    vendor_id: UUID = Depends(get_store_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Compute shipping, tax, and total from the current cart (server-authoritative)."""
    cart_repo = CartRepository(db)
    cart = await cart_repo.get_by_customer(vendor_id, customer.id)
    if not cart or not cart.items:
        raise HTTPException(400, "Cart is empty")

    vendor_repo = VendorRepository(db)
    vendor = await vendor_repo.get_by_id(vendor_id)
    if not vendor:
        raise HTTPException(404, "Store not found")

    preview = await CheckoutService(db).preview(
        vendor=vendor,
        items=cart.items,
        shipping_method_id=data.shipping_method_id,
        coupon_code=data.coupon_code,
        customer_id=customer.id,
        shipping_state=data.shipping_state,
    )
    payment_info = await build_checkout_payment_info(db, vendor)
    preview.update(payment_info)
    return JSONResponse(content=preview)


@router.post("/payments/razorpay/create")
async def create_razorpay_order(
    data: RazorpayCreateRequest,
    customer: Customer = Depends(get_current_active_customer),
    vendor_id: UUID = Depends(get_store_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Create a Razorpay order for an existing pending store order."""
    from app.repositories.order_repo import OrderRepository

    order_repo = OrderRepository(db)
    try:
        order_id = UUID(data.order_id)
    except ValueError:
        raise HTTPException(400, "Invalid order_id")

    order = await order_repo.get_by_vendor_and_id(vendor_id, order_id)
    if not order or order.customer_id != customer.id:
        raise HTTPException(404, "Order not found")
    if order.payment_status == "paid":
        raise HTTPException(400, "Order is already paid")

    vendor_repo = VendorRepository(db)
    vendor = await vendor_repo.get_by_id(vendor_id)
    if not vendor:
        raise HTTPException(404, "Store not found")

    gw = PaymentGatewayService(db)
    payload = await gw.create_razorpay_order(
        vendor=vendor,
        order=order,
        customer_name=customer.full_name or customer.name or "Customer",
        customer_email=customer.email,
        customer_phone=customer.phone,
    )
    await gw.persist_razorpay_order_id(order, payload["razorpay_order_id"])
    return JSONResponse(content=payload)


@router.post("/payments/razorpay/verify")
async def verify_razorpay_payment(
    data: RazorpayVerifyRequest,
    customer: Customer = Depends(get_current_active_customer),
    vendor_id: UUID = Depends(get_store_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Verify Razorpay payment signature and mark order as paid."""
    try:
        order_id = UUID(data.order_id)
    except ValueError:
        raise HTTPException(400, "Invalid order_id")

    result = await db.execute(select(Vendor).where(Vendor.id == vendor_id))
    vendor = result.scalar_one_or_none()
    if not vendor:
        raise HTTPException(404, "Store not found")

    order = await PaymentGatewayService(db).confirm_razorpay_payment(
        vendor_id=vendor_id,
        customer_id=customer.id,
        order_id=order_id,
        razorpay_order_id=data.razorpay_order_id,
        razorpay_payment_id=data.razorpay_payment_id,
        razorpay_signature=data.razorpay_signature,
        vendor=vendor,
    )
    return JSONResponse(content={
        "ok": True,
        "order_id": str(order.id),
        "order_number": order.order_number,
        "payment_status": order.payment_status,
        "status": order.status,
    })


@router.post("/payments/razorpay/webhook")
async def razorpay_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Razorpay payment webhook — idempotent order confirmation on payment.captured."""
    import json

    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")
    gw = PaymentGatewayService(db)

    try:
        payload = json.loads(body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise HTTPException(400, "Invalid JSON payload")

    vendor = None
    payment_entity = payload.get("payload", {}).get("payment", {}).get("entity", {})
    notes = payment_entity.get("notes") or {}
    vendor_id_raw = notes.get("vendor_id")
    if vendor_id_raw:
        try:
            result = await db.execute(select(Vendor).where(Vendor.id == UUID(str(vendor_id_raw))))
            vendor = result.scalar_one_or_none()
        except (ValueError, TypeError):
            vendor = None

    if not await gw.verify_webhook_signature(body, signature, vendor=vendor):
        raise HTTPException(400, "Invalid webhook signature")

    result = await gw.handle_razorpay_webhook(payload)
    return JSONResponse(content=result)


@router.post("/payments/stripe/webhook")
async def stripe_webhook(request: Request):
    """Stripe webhook endpoint — configure in Stripe Dashboard after connecting integration."""
    body = await request.body()
    _ = body
    return JSONResponse(content={"ok": True, "received": True})


@router.post("/payments/paypal/webhook")
async def paypal_webhook(request: Request):
    """PayPal webhook endpoint — configure in PayPal Developer after connecting integration."""
    body = await request.body()
    _ = body
    return JSONResponse(content={"ok": True, "received": True})


@router.post("/payments/square/webhook")
async def square_webhook(request: Request):
    """Square webhook endpoint — configure in Square Developer after connecting integration."""
    body = await request.body()
    _ = body
    return JSONResponse(content={"ok": True, "received": True})


@router.post("/payments/payu/webhook")
async def payu_webhook(request: Request):
    """PayU webhook endpoint — configure in PayU merchant panel after connecting integration."""
    body = await request.body()
    _ = body
    return JSONResponse(content={"ok": True, "received": True})
