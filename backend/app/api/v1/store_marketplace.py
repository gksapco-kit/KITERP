from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_customer, get_store_vendor_id
from app.database import get_db
from app.models.customer import Customer
from app.schemas.marketplace import MarketplaceLeadCreate, MarketplaceLeadResponse
from app.services.marketplace_service import MarketplaceService

router = APIRouter()


@router.post("/leads", response_model=MarketplaceLeadResponse, status_code=status.HTTP_201_CREATED)
async def create_marketplace_lead(
    data: MarketplaceLeadCreate,
    customer: Customer = Depends(get_current_active_customer),
    db: AsyncSession = Depends(get_db),
    _vendor_id: UUID = Depends(get_store_vendor_id),
):
    return await MarketplaceService(db).create_lead(customer, data)


@router.get("/leads", response_model=list[MarketplaceLeadResponse])
async def list_my_leads(
    customer: Customer = Depends(get_current_active_customer),
    db: AsyncSession = Depends(get_db),
    _vendor_id: UUID = Depends(get_store_vendor_id),
):
    return await MarketplaceService(db).list_customer_leads(customer.id)


@router.get("/leads/{lead_id}", response_model=MarketplaceLeadResponse)
async def get_my_lead(
    lead_id: UUID,
    customer: Customer = Depends(get_current_active_customer),
    db: AsyncSession = Depends(get_db),
    _vendor_id: UUID = Depends(get_store_vendor_id),
):
    return await MarketplaceService(db).get_customer_lead(customer.id, lead_id)


@router.post("/leads/{lead_id}/quotes/{quote_id}/accept", response_model=MarketplaceLeadResponse)
async def accept_marketplace_quote(
    lead_id: UUID,
    quote_id: UUID,
    customer: Customer = Depends(get_current_active_customer),
    db: AsyncSession = Depends(get_db),
    _vendor_id: UUID = Depends(get_store_vendor_id),
):
    return await MarketplaceService(db).accept_quote(customer.id, lead_id, quote_id)
