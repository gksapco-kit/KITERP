from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.deps import get_current_active_user, resolve_dashboard_vendor
from app.middleware.vendor_dashboard_context import get_preferred_vendor_id_from_context
from app.models.user import User
from app.models.vendor import Vendor
from app.services.storefront_theme_config import (
    DEFAULT_THEME,
    TEMPLATE_PRESETS,
    normalize_theme_config,
    theme_config_needs_migration,
)
from pydantic import BaseModel
from typing import Optional, Dict

router = APIRouter()


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


async def _get_vendor(user: User = Depends(get_current_active_user), db: AsyncSession = Depends(get_db)) -> Vendor:
    pref = get_preferred_vendor_id_from_context()
    return await resolve_dashboard_vendor(db, user, preferred_vendor_id=pref)


@router.get("/presets")
async def list_presets():
    return JSONResponse(content={"presets": list(TEMPLATE_PRESETS.values())})


@router.get("")
async def get_template_config(
    vendor: Vendor = Depends(_get_vendor),
    db: AsyncSession = Depends(get_db),
):
    raw = vendor.theme_config or {}
    if theme_config_needs_migration(raw):
        normalized = normalize_theme_config(raw)
        vendor.theme_config = normalized
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(vendor, "theme_config")
        await db.commit()
        await db.refresh(vendor)
        return JSONResponse(content=normalized)
    return JSONResponse(content=normalize_theme_config(raw))


@router.put("")
async def update_template_config(data: TemplateConfigUpdate, vendor: Vendor = Depends(_get_vendor), db: AsyncSession = Depends(get_db)):
    current = dict(vendor.theme_config or {})

    updates = data.model_dump(exclude_unset=True)

    if "template" in updates:
        tid = updates["template"]
        if tid not in TEMPLATE_PRESETS:
            updates["template"] = "light"
        preset = TEMPLATE_PRESETS[updates["template"]]
        current["template"] = updates["template"]
        if "colors" not in updates:
            current["colors"] = preset["colors"]
        if "font" not in updates:
            current["font"] = preset["font"]
        if "sections" not in updates:
            current["sections"] = preset["sections"]
        if "hero_style" not in updates:
            current["hero_style"] = preset["hero_style"]
        if "product_layout" not in updates:
            current["product_layout"] = preset["product_layout"]

    for key, val in updates.items():
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

    return JSONResponse(content=normalize_theme_config(vendor.theme_config))


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

    return JSONResponse(content=normalize_theme_config(vendor.theme_config))
