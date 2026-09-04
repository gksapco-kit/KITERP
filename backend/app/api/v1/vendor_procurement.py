# app/api/v1/vendor_procurement.py
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional
from uuid import UUID
import math
import re

from datetime import datetime, timezone, date
from app.database import get_db
from app.models.procurement import Supplier, PurchaseOrder, PurchaseOrderApproval
from app.models.procurement_grn import GoodsReceiptNote
from app.models.procurement_return import PurchaseReturn
from app.models.procurement_invoice import VendorInvoice
from app.api.deps import get_current_active_user, get_current_vendor_id, require_permission, get_current_vendor_user
from app.models.user import User
from app.models.vendor_user import VendorUser
from app.services.vendor_service import VendorService
from app.services.procurement_service import SupplierService, PurchaseOrderService
from app.utils.procurement_utils import append_audit_log
from app.schemas.procurement import (
    SupplierCreate, SupplierUpdate, SupplierResponse, SupplierListResponse,
    PurchaseOrderCreate, PurchaseOrderUpdate, ReceiveItemsRequest,
    PurchaseOrderResponse, PurchaseOrderItemResponse, PurchaseOrderReceiptResponse,
    POApproverAssign,
)

router = APIRouter(dependencies=[Depends(require_permission("procurement.view"))])


def _supplier_to_dict(s) -> dict:
    return SupplierResponse.model_validate(s).model_dump()


def _po_item_to_dict(item) -> dict:
    d = PurchaseOrderItemResponse.model_validate(item).model_dump()
    if item.product:
        d["product_name"] = item.product.name
        d["product_sku"] = item.product.sku
    if item.variant:
        d["variant_name"] = item.variant.name
        d["variant_sku"] = item.variant.sku
        d["variant_barcode"] = item.variant.barcode
    return d


def _receipt_to_dict(r) -> dict:
    return PurchaseOrderReceiptResponse.model_validate(r).model_dump()


def _approval_step_to_dict(a) -> dict:
    approver = getattr(a, "approver", None)
    user = getattr(approver, "user", None) if approver else None
    return {
        "id": str(a.id),
        "purchase_order_id": str(a.purchase_order_id),
        "level": a.level,
        "approver_id": str(a.approver_id) if a.approver_id else None,
        "approver_name": user.full_name if user else None,
        "status": a.status,
        "comments": a.comments,
        "actioned_at": a.actioned_at.isoformat() if a.actioned_at else None,
        "created_at": a.created_at.isoformat() if getattr(a, "created_at", None) else None,
    }


def _po_to_dict(po, include_receipts: bool = False) -> dict:
    d = {
        "id": str(po.id),
        "vendor_id": str(po.vendor_id),
        "supplier_id": str(po.supplier_id),
        "supplier_name": po.supplier.name if po.supplier else None,
        "po_number": po.po_number,
        "status": po.status,
        "order_date": po.order_date.isoformat() if po.order_date else None,
        "expected_delivery_date": po.expected_delivery_date.isoformat() if po.expected_delivery_date else None,
        "notes": po.notes,
        "subtotal": float(po.subtotal) if po.subtotal else 0,
        "tax_amount": float(po.tax_amount) if po.tax_amount else 0,
        "total": float(po.total) if po.total else 0,
        "created_by": str(po.created_by) if po.created_by else None,
        "created_at": po.created_at.isoformat() if po.created_at else None,
        "updated_at": po.updated_at.isoformat() if po.updated_at else None,
        "received_at": po.received_at.isoformat() if po.received_at else None,
        "closed_at": po.closed_at.isoformat() if po.closed_at else None,
        # ── Approval ──
        "approval_status": po.approval_status or "not_required",
        "approved_by": str(po.approved_by) if po.approved_by else None,
        "approved_at": po.approved_at.isoformat() if po.approved_at else None,
        "approver_message": po.approver_message,
        "approvals": [_approval_step_to_dict(a) for a in sorted(po.approvals or [], key=lambda x: x.level)],
        "items": [_po_item_to_dict(i) for i in (po.items or [])],
        # Linked Purchase Requisition (if any)
        "requisition_id": str(po.requisition_id) if po.requisition_id else None,
        "pr_number": po.requisition.pr_number if getattr(po, "requisition", None) else None,
    }
    if include_receipts:
        d["receipts"] = [_receipt_to_dict(r) for r in (po.receipts or [])]
    else:
        d["receipts"] = []
    return d


# ══════════════════════════════════════════════════════════════════
#  SUPPLIERS
# ══════════════════════════════════════════════════════════════════

GSTIN_RE = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$")


