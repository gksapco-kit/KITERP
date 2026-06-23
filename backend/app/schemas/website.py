"""Pydantic schemas for the Website Builder module."""
from __future__ import annotations
from typing import Any, Dict, List, Optional, Union
from uuid import UUID
from pydantic import BaseModel, Field, field_validator
from datetime import datetime


def _str_uuid(v: Any) -> str:
    """Coerce UUID objects to str for response models."""
    if isinstance(v, UUID):
        return str(v)
    return v


# ── Block ─────────────────────────────────────────────────────────────────────

class BlockCreate(BaseModel):
    block_type: str
    label: Optional[str] = None
    props: Dict[str, Any] = Field(default_factory=dict)
    style_overrides: Dict[str, Any] = Field(default_factory=dict)
    visible: bool = True
    visible_on_mobile: bool = True
    visible_on_tablet: bool = True
    visible_on_desktop: bool = True
    animation: Optional[str] = None
    animation_delay: int = 0
    sort_order: int = 0


class BlockUpdate(BaseModel):
    label: Optional[str] = None
    props: Optional[Dict[str, Any]] = None
    style_overrides: Optional[Dict[str, Any]] = None
    visible: Optional[bool] = None
    visible_on_mobile: Optional[bool] = None
    visible_on_tablet: Optional[bool] = None
    visible_on_desktop: Optional[bool] = None
    animation: Optional[str] = None
    animation_delay: Optional[int] = None
    sort_order: Optional[int] = None


class BlockOut(BaseModel):
    id: str
    page_id: str
    block_type: str
    label: Optional[str]
    props: Dict[str, Any]
    style_overrides: Dict[str, Any]
    visible: bool
    visible_on_mobile: bool
    visible_on_tablet: bool
    visible_on_desktop: bool
    animation: Optional[str]
    animation_delay: int
    sort_order: int
    created_at: datetime
    updated_at: datetime

    @field_validator('id', 'page_id', mode='before')
    @classmethod
    def coerce_uuid(cls, v: Any) -> str:
        return _str_uuid(v)

    class Config:
        from_attributes = True


# ── Page ──────────────────────────────────────────────────────────────────────

class PageCreate(BaseModel):
    title: str
    slug: str
    page_type: str = "custom"
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
    og_image_url: Optional[str] = None
    layout: str = "full"
    sort_order: int = 0
    is_published: bool = True
    is_homepage: bool = False
    show_in_nav: bool = True


