"""Razorpay payment gateway integration."""
from __future__ import annotations

import hashlib
import hmac
import logging
from decimal import Decimal
from typing import Any
from uuid import UUID

import httpx
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy import select

from app.config import settings
from app.models.order import Order
from app.models.payment import Payment
from app.models.vendor import Vendor
from app.repositories.order_repo import OrderRepository
from app.repositories.vendor_repo import VendorRepository
from app.services.checkout_service import get_razorpay_key_id

log = logging.getLogger(__name__)

RAZORPAY_API = "https://api.razorpay.com/v1"


class PaymentGatewayService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.order_repo = OrderRepository(db)

    def _credentials(self, vendor) -> tuple[str, str]:
        key_id = get_razorpay_key_id(vendor, settings.RAZORPAY_KEY_ID)
        key_secret = settings.RAZORPAY_KEY_SECRET
        if not key_id or not key_secret:
            if settings.DEBUG:
                return "rzp_test_dev", "dev_secret"
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Online payments are not configured. Use Cash on Delivery or contact the store.",
            )
        return key_id, key_secret

    async def create_razorpay_order(
        self,
        vendor,
        order: Order,
        customer_name: str,
        customer_email: str | None,
        customer_phone: str | None,
    ) -> dict[str, Any]:
        key_id, key_secret = self._credentials(vendor)
        amount_paise = int(Decimal(str(order.total or 0)) * 100)
        if amount_paise < 100:
            raise HTTPException(400, "Order total must be at least ₹1 for online payment")

        # Dev mock when keys are placeholder
        if key_id == "rzp_test_dev":
            return {
                "key_id": key_id,
                "razorpay_order_id": f"order_dev_{order.id}",
                "amount": amount_paise,
                "currency": "INR",
                "order_id": str(order.id),
                "dev_mode": True,
                "prefill": {
                    "name": customer_name,
                    "email": customer_email or "",
                    "contact": customer_phone or "",
                },
            }

        payload = {
            "amount": amount_paise,
            "currency": "INR",
            "receipt": order.order_number,
            "notes": {"order_id": str(order.id), "vendor_id": str(vendor.id)},
        }
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{RAZORPAY_API}/orders",
                json=payload,
                auth=(key_id, key_secret),
            )
        if resp.status_code >= 400:
            log.error("Razorpay order create failed: %s", resp.text)
            raise HTTPException(502, "Could not initiate payment. Please try again.")

        data = resp.json()
        return {
            "key_id": key_id,
            "razorpay_order_id": data["id"],
            "amount": amount_paise,
            "currency": data.get("currency", "INR"),
            "order_id": str(order.id),
            "dev_mode": False,
            "prefill": {
                "name": customer_name,
                "email": customer_email or "",
                "contact": customer_phone or "",
            },
        }

    def verify_razorpay_signature(
        self,
        razorpay_order_id: str,
        razorpay_payment_id: str,
        razorpay_signature: str,
        vendor,
    ) -> bool:
        _, key_secret = self._credentials(vendor)
        if key_secret == "dev_secret":
            return razorpay_signature == "dev_sig"
        body = f"{razorpay_order_id}|{razorpay_payment_id}"
        expected = hmac.new(
            key_secret.encode(),
            body.encode(),
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(expected, razorpay_signature)

    def verify_webhook_signature(self, body: bytes, signature: str) -> bool:
        secret = (settings.RAZORPAY_WEBHOOK_SECRET or "").strip()
        if not secret:
            if settings.DEBUG:
                return True
            return False
        expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, signature or "")

    async def persist_razorpay_order_id(self, order: Order, razorpay_order_id: str) -> None:
        result = await self.db.execute(
            select(Payment).where(Payment.order_id == order.id).order_by(Payment.created_at.desc())
        )
        payment = result.scalars().first()
        if payment:
            payment.gateway_response = {
                **(payment.gateway_response or {}),
                "razorpay_order_id": razorpay_order_id,
            }
            await self.db.commit()

    async def _find_order_for_razorpay(
        self,
        razorpay_order_id: str,
        notes: dict | None = None,
    ) -> tuple[Order | None, Vendor | None]:
        notes = notes or {}
        order_id_raw = notes.get("order_id")
        vendor_id_raw = notes.get("vendor_id")

        if order_id_raw and vendor_id_raw:
            try:
                order = await self.order_repo.get_by_vendor_and_id(UUID(str(vendor_id_raw)), UUID(str(order_id_raw)))
                if order:
                    vendor = await VendorRepository(self.db).get_by_id(UUID(str(vendor_id_raw)))
                    return order, vendor
            except (ValueError, TypeError):
                pass

        result = await self.db.execute(
            select(Payment).where(
                Payment.gateway_response["razorpay_order_id"].astext == razorpay_order_id
            )
        )
        payment = result.scalars().first()
        if not payment:
            return None, None
        order = await self.order_repo.get_by_vendor_and_id(payment.vendor_id, payment.order_id)
        vendor = await VendorRepository(self.db).get_by_id(payment.vendor_id) if order else None
        return order, vendor

    async def _finalize_paid_order(
        self,
        order: Order,
        vendor_id: UUID,
        customer_id: UUID,
        razorpay_order_id: str,
        razorpay_payment_id: str,
    ) -> Order:
        if order.payment_status == "paid":
            if order.payment_reference == razorpay_payment_id:
                return order
            return order

        order.payment_status = "paid"
        order.payment_reference = razorpay_payment_id
        order.status = "confirmed"
        from datetime import datetime, timezone
        order.confirmed_at = datetime.now(timezone.utc)

        result = await self.db.execute(
            select(Payment).where(Payment.order_id == order.id).order_by(Payment.created_at.desc())
        )
        payment = result.scalars().first()
        if payment:
            payment.status = "completed"
            payment.gateway_reference = razorpay_payment_id
            payment.gateway_response = {
                **(payment.gateway_response or {}),
                "razorpay_order_id": razorpay_order_id,
                "razorpay_payment_id": razorpay_payment_id,
            }

        await self.db.commit()
        await self.db.refresh(order)

        try:
            from app.services.inventory_service import InventoryService
            from app.models.vendor_product import Product

            inv_svc = InventoryService(self.db)
            for item in (order.items or []):
                product_id = item.get("product_id")
                variant_id = item.get("variant_id")
                qty = item.get("qty", 0)
                if not product_id or qty <= 0:
                    continue
                result = await self.db.execute(
                    select(Product).where(Product.id == UUID(str(product_id)))
                )
                product = result.scalar_one_or_none()
                if product and product.track_inventory:
                    vid = UUID(str(variant_id)) if variant_id else None
                    await inv_svc.deduct_for_sale(
                        vendor_id=vendor_id,
                        product_id=UUID(str(product_id)),
                        quantity=qty,
                        reference_id=order.id,
                        reference_type="order",
                        variant_id=vid,
                    )

            from app.repositories.cart_repo import CartRepository
            cart_repo = CartRepository(self.db)
            cart = await cart_repo.get_by_customer(vendor_id, customer_id)
            if cart:
                await cart_repo.clear_cart(cart)
                await self.db.commit()
        except Exception as exc:
            log.warning("Post-payment inventory/cart cleanup failed for %s: %s", order.id, exc)

        try:
            from app.services.invoice_service import InvoiceService
            await InvoiceService(self.db).create_from_order(order, auto_commit=True)
        except Exception as exc:
            log.warning("Invoice after Razorpay payment failed for %s: %s", order.id, exc)

        return order

    async def confirm_razorpay_payment(
        self,
        vendor_id: UUID,
        customer_id: UUID,
        order_id: UUID,
        razorpay_order_id: str,
        razorpay_payment_id: str,
        razorpay_signature: str,
        vendor,
    ) -> Order:
        order = await self.order_repo.get_by_vendor_and_id(vendor_id, order_id)
        if not order or order.customer_id != customer_id:
            raise HTTPException(404, "Order not found")
        if order.payment_status == "paid":
            return order

        if not self.verify_razorpay_signature(
            razorpay_order_id, razorpay_payment_id, razorpay_signature, vendor,
        ):
            raise HTTPException(400, "Payment verification failed")

        return await self._finalize_paid_order(
            order, vendor_id, customer_id, razorpay_order_id, razorpay_payment_id,
        )

    async def handle_razorpay_webhook(self, payload: dict[str, Any]) -> dict[str, Any]:
        event = payload.get("event", "")
        if event not in ("payment.captured", "payment.authorized"):
            return {"ok": True, "ignored": event or "unknown"}

        payment_entity = (
            payload.get("payload", {}).get("payment", {}).get("entity", {})
        )
        razorpay_payment_id = payment_entity.get("id")
        razorpay_order_id = payment_entity.get("order_id")
        notes = payment_entity.get("notes") or {}

        if not razorpay_payment_id or not razorpay_order_id:
            log.warning("Razorpay webhook missing payment/order id: %s", event)
            return {"ok": False, "error": "missing_ids"}

        order, vendor = await self._find_order_for_razorpay(razorpay_order_id, notes)
        if not order or not vendor:
            log.warning("No order for Razorpay order %s", razorpay_order_id)
            return {"ok": False, "error": "order_not_found"}

        if order.payment_status == "paid":
            return {"ok": True, "order_id": str(order.id), "already_paid": True}

        await self._finalize_paid_order(
            order,
            order.vendor_id,
            order.customer_id,
            razorpay_order_id,
            razorpay_payment_id,
        )
        return {"ok": True, "order_id": str(order.id)}
