"""Shared plumbing for the Real Estate module: request context, numbering, audit, notifications."""
from __future__ import annotations

import enum
import uuid
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.realestate.admin import ReAuditLog, ReNumberRange

DEFAULT_PREFIX = {
    "lead": "LD", "enquiry": "EQ", "quotation": "QT", "booking": "BK", "allotment": "AL",
    "cancellation": "CN", "refund": "RF", "customer": "CU", "demand": "DM", "receipt": "RC",
    "work_order": "WO", "purchase_requisition": "PR", "rfq": "RFQ", "purchase_order": "PO",
    "grn": "GRN", "material_issue": "MI", "stock_transfer": "ST", "subcontract": "SC",
    "work_certificate": "RA", "handover": "HO", "ticket": "TK", "lease": "LS",
    "rent_invoice": "RI", "maintenance_bill": "MB", "settlement": "SE", "agreement": "AG",
    "material": "MT", "site_store": "ST-S", "warranty": "WR", "ops_receipt": "OR",
    "acquisition": "AQ", "jda": "JDA", "parcel": "LP", "facility_work_order": "FWO",
    "tenant": "TN", "contractor": "CT", "supplier": "SU", "broker": "BR", "asset": "AS",
    "wage_sheet": "WS", "labour": "LB", "visitor_pass": "VP", "wbs": "WBS", "project": "PRJ",
}


@dataclass
class Ctx:
    """Resolved per-request context: DB session + tenant + acting user."""

    db: AsyncSession
    vendor_id: UUID
    user_id: Optional[UUID]
    actor_name: str
    permissions: frozenset[str]
    role: str = ""

    def has(self, perm: str) -> bool:
        return perm in self.permissions


# ── JSON helpers ────────────────────────────────────────────────────────────────────────────

def jsonable(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, enum.Enum):
        return value.value
    if isinstance(value, dict):
        return {str(k): jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [jsonable(v) for v in value]
    return str(value)


def row_dict(obj: Any, exclude: tuple[str, ...] = ()) -> dict[str, Any]:
    """Serialise an ORM row to plain JSON-safe values (one key per column)."""
    out: dict[str, Any] = {}
    for col in obj.__table__.columns:
        if col.key in exclude:
            continue
        out[col.key] = jsonable(getattr(obj, col.key, None))
    return out


_LABEL_KEYS = (
    "name", "title", "full_name", "unit_number", "booking_no", "lead_no", "quote_no", "demand_no",
    "receipt_no", "enquiry_no", "ticket_no", "lease_no", "agreement_no", "allotment_no", "po_no",
    "pr_no", "rfq_no", "grn_no", "wo_no", "code", "item_code", "subject", "doc_no",
    "invoice_no", "bill_no", "pass_no", "visitor_name", "meter_no", "asset_code", "handover_no",
)


def label_of(obj: Any) -> str:
    for key in _LABEL_KEYS:
        if hasattr(obj, key):
            val = getattr(obj, key)
            if val:
                return str(val)
    return str(getattr(obj, "id", ""))


# ── numbering ───────────────────────────────────────────────────────────────────────────────

async def next_number(db: AsyncSession, vendor_id: UUID, doc_type: str) -> str:
    """Return the next formatted document number (``BK-26-00001``) and bump the counter."""
    stmt = (
        select(ReNumberRange)
        .where(ReNumberRange.vendor_id == vendor_id, ReNumberRange.doc_type == doc_type)
        .with_for_update()
    )
    row = (await db.execute(stmt)).scalar_one_or_none()
    if row is None:
        try:
            async with db.begin_nested():
                row = ReNumberRange(
                    id=uuid.uuid4(),
                    vendor_id=vendor_id,
                    doc_type=doc_type,
                    prefix=DEFAULT_PREFIX.get(doc_type, doc_type[:3].upper()),
                    next_number=1,
                    padding=5,
                    include_year=True,
                    reset_yearly=False,
                )
                db.add(row)
                await db.flush()
        except IntegrityError:
            row = (await db.execute(stmt)).scalar_one()
    year = date.today().year
    if row.reset_yearly and row.last_year and row.last_year != year:
        row.next_number = 1
    n = int(row.next_number or 1)
    row.next_number = n + 1
    row.last_year = year
    body = str(n).zfill(int(row.padding or 5))
    prefix = row.prefix or doc_type[:3].upper()
    return f"{prefix}-{str(year)[2:]}-{body}" if row.include_year else f"{prefix}-{body}"


# ── audit & notifications ───────────────────────────────────────────────────────────────────

async def audit(
    ctx: Ctx,
    entity_type: str,
    entity_id: Optional[UUID],
    action: str,
    *,
    ref: Optional[str] = None,
    changes: Optional[dict] = None,
) -> None:
    ctx.db.add(
        ReAuditLog(
            id=uuid.uuid4(),
            vendor_id=ctx.vendor_id,
            entity_type=entity_type,
            entity_id=entity_id,
            entity_ref=(ref or "")[:120] or None,
            action=action,
            actor_user_id=ctx.user_id,
            actor_name=ctx.actor_name,
            changes=jsonable(changes or {}),
        )
    )


async def notify(
    db: AsyncSession,
    vendor_id: UUID,
    title: str,
    message: str,
    *,
    reference_type: str = "realestate",
    reference_id: Optional[UUID] = None,
) -> None:
    """Best-effort in-app notification (never raises into the caller)."""
    try:
        from app.services.notification_service import NotificationService

        await NotificationService(db).notify_hr_event(
            vendor_id=vendor_id,
            title=title,
            message=message,
            notif_type="realestate",
            reference_id=str(reference_id) if reference_id else None,
            reference_type=reference_type,
        )
    except Exception:  # pragma: no cover - notification failures must not break workflows
        pass


# ── lookups ─────────────────────────────────────────────────────────────────────────────────

async def get_owned(db: AsyncSession, model: Any, vendor_id: UUID, obj_id: UUID, what: str | None = None):
    """Fetch a tenant-scoped row or raise 404."""
    obj = (
        await db.execute(select(model).where(model.id == obj_id, model.vendor_id == vendor_id))
    ).scalar_one_or_none()
    if obj is None:
        raise HTTPException(status_code=404, detail=f"{what or model.__tablename__} not found")
    return obj


def D(value: Any) -> Decimal:
    """Coerce to Decimal (None -> 0)."""
    if value is None:
        return Decimal(0)
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def money_q(value: Decimal | float | int) -> Decimal:
    return D(value).quantize(Decimal("0.01"))
