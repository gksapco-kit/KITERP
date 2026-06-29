# app/api/v1/vendor_procurement_special.py
import math
from uuid import UUID
from typing import Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.deps import get_current_vendor_id, get_current_vendor_user
from app.models.vendor_user import VendorUser
from app.models.procurement_special import (
    MaterialValuation, SubcontractingOrder, ConsignmentStock, ServiceEntrySheet,
)
from app.schemas.procurement_special import (
    MaterialValuationCreate, MaterialValuationUpdate,
    SubcontractingOrderCreate, SubcontractingOrderUpdate,
    ServiceEntrySheetCreate, ServiceEntrySheetUpdate,
)
from app.repositories.procurement_special_repo import (
    MaterialValuationRepository, SubcontractingOrderRepository,
    ConsignmentStockRepository, ServiceEntrySheetRepository,
)

router = APIRouter()


# ── Material Valuation ────────────────────────────────────────────

def _mv_to_dict(v: MaterialValuation) -> dict:
    def _f(x):
        return float(x) if x is not None else 0

    return {
        "id": str(v.id),
        "vendor_id": str(v.vendor_id),
        "product_id": str(v.product_id),
        "variant_id": str(v.variant_id) if v.variant_id else None,
        "plant_id": str(v.plant_id) if v.plant_id else None,
        "valuation_method": v.valuation_method,
        "currency": v.currency,
        "standard_price": _f(v.standard_price),
        "moving_avg_price": _f(v.moving_avg_price),
        "total_stock": _f(v.total_stock),
        "total_value": _f(v.total_value),
        "last_po_price": _f(v.last_po_price),
        "last_purchase_date": v.last_purchase_date.isoformat() if v.last_purchase_date else None,
        "updated_at": v.updated_at.isoformat() if v.updated_at else None,
    }


