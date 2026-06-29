# app/api/v1/vendor_plants.py
from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.deps import get_current_vendor_id
from app.models.plant import Plant
from app.schemas.plant import PlantCreate, PlantUpdate
from app.repositories.plant_repo import PlantRepository
from app.services.catalog_store_scope import validate_store_ids

router = APIRouter()


def _plant_to_dict(plant: Plant) -> dict:
    return {
        "id": str(plant.id),
        "vendor_id": str(plant.vendor_id),
        "store_id": str(plant.store_id),
        "name": plant.name,
        "code": plant.code,
        "description": plant.description,
        "address": plant.address or {},
        "is_active": plant.is_active,
        "sort_order": plant.sort_order or 0,
        "created_at": plant.created_at.isoformat() if plant.created_at else None,
        "updated_at": plant.updated_at.isoformat() if plant.updated_at else None,
    }


@router.get("")
async def list_plants(
    store_id: str = Query(..., description="Business unit id"),
    is_active: Optional[bool] = Query(None),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    await validate_store_ids(db, vendor_id, [store_id])
    repo = PlantRepository(db)
    plants = await repo.list_by_store(vendor_id, UUID(store_id), is_active=is_active)
    return JSONResponse(content={"plants": [_plant_to_dict(p) for p in plants]})


@router.get("/{plant_id}")
async def get_plant(
    plant_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = PlantRepository(db)
    plant = await repo.get_by_vendor_and_id(vendor_id, plant_id)
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")
    return JSONResponse(content=_plant_to_dict(plant))


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_plant(
    data: PlantCreate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    await validate_store_ids(db, vendor_id, [data.store_id])
    repo = PlantRepository(db)
    store_uuid = UUID(data.store_id)

    if data.code:
        existing = await repo.get_by_store_and_code(vendor_id, store_uuid, data.code.strip())
        if existing:
            raise HTTPException(
                status_code=400,
                detail="A plant with this code already exists in this business unit",
            )

    plant = Plant(
        vendor_id=vendor_id,
        store_id=store_uuid,
        name=data.name.strip(),
        code=data.code.strip() if data.code else None,
        description=data.description,
        address=data.address or {},
        sort_order=data.sort_order,
    )
    db.add(plant)
    await db.commit()
    await db.refresh(plant)
    return JSONResponse(content=_plant_to_dict(plant), status_code=201)


@router.put("/{plant_id}")
async def update_plant(
    plant_id: UUID,
    data: PlantUpdate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = PlantRepository(db)
    plant = await repo.get_by_vendor_and_id(vendor_id, plant_id)
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")

    if data.code is not None:
        code = data.code.strip() if data.code else None
        if code:
            dup = await repo.get_by_store_and_code(vendor_id, plant.store_id, code)
            if dup and dup.id != plant.id:
                raise HTTPException(
                    status_code=400,
                    detail="A plant with this code already exists in this business unit",
                )
        plant.code = code

    if data.name is not None:
        plant.name = data.name.strip()
    if data.description is not None:
        plant.description = data.description
    if data.address is not None:
        plant.address = data.address
    if data.is_active is not None:
        plant.is_active = data.is_active
    if data.sort_order is not None:
        plant.sort_order = data.sort_order

    await db.commit()
    await db.refresh(plant)
    return JSONResponse(content=_plant_to_dict(plant))


@router.delete("/{plant_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_plant(
    plant_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = PlantRepository(db)
    plant = await repo.get_by_vendor_and_id(vendor_id, plant_id)
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")
    await db.delete(plant)
    await db.commit()
