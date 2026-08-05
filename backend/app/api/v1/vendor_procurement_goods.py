# app/api/v1/vendor_procurement_goods.py
from uuid import UUID
from typing import Optional, Sequence
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.deps import get_current_vendor_id, get_current_vendor_user, require_permission
from app.models.vendor_user import VendorUser
from app.models.user import User
from app.models.plant import Plant
from app.models.vendor_product import Product, ProductVariant
from app.models.procurement_goods import GoodsBatch, GoodsMovementDocument
from app.schemas.procurement_goods import (
    GoodsBatchCreate, GoodsBatchUpdate, GoodsMovementCreate,
)
from app.repositories.procurement_goods_repo import (
    GoodsBatchRepository, GoodsMovementDocumentRepository,
)
from app.services.store_inventory_service import (
    apply_store_inventory_delta,
    sync_product_quantity_from_stores,
)

router = APIRouter(dependencies=[Depends(require_permission("procurement.view"))])


# ── Serialisers ───────────────────────────────────────────────────

def _batch_to_dict(
    b: GoodsBatch,
    *,
    product_name: Optional[str] = None,
    variant_name: Optional[str] = None,
    uom: Optional[str] = None,
) -> dict:
    def _f(v):
        return float(v) if v is not None else 0

    return {
        "id": str(b.id),
        "vendor_id": str(b.vendor_id),
        "product_id": str(b.product_id),
        "variant_id": str(b.variant_id) if b.variant_id else None,
        "product_name": product_name,
        "variant_name": variant_name,
        "uom": uom,
        "batch_number": b.batch_number,
        "serial_numbers": b.serial_numbers or [],
        "manufacturing_date": b.manufacturing_date.isoformat() if b.manufacturing_date else None,
        "expiry_date": b.expiry_date.isoformat() if b.expiry_date else None,
        "best_before_date": b.best_before_date.isoformat() if b.best_before_date else None,
        "plant_id": str(b.plant_id) if b.plant_id else None,
        "storage_location_id": str(b.storage_location_id) if b.storage_location_id else None,
        "quantity_received": _f(b.quantity_received),
        "quantity_available": _f(b.quantity_available),
        "quantity_reserved": _f(b.quantity_reserved),
        "quantity_consumed": _f(b.quantity_consumed),
        "source_type": b.source_type,
        "source_id": str(b.source_id) if b.source_id else None,
        "quality_status": b.quality_status,
        "supplier_batch_number": b.supplier_batch_number,
        "notes": b.notes,
        "is_active": b.is_active,
        "created_at": b.created_at.isoformat() if b.created_at else None,
        "updated_at": b.updated_at.isoformat() if b.updated_at else None,
    }


async def _enrich_batches(db: AsyncSession, batches: Sequence[GoodsBatch]) -> list[dict]:
    if not batches:
        return []

    product_ids = {b.product_id for b in batches if b.product_id}
    variant_ids = {b.variant_id for b in batches if b.variant_id}

    products: dict[UUID, Product] = {}
    if product_ids:
        result = await db.execute(select(Product).where(Product.id.in_(product_ids)))
        products = {p.id: p for p in result.scalars().all()}

    variants: dict[UUID, ProductVariant] = {}
    if variant_ids:
        result = await db.execute(select(ProductVariant).where(ProductVariant.id.in_(variant_ids)))
        variants = {v.id: v for v in result.scalars().all()}

    enriched: list[dict] = []
    for b in batches:
        product = products.get(b.product_id)
        variant = variants.get(b.variant_id) if b.variant_id else None
        uom = None
        if variant and getattr(variant, "uom", None):
            uom = variant.uom
        elif product and getattr(product, "uom", None):
            uom = product.uom
        enriched.append(_batch_to_dict(
            b,
            product_name=product.name if product else None,
            variant_name=variant.name if variant else None,
            uom=uom,
        ))
    return enriched


