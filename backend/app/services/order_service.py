import logging
from uuid import UUID
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException, status

from app.models.order import Order, OrderStatusHistory
from app.models.payment import Payment
from app.models.vendor_product import Product
from app.schemas.order import (
    CheckoutRequest, GuestCheckoutRequest, OrderStatusUpdate,
    OrderCancelRequest, ReturnExchangeRequest, ReturnResolveRequest,
    PaymentProofSubmit, PaymentProofReview,
)
from app.services.customer_service import CustomerService
from app.repositories.order_repo import OrderRepository
from app.repositories.cart_repo import CartRepository
from app.repositories.customer_repo import CustomerRepository
from app.repositories.payment_repo import PaymentRepository
from app.services.inventory_service import InventoryService
from app.services.notification_service import NotificationService
from app.services.order_notification_service import send_order_placed_notifications
from app.services.invoice_service import InvoiceService
from app.services.checkout_service import CheckoutService, get_manual_upi_config
from app.services.coupon_service import CouponService
from app.services.price_resolver import resolve_items_pricing
from app.repositories.vendor_repo import VendorRepository
from app.models.store import Store
from app.services.store_resolver import resolve_store_id as resolve_txn_store_id

log = logging.getLogger(__name__)

# Valid status transitions: maps current status → allowed next statuses
VALID_TRANSITIONS: dict[str, set[str]] = {
    "pending":            {"confirmed", "processing", "cancelled"},
    "confirmed":          {"processing", "shipped", "cancelled"},
    "processing":         {"shipped", "delivered", "cancelled"},
    "shipped":            {"delivered", "cancelled"},
    "delivered":          {"returned", "exchanged"},
    "quote_requested":    {"confirmed", "cancelled"},
    "return_requested":   {"returned", "delivered"},
    "exchange_requested": {"exchanged", "delivered"},
    "returned":           set(),
    "exchanged":          set(),
    "cancelled":          set(),
    "refunded":           set(),
}


