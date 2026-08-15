"""Remove vendor-scoped rows so a business account can be deleted.

Many storefront / CRM / payment tables FK to ``vendor.id`` without
``ON DELETE CASCADE``. Admin delete used to fail with IntegrityError even
when the business had no customer orders.
"""
from __future__ import annotations

import logging
import re
from typing import Any
from uuid import UUID

from sqlalchemy import delete, select, text, update
from sqlalchemy.exc import IntegrityError, OperationalError, ProgrammingError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.schema import Column, Table

from app.database import Base
from app.models.vendor import Vendor

logger = logging.getLogger(__name__)

_MISSING_TABLE_HINTS = ("no such table", "does not exist", "undefined table")
_IDENT_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
_FK_TABLE_RE = re.compile(
    r'(?:on table|from table)\s+"([A-Za-z0-9_]+)"',
    re.IGNORECASE,
)
_MAX_DEPTH = 40
_MAX_VENDOR_DELETE_RETRIES = 30
_incoming_cache: dict[str, list[tuple[Table, Column, Any]]] | None = None


def _is_missing_table_error(exc: Exception) -> bool:
    msg = str(exc).lower()
    return any(hint in msg for hint in _MISSING_TABLE_HINTS)


def _ensure_models_loaded() -> None:
    global _incoming_cache
    import app.models  # noqa: F401
    _incoming_cache = None


def _refers_to_vendor(fk) -> bool:
    referred = fk.column
    return referred.table.name == "vendor" and referred.name == "id"


def _ondelete(fk) -> str:
    return (fk.ondelete or "NO ACTION").upper().replace(" ", "_")


def _vendor_fk_columns(table: Table) -> list[Column]:
    cols: list[Column] = []
    for col in table.columns:
        for fk in col.foreign_keys:
            if _refers_to_vendor(fk):
                cols.append(col)
                break
    return cols


def _incoming_fks(target: Table) -> list[tuple[Table, Column, Any]]:
    global _incoming_cache
    if _incoming_cache is None:
        cache: dict[str, list[tuple[Table, Column, Any]]] = {}
        for table in Base.metadata.tables.values():
            for col in table.columns:
                for fk in col.foreign_keys:
                    cache.setdefault(fk.column.table.name, []).append((table, col, fk))
        _incoming_cache = cache
    return _incoming_cache.get(target.name, [])


async def _fetch_pks(db: AsyncSession, table: Table, where) -> list[Any]:
    pk_cols = list(table.primary_key.columns)
    if len(pk_cols) != 1:
        return []
    try:
        async with db.begin_nested():
            result = await db.scalars(select(pk_cols[0]).where(where))
            return list(result.all())
    except (ProgrammingError, OperationalError) as exc:
        if _is_missing_table_error(exc):
            return []
        raise


async def _null_self_refs(db: AsyncSession, table: Table, pk_ids: list[Any]) -> None:
    if not pk_ids:
        return
    pk = list(table.primary_key.columns)[0]
    values = {}
    for col in table.columns:
        for fk in col.foreign_keys:
            if fk.column.table.name == table.name and col.nullable:
                values[col.name] = None
    if not values:
        return
    try:
        async with db.begin_nested():
            await db.execute(update(table).where(pk.in_(pk_ids)).values(**values))
    except (ProgrammingError, OperationalError) as exc:
        if not _is_missing_table_error(exc):
            raise


async def _purge_where(
    db: AsyncSession,
    table: Table,
    where,
    stack: frozenset[str],
) -> None:
    if table.name in stack:
        pk_ids = await _fetch_pks(db, table, where)
        await _null_self_refs(db, table, pk_ids)
        return
    if len(stack) > _MAX_DEPTH:
        logger.warning("vendor cleanup depth limit at table %s", table.name)
        return

    pk_cols = list(table.primary_key.columns)
    pk_ids = await _fetch_pks(db, table, where) if len(pk_cols) == 1 else []
    next_stack = stack | {table.name}

    if pk_ids:
        await _null_self_refs(db, table, pk_ids)
        for child_table, child_col, _fk in _incoming_fks(table):
            if child_table.name == table.name:
                continue
            await _purge_where(db, child_table, child_col.in_(pk_ids), next_stack)

    try:
        async with db.begin_nested():
            await db.execute(delete(table).where(where))
    except IntegrityError:
        logger.warning("vendor cleanup: leftover rows in %s (will retry)", table.name)
    except (ProgrammingError, OperationalError) as exc:
        if not _is_missing_table_error(exc):
            raise


