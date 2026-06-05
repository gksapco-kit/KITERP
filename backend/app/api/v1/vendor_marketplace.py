from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user, get_current_vendor_id
from app.database import get_db
from app.models.user import User
from app.models.vendor import Vendor
from app.repositories.vendor_repo import VendorRepository
from app.schemas.marketplace import MarketplaceLeadResponse, MarketplaceQuoteCreate, MarketplaceQuoteResponse
from app.services.marketplace_service import MarketplaceService

router = APIRouter()


async def _vendor(db: AsyncSession, vendor_id: UUID) -> Vendor:
    v = await VendorRepository(db).get_by_id(vendor_id)
    if not v:
        from fastapi import HTTPException
        raise HTTPException(404, "Vendor not found")
    return v


@router.get("/leads", response_model=list[MarketplaceLeadResponse])
async def list_open_leads(
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_active_user),
):
    vendor = await _vendor(db, vendor_id)
    return await MarketplaceService(db).list_open_leads_for_vendor(vendor)


@router.post("/leads/{lead_id}/quotes", response_model=MarketplaceQuoteResponse, status_code=status.HTTP_201_CREATED)
async def submit_quote(
    lead_id: UUID,
    data: MarketplaceQuoteCreate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_active_user),
):
    vendor = await _vendor(db, vendor_id)
    return await MarketplaceService(db).submit_quote(vendor, lead_id, data)


@router.get("/quotes")
async def list_my_quotes(
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_active_user),
):
    return await MarketplaceService(db).list_vendor_quotes(vendor_id)
