# app/api/v1/vendor_procurement_rfq.py
"""
RFQ (Phase 3) + Supplier Quotation (Phase 4) API

Routes (all under /vendors/me/procurement):
  RFQ
    GET/POST  /rfqs
    GET/PUT   /rfqs/{rfq_id}
    POST      /rfqs/{rfq_id}/issue
    POST      /rfqs/{rfq_id}/close-bids
    POST      /rfqs/{rfq_id}/cancel
    POST      /rfqs/{rfq_id}/suppliers          – add suppliers to RFQ
    PUT       /rfqs/{rfq_id}/suppliers/{s_id}   – update invite status

  Supplier Quotations
    GET/POST  /quotations
    GET/PUT   /quotations/{sq_id}
    POST      /quotations/{sq_id}/submit
    POST      /quotations/{sq_id}/review
    POST      /quotations/{sq_id}/accept
    POST      /quotations/{sq_id}/reject
"""
from __future__ import annotations

import math
import secrets
from datetime import datetime, timezone, date
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.api.deps import get_current_vendor_id, get_current_vendor_user, require_permission
from app.models.vendor_user import VendorUser
from app.models.procurement_rfq import RequestForQuotation, RequestForQuotationItem, RFQSupplier
from app.models.procurement_quotation import SupplierQuotation, SupplierQuotationItem
from app.models.procurement import Supplier
from app.models.procurement_supplier import SupplierOnboarding
from app.schemas.procurement_rfq import (
    RFQCreate, RFQUpdate, AddSuppliersRequest, RFQSupplierStatusUpdate, CloseRFQRequest,
    SupplierQuotationCreate, SupplierQuotationUpdate, AcceptRejectQuotationRequest,
)
from app.utils.procurement_utils import next_doc_number, append_audit_log, guard_transition

router = APIRouter(dependencies=[Depends(require_permission("procurement.view"))])
_MANAGE = Depends(require_permission("procurement.manage"))


# ─────────────────────────────────────────────────────────────────
# Serialisers
# ─────────────────────────────────────────────────────────────────

def _rfq_item_to_dict(i: RequestForQuotationItem) -> dict:
    return {
        "id": str(i.id),
        "rfq_id": str(i.rfq_id),
        "pr_item_id": str(i.pr_item_id) if i.pr_item_id else None,
        "line_number": i.line_number,
        "item_type": i.item_type,
        "product_id": str(i.product_id) if i.product_id else None,
        "product_name": i.product.name if i.product else None,
        "service_id": str(i.service_id) if i.service_id else None,
        "service_name": i.service.name if i.service else None,
        "variant_id": str(i.variant_id) if i.variant_id else None,
        "description": i.description,
        "quantity": float(i.quantity),
        "unit_of_measure": i.unit_of_measure,
        "target_price": float(i.target_price) if i.target_price else None,
        "currency": i.currency,
        "needed_by_date": i.needed_by_date.isoformat() if i.needed_by_date else None,
        "technical_specs": i.technical_specs,
        "notes": i.notes,
    }


def _rfq_supplier_to_dict(rs: RFQSupplier) -> dict:
    return {
        "id": str(rs.id),
        "rfq_id": str(rs.rfq_id),
        "supplier_id": str(rs.supplier_id),
        "supplier_name": rs.supplier.name if rs.supplier else None,
        "invite_status": rs.invite_status,
        "invited_at": rs.invited_at.isoformat() if rs.invited_at else None,
        "acknowledged_at": rs.acknowledged_at.isoformat() if rs.acknowledged_at else None,
        "decline_reason": rs.decline_reason,
    }


def _rfq_to_dict(rfq: RequestForQuotation, include_items: bool = True, include_suppliers: bool = True) -> dict:
    d: dict = {
        "id": str(rfq.id),
        "vendor_id": str(rfq.vendor_id),
        "rfq_number": rfq.rfq_number,
        "title": rfq.title,
        "status": rfq.status,
        "sourcing_type": rfq.sourcing_type,
        "requisition_id": str(rfq.requisition_id) if rfq.requisition_id else None,
        "department": rfq.department,
        "bid_submission_deadline": rfq.bid_submission_deadline.isoformat() if rfq.bid_submission_deadline else None,
        "delivery_required_by": rfq.delivery_required_by.isoformat() if rfq.delivery_required_by else None,
        "valid_until": rfq.valid_until.isoformat() if rfq.valid_until else None,
        "currency": rfq.currency,
        "payment_terms": rfq.payment_terms,
        "delivery_terms": rfq.delivery_terms,
        "instructions_to_suppliers": rfq.instructions_to_suppliers,
        "internal_notes": rfq.internal_notes,
        "awarded_at": rfq.awarded_at.isoformat() if rfq.awarded_at else None,
        "audit_log": rfq.audit_log or [],
        "created_at": rfq.created_at.isoformat() if rfq.created_at else None,
        "updated_at": rfq.updated_at.isoformat() if rfq.updated_at else None,
    }
    if include_items:
        d["items"] = [_rfq_item_to_dict(i) for i in (rfq.items or [])]
    if include_suppliers:
        d["suppliers"] = [_rfq_supplier_to_dict(s) for s in (rfq.suppliers or [])]
    return d


