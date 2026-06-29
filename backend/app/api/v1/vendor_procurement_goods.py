# app/api/v1/vendor_procurement_goods.py
from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.deps import get_current_vendor_id, get_current_vendor_user
from app.models.vendor_user import VendorUser
from app.models.procurement_goods import GoodsBatch, GoodsMovementDocument
from app.schemas.procurement_goods import (
    GoodsBatchCreate, GoodsBatchUpdate, GoodsMovementCreate,
)
from app.repositories.procurement_goods_repo import (
    GoodsBatchRepository, GoodsMovementDocumentRepository,
)

router = APIRouter()


# ── Serialisers ───────────────────────────────────────────────────

def _batch_to_dict(b: GoodsBatch) -> dict:
    def _f(v):
        return float(v) if v is not None else 0

    return {
        "id": str(b.id),
        "vendor_id": str(b.vendor_id),
        "product_id": str(b.product_id),
        "variant_id": str(b.variant_id) if b.variant_id else None,
        "batch_number": b.batch_number,
        "serial_numbers": b.serial_numbers or [],
        "manufacturing_date": b.manufacturing_date.isoformat() if b.manufacturing_date else None,
        "expiry_date": b.expiry_date.isoformat() if b.expiry_date else None,
        "best_before_date": b.best_before_date.isoformat() if b.best_before_date else None,
        "plant_id": str(b.plant_id) if b.plant_id else None,
        "storage_location_id": str(b.storage_location_id) if b.storage_location_id else None,
        "quantity_received": _f(b.quantity_received),
        "quantity_available": _f(b.quantity_available),
        "quantity_reserved": _f(b.quantity_reserved),
        "quantity_consumed": _f(b.quantity_consumed),
        "source_type": b.source_type,
        "source_id": str(b.source_id) if b.source_id else None,
        "quality_status": b.quality_status,
        "supplier_batch_number": b.supplier_batch_number,
        "notes": b.notes,
        "is_active": b.is_active,
        "created_at": b.created_at.isoformat() if b.created_at else None,
        "updated_at": b.updated_at.isoformat() if b.updated_at else None,
    }


def _gmd_to_dict(d: GoodsMovementDocument) -> dict:
    return {
        "id": str(d.id),
        "vendor_id": str(d.vendor_id),
        "document_number": d.document_number,
        "movement_type": d.movement_type,
        "po_receipt_id": str(d.po_receipt_id) if d.po_receipt_id else None,
        "production_order_id": str(d.production_order_id) if d.production_order_id else None,
        "plant_id": str(d.plant_id) if d.plant_id else None,
        "from_storage_location_id": str(d.from_storage_location_id) if d.from_storage_location_id else None,
        "to_storage_location_id": str(d.to_storage_location_id) if d.to_storage_location_id else None,
        "lines": d.lines or [],
        "posting_date": d.posting_date.isoformat() if d.posting_date else None,
        "notes": d.notes,
        "created_at": d.created_at.isoformat() if d.created_at else None,
    }


# ── Goods Batches ─────────────────────────────────────────────────

