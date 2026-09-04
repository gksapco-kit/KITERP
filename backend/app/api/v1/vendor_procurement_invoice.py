# app/api/v1/vendor_procurement_invoice.py
import logging
import math
from uuid import UUID
from typing import Optional
from datetime import datetime, timezone
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.api.deps import get_current_vendor_id, get_current_vendor_user, require_permission
from app.models.vendor_user import VendorUser
from app.models.procurement_invoice import VendorInvoice, VendorInvoiceItem, VendorInvoicePayment, VendorInvoiceApproval
from app.schemas.procurement_invoice import (
    VendorInvoiceCreate, VendorInvoiceUpdate, RunMatchRequest,
)
from app.repositories.procurement_invoice_repo import VendorInvoiceRepository
from app.services.finance.posting import post_event

log = logging.getLogger(__name__)

router = APIRouter(dependencies=[Depends(require_permission("procurement.view"))])


# ── Serialiser ────────────────────────────────────────────────────

def _item_to_dict(i: VendorInvoiceItem) -> dict:
    def _f(v):
        return float(v) if v is not None else 0

    return {
        "id": str(i.id),
        "invoice_id": str(i.invoice_id),
        "line_number": getattr(i, "line_number", None) or 1,
        "po_item_id": str(i.po_item_id) if i.po_item_id else None,
        "product_id": str(i.product_id) if i.product_id else None,
        "variant_id": str(i.variant_id) if i.variant_id else None,
        "description": getattr(i, "description", None) or i.notes,
        "uom": getattr(i, "uom", None) or "PCS",
        "ordered_qty": _f(i.ordered_qty),
        "received_qty": _f(i.received_qty),
        "invoiced_qty": _f(i.invoiced_qty),
        "po_unit_price": _f(i.po_unit_price),
        "unit_price": _f(i.unit_price),
        "hsn_code": i.hsn_code,
        "tax_code": i.tax_code,
        "cgst_rate": _f(i.cgst_rate),
        "sgst_rate": _f(i.sgst_rate),
        "igst_rate": _f(i.igst_rate),
        "cgst_amount": _f(i.cgst_amount),
        "sgst_amount": _f(i.sgst_amount),
        "igst_amount": _f(i.igst_amount),
        "subtotal": _f(i.subtotal),
        "tax_total": _f(i.tax_total),
        "total": _f(i.total),
        "qty_variance": _f(i.qty_variance),
        "price_variance": _f(i.price_variance),
        "match_status": i.match_status,
        "notes": i.notes,
        "product_name": i.product.name if getattr(i, "product", None) else None,
    }


