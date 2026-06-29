# app/api/v1/vendor_procurement_invoice.py
import math
from uuid import UUID
from typing import Optional
from datetime import datetime, timezone
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.api.deps import get_current_vendor_id, get_current_vendor_user
from app.models.vendor_user import VendorUser
from app.models.procurement_invoice import VendorInvoice, VendorInvoiceItem
from app.schemas.procurement_invoice import (
    VendorInvoiceCreate, VendorInvoiceUpdate, RunMatchRequest,
)
from app.repositories.procurement_invoice_repo import VendorInvoiceRepository

router = APIRouter()


# ── Serialiser ────────────────────────────────────────────────────

def _item_to_dict(i: VendorInvoiceItem) -> dict:
    def _f(v):
        return float(v) if v is not None else 0

    return {
        "id": str(i.id),
        "invoice_id": str(i.invoice_id),
        "po_item_id": str(i.po_item_id) if i.po_item_id else None,
        "product_id": str(i.product_id),
        "variant_id": str(i.variant_id) if i.variant_id else None,
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
        "notes": inv.notes,
        "created_at": inv.created_at.isoformat() if inv.created_at else None,
        "updated_at": inv.updated_at.isoformat() if inv.updated_at else None,
        "items": [_item_to_dict(i) for i in (inv.items or [])],
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
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = VendorInvoiceRepository(db)
    skip = (page - 1) * size
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

    for item_data in data.items:
        item_obj = VendorInvoiceItem(
            product_id=UUID(item_data.product_id),
            variant_id=UUID(item_data.variant_id) if item_data.variant_id else None,
            po_item_id=UUID(item_data.po_item_id) if item_data.po_item_id else None,
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
    db: AsyncSession = Depends(get_db),
):
    repo = VendorInvoiceRepository(db)
    inv = await repo.get_by_vendor_and_id(vendor_id, invoice_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Vendor invoice not found")
    if inv.status != "draft":
        raise HTTPException(status_code=400, detail="Only draft invoices can be posted")

    inv.status = "posted"
    inv.audit_log = (inv.audit_log or []) + [{"action": "posted", "at": datetime.now(timezone.utc).isoformat()}]
    await db.commit()
    inv = await repo.get_by_vendor_and_id(vendor_id, inv.id)
    return JSONResponse(content=_invoice_to_dict(inv))


# ── 3-way match ───────────────────────────────────────────────────

@router.post("/vendor-invoices/{invoice_id}/match")
async def run_three_way_match(
    invoice_id: UUID,
    data: RunMatchRequest,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
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
    db: AsyncSession = Depends(get_db),
):
    repo = VendorInvoiceRepository(db)
    inv = await repo.get_by_vendor_and_id(vendor_id, invoice_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Vendor invoice not found")
    if inv.status == "paid":
        raise HTTPException(status_code=400, detail="Cannot cancel a paid invoice")

    inv.status = "cancelled"
    inv.audit_log = (inv.audit_log or []) + [{"action": "cancelled", "at": datetime.now(timezone.utc).isoformat()}]
    await db.commit()
    inv = await repo.get_by_vendor_and_id(vendor_id, inv.id)
    return JSONResponse(content=_invoice_to_dict(inv))
