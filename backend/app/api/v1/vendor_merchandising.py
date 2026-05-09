# app/api/v1/vendor_merchandising.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func as sa_func
from typing import Optional
from uuid import UUID
from slugify import slugify
import uuid as uuid_mod

from app.database import get_db
from app.api.deps import get_current_active_user
from app.models.user import User
from app.models.vendor_product import Product
from app.models.merchandising import Bundle, BundleItem, UpsellMapping
from app.schemas.merchandising import (
    BundleCreate, BundleUpdate, BundleResponse, BundleListResponse,
    UpsellMappingCreate, UpsellMappingUpdate,
    UpsellMappingResponse, UpsellMappingListResponse,
    ProductMerchandisingSync, ProductMerchandisingResponse,
)
from app.services.vendor_service import VendorService

router = APIRouter()


async def _get_vendor_id(user: User = Depends(get_current_active_user), db: AsyncSession = Depends(get_db)) -> UUID:
    svc = VendorService(db)
    vendor = await svc.get_by_user_id(user.id)
    if not vendor:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No vendor found for this user")
    return vendor.id


def _dt(v):
    return v.isoformat() if v else None


# ── helpers ───────────────────────────────────────────────────────

def _bundle_to_dict(b: Bundle, product_map: dict | None = None) -> dict:
    pm = product_map or {}
    return {
        "id": str(b.id),
        "vendor_id": str(b.vendor_id),
        "name": b.name,
        "slug": b.slug,
        "description": b.description,
        "discount_type": b.discount_type or "none",
        "discount_value": float(b.discount_value or 0),
        "is_active": b.is_active if b.is_active is not None else True,
        "items": [
            {
                "id": str(bi.id),
                "bundle_id": str(bi.bundle_id),
                "product_id": str(bi.product_id),
                "product_name": pm.get(str(bi.product_id), {}).get("name"),
                "product_sku": pm.get(str(bi.product_id), {}).get("sku"),
                "quantity": bi.quantity,
                "sort_order": bi.sort_order,
            }
            for bi in (b.items or [])
        ],
        "created_at": _dt(b.created_at),
        "updated_at": _dt(b.updated_at),
    }


def _mapping_to_dict(m: UpsellMapping, product_map: dict | None = None, bundle_map: dict | None = None) -> dict:
    pm = product_map or {}
    bm = bundle_map or {}
    tgt_id = str(m.target_product_id) if m.target_product_id else None
    return {
        "id": str(m.id),
        "vendor_id": str(m.vendor_id),
        "source_product_id": str(m.source_product_id),
        "target_type": m.target_type or "product",
        "target_product_id": tgt_id,
        "target_product_name": pm.get(tgt_id, {}).get("name") if tgt_id else None,
        "target_product_sku": pm.get(tgt_id, {}).get("sku") if tgt_id else None,
        "target_category": m.target_category,
        "relation_type": m.relation_type,
        "bundle_id": str(m.bundle_id) if m.bundle_id else None,
        "bundle_name": bm.get(str(m.bundle_id)) if m.bundle_id else None,
        "trigger_stage": m.trigger_stage or "PDP",
        "priority": m.priority or 0,
        "is_active": m.is_active if m.is_active is not None else True,
        "created_at": _dt(m.created_at),
        "updated_at": _dt(m.updated_at),
    }


async def _product_lookup(db: AsyncSession, vendor_id: UUID) -> dict:
    """Return {product_id_str: {"name": ..., "sku": ...}}"""
    res = await db.execute(
        select(Product.id, Product.name, Product.sku).where(Product.vendor_id == vendor_id)
    )
    return {str(r.id): {"name": r.name, "sku": r.sku} for r in res.all()}


async def _bundle_lookup(db: AsyncSession, vendor_id: UUID) -> dict:
    """Return {bundle_id_str: name}"""
    res = await db.execute(
        select(Bundle.id, Bundle.name).where(Bundle.vendor_id == vendor_id)
    )
    return {str(r.id): r.name for r in res.all()}


# ══════════════════════════════════════════════════════════════════
#  BUNDLES
# ══════════════════════════════════════════════════════════════════

