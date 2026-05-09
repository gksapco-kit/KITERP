# app/api/v1/vendor_relationship_manager.py
"""Vendor-facing endpoints: assigned relationship manager + queries to them."""
from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.deps import get_current_vendor_user
from app.models.vendor_rm_query import VendorRmQuery
from app.models.vendor_user import VendorUser
from app.repositories.vendor_repo import VendorRepository

router = APIRouter()


class VendorRmQueryCreate(BaseModel):
    subject: str = Field(..., min_length=3, max_length=255)
    body: str = Field(..., min_length=10, max_length=8000)


class VendorRmQueryRow(BaseModel):
    id: str
    subject: str
    body: str
    status: str
    created_at: Optional[str] = None


@router.get("/relationship-manager")
async def get_my_relationship_manager(
    vu: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    repo = VendorRepository(db)
    vendor = await repo.get_by_id(vu.vendor_id)
    if not vendor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor not found")
    if not vendor.relationship_manager_user_id or not vendor.relationship_manager:
        return {"assigned": False, "manager": None}
    rm = vendor.relationship_manager
    return {
        "assigned": True,
        "manager": {
            "id": str(rm.id),
            "full_name": (rm.full_name or "").strip() or "—",
            "email": rm.email,
            "phone": rm.phone,
        },
    }


@router.get("/relationship-manager/queries", response_model=List[VendorRmQueryRow])
async def list_my_rm_queries(
    vu: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(VendorRmQuery)
        .where(VendorRmQuery.vendor_id == vu.vendor_id)
        .order_by(VendorRmQuery.created_at.desc())
    )
    rows = list(result.scalars().all())
    out: List[VendorRmQueryRow] = []
    for r in rows:
        out.append(
            VendorRmQueryRow(
                id=str(r.id),
                subject=r.subject,
                body=r.body,
                status=r.status,
                created_at=r.created_at.isoformat() if r.created_at else None,
            )
        )
    return out


@router.post(
    "/relationship-manager/queries",
    response_model=VendorRmQueryRow,
    status_code=status.HTTP_201_CREATED,
)
async def create_rm_query(
    body: VendorRmQueryCreate,
    vu: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    repo = VendorRepository(db)
    vendor = await repo.get_by_id(vu.vendor_id)
    if not vendor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor not found")
    if not vendor.relationship_manager_user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No relationship manager is assigned to your account yet. Please contact platform support.",
        )
    q = VendorRmQuery(
        vendor_id=vendor.id,
        created_by_user_id=vu.user_id,
        subject=body.subject.strip(),
        body=body.body.strip(),
        status="open",
    )
    db.add(q)
    await db.commit()
    await db.refresh(q)
    return VendorRmQueryRow(
        id=str(q.id),
        subject=q.subject,
        body=q.body,
        status=q.status,
        created_at=q.created_at.isoformat() if q.created_at else None,
    )
