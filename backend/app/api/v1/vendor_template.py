from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID

from app.database import get_db
from app.api.deps import get_current_active_user
from app.models.user import User
from app.models.vendor import Vendor
from app.services.vendor_service import VendorService
from pydantic import BaseModel
from typing import Any, Optional, Dict, List

router = APIRouter()

TEMPLATE_PRESETS = {
    "retail": {
        "id": "retail",
        "name": "Retail Store",
        "description": "Clean grid layout optimized for product catalogs",
        "hero_style": "gradient",
        "product_layout": "grid-4",
        "colors": {"primary": "#2563eb", "secondary": "#1e40af", "accent": "#f59e0b", "background": "#f9fafb"},
        "font": "Inter",
        "sections": {"hero": True, "trust_badges": True, "featured_products": True, "featured_services": False, "offers_banner": True, "testimonials": False, "cta": True},
    },
    "service": {
        "id": "service",
        "name": "Service Business",
        "description": "Service-first layout with booking and portfolio focus",
        "hero_style": "image",
        "product_layout": "grid-3",
        "colors": {"primary": "#64C3A0", "secondary": "#13624A", "accent": "#10b981", "background": "#f3fbf7"},
        "font": "Poppins",
        "sections": {"hero": True, "trust_badges": True, "featured_products": False, "featured_services": True, "offers_banner": False, "testimonials": True, "cta": True},
    },
    "hybrid": {
        "id": "hybrid",
        "name": "Hybrid Store",
        "description": "Balanced layout for both products and services",
        "hero_style": "gradient",
        "product_layout": "grid-4",
        "colors": {"primary": "#0891b2", "secondary": "#155e75", "accent": "#f97316", "background": "#f0fdfa"},
        "font": "Inter",
        "sections": {"hero": True, "trust_badges": True, "featured_products": True, "featured_services": True, "offers_banner": True, "testimonials": True, "cta": True},
    },
    "restaurant": {
        "id": "restaurant",
        "name": "Restaurant / Food",
        "description": "Menu-style layout with appetizing visuals",
        "hero_style": "image",
        "product_layout": "grid-3",
        "colors": {"primary": "#dc2626", "secondary": "#991b1b", "accent": "#facc15", "background": "#fef2f2"},
        "font": "DM Sans",
        "sections": {"hero": True, "trust_badges": False, "featured_products": True, "featured_services": False, "offers_banner": True, "testimonials": True, "cta": True},
    },
    "electronics": {
        "id": "electronics",
        "name": "Electronics / Repair",
        "description": "Tech-focused layout with specs and services",
        "hero_style": "gradient",
        "product_layout": "grid-4",
        "colors": {"primary": "#1d4ed8", "secondary": "#1e3a5f", "accent": "#22d3ee", "background": "#f0f9ff"},
        "font": "Space Grotesk",
        "sections": {"hero": True, "trust_badges": True, "featured_products": True, "featured_services": True, "offers_banner": True, "testimonials": False, "cta": True},
    },
    "fashion": {
        "id": "fashion",
        "name": "Fashion & Apparel",
        "description": "Stylish lookbook layout with large imagery and elegant typography",
        "hero_style": "image",
        "product_layout": "grid-3",
        "colors": {"primary": "#be185d", "secondary": "#9d174d", "accent": "#fbbf24", "background": "#fdf2f8"},
        "font": "Playfair Display",
        "sections": {"hero": True, "trust_badges": False, "featured_products": True, "featured_services": False, "offers_banner": True, "testimonials": True, "cta": True},
    },
    "clinic": {
        "id": "clinic",
        "name": "Clinic / Healthcare",
        "description": "Professional healthcare layout with appointment booking focus",
        "hero_style": "gradient",
        "product_layout": "grid-3",
        "colors": {"primary": "#0d9488", "secondary": "#0f766e", "accent": "#06b6d4", "background": "#f0fdfa"},
        "font": "Nunito",
        "sections": {"hero": True, "trust_badges": True, "featured_products": False, "featured_services": True, "offers_banner": False, "testimonials": True, "cta": True},
    },
    "grocery": {
        "id": "grocery",
        "name": "Grocery & Supermarket",
        "description": "Dense product grid optimized for large catalogs with quick-add",
        "hero_style": "gradient",
        "product_layout": "grid-4",
        "colors": {"primary": "#16a34a", "secondary": "#15803d", "accent": "#f97316", "background": "#f0fdf4"},
        "font": "Roboto",
        "sections": {"hero": True, "trust_badges": True, "featured_products": True, "featured_services": False, "offers_banner": True, "testimonials": False, "cta": True},
    },
    "jewellery": {
        "id": "jewellery",
        "name": "Jewellery & Luxury",
        "description": "Premium layout with rich gold accents and elegant presentation",
        "hero_style": "image",
        "product_layout": "grid-3",
        "colors": {"primary": "#92400e", "secondary": "#78350f", "accent": "#d4a017", "background": "#fffbeb"},
        "font": "Cormorant Garamond",
        "sections": {"hero": True, "trust_badges": True, "featured_products": True, "featured_services": False, "offers_banner": True, "testimonials": True, "cta": True},
    },
    "laundry": {
        "id": "laundry",
        "name": "Laundry & Dry Cleaning",
        "description": "Service-oriented layout with pricing tiers and pickup scheduling",
        "hero_style": "gradient",
        "product_layout": "grid-3",
        "colors": {"primary": "#2563eb", "secondary": "#1d4ed8", "accent": "#14b8a6", "background": "#eff6ff"},
        "font": "Quicksand",
        "sections": {"hero": True, "trust_badges": True, "featured_products": False, "featured_services": True, "offers_banner": True, "testimonials": True, "cta": True},
    },
    "medicine": {
        "id": "medicine",
        "name": "Pharmacy & Medicine",
        "description": "Clean medical layout with category-based product browsing",
        "hero_style": "gradient",
        "product_layout": "grid-4",
        "colors": {"primary": "#059669", "secondary": "#047857", "accent": "#3b82f6", "background": "#ecfdf5"},
        "font": "Source Sans Pro",
        "sections": {"hero": True, "trust_badges": True, "featured_products": True, "featured_services": False, "offers_banner": True, "testimonials": False, "cta": True},
    },
    "food": {
        "id": "food",
        "name": "Food & Bakery",
        "description": "Warm, appetizing layout for bakeries, cafes, and food businesses",
        "hero_style": "image",
        "product_layout": "grid-3",
        "colors": {"primary": "#ea580c", "secondary": "#c2410c", "accent": "#eab308", "background": "#fff7ed"},
        "font": "Nunito Sans",
        "sections": {"hero": True, "trust_badges": False, "featured_products": True, "featured_services": False, "offers_banner": True, "testimonials": True, "cta": True},
    },
}

