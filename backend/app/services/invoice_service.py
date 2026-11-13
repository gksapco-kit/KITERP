import logging
import uuid
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func as sqlfunc, and_, or_
from uuid import UUID
from datetime import date, datetime, timezone
import math

from app.models.invoice import Invoice
from app.models.vendor import Vendor
from app.models.order import Order
from app.models.customer import Customer
from app.models.pos import POSTransaction
from app.models.booking import Booking
from app.services.store_resolver import (
    resolve_store_id as resolve_txn_store_id,
    get_default_store_id,
    parse_explicit_sales_area_id,
    resolve_txn_sales_area_id,
)
from app.services.invoice_numbering import (
    format_invoice_number,
    resolve_number_prefix_suffix_with_overrides,
)

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

def _normalize_invoice_additional_charges(raw) -> list:
    if not raw:
        return []
    if not isinstance(raw, list):
        return []
    out = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or "").strip()
        amount = float(item.get("amount") or 0)
        if not name or amount <= 0:
            continue
        tax_rate = float(item.get("tax_rate") if item.get("tax_rate") is not None else 18)
        out.append({
            "id": str(item.get("id") or "").strip() or str(uuid.uuid4()),
            "name": name,
            "amount": round(amount, 2),
            "tax_rate": max(0.0, min(100.0, tax_rate)),
        })
    return out


def _additional_charges_as_items(charges: list) -> list:
    return [
        {
            "name": c["name"],
            "qty": 1,
            "rate": c["amount"],
            "discount": 0,
            "tax_rate": c.get("tax_rate", 18),
        }
        for c in charges
    ]


async def _try_generate_einvoice(db, invoice, vendor=None):
    """Best-effort GST e-invoice. Off by default; never blocks invoice creation."""
    try:
        from app.services.einvoice_service import maybe_generate_einvoice
        await maybe_generate_einvoice(db, invoice, vendor)
    except Exception:
        log.exception("e-invoice auto-generate failed for invoice %s", getattr(invoice, "id", None))


# Finance GL posting (non-blocking: failures are queued in fin_posting_failure for Finance to retry)
async def _try_post_invoice(db, vendor_id, invoice):
    """Post invoice to GL. Credit notes use 'credit_note' source type (reversed entries)."""
    from app.services.finance.safe_posting import safe_post
    inv_type = getattr(invoice, "invoice_type", "invoice") or "invoice"
    source_type = "credit_note" if inv_type == "credit_note" else "invoice"
    entry_date = invoice.invoice_date or (invoice.created_at.date() if invoice.created_at else date.today())
    return await safe_post(db, vendor_id, source_type, invoice.id, {
        "total": Decimal(str(invoice.total or 0)),
        "cgst": Decimal(str(getattr(invoice, "cgst_amount", None) or 0)),
        "sgst": Decimal(str(getattr(invoice, "sgst_amount", None) or 0)),
        "igst": Decimal(str(getattr(invoice, "igst_amount", None) or 0)),
        "customer_id": invoice.customer_id,
        "entry_date": entry_date,
        "narration": f"{inv_type.replace('_', ' ').title()} {invoice.invoice_number}",
    })


def payment_source_id(invoice_id, amount_paid_after) -> uuid.UUID:
    """
    Deterministic GL source id for ONE payment against an invoice.

    post_event keeps a single live entry per (source_type, source_id); using the
    invoice id for every payment made a second partial payment void the first.
    Keying on the cumulative amount paid makes each payment distinct yet idempotent.
    """
    return uuid.uuid5(invoice_id, f"payment:{Decimal(str(amount_paid_after)):.2f}")


