# app/api/v1/vendor_storage_locations.py
from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.deps import get_current_vendor_id, require_permission
from app.models.storage_location import StorageLocation
from app.models.store import Store
from app.schemas.storage_location import StorageLocationCreate, StorageLocationUpdate
from app.repositories.storage_location_repo import StorageLocationRepository
from app.repositories.plant_repo import PlantRepository
from app.services.catalog_store_scope import validate_store_ids

router = APIRouter(dependencies=[Depends(require_permission("masterdata.view"))])

VALID_STOCK_TYPES = {"unrestricted", "quarantine", "rejected", "returns"}


def _normalize_stock_type(value: str | None) -> str:
    raw = (value or "unrestricted").strip().lower()
    if raw not in VALID_STOCK_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"stock_type must be one of: {', '.join(sorted(VALID_STOCK_TYPES))}",
        )
    return raw


def _location_to_dict(loc: StorageLocation) -> dict:
    return {
        "id": str(loc.id),
        "vendor_id": str(loc.vendor_id),
        "store_id": str(loc.store_id),
        "plant_id": str(loc.plant_id) if loc.plant_id else None,
        "parent_id": str(loc.parent_id) if loc.parent_id else None,
        "name": loc.name,
        "code": loc.code,
        "description": loc.description,
        "is_active": loc.is_active,
        "sort_order": loc.sort_order or 0,
        "stock_type": getattr(loc, "stock_type", None) or "unrestricted",
        "storage_condition": getattr(loc, "storage_condition", None),
        "temp_min_c": getattr(loc, "temp_min_c", None),
        "temp_max_c": getattr(loc, "temp_max_c", None),
        "custom_fields": loc.custom_fields or [],
        "children": [],
        "created_at": loc.created_at.isoformat() if loc.created_at else None,
        "updated_at": loc.updated_at.isoformat() if loc.updated_at else None,
    }


def _tree_node_to_dict(node: dict) -> dict:
    loc = node["_model"]
    d = _location_to_dict(loc)
    d["children"] = [_tree_node_to_dict(ch) for ch in node.get("children", [])]
    return d


