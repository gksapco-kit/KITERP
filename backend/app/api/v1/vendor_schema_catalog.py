from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    get_current_active_user,
    get_current_vendor_id,
    preferred_vendor_id_from_request,
    require_role,
    resolve_dashboard_vendor,
)
from app.database import get_db
from app.models.user import User
from app.models.vendor_user import VendorUser
from app.services.api_catalog_service import enrich_models_with_api_bindings
from app.services.schema_catalog_service import build_schema_catalog
from app.services import schema_field_mapping_service as mapping_svc
from app.services.table_data_service import (
    browse_table_rows,
    filter_catalog_for_vendor,
    find_value_across_tables,
)

router = APIRouter()


class FieldMappingCreate(BaseModel):
    table_name: str = Field(..., min_length=1, max_length=120)
    column_name: str = Field(..., min_length=1, max_length=120)
    ui_label: str = Field(..., min_length=1, max_length=200)
    help_short: Optional[str] = None
    help_full: Optional[str] = None
    screens: List[str] = []
    note: Optional[str] = None


class FieldMappingUpdate(BaseModel):
    ui_label: Optional[str] = Field(None, min_length=1, max_length=200)
    help_short: Optional[str] = None
    help_full: Optional[str] = None
    screens: Optional[List[str]] = None
    note: Optional[str] = None


async def _optional_vendor_id(
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Optional[UUID]:
    """Resolve vendor for mappings; None if user has no tenant (catalog still readable)."""
    try:
        pref = preferred_vendor_id_from_request(request)
        vendor = await resolve_dashboard_vendor(db, current_user, preferred_vendor_id=pref)
        return vendor.id
    except HTTPException:
        return None


def _enrich_models_with_virtual_mapping_columns(
    models: list[dict],
    mappings: list[dict],
) -> int:
    """Surface mapping-only fields (JSON keys) as virtual columns in the catalog."""
    _JSON_PARENT_BY_TABLE = {"store": "address"}
    virtual_count = 0
    for model in models:
        existing = {c["name"] for c in model["columns"]}
        added: list[dict] = []
        for m in mappings:
            if m["table_name"] != model["table"]:
                continue
            col_name = m["column_name"]
            if col_name in existing:
                continue
            json_parent = _JSON_PARENT_BY_TABLE.get(model["table"])
            data_type = m.get("data_type") or "text"
            added.append(
                {
                    "name": col_name,
                    "type": f"JSON key → {data_type}" if json_parent else f"Mapped → {data_type}",
                    "nullable": True,
                    "primary_key": False,
                    "unique": False,
                    "foreign_keys": [],
                    "is_virtual": True,
                    "json_parent": json_parent,
                    "user_mapping": m,
                }
            )
            existing.add(col_name)
            virtual_count += 1
        if added:
            model["columns"] = sorted(model["columns"] + added, key=lambda c: c["name"])
            model["column_count"] = len(model["columns"])
    return virtual_count


async def _build_models_response(
    db: AsyncSession,
    vendor_id: Optional[UUID],
) -> dict:
    models = build_schema_catalog()
    try:
        models = enrich_models_with_api_bindings(models)
    except Exception:
        pass

    mappings: list[dict] = []
    if vendor_id is not None:
        try:
            mappings = await mapping_svc.list_mappings(db, vendor_id)
        except Exception:
            mappings = []

    mapping_by_col = {f"{m['table_name']}.{m['column_name']}": m for m in mappings}
    user_mapped_columns = 0
    for model in models:
        for col in model["columns"]:
            if col.get("user_mapping"):
                user_mapped_columns += 1
                continue
            key = f"{model['table']}.{col['name']}"
            user_map = mapping_by_col.get(key)
            col["user_mapping"] = user_map
            if user_map:
                user_mapped_columns += 1

    virtual_mapped_columns = _enrich_models_with_virtual_mapping_columns(models, mappings)
    user_mapped_columns += virtual_mapped_columns

    api_bound_columns = sum(1 for m in models for c in m["columns"] if c.get("api_bindings"))
    return {
        "models": models,
        "model_count": len(models),
        "table_count": len(models),
        "column_count": sum(m["column_count"] for m in models),
        "api_bound_columns": api_bound_columns,
        "user_mapped_columns": user_mapped_columns,
        "mappings": mappings,
        "vendor_resolved": vendor_id is not None,
    }


@router.get("/models")
async def list_schema_models(
    _user: User = Depends(get_current_active_user),
    vendor_id: Optional[UUID] = Depends(_optional_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Database model catalog — any logged-in user; vendor mappings when tenant resolves."""
    return await _build_models_response(db, vendor_id)


@router.get("/mappings")
async def list_field_mappings(
    vendor_id: Optional[UUID] = Depends(_optional_vendor_id),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_active_user),
):
    """Active field mappings for this vendor (empty when no tenant)."""
    if vendor_id is None:
        return {"items": [], "total": 0}
    items = await mapping_svc.list_mappings(db, vendor_id)
    return {"items": items, "total": len(items)}


@router.post("/mappings", status_code=201)
async def create_field_mapping(
    data: FieldMappingCreate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _vendor_user: VendorUser = Depends(require_role("owner", "admin")),
):
    try:
        row = await mapping_svc.create_mapping(db, vendor_id, data.model_dump())
        await db.commit()
        return row
    except ValueError as e:
        await db.rollback()
        raise HTTPException(400, str(e))


@router.patch("/mappings/{mapping_id}")
async def update_field_mapping(
    mapping_id: UUID,
    data: FieldMappingUpdate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _vendor_user: VendorUser = Depends(require_role("owner", "admin")),
):
    try:
        row = await mapping_svc.update_mapping(
            db, vendor_id, mapping_id, data.model_dump(exclude_unset=True)
        )
        await db.commit()
        return row
    except ValueError as e:
        await db.rollback()
        raise HTTPException(404, str(e))


@router.delete("/mappings/{mapping_id}", status_code=204)
async def delete_field_mapping(
    mapping_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _vendor_user: VendorUser = Depends(require_role("owner", "admin")),
):
    try:
        await mapping_svc.delete_mapping(db, vendor_id, mapping_id)
        await db.commit()
    except ValueError as e:
        await db.rollback()
        raise HTTPException(404, str(e))


@router.get("/table-data/tables")
async def list_vendor_table_data_tables(
    vendor_id: UUID = Depends(get_current_vendor_id),
    _vendor_user: VendorUser = Depends(require_role("owner", "admin")),
):
    """Tables this business may browse (tenant-scoped rows only)."""
    models = filter_catalog_for_vendor(build_schema_catalog())
    return {
        "models": models,
        "model_count": len(models),
        "table_count": len(models),
        "scope": "vendor",
    }


@router.get("/table-data/find")
async def find_vendor_table_data(
    q: str = Query(..., min_length=2, max_length=120, description="UUID or text to locate"),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _vendor_user: VendorUser = Depends(require_role("owner", "admin")),
):
    """Search this business's tables for a UUID or text value."""
    return await find_value_across_tables(db, q, vendor_id=vendor_id)


@router.get("/table-data/{table_name}")
async def browse_vendor_table_data(
    table_name: str,
    q: Optional[str] = Query(None, max_length=200),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _vendor_user: VendorUser = Depends(require_role("owner", "admin")),
):
    """Browse rows for one table — only records for this business."""
    try:
        return await browse_table_rows(
            db, table_name, vendor_id=vendor_id, q=q, page=page, page_size=page_size
        )
    except ValueError as e:
        raise HTTPException(400, str(e))

