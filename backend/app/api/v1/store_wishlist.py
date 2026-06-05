from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_customer, get_store_vendor_id
from app.database import get_db
from app.models.customer import Customer
from app.schemas.wishlist import WishlistItemAdd, WishlistResponse
from app.services.wishlist_service import WishlistService

router = APIRouter()


@router.get("", response_model=WishlistResponse)
async def get_wishlist(
    customer: Customer = Depends(get_current_active_customer),
    vendor_id: UUID = Depends(get_store_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    return await WishlistService(db).get_wishlist(vendor_id, customer.id)


@router.post("/items", response_model=WishlistResponse)
async def add_wishlist_item(
    item: WishlistItemAdd,
    customer: Customer = Depends(get_current_active_customer),
    vendor_id: UUID = Depends(get_store_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    return await WishlistService(db).add_item(vendor_id, customer.id, item)


@router.post("/toggle", response_model=WishlistResponse)
async def toggle_wishlist_item(
    item: WishlistItemAdd,
    customer: Customer = Depends(get_current_active_customer),
    vendor_id: UUID = Depends(get_store_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    return await WishlistService(db).toggle_item(vendor_id, customer.id, item)


@router.delete("/items/{product_id}", response_model=WishlistResponse)
async def remove_wishlist_item(
    product_id: str,
    customer: Customer = Depends(get_current_active_customer),
    vendor_id: UUID = Depends(get_store_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    return await WishlistService(db).remove_item(vendor_id, customer.id, product_id)


@router.put("/sync", response_model=WishlistResponse)
async def sync_wishlist(
    items: list[dict],
    customer: Customer = Depends(get_current_active_customer),
    vendor_id: UUID = Depends(get_store_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Merge local wishlist items into the server copy (on login)."""
    return await WishlistService(db).sync_items(vendor_id, customer.id, items)
