"""Shared helpers for the Asset Management services: numbering, tenant guards, events, serialisation."""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Iterable, Optional, Sequence
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.asset_mgmt import AmAsset, AmEvent, AmSequence


# ── Serialisation ────────────────────────────────────────────────────────────────────────────────
def jsonable(v: Any) -> Any:
    if v is None or isinstance(v, (str, int, float, bool)):
        return v
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, (date, datetime)):
        return v.isoformat()
    if isinstance(v, UUID):
        return str(v)
    if isinstance(v, dict):
        return {k: jsonable(x) for k, x in v.items()}
    if isinstance(v, (list, tuple, set)):
        return [jsonable(x) for x in v]
    return str(v)


def to_dict(obj: Any, exclude: Iterable[str] = ()) -> dict:
    """Column-only dict of a model row (no relationship access, so it is safe under async SQLAlchemy)."""
    skip = set(exclude)
    return {c.name: jsonable(getattr(obj, c.name)) for c in obj.__table__.columns if c.name not in skip}


# ── Input coercion ───────────────────────────────────────────────────────────────────────────────
def as_uuid(v: Any, field: str = "id") -> Optional[UUID]:
    if v in (None, ""):
        return None
    if isinstance(v, UUID):
        return v
    try:
        return UUID(str(v))
    except (ValueError, AttributeError, TypeError):
        raise HTTPException(400, f"Invalid {field}")


def as_date(v: Any, field: str = "date") -> Optional[date]:
    if v in (None, ""):
        return None
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    try:
        return date.fromisoformat(str(v)[:10])
    except ValueError:
        raise HTTPException(400, f"Invalid {field}")


def as_datetime(v: Any, field: str = "datetime") -> Optional[datetime]:
    if v in (None, ""):
        return None
    if isinstance(v, datetime):
        return v
    try:
        return datetime.fromisoformat(str(v).replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(400, f"Invalid {field}")


def as_decimal(v: Any, field: str = "amount", *, allow_negative: bool = False) -> Optional[Decimal]:
    if v in (None, ""):
        return None
    try:
        d = Decimal(str(v))
    except Exception:
        raise HTTPException(400, f"Invalid {field}")
    if not d.is_finite():
        raise HTTPException(400, f"Invalid {field}")
    if d < 0 and not allow_negative:
        raise HTTPException(400, f"{field} cannot be negative")
    return d


def pick(data: dict, allowed: Iterable[str]) -> dict:
    """Only whitelisted keys, so a client can never set vendor_id / status / system columns directly."""
    return {k: data[k] for k in allowed if k in data}


def clean_str(v: Any, max_len: Optional[int] = None) -> Optional[str]:
    if v is None:
        return None
    s = str(v).strip()
    if not s:
        return None
    return s[:max_len] if max_len else s


def check_choice(value: Optional[str], choices: Sequence[str], field: str) -> Optional[str]:
    if value is None:
        return None
    if value not in choices:
        raise HTTPException(400, f"Invalid {field}. Allowed: {', '.join(choices)}")
    return value


# ── Numbering ────────────────────────────────────────────────────────────────────────────────────
async def next_number(db: AsyncSession, vendor_id: UUID, key: str, prefix: str, width: int = 6) -> str:
    """Atomic per-vendor counter (single upsert, safe under concurrency)."""
    stmt = (
        pg_insert(AmSequence)
        .values(vendor_id=vendor_id, key=key, next_value=2)
        .on_conflict_do_update(
            index_elements=[AmSequence.vendor_id, AmSequence.key],
            set_={"next_value": AmSequence.next_value + 1},
        )
        .returning(AmSequence.next_value)
    )
    n = (await db.execute(stmt)).scalar_one() - 1
    return f"{prefix}-{n:0{width}d}"


# ── Tenant guards ────────────────────────────────────────────────────────────────────────────────
async def get_owned(db: AsyncSession, model, row_id: Any, vendor_id: UUID, label: str, *, lock: bool = False):
    rid = as_uuid(row_id, f"{label} id")
    q = select(model).where(model.id == rid, model.vendor_id == vendor_id)
    if lock:
        q = q.with_for_update()
    row = (await db.execute(q)).scalar_one_or_none()
    if row is None:
        raise HTTPException(404, f"{label} not found")
    return row


async def assert_owned(db: AsyncSession, model, row_id: Any, vendor_id: UUID, label: str) -> Optional[UUID]:
    """Validate an optional foreign reference belongs to this tenant (blocks cross-tenant id injection)."""
    rid = as_uuid(row_id, f"{label} id")
    if rid is None:
        return None
    found = (await db.execute(
        select(model.id).where(model.id == rid, model.vendor_id == vendor_id)
    )).scalar_one_or_none()
    if found is None:
        raise HTTPException(404, f"{label} not found")
    return rid


# ── Lifecycle timeline ───────────────────────────────────────────────────────────────────────────
async def record_event(
    db: AsyncSession, vendor_id: UUID, asset_id: UUID, event_type: str, summary: str,
    data: Optional[dict] = None, actor_user_id: Optional[UUID] = None,
) -> None:
    db.add(AmEvent(
        vendor_id=vendor_id, asset_id=asset_id, event_type=event_type,
        summary=summary[:500], data=jsonable(data or {}), actor_user_id=actor_user_id,
    ))


async def get_asset(db: AsyncSession, vendor_id: UUID, asset_id: Any, *, lock: bool = False) -> AmAsset:
    return await get_owned(db, AmAsset, asset_id, vendor_id, "Asset", lock=lock)


def actor_id(vu: Any) -> Optional[UUID]:
    return getattr(vu, "id", None)


def is_vendor_admin(vu: Any) -> bool:
    return str(getattr(vu, "role", "") or "") in ("owner", "admin", "platform_staff")