DEFAULT_THEME = {
    "template": "hybrid",
    "colors": {"primary": "#2563eb", "secondary": "#1e40af", "accent": "#f59e0b", "background": "#f9fafb"},
    "font": "Inter",
    "font_body": "Inter",
    "hero_style": "gradient",
    "hero_title": "",
    "hero_subtitle": "",
    "hero_height": "medium",
    "hero_image_url": "",
    "product_layout": "grid-4",
    "product_detail_template": "classic",
    "card_style": "default",
    "button_radius": "rounded",
    "header_style": "classic",
    "sticky_header": True,
    "show_search": True,
    "footer_style": "standard",
    "sections": {
        "hero": True, "trust_badges": True, "featured_products": True,
        "featured_services": True, "offers_banner": True, "testimonials": False, "cta": True,
    },
    "custom_announcement": "",
}


class TemplateConfigUpdate(BaseModel):
    template: Optional[str] = None
    colors: Optional[Dict[str, str]] = None
    font: Optional[str] = None
    font_body: Optional[str] = None
    hero_style: Optional[str] = None
    hero_title: Optional[str] = None
    hero_subtitle: Optional[str] = None
    hero_height: Optional[str] = None
    hero_image_url: Optional[str] = None
    product_layout: Optional[str] = None
    product_detail_template: Optional[str] = None
    card_style: Optional[str] = None
    button_radius: Optional[str] = None
    header_style: Optional[str] = None
    sticky_header: Optional[bool] = None
    show_search: Optional[bool] = None
    footer_style: Optional[str] = None
    sections: Optional[Dict[str, bool]] = None
    custom_announcement: Optional[str] = None
    builder_config: Optional[Dict[str, Any]] = None


async def _get_vendor(user: User = Depends(get_current_active_user), db: AsyncSession = Depends(get_db)) -> Vendor:
    svc = VendorService(db)
    vendor = await svc.get_by_user_id(user.id)
    if not vendor:
        raise HTTPException(404, "Vendor not found")
    return vendor


@router.get("/presets")
async def list_presets():
    return JSONResponse(content={"presets": list(TEMPLATE_PRESETS.values())})


@router.get("")
async def get_template_config(vendor: Vendor = Depends(_get_vendor)):
    config = vendor.theme_config or {}
    merged = {**DEFAULT_THEME, **config}
    return JSONResponse(content=merged)


