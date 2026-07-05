import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func as sqlfunc, and_, or_
from uuid import UUID
from datetime import date, datetime
import math

from app.models.invoice import Invoice
from app.models.vendor import Vendor
from app.models.order import Order
from app.models.customer import Customer
from app.models.pos import POSTransaction
from app.models.booking import Booking
from app.services.store_resolver import resolve_store_id as resolve_txn_store_id, get_default_store_id

log = logging.getLogger(__name__)


def _parse_optional_date(val) -> date | None:
    """Coerce API date strings (YYYY-MM-DD) for asyncpg DATE columns."""
    if val is None or val == '':
        return None
    if isinstance(val, datetime):
        return val.date()
    if isinstance(val, date):
        return val
    if isinstance(val, str):
        return date.fromisoformat(val[:10])
    return None

# Finance GL posting (non-blocking — failures logged but don't break invoice flow)
async def _try_post_invoice(db, vendor_id, invoice):
    try:
        from app.services.finance.posting import post_event
        await post_event(db, vendor_id, "invoice", invoice.id, {
            "total": float(invoice.total or 0),
            "cgst": float(getattr(invoice, "cgst_amount", None) or 0),
            "sgst": float(getattr(invoice, "sgst_amount", None) or 0),
            "igst": float(getattr(invoice, "igst_amount", None) or 0),
            "customer_id": invoice.customer_id,
            "entry_date": invoice.created_at.date() if invoice.created_at else None,
            "narration": f"Invoice {invoice.invoice_number}",
        })
    except Exception:
        log.exception("Finance GL: failed to post invoice %s", invoice.id)

async def _try_post_payment(db, vendor_id, invoice, amount):
    try:
        from app.services.finance.posting import post_event
        await post_event(db, vendor_id, "payment", invoice.id, {
            "amount": amount,
            "customer_id": invoice.customer_id,
            "entry_date": date.today(),
            "narration": f"Payment for Invoice {invoice.invoice_number}",
        })
    except Exception:
        log.exception("Finance GL: failed to post payment for invoice %s", invoice.id)


