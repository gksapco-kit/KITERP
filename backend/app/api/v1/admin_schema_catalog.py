"""Platform super-admin schema tools (table browse / value search)."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_superuser
from app.database import get_db
from app.models.user import User
from app.services.schema_catalog_service import build_schema_catalog
from app.services.table_data_service import browse_table_rows, find_value_across_tables

router = APIRouter()


@router.get("/models")
async def list_schema_models_catalog(
    _user: User = Depends(get_current_superuser),
):
    """Database table catalog for super-admin Table Data UI."""
    models = build_schema_catalog()
    return {
        "models": models,
        "model_count": len(models),
        "table_count": len(models),
        "scope": "platform",
    }


@router.get("/table-data/find")
async def find_table_data_by_value(
    q: str = Query(..., min_length=2, max_length=120, description="UUID or text to locate"),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_superuser),
):
    """Search all application tables for a UUID or text value."""
    return await find_value_across_tables(db, q)


@router.get("/table-data/{table_name}")
async def list_table_data_rows(
    table_name: str,
    q: Optional[str] = Query(None, max_length=200),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_superuser),
):
    """Browse rows for one table with optional search."""
    try:
        return await browse_table_rows(db, table_name, q=q, page=page, page_size=page_size)
    except ValueError as e:
        raise HTTPException(400, str(e))