def _invoice_to_dict(inv: VendorInvoice) -> dict:
    def _f(v):
        return float(v) if v is not None else 0

    return {
        "id": str(inv.id),
        "vendor_id": str(inv.vendor_id),
        "supplier_id": str(inv.supplier_id),
        "supplier_name": inv.supplier.name if inv.supplier else None,
        "purchase_order_id": str(inv.purchase_order_id) if inv.purchase_order_id else None,
        "po_number": inv.purchase_order.po_number if getattr(inv, "purchase_order", None) else None,
        "requisition_id": str(inv.purchase_order.requisition_id) if getattr(inv, "purchase_order", None) and inv.purchase_order.requisition_id else None,
        "pr_number": inv.purchase_order.requisition.pr_number if getattr(inv, "purchase_order", None) and getattr(inv.purchase_order, "requisition", None) else None,
        "invoice_number": inv.invoice_number,
        "supplier_invoice_number": inv.supplier_invoice_number,
        "invoice_date": inv.invoice_date.isoformat() if inv.invoice_date else None,
        "due_date": inv.due_date.isoformat() if inv.due_date else None,
        "posting_date": inv.posting_date.isoformat() if inv.posting_date else None,
        "status": inv.status,
        "match_status": inv.match_status,
        "currency": inv.currency,
        "subtotal": _f(inv.subtotal),
        "cgst_amount": _f(inv.cgst_amount),
        "sgst_amount": _f(inv.sgst_amount),
        "igst_amount": _f(inv.igst_amount),
        "tax_amount": _f(inv.tax_amount),
        "total": _f(inv.total),
        "amount_paid": _f(inv.amount_paid),
        "amount_due": _f(inv.amount_due),
        "payment_terms": inv.payment_terms,
        "block_reason": inv.block_reason,
        "journal_entry_id": str(inv.journal_entry_id) if getattr(inv, "journal_entry_id", None) else None,
        # Payment tracking (Phase 8)
        "payment_status": getattr(inv, "payment_status", "unpaid"),
        "paid_amount": _f(getattr(inv, "paid_amount", 0)),
        "payment_due_date": inv.payment_due_date.isoformat() if getattr(inv, "payment_due_date", None) else None,
        "tds_rate": _f(getattr(inv, "tds_rate", 0)),
        "tds_amount": _f(getattr(inv, "tds_amount", 0)),
        "net_payable": _f(getattr(inv, "net_payable", 0)),
        "fin_vendor_bill_id": str(inv.fin_vendor_bill_id) if getattr(inv, "fin_vendor_bill_id", None) else None,
        "notes": inv.notes,
        "created_at": inv.created_at.isoformat() if inv.created_at else None,
        "updated_at": inv.updated_at.isoformat() if inv.updated_at else None,
        # Approval workflow (Phase 12)
        "approval_status": getattr(inv, "approval_status", "not_required"),
        "approved_by": str(inv.approved_by) if getattr(inv, "approved_by", None) else None,
        "approved_at": inv.approved_at.isoformat() if getattr(inv, "approved_at", None) else None,
        "approval_required_above": _f(getattr(inv, "approval_required_above", None)),
        "approver_message": getattr(inv, "approver_message", None),
        "approvals": [
            {
                "id": str(a.id),
                "level": a.level,
                "approver_id": str(a.approver_id) if a.approver_id else None,
                "status": a.status,
                "comments": a.comments,
                "actioned_at": a.actioned_at.isoformat() if a.actioned_at else None,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }
            for a in (getattr(inv, "approvals", None) or [])
        ],
        "items": [_item_to_dict(i) for i in (inv.items or [])],
        "payments": [_payment_to_dict(p) for p in (getattr(inv, "payments", None) or [])],
    }