class InvoiceService:
    def __init__(self, db: AsyncSession):
        self.db = db

    def _get_financial_year(self) -> str:
        today = date.today()
        if today.month >= 4:
            return f"{today.year}-{str(today.year + 1)[-2:]}"
        return f"{today.year - 1}-{str(today.year)[-2:]}"

    async def _next_sequence(self, vendor_id: UUID, invoice_type: str) -> int:
        fy = self._get_financial_year()
        result = await self.db.execute(
            select(sqlfunc.max(Invoice.sequence_number)).where(
                and_(
                    Invoice.vendor_id == vendor_id,
                    Invoice.financial_year == fy,
                    Invoice.invoice_type == invoice_type,
                )
            )
        )
        current_max = result.scalar_one() or 0
        return current_max + 1

    def _generate_number(self, prefix: str, fy: str, seq: int) -> str:
        fy_short = fy.replace("-", "")
        return f"{prefix}/{fy_short}/{seq:04d}"

    def _compute_tax(
        self,
        items: list,
        is_inter_state: bool,
        vendor_gst_registered: bool,
        invoice_type: str = "invoice",
    ):
        computed = []
        total_cgst = total_sgst = total_igst = total_taxable = 0

        for item in items:
            qty = item.get("qty", 0)
            rate = item.get("rate", 0)
            discount = item.get("discount", 0)
            user_tax_rate = float(item.get("tax_rate", 0) or 0)
            apply_tax = user_tax_rate

            line_total = qty * rate
            taxable = line_total - discount

            if is_inter_state:
                igst_rate = apply_tax
                igst_amt = round(taxable * igst_rate / 100, 2)
                cgst_rate = cgst_amt = sgst_rate = sgst_amt = 0
                total_igst += igst_amt
            else:
                half = apply_tax / 2
                cgst_rate = half
                sgst_rate = half
                cgst_amt = round(taxable * cgst_rate / 100, 2)
                sgst_amt = round(taxable * sgst_rate / 100, 2)
                igst_rate = igst_amt = 0
                total_cgst += cgst_amt
                total_sgst += sgst_amt

            total_taxable += taxable
            line_tax = cgst_amt + sgst_amt + igst_amt

            computed.append({
                "name": item.get("name", ""),
                "description": item.get("description"),
                "hsn_sac": item.get("hsn_sac"),
                "qty": qty,
                "rate": rate,
                "discount": discount,
                "taxable_value": float(taxable),
                "cgst_rate": cgst_rate,
                "cgst_amt": float(cgst_amt),
                "sgst_rate": sgst_rate,
                "sgst_amt": float(sgst_amt),
                "igst_rate": igst_rate,
                "igst_amt": float(igst_amt),
                "tax_rate": user_tax_rate,
                "total": float(taxable + line_tax),
            })

        return computed, float(total_taxable), float(total_cgst), float(total_sgst), float(total_igst)

    async def create_invoice(
        self,
        vendor_id: UUID,
        data: dict,
        created_by: UUID,
    ) -> Invoice:
        vendor_result = await self.db.execute(select(Vendor).where(Vendor.id == vendor_id))
        vendor = vendor_result.scalar_one_or_none()
        if not vendor:
            raise ValueError("Vendor not found")

        invoice_type = data.get("invoice_type", "invoice")
        prefix_map = {"estimate": "EST", "invoice": "INV", "receipt": "RCT", "credit_note": "CN"}
        prefix = prefix_map.get(invoice_type, "INV")

        fy = self._get_financial_year()
        seq = await self._next_sequence(vendor_id, invoice_type)
        invoice_number = self._generate_number(prefix, fy, seq)

        is_inter_state = data.get("is_inter_state", False)
        vendor_gst = bool(vendor.gstin)

        raw_items = data.get("items", [])
        computed_items, taxable, cgst, sgst, igst = self._compute_tax(
            raw_items, is_inter_state, vendor_gst, invoice_type
        )

        subtotal = sum(i["qty"] * i["rate"] for i in raw_items)
        discount_amount = data.get("discount_amount", 0)
        total_tax = cgst + sgst + igst
        grand_total = taxable - discount_amount + total_tax
        round_off = round(grand_total) - grand_total
        grand_total = round(grand_total)

        doc_type = "tax_invoice" if vendor_gst else "bill_of_supply"

        order_uuid = UUID(data["order_id"]) if data.get("order_id") else None
        store_id = data.get("store_id")
        if not store_id and order_uuid:
            linked = await self.db.get(Order, order_uuid)
            store_id = linked.store_id if linked else None
        store_id = await resolve_txn_store_id(self.db, vendor_id, store_id=store_id)

        invoice = Invoice(
            vendor_id=vendor_id,
            customer_id=UUID(data["customer_id"]) if data.get("customer_id") else None,
            order_id=order_uuid,
            store_id=store_id,
            invoice_number=invoice_number,
            invoice_type=invoice_type,
            document_type=doc_type,
            customer_name=data.get("customer_name"),
            customer_email=data.get("customer_email"),
            customer_phone=data.get("customer_phone"),
            customer_gstin=data.get("customer_gstin"),
            billing_address=data.get("billing_address"),
            shipping_address=data.get("shipping_address"),
            vendor_name=vendor.business_name,
            vendor_gstin=vendor.gstin,
            vendor_pan=vendor.pan_number,
            vendor_address={
                "street": vendor.street_address,
                "city": vendor.city,
                "state": vendor.state,
                "postal_code": vendor.postal_code,
            },
            items=computed_items,
            item_count=len(computed_items),
            subtotal=subtotal,
            discount_amount=discount_amount,
            taxable_amount=taxable,
            cgst_amount=cgst,
            sgst_amount=sgst,
            igst_amount=igst,
            total_tax=total_tax,
            round_off=round_off,
            total=grand_total,
            amount_paid=0,
            balance_due=grand_total,
            financial_year=fy,
            sequence_number=seq,
            is_gst=vendor_gst,
            place_of_supply=data.get("place_of_supply"),
            is_inter_state=is_inter_state,
            due_date=_parse_optional_date(data.get("due_date")),
            payment_terms=data.get("payment_terms"),
            notes=data.get("notes"),
            terms_and_conditions=data.get("terms_and_conditions"),
            extra_fields=data.get("extra_fields") or [],
            created_by=created_by,
        )
        self.db.add(invoice)
        await self.db.commit()
        await self.db.refresh(invoice)
        return invoice

    async def update_invoice(self, invoice_id: UUID, vendor_id: UUID, data: dict) -> Invoice:
        result = await self.db.execute(
            select(Invoice).where(and_(Invoice.id == invoice_id, Invoice.vendor_id == vendor_id))
        )
        invoice = result.scalar_one_or_none()
        if not invoice:
            raise ValueError("Invoice not found")

        if invoice.status in ("paid", "cancelled"):
            raise ValueError(f"Cannot edit invoice in '{invoice.status}' status")

        if "due_date" in data:
            data = {**data, "due_date": _parse_optional_date(data.get("due_date"))}

        for key, value in data.items():
            if value is not None and hasattr(invoice, key) and key not in ("id", "vendor_id", "invoice_number"):
                setattr(invoice, key, value)

        if data.get("items"):
            vendor_result = await self.db.execute(select(Vendor).where(Vendor.id == vendor_id))
            vendor = vendor_result.scalar_one_or_none()
            computed, taxable, cgst, sgst, igst = self._compute_tax(
                data["items"],
                invoice.is_inter_state,
                bool(vendor and vendor.gstin),
                invoice.invoice_type,
            )
            invoice.items = computed
            invoice.item_count = len(computed)
            invoice.taxable_amount = taxable
            invoice.cgst_amount = cgst
            invoice.sgst_amount = sgst
            invoice.igst_amount = igst
            invoice.total_tax = cgst + sgst + igst
            invoice.subtotal = sum(i["qty"] * i["rate"] for i in data["items"])
            grand = taxable - float(invoice.discount_amount or 0) + invoice.total_tax
            invoice.round_off = round(grand) - grand
            invoice.total = round(grand)
            invoice.balance_due = invoice.total - float(invoice.amount_paid or 0)

        await self.db.commit()
        await self.db.refresh(invoice)
        return invoice

    async def record_payment(self, invoice_id: UUID, vendor_id: UUID, amount: float) -> Invoice:
        result = await self.db.execute(
            select(Invoice).where(and_(Invoice.id == invoice_id, Invoice.vendor_id == vendor_id))
        )
        invoice = result.scalar_one_or_none()
        if not invoice:
            raise ValueError("Invoice not found")

        invoice.amount_paid = float(invoice.amount_paid or 0) + amount
        invoice.balance_due = float(invoice.total or 0) - invoice.amount_paid

        if invoice.balance_due <= 0:
            invoice.status = "paid"
            invoice.balance_due = 0
        else:
            invoice.status = "partially_paid"

        await self.db.commit()
        await self.db.refresh(invoice)
        await _try_post_payment(self.db, vendor_id, invoice, amount)
        return invoice

    async def convert_estimate_to_invoice(self, estimate_id: UUID, vendor_id: UUID, created_by: UUID) -> Invoice:
        result = await self.db.execute(
            select(Invoice).where(
                and_(Invoice.id == estimate_id, Invoice.vendor_id == vendor_id, Invoice.invoice_type == "estimate")
            )
        )
        estimate = result.scalar_one_or_none()
        if not estimate:
            raise ValueError("Estimate not found")

        data = {
            "invoice_type": "invoice",
            "customer_id": str(estimate.customer_id) if estimate.customer_id else None,
            "customer_name": estimate.customer_name,
            "customer_email": estimate.customer_email,
            "customer_phone": estimate.customer_phone,
            "customer_gstin": estimate.customer_gstin,
            "billing_address": estimate.billing_address,
            "shipping_address": estimate.shipping_address,
            "items": estimate.items,
            "discount_amount": float(estimate.discount_amount or 0),
            "place_of_supply": estimate.place_of_supply,
            "is_inter_state": estimate.is_inter_state,
            "notes": estimate.notes,
            "terms_and_conditions": estimate.terms_and_conditions,
        }
        invoice = await self.create_invoice(vendor_id, data, created_by)
        invoice.converted_from_id = estimate.id

        estimate.status = "cancelled"
        await self.db.commit()
        await self.db.refresh(invoice)
        return invoice

    async def list_invoices(
        self,
        vendor_id: UUID,
        invoice_type: str = None,
        exclude_invoice_type: str = None,
        status: str = None,
        page: int = 1,
        size: int = 20,
        store_id: str | UUID = None,
        search: str = None,
        sales_area_id: str | UUID = None,
    ):
        conditions = [Invoice.vendor_id == vendor_id]
        if invoice_type:
            conditions.append(Invoice.invoice_type == invoice_type)
        elif exclude_invoice_type:
            conditions.append(Invoice.invoice_type != exclude_invoice_type)
        if status:
            conditions.append(Invoice.status == status)
        if store_id:
            conditions.append(Invoice.store_id == (store_id if isinstance(store_id, UUID) else UUID(str(store_id))))
        if sales_area_id:
            conditions.append(Invoice.sales_area_id == (sales_area_id if isinstance(sales_area_id, UUID) else UUID(str(sales_area_id))))
        if search and search.strip():
            term = f"%{search.strip()}%"
            conditions.append(
                or_(
                    Invoice.customer_name.ilike(term),
                    Invoice.invoice_number.ilike(term),
                    Invoice.customer_email.ilike(term),
                    Invoice.customer_phone.ilike(term),
                    Invoice.order_number.ilike(term),
                    Invoice.booking_number.ilike(term),
                )
            )

        count_q = select(sqlfunc.count(Invoice.id)).where(and_(*conditions))
        total = (await self.db.execute(count_q)).scalar_one()

        q = (
            select(Invoice)
            .where(and_(*conditions))
            .order_by(Invoice.created_at.desc())
            .offset((page - 1) * size)
            .limit(size)
        )
        result = await self.db.execute(q)
        items = result.scalars().all()
        return items, total

    async def get_invoice(self, invoice_id: UUID, vendor_id: UUID) -> Invoice | None:
        result = await self.db.execute(
            select(Invoice).where(and_(Invoice.id == invoice_id, Invoice.vendor_id == vendor_id))
        )
        return result.scalar_one_or_none()

    async def get_by_order_id(self, order_id: UUID, vendor_id: UUID) -> Invoice | None:
        result = await self.db.execute(
            select(Invoice).where(
                and_(Invoice.order_id == order_id, Invoice.vendor_id == vendor_id, Invoice.invoice_type == "invoice")
            )
        )
        return result.scalar_one_or_none()

    async def create_from_order(self, order: Order, auto_commit: bool = True) -> Invoice | None:
        """Auto-generate an invoice when an order is confirmed."""
        existing = await self.get_by_order_id(order.id, order.vendor_id)
        if existing:
            return existing

        vendor_result = await self.db.execute(select(Vendor).where(Vendor.id == order.vendor_id))
        vendor = vendor_result.scalar_one_or_none()
        if not vendor:
            log.warning("Cannot create invoice: vendor %s not found", order.vendor_id)
            return None

        customer = None
        if order.customer_id:
            customer_result = await self.db.execute(select(Customer).where(Customer.id == order.customer_id))
            customer = customer_result.scalar_one_or_none()

        vendor_gst = bool(vendor.gstin)
        is_inter_state = False

        invoice_items = []
        for item in (order.items or []):
            qty = item.get("qty", 0)
            rate = item.get("price", 0)
            tax_rate = 18 if vendor_gst else 0
            taxable = qty * rate
            half = tax_rate / 2
            cgst_amt = round(taxable * half / 100, 2) if not is_inter_state else 0
            sgst_amt = round(taxable * half / 100, 2) if not is_inter_state else 0
            igst_amt = round(taxable * tax_rate / 100, 2) if is_inter_state else 0

            invoice_items.append({
                "name": item.get("name", ""),
                "description": None,
                "hsn_sac": None,
                "qty": qty,
                "rate": rate,
                "discount": 0,
                "taxable_value": float(taxable),
                "cgst_rate": half if not is_inter_state else 0,
                "cgst_amt": float(cgst_amt),
                "sgst_rate": half if not is_inter_state else 0,
                "sgst_amt": float(sgst_amt),
                "igst_rate": tax_rate if is_inter_state else 0,
                "igst_amt": float(igst_amt),
                "tax_rate": tax_rate,
                "total": float(taxable + cgst_amt + sgst_amt + igst_amt),
            })

        fy = self._get_financial_year()
        seq = await self._next_sequence(order.vendor_id, "invoice")
        invoice_number = self._generate_number("INV", fy, seq)

        subtotal = float(order.subtotal or 0)
        discount = float(order.discount_amount or 0)
        taxable_total = subtotal - discount
        total_cgst = sum(i["cgst_amt"] for i in invoice_items)
        total_sgst = sum(i["sgst_amt"] for i in invoice_items)
        total_igst = sum(i["igst_amt"] for i in invoice_items)
        total_tax = total_cgst + total_sgst + total_igst
        grand = taxable_total + total_tax
        round_off = round(grand) - grand
        grand = round(grand)

        paid = grand if order.payment_status == "paid" else 0

        store_id = order.store_id or await get_default_store_id(self.db, order.vendor_id)

        invoice = Invoice(
            vendor_id=order.vendor_id,
            customer_id=order.customer_id,
            order_id=order.id,
            store_id=store_id,
            order_number=getattr(order, "order_number", None),
            invoice_number=invoice_number,
            invoice_type="invoice",
            document_type="tax_invoice" if vendor_gst else "bill_of_supply",
            customer_name=customer.full_name if customer else None,
            customer_email=customer.email if customer else None,
            customer_phone=customer.phone if customer else None,
            billing_address=order.shipping_address,
            shipping_address=order.shipping_address,
            vendor_name=vendor.business_name,
            vendor_gstin=vendor.gstin,
            vendor_pan=vendor.pan_number,
            vendor_address={
                "street": vendor.street_address,
                "city": vendor.city,
                "state": vendor.state,
                "postal_code": vendor.postal_code,
            },
            items=invoice_items,
            item_count=len(invoice_items),
            subtotal=subtotal,
            discount_amount=discount,
            taxable_amount=taxable_total,
            cgst_amount=total_cgst,
            sgst_amount=total_sgst,
            igst_amount=total_igst,
            total_tax=total_tax,
            round_off=round_off,
            total=grand,
            amount_paid=paid,
            balance_due=grand - paid,
            financial_year=fy,
            sequence_number=seq,
            status="paid" if paid >= grand else "sent",
            is_gst=vendor_gst,
            is_inter_state=is_inter_state,
        )
        self.db.add(invoice)
        if auto_commit:
            await self.db.commit()
            await self.db.refresh(invoice)
        else:
            await self.db.flush()
        return invoice

    async def create_from_pos_transaction(
        self,
        txn: POSTransaction,
        order_id=None,
        auto_commit: bool = False,
    ) -> Invoice | None:
        """Auto-generate an invoice from a POS transaction."""
        vendor_result = await self.db.execute(select(Vendor).where(Vendor.id == txn.vendor_id))
        vendor = vendor_result.scalar_one_or_none()
        if not vendor:
            log.warning("Cannot create POS invoice: vendor %s not found", txn.vendor_id)
            return None

        customer = None
        if txn.customer_id:
            customer_result = await self.db.execute(select(Customer).where(Customer.id == txn.customer_id))
            customer = customer_result.scalar_one_or_none()

        vendor_gst = bool(vendor.gstin)

        invoice_items = []
        for item in (txn.items or []):
            qty = item.get("qty", 0)
            rate = item.get("price", 0)
            tax_rate = item.get("tax_rate", 0) if vendor_gst else 0
            taxable = float(item.get("taxable", qty * rate))
            half = tax_rate / 2
            cgst_amt = round(taxable * half / 100, 2)
            sgst_amt = round(taxable * half / 100, 2)

            invoice_items.append({
                "name": item.get("name", ""),
                "description": item.get("description"),
                "hsn_sac": item.get("hsn_code") or item.get("sac_code"),
                "qty": qty,
                "rate": rate,
                "discount": float(item.get("discount", 0)),
                "taxable_value": taxable,
                "cgst_rate": half, "cgst_amt": float(cgst_amt),
                "sgst_rate": half, "sgst_amt": float(sgst_amt),
                "igst_rate": 0, "igst_amt": 0,
                "tax_rate": tax_rate,
                "total": float(taxable + cgst_amt + sgst_amt),
            })

        fy = self._get_financial_year()
        seq = await self._next_sequence(txn.vendor_id, "invoice")
        invoice_number = self._generate_number("INV", fy, seq)

        subtotal = float(txn.subtotal or 0)
        discount = float(txn.discount_amount or 0)
        taxable_total = subtotal - discount
        total_cgst = sum(i["cgst_amt"] for i in invoice_items)
        total_sgst = sum(i["sgst_amt"] for i in invoice_items)
        total_tax = total_cgst + total_sgst
        grand = taxable_total + total_tax
        round_off = round(grand) - grand
        grand = round(grand)

        store_id = getattr(txn, "store_id", None) or await get_default_store_id(self.db, txn.vendor_id)

        invoice = Invoice(
            vendor_id=txn.vendor_id,
            customer_id=txn.customer_id,
            order_id=order_id,
            store_id=store_id,
            invoice_number=invoice_number,
            invoice_type="invoice",
            document_type="tax_invoice" if vendor_gst else "bill_of_supply",
            customer_name=customer.full_name if customer else None,
            customer_email=customer.email if customer else None,
            customer_phone=customer.phone if customer else None,
            vendor_name=vendor.business_name,
            vendor_gstin=vendor.gstin,
            vendor_pan=vendor.pan_number,
            vendor_address={
                "street": vendor.street_address,
                "city": vendor.city,
                "state": vendor.state,
                "postal_code": vendor.postal_code,
            },
            items=invoice_items,
            item_count=len(invoice_items),
            subtotal=subtotal,
            discount_amount=discount,
            taxable_amount=taxable_total,
            cgst_amount=total_cgst,
            sgst_amount=total_sgst,
            igst_amount=0,
            total_tax=total_tax,
            round_off=round_off,
            total=grand,
            amount_paid=grand,
            balance_due=0,
            financial_year=fy,
            sequence_number=seq,
            status="paid",
            is_gst=vendor_gst,
            is_inter_state=False,
            notes=f"POS Transaction: {txn.transaction_number}",
        )
        self.db.add(invoice)
        if auto_commit:
            await self.db.commit()
            await self.db.refresh(invoice)
        else:
            await self.db.flush()
        return invoice

    async def create_from_booking(
        self,
        booking: Booking,
        auto_commit: bool = True,
    ) -> Invoice | None:
        """Auto-generate an invoice when a booking is completed."""
        if booking.invoice_id:
            existing = await self.db.get(Invoice, booking.invoice_id)
            if existing:
                return existing

        vendor_result = await self.db.execute(select(Vendor).where(Vendor.id == booking.vendor_id))
        vendor = vendor_result.scalar_one_or_none()
        if not vendor:
            log.warning("Cannot create booking invoice: vendor %s not found", booking.vendor_id)
            return None

        customer = None
        if booking.customer_id:
            customer_result = await self.db.execute(select(Customer).where(Customer.id == booking.customer_id))
            customer = customer_result.scalar_one_or_none()

        vendor_gst = bool(vendor.gstin)
        price = float(booking.service_price or booking.subtotal or 0)
        tax_rate = 18 if vendor_gst else 0
        half = tax_rate / 2
        taxable = price
        cgst_amt = round(taxable * half / 100, 2)
        sgst_amt = round(taxable * half / 100, 2)

        invoice_items = [{
            "name": booking.service_name or "Service Booking",
            "description": f"Booking: {booking.booking_number}",
            "hsn_sac": None,
            "qty": 1,
            "rate": price,
            "discount": float(booking.discount_amount or 0),
            "taxable_value": taxable,
            "cgst_rate": half, "cgst_amt": float(cgst_amt),
            "sgst_rate": half, "sgst_amt": float(sgst_amt),
            "igst_rate": 0, "igst_amt": 0,
            "tax_rate": tax_rate,
            "total": float(taxable + cgst_amt + sgst_amt),
        }]

        fy = self._get_financial_year()
        seq = await self._next_sequence(booking.vendor_id, "invoice")
        invoice_number = self._generate_number("INV", fy, seq)

        total_tax = cgst_amt + sgst_amt
        grand = taxable + total_tax
        round_off = round(grand) - grand
        grand = round(grand)

        booking_order_id = getattr(booking, "order_id", None)
        store_id = None
        if booking_order_id:
            linked = await self.db.get(Order, booking_order_id)
            store_id = linked.store_id if linked else None
        store_id = store_id or await get_default_store_id(self.db, booking.vendor_id)

        invoice = Invoice(
            vendor_id=booking.vendor_id,
            customer_id=booking.customer_id,
            order_id=booking_order_id,
            store_id=store_id,
            booking_id=booking.id,
            booking_number=booking.booking_number,
            invoice_number=invoice_number,
            invoice_type="invoice",
            document_type="tax_invoice" if vendor_gst else "bill_of_supply",
            customer_name=booking.customer_name or (customer.full_name if customer else None),
            customer_email=booking.customer_email or (customer.email if customer else None),
            customer_phone=booking.customer_phone or (customer.phone if customer else None),
            vendor_name=vendor.business_name,
            vendor_gstin=vendor.gstin,
            vendor_pan=vendor.pan_number,
            vendor_address={
                "street": vendor.street_address,
                "city": vendor.city,
                "state": vendor.state,
                "postal_code": vendor.postal_code,
            },
            items=invoice_items,
            item_count=1,
            subtotal=price,
            discount_amount=float(booking.discount_amount or 0),
            taxable_amount=taxable,
            cgst_amount=cgst_amt,
            sgst_amount=sgst_amt,
            igst_amount=0,
            total_tax=total_tax,
            round_off=round_off,
            total=grand,
            amount_paid=grand,
            balance_due=0,
            financial_year=fy,
            sequence_number=seq,
            status="paid",
            is_gst=vendor_gst,
            is_inter_state=False,
            notes=f"Booking: {booking.booking_number}",
        )
        self.db.add(invoice)
        if auto_commit:
            await self.db.commit()
            await self.db.refresh(invoice)
        else:
            await self.db.flush()

        booking.invoice_id = invoice.id
        if auto_commit:
            await self.db.commit()

        return invoice
