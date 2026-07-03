"""
Public restaurant endpoints — no vendor-user JWT required.
Used by the storefront QR table-order and reservation pages.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date as date_type

from app.database import get_db
from app.repositories.vendor_repo import VendorRepository
from app.models.restaurant import Restaurant, RestaurantZone
from app.models.vendor_product import Product, ProductModifierGroup, ProductModifierOption
from app.services.restaurant_service import RestaurantService
from app.services.restaurant_menu_service import RestaurantMenuService, CATALOG_ITEM_LIMIT
from app.utils.restaurant_menu import load_dine_in_products_with_meta, parse_category_order, sort_menu_sections
from app.schemas.restaurant import RestaurantReservationCreate

router = APIRouter()


async def _resolve_vendor(vendor_slug: str, db: AsyncSession):
    repo = VendorRepository(db)
    vendor = await repo.find_by_slug(vendor_slug)
    if not vendor:
        raise HTTPException(404, f"Vendor '{vendor_slug}' not found")
    return vendor


def _primary_image_url(p: Product) -> Optional[str]:
    """Return the primary image URL from the eager-loaded images relation."""
    images = p.images  # type: ignore[attr-defined]
    if not images:
        return None
    # Prefer explicitly flagged primary; fall back to lowest position
    primary = next((img for img in images if img.is_primary and img.media_type == "image"), None)
    if primary:
        return primary.url
    image_only = [img for img in images if img.media_type == "image"]
    if image_only:
        return min(image_only, key=lambda img: img.position or 0).url
    return None


def _product_dict(p: Product, modifier_groups: Optional[list] = None) -> dict:
    raw_tags = p.tags if isinstance(p.tags, list) else []
    return {
        "id": str(p.id),
        "name": p.name,
        "description": p.short_description or p.description,
        "price": float(p.price or 0),
        "category": p.category,
        "tax_rate": float(p.tax_rate or p.gst_rate or 0),
        "image_url": _primary_image_url(p),
        "stock_status": p.stock_status or "in_stock",
        "is_available": p.status == "active" and (p.stock_status != "out_of_stock" or bool(p.allow_backorders)),
        "tags": [str(t) for t in raw_tags],
        "modifier_groups": modifier_groups or [],
    }


async def _load_modifier_groups_by_product(db: AsyncSession, vendor_id, product_ids: list) -> dict:
    if not product_ids:
        return {}
    groups_r = await db.execute(
        select(ProductModifierGroup)
        .where(and_(
            ProductModifierGroup.vendor_id == vendor_id,
            ProductModifierGroup.product_id.in_(product_ids),
            ProductModifierGroup.is_active == True,
        ))
        .order_by(ProductModifierGroup.sort_order)
    )
    groups = list(groups_r.scalars().all())
    if not groups:
        return {}
    group_ids = [g.id for g in groups]
    opts_r = await db.execute(
        select(ProductModifierOption)
        .where(and_(
            ProductModifierOption.group_id.in_(group_ids),
            ProductModifierOption.is_active == True,
        ))
        .order_by(ProductModifierOption.sort_order)
    )
    opts_by_group: dict = {}
    for o in opts_r.scalars().all():
        opts_by_group.setdefault(o.group_id, []).append(o)

    by_product: dict = {}
    for g in groups:
        opts = opts_by_group.get(g.id, [])
        if not opts:
            continue
        by_product.setdefault(str(g.product_id), []).append({
            "id": str(g.id),
            "name": g.name,
            "selection_type": g.selection_type,
            "is_required": g.is_required,
            "min_select": g.min_select or (1 if g.is_required else 0),
            "options": [
                {
                    "id": str(o.id),
                    "name": o.name,
                    "price_delta": float(o.price_delta or 0),
                    "is_default": o.is_default,
                }
                for o in opts
            ],
        })
    return by_product


async def _load_products_by_ids(db: AsyncSession, vendor_id, product_ids: list) -> dict:
    if not product_ids:
        return {}
    from uuid import UUID
    uuids = [UUID(pid) for pid in product_ids]
    r = await db.execute(
        select(Product)
        .options(selectinload(Product.images))
        .where(Product.vendor_id == vendor_id, Product.id.in_(uuids))
    )
    return {str(p.id): p for p in r.scalars().all()}


def _menu_tree_product_ids(tree: list[dict]) -> list[str]:
    ids: list[str] = []

    def walk(cat: dict) -> None:
        for item in cat.get("items", []):
            if item.get("item_type") == "product":
                ids.append(item["id"])
        for child in cat.get("children", []):
            walk(child)

    for root in tree:
        walk(root)
    return ids


def _products_from_named_items(items: list[dict], products_by_id: dict, mod_map: dict) -> list[dict]:
    out: list[dict] = []
    for item in items:
        if item.get("item_type") != "product":
            continue
        product = products_by_id.get(item["id"])
        if product:
            out.append(_product_dict(product, mod_map.get(str(product.id), [])))
    return out


def _child_to_subcategories(child: dict, products_by_id: dict, mod_map: dict) -> list[dict]:
    subs: list[dict] = []
    grandchildren = child.get("children", [])
    child_products = _products_from_named_items(child.get("items", []), products_by_id, mod_map)
    if grandchildren:
        for grandchild in grandchildren:
            gc_products = _products_from_named_items(grandchild.get("items", []), products_by_id, mod_map)
            if gc_products:
                subs.append({"name": grandchild["name"], "items": gc_products})
        if child_products:
            subs.insert(0, {"name": child["name"], "items": child_products})
    elif child_products:
        subs.append({"name": child["name"], "items": child_products})
    return subs


def _named_menu_tree_to_sections(tree: list[dict], products_by_id: dict, mod_map: dict) -> list[dict]:
    sections: list[dict] = []
    for root in tree:
        children = root.get("children", [])
        direct_items = _products_from_named_items(root.get("items", []), products_by_id, mod_map)
        subcategories: list[dict] = []
        for child in children:
            subcategories.extend(_child_to_subcategories(child, products_by_id, mod_map))
        if direct_items or subcategories:
            sections.append({
                "category": root["name"],
                "items": direct_items,
                "subcategories": subcategories,
            })
    return sections


# ── Table info + menu by QR token ────────────────────────────────

@router.get("/{vendor_slug}/table/{qr_token}")
async def get_table_by_qr(vendor_slug: str, qr_token: str, db: AsyncSession = Depends(get_db)):
    vendor = await _resolve_vendor(vendor_slug, db)
    svc = RestaurantService(db)
    menu_svc = RestaurantMenuService(db)

    preview_mode = qr_token == "preview"
    outlet_settings: dict | None = None
    zone_name: str | None = None

    if preview_mode:
        table_id = "preview"
        table_label = "Preview"
        table_capacity = 2
    else:
        table_row = await svc.get_table_by_qr_token(qr_token)
        if not table_row or table_row.vendor_id != vendor.id:
            raise HTTPException(404, "Table not found or QR code invalid")
        table_id = str(table_row.id)
        table_label = table_row.label
        table_capacity = table_row.capacity

        if table_row.zone_id:
            zone = await db.get(RestaurantZone, table_row.zone_id)
            zone_name = zone.name if zone else None

            named_menu = await menu_svc.resolve_menu_for_zone(vendor.id, table_row.zone_id)
            if named_menu:
                categories_tree = await menu_svc.build_menu_tree_payload(vendor.id, named_menu)
                product_ids = _menu_tree_product_ids(categories_tree)
                products_by_id = await _load_products_by_ids(db, vendor.id, product_ids)
                mod_map = await _load_modifier_groups_by_product(
                    db, vendor.id, [p.id for p in products_by_id.values()],
                )
                menu_sections = _named_menu_tree_to_sections(categories_tree, products_by_id, mod_map)

                return JSONResponse(content={
                    "vendor": {
                        "id": str(vendor.id),
                        "name": vendor.business_name,
                        "slug": vendor.slug,
                    },
                    "table": {
                        "id": table_id,
                        "label": table_label,
                        "capacity": table_capacity,
                        "zone_name": zone_name,
                    },
                    "menu": menu_sections,
                    "menu_truncated": len(product_ids) >= CATALOG_ITEM_LIMIT,
                })

        # Load per-outlet menu settings if this table belongs to a restaurant outlet
        if table_row.restaurant_id:
            restaurant = await db.get(Restaurant, table_row.restaurant_id)
            if restaurant and restaurant.settings and restaurant.settings.get("restaurant_menu"):
                outlet_settings = restaurant.settings

    # Prefer outlet-level settings when available, fall back to vendor-wide
    effective_settings = outlet_settings if outlet_settings is not None else (vendor.settings or {})

    catalog = await load_dine_in_products_with_meta(
        db, vendor.id, effective_settings, limit=200,
    )
    mod_map = await _load_modifier_groups_by_product(
        db, vendor.id, [p.id for p in catalog.products],
    )

    menu: dict = {}
    for p in catalog.products:
        cat = p.category or "Menu"
        sub = (p.subcategory or "").strip()
        menu.setdefault(cat, {}).setdefault(sub, []).append(
            _product_dict(p, mod_map.get(str(p.id), [])),
        )

    menu_sections = []
    for cat, subs in menu.items():
        direct_items = subs.get("", [])
        subcategories = [
            {"name": sub_name, "items": sub_items}
            for sub_name, sub_items in subs.items()
            if sub_name and sub_items
        ]
        menu_sections.append({
            "category": cat,
            "items": direct_items,
            "subcategories": subcategories,
        })

    category_order = parse_category_order(effective_settings)
    menu_sections = sort_menu_sections(menu_sections, category_order)

    return JSONResponse(content={
        "vendor": {
            "id": str(vendor.id),
            "name": vendor.business_name,
            "slug": vendor.slug,
        },
        "table": {
            "id": table_id,
            "label": table_label,
            "capacity": table_capacity,
            "zone_name": zone_name,
        },
        "menu": menu_sections,
        "menu_truncated": catalog.truncated,
    })


# ── Named menu by zone guest-link token ────────────────────────────

@router.get("/{vendor_slug}/menu/{link_token}")
async def get_menu_by_zone_link(vendor_slug: str, link_token: str, db: AsyncSession = Depends(get_db)):
    """Resolve a menu + zone from a guest-facing menu link token, with the
    full category tree and resolved products/services for guest browsing."""
    vendor = await _resolve_vendor(vendor_slug, db)
    menu_svc = RestaurantMenuService(db)

    link = await menu_svc.resolve_zone_link(link_token)
    if not link or link.vendor_id != vendor.id:
        raise HTTPException(404, "Menu link not found")

    menu = link.menu
    restaurant_svc = RestaurantService(db)
    zones = await restaurant_svc.list_zones(vendor.id, restaurant_id=menu.restaurant_id)
    zone = next((z for z in zones if z.id == link.zone_id), None)

    categories = await menu_svc.build_menu_tree_payload(vendor.id, menu)

    return JSONResponse(content={
        "vendor": {
            "id": str(vendor.id),
            "name": vendor.business_name,
            "slug": vendor.slug,
        },
        "zone": {
            "id": str(link.zone_id),
            "name": zone.name if zone else None,
        },
        "menu": {
            "id": str(menu.id),
            "name": menu.name,
            "categories": categories,
        },
    })


# ── Guest dine-in order submission via QR ─────────────────────────

class GuestOrderModifier(BaseModel):
    group_id: str
    group_name: str
    option_id: str
    option_name: str
    price_delta: float = 0


class GuestOrderItem(BaseModel):
    product_id: str
    name: str
    qty: int = Field(ge=1)
    unit_price: float
    notes: Optional[str] = None
    modifiers: Optional[List[GuestOrderModifier]] = None


def _guest_item_dict(i: GuestOrderItem) -> dict:
    mods = [
        {
            "group_id": m.group_id,
            "group_name": m.group_name,
            "option_id": m.option_id,
            "option_name": m.option_name,
            "price_delta": m.price_delta,
        }
        for m in (i.modifiers or [])
    ]
    return {
        "product_id": str(i.product_id),
        "name": i.name,
        "qty": i.qty,
        "unit_price": i.unit_price,
        "notes": i.notes,
        "item_type": "product",
        "modifiers": mods if mods else None,
    }


class GuestOrderCreate(BaseModel):
    items: List[GuestOrderItem] = Field(min_length=1)
    guest_name: Optional[str] = None
    guest_phone: Optional[str] = None
    notes: Optional[str] = None


def _guest_order_notes(data: GuestOrderCreate) -> str:
    parts: list[str] = []
    if data.notes:
        parts.append(data.notes)
    if data.guest_name:
        parts.append(f"QR order by {data.guest_name}")
    if data.guest_phone:
        parts.append(f"Phone: {data.guest_phone}")
    return "\n".join(parts) if parts else "QR order"


@router.post("/{vendor_slug}/table/{qr_token}/order", status_code=201)
async def guest_create_order(
    vendor_slug: str,
    qr_token: str,
    data: GuestOrderCreate,
    db: AsyncSession = Depends(get_db),
):
    vendor = await _resolve_vendor(vendor_slug, db)
    svc = RestaurantService(db)
    table = await svc.get_table_by_qr_token(qr_token)
    if not table or table.vendor_id != vendor.id:
        raise HTTPException(404, "Table not found or QR code invalid")

    from uuid import UUID
    # Check if there's already an open order for this table
    existing = await svc._get_open_order_for_table(vendor.id, table.id)
    if existing:
        # Add items to existing order
        new_items = [_guest_item_dict(i) for i in data.items]
        order = await svc.add_items_to_order(vendor.id, existing.id, new_items)
        await svc.send_kot(
            vendor.id,
            existing.id,
            new_items,
            notes=_guest_order_notes(data) if (data.notes or data.guest_name or data.guest_phone) else "QR add-on order",
        )
        created = False
    else:
        # Create new order
        order = await svc.create_order(
            vendor.id,
            table.id,
            covers=1,
            notes=_guest_order_notes(data),
        )
        new_items = [_guest_item_dict(i) for i in data.items]
        order = await svc.add_items_to_order(vendor.id, order.id, new_items)

        # Auto-send KOT
        await svc.send_kot(vendor.id, order.id, new_items, notes="QR order")
        created = True

    if not order:
        raise HTTPException(500, "Could not create order")

    return JSONResponse(content={
        "order_id": str(order.id),
        "table_label": table.label,
        "status": order.status,
        "items": order.items or [],
        "created": created,
    }, status_code=201)


# ── Online reservation submission ─────────────────────────────────

@router.post("/{vendor_slug}/reserve", status_code=201)
async def guest_reserve(
    vendor_slug: str,
    data: RestaurantReservationCreate,
    db: AsyncSession = Depends(get_db),
):
    vendor = await _resolve_vendor(vendor_slug, db)
    svc = RestaurantService(db)
    from uuid import UUID
    r = await svc.create_reservation(
        vendor.id,
        data.guest_name,
        data.reservation_date,
        data.reservation_time,
        data.party_size,
        table_id=UUID(data.table_id) if data.table_id else None,
        guest_phone=data.guest_phone,
        guest_email=data.guest_email,
        notes=data.notes,
        source="online",
    )
    return JSONResponse(content={
        "id": str(r.id),
        "status": r.status,
        "guest_name": r.guest_name,
        "reservation_date": r.reservation_date.isoformat(),
        "reservation_time": r.reservation_time,
        "party_size": r.party_size,
    }, status_code=201)