def _gmd_to_dict(
    d: GoodsMovementDocument,
    *,
    plant_name: Optional[str] = None,
    performed_by_name: Optional[str] = None,
) -> dict:
    return {
        "id": str(d.id),
        "vendor_id": str(d.vendor_id),
        "document_number": d.document_number,
        "movement_type": d.movement_type,
        "po_receipt_id": str(d.po_receipt_id) if d.po_receipt_id else None,
        "production_order_id": str(d.production_order_id) if d.production_order_id else None,
        "plant_id": str(d.plant_id) if d.plant_id else None,
        "plant_name": plant_name,
        "from_storage_location_id": str(d.from_storage_location_id) if d.from_storage_location_id else None,
        "to_storage_location_id": str(d.to_storage_location_id) if d.to_storage_location_id else None,
        "lines": d.lines or [],
        "posting_date": d.posting_date.isoformat() if d.posting_date else None,
        "notes": d.notes,
        "performed_by": str(d.performed_by) if d.performed_by else None,
        "performed_by_name": performed_by_name,
        "created_at": d.created_at.isoformat() if d.created_at else None,
    }


async def _enrich_gmds(db: AsyncSession, docs: Sequence[GoodsMovementDocument]) -> list[dict]:
    """Enrich a list of movement documents with plant name and performer name."""
    if not docs:
        return []

    plant_ids = {d.plant_id for d in docs if d.plant_id}
    performed_by_ids = {d.performed_by for d in docs if d.performed_by}

    plants: dict[UUID, str] = {}
    if plant_ids:
        rows = (await db.execute(select(Plant).where(Plant.id.in_(plant_ids)))).scalars().all()
        plants = {r.id: r.name for r in rows}

    performers: dict[UUID, str] = {}
    if performed_by_ids:
        rows = (await db.execute(
            select(VendorUser).where(VendorUser.id.in_(performed_by_ids))
        )).scalars().all()
        user_ids = {vu.user_id for vu in rows}
        if user_ids:
            users = (await db.execute(select(User).where(User.id.in_(user_ids)))).scalars().all()
            user_map = {u.id: u.full_name for u in users}
        else:
            user_map = {}
        performers = {vu.id: user_map.get(vu.user_id, "") for vu in rows}

    return [
        _gmd_to_dict(
            d,
            plant_name=plants.get(d.plant_id) if d.plant_id else None,
            performed_by_name=performers.get(d.performed_by) if d.performed_by else None,
        )
        for d in docs
    ]


# Movement types that add stock
_RECEIPT_TYPES = {"gr_po", "receipt_no_po"}
# Movement types that consume/remove stock
_ISSUE_TYPES = {"gi_cost_center", "gi_production", "return_to_vendor", "gr_reversal"}
# Movement types that transfer stock (reduce from source, add to destination)
_TRANSFER_TYPES = {"plant_transfer", "sloc_transfer"}


async def _update_entity_quantity_direct(
    db: AsyncSession,
    product_id: UUID,
    variant_id: Optional[UUID],
    delta: float,
) -> None:
    """Directly increment/decrement quantity on the Product or ProductVariant row.

    Used as a fallback when no plant/store is linked to the movement so that
    the product-level stock counter still stays accurate even without per-store
    store_inventory rows.
    """
    if variant_id:
        entity = await db.get(ProductVariant, variant_id)
    else:
        entity = await db.get(Product, product_id)
    if entity is None:
        return
    current = float(getattr(entity, "quantity", 0) or 0)
    new_qty = max(0.0, current + delta)
    entity.quantity = new_qty
    # Update stock_status to reflect the new quantity
    threshold = float(getattr(entity, "low_stock_threshold", 0) or 0)
    allow_backorders = getattr(entity, "allow_backorders", False)
    if new_qty <= 0 and not allow_backorders:
        if getattr(entity, "stock_status", None) != "discontinued":
            entity.stock_status = "out_of_stock"
    elif new_qty <= threshold and new_qty > 0:
        entity.stock_status = "low_stock"
    elif new_qty > 0 and getattr(entity, "stock_status", None) in ("out_of_stock", "low_stock"):
        entity.stock_status = "in_stock"


