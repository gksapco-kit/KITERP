# app/api/v1/vendor_procurement_grn.py
"""
Goods Receipt Note (GRN) API — Phase 7

Routes (all under /vendors/me/procurement):
  GET/POST  /grns
  GET       /grns/{grn_id}
  POST      /grns/{grn_id}/post           – record as received, update inventory
  POST      /grns/{grn_id}/qc/{line_id}   – record QC result per line
  POST      /grns/{grn_id}/close-qc       – mark all QC done → qc_done
  POST      /grns/{grn_id}/close          – close the GRN
  POST      /grns/{grn_id}/reverse        – create a partial/full reversal

Permissions:
  read   → procurement.view (via router)
  write  → procurement.gr.post
"""
from __future__ import annotations

import logging
import math
from datetime import datetime, timezone, date
from decimal import Decimal
from typing import List, Optional, Tuple
from uuid import UUID

_log = logging.getLogger(__name__)

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.deps import get_current_vendor_id, get_current_vendor_user, require_permission
from app.models.vendor_user import VendorUser
from app.models.procurement import PurchaseOrder, PurchaseOrderItem
from app.models.procurement_grn import (
    GoodsReceiptNote, GRNLine, GRNQCInspection, GRNReversal, GRNReversalLine,
)
from app.models.vendor_product import Product
from app.models.plant import Plant
from app.models.storage_location import StorageLocation
from app.services.inventory_service import InventoryService
from app.services.store_inventory_service import apply_store_inventory_delta, sync_product_quantity_from_stores
from app.services.store_resolver import get_default_store_id
from app.utils.procurement_utils import next_doc_number, append_audit_log, guard_transition

router = APIRouter(dependencies=[Depends(require_permission("procurement.view"))])
_GR_POST = Depends(require_permission("procurement.gr.post"))


# ─────────────────────────────────────────────────────────────────
# Inventory helpers — shared by create, close-qc, and reversal
# ─────────────────────────────────────────────────────────────────

async def _resolve_store_for_grn_line(
    db: AsyncSession,
    vendor_id: UUID,
    grn: GoodsReceiptNote,
    line: GRNLine,
) -> UUID | None:
    """Resolve the business-unit store_id for a GRN line.

    Priority:
      1. line.storage_location_id → StorageLocation.store_id
      2. line.plant_id → Plant.store_id
      3. grn.storage_location_id → StorageLocation.store_id
      4. grn.plant_id → Plant.store_id
      5. vendor's default store
    """
    sloc_id = line.storage_location_id or grn.storage_location_id
    if sloc_id:
        row = await db.execute(
            select(StorageLocation.store_id).where(StorageLocation.id == sloc_id)
        )
        store_id = row.scalars().first()
        if store_id:
            return store_id

    plant_id = line.plant_id or grn.plant_id
    if plant_id:
        row = await db.execute(
            select(Plant.store_id).where(Plant.id == plant_id)
        )
        store_id = row.scalars().first()
        if store_id:
            return store_id

    return await get_default_store_id(db, vendor_id)