@router.post("/suppliers", status_code=201)
async def create_supplier(
    data: SupplierCreate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = Depends(require_permission("procurement.manage")),
):
    svc = SupplierService(db)
    payload = data.model_dump(exclude_none=True)
    if "address" in payload and payload["address"]:
        payload["address"] = data.address.model_dump() if data.address else {}
    if data.gstin:
        g = data.gstin.upper().strip()
        if not GSTIN_RE.match(g):
            raise HTTPException(status_code=400, detail="Invalid GSTIN format")
        dup = await db.execute(select(Supplier).where(Supplier.vendor_id == vendor_id, Supplier.gstin == g))
        if dup.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="A supplier with this GSTIN already exists")
        payload["gstin"] = g
    supplier = await svc.create(vendor_id, payload)
    return JSONResponse(content=_supplier_to_dict(supplier), status_code=201)


@router.get("/suppliers")
async def list_suppliers(
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    page: int = Query(1, ge=1),
    size: int = Query(100, ge=1, le=500),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    svc = SupplierService(db)
    items, total = await svc.list(vendor_id, search=search, is_active=is_active, page=page, size=size)
    return JSONResponse(content={
        "items": [_supplier_to_dict(s) for s in items],
        "total": total,
        "page": page,
        "size": size,
        "pages": math.ceil(total / size) if total > 0 else 0,
    })


@router.get("/suppliers/{supplier_id}")
async def get_supplier(
    supplier_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    svc = SupplierService(db)
    supplier = await svc.get(vendor_id, supplier_id)
    return JSONResponse(content=_supplier_to_dict(supplier))


@router.put("/suppliers/{supplier_id}")
async def update_supplier(
    supplier_id: UUID,
    data: SupplierUpdate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = Depends(require_permission("procurement.manage")),
):
    svc = SupplierService(db)
    payload = data.model_dump(exclude_none=True)
    if "address" in payload and data.address:
        payload["address"] = data.address.model_dump()
    if data.gstin is not None and data.gstin:
        g = data.gstin.upper().strip()
        if not GSTIN_RE.match(g):
            raise HTTPException(status_code=400, detail="Invalid GSTIN format")
        dup = await db.execute(
            select(Supplier).where(Supplier.vendor_id == vendor_id, Supplier.gstin == g, Supplier.id != supplier_id)
        )
        if dup.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="GSTIN already in use by another supplier")
        payload["gstin"] = g
    supplier = await svc.update(vendor_id, supplier_id, payload)
    return JSONResponse(content=_supplier_to_dict(supplier))


@router.delete("/suppliers/{supplier_id}")
async def delete_supplier(
    supplier_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = Depends(require_permission("procurement.manage")),
):
    svc = SupplierService(db)
    await svc.delete(vendor_id, supplier_id)
    return JSONResponse(content={"detail": "Supplier deleted"})


@router.post("/suppliers/{supplier_id}/deactivate")
async def deactivate_supplier(
    supplier_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = Depends(require_permission("procurement.manage")),
):
    svc = SupplierService(db)
    supplier = await svc.deactivate(vendor_id, supplier_id)
    return JSONResponse(content=_supplier_to_dict(supplier))


@router.post("/suppliers/{supplier_id}/reactivate")
async def reactivate_supplier(
    supplier_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = Depends(require_permission("procurement.manage")),
):
    svc = SupplierService(db)
    supplier = await svc.reactivate(vendor_id, supplier_id)
    return JSONResponse(content=_supplier_to_dict(supplier))


# ══════════════════════════════════════════════════════════════════
#  PURCHASE ORDERS
# ══════════════════════════════════════════════════════════════════

@router.post("/purchase-orders", status_code=201)
async def create_purchase_order(
    data: PurchaseOrderCreate,
    current_user: User = Depends(get_current_active_user),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = Depends(require_permission("procurement.manage")),
):
    svc = PurchaseOrderService(db)
    payload = {
        "supplier_id": data.supplier_id,
        "items": [i.model_dump() for i in data.items],
        "expected_delivery_date": data.expected_delivery_date,
        "notes": data.notes,
        "requisition_id": data.requisition_id,
        "pr_item_ids": data.pr_item_ids,
        "approvers": [a.model_dump() for a in (data.approvers or [])],
        "approver_message": data.approver_message,
    }
    po = await svc.create(vendor_id, payload, created_by=current_user.id)
    return JSONResponse(content=_po_to_dict(po), status_code=201)


@router.get("/purchase-orders")
async def list_purchase_orders(
    status: Optional[str] = None,
    supplier_id: Optional[str] = None,
    pending_my_approval: bool = Query(False),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=200),
    vendor_id: UUID = Depends(get_current_vendor_id),
    vendor_user: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    svc = PurchaseOrderService(db)
    items, total = await svc.list(
        vendor_id,
        status_filter=status,
        supplier_id=UUID(supplier_id) if supplier_id else None,
        page=page, size=size,
        pending_my_approval=pending_my_approval,
        approver_id=vendor_user.id if pending_my_approval else None,
    )
    return JSONResponse(content={
        "items": [_po_to_dict(po) for po in items],
        "total": total,
        "page": page,
        "size": size,
        "pages": math.ceil(total / size) if total > 0 else 0,
    })


@router.get("/purchase-orders/{po_id}")
async def get_purchase_order(
    po_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    svc = PurchaseOrderService(db)
    po = await svc.get(vendor_id, po_id)
    return JSONResponse(content=_po_to_dict(po, include_receipts=True))


@router.put("/purchase-orders/{po_id}")
async def update_purchase_order(
    po_id: UUID,
    data: PurchaseOrderUpdate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = Depends(require_permission("procurement.manage")),
):
    svc = PurchaseOrderService(db)
    payload = data.model_dump(exclude_none=True)
    if "items" in payload:
        payload["items"] = [i.model_dump() for i in data.items]
    if data.approvers is not None:
        payload["approvers"] = [a.model_dump() for a in data.approvers]
    po = await svc.update(vendor_id, po_id, payload)
    return JSONResponse(content=_po_to_dict(po))


@router.post("/purchase-orders/{po_id}/send")
async def send_purchase_order(
    po_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = Depends(require_permission("procurement.manage")),
):
    svc = PurchaseOrderService(db)
    po = await svc.send(vendor_id, po_id)
    return JSONResponse(content=_po_to_dict(po))


@router.post("/purchase-orders/{po_id}/receive")
async def receive_purchase_order_items(
    po_id: UUID,
    data: ReceiveItemsRequest,
    current_user: User = Depends(get_current_active_user),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = Depends(require_permission("procurement.gr.post")),
):
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail=(
            "This endpoint is retired. Use POST /vendors/me/procurement/grns "
            "to receive goods via a Goods Receipt Note (GRN), which handles "
            "inventory, QC, and 3-way matching correctly."
        ),
    )
    svc = PurchaseOrderService(db)
    payload = {
        "items": [
            {
                "item_id": i.item_id,
                "quantity": i.quantity,
                "batch_number": i.batch_number,
                "supplier_batch_number": i.supplier_batch_number,
                "manufacturing_date": i.manufacturing_date,
                "expiry_date": i.expiry_date,
                "track_id": i.track_id,
                "reference": i.reference,
                "plant_id": i.plant_id,
                "storage_location_id": i.storage_location_id,
            }
            for i in data.items
        ],
        "notes": data.notes,
        "plant_id": data.plant_id,
        "storage_location_id": data.storage_location_id,
        "posting_date": data.posting_date,
    }
    po = await svc.receive_items(vendor_id, po_id, payload, received_by=current_user.id)
    return JSONResponse(content=_po_to_dict(po, include_receipts=True))


@router.post("/purchase-orders/{po_id}/close")
async def close_purchase_order(
    po_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = Depends(require_permission("procurement.manage")),
):
    svc = PurchaseOrderService(db)
    po = await svc.close(vendor_id, po_id)
    return JSONResponse(content=_po_to_dict(po))


@router.post("/purchase-orders/{po_id}/cancel")
async def cancel_purchase_order(
    po_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = Depends(require_permission("procurement.manage")),
):
    svc = PurchaseOrderService(db)
    po = await svc.cancel(vendor_id, po_id)
    return JSONResponse(content=_po_to_dict(po))


# ══════════════════════════════════════════════════════════════════
#  PO APPROVAL WORKFLOW  (Phase 6)
# ══════════════════════════════════════════════════════════════════

from pydantic import BaseModel as _BM
from datetime import datetime, timezone as _tz


class POApprovalCreate(_BM):
    approver_ids: list[str] = []  # ordered list of approver vendor_user IDs; may be empty to use existing


class POApproveRejectRequest(_BM):
    action: str   # approve | reject
    comments: Optional[str] = None


@router.post("/purchase-orders/{po_id}/request-approval")
async def request_po_approval(
    po_id: UUID,
    data: POApprovalCreate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vendor_user: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = Depends(require_permission("procurement.manage")),
):
    """
    Submit a PO for approval.

    Resolution order:
      1. Try the approver matrix — resolve dimensions from the PO header.
      2. If the matrix matched and lock_chain is True, reject any manually
         supplied approver_ids (chain is fully locked).
      3. If the matrix matched and lock_chain is False, append any supplied
         approver_ids above the resolved chain.
      4. If the matrix did not match, fall back to supplied / pre-assigned ids.
      5. Legacy per-document threshold (approval_required_above) still applies
         as a safety net when no matrix rules exist.
    """
    from app.services.procurement_approver_matrix import (
        resolve_approvers as _resolve,
        get_material_types_for_po as _mt_po,
    )
    from decimal import Decimal as _D

    svc = PurchaseOrderService(db)
    po = await svc.get(vendor_id, po_id)
    if po.status != "draft":
        raise HTTPException(status_code=400, detail="Only draft POs can be submitted for approval")

    po_total = _D(str(po.total or 0))
    material_types = await _mt_po(db, po_id)

    # ── 1. Wipe existing pending steps before resolving ──────────────
    existing_result = await db.execute(
        select(PurchaseOrderApproval).where(PurchaseOrderApproval.purchase_order_id == po_id)
    )
    for apv in existing_result.scalars().all():
        await db.delete(apv)
    await db.flush()

    # ── 2. Try the approver matrix ───────────────────────────────────
    chain = await _resolve(
        db,
        vendor_id       = vendor_id,
        doc_type        = "PO",
        company_id      = po.company_id,
        branch_id       = po.branch_id,
        plant_id        = po.plant_id,
        material_types  = material_types,
        amount          = po_total,
        creator_vendor_user_id = vendor_user.id,
    )

    next_level = 1
    if chain.matched:
        if chain.lock_chain and data.approver_ids:
            raise HTTPException(
                status_code=400,
                detail="The approver matrix rule for this PO is locked — manual overrides are not allowed.",
            )
        for step in chain.steps:
            db.add(PurchaseOrderApproval(
                purchase_order_id = po_id,
                level             = step.level,
                approver_id       = step.approver_id,
                source_rule_id    = step.source_rule_id,
                status            = "pending",
            ))
        next_level = (chain.steps[-1].level + 1) if chain.steps else 1
        await db.flush()

    # ── 3. Append manual overrides (allowed when not locked) ─────────
    for i, approver_id_str in enumerate(data.approver_ids or []):
        db.add(PurchaseOrderApproval(
            purchase_order_id = po_id,
            level             = next_level + i,
            approver_id       = UUID(approver_id_str),
            status            = "pending",
        ))
    await db.flush()

    # ── 4. Check whether there are pending steps after all of the above
    pending_result = await db.execute(
        select(PurchaseOrderApproval)
        .where(PurchaseOrderApproval.purchase_order_id == po_id, PurchaseOrderApproval.status == "pending")
    )
    has_pending_approvers = bool(pending_result.scalars().all())

    # ── 5. Legacy per-document threshold safety net ──────────────────
    approval_required_above = float(po.approval_required_above or 0)
    if approval_required_above and float(po_total) > approval_required_above and not has_pending_approvers:
        raise HTTPException(
            status_code=400,
            detail=(
                f"This PO total exceeds the approval threshold of ₹{approval_required_above:,.2f}. "
                f"Please assign an approver before submitting."
            ),
        )

    if not has_pending_approvers:
        po.approval_status = "not_required"
        append_audit_log(po, "approval_skipped", vendor_user.id, reason="no_approvers_assigned")
    else:
        po.approval_status = "pending"
        append_audit_log(po, "approval_requested", vendor_user.id,
                         matrix_matched=chain.matched, lock_chain=chain.lock_chain)

    await db.commit()
    po = await svc.get(vendor_id, po_id)
    return JSONResponse(content=_po_to_dict(po))


@router.post("/purchase-orders/{po_id}/approve")
async def approve_or_reject_po(
    po_id: UUID,
    data: POApproveRejectRequest,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vendor_user: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = Depends(require_permission("procurement.po.approve")),
):
    """Approve or reject the current pending approval step."""
    if data.action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="action must be 'approve' or 'reject'")

    result = await db.execute(
        select(PurchaseOrder).where(PurchaseOrder.vendor_id == vendor_id, PurchaseOrder.id == po_id)
    )
    po = result.scalar_one_or_none()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    if po.approval_status != "pending":
        raise HTTPException(status_code=400, detail=f"PO is not pending approval (status: {po.approval_status})")

    # Find the current lowest-level pending step
    steps_result = await db.execute(
        select(PurchaseOrderApproval)
        .where(
            PurchaseOrderApproval.purchase_order_id == po_id,
            PurchaseOrderApproval.status == "pending",
        )
        .order_by(PurchaseOrderApproval.level)
    )
    pending_steps = steps_result.scalars().all()
    if not pending_steps:
        raise HTTPException(status_code=400, detail="No pending approval steps")

    current_step = pending_steps[0]
    if current_step.approver_id and current_step.approver_id != vendor_user.id:
        raise HTTPException(status_code=403, detail="You are not the designated approver for this step")

    now = datetime.now(_tz.utc)
    current_step.status = data.action + "d"   # approved / rejected
    current_step.comments = data.comments
    current_step.actioned_at = now

    if data.action == "reject":
        po.approval_status = "rejected"
        append_audit_log(po, "approval_rejected", vendor_user.id, level=current_step.level, comments=data.comments)
    else:
        remaining = [s for s in pending_steps if s.id != current_step.id]
        if not remaining:
            po.approval_status = "approved"
            po.approved_by = vendor_user.id
            po.approved_at = now
            append_audit_log(po, "approval_approved", vendor_user.id, level=current_step.level)
        else:
            append_audit_log(po, "approval_step_approved", vendor_user.id, level=current_step.level, next_level=remaining[0].level)

    await db.commit()
    svc = PurchaseOrderService(db)
    po = await svc.get(vendor_id, po_id)
    return JSONResponse(content=_po_to_dict(po))


