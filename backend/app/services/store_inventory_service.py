"""Store-level and bin-level inventory helpers."""
from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.store import StoreInventory
from app.models.storage_location import StorageLocation
from app.models.vendor_product import Product


async def validate_storage_location(
    db: AsyncSession,
    vendor_id: UUID,
    store_id: UUID,
    storage_location_id: UUID,
) -> StorageLocation:
    result = await db.execute(
        select(StorageLocation).where(
            StorageLocation.id == storage_location_id,
            StorageLocation.vendor_id == vendor_id,
            StorageLocation.store_id == store_id,
            StorageLocation.is_active == True,
        )
    )
    loc = result.scalar_one_or_none()
    if not loc:
        raise HTTPException(400, "Invalid or inactive storage location for this business unit")
    return loc


async def get_store_inventory_row(
    db: AsyncSession,
    store_id: UUID,
    product_id: UUID,
    variant_id: UUID | None,
    storage_location_id: UUID | None,
) -> StoreInventory | None:
    q = select(StoreInventory).where(
        StoreInventory.store_id == store_id,
        StoreInventory.product_id == product_id,
    )
    if variant_id:
        q = q.where(StoreInventory.variant_id == variant_id)
    else:
        q = q.where(StoreInventory.variant_id.is_(None))
    if storage_location_id:
        q = q.where(StoreInventory.storage_location_id == storage_location_id)
    else:
        q = q.where(StoreInventory.storage_location_id.is_(None))
    result = await db.execute(q)
    return result.scalar_one_or_none()


async def apply_store_inventory_delta(
    db: AsyncSession,
    vendor_id: UUID,
    store_id: UUID,
    product_id: UUID,
    variant_id: UUID | None,
    delta: int,
    storage_location_id: UUID | None = None,
) -> StoreInventory:
    if storage_location_id:
        await validate_storage_location(db, vendor_id, store_id, storage_location_id)

    inv = await get_store_inventory_row(db, store_id, product_id, variant_id, storage_location_id)
    if inv:
        new_qty = (inv.quantity or 0) + delta
        if new_qty < 0:
            label = "at this storage location" if storage_location_id else "at this business unit"
            raise ValueError(f"Insufficient stock {label}. Available: {inv.quantity or 0}, requested: {abs(delta)}")
        inv.quantity = new_qty
        return inv

    if delta < 0:
        raise ValueError("Insufficient stock — no inventory record found for this location")
    inv = StoreInventory(
        store_id=store_id,
        vendor_id=vendor_id,
        product_id=product_id,
        variant_id=variant_id,
        storage_location_id=storage_location_id,
        quantity=delta,
    )
    db.add(inv)
    return inv


async def set_store_inventory_quantity(
    db: AsyncSession,
    vendor_id: UUID,
    store_id: UUID,
    product_id: UUID,
    variant_id: UUID | None,
    new_quantity: int,
    storage_location_id: UUID | None = None,
) -> tuple[StoreInventory, int]:
    """Set absolute quantity; returns (row, delta)."""
    if new_quantity < 0:
        raise ValueError("Quantity cannot be negative")
    if storage_location_id:
        await validate_storage_location(db, vendor_id, store_id, storage_location_id)

    inv = await get_store_inventory_row(db, store_id, product_id, variant_id, storage_location_id)
    before = inv.quantity or 0 if inv else 0
    delta = new_quantity - before

    if inv:
        inv.quantity = new_quantity
    else:
        inv = StoreInventory(
            store_id=store_id,
            vendor_id=vendor_id,
            product_id=product_id,
            variant_id=variant_id,
            storage_location_id=storage_location_id,
            quantity=new_quantity,
        )
        db.add(inv)
    return inv, delta


async def sync_product_quantity_from_stores(
    db: AsyncSession,
    vendor_id: UUID,
    product_id: UUID,
    variant_id: UUID | None = None,
) -> None:
    """Sync product/variant quantity to sum of store_inventory rows."""
    q = select(func.coalesce(func.sum(StoreInventory.quantity), 0)).where(
        StoreInventory.product_id == product_id,
        StoreInventory.vendor_id == vendor_id,
    )
    if variant_id:
        q = q.where(StoreInventory.variant_id == variant_id)
    else:
        q = q.where(StoreInventory.variant_id.is_(None))
    total = (await db.execute(q)).scalar() or 0

    if variant_id:
        from app.models.vendor_product import ProductVariant
        entity = await db.get(ProductVariant, variant_id)
    else:
        entity = await db.get(Product, product_id)

    if entity:
        entity.quantity = total
        if total > 0 and getattr(entity, "stock_status", None) == "out_of_stock":
            entity.stock_status = "in_stock"
