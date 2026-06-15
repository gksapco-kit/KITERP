"""Read-only table row browse and cross-table ID search for System Configuration."""
from __future__ import annotations

import json
import re
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.schema_catalog_service import build_schema_catalog

_TABLE_NAME_RE = re.compile(r"^[a-z][a-z0-9_]*$")
_COLUMN_NAME_RE = re.compile(r"^[a-z][a-z0-9_]*$")

SENSITIVE_COLUMNS = frozenset(
    {
        "password_hash",
        "totp_secret",
        "verification_code",
        "email_change_code",
        "portal_temp_password",
        "jwt_secret",
        "secret",
        "api_key",
        "access_token",
        "refresh_token",
    }
)

RESERVED_TABLES = frozenset({"user", "order", "table", "group"})


def _quote_table(table: str) -> str:
    if table in RESERVED_TABLES:
        return f'"{table}"'
    return table


def _quote_column(col: str) -> str:
    return f'"{col}"'


def _catalog_by_table() -> dict[str, dict[str, Any]]:
    return {m["table"]: m for m in build_schema_catalog()}


def _is_uuid_type(type_str: str) -> bool:
    t = type_str.upper()
    return "UUID" in t


def _is_text_type(type_str: str) -> bool:
    t = type_str.upper()
    return any(x in t for x in ("VARCHAR", "TEXT", "CHAR", "STRING"))


def _serialize_value(val: Any) -> Any:
    if val is None:
        return None
    if isinstance(val, UUID):
        return str(val)
    if isinstance(val, (dict, list)):
        return val
    if hasattr(val, "isoformat"):
        try:
            return val.isoformat()
        except Exception:
            pass
    return val


