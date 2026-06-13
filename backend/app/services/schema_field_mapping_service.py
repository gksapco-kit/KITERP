"""CRUD for per-vendor schema field mappings."""
from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.schema_field_mapping import SchemaFieldMapping


def _to_dict(row: SchemaFieldMapping) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "vendor_id": str(row.vendor_id),
        "table_name": row.table_name,
        "column_name": row.column_name,
        "ui_label": row.ui_label,
        "help_short": row.help_short,
        "help_full": row.help_full,
        "screens": row.screens or [],
        "note": row.note,
        "is_active": row.is_active,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


async def list_mappings(db: AsyncSession, vendor_id: UUID) -> list[dict[str, Any]]:
    result = await db.execute(
        select(SchemaFieldMapping)
        .where(SchemaFieldMapping.vendor_id == vendor_id, SchemaFieldMapping.is_active.is_(True))
        .order_by(SchemaFieldMapping.table_name, SchemaFieldMapping.column_name)
    )
    return [_to_dict(r) for r in result.scalars().all()]


async def get_mapping(db: AsyncSession, vendor_id: UUID, mapping_id: UUID) -> SchemaFieldMapping | None:
    result = await db.execute(
        select(SchemaFieldMapping).where(
            SchemaFieldMapping.id == mapping_id,
            SchemaFieldMapping.vendor_id == vendor_id,
        )
    )
    return result.scalar_one_or_none()


async def get_mapping_by_column(
    db: AsyncSession, vendor_id: UUID, table_name: str, column_name: str
) -> SchemaFieldMapping | None:
    result = await db.execute(
        select(SchemaFieldMapping).where(
            SchemaFieldMapping.vendor_id == vendor_id,
            SchemaFieldMapping.table_name == table_name,
            SchemaFieldMapping.column_name == column_name,
            SchemaFieldMapping.is_active.is_(True),
        )
    )
    return result.scalar_one_or_none()


async def create_mapping(db: AsyncSession, vendor_id: UUID, data: dict[str, Any]) -> dict[str, Any]:
    existing = await get_mapping_by_column(db, vendor_id, data["table_name"], data["column_name"])
    if existing:
        raise ValueError("A mapping already exists for this table and column. Edit it instead.")
    row = SchemaFieldMapping(
        vendor_id=vendor_id,
        table_name=data["table_name"].strip(),
        column_name=data["column_name"].strip(),
        ui_label=data["ui_label"].strip(),
        help_short=(data.get("help_short") or "").strip() or None,
        help_full=(data.get("help_full") or "").strip() or None,
        screens=data.get("screens") or [],
        note=(data.get("note") or "").strip() or None,
    )
    db.add(row)
    await db.flush()
    await db.refresh(row)
    return _to_dict(row)


async def update_mapping(
    db: AsyncSession, vendor_id: UUID, mapping_id: UUID, data: dict[str, Any]
) -> dict[str, Any]:
    row = await get_mapping(db, vendor_id, mapping_id)
    if not row:
        raise ValueError("Mapping not found")
    if "ui_label" in data and data["ui_label"]:
        row.ui_label = data["ui_label"].strip()
    if "help_short" in data:
        row.help_short = (data["help_short"] or "").strip() or None
    if "help_full" in data:
        row.help_full = (data["help_full"] or "").strip() or None
    if "screens" in data:
        row.screens = data["screens"] or []
    if "note" in data:
        row.note = (data["note"] or "").strip() or None
    if "is_active" in data:
        row.is_active = bool(data["is_active"])
    await db.flush()
    await db.refresh(row)
    return _to_dict(row)


async def delete_mapping(db: AsyncSession, vendor_id: UUID, mapping_id: UUID) -> None:
    row = await get_mapping(db, vendor_id, mapping_id)
    if not row:
        raise ValueError("Mapping not found")
    row.is_active = False
    await db.flush()
