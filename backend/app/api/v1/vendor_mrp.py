# app/api/v1/vendor_mrp.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, and_, func as sqlfunc
from typing import Optional, List
from uuid import UUID
from decimal import Decimal
from datetime import datetime, timezone

from app.database import get_db
from app.api.deps import get_current_active_user
from app.models.user import User
from app.models.mrp import ProductBOMItem, StockReservation
from app.models.vendor_product import Product
from app.services.vendor_service import VendorService
from app.schemas.mrp import (
    BOMItemIn, BOMItemOut,
    MRPRequest, MRPResultLine,
    ReservationCreate, ReservationOut,
)

router = APIRouter()


# ── Shared dep: current vendor id ────────────────────────────────────────────

async def get_current_vendor_id(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> UUID:
    svc = VendorService(db)
    vendor = await svc.get_by_user_id(current_user.id)
    if not vendor:
        raise HTTPException(status_code=404, detail="No vendor found for this user")
    return vendor.id


# ── BOM helpers ───────────────────────────────────────────────────────────────

def _bom_to_dict(item: ProductBOMItem, component: Product) -> dict:
    return {
        "id": str(item.id),
        "product_id": str(item.product_id),
        "component_id": str(item.component_id),
        "component_name": component.name if component else "Unknown",
        "component_sku": component.sku if component else None,
        "component_uom": component.uom if component else None,
        "qty_per_unit": float(item.qty_per_unit),
        "notes": item.notes,
        "created_at": item.created_at.isoformat() if item.created_at else None,
    }


def _resv_to_dict(r: StockReservation, product_name: Optional[str] = None) -> dict:
    return {
        "id": str(r.id),
        "vendor_id": str(r.vendor_id),
        "order_type": r.order_type,
        "order_id": r.order_id,
        "product_id": str(r.product_id),
        "product_name": product_name,
        "variant_id": str(r.variant_id) if r.variant_id else None,
        "reserved_qty": float(r.reserved_qty),
        "status": r.status,
        "notes": r.notes,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "released_at": r.released_at.isoformat() if r.released_at else None,
    }


# ── GET /products/{product_id}/bom ───────────────────────────────────────────

@router.get("/products/{product_id}/bom")
async def get_product_bom(
    product_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """List BOM items for a finished product."""
    result = await db.execute(
        select(ProductBOMItem)
        .where(
            ProductBOMItem.vendor_id == vendor_id,
            ProductBOMItem.product_id == product_id,
        )
        .order_by(ProductBOMItem.created_at)
    )
    items = result.scalars().all()

    # Fetch component details
    out = []
    for item in items:
        comp_result = await db.execute(select(Product).where(Product.id == item.component_id))
        comp = comp_result.scalar_one_or_none()
        out.append(_bom_to_dict(item, comp))

    return out


# ── PUT /products/{product_id}/bom ───────────────────────────────────────────

@router.put("/products/{product_id}/bom", status_code=200)
async def replace_product_bom(
    product_id: UUID,
    items: List[BOMItemIn],
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Replace all BOM items for a product (full replace / upsert)."""
    # Verify product belongs to vendor
    prod_result = await db.execute(
        select(Product).where(Product.id == product_id, Product.vendor_id == vendor_id)
    )
    if not prod_result.scalar_one_or_none():
        raise HTTPException(404, "Product not found")

    # Delete existing BOM
    await db.execute(
        delete(ProductBOMItem).where(
            ProductBOMItem.vendor_id == vendor_id,
            ProductBOMItem.product_id == product_id,
        )
    )

    # Insert new rows
    new_items = []
    for item in items:
        # Verify component belongs to vendor
        comp_result = await db.execute(
            select(Product).where(Product.id == item.component_id, Product.vendor_id == vendor_id)
        )
        comp = comp_result.scalar_one_or_none()
        if not comp:
            raise HTTPException(404, f"Component product {item.component_id} not found")

        bom_item = ProductBOMItem(
            vendor_id=vendor_id,
            product_id=product_id,
            component_id=item.component_id,
            qty_per_unit=item.qty_per_unit,
            notes=item.notes,
        )
        db.add(bom_item)
        new_items.append((bom_item, comp))

    await db.commit()

    out = []
    for bom_item, comp in new_items:
        await db.refresh(bom_item)
        out.append(_bom_to_dict(bom_item, comp))

    return out


# ── POST /mrp/calculate ───────────────────────────────────────────────────────

@router.post("/mrp/calculate")
async def calculate_mrp(
    body: MRPRequest,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Given a list of finished-product line items, explode BOMs, query stock,
    and return material availability per component.
    """
    # Aggregate required qty per component across all order items
    component_requirements: dict[str, dict] = {}  # component_id_str -> {...}

    for req_item in body.items:
        try:
            pid = UUID(req_item.product_id)
        except ValueError:
            continue

        bom_result = await db.execute(
            select(ProductBOMItem).where(
                ProductBOMItem.vendor_id == vendor_id,
                ProductBOMItem.product_id == pid,
            )
        )
        bom_items = bom_result.scalars().all()

        if not bom_items:
            # No BOM — report the product itself as the material (direct stock check)
            cid = req_item.product_id
            if cid not in component_requirements:
                component_requirements[cid] = {
                    "component_id": cid,
                    "product_obj": None,
                    "required_qty": Decimal("0"),
                    "source_items": [],
                    "no_bom": True,
                }
            component_requirements[cid]["required_qty"] += Decimal(str(req_item.qty))
            component_requirements[cid]["source_items"].append(req_item.name or req_item.product_id)
        else:
            for bom_item in bom_items:
                cid = str(bom_item.component_id)
                needed = Decimal(str(req_item.qty)) * bom_item.qty_per_unit
                if cid not in component_requirements:
                    comp_result = await db.execute(select(Product).where(Product.id == bom_item.component_id))
                    comp = comp_result.scalar_one_or_none()
                    component_requirements[cid] = {
                        "component_id": cid,
                        "product_obj": comp,
                        "required_qty": Decimal("0"),
                        "source_items": [],
                        "no_bom": False,
                    }
                component_requirements[cid]["required_qty"] += needed
                component_requirements[cid]["source_items"].append(req_item.name or req_item.product_id)

    # For items with no_bom, fetch product
    for cid, entry in component_requirements.items():
        if entry["product_obj"] is None:
            try:
                pid = UUID(cid)
                prod_result = await db.execute(select(Product).where(Product.id == pid))
                entry["product_obj"] = prod_result.scalar_one_or_none()
            except ValueError:
                pass

    # Get active reservations for ALL components (to compute reserved_by_others)
    result_lines = []
    for cid, entry in component_requirements.items():
        comp = entry["product_obj"]
        in_stock = Decimal(str(comp.quantity)) if comp and comp.quantity is not None else Decimal("0")

        # Total active reservations for this component
        resv_result = await db.execute(
            select(sqlfunc.coalesce(sqlfunc.sum(StockReservation.reserved_qty), 0)).where(
                StockReservation.vendor_id == vendor_id,
                StockReservation.product_id == UUID(cid),
                StockReservation.status == "active",
            )
        )
        total_reserved = Decimal(str(resv_result.scalar() or 0))

        # Reservation already held by THIS order
        order_resv_result = await db.execute(
            select(sqlfunc.coalesce(sqlfunc.sum(StockReservation.reserved_qty), 0)).where(
                StockReservation.vendor_id == vendor_id,
                StockReservation.product_id == UUID(cid),
                StockReservation.status == "active",
                StockReservation.order_type == body.order_type,
                StockReservation.order_id == body.order_id,
            )
        )
        order_reserved = Decimal(str(order_resv_result.scalar() or 0))

        reserved_by_others = total_reserved - order_reserved
        available = in_stock - reserved_by_others
        required = entry["required_qty"]
        shortage = max(Decimal("0"), required - available)

        if entry["no_bom"]:
            status = "no_bom"
        elif available >= required:
            status = "ok"
        elif available > 0:
            status = "partial"
        else:
            status = "short"

        result_lines.append({
            "component_id": cid,
            "component_name": comp.name if comp else "Unknown",
            "component_sku": comp.sku if comp else None,
            "component_uom": comp.uom if comp else None,
            "required_qty": float(required),
            "in_stock": float(in_stock),
            "reserved_by_others": float(reserved_by_others),
            "already_reserved_for_order": float(order_reserved),
            "available": float(available),
            "shortage": float(shortage),
            "status": status,
            "source_items": list(set(entry["source_items"])),
        })

    return result_lines


# ── GET /stock-reservations ───────────────────────────────────────────────────

@router.get("/stock-reservations")
async def list_reservations(
    order_type: Optional[str] = None,
    order_id: Optional[str] = None,
    status: Optional[str] = None,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """List stock reservations, optionally filtered by order."""
    q = select(StockReservation).where(StockReservation.vendor_id == vendor_id)
    if order_type:
        q = q.where(StockReservation.order_type == order_type)
    if order_id:
        q = q.where(StockReservation.order_id == order_id)
    if status:
        q = q.where(StockReservation.status == status)
    q = q.order_by(StockReservation.created_at.desc())

    result = await db.execute(q)
    reservations = result.scalars().all()

    out = []
    for r in reservations:
        prod_result = await db.execute(select(Product).where(Product.id == r.product_id))
        prod = prod_result.scalar_one_or_none()
        out.append(_resv_to_dict(r, prod.name if prod else None))

    return out


# ── POST /stock-reservations ──────────────────────────────────────────────────

@router.post("/stock-reservations", status_code=201)
async def create_reservations(
    body: ReservationCreate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Create stock reservations for an order."""
    if not body.items:
        raise HTTPException(400, "No items to reserve")

    created = []
    for item in body.items:
        resv = StockReservation(
            vendor_id=vendor_id,
            order_type=body.order_type,
            order_id=body.order_id,
            product_id=item.product_id,
            variant_id=item.variant_id,
            reserved_qty=item.reserved_qty,
            notes=item.notes,
            status="active",
        )
        db.add(resv)
        created.append((resv, item.product_id))

    await db.commit()

    out = []
    for resv, product_id in created:
        await db.refresh(resv)
        prod_result = await db.execute(select(Product).where(Product.id == product_id))
        prod = prod_result.scalar_one_or_none()
        out.append(_resv_to_dict(resv, prod.name if prod else None))

    return out


# ── DELETE /stock-reservations/{id} ──────────────────────────────────────────

@router.delete("/stock-reservations/{reservation_id}", status_code=200)
async def release_reservation(
    reservation_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Release a single stock reservation."""
    result = await db.execute(
        select(StockReservation).where(
            StockReservation.id == reservation_id,
            StockReservation.vendor_id == vendor_id,
        )
    )
    resv = result.scalar_one_or_none()
    if not resv:
        raise HTTPException(404, "Reservation not found")

    resv.status = "released"
    resv.released_at = datetime.now(timezone.utc)
    await db.commit()
    return {"message": "Reservation released", "id": str(reservation_id)}


# ── DELETE /stock-reservations (bulk by order) ───────────────────────────────

@router.delete("/stock-reservations", status_code=200)
async def release_all_reservations(
    order_type: str = Query(...),
    order_id: str = Query(...),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Release all active reservations for a given order."""
    result = await db.execute(
        select(StockReservation).where(
            StockReservation.vendor_id == vendor_id,
            StockReservation.order_type == order_type,
            StockReservation.order_id == order_id,
            StockReservation.status == "active",
        )
    )
    reservations = result.scalars().all()
    now = datetime.now(timezone.utc)
    count = 0
    for r in reservations:
        r.status = "released"
        r.released_at = now
        count += 1

    await db.commit()
    return {"message": f"{count} reservation(s) released", "count": count}
