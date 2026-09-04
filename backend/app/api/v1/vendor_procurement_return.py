# app/api/v1/vendor_procurement_return.py
"""
Purchase Return (PRET) endpoints — Phase 9.

Workflow:
  POST   /purchase-returns                     create draft
  GET    /purchase-returns                     list
  GET    /purchase-returns/{id}                detail
  PUT    /purchase-returns/{id}                update draft
  POST   /purchase-returns/{id}/approve        approve (permission: procurement.manage)
  POST   /purchase-returns/{id}/dispatch       mark goods dispatched
  POST   /purchase-returns/{id}/confirm        supplier confirms receipt
  POST   /purchase-returns/{id}/close          close the return
  POST   /purchase-returns/{id}/cancel         cancel draft
  DELETE /purchase-returns/{id}                delete draft
"""
from __future__ import annotations

import uuid as _uuid_module
from datetime import datetime, timezone, date
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import logging as _logging

from app.api.deps import get_current_vendor_id, require_permission
from app.api.deps import get_current_vendor_user
from app.database import get_db
from app.models.procurement_return import PurchaseReturn, PurchaseReturnLine
from app.models.procurement import PurchaseOrder
from app.models.procurement_grn import GoodsReceiptNote, GRNLine
from app.models.plant import Plant
from app.models.storage_location import StorageLocation
from app.models.vendor_product import Product
from app.services.inventory_service import InventoryService
from app.services.store_inventory_service import apply_store_inventory_delta, sync_product_quantity_from_stores
from app.services.store_resolver import get_default_store_id
from app.utils.procurement_utils import (
    append_audit_log,
    guard_transition,
    next_doc_number,
)
from app.services.finance.posting import post_event
from app.models.vendor_user import VendorUser

_log = _logging.getLogger(__name__)

router = APIRouter(
    dependencies=[Depends(require_permission("procurement.view"))],
    tags=["Procurement – Purchase Returns"],
)


# ── Pydantic schemas ──────────────────────────────────────────────

class ReturnLineIn(BaseModel):
    po_item_id: str
    product_id: str
    variant_id: Optional[str] = None
    grn_line_id: Optional[str] = None
    batch_number: Optional[str] = None
    serial_number: Optional[str] = None
    line_number: int = 1
    unit_of_measure: str = "piece"
    return_qty: Decimal
    unit_price: Decimal
    cgst_rate: Decimal = Decimal("0")
    sgst_rate: Decimal = Decimal("0")
    igst_rate: Decimal = Decimal("0")
    plant_id: Optional[str] = None
    storage_location_id: Optional[str] = None
    reason: Optional[str] = None


class PurchaseReturnCreate(BaseModel):
    purchase_order_id: str
    grn_id: Optional[str] = None
    return_date: date
    return_reason: str = "quality_rejection"
    currency: str = "INR"
    notes: Optional[str] = None
    lines: List[ReturnLineIn]


class PurchaseReturnUpdate(BaseModel):
    return_date: Optional[date] = None
    return_reason: Optional[str] = None
    currency: Optional[str] = None
    supplier_return_authorization: Optional[str] = None
    debit_note_reference: Optional[str] = None
    dispatched_via: Optional[str] = None
    dispatch_date: Optional[date] = None
    tracking_number: Optional[str] = None
    notes: Optional[str] = None
    lines: Optional[List[ReturnLineIn]] = None


class DispatchRequest(BaseModel):
    dispatched_via: Optional[str] = None
    dispatch_date: Optional[date] = None
    tracking_number: Optional[str] = None


# ── helpers ───────────────────────────────────────────────────────

def _compute_line_totals(line: PurchaseReturnLine) -> None:
    subtotal = Decimal(str(line.return_qty)) * Decimal(str(line.unit_price))
    cgst = subtotal * Decimal(str(line.cgst_rate)) / 100
    sgst = subtotal * Decimal(str(line.sgst_rate)) / 100
    igst = subtotal * Decimal(str(line.igst_rate)) / 100
    line.subtotal = subtotal
    line.cgst_amount = cgst
    line.sgst_amount = sgst
    line.igst_amount = igst
    line.tax_total = cgst + sgst + igst
    line.total = subtotal + line.tax_total