async def _null_non_tenant_vendor_fks(db: AsyncSession, vendor_id: UUID) -> None:
    """Clear nullable FKs to vendor that are not the tenant ``vendor_id`` column."""
    for table in Base.metadata.tables.values():
        if table.name == "vendor":
            continue
        for col in _vendor_fk_columns(table):
            if col.name == "vendor_id" and not col.nullable:
                continue
            if not col.nullable:
                continue
            ondelete = "NO ACTION"
            for fk in col.foreign_keys:
                if _refers_to_vendor(fk):
                    ondelete = _ondelete(fk)
                    break
            if col.name != "vendor_id" or ondelete in {"SET_NULL", "SET NULL"}:
                try:
                    async with db.begin_nested():
                        await db.execute(
                            update(table).where(col == vendor_id).values({col.name: None})
                        )
                except (ProgrammingError, OperationalError) as exc:
                    if not _is_missing_table_error(exc):
                        raise


async def purge_vendor_dependents(db: AsyncSession, vendor_id: UUID) -> None:
    """Delete (or detach) rows that would block deleting ``vendor``."""
    _ensure_models_loaded()
    await _null_non_tenant_vendor_fks(db, vendor_id)

    tenant_targets: list[tuple[Table, Column]] = []
    for table in Base.metadata.tables.values():
        if table.name == "vendor":
            continue
        for col in _vendor_fk_columns(table):
            if col.name == "vendor_id":
                tenant_targets.append((table, col))
                break

    for table, col in tenant_targets:
        await _purge_where(db, table, col == vendor_id, frozenset())


def _blocking_table_from_integrity_error(exc: IntegrityError) -> str | None:
    orig = getattr(exc, "orig", None)
    diag = getattr(orig, "diag", None)
    table = getattr(diag, "table_name", None)
    if isinstance(table, str) and _IDENT_RE.match(table):
        return table
    match = _FK_TABLE_RE.search(str(exc))
    if match and _IDENT_RE.match(match.group(1)):
        return match.group(1)
    return None


async def _clear_named_table(db: AsyncSession, table: str, vendor_id: UUID, depth: int = 0) -> None:
    if depth > _MAX_DEPTH or not _IDENT_RE.match(table) or table == "vendor":
        return
    for _ in range(20):
        try:
            async with db.begin_nested():
                await db.execute(
                    text(f'DELETE FROM "{table}" WHERE vendor_id = :vid'),
                    {"vid": vendor_id},
                )
            return
        except IntegrityError as exc:
            child = _blocking_table_from_integrity_error(exc)
            if not child or child == table:
                return
            await _clear_named_table(db, child, vendor_id, depth + 1)
        except (ProgrammingError, OperationalError) as exc:
            if _is_missing_table_error(exc):
                return
            raise


async def delete_vendor_row(db: AsyncSession, vendor_id: UUID) -> None:
    """Purge dependents, then delete the vendor row."""
    await purge_vendor_dependents(db, vendor_id)

    for _ in range(_MAX_VENDOR_DELETE_RETRIES):
        try:
            async with db.begin_nested():
                await db.execute(delete(Vendor).where(Vendor.id == vendor_id))
                await db.flush()
            return
        except IntegrityError as exc:
            blocking = _blocking_table_from_integrity_error(exc)
            if not blocking:
                raise
            logger.info(
                "vendor cleanup: clearing blocking table %s for vendor %s",
                blocking,
                vendor_id,
            )
            await _clear_named_table(db, blocking, vendor_id)

    await db.execute(delete(Vendor).where(Vendor.id == vendor_id))
    await db.flush()
