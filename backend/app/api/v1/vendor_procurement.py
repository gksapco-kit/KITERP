# app/api/v1/vendor_procurement.py
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from uuid import UUID
import math
import re

from app.database import get_db
from app.models.procurement import Supplier
from app.api.deps import get_current_active_user
from app.models.user import User
from app.services.vendor_service import VendorService
from app.services.procurement_service import SupplierService, PurchaseOrderService
from app.schemas.procurement import (
    SupplierCreate, SupplierUpdate, SupplierResponse, SupplierListResponse,
    PurchaseOrderCreate, PurchaseOrderUpdate, ReceiveItemsRequest,
    PurchaseOrderResponse, PurchaseOrderItemResponse, PurchaseOrderReceiptResponse,
)

router = APIRouter()


async def get_current_vendor_id(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> UUID:
    service = VendorService(db)
    vendor = await service.get_by_user_id(current_user.id)
    if not vendor:
        raise HTTPException(status_code=404, detail="No vendor found for this user")
    return vendor.id


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
        "items": [_po_item_to_dict(i) for i in (po.items or [])],
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
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    svc = SupplierService(db)
    items, total = await svc.list(vendor_id, search=search, is_active=is_active)
    return JSONResponse(content={
        "items": [_supplier_to_dict(s) for s in items],
        "total": total,
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
):
    svc = SupplierService(db)
    await svc.deactivate(vendor_id, supplier_id)
    return JSONResponse(content={"detail": "Supplier deactivated"})


# ══════════════════════════════════════════════════════════════════
#  PURCHASE ORDERS
# ══════════════════════════════════════════════════════════════════

@router.post("/purchase-orders", status_code=201)
async def create_purchase_order(
    data: PurchaseOrderCreate,
    current_user: User = Depends(get_current_active_user),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    svc = PurchaseOrderService(db)
    payload = {
        "supplier_id": data.supplier_id,
        "items": [i.model_dump() for i in data.items],
        "expected_delivery_date": data.expected_delivery_date,
        "notes": data.notes,
    }
    po = await svc.create(vendor_id, payload, created_by=current_user.id)
    return JSONResponse(content=_po_to_dict(po), status_code=201)


@router.get("/purchase-orders")
async def list_purchase_orders(
    status: Optional[str] = None,
    supplier_id: Optional[str] = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    svc = PurchaseOrderService(db)
    items, total = await svc.list(
        vendor_id,
        status_filter=status,
        supplier_id=UUID(supplier_id) if supplier_id else None,
        page=page, size=size,
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
):
    svc = PurchaseOrderService(db)
    payload = data.model_dump(exclude_none=True)
    if "items" in payload:
        payload["items"] = [i.model_dump() for i in data.items]
    po = await svc.update(vendor_id, po_id, payload)
    return JSONResponse(content=_po_to_dict(po))


@router.post("/purchase-orders/{po_id}/send")
async def send_purchase_order(
    po_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
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
):
    svc = PurchaseOrderService(db)
    payload = {
        "items": [{"item_id": i.item_id, "quantity": i.quantity} for i in data.items],
        "notes": data.notes,
    }
    po = await svc.receive_items(vendor_id, po_id, payload, received_by=current_user.id)
    return JSONResponse(content=_po_to_dict(po, include_receipts=True))


@router.post("/purchase-orders/{po_id}/close")
async def close_purchase_order(
    po_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    svc = PurchaseOrderService(db)
    po = await svc.close(vendor_id, po_id)
    return JSONResponse(content=_po_to_dict(po))


@router.post("/purchase-orders/{po_id}/cancel")
async def cancel_purchase_order(
    po_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    svc = PurchaseOrderService(db)
    po = await svc.cancel(vendor_id, po_id)
    return JSONResponse(content=_po_to_dict(po))
