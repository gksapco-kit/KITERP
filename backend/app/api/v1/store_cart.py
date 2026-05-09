# app/api/v1/store_cart.py
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.database import get_db
from app.api.deps import get_store_vendor_id, get_current_active_customer
from app.models.customer import Customer
from app.schemas.cart import CartItemAdd, CartItemUpdate, CartResponse
from app.services.cart_service import CartService

router = APIRouter()


@router.get("", response_model=CartResponse)
async def get_cart(
    customer: Customer = Depends(get_current_active_customer),
    vendor_id: UUID = Depends(get_store_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Get the customer's cart."""
    service = CartService(db)
    return await service.get_cart(vendor_id, customer.id)


@router.post("/items", response_model=CartResponse)
async def add_item(
    item: CartItemAdd,
    customer: Customer = Depends(get_current_active_customer),
    vendor_id: UUID = Depends(get_store_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Add an item to the cart."""
    service = CartService(db)
    return await service.add_item(vendor_id, customer.id, item)


@router.put("/items/{item_index}", response_model=CartResponse)
async def update_item(
    item_index: int,
    data: CartItemUpdate,
    customer: Customer = Depends(get_current_active_customer),
    vendor_id: UUID = Depends(get_store_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Update a cart item quantity."""
    service = CartService(db)
    return await service.update_item(vendor_id, customer.id, item_index, data)


@router.delete("/items/{item_index}", response_model=CartResponse)
async def remove_item(
    item_index: int,
    customer: Customer = Depends(get_current_active_customer),
    vendor_id: UUID = Depends(get_store_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Remove an item from the cart."""
    service = CartService(db)
    return await service.remove_item(vendor_id, customer.id, item_index)


@router.delete("", response_model=CartResponse)
async def clear_cart(
    customer: Customer = Depends(get_current_active_customer),
    vendor_id: UUID = Depends(get_store_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Clear the entire cart."""
    service = CartService(db)
    return await service.clear_cart(vendor_id, customer.id)
