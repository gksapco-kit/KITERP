# app/api/v1/vendor_procurement_sourcing.py
from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.deps import get_current_vendor_id
from app.models.procurement_sourcing import PurchasingInfoRecord, SourceList
from app.schemas.procurement_sourcing import (
    PurchasingInfoRecordCreate, PurchasingInfoRecordUpdate,
    SourceListCreate, SourceListUpdate,
)
from app.repositories.procurement_sourcing_repo import (
    PurchasingInfoRecordRepository, SourceListRepository,
)

router = APIRouter()


# ── Helper serialisers ────────────────────────────────────────────

def _product_description(product) -> str | None:
    if not product:
        return None
    text = (product.short_description or product.description or "").strip()
    if not text:
        return None
    return text[:200] if len(text) > 200 else text


def _pir_to_dict(r: PurchasingInfoRecord) -> dict:
    d = {
        "id": str(r.id),
        "vendor_id": str(r.vendor_id),
        "supplier_id": str(r.supplier_id),
        "product_id": str(r.product_id),
        "variant_id": str(r.variant_id) if r.variant_id else None,
        "plant_id": str(r.plant_id) if r.plant_id else None,
        "currency": r.currency,
        "price": float(r.price) if r.price is not None else 0,
        "price_unit": r.price_unit or 1,
        "min_order_qty": float(r.min_order_qty) if r.min_order_qty is not None else 1,
        "max_order_qty": float(r.max_order_qty) if r.max_order_qty is not None else None,
        "order_unit": r.order_unit,
        "lead_time_days": r.lead_time_days or 0,
        "planned_delivery_days": r.planned_delivery_days or 0,
        "valid_from": r.valid_from.isoformat() if r.valid_from else None,
        "valid_to": r.valid_to.isoformat() if r.valid_to else None,
        "is_active": r.is_active,
        "notes": r.notes,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
    }
    if r.supplier:
        d["supplier_name"] = r.supplier.name
        d["supplier_contact_name"] = r.supplier.contact_name
    if r.product:
        d["product_name"] = r.product.name
        d["product_sku"] = r.product.sku
        d["product_description"] = _product_description(r.product)
    return d


def _sl_to_dict(s: SourceList) -> dict:
    d = {
        "id": str(s.id),
        "vendor_id": str(s.vendor_id),
        "product_id": str(s.product_id),
        "variant_id": str(s.variant_id) if s.variant_id else None,
        "supplier_id": str(s.supplier_id),
        "plant_id": str(s.plant_id) if s.plant_id else None,
        "valid_from": s.valid_from.isoformat() if s.valid_from else None,
        "valid_to": s.valid_to.isoformat() if s.valid_to else None,
        "is_fixed": s.is_fixed,
        "is_blocked": s.is_blocked,
        "priority": s.priority or 0,
        "notes": s.notes,
        "created_at": s.created_at.isoformat() if s.created_at else None,
        "updated_at": s.updated_at.isoformat() if s.updated_at else None,
    }
    if s.supplier:
        d["supplier_name"] = s.supplier.name
        d["supplier_contact_name"] = s.supplier.contact_name
    if s.product:
        d["product_name"] = s.product.name
        d["product_sku"] = s.product.sku
        d["product_description"] = _product_description(s.product)
    return d


# ── Purchasing Info Records ───────────────────────────────────────

