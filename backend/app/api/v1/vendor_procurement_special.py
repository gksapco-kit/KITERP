# app/api/v1/vendor_procurement_special.py
import math
from uuid import UUID
from typing import Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import JSONResponse
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.api.deps import get_current_vendor_id, get_current_vendor_user, require_permission
from app.models.vendor_user import VendorUser
from app.models.vendor_product import Product
from app.models.procurement_special import (
    MaterialValuation, SubcontractingOrder, ConsignmentStock, ServiceEntrySheet,
)
from app.schemas.procurement_special import (
    MaterialValuationCreate, MaterialValuationUpdate,
    SubcontractingOrderCreate, SubcontractingOrderUpdate,
    ConsignmentStockCreate, ConsignmentStockUpdate, ConsignmentWithdraw,
    ServiceEntrySheetCreate, ServiceEntrySheetUpdate,
)
from app.models.procurement import PurchaseOrder, Supplier
from app.repositories.procurement_special_repo import (
    MaterialValuationRepository, SubcontractingOrderRepository,
    ConsignmentStockRepository, ServiceEntrySheetRepository,
)

router = APIRouter(dependencies=[Depends(require_permission("procurement.view"))])


# ── Material Valuation ────────────────────────────────────────────

def _mv_to_dict(v: MaterialValuation) -> dict:
    def _f(x):
        return float(x) if x is not None else 0

    return {
        "id": str(v.id),
        "vendor_id": str(v.vendor_id),
        "product_id": str(v.product_id),
        "product_name": v.product.name if v.product else None,
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
    from sqlalchemy import func as sqlfunc

    conditions = [MaterialValuation.vendor_id == vendor_id]
    if product_id:
        conditions.append(MaterialValuation.product_id == UUID(product_id))
    if plant_id:
        conditions.append(MaterialValuation.plant_id == UUID(plant_id))

    total = (await db.execute(
        select(sqlfunc.count()).select_from(MaterialValuation).where(and_(*conditions))
    )).scalar_one()

    result = await db.execute(
        select(MaterialValuation)
        .options(selectinload(MaterialValuation.product))
        .where(and_(*conditions))
        .order_by(MaterialValuation.updated_at.desc())
        .offset((page - 1) * size)
        .limit(size)
    )
    records = list(result.scalars().all())

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

def _sc_load_options():
    return (
        selectinload(SubcontractingOrder.supplier),
        selectinload(SubcontractingOrder.finished_product),
    )


def _sc_to_dict(s: SubcontractingOrder) -> dict:
    # Enrich stored components with product_name where available
    name_map: dict = getattr(s, "_product_name_map", {})
    components = []
    for c in (s.components or []):
        row = dict(c)
        if not row.get("product_name") and name_map:
            pid = row.get("product_id")
            if pid:
                row["product_name"] = name_map.get(pid)
        components.append(row)

    return {
        "id": str(s.id),
        "vendor_id": str(s.vendor_id),
        "purchase_order_id": str(s.purchase_order_id),
        "supplier_id": str(s.supplier_id),
        "supplier_name": s.supplier.name if s.supplier else None,
        "plant_id": str(s.plant_id) if s.plant_id else None,
        "ref": s.ref,
        "status": s.status,
        "components": components,
        "finished_product_id": str(s.finished_product_id) if s.finished_product_id else None,
        "finished_product_name": s.finished_product.name if s.finished_product else None,
        "finished_variant_id": str(s.finished_variant_id) if s.finished_variant_id else None,
        "qty_expected": float(s.qty_expected) if s.qty_expected is not None else 0,
        "qty_received": float(s.qty_received) if s.qty_received is not None else 0,
        "notes": s.notes,
        "created_at": s.created_at.isoformat() if s.created_at else None,
        "updated_at": s.updated_at.isoformat() if s.updated_at else None,
    }


async def _enrich_sc_product_names(db: AsyncSession, orders: list[SubcontractingOrder]) -> None:
    """Attach a transient _product_name_map to each order for component name resolution."""
    all_pids: set[UUID] = set()
    for sc in orders:
        for c in (sc.components or []):
            pid = c.get("product_id")
            if pid:
                try:
                    all_pids.add(UUID(pid))
                except ValueError:
                    pass
        if sc.finished_product_id:
            all_pids.add(sc.finished_product_id)

    name_map: dict[str, str] = {}
    if all_pids:
        result = await db.execute(
            select(Product.id, Product.name).where(Product.id.in_(all_pids))
        )
        for row in result.all():
            name_map[str(row.id)] = row.name

    for sc in orders:
        sc._product_name_map = name_map  # type: ignore[attr-defined]


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

    result2 = await db.execute(
        select(SubcontractingOrder)
        .options(*_sc_load_options())
        .where(SubcontractingOrder.id.in_([o.id for o in orders]))
        .order_by(SubcontractingOrder.created_at.desc())
    )
    loaded = list(result2.scalars().all())
    await _enrich_sc_product_names(db, loaded)

    return JSONResponse(content={
        "items": [_sc_to_dict(s) for s in loaded],
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
    result = await db.execute(
        select(SubcontractingOrder)
        .options(*_sc_load_options())
        .where(SubcontractingOrder.vendor_id == vendor_id, SubcontractingOrder.id == sc_id)
    )
    sc = result.scalar_one_or_none()
    if not sc:
        raise HTTPException(status_code=404, detail="Subcontracting order not found")
    await _enrich_sc_product_names(db, [sc])
    return JSONResponse(content=_sc_to_dict(sc))


@router.post("/subcontracting", status_code=status.HTTP_201_CREATED)
async def create_subcontracting_order(
    data: SubcontractingOrderCreate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    # Verify the PO belongs to this vendor
    po_result = await db.execute(
        select(PurchaseOrder).where(
            PurchaseOrder.id == UUID(data.purchase_order_id),
            PurchaseOrder.vendor_id == vendor_id,
        )
    )
    if not po_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Purchase order not found")

    # Verify the supplier belongs to this vendor
    sup_result = await db.execute(
        select(Supplier).where(
            Supplier.id == UUID(data.supplier_id),
            Supplier.vendor_id == vendor_id,
        )
    )
    if not sup_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Supplier not found")

    # Soft uniqueness check on ref per vendor
    dup = await db.execute(
        select(SubcontractingOrder).where(
            SubcontractingOrder.vendor_id == vendor_id,
            SubcontractingOrder.ref == data.ref,
        )
    )
    if dup.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"Reference '{data.ref}' already exists for another subcontracting order")

    sc = SubcontractingOrder(
        vendor_id=vendor_id,
        purchase_order_id=UUID(data.purchase_order_id),
        supplier_id=UUID(data.supplier_id),
        plant_id=UUID(data.plant_id) if data.plant_id else None,
        ref=data.ref,
        components=[c.model_dump() for c in data.components],
        finished_product_id=UUID(data.finished_product_id) if data.finished_product_id else None,
        finished_variant_id=UUID(data.finished_variant_id) if data.finished_variant_id else None,
        qty_expected=data.qty_expected or 0,
        notes=data.notes,
    )
    db.add(sc)
    await db.commit()

    result = await db.execute(
        select(SubcontractingOrder)
        .options(*_sc_load_options())
        .where(SubcontractingOrder.id == sc.id)
    )
    sc = result.scalar_one()
    await _enrich_sc_product_names(db, [sc])
    return JSONResponse(content=_sc_to_dict(sc), status_code=201)


@router.put("/subcontracting/{sc_id}")
async def update_subcontracting_order(
    sc_id: UUID,
    data: SubcontractingOrderUpdate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SubcontractingOrder)
        .options(*_sc_load_options())
        .where(SubcontractingOrder.vendor_id == vendor_id, SubcontractingOrder.id == sc_id)
    )
    sc = result.scalar_one_or_none()
    if not sc:
        raise HTTPException(status_code=404, detail="Subcontracting order not found")

    if data.status is not None:
        sc.status = data.status
    if data.components is not None:
        sc.components = [c.model_dump() for c in data.components]
    if data.qty_received is not None:
        sc.qty_received = data.qty_received
    if data.notes is not None:
        sc.notes = data.notes

    await db.commit()

    result2 = await db.execute(
        select(SubcontractingOrder)
        .options(*_sc_load_options())
        .where(SubcontractingOrder.id == sc_id)
    )
    sc = result2.scalar_one()
    await _enrich_sc_product_names(db, [sc])
    return JSONResponse(content=_sc_to_dict(sc))


# ── Consignment Stock ─────────────────────────────────────────────

def _cs_to_dict(c: ConsignmentStock) -> dict:
    def _f(x):
        return float(x) if x is not None else 0

    return {
        "id": str(c.id),
        "vendor_id": str(c.vendor_id),
        "supplier_id": str(c.supplier_id),
        "supplier_name": c.supplier.name if c.supplier else None,
        "product_id": str(c.product_id),
        "product_name": c.product.name if c.product else None,
        "variant_id": str(c.variant_id) if c.variant_id else None,
        "plant_id": str(c.plant_id) if c.plant_id else None,
        "storage_location_id": str(c.storage_location_id) if c.storage_location_id else None,
        "purchase_order_id": str(c.purchase_order_id) if c.purchase_order_id else None,
        "po_number": c.purchase_order.po_number if c.purchase_order else None,
        "quantity_available": _f(c.quantity_available),
        "quantity_withdrawn": _f(c.quantity_withdrawn),
        "unit_price": _f(c.unit_price),
        "currency": c.currency,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }


def _cs_load_options():
    return (
        selectinload(ConsignmentStock.supplier),
        selectinload(ConsignmentStock.product),
        selectinload(ConsignmentStock.purchase_order),
    )


@router.get("/consignment-stock")
async def list_consignment_stock(
    supplier_id: Optional[str] = Query(None),
    plant_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import func as sqlfunc
    conditions = [ConsignmentStock.vendor_id == vendor_id]
    if supplier_id:
        conditions.append(ConsignmentStock.supplier_id == UUID(supplier_id))
    if plant_id:
        conditions.append(ConsignmentStock.plant_id == UUID(plant_id))

    total = (await db.execute(
        select(sqlfunc.count()).select_from(ConsignmentStock).where(and_(*conditions))
    )).scalar_one()

    result = await db.execute(
        select(ConsignmentStock)
        .options(*_cs_load_options())
        .where(and_(*conditions))
        .order_by(ConsignmentStock.updated_at.desc())
        .offset((page - 1) * size)
        .limit(size)
    )
    stocks = list(result.scalars().all())

    return JSONResponse(content={
        "items": [_cs_to_dict(c) for c in stocks],
        "total": total,
        "page": page,
        "size": size,
    })


@router.post("/consignment-stock", status_code=status.HTTP_201_CREATED)
async def create_consignment_stock(
    data: ConsignmentStockCreate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Create or upsert a consignment stock record for a supplier+product combination."""
    repo = ConsignmentStockRepository(db)
    existing = await repo.get_by_supplier_and_product(
        vendor_id,
        UUID(data.supplier_id),
        UUID(data.product_id),
        plant_id=UUID(data.plant_id) if data.plant_id else None,
    )
    if existing:
        # Upsert: add quantity to existing record
        from decimal import Decimal
        existing.quantity_available = (existing.quantity_available or 0) + Decimal(str(data.quantity_available))
        if data.unit_price:
            existing.unit_price = data.unit_price
        if data.currency:
            existing.currency = data.currency
        if data.purchase_order_id:
            existing.purchase_order_id = UUID(data.purchase_order_id)
        await db.commit()
        result = await db.execute(
            select(ConsignmentStock)
            .options(*_cs_load_options())
            .where(ConsignmentStock.id == existing.id)
        )
        return JSONResponse(content=_cs_to_dict(result.scalar_one()))

    record = ConsignmentStock(
        vendor_id=vendor_id,
        supplier_id=UUID(data.supplier_id),
        product_id=UUID(data.product_id),
        variant_id=UUID(data.variant_id) if data.variant_id else None,
        plant_id=UUID(data.plant_id) if data.plant_id else None,
        storage_location_id=UUID(data.storage_location_id) if data.storage_location_id else None,
        purchase_order_id=UUID(data.purchase_order_id) if data.purchase_order_id else None,
        quantity_available=data.quantity_available,
        quantity_withdrawn=0,
        unit_price=data.unit_price,
        currency=data.currency or "INR",
    )
    db.add(record)
    await db.commit()
    result = await db.execute(
        select(ConsignmentStock)
        .options(*_cs_load_options())
        .where(ConsignmentStock.id == record.id)
    )
    return JSONResponse(content=_cs_to_dict(result.scalar_one()), status_code=201)


@router.put("/consignment-stock/{cs_id}")
async def update_consignment_stock(
    cs_id: UUID,
    data: ConsignmentStockUpdate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ConsignmentStock)
        .options(*_cs_load_options())
        .where(ConsignmentStock.id == cs_id, ConsignmentStock.vendor_id == vendor_id)
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Consignment stock record not found")

    for field in ["unit_price", "currency", "plant_id", "storage_location_id"]:
        val = getattr(data, field, None)
        if val is not None:
            setattr(record, field, val)
    if data.quantity_available is not None:
        record.quantity_available = data.quantity_available
    if data.purchase_order_id is not None:
        record.purchase_order_id = UUID(data.purchase_order_id) if data.purchase_order_id else None

    await db.commit()
    result = await db.execute(
        select(ConsignmentStock)
        .options(*_cs_load_options())
        .where(ConsignmentStock.id == cs_id)
    )
    return JSONResponse(content=_cs_to_dict(result.scalar_one()))


@router.post("/consignment-stock/{cs_id}/withdraw")
async def withdraw_consignment_stock(
    cs_id: UUID,
    data: ConsignmentWithdraw,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Withdraw (consume) quantity from consignment stock. Liability transfers on withdrawal."""
    from decimal import Decimal
    result = await db.execute(
        select(ConsignmentStock)
        .options(*_cs_load_options())
        .where(ConsignmentStock.id == cs_id, ConsignmentStock.vendor_id == vendor_id)
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Consignment stock record not found")

    qty = Decimal(str(data.quantity))
    available = record.quantity_available or Decimal("0")
    if qty > available:
        raise HTTPException(
            status_code=400,
            detail=f"Withdrawal quantity {float(qty)} exceeds available stock {float(available)}",
        )

    record.quantity_available = available - qty
    record.quantity_withdrawn = (record.quantity_withdrawn or Decimal("0")) + qty

    await db.commit()
    result = await db.execute(
        select(ConsignmentStock)
        .options(*_cs_load_options())
        .where(ConsignmentStock.id == cs_id)
    )
    return JSONResponse(content=_cs_to_dict(result.scalar_one()))


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