# ── Procurement Analytics (server-side aggregates) ─────────────────────────────

@router.get("/procurement/analytics")
async def get_procurement_analytics(
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns pre-aggregated procurement KPIs, top-supplier spend,
    AP aging, and the last 6-month PO value trend.

    All heavy aggregation runs in the database — the frontend no longer
    needs to fetch 500 rows from every list endpoint.
    """
    today = date.today()

    # ── PO aggregates ─────────────────────────────────────────────
    po_rows = (await db.execute(
        select(
            PurchaseOrder.status,
            func.count(PurchaseOrder.id).label("cnt"),
            func.coalesce(func.sum(PurchaseOrder.total), 0).label("total"),
        )
        .where(PurchaseOrder.vendor_id == vendor_id)
        .group_by(PurchaseOrder.status)
    )).all()

    total_po_value = sum(float(r.total) for r in po_rows if r.status != "cancelled")
    total_po_count = sum(r.cnt for r in po_rows if r.status != "cancelled")
    fulfilled_pos   = sum(r.cnt for r in po_rows if r.status in ("received", "closed"))

    # ── Invoice / AP aggregates ───────────────────────────────────
    inv_rows = (await db.execute(
        select(
            VendorInvoice.status,
            func.count(VendorInvoice.id).label("cnt"),
            func.coalesce(func.sum(VendorInvoice.total), 0).label("total"),
            func.coalesce(func.sum(VendorInvoice.amount_paid), 0).label("paid"),
        )
        .where(VendorInvoice.vendor_id == vendor_id)
        .group_by(VendorInvoice.status)
    )).all()

    open_ap_value = sum(
        float(r.total) - float(r.paid)
        for r in inv_rows if r.status not in ("paid", "cancelled")
    )
    open_inv_count = sum(r.cnt for r in inv_rows if r.status not in ("paid", "cancelled"))

    # ── GRN count ─────────────────────────────────────────────────
    grn_count_row = (await db.execute(
        select(func.count(GoodsReceiptNote.id))
        .where(GoodsReceiptNote.vendor_id == vendor_id, GoodsReceiptNote.status != "cancelled")
    )).scalar() or 0

    # ── Return value ──────────────────────────────────────────────
    return_row = (await db.execute(
        select(
            func.count(PurchaseReturn.id).label("cnt"),
            func.coalesce(func.sum(PurchaseReturn.total), 0).label("total"),
        )
        .where(PurchaseReturn.vendor_id == vendor_id, PurchaseReturn.status != "cancelled")
    )).one()
    return_value = float(return_row.total)
    return_count = int(return_row.cnt)

    # ── Active / total suppliers ──────────────────────────────────
    sup_rows = (await db.execute(
        select(
            Supplier.is_active,
            func.count(Supplier.id).label("cnt"),
        )
        .where(Supplier.vendor_id == vendor_id)
        .group_by(Supplier.is_active)
    )).all()
    total_suppliers  = sum(r.cnt for r in sup_rows)
    active_suppliers = sum(r.cnt for r in sup_rows if r.is_active)

    # ── Top 10 suppliers by invoice spend ────────────────────────
    top_sup_rows = (await db.execute(
        select(
            VendorInvoice.supplier_id,
            func.count(VendorInvoice.id).label("invoice_count"),
            func.coalesce(func.sum(VendorInvoice.total), 0).label("spend"),
        )
        .where(VendorInvoice.vendor_id == vendor_id, VendorInvoice.status != "cancelled")
        .group_by(VendorInvoice.supplier_id)
        .order_by(func.coalesce(func.sum(VendorInvoice.total), 0).desc())
        .limit(10)
    )).all()

    # Separate query for paid-count per supplier
    paid_count_rows = (await db.execute(
        select(
            VendorInvoice.supplier_id,
            func.count(VendorInvoice.id).label("paid_count"),
        )
        .where(
            VendorInvoice.vendor_id == vendor_id,
            VendorInvoice.status == "paid",
        )
        .group_by(VendorInvoice.supplier_id)
    )).all()
    paid_count_map = {str(r.supplier_id): int(r.paid_count) for r in paid_count_rows}

    # Load supplier names for the top list
    supplier_ids = [r.supplier_id for r in top_sup_rows if r.supplier_id]
    sup_name_map: dict = {}
    if supplier_ids:
        name_rows = (await db.execute(
            select(Supplier.id, Supplier.name)
            .where(Supplier.id.in_(supplier_ids))
        )).all()
        sup_name_map = {str(r.id): r.name for r in name_rows}

    top_suppliers = [
        {
            "supplier_id": str(r.supplier_id) if r.supplier_id else None,
            "name": sup_name_map.get(str(r.supplier_id), "Unknown"),
            "spend": float(r.spend or 0),
            "invoice_count": int(r.invoice_count or 0),
            "paid_count": paid_count_map.get(str(r.supplier_id), 0),
        }
        for r in top_sup_rows
    ]

    # ── AP Aging (server-side bucket computation) ─────────────────
    open_invoices = (await db.execute(
        select(VendorInvoice.due_date, VendorInvoice.total, VendorInvoice.amount_paid)
        .where(
            VendorInvoice.vendor_id == vendor_id,
            VendorInvoice.status.notin_(["paid", "cancelled"]),
        )
    )).all()

    aging: dict[str, dict] = {}
    for inv in open_invoices:
        outstanding = float(inv.total or 0) - float(inv.amount_paid or 0)
        if outstanding <= 0:
            continue
        if inv.due_date is None:
            bucket = "No due date"
        else:
            days = (today - inv.due_date).days
            if days <= 0:
                bucket = "Current"
            elif days <= 30:
                bucket = "1–30 days"
            elif days <= 60:
                bucket = "31–60 days"
            elif days <= 90:
                bucket = "61–90 days"
            else:
                bucket = "90+ days"
        if bucket not in aging:
            aging[bucket] = {"count": 0, "amount": 0.0}
        aging[bucket]["count"] += 1
        aging[bucket]["amount"] += outstanding

    aging_order = ["Current", "1–30 days", "31–60 days", "61–90 days", "90+ days", "No due date"]
    ap_aging = [
        {"bucket": b, "count": aging[b]["count"], "amount": aging[b]["amount"]}
        for b in aging_order if b in aging
    ]

    # ── Monthly PO value (last 6 months) ─────────────────────────
    from sqlalchemy import extract
    six_months: list[dict] = []
    for offset in range(5, -1, -1):
        # Compute year/month for this slot
        month_num = today.month - offset
        year_num = today.year
        while month_num <= 0:
            month_num += 12
            year_num -= 1
        key = f"{year_num}-{str(month_num).zfill(2)}"
        six_months.append({"month": key, "value": 0.0})

    po_trend_rows = (await db.execute(
        select(
            extract("year", PurchaseOrder.order_date).label("yr"),
            extract("month", PurchaseOrder.order_date).label("mo"),
            func.coalesce(func.sum(PurchaseOrder.total), 0).label("total"),
        )
        .where(
            PurchaseOrder.vendor_id == vendor_id,
            PurchaseOrder.status != "cancelled",
            PurchaseOrder.order_date.isnot(None),
        )
        .group_by("yr", "mo")
    )).all()

    trend_map = {
        f"{int(r.yr)}-{str(int(r.mo)).zfill(2)}": float(r.total or 0)
        for r in po_trend_rows
    }
    for slot in six_months:
        slot["value"] = trend_map.get(slot["month"], 0.0)

    # ── Recent POs (last 10) ──────────────────────────────────────
    recent_po_rows = (await db.execute(
        select(PurchaseOrder)
        .where(PurchaseOrder.vendor_id == vendor_id)
        .order_by(PurchaseOrder.order_date.desc().nullslast(), PurchaseOrder.created_at.desc())
        .limit(10)
    )).scalars().all()

    recent_pos = [_po_to_dict(po) for po in recent_po_rows]

    return JSONResponse(content={
        "kpis": {
            "total_po_value": total_po_value,
            "total_po_count": total_po_count,
            "fulfilled_pos": fulfilled_pos,
            "open_ap_value": open_ap_value,
            "open_invoice_count": open_inv_count,
            "grn_count": int(grn_count_row),
            "return_value": return_value,
            "return_count": return_count,
            "total_suppliers": total_suppliers,
            "active_suppliers": active_suppliers,
        },
        "top_suppliers": top_suppliers,
        "ap_aging": ap_aging,
        "monthly_trend": six_months,
        "recent_pos": recent_pos,
    })


# ══════════════════════════════════════════════════════════════════
#  APPROVER MATRIX  (procurement_approver_rule CRUD + preview)
# ══════════════════════════════════════════════════════════════════

from decimal import Decimal as _Decimal
from pydantic import BaseModel as _BM3, model_validator
from typing import List as _List3, Optional as _Opt3
from app.models.procurement_approver_rule import ProcurementApproverRule
from app.services.procurement_approver_matrix import (
    resolve_approvers,
    get_material_types_for_po,
    get_material_types_for_pr,
)


class ApproverRuleIn(_BM3):
    doc_type: str                           # PR | PO | INVOICE
    company_id:    _Opt3[str] = None
    branch_id:     _Opt3[str] = None
    plant_id:      _Opt3[str] = None
    material_type: _Opt3[str] = None
    min_amount:    _Opt3[float] = None
    max_amount:    _Opt3[float] = None
    level:         int = 1
    approver_id:      _Opt3[str] = None
    approver_role_id: _Opt3[str] = None
    lock_chain: bool = False
    is_active:  bool = True

    @model_validator(mode="after")
    def _one_target(self):
        has_user = bool(self.approver_id)
        has_role = bool(self.approver_role_id)
        if has_user == has_role:
            raise ValueError("Exactly one of approver_id or approver_role_id must be set")
        return self


class ApproverRulePreviewIn(_BM3):
    doc_type:      str
    company_id:    _Opt3[str]   = None
    branch_id:     _Opt3[str]   = None
    plant_id:      _Opt3[str]   = None
    material_types: _List3[str] = []
    amount:        float        = 0.0


def _rule_to_dict(rule: ProcurementApproverRule) -> dict:
    approver = getattr(rule, "approver", None)
    role     = getattr(rule, "approver_role", None)
    company  = getattr(rule, "company", None)
    branch   = getattr(rule, "branch", None)
    plant    = getattr(rule, "plant", None)
    return {
        "id":            str(rule.id),
        "vendor_id":     str(rule.vendor_id),
        "doc_type":      rule.doc_type,
        "company_id":    str(rule.company_id) if rule.company_id else None,
        "company_name":  company.name if company else None,
        "branch_id":     str(rule.branch_id) if rule.branch_id else None,
        "branch_name":   branch.name if branch else None,
        "plant_id":      str(rule.plant_id) if rule.plant_id else None,
        "plant_name":    plant.name if plant else None,
        "material_type": rule.material_type,
        "min_amount":    float(rule.min_amount) if rule.min_amount is not None else None,
        "max_amount":    float(rule.max_amount) if rule.max_amount is not None else None,
        "level":         rule.level,
        "approver_id":   str(rule.approver_id) if rule.approver_id else None,
        "approver_name": (
            approver.user.full_name if approver and getattr(approver, "user", None) else None
        ),
        "approver_role_id":   str(rule.approver_role_id) if rule.approver_role_id else None,
        "approver_role_name": role.name if role else None,
        "lock_chain": rule.lock_chain,
        "is_active":  rule.is_active,
        "created_at": rule.created_at.isoformat() if rule.created_at else None,
        "updated_at": rule.updated_at.isoformat() if rule.updated_at else None,
    }


@router.get("/procurement/approver-rules")
async def list_approver_rules(
    doc_type: _Opt3[str] = Query(None),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = Depends(require_permission("procurement.approver_matrix.manage")),
):
    """List all approver matrix rules for this vendor, optionally filtered by doc_type."""
    stmt = (
        select(ProcurementApproverRule)
        .where(ProcurementApproverRule.vendor_id == vendor_id)
        .order_by(
            ProcurementApproverRule.doc_type,
            ProcurementApproverRule.level,
            ProcurementApproverRule.created_at,
        )
    )
    if doc_type:
        stmt = stmt.where(ProcurementApproverRule.doc_type == doc_type)
    rules = (await db.execute(stmt)).scalars().all()
    return {"rules": [_rule_to_dict(r) for r in rules]}


@router.post("/procurement/approver-rules", status_code=201)
async def create_approver_rule(
    data: ApproverRuleIn,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vendor_user: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = Depends(require_permission("procurement.approver_matrix.manage")),
):
    """Create a new approver matrix rule."""
    if data.doc_type not in ("PR", "PO", "INVOICE"):
        raise HTTPException(status_code=400, detail="doc_type must be PR, PO, or INVOICE")

    rule = ProcurementApproverRule(
        vendor_id     = vendor_id,
        doc_type      = data.doc_type,
        company_id    = UUID(data.company_id)    if data.company_id    else None,
        branch_id     = UUID(data.branch_id)     if data.branch_id     else None,
        plant_id      = UUID(data.plant_id)      if data.plant_id      else None,
        material_type = data.material_type,
        min_amount    = _Decimal(str(data.min_amount)) if data.min_amount is not None else None,
        max_amount    = _Decimal(str(data.max_amount)) if data.max_amount is not None else None,
        level         = data.level,
        approver_id      = UUID(data.approver_id)      if data.approver_id      else None,
        approver_role_id = UUID(data.approver_role_id) if data.approver_role_id else None,
        lock_chain    = data.lock_chain,
        is_active     = data.is_active,
        created_by    = vendor_user.id,
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return _rule_to_dict(rule)


@router.put("/procurement/approver-rules/{rule_id}")
async def update_approver_rule(
    rule_id: UUID,
    data: ApproverRuleIn,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = Depends(require_permission("procurement.approver_matrix.manage")),
):
    """Update an existing approver matrix rule."""
    rule: ProcurementApproverRule | None = await db.get(ProcurementApproverRule, rule_id)
    if not rule or rule.vendor_id != vendor_id:
        raise HTTPException(status_code=404, detail="Rule not found")

    if data.doc_type not in ("PR", "PO", "INVOICE"):
        raise HTTPException(status_code=400, detail="doc_type must be PR, PO, or INVOICE")

    rule.doc_type      = data.doc_type
    rule.company_id    = UUID(data.company_id)    if data.company_id    else None
    rule.branch_id     = UUID(data.branch_id)     if data.branch_id     else None
    rule.plant_id      = UUID(data.plant_id)      if data.plant_id      else None
    rule.material_type = data.material_type
    rule.min_amount    = _Decimal(str(data.min_amount)) if data.min_amount is not None else None
    rule.max_amount    = _Decimal(str(data.max_amount)) if data.max_amount is not None else None
    rule.level         = data.level
    rule.approver_id      = UUID(data.approver_id)      if data.approver_id      else None
    rule.approver_role_id = UUID(data.approver_role_id) if data.approver_role_id else None
    rule.lock_chain    = data.lock_chain
    rule.is_active     = data.is_active

    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return _rule_to_dict(rule)


@router.delete("/procurement/approver-rules/{rule_id}", status_code=204)
async def delete_approver_rule(
    rule_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = Depends(require_permission("procurement.approver_matrix.manage")),
):
    """Delete an approver matrix rule."""
    rule: ProcurementApproverRule | None = await db.get(ProcurementApproverRule, rule_id)
    if not rule or rule.vendor_id != vendor_id:
        raise HTTPException(status_code=404, detail="Rule not found")
    await db.delete(rule)
    await db.commit()


@router.post("/procurement/approver-rules/preview")
async def preview_approver_resolution(
    data: ApproverRulePreviewIn,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = Depends(require_permission("procurement.approver_matrix.manage")),
):
    """Dry-run: show which approvers would be assigned for the given document dimensions.

    Useful for admins to debug matrix rules without creating a real document.
    """
    if data.doc_type not in ("PR", "PO", "INVOICE"):
        raise HTTPException(status_code=400, detail="doc_type must be PR, PO, or INVOICE")

    chain = await resolve_approvers(
        db,
        vendor_id      = vendor_id,
        doc_type       = data.doc_type,
        company_id     = UUID(data.company_id)  if data.company_id  else None,
        branch_id      = UUID(data.branch_id)   if data.branch_id   else None,
        plant_id       = UUID(data.plant_id)    if data.plant_id    else None,
        material_types = set(data.material_types),
        amount         = _Decimal(str(data.amount)),
    )

    # Enrich steps with user display names
    steps_out = []
    if chain.matched:
        from app.models.vendor_user import VendorUser as _VU
        for step in chain.steps:
            vu = await db.get(_VU, step.approver_id)
            user = getattr(vu, "user", None) if vu else None
            steps_out.append({
                "level": step.level,
                "approver_id": str(step.approver_id),
                "approver_name": user.full_name if user else str(step.approver_id),
                "source_rule_id": str(step.source_rule_id),
            })

    return {
        "matched":    chain.matched,
        "lock_chain": chain.lock_chain,
        "steps":      steps_out,
    }
