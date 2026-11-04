"""Production orders API — persisted, store-scoped.

Rules enforced here (see also app/services/production_lifecycle.py):
  * writes need ``production.manage`` (reads ``production.view``)
  * status changes only through the lifecycle state machine
  * order row is locked (SELECT … FOR UPDATE) for every update/delete
  * items / business unit / plant / output location are frozen after the order
    leaves draft; completed & cancelled orders are read-only except notes/attachments
  * the audit trail is written by the server using the logged-in user — clients
    cannot supply or replace it
"""
from __future__ import annotations

from datetime import date, datetime
from typing import Any, List, Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.deps import get_current_active_user, get_current_vendor_user, get_current_vendor_id
from app.api.v1.production_access import production_view, production_manage
from app.models.user import User
from app.models.vendor_user import VendorUser
from app.models.customer import Customer
from app.models.store import Store
from app.models.production import ProductionOrder
from app.models.plant import Plant
from app.models.storage_location import StorageLocation
from app.models.vendor_product import Product
from app.repositories.production_repo import ProductionOrderRepo
from app.services.production_lifecycle import (
    TERMINAL_STATUSES,
    TransitionError,
    append_audit,
    transition_order,
)
from app.services.production_materials import release_materials

router = APIRouter(dependencies=[Depends(production_view)])

POStatusLit = Literal["draft", "confirmed", "in_production", "qc", "on_hold", "completed", "cancelled"]
PriorityLit = Literal["low", "medium", "high", "urgent"]

MAX_ATTACHMENTS = 20
MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
MAX_DATA_URL_CHARS = 14_500_000  # ~10 MB of binary as base64
MAX_IMPORT_ORDERS = 200

# Fields that define *what* is produced and *where* — frozen once the order leaves draft.
_STRUCTURAL_FIELDS = ("items", "store_id", "plant_id", "output_storage_location_id", "ref")
# Fields still editable on completed / cancelled orders.
_TERMINAL_EDITABLE = {"status", "notes", "attachments"}


# ── Value helpers ─────────────────────────────────────────────────────────

def _parse_date(v: Any) -> Optional[date]:
    if v is None or v == "":
        return None
    if isinstance(v, date) and not isinstance(v, datetime):
        return v
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, str):
        return date.fromisoformat(v[:10])
    return v


def _serialize(row: ProductionOrder, *, include_heavy: bool = True) -> dict:
    def d(v):
        if v is None:
            return None
        if isinstance(v, (date, datetime)):
            return v.isoformat()
        if isinstance(v, UUID):
            return str(v)
        return v

    out = {
        "id": str(row.id),
        "vendor_id": str(row.vendor_id),
        "store_id": str(row.store_id) if row.store_id else None,
        "plant_id": str(row.plant_id) if row.plant_id else None,
        "output_storage_location_id": str(row.output_storage_location_id) if row.output_storage_location_id else None,
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
        # Materials (BOM/MRP) — see app/services/production_materials.py
        "material_requirements": row.material_requirements or [],
        "materials_reserved_at": d(row.materials_reserved_at),
        "materials_released_at": d(row.materials_released_at),
        "inventory_posted_at": d(row.inventory_posted_at),
        # Costing (Phase 7)
        "planned_material_cost": float(row.planned_material_cost) if row.planned_material_cost is not None else None,
        "planned_labor_cost": float(row.planned_labor_cost) if row.planned_labor_cost is not None else None,
        "actual_material_cost": float(row.actual_material_cost) if row.actual_material_cost is not None else None,
        "actual_labor_cost": float(row.actual_labor_cost) if row.actual_labor_cost is not None else None,
    }
    if include_heavy:
        out["attachments"] = row.attachments or []
        out["stock_dispatches"] = row.stock_dispatches or []
        out["audit_log"] = row.audit_log or []
        out["inventory_posting"] = row.inventory_posting
    else:
        out["attachments"] = []
        out["stock_dispatches"] = row.stock_dispatches or []
        out["audit_log"] = []
    return out