def _compute_return_totals(ret: PurchaseReturn) -> None:
    ret.subtotal = sum(Decimal(str(l.subtotal)) for l in ret.lines)
    ret.tax_amount = sum(Decimal(str(l.tax_total)) for l in ret.lines)
    ret.total = ret.subtotal + ret.tax_amount


def _line_to_dict(l: PurchaseReturnLine) -> dict:
    product_name = None
    if getattr(l, "product", None) is not None:
        product_name = getattr(l.product, "name", None)
    return {
        "id": str(l.id),
        "po_item_id": str(l.po_item_id),
        "product_id": str(l.product_id),
        "variant_id": str(l.variant_id) if l.variant_id else None,
        "grn_line_id": str(l.grn_line_id) if l.grn_line_id else None,
        "product_name": product_name,
        "batch_number": l.batch_number,
        "serial_number": l.serial_number,
        "line_number": l.line_number,
        "unit_of_measure": l.unit_of_measure,
        "return_qty": str(l.return_qty),
        "unit_price": str(l.unit_price),
        "cgst_rate": str(l.cgst_rate),
        "sgst_rate": str(l.sgst_rate),
        "igst_rate": str(l.igst_rate),
        "cgst_amount": str(l.cgst_amount),
        "sgst_amount": str(l.sgst_amount),
        "igst_amount": str(l.igst_amount),
        "subtotal": str(l.subtotal),
        "tax_amount": str(l.tax_total),
        "tax_total": str(l.tax_total),
        "total": str(l.total),
        "plant_id": str(l.plant_id) if l.plant_id else None,
        "storage_location_id": str(l.storage_location_id) if l.storage_location_id else None,
        "reason": l.reason,
    }


def _return_to_dict(ret: PurchaseReturn) -> dict:
    supplier_name = ret.supplier.name if ret.supplier else None
    return {
        "id": str(ret.id),
        "vendor_id": str(ret.vendor_id),
        "return_number": ret.return_number,
        "status": ret.status,
        "purchase_order_id": str(ret.purchase_order_id),
        "grn_id": str(ret.grn_id) if ret.grn_id else None,
        "supplier_id": str(ret.supplier_id),
        "supplier_name": supplier_name,
        "return_date": ret.return_date.isoformat() if ret.return_date else None,
        "return_reason": ret.return_reason,
        "supplier_return_authorization": ret.supplier_return_authorization,
        "debit_note_reference": ret.debit_note_reference,
        "currency": ret.currency,
        "subtotal": str(ret.subtotal),
        "tax_amount": str(ret.tax_amount),
        "total": str(ret.total),
        "journal_entry_id": str(ret.journal_entry_id) if ret.journal_entry_id else None,
        "dispatched_via": ret.dispatched_via,
        "dispatch_date": ret.dispatch_date.isoformat() if ret.dispatch_date else None,
        "tracking_number": ret.tracking_number,
        "notes": ret.notes,
        "approved_by": str(ret.approved_by) if ret.approved_by else None,
        "approved_at": ret.approved_at.isoformat() if ret.approved_at else None,
        "created_by": str(ret.created_by) if ret.created_by else None,
        "created_at": ret.created_at.isoformat() if ret.created_at else None,
        "updated_at": ret.updated_at.isoformat() if ret.updated_at else None,
        "audit_log": ret.audit_log or [],
        "supplier": {
            "id": str(ret.supplier.id),
            "name": ret.supplier.name,
        } if ret.supplier else None,
        "lines": [_line_to_dict(l) for l in (ret.lines or [])],
    }


async def _resolve_store_for_return_line(
    db: AsyncSession,
    vendor_id: UUID,
    line: PurchaseReturnLine,
) -> UUID | None:
    """Resolve the business-unit store_id for a return line.

    Priority:
      1. line.storage_location_id → StorageLocation.store_id
      2. line.plant_id → Plant.store_id
      3. vendor's default store
    """
    if line.storage_location_id:
        row = await db.execute(
            select(StorageLocation.store_id).where(StorageLocation.id == line.storage_location_id)
        )
        store_id = row.scalars().first()
        if store_id:
            return store_id
    if line.plant_id:
        row = await db.execute(
            select(Plant.store_id).where(Plant.id == line.plant_id)
        )
        store_id = row.scalars().first()
        if store_id:
            return store_id
    return await get_default_store_id(db, vendor_id)


