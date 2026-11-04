"""
Reconciliation between operational documents and the general ledger.

Finds documents that exist (and are not draft/cancelled) but have no live journal
entry â€” because posting failed, accounts were missing, or the document pre-dates the
GL wiring â€” and re-posts them.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy import exists, select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.finance import (
    FinBankAccount, FinJournalEntry, FinPostingFailure, FinVendorBill, FinVendorPayment,
)
from app.models.invoice import Invoice
from app.models.pos import POSTransaction

DOC_TYPES = ("invoice", "vendor_bill", "vendor_payment")


def _live_je(vendor_col, source_types: tuple[str, ...], source_id_col):
    return exists().where(
        FinJournalEntry.vendor_id == vendor_col,
        FinJournalEntry.source_type.in_(source_types),
        FinJournalEntry.source_id == source_id_col,
        FinJournalEntry.status == "posted",
        FinJournalEntry.reverses_id.is_(None),
        FinJournalEntry.reversed_by_id.is_(None),
    )


async def _open_failures(db, vendor_id) -> dict:
    rows = (await db.execute(select(FinPostingFailure).where(
        FinPostingFailure.vendor_id == vendor_id, FinPostingFailure.status == "open",
    ))).scalars().all()
    return {(r.source_type, r.source_id): r.error for r in rows}


async def find_unposted(
    db: AsyncSession, vendor_id: UUID, *, from_date: Optional[date] = None,
    to_date: Optional[date] = None, limit: int = 500,
) -> dict:
    """Return documents lacking a live journal entry, grouped by type."""
    failures = await _open_failures(db, vendor_id)
    out: dict[str, list[dict]] = {"invoice": [], "vendor_bill": [], "vendor_payment": []}

    # Sales invoices / credit notes (POS invoices are covered by the POS session posting)
    pos_invoice_ids = select(POSTransaction.invoice_id).where(
        POSTransaction.vendor_id == vendor_id, POSTransaction.invoice_id.isnot(None))
    q = select(Invoice).where(
        Invoice.vendor_id == vendor_id,
        Invoice.status.notin_(("draft", "cancelled")),
        Invoice.invoice_type != "estimate",
        Invoice.id.notin_(pos_invoice_ids),
        ~_live_je(Invoice.vendor_id, ("invoice", "credit_note"), Invoice.id),
    )
    if from_date:
        q = q.where(Invoice.invoice_date >= from_date)
    if to_date:
        q = q.where(Invoice.invoice_date <= to_date)
    for inv in (await db.execute(q.order_by(Invoice.created_at).limit(limit))).scalars().all():
        st = "credit_note" if inv.invoice_type == "credit_note" else "invoice"
        out["invoice"].append({
            "id": str(inv.id), "number": inv.invoice_number, "date": str(inv.invoice_date or ""),
            "amount": float(inv.total or 0), "status": inv.status,
            "reason": failures.get((st, inv.id)) or "Never posted to the ledger",
        })

    # Vendor bills
    q = select(FinVendorBill).where(
        FinVendorBill.vendor_id == vendor_id,
        FinVendorBill.status.notin_(("draft", "void", "cancelled")),
        ~_live_je(FinVendorBill.vendor_id, ("vendor_bill",), FinVendorBill.id),
    )
    if from_date:
        q = q.where(FinVendorBill.bill_date >= from_date)
    if to_date:
        q = q.where(FinVendorBill.bill_date <= to_date)
    for b in (await db.execute(q.order_by(FinVendorBill.created_at).limit(limit))).scalars().all():
        out["vendor_bill"].append({
            "id": str(b.id), "number": b.bill_no, "date": str(b.bill_date or ""),
            "amount": float(b.total or 0), "status": b.status,
            "reason": failures.get(("vendor_bill", b.id)) or "Never posted to the ledger",
        })

    # Vendor payments
    q = select(FinVendorPayment).where(
        FinVendorPayment.vendor_id == vendor_id,
        FinVendorPayment.status.notin_(("void", "cancelled", "draft")),
        ~_live_je(FinVendorPayment.vendor_id, ("vendor_payment",), FinVendorPayment.id),
    )
    if from_date:
        q = q.where(FinVendorPayment.payment_date >= from_date)
    if to_date:
        q = q.where(FinVendorPayment.payment_date <= to_date)
    for p in (await db.execute(q.order_by(FinVendorPayment.created_at).limit(limit))).scalars().all():
        out["vendor_payment"].append({
            "id": str(p.id), "number": p.reference_no or str(p.id)[:8], "date": str(p.payment_date or ""),
            "amount": float(p.amount or 0), "status": p.status,
            "reason": failures.get(("vendor_payment", p.id)) or "Never posted to the ledger",
        })

    out["total"] = sum(len(v) for v in out.values() if isinstance(v, list))
    return out


async def repost_document(db: AsyncSession, vendor_id: UUID, doc_type: str, doc_id: UUID,
                          created_by_id: Optional[UUID] = None) -> dict:
    """Re-post one document. Returns {posted: bool, journal_entry_id?, error?}."""
    from app.services.finance.safe_posting import safe_post

    if doc_type == "invoice":
        from app.services.invoice_service import _try_post_invoice, _try_post_payment
        inv = (await db.execute(select(Invoice).where(
            Invoice.id == doc_id, Invoice.vendor_id == vendor_id))).scalar_one_or_none()
        if inv is None:
            raise ValueError("Invoice not found")
        if inv.status in ("draft", "cancelled") or inv.invoice_type == "estimate":
            raise ValueError("Draft, cancelled and estimate documents are not posted to the ledger.")
        je = await _try_post_invoice(db, vendor_id, inv)
        if je is not None and Decimal(str(inv.amount_paid or 0)) > 0:
            await _try_post_payment(db, vendor_id, inv, Decimal(str(inv.amount_paid)))
    elif doc_type == "vendor_bill":
        b = (await db.execute(select(FinVendorBill).where(
            FinVendorBill.id == doc_id, FinVendorBill.vendor_id == vendor_id))).scalar_one_or_none()
        if b is None:
            raise ValueError("Vendor bill not found")
        je = await safe_post(db, vendor_id, "vendor_bill", b.id, {
            "subtotal": Decimal(str(b.subtotal or 0)), "tax_amount": Decimal(str(b.tax_amount or 0)),
            "total": Decimal(str(b.total or 0)), "supplier_id": b.supplier_id,
            "entry_date": b.bill_date, "narration": f"Vendor Bill {b.bill_no}",
        }, created_by_id=created_by_id)
        if je is not None:
            b.journal_entry_id = je.id
    elif doc_type == "vendor_payment":
        p = (await db.execute(select(FinVendorPayment).where(
            FinVendorPayment.id == doc_id, FinVendorPayment.vendor_id == vendor_id))).scalar_one_or_none()
        if p is None:
            raise ValueError("Vendor payment not found")
        bank_gl_id = None
        if p.bank_account_id:
            ba = (await db.execute(select(FinBankAccount).where(
                FinBankAccount.id == p.bank_account_id,
                FinBankAccount.vendor_id == vendor_id))).scalar_one_or_none()
            bank_gl_id = ba.gl_account_id if ba else None
        je = await safe_post(db, vendor_id, "vendor_payment", p.id, {
            "amount": Decimal(str(p.amount or 0)), "supplier_id": p.supplier_id,
            "bank_account_gl_id": bank_gl_id, "entry_date": p.payment_date,
            "narration": f"Vendor Payment {p.reference_no or ''}".strip(),
        }, created_by_id=created_by_id)
        if je is not None:
            p.journal_entry_id = je.id
    else:
        raise ValueError(f"Unsupported document type '{doc_type}'. Use one of {DOC_TYPES}.")

    if je is None:
        row = (await db.execute(select(FinPostingFailure).where(
            FinPostingFailure.vendor_id == vendor_id, FinPostingFailure.source_id == doc_id,
        ))).scalars().first()
        return {"posted": False, "error": row.error if row else "Posting failed"}
    return {"posted": True, "journal_entry_id": str(je.id)}