@router.get("/material-valuation")
async def list_material_valuation(
    product_id: Optional[str] = Query(None),
    plant_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = MaterialValuationRepository(db)
    skip = (page - 1) * size
    records, total = await repo.list_by_vendor(
        vendor_id,
        product_id=UUID(product_id) if product_id else None,
        plant_id=UUID(plant_id) if plant_id else None,
        skip=skip,
        limit=size,
    )
    return JSONResponse(content={
        "items": [_mv_to_dict(r) for r in records],
        "total": total,
        "page": page,
        "size": size,
    })


@router.post("/material-valuation", status_code=status.HTTP_201_CREATED)
async def create_material_valuation(
    data: MaterialValuationCreate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    record = MaterialValuation(
        vendor_id=vendor_id,
        product_id=UUID(data.product_id),
        variant_id=UUID(data.variant_id) if data.variant_id else None,
        plant_id=UUID(data.plant_id) if data.plant_id else None,
        valuation_method=data.valuation_method or "moving_average",
        currency=data.currency or "INR",
        standard_price=data.standard_price or 0,
        moving_avg_price=data.moving_avg_price or 0,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return JSONResponse(content=_mv_to_dict(record), status_code=201)


@router.put("/material-valuation/{val_id}")
async def update_material_valuation(
    val_id: UUID,
    data: MaterialValuationUpdate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import select
    result = await db.execute(
        select(MaterialValuation).where(
            MaterialValuation.vendor_id == vendor_id,
            MaterialValuation.id == val_id,
        )
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Material valuation not found")

    for field in ["valuation_method", "standard_price", "moving_avg_price"]:
        val = getattr(data, field, None)
        if val is not None:
            setattr(record, field, val)

    await db.commit()
    await db.refresh(record)
    return JSONResponse(content=_mv_to_dict(record))


# ── Subcontracting Orders ─────────────────────────────────────────

def _sc_to_dict(s: SubcontractingOrder) -> dict:
    return {
        "id": str(s.id),
        "vendor_id": str(s.vendor_id),
        "purchase_order_id": str(s.purchase_order_id),
        "supplier_id": str(s.supplier_id),
        "plant_id": str(s.plant_id) if s.plant_id else None,
        "ref": s.ref,
        "status": s.status,
        "components": s.components or [],
        "finished_product_id": str(s.finished_product_id) if s.finished_product_id else None,
        "finished_variant_id": str(s.finished_variant_id) if s.finished_variant_id else None,
        "qty_expected": float(s.qty_expected) if s.qty_expected is not None else 0,
        "qty_received": float(s.qty_received) if s.qty_received is not None else 0,
        "notes": s.notes,
        "created_at": s.created_at.isoformat() if s.created_at else None,
        "updated_at": s.updated_at.isoformat() if s.updated_at else None,
    }


@router.get("/subcontracting")
async def list_subcontracting_orders(
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = SubcontractingOrderRepository(db)
    skip = (page - 1) * size
    orders, total = await repo.list_by_vendor(vendor_id, status=status, skip=skip, limit=size)
    return JSONResponse(content={
        "items": [_sc_to_dict(s) for s in orders],
        "total": total,
        "page": page,
        "size": size,
        "pages": math.ceil(total / size) if size else 1,
    })


@router.get("/subcontracting/{sc_id}")
async def get_subcontracting_order(
    sc_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = SubcontractingOrderRepository(db)
    sc = await repo.get_by_vendor_and_id(vendor_id, sc_id)
    if not sc:
        raise HTTPException(status_code=404, detail="Subcontracting order not found")
    return JSONResponse(content=_sc_to_dict(sc))


@router.post("/subcontracting", status_code=status.HTTP_201_CREATED)
async def create_subcontracting_order(
    data: SubcontractingOrderCreate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    sc = SubcontractingOrder(
        vendor_id=vendor_id,
        purchase_order_id=UUID(data.purchase_order_id),
        supplier_id=UUID(data.supplier_id),
        plant_id=UUID(data.plant_id) if data.plant_id else None,
        ref=data.ref,
        components=data.components,
        finished_product_id=UUID(data.finished_product_id) if data.finished_product_id else None,
        finished_variant_id=UUID(data.finished_variant_id) if data.finished_variant_id else None,
        qty_expected=data.qty_expected or 0,
        notes=data.notes,
    )
    db.add(sc)
    await db.commit()
    await db.refresh(sc)
    return JSONResponse(content=_sc_to_dict(sc), status_code=201)


@router.put("/subcontracting/{sc_id}")
async def update_subcontracting_order(
    sc_id: UUID,
    data: SubcontractingOrderUpdate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = SubcontractingOrderRepository(db)
    sc = await repo.get_by_vendor_and_id(vendor_id, sc_id)
    if not sc:
        raise HTTPException(status_code=404, detail="Subcontracting order not found")

    for field in ["status", "components", "qty_received", "notes"]:
        val = getattr(data, field, None)
        if val is not None:
            setattr(sc, field, val)

    await db.commit()
    await db.refresh(sc)
    return JSONResponse(content=_sc_to_dict(sc))


# ── Consignment Stock ─────────────────────────────────────────────

def _cs_to_dict(c: ConsignmentStock) -> dict:
    def _f(x):
        return float(x) if x is not None else 0

    return {
        "id": str(c.id),
        "vendor_id": str(c.vendor_id),
        "supplier_id": str(c.supplier_id),
        "product_id": str(c.product_id),
        "variant_id": str(c.variant_id) if c.variant_id else None,
        "plant_id": str(c.plant_id) if c.plant_id else None,
        "storage_location_id": str(c.storage_location_id) if c.storage_location_id else None,
        "quantity_available": _f(c.quantity_available),
        "quantity_withdrawn": _f(c.quantity_withdrawn),
        "unit_price": _f(c.unit_price),
        "currency": c.currency,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }


@router.get("/consignment-stock")
async def list_consignment_stock(
    supplier_id: Optional[str] = Query(None),
    plant_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = ConsignmentStockRepository(db)
    skip = (page - 1) * size
    stocks, total = await repo.list_by_vendor(
        vendor_id,
        supplier_id=UUID(supplier_id) if supplier_id else None,
        plant_id=UUID(plant_id) if plant_id else None,
        skip=skip,
        limit=size,
    )
    return JSONResponse(content={
        "items": [_cs_to_dict(c) for c in stocks],
        "total": total,
        "page": page,
        "size": size,
    })


# ── Service Entry Sheets ──────────────────────────────────────────

def _ses_to_dict(s: ServiceEntrySheet) -> dict:
    return {
        "id": str(s.id),
        "vendor_id": str(s.vendor_id),
        "purchase_order_id": str(s.purchase_order_id),
        "supplier_id": str(s.supplier_id),
        "entry_number": s.entry_number,
        "status": s.status,
        "service_period_from": s.service_period_from.isoformat() if s.service_period_from else None,
        "service_period_to": s.service_period_to.isoformat() if s.service_period_to else None,
        "lines": s.lines or [],
        "total_amount": float(s.total_amount) if s.total_amount else 0,
        "currency": s.currency,
        "accepted_by": str(s.accepted_by) if s.accepted_by else None,
        "accepted_at": s.accepted_at.isoformat() if s.accepted_at else None,
        "notes": s.notes,
        "created_at": s.created_at.isoformat() if s.created_at else None,
        "updated_at": s.updated_at.isoformat() if s.updated_at else None,
    }


@router.get("/service-entry-sheets")
async def list_service_entry_sheets(
    status: Optional[str] = Query(None),
    purchase_order_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = ServiceEntrySheetRepository(db)
    skip = (page - 1) * size
    sheets, total = await repo.list_by_vendor(
        vendor_id,
        status=status,
        purchase_order_id=UUID(purchase_order_id) if purchase_order_id else None,
        skip=skip,
        limit=size,
    )
    return JSONResponse(content={
        "items": [_ses_to_dict(s) for s in sheets],
        "total": total,
        "page": page,
        "size": size,
        "pages": math.ceil(total / size) if size else 1,
    })


@router.get("/service-entry-sheets/{ses_id}")
async def get_service_entry_sheet(
    ses_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = ServiceEntrySheetRepository(db)
    ses = await repo.get_by_vendor_and_id(vendor_id, ses_id)
    if not ses:
        raise HTTPException(status_code=404, detail="Service entry sheet not found")
    return JSONResponse(content=_ses_to_dict(ses))


@router.post("/service-entry-sheets", status_code=status.HTTP_201_CREATED)
async def create_service_entry_sheet(
    data: ServiceEntrySheetCreate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = ServiceEntrySheetRepository(db)
    existing = await repo.get_by_entry_number(vendor_id, data.entry_number)
    if existing:
        raise HTTPException(status_code=400, detail="Service entry sheet number already exists")

    ses = ServiceEntrySheet(
        vendor_id=vendor_id,
        purchase_order_id=UUID(data.purchase_order_id),
        supplier_id=UUID(data.supplier_id),
        entry_number=data.entry_number,
        service_period_from=data.service_period_from,
        service_period_to=data.service_period_to,
        lines=data.lines,
        total_amount=data.total_amount,
        currency=data.currency or "INR",
        notes=data.notes,
    )
    db.add(ses)
    await db.commit()
    await db.refresh(ses)
    return JSONResponse(content=_ses_to_dict(ses), status_code=201)


@router.put("/service-entry-sheets/{ses_id}")
async def update_service_entry_sheet(
    ses_id: UUID,
    data: ServiceEntrySheetUpdate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = ServiceEntrySheetRepository(db)
    ses = await repo.get_by_vendor_and_id(vendor_id, ses_id)
    if not ses:
        raise HTTPException(status_code=404, detail="Service entry sheet not found")
    if ses.status not in ("draft",):
        raise HTTPException(status_code=400, detail="Only draft SES entries can be edited")

    for field in ["service_period_from", "service_period_to", "lines", "total_amount", "notes"]:
        val = getattr(data, field, None)
        if val is not None:
            setattr(ses, field, val)

    await db.commit()
    await db.refresh(ses)
    return JSONResponse(content=_ses_to_dict(ses))


@router.post("/service-entry-sheets/{ses_id}/submit")
async def submit_service_entry_sheet(
    ses_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = ServiceEntrySheetRepository(db)
    ses = await repo.get_by_vendor_and_id(vendor_id, ses_id)
    if not ses:
        raise HTTPException(status_code=404, detail="Service entry sheet not found")
    if ses.status != "draft":
        raise HTTPException(status_code=400, detail="Only draft SES entries can be submitted")

    ses.status = "submitted"
    await db.commit()
    await db.refresh(ses)
    return JSONResponse(content=_ses_to_dict(ses))


@router.post("/service-entry-sheets/{ses_id}/approve")
async def approve_service_entry_sheet(
    ses_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vendor_user: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    repo = ServiceEntrySheetRepository(db)
    ses = await repo.get_by_vendor_and_id(vendor_id, ses_id)
    if not ses:
        raise HTTPException(status_code=404, detail="Service entry sheet not found")
    if ses.status != "submitted":
        raise HTTPException(status_code=400, detail="Only submitted SES entries can be approved")

    ses.status = "approved"
    ses.accepted_by = vendor_user.id
    ses.accepted_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(ses)
    return JSONResponse(content=_ses_to_dict(ses))