class OrderService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.order_repo = OrderRepository(db)
        self.cart_repo = CartRepository(db)
        self.customer_repo = CustomerRepository(db)
        self.payment_repo = PaymentRepository(db)
        self.inventory_svc = InventoryService(db)
        self.invoice_svc = InvoiceService(db)

    def _record_status(
        self, order_id: UUID, from_status: str | None, to_status: str,
        changed_by: UUID | None = None, changed_by_role: str = "system", notes: str | None = None,
    ):
        entry = OrderStatusHistory(
            order_id=order_id,
            from_status=from_status,
            to_status=to_status,
            changed_by=changed_by,
            changed_by_role=changed_by_role,
            notes=notes,
        )
        self.db.add(entry)

    async def _check_branch_open(self, vendor_id: UUID, branch_code: str | None) -> None:
        """Raise 422 if the specified branch exists but is currently closed."""
        if not branch_code:
            return
        from sqlalchemy import func, or_
        cleaned = branch_code.strip()
        filters = [func.lower(Store.code) == cleaned.lower()]
        try:
            filters.append(Store.id == UUID(cleaned))
        except (ValueError, AttributeError):
            pass
        row = await self.db.execute(
            select(Store.is_open, Store.is_active).where(
                Store.vendor_id == vendor_id,
                or_(*filters),
            )
        )
        result = row.one_or_none()
        if result is None:
            return  # unknown branch — let catalog layer handle it
        is_open, is_active = result
        if not is_active or is_open is False:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="This business unit is currently closed. Orders cannot be placed.",
            )

    async def checkout(
        self,
        vendor_id: UUID,
        customer_id: UUID,
        data: CheckoutRequest,
        *,
        items_override: list[dict] | None = None,
        clear_cart: bool = True,
    ) -> Order:
        await self._check_branch_open(vendor_id, getattr(data, "branch_code", None))

        cart = None
        if items_override is not None:
            items = items_override
            if not items:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cart is empty")
        else:
            cart = await self.cart_repo.get_by_customer(vendor_id, customer_id)
            if not cart or not cart.items:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cart is empty",
                )
            items = cart.items

        # Server-authoritative totals (GST per product, shipping, coupon)
        vendor_repo = VendorRepository(self.db)
        vendor = await vendor_repo.get_by_id(vendor_id)
        if not vendor:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor not found")

        shipping_state = data.shipping_address.state if data.shipping_address else None
        shipping_city = data.shipping_address.city if data.shipping_address else None
        shipping_pincode = data.shipping_address.postal_code if data.shipping_address else None

        # Apply party (retail/wholesale/distributor/agent…), quantity-tier,
        # channel, location, and scheduled price rules before totals are computed
        # so the effective price — not the sticker price — is what gets charged.
        items = await resolve_items_pricing(
            self.db,
            vendor_id,
            items,
            customer_id=customer_id,
            channel="online",
            shipping_state=shipping_state,
            shipping_city=shipping_city,
            shipping_pincode=shipping_pincode,
        )

        preview = await CheckoutService(self.db).preview(
            vendor=vendor,
            items=items,
            shipping_method_id=data.shipping_method_id,
            coupon_code=data.coupon_code,
            customer_id=customer_id,
            shipping_state=shipping_state,
        )
        subtotal = preview["subtotal"]
        tax_amount = preview["tax_amount"]
        discount_amount = preview["discount_amount"]
        shipping_amount = preview["shipping_amount"]
        total = preview["total"]

        online_methods = {
            "card", "upi", "netbanking", "wallet", "razorpay",
            "stripe", "square", "paypal", "payu",
        }
        manual_upi_cfg = get_manual_upi_config(vendor)
        is_manual_upi = (
            data.payment_method.value == "upi"
            and manual_upi_cfg.get("enabled")
        )
        is_manual_proof = is_manual_upi
        is_online = data.payment_method.value in online_methods and not is_manual_proof

        # Generate order number
        order_number = await self.order_repo.get_next_order_number(vendor_id)

        store_id = await resolve_txn_store_id(
            self.db,
            vendor_id,
            store_id=getattr(data, "store_id", None),
            branch=getattr(data, "branch_code", None),
        )

        # Create order
        order = Order(
            order_number=order_number,
            vendor_id=vendor_id,
            customer_id=customer_id,
            store_id=store_id,
            items=items,
            item_count=sum(i.get("qty", 0) for i in items),
            subtotal=subtotal,
            tax_amount=tax_amount,
            discount_amount=discount_amount,
            shipping_amount=shipping_amount,
            total=total,
            status="pending",
            payment_status="pending",
            payment_method=data.payment_method.value,
            shipping_address=data.shipping_address.model_dump(),
            notes=data.notes,
            coupon_code=data.coupon_code,
            source="online",
        )
        self.db.add(order)
        await self.db.flush()

        self._record_status(order.id, None, "pending", changed_by_role="customer", notes="Order placed")

        # Create payment record
        payment = Payment(
            order_id=order.id,
            vendor_id=vendor_id,
            amount=total,
            currency="INR",
            method=data.payment_method.value,
            status="pending",
        )
        self.db.add(payment)

        is_pay_later = data.payment_method.value == "pay_later"

        # COD: confirm immediately; Pay later / online / manual UPI: stay pending until admin or gateway
        if data.payment_method.value == "cod":
            order.payment_status = "pending"
            order.status = "confirmed"
            order.confirmed_at = datetime.now(timezone.utc)
            payment.status = "pending"
            self._record_status(order.id, "pending", "confirmed", changed_by_role="system", notes="Auto-confirmed (COD)")
        elif is_pay_later:
            # Awaiting vendor approval — no QR/payment; confirm only when admin approves
            order.payment_status = "pending"
            order.status = "pending"
            payment.status = "pending"
            self._record_status(
                order.id, "pending", "pending",
                changed_by_role="system",
                notes="Pay later — awaiting vendor approval",
            )
        elif is_online:
            order.payment_status = "pending"
            order.status = "pending"
            payment.status = "pending"
        elif is_manual_proof:
            order.payment_status = "pending"
            order.status = "pending"
            payment.status = "pending"

        # Auto-generate invoice for confirmed (COD) orders
        if order.status == "confirmed":
            try:
                await self.invoice_svc.create_from_order(order, auto_commit=False)
            except Exception as e:
                log.warning("Auto-invoice at checkout failed for order %s: %s", order.id, e)

        # Update customer stats
        customer = await self.customer_repo.get_by_vendor_and_id(vendor_id, customer_id)
        if customer:
            customer.total_orders = (customer.total_orders or 0) + 1
            customer.total_spent = float(customer.total_spent or 0) + total
            ship_phone = (data.shipping_address.phone or "").strip()
            if ship_phone and not (customer.phone or "").strip():
                customer.phone = ship_phone

        # COD: deduct stock + clear cart now.
        # Pay later: clear cart (order is placed) but defer stock until admin confirms.
        # Online / manual UPI: defer stock until payment verify.
        if data.payment_method.value == "cod":
            await self._deduct_inventory_for_order(vendor_id, order)
            if clear_cart and cart is not None:
                await self.cart_repo.clear_cart(cart)
        elif is_pay_later:
            if clear_cart and cart is not None:
                await self.cart_repo.clear_cart(cart)

        # Increment purchase_count for each product in the order
        for item in items:
            pid = item.get("product_id") or item.get("id")
            if pid:
                try:
                    result = await self.db.execute(select(Product).where(Product.id == UUID(str(pid))))
                    prod = result.scalar_one_or_none()
                    if prod:
                        prod.purchase_count = (prod.purchase_count or 0) + 1
                except Exception:
                    pass

        await self.db.commit()
        await self.db.refresh(order)

        if data.coupon_code and discount_amount > 0:
            try:
                coupon_svc = CouponService(self.db)
                result = await coupon_svc.validate_coupon(
                    vendor_id, data.coupon_code, subtotal, customer_id=customer_id,
                )
                if result.get("valid") and result.get("coupon"):
                    await coupon_svc.record_usage(
                        result["coupon"].id, customer_id, order.id, discount_amount,
                    )
            except Exception as e:
                log.warning("Coupon usage record failed for order %s: %s", order.id, e)

        # In-app + email notifications for new order (best-effort)
        try:
            from app.services.vendor_service import VendorService
            vendor_svc = VendorService(self.db)
            vendor = await vendor_svc.get_by_id(vendor_id)
            if vendor:
                notif_svc = NotificationService(self.db)
                # Manual UPI: defer admin "New Order" + customer confirmations until payment proof is submitted.
                # Pay later / COD: notify admin immediately so they can approve (pay later) or fulfill (COD).
                if not is_manual_proof:
                    await notif_svc.notify_order_received(
                        vendor_id=vendor_id,
                        vendor_phone=vendor.primary_phone,
                        vendor_name=vendor.display_name or vendor.business_name,
                        order_number=order.order_number,
                        total=float(order.total or 0),
                        order_id=order.id,
                    )
                # Online card/UPI gateway: defer email/SMS/WhatsApp until payment is confirmed
                # (see PaymentGatewayService._finalize_paid_order).
                # Manual UPI: deferred to submit_payment_proof.
                # Pay later: customer gets placed notice; confirmation is after admin approve.
                if data.payment_method.value in ("cod", "pay_later"):
                    customer = await self.customer_repo.get_by_vendor_and_id(vendor_id, customer_id)
                    await send_order_placed_notifications(
                        self.db,
                        vendor=vendor,
                        order=order,
                        customer=customer,
                    )
                # Persist in-app row: checkout already committed; session closes without a commit otherwise.
                await self.db.commit()
        except Exception as exc:
            log.warning("Order placement notifications failed for order %s: %s", order.id, exc, exc_info=True)

        # Fan-out the `order.placed` webhook — defer for manual UPI until proof is submitted.
        if not is_manual_proof:
            try:
                from app.services.website_webhooks import (
                    dispatch_event_for_vendor,
                    order_payload,
                )
                await dispatch_event_for_vendor(
                    self.db,
                    vendor_id=vendor_id,
                    event="order.placed",
                    payload=order_payload(order),
                )
            except Exception as exc:
                log.warning("order.placed webhook dispatch failed for order %s: %s", order.id, exc)

        return order

    async def guest_checkout(self, vendor_id: UUID, data: GuestCheckoutRequest) -> Order:
        await self._check_branch_open(vendor_id, getattr(data, "branch_code", None))

        customer_svc = CustomerService(self.db)
        customer = await customer_svc.get_or_create_guest(
            vendor_id,
            full_name=data.customer.full_name,
            email=data.customer.email,
            phone=data.customer.phone,
        )
        items = [i.model_dump() for i in data.items]
        checkout_data = CheckoutRequest(
            shipping_address=data.shipping_address,
            payment_method=data.payment_method,
            shipping_method_id=data.shipping_method_id,
            notes=data.notes,
            coupon_code=data.coupon_code,
            branch_code=data.branch_code,
            store_id=getattr(data, "store_id", None),
        )
        return await self.checkout(
            vendor_id,
            customer.id,
            checkout_data,
            items_override=items,
            clear_cart=False,
        )

    async def _deduct_inventory_for_order(self, vendor_id: UUID, order: Order):
        """Deduct stock for each item in the order that has track_inventory enabled."""
        for item in (order.items or []):
            product_id = item.get("product_id")
            variant_id = item.get("variant_id")
            qty = item.get("qty", 0)
            if not product_id or qty <= 0:
                continue
            try:
                product = await self.db.get(Product, UUID(str(product_id)))
                if not product or not product.track_inventory:
                    continue
                vid = UUID(str(variant_id)) if variant_id else None
                await self.inventory_svc.deduct_for_sale(
                    vendor_id=vendor_id,
                    product_id=UUID(str(product_id)),
                    quantity=qty,
                    reference_id=order.id,
                    reference_type="order",
                    variant_id=vid,
                )
            except Exception as e:
                log.warning("Inventory deduction failed for product %s: %s", product_id, e)

    @staticmethod
    def _order_had_inventory_deducted(order: Order, status_at_cancel: str) -> bool:
        """True when stock was already taken for this order (safe to restore on cancel)."""
        method = order.payment_method or ""
        if method == "cod":
            return True
        if method == "pay_later":
            return status_at_cancel != "pending"
        if method == "upi":
            return order.payment_status == "paid"
        # Online gateways deduct on payment finalize when status becomes confirmed
        return status_at_cancel not in ("pending",)

    async def _restore_inventory_for_order(self, vendor_id: UUID, order: Order):
        """Restore stock for each item when an order is cancelled."""
        for item in (order.items or []):
            product_id = item.get("product_id")
            variant_id = item.get("variant_id")
            qty = item.get("qty", 0)
            if not product_id or qty <= 0:
                continue
            try:
                product = await self.db.get(Product, UUID(str(product_id)))
                if not product or not product.track_inventory:
                    continue
                vid = UUID(str(variant_id)) if variant_id else None
                await self.inventory_svc.return_stock(
                    vendor_id=vendor_id,
                    product_id=UUID(str(product_id)),
                    quantity=qty,
                    reference_id=order.id,
                    variant_id=vid,
                )
            except Exception as e:
                log.warning("Inventory restoration failed for product %s: %s", product_id, e)

    async def assign_delivery(
        self,
        vendor_id: UUID,
        order_id: UUID,
        *,
        staff_id: str | None = None,
        staff_name: str | None = None,
    ) -> Order:
        order = await self.order_repo.get_by_vendor_and_id(vendor_id, order_id)
        if not order:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
        if not staff_name and not staff_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="staff_name or staff_id required")
        order.delivery_staff_name = staff_name
        if staff_id:
            try:
                order.delivery_staff_id = UUID(str(staff_id))
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid staff_id")
        order.delivery_assigned_at = datetime.now(timezone.utc)
        order.delivery_status = "assigned"
        await self.db.commit()
        await self.db.refresh(order)
        return order

    async def update_status(
        self, vendor_id: UUID, order_id: UUID, data: OrderStatusUpdate, user_id: UUID | None = None,
    ) -> Order:
        order = await self.order_repo.get_by_vendor_and_id(vendor_id, order_id)
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Order not found",
            )

        previous_status = order.status
        new_status = data.status.value
        allowed = VALID_TRANSITIONS.get(previous_status, set())
        if new_status != previous_status and new_status not in allowed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot transition order from '{previous_status}' to '{new_status}'",
            )
        now = datetime.now(timezone.utc)
        order.status = new_status
        history_notes = data.notes
        if (
            new_status == "confirmed"
            and previous_status == "pending"
            and order.payment_method == "pay_later"
            and not history_notes
        ):
            history_notes = "Pay later order approved by vendor"
        self._record_status(
            order.id, previous_status, new_status,
            changed_by=user_id, changed_by_role="vendor", notes=history_notes,
        )

        if data.status.value == "confirmed":
            order.confirmed_at = now
            # Pay later: stock was deferred at checkout until vendor approval
            if previous_status == "pending" and order.payment_method == "pay_later":
                await self._deduct_inventory_for_order(vendor_id, order)
                try:
                    cart = await self.cart_repo.get_by_customer(vendor_id, order.customer_id)
                    if cart:
                        await self.cart_repo.clear_cart(cart)
                except Exception as exc:
                    log.warning("Cart clear after pay later confirm failed for %s: %s", order_id, exc)
            try:
                await self.invoice_svc.create_from_order(order, auto_commit=False)
            except Exception as e:
                log.warning("Auto-invoice creation failed for order %s: %s", order_id, e)
        elif data.status.value == "shipped":
            order.shipped_at = now
            if data.tracking_number:
                order.tracking_number = data.tracking_number
            if data.tracking_url:
                order.tracking_url = data.tracking_url
        elif data.status.value == "delivered":
            order.delivered_at = now
            order.payment_status = "paid"
            # Mark the invoice as paid when order is delivered
            try:
                invoice = await self.invoice_svc.get_by_order_id(order.id, vendor_id)
                if invoice and invoice.status != "paid":
                    invoice.amount_paid = float(invoice.total or 0)
                    invoice.balance_due = 0
                    invoice.status = "paid"
            except Exception as e:
                log.warning("Invoice payment update failed for order %s: %s", order_id, e)
        elif new_status == "cancelled" and previous_status != "cancelled":
            if self._order_had_inventory_deducted(order, previous_status):
                await self._restore_inventory_for_order(vendor_id, order)
            if data.cancel_reason:
                order.cancel_reason = data.cancel_reason
            if data.cancel_attachments is not None:
                order.cancel_attachments = [a.model_dump() for a in data.cancel_attachments]

        # Only append status-change notes to avoid overwriting order-level notes
        if data.notes:
            order.cancel_reason = order.cancel_reason or data.notes

        await self.db.commit()
        await self.db.refresh(order)

        # Send WhatsApp notification to customer on status change
        try:
            from app.services.vendor_service import VendorService
            vendor_svc = VendorService(self.db)
            vendor = await vendor_svc.get_by_id(vendor_id)
            if vendor and order.customer_id:
                customer = await self.customer_repo.get_by_vendor_and_id(vendor_id, order.customer_id)
                if customer and customer.phone:
                    notif_svc = NotificationService(self.db)
                    await notif_svc.notify_order_status(
                        vendor_id=vendor_id,
                        customer_phone=customer.phone,
                        customer_name=customer.full_name or customer.name,
                        vendor_name=vendor.display_name or vendor.business_name,
                        order_number=order.order_number,
                        status=order.status,
                        order_id=order.id,
                        customer_id=customer.id,
                    )
                    await self.db.commit()
        except Exception:
            pass  # Never let notification failure break order update

        return order

    async def cancel_order(
        self, vendor_id: UUID, customer_id: UUID, order_id: UUID, data: OrderCancelRequest, user_id: UUID | None = None,
    ) -> Order:
        order = await self.order_repo.get_by_vendor_and_id(vendor_id, order_id)
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Order not found",
            )

        if order.customer_id != customer_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not your order",
            )

        if order.status in ("shipped", "delivered"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot cancel a shipped or delivered order",
            )

        prev = order.status
        order.status = "cancelled"
        order.cancel_reason = data.reason
        if data.attachments:
            order.cancel_attachments = [a.model_dump() for a in data.attachments]
        else:
            order.cancel_attachments = []
        self._record_status(order.id, prev, "cancelled", changed_by=user_id, changed_by_role="customer", notes=data.reason)

        # Restore inventory only if it was deducted
        if self._order_had_inventory_deducted(order, prev):
            await self._restore_inventory_for_order(vendor_id, order)

        await self.db.commit()
        await self.db.refresh(order)
        return order

    async def request_return_exchange(
        self, vendor_id: UUID, customer_id: UUID, order_id: UUID, data: ReturnExchangeRequest,
        user_id: UUID | None = None, initiated_by_role: str = "customer",
    ) -> Order:
        order = await self.order_repo.get_by_vendor_and_id(vendor_id, order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        if order.customer_id != customer_id:
            raise HTTPException(status_code=403, detail="Not your order")
        if order.status != "delivered":
            raise HTTPException(status_code=400, detail="Only delivered orders can be returned or exchanged")
        if order.return_status in ("requested", "approved"):
            raise HTTPException(status_code=400, detail="A return/exchange request already exists for this order")

        now = datetime.now(timezone.utc)
        prev = order.status
        order.return_type = data.return_type
        order.return_reason = data.reason
        order.return_status = "requested"
        order.return_requested_at = now
        order.status = "return_requested" if data.return_type == "return" else "exchange_requested"
        if data.attachments:
            order.return_attachments = [a.model_dump() for a in data.attachments]
        else:
            order.return_attachments = []
        self._record_status(order.id, prev, order.status, changed_by=user_id, changed_by_role=initiated_by_role, notes=data.reason)

        await self.db.commit()
        await self.db.refresh(order)
        return order

    async def resolve_return(
        self, vendor_id: UUID, order_id: UUID, data: ReturnResolveRequest, user_id: UUID | None = None,
    ) -> Order:
        order = await self.order_repo.get_by_vendor_and_id(vendor_id, order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        if order.return_status != "requested":
            raise HTTPException(status_code=400, detail="No pending return/exchange request")

        now = datetime.now(timezone.utc)
        prev = order.status
        order.return_resolved_at = now
        order.return_notes = data.notes

        if data.action == "approve":
            order.return_status = "approved"
            if data.return_tracking_number:
                order.return_tracking_number = data.return_tracking_number
            if data.return_tracking_url:
                order.return_tracking_url = data.return_tracking_url
            if order.return_type == "return":
                order.status = "returned"
                refund = data.refund_amount if data.refund_amount is not None else float(order.total or 0)
                order.refund_amount = refund
                order.payment_status = "refunded"
                await self._restore_inventory_for_order(vendor_id, order)
            else:
                order.status = "exchanged"
        else:
            order.return_status = "rejected"
            order.status = "delivered"

        self._record_status(order.id, prev, order.status, changed_by=user_id, changed_by_role="vendor", notes=data.notes)

        await self.db.commit()
        await self.db.refresh(order)
        return order

    async def submit_payment_proof(
        self,
        vendor_id: UUID,
        customer_id: UUID,
        order_id: UUID,
        data: PaymentProofSubmit,
    ) -> Order:
        order = await self.order_repo.get_by_vendor_and_id(vendor_id, order_id)
        if not order or order.customer_id != customer_id:
            raise HTTPException(status_code=404, detail="Order not found")
        if order.payment_method != "upi":
            raise HTTPException(status_code=400, detail="This order does not use manual UPI payment verification")
        if order.payment_status == "paid":
            raise HTTPException(status_code=400, detail="Payment already confirmed")
        if order.payment_status not in ("pending", "pending_verification"):
            raise HTTPException(status_code=400, detail="Payment cannot be submitted for this order")

        now = datetime.now(timezone.utc).isoformat()
        order.payment_reference = data.utr.strip()
        order.payment_proof = {
            "utr": data.utr.strip(),
            "screenshot_url": data.screenshot_url.strip(),
            "status": "submitted",
            "submitted_at": now,
        }
        order.payment_status = "pending_verification"

        result = await self.db.execute(
            select(Payment).where(Payment.order_id == order.id).order_by(Payment.created_at.desc())
        )
        payment = result.scalars().first()
        if payment:
            payment.gateway_response = {
                **(payment.gateway_response or {}),
                "manual_upi_proof": order.payment_proof,
            }

        await self.db.commit()
        await self.db.refresh(order)

        # Clear server cart now that the customer completed payment proof
        try:
            cart = await self.cart_repo.get_by_customer(vendor_id, customer_id)
            if cart:
                await self.cart_repo.clear_cart(cart)
                await self.db.commit()
        except Exception as exc:
            log.warning("Cart clear after payment proof failed for %s: %s", order.id, exc)

        try:
            from app.services.vendor_service import VendorService
            vendor_svc = VendorService(self.db)
            vendor = await vendor_svc.get_by_id(vendor_id)
            if vendor:
                customer = await self.customer_repo.get_by_vendor_and_id(vendor_id, customer_id)
                notif_svc = NotificationService(self.db)
                await notif_svc.notify_order_received(
                    vendor_id=vendor_id,
                    vendor_phone=vendor.primary_phone,
                    vendor_name=vendor.display_name or vendor.business_name,
                    order_number=order.order_number,
                    total=float(order.total or 0),
                    order_id=order.id,
                )
                await send_order_placed_notifications(
                    self.db, vendor=vendor, order=order, customer=customer,
                )
                await self.db.commit()
        except Exception as exc:
            log.warning("Notifications after payment proof failed for %s: %s", order.id, exc)

        try:
            from app.services.website_webhooks import (
                dispatch_event_for_vendor,
                order_payload,
            )
            await dispatch_event_for_vendor(
                self.db,
                vendor_id=vendor_id,
                event="order.placed",
                payload=order_payload(order),
            )
        except Exception as exc:
            log.warning("order.placed webhook after payment proof failed for %s: %s", order.id, exc)

        return order

    async def approve_manual_payment(
        self,
        vendor_id: UUID,
        order_id: UUID,
        data: PaymentProofReview | None = None,
        user_id: UUID | None = None,
    ) -> Order:
        order = await self.order_repo.get_by_vendor_and_id(vendor_id, order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        if order.payment_method != "upi":
            raise HTTPException(status_code=400, detail="Not a manual UPI payment order")
        if order.payment_status == "paid":
            return order
        if order.payment_status != "pending_verification" or not order.payment_proof:
            raise HTTPException(status_code=400, detail="No payment proof awaiting approval")

        proof = dict(order.payment_proof or {})
        proof["status"] = "approved"
        proof["reviewed_at"] = datetime.now(timezone.utc).isoformat()
        if data and data.notes:
            proof["review_notes"] = data.notes
        order.payment_proof = proof
        order.payment_status = "paid"
        order.status = "confirmed"
        now = datetime.now(timezone.utc)
        order.confirmed_at = now
        self._record_status(
            order.id, "pending", "confirmed",
            changed_by=user_id, changed_by_role="vendor",
            notes=data.notes if data else "Manual UPI payment approved",
        )

        result = await self.db.execute(
            select(Payment).where(Payment.order_id == order.id).order_by(Payment.created_at.desc())
        )
        payment = result.scalars().first()
        if payment:
            payment.status = "completed"
            if order.payment_reference:
                payment.gateway_reference = order.payment_reference
            payment.gateway_response = {
                **(payment.gateway_response or {}),
                "manual_upi_proof": proof,
            }

        await self._deduct_inventory_for_order(vendor_id, order)

        try:
            cart = await self.cart_repo.get_by_customer(vendor_id, order.customer_id)
            if cart:
                await self.cart_repo.clear_cart(cart)
        except Exception as exc:
            log.warning("Cart clear after manual UPI approval failed for %s: %s", order.id, exc)

        try:
            await self.invoice_svc.create_from_order(order, auto_commit=False)
        except Exception as e:
            log.warning("Auto-invoice after manual UPI approval failed for %s: %s", order.id, e)

        await self.db.commit()
        await self.db.refresh(order)

        # Order-placed email/SMS/WhatsApp already sent when the customer submitted proof.
        return order

    async def reject_manual_payment(
        self,
        vendor_id: UUID,
        order_id: UUID,
        data: PaymentProofReview | None = None,
        user_id: UUID | None = None,
    ) -> Order:
        order = await self.order_repo.get_by_vendor_and_id(vendor_id, order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        if order.payment_method != "upi":
            raise HTTPException(status_code=400, detail="Not a manual UPI payment order")
        if order.payment_status == "paid":
            raise HTTPException(status_code=400, detail="Payment already confirmed")

        proof = dict(order.payment_proof or {})
        proof["status"] = "rejected"
        proof["reviewed_at"] = datetime.now(timezone.utc).isoformat()
        if data and data.notes:
            proof["review_notes"] = data.notes
        order.payment_proof = proof
        order.payment_status = "failed"

        result = await self.db.execute(
            select(Payment).where(Payment.order_id == order.id).order_by(Payment.created_at.desc())
        )
        payment = result.scalars().first()
        if payment:
            payment.status = "failed"
            payment.gateway_response = {
                **(payment.gateway_response or {}),
                "manual_upi_proof": proof,
            }

        self._record_status(
            order.id, order.status, order.status,
            changed_by=user_id, changed_by_role="vendor",
            notes=data.notes if data else "Manual UPI payment rejected",
        )

        await self.db.commit()
        await self.db.refresh(order)
        return order