@router.get("/bundles")
async def list_bundles(
    vendor_id: UUID = Depends(_get_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy.orm import selectinload
    q = (
        select(Bundle)
        .options(selectinload(Bundle.items))
        .where(Bundle.vendor_id == vendor_id)
        .order_by(Bundle.name)
    )
    rows = (await db.execute(q)).scalars().all()
    pm = await _product_lookup(db, vendor_id) if rows else {}
    return JSONResponse(content={
        "items": [_bundle_to_dict(b, pm) for b in rows],
        "total": len(rows),
    })


@router.post("/bundles", status_code=201)
async def create_bundle(
    body: BundleCreate,
    vendor_id: UUID = Depends(_get_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy.orm import selectinload
    slug = slugify(body.name)
    bundle = Bundle(
        id=uuid_mod.uuid4(),
        vendor_id=vendor_id,
        name=body.name,
        slug=slug,
        description=body.description,
        discount_type=body.discount_type.value if body.discount_type else "none",
        discount_value=body.discount_value,
        is_active=body.is_active,
    )
    db.add(bundle)
    for item in body.items:
        db.add(BundleItem(
            id=uuid_mod.uuid4(),
            bundle_id=bundle.id,
            product_id=UUID(item.product_id),
            quantity=item.quantity,
            sort_order=item.sort_order,
        ))
    await db.commit()
    await db.refresh(bundle, ["items"])
    pm = await _product_lookup(db, vendor_id)
    return JSONResponse(content=_bundle_to_dict(bundle, pm), status_code=201)


@router.get("/bundles/{bundle_id}")
async def get_bundle(
    bundle_id: UUID,
    vendor_id: UUID = Depends(_get_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy.orm import selectinload
    q = (
        select(Bundle)
        .options(selectinload(Bundle.items))
        .where(Bundle.id == bundle_id, Bundle.vendor_id == vendor_id)
    )
    b = (await db.execute(q)).scalars().first()
    if not b:
        raise HTTPException(404, "Bundle not found")
    pm = await _product_lookup(db, vendor_id)
    return JSONResponse(content=_bundle_to_dict(b, pm))


@router.put("/bundles/{bundle_id}")
async def update_bundle(
    bundle_id: UUID,
    body: BundleUpdate,
    vendor_id: UUID = Depends(_get_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy.orm import selectinload
    q = (
        select(Bundle)
        .options(selectinload(Bundle.items))
        .where(Bundle.id == bundle_id, Bundle.vendor_id == vendor_id)
    )
    b = (await db.execute(q)).scalars().first()
    if not b:
        raise HTTPException(404, "Bundle not found")

    updates = body.model_dump(exclude_unset=True)
    items_payload = updates.pop("items", None)
    for k, v in updates.items():
        if k == "discount_type" and v is not None:
            v = v.value if hasattr(v, "value") else v
        setattr(b, k, v)
    if body.name:
        b.slug = slugify(body.name)

    if items_payload is not None:
        await db.execute(delete(BundleItem).where(BundleItem.bundle_id == b.id))
        for item in items_payload:
            db.add(BundleItem(
                id=uuid_mod.uuid4(),
                bundle_id=b.id,
                product_id=UUID(item["product_id"]),
                quantity=item.get("quantity", 1),
                sort_order=item.get("sort_order", 0),
            ))

    await db.commit()
    await db.refresh(b, ["items"])
    pm = await _product_lookup(db, vendor_id)
    return JSONResponse(content=_bundle_to_dict(b, pm))


@router.delete("/bundles/{bundle_id}", status_code=204)
async def delete_bundle(
    bundle_id: UUID,
    vendor_id: UUID = Depends(_get_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    q = select(Bundle).where(Bundle.id == bundle_id, Bundle.vendor_id == vendor_id)
    b = (await db.execute(q)).scalars().first()
    if not b:
        raise HTTPException(404, "Bundle not found")
    await db.delete(b)
    await db.commit()


# ══════════════════════════════════════════════════════════════════
#  UPSELL MAPPINGS (per product)
# ══════════════════════════════════════════════════════════════════

@router.get("/products/{product_id}/merchandising")
async def get_product_merchandising(
    product_id: UUID,
    vendor_id: UUID = Depends(_get_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Get all upsell/cross-sell mappings for a product, split by type."""
    q = (
        select(UpsellMapping)
        .where(
            UpsellMapping.vendor_id == vendor_id,
            UpsellMapping.source_product_id == product_id,
        )
        .order_by(UpsellMapping.relation_type, UpsellMapping.priority)
    )
    rows = (await db.execute(q)).scalars().all()
    pm = await _product_lookup(db, vendor_id)
    bm = await _bundle_lookup(db, vendor_id) if any(r.bundle_id for r in rows) else {}

    cross = [_mapping_to_dict(r, pm, bm) for r in rows if r.relation_type == "cross_sell"]
    upsell = [_mapping_to_dict(r, pm, bm) for r in rows if r.relation_type == "upsell"]
    return JSONResponse(content={"cross_sell": cross, "upsell": upsell})


@router.put("/products/{product_id}/merchandising")
async def sync_product_merchandising(
    product_id: UUID,
    body: ProductMerchandisingSync,
    vendor_id: UUID = Depends(_get_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Full-replace strategy: delete all existing mappings for this source product,
    then insert the provided list. This keeps the product form simple (just POST
    the current state).
    """
    prod = (await db.execute(
        select(Product).where(Product.id == product_id, Product.vendor_id == vendor_id)
    )).scalars().first()
    if not prod:
        raise HTTPException(404, "Product not found")

    await db.execute(
        delete(UpsellMapping).where(
            UpsellMapping.source_product_id == product_id,
            UpsellMapping.vendor_id == vendor_id,
        )
    )

    for entry in body.mappings:
        ttype = entry.target_type.value if entry.target_type else "product"
        if ttype == "product":
            if not entry.target_product_id:
                continue
            if str(product_id) == entry.target_product_id:
                continue
        else:
            if not entry.target_category:
                continue

        db.add(UpsellMapping(
            id=uuid_mod.uuid4(),
            vendor_id=vendor_id,
            source_product_id=product_id,
            target_type=ttype,
            target_product_id=UUID(entry.target_product_id) if ttype == "product" and entry.target_product_id else None,
            target_category=entry.target_category if ttype == "category" else None,
            relation_type=entry.relation_type.value,
            bundle_id=UUID(entry.bundle_id) if entry.bundle_id else None,
            trigger_stage=entry.trigger_stage.value,
            priority=entry.priority,
            is_active=True,
        ))

    await db.commit()

    q = (
        select(UpsellMapping)
        .where(UpsellMapping.vendor_id == vendor_id, UpsellMapping.source_product_id == product_id)
        .order_by(UpsellMapping.relation_type, UpsellMapping.priority)
    )
    rows = (await db.execute(q)).scalars().all()
    pm = await _product_lookup(db, vendor_id)
    bm = await _bundle_lookup(db, vendor_id)

    cross = [_mapping_to_dict(r, pm, bm) for r in rows if r.relation_type == "cross_sell"]
    upsell = [_mapping_to_dict(r, pm, bm) for r in rows if r.relation_type == "upsell"]
    return JSONResponse(content={"cross_sell": cross, "upsell": upsell})


@router.post("/mappings", status_code=201)
async def create_mapping(
    body: UpsellMappingCreate,
    vendor_id: UUID = Depends(_get_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    ttype = body.target_type.value if body.target_type else "product"
    m = UpsellMapping(
        id=uuid_mod.uuid4(),
        vendor_id=vendor_id,
        source_product_id=UUID(body.source_product_id),
        target_type=ttype,
        target_product_id=UUID(body.target_product_id) if ttype == "product" and body.target_product_id else None,
        target_category=body.target_category if ttype == "category" else None,
        relation_type=body.relation_type.value,
        bundle_id=UUID(body.bundle_id) if body.bundle_id else None,
        trigger_stage=body.trigger_stage.value,
        priority=body.priority,
        is_active=body.is_active,
    )
    db.add(m)
    await db.commit()
    await db.refresh(m)
    pm = await _product_lookup(db, vendor_id)
    return JSONResponse(content=_mapping_to_dict(m, pm), status_code=201)


@router.delete("/mappings/{mapping_id}", status_code=204)
async def delete_mapping(
    mapping_id: UUID,
    vendor_id: UUID = Depends(_get_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    m = (await db.execute(
        select(UpsellMapping).where(UpsellMapping.id == mapping_id, UpsellMapping.vendor_id == vendor_id)
    )).scalars().first()
    if not m:
        raise HTTPException(404, "Mapping not found")
    await db.delete(m)
    await db.commit()
