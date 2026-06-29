# app/api/v1/vendor_procurement_requisition.py
from uuid import UUID
from typing import Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.api.deps import get_current_vendor_id, get_current_vendor_user
from app.models.vendor_user import VendorUser
from app.models.vendor_product import Product, ProductVariant
from app.models.store import Store, StoreInventory, ProductStore
from app.models.storage_location import StorageLocation
from app.models.plant import Plant
from app.models.mrp import StockReservation
from app.models.procurement import PurchaseOrder, PurchaseOrderItem
from app.models.procurement_requisition import (
    PurchaseRequisition, PurchaseRequisitionItem, PurchaseRequisitionApproval,
)
from app.schemas.procurement_requisition import (
    PurchaseRequisitionCreate, PurchaseRequisitionUpdate,
    PRItemCreate,
    ApproveRejectRequest, ConvertPRToPORequest,
)
from app.repositories.procurement_requisition_repo import PurchaseRequisitionRepository

router = APIRouter()


def _normalize_uom(uom: str | None) -> str:
    if not uom:
        return "PCS"
    key = uom.lower().strip().replace(" ", "_")
    mapping = {
        "piece": "PCS", "pieces": "PCS", "pcs": "PCS", "unit": "PCS",
        "box": "BOX", "kg": "KG", "kilogram": "KG",
        "ltr": "LTR", "litre": "LTR", "liter": "LTR",
        "mtr": "MTR", "metre": "MTR", "meter": "MTR",
        "hr": "HR", "hour": "HR", "hours": "HR",
        "day": "DAY", "ea": "EA", "each": "EA",
    }
    return mapping.get(key, uom.upper()[:20])


# ── Product context for requisition lines ─────────────────────────