async def _post_grn_inventory(
    db: AsyncSession,
    vendor_id: UUID,
    grn: GoodsReceiptNote,
    line_qty_pairs: List[Tuple[GRNLine, Decimal]],
    performed_by_user_id: UUID,  # platform user.id — NOT VendorUser.id
    movement_type: str,
    sign: int,  # +1 for receipt, -1 for reversal
) -> None:
    """
    Write InventoryMovement records + update StoreInventory and Product/Variant.quantity
    and PurchaseOrderItem.quantity_received for each (GRNLine, qty) pair.
    Also recomputes the parent PO status.

    Quantities are passed explicitly as (line, qty) tuples — this function
    never mutates the source GRNLine records.

    Callers are responsible for commit — this only flushes.
    """
    inv_svc = InventoryService(db)

    for line, qty_dec in line_qty_pairs:
        if not line.product_id or qty_dec <= 0:
            continue

        # Check track_inventory before touching stock
        product_result = await db.execute(
            select(Product).where(Product.id == line.product_id, Product.vendor_id == vendor_id)
        )
        product = product_result.scalar_one_or_none()
        if not product or not product.track_inventory:
            continue

        # Inventory quantities are Integer columns; truncate toward zero.
        # Sub-unit fractional receipts are skipped with a warning.
        qty_int = int(qty_dec)
        if qty_int == 0:
            _log.warning(
                "GRN %s line %s: fractional qty %s < 1 integer unit — "
                "inventory movement skipped",
                grn.grn_number, line.id, qty_dec,
            )
            continue

        # Resolve the business unit this receipt lands in, then update StoreInventory
        store_id = await _resolve_store_for_grn_line(db, vendor_id, grn, line)
        sloc_id = line.storage_location_id or grn.storage_location_id

        if store_id:
            try:
                await apply_store_inventory_delta(
                    db, vendor_id, store_id,
                    line.product_id, line.variant_id,
                    qty_int * sign, sloc_id,
                )
            except ValueError as e:
                _log.warning(
                    "GRN %s line %s: StoreInventory delta failed (%s) — "
                    "InventoryMovement will still be written",
                    grn.grn_number, line.id, e,
                )

        movement = await inv_svc.record_movement_no_commit(
            vendor_id=vendor_id,
            product_id=line.product_id,
            movement_type=movement_type,
            quantity=qty_int * sign,
            performed_by=performed_by_user_id,
            variant_id=line.variant_id,
            reason=f"GRN {grn.grn_number}",
            reference_type="grn",
            reference_id=grn.id,
        )
        movement.store_id = store_id
        if sloc_id:
            movement.storage_location_id = sloc_id

        # Re-derive Product.quantity from the now-correct StoreInventory rows
        if store_id:
            await sync_product_quantity_from_stores(db, vendor_id, line.product_id, line.variant_id)

        # Warn when stock was clamped at zero (reversal reduced it to 0 or below)
        if sign == -1 and movement.quantity_after == 0 and abs(qty_int) > movement.quantity_before:
            _log.warning(
                "GRN reversal %s line %s: stock clamped at 0 "
                "(requested -%s, available %s)",
                grn.grn_number, line.id, qty_int, movement.quantity_before,
            )

        # Mirror PO line received qty
        po_item_result = await db.execute(
            select(PurchaseOrderItem).where(PurchaseOrderItem.id == line.po_item_id)
        )
        po_item = po_item_result.scalar_one_or_none()
        if po_item:
            po_item.quantity_received = max(
                Decimal(0),
                Decimal(str(po_item.quantity_received or 0)) + qty_dec * sign,
            )

        # Update MaterialValuation (MAP) + FIFO cost layers for product lines
        if product and line.product_id:
            unit_price = float(line.unit_price or 0) or (float(po_item.unit_cost) if po_item and po_item.unit_cost else 0)
            if unit_price > 0:
                from app.services.procurement_service import ProcurementService
                from app.services.fifo_cost_service import FifoCostService
                from app.services.cost_resolution import refresh_product_cost

                proc_svc = ProcurementService(db)
                await proc_svc._upsert_material_valuation(
                    vendor_id=vendor_id,
                    product_id=line.product_id,
                    variant_id=line.variant_id,
                    plant_id=line.storage_location_id and None,  # plant from GRN header if needed
                    qty_signed=float(qty_dec) * sign,
                    unit_cost=unit_price,
                )

                if sign == 1:
                    # Create FIFO layer for receipt
                    fifo = FifoCostService(db)
                    await fifo.create_layer(
                        vendor_id=vendor_id,
                        product_id=line.product_id,
                        unit_cost=unit_price,
                        quantity=float(qty_dec),
                        variant_id=line.variant_id,
                        movement_id=movement.id if movement else None,
                        source_type="grn",
                        auto_commit=False,
                    )

                await refresh_product_cost(db, vendor_id, line.product_id, line.variant_id)

    # Recompute PO status after all lines are processed
    po_result = await db.execute(
        select(PurchaseOrder).where(PurchaseOrder.id == grn.purchase_order_id)
    )
    po = po_result.scalar_one_or_none()
    if po:
        items_result = await db.execute(
            select(PurchaseOrderItem).where(PurchaseOrderItem.purchase_order_id == po.id)
        )
        po_items = items_result.scalars().all()
        if po_items:
            all_received = all(
                Decimal(str(it.quantity_received or 0)) >= Decimal(str(it.quantity_ordered or 0))
                for it in po_items
            )
            if all_received and po.status not in ("received", "closed", "cancelled"):
                po.status = "received"
                po.received_at = datetime.now(timezone.utc)
            elif not all_received and po.status in ("sent", "draft", "received", "partial_received"):
                # Covers reversals that un-receive a fully received PO
                if po.status == "received":
                    po.received_at = None
                po.status = "partial_received"

    await db.flush()


# ─────────────────────────────────────────────────────────────────
# Schemas
# ─────────────────────────────────────────────────────────────────

