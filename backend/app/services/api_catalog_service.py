"""Map vendor API routes + Pydantic schemas to database table columns."""
from __future__ import annotations

import importlib
import inspect
import pkgutil
import re
from typing import Any, get_args, get_origin

import app.models as models_pkg
from app.config import settings
from app.database import Base
from pydantic import BaseModel

# Longest suffixes first so e.g. CustomerListResponse → Customer, not CustomerList.
_SCHEMA_SUFFIXES = (
    "ListResponse",
    "ValidationResponse",
    "TemplatedCreate",
    "LegacyCreate",
    "StatusUpdate",
    "TrashOut",
    "CheckRequest",
    "CheckResponse",
    "Create",
    "Update",
    "Response",
    "Validate",
    "Review",
    "Upload",
    "Out",
)

# Explicit schema class → SQL table when name inference fails.
_SCHEMA_TABLE_OVERRIDES: dict[str, str] = {
    "CouponValidate": "coupon",
    "DocumentUpload": "vendor_document",
    "DocumentReview": "vendor_document",
    "SlugCheckRequest": "vendor",
    "SlugCheckResponse": "vendor",
    "ProductListResponse": "product",
    "ServiceListResponse": "service",
    "CustomerListResponse": "customer",
    "VendorListResponse": "vendor",
    "PaginatedResponse": "",
    "MessageResponse": "",
    "Token": "user",
}

_WRITE_SCHEMA_HINTS = ("create", "update", "upload", "review", "validate", "legacy", "templated")
_READ_SCHEMA_HINTS = ("response", "out", "list", "checkresponse", "validationresponse", "trashout")


def _camel_to_snake(name: str) -> str:
    return re.sub(r"(?<!^)(?=[A-Z])", "_", name).lower()


def _entity_from_schema_name(schema_name: str) -> str:
    for suffix in _SCHEMA_SUFFIXES:
        if schema_name.endswith(suffix) and len(schema_name) > len(suffix):
            return schema_name[: -len(suffix)]
    return schema_name


def _build_table_lookup() -> dict[str, str]:
    """Map entity keys (Coupon, coupon, bank_account) → table name."""
    lookup: dict[str, str] = {}
    for _, obj in inspect.getmembers(models_pkg):
        if not inspect.isclass(obj) or obj is Base:
            continue
        tablename = getattr(obj, "__tablename__", None)
        if not tablename:
            continue
        try:
            if not issubclass(obj, Base):
                continue
        except TypeError:
            continue
        lookup[obj.__name__] = tablename
        lookup[obj.__name__.lower()] = tablename
        lookup[tablename] = tablename
        snake = _camel_to_snake(obj.__name__)
        lookup[snake] = tablename
    return lookup


def _resolve_schema_table(schema_name: str, table_lookup: dict[str, str]) -> str | None:
    if schema_name in _SCHEMA_TABLE_OVERRIDES:
        t = _SCHEMA_TABLE_OVERRIDES[schema_name]
        return t or None
    entity = _entity_from_schema_name(schema_name)
    for key in (entity, entity.lower(), _camel_to_snake(entity)):
        if key in table_lookup:
            return table_lookup[key]
    return None


def _schema_direction(schema_name: str) -> str:
    lower = schema_name.lower()
    if any(h in lower for h in _WRITE_SCHEMA_HINTS):
        return "write"
    if any(h in lower for h in _READ_SCHEMA_HINTS):
        return "read"
    return "write"


def _unwrap_annotation(annotation: Any) -> Any:
    if annotation is inspect.Parameter.empty:
        return None
    origin = get_origin(annotation)
    if origin is not None:
        args = get_args(annotation)
        if args:
            return _unwrap_annotation(args[0])
    return annotation


def _iter_schema_modules():
    import app.schemas as schemas_pkg

    yield schemas_pkg
    if not hasattr(schemas_pkg, "__path__"):
        return
    for _importer, modname, _ispkg in pkgutil.walk_packages(schemas_pkg.__path__, schemas_pkg.__name__ + "."):
        try:
            yield importlib.import_module(modname)
        except Exception:
            continue


def _collect_schema_fields(table_lookup: dict[str, str]) -> dict[str, dict[str, Any]]:
    """schema_class_name → {table, fields: {schema_field: db_column}}"""
    index: dict[str, dict[str, Any]] = {}
    for module in _iter_schema_modules():
        for name, obj in inspect.getmembers(module):
            if not inspect.isclass(obj):
                continue
            try:
                if not issubclass(obj, BaseModel) or obj is BaseModel:
                    continue
            except TypeError:
                continue
            table = _resolve_schema_table(name, table_lookup)
            if not table:
                continue
            fields: dict[str, str] = {}
            for fname, finfo in getattr(obj, "model_fields", {}).items():
                col = finfo.serialization_alias or finfo.alias or fname
                if isinstance(col, str):
                    fields[fname] = col
            if fields:
                index[name] = {"table": table, "fields": fields, "direction": _schema_direction(name)}
    return index


def _binding_key(method: str, path: str, schema: str) -> str:
    return f"{method.upper()}:{path}:{schema}"


def _add_binding(
    store: dict[str, list[dict[str, str]]],
    seen: set[str],
    table: str,
    column: str,
    *,
    method: str,
    path: str,
    schema: str,
    direction: str,
) -> None:
    key = f"{table}.{column}"
    dedupe = _binding_key(method, path, schema)
    full = f"{key}:{dedupe}"
    if full in seen:
        return
    seen.add(full)
    store.setdefault(key, []).append(
        {
            "method": method.upper(),
            "path": path,
            "schema": schema,
            "direction": direction,
        }
    )


