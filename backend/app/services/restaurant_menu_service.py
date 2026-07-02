"""Multi-menu management for restaurant outlets.

A restaurant outlet can have several named menus (e.g. "Lunch menu",
"Dinner menu"). Each menu has a tree of categories / sub-categories, and each
category resolves its own set of products/services via one of three modes:

- all_active:    every active product/service on the vendor's catalog
- curated:       an explicit list of product_ids / service_ids
- by_categories: everything under the selected vendor catalog categories
                 (Sales -> Categories), matched by category/subcategory name
                 the same way `vendor_categories.get_category_catalogues` does

Menus can be linked to one or more zones; each link carries a unique guest
-facing token used to build QR / guest ordering URLs.
"""
from __future__ import annotations

import secrets
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.restaurant import (
    Restaurant,
    RestaurantZone,
    RestaurantMenu,
    RestaurantMenuCategory,
    RestaurantMenuZoneLink,
)
from app.models.vendor_category import VendorCategory
from app.models.vendor_product import Product
from app.models.vendor_service import Service

MENU_CATEGORY_MODES = ("all_active", "curated", "by_categories")
CATALOG_ITEM_LIMIT = 300


def _menu_query():
    # populate_existing forces relationships to be re-fetched even when the
    # RestaurantMenu instance is already in the session identity map (e.g.
    # right after a mutation in the same request/session).
    return select(RestaurantMenu).options(
        selectinload(RestaurantMenu.categories),
        selectinload(RestaurantMenu.zone_links),
    ).execution_options(populate_existing=True)