@router.get("")
async def list_storage_locations(
    store_id: Optional[str] = Query(None, description="Business unit id — omit for all units"),
    plant_id: Optional[str] = Query(None, description="Filter by plant"),
    is_active: Optional[bool] = Query(None),
    tree: bool = Query(False, description="Return nested tree"),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = StorageLocationRepository(db)
    sid = UUID(store_id) if store_id else None
    pid = UUID(plant_id) if plant_id else None

    if sid:
        await validate_store_ids(db, vendor_id, [store_id])

    if pid:
        plant_repo = PlantRepository(db)
        plant = await plant_repo.get_by_vendor_and_id(vendor_id, pid)
        if not plant:
            raise HTTPException(status_code=400, detail="Plant not found")
        if sid and plant.store_id != sid:
            raise HTTPException(status_code=400, detail="Plant not found in this business unit")

    if tree:
        tree_data = await repo.get_tree(vendor_id, sid, is_active=is_active, plant_id=pid)
        return JSONResponse(content={
            "locations": [_tree_node_to_dict(n) for n in tree_data],
        })

    items = await repo.list_all_flat(vendor_id, sid, is_active=is_active, plant_id=pid)
    return JSONResponse(content={
        "locations": [_location_to_dict(loc) for loc in items],
    })


@router.get("/{location_id}")
async def get_storage_location(
    location_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = StorageLocationRepository(db)
    loc = await repo.get_by_vendor_and_id(vendor_id, location_id)
    if not loc:
        raise HTTPException(status_code=404, detail="Storage location not found")
    d = _location_to_dict(loc)
    children = await repo.list_by_store(vendor_id, loc.store_id, parent_id=str(location_id))
    d["children"] = [_location_to_dict(ch) for ch in children]
    return JSONResponse(content=d)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_storage_location(
    data: StorageLocationCreate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    await validate_store_ids(db, vendor_id, [data.store_id])
    repo = StorageLocationRepository(db)
    plant_repo = PlantRepository(db)
    store_uuid = UUID(data.store_id)
    plant_uuid = UUID(data.plant_id) if data.plant_id else None

    if plant_uuid is not None:
        plant = await plant_repo.get_by_vendor_and_id(vendor_id, plant_uuid)
        # Plant belongs to a business unit; location store_id may be that BU
        # or a branch under it.
        if not plant:
            raise HTTPException(status_code=400, detail="Plant not found")
        if plant.store_id != store_uuid:
            branch = (
                await db.execute(
                    select(Store.id).where(
                        Store.id == store_uuid,
                        Store.vendor_id == vendor_id,
                        Store.parent_id == plant.store_id,
                    )
                )
            ).scalar_one_or_none()
            if not branch:
                raise HTTPException(
                    status_code=400,
                    detail="Plant not found in this business unit or branch",
                )

    if data.code:
        existing = await repo.get_by_store_and_code(vendor_id, store_uuid, data.code.strip())
        if existing:
            raise HTTPException(status_code=400, detail="A location with this code already exists in this business unit")

    parent_uuid = None
    if data.parent_id:
        parent = await repo.get_by_vendor_and_id(vendor_id, UUID(data.parent_id))
        if not parent:
            raise HTTPException(status_code=400, detail="Parent location not found")
        if parent.store_id != store_uuid:
            raise HTTPException(status_code=400, detail="Parent must belong to the same business unit")
        if parent.plant_id != plant_uuid:
            raise HTTPException(status_code=400, detail="Parent must belong to the same plant / branch scope")
        parent_uuid = parent.id

    loc = StorageLocation(
        vendor_id=vendor_id,
        store_id=store_uuid,
        plant_id=plant_uuid,
        parent_id=parent_uuid,
        name=data.name.strip(),
        code=data.code.strip() if data.code else None,
        description=data.description,
        sort_order=data.sort_order,
        stock_type=_normalize_stock_type(data.stock_type),
        storage_condition=(data.storage_condition or None),
        temp_min_c=data.temp_min_c,
        temp_max_c=data.temp_max_c,
        custom_fields=[f.model_dump() for f in data.custom_fields] if data.custom_fields else [],
    )
    db.add(loc)
    await db.commit()
    await db.refresh(loc)
    return JSONResponse(content=_location_to_dict(loc), status_code=201)


@router.put("/{location_id}")
async def update_storage_location(
    location_id: UUID,
    data: StorageLocationUpdate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = StorageLocationRepository(db)
    loc = await repo.get_by_vendor_and_id(vendor_id, location_id)
    if not loc:
        raise HTTPException(status_code=404, detail="Storage location not found")

    if data.plant_id is not None:
        if not data.plant_id:
            loc.plant_id = None
        else:
            plant_repo = PlantRepository(db)
            plant = await plant_repo.get_by_vendor_and_id(vendor_id, UUID(data.plant_id))
            if not plant:
                raise HTTPException(status_code=400, detail="Plant not found")
            if plant.store_id != loc.store_id:
                branch = (
                    await db.execute(
                        select(Store.id).where(
                            Store.id == loc.store_id,
                            Store.vendor_id == vendor_id,
                            Store.parent_id == plant.store_id,
                        )
                    )
                ).scalar_one_or_none()
                if not branch:
                    raise HTTPException(status_code=400, detail="Plant not found in this business unit")
            loc.plant_id = plant.id

    if data.code is not None:
        code = data.code.strip() if data.code else None
        if code:
            dup = await repo.get_by_store_and_code(vendor_id, loc.store_id, code)
            if dup and dup.id != loc.id:
                raise HTTPException(status_code=400, detail="A location with this code already exists in this business unit")
        loc.code = code

    if data.name is not None:
        loc.name = data.name.strip()
    if data.description is not None:
        loc.description = data.description
    if data.is_active is not None:
        loc.is_active = data.is_active
    if data.sort_order is not None:
        loc.sort_order = data.sort_order
    if data.stock_type is not None:
        loc.stock_type = _normalize_stock_type(data.stock_type)
    if data.storage_condition is not None:
        loc.storage_condition = data.storage_condition or None
    if data.temp_min_c is not None:
        loc.temp_min_c = data.temp_min_c
    if data.temp_max_c is not None:
        loc.temp_max_c = data.temp_max_c
    if data.custom_fields is not None:
        loc.custom_fields = [f.model_dump() for f in data.custom_fields]

    if data.parent_id is not None:
        if data.parent_id == str(location_id):
            raise HTTPException(status_code=400, detail="Location cannot be its own parent")
        if data.parent_id:
            parent = await repo.get_by_vendor_and_id(vendor_id, UUID(data.parent_id))
            if not parent:
                raise HTTPException(status_code=400, detail="Parent location not found")
            if parent.store_id != loc.store_id:
                raise HTTPException(status_code=400, detail="Parent must belong to the same business unit")
            if parent.plant_id != loc.plant_id:
                raise HTTPException(status_code=400, detail="Parent must belong to the same plant")
            loc.parent_id = parent.id
        else:
            loc.parent_id = None

    await db.commit()
    await db.refresh(loc)
    return JSONResponse(content=_location_to_dict(loc))


@router.delete("/{location_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_storage_location(
    location_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = StorageLocationRepository(db)
    loc = await repo.get_by_vendor_and_id(vendor_id, location_id)
    if not loc:
        raise HTTPException(status_code=404, detail="Storage location not found")
    await db.delete(loc)
    await db.commit()