def _apply_builder_config(current: dict, bc: dict) -> None:
    """Translate the Storefront Builder's rich config into the flat theme_config fields
    that ThemeContext and the storefront consume, and store the raw builder_config for
    round-trip reload in the builder UI."""
    current["builder_config"] = bc

    if bc.get("template_id"):
        current["template"] = bc["template_id"]

    if bc.get("product_detail_template"):
        current["product_detail_template"] = bc["product_detail_template"]

    style: dict = bc.get("style") or {}
    if style:
        colors = dict(current.get("colors") or {})
        if style.get("primary_color"):
            colors["primary"] = style["primary_color"]
        if style.get("secondary_color"):
            colors["secondary"] = style["secondary_color"]
        if style.get("accent_color"):
            colors["accent"] = style["accent_color"]
        if style.get("bg_color"):
            colors["background"] = style["bg_color"]
        current["colors"] = colors
        if style.get("font_heading"):
            current["font"] = style["font_heading"]
        if style.get("checkout_layout"):
            current["checkout_layout"] = style["checkout_layout"]

    sections_list: list = bc.get("sections") or []
    if sections_list:
        # Builder id → ThemeContext/Home.tsx section key
        SECTION_ID_MAP = {"cta_banner": "cta"}

        sections_map: dict = {}
        for sec in sections_list:
            sec_id: str = sec.get("id", "")
            visible: bool = bool(sec.get("visible", True))
            props: dict = sec.get("props") or {}
            # Map builder section ids to storefront section keys
            mapped_id = SECTION_ID_MAP.get(sec_id, sec_id)
            sections_map[mapped_id] = visible

            if sec_id == "hero":
                if props.get("headline"):
                    current["hero_title"] = props["headline"]
                if props.get("subtitle"):
                    current["hero_subtitle"] = props["subtitle"]
                if props.get("bg_style"):
                    current["hero_style"] = props["bg_style"]

            if sec_id == "announcement_bar":
                current["custom_announcement"] = props.get("announcement_text", "") if visible else ""

        current["sections"] = sections_map


@router.put("")
async def update_template_config(data: TemplateConfigUpdate, vendor: Vendor = Depends(_get_vendor), db: AsyncSession = Depends(get_db)):
    current = dict(vendor.theme_config or {})

    updates = data.model_dump(exclude_unset=True)

    # Handle full builder_config payload first (Storefront Builder saves this shape)
    if "builder_config" in updates and updates["builder_config"]:
        _apply_builder_config(current, updates["builder_config"])

    # Handle legacy / direct flat-field updates
    flat_updates = {k: v for k, v in updates.items() if k != "builder_config"}

    if "template" in flat_updates and flat_updates["template"] in TEMPLATE_PRESETS:
        preset = TEMPLATE_PRESETS[flat_updates["template"]]
        current["template"] = flat_updates["template"]
        if "colors" not in flat_updates:
            current["colors"] = preset["colors"]
        if "font" not in flat_updates:
            current["font"] = preset["font"]
        if "sections" not in flat_updates:
            current["sections"] = preset["sections"]
        if "hero_style" not in flat_updates:
            current["hero_style"] = preset["hero_style"]
        if "product_layout" not in flat_updates:
            current["product_layout"] = preset["product_layout"]

    for key, val in flat_updates.items():
        if val is not None:
            if key in ("colors", "sections") and isinstance(val, dict):
                existing = current.get(key, {})
                current[key] = {**existing, **val}
            else:
                current[key] = val

    vendor.theme_config = current
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(vendor, "theme_config")
    await db.commit()
    await db.refresh(vendor)

    merged = {**DEFAULT_THEME, **vendor.theme_config}
    return JSONResponse(content=merged)


@router.post("/apply-preset/{preset_id}")
async def apply_preset(preset_id: str, vendor: Vendor = Depends(_get_vendor), db: AsyncSession = Depends(get_db)):
    if preset_id not in TEMPLATE_PRESETS:
        raise HTTPException(400, f"Unknown preset: {preset_id}")

    preset = TEMPLATE_PRESETS[preset_id]
    current = dict(vendor.theme_config or {})
    current["template"] = preset_id
    current["colors"] = preset["colors"]
    current["font"] = preset["font"]
    current["hero_style"] = preset["hero_style"]
    current["product_layout"] = preset["product_layout"]
    current["sections"] = preset["sections"]

    vendor.theme_config = current
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(vendor, "theme_config")
    await db.commit()
    await db.refresh(vendor)

    merged = {**DEFAULT_THEME, **vendor.theme_config}
    return JSONResponse(content=merged)