class RestaurantMenuService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Menus ───────────────────────────────────────────────────────

    async def list_menus(self, vendor_id: UUID, restaurant_id: Optional[UUID] = None) -> list[RestaurantMenu]:
        q = _menu_query().where(RestaurantMenu.vendor_id == vendor_id)
        if restaurant_id:
            q = q.where(RestaurantMenu.restaurant_id == restaurant_id)
        q = q.order_by(RestaurantMenu.sort_order, RestaurantMenu.name)
        r = await self.db.execute(q)
        return list(r.scalars().unique().all())

    async def get_menu(self, vendor_id: UUID, menu_id: UUID) -> Optional[RestaurantMenu]:
        q = _menu_query().where(
            RestaurantMenu.vendor_id == vendor_id, RestaurantMenu.id == menu_id,
        )
        r = await self.db.execute(q)
        return r.scalars().unique().one_or_none()

    async def create_menu(
        self, vendor_id: UUID, restaurant_id: UUID, name: str, zone_ids: list[str] | None = None,
    ) -> RestaurantMenu:
        restaurant = await self.db.get(Restaurant, restaurant_id)
        if not restaurant or restaurant.vendor_id != vendor_id:
            raise ValueError("Restaurant not found")

        count_q = await self.db.execute(
            select(RestaurantMenu).where(RestaurantMenu.restaurant_id == restaurant_id)
        )
        sort_order = len(list(count_q.scalars().all()))

        menu = RestaurantMenu(
            vendor_id=vendor_id, restaurant_id=restaurant_id, name=name.strip(),
            sort_order=sort_order,
        )
        self.db.add(menu)
        await self.db.flush()

        for zone_id in (zone_ids or []):
            await self._add_zone_link(vendor_id, menu.id, UUID(zone_id))

        await self.db.commit()
        return await self.get_menu(vendor_id, menu.id)

    async def update_menu(self, vendor_id: UUID, menu_id: UUID, **fields) -> RestaurantMenu:
        menu = await self.get_menu(vendor_id, menu_id)
        if not menu:
            raise ValueError("Menu not found")
        for key, value in fields.items():
            if value is not None:
                setattr(menu, key, value.strip() if isinstance(value, str) else value)
        await self.db.commit()
        return await self.get_menu(vendor_id, menu_id)

    async def delete_menu(self, vendor_id: UUID, menu_id: UUID) -> None:
        menu = await self.get_menu(vendor_id, menu_id)
        if not menu:
            raise ValueError("Menu not found")
        await self.db.delete(menu)
        await self.db.commit()

    # ── Categories (tree) ─────────────────────────────────────────

    async def create_category(
        self, vendor_id: UUID, menu_id: UUID, name: str, parent_id: Optional[UUID] = None,
    ) -> RestaurantMenuCategory:
        menu = await self.get_menu(vendor_id, menu_id)
        if not menu:
            raise ValueError("Menu not found")
        if parent_id and not any(c.id == parent_id for c in menu.categories):
            raise ValueError("Parent category not found")

        siblings = [c for c in menu.categories if c.parent_id == parent_id]
        if any(c.name.strip().lower() == name.strip().lower() for c in siblings):
            raise ValueError("Category already exists at this level")

        category = RestaurantMenuCategory(
            vendor_id=vendor_id, menu_id=menu_id, parent_id=parent_id,
            name=name.strip(), sort_order=len(siblings), mode="all_active",
        )
        self.db.add(category)
        await self.db.commit()
        return category

    async def _get_category(self, vendor_id: UUID, menu_id: UUID, category_id: UUID) -> RestaurantMenuCategory:
        r = await self.db.execute(
            select(RestaurantMenuCategory).where(
                RestaurantMenuCategory.id == category_id,
                RestaurantMenuCategory.menu_id == menu_id,
                RestaurantMenuCategory.vendor_id == vendor_id,
            )
        )
        category = r.scalar_one_or_none()
        if not category:
            raise ValueError("Category not found")
        return category

    async def update_category(
        self, vendor_id: UUID, menu_id: UUID, category_id: UUID, **fields,
    ) -> RestaurantMenuCategory:
        category = await self._get_category(vendor_id, menu_id, category_id)
        for key, value in fields.items():
            if value is None:
                continue
            if key == "mode" and value not in MENU_CATEGORY_MODES:
                raise ValueError("Invalid mode")
            setattr(category, key, value.strip() if isinstance(value, str) and key == "name" else value)
        await self.db.commit()
        await self.db.refresh(category)
        return category

    async def delete_category(self, vendor_id: UUID, menu_id: UUID, category_id: UUID) -> None:
        category = await self._get_category(vendor_id, menu_id, category_id)
        await self.db.delete(category)
        await self.db.commit()

    async def move_category(
        self, vendor_id: UUID, menu_id: UUID, category_id: UUID, direction: str,
    ) -> None:
        category = await self._get_category(vendor_id, menu_id, category_id)
        r = await self.db.execute(
            select(RestaurantMenuCategory).where(
                RestaurantMenuCategory.menu_id == menu_id,
                RestaurantMenuCategory.parent_id == category.parent_id,
            ).order_by(RestaurantMenuCategory.sort_order)
        )
        siblings = list(r.scalars().all())
        idx = next((i for i, c in enumerate(siblings) if c.id == category.id), None)
        if idx is None:
            return
        swap_idx = idx - 1 if direction == "up" else idx + 1
        if swap_idx < 0 or swap_idx >= len(siblings):
            return
        siblings[idx].sort_order, siblings[swap_idx].sort_order = (
            siblings[swap_idx].sort_order, siblings[idx].sort_order,
        )
        await self.db.commit()

    # ── Zone links ──────────────────────────────────────────────────

    async def _add_zone_link(self, vendor_id: UUID, menu_id: UUID, zone_id: UUID) -> RestaurantMenuZoneLink:
        link = RestaurantMenuZoneLink(
            vendor_id=vendor_id, menu_id=menu_id, zone_id=zone_id,
            link_token=secrets.token_urlsafe(18),
        )
        self.db.add(link)
        await self.db.flush()
        return link

    async def sync_zone_links(
        self, vendor_id: UUID, menu_id: UUID, zone_ids: list[str],
    ) -> list[RestaurantMenuZoneLink]:
        menu = await self.get_menu(vendor_id, menu_id)
        if not menu:
            raise ValueError("Menu not found")
        wanted = {UUID(z) for z in zone_ids}
        existing_by_zone = {link.zone_id: link for link in menu.zone_links}

        for zone_id, link in list(existing_by_zone.items()):
            if zone_id not in wanted:
                await self.db.delete(link)

        for zone_id in wanted:
            if zone_id not in existing_by_zone:
                await self._add_zone_link(vendor_id, menu_id, zone_id)

        await self.db.commit()
        refreshed = await self.get_menu(vendor_id, menu_id)
        return refreshed.zone_links

    async def resolve_zone_link(self, link_token: str) -> Optional[RestaurantMenuZoneLink]:
        r = await self.db.execute(
            select(RestaurantMenuZoneLink)
            .options(selectinload(RestaurantMenuZoneLink.menu).selectinload(RestaurantMenu.categories))
            .where(RestaurantMenuZoneLink.link_token == link_token)
        )
        return r.scalar_one_or_none()

    # ── Item resolution (per-category, for guest / preview rendering) ─

    async def _resolve_by_categories(
        self, vendor_id: UUID, vendor_category_ids: list[str],
    ) -> tuple[set[str], set[str]]:
        """Return (product_match_tokens, service_match_tokens) — lowercased
        names/slugs of the selected vendor categories and their descendants."""
        if not vendor_category_ids:
            return set(), set()
        r = await self.db.execute(
            select(VendorCategory).where(VendorCategory.vendor_id == vendor_id)
        )
        all_cats = list(r.scalars().all())
        by_parent: dict[Optional[UUID], list[VendorCategory]] = {}
        for c in all_cats:
            by_parent.setdefault(c.parent_id, []).append(c)
        by_id = {c.id: c for c in all_cats}

        selected_ids = {UUID(cid) for cid in vendor_category_ids if cid}
        product_tokens: set[str] = set()
        service_tokens: set[str] = set()

        def collect_tokens(cat: VendorCategory, tokens: set[str]):
            tokens.add(cat.name.strip().lower())
            tokens.add(cat.slug.strip().lower())
            for child in by_parent.get(cat.id, []):
                collect_tokens(child, tokens)

        for cid in selected_ids:
            cat = by_id.get(cid)
            if not cat:
                continue
            if cat.applies_to in ("product", "both"):
                collect_tokens(cat, product_tokens)
            if cat.applies_to in ("service", "both"):
                collect_tokens(cat, service_tokens)

        return product_tokens, service_tokens

    async def resolve_category_items(
        self, vendor_id: UUID, category: RestaurantMenuCategory,
    ) -> tuple[list[Product], list[Service]]:
        """Resolve the actual active products/services for one menu category."""
        if category.mode == "all_active":
            products = await self._active_products(vendor_id)
            services = await self._active_services(vendor_id)
            return products, services

        if category.mode == "curated":
            products = await self._products_by_ids(vendor_id, category.product_ids or [])
            services = await self._services_by_ids(vendor_id, category.service_ids or [])
            return products, services

        if category.mode == "by_categories":
            product_tokens, service_tokens = await self._resolve_by_categories(
                vendor_id, category.vendor_category_ids or [],
            )
            products = await self._active_products(vendor_id) if product_tokens else []
            services = await self._active_services(vendor_id) if service_tokens else []
            products = [
                p for p in products
                if (p.category or "").strip().lower() in product_tokens
                or (p.subcategory or "").strip().lower() in product_tokens
            ]
            services = [
                s for s in services
                if (s.category or "").strip().lower() in service_tokens
                or (s.subcategory or "").strip().lower() in service_tokens
            ]
            return products, services

        return [], []

    async def _active_products(self, vendor_id: UUID) -> list[Product]:
        r = await self.db.execute(
            select(Product)
            .options(selectinload(Product.images))
            .where(
                Product.vendor_id == vendor_id,
                Product.status == "active",
                Product.is_visible == True,  # noqa: E712
            )
            .order_by(Product.category, Product.name)
            .limit(CATALOG_ITEM_LIMIT)
        )
        return list(r.scalars().all())

    async def _active_services(self, vendor_id: UUID) -> list[Service]:
        r = await self.db.execute(
            select(Service)
            .where(
                Service.vendor_id == vendor_id,
                Service.status == "active",
                Service.is_visible == True,  # noqa: E712
            )
            .order_by(Service.category, Service.name)
            .limit(CATALOG_ITEM_LIMIT)
        )
        return list(r.scalars().all())

    async def _products_by_ids(self, vendor_id: UUID, ids: list[str]) -> list[Product]:
        uuids = [UUID(i) for i in ids if _is_uuid(i)]
        if not uuids:
            return []
        r = await self.db.execute(
            select(Product)
            .options(selectinload(Product.images))
            .where(Product.vendor_id == vendor_id, Product.id.in_(uuids))
        )
        rows = {p.id: p for p in r.scalars().all()}
        return [rows[u] for u in uuids if u in rows]

    async def _services_by_ids(self, vendor_id: UUID, ids: list[str]) -> list[Service]:
        uuids = [UUID(i) for i in ids if _is_uuid(i)]
        if not uuids:
            return []
        r = await self.db.execute(
            select(Service).where(Service.vendor_id == vendor_id, Service.id.in_(uuids))
        )
        rows = {s.id: s for s in r.scalars().all()}
        return [rows[u] for u in uuids if u in rows]

    async def build_menu_tree_payload(self, vendor_id: UUID, menu: RestaurantMenu) -> list[dict]:
        """Build a JSON-safe category tree with resolved products/services for guest display."""
        by_parent: dict[Optional[UUID], list[RestaurantMenuCategory]] = {}
        for c in menu.categories:
            by_parent.setdefault(c.parent_id, []).append(c)
        for kids in by_parent.values():
            kids.sort(key=lambda c: c.sort_order)

        async def build(cat: RestaurantMenuCategory) -> dict:
            products, services = await self.resolve_category_items(vendor_id, cat)
            children = [await build(child) for child in by_parent.get(cat.id, [])]
            return {
                "id": str(cat.id),
                "name": cat.name,
                "mode": cat.mode,
                "items": [_product_summary(p) for p in products] + [_service_summary(s) for s in services],
                "children": children,
            }

        return [await build(root) for root in by_parent.get(None, [])]


def _is_uuid(value: str) -> bool:
    try:
        UUID(value)
        return True
    except (ValueError, AttributeError, TypeError):
        return False


def _product_summary(p: Product) -> dict:
    images = getattr(p, "images", None) or []
    primary = next((img for img in images if img.is_primary), images[0] if images else None)
    return {
        "id": str(p.id),
        "item_type": "product",
        "name": p.name,
        "description": p.short_description,
        "price": float(p.price or 0),
        "category": p.category,
        "subcategory": p.subcategory,
        "image_url": primary.url if primary else None,
    }


def _service_summary(s: Service) -> dict:
    return {
        "id": str(s.id),
        "item_type": "service",
        "name": s.name,
        "description": s.short_description,
        "price": float(s.price or 0),
        "category": s.category,
        "subcategory": s.subcategory,
        "image_url": None,
    }