def _actor(user: User) -> str:
    return (getattr(user, "full_name", None) or getattr(user, "email", None) or "User").strip()


# ── Reference validation ──────────────────────────────────────────────────

async def _validate_store(db: AsyncSession, vendor_id: UUID, store_id: Optional[UUID]) -> None:
    if not store_id:
        return
    r = await db.execute(
        select(Store).where(Store.id == store_id, Store.vendor_id == vendor_id)
    )
    if not r.scalar_one_or_none():
        raise HTTPException(400, "Invalid store for this vendor")


async def _validate_plant(
    db: AsyncSession,
    vendor_id: UUID,
    plant_id: Optional[UUID],
    store_id: Optional[UUID],
) -> None:
    if not plant_id:
        return
    r = await db.execute(
        select(Plant).where(Plant.id == plant_id, Plant.vendor_id == vendor_id)
    )
    plant = r.scalar_one_or_none()
    if not plant:
        raise HTTPException(400, "Invalid plant for this vendor")
    if store_id and plant.store_id != store_id:
        raise HTTPException(400, "Plant does not belong to the selected business unit")


async def _validate_output_location(
    db: AsyncSession,
    vendor_id: UUID,
    location_id: Optional[UUID],
    plant_id: Optional[UUID],
) -> None:
    if not location_id:
        return
    r = await db.execute(
        select(StorageLocation).where(
            StorageLocation.id == location_id,
            StorageLocation.vendor_id == vendor_id,
        )
    )
    loc = r.scalar_one_or_none()
    if not loc:
        raise HTTPException(400, "Invalid output storage location for this vendor")
    if plant_id and loc.plant_id != plant_id:
        raise HTTPException(400, "Output storage location does not belong to the selected plant")


async def _validate_customer(db: AsyncSession, vendor_id: UUID, customer_id: Optional[UUID]) -> None:
    if not customer_id:
        return
    r = await db.execute(
        select(Customer).where(Customer.id == customer_id, Customer.vendor_id == vendor_id)
    )
    if not r.scalar_one_or_none():
        raise HTTPException(400, "Invalid customer for this vendor")


async def _validate_items(db: AsyncSession, vendor_id: UUID, items: list[dict]) -> None:
    """Every product line must reference a product of this vendor."""
    pids: set[UUID] = set()
    for it in items:
        if it.get("item_type", "product") == "product" and it.get("product_id"):
            pids.add(UUID(str(it["product_id"])))
    if not pids:
        return
    found = set((await db.execute(
        select(Product.id).where(Product.vendor_id == vendor_id, Product.id.in_(pids))
    )).scalars().all())
    missing = pids - found
    if missing:
        raise HTTPException(400, f"Unknown product(s) in order items: {', '.join(sorted(str(m) for m in missing))}")


# ── Request models ────────────────────────────────────────────────────────

class OrderItemIn(BaseModel):
    """One output line. Extra UI fields (sku, variant info, priority …) pass through."""
    model_config = ConfigDict(extra="allow")
    item_type: Literal["product", "service"] = "product"
    product_id: Optional[UUID] = None
    name: str = Field("", max_length=255)
    qty: float = Field(..., gt=0, le=10_000_000)
    produced: Optional[float] = Field(None, ge=0, le=10_000_000)


