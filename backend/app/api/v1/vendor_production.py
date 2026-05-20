"""Production orders API — persisted, store-scoped."""
from __future__ import annotations

from datetime import date, datetime
from typing import Any, Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.deps import get_current_active_user, get_current_vendor_user, get_current_vendor_id
from app.models.user import User
from app.models.vendor_user import VendorUser
from app.models.customer import Customer
from app.models.store import Store
from app.models.production import ProductionOrder
from app.repositories.production_repo import ProductionOrderRepo

router = APIRouter()


def _parse_date(v: Any) -> Optional[date]:
    if v is None or v == "":
        return None
    if isinstance(v, date) and not isinstance(v, datetime):
        return v
    if isinstance(v, str):
        return date.fromisoformat(v[:10])
    return v


def _serialize(row: ProductionOrder, *, include_heavy: bool = True) -> dict:
    def d(v):
        if v is None:
            return None
        if isinstance(v, (date, datetime)):
            return v.isoformat() if isinstance(v, datetime) else v.isoformat()
        if isinstance(v, UUID):
            return str(v)
        return v

    out = {
        "id": str(row.id),
        "vendor_id": str(row.vendor_id),
        "store_id": str(row.store_id) if row.store_id else None,
        "ref": row.ref,
        "type": row.type,
        "template": row.template,
        "status": row.status,
        "progress": row.progress or 0,
        "priority": row.priority,
        "customer_id": str(row.customer_id) if row.customer_id else None,
        "customer_name": row.customer_name,
        "customer_phone": row.customer_phone,
        "customer_email": row.customer_email,
        "order_ref": row.order_ref,
        "delivery_deadline": d(row.delivery_deadline),
        "special_requirements": row.special_requirements,
        "target_stock_level": row.target_stock_level,
        "team": row.team or "",
        "target_date": d(row.target_date),
        "notes": row.notes or "",
        "items": row.items or [],
        "assignees": row.assignees or [],
        "created_at": d(row.created_at),
        "updated_at": d(row.updated_at),
    }
    if include_heavy:
        out["attachments"] = row.attachments or []
        out["stock_dispatches"] = row.stock_dispatches or []
        out["audit_log"] = row.audit_log or []
    else:
        out["attachments"] = []
        out["stock_dispatches"] = row.stock_dispatches or []
        out["audit_log"] = []
    return out


async def _validate_store(db: AsyncSession, vendor_id: UUID, store_id: Optional[UUID]) -> None:
    if not store_id:
        return
    r = await db.execute(
        select(Store).where(Store.id == store_id, Store.vendor_id == vendor_id)
    )
    if not r.scalar_one_or_none():
        raise HTTPException(400, "Invalid store for this vendor")


async def _validate_customer(db: AsyncSession, vendor_id: UUID, customer_id: Optional[UUID]) -> None:
    if not customer_id:
        return
    r = await db.execute(
        select(Customer).where(Customer.id == customer_id, Customer.vendor_id == vendor_id)
    )
    if not r.scalar_one_or_none():
        raise HTTPException(400, "Invalid customer for this vendor")


_PO_DATE_FIELDS = ("delivery_deadline", "target_date")


class ProductionOrderCreate(BaseModel):
    ref: Optional[str] = None
    type: str = Field(..., pattern="^(mto|mts)$")
    template: str = "Standard"
    status: str = "draft"
    progress: int = 0
    priority: str = "medium"
    store_id: Optional[UUID] = None
    customer_id: Optional[UUID] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    order_ref: Optional[str] = None
    delivery_deadline: Optional[date] = None
    special_requirements: Optional[str] = None
    target_stock_level: Optional[int] = None
    team: Optional[str] = ""
    target_date: Optional[date] = None
    notes: Optional[str] = ""
    items: List[dict] = Field(default_factory=list)
    assignees: List[dict] = Field(default_factory=list)
    attachments: List[dict] = Field(default_factory=list)
    stock_dispatches: List[dict] = Field(default_factory=list)
    audit_log: List[dict] = Field(default_factory=list)

    @field_validator(*_PO_DATE_FIELDS, mode="before")
    @classmethod
    def _coerce_dates(cls, v: Any) -> Optional[date]:
        return _parse_date(v)


class ProductionOrderUpdate(BaseModel):
    ref: Optional[str] = None
    template: Optional[str] = None
    status: Optional[str] = None
    progress: Optional[int] = None
    priority: Optional[str] = None
    store_id: Optional[UUID] = None
    customer_id: Optional[UUID] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    order_ref: Optional[str] = None
    delivery_deadline: Optional[date] = None
    special_requirements: Optional[str] = None
    target_stock_level: Optional[int] = None
    team: Optional[str] = None
    target_date: Optional[date] = None
    notes: Optional[str] = None
    items: Optional[List[dict]] = None
    assignees: Optional[List[dict]] = None
    attachments: Optional[List[dict]] = None
    stock_dispatches: Optional[List[dict]] = None
    audit_log: Optional[List[dict]] = None
    audit_event: Optional[dict] = None

    @field_validator(*_PO_DATE_FIELDS, mode="before")
    @classmethod
    def _coerce_dates(cls, v: Any) -> Optional[date]:
        return _parse_date(v)


class BulkImportBody(BaseModel):
    orders: List[dict]
    default_store_id: Optional[UUID] = None