class GRNLineCreate(BaseModel):
    po_item_id: str
    product_id: str
    variant_id: Optional[str] = None
    batch_number: Optional[str] = None
    supplier_batch_number: Optional[str] = None
    manufacturing_date: Optional[date] = None
    expiry_date: Optional[date] = None
    received_qty: float
    unit_of_measure: str = "piece"
    unit_price: Optional[float] = None
    plant_id: Optional[str] = None
    storage_location_id: Optional[str] = None
    notes: Optional[str] = None


class GRNCreate(BaseModel):
    purchase_order_id: str
    posting_date: Optional[date] = None
    document_date: Optional[date] = None
    supplier_delivery_number: Optional[str] = None
    supplier_invoice_reference: Optional[str] = None
    plant_id: Optional[str] = None
    storage_location_id: Optional[str] = None
    requires_qc: bool = False
    notes: Optional[str] = None
    lines: List[GRNLineCreate]


class QCResultRequest(BaseModel):
    result: str   # passed | failed | partial_pass | hold
    accepted_qty: float
    rejected_qty: float = 0
    defect_code: Optional[str] = None
    defect_description: Optional[str] = None
    notes: Optional[str] = None


class GRNReversalLineCreate(BaseModel):
    grn_line_id: str
    reversed_qty: float
    reason: Optional[str] = None


class GRNReversalCreate(BaseModel):
    reversal_type: str = "partial"
    reversal_date: date
    reason: Optional[str] = None
    notes: Optional[str] = None
    lines: List[GRNReversalLineCreate]


# ─────────────────────────────────────────────────────────────────
# Serialisers
# ─────────────────────────────────────────────────────────────────

def _qc_to_dict(q: GRNQCInspection | None) -> dict | None:
    if not q:
        return None
    return {
        "id": str(q.id),
        "result": q.result,
        "inspected_qty": float(q.inspected_qty) if q.inspected_qty else None,
        "accepted_qty": float(q.accepted_qty) if q.accepted_qty else None,
        "rejected_qty": float(q.rejected_qty) if q.rejected_qty else None,
        "defect_code": q.defect_code,
        "defect_description": q.defect_description,
        "inspected_at": q.inspected_at.isoformat() if q.inspected_at else None,
        "notes": q.notes,
    }


def _line_to_dict(ln: GRNLine) -> dict:
    def _f(v): return float(v) if v is not None else None
    return {
        "id": str(ln.id),
        "grn_id": str(ln.grn_id),
        "po_item_id": str(ln.po_item_id),
        "product_id": str(ln.product_id),
        "product_name": ln.product.name if ln.product else None,
        "variant_id": str(ln.variant_id) if ln.variant_id else None,
        "batch_number": ln.batch_number,
        "supplier_batch_number": ln.supplier_batch_number,
        "manufacturing_date": ln.manufacturing_date.isoformat() if ln.manufacturing_date else None,
        "expiry_date": ln.expiry_date.isoformat() if ln.expiry_date else None,
        "line_number": ln.line_number,
        "unit_of_measure": ln.unit_of_measure,
        "ordered_qty": _f(ln.ordered_qty),
        "received_qty": _f(ln.received_qty),
        "accepted_qty": _f(ln.accepted_qty),
        "rejected_qty": _f(ln.rejected_qty),
        "pending_qc_qty": _f(ln.pending_qc_qty),
        "unit_price": _f(ln.unit_price),
        "plant_id": str(ln.plant_id) if ln.plant_id else None,
        "storage_location_id": str(ln.storage_location_id) if ln.storage_location_id else None,
        "qc_status": ln.qc_status,
        "qc_inspection": _qc_to_dict(ln.qc_inspection),
        "notes": ln.notes,
    }