def _payment_to_dict(p: VendorInvoicePayment) -> dict:
    return {
        "id": str(p.id),
        "invoice_id": str(p.invoice_id),
        "amount": float(p.amount) if p.amount is not None else 0,
        "payment_date": p.payment_date.isoformat() if p.payment_date else None,
        "payment_mode": p.payment_mode,
        "payment_reference": p.payment_reference,
        "journal_entry_id": str(p.journal_entry_id) if p.journal_entry_id else None,
        "notes": p.notes,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


def _compute_line_amounts(item_data, item_obj: VendorInvoiceItem) -> VendorInvoiceItem:
    """Calculate tax amounts and totals for a single invoice line."""
    qty = Decimal(str(item_data.invoiced_qty))
    price = Decimal(str(item_data.unit_price))
    subtotal = qty * price

    cgst_rate = Decimal(str(item_data.cgst_rate or 0)) / 100
    sgst_rate = Decimal(str(item_data.sgst_rate or 0)) / 100
    igst_rate = Decimal(str(item_data.igst_rate or 0)) / 100

    cgst_amt = subtotal * cgst_rate
    sgst_amt = subtotal * sgst_rate
    igst_amt = subtotal * igst_rate
    tax_total = cgst_amt + sgst_amt + igst_amt

    item_obj.cgst_rate = item_data.cgst_rate or 0
    item_obj.sgst_rate = item_data.sgst_rate or 0
    item_obj.igst_rate = item_data.igst_rate or 0
    item_obj.cgst_amount = cgst_amt
    item_obj.sgst_amount = sgst_amt
    item_obj.igst_amount = igst_amt
    item_obj.subtotal = subtotal
    item_obj.tax_total = tax_total
    item_obj.total = subtotal + tax_total
    return item_obj


# ── CRUD ──────────────────────────────────────────────────────────

@router.get("/vendor-invoices")
async def list_vendor_invoices(
    status: Optional[str] = Query(None),
    match_status: Optional[str] = Query(None),
    supplier_id: Optional[str] = Query(None),
    pending_my_approval: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    vendor_id: UUID = Depends(get_current_vendor_id),
    vendor_user: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    repo = VendorInvoiceRepository(db)
    skip = (page - 1) * size

    if pending_my_approval:
        # Return invoices with a pending approval step assigned to the current user
        result = await db.execute(
            select(VendorInvoice)
            .join(
                VendorInvoiceApproval,
                (VendorInvoiceApproval.invoice_id == VendorInvoice.id)
                & (VendorInvoiceApproval.approver_id == vendor_user.id)
                & (VendorInvoiceApproval.status == "pending"),
            )
            .where(VendorInvoice.vendor_id == vendor_id)
            .offset(skip)
            .limit(size)
        )
        items = result.scalars().all()
        count_result = await db.execute(
            select(func.count(VendorInvoice.id))
            .join(
                VendorInvoiceApproval,
                (VendorInvoiceApproval.invoice_id == VendorInvoice.id)
                & (VendorInvoiceApproval.approver_id == vendor_user.id)
                & (VendorInvoiceApproval.status == "pending"),
            )
            .where(VendorInvoice.vendor_id == vendor_id)
        )
        total = count_result.scalar_one()
    else:
        items, total = await repo.list_by_vendor(
            vendor_id,
            status=status,
            match_status=match_status,
            supplier_id=UUID(supplier_id) if supplier_id else None,
            skip=skip,
            limit=size,
        )

    return JSONResponse(content={
        "items": [_invoice_to_dict(inv) for inv in items],
        "total": total,
        "page": page,
        "size": size,
        "pages": math.ceil(total / size) if size else 1,
    })


@router.get("/vendor-invoices/{invoice_id}")
async def get_vendor_invoice(
    invoice_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = VendorInvoiceRepository(db)
    inv = await repo.get_by_vendor_and_id(vendor_id, invoice_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Vendor invoice not found")
    return JSONResponse(content=_invoice_to_dict(inv))


@router.post("/vendor-invoices", status_code=status.HTTP_201_CREATED)
async def create_vendor_invoice(
    data: VendorInvoiceCreate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vendor_user: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = Depends(require_permission("procurement.manage")),
):
    repo = VendorInvoiceRepository(db)

    existing = await repo.get_by_invoice_number(vendor_id, data.invoice_number)
    if existing:
        raise HTTPException(status_code=400, detail="Invoice number already exists")

    inv = VendorInvoice(
        vendor_id=vendor_id,
        supplier_id=UUID(data.supplier_id),
        purchase_order_id=UUID(data.purchase_order_id) if data.purchase_order_id else None,
        invoice_number=data.invoice_number,
        supplier_invoice_number=data.supplier_invoice_number,
        invoice_date=data.invoice_date,
        due_date=data.due_date,
        posting_date=data.posting_date,
        currency=data.currency or "INR",
        payment_terms=data.payment_terms,
        notes=data.notes,
        posted_by=vendor_user.id,
    )

    subtotal_total = Decimal(0)
    cgst_total = Decimal(0)
    sgst_total = Decimal(0)
    igst_total = Decimal(0)

    for idx, item_data in enumerate(data.items, start=1):
        if not item_data.product_id and not (item_data.description or "").strip():
            raise HTTPException(
                status_code=400,
                detail=f"Line {idx}: provide a product or a description",
            )
        item_obj = VendorInvoiceItem(
            product_id=UUID(item_data.product_id) if item_data.product_id else None,
            variant_id=UUID(item_data.variant_id) if item_data.variant_id else None,
            po_item_id=UUID(item_data.po_item_id) if item_data.po_item_id else None,
            line_number=item_data.line_number or idx,
            description=(item_data.description or "").strip() or None,
            uom=(item_data.uom or "PCS").strip() or "PCS",
            invoiced_qty=Decimal(str(item_data.invoiced_qty)),
            unit_price=Decimal(str(item_data.unit_price)),
            hsn_code=item_data.hsn_code,
            tax_code=item_data.tax_code,
            notes=item_data.notes,
        )
        _compute_line_amounts(item_data, item_obj)
        inv.items.append(item_obj)

        subtotal_total += item_obj.subtotal
        cgst_total += item_obj.cgst_amount
        sgst_total += item_obj.sgst_amount
        igst_total += item_obj.igst_amount

    inv.subtotal = subtotal_total
    inv.cgst_amount = cgst_total
    inv.sgst_amount = sgst_total
    inv.igst_amount = igst_total
    inv.tax_amount = cgst_total + sgst_total + igst_total
    inv.total = subtotal_total + inv.tax_amount
    inv.amount_due = inv.total

    db.add(inv)
    await db.commit()
    await db.refresh(inv)
    inv = await repo.get_by_vendor_and_id(vendor_id, inv.id)
    return JSONResponse(content=_invoice_to_dict(inv), status_code=201)


@router.put("/vendor-invoices/{invoice_id}")
async def update_vendor_invoice(
    invoice_id: UUID,
    data: VendorInvoiceUpdate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = Depends(require_permission("procurement.manage")),
):
    repo = VendorInvoiceRepository(db)
    inv = await repo.get_by_vendor_and_id(vendor_id, invoice_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Vendor invoice not found")
    if inv.status not in ("draft",):
        raise HTTPException(status_code=400, detail="Only draft invoices can be edited")

    for field in ["supplier_invoice_number", "invoice_date", "due_date", "posting_date", "payment_terms", "notes"]:
        val = getattr(data, field, None)
        if val is not None:
            setattr(inv, field, val)

    await db.commit()
    await db.refresh(inv)
    inv = await repo.get_by_vendor_and_id(vendor_id, inv.id)
    return JSONResponse(content=_invoice_to_dict(inv))


# ── Post invoice ──────────────────────────────────────────────────

@router.post("/vendor-invoices/{invoice_id}/post")
async def post_vendor_invoice(
    invoice_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vendor_user: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = Depends(require_permission("procurement.invoice.verify")),
):
    repo = VendorInvoiceRepository(db)
    inv = await repo.get_by_vendor_and_id(vendor_id, invoice_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Vendor invoice not found")
    if inv.status != "draft":
        raise HTTPException(status_code=400, detail="Only draft invoices can be posted")
    if getattr(inv, "approval_status", "not_required") == "pending":
        raise HTTPException(status_code=400, detail="Invoice is pending approval — it cannot be posted until approved")
    if getattr(inv, "approval_status", "not_required") == "rejected":
        raise HTTPException(status_code=400, detail="Invoice was rejected and cannot be posted")

    inv.status = "posted"
    now = datetime.now(timezone.utc)
    inv.audit_log = (inv.audit_log or []) + [{
        "action": "posted",
        "by": str(vendor_user.id),
        "at": now.isoformat(),
    }]
    await db.flush()

    # ── Finance GL integration ─────────────────────────────────────
    # Build a simple aggregate vendor-bill payload so the existing
    # _handle_vendor_bill logic can create the AP journal entry.
    gl_payload = {
        "subtotal": float(inv.subtotal or 0),
        "tax_amount": float(inv.tax_amount or 0),
        "total": float(inv.total or 0),
        "supplier_id": str(inv.supplier_id),
        "narration": f"AP Invoice {inv.invoice_number}",
    }
    try:
        je = await post_event(db, vendor_id, "vendor_bill", inv.id, gl_payload,
                              created_by_id=vendor_user.id)
        if je is not None:
            inv.journal_entry_id = je.id
    except Exception:
        log.exception(
            "GL posting failed for vendor invoice %s — invoice posted without journal entry",
            inv.id,
        )

    await db.commit()
    inv = await repo.get_by_vendor_and_id(vendor_id, inv.id)
    return JSONResponse(content=_invoice_to_dict(inv))


# ── 3-way match ───────────────────────────────────────────────────

@router.post("/vendor-invoices/{invoice_id}/match")
async def run_three_way_match(
    invoice_id: UUID,
    data: RunMatchRequest,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vendor_user: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = Depends(require_permission("procurement.invoice.verify")),
):
    repo = VendorInvoiceRepository(db)
    inv = await repo.get_by_vendor_and_id(vendor_id, invoice_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Vendor invoice not found")
    if inv.status not in ("posted", "partial_match", "blocked"):
        raise HTTPException(status_code=400, detail="Invoice must be posted before matching")

    inv = await repo.run_three_way_match(
        inv,
        qty_tolerance_pct=data.qty_tolerance_pct or 0,
        price_tolerance_pct=data.price_tolerance_pct or 0,
    )
    inv.audit_log = (inv.audit_log or []) + [{
        "action": "3way_match",
        "result": inv.match_status,
        "by": str(vendor_user.id),
        "at": datetime.now(timezone.utc).isoformat(),
    }]
    await db.commit()
    inv = await repo.get_by_vendor_and_id(vendor_id, inv.id)
    return JSONResponse(content=_invoice_to_dict(inv))


# ── Cancel ────────────────────────────────────────────────────────

@router.post("/vendor-invoices/{invoice_id}/cancel")
async def cancel_vendor_invoice(
    invoice_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vendor_user: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = Depends(require_permission("procurement.invoice.verify")),
):
    repo = VendorInvoiceRepository(db)
    inv = await repo.get_by_vendor_and_id(vendor_id, invoice_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Vendor invoice not found")
    if inv.status == "paid":
        raise HTTPException(status_code=400, detail="Cannot cancel a paid invoice")

    inv.status = "cancelled"
    inv.audit_log = (inv.audit_log or []) + [{
        "action": "cancelled",
        "by": str(vendor_user.id),
        "at": datetime.now(timezone.utc).isoformat(),
    }]
    await db.commit()
    inv = await repo.get_by_vendor_and_id(vendor_id, inv.id)
    return JSONResponse(content=_invoice_to_dict(inv))


# ── Record payment ─────────────────────────────────────────────────

from pydantic import BaseModel as _BM
from decimal import Decimal as _D


class RecordPaymentRequest(_BM):
    amount: float                  # payment amount (must be > 0)
    payment_date: str              # ISO date string YYYY-MM-DD
    payment_reference: str | None = None   # cheque/UTR/NEFT reference
    payment_mode: str | None = None        # cash / bank_transfer / cheque / upi


@router.post("/vendor-invoices/{invoice_id}/record-payment")
async def record_invoice_payment(
    invoice_id: UUID,
    data: RecordPaymentRequest,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vendor_user: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = Depends(require_permission("procurement.invoice.verify")),
):
    """
    Record a full or partial payment against a vendor invoice.

    Each payment creates its own VendorInvoicePayment row.  That row's UUID is
    used as source_id for the GL journal entry, so each partial payment gets a
    separate Dr-AP / Cr-Bank entry that is individually reversible without
    voiding earlier payment entries.
    """
    from datetime import date as _date
    repo = VendorInvoiceRepository(db)
    inv = await repo.get_by_vendor_and_id(vendor_id, invoice_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Vendor invoice not found")
    if inv.status in ("cancelled", "paid"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot record payment on a {inv.status} invoice",
        )
    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Payment amount must be positive")

    amount = _D(str(data.amount))

    # Guard: don't allow overpayment
    current_due = _D(str(inv.amount_due or inv.total or 0))
    if amount > current_due + _D("0.01"):
        raise HTTPException(
            status_code=400,
            detail=f"Payment amount ({amount}) exceeds amount due ({current_due})",
        )

    # Parse payment date
    try:
        pay_date = _date.fromisoformat(data.payment_date)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid payment_date — must be YYYY-MM-DD")

    now = datetime.now(timezone.utc)
    narration = (
        f"Payment against {inv.invoice_number or inv.id}"
        + (f" — {data.payment_reference}" if data.payment_reference else "")
    )

    # ── Create payment ledger row ──────────────────────────────────
    payment = VendorInvoicePayment(
        vendor_id=vendor_id,
        invoice_id=inv.id,
        supplier_id=inv.supplier_id,
        amount=amount,
        payment_date=pay_date,
        payment_mode=data.payment_mode,
        payment_reference=data.payment_reference,
        created_by=vendor_user.id,
        notes=narration,
    )
    db.add(payment)
    await db.flush()  # assigns payment.id before GL posting

    # ── Update invoice running totals ──────────────────────────────
    inv.amount_paid = (_D(str(inv.amount_paid or 0)) + amount).quantize(_D("0.01"))
    inv.amount_due = max(_D("0"), (_D(str(inv.total or 0)) - _D(str(inv.amount_paid)))).quantize(_D("0.01"))
    if inv.amount_due == _D("0"):
        inv.status = "paid"

    inv.audit_log = (inv.audit_log or []) + [{
        "action": "payment_recorded",
        "payment_id": str(payment.id),
        "amount": str(amount),
        "date": data.payment_date,
        "reference": data.payment_reference,
        "mode": data.payment_mode,
        "by": str(vendor_user.id),
        "at": now.isoformat(),
    }]

    # ── GL: Dr AP / Cr Bank — one entry per payment row ───────────
    # source_id = payment.id (NOT inv.id) so each partial payment is
    # a distinct idempotent entry and does not void earlier ones.
    gl_payload = {
        "amount": float(amount),
        "supplier_id": str(inv.supplier_id) if inv.supplier_id else None,
        "narration": narration,
    }
    try:
        je = await post_event(
            db, vendor_id, "vendor_payment", payment.id, gl_payload,
            created_by_id=vendor_user.id,
        )
        if je is not None:
            payment.journal_entry_id = je.id
            inv.audit_log = inv.audit_log + [{
                "action": "gl_posted",
                "payment_id": str(payment.id),
                "journal_entry_id": str(je.id),
                "at": now.isoformat(),
            }]
    except Exception:
        log.exception(
            "GL posting failed for payment %s on invoice %s — payment recorded without journal entry",
            payment.id, inv.id,
        )

    await db.commit()
    inv = await repo.get_by_vendor_and_id(vendor_id, inv.id)
    return JSONResponse(content=_invoice_to_dict(inv))


# ── Invoice approval workflow ─────────────────────────────────────

import uuid as _uuid_mod


class InvoiceApprovalCreate(_BM):
    approver_ids: list[str] = []   # ordered list of vendor_user IDs; may be empty to use pre-assigned
    approver_message: str | None = None


class InvoiceApproveRejectRequest(_BM):
    action: str                    # approve | reject
    comments: str | None = None


@router.post("/vendor-invoices/{invoice_id}/request-approval")
async def request_invoice_approval(
    invoice_id: UUID,
    data: InvoiceApprovalCreate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vendor_user: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = Depends(require_permission("procurement.manage")),
):
    """
    Submit a vendor invoice for approval.

    Resolution order mirrors the PO path:
      1. Try the approver matrix (dimensions from the invoice header).
      2. If matrix matched + lock_chain=True, reject manually supplied ids.
      3. If matrix matched + lock_chain=False, append supplied ids above chain.
      4. If no matrix match, fall back to supplied / pre-assigned ids.
      5. Legacy per-document threshold still applies as safety net.
    """
    from app.services.procurement_approver_matrix import resolve_approvers as _resolve
    from decimal import Decimal as _D

    repo = VendorInvoiceRepository(db)
    inv = await repo.get_by_vendor_and_id(vendor_id, invoice_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Vendor invoice not found")
    if inv.status != "draft":
        raise HTTPException(status_code=400, detail="Only draft invoices can be submitted for approval")
    if inv.approval_status == "pending":
        raise HTTPException(status_code=400, detail="Invoice is already pending approval")
    if inv.approval_status == "approved":
        raise HTTPException(status_code=400, detail="Invoice has already been approved")

    if data.approver_message is not None:
        inv.approver_message = data.approver_message

    inv_total = _D(str(inv.total or 0))

    # ── Wipe existing steps ──────────────────────────────────────────
    existing = await db.execute(
        select(VendorInvoiceApproval).where(VendorInvoiceApproval.invoice_id == invoice_id)
    )
    for step in existing.scalars().all():
        await db.delete(step)
    await db.flush()

    # ── Try approver matrix ──────────────────────────────────────────
    chain = await _resolve(
        db,
        vendor_id       = vendor_id,
        doc_type        = "INVOICE",
        company_id      = inv.company_id,
        branch_id       = inv.branch_id,
        plant_id        = inv.plant_id,
        amount          = inv_total,
        creator_vendor_user_id = vendor_user.id,
    )

    next_level = 1
    if chain.matched:
        if chain.lock_chain and data.approver_ids:
            raise HTTPException(
                status_code=400,
                detail="The approver matrix rule for this invoice is locked — manual overrides are not allowed.",
            )
        for step in chain.steps:
            db.add(VendorInvoiceApproval(
                id             = _uuid_mod.uuid4(),
                invoice_id     = invoice_id,
                level          = step.level,
                approver_id    = step.approver_id,
                source_rule_id = step.source_rule_id,
                status         = "pending",
            ))
        next_level = (chain.steps[-1].level + 1) if chain.steps else 1
        await db.flush()

    # ── Append manual overrides ──────────────────────────────────────
    for i, approver_id_str in enumerate(data.approver_ids or []):
        db.add(VendorInvoiceApproval(
            id          = _uuid_mod.uuid4(),
            invoice_id  = invoice_id,
            level       = next_level + i,
            approver_id = UUID(approver_id_str),
            status      = "pending",
        ))
    await db.flush()

    pending_result = await db.execute(
        select(VendorInvoiceApproval).where(
            VendorInvoiceApproval.invoice_id == invoice_id,
            VendorInvoiceApproval.status == "pending",
        )
    )
    has_pending_approvers = bool(pending_result.scalars().all())

    # ── Legacy per-document threshold safety net ─────────────────────
    approval_required_above = float(inv.approval_required_above or 0)
    if approval_required_above and float(inv_total) > approval_required_above and not has_pending_approvers:
        raise HTTPException(
            status_code=400,
            detail=(
                f"This invoice total exceeds the approval threshold of ₹{approval_required_above:,.2f}. "
                f"Please assign an approver before submitting."
            ),
        )

    now = datetime.now(timezone.utc)
    if not has_pending_approvers:
        inv.approval_status = "not_required"
        inv.audit_log = (inv.audit_log or []) + [{
            "action": "approval_skipped", "by": str(vendor_user.id),
            "reason": "no_approvers_assigned", "at": now.isoformat(),
        }]
    else:
        inv.approval_status = "pending"
        inv.audit_log = (inv.audit_log or []) + [{
            "action": "approval_requested", "by": str(vendor_user.id),
            "matrix_matched": chain.matched, "lock_chain": chain.lock_chain,
            "at": now.isoformat(),
        }]

    await db.commit()
    inv = await repo.get_by_vendor_and_id(vendor_id, inv.id)
    return JSONResponse(content=_invoice_to_dict(inv))


@router.post("/vendor-invoices/{invoice_id}/approve")
async def approve_or_reject_invoice(
    invoice_id: UUID,
    data: InvoiceApproveRejectRequest,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vendor_user: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = Depends(require_permission("procurement.invoice.approve")),
):
    """Approve or reject the current pending approval step on a vendor invoice."""
    if data.action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="action must be 'approve' or 'reject'")

    result = await db.execute(
        select(VendorInvoice).where(VendorInvoice.vendor_id == vendor_id, VendorInvoice.id == invoice_id)
    )
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Vendor invoice not found")
    if inv.approval_status != "pending":
        raise HTTPException(status_code=400, detail=f"Invoice is not pending approval (status: {inv.approval_status})")

    steps_result = await db.execute(
        select(VendorInvoiceApproval)
        .where(
            VendorInvoiceApproval.invoice_id == invoice_id,
            VendorInvoiceApproval.status == "pending",
        )
        .order_by(VendorInvoiceApproval.level)
    )
    pending_steps = steps_result.scalars().all()
    if not pending_steps:
        raise HTTPException(status_code=400, detail="No pending approval steps")

    current_step = pending_steps[0]
    if current_step.approver_id and current_step.approver_id != vendor_user.id:
        raise HTTPException(status_code=403, detail="You are not the designated approver for this step")

    now = datetime.now(timezone.utc)
    current_step.status = data.action + "d"   # approved / rejected
    current_step.comments = data.comments
    current_step.actioned_at = now

    if data.action == "reject":
        inv.approval_status = "rejected"
        inv.audit_log = (inv.audit_log or []) + [{
            "action": "approval_rejected", "by": str(vendor_user.id),
            "level": current_step.level, "comments": data.comments, "at": now.isoformat(),
        }]
    else:
        remaining = [s for s in pending_steps if s.id != current_step.id]
        if not remaining:
            inv.approval_status = "approved"
            inv.approved_by = vendor_user.id
            inv.approved_at = now
            inv.audit_log = (inv.audit_log or []) + [{
                "action": "approval_approved", "by": str(vendor_user.id),
                "level": current_step.level, "at": now.isoformat(),
            }]
        else:
            inv.audit_log = (inv.audit_log or []) + [{
                "action": "approval_step_approved", "by": str(vendor_user.id),
                "level": current_step.level, "next_level": remaining[0].level, "at": now.isoformat(),
            }]

    await db.commit()
    repo = VendorInvoiceRepository(db)
    inv = await repo.get_by_vendor_and_id(vendor_id, inv.id)
    return JSONResponse(content=_invoice_to_dict(inv))


# ── List payments for an invoice ──────────────────────────────────

@router.get("/vendor-invoices/{invoice_id}/payments")
async def list_invoice_payments(
    invoice_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = VendorInvoiceRepository(db)
    inv = await repo.get_by_vendor_and_id(vendor_id, invoice_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Vendor invoice not found")
    payments = inv.payments or []
    return JSONResponse(content={
        "invoice_id": str(invoice_id),
        "invoice_number": inv.invoice_number,
        "total": float(inv.total or 0),
        "amount_paid": float(inv.amount_paid or 0),
        "amount_due": float(inv.amount_due or 0),
        "payments": [_payment_to_dict(p) for p in payments],
    })