def _sq_item_to_dict(i: SupplierQuotationItem) -> dict:
    def _f(v): return float(v) if v is not None else 0
    return {
        "id": str(i.id),
        "quotation_id": str(i.quotation_id),
        "rfq_item_id": str(i.rfq_item_id) if i.rfq_item_id else None,
        "line_number": i.line_number,
        "item_type": i.item_type,
        "product_id": str(i.product_id) if i.product_id else None,
        "product_name": i.product.name if i.product else None,
        "variant_id": str(i.variant_id) if i.variant_id else None,
        "description": i.description,
        "quantity": _f(i.quantity),
        "unit_of_measure": i.unit_of_measure,
        "min_order_quantity": _f(i.min_order_quantity) if i.min_order_quantity else None,
        "unit_price": _f(i.unit_price),
        "discount_pct": _f(i.discount_pct),
        "net_unit_price": _f(i.net_unit_price),
        "hsn_code": i.hsn_code,
        "cgst_rate": _f(i.cgst_rate),
        "sgst_rate": _f(i.sgst_rate),
        "igst_rate": _f(i.igst_rate),
        "cgst_amount": _f(i.cgst_amount),
        "sgst_amount": _f(i.sgst_amount),
        "igst_amount": _f(i.igst_amount),
        "subtotal": _f(i.subtotal),
        "tax_total": _f(i.tax_total),
        "total": _f(i.total),
        "lead_time_days": i.lead_time_days,
        "delivery_date": i.delivery_date.isoformat() if i.delivery_date else None,
        "notes": i.notes,
    }


def _sq_to_dict(sq: SupplierQuotation) -> dict:
    def _f(v): return float(v) if v is not None else 0
    return {
        "id": str(sq.id),
        "vendor_id": str(sq.vendor_id),
        "supplier_id": str(sq.supplier_id),
        "supplier_name": sq.supplier.name if sq.supplier else None,
        "rfq_id": str(sq.rfq_id) if sq.rfq_id else None,
        "quotation_number": sq.quotation_number,
        "supplier_reference": sq.supplier_reference,
        "status": sq.status,
        "quote_type": sq.quote_type,
        "source": sq.source,
        "quote_date": sq.quote_date.isoformat() if sq.quote_date else None,
        "valid_until": sq.valid_until.isoformat() if sq.valid_until else None,
        "currency": sq.currency,
        "exchange_rate": float(sq.exchange_rate),
        "subtotal": _f(sq.subtotal),
        "tax_amount": _f(sq.tax_amount),
        "freight_amount": _f(sq.freight_amount),
        "other_charges": _f(sq.other_charges),
        "total": _f(sq.total),
        "cgst_amount": _f(sq.cgst_amount),
        "sgst_amount": _f(sq.sgst_amount),
        "igst_amount": _f(sq.igst_amount),
        "payment_terms": sq.payment_terms,
        "delivery_terms": sq.delivery_terms,
        "delivery_lead_time_days": sq.delivery_lead_time_days,
        "notes": sq.notes,
        "audit_log": sq.audit_log or [],
        "created_at": sq.created_at.isoformat() if sq.created_at else None,
        "updated_at": sq.updated_at.isoformat() if sq.updated_at else None,
        "items": [_sq_item_to_dict(i) for i in (sq.items or [])],
    }


# ─────────────────────────────────────────────────────────────────
# Line calculation helper
# ─────────────────────────────────────────────────────────────────

def _compute_sq_line(data, item: SupplierQuotationItem) -> None:
    qty = Decimal(str(data.quantity))
    price = Decimal(str(data.unit_price))
    disc_pct = Decimal(str(data.discount_pct or 0)) / 100
    disc_amt = price * disc_pct
    net_price = price - disc_amt
    subtotal = qty * net_price

    cgst = Decimal(str(data.cgst_rate or 0)) / 100
    sgst = Decimal(str(data.sgst_rate or 0)) / 100
    igst = Decimal(str(data.igst_rate or 0)) / 100

    cgst_amt = subtotal * cgst
    sgst_amt = subtotal * sgst
    igst_amt = subtotal * igst
    tax_total = cgst_amt + sgst_amt + igst_amt

    item.unit_price = price
    item.discount_pct = data.discount_pct or 0
    item.discount_amount = disc_amt * qty
    item.net_unit_price = net_price
    item.subtotal = subtotal
    item.cgst_rate = data.cgst_rate or 0
    item.sgst_rate = data.sgst_rate or 0
    item.igst_rate = data.igst_rate or 0
    item.cgst_amount = cgst_amt
    item.sgst_amount = sgst_amt
    item.igst_amount = igst_amt
    item.tax_total = tax_total
    item.total = subtotal + tax_total