def _grn_to_dict(grn: GoodsReceiptNote) -> dict:
    def _f(v): return float(v) if v is not None else 0
    return {
        "id": str(grn.id),
        "vendor_id": str(grn.vendor_id),
        "grn_number": grn.grn_number,
        "purchase_order_id": str(grn.purchase_order_id),
        "po_number": grn.purchase_order.po_number if grn.purchase_order else None,
        "status": grn.status,
        "posting_date": grn.posting_date.isoformat() if grn.posting_date else None,
        "document_date": grn.document_date.isoformat() if grn.document_date else None,
        "supplier_delivery_number": grn.supplier_delivery_number,
        "supplier_invoice_reference": grn.supplier_invoice_reference,
        "plant_id": str(grn.plant_id) if grn.plant_id else None,
        "storage_location_id": str(grn.storage_location_id) if grn.storage_location_id else None,
        "requires_qc": grn.requires_qc,
        "qc_completed_at": grn.qc_completed_at.isoformat() if grn.qc_completed_at else None,
        "total_ordered_qty": _f(grn.total_ordered_qty),
        "total_received_qty": _f(grn.total_received_qty),
        "total_accepted_qty": _f(grn.total_accepted_qty),
        "total_rejected_qty": _f(grn.total_rejected_qty),
        "notes": grn.notes,
        "audit_log": grn.audit_log or [],
        "created_at": grn.created_at.isoformat() if grn.created_at else None,
        "updated_at": grn.updated_at.isoformat() if grn.updated_at else None,
        "lines": [_line_to_dict(ln) for ln in (grn.lines or [])],
    }


# ─────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────

async def _get_grn_or_404(db: AsyncSession, vendor_id: UUID, grn_id: UUID) -> GoodsReceiptNote:
    result = await db.execute(
        select(GoodsReceiptNote).where(
            GoodsReceiptNote.vendor_id == vendor_id,
            GoodsReceiptNote.id == grn_id,
        )
    )
    grn = result.scalar_one_or_none()
    if not grn:
        raise HTTPException(status_code=404, detail="GRN not found")
    return grn


# ═══════════════════════════════════════════════════════════════════
#  ENDPOINTS
# ═══════════════════════════════════════════════════════════════════