async def _try_post_payment(db, vendor_id, invoice, amount):
    from app.services.finance.safe_posting import safe_post
    return await safe_post(
        db, vendor_id, "payment", payment_source_id(invoice.id, invoice.amount_paid or 0), {
            "amount": Decimal(str(amount)),
            "customer_id": invoice.customer_id,
            "entry_date": date.today(),
            "narration": f"Payment for Invoice {invoice.invoice_number}",
        })


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

    def _generate_number(self, prefix: str, fy: str, seq: int, suffix: str = "") -> str:
        return format_invoice_number(prefix, fy, seq, suffix)

    async def _invoice_number_taken(self, vendor_id: UUID, invoice_number: str) -> bool:
        result = await self.db.execute(
            select(Invoice.id).where(
                and_(
                    Invoice.vendor_id == vendor_id,
                    Invoice.invoice_number == invoice_number,
                )
            ).limit(1)
        )
        return result.scalar_one_or_none() is not None

    async def _allocate_invoice_number(
        self,
        vendor: Vendor,
        vendor_id: UUID,
        invoice_type: str,
        *,
        prefix_override: str | None = None,
        suffix_override: str | None = None,
        sequence_override: int | None = None,
    ) -> tuple[str, str, int]:
        prefix, suffix = resolve_number_prefix_suffix_with_overrides(
            vendor.settings,
            invoice_type,
            prefix_override=prefix_override,
            suffix_override=suffix_override,
        )
        fy = self._get_financial_year()
        if sequence_override is not None:
            seq = int(sequence_override)
            if seq < 1:
                raise ValueError("Sequence must be at least 1")
        else:
            seq = await self._next_sequence(vendor_id, invoice_type)
        invoice_number = self._generate_number(prefix, fy, seq, suffix)
        if await self._invoice_number_taken(vendor_id, invoice_number):
            raise ValueError(
                f"Invoice number {invoice_number} already exists — choose another sequence or prefix"
            )
        return invoice_number, fy, seq

    async def preview_invoice_number(
        self,
        vendor_id: UUID,
        invoice_type: str,
        *,
        prefix_override: str | None = None,
        suffix_override: str | None = None,
        sequence_override: int | None = None,
    ) -> dict:
        vendor_result = await self.db.execute(select(Vendor).where(Vendor.id == vendor_id))
        vendor = vendor_result.scalar_one_or_none()
        if not vendor:
            raise ValueError("Vendor not found")

        has_prefix = prefix_override is not None
        has_suffix = suffix_override is not None
        prefix, suffix = resolve_number_prefix_suffix_with_overrides(
            vendor.settings,
            invoice_type,
            prefix_override=prefix_override if has_prefix else None,
            suffix_override=suffix_override if has_suffix else None,
        )
        fy = self._get_financial_year()
        suggested = await self._next_sequence(vendor_id, invoice_type)
        if sequence_override is not None:
            seq = int(sequence_override)
            if seq < 1:
                raise ValueError("Sequence must be at least 1")
        else:
            seq = suggested
        invoice_number = self._generate_number(prefix, fy, seq, suffix)
        return {
            "invoice_number": invoice_number,
            "prefix": prefix,
            "suffix": suffix,
            "financial_year": fy,
            "sequence_number": seq,
            "suggested_sequence": suggested,
            "available": not await self._invoice_number_taken(vendor_id, invoice_number),
        }

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

    def _rollup_line_and_charge_tax(
        self,
        raw_items: list,
        additional_charges: list,
        is_inter_state: bool,
        vendor_gst_registered: bool,
        invoice_type: str = "invoice",
    ):
        computed_items, taxable_lines, cgst, sgst, igst = self._compute_tax(
            raw_items, is_inter_state, vendor_gst_registered, invoice_type
        )
        if additional_charges:
            _, taxable_ch, cgst_c, sgst_c, igst_c = self._compute_tax(
                _additional_charges_as_items(additional_charges),
                is_inter_state,
                vendor_gst_registered,
                invoice_type,
            )
            taxable = taxable_lines + taxable_ch
            cgst += cgst_c
            sgst += sgst_c
            igst += igst_c
        else:
            taxable = taxable_lines
        return computed_items, taxable, cgst, sgst, igst

    def _raw_items_from_stored(self, stored_items: list) -> list:
        raw = []
        for item in stored_items or []:
            if not isinstance(item, dict):
                continue
            raw.append({
                "name": item.get("name", ""),
                "description": item.get("description"),
                "hsn_sac": item.get("hsn_sac"),
                "qty": item.get("qty", 0),
                "rate": item.get("rate", 0),
                "discount": item.get("discount", 0),
                "tax_rate": item.get("tax_rate", 0),
            })
        return raw

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
        has_prefix = "number_prefix" in data
        has_suffix = "number_suffix" in data
        seq_override = None
        if data.get("number_sequence") is not None and str(data.get("number_sequence")).strip() != "":
            seq_override = int(data["number_sequence"])
        invoice_number, fy, seq = await self._allocate_invoice_number(
            vendor,
            vendor_id,
            invoice_type,
            prefix_override=data.get("number_prefix") if has_prefix else None,
            suffix_override=data.get("number_suffix") if has_suffix else None,
            sequence_override=seq_override,
        )

        is_inter_state = data.get("is_inter_state", False)
        vendor_gst = bool(vendor.gstin)

        raw_items = data.get("items", [])
        additional_charges = _normalize_invoice_additional_charges(data.get("additional_charges"))
        computed_items, taxable, cgst, sgst, igst = self._rollup_line_and_charge_tax(
            raw_items, additional_charges, is_inter_state, vendor_gst, invoice_type
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
        linked = await self.db.get(Order, order_uuid) if order_uuid else None
        if not store_id and linked:
            store_id = linked.store_id
        store_id = await resolve_txn_store_id(self.db, vendor_id, store_id=store_id)

        cust_uuid = UUID(data["customer_id"]) if data.get("customer_id") else None
        explicit_sa = await parse_explicit_sales_area_id(
            self.db, vendor_id, data.get("sales_area_id"),
        )
        sales_area_id = await resolve_txn_sales_area_id(
            self.db,
            vendor_id,
            store_id=store_id,
            customer_id=cust_uuid,
            explicit=explicit_sa,
            source_sales_area_id=getattr(linked, "sales_area_id", None) if linked else None,
        )

        order_number = (data.get("order_number") or "").strip() or None
        if linked and not order_number:
            order_number = getattr(linked, "order_number", None)

        invoice = Invoice(
            vendor_id=vendor_id,
            customer_id=cust_uuid,
            order_id=order_uuid,
            order_number=order_number,
            store_id=store_id,
            sales_area_id=sales_area_id,
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
            additional_charges=additional_charges,
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
            invoice_date=_parse_optional_date(data.get("invoice_date")),
            posting_date=_parse_optional_date(data.get("posting_date")),
            due_date=_parse_optional_date(data.get("due_date")),
            payment_terms=data.get("payment_terms"),
            notes=data.get("notes"),
            terms_and_conditions=data.get("terms_and_conditions"),
            extra_fields=data.get("extra_fields") or [],
            created_by=created_by,
            # Vendor-panel "Create Invoice" issues the document immediately so it
            # appears in Outstanding AR. Estimates stay draft until converted.
            # Callers may still pass an explicit status (e.g. draft / paid).
            status=(
                data.get("status")
                or ("draft" if invoice_type == "estimate" else "sent")
            ),
        )
        self.db.add(invoice)
        await self.db.commit()
        await self.db.refresh(invoice)
        # Post to GL for non-draft, non-estimate invoices (best-effort, non-blocking)
        if invoice.invoice_type not in ("estimate",) and invoice.status not in ("draft",):
            await _try_post_invoice(self.db, vendor_id, invoice)
            # _try_post_invoice only flushes inside a savepoint; persist the JE.
            await self.db.commit()
        await _try_generate_einvoice(self.db, invoice, vendor)
        await self.db.commit()
        await self.db.refresh(invoice)

        init_pay = data.get("initial_payment")
        if init_pay and invoice.invoice_type != "estimate":
            try:
                amt = float(init_pay.get("amount") or 0)
            except (TypeError, ValueError):
                amt = 0
            if amt > 0:
                cap = min(amt, float(invoice.total or 0))
                if cap > 0:
                    invoice = await self.record_payment(invoice.id, vendor_id, cap)

        return invoice

    async def update_invoice(self, invoice_id: UUID, vendor_id: UUID, data: dict) -> Invoice:
        result = await self.db.execute(
            select(Invoice).where(and_(Invoice.id == invoice_id, Invoice.vendor_id == vendor_id))
        )
        invoice = result.scalar_one_or_none()
        if not invoice:
            raise ValueError("Invoice not found")
        if invoice.deleted_at:
            raise ValueError("Cannot edit a deleted invoice. Restore it first.")

        if invoice.status in ("paid", "cancelled"):
            raise ValueError(f"Cannot edit invoice in '{invoice.status}' status")

        if invoice.order_id:
            extra = {k for k in data.keys() if k != "sales_area_id"}
            if extra:
                raise ValueError(
                    "This invoice is linked to an order and cannot be edited. Update the order instead."
                )

        if "due_date" in data:
            data = {**data, "due_date": _parse_optional_date(data.get("due_date"))}
        if "invoice_date" in data:
            data = {**data, "invoice_date": _parse_optional_date(data.get("invoice_date"))}
        if "posting_date" in data:
            data = {**data, "posting_date": _parse_optional_date(data.get("posting_date"))}

        if "sales_area_id" in data:
            invoice.sales_area_id = await parse_explicit_sales_area_id(
                self.db, vendor_id, data.get("sales_area_id"),
            )
            data = {k: v for k, v in data.items() if k != "sales_area_id"}

        if "additional_charges" in data:
            data = {
                **data,
                "additional_charges": _normalize_invoice_additional_charges(data.get("additional_charges")),
            }

        for key, value in data.items():
            if value is not None and hasattr(invoice, key) and key not in ("id", "vendor_id", "invoice_number"):
                setattr(invoice, key, value)

        recalc = bool(data.get("items")) or "additional_charges" in data or "discount_amount" in data
        if recalc:
            vendor_result = await self.db.execute(select(Vendor).where(Vendor.id == vendor_id))
            vendor = vendor_result.scalar_one_or_none()
            raw_items = data.get("items") or self._raw_items_from_stored(invoice.items or [])
            charges = (
                _normalize_invoice_additional_charges(data.get("additional_charges"))
                if "additional_charges" in data
                else _normalize_invoice_additional_charges(getattr(invoice, "additional_charges", None))
            )
            computed, taxable, cgst, sgst, igst = self._rollup_line_and_charge_tax(
                raw_items,
                charges,
                invoice.is_inter_state,
                bool(vendor and vendor.gstin),
                invoice.invoice_type,
            )
            if data.get("items"):
                invoice.items = computed
                invoice.item_count = len(computed)
            if "additional_charges" in data:
                invoice.additional_charges = charges
            invoice.taxable_amount = taxable
            invoice.cgst_amount = cgst
            invoice.sgst_amount = sgst
            invoice.igst_amount = igst
            invoice.total_tax = cgst + sgst + igst
            invoice.subtotal = sum(i["qty"] * i["rate"] for i in raw_items)
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
        if invoice.deleted_at:
            raise ValueError("Cannot record payment on a deleted invoice. Restore it first.")

        invoice.amount_paid = float(invoice.amount_paid or 0) + amount
        invoice.balance_due = float(invoice.total or 0) - invoice.amount_paid

        if invoice.balance_due <= 0:
            invoice.status = "paid"
            invoice.balance_due = 0
        else:
            invoice.status = "partially_paid"

        # Post GL entry within the same transaction so subledger and ledger stay in sync
        await _try_post_payment(self.db, vendor_id, invoice, amount)
        await self.db.commit()
        await self.db.refresh(invoice)

        # Phase-8: reduce credit outstanding when a pay_later order's invoice is paid
        if invoice.order_id and invoice.status == "paid":
            try:
                from app.models.order import Order as _Order
                from app.services.crm.credit_gate import find_credit_control as _fcc, adjust_outstanding as _adj
                from decimal import Decimal as _Dec

                order_result = await self.db.execute(
                    select(_Order).where(_Order.id == invoice.order_id)
                )
                order = order_result.scalar_one_or_none()
                if order and order.payment_method == "pay_later":
                    credit_row = await _fcc(self.db, vendor_id, customer_id=order.customer_id)
                    if credit_row:
                        await _adj(self.db, credit_row, -_Dec(str(amount)))
                        await self.db.commit()
            except Exception as exc:
                log.warning("Credit outstanding sync on invoice payment failed: %s", exc)

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
            "additional_charges": getattr(estimate, "additional_charges", None) or [],
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
        customer_id: str | UUID = None,
        open_only: bool = False,
        deleted: bool = False,
    ):
        conditions = [Invoice.vendor_id == vendor_id]
        if deleted:
            conditions.append(Invoice.deleted_at.is_not(None))
        else:
            conditions.append(Invoice.deleted_at.is_(None))
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
        if customer_id:
            conditions.append(
                Invoice.customer_id == (customer_id if isinstance(customer_id, UUID) else UUID(str(customer_id)))
            )
        if open_only:
            # Outstanding AR: not paid/cancelled/draft, and still has a balance.
            conditions.append(Invoice.status.notin_(("paid", "cancelled", "draft")))
            conditions.append(Invoice.balance_due > 0)
            if not invoice_type and not exclude_invoice_type:
                conditions.append(Invoice.invoice_type != "estimate")
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

    async def get_by_number(
        self, vendor_id: UUID, number: str, invoice_type: str | None = None,
    ) -> Invoice | None:
        from app.utils.doc_lookup import lookup_id_by_number, lookup_http_error
        extra = [Invoice.deleted_at.is_(None)]
        if invoice_type:
            extra.append(Invoice.invoice_type == invoice_type)
        invoice_id, status = await lookup_id_by_number(
            self.db, Invoice, Invoice.invoice_number, vendor_id, number, extra_filters=extra,
        )
        if not invoice_id and invoice_type:
            invoice_id, status = await lookup_id_by_number(
                self.db, Invoice, Invoice.invoice_number, vendor_id, number,
                extra_filters=[Invoice.deleted_at.is_(None)],
            )
        if not invoice_id:
            raise lookup_http_error(status, "invoice")
        return await self.get_invoice(invoice_id, vendor_id)

    async def get_by_order_id(self, order_id: UUID, vendor_id: UUID) -> Invoice | None:
        result = await self.db.execute(
            select(Invoice).where(
                and_(
                    Invoice.order_id == order_id,
                    Invoice.vendor_id == vendor_id,
                    Invoice.invoice_type == "invoice",
                    Invoice.deleted_at.is_(None),
                )
            )
        )
        return result.scalar_one_or_none()

    async def soft_delete(self, invoice_id: UUID, vendor_id: UUID) -> Invoice:
        invoice = await self.get_invoice(invoice_id, vendor_id)
        if not invoice:
            raise ValueError("Invoice not found")
        if invoice.deleted_at:
            raise ValueError("Invoice is already deleted")
        invoice.deleted_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(invoice)
        return invoice

    async def restore(self, invoice_id: UUID, vendor_id: UUID) -> Invoice:
        invoice = await self.get_invoice(invoice_id, vendor_id)
        if not invoice:
            raise ValueError("Invoice not found")
        if not invoice.deleted_at:
            raise ValueError("Invoice is not deleted")
        invoice.deleted_at = None
        await self.db.commit()
        await self.db.refresh(invoice)
        return invoice

    async def _post_new_invoice_to_gl(self, vendor_id: UUID, invoice: Invoice) -> None:
        """GL-post an invoice created by an order/booking flow, plus any payment already received."""
        if invoice.invoice_type in ("estimate",) or invoice.status in ("draft",):
            return
        await _try_post_invoice(self.db, vendor_id, invoice)
        paid = Decimal(str(invoice.amount_paid or 0))
        if paid > 0:
            await _try_post_payment(self.db, vendor_id, invoice, paid)

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
                "hsn_sac": item.get("hsn_sac") or item.get("hsn_code") or item.get("sac_code"),
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

        invoice_number, fy, seq = await self._allocate_invoice_number(vendor, order.vendor_id, "invoice")

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
        sales_area_id = await resolve_txn_sales_area_id(
            self.db,
            order.vendor_id,
            store_id=store_id,
            customer_id=order.customer_id,
            source_sales_area_id=getattr(order, "sales_area_id", None),
        )

        invoice = Invoice(
            vendor_id=order.vendor_id,
            customer_id=order.customer_id,
            order_id=order.id,
            store_id=store_id,
            sales_area_id=sales_area_id,
            order_number=getattr(order, "order_number", None),
            invoice_number=invoice_number,
            invoice_type="invoice",
            document_type="tax_invoice" if vendor_gst else "bill_of_supply",
            customer_name=customer.full_name if customer else None,
            customer_email=customer.email if customer else None,
            customer_phone=customer.phone if customer else None,
            customer_gstin=getattr(customer, "gstin", None) if customer else None,
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
        await self.db.flush()
        await self._post_new_invoice_to_gl(order.vendor_id, invoice)
        if auto_commit:
            await self.db.commit()
            await self.db.refresh(invoice)
        else:
            await self.db.flush()
        await _try_generate_einvoice(self.db, invoice, vendor)
        if auto_commit:
            await self.db.commit()
            await self.db.refresh(invoice)
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

        invoice_number, fy, seq = await self._allocate_invoice_number(vendor, txn.vendor_id, "invoice")

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
        sales_area_id = await resolve_txn_sales_area_id(
            self.db,
            txn.vendor_id,
            store_id=store_id,
            customer_id=txn.customer_id,
            source_sales_area_id=getattr(txn, "sales_area_id", None),
        )

        invoice = Invoice(
            vendor_id=txn.vendor_id,
            customer_id=txn.customer_id,
            order_id=order_id,
            store_id=store_id,
            sales_area_id=sales_area_id,
            invoice_number=invoice_number,
            invoice_type="invoice",
            document_type="tax_invoice" if vendor_gst else "bill_of_supply",
            customer_name=customer.full_name if customer else None,
            customer_email=customer.email if customer else None,
            customer_phone=customer.phone if customer else None,
            customer_gstin=getattr(customer, "gstin", None) if customer else None,
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
        await _try_generate_einvoice(self.db, invoice, vendor)
        if auto_commit:
            await self.db.commit()
            await self.db.refresh(invoice)
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

        invoice_number, fy, seq = await self._allocate_invoice_number(vendor, booking.vendor_id, "invoice")

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
        sales_area_id = await resolve_txn_sales_area_id(
            self.db,
            booking.vendor_id,
            store_id=store_id,
            customer_id=booking.customer_id,
            source_sales_area_id=getattr(booking, "sales_area_id", None),
        )

        invoice = Invoice(
            vendor_id=booking.vendor_id,
            customer_id=booking.customer_id,
            order_id=booking_order_id,
            store_id=store_id,
            sales_area_id=sales_area_id,
            booking_id=booking.id,
            booking_number=booking.booking_number,
            invoice_number=invoice_number,
            invoice_type="invoice",
            document_type="tax_invoice" if vendor_gst else "bill_of_supply",
            customer_name=booking.customer_name or (customer.full_name if customer else None),
            customer_email=booking.customer_email or (customer.email if customer else None),
            customer_phone=booking.customer_phone or (customer.phone if customer else None),
            customer_gstin=getattr(customer, "gstin", None) if customer else None,
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
        await self.db.flush()
        await self._post_new_invoice_to_gl(booking.vendor_id, invoice)
        if auto_commit:
            await self.db.commit()
            await self.db.refresh(invoice)
        else:
            await self.db.flush()
        await _try_generate_einvoice(self.db, invoice, vendor)

        booking.invoice_id = invoice.id
        if auto_commit:
            await self.db.commit()
            await self.db.refresh(invoice)

        return invoice

    # ── Phase-5: bill from delivery ──────────────────────────────────────────

    async def bill_from_delivery(
        self,
        vendor_id: UUID,
        order_id: UUID,
        delivery_id: UUID,
        created_by: UUID,
        due_date: date | None = None,
        notes: str | None = None,
    ) -> Invoice:
        """Create an invoice from a goods-issued delivery.

        Validates:
          • delivery belongs to order and is goods_issued
          • order has no billing_block
          • no existing invoice already covers this delivery

        After creating the invoice, updates:
          • OrderLine.invoiced_qty  (adds issued_qty per delivery line)
          • Order.billing_status   (open | partial | complete)
        """
        from decimal import Decimal
        from app.models.order import OrderDelivery, DeliveryLine, OrderLine

        # ── Guard checks ─────────────────────────────────────────────────────
        order_result = await self.db.execute(
            select(Order).where(Order.id == order_id, Order.vendor_id == vendor_id)
        )
        order = order_result.scalar_one_or_none()
        if not order:
            raise ValueError("Order not found")

        if getattr(order, "billing_block", None):
            raise ValueError(f"Order has a billing block: {order.billing_block}")

        delivery_result = await self.db.execute(
            select(OrderDelivery).where(
                OrderDelivery.id == delivery_id,
                OrderDelivery.order_id == order_id,
                OrderDelivery.vendor_id == vendor_id,
            )
        )
        delivery = delivery_result.scalar_one_or_none()
        if not delivery:
            raise ValueError("Delivery not found")
        if delivery.status != "goods_issued":
            raise ValueError("Invoice can only be created after goods issue is posted")

        # Check if a billing document already exists for this delivery
        existing_result = await self.db.execute(
            select(Invoice).where(
                Invoice.delivery_id == delivery_id,
                Invoice.invoice_type == "invoice",
            )
        )
        if existing_result.scalar_one_or_none():
            raise ValueError("A billing document already exists for this delivery")

        # ── Build invoice items from delivery lines ───────────────────────────
        dl_result = await self.db.execute(
            select(DeliveryLine).where(DeliveryLine.delivery_id == delivery_id)
        )
        dl_rows = dl_result.scalars().all()
        if not dl_rows:
            raise ValueError("Delivery has no lines")

        # Collect unit prices from order_lines
        ol_prices: dict[UUID, dict] = {}
        for dl in dl_rows:
            if dl.order_line_id and dl.order_line_id not in ol_prices:
                ol_result = await self.db.execute(
                    select(OrderLine).where(OrderLine.id == dl.order_line_id)
                )
                ol = ol_result.scalar_one_or_none()
                if ol:
                    ol_prices[dl.order_line_id] = {
                        "unit_price": float(ol.unit_price or 0),
                        "discount_pct": float(ol.discount_pct or 0),
                        "tax_pct": float(ol.tax_pct or 0),
                        "hsn_sac": ol.hsn_sac,
                    }

        invoice_items = []
        for dl in dl_rows:
            qty = float(dl.issued_qty or dl.planned_qty)
            if qty <= 0:
                continue
            pricing = ol_prices.get(dl.order_line_id, {}) if dl.order_line_id else {}
            rate = pricing.get("unit_price", 0)
            invoice_items.append({
                "name": dl.product_name or f"Item {dl.line_no}",
                "description": f"Delivery {delivery.delivery_number} — line {dl.line_no}",
                "hsn_sac": pricing.get("hsn_sac") or "",
                "qty": qty,
                "unit": dl.unit or "pcs",
                "rate": rate,
                "discount": pricing.get("discount_pct", 0),
                "tax_rate": pricing.get("tax_pct", 0),
            })

        # ── Customer details ─────────────────────────────────────────────────
        customer_result = await self.db.execute(
            select(Customer).where(Customer.id == order.customer_id)
        )
        customer = customer_result.scalar_one_or_none()

        payment_terms_str = None
        if getattr(order, "payment_terms_code", None):
            pt_days = getattr(order, "payment_terms_days", None)
            payment_terms_str = order.payment_terms_code
            if pt_days:
                payment_terms_str += f" ({pt_days} days)"

        data = {
            "order_id": str(order_id),
            "invoice_type": "invoice",
            "customer_id": str(order.customer_id) if order.customer_id else None,
            "customer_name": customer.full_name if customer else None,
            "customer_email": customer.email if customer else None,
            "customer_phone": customer.phone if customer else None,
            "customer_gstin": customer.gstin if customer else None,
            "billing_address": (customer.billing_address if customer else None) or order.shipping_address,
            "shipping_address": order.shipping_address,
            "is_inter_state": False,
            "place_of_supply": None,
            "items": invoice_items,
            "discount_amount": 0,
            "due_date": due_date.isoformat() if due_date else None,
            "payment_terms": payment_terms_str,
            "notes": notes or f"Generated from delivery {delivery.delivery_number}",
            "order_number": order.order_number,
        }

        # ── Create invoice (commits internally) ──────────────────────────────
        invoice = await self.create_invoice(vendor_id, data, created_by)

        # ── Link delivery ────────────────────────────────────────────────────
        invoice.delivery_id = delivery_id
        await self.db.commit()

        # ── Update OrderLine.invoiced_qty ─────────────────────────────────────
        for dl in dl_rows:
            if not dl.order_line_id:
                continue
            ol_result = await self.db.execute(
                select(OrderLine).where(OrderLine.id == dl.order_line_id)
            )
            ol = ol_result.scalar_one_or_none()
            if ol:
                ol.invoiced_qty = (ol.invoiced_qty or Decimal("0")) + (dl.issued_qty or dl.planned_qty)

        # ── Recalculate Order.billing_status ─────────────────────────────────
        all_lines_result = await self.db.execute(
            select(OrderLine).where(OrderLine.order_id == order_id)
        )
        all_lines = all_lines_result.scalars().all()
        if all_lines:
            total_ordered = sum(float(l.ordered_qty) for l in all_lines)
            total_invoiced = sum(float(l.invoiced_qty or 0) for l in all_lines)
            if total_invoiced <= 0:
                order.billing_status = "open"
            elif total_invoiced >= total_ordered:
                order.billing_status = "complete"
            else:
                order.billing_status = "partial"

        await self.db.commit()
        return invoice
