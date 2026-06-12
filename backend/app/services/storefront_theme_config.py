"""Shared business-front theme defaults (light / dark) and legacy preset migration."""

from __future__ import annotations

from copy import deepcopy
from typing import Any

TEMPLATE_PRESETS: dict[str, dict[str, Any]] = {
    "light": {
        "id": "light",
        "name": "Light",
        "description": "Clean bright storefront with light backgrounds and readable contrast",
        "hero_style": "gradient",
        "product_layout": "grid-4",
        "colors": {
            "primary": "#64C3A0",
            "secondary": "#13624A",
            "accent": "#0891b2",
            "background": "#f9fafb",
        },
        "font": "Inter",
        "sections": {
            "hero": True,
            "trust_badges": True,
            "featured_products": True,
            "featured_services": True,
            "offers_banner": True,
            "testimonials": False,
            "cta": True,
        },
    },
    "dark": {
        "id": "dark",
        "name": "Dark",
        "description": "Modern dark storefront with high-contrast accents",
        "hero_style": "dark",
        "product_layout": "grid-4",
        "colors": {
            "primary": "#64C3A0",
            "secondary": "#1e293b",
            "accent": "#38bdf8",
            "background": "#0f172a",
        },
        "font": "Inter",
        "sections": {
            "hero": True,
            "trust_badges": True,
            "featured_products": True,
            "featured_services": True,
            "offers_banner": True,
            "testimonials": False,
            "cta": True,
        },
    },
}

DEFAULT_THEME: dict[str, Any] = {
    "template": "light",
    "colors": dict(TEMPLATE_PRESETS["light"]["colors"]),
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
    "sections": dict(TEMPLATE_PRESETS["light"]["sections"]),
    "custom_announcement": "",
}

# Retired industry presets — migrate to light with fresh palette on read.
LEGACY_TEMPLATE_IDS = frozenset(
    {
        "retail",
        "service",
        "hybrid",
        "restaurant",
        "electronics",
        "fashion",
        "clinic",
        "grocery",
        "jewellery",
        "laundry",
        "medicine",
        "food",
    }
)

# Primary colors from retired industry presets (not light/dark).
LEGACY_PRIMARY_COLORS = frozenset(
    {
        "#2563eb",
        "#0891b2",
        "#dc2626",
        "#1d4ed8",
        "#be185d",
        "#0d9488",
        "#16a34a",
        "#92400e",
        "#059669",
        "#ea580c",
        "#1e40af",
        "#155e75",
        "#991b1b",
        "#1e3a5f",
    }
)


def _merge_base(config: dict | None) -> dict[str, Any]:
    raw = config or {}
    merged = {**DEFAULT_THEME, **raw}
    if isinstance(raw.get("colors"), dict):
        merged["colors"] = {**DEFAULT_THEME["colors"], **raw["colors"]}
    if isinstance(raw.get("sections"), dict):
        merged["sections"] = {**DEFAULT_THEME["sections"], **raw["sections"]}
    return merged


def _apply_preset(merged: dict[str, Any], preset_id: str) -> dict[str, Any]:
    preset = TEMPLATE_PRESETS[preset_id]
    out = deepcopy(merged)
    out["template"] = preset_id
    out["colors"] = dict(preset["colors"])
    out["font"] = preset["font"]
    out["hero_style"] = preset["hero_style"]
    out["product_layout"] = preset["product_layout"]
    out["sections"] = {**DEFAULT_THEME["sections"], **preset["sections"]}
    return out


def _uses_legacy_palette(merged: dict[str, Any]) -> bool:
    tid = str(merged.get("template") or "").strip()
    if tid in LEGACY_TEMPLATE_IDS or (tid and tid not in TEMPLATE_PRESETS):
        return True
    colors = merged.get("colors") if isinstance(merged.get("colors"), dict) else {}
    primary = str(colors.get("primary") or "").strip().lower()
    return primary in LEGACY_PRIMARY_COLORS


def normalize_theme_config(config: dict | None) -> dict[str, Any]:
    """Merge defaults; map retired industry templates to the light palette."""
    merged = _merge_base(config)
    if _uses_legacy_palette(merged):
        return _apply_preset(merged, "light")
    return merged


def theme_config_needs_migration(config: dict | None) -> bool:
    return _uses_legacy_palette(_merge_base(config))