class AssigneeIn(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: str = Field(..., max_length=64)
    name: str = Field("", max_length=255)
    role: str = Field("", max_length=100)
    type: Literal["team", "supplier"] = "team"


class AttachmentIn(BaseModel):
    model_config = ConfigDict(extra="allow")
    name: str = Field(..., max_length=255)
    type: str = Field("", max_length=100)
    size: int = Field(0, ge=0, le=MAX_ATTACHMENT_BYTES)
    dataUrl: str = Field("", max_length=MAX_DATA_URL_CHARS)

    @field_validator("dataUrl")
    @classmethod
    def _data_url_shape(cls, v: str) -> str:
        # Only embedded data: URLs (as produced by the UI) or already-stored http(s)/relative URLs.
        if v and not (v.startswith("data:") or v.startswith("/") or v.startswith("https://") or v.startswith("http://")):
            raise ValueError("Unsupported attachment URL")
        return v


class DispatchIn(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: str = Field(..., max_length=64)
    date: str = Field("", max_length=32)
    qty: float = Field(..., gt=0, le=10_000_000)
    notes: str = Field("", max_length=500)
    by: str = Field("", max_length=120)


_PO_DATE_FIELDS = ("delivery_deadline", "target_date")


class ProductionOrderCreate(BaseModel):
    ref: Optional[str] = Field(None, max_length=40)
    type: str = Field(..., pattern="^(mto|mts)$")
    template: str = Field("Standard", max_length=80)
    # Orders are created as drafts, optionally confirmed straight away. Later
    # stages are reached through status changes so stock side-effects always run.
    status: Literal["draft", "confirmed"] = "draft"
    progress: int = Field(0, ge=0, le=100)
    priority: PriorityLit = "medium"
    store_id: Optional[UUID] = None
    plant_id: Optional[UUID] = None
    output_storage_location_id: Optional[UUID] = None
    customer_id: Optional[UUID] = None
    customer_name: Optional[str] = Field(None, max_length=255)
    customer_phone: Optional[str] = Field(None, max_length=30)
    customer_email: Optional[str] = Field(None, max_length=255)
    order_ref: Optional[str] = Field(None, max_length=100)
    delivery_deadline: Optional[date] = None
    special_requirements: Optional[str] = Field(None, max_length=5000)
    target_stock_level: Optional[int] = Field(None, ge=0, le=100_000_000)
    team: Optional[str] = Field("", max_length=120)
    target_date: Optional[date] = None
    notes: Optional[str] = Field("", max_length=10000)
    items: List[OrderItemIn] = Field(default_factory=list, max_length=500)
    assignees: List[AssigneeIn] = Field(default_factory=list, max_length=100)
    attachments: List[AttachmentIn] = Field(default_factory=list, max_length=MAX_ATTACHMENTS)
    stock_dispatches: List[DispatchIn] = Field(default_factory=list, max_length=1000)

    @field_validator(*_PO_DATE_FIELDS, mode="before")
    @classmethod
    def _coerce_dates(cls, v: Any) -> Optional[date]:
        return _parse_date(v)


class ProductionOrderUpdate(BaseModel):
    ref: Optional[str] = Field(None, max_length=40)
    template: Optional[str] = Field(None, max_length=80)
    status: Optional[POStatusLit] = None
    progress: Optional[int] = Field(None, ge=0, le=100)
    priority: Optional[PriorityLit] = None
    store_id: Optional[UUID] = None
    plant_id: Optional[UUID] = None
    output_storage_location_id: Optional[UUID] = None
    customer_id: Optional[UUID] = None
    customer_name: Optional[str] = Field(None, max_length=255)
    customer_phone: Optional[str] = Field(None, max_length=30)
    customer_email: Optional[str] = Field(None, max_length=255)
    order_ref: Optional[str] = Field(None, max_length=100)
    delivery_deadline: Optional[date] = None
    special_requirements: Optional[str] = Field(None, max_length=5000)
    target_stock_level: Optional[int] = Field(None, ge=0, le=100_000_000)
    team: Optional[str] = Field(None, max_length=120)
    target_date: Optional[date] = None
    notes: Optional[str] = Field(None, max_length=10000)
    items: Optional[List[OrderItemIn]] = Field(None, max_length=500)
    assignees: Optional[List[AssigneeIn]] = Field(None, max_length=100)
    attachments: Optional[List[AttachmentIn]] = Field(None, max_length=MAX_ATTACHMENTS)
    stock_dispatches: Optional[List[DispatchIn]] = Field(None, max_length=1000)
    # NOTE: audit_log / audit_event are deliberately not accepted — the server owns the trail.

    @field_validator(*_PO_DATE_FIELDS, mode="before")
    @classmethod
    def _coerce_dates(cls, v: Any) -> Optional[date]:
        return _parse_date(v)


class BulkImportBody(BaseModel):
    orders: List[dict] = Field(..., max_length=MAX_IMPORT_ORDERS)
    default_store_id: Optional[UUID] = None


def _dump_list(models: Optional[list[BaseModel]]) -> Optional[list[dict]]:
    if models is None:
        return None
    return [m.model_dump(mode="json") for m in models]


def _items_signature(items: Optional[list[dict]]) -> list[tuple]:
    """Canonical view of what an items list *means* (ignores cosmetic fields)."""
    sig = []
    for it in items or []:
        sig.append((
            it.get("item_type") or "product",
            str(it.get("product_id") or ""),
            str(it.get("variant_id") or ""),
            round(float(it.get("qty") or 0), 6),
        ))
    return sorted(sig)


def _commit_error(exc: Exception) -> HTTPException:
    if isinstance(exc, TransitionError):
        return HTTPException(409, str(exc))
    return HTTPException(400, str(exc))


# ── Routes ────────────────────────────────────────────────────────────────

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


@router.post("/production-orders", status_code=201, dependencies=[Depends(production_manage)])
async def create_production_order(
    body: ProductionOrderCreate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vu: VendorUser = Depends(get_current_vendor_user),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    actor = _actor(current_user)
    items = _dump_list(body.items) or []

    await _validate_store(db, vendor_id, body.store_id)
    await _validate_plant(db, vendor_id, body.plant_id, body.store_id)
    await _validate_output_location(db, vendor_id, body.output_storage_location_id, body.plant_id)
    if body.type == "mto":
        await _validate_customer(db, vendor_id, body.customer_id)
    await _validate_items(db, vendor_id, items)

    repo = ProductionOrderRepo(db)
    ref = (body.ref or "").strip() or await repo.next_ref(vendor_id, body.type)
    if await repo.get_by_ref(vendor_id, ref):
        raise HTTPException(400, f"Reference {ref} already exists")

    row = ProductionOrder(
        vendor_id=vendor_id,
        store_id=body.store_id,
        plant_id=body.plant_id,
        output_storage_location_id=body.output_storage_location_id,
        ref=ref,
        type=body.type,
        template=body.template,
        status="draft",
        progress=body.progress,
        priority=body.priority,
        customer_id=body.customer_id,
        customer_name=body.customer_name,
        customer_phone=body.customer_phone,
        customer_email=body.customer_email,
        order_ref=body.order_ref,
        delivery_deadline=body.delivery_deadline,
        special_requirements=body.special_requirements,
        target_stock_level=body.target_stock_level,
        team=body.team or "",
        target_date=body.target_date,
        notes=body.notes or "",
        items=items,
        assignees=_dump_list(body.assignees) or [],
        attachments=_dump_list(body.attachments) or [],
        stock_dispatches=_dump_list(body.stock_dispatches) or [],
        audit_log=[],
        created_by=vu.id,
    )
    try:
        row = await repo.create(row)
    except IntegrityError:
        # Lost a race on the (vendor, ref) unique constraint.
        await db.rollback()
        raise HTTPException(400, f"Reference {ref} already exists")

    append_audit(
        row, "created", f"Order {ref} created as Draft",
        actor=actor, meta={"items": len(items), "type": body.type},
    )

    if body.status != "draft":
        try:
            await transition_order(db, vendor_id, row, body.status, actor=actor, actor_id=vu.id)
        except ValueError as exc:
            await db.rollback()
            raise _commit_error(exc)

    await db.commit()
    await db.refresh(row)
    return _serialize(row, include_heavy=True)


def _audit_field_changes(
    row: ProductionOrder,
    before: dict[str, Any],
    actor: str,
) -> None:
    """Server-generated audit entries for non-status edits."""
    if (row.progress or 0) != (before["progress"] or 0):
        append_audit(row, "progress_updated", f"Progress: {before['progress'] or 0}% → {row.progress or 0}%", actor=actor)
    if row.priority != before["priority"]:
        append_audit(row, "priority_changed", f"Priority: {before['priority']} → {row.priority}", actor=actor)
    if (row.notes or "") != (before["notes"] or ""):
        preview = (row.notes or "")[:80]
        append_audit(row, "notes_updated", f'Instructions updated: "{preview or "(cleared)"}"', actor=actor)
    if row.assignees != before["assignees"]:
        names = ", ".join(a.get("name", "") for a in (row.assignees or [])) or "(none)"
        append_audit(row, "assignees_updated", f"Assigned to: {names}", actor=actor, meta={"count": len(row.assignees or [])})
    old_att, new_att = len(before["attachments"]), len(row.attachments or [])
    if new_att > old_att:
        added = [a.get("name", "") for a in (row.attachments or [])[old_att:]]
        append_audit(row, "file_attached", f"{new_att - old_att} file(s) attached: {', '.join(added)}", actor=actor, meta={"count": new_att - old_att})
    elif new_att < old_att:
        append_audit(row, "file_removed", f"{old_att - new_att} file(s) removed", actor=actor, meta={"count": old_att - new_att})
    old_disp, new_disp = before["stock_dispatches"], row.stock_dispatches or []
    if len(new_disp) > len(old_disp):
        for disp in new_disp[len(old_disp):]:
            append_audit(
                row, "stock_dispatched",
                f"{disp.get('qty')} unit(s) dispatched to stock" + (f" by {disp.get('by')}" if disp.get("by") else ""),
                actor=actor, meta={"qty": disp.get("qty")},
            )
    if _items_signature(row.items) != before["items_sig"]:
        grew = len(row.items or []) > before["items_count"]
        append_audit(
            row, "item_added" if grew else "items_updated",
            f"Order items changed ({before['items_count']} → {len(row.items or [])} lines)",
            actor=actor,
        )


@router.put("/production-orders/{order_id}", dependencies=[Depends(production_manage)])
async def update_production_order(
    order_id: UUID,
    body: ProductionOrderUpdate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vu: VendorUser = Depends(get_current_vendor_user),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    repo = ProductionOrderRepo(db)
    # Row lock: concurrent updates/transitions of this order queue up here.
    row = await repo.get(order_id, vendor_id, for_update=True)
    if not row:
        raise HTTPException(404, "Production order not found")

    actor = _actor(current_user)
    fields = body.model_fields_set
    old_status = row.status or "draft"
    new_status = body.status if ("status" in fields and body.status) else old_status
    status_changing = new_status != old_status

    # ── Edit-permission rules by status ───────────────────────────────────
    if not status_changing and old_status in TERMINAL_STATUSES:
        blocked = sorted(f for f in fields if f not in _TERMINAL_EDITABLE)
        if blocked:
            raise HTTPException(
                409,
                f"A {old_status} order is read-only (only notes and attachments can change). "
                f"Re-open it to edit: {', '.join(blocked)}.",
            )

    structural_open = old_status == "draft" or new_status == "draft"
    if not structural_open:
        locked_changes: list[str] = []
        if "items" in fields and body.items is not None and \
                _items_signature(_dump_list(body.items)) != _items_signature(row.items):
            locked_changes.append("items")
        for f in ("store_id", "plant_id", "output_storage_location_id"):
            if f in fields and getattr(body, f) != getattr(row, f):
                locked_changes.append(f)
        if "ref" in fields and body.ref and body.ref.strip() != row.ref:
            locked_changes.append("ref")
        if locked_changes:
            raise HTTPException(
                409,
                f"{', '.join(locked_changes)} cannot be changed once the order is confirmed. "
                "Move it back to draft first.",
            )

    # ── Reference validation ──────────────────────────────────────────────
    effective_store = body.store_id if "store_id" in fields else row.store_id
    effective_plant = body.plant_id if "plant_id" in fields else row.plant_id
    if "store_id" in fields:
        await _validate_store(db, vendor_id, body.store_id)
    if "plant_id" in fields or "store_id" in fields:
        await _validate_plant(db, vendor_id, effective_plant, effective_store)
    if "output_storage_location_id" in fields or "plant_id" in fields:
        loc = body.output_storage_location_id if "output_storage_location_id" in fields else row.output_storage_location_id
        await _validate_output_location(db, vendor_id, loc, effective_plant)
    if "customer_id" in fields and body.customer_id is not None:
        await _validate_customer(db, vendor_id, body.customer_id)
    new_ref: Optional[str] = None
    if "ref" in fields and body.ref is not None:
        new_ref = body.ref.strip()
        if not new_ref:
            raise HTTPException(400, "Reference cannot be empty")
        if new_ref != row.ref and await repo.get_by_ref(vendor_id, new_ref):
            raise HTTPException(400, f"Reference {new_ref} already exists")
    items_payload = _dump_list(body.items)
    if items_payload is not None:
        await _validate_items(db, vendor_id, items_payload)

    # Produced quantities are owned by recorded output / completion; a stale client copy of the
    # order must not overwrite them.
    if items_payload is not None and row.partial_outputs:
        known = {
            (str(i.get("product_id") or ""), str(i.get("variant_id") or "")): i.get("produced")
            for i in (row.items or []) if isinstance(i, dict)
        }
        for it in items_payload:
            key = (str(it.get("product_id") or ""), str(it.get("variant_id") or ""))
            if key in known:
                it["produced"] = known[key]

    # ── Build the field patch ─────────────────────────────────────────────
    json_fields = {"items", "assignees", "attachments", "stock_dispatches"}
    data = body.model_dump(exclude_none=True, exclude=json_fields | {"status", "ref"})
    # Explicit nulls are meaningful for these (clear the link / date).
    for f in ("store_id", "plant_id", "output_storage_location_id", "customer_id", *_PO_DATE_FIELDS):
        if f in fields:
            data[f] = getattr(body, f)
    if new_ref is not None:
        data["ref"] = new_ref
    for f in json_fields:
        dumped = _dump_list(getattr(body, f))
        if dumped is not None:
            data[f] = dumped

    before = {
        "progress": row.progress, "priority": row.priority, "notes": row.notes,
        "assignees": list(row.assignees or []), "attachments": list(row.attachments or []),
        "stock_dispatches": list(row.stock_dispatches or []),
        "items_sig": _items_signature(row.items), "items_count": len(row.items or []),
    }

    async def _apply_fields() -> None:
        await repo.update(row, data)
        _audit_field_changes(row, before, actor)

    try:
        if status_changing and new_status == "draft":
            # Leave the live state first (releases holds), then edit freely.
            await transition_order(db, vendor_id, row, new_status, actor=actor, actor_id=vu.id)
            await _apply_fields()
        else:
            # Apply edits first so confirmation/completion uses the new items & location.
            await _apply_fields()
            if status_changing:
                await transition_order(db, vendor_id, row, new_status, actor=actor, actor_id=vu.id)
    except ValueError as exc:
        await db.rollback()
        raise _commit_error(exc)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(400, "Could not save: a unique value (such as the reference) is already in use")

    await db.commit()
    await db.refresh(row)
    return _serialize(row, include_heavy=True)


@router.delete("/production-orders/{order_id}", status_code=204, dependencies=[Depends(production_manage)])
async def delete_production_order(
    order_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = ProductionOrderRepo(db)
    row = await repo.get(order_id, vendor_id, for_update=True)
    if not row:
        raise HTTPException(404, "Production order not found")
    if row.inventory_posted_at:
        raise HTTPException(
            400,
            "Cannot delete a production order whose materials/finished goods have already been "
            "posted to stock. Re-open it first to reverse the postings, or keep it as a record.",
        )
    if row.status not in ("draft", "cancelled"):
        raise HTTPException(
            409,
            f"Only draft or cancelled orders can be deleted (this one is {row.status}). Cancel it first.",
        )
    if row.materials_reserved_at and not row.materials_released_at:
        await release_materials(db, vendor_id, row)
    await repo.delete(row)
    await db.commit()
    return None


@router.post("/production-orders/import-local", dependencies=[Depends(production_manage)])
async def import_local_production_orders(
    body: BulkImportBody,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vu: VendorUser = Depends(get_current_vendor_user),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """One-time import from browser localStorage payload.

    Imported orders always arrive as *draft* (they were never posted to stock) and
    each one is validated individually; bad rows are skipped and reported.
    """
    repo = ProductionOrderRepo(db)
    actor = _actor(current_user)
    created = 0
    skipped = 0
    errors: list[dict[str, str]] = []

    for raw in body.orders:
        ref = str(raw.get("ref") or "").strip()[:40]
        try:
            # Savepoint per row: a failure rolls back only this row, never the batch.
            async with db.begin_nested():
                await _import_one(db, repo, vendor_id, vu, actor, body, raw, ref)
            created += 1
        except Exception as exc:  # noqa: BLE001 — per-row isolation; reported to the caller
            skipped += 1
            errors.append({"ref": ref or "(none)", "error": str(getattr(exc, "detail", exc))[:200]})

    await db.commit()
    return {"created": created, "skipped": skipped, "errors": errors[:50]}


async def _import_one(
    db: AsyncSession,
    repo: ProductionOrderRepo,
    vendor_id: UUID,
    vu: VendorUser,
    actor: str,
    body: BulkImportBody,
    raw: dict,
    ref: str,
) -> None:
    if not ref:
        raise ValueError("missing ref")
    if await repo.get_by_ref(vendor_id, ref):
        raise ValueError("reference already exists")

    po_type = raw.get("type") if raw.get("type") in ("mto", "mts") else "mts"

    store_id: Optional[UUID] = None
    sid = raw.get("store_id") or body.default_store_id
    if sid:
        try:
            store_id = UUID(str(sid))
            await _validate_store(db, vendor_id, store_id)
        except (ValueError, HTTPException):
            store_id = None

    customer_id: Optional[UUID] = None
    if raw.get("customer_id"):
        try:
            customer_id = UUID(str(raw["customer_id"]))
            await _validate_customer(db, vendor_id, customer_id)
        except (ValueError, HTTPException):
            customer_id = None

    items = [OrderItemIn.model_validate(i).model_dump(mode="json") for i in (raw.get("items") or [])]
    await _validate_items(db, vendor_id, items)
    priority = raw.get("priority") if raw.get("priority") in ("low", "medium", "high", "urgent") else "medium"
    try:
        progress = max(0, min(100, int(raw.get("progress") or 0)))
    except (ValueError, TypeError):
        progress = 0

    row = ProductionOrder(
        vendor_id=vendor_id,
        store_id=store_id,
        ref=ref,
        type=po_type,
        template=str(raw.get("template") or "Standard")[:80],
        status="draft",
        progress=progress,
        priority=priority,
        customer_id=customer_id,
        customer_name=(str(raw["customer_name"])[:255] if raw.get("customer_name") else None),
        customer_phone=(str(raw["customer_phone"])[:30] if raw.get("customer_phone") else None),
        customer_email=(str(raw["customer_email"])[:255] if raw.get("customer_email") else None),
        order_ref=(str(raw["order_ref"])[:100] if raw.get("order_ref") else None),
        delivery_deadline=_parse_date(raw.get("delivery_deadline")),
        special_requirements=raw.get("special_requirements"),
        target_stock_level=raw.get("target_stock_level") if isinstance(raw.get("target_stock_level"), int) else None,
        team=str(raw.get("team") or "")[:120],
        target_date=_parse_date(raw.get("target_date")),
        notes=raw.get("notes") or "",
        items=items,
        assignees=[AssigneeIn.model_validate(a).model_dump(mode="json") for a in (raw.get("assignees") or [])],
        attachments=[],
        stock_dispatches=[],
        audit_log=[],
        created_by=vu.id,
    )
    await repo.create(row)
    append_audit(
        row, "created",
        f"Order {ref} imported from browser storage as Draft (original status: {raw.get('status') or 'unknown'})",
        actor=actor,
    )
