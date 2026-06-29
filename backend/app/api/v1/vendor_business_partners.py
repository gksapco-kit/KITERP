# app/api/v1/vendor_business_partners.py
from uuid import UUID
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.deps import get_current_vendor_id
from app.schemas.business_partner import (
    BusinessPartnerCreate, BusinessPartnerUpdate, RoleIn,
)
from app.services.business_partner_service import BusinessPartnerService

router = APIRouter()


@router.get("")
async def list_business_partners(
    search: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    svc = BusinessPartnerService(db)
    result = await svc.list(vendor_id, search=search, role=role, is_active=is_active, page=page, size=size)
    return JSONResponse(content=result)


@router.get("/check-duplicate")
async def check_duplicate(
    name: str = Query(...),
    phone: Optional[str] = Query(None),
    email: Optional[str] = Query(None),
    gstin: Optional[str] = Query(None),
    exclude_id: Optional[str] = Query(None),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Returns existing BP if a duplicate is found, 404 otherwise.

    Pass exclude_id when editing an existing record so it is not matched as a duplicate.
    """
    svc = BusinessPartnerService(db)
    dup = await svc.find_duplicate(
        vendor_id, name, phone, email, gstin,
        exclude_id=UUID(exclude_id) if exclude_id else None,
    )
    if not dup:
        raise HTTPException(status_code=404, detail="No duplicate found")
    return JSONResponse(content=svc._bp_to_dict(dup))


@router.get("/{bp_id}")
async def get_business_partner(
    bp_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    svc = BusinessPartnerService(db)
    return JSONResponse(content=await svc.get(vendor_id, bp_id))


@router.post("", status_code=201)
async def create_business_partner(
    data: BusinessPartnerCreate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    svc = BusinessPartnerService(db)
    identity = data.model_dump(exclude={"roles"})
    roles = [r.model_dump() for r in data.roles]
    result = await svc.create(vendor_id, identity, roles)
    return JSONResponse(content=result, status_code=201)


@router.put("/{bp_id}")
async def update_business_partner(
    bp_id: UUID,
    data: BusinessPartnerUpdate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    svc = BusinessPartnerService(db)
    patch = {k: v for k, v in data.model_dump().items() if v is not None}
    return JSONResponse(content=await svc.update(vendor_id, bp_id, patch))


@router.post("/{bp_id}/roles", status_code=201)
async def add_role(
    bp_id: UUID,
    data: RoleIn,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    svc = BusinessPartnerService(db)
    result = await svc.add_role(vendor_id, bp_id, data.role, data.attributes)
    return JSONResponse(content=result, status_code=201)


@router.delete("/{bp_id}/roles/{role}", status_code=204)
async def remove_role(
    bp_id: UUID,
    role: str,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    svc = BusinessPartnerService(db)
    await svc.remove_role(vendor_id, bp_id, role)
