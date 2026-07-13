"""Website builder export helpers (static snapshot vs dynamic config)."""

from __future__ import annotations

from copy import deepcopy
from typing import Any, Dict, List, Optional, Tuple

# Mirrors vendor-web blockDataSources.ts + backend apply-template wiring.
BLOCK_LIVE_RESOURCE: Dict[str, str] = {
    "nav": "pages",
    "footer": "pages",
    "about_split": "profile",
    "contact_form": "profile",
    "map_embed": "profile",
    "map_contact": "profile",
    "social_links": "profile",
    "product_grid": "products",
    "menu_grid": "products",
    "live_stock": "products",
    "live_quote": "products",
    "cart_drawer": "products",
    "product_detail": "products",
    "related_products": "products",
    "search_bar": "products",
    "recently_viewed": "products",
    "category_cards": "categories",
    "product_filters": "categories",
    "product.categories": "categories",
    "services_cards": "services",
    "services_list": "services",
    "booking_widget": "services",
    "booking_slot_picker": "services",
    "testimonials": "testimonials",
    "testimonials_grid": "testimonials",
    "product_reviews": "testimonials",
    "service.testimonials": "testimonials",
    "team_grid": "team",
    "team_list": "team",
    "stats": "kpis",
    "counters": "kpis",
    "impact_stats": "kpis",
    "gallery_masonry": "media",
    "gallery_grid": "media",
    "image_gallery": "media",
    "portfolio_grid": "media",
    "order_status": "orders",
    "trust_logos": "customers",
    "blog_grid": "blog",
    "blog_featured": "blog",
    "blog_list": "blog",
    "pricing": "plans",
    "service.pricing": "plans",
    "vertical.propertyListing": "properties",
    "vertical.propertyDetail": "properties",
    "vertical.courseCatalog": "courses",
    "vertical.courseDetail": "courses",
    "vertical.fitnessSchedule": "fitness_classes",
    "vertical.autoInventory": "vehicles",
    "vertical.vehicleDetail": "vehicles",
    "vertical.eventListing": "events",
    "vertical.ticketPicker": "events",
    "booking.recurring": "recurring_plans",
    "booking.wizard": "booking_wizard_steps",
    "booking.resource": "booking_resources",
}

_DYNAMIC_STRIP_PROP_KEYS = frozenset({
    "testimonials",
    "plans",
    "products",
    "services",
    "items",
    "events",
    "properties",
    "courses",
    "classes",
    "vehicles",
    "categories",
    "team_members",
    "members",
    "blog_posts",
    "posts",
    "resources",
    "steps",
    "recurring_plans",
})


def wire_block_data_source(block_type: str, props: Dict[str, Any]) -> Dict[str, Any]:
    p = dict(props or {})
    auto_source = BLOCK_LIVE_RESOURCE.get(block_type)
    if auto_source and "data_source" not in p:
        p["data_source"] = {"type": auto_source, "auto": True}
        if block_type in ("testimonials", "testimonials_grid", "product_reviews", "service.testimonials"):
            p["testimonials"] = []
    return p


def resolve_block_live_resource(block_type: str, props: Optional[Dict[str, Any]]) -> Optional[str]:
    p = props or {}
    ds = p.get("data_source")
    if isinstance(ds, dict):
        raw = ds.get("type")
        if isinstance(raw, str) and raw and raw not in ("external_api",):
            return raw.replace("internal_", "")
    return BLOCK_LIVE_RESOURCE.get(block_type)


def block_export_limit(props: Optional[Dict[str, Any]], default: int = 12) -> int:
    p = props or {}
    ds = p.get("data_source")
    if isinstance(ds, dict) and ds.get("limit") is not None:
        try:
            return max(1, min(int(ds["limit"]), 200))
        except (TypeError, ValueError):
            pass
    show_count = p.get("show_count")
    if show_count is not None:
        try:
            return max(1, min(int(show_count), 200))
        except (TypeError, ValueError):
            pass
    return max(1, min(default, 200))


def selected_ids_from_props(props: Optional[Dict[str, Any]]) -> List[str]:
    p = props or {}
    ds = p.get("data_source")
    if not isinstance(ds, dict):
        return []
    raw = ds.get("selected_ids")
    if not isinstance(raw, list):
        return []
    return [str(x) for x in raw if x]


def filter_live_items(items: List[Dict[str, Any]], selected_ids: List[str]) -> List[Dict[str, Any]]:
    if not selected_ids:
        return items
    allowed = set(selected_ids)
    return [item for item in items if item.get("id") and str(item["id"]) in allowed]


def props_for_dynamic_export(block_type: str, props: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    wired = wire_block_data_source(block_type, dict(props or {}))
    resource = resolve_block_live_resource(block_type, wired)
    if not resource:
        return wired
    cleaned = deepcopy(wired)
    for key in _DYNAMIC_STRIP_PROP_KEYS:
        cleaned.pop(key, None)
    return cleaned


def live_cache_key(resource: str, limit: int, selected_ids: List[str]) -> Tuple[str, int, Tuple[str, ...]]:
    return (resource, limit, tuple(selected_ids))


async def fetch_block_static_snapshot(
    db,
    vendor,
    site,
    site_id: str,
    block_type: str,
    props: Optional[Dict[str, Any]],
    live_cache: Dict[Tuple[str, int, Tuple[str, ...]], List[Dict[str, Any]]],
    fetch_live_items,
) -> Optional[Dict[str, Any]]:
    resource = resolve_block_live_resource(block_type, props)
    if not resource:
        return None
    limit = block_export_limit(props)
    selected = selected_ids_from_props(props)
    key = live_cache_key(resource, limit, selected)
    if key not in live_cache:
        items = await fetch_live_items(db, vendor, site, site_id, resource, limit)
        live_cache[key] = filter_live_items(items, selected)
    return {
        "resource": resource,
        "items": deepcopy(live_cache[key]),
        "selected_ids": selected or None,
        "limit": limit,
    }