@router.get("/grns")
async def list_grns(
    purchase_order_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(GoodsReceiptNote).where(GoodsReceiptNote.vendor_id == vendor_id)
    if purchase_order_id:
        stmt = stmt.where(GoodsReceiptNote.purchase_order_id == UUID(purchase_order_id))
    if status:
        stmt = stmt.where(GoodsReceiptNote.status == status)

    count_result = await db.execute(
        stmt.with_only_columns(*[GoodsReceiptNote.id]).order_by(None)
    )
    total = len(count_result.all())

    stmt = stmt.order_by(GoodsReceiptNote.created_at.desc()).offset((page - 1) * size).limit(size)
    result = await db.execute(stmt)
    grns = result.scalars().all()
    return JSONResponse(content={
        "items": [_grn_to_dict(g) for g in grns],
        "total": total,
        "page": page,
        "size": size,
        "pages": math.ceil(total / size) if total > 0 else 0,
    })


@router.post("/grns", status_code=201)
async def create_grn(
    data: GRNCreate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vendor_user: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = _GR_POST,
):
    # Validate PO belongs to vendor
    po_result = await db.execute(
        select(PurchaseOrder).where(
            PurchaseOrder.id == UUID(data.purchase_order_id),
            PurchaseOrder.vendor_id == vendor_id,
        )
    )
    po = po_result.scalar_one_or_none()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    if po.status not in ("draft", "sent", "partial_received"):
        raise HTTPException(status_code=400, detail=f"Cannot create GRN for PO with status '{po.status}'")

    grn_number = await next_doc_number(db, vendor_id, "GRN", width=6)
    today = date.today()

    grn = GoodsReceiptNote(
        vendor_id=vendor_id,
        grn_number=grn_number,
        purchase_order_id=UUID(data.purchase_order_id),
        posting_date=data.posting_date or today,
        document_date=data.document_date or today,
        supplier_delivery_number=data.supplier_delivery_number,
        supplier_invoice_reference=data.supplier_invoice_reference,
        plant_id=UUID(data.plant_id) if data.plant_id else None,
        storage_location_id=UUID(data.storage_location_id) if data.storage_location_id else None,
        requires_qc=data.requires_qc,
        notes=data.notes,
        received_by=vendor_user.id,
    )

    total_received = Decimal(0)
    for i, line_data in enumerate(data.lines, start=1):
        # Pull PO item to get ordered_qty
        po_item_result = await db.execute(
            select(PurchaseOrderItem).where(PurchaseOrderItem.id == UUID(line_data.po_item_id))
        )
        po_item = po_item_result.scalar_one_or_none()
        ordered_qty = float(po_item.quantity_ordered) if po_item else line_data.received_qty

        received = Decimal(str(line_data.received_qty))
        line = GRNLine(
            line_number=i,
            po_item_id=UUID(line_data.po_item_id),
            product_id=UUID(line_data.product_id),
            variant_id=UUID(line_data.variant_id) if line_data.variant_id else None,
            batch_number=line_data.batch_number,
            supplier_batch_number=line_data.supplier_batch_number,
            manufacturing_date=line_data.manufacturing_date,
            expiry_date=line_data.expiry_date,
            unit_of_measure=line_data.unit_of_measure,
            ordered_qty=ordered_qty,
            received_qty=received,
            accepted_qty=received if not data.requires_qc else None,
            pending_qc_qty=received if data.requires_qc else None,
            unit_price=line_data.unit_price,
            plant_id=UUID(line_data.plant_id) if line_data.plant_id else grn.plant_id,
            storage_location_id=UUID(line_data.storage_location_id) if line_data.storage_location_id else grn.storage_location_id,
            qc_status="pending" if data.requires_qc else "not_required",
            notes=line_data.notes,
        )
        grn.lines.append(line)
        total_received += received

    grn.total_received_qty = total_received
    grn.total_accepted_qty = total_received if not data.requires_qc else Decimal(0)
    grn.status = "qc_pending" if data.requires_qc else "posted"

    append_audit_log(grn, "created", vendor_user.id)
    if not data.requires_qc:
        append_audit_log(grn, "posted", vendor_user.id)

    db.add(grn)
    await db.flush()  # gives grn.id before inventory writes

    if not data.requires_qc:
        pairs = [(ln, Decimal(str(ln.received_qty or 0))) for ln in grn.lines]
        await _post_grn_inventory(
            db, vendor_id, grn, pairs,
            performed_by_user_id=vendor_user.user_id,
            movement_type="purchase",
            sign=1,
        )

    await db.commit()
    result = await db.execute(select(GoodsReceiptNote).where(GoodsReceiptNote.id == grn.id))
    grn = result.scalar_one()
    return JSONResponse(content=_grn_to_dict(grn), status_code=201)


@router.get("/grns/{grn_id}")
async def get_grn(
    grn_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    grn = await _get_grn_or_404(db, vendor_id, grn_id)
    return JSONResponse(content=_grn_to_dict(grn))


@router.post("/grns/{grn_id}/qc/{line_id}")
async def record_qc_result(
    grn_id: UUID,
    line_id: UUID,
    data: QCResultRequest,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vendor_user: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = _GR_POST,
):
    """Record QC inspection result for a single GRN line."""
    grn = await _get_grn_or_404(db, vendor_id, grn_id)
    guard_transition(grn.status, ("qc_pending",), "record QC")

    line_result = await db.execute(
        select(GRNLine).where(GRNLine.id == line_id, GRNLine.grn_id == grn_id)
    )
    line = line_result.scalar_one_or_none()
    if not line:
        raise HTTPException(status_code=404, detail="GRN line not found")

    now = datetime.now(timezone.utc)
    if line.qc_inspection:
        qc = line.qc_inspection
    else:
        qc = GRNQCInspection(grn_line_id=line_id)
        line.qc_inspection = qc

    qc.result = data.result
    qc.accepted_qty = Decimal(str(data.accepted_qty))
    qc.rejected_qty = Decimal(str(data.rejected_qty))
    qc.inspected_qty = Decimal(str(data.accepted_qty)) + Decimal(str(data.rejected_qty))
    qc.defect_code = data.defect_code
    qc.defect_description = data.defect_description
    qc.inspector_id = vendor_user.id
    qc.inspected_at = now
    qc.notes = data.notes

    line.accepted_qty = qc.accepted_qty
    line.rejected_qty = qc.rejected_qty
    line.pending_qc_qty = Decimal(0)
    line.qc_status = data.result

    await db.commit()
    await db.refresh(line)
    return JSONResponse(content=_line_to_dict(line))


@router.post("/grns/{grn_id}/close-qc")
async def close_grn_qc(
    grn_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vendor_user: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = _GR_POST,
):
    """Mark all QC as done for the GRN → status = qc_done."""
    grn = await _get_grn_or_404(db, vendor_id, grn_id)
    guard_transition(grn.status, ("qc_pending",), "close-qc")

    pending = [ln for ln in (grn.lines or []) if ln.qc_status == "pending"]
    if pending:
        raise HTTPException(
            status_code=400,
            detail=f"{len(pending)} line(s) still pending QC inspection",
        )

    now = datetime.now(timezone.utc)
    accepted_total = sum(float(ln.accepted_qty or 0) for ln in (grn.lines or []))
    rejected_total = sum(float(ln.rejected_qty or 0) for ln in (grn.lines or []))

    grn.status = "qc_done"
    grn.qc_completed_at = now
    grn.qc_completed_by = vendor_user.id
    grn.total_accepted_qty = accepted_total
    grn.total_rejected_qty = rejected_total
    append_audit_log(grn, "qc_closed", vendor_user.id)

    # Post inventory only for accepted qty (QC path)
    pairs = [
        (ln, Decimal(str(ln.accepted_qty)) if ln.accepted_qty is not None else Decimal(0))
        for ln in (grn.lines or [])
    ]
    await _post_grn_inventory(
        db, vendor_id, grn, pairs,
        performed_by_user_id=vendor_user.user_id,
        movement_type="purchase",
        sign=1,
    )

    await db.commit()
    result = await db.execute(select(GoodsReceiptNote).where(GoodsReceiptNote.id == grn_id))
    return JSONResponse(content=_grn_to_dict(result.scalar_one()))


@router.post("/grns/{grn_id}/close")
async def close_grn(
    grn_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vendor_user: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = _GR_POST,
):
    grn = await _get_grn_or_404(db, vendor_id, grn_id)
    guard_transition(grn.status, ("posted", "qc_done"), "close")
    grn.status = "closed"
    append_audit_log(grn, "closed", vendor_user.id)
    await db.commit()
    result = await db.execute(select(GoodsReceiptNote).where(GoodsReceiptNote.id == grn_id))
    return JSONResponse(content=_grn_to_dict(result.scalar_one()))


@router.post("/grns/{grn_id}/reverse", status_code=201)
async def reverse_grn(
    grn_id: UUID,
    data: GRNReversalCreate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vendor_user: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = _GR_POST,
):
    """Create a GRN reversal document (partial or full)."""
    grn = await _get_grn_or_404(db, vendor_id, grn_id)
    guard_transition(grn.status, ("posted", "qc_done", "closed"), "reverse")

    rev_number = await next_doc_number(db, vendor_id, "GRNR", width=5)
    reversal = GRNReversal(
        vendor_id=vendor_id,
        grn_id=grn_id,
        reversal_number=rev_number,
        reversal_type=data.reversal_type,
        reversal_date=data.reversal_date,
        reason=data.reason,
        notes=data.notes,
        status="posted",
        reversed_by=vendor_user.id,
    )

    for line_data in data.lines:
        line_result = await db.execute(
            select(GRNLine).where(
                GRNLine.id == UUID(line_data.grn_line_id),
                GRNLine.grn_id == grn_id,
            )
        )
        grn_line = line_result.scalar_one_or_none()
        if not grn_line:
            raise HTTPException(status_code=400, detail=f"GRN line {line_data.grn_line_id} not found")
        max_reversible = float(grn_line.accepted_qty or grn_line.received_qty)
        if line_data.reversed_qty > max_reversible:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot reverse {line_data.reversed_qty} — max reversible is {max_reversible}",
            )
        reversal.lines.append(GRNReversalLine(
            grn_line_id=UUID(line_data.grn_line_id),
            reversed_qty=Decimal(str(line_data.reversed_qty)),
            reason=line_data.reason,
        ))

    append_audit_log(reversal, "created", vendor_user.id)
    db.add(reversal)

    grn.status = "reversed"
    append_audit_log(grn, "reversed", vendor_user.id, reversal_number=rev_number)

    # Reverse inventory using explicit (line, qty) pairs — source lines are NOT mutated
    reversal_pairs: List[Tuple[GRNLine, Decimal]] = []
    for rl in reversal.lines:
        orig_result = await db.execute(
            select(GRNLine).where(GRNLine.id == rl.grn_line_id)
        )
        orig_line = orig_result.scalar_one_or_none()
        if orig_line:
            reversal_pairs.append((orig_line, Decimal(str(rl.reversed_qty))))

    if reversal_pairs:
        await _post_grn_inventory(
            db, vendor_id, grn, reversal_pairs,
            performed_by_user_id=vendor_user.user_id,
            movement_type="purchase_return",
            sign=-1,
        )

    await db.commit()
    await db.refresh(reversal)
    return JSONResponse(content={
        "id": str(reversal.id),
        "reversal_number": reversal.reversal_number,
        "grn_id": str(grn_id),
        "reversal_type": reversal.reversal_type,
        "reversal_date": reversal.reversal_date.isoformat(),
        "status": reversal.status,
        "lines": [
            {
                "grn_line_id": str(rl.grn_line_id),
                "reversed_qty": float(rl.reversed_qty),
                "reason": rl.reason,
            }
            for rl in reversal.lines
        ],
    }, status_code=201)