@router.get("/goods-batches")
async def list_goods_batches(
    product_id: Optional[str] = Query(None),
    plant_id: Optional[str] = Query(None),
    quality_status: Optional[str] = Query(None),
    expiring_within_days: Optional[int] = Query(None, ge=0),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = GoodsBatchRepository(db)
    skip = (page - 1) * size
    batches, total = await repo.list_by_vendor(
        vendor_id,
        product_id=UUID(product_id) if product_id else None,
        plant_id=UUID(plant_id) if plant_id else None,
        quality_status=quality_status,
        expiring_within_days=expiring_within_days,
        skip=skip,
        limit=size,
    )
    return JSONResponse(content={
        "items": [_batch_to_dict(b) for b in batches],
        "total": total,
        "page": page,
        "size": size,
    })


@router.get("/goods-batches/{batch_id}")
async def get_goods_batch(
    batch_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = GoodsBatchRepository(db)
    batch = await repo.get_by_vendor_and_id(vendor_id, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Goods batch not found")
    return JSONResponse(content=_batch_to_dict(batch))


@router.post("/goods-batches", status_code=status.HTTP_201_CREATED)
async def create_goods_batch(
    data: GoodsBatchCreate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    batch = GoodsBatch(
        vendor_id=vendor_id,
        product_id=UUID(data.product_id),
        variant_id=UUID(data.variant_id) if data.variant_id else None,
        batch_number=data.batch_number,
        serial_numbers=data.serial_numbers or [],
        manufacturing_date=data.manufacturing_date,
        expiry_date=data.expiry_date,
        best_before_date=data.best_before_date,
        plant_id=UUID(data.plant_id) if data.plant_id else None,
        storage_location_id=UUID(data.storage_location_id) if data.storage_location_id else None,
        quantity_received=data.quantity_received,
        quantity_available=data.quantity_received,
        source_type=data.source_type,
        source_id=UUID(data.source_id) if data.source_id else None,
        quality_status=data.quality_status or "unrestricted",
        supplier_batch_number=data.supplier_batch_number,
        notes=data.notes,
    )
    db.add(batch)
    await db.commit()
    await db.refresh(batch)
    return JSONResponse(content=_batch_to_dict(batch), status_code=201)


@router.put("/goods-batches/{batch_id}")
async def update_goods_batch(
    batch_id: UUID,
    data: GoodsBatchUpdate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = GoodsBatchRepository(db)
    batch = await repo.get_by_vendor_and_id(vendor_id, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Goods batch not found")

    for field in ["quality_status", "storage_location_id", "plant_id", "expiry_date", "best_before_date", "notes", "is_active"]:
        val = getattr(data, field, None)
        if val is not None:
            if field in ("storage_location_id", "plant_id") and isinstance(val, str):
                setattr(batch, field, UUID(val))
            else:
                setattr(batch, field, val)

    await db.commit()
    await db.refresh(batch)
    return JSONResponse(content=_batch_to_dict(batch))


# ── Goods Movement Documents ──────────────────────────────────────

@router.get("/goods-movements")
async def list_goods_movements(
    movement_type: Optional[str] = Query(None),
    plant_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = GoodsMovementDocumentRepository(db)
    skip = (page - 1) * size
    docs, total = await repo.list_by_vendor(
        vendor_id,
        movement_type=movement_type,
        plant_id=UUID(plant_id) if plant_id else None,
        skip=skip,
        limit=size,
    )
    return JSONResponse(content={
        "items": [_gmd_to_dict(d) for d in docs],
        "total": total,
        "page": page,
        "size": size,
    })


@router.get("/goods-movements/{doc_id}")
async def get_goods_movement(
    doc_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = GoodsMovementDocumentRepository(db)
    doc = await repo.get_by_vendor_and_id(vendor_id, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Goods movement document not found")
    return JSONResponse(content=_gmd_to_dict(doc))


@router.post("/goods-movements", status_code=status.HTTP_201_CREATED)
async def create_goods_movement(
    data: GoodsMovementCreate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vendor_user: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    repo = GoodsMovementDocumentRepository(db)
    doc_number = await repo.get_next_document_number(vendor_id)

    doc = GoodsMovementDocument(
        vendor_id=vendor_id,
        document_number=doc_number,
        movement_type=data.movement_type.value,
        po_receipt_id=UUID(data.po_receipt_id) if data.po_receipt_id else None,
        production_order_id=UUID(data.production_order_id) if data.production_order_id else None,
        plant_id=UUID(data.plant_id) if data.plant_id else None,
        from_storage_location_id=UUID(data.from_storage_location_id) if data.from_storage_location_id else None,
        to_storage_location_id=UUID(data.to_storage_location_id) if data.to_storage_location_id else None,
        lines=data.lines,
        posting_date=data.posting_date,
        notes=data.notes,
        performed_by=vendor_user.id,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    return JSONResponse(content=_gmd_to_dict(doc), status_code=201)