@router.get("/info-records")
async def list_info_records(
    supplier_id: Optional[str] = Query(None),
    product_id: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = PurchasingInfoRecordRepository(db)
    skip = (page - 1) * size
    records, total = await repo.list_by_vendor(
        vendor_id,
        supplier_id=UUID(supplier_id) if supplier_id else None,
        product_id=UUID(product_id) if product_id else None,
        is_active=is_active,
        skip=skip,
        limit=size,
    )
    return JSONResponse(content={
        "items": [_pir_to_dict(r) for r in records],
        "total": total,
        "page": page,
        "size": size,
    })


@router.get("/info-records/{record_id}")
async def get_info_record(
    record_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = PurchasingInfoRecordRepository(db)
    record = await repo.get_by_vendor_and_id(vendor_id, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Purchasing info record not found")
    return JSONResponse(content=_pir_to_dict(record))


@router.post("/info-records", status_code=status.HTTP_201_CREATED)
async def create_info_record(
    data: PurchasingInfoRecordCreate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    record = PurchasingInfoRecord(
        vendor_id=vendor_id,
        supplier_id=UUID(data.supplier_id),
        product_id=UUID(data.product_id),
        variant_id=UUID(data.variant_id) if data.variant_id else None,
        plant_id=UUID(data.plant_id) if data.plant_id else None,
        currency=data.currency or "INR",
        price=data.price,
        price_unit=data.price_unit or 1,
        min_order_qty=data.min_order_qty or 1,
        max_order_qty=data.max_order_qty,
        order_unit=data.order_unit or "PCS",
        lead_time_days=data.lead_time_days or 0,
        planned_delivery_days=data.planned_delivery_days or 0,
        valid_from=data.valid_from,
        valid_to=data.valid_to,
        notes=data.notes,
    )
    repo = PurchasingInfoRecordRepository(db)
    db.add(record)
    await db.commit()
    record = await repo.get_by_vendor_and_id(vendor_id, record.id)
    return JSONResponse(content=_pir_to_dict(record), status_code=201)


@router.put("/info-records/{record_id}")
async def update_info_record(
    record_id: UUID,
    data: PurchasingInfoRecordUpdate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = PurchasingInfoRecordRepository(db)
    record = await repo.get_by_vendor_and_id(vendor_id, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Purchasing info record not found")

    for field in [
        "currency", "price", "price_unit", "min_order_qty", "max_order_qty",
        "order_unit", "lead_time_days", "planned_delivery_days",
        "valid_from", "valid_to", "is_active", "notes",
    ]:
        val = getattr(data, field, None)
        if val is not None:
            setattr(record, field, val)

    await db.commit()
    record = await repo.get_by_vendor_and_id(vendor_id, record_id)
    return JSONResponse(content=_pir_to_dict(record))


@router.delete("/info-records/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_info_record(
    record_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = PurchasingInfoRecordRepository(db)
    record = await repo.get_by_vendor_and_id(vendor_id, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Purchasing info record not found")
    await db.delete(record)
    await db.commit()


# ── Source List ───────────────────────────────────────────────────

@router.get("/source-list")
async def list_source_list(
    product_id: Optional[str] = Query(None),
    supplier_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = SourceListRepository(db)
    skip = (page - 1) * size
    items, total = await repo.list_by_vendor(
        vendor_id,
        supplier_id=UUID(supplier_id) if supplier_id else None,
        product_id=UUID(product_id) if product_id else None,
        skip=skip,
        limit=size,
    )
    return JSONResponse(content={
        "items": [_sl_to_dict(s) for s in items],
        "total": total,
        "page": page,
        "size": size,
    })


@router.get("/source-list/{source_id}")
async def get_source_list_entry(
    source_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = SourceListRepository(db)
    entry = await repo.get_by_vendor_and_id(vendor_id, source_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Source list entry not found")
    return JSONResponse(content=_sl_to_dict(entry))


@router.post("/source-list", status_code=status.HTTP_201_CREATED)
async def create_source_list_entry(
    data: SourceListCreate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    entry = SourceList(
        vendor_id=vendor_id,
        product_id=UUID(data.product_id),
        variant_id=UUID(data.variant_id) if data.variant_id else None,
        supplier_id=UUID(data.supplier_id),
        plant_id=UUID(data.plant_id) if data.plant_id else None,
        valid_from=data.valid_from,
        valid_to=data.valid_to,
        is_fixed=data.is_fixed or False,
        is_blocked=data.is_blocked or False,
        priority=data.priority or 0,
        notes=data.notes,
    )
    repo = SourceListRepository(db)
    db.add(entry)
    await db.commit()
    entry = await repo.get_by_vendor_and_id(vendor_id, entry.id)
    return JSONResponse(content=_sl_to_dict(entry), status_code=201)


@router.put("/source-list/{source_id}")
async def update_source_list_entry(
    source_id: UUID,
    data: SourceListUpdate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = SourceListRepository(db)
    entry = await repo.get_by_vendor_and_id(vendor_id, source_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Source list entry not found")

    for field in ["valid_from", "valid_to", "is_fixed", "is_blocked", "priority", "notes"]:
        val = getattr(data, field, None)
        if val is not None:
            setattr(entry, field, val)

    await db.commit()
    entry = await repo.get_by_vendor_and_id(vendor_id, source_id)
    return JSONResponse(content=_sl_to_dict(entry))


@router.delete("/source-list/{source_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_source_list_entry(
    source_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = SourceListRepository(db)
    entry = await repo.get_by_vendor_and_id(vendor_id, source_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Source list entry not found")
    await db.delete(entry)
    await db.commit()