def _normalize_path(prefix: str, route_path: str) -> str:
    combined = f"{settings.API_V1_PREFIX}{prefix}{route_path}"
    combined = combined.replace("//", "/")
    if combined.endswith("/") and combined != "/":
        combined = combined.rstrip("/")
    return combined


def _scan_vendor_routes(
    schema_index: dict[str, dict[str, Any]],
    table_lookup: dict[str, str],
) -> dict[str, list[dict[str, str]]]:
    from fastapi.routing import APIRoute

    from app.api.v1.router import api_router

    store: dict[str, list[dict[str, str]]] = {}
    seen: set[str] = set()

    def walk(router, prefix: str = "") -> None:
        for route in router.routes:
            if hasattr(route, "routes") and not isinstance(route, APIRoute):
                child_prefix = prefix + getattr(route, "path", "")
                walk(route, child_prefix)
                continue
            if not isinstance(route, APIRoute):
                continue
            full_prefix = prefix
            path = _normalize_path(full_prefix, route.path)
            if "/vendors/me" not in path and not path.endswith("/vendors"):
                continue

            methods = sorted(m for m in (route.methods or set()) if m not in {"HEAD", "OPTIONS"})
            if not methods:
                continue

            body_schemas: list[tuple[str, str]] = []
            try:
                sig = inspect.signature(route.endpoint)
            except (TypeError, ValueError):
                sig = None

            if sig:
                for param in sig.parameters.values():
                    ann = _unwrap_annotation(param.annotation)
                    if inspect.isclass(ann) and issubclass(ann, BaseModel):
                        body_schemas.append((ann.__name__, "write"))

            response_model = getattr(route, "response_model", None)
            if response_model is not None:
                resp = _unwrap_annotation(response_model)
                if inspect.isclass(resp) and issubclass(resp, BaseModel):
                    body_schemas.append((resp.__name__, "read"))

            for method in methods:
                if method == "GET" and not body_schemas:
                    # Generic list/detail read — attach route to all columns of inferred table from path.
                    segment = path.rstrip("/").split("/")[-1]
                    if segment and segment not in {"me", "vendors", "hr", "crm", "finance"}:
                        guess = segment.replace("-", "_").rstrip("s")
                        table = table_lookup.get(guess) or table_lookup.get(segment.replace("-", "_"))
                        if table:
                            _add_binding(
                                store,
                                seen,
                                table,
                                "*",
                                method=method,
                                path=path,
                                schema="(response)",
                                direction="read",
                            )
                    continue

                for schema_name, default_direction in body_schemas:
                    meta = schema_index.get(schema_name)
                    if not meta:
                        table = _resolve_schema_table(schema_name, table_lookup)
                        if not table:
                            continue
                        meta = {"table": table, "fields": {}, "direction": default_direction}
                    direction = meta.get("direction") or default_direction
                    if direction == "write" and method == "GET":
                        direction = "read"
                    table = meta["table"]
                    for _fname, col in meta.get("fields", {}).items():
                        _add_binding(
                            store,
                            seen,
                            table,
                            col,
                            method=method,
                            path=path,
                            schema=schema_name,
                            direction=direction,
                        )

    walk(api_router)
    return store


def _expand_wildcard_bindings(
    bindings: dict[str, list[dict[str, str]]],
    known_tables: dict[str, set[str]],
) -> dict[str, list[dict[str, str]]]:
    """Expand table.* wildcard GET bindings to every column in that table."""
    out: dict[str, list[dict[str, str]]] = {}
    for key, items in bindings.items():
        if key.endswith(".*"):
            table = key[:-2]
            cols = known_tables.get(table, set())
            for col in cols:
                out.setdefault(f"{table}.{col}", []).extend(items)
        else:
            out.setdefault(key, []).extend(items)

    for key in out:
        unique: list[dict[str, str]] = []
        seen_paths: set[str] = set()
        for b in out[key]:
            sig = _binding_key(b["method"], b["path"], b["schema"])
            if sig in seen_paths:
                continue
            seen_paths.add(sig)
            unique.append(b)
        out[key] = sorted(unique, key=lambda x: (x["path"], x["method"]))
    return out


def build_column_api_bindings(known_tables: dict[str, set[str]] | None = None) -> dict[str, list[dict[str, str]]]:
    """
    Returns {"invoice.total": [{method, path, schema, direction}, ...], ...}
    known_tables: optional {table: {column names}} for wildcard expansion.
    """
    table_lookup = _build_table_lookup()
    schema_index = _collect_schema_fields(table_lookup)
    raw = _scan_vendor_routes(schema_index, table_lookup)
    if known_tables:
        return _expand_wildcard_bindings(raw, known_tables)
    return {k: v for k, v in raw.items() if not k.endswith(".*")}


def enrich_models_with_api_bindings(models: list[dict[str, Any]]) -> list[dict[str, Any]]:
    known_tables = {m["table"]: {c["name"] for c in m["columns"]} for m in models}
    bindings = build_column_api_bindings(known_tables)
    for model in models:
        table = model["table"]
        exposed = 0
        unmapped_ui = 0
        for col in model["columns"]:
            key = f"{table}.{col['name']}"
            col_bindings = bindings.get(key, [])
            col["api_bindings"] = col_bindings
            if col_bindings:
                exposed += 1
        model["api_exposed_columns"] = exposed
    return models