@router.get("/requisitions/product-context/{product_id}")
async def get_product_procurement_context(
    product_id: UUID,
    variant_id: Optional[str] = Query(None),
    store_id: Optional[str] = Query(None),
    plant_id: Optional[str] = Query(None),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Stock, MRP demand, tax, UOM and location hints for a requisition line item."""
    result = await db.execute(
        select(Product)
        .options(selectinload(Product.store_assignments).selectinload(ProductStore.store))
        .where(Product.id == product_id, Product.vendor_id == vendor_id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    variant = None
    vid = None
    if variant_id:
        try:
            vid = UUID(variant_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid variant_id")
        v_result = await db.execute(
            select(ProductVariant).where(
                ProductVariant.id == vid,
                ProductVariant.product_id == product_id,
            )
        )
        variant = v_result.scalar_one_or_none()
        if not variant:
            raise HTTPException(status_code=404, detail="Variant not found")

    uom = _normalize_uom(variant.uom if variant else product.uom)
    cost_price = float(variant.cost_price if variant and variant.cost_price is not None
                       else product.cost_price or product.price or 0)
    hsn = variant.hsn_code if variant and variant.hsn_code else product.hsn_code
    gst_rate = float(variant.gst_rate if variant and variant.gst_rate is not None
                     else product.gst_rate or product.tax_rate or 0)
    reorder_point = variant.reorder_point if variant and variant.reorder_point is not None else product.reorder_point

    # Business units (entities) this product belongs to
    if product.store_scope == "all":
        stores_result = await db.execute(
            select(Store).where(Store.vendor_id == vendor_id, Store.is_active == True).order_by(Store.name)
        )
        entities = [
            {"id": str(s.id), "name": s.name, "code": s.code}
            for s in stores_result.scalars().all()
        ]
    else:
        entities = [
            {"id": str(ps.store_id), "name": ps.store.name if ps.store else str(ps.store_id), "code": ps.store.code if ps.store else None}
            for ps in (product.store_assignments or [])
            if ps.store
        ]

    sid = UUID(store_id) if store_id else None
    pid_filter = UUID(plant_id) if plant_id else None

    # Per-location stock rows
    si_q = (
        select(StoreInventory, Store, StorageLocation, Plant)
        .join(Store, StoreInventory.store_id == Store.id)
        .outerjoin(StorageLocation, StoreInventory.storage_location_id == StorageLocation.id)
        .outerjoin(Plant, StorageLocation.plant_id == Plant.id)
        .where(
            StoreInventory.vendor_id == vendor_id,
            StoreInventory.product_id == product_id,
        )
    )
    if vid:
        si_q = si_q.where(
            (StoreInventory.variant_id == vid) | (StoreInventory.variant_id.is_(None))
        )
    if sid:
        si_q = si_q.where(StoreInventory.store_id == sid)
    if pid_filter:
        si_q = si_q.where(StorageLocation.plant_id == pid_filter)

    si_rows = (await db.execute(si_q)).all()
    stock_by_location = []
    location_stock_total = 0
    default_store_id = None
    default_plant_id = None
    default_storage_location_id = None
    for inv, store, loc, plant in si_rows:
        qty = int(inv.quantity or 0)
        location_stock_total += qty
        row = {
            "store_id": str(store.id),
            "store_name": store.name,
            "plant_id": str(plant.id) if plant else (str(loc.plant_id) if loc and loc.plant_id else None),
            "plant_name": plant.name if plant else None,
            "storage_location_id": str(loc.id) if loc else None,
            "storage_location_name": loc.name if loc else None,
            "quantity": qty,
        }
        stock_by_location.append(row)
        if default_store_id is None and qty > 0 and loc:
            default_store_id = str(store.id)
            default_plant_id = row["plant_id"]
            default_storage_location_id = row["storage_location_id"]

    if location_stock_total > 0:
        available_stock = location_stock_total
    else:
        available_stock = int(variant.quantity if variant else product.quantity or 0)

    # Active reservations
    resv_q = select(func.coalesce(func.sum(StockReservation.reserved_qty), 0)).where(
        StockReservation.vendor_id == vendor_id,
        StockReservation.product_id == product_id,
        StockReservation.status == "active",
    )
    if vid:
        resv_q = resv_q.where(
            (StockReservation.variant_id == vid) | (StockReservation.variant_id.is_(None))
        )
    reserved_qty = float((await db.execute(resv_q)).scalar() or 0)

    net_available = max(0.0, float(available_stock) - reserved_qty)

    # Open requisition pipeline (not yet converted to PO)
    open_pr_q = (
        select(func.coalesce(func.sum(PurchaseRequisitionItem.quantity - PurchaseRequisitionItem.quantity_ordered), 0))
        .join(PurchaseRequisition, PurchaseRequisitionItem.requisition_id == PurchaseRequisition.id)
        .where(
            PurchaseRequisition.vendor_id == vendor_id,
            PurchaseRequisition.status.in_(["submitted", "approved", "partially_converted"]),
            PurchaseRequisitionItem.product_id == product_id,
        )
    )
    if vid:
        open_pr_q = open_pr_q.where(
            (PurchaseRequisitionItem.variant_id == vid) | (PurchaseRequisitionItem.variant_id.is_(None))
        )
    open_requisition_qty = float((await db.execute(open_pr_q)).scalar() or 0)

    # Open PO (on order, not yet received)
    open_po_q = (
        select(func.coalesce(func.sum(PurchaseOrderItem.quantity_ordered - PurchaseOrderItem.quantity_received), 0))
        .join(PurchaseOrder, PurchaseOrderItem.purchase_order_id == PurchaseOrder.id)
        .where(
            PurchaseOrder.vendor_id == vendor_id,
            PurchaseOrder.status.in_(["draft", "sent", "partial_received"]),
            PurchaseOrderItem.product_id == product_id,
        )
    )
    if vid:
        open_po_q = open_po_q.where(
            (PurchaseOrderItem.variant_id == vid) | (PurchaseOrderItem.variant_id.is_(None))
        )
    open_po_qty = float((await db.execute(open_po_q)).scalar() or 0)

    reorder_gap = max(0, int(reorder_point or 0) - int(net_available)) if reorder_point else 0
    on_demand_mrp = reorder_gap + open_requisition_qty + open_po_qty

    return JSONResponse(content={
        "product_id": str(product.id),
        "variant_id": str(vid) if vid else None,
        "name": variant.name if variant else product.name,
        "material_code": product.material_code,
        "sku": variant.sku if variant and variant.sku else product.sku,
        "uom": uom,
        "cost_price": cost_price,
        "hsn_code": hsn,
        "gst_rate": gst_rate,
        "is_taxable": bool(variant.is_taxable if variant else product.is_taxable),
        "store_scope": product.store_scope or "all",
        "entities": entities,
        "available_stock": net_available,
        "reserved_qty": reserved_qty,
        "open_requisition_qty": open_requisition_qty,
        "open_po_qty": open_po_qty,
        "reorder_point": int(reorder_point) if reorder_point is not None else None,
        "on_demand_mrp": on_demand_mrp,
        "default_store_id": default_store_id,
        "default_plant_id": default_plant_id,
        "default_storage_location_id": default_storage_location_id,
        "stock_by_location": stock_by_location,
    })


# ── Serialiser ────────────────────────────────────────────────────

def _item_to_dict(item: PurchaseRequisitionItem) -> dict:
    product = getattr(item, "product", None)
    service = getattr(item, "service", None)
    return {
        "id": str(item.id),
        "requisition_id": str(item.requisition_id),
        "item_type": item.item_type or "product",
        "product_id": str(item.product_id) if item.product_id else None,
        "service_id": str(item.service_id) if item.service_id else None,
        "variant_id": str(item.variant_id) if item.variant_id else None,
        "description": item.description,
        "asset_category_id": str(item.asset_category_id) if item.asset_category_id else None,
        "product_name": product.name if product else None,
        "product_sku": product.sku if product else None,
        "service_name": service.name if service else None,
        "quantity": float(item.quantity),
        "unit_of_measure": item.unit_of_measure,
        "needed_by_date": item.needed_by_date.isoformat() if item.needed_by_date else None,
        "plant_id": str(item.plant_id) if item.plant_id else None,
        "storage_location_id": str(item.storage_location_id) if item.storage_location_id else None,
        "estimated_price": float(item.estimated_price) if item.estimated_price else 0,
        "suggested_supplier_id": str(item.suggested_supplier_id) if item.suggested_supplier_id else None,
        "quantity_ordered": float(item.quantity_ordered) if item.quantity_ordered else 0,
        "purchase_order_id": str(item.purchase_order_id) if item.purchase_order_id else None,
        "is_converted": item.is_converted,
        "notes": item.notes,
    }


def _approval_to_dict(a: PurchaseRequisitionApproval) -> dict:
    approver = getattr(a, "approver", None)
    user = getattr(approver, "user", None) if approver else None
    return {
        "id": str(a.id),
        "requisition_id": str(a.requisition_id),
        "level": a.level,
        "approver_id": str(a.approver_id) if a.approver_id else None,
        "approver_name": user.full_name if user else None,
        "status": a.status,
        "comments": a.comments,
        "actioned_at": a.actioned_at.isoformat() if a.actioned_at else None,
        "created_at": a.created_at.isoformat() if a.created_at else None,
    }


def _pr_to_dict(pr: PurchaseRequisition) -> dict:
    return {
        "id": str(pr.id),
        "vendor_id": str(pr.vendor_id),
        "pr_number": pr.pr_number,
        "status": pr.status,
        "requisition_type": pr.requisition_type or "product",
        "department": pr.department,
        "priority": pr.priority,
        "store_id": str(pr.store_id) if pr.store_id else None,
        "store_name": pr.store.name if getattr(pr, "store", None) else None,
        "procurement_source": pr.procurement_source or "supplier",
        "bu_scope": pr.bu_scope,
        "from_store_id": str(pr.from_store_id) if pr.from_store_id else None,
        "from_store_name": pr.from_store.name if getattr(pr, "from_store", None) else None,
        "to_store_id": str(pr.to_store_id) if pr.to_store_id else None,
        "to_store_name": pr.to_store.name if getattr(pr, "to_store", None) else None,
        "header_supplier_id": str(pr.header_supplier_id) if pr.header_supplier_id else None,
        "header_supplier_name": pr.header_supplier.name if getattr(pr, "header_supplier", None) else None,
        "notes": pr.notes,
        "approver_message": pr.approver_message,
        "submitted_at": pr.submitted_at.isoformat() if pr.submitted_at else None,
        "approved_at": pr.approved_at.isoformat() if pr.approved_at else None,
        "created_at": pr.created_at.isoformat() if pr.created_at else None,
        "updated_at": pr.updated_at.isoformat() if pr.updated_at else None,
        "items": [_item_to_dict(i) for i in (pr.items or [])],
        "approvals": [_approval_to_dict(a) for a in (pr.approvals or [])],
    }


def _append_pr_item(pr: PurchaseRequisition, item_data: PRItemCreate, default_type: str) -> None:
    item_type = item_data.item_type or default_type or "product"
    pr.items.append(
        PurchaseRequisitionItem(
            item_type=item_type,
            product_id=UUID(item_data.product_id) if item_data.product_id else None,
            service_id=UUID(item_data.service_id) if item_data.service_id else None,
            variant_id=UUID(item_data.variant_id) if item_data.variant_id else None,
            description=item_data.description,
            asset_category_id=UUID(item_data.asset_category_id) if item_data.asset_category_id else None,
            quantity=item_data.quantity,
            unit_of_measure=item_data.unit_of_measure or "PCS",
            needed_by_date=item_data.needed_by_date,
            plant_id=UUID(item_data.plant_id) if item_data.plant_id else None,
            storage_location_id=UUID(item_data.storage_location_id) if item_data.storage_location_id else None,
            estimated_price=item_data.estimated_price or 0,
            suggested_supplier_id=UUID(item_data.suggested_supplier_id) if item_data.suggested_supplier_id else None,
            notes=item_data.notes,
        )
    )


def _apply_pr_header(pr: PurchaseRequisition, data, *, include_approvers: bool = False) -> None:
    if getattr(data, "requisition_type", None) is not None:
        pr.requisition_type = data.requisition_type or "product"
    if getattr(data, "department", None) is not None:
        pr.department = data.department
    if getattr(data, "priority", None) is not None:
        pr.priority = data.priority or "medium"
    if getattr(data, "notes", None) is not None:
        pr.notes = data.notes
    if getattr(data, "approver_message", None) is not None:
        pr.approver_message = data.approver_message
    if getattr(data, "store_id", None) is not None:
        pr.store_id = UUID(data.store_id) if data.store_id else None
    if getattr(data, "procurement_source", None) is not None:
        pr.procurement_source = data.procurement_source or "supplier"
    if getattr(data, "bu_scope", None) is not None:
        pr.bu_scope = data.bu_scope
    if getattr(data, "from_store_id", None) is not None:
        pr.from_store_id = UUID(data.from_store_id) if data.from_store_id else None
    if getattr(data, "to_store_id", None) is not None:
        pr.to_store_id = UUID(data.to_store_id) if data.to_store_id else None
    if getattr(data, "header_supplier_id", None) is not None:
        pr.header_supplier_id = UUID(data.header_supplier_id) if data.header_supplier_id else None

    if include_approvers and getattr(data, "approvers", None) is not None:
        pr.approvals.clear()
        for approver in sorted(data.approvers, key=lambda a: a.level):
            pr.approvals.append(
                PurchaseRequisitionApproval(
                    level=approver.level,
                    approver_id=UUID(approver.approver_id),
                    status="pending",
                )
            )


# ── CRUD ──────────────────────────────────────────────────────────

@router.get("/requisitions")
async def list_requisitions(
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = PurchaseRequisitionRepository(db)
    skip = (page - 1) * size
    items, total = await repo.list_by_vendor(vendor_id, status=status, skip=skip, limit=size)
    import math
    return JSONResponse(content={
        "items": [_pr_to_dict(pr) for pr in items],
        "total": total,
        "page": page,
        "size": size,
        "pages": math.ceil(total / size) if size else 1,
    })


@router.get("/requisitions/{pr_id}")
async def get_requisition(
    pr_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = PurchaseRequisitionRepository(db)
    pr = await repo.get_by_vendor_and_id(vendor_id, pr_id)
    if not pr:
        raise HTTPException(status_code=404, detail="Purchase requisition not found")
    return JSONResponse(content=_pr_to_dict(pr))


@router.post("/requisitions", status_code=status.HTTP_201_CREATED)
async def create_requisition(
    data: PurchaseRequisitionCreate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vendor_user: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    repo = PurchaseRequisitionRepository(db)
    pr_number = await repo.get_next_pr_number(vendor_id)

    pr = PurchaseRequisition(
        vendor_id=vendor_id,
        pr_number=pr_number,
        status="draft",
        requested_by=vendor_user.id,
        requisition_type=data.requisition_type or "product",
        department=data.department,
        priority=data.priority or "medium",
        store_id=UUID(data.store_id) if data.store_id else None,
        procurement_source=data.procurement_source or "supplier",
        bu_scope=data.bu_scope,
        from_store_id=UUID(data.from_store_id) if data.from_store_id else None,
        to_store_id=UUID(data.to_store_id) if data.to_store_id else None,
        header_supplier_id=UUID(data.header_supplier_id) if data.header_supplier_id else None,
        notes=data.notes,
        approver_message=data.approver_message,
    )
    for item_data in data.items:
        _append_pr_item(pr, item_data, data.requisition_type or "product")

    for approver in sorted(data.approvers or [], key=lambda a: a.level):
        pr.approvals.append(
            PurchaseRequisitionApproval(
                level=approver.level,
                approver_id=UUID(approver.approver_id),
                status="pending",
            )
        )

    db.add(pr)
    await db.commit()
    await db.refresh(pr)
    pr = await repo.get_by_vendor_and_id(vendor_id, pr.id)
    return JSONResponse(content=_pr_to_dict(pr), status_code=201)


@router.put("/requisitions/{pr_id}")
async def update_requisition(
    pr_id: UUID,
    data: PurchaseRequisitionUpdate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = PurchaseRequisitionRepository(db)
    pr = await repo.get_by_vendor_and_id(vendor_id, pr_id)
    if not pr:
        raise HTTPException(status_code=404, detail="Purchase requisition not found")
    if pr.status not in ("draft",):
        raise HTTPException(status_code=400, detail="Only draft requisitions can be edited")

    _apply_pr_header(pr, data, include_approvers=data.approvers is not None)

    if data.items is not None:
        for existing in list(pr.items):
            await db.delete(existing)
        pr.items.clear()
        default_type = data.requisition_type or pr.requisition_type or "product"
        for item_data in data.items:
            _append_pr_item(pr, item_data, default_type)

    await db.commit()
    await db.refresh(pr)
    pr = await repo.get_by_vendor_and_id(vendor_id, pr.id)
    return JSONResponse(content=_pr_to_dict(pr))


# ── Submit for approval ───────────────────────────────────────────

@router.post("/requisitions/{pr_id}/submit")
async def submit_requisition(
    pr_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = PurchaseRequisitionRepository(db)
    pr = await repo.get_by_vendor_and_id(vendor_id, pr_id)
    if not pr:
        raise HTTPException(status_code=404, detail="Purchase requisition not found")
    if pr.status != "draft":
        raise HTTPException(status_code=400, detail="Only draft requisitions can be submitted")
    if not pr.approvals or not any(a.status == "pending" for a in pr.approvals):
        raise HTTPException(status_code=400, detail="Assign at least one approver before submitting")

    pr.status = "submitted"
    pr.submitted_at = datetime.now(timezone.utc)
    pr.audit_log = (pr.audit_log or []) + [{
        "action": "submitted",
        "at": pr.submitted_at.isoformat(),
    }]
    await db.commit()
    await db.refresh(pr)
    pr = await repo.get_by_vendor_and_id(vendor_id, pr.id)
    return JSONResponse(content=_pr_to_dict(pr))


# ── Approve / Reject ──────────────────────────────────────────────

@router.post("/requisitions/{pr_id}/approve")
async def approve_or_reject_requisition(
    pr_id: UUID,
    data: ApproveRejectRequest,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vendor_user: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    repo = PurchaseRequisitionRepository(db)
    pr = await repo.get_by_vendor_and_id(vendor_id, pr_id)
    if not pr:
        raise HTTPException(status_code=404, detail="Purchase requisition not found")
    if pr.status != "submitted":
        raise HTTPException(status_code=400, detail="Only submitted requisitions can be approved/rejected")

    pending_steps = sorted(
        [a for a in (pr.approvals or []) if a.status == "pending"],
        key=lambda a: a.level,
    )
    if not pending_steps:
        raise HTTPException(status_code=400, detail="No pending approval step for this requisition")

    current_step = pending_steps[0]
    if current_step.approver_id and current_step.approver_id != vendor_user.id:
        raise HTTPException(status_code=403, detail="You are not the designated approver for this step")

    now = datetime.now(timezone.utc)
    current_step.status = data.status.value
    current_step.comments = data.comments
    current_step.actioned_at = now

    if data.status.value == "rejected":
        pr.status = "rejected"
    elif data.status.value == "approved":
        remaining = [a for a in pending_steps if a.id != current_step.id]
        if not remaining:
            pr.status = "approved"
            pr.approved_at = now

    pr.audit_log = (pr.audit_log or []) + [{
        "action": data.status.value,
        "by": str(vendor_user.id),
        "level": current_step.level,
        "comments": data.comments,
        "at": now.isoformat(),
    }]

    await db.commit()
    await db.refresh(pr)
    pr = await repo.get_by_vendor_and_id(vendor_id, pr.id)
    return JSONResponse(content=_pr_to_dict(pr))


# ── Cancel ────────────────────────────────────────────────────────

@router.post("/requisitions/{pr_id}/cancel")
async def cancel_requisition(
    pr_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = PurchaseRequisitionRepository(db)
    pr = await repo.get_by_vendor_and_id(vendor_id, pr_id)
    if not pr:
        raise HTTPException(status_code=404, detail="Purchase requisition not found")
    if pr.status in ("converted", "cancelled"):
        raise HTTPException(status_code=400, detail=f"Cannot cancel a {pr.status} requisition")

    pr.status = "cancelled"
    pr.audit_log = (pr.audit_log or []) + [{"action": "cancelled", "at": datetime.now(timezone.utc).isoformat()}]
    await db.commit()
    pr = await repo.get_by_vendor_and_id(vendor_id, pr.id)
    return JSONResponse(content=_pr_to_dict(pr))