async def _apply_movement_to_stock(
    db: AsyncSession,
    vendor_id: UUID,
    doc: GoodsMovementDocument,
) -> None:
    """Create/update batches and adjust store inventory for each movement line."""

    movement_type = doc.movement_type
    lines = doc.lines or []

    for line in lines:
        try:
            product_id = UUID(line["product_id"])
        except (KeyError, ValueError):
            continue

        variant_id: Optional[UUID] = None
        if line.get("variant_id"):
            try:
                variant_id = UUID(line["variant_id"])
            except ValueError:
                pass

        qty = float(line.get("quantity") or 0)
        if qty <= 0:
            continue

        plant_id = doc.plant_id
        to_plant_id: Optional[UUID] = None
        if line.get("to_plant_id"):
            try:
                to_plant_id = UUID(line["to_plant_id"])
            except ValueError:
                pass

        from_sloc_id = doc.from_storage_location_id
        to_sloc_id = doc.to_storage_location_id

        # ── Resolve plant → store_id for stock adjustment ─────────────────
        store_id: Optional[UUID] = None
        if plant_id:
            plant_row = await db.get(Plant, plant_id)
            if plant_row:
                store_id = plant_row.store_id

        to_store_id: Optional[UUID] = None
        if to_plant_id:
            to_plant_row = await db.get(Plant, to_plant_id)
            if to_plant_row:
                to_store_id = to_plant_row.store_id

        int_qty = round(qty)

        if movement_type in _RECEIPT_TYPES:
            # ── Create/update batch ────────────────────────────────────────
            batch_number = line.get("batch_number") or f"{doc.document_number}-{str(product_id)[:8].upper()}"
            batch = GoodsBatch(
                vendor_id=vendor_id,
                product_id=product_id,
                variant_id=variant_id,
                batch_number=batch_number,
                plant_id=plant_id,
                storage_location_id=to_sloc_id or from_sloc_id,
                quantity_received=qty,
                quantity_available=qty,
                source_type="goods_movement",
                source_id=doc.id,
                quality_status="unrestricted",
                notes=doc.notes,
            )
            db.add(batch)

            # ── Adjust store inventory (or fall back to product-level qty) ─
            if store_id:
                try:
                    await apply_store_inventory_delta(
                        db, vendor_id, store_id, product_id, variant_id,
                        int_qty, storage_location_id=to_sloc_id or from_sloc_id,
                    )
                    await sync_product_quantity_from_stores(db, vendor_id, product_id, variant_id)
                except ValueError:
                    pass
            else:
                # No plant → no store row; update the product/variant counter directly.
                await _update_entity_quantity_direct(db, product_id, variant_id, qty)

        elif movement_type in _ISSUE_TYPES:
            # ── Reduce from batch (FIFO: oldest first) ────────────────────
            remaining = qty
            batch_q = (
                select(GoodsBatch)
                .where(
                    GoodsBatch.vendor_id == vendor_id,
                    GoodsBatch.product_id == product_id,
                    GoodsBatch.quantity_available > 0,
                    GoodsBatch.is_active == True,
                )
                .order_by(GoodsBatch.created_at.asc())
            )
            if variant_id:
                batch_q = batch_q.where(GoodsBatch.variant_id == variant_id)
            if plant_id:
                batch_q = batch_q.where(GoodsBatch.plant_id == plant_id)
            batches = (await db.execute(batch_q)).scalars().all()
            for b in batches:
                if remaining <= 0:
                    break
                consume = min(float(b.quantity_available), remaining)
                b.quantity_available = float(b.quantity_available) - consume
                b.quantity_consumed = float(b.quantity_consumed or 0) + consume
                remaining -= consume

            # ── Reduce from store inventory (or fall back to product-level qty) ─
            if store_id:
                try:
                    await apply_store_inventory_delta(
                        db, vendor_id, store_id, product_id, variant_id,
                        -int_qty, storage_location_id=from_sloc_id,
                    )
                    await sync_product_quantity_from_stores(db, vendor_id, product_id, variant_id)
                except ValueError:
                    pass
            else:
                await _update_entity_quantity_direct(db, product_id, variant_id, -qty)

        elif movement_type in _TRANSFER_TYPES:
            # ── Move from source batch/store to destination ───────────────
            remaining = qty
            from_batches_q = (
                select(GoodsBatch)
                .where(
                    GoodsBatch.vendor_id == vendor_id,
                    GoodsBatch.product_id == product_id,
                    GoodsBatch.quantity_available > 0,
                    GoodsBatch.is_active == True,
                )
                .order_by(GoodsBatch.created_at.asc())
            )
            if variant_id:
                from_batches_q = from_batches_q.where(GoodsBatch.variant_id == variant_id)
            if plant_id:
                from_batches_q = from_batches_q.where(GoodsBatch.plant_id == plant_id)
            from_batches = (await db.execute(from_batches_q)).scalars().all()
            for b in from_batches:
                if remaining <= 0:
                    break
                consume = min(float(b.quantity_available), remaining)
                b.quantity_available = float(b.quantity_available) - consume
                remaining -= consume

            transferred = qty - remaining
            if transferred > 0:
                dest_plant = to_plant_id or plant_id
                dest_batch = GoodsBatch(
                    vendor_id=vendor_id,
                    product_id=product_id,
                    variant_id=variant_id,
                    batch_number=f"{doc.document_number}-T-{str(product_id)[:8].upper()}",
                    plant_id=dest_plant,
                    storage_location_id=to_sloc_id,
                    quantity_received=transferred,
                    quantity_available=transferred,
                    source_type="goods_movement",
                    source_id=doc.id,
                    quality_status="unrestricted",
                    notes=doc.notes,
                )
                db.add(dest_batch)

                # Adjust both sides of store inventory
                if store_id:
                    try:
                        await apply_store_inventory_delta(
                            db, vendor_id, store_id, product_id, variant_id,
                            -round(transferred), storage_location_id=from_sloc_id,
                        )
                    except ValueError:
                        pass
                if to_store_id and to_store_id != store_id:
                    await apply_store_inventory_delta(
                        db, vendor_id, to_store_id, product_id, variant_id,
                        round(transferred), storage_location_id=to_sloc_id,
                    )
                elif store_id and to_store_id == store_id:
                    # Same BU, different location — net is zero; inventory already adjusted
                    await apply_store_inventory_delta(
                        db, vendor_id, store_id, product_id, variant_id,
                        round(transferred), storage_location_id=to_sloc_id,
                    )
                await sync_product_quantity_from_stores(db, vendor_id, product_id, variant_id)