async def _get_return_or_404(db: AsyncSession, vendor_id: UUID, ret_id: UUID) -> PurchaseReturn:
    result = await db.execute(
        select(PurchaseReturn).where(
            PurchaseReturn.vendor_id == vendor_id,
            PurchaseReturn.id == ret_id,
        )
    )
    ret = result.scalar_one_or_none()
    if not ret:
        raise HTTPException(status_code=404, detail="Purchase return not found")
    return ret


# ── Endpoints ─────────────────────────────────────────────────────

@router.post("/purchase-returns")
async def create_purchase_return(
    data: PurchaseReturnCreate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vendor_user: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = Depends(require_permission("procurement.manage")),
):
    if not data.lines:
        raise HTTPException(status_code=400, detail="At least one return line required")

    po_id = UUID(data.purchase_order_id)
    po_result = await db.execute(
        select(PurchaseOrder).where(PurchaseOrder.vendor_id == vendor_id, PurchaseOrder.id == po_id)
    )
    po = po_result.scalar_one_or_none()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    return_number = await next_doc_number(db, vendor_id, "PRET")

    ret = PurchaseReturn(
        id=_uuid_module.uuid4(),
        vendor_id=vendor_id,
        return_number=return_number,
        status="draft",
        purchase_order_id=po_id,
        grn_id=UUID(data.grn_id) if data.grn_id else None,
        supplier_id=po.supplier_id,
        return_date=data.return_date,
        return_reason=data.return_reason,
        currency=data.currency,
        notes=data.notes,
        created_by=vendor_user.id,
        audit_log=[],
    )

    for ld in data.lines:
        line = PurchaseReturnLine(
            id=_uuid_module.uuid4(),
            purchase_return_id=ret.id,
            po_item_id=UUID(ld.po_item_id),
            product_id=UUID(ld.product_id),
            variant_id=UUID(ld.variant_id) if ld.variant_id else None,
            grn_line_id=UUID(ld.grn_line_id) if ld.grn_line_id else None,
            batch_number=ld.batch_number,
            serial_number=ld.serial_number,
            line_number=ld.line_number,
            unit_of_measure=ld.unit_of_measure,
            return_qty=ld.return_qty,
            unit_price=ld.unit_price,
            cgst_rate=ld.cgst_rate,
            sgst_rate=ld.sgst_rate,
            igst_rate=ld.igst_rate,
            plant_id=UUID(ld.plant_id) if ld.plant_id else None,
            storage_location_id=UUID(ld.storage_location_id) if ld.storage_location_id else None,
            reason=ld.reason,
        )
        _compute_line_totals(line)
        ret.lines.append(line)

    _compute_return_totals(ret)
    append_audit_log(ret, "created", vendor_user.id)

    db.add(ret)
    await db.commit()
    await db.refresh(ret)
    return JSONResponse(status_code=201, content=_return_to_dict(ret))