def _mask_row(row: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for k, v in row.items():
        if k in SENSITIVE_COLUMNS:
            out[k] = "••••••••"
        elif isinstance(v, (dict, list)):
            out[k] = v
        else:
            out[k] = _serialize_value(v)
    return out


def _row_from_mapping(mapping: Any) -> dict[str, Any]:
    return _mask_row({k: mapping[k] for k in mapping.keys()})


def _uuid_columns(entry: dict[str, Any]) -> list[str]:
    cols: list[str] = []
    for c in entry["columns"]:
        name = c["name"]
        if not _COLUMN_NAME_RE.match(name):
            continue
        if c.get("primary_key") or name == "id" or name.endswith("_id") or _is_uuid_type(c["type"]):
            cols.append(name)
    return cols


def _text_columns(entry: dict[str, Any], limit: int = 12) -> list[str]:
    cols: list[str] = []
    for c in entry["columns"]:
        name = c["name"]
        if name in SENSITIVE_COLUMNS or not _COLUMN_NAME_RE.match(name):
            continue
        if _is_text_type(c["type"]):
            cols.append(name)
        if len(cols) >= limit:
            break
    return cols


def _value_matches_query(val: Any, query: str, is_uuid: bool) -> bool:
    if val is None:
        return False
    if is_uuid:
        return str(val).lower() == query.lower()
    return query.lower() in str(val).lower()


def _build_cell_matches(
    table: str,
    domain: Optional[str],
    rows: list[dict[str, Any]],
    matched_columns: list[str],
    query: str,
    is_uuid: bool,
) -> list[dict[str, Any]]:
    """One entry per table + column + value that matched the search."""
    out: list[dict[str, Any]] = []
    seen: set[tuple[str, str, str]] = set()
    for row in rows:
        for col in matched_columns:
            val = row.get(col)
            if not _value_matches_query(val, query, is_uuid):
                continue
            display = _serialize_value(val)
            if display is None:
                continue
            display_str = str(display) if not isinstance(display, (dict, list)) else json.dumps(display)
            key = (table, col, display_str)
            if key in seen:
                continue
            seen.add(key)
            out.append(
                {
                    "table": table,
                    "column": col,
                    "value": display_str,
                    "domain": domain,
                }
            )
    return out


def _column_names(entry: dict[str, Any]) -> set[str]:
    return {c["name"] for c in entry["columns"] if _COLUMN_NAME_RE.match(c["name"])}


def _vendor_scope_clause(
    table: str,
    entry: dict[str, Any],
    vendor_id: UUID,
) -> Optional[tuple[str, dict[str, Any]]]:
    """SQL predicate + params limiting rows to one vendor. None = table not tenant-scoped."""
    cols = _column_names(entry)
    if table == "vendor":
        return f"{_quote_column('id')} = :vid", {"vid": vendor_id}
    if "vendor_id" in cols:
        return f"{_quote_column('vendor_id')} = :vid", {"vid": vendor_id}
    if "store_id" in cols:
        return (
            f"{_quote_column('store_id')} IN "
            f"(SELECT {_quote_column('id')} FROM {_quote_table('store')} "
            f"WHERE {_quote_column('vendor_id')} = :vid)",
            {"vid": vendor_id},
        )
    return None


def is_vendor_scoped_table(table: str, entry: dict[str, Any]) -> bool:
    cols = _column_names(entry)
    return table == "vendor" or "vendor_id" in cols or "store_id" in cols


def filter_catalog_for_vendor(catalog: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Tables a business admin may browse (rows tied to vendor_id or store_id)."""
    out: list[dict[str, Any]] = []
    for entry in catalog:
        table = entry["table"]
        if not _TABLE_NAME_RE.match(table):
            continue
        if is_vendor_scoped_table(table, entry):
            out.append(entry)
    return out


def _where_and(parts: list[str]) -> str:
    clean = [p.strip() for p in parts if p and p.strip()]
    if not clean:
        return ""
    return "WHERE " + " AND ".join(f"({p})" for p in clean)


def validate_table_name(table: str, *, vendor_id: Optional[UUID] = None) -> dict[str, Any]:
    if not _TABLE_NAME_RE.match(table):
        raise ValueError("Invalid table name")
    catalog = _catalog_by_table()
    entry = catalog.get(table)
    if not entry:
        raise ValueError(f"Unknown table: {table}")
    if vendor_id is not None and _vendor_scope_clause(table, entry, vendor_id) is None:
        raise ValueError(f"Table not available for this business: {table}")
    return entry


async def find_value_across_tables(
    db: AsyncSession,
    query: str,
    *,
    vendor_id: Optional[UUID] = None,
    max_hits: int = 40,
    rows_per_hit: int = 5,
) -> dict[str, Any]:
    """Find which tables/columns contain a UUID or text value."""
    raw = (query or "").strip()
    scope_label = "vendor" if vendor_id else "platform"
    if not raw or len(raw) < 2:
        return {
            "query": raw,
            "scope": scope_label,
            "hits": [],
            "matches": [],
            "match_count": 0,
            "hit_count": 0,
            "tables_scanned": 0,
        }

    catalog = _catalog_by_table()
    if vendor_id is not None:
        catalog = {e["table"]: e for e in filter_catalog_for_vendor(list(catalog.values()))}

    hits: list[dict[str, Any]] = []
    all_matches: list[dict[str, Any]] = []
    tables_scanned = 0
    is_uuid = False
    uuid_val: Optional[UUID] = None
    try:
        uuid_val = UUID(raw)
        is_uuid = True
    except ValueError:
        is_uuid = False

    for table, entry in catalog.items():
        if len(hits) >= max_hits:
            break
        if not _TABLE_NAME_RE.match(table):
            continue
        tables_scanned += 1
        qtable = _quote_table(table)

        scope_sql = ""
        scope_params: dict[str, Any] = {}
        if vendor_id is not None:
            scope = _vendor_scope_clause(table, entry, vendor_id)
            if scope is None:
                continue
            scope_sql, scope_params = scope

        if is_uuid and uuid_val is not None:
            uuid_cols = _uuid_columns(entry)
            if not uuid_cols:
                continue
            # Search primary key first (fast path).
            if "id" in uuid_cols:
                where = _where_and([scope_sql, f"{_quote_column('id')} = :uid"])
                sql = f"SELECT * FROM {qtable} {where} LIMIT :lim"
                params = {**scope_params, "uid": uuid_val, "lim": rows_per_hit}
                try:
                    async with db.begin_nested():
                        result = await db.execute(text(sql), params)
                        rows = result.mappings().all()
                    if rows:
                        mapped = [_row_from_mapping(r) for r in rows]
                        matched = ["id"]
                        cell_matches = _build_cell_matches(table, entry.get("domain"), mapped, matched, raw, True)
                        all_matches.extend(cell_matches)
                        hits.append(
                            {
                                "table": table,
                                "domain": entry.get("domain"),
                                "matched_columns": matched,
                                "row_count": len(rows),
                                "rows": mapped,
                                "cell_matches": cell_matches,
                            }
                        )
                        continue
                except Exception:
                    pass
            other_cols = [c for c in uuid_cols if c != "id"]
            if not other_cols:
                continue
            match_cond = " OR ".join(f"{_quote_column(c)} = :uid" for c in other_cols)
            where = _where_and([scope_sql, match_cond])
            sql = f"SELECT * FROM {qtable} {where} LIMIT :lim"
            params = {**scope_params, "uid": uuid_val, "lim": rows_per_hit}
            try:
                async with db.begin_nested():
                    result = await db.execute(text(sql), params)
                    rows = result.mappings().all()
            except Exception:
                continue
            if not rows:
                continue
            matched_cols = []
            for col in other_cols:
                for row in rows:
                    if str(row.get(col)) == str(uuid_val):
                        matched_cols.append(col)
                        break
            mapped = [_row_from_mapping(r) for r in rows]
            matched = sorted(set(matched_cols)) or other_cols[:3]
            cell_matches = _build_cell_matches(table, entry.get("domain"), mapped, matched, raw, True)
            all_matches.extend(cell_matches)
            hits.append(
                {
                    "table": table,
                    "domain": entry.get("domain"),
                    "matched_columns": matched,
                    "row_count": len(rows),
                    "rows": mapped,
                    "cell_matches": cell_matches,
                }
            )
        else:
            text_cols = _text_columns(entry)
            if not text_cols:
                continue
            pattern = f"%{raw}%"
            match_cond = " OR ".join(f"CAST({_quote_column(c)} AS TEXT) ILIKE :pat" for c in text_cols)
            where = _where_and([scope_sql, match_cond])
            sql = f"SELECT * FROM {qtable} {where} LIMIT :lim"
            params = {**scope_params, "pat": pattern, "lim": rows_per_hit}
            try:
                async with db.begin_nested():
                    result = await db.execute(text(sql), params)
                    rows = result.mappings().all()
            except Exception:
                continue
            if not rows:
                continue
            mapped = [_row_from_mapping(r) for r in rows]
            # Determine which text columns actually contain the query.
            actual_cols: list[str] = []
            for col in text_cols:
                for row in mapped:
                    if _value_matches_query(row.get(col), raw, False):
                        actual_cols.append(col)
                        break
            matched = actual_cols or text_cols[:3]
            cell_matches = _build_cell_matches(table, entry.get("domain"), mapped, matched, raw, False)
            all_matches.extend(cell_matches)
            hits.append(
                {
                    "table": table,
                    "domain": entry.get("domain"),
                    "matched_columns": matched,
                    "row_count": len(rows),
                    "rows": mapped,
                    "cell_matches": cell_matches,
                }
            )

    return {
        "query": raw,
        "scope": scope_label,
        "search_mode": "uuid" if is_uuid else "text",
        "hits": hits,
        "matches": all_matches,
        "match_count": len(all_matches),
        "hit_count": len(hits),
        "tables_scanned": tables_scanned,
    }


async def browse_table_rows(
    db: AsyncSession,
    table: str,
    *,
    vendor_id: Optional[UUID] = None,
    q: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
) -> dict[str, Any]:
    """Paginated read-only rows for one whitelisted table."""
    entry = validate_table_name(table, vendor_id=vendor_id)
    page = max(1, page)
    page_size = min(max(1, page_size), 100)
    offset = (page - 1) * page_size
    qtable = _quote_table(table)

    col_names = [c["name"] for c in entry["columns"] if _COLUMN_NAME_RE.match(c["name"])]
    order_col = "created_at" if "created_at" in col_names else ("id" if "id" in col_names else col_names[0])

    params: dict[str, Any] = {"lim": page_size, "off": offset}
    where_parts: list[str] = []

    if vendor_id is not None:
        scope = _vendor_scope_clause(table, entry, vendor_id)
        if scope is None:
            raise ValueError(f"Table not available for this business: {table}")
        scope_sql, scope_params = scope
        where_parts.append(scope_sql)
        params.update(scope_params)

    raw_q = (q or "").strip()
    if raw_q:
        try:
            uid = UUID(raw_q)
            uuid_cols = _uuid_columns(entry)
            if uuid_cols:
                where_parts.append(
                    "(" + " OR ".join(f"{_quote_column(c)} = :uid" for c in uuid_cols) + ")"
                )
                params["uid"] = uid
            else:
                raw_q = ""
        except ValueError:
            text_cols = _text_columns(entry, limit=8)
            if text_cols:
                where_parts.append(
                    "("
                    + " OR ".join(f"CAST({_quote_column(c)} AS TEXT) ILIKE :pat" for c in text_cols)
                    + ")"
                )
                params["pat"] = f"%{raw_q}%"

    where_clause = _where_and(where_parts)

    count_sql = f"SELECT COUNT(*) AS cnt FROM {qtable} {where_clause}"
    try:
        async with db.begin_nested():
            count_result = await db.execute(text(count_sql), params)
            total = int(count_result.scalar_one())
    except Exception:
        total = 0

    data_sql = (
        f"SELECT * FROM {qtable} {where_clause} "
        f"ORDER BY {_quote_column(order_col)} DESC NULLS LAST "
        f"LIMIT :lim OFFSET :off"
    )
    rows: list[dict[str, Any]] = []
    try:
        async with db.begin_nested():
            result = await db.execute(text(data_sql), params)
            rows = [_row_from_mapping(r) for r in result.mappings().all()]
    except Exception:
        fallback_sql = (
            f"SELECT * FROM {qtable} {where_clause} "
            f"ORDER BY {_quote_column('id')} DESC NULLS LAST "
            f"LIMIT :lim OFFSET :off"
            if "id" in col_names
            else f"SELECT * FROM {qtable} {where_clause} LIMIT :lim OFFSET :off"
        )
        try:
            async with db.begin_nested():
                result = await db.execute(text(fallback_sql), params)
                rows = [_row_from_mapping(r) for r in result.mappings().all()]
        except Exception:
            rows = []

    return {
        "table": table,
        "domain": entry.get("domain"),
        "scope": "vendor" if vendor_id else "platform",
        "columns": col_names,
        "page": page,
        "page_size": page_size,
        "total": total,
        "rows": rows,
    }
