import logging
from typing import List, Optional, Tuple
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func as sqlfunc, and_, or_
from uuid import UUID
from datetime import date, datetime, time as dt_time

from app.models.pos import POSSession, POSTransaction
from app.models.restaurant import RestaurantTable
from app.models.vendor_user import VendorUser
from app.models.customer import Customer
from app.models.vendor_product import Product
from app.models.order import Order
from app.models.booking import Booking
from app.models.invoice import Invoice
from app.services.inventory_service import InventoryService
from app.services.invoice_service import InvoiceService
from app.services.coupon_service import CouponService
from app.services.loyalty_service import LoyaltyService
from app.services.price_resolver import resolve_items_pricing

log = logging.getLogger(__name__)


class POSService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _generate_txn_number(self, vendor_id: UUID) -> str:
        result = await self.db.execute(
            select(sqlfunc.max(POSTransaction.transaction_number))
            .where(POSTransaction.vendor_id == vendor_id)
        )
        last = result.scalar_one_or_none()
        if last:
            try:
                num = int(last.split("-")[-1]) + 1
            except (ValueError, IndexError):
                num = 1
        else:
            num = 1
        return f"POS-{num:06d}"

    async def _next_pos_order_number(self, vendor_id: UUID) -> str:
        """POS-PRD-XXXX for product orders created via POS."""
        result = await self.db.execute(
            select(sqlfunc.max(Order.order_number))
            .where(and_(
                Order.vendor_id == vendor_id,
                Order.order_number.like("POS-PRD-%"),
            ))
        )
        last = result.scalar_one_or_none()
        if last:
            try:
                num = int(last.split("-")[-1]) + 1
            except (ValueError, IndexError):
                num = 1
        else:
            num = 1
        return f"POS-PRD-{num:04d}"

    async def _next_pos_booking_number(self, vendor_id: UUID) -> str:
        """POS-BK-XXXX for bookings created via POS."""
        result = await self.db.execute(
            select(sqlfunc.max(Booking.booking_number))
            .where(and_(
                Booking.vendor_id == vendor_id,
                Booking.booking_number.like("POS-BK-%"),
            ))
        )
        last = result.scalar_one_or_none()
        if last:
            try:
                num = int(last.split("-")[-1]) + 1
            except (ValueError, IndexError):
                num = 1
        else:
            num = 1
        return f"POS-BK-{num:04d}"

    # ── Session management ────────────────────────────────────────

    async def open_session(
        self, vendor_id: UUID, user_id: UUID, store_id: UUID,
        opening_cash: float = 0, notes: str = None,
    ) -> POSSession:
        existing = await self.db.execute(
            select(POSSession).where(
                and_(
                    POSSession.vendor_id == vendor_id,
                    POSSession.store_id == store_id,
                    POSSession.status == "open",
                )
            )
        )
        if existing.scalar_one_or_none():
            raise ValueError("There is already an open POS session for this business unit. Close it first.")

        session = POSSession(
            vendor_id=vendor_id,
            store_id=store_id,
            opened_by=user_id,
            session_date=date.today(),
            opening_cash=opening_cash,
            notes=notes,
        )
        self.db.add(session)
        await self.db.commit()
        await self.db.refresh(session)
        return session

    async def close_session(self, session_id: UUID, vendor_id: UUID, user_id: UUID, closing_cash: float, notes: str = None) -> POSSession:
        result = await self.db.execute(
            select(POSSession).where(
                and_(POSSession.id == session_id, POSSession.vendor_id == vendor_id, POSSession.status == "open")
            )
        )
        session = result.scalar_one_or_none()
        if not session:
            raise ValueError("No open session found")

        session.closed_by = user_id
        session.closing_cash = closing_cash
        session.status = "closed"
        session.closed_at = datetime.utcnow()
        if notes:
            session.notes = (session.notes or "") + f"\nClosing: {notes}"

        await self.db.commit()
        await self.db.refresh(session)
        return session

    async def get_open_session(self, vendor_id: UUID, store_id: UUID) -> POSSession | None:
        result = await self.db.execute(
            select(POSSession).where(
                and_(
                    POSSession.vendor_id == vendor_id,
                    POSSession.store_id == store_id,
                    POSSession.status == "open",
                )
            )
        )
        return result.scalar_one_or_none()

    # ── Transaction creation ──────────────────────────────────────

    async def create_transaction(
        self,
        vendor_id: UUID,
        session_id: Optional[UUID],
        cashier_id: UUID,
        store_id: UUID,
        items: list,
        payment_methods: list,
        customer_id: UUID = None,
        transaction_type: str = "sale",
        discount_type: str = None,
        discount_value: float = 0,
        cash_received: float = 0,
        notes: str = None,
        return_of: UUID = None,
        coupon_code: str = None,
        loyalty_points_redeem: int = 0,
        restaurant_table_id: Optional[UUID] = None,
        sales_person_vendor_user_id: Optional[UUID] = None,
        tip_amount: float = 0,
        service_charge_amount: float = 0,
    ) -> dict:
        """Create a POS transaction and return a rich dict with linked records.

        Credit/debit memos may omit session_id (no open till required). Register
        sales/returns still require an open POS session.
        """
        sp_vu_id: Optional[UUID] = None
        if sales_person_vendor_user_id:
            sp_row = await self.db.get(VendorUser, sales_person_vendor_user_id)
            if (
                not sp_row
                or sp_row.vendor_id != vendor_id
                or not sp_row.is_active
            ):
                raise ValueError("Salesperson must be an active member of your team")
            sp_vu_id = sales_person_vendor_user_id

        rt_id: Optional[UUID] = restaurant_table_id
        if rt_id:
            tbl = await self.db.get(RestaurantTable, rt_id)
            if not tbl or tbl.vendor_id != vendor_id:
                raise ValueError("Invalid restaurant table")

        is_memo = transaction_type in ("credit_memo", "debit_memo")
        session = None
        resolved_session_id: Optional[UUID] = None

        if is_memo and not session_id:
            # Finance memos are independent of the till — no open session needed.
            resolved_session_id = None
        else:
            if not session_id:
                raise ValueError("No open POS session found for this business unit")
            session_result = await self.db.execute(
                select(POSSession).where(
                    and_(
                        POSSession.id == session_id,
                        POSSession.vendor_id == vendor_id,
                        POSSession.store_id == store_id,
                        POSSession.status == "open",
                    )
                )
            )
            session = session_result.scalar_one_or_none()
            if not session:
                raise ValueError("No open POS session found for this business unit")
            resolved_session_id = session_id

        # ── Apply party (retail/wholesale/distributor/agent…), quantity-tier,
        # and channel price rules for new sales, so the price charged reflects
        # who's buying and how much — not just the sticker price. Returns and
        # credit memos keep the originally sold price.
        if transaction_type in ("sale", "debit_memo"):
            items = await resolve_items_pricing(
                self.db,
                vendor_id,
                items,
                customer_id=customer_id,
                channel="pos",
            )

        # ── Compute line items ──
        subtotal = 0
        total_tax = 0
        computed_items = []

        for item in items:
            item_subtotal = item["qty"] * item["price"]
            item_discount = item.get("discount", 0)
            taxable = item_subtotal - item_discount
            tax_rate = item.get("tax_rate", 0)
            item_tax = round(taxable * tax_rate / 100, 2)
            item_total = round(taxable + item_tax, 2)

            computed_items.append({
                **item,
                "subtotal": float(item_subtotal),
                "taxable": float(taxable),
                "tax_amount": float(item_tax),
                "total": float(item_total),
            })
            subtotal += item_subtotal
            total_tax += item_tax

        cart_discount = 0
        if discount_value > 0:
            if discount_type == "percentage":
                cart_discount = round(subtotal * discount_value / 100, 2)
            else:
                cart_discount = discount_value

        # ── Coupon discount ──
        coupon_discount = 0.0
        validated_coupon = None
        if coupon_code and transaction_type in ("sale", "debit_memo"):
            coupon_svc = CouponService(self.db)
            validation = await coupon_svc.validate_coupon(vendor_id, coupon_code, subtotal - cart_discount, customer_id)
            if validation["valid"]:
                coupon_discount = validation["discount_amount"]
                validated_coupon = validation.get("coupon")

        # ── Loyalty points discount ──
        loyalty_discount = 0.0
        loyalty_points_used = 0
        if loyalty_points_redeem > 0 and customer_id and transaction_type in ("sale", "debit_memo"):
            try:
                loyalty_svc = LoyaltyService(self.db)
                _, lp_discount = await loyalty_svc.redeem_points(
                    vendor_id, customer_id, loyalty_points_redeem, auto_commit=False,
                )
                loyalty_discount = lp_discount
                loyalty_points_used = loyalty_points_redeem
            except ValueError as e:
                log.warning("Loyalty redeem failed: %s", e)

        total_discount = cart_discount + coupon_discount + loyalty_discount
        tip = round(float(tip_amount or 0), 2)
        svc_charge = round(float(service_charge_amount or 0), 2)
        total = round(subtotal - total_discount + total_tax + tip + svc_charge, 2)
        change_due = max(0, cash_received - total)

        txn_number = await self._generate_txn_number(vendor_id)

        status_map = {
            "sale": "completed",
            "return": "returned",
            "exchange": "exchanged",
            "credit_memo": "completed",
            "debit_memo": "completed",
        }

        # store_id is the cashier's locked business unit (resolved at the API layer).
        from app.services.store_resolver import resolve_txn_sales_area_id
        sales_area_id = await resolve_txn_sales_area_id(
            self.db, vendor_id, store_id=store_id, customer_id=customer_id,
        )

        txn = POSTransaction(
            vendor_id=vendor_id,
            session_id=resolved_session_id,
            store_id=store_id,
            cashier_id=cashier_id,
            customer_id=customer_id,
            sales_area_id=sales_area_id,
            sales_person_vendor_user_id=sp_vu_id,
            transaction_number=txn_number,
            transaction_type=transaction_type,
            items=computed_items,
            item_count=sum(i["qty"] for i in items),
            subtotal=subtotal,
            discount_amount=total_discount,
            discount_type=discount_type,
            discount_value=discount_value,
            tax_amount=total_tax,
            total=total,
            payment_methods=[{"method": p["method"], "amount": float(p["amount"])} for p in payment_methods],
            cash_received=cash_received,
            change_due=change_due,
            coupon_code=coupon_code.upper() if coupon_code else None,
            coupon_discount=coupon_discount,
            loyalty_points_redeemed=loyalty_points_used,
            loyalty_discount=loyalty_discount,
            notes=notes,
            return_of=return_of,
            status=status_map.get(transaction_type, "completed"),
            tip_amount=tip,
            service_charge_amount=svc_charge,
            restaurant_table_id=rt_id,
            kitchen_ticket_status="new" if rt_id and transaction_type in ("sale", "debit_memo") else None,
        )
        self.db.add(txn)

        # ── Session totals (skip when memo has no till session) ──
        if session is not None:
            if transaction_type in ("sale", "debit_memo"):
                session.total_sales = float(session.total_sales or 0) + total
                session.total_discount = float(session.total_discount or 0) + total_discount
            elif transaction_type in ("return", "credit_memo", "exchange"):
                session.total_returns = float(session.total_returns or 0) + total

            session.total_tax = float(session.total_tax or 0) + total_tax
            session.transaction_count = (session.transaction_count or 0) + 1

            for pm in payment_methods:
                method = pm["method"]
                amt = float(pm["amount"])
                if method == "cash":
                    session.cash_total = float(session.cash_total or 0) + amt
                elif method == "upi":
                    session.upi_total = float(session.upi_total or 0) + amt
                elif method == "card":
                    session.card_total = float(session.card_total or 0) + amt

        await self.db.flush()

        # ── Inventory ──
        inv_svc = InventoryService(self.db)
        if transaction_type in ("sale", "debit_memo"):
            for item in items:
                pid = item.get("product_id")
                if not pid or item.get("item_type") == "service":
                    continue
                product = None
                try:
                    async with self.db.begin_nested():
                        product = await self.db.get(Product, UUID(item["product_id"]))
                        if not product:
                            raise ValueError("product not found")
                        product.purchase_count = (product.purchase_count or 0) + 1
                        if not product.track_inventory:
                            raise ValueError("no tracking")
                        await inv_svc.deduct_for_sale_at_store(
                            vendor_id=vendor_id,
                            store_id=store_id,
                            product_id=UUID(item["product_id"]),
                            quantity=item["qty"],
                            variant_id=UUID(item["variant_id"]) if item.get("variant_id") else None,
                            reference_id=txn.id,
                            reference_type="pos_transaction",
                            customer_id=customer_id,
                        )
                except Exception as e:
                    # Batch/serial-managed products must not sell without traceable lots.
                    if product and (
                        getattr(product, "batch_managed", False)
                        or getattr(product, "serial_managed", False)
                    ):
                        raise ValueError(
                            f"Cannot sell {product.name}: {e}"
                        ) from e
                    log.warning("POS inventory deduction failed for %s: %s", item.get("product_id"), e)
        elif transaction_type in ("return", "credit_memo"):
            for item in items:
                pid = item.get("product_id")
                if not pid or item.get("item_type") == "service":
                    continue
                try:
                    async with self.db.begin_nested():
                        product = await self.db.get(Product, UUID(item["product_id"]))
                        if not product or not product.track_inventory:
                            raise ValueError("product not found or no tracking")
                        await inv_svc.return_stock_at_store(
                            vendor_id=vendor_id,
                            store_id=store_id,
                            product_id=UUID(item["product_id"]),
                            quantity=item["qty"],
                            variant_id=UUID(item["variant_id"]) if item.get("variant_id") else None,
                            reference_id=txn.id,
                            original_source_id=return_of,
                            original_source_type="pos_transaction",
                        )
                except Exception as e:
                    log.warning("POS inventory return failed for %s: %s", item.get("product_id"), e)

        # ── Create Order only when a customer is linked (customer_id is NOT NULL in orders) ──
        pos_order_id = None
        order_number = None
        if transaction_type in ("sale", "debit_memo") and customer_id is not None:
            try:
                async with self.db.begin_nested():
                    order_number = await self._next_pos_order_number(vendor_id)
                    primary_method = payment_methods[0]["method"] if payment_methods else "cash"
                    order = Order(
                        order_number=order_number,
                        vendor_id=vendor_id,
                        customer_id=customer_id,
                        store_id=store_id,
                        items=computed_items,
                        item_count=sum(i["qty"] for i in items),
                        subtotal=subtotal,
                        tax_amount=total_tax,
                        discount_amount=cart_discount,
                        total=total,
                        status="delivered",
                        payment_status="paid",
                        payment_method=primary_method,
                        source="pos",
                        pos_transaction_id=txn.id,
                        notes=notes,
                    )
                    self.db.add(order)
                    await self.db.flush()
                    pos_order_id = order.id
            except Exception as e:
                log.warning("Failed to create Order from POS transaction: %s", e)
                order_number = None
        elif transaction_type in ("sale", "debit_memo") and customer_id is None:
            log.info("POS walk-in sale %s — skipping Order record (no customer linked)", txn_number)

        # ── Create Bookings for service items ──
        booking_numbers = []
        if transaction_type == "sale":
            for ci in computed_items:
                if ci.get("item_type") != "service":
                    continue
                try:
                    async with self.db.begin_nested():
                        bk_number = await self._next_pos_booking_number(vendor_id)

                        customer_name = None
                        customer_email = None
                        customer_phone = None
                        if customer_id:
                            cust_r = await self.db.get(Customer, customer_id)
                            if cust_r:
                                customer_name = cust_r.full_name
                                customer_email = cust_r.email
                                customer_phone = cust_r.phone

                        booking = Booking(
                            vendor_id=vendor_id,
                            customer_id=customer_id,
                            service_id=UUID(ci["product_id"]),
                            booking_number=bk_number,
                            service_name=ci.get("name", "Service"),
                            service_price=Decimal(str(ci.get("price", 0))),
                            booking_date=ci.get("booking_date") or date.today(),
                            start_time=dt_time.fromisoformat(ci["booking_time"]) if ci.get("booking_time") else None,
                            end_time=None,
                            duration_minutes=ci.get("duration_minutes"),
                            status="confirmed",
                            customer_name=customer_name,
                            customer_email=customer_email,
                            customer_phone=customer_phone,
                            notes=ci.get("booking_notes") or notes,
                            subtotal=Decimal(str(ci.get("subtotal", 0))),
                            tax_amount=Decimal(str(ci.get("tax_amount", 0))),
                            discount_amount=Decimal(str(ci.get("discount", 0))),
                            total=Decimal(str(ci.get("total", 0))),
                            payment_status="paid",
                            payment_method=payment_methods[0]["method"] if payment_methods else "cash",
                            order_id=pos_order_id,
                        )
                        self.db.add(booking)
                        await self.db.flush()
                        booking_numbers.append(bk_number)
                        ci["booking_id"] = str(booking.id)
                        ci["booking_number"] = bk_number
                except Exception as e:
                    log.warning("Failed to create booking for POS service item: %s", e)

        # ── Always create Invoice ──
        invoice_id = None
        invoice_number = None
        if transaction_type in ("sale", "debit_memo"):
            try:
                async with self.db.begin_nested():
                    inv_svc_obj = InvoiceService(self.db)
                    inv = await inv_svc_obj.create_from_pos_transaction(
                        txn=txn,
                        order_id=pos_order_id,
                        auto_commit=False,
                    )
                    if inv:
                        invoice_id = inv.id
                        invoice_number = inv.invoice_number
                        txn.invoice_id = inv.id
            except Exception as e:
                log.warning("Failed to create invoice from POS transaction: %s", e)

        # ── Record coupon usage ──
        if validated_coupon and coupon_discount > 0:
            try:
                async with self.db.begin_nested():
                    coupon_svc = CouponService(self.db)
                    await coupon_svc.record_usage(
                        validated_coupon.id,
                        customer_id or vendor_id,
                        pos_order_id or txn.id,
                        coupon_discount,
                    )
            except Exception as e:
                log.warning("Failed to record coupon usage: %s", e)

        # ── Earn loyalty points ──
        loyalty_earned = 0
        if transaction_type in ("sale", "debit_memo") and customer_id:
            try:
                async with self.db.begin_nested():
                    loyalty_svc = LoyaltyService(self.db)
                    earn_txn = await loyalty_svc.earn_points(
                        vendor_id, customer_id, float(total),
                        reference_type="pos_transaction", reference_id=txn.id,
                        auto_commit=False,
                    )
                    if earn_txn:
                        loyalty_earned = earn_txn.points
                        txn.loyalty_points_earned = loyalty_earned
            except Exception as e:
                log.warning("Failed to earn loyalty points: %s", e)

        await self.db.commit()
        await self.db.refresh(txn)

        # ── Return rich response ──
        return {
            "txn": txn,
            "order_number": order_number,
            "order_id": str(pos_order_id) if pos_order_id else None,
            "invoice_id": str(invoice_id) if invoice_id else None,
            "invoice_number": invoice_number,
            "booking_numbers": booking_numbers,
            "coupon_discount": coupon_discount,
            "loyalty_points_earned": loyalty_earned,
            "loyalty_points_redeemed": loyalty_points_used,
            "loyalty_discount": loyalty_discount,
        }

    # ── Queries ───────────────────────────────────────────────────

    async def get_transaction(self, vendor_id: UUID, txn_id: UUID) -> POSTransaction | None:
        result = await self.db.execute(
            select(POSTransaction).where(
                and_(POSTransaction.id == txn_id, POSTransaction.vendor_id == vendor_id)
            )
        )
        return result.scalar_one_or_none()

    async def find_transaction_by_number(self, vendor_id: UUID, txn_number: str) -> POSTransaction | None:
        result = await self.db.execute(
            select(POSTransaction).where(
                and_(
                    POSTransaction.vendor_id == vendor_id,
                    POSTransaction.transaction_number == txn_number,
                )
            )
        )
        return result.scalar_one_or_none()

    async def find_by_order_number(self, vendor_id: UUID, order_number: str) -> POSTransaction | None:
        """Look up a POS txn by the linked Order.order_number (ORD-XXXXX)."""
        result = await self.db.execute(
            select(POSTransaction)
            .join(Order, Order.pos_transaction_id == POSTransaction.id)
            .where(and_(
                POSTransaction.vendor_id == vendor_id,
                Order.order_number == order_number,
            ))
        )
        return result.scalar_one_or_none()

    async def list_vendor_transactions(
        self,
        vendor_id: UUID,
        skip: int = 0,
        limit: int = 20,
        search: Optional[str] = None,
        transaction_type: Optional[str] = None,
        include_voided: bool = False,
        store_id: Optional[UUID] = None,
    ) -> Tuple[List[Tuple[POSTransaction, Optional[str], Optional[str], Optional[str]]], int]:
        """
        Return (POSTransaction, customer_name, order_number, invoice_number) tuples.
        """
        join_cond = POSTransaction.customer_id == Customer.id
        order_join = Order.pos_transaction_id == POSTransaction.id
        inv_join = Invoice.id == POSTransaction.invoice_id

        conditions = [POSTransaction.vendor_id == vendor_id]
        if store_id:
            conditions.append(POSTransaction.store_id == store_id)
        if not include_voided:
            conditions.append(or_(POSTransaction.status.is_(None), POSTransaction.status != "voided"))
        if transaction_type:
            tt = transaction_type.strip()
            if "," in tt:
                types = [x.strip() for x in tt.split(",") if x.strip()]
                if types:
                    conditions.append(POSTransaction.transaction_type.in_(types))
            else:
                conditions.append(POSTransaction.transaction_type == tt)
        if search and search.strip():
            term = f"%{search.strip()}%"
            conditions.append(
                or_(
                    POSTransaction.transaction_number.ilike(term),
                    Customer.full_name.ilike(term),
                    Order.order_number.ilike(term),
                )
            )
        where_clause = and_(*conditions)

        count_q = (
            select(sqlfunc.count(POSTransaction.id))
            .select_from(POSTransaction)
            .outerjoin(Customer, join_cond)
            .outerjoin(Order, order_join)
            .where(where_clause)
        )
        total = (await self.db.execute(count_q)).scalar_one()

        q = (
            select(
                POSTransaction,
                Customer.full_name,
                Order.order_number,
                Invoice.invoice_number,
            )
            .outerjoin(Customer, join_cond)
            .outerjoin(Order, order_join)
            .outerjoin(Invoice, inv_join)
            .where(where_clause)
            .order_by(POSTransaction.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(q)
        rows = [(r[0], r[1], r[2], r[3]) for r in result.all()]
        return rows, total

    async def get_session_transactions(self, session_id: UUID, vendor_id: UUID, page: int = 1, size: int = 50):
        count_q = select(sqlfunc.count(POSTransaction.id)).where(
            and_(POSTransaction.session_id == session_id, POSTransaction.vendor_id == vendor_id)
        )
        total = (await self.db.execute(count_q)).scalar_one()

        q = (
            select(POSTransaction)
            .where(and_(POSTransaction.session_id == session_id, POSTransaction.vendor_id == vendor_id))
            .order_by(POSTransaction.created_at.desc())
            .offset((page - 1) * size)
            .limit(size)
        )
        result = await self.db.execute(q)
        items = result.scalars().all()
        return items, total

    async def get_sessions(self, vendor_id: UUID, status: str = None, page: int = 1, size: int = 20, store_id: UUID = None):
        conditions = [POSSession.vendor_id == vendor_id]
        if store_id:
            conditions.append(POSSession.store_id == store_id)
        if status:
            conditions.append(POSSession.status == status)

        count_q = select(sqlfunc.count(POSSession.id)).where(and_(*conditions))
        total = (await self.db.execute(count_q)).scalar_one()

        q = (
            select(POSSession)
            .where(and_(*conditions))
            .order_by(POSSession.opened_at.desc())
            .offset((page - 1) * size)
            .limit(size)
        )
        result = await self.db.execute(q)
        items = result.scalars().all()
        return items, total

    async def get_z_report(self, session_id: UUID, vendor_id: UUID) -> dict:
        result = await self.db.execute(
            select(POSSession).where(
                and_(POSSession.id == session_id, POSSession.vendor_id == vendor_id)
            )
        )
        session = result.scalar_one_or_none()
        if not session:
            raise ValueError("Session not found")

        txns, _ = await self.get_session_transactions(session_id, vendor_id, page=1, size=500)
        return {"session": session, "transactions": txns}

    def _reverse_memo_session_totals(self, session, txn: POSTransaction) -> None:
        """Remove a memo's contribution from session aggregates (void or before replace)."""
        t = float(txn.total or 0)
        td = float(txn.discount_amount or 0)
        ttax = float(txn.tax_amount or 0)
        ttype = txn.transaction_type or "sale"
        if ttype in ("sale", "debit_memo"):
            session.total_sales = max(0.0, float(session.total_sales or 0) - t)
            session.total_discount = max(0.0, float(session.total_discount or 0) - td)
        elif ttype in ("return", "credit_memo", "exchange"):
            session.total_returns = max(0.0, float(session.total_returns or 0) - t)
        session.total_tax = max(0.0, float(session.total_tax or 0) - ttax)
        session.transaction_count = max(0, (session.transaction_count or 1) - 1)
        for pm in txn.payment_methods or []:
            ad = pm if isinstance(pm, dict) else (pm or {})
            method = ad.get("method")
            amt = float(ad.get("amount", 0) or 0)
            if method == "cash":
                session.cash_total = max(0.0, float(session.cash_total or 0) - amt)
            elif method == "upi":
                session.upi_total = max(0.0, float(session.upi_total or 0) - amt)
            elif method == "card":
                session.card_total = max(0.0, float(session.card_total or 0) - amt)
            elif method == "adjustment":
                pass

    def _apply_memo_session_totals(
        self, session, transaction_type: str, total: float, total_discount: float, total_tax: float, payment_methods: list
    ) -> None:
        if transaction_type in ("sale", "debit_memo"):
            session.total_sales = float(session.total_sales or 0) + float(total)
            session.total_discount = float(session.total_discount or 0) + float(total_discount)
        elif transaction_type in ("return", "credit_memo", "exchange"):
            session.total_returns = float(session.total_returns or 0) + float(total)
        session.total_tax = float(session.total_tax or 0) + float(total_tax)
        session.transaction_count = (session.transaction_count or 0) + 1
        for pm in payment_methods or []:
            p = pm if isinstance(pm, dict) else {"method": getattr(pm, "method", None), "amount": getattr(pm, "amount", 0)}
            method = p.get("method")
            amt = float(p.get("amount") or 0)
            if method == "cash":
                session.cash_total = float(session.cash_total or 0) + amt
            elif method == "upi":
                session.upi_total = float(session.upi_total or 0) + amt
            elif method == "card":
                session.card_total = float(session.card_total or 0) + amt

    async def _undo_memo_inventory(self, vendor_id: UUID, txn: POSTransaction) -> None:
        inv_svc = InventoryService(self.db)
        ttype = txn.transaction_type
        store_id = txn.store_id
        if not store_id:
            return
        for item in txn.items or []:
            pid = item.get("product_id")
            if not pid or item.get("item_type") == "service":
                continue
            vid = UUID(str(item["variant_id"])) if item.get("variant_id") else None
            try:
                async with self.db.begin_nested():
                    if ttype == "credit_memo":
                        await inv_svc.deduct_for_sale_at_store(
                            vendor_id=vendor_id,
                            store_id=store_id,
                            product_id=UUID(str(pid)),
                            quantity=int(item.get("qty") or 0),
                            variant_id=vid,
                            reference_id=txn.id,
                            reference_type="pos_transaction",
                        )
                    elif ttype == "debit_memo":
                        await inv_svc.return_stock_at_store(
                            vendor_id=vendor_id,
                            store_id=store_id,
                            product_id=UUID(str(pid)),
                            quantity=int(item.get("qty") or 0),
                            variant_id=vid,
                            reference_id=txn.id,
                            original_source_id=getattr(txn, "return_of", None),
                            original_source_type="pos_transaction",
                        )
            except Exception as e:
                log.warning("void/update memo: inventory undo for %s: %s", pid, e)

    async def _apply_memo_inventory(self, vendor_id: UUID, txn: POSTransaction, ttype: str, raw_items: list) -> None:
        inv_svc = InventoryService(self.db)
        store_id = txn.store_id
        if not store_id:
            return
        if ttype in ("sale", "debit_memo"):
            for item in raw_items:
                if not item.get("product_id") or item.get("item_type") == "service":
                    continue
                product = None
                try:
                    async with self.db.begin_nested():
                        product = await self.db.get(Product, UUID(str(item["product_id"])))
                        if not product or not product.track_inventory:
                            raise ValueError("skip")
                        await inv_svc.deduct_for_sale_at_store(
                            vendor_id=vendor_id,
                            store_id=store_id,
                            product_id=UUID(str(item["product_id"])),
                            quantity=item.get("qty") or 0,
                            variant_id=UUID(str(item["variant_id"])) if item.get("variant_id") else None,
                            reference_id=txn.id,
                            reference_type="pos_transaction",
                        )
                except Exception as e:
                    if product and getattr(product, "batch_managed", False):
                        raise ValueError(f"Cannot sell {product.name}: {e}") from e
                    log.warning("memo inv deduct %s: %s", item.get("product_id"), e)
        elif ttype in ("return", "credit_memo"):
            for item in raw_items:
                if not item.get("product_id") or item.get("item_type") == "service":
                    continue
                try:
                    async with self.db.begin_nested():
                        product = await self.db.get(Product, UUID(str(item["product_id"])))
                        if not product or not product.track_inventory:
                            raise ValueError("skip")
                        await inv_svc.return_stock_at_store(
                            vendor_id=vendor_id,
                            store_id=store_id,
                            product_id=UUID(str(item["product_id"])),
                            quantity=item.get("qty") or 0,
                            variant_id=UUID(str(item["variant_id"])) if item.get("variant_id") else None,
                            reference_id=txn.id,
                            original_source_id=getattr(txn, "return_of", None),
                            original_source_type="pos_transaction",
                        )
                except Exception as e:
                    log.warning("memo inv return %s: %s", item.get("product_id"), e)

    @staticmethod
    def _recompute_memo_from_items(
        items: list, discount_type: str | None, discount_value: float, cash_received: float
    ) -> tuple:
        subtotal = 0.0
        total_tax = 0.0
        computed_items: list = []
        for item in items:
            item = dict(item) if not isinstance(item, dict) else item
            item_subtotal = (item.get("qty") or 0) * float(item.get("price") or 0)
            item_discount = float(item.get("discount") or 0)
            taxable = item_subtotal - item_discount
            tax_rate = float(item.get("tax_rate") or 0)
            item_tax = round(taxable * tax_rate / 100, 2)
            item_total = round(taxable + item_tax, 2)
            computed_items.append({
                **item,
                "subtotal": float(item_subtotal),
                "taxable": float(taxable),
                "tax_amount": float(item_tax),
                "total": float(item_total),
            })
            subtotal += item_subtotal
            total_tax += item_tax
        cart_discount = 0.0
        if discount_value > 0:
            if discount_type == "percentage":
                cart_discount = round(subtotal * float(discount_value) / 100, 2)
            else:
                cart_discount = float(discount_value)
        total_discount = cart_discount
        total = round(subtotal - total_discount + total_tax, 2)
        change_due = max(0, float(cash_received) - total)
        return subtotal, total_tax, total_discount, total, change_due, computed_items

    async def void_memo_transaction(
        self, vendor_id: UUID, txn_id: UUID, user_id: UUID, reason: str | None = None,
    ) -> POSTransaction:
        txn = await self.get_transaction(vendor_id, txn_id)
        if not txn:
            raise ValueError("Transaction not found")
        if txn.transaction_type not in ("credit_memo", "debit_memo"):
            raise ValueError("Only credit or debit memos can be voided")
        if (txn.status or "") == "voided":
            raise ValueError("This memo is already voided")
        session = None
        if txn.session_id:
            res_s = await self.db.execute(
                select(POSSession).where(and_(POSSession.id == txn.session_id, POSSession.vendor_id == vendor_id))
            )
            session = res_s.scalar_one_or_none()
            if not session:
                raise ValueError("Session not found for this transaction")
            self._reverse_memo_session_totals(session, txn)

        await self._undo_memo_inventory(vendor_id, txn)

        stamp = f"\n[VOIDED] {datetime.utcnow().isoformat()}"
        if reason:
            stamp += f" — {reason}"
        txn.notes = (txn.notes or "") + stamp
        txn.status = "voided"

        await self.db.commit()
        await self.db.refresh(txn)
        return txn

    async def update_memo_transaction(
        self,
        vendor_id: UUID,
        txn_id: UUID,
        cashier_id: UUID,
        customer_id: UUID | None,
        items: list,
        payment_methods: list,
        discount_type: str | None,
        discount_value: float,
        cash_received: float,
        notes: str | None,
    ) -> POSTransaction:
        """Replace memo lines, totals, and notes; re-apply session and inventory for the same linked Order/invoice? (invoice not updated in v1)."""
        if not items:
            raise ValueError("At least one line item is required")
        txn = await self.get_transaction(vendor_id, txn_id)
        if not txn:
            raise ValueError("Transaction not found")
        if txn.transaction_type not in ("credit_memo", "debit_memo"):
            raise ValueError("Only memos can be updated here")
        if (txn.status or "") == "voided":
            raise ValueError("Voided memos cannot be edited")

        session = None
        if txn.session_id:
            res_s = await self.db.execute(
                select(POSSession).where(and_(POSSession.id == txn.session_id, POSSession.vendor_id == vendor_id))
            )
            session = res_s.scalar_one_or_none()
            if not session:
                raise ValueError("Session not found for this transaction")

        def _as_dict(x):
            if hasattr(x, "model_dump"):
                return x.model_dump()
            if isinstance(x, dict):
                return x
            return dict(x)

        raw_items = [_as_dict(it) for it in items]

        if session is not None:
            self._reverse_memo_session_totals(session, txn)
        await self._undo_memo_inventory(vendor_id, txn)

        subtotal, total_tax, total_discount, total, change_due, computed_items = self._recompute_memo_from_items(
            raw_items, discount_type, discount_value, cash_received
        )
        ttype = txn.transaction_type
        pms = [{"method": p["method"], "amount": float(p["amount"])} for p in payment_methods]
        if session is not None:
            self._apply_memo_session_totals(session, ttype, total, total_discount, total_tax, pms)

        txn.customer_id = customer_id
        txn.cashier_id = cashier_id
        txn.items = computed_items
        txn.item_count = sum(int(x.get("qty") or 0) for x in raw_items)
        txn.subtotal = subtotal
        txn.discount_amount = total_discount
        txn.discount_type = discount_type
        txn.discount_value = discount_value
        txn.tax_amount = total_tax
        txn.total = total
        txn.payment_methods = pms
        txn.cash_received = cash_received
        txn.change_due = change_due
        if notes is not None:
            txn.notes = notes

        await self._apply_memo_inventory(vendor_id, txn, ttype, raw_items)

        await self.db.commit()
        await self.db.refresh(txn)
        return txn