@router.get("/production-orders")
async def list_production_orders(
    store_id: Optional[UUID] = Query(None, description="Filter by store; omit for all locations"),
    po_type: Optional[str] = Query(None, alias="type"),
    status: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    size: int = Query(500, ge=1, le=500),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = ProductionOrderRepo(db)
    skip = (page - 1) * size
    items, total = await repo.list(
        vendor_id,
        store_id=store_id,
        type_filter=po_type,
        status=status,
        search=search,
        skip=skip,
        limit=size,
    )
    return {
        "items": [_serialize(o, include_heavy=False) for o in items],
        "total": total,
        "page": page,
        "size": size,
    }


@router.get("/production-orders/{order_id}")
async def get_production_order(
    order_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = ProductionOrderRepo(db)
    row = await repo.get(order_id, vendor_id)
    if not row:
        raise HTTPException(404, "Production order not found")
    return _serialize(row, include_heavy=True)


@router.post("/production-orders", status_code=201)
async def create_production_order(
    body: ProductionOrderCreate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vu: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    await _validate_store(db, vendor_id, body.store_id)
    if body.type == "mto":
        await _validate_customer(db, vendor_id, body.customer_id)
    repo = ProductionOrderRepo(db)
    ref = (body.ref or "").strip() or await repo.next_ref(vendor_id, body.type)
    if await repo.get_by_ref(vendor_id, ref):
        raise HTTPException(400, f"Reference {ref} already exists")

    row = ProductionOrder(
        vendor_id=vendor_id,
        store_id=body.store_id,
        ref=ref,
        type=body.type,
        template=body.template,
        status=body.status,
        progress=body.progress,
        priority=body.priority,
        customer_id=body.customer_id,
        customer_name=body.customer_name,
        customer_phone=body.customer_phone,
        customer_email=body.customer_email,
        order_ref=body.order_ref,
        delivery_deadline=_parse_date(body.delivery_deadline),
        special_requirements=body.special_requirements,
        target_stock_level=body.target_stock_level,
        team=body.team or "",
        target_date=_parse_date(body.target_date),
        notes=body.notes or "",
        items=body.items,
        assignees=body.assignees,
        attachments=body.attachments,
        stock_dispatches=body.stock_dispatches,
        audit_log=body.audit_log,
        created_by=vu.id,
    )
    row = await repo.create(row)
    await db.commit()
    return _serialize(row, include_heavy=True)


@router.put("/production-orders/{order_id}")
async def update_production_order(
    order_id: UUID,
    body: ProductionOrderUpdate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = ProductionOrderRepo(db)
    row = await repo.get(order_id, vendor_id)
    if not row:
        raise HTTPException(404, "Production order not found")

    data = body.model_dump(exclude_none=True)
    audit_event = data.pop("audit_event", None)
    if audit_event:
        log = list(row.audit_log or [])
        log.append(audit_event)
        data["audit_log"] = log

    for date_field in ("delivery_deadline", "target_date"):
        if date_field in body.model_fields_set:
            data[date_field] = _parse_date(getattr(body, date_field))

    if "store_id" in body.model_fields_set:
        await _validate_store(db, vendor_id, body.store_id)
        data["store_id"] = body.store_id
    if body.customer_id is not None or "customer_id" in body.model_fields_set:
        cid = data.get("customer_id", row.customer_id)
        await _validate_customer(db, vendor_id, cid)

    row = await repo.update(row, data)
    await db.commit()
    return _serialize(row, include_heavy=True)


@router.delete("/production-orders/{order_id}", status_code=204)
async def delete_production_order(
    order_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = ProductionOrderRepo(db)
    row = await repo.get(order_id, vendor_id)
    if not row:
        raise HTTPException(404, "Production order not found")
    await repo.delete(row)
    await db.commit()
    return None


@router.post("/production-orders/import-local")
async def import_local_production_orders(
    body: BulkImportBody,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vu: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    """One-time import from browser localStorage payload."""
    repo = ProductionOrderRepo(db)
    created = 0
    skipped = 0
    for raw in body.orders:
        ref = str(raw.get("ref") or "").strip()
        if not ref or await repo.get_by_ref(vendor_id, ref):
            skipped += 1
            continue
        po_type = raw.get("type") or "mts"
        if po_type not in ("mto", "mts"):
            po_type = "mts"
        store_id = raw.get("store_id") or body.default_store_id
        if store_id:
            try:
                store_id = UUID(str(store_id))
                await _validate_store(db, vendor_id, store_id)
            except (ValueError, HTTPException):
                store_id = None
        cid = raw.get("customer_id")
        customer_id = UUID(str(cid)) if cid else None
        if customer_id:
            try:
                await _validate_customer(db, vendor_id, customer_id)
            except HTTPException:
                customer_id = None

        row = ProductionOrder(
            vendor_id=vendor_id,
            store_id=store_id,
            ref=ref,
            type=po_type,
            template=raw.get("template") or "Standard",
            status=raw.get("status") or "draft",
            progress=int(raw.get("progress") or 0),
            priority=raw.get("priority") or "medium",
            customer_id=customer_id,
            customer_name=raw.get("customer_name"),
            customer_phone=raw.get("customer_phone"),
            customer_email=raw.get("customer_email"),
            order_ref=raw.get("order_ref"),
            delivery_deadline=_parse_date(raw.get("delivery_deadline")),
            special_requirements=raw.get("special_requirements"),
            target_stock_level=raw.get("target_stock_level"),
            team=raw.get("team") or "",
            target_date=_parse_date(raw.get("target_date")),
            notes=raw.get("notes") or "",
            items=raw.get("items") or [],
            assignees=raw.get("assignees") or [],
            attachments=raw.get("attachments") or [],
            stock_dispatches=raw.get("stock_dispatches") or [],
            audit_log=raw.get("audit_log") or [],
            created_by=vu.id,
        )
        await repo.create(row)
        created += 1
    await db.commit()
    return {"created": created, "skipped": skipped}