class PageUpdate(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    page_type: Optional[str] = None
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
    og_image_url: Optional[str] = None
    layout: Optional[str] = None
    sort_order: Optional[int] = None
    is_published: Optional[bool] = None
    is_homepage: Optional[bool] = None
    show_in_nav: Optional[bool] = None


class PageOut(BaseModel):
    id: str
    site_id: str
    title: str
    slug: str
    page_type: str
    seo_title: Optional[str]
    seo_description: Optional[str]
    og_image_url: Optional[str]
    layout: str
    sort_order: int
    is_published: bool
    is_homepage: bool
    show_in_nav: bool
    deleted_at: Optional[datetime] = None
    blocks: List[BlockOut] = []
    created_at: datetime
    updated_at: datetime

    @field_validator('id', 'site_id', mode='before')
    @classmethod
    def coerce_uuid(cls, v: Any) -> str:
        return _str_uuid(v)

    class Config:
        from_attributes = True


# ── Site ──────────────────────────────────────────────────────────────────────

class StyleConfig(BaseModel):
    primary_color: str = "#6d28d9"
    secondary_color: str = "#4c1d95"
    accent_color: str = "#f59e0b"
    bg_color: str = "#ffffff"
    surface_color: str = "#f9fafb"
    text_color: str = "#111827"
    font_heading: str = "Inter"
    font_body: str = "Inter"
    border_radius: str = "rounded"        # sharp|rounded|pill
    spacing: str = "comfortable"          # compact|comfortable|spacious
    animation: str = "subtle"            # none|subtle|expressive
    shadow_style: str = "soft"           # none|soft|elevated
    button_style: str = "filled"         # filled|outline|ghost
    nav_style: str = "default"           # default|transparent|sticky
    footer_style: str = "default"
    container_width: str = "1280px"


class SiteCreate(BaseModel):
    name: str
    subdomain: Optional[str] = None
    custom_domain: Optional[str] = None
    description: Optional[str] = None
    favicon_url: Optional[str] = None
    logo_url: Optional[str] = None
    style_config: Dict[str, Any] = Field(default_factory=dict)
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
    seo_keywords: Optional[str] = None
    og_image_url: Optional[str] = None
    google_analytics_id: Optional[str] = None
    meta_pixel_id: Optional[str] = None
    custom_head_code: Optional[str] = None
    custom_body_code: Optional[str] = None
    language: Optional[str] = "en"
    languages_enabled: Optional[List[str]] = Field(default_factory=lambda: ["en"])
    currency: Optional[str] = "USD"
    currencies_enabled: Optional[List[str]] = Field(default_factory=lambda: ["USD"])
    currency_symbol: Optional[str] = "$"
    currency_position: Optional[str] = "before"
    location: Optional[str] = None
    timezone: Optional[str] = "UTC"


class SiteUpdate(BaseModel):
    name: Optional[str] = None
    subdomain: Optional[str] = None
    custom_domain: Optional[str] = None
    description: Optional[str] = None
    favicon_url: Optional[str] = None
    logo_url: Optional[str] = None
    style_config: Optional[Dict[str, Any]] = None
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
    seo_keywords: Optional[str] = None
    og_image_url: Optional[str] = None
    is_published: Optional[bool] = None
    status: Optional[str] = None
    google_analytics_id: Optional[str] = None
    meta_pixel_id: Optional[str] = None
    custom_head_code: Optional[str] = None
    custom_body_code: Optional[str] = None
    language: Optional[str] = None
    languages_enabled: Optional[List[str]] = None
    currency: Optional[str] = None
    currencies_enabled: Optional[List[str]] = None
    currency_symbol: Optional[str] = None
    currency_position: Optional[str] = None
    location: Optional[str] = None
    timezone: Optional[str] = None
    headless_enabled: Optional[bool] = None


class SiteOut(BaseModel):
    id: str
    vendor_id: str
    name: str
    subdomain: Optional[str]
    custom_domain: Optional[str]
    description: Optional[str]
    favicon_url: Optional[str]
    logo_url: Optional[str]
    style_config: Dict[str, Any]
    seo_title: Optional[str]
    seo_description: Optional[str]
    seo_keywords: Optional[str]
    og_image_url: Optional[str]
    is_published: bool
    published_at: Optional[datetime]
    status: str
    google_analytics_id: Optional[str]
    meta_pixel_id: Optional[str]
    custom_head_code: Optional[str]
    custom_body_code: Optional[str]
    language: Optional[str] = "en"
    languages_enabled: Optional[List[str]] = Field(default_factory=lambda: ["en"])
    currency: Optional[str] = "USD"
    currencies_enabled: Optional[List[str]] = Field(default_factory=lambda: ["USD"])
    currency_symbol: Optional[str] = "$"
    currency_position: Optional[str] = "before"
    location: Optional[str] = None
    timezone: Optional[str] = "UTC"
    headless_enabled: Optional[bool] = False
    headless_token: Optional[str] = None
    pages: List[PageOut] = []
    created_at: datetime
    updated_at: datetime

    @field_validator('id', 'vendor_id', mode='before')
    @classmethod
    def coerce_uuid(cls, v: Any) -> str:
        return _str_uuid(v)

    class Config:
        from_attributes = True


class SiteListItem(BaseModel):
    id: str
    name: str
    subdomain: Optional[str]
    custom_domain: Optional[str]
    description: Optional[str]
    favicon_url: Optional[str]
    logo_url: Optional[str]
    is_published: bool
    status: str
    page_count: int = 0
    applied_template_id: Optional[str] = None
    applied_template_name: Optional[str] = None
    website_store_scope: Optional[str] = None
    website_store_id: Optional[str] = None
    website_store_name: Optional[str] = None
    website_home_store_id: Optional[str] = None
    storefront_assigned: Optional[bool] = None
    created_at: datetime
    updated_at: datetime

    @field_validator('id', mode='before')
    @classmethod
    def coerce_uuid(cls, v: Any) -> str:
        return _str_uuid(v)

    class Config:
        from_attributes = True


class PageTrashOut(BaseModel):
    id: str
    title: str
    slug: str
    deleted_at: datetime
    purge_at: datetime
    days_remaining: int
    block_count: int = 0

    @field_validator('id', mode='before')
    @classmethod
    def coerce_uuid(cls, v: Any) -> str:
        return _str_uuid(v)


# ── Block reorder ─────────────────────────────────────────────────────────────

class BlockReorderItem(BaseModel):
    id: str
    sort_order: int


class BlockReorderRequest(BaseModel):
    items: List[BlockReorderItem]


# ── Page reorder ──────────────────────────────────────────────────────────────

class PageReorderItem(BaseModel):
    id: str
    sort_order: int


class PageReorderRequest(BaseModel):
    items: List[PageReorderItem]


# ── AI requests ───────────────────────────────────────────────────────────────

class AIGenerateSiteRequest(BaseModel):
    """One-prompt full-site generator."""
    business_description: str
    niche: Optional[str] = None          # restaurant|saas|ecommerce|agency|portfolio|etc.
    tone: str = "professional"
    pages: Optional[List[str]] = None    # e.g. ["home","about","pricing","contact"] (auto if omitted)
    include_blog: bool = False
    include_pricing: bool = True
    image_category: Optional[str] = None
    selling_mode: Optional[str] = None   # products|services|both
    site_name: Optional[str] = None
    business_type: Optional[str] = None
    setup_features: Optional[List[str]] = None


class AIGenerateSiteResponse(BaseModel):
    site_name: str
    tagline: str
    pages: List[Dict[str, Any]]          # [{title, slug, page_type, blocks: [...]}]
    style_config: Dict[str, Any]
    seo_title: str
    seo_description: str
    summary: str


class SiteRedirectCreate(BaseModel):
    from_path: str
    to_path: str
    status_code: int = 301
    is_active: bool = True


class SiteRedirectUpdate(BaseModel):
    from_path: Optional[str] = None
    to_path: Optional[str] = None
    status_code: Optional[int] = None
    is_active: Optional[bool] = None


class SiteRedirectOut(BaseModel):
    id: str
    site_id: str
    from_path: str
    to_path: str
    status_code: int
    is_active: bool
    hit_count: int
    created_at: datetime

    @field_validator('id', 'site_id', mode='before')
    @classmethod
    def coerce_uuid(cls, v: Any) -> str:
        return _str_uuid(v)

    class Config:
        from_attributes = True


class AITextRequest(BaseModel):
    prompt: str
    context: Optional[str] = None
    tone: str = "professional"
    # professional|friendly|bold|minimalist|luxury|gen_z|empathetic|casual|persuasive|corporate
    block_type: Optional[str] = None
    field: Optional[str] = None          # headline|subtitle|cta|body|seo_title|seo_description


class AIScreenshotRequest(BaseModel):
    image_base64: str
    website_type: Optional[str] = None  # ecommerce|portfolio|blog|corporate|landing|restaurant


class AIUrlCloneRequest(BaseModel):
    url: str
    clone_mode: str = "style"           # style|structure|full


class AIUxReviewRequest(BaseModel):
    site_id: str
    page_id: Optional[str] = None
    checks: List[str] = Field(default_factory=lambda: [
        "contrast", "cta_clarity", "mobile_friendliness",
        "hierarchy", "conversion", "accessibility", "seo"
    ])


class AIImageRequest(BaseModel):
    prompt: str
    style: str = "photorealistic"       # photorealistic|illustration|minimalist|abstract|3d
    aspect_ratio: str = "16:9"         # 16:9|1:1|4:3|9:16|3:2
    site_context: Optional[str] = None
    negative_prompt: Optional[str] = None
    block_context: Optional[str] = None  # hero|product|team|about|etc.


class AISEORequest(BaseModel):
    page_title: str
    page_type: str = "home"
    site_description: Optional[str] = None
    keywords_hint: Optional[str] = None


class AISEOResponse(BaseModel):
    seo_title: str
    seo_description: str
    seo_keywords: str
    og_title: str
    og_description: str
    focus_keyword: str
    readability_tips: List[str]


class AISuggestBlocksRequest(BaseModel):
    page_type: str          # home|about|services|contact|landing|portfolio|etc.
    industry: Optional[str] = None
    goal: Optional[str] = None  # conversions|awareness|portfolio|ecommerce


class AISuggestBlocksResponse(BaseModel):
    blocks: List[Dict[str, Any]]
    reasoning: str
    estimated_sections: int


class AIEnhancePromptRequest(BaseModel):
    prompt: str
    style: Optional[str] = None
    block_context: Optional[str] = None
    site_description: Optional[str] = None


class AIEnhancePromptResponse(BaseModel):
    enhanced_prompt: str
    negative_prompt: str
    style_suggestion: str
    tips: List[str]


class AIThemeRequest(BaseModel):
    brand_description: str
    industry: Optional[str] = None
    mood: Optional[str] = None           # professional|playful|luxury|minimal|bold
    logo_url: Optional[str] = None


class AIMediaAdjustRequest(BaseModel):
    image_url: str
    adjustments: Dict[str, Any] = Field(default_factory=dict)
    # adjustments keys: brightness, contrast, saturation, sharpness,
    #   remove_background, color_grade (preset name), ai_enhance, crop_focus


class AITextResponse(BaseModel):
    result: str
    alternatives: List[str] = []


class AIScreenshotResponse(BaseModel):
    detected_sections: List[Dict[str, Any]]
    suggested_blocks: List[Dict[str, Any]]
    detected_colors: List[str]
    detected_fonts: List[str]
    website_type: str
    confidence: float


class AIUrlCloneResponse(BaseModel):
    style_config: Dict[str, Any]
    detected_blocks: List[Dict[str, Any]]
    color_palette: List[str]
    typography: Dict[str, Any]
    layout_notes: str


class AIUxReviewResponse(BaseModel):
    score: int                          # 0-100
    issues: List[Dict[str, Any]]
    suggestions: List[Dict[str, Any]]
    strengths: List[str]
    priority_fixes: List[str]


class AIThemeResponse(BaseModel):
    style_config: Dict[str, Any]
    color_palette: List[str]
    font_pairing: Dict[str, str]
    mood_description: str
    suggested_templates: List[str]


class AIMediaAdjustResponse(BaseModel):
    adjusted_url: str
    adjustments_applied: Dict[str, Any]
    preview_url: Optional[str] = None


# ── Media ─────────────────────────────────────────────────────────────────────

class MediaUpdateBody(BaseModel):
    filename: str


class MediaOut(BaseModel):
    id: str
    site_id: str
    filename: str
    original_url: str
    adjusted_url: Optional[str]
    thumbnail_url: Optional[str]
    file_type: Optional[str]
    width: Optional[int]
    height: Optional[int]
    file_size: Optional[int]
    adjustments: Dict[str, Any]
    ai_tags: List[str]
    ai_description: Optional[str]
    created_at: datetime

    @field_validator('id', 'site_id', mode='before')
    @classmethod
    def coerce_uuid(cls, v: Any) -> str:
        return _str_uuid(v)

    class Config:
        from_attributes = True