# ─────────────────────────────────────────────────────────────────
# Helper
# ─────────────────────────────────────────────────────────────────

async def _get_rfq_or_404(db: AsyncSession, vendor_id: UUID, rfq_id: UUID) -> RequestForQuotation:
    result = await db.execute(
        select(RequestForQuotation)
        .where(RequestForQuotation.vendor_id == vendor_id, RequestForQuotation.id == rfq_id)
    )
    rfq = result.scalar_one_or_none()
    if not rfq:
        raise HTTPException(status_code=404, detail="RFQ not found")
    return rfq


async def _get_sq_or_404(db: AsyncSession, vendor_id: UUID, sq_id: UUID) -> SupplierQuotation:
    result = await db.execute(
        select(SupplierQuotation)
        .where(SupplierQuotation.vendor_id == vendor_id, SupplierQuotation.id == sq_id)
    )
    sq = result.scalar_one_or_none()
    if not sq:
        raise HTTPException(status_code=404, detail="Supplier quotation not found")
    return sq


# ═══════════════════════════════════════════════════════════════════
#  RFQ ENDPOINTS
# ═══════════════════════════════════════════════════════════════════

@router.get("/rfqs")
async def list_rfqs(
    status: Optional[str] = Query(None),
    sourcing_type: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(RequestForQuotation).where(RequestForQuotation.vendor_id == vendor_id)
    if status:
        stmt = stmt.where(RequestForQuotation.status == status)
    if sourcing_type:
        stmt = stmt.where(RequestForQuotation.sourcing_type == sourcing_type)

    count_result = await db.execute(stmt.with_only_columns(
        *[RequestForQuotation.id]
    ).order_by(None))
    total = len(count_result.all())

    stmt = stmt.order_by(RequestForQuotation.created_at.desc()).offset((page - 1) * size).limit(size)
    result = await db.execute(stmt)
    rfqs = result.scalars().all()
    return JSONResponse(content={
        "items": [_rfq_to_dict(r, include_items=False, include_suppliers=False) for r in rfqs],
        "total": total,
        "page": page,
        "size": size,
        "pages": math.ceil(total / size) if total > 0 else 0,
    })


@router.post("/rfqs", status_code=201)
async def create_rfq(
    data: RFQCreate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vendor_user: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = _MANAGE,
):
    rfq_number = await next_doc_number(db, vendor_id, "RFQ", width=6)

    rfq = RequestForQuotation(
        vendor_id=vendor_id,
        rfq_number=rfq_number,
        title=data.title,
        sourcing_type=data.sourcing_type,
        requisition_id=UUID(data.requisition_id) if data.requisition_id else None,
        store_id=UUID(data.store_id) if data.store_id else None,
        department=data.department,
        bid_submission_deadline=data.bid_submission_deadline,
        delivery_required_by=data.delivery_required_by,
        valid_until=data.valid_until,
        currency=data.currency or "INR",
        payment_terms=data.payment_terms,
        delivery_terms=data.delivery_terms,
        instructions_to_suppliers=data.instructions_to_suppliers,
        internal_notes=data.internal_notes,
        created_by=vendor_user.id,
    )
    for i, item_data in enumerate(data.items, start=1):
        rfq.items.append(RequestForQuotationItem(
            line_number=i,
            item_type=item_data.item_type,
            product_id=UUID(item_data.product_id) if item_data.product_id else None,
            service_id=UUID(item_data.service_id) if item_data.service_id else None,
            variant_id=UUID(item_data.variant_id) if item_data.variant_id else None,
            pr_item_id=UUID(item_data.pr_item_id) if item_data.pr_item_id else None,
            description=item_data.description,
            quantity=item_data.quantity,
            unit_of_measure=item_data.unit_of_measure,
            target_price=item_data.target_price,
            needed_by_date=item_data.needed_by_date,
            technical_specs=item_data.technical_specs,
            notes=item_data.notes,
        ))
    for sup_id_str in data.supplier_ids:
        rfq.suppliers.append(RFQSupplier(
            supplier_id=UUID(sup_id_str),
            invite_status="invited",
        ))

    append_audit_log(rfq, "created", vendor_user.id)
    db.add(rfq)
    await db.commit()
    await db.refresh(rfq)

    result = await db.execute(select(RequestForQuotation).where(RequestForQuotation.id == rfq.id))
    rfq = result.scalar_one()
    return JSONResponse(content=_rfq_to_dict(rfq), status_code=201)


@router.get("/rfqs/{rfq_id}")
async def get_rfq(
    rfq_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    rfq = await _get_rfq_or_404(db, vendor_id, rfq_id)
    return JSONResponse(content=_rfq_to_dict(rfq))


@router.put("/rfqs/{rfq_id}")
async def update_rfq(
    rfq_id: UUID,
    data: RFQUpdate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vendor_user: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = _MANAGE,
):
    rfq = await _get_rfq_or_404(db, vendor_id, rfq_id)
    guard_transition(rfq.status, ("draft",), "update")

    for field in ["title", "bid_submission_deadline", "delivery_required_by", "valid_until",
                  "payment_terms", "delivery_terms", "instructions_to_suppliers", "internal_notes"]:
        val = getattr(data, field, None)
        if val is not None:
            setattr(rfq, field, val)

    if data.items is not None:
        for existing in list(rfq.items):
            await db.delete(existing)
        rfq.items.clear()
        for i, item_data in enumerate(data.items, start=1):
            rfq.items.append(RequestForQuotationItem(
                line_number=i,
                item_type=item_data.item_type,
                product_id=UUID(item_data.product_id) if item_data.product_id else None,
                service_id=UUID(item_data.service_id) if item_data.service_id else None,
                variant_id=UUID(item_data.variant_id) if item_data.variant_id else None,
                pr_item_id=UUID(item_data.pr_item_id) if item_data.pr_item_id else None,
                description=item_data.description,
                quantity=item_data.quantity,
                unit_of_measure=item_data.unit_of_measure,
                target_price=item_data.target_price,
                needed_by_date=item_data.needed_by_date,
                technical_specs=item_data.technical_specs,
                notes=item_data.notes,
            ))

    append_audit_log(rfq, "updated", vendor_user.id)
    await db.commit()
    result = await db.execute(select(RequestForQuotation).where(RequestForQuotation.id == rfq_id))
    rfq = result.scalar_one()
    return JSONResponse(content=_rfq_to_dict(rfq))


@router.post("/rfqs/{rfq_id}/issue")
async def issue_rfq(
    rfq_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vendor_user: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = _MANAGE,
):
    rfq = await _get_rfq_or_404(db, vendor_id, rfq_id)
    guard_transition(rfq.status, ("draft",), "issue")
    if not rfq.items:
        raise HTTPException(status_code=400, detail="Cannot issue an RFQ with no line items")
    if not rfq.suppliers:
        raise HTTPException(status_code=400, detail="Cannot issue an RFQ with no suppliers invited")

    now = datetime.now(timezone.utc)
    rfq.status = "issued"
    # Set invited_at on all suppliers
    for rs in rfq.suppliers:
        if rs.invite_status == "invited" and not rs.invited_at:
            rs.invited_at = now
            # Generate access token for self-service portal
            rs.access_token = secrets.token_urlsafe(32)
    append_audit_log(rfq, "issued", vendor_user.id)
    await db.commit()
    result = await db.execute(select(RequestForQuotation).where(RequestForQuotation.id == rfq_id))
    rfq = result.scalar_one()
    return JSONResponse(content=_rfq_to_dict(rfq))


@router.post("/rfqs/{rfq_id}/close-bids")
async def close_rfq_bids(
    rfq_id: UUID,
    data: CloseRFQRequest,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vendor_user: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = _MANAGE,
):
    rfq = await _get_rfq_or_404(db, vendor_id, rfq_id)
    guard_transition(rfq.status, ("issued",), "close-bids")
    rfq.status = "bids_closed"
    append_audit_log(rfq, "bids_closed", vendor_user.id, reason=data.reason)
    await db.commit()
    result = await db.execute(select(RequestForQuotation).where(RequestForQuotation.id == rfq_id))
    return JSONResponse(content=_rfq_to_dict(result.scalar_one()))


@router.post("/rfqs/{rfq_id}/cancel")
async def cancel_rfq(
    rfq_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vendor_user: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = _MANAGE,
):
    rfq = await _get_rfq_or_404(db, vendor_id, rfq_id)
    guard_transition(rfq.status, ("draft", "issued"), "cancel")
    rfq.status = "cancelled"
    append_audit_log(rfq, "cancelled", vendor_user.id)
    await db.commit()
    result = await db.execute(select(RequestForQuotation).where(RequestForQuotation.id == rfq_id))
    return JSONResponse(content=_rfq_to_dict(result.scalar_one()))


@router.post("/rfqs/{rfq_id}/suppliers")
async def add_rfq_suppliers(
    rfq_id: UUID,
    data: AddSuppliersRequest,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vendor_user: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = _MANAGE,
):
    rfq = await _get_rfq_or_404(db, vendor_id, rfq_id)
    guard_transition(rfq.status, ("draft", "issued"), "add suppliers")

    existing_ids = {str(s.supplier_id) for s in rfq.suppliers}
    added = []
    now = datetime.now(timezone.utc) if rfq.status == "issued" else None

    for sid_str in data.supplier_ids:
        if sid_str not in existing_ids:
            # Validate supplier is active and not blacklisted
            sup_res = await db.execute(
                select(Supplier).where(Supplier.id == UUID(sid_str), Supplier.vendor_id == vendor_id)
            )
            sup = sup_res.scalar_one_or_none()
            if not sup:
                raise HTTPException(status_code=404, detail=f"Supplier {sid_str} not found")
            if not sup.is_active:
                raise HTTPException(status_code=400, detail=f"Supplier '{sup.name}' is inactive and cannot be invited to an RFQ")
            ob_res = await db.execute(
                select(SupplierOnboarding).where(
                    SupplierOnboarding.supplier_id == UUID(sid_str),
                    SupplierOnboarding.vendor_id == vendor_id,
                )
            )
            ob = ob_res.scalar_one_or_none()
            if ob and ob.status == "blacklisted":
                raise HTTPException(status_code=400, detail=f"Supplier '{sup.name}' is blacklisted and cannot be invited to an RFQ")

            rs = RFQSupplier(
                rfq_id=rfq_id,
                supplier_id=UUID(sid_str),
                invite_status="invited",
                invited_at=now,
                access_token=secrets.token_urlsafe(32) if rfq.status == "issued" else None,
            )
            db.add(rs)
            added.append(sid_str)

    await db.commit()
    result = await db.execute(select(RequestForQuotation).where(RequestForQuotation.id == rfq_id))
    rfq = result.scalar_one()
    return JSONResponse(content=_rfq_to_dict(rfq))


@router.put("/rfqs/{rfq_id}/suppliers/{rfq_supplier_id}")
async def update_rfq_supplier_status(
    rfq_id: UUID,
    rfq_supplier_id: UUID,
    data: RFQSupplierStatusUpdate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vendor_user: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = _MANAGE,
):
    await _get_rfq_or_404(db, vendor_id, rfq_id)
    result = await db.execute(
        select(RFQSupplier).where(RFQSupplier.id == rfq_supplier_id, RFQSupplier.rfq_id == rfq_id)
    )
    rs = result.scalar_one_or_none()
    if not rs:
        raise HTTPException(status_code=404, detail="RFQ supplier not found")

    rs.invite_status = data.invite_status
    if data.invite_status == "acknowledged":
        rs.acknowledged_at = datetime.now(timezone.utc)
    if data.decline_reason:
        rs.decline_reason = data.decline_reason
    await db.commit()
    await db.refresh(rs)
    return JSONResponse(content=_rfq_supplier_to_dict(rs))


# ═══════════════════════════════════════════════════════════════════
#  SUPPLIER QUOTATION ENDPOINTS
# ═══════════════════════════════════════════════════════════════════

@router.get("/quotations")
async def list_quotations(
    rfq_id: Optional[str] = Query(None),
    supplier_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(SupplierQuotation).where(SupplierQuotation.vendor_id == vendor_id)
    if rfq_id:
        stmt = stmt.where(SupplierQuotation.rfq_id == UUID(rfq_id))
    if supplier_id:
        stmt = stmt.where(SupplierQuotation.supplier_id == UUID(supplier_id))
    if status:
        stmt = stmt.where(SupplierQuotation.status == status)

    count_result = await db.execute(stmt.with_only_columns(*[SupplierQuotation.id]).order_by(None))
    total = len(count_result.all())

    stmt = stmt.order_by(SupplierQuotation.created_at.desc()).offset((page - 1) * size).limit(size)
    result = await db.execute(stmt)
    quotes = result.scalars().all()
    return JSONResponse(content={
        "items": [_sq_to_dict(sq) for sq in quotes],
        "total": total,
        "page": page,
        "size": size,
        "pages": math.ceil(total / size) if total > 0 else 0,
    })


@router.post("/quotations", status_code=201)
async def create_quotation(
    data: SupplierQuotationCreate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vendor_user: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = _MANAGE,
):
    sq_number = await next_doc_number(db, vendor_id, "SQ", width=6)

    sq = SupplierQuotation(
        vendor_id=vendor_id,
        supplier_id=UUID(data.supplier_id),
        rfq_id=UUID(data.rfq_id) if data.rfq_id else None,
        quotation_number=sq_number,
        supplier_reference=data.supplier_reference,
        quote_type=data.quote_type,
        source=data.source,
        quote_date=data.quote_date,
        valid_until=data.valid_until,
        currency=data.currency,
        exchange_rate=data.exchange_rate,
        freight_amount=data.freight_amount or 0,
        other_charges=data.other_charges or 0,
        payment_terms=data.payment_terms,
        delivery_terms=data.delivery_terms,
        delivery_lead_time_days=data.delivery_lead_time_days,
        notes=data.notes,
        terms_and_conditions=data.terms_and_conditions,
        submitted_by=vendor_user.id,
    )

    subtotal = Decimal(0)
    cgst_total = Decimal(0)
    sgst_total = Decimal(0)
    igst_total = Decimal(0)

    for i, item_data in enumerate(data.items, start=1):
        item = SupplierQuotationItem(
            line_number=i,
            item_type=item_data.item_type,
            product_id=UUID(item_data.product_id) if item_data.product_id else None,
            variant_id=UUID(item_data.variant_id) if item_data.variant_id else None,
            rfq_item_id=UUID(item_data.rfq_item_id) if item_data.rfq_item_id else None,
            description=item_data.description,
            quantity=item_data.quantity,
            unit_of_measure=item_data.unit_of_measure,
            min_order_quantity=item_data.min_order_quantity,
            hsn_code=item_data.hsn_code,
            tax_code=item_data.tax_code,
            lead_time_days=item_data.lead_time_days,
            delivery_date=item_data.delivery_date,
            notes=item_data.notes,
        )
        _compute_sq_line(item_data, item)
        sq.items.append(item)
        subtotal += item.subtotal
        cgst_total += item.cgst_amount
        sgst_total += item.sgst_amount
        igst_total += item.igst_amount

    sq.subtotal = subtotal
    sq.cgst_amount = cgst_total
    sq.sgst_amount = sgst_total
    sq.igst_amount = igst_total
    sq.tax_amount = cgst_total + sgst_total + igst_total
    sq.total = subtotal + sq.tax_amount + Decimal(str(sq.freight_amount or 0)) + Decimal(str(sq.other_charges or 0))

    append_audit_log(sq, "created", vendor_user.id)
    db.add(sq)
    await db.commit()
    result = await db.execute(select(SupplierQuotation).where(SupplierQuotation.id == sq.id))
    sq = result.scalar_one()
    return JSONResponse(content=_sq_to_dict(sq), status_code=201)


@router.get("/quotations/{sq_id}")
async def get_quotation(
    sq_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    sq = await _get_sq_or_404(db, vendor_id, sq_id)
    return JSONResponse(content=_sq_to_dict(sq))


@router.put("/quotations/{sq_id}")
async def update_quotation(
    sq_id: UUID,
    data: SupplierQuotationUpdate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vendor_user: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = _MANAGE,
):
    sq = await _get_sq_or_404(db, vendor_id, sq_id)
    guard_transition(sq.status, ("draft",), "update")

    for field in ["supplier_reference", "quote_date", "valid_until", "freight_amount",
                  "other_charges", "payment_terms", "delivery_terms", "delivery_lead_time_days", "notes"]:
        val = getattr(data, field, None)
        if val is not None:
            setattr(sq, field, val)

    if data.items is not None:
        for existing in list(sq.items):
            await db.delete(existing)
        sq.items.clear()
        subtotal = Decimal(0)
        cgst_total = Decimal(0)
        sgst_total = Decimal(0)
        igst_total = Decimal(0)
        for i, item_data in enumerate(data.items, start=1):
            item = SupplierQuotationItem(
                line_number=i,
                item_type=item_data.item_type,
                product_id=UUID(item_data.product_id) if item_data.product_id else None,
                rfq_item_id=UUID(item_data.rfq_item_id) if item_data.rfq_item_id else None,
                description=item_data.description,
                quantity=item_data.quantity,
                unit_of_measure=item_data.unit_of_measure,
                min_order_quantity=item_data.min_order_quantity,
                hsn_code=item_data.hsn_code,
                lead_time_days=item_data.lead_time_days,
                notes=item_data.notes,
            )
            _compute_sq_line(item_data, item)
            sq.items.append(item)
            subtotal += item.subtotal
            cgst_total += item.cgst_amount
            sgst_total += item.sgst_amount
            igst_total += item.igst_amount

        sq.subtotal = subtotal
        sq.cgst_amount = cgst_total
        sq.sgst_amount = sgst_total
        sq.igst_amount = igst_total
        sq.tax_amount = cgst_total + sgst_total + igst_total
        sq.total = subtotal + sq.tax_amount + Decimal(str(sq.freight_amount or 0)) + Decimal(str(sq.other_charges or 0))

    append_audit_log(sq, "updated", vendor_user.id)
    await db.commit()
    result = await db.execute(select(SupplierQuotation).where(SupplierQuotation.id == sq_id))
    return JSONResponse(content=_sq_to_dict(result.scalar_one()))


@router.post("/quotations/{sq_id}/submit")
async def submit_quotation(
    sq_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vendor_user: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = _MANAGE,
):
    sq = await _get_sq_or_404(db, vendor_id, sq_id)
    guard_transition(sq.status, ("draft",), "submit")
    sq.status = "submitted"
    sq.submitted_by = vendor_user.id
    append_audit_log(sq, "submitted", vendor_user.id)
    await db.commit()
    result = await db.execute(select(SupplierQuotation).where(SupplierQuotation.id == sq_id))
    return JSONResponse(content=_sq_to_dict(result.scalar_one()))


@router.post("/quotations/{sq_id}/accept")
async def accept_quotation(
    sq_id: UUID,
    data: AcceptRejectQuotationRequest,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vendor_user: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = _MANAGE,
):
    sq = await _get_sq_or_404(db, vendor_id, sq_id)
    guard_transition(sq.status, ("submitted", "under_review"), "accept")
    sq.status = "accepted"
    sq.reviewed_by = vendor_user.id
    append_audit_log(sq, "accepted", vendor_user.id, notes=data.notes)
    await db.commit()
    result = await db.execute(select(SupplierQuotation).where(SupplierQuotation.id == sq_id))
    return JSONResponse(content=_sq_to_dict(result.scalar_one()))


@router.post("/quotations/{sq_id}/reject")
async def reject_quotation(
    sq_id: UUID,
    data: AcceptRejectQuotationRequest,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vendor_user: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = _MANAGE,
):
    sq = await _get_sq_or_404(db, vendor_id, sq_id)
    guard_transition(sq.status, ("submitted", "under_review"), "reject")
    sq.status = "rejected"
    sq.reviewed_by = vendor_user.id
    append_audit_log(sq, "rejected", vendor_user.id, notes=data.notes)
    await db.commit()
    result = await db.execute(select(SupplierQuotation).where(SupplierQuotation.id == sq_id))
    return JSONResponse(content=_sq_to_dict(result.scalar_one()))


# ═══════════════════════════════════════════════════════════════════
#  PHASE 5 — QUOTATION COMPARISON + AWARD
# ═══════════════════════════════════════════════════════════════════

@router.get("/rfqs/{rfq_id}/comparison")
async def rfq_quotation_comparison(
    rfq_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Side-by-side comparison of all submitted/accepted supplier quotes for an RFQ.

    Returns:
      rfq_items    – line items from the RFQ (the requirement)
      quotes       – submitted/accepted quotes for this RFQ
      matrix       – [{rfq_item_id, line_number, description, ...},
                      quote_lines: [{quotation_id, supplier_name, unit_price, ...}, ...]]
      summary      – per-supplier totals sorted by total ascending (lowest-price first)
    """
    rfq = await _get_rfq_or_404(db, vendor_id, rfq_id)

    # Fetch all non-draft quotes for this RFQ
    result = await db.execute(
        select(SupplierQuotation).where(
            SupplierQuotation.rfq_id == rfq_id,
            SupplierQuotation.vendor_id == vendor_id,
            SupplierQuotation.status.in_(["submitted", "under_review", "accepted"]),
        )
    )
    quotes = result.scalars().all()

    # Build an index: rfq_item_id → {quotation_id: sq_item}
    rfq_item_map: dict[str, dict] = {}
    for sq in quotes:
        for sq_item in (sq.items or []):
            key = str(sq_item.rfq_item_id) if sq_item.rfq_item_id else f"_no_rfq_item_{sq.id}_{sq_item.id}"
            if key not in rfq_item_map:
                rfq_item_map[key] = {}
            rfq_item_map[key][str(sq.id)] = sq_item

    # Build comparison matrix keyed by RFQ line
    matrix = []
    for rfq_item in sorted(rfq.items or [], key=lambda x: x.line_number):
        key = str(rfq_item.id)
        quote_lines = []
        for sq in quotes:
            sq_item = rfq_item_map.get(key, {}).get(str(sq.id))
            if sq_item:
                quote_lines.append({
                    "quotation_id": str(sq.id),
                    "quotation_number": sq.quotation_number,
                    "supplier_id": str(sq.supplier_id),
                    "supplier_name": sq.supplier.name if sq.supplier else None,
                    "unit_price": float(sq_item.unit_price),
                    "net_unit_price": float(sq_item.net_unit_price),
                    "quantity": float(sq_item.quantity),
                    "total": float(sq_item.total),
                    "lead_time_days": sq_item.lead_time_days,
                    "min_order_quantity": float(sq_item.min_order_quantity) if sq_item.min_order_quantity else None,
                    "status": sq.status,
                })
            else:
                quote_lines.append({
                    "quotation_id": str(sq.id),
                    "quotation_number": sq.quotation_number,
                    "supplier_id": str(sq.supplier_id),
                    "supplier_name": sq.supplier.name if sq.supplier else None,
                    "unit_price": None,
                    "net_unit_price": None,
                    "quantity": None,
                    "total": None,
                    "lead_time_days": None,
                    "min_order_quantity": None,
                    "status": sq.status,
                })
        # Mark the lowest-price quote for this line
        priced = [ql for ql in quote_lines if ql["net_unit_price"] is not None]
        if priced:
            min_price = min(ql["net_unit_price"] for ql in priced)
            for ql in priced:
                ql["is_lowest_price"] = ql["net_unit_price"] == min_price
        matrix.append({
            "rfq_item_id": str(rfq_item.id),
            "line_number": rfq_item.line_number,
            "product_id": str(rfq_item.product_id) if rfq_item.product_id else None,
            "product_name": rfq_item.product.name if rfq_item.product else None,
            "description": rfq_item.description,
            "quantity": float(rfq_item.quantity),
            "unit_of_measure": rfq_item.unit_of_measure,
            "target_price": float(rfq_item.target_price) if rfq_item.target_price else None,
            "quote_lines": quote_lines,
        })

    # Per-supplier summary
    summary = sorted(
        [
            {
                "quotation_id": str(sq.id),
                "quotation_number": sq.quotation_number,
                "supplier_id": str(sq.supplier_id),
                "supplier_name": sq.supplier.name if sq.supplier else None,
                "status": sq.status,
                "currency": sq.currency,
                "subtotal": float(sq.subtotal),
                "tax_amount": float(sq.tax_amount),
                "freight_amount": float(sq.freight_amount),
                "total": float(sq.total),
                "delivery_lead_time_days": sq.delivery_lead_time_days,
                "payment_terms": sq.payment_terms,
                "valid_until": sq.valid_until.isoformat() if sq.valid_until else None,
            }
            for sq in quotes
        ],
        key=lambda x: x["total"],
    )

    return JSONResponse(content={
        "rfq_id": str(rfq_id),
        "rfq_number": rfq.rfq_number,
        "rfq_status": rfq.status,
        "currency": rfq.currency,
        "matrix": matrix,
        "summary": summary,
        "total_quotes": len(quotes),
    })


class AwardRFQRequest(BaseModel):
    awarded_quotation_ids: list[str]
    notes: Optional[str] = None


@router.post("/rfqs/{rfq_id}/award")
async def award_rfq(
    rfq_id: UUID,
    data: AwardRFQRequest,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vendor_user: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = _MANAGE,
):
    """
    Award the RFQ to one or more supplier quotations.

    Accepts a list of quotation IDs (for split-award scenarios).
    Awards the listed quotes → status = "accepted".
    All remaining submitted quotes → status = "rejected".
    RFQ status → "awarded".
    """
    rfq = await _get_rfq_or_404(db, vendor_id, rfq_id)
    guard_transition(rfq.status, ("bids_closed",), "award")

    if not data.awarded_quotation_ids:
        raise HTTPException(status_code=400, detail="At least one quotation_id required")

    # Validate that all provided IDs belong to this RFQ
    result = await db.execute(
        select(SupplierQuotation).where(
            SupplierQuotation.vendor_id == vendor_id,
            SupplierQuotation.rfq_id == rfq_id,
        )
    )
    all_sq = result.scalars().all()
    sq_by_id = {str(sq.id): sq for sq in all_sq}

    for sq_id_str in data.awarded_quotation_ids:
        if sq_id_str not in sq_by_id:
            raise HTTPException(status_code=400, detail=f"Quotation {sq_id_str} not found for this RFQ")

    now = datetime.now(timezone.utc)
    for sq in all_sq:
        if str(sq.id) in data.awarded_quotation_ids:
            sq.status = "accepted"
            sq.reviewed_by = vendor_user.id
            append_audit_log(sq, "awarded", vendor_user.id, notes=data.notes)
        elif sq.status in ("submitted", "under_review"):
            sq.status = "rejected"
            append_audit_log(sq, "rejected_on_award", vendor_user.id)

    rfq.status = "awarded"
    rfq.awarded_at = now
    rfq.awarded_by = vendor_user.id
    append_audit_log(rfq, "awarded", vendor_user.id,
                     awarded_quotes=data.awarded_quotation_ids,
                     notes=data.notes)

    await db.commit()
    result = await db.execute(select(RequestForQuotation).where(RequestForQuotation.id == rfq_id))
    rfq = result.scalar_one()
    return JSONResponse(content=_rfq_to_dict(rfq))
