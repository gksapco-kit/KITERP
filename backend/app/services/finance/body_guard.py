"""
Request-body guard for finance endpoints that accept free-form JSON.

`coerce_body(Model, body, mode)` turns an untrusted dict into a dict that is safe to splat into
`Model(**data)` / `setattr`:

  * protected columns (id, vendor_id, audit stamps, posting links…) are dropped, so a client can
    never re-parent a row into another tenant or forge audit fields;
  * on *create*, unknown keys are rejected (they used to surface as a 500 TypeError);
    on *update*, unknown keys are ignored (matches the old setattr behaviour);
  * values are coerced to the column type (Decimal / date / datetime / UUID / bool / int / str) so a
    bad value is a clean 422 rather than a database error halfway through a transaction;
  * NOT NULL columns without a default must be present on create.
"""
from __future__ import annotations

import datetime as _dt
import uuid as _uuid
from decimal import Decimal, InvalidOperation
from typing import Any, Iterable, Optional

from fastapi import HTTPException
from sqlalchemy import Boolean, Date, DateTime, Integer, Numeric, String, Text, inspect as sa_inspect
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.types import Uuid as SA_Uuid

PROTECTED = frozenset({
    "id", "vendor_id", "created_at", "updated_at", "created_by_id", "updated_by_id",
    "posted_at", "posted_by_id", "journal_entry_id", "reversed_entry_id", "deleted_at",
})


def _coerce_value(col_name: str, col_type: Any, value: Any) -> Any:
    if value is None:
        return None
    # HTML forms send "" for an untouched date / number / select; that means "not provided"
    if isinstance(value, str) and value.strip() == "" and not isinstance(col_type, (String, Text)):
        return None
    try:
        if isinstance(col_type, (PG_UUID, SA_Uuid)):
            return value if isinstance(value, _uuid.UUID) else _uuid.UUID(str(value))
        if isinstance(col_type, Numeric):
            if isinstance(value, bool):
                raise ValueError
            d = value if isinstance(value, Decimal) else Decimal(str(value).replace(",", "").strip())
            if not d.is_finite():
                raise ValueError
            return d
        if isinstance(col_type, DateTime):
            if isinstance(value, _dt.datetime):
                return value
            if isinstance(value, _dt.date):
                return _dt.datetime.combine(value, _dt.time())
            return _dt.datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if isinstance(col_type, Date):
            if isinstance(value, _dt.datetime):
                return value.date()
            if isinstance(value, _dt.date):
                return value
            return _dt.date.fromisoformat(str(value)[:10])
        if isinstance(col_type, Boolean):
            if isinstance(value, bool):
                return value
            s = str(value).strip().lower()
            if s in ("true", "1", "yes", "y"):
                return True
            if s in ("false", "0", "no", "n"):
                return False
            raise ValueError
        if isinstance(col_type, Integer):
            if isinstance(value, bool):
                raise ValueError
            if isinstance(value, float) and not value.is_integer():
                raise ValueError
            return int(value)
        if isinstance(col_type, (String, Text)):
            if isinstance(value, (dict, list)):
                raise ValueError
            s = str(value)
            length = getattr(col_type, "length", None)
            if length and len(s) > length:
                raise HTTPException(422, f"'{col_name}' is too long (max {length} characters)")
            return s
    except HTTPException:
        raise
    except (ValueError, InvalidOperation, TypeError):
        raise HTTPException(422, f"Invalid value for '{col_name}'") from None
    return value  # JSON / ARRAY / other: pass through


def coerce_body(
    model: Any,
    body: Any,
    mode: str = "create",
    *,
    protect: Iterable[str] = (),
    allow: Optional[Iterable[str]] = None,
    skip: Iterable[str] = (),
    exempt: Iterable[str] = (),
) -> dict:
    """
    mode: "create" | "update".
    protect: extra columns that clients may not set on this endpoint (e.g. status).
    allow: if given, only these columns may be set (whitelist).
    skip: keys handled by the caller (e.g. nested "lines"); passed through untouched.
    exempt: columns the caller fills in itself (parent FK such as statement_id) — not required.
    """
    if not isinstance(body, dict):
        raise HTTPException(422, "Request body must be a JSON object")
    mapper = sa_inspect(model)
    cols = {c.key: c for c in mapper.columns}
    blocked = PROTECTED | set(protect)
    allowed = set(allow) if allow is not None else None
    skip = set(skip)
    exempt = set(exempt)
    out: dict = {}
    unknown: list[str] = []
    for key, value in body.items():
        if key in skip:
            out[key] = value
            continue
        if key in blocked:
            continue
        if key not in cols:
            unknown.append(key)
            continue
        if allowed is not None and key not in allowed:
            continue
        out[key] = _coerce_value(key, cols[key].type, value)
    if mode == "create":
        if unknown:
            raise HTTPException(422, f"Unknown field(s): {', '.join(sorted(unknown))}")
        missing = [
            k for k, c in cols.items()
            if not c.nullable and c.default is None and c.server_default is None
            and not c.primary_key and k not in blocked and out.get(k) is None and k not in exempt
            and not (c.foreign_keys and k == "vendor_id")
        ]
        if missing:
            raise HTTPException(422, f"Missing required field(s): {', '.join(sorted(missing))}")
    else:
        for k in list(out):
            if k not in skip and cols[k].nullable is False and out[k] is None:
                raise HTTPException(422, f"'{k}' cannot be empty")
    return out