# ── Goods Batches ─────────────────────────────────────────────────

@router.get("/goods-batches")
async def list_goods_batches(
    product_id: Optional[str] = Query(None),
    plant_id: Optional[str] = Query(None),
    quality_status: Optional[str] = Query(None),
    expiring_within_days: Optional[int] = Query(None, ge=0),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = GoodsBatchRepository(db)
    skip = (page - 1) * size
    batches, total = await repo.list_by_vendor(
        vendor_id,
        product_id=UUID(product_id) if product_id else None,
        plant_id=UUID(plant_id) if plant_id else None,
        quality_status=quality_status,
        expiring_within_days=expiring_within_days,
        skip=skip,
        limit=size,
    )
    return JSONResponse(content={
        "items": await _enrich_batches(db, batches),
        "total": total,
        "page": page,
        "size": size,
    })


@router.get("/goods-batches/{batch_id}")
async def get_goods_batch(
    batch_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = GoodsBatchRepository(db)
    batch = await repo.get_by_vendor_and_id(vendor_id, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Goods batch not found")
    items = await _enrich_batches(db, [batch])
    return JSONResponse(content=items[0])


@router.post("/goods-batches", status_code=status.HTTP_201_CREATED)
async def create_goods_batch(
    data: GoodsBatchCreate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    batch = GoodsBatch(
        vendor_id=vendor_id,
        product_id=UUID(data.product_id),
        variant_id=UUID(data.variant_id) if data.variant_id else None,
        batch_number=data.batch_number,
        serial_numbers=data.serial_numbers or [],
        manufacturing_date=data.manufacturing_date,
        expiry_date=data.expiry_date,
        best_before_date=data.best_before_date,
        plant_id=UUID(data.plant_id) if data.plant_id else None,
        storage_location_id=UUID(data.storage_location_id) if data.storage_location_id else None,
        quantity_received=data.quantity_received,
        quantity_available=data.quantity_received,
        source_type=data.source_type,
        source_id=UUID(data.source_id) if data.source_id else None,
        quality_status=data.quality_status or "unrestricted",
        supplier_batch_number=data.supplier_batch_number,
        notes=data.notes,
    )
    db.add(batch)
    await db.commit()
    await db.refresh(batch)
    items = await _enrich_batches(db, [batch])
    return JSONResponse(content=items[0], status_code=201)


@router.put("/goods-batches/{batch_id}")
async def update_goods_batch(
    batch_id: UUID,
    data: GoodsBatchUpdate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = GoodsBatchRepository(db)
    batch = await repo.get_by_vendor_and_id(vendor_id, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Goods batch not found")

    for field in ["quality_status", "storage_location_id", "plant_id", "expiry_date", "best_before_date", "notes", "is_active"]:
        val = getattr(data, field, None)
        if val is not None:
            if field in ("storage_location_id", "plant_id") and isinstance(val, str):
                setattr(batch, field, UUID(val))
            else:
                setattr(batch, field, val)

    await db.commit()
    await db.refresh(batch)
    items = await _enrich_batches(db, [batch])
    return JSONResponse(content=items[0])


# ── Goods Movement Documents ──────────────────────────────────────

@router.get("/goods-movements")
async def list_goods_movements(
    movement_type: Optional[str] = Query(None),
    plant_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = GoodsMovementDocumentRepository(db)
    skip = (page - 1) * size
    docs, total = await repo.list_by_vendor(
        vendor_id,
        movement_type=movement_type,
        plant_id=UUID(plant_id) if plant_id else None,
        skip=skip,
        limit=size,
    )
    return JSONResponse(content={
        "items": await _enrich_gmds(db, docs),
        "total": total,
        "page": page,
        "size": size,
    })


@router.get("/goods-movements/{doc_id}")
async def get_goods_movement(
    doc_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = GoodsMovementDocumentRepository(db)
    doc = await repo.get_by_vendor_and_id(vendor_id, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Goods movement document not found")
    enriched = await _enrich_gmds(db, [doc])
    return JSONResponse(content=enriched[0])


async def _enrich_lines(db: AsyncSession, lines: list[dict]) -> list[dict]:
    """Attach product_name and variant_name into each line dict before persisting."""
    if not lines:
        return lines
    product_ids = {UUID(l["product_id"]) for l in lines if l.get("product_id")}
    variant_ids = {UUID(l["variant_id"]) for l in lines if l.get("variant_id")}

    products_map: dict[str, str] = {}
    if product_ids:
        rows = (await db.execute(select(Product).where(Product.id.in_(product_ids)))).scalars().all()
        products_map = {str(r.id): r.name for r in rows}

    variants_map: dict[str, str] = {}
    if variant_ids:
        rows = (await db.execute(select(ProductVariant).where(ProductVariant.id.in_(variant_ids)))).scalars().all()
        variants_map = {str(r.id): r.name for r in rows}

    enriched = []
    for l in lines:
        entry = dict(l)
        if entry.get("product_id"):
            entry["product_name"] = products_map.get(entry["product_id"])
        if entry.get("variant_id"):
            entry["variant_name"] = variants_map.get(entry["variant_id"])
        enriched.append(entry)
    return enriched


@router.post("/goods-movements", status_code=status.HTTP_201_CREATED)
async def create_goods_movement(
    data: GoodsMovementCreate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vendor_user: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    repo = GoodsMovementDocumentRepository(db)
    doc_number = await repo.get_next_document_number(vendor_id)

    enriched_lines = await _enrich_lines(db, data.lines or [])

    doc = GoodsMovementDocument(
        vendor_id=vendor_id,
        document_number=doc_number,
        movement_type=data.movement_type.value,
        po_receipt_id=UUID(data.po_receipt_id) if data.po_receipt_id else None,
        production_order_id=UUID(data.production_order_id) if data.production_order_id else None,
        plant_id=UUID(data.plant_id) if data.plant_id else None,
        from_storage_location_id=UUID(data.from_storage_location_id) if data.from_storage_location_id else None,
        to_storage_location_id=UUID(data.to_storage_location_id) if data.to_storage_location_id else None,
        lines=enriched_lines,
        posting_date=data.posting_date,
        notes=data.notes,
        performed_by=vendor_user.id,
    )
    db.add(doc)
    await db.flush()  # get doc.id before applying stock changes

    try:
        await _apply_movement_to_stock(db, vendor_id, doc)
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=422, detail=f"Stock update failed: {exc}") from exc

    await db.commit()
    await db.refresh(doc)
    enriched = await _enrich_gmds(db, [doc])
    return JSONResponse(content=enriched[0], status_code=201)
