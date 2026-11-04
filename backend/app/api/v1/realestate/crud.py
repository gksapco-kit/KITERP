"""Metadata-driven CRUD for ``re_*`` resources.

A :class:`Resource` describes one table; :func:`build_crud_router` turns it into list / create /
get / update / delete endpoints with tenant scoping, choice + foreign-key validation, auto
numbering, audit logging and optional hooks. The same description feeds ``GET /meta`` so the
vendor-web UI can render tables and forms without per-resource code.

NOTE: this module must not use ``from __future__ import annotations`` because FastAPI needs the
dynamic pydantic models as real (not stringified) annotations.
"""
import uuid
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Awaitable, Callable, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request
from pydantic import ConfigDict, Field, create_model
from sqlalchemy import (
    Boolean, Date, DateTime, Integer, Numeric, String, Text, asc, desc, func, or_, select,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.exc import IntegrityError
from sqlalchemy.types import JSON, TypeDecorator, Uuid

from app.database import Base
from app.models.realestate.base import is_secret_key
from app.services.realestate.common import Ctx, audit, jsonable, label_of, next_number, row_dict

from .ctx import ctx_dep

SYSTEM_COLS = {"id", "vendor_id", "created_at", "updated_at"}
Hook = Callable[..., Awaitable[None]]


@dataclass
class Action:
    """A workflow button shown on a row. The endpoint itself lives in a flows module."""

    key: str
    label: str
    path: str  # relative to /<resource>/{id}/ , e.g. "approve"
    method: str = "POST"
    params: list[dict] = field(default_factory=list)  # [{name,label,type,required,choices,ref}]
    when: Optional[dict] = None  # {"status": ["draft", ...]}
    confirm: Optional[str] = None
    style: str = "default"  # default | primary | danger
    result: str = "refresh"  # refresh | html | download


@dataclass
class Resource:
    key: str
    model: Any
    title: str
    columns: list[str]
    search: list[str] = field(default_factory=list)
    filters: list[str] = field(default_factory=list)
    write_perm: str = "realestate.manage"
    read_perm: str = "realestate.view"
    number: Optional[tuple[str, str]] = None  # (doc_type, column)
    readonly: tuple[str, ...] = ()  # columns not settable through generic create / update
    hide: tuple[str, ...] = ()  # columns hidden from the generated form
    labels: dict[str, str] = field(default_factory=dict)
    json_fields: tuple[str, ...] = ()  # JSON columns editable as raw JSON in the form
    json_ui: dict[str, str] = field(default_factory=dict)  # field -> "list" | "map" | "json" (overrides auto-detect)
    order: str = "-created_at"
    allow_create: bool = True
    # Resources created through a hand-written endpoint (``POST /<key>``) list the fields the "New" form shows.
    create_fields: tuple[str, ...] = ()
    allow_edit: bool = True
    allow_delete: bool = True
    audit: bool = True
    actions: list[Action] = field(default_factory=list)
    before_create: Optional[Hook] = None  # (ctx, data) -> None
    after_create: Optional[Hook] = None  # (ctx, obj) -> None
    before_update: Optional[Hook] = None  # (ctx, obj, data) -> None
    after_update: Optional[Hook] = None  # (ctx, obj, data) -> None
    before_delete: Optional[Hook] = None  # (ctx, obj) -> None
    editable_when: Optional[dict] = None  # {"status": ["draft"]} -> PATCH/DELETE only in those states
    extra_filters: Optional[Callable[[Any], list]] = None  # (model) -> [sqlalchemy conditions]
    secret_json: tuple[str, ...] = ()  # JSON columns whose secret-looking values are masked in responses and audit logs


# ── column helpers ──────────────────────────────────────────────────────────────────────────

def _is_uuid(t: Any) -> bool:
    return isinstance(t, (PGUUID, Uuid))


def _is_json(t: Any) -> bool:
    if isinstance(t, TypeDecorator):  # e.g. EncryptedSecrets
        t = t.impl
    return isinstance(t, (JSONB, JSON))


def py_type(col) -> Any:
    t = col.type
    if _is_uuid(t):
        return uuid.UUID
    if isinstance(t, Boolean):
        return bool
    if isinstance(t, Integer):
        return int
    if isinstance(t, Numeric):
        return Decimal
    if isinstance(t, DateTime):
        return datetime
    if isinstance(t, Date):
        return date
    if _is_json(t):
        return Any
    return str


def field_kind(col) -> str:
    t = col.type
    if col.foreign_keys:
        return "ref"
    if _is_uuid(t):
        return "uuid"
    if isinstance(t, Boolean):
        return "boolean"
    if isinstance(t, Integer):
        return "integer"
    if isinstance(t, Numeric):
        scale = t.scale if t.scale is not None else 2
        precision = t.precision or 16
        if precision == 7:
            return "percent"
        if precision == 10:
            return "decimal"
        return "money" if scale == 2 else "number"
    if isinstance(t, DateTime):
        return "datetime"
    if isinstance(t, Date):
        return "date"
    if _is_json(t):
        return "json"
    if isinstance(t, Text):
        return "textarea"
    if col.info.get("choices"):
        return "select"
    return "text"


def _required(col) -> bool:
    return (not col.nullable) and col.default is None and col.server_default is None


def _json_shape(col, res: "Resource") -> str:
    """Return 'list', 'map', or 'json' for a JSONB column.

    Manual override via ``res.json_ui`` wins.  Otherwise the column's Python
    default (list vs dict) is used to pick the friendlier editor.
    """
    if col.key in res.json_ui:
        return res.json_ui[col.key]
    default_arg = getattr(col.default, "arg", None)
    if default_arg is list:
        return "list"
    if default_arg is dict:
        return "map"
    return "json"


_table_models: dict[str, Any] = {}


def table_model(table_name: str):
    """ORM class registered for a ``__tablename__``."""
    if not _table_models:
        for mapper in Base.registry.mappers:
            _table_models[mapper.class_.__tablename__] = mapper.class_
    return _table_models.get(table_name)


# ── schema generation ───────────────────────────────────────────────────────────────────────

def _editable_columns(res: Resource):
    skip = SYSTEM_COLS | set(res.readonly)
    if res.number:
        skip.add(res.number[1])
    return [c for c in res.model.__table__.columns if c.key not in skip]


def build_schemas(res: Resource):
    create_fields: dict[str, Any] = {}
    update_fields: dict[str, Any] = {}
    for col in _editable_columns(res):
        typ = py_type(col)
        kwargs: dict[str, Any] = {}
        if isinstance(col.type, String) and getattr(col.type, "length", None):
            kwargs["max_length"] = col.type.length
        if _required(col) and col.key not in res.hide:
            create_fields[col.key] = (typ, Field(..., **kwargs))
        else:
            create_fields[col.key] = (Optional[typ], Field(None, **kwargs))
        update_fields[col.key] = (Optional[typ], Field(None, **kwargs))
    cfg = ConfigDict(extra="ignore")
    create_cls = create_model(f"{res.model.__name__}Create", __config__=cfg, **create_fields)
    update_cls = create_model(f"{res.model.__name__}Update", __config__=cfg, **update_fields)
    return create_cls, update_cls


def validate_choices(res: Resource, data: dict[str, Any]) -> None:
    for col in res.model.__table__.columns:
        choices = col.info.get("choices")
        if choices and col.key in data and data[col.key] is not None and data[col.key] not in choices:
            raise HTTPException(
                status_code=422,
                detail=f"{col.key}: '{data[col.key]}' is not valid; use one of {', '.join(choices)}",
            )


async def validate_fks(ctx: Ctx, model: Any, data: dict[str, Any]) -> None:
    """Reject foreign keys that point at another tenant's rows."""
    for col in model.__table__.columns:
        if col.key not in data or data[col.key] is None or not col.foreign_keys:
            continue
        target = next(iter(col.foreign_keys)).column.table
        if "vendor_id" not in target.c:
            continue
        found = (
            await ctx.db.execute(
                select(target.c.id).where(target.c.id == data[col.key], target.c.vendor_id == ctx.vendor_id)
            )
        ).first()
        if found is None:
            raise HTTPException(status_code=422, detail=f"{col.key}: referenced record not found")


def _clean_nulls(model: Any, data: dict[str, Any]) -> dict[str, Any]:
    """Drop explicit nulls for NOT NULL columns so model defaults apply."""
    out = {}
    for key, value in data.items():
        col = model.__table__.columns.get(key)
        if value is None and col is not None and not col.nullable:
            continue
        out[key] = value
    return out


def _coerce_filter(col, raw: str) -> Any:
    t = col.type
    if _is_uuid(t):
        try:
            return uuid.UUID(raw)
        except ValueError:
            raise HTTPException(status_code=422, detail=f"invalid {col.key}")
    if isinstance(t, Boolean):
        return raw.lower() in ("1", "true", "yes")
    if isinstance(t, Integer):
        return int(raw)
    return raw


_RESERVED = {"page", "size", "search", "sort", "q"}


async def attach_refs(ctx: Ctx, res: Resource, items: list[dict]) -> None:
    """Resolve display labels for foreign keys into ``item['_refs'][column]``."""
    ref_cols = [c for c in res.model.__table__.columns if c.foreign_keys and c.key in res.columns]
    for col in ref_cols:
        target_table = next(iter(col.foreign_keys)).column.table.name
        target_model = table_model(target_table)
        if target_model is None:
            continue
        ids = {it.get(col.key) for it in items if it.get(col.key)}
        if not ids:
            continue
        uids = []
        for i in ids:
            try:
                uids.append(uuid.UUID(str(i)))
            except ValueError:
                pass
        if not uids:
            continue
        rows = (await ctx.db.execute(select(target_model).where(target_model.id.in_(uids)))).scalars().all()
        labels = {str(r.id): label_of(r) for r in rows}
        for it in items:
            val = it.get(col.key)
            if val:
                it.setdefault("_refs", {})[col.key] = labels.get(str(val))


SECRET_MASK = "********"

def mask_secrets(value: Any) -> Any:
    """Replace the values of secret-looking keys (recursively) with a fixed mask; empty values stay empty."""
    if isinstance(value, dict):
        return {k: (SECRET_MASK if is_secret_key(k) and v not in (None, "") and not isinstance(v, (dict, list))
                    else mask_secrets(v)) for k, v in value.items()}
    if isinstance(value, list):
        return [mask_secrets(v) for v in value]
    return value


def restore_masked(new: Any, old: Any) -> Any:
    """A client that echoes back the mask keeps the stored secret instead of overwriting it with asterisks."""
    if isinstance(new, dict):
        old_d = old if isinstance(old, dict) else {}
        return {k: (old_d.get(k) if v == SECRET_MASK and k in old_d else restore_masked(v, old_d.get(k)))
                for k, v in new.items()}
    if isinstance(new, list):
        return [restore_masked(v, None) for v in new]
    return new


# Personal / financial identifiers: shown in full only to roles holding ``realestate.pii`` (owner, admin, manager and
# the specialist roles that need them). Everyone else sees the last four characters only.
PII_PERM = "realestate.pii"
PII_TAIL_COLUMNS = frozenset({"pan", "aadhaar_last4", "doc_number", "account_number"})
PII_HIDDEN_COLUMNS = {"re_kyc_document": ("file_url",)}  # KYC scans are never shown to roles without the permission
RESTRICTED = "(restricted)"


def mask_tail(value: Any) -> Any:
    s = str(value) if value not in (None, "") else ""
    if not s:
        return value
    return "*" * max(len(s) - 4, 0) + s[-4:] if len(s) > 4 else "*" * len(s)


def mask_pii(data: dict[str, Any], table: str, ctx: Optional[Ctx]) -> dict[str, Any]:
    """Mask identifiers in a serialised row unless the caller holds ``realestate.pii``. No ctx = internal use, unmasked."""
    if ctx is None or ctx.has(PII_PERM):
        return data
    for col in PII_TAIL_COLUMNS & data.keys():
        data[col] = mask_tail(data[col])
    for col in PII_HIDDEN_COLUMNS.get(table, ()):
        if data.get(col):
            data[col] = RESTRICTED
    return data


def drop_masked_pii(data: dict[str, Any]) -> None:
    """A masked value echoed back by an edit form must never overwrite the stored identifier."""
    for col in PII_TAIL_COLUMNS & data.keys():
        if isinstance(data[col], str) and "*" in data[col]:
            data.pop(col)
    if data.get("file_url") == RESTRICTED:
        data.pop("file_url")


def serialize(obj: Any, res: Optional["Resource"] = None, ctx: Optional[Ctx] = None) -> dict[str, Any]:
    data = row_dict(obj)
    if res is not None:
        for fld in res.secret_json:
            if fld in data:
                data[fld] = mask_secrets(data[fld])
    mask_pii(data, getattr(obj, "__tablename__", ""), ctx)
    data["_label"] = label_of(obj)
    return data


def _state_ok(obj: Any, when: Optional[dict]) -> bool:
    if not when:
        return True
    return all(getattr(obj, k, None) in vals for k, vals in when.items())


# ── router factory ──────────────────────────────────────────────────────────────────────────

def build_crud_router(res: Resource) -> APIRouter:
    router = APIRouter()
    model = res.model
    create_cls, update_cls = build_schemas(res)
    read_dep = ctx_dep(res.read_perm)
    write_dep = ctx_dep(res.write_perm)
    cols = model.__table__.columns

    @router.get("", name=f"list_{res.key}")
    async def list_items(
        request: Request,
        page: int = Query(1, ge=1),
        size: int = Query(50, ge=1, le=500),
        search: Optional[str] = Query(None, alias="search"),
        sort: Optional[str] = None,
        ctx: Ctx = Depends(read_dep),
    ):
        conds = [model.vendor_id == ctx.vendor_id]
        for key, raw in request.query_params.items():
            if key in _RESERVED or raw == "":
                continue
            if key.endswith("__notnull") and key[: -len("__notnull")] in cols:
                conds.append(cols[key[: -len("__notnull")]].is_not(None))
            elif key.endswith("__null") and key[: -len("__null")] in cols:
                conds.append(cols[key[: -len("__null")]].is_(None))
            elif key in cols:
                conds.append(cols[key] == _coerce_filter(cols[key], raw))
        if search and res.search:
            like = f"%{search.strip()}%"
            conds.append(or_(*[cols[c].ilike(like) for c in res.search if c in cols]))
        if res.extra_filters:
            conds.extend(res.extra_filters(model))
        total = (await ctx.db.execute(select(func.count()).select_from(model).where(*conds))).scalar_one()
        sort_key = sort or res.order
        desc_order = sort_key.startswith("-")
        sort_col = cols.get(sort_key.lstrip("-")) if sort_key.lstrip("-") in cols else cols["created_at"]
        order_by = desc(sort_col) if desc_order else asc(sort_col)
        rows = (
            await ctx.db.execute(
                select(model).where(*conds).order_by(order_by).offset((page - 1) * size).limit(size)
            )
        ).scalars().all()
        items = [serialize(r, res, ctx) for r in rows]
        await attach_refs(ctx, res, items)
        return {"items": items, "total": total, "page": page, "size": size, "pages": max(1, -(-total // size))}

    if res.allow_create:

        @router.post("", status_code=201, name=f"create_{res.key}")
        async def create_item(body: create_cls = Body(...), ctx: Ctx = Depends(write_dep)):  # type: ignore[valid-type]
            data = _clean_nulls(model, body.model_dump(exclude_unset=True))
            validate_choices(res, data)
            await validate_fks(ctx, model, data)
            if res.number and not data.get(res.number[1]):
                data[res.number[1]] = await next_number(ctx.db, ctx.vendor_id, res.number[0])
            if res.before_create:
                await res.before_create(ctx, data)
            obj = model(id=uuid.uuid4(), vendor_id=ctx.vendor_id, **data)
            ctx.db.add(obj)
            try:
                await ctx.db.flush()
            except IntegrityError as exc:
                await ctx.db.rollback()
                raise HTTPException(status_code=409, detail=f"Duplicate or invalid {res.title}: {exc.orig}")
            if res.after_create:
                await res.after_create(ctx, obj)
            if res.audit:
                logged = jsonable(data)
                for fld in res.secret_json:
                    if fld in logged:
                        logged[fld] = mask_secrets(logged[fld])
                await audit(ctx, res.key, obj.id, "create", ref=label_of(obj), changes=logged)
            await ctx.db.commit()
            await ctx.db.refresh(obj)
            out = serialize(obj, res, ctx)
            await attach_refs(ctx, res, [out])
            return out

    @router.get("/{item_id}", name=f"get_{res.key}")
    async def get_item(item_id: uuid.UUID, ctx: Ctx = Depends(read_dep)):
        obj = (
            await ctx.db.execute(select(model).where(model.id == item_id, model.vendor_id == ctx.vendor_id))
        ).scalar_one_or_none()
        if obj is None:
            raise HTTPException(status_code=404, detail=f"{res.title} not found")
        out = serialize(obj, res, ctx)
        await attach_refs(ctx, res, [out])
        return out

    if res.allow_edit:

        @router.patch("/{item_id}", name=f"update_{res.key}")
        async def update_item(
            item_id: uuid.UUID, body: update_cls = Body(...), ctx: Ctx = Depends(write_dep)  # type: ignore[valid-type]
        ):
            obj = (
                await ctx.db.execute(select(model).where(model.id == item_id, model.vendor_id == ctx.vendor_id))
            ).scalar_one_or_none()
            if obj is None:
                raise HTTPException(status_code=404, detail=f"{res.title} not found")
            if not _state_ok(obj, res.editable_when):
                raise HTTPException(status_code=409, detail=f"{res.title} can no longer be edited in its current state")
            data = _clean_nulls(model, body.model_dump(exclude_unset=True))
            drop_masked_pii(data)
            validate_choices(res, data)
            await validate_fks(ctx, model, data)
            for fld in res.secret_json:
                if fld in data:
                    data[fld] = restore_masked(data[fld], getattr(obj, fld, None))
            if res.before_update:
                await res.before_update(ctx, obj, data)
            changes = {}
            for key, value in data.items():
                old = getattr(obj, key, None)
                if jsonable(old) != jsonable(value):
                    if key in res.secret_json:
                        changes[key] = {"from": mask_secrets(jsonable(old)), "to": mask_secrets(jsonable(value))}
                    else:
                        changes[key] = {"from": jsonable(old), "to": jsonable(value)}
                setattr(obj, key, value)
            try:
                await ctx.db.flush()
            except IntegrityError as exc:
                await ctx.db.rollback()
                raise HTTPException(status_code=409, detail=f"Duplicate or invalid {res.title}: {exc.orig}")
            if res.after_update:
                await res.after_update(ctx, obj, data)
            if res.audit and changes:
                await audit(ctx, res.key, obj.id, "update", ref=label_of(obj), changes=changes)
            await ctx.db.commit()
            await ctx.db.refresh(obj)
            out = serialize(obj, res, ctx)
            await attach_refs(ctx, res, [out])
            return out

    if res.allow_delete:

        @router.delete("/{item_id}", status_code=204, name=f"delete_{res.key}")
        async def delete_item(item_id: uuid.UUID, ctx: Ctx = Depends(write_dep)):
            obj = (
                await ctx.db.execute(select(model).where(model.id == item_id, model.vendor_id == ctx.vendor_id))
            ).scalar_one_or_none()
            if obj is None:
                raise HTTPException(status_code=404, detail=f"{res.title} not found")
            if not _state_ok(obj, res.editable_when):
                raise HTTPException(status_code=409, detail=f"{res.title} can no longer be deleted in its current state")
            if res.before_delete:
                await res.before_delete(ctx, obj)
            label = label_of(obj)
            await ctx.db.delete(obj)
            if res.audit:
                await audit(ctx, res.key, item_id, "delete", ref=label)
            try:
                await ctx.db.commit()
            except IntegrityError:
                await ctx.db.rollback()
                raise HTTPException(status_code=409, detail=f"{res.title} is referenced by other records and cannot be deleted")

    return router


# ── metadata for the UI ─────────────────────────────────────────────────────────────────────

def _label(name: str, override: dict[str, str]) -> str:
    if name in override:
        return override[name]
    base = name[:-3] if name.endswith("_id") else name
    return base.replace("_", " ").strip().capitalize()


def resource_meta(res: Resource, key_by_table: dict[str, str]) -> dict[str, Any]:
    fields = []
    for col in res.model.__table__.columns:
        if col.key in SYSTEM_COLS:
            continue
        kind = field_kind(col)
        is_number = bool(res.number and res.number[1] == col.key)
        internal = col.key in res.hide or (kind == "uuid") or (kind == "json" and col.key not in res.json_fields)
        entry: dict[str, Any] = {
            "name": col.key,
            "label": _label(col.key, res.labels),
            "type": kind,
            "required": _required(col) and not is_number,
            "readonly": col.key in res.readonly or is_number,
            "hidden": internal,
        }
        if col.info.get("choices"):
            entry["choices"] = col.info["choices"]
        if col.foreign_keys:
            target = next(iter(col.foreign_keys)).column.table.name
            entry["ref"] = key_by_table.get(target)
        if getattr(col.type, "length", None):
            entry["max"] = col.type.length
        if kind == "json" and not internal:
            entry["shape"] = _json_shape(col, res)
        fields.append(entry)
    return {
        "key": res.key,
        "title": res.title,
        "columns": res.columns,
        "search": bool(res.search),
        "filters": res.filters,
        "fields": fields,
        "can_create": res.allow_create or bool(res.create_fields),
        "create_fields": list(res.create_fields),
        "can_edit": res.allow_edit,
        "can_delete": res.allow_delete,
        "write_perm": res.write_perm,
        "editable_when": res.editable_when,
        "actions": [
            {
                "key": a.key, "label": a.label, "path": a.path, "method": a.method, "params": a.params,
                "when": a.when, "confirm": a.confirm, "style": a.style, "result": a.result,
            }
            for a in res.actions
        ],
    }