@router.get("/purchase-returns")
async def list_purchase_returns(
    status: Optional[str] = Query(None),
    supplier_id: Optional[str] = Query(None),
    po_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    limit: Optional[int] = Query(None, ge=1, le=200),
    offset: Optional[int] = Query(None, ge=0),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """List purchase returns. Accepts page/size (preferred) or limit/offset."""
    base = [PurchaseReturn.vendor_id == vendor_id]
    if status:
        base.append(PurchaseReturn.status == status)
    if supplier_id:
        base.append(PurchaseReturn.supplier_id == UUID(supplier_id))
    if po_id:
        base.append(PurchaseReturn.purchase_order_id == UUID(po_id))

    count_result = await db.execute(select(PurchaseReturn.id).where(*base))
    total = len(count_result.all())

    page_size = limit if limit is not None else size
    page_offset = offset if offset is not None else (page - 1) * page_size
    q = (
        select(PurchaseReturn)
        .where(*base)
        .order_by(PurchaseReturn.created_at.desc())
        .offset(page_offset)
        .limit(page_size)
    )
    result = await db.execute(q)
    items = result.scalars().all()
    pages = (total + page_size - 1) // page_size if total > 0 else 0
    return JSONResponse(content={
        "items": [_return_to_dict(r) for r in items],
        "total": total,
        "page": (page_offset // page_size) + 1 if page_size else 1,
        "size": page_size,
        "pages": pages,
    })


@router.get("/purchase-returns/{ret_id}")
async def get_purchase_return(
    ret_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    ret = await _get_return_or_404(db, vendor_id, ret_id)
    return JSONResponse(content=_return_to_dict(ret))


@router.put("/purchase-returns/{ret_id}")
async def update_purchase_return(
    ret_id: UUID,
    data: PurchaseReturnUpdate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vendor_user: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = Depends(require_permission("procurement.manage")),
):
    ret = await _get_return_or_404(db, vendor_id, ret_id)
    guard_transition(ret.status, ("draft",), "update")

    if data.return_date is not None:
        ret.return_date = data.return_date
    if data.return_reason is not None:
        ret.return_reason = data.return_reason
    if data.currency is not None:
        ret.currency = data.currency
    if data.supplier_return_authorization is not None:
        ret.supplier_return_authorization = data.supplier_return_authorization
    if data.debit_note_reference is not None:
        ret.debit_note_reference = data.debit_note_reference
    if data.dispatched_via is not None:
        ret.dispatched_via = data.dispatched_via
    if data.dispatch_date is not None:
        ret.dispatch_date = data.dispatch_date
    if data.tracking_number is not None:
        ret.tracking_number = data.tracking_number
    if data.notes is not None:
        ret.notes = data.notes

    if data.lines is not None:
        for existing_line in list(ret.lines):
            await db.delete(existing_line)
        ret.lines = []
        for ld in data.lines:
            line = PurchaseReturnLine(
                id=_uuid_module.uuid4(),
                purchase_return_id=ret.id,
                po_item_id=UUID(ld.po_item_id),
                product_id=UUID(ld.product_id),
                variant_id=UUID(ld.variant_id) if ld.variant_id else None,
                grn_line_id=UUID(ld.grn_line_id) if ld.grn_line_id else None,
                batch_number=ld.batch_number,
                serial_number=ld.serial_number,
                line_number=ld.line_number,
                unit_of_measure=ld.unit_of_measure,
                return_qty=ld.return_qty,
                unit_price=ld.unit_price,
                cgst_rate=ld.cgst_rate,
                sgst_rate=ld.sgst_rate,
                igst_rate=ld.igst_rate,
                plant_id=UUID(ld.plant_id) if ld.plant_id else None,
                storage_location_id=UUID(ld.storage_location_id) if ld.storage_location_id else None,
                reason=ld.reason,
            )
            _compute_line_totals(line)
            ret.lines.append(line)
        _compute_return_totals(ret)

    append_audit_log(ret, "updated", vendor_user.id)
    await db.commit()
    await db.refresh(ret)
    return JSONResponse(content=_return_to_dict(ret))


@router.post("/purchase-returns/{ret_id}/approve")
async def approve_purchase_return(
    ret_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vendor_user: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = Depends(require_permission("procurement.manage")),
):
    ret = await _get_return_or_404(db, vendor_id, ret_id)
    guard_transition(ret.status, ("draft",), "approve")

    ret.status = "approved"
    ret.approved_by = vendor_user.id
    ret.approved_at = datetime.now(timezone.utc)
    append_audit_log(ret, "approved", vendor_user.id)
    await db.commit()
    await db.refresh(ret)
    return JSONResponse(content=_return_to_dict(ret))


@router.post("/purchase-returns/{ret_id}/dispatch")
async def dispatch_purchase_return(
    ret_id: UUID,
    data: DispatchRequest,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vendor_user: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = Depends(require_permission("procurement.manage")),
):
    ret = await _get_return_or_404(db, vendor_id, ret_id)
    guard_transition(ret.status, ("approved",), "dispatch")

    if data.dispatched_via:
        ret.dispatched_via = data.dispatched_via
    if data.dispatch_date:
        ret.dispatch_date = data.dispatch_date
    if data.tracking_number:
        ret.tracking_number = data.tracking_number

    # Deduct stock for each return line as goods physically leave
    inv_svc = InventoryService(db)
    for line in (ret.lines or []):
        product = await db.get(Product, line.product_id)
        if not product or not product.track_inventory:
            continue
        qty_int = int(line.return_qty)
        if qty_int <= 0:
            continue

        store_id = await _resolve_store_for_return_line(db, vendor_id, line)
        sloc_id = line.storage_location_id

        if store_id:
            try:
                await apply_store_inventory_delta(
                    db, vendor_id, store_id,
                    line.product_id, line.variant_id,
                    -qty_int, sloc_id,
                )
            except ValueError as e:
                _log.warning(
                    "Purchase return %s line %s: StoreInventory delta failed (%s)",
                    ret.return_number, line.id, e,
                )

        movement = await inv_svc.record_movement_no_commit(
            vendor_id=vendor_id,
            product_id=line.product_id,
            movement_type="stock_out",
            quantity=-qty_int,
            performed_by=vendor_user.user_id if hasattr(vendor_user, "user_id") else None,
            variant_id=line.variant_id,
            reason=f"Return to supplier — {ret.return_number}",
            reference_type="purchase_return",
            reference_id=ret.id,
        )
        movement.store_id = store_id
        if sloc_id:
            movement.storage_location_id = sloc_id

        if store_id:
            await sync_product_quantity_from_stores(db, vendor_id, line.product_id, line.variant_id)

    ret.status = "goods_dispatched"
    append_audit_log(
        ret, "dispatched", vendor_user.id,
        via=data.dispatched_via,
        tracking=data.tracking_number,
    )
    await db.commit()
    await db.refresh(ret)
    return JSONResponse(content=_return_to_dict(ret))


@router.post("/purchase-returns/{ret_id}/confirm")
async def supplier_confirm_return(
    ret_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vendor_user: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = Depends(require_permission("procurement.manage")),
):
    ret = await _get_return_or_404(db, vendor_id, ret_id)
    guard_transition(ret.status, ("goods_dispatched",), "confirm")

    ret.status = "supplier_confirmed"
    append_audit_log(ret, "supplier_confirmed", vendor_user.id)
    await db.commit()
    await db.refresh(ret)
    return JSONResponse(content=_return_to_dict(ret))


@router.post("/purchase-returns/{ret_id}/close")
async def close_purchase_return(
    ret_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vendor_user: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = Depends(require_permission("procurement.manage")),
):
    ret = await _get_return_or_404(db, vendor_id, ret_id)
    guard_transition(ret.status, ("supplier_confirmed",), "close")

    ret.status = "closed"
    append_audit_log(ret, "closed", vendor_user.id)
    await db.flush()

    # Post debit note to GL — mirrors the vendor_bill pattern in invoice posting.
    # Event type "vendor_debit_note" so the finance posting handler can create the
    # corresponding AP reversal journal entry.
    gl_payload = {
        "subtotal": float(ret.subtotal or 0),
        "tax_amount": float(ret.tax_amount or 0),
        "total": float(ret.total or 0),
        "supplier_id": str(ret.supplier_id),
        "narration": f"Debit Note — Purchase Return {ret.return_number}",
        "return_reason": ret.return_reason,
    }
    try:
        je = await post_event(
            db, vendor_id, "vendor_debit_note", ret.id, gl_payload,
            created_by_id=vendor_user.id,
        )
        if je is not None:
            ret.journal_entry_id = je.id
    except Exception:
        _log.exception(
            "GL posting failed for purchase return %s — return closed without debit note journal entry",
            ret.id,
        )

    await db.commit()
    await db.refresh(ret)
    return JSONResponse(content=_return_to_dict(ret))


@router.post("/purchase-returns/{ret_id}/cancel")
async def cancel_purchase_return(
    ret_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vendor_user: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = Depends(require_permission("procurement.manage")),
):
    ret = await _get_return_or_404(db, vendor_id, ret_id)
    guard_transition(ret.status, ("draft", "approved"), "cancel")

    ret.status = "cancelled"
    append_audit_log(ret, "cancelled", vendor_user.id)
    await db.commit()
    await db.refresh(ret)
    return JSONResponse(content=_return_to_dict(ret))


@router.delete("/purchase-returns/{ret_id}", status_code=204)
async def delete_purchase_return(
    ret_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = Depends(require_permission("procurement.manage")),
):
    ret = await _get_return_or_404(db, vendor_id, ret_id)
    guard_transition(ret.status, ("draft",), "delete")
    await db.delete(ret)
    await db.commit()
