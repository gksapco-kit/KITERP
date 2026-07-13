"""
Website Builder models — multi-site, multi-page, block-based.
"""
from __future__ import annotations
import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Boolean, DateTime, ForeignKey, Integer, Text, JSON
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base

SUPPORTED_LANGUAGES = [
    ("en", "English"), ("es", "Español"), ("fr", "Français"), ("de", "Deutsch"),
    ("it", "Italiano"), ("pt", "Português"), ("ar", "العربية"), ("hi", "हिंदी"),
    ("zh", "中文"), ("ja", "日本語"), ("ko", "한국어"),
]

SUPPORTED_CURRENCIES = [
    ("USD", "$"), ("EUR", "€"), ("GBP", "£"), ("INR", "₹"), ("JPY", "¥"),
    ("AED", "AED"), ("SAR", "SAR"), ("CAD", "CA$"), ("AUD", "A$"), ("SGD", "S$"),
]


class WebsiteSite(Base):
    __tablename__ = "wb_sites"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)

    name = Column(String(200), nullable=False)
    subdomain = Column(String(100), nullable=True, unique=True)
    custom_domain = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    favicon_url = Column(String(500), nullable=True)
    logo_url = Column(String(500), nullable=True)

    # Global style config
    style_config = Column(JSON, nullable=False, default=dict)

    # SEO defaults
    seo_title = Column(String(200), nullable=True)
    seo_description = Column(Text, nullable=True)
    seo_keywords = Column(String(500), nullable=True)
    og_image_url = Column(String(500), nullable=True)
    schema_org_type = Column(String(30), nullable=False, default="auto")

    # Status
    is_published = Column(Boolean, default=False)
    published_at = Column(DateTime, nullable=True)
    status = Column(String(50), default="draft")  # draft | published | archived

    # Soft delete — site stays recoverable for SITE_TRASH_RETENTION_DAYS, then purged
    deleted_at = Column(DateTime, nullable=True, index=True)

    # Analytics & integrations
    google_analytics_id = Column(String(50), nullable=True)
    meta_pixel_id = Column(String(50), nullable=True)
    custom_head_code = Column(Text, nullable=True)
    custom_body_code = Column(Text, nullable=True)

    # Internationalisation
    language = Column(String(10), default="en")
    languages_enabled = Column(JSON, default=lambda: ["en"])
    currency = Column(String(10), default="USD")
    currencies_enabled = Column(JSON, default=lambda: ["USD"])
    currency_symbol = Column(String(10), default="$")
    currency_position = Column(String(10), default="before")  # before | after

    # Location / timezone
    location = Column(String(200), nullable=True)
    timezone = Column(String(100), default="UTC")

    # Custom domain verification (P2.1)
    domain_verification_token = Column(String(64), nullable=True)
    domain_verified = Column(Boolean, default=False)
    domain_ssl_status = Column(String(30), nullable=True)   # pending | issued | failed
    domain_ssl_expires_at = Column(DateTime, nullable=True)

    # Headless / API-first mode
    headless_enabled = Column(Boolean, default=False)
    headless_token = Column(String(64), nullable=True)

    # Feature flags (used to dark-launch per-phase features)
    feature_flags = Column(JSON, nullable=True, default=dict)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    pages = relationship("WebsitePage", back_populates="site", cascade="all, delete-orphan", order_by="WebsitePage.sort_order")
    redirects = relationship("WebsiteRedirect", back_populates="site", cascade="all, delete-orphan")


class WebsitePage(Base):
    __tablename__ = "wb_pages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    site_id = Column(UUID(as_uuid=True), ForeignKey("wb_sites.id", ondelete="CASCADE"), nullable=False, index=True)

    title = Column(String(200), nullable=False)
    slug = Column(String(200), nullable=False)
    page_type = Column(String(50), default="custom")  # home|about|services|contact|blog|portfolio|pricing|custom

    # SEO per-page overrides
    seo_title = Column(String(200), nullable=True)
    seo_description = Column(Text, nullable=True)
    og_image_url = Column(String(500), nullable=True)
    focus_keyword = Column(String(100), nullable=True)
    seo_keywords = Column(String(500), nullable=True)
    noindex = Column(Boolean, default=False, nullable=False)
    og_title = Column(String(200), nullable=True)
    og_description = Column(Text, nullable=True)
    canonical_url = Column(String(500), nullable=True)
    schema_type = Column(String(30), nullable=False, default="auto")

    # Layout
    layout = Column(String(50), default="full")  # full|boxed|sidebar-left|sidebar-right

    sort_order = Column(Integer, default=0)
    is_published = Column(Boolean, default=True)
    is_homepage = Column(Boolean, default=False)
    show_in_nav = Column(Boolean, default=True)

    # P2.3 — draft/scheduled publishing
    publish_status = Column(String(20), default="published")   # draft | scheduled | published
    scheduled_publish_at = Column(DateTime, nullable=True)

    # Soft delete — page stays recoverable for PAGE_TRASH_RETENTION_DAYS, then purged
    deleted_at = Column(DateTime, nullable=True, index=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    site = relationship("WebsiteSite", back_populates="pages")
    blocks = relationship("WebsiteBlock", back_populates="page", cascade="all, delete-orphan", order_by="WebsiteBlock.sort_order")


class WebsiteBlock(Base):
    __tablename__ = "wb_blocks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    page_id = Column(UUID(as_uuid=True), ForeignKey("wb_pages.id", ondelete="CASCADE"), nullable=False, index=True)

    block_type = Column(String(100), nullable=False)
    label = Column(String(200), nullable=True)

    # All block content and style as JSON
    props = Column(JSON, nullable=False, default=dict)

    # Style overrides for this specific block
    style_overrides = Column(JSON, nullable=False, default=dict)

    # Visibility
    visible = Column(Boolean, default=True)
    visible_on_mobile = Column(Boolean, default=True)
    visible_on_tablet = Column(Boolean, default=True)
    visible_on_desktop = Column(Boolean, default=True)

    # Animation
    animation = Column(String(50), nullable=True)  # fade-in|slide-up|slide-left|zoom-in
    animation_delay = Column(Integer, default=0)   # ms

    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    page = relationship("WebsitePage", back_populates="blocks")


class WebsiteRedirect(Base):
    """URL redirect rules per site."""
    __tablename__ = "wb_redirects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    site_id = Column(UUID(as_uuid=True), ForeignKey("wb_sites.id", ondelete="CASCADE"), nullable=False, index=True)

    from_path = Column(String(500), nullable=False)
    to_path = Column(String(500), nullable=False)
    status_code = Column(Integer, default=301)  # 301 | 302
    is_active = Column(Boolean, default=True)
    hit_count = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)

    site = relationship("WebsiteSite", back_populates="redirects")


class WebsiteFormSubmission(Base):
    """Contact/newsletter/custom form submissions from published business front pages."""
    __tablename__ = "wb_form_submissions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    site_id = Column(UUID(as_uuid=True), ForeignKey("wb_sites.id", ondelete="CASCADE"), nullable=False, index=True)
    page_id = Column(UUID(as_uuid=True), ForeignKey("wb_pages.id", ondelete="SET NULL"), nullable=True, index=True)
    block_id = Column(UUID(as_uuid=True), nullable=True)
    form_type = Column(String(50), nullable=True)   # contact | newsletter | custom
    payload = Column(JSON, nullable=False, default=dict)
    crm_lead_id = Column(UUID(as_uuid=True), nullable=True)
    gdpr_consent = Column(Boolean, default=False)
    ip_address = Column(String(64), nullable=True)
    user_agent = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    site = relationship("WebsiteSite")


class WebsiteBuilderPreview(Base):
    """
    Full-site JSON snapshot for browser preview (business front :3002) without publishing.
    Created from the vendor builder; read via opaque token on the public API.
    """
    __tablename__ = "wb_builder_previews"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    site_id = Column(UUID(as_uuid=True), ForeignKey("wb_sites.id", ondelete="CASCADE"), nullable=False, index=True)
    preview_token = Column(String(64), nullable=False, unique=True, index=True)
    label = Column(String(200), nullable=True)
    payload = Column(JSON, nullable=False, default=dict)  # same shape as public _site_out()
    created_at = Column(DateTime, default=datetime.utcnow)

    site = relationship("WebsiteSite")


class WebsitePageRevision(Base):
    """Immutable snapshot of a page + blocks taken on every save — for history/rollback."""
    __tablename__ = "wb_page_revisions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    page_id = Column(UUID(as_uuid=True), ForeignKey("wb_pages.id", ondelete="CASCADE"), nullable=False, index=True)
    site_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    snapshot = Column(JSON, nullable=False, default=dict)   # full page + blocks JSON
    author_user_id = Column(UUID(as_uuid=True), nullable=True)
    note = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    page = relationship("WebsitePage")


class WebsiteBlockTranslation(Base):
    """Translated props override per block per language (P3.1)."""
    __tablename__ = "wb_block_translations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    block_id = Column(UUID(as_uuid=True), ForeignKey("wb_blocks.id", ondelete="CASCADE"), nullable=False, index=True)
    language = Column(String(10), nullable=False)
    props_override = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    block = relationship("WebsiteBlock")


class WebsiteSymbol(Base):
    """Reusable block subtrees that update all instances on edit (P3.3)."""
    __tablename__ = "wb_symbols"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    snapshot = Column(JSON, nullable=False, default=dict)
    thumbnail_url = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class WebsiteABExposure(Base):
    """A/B test exposure and conversion tracking (P3.7)."""
    __tablename__ = "wb_ab_exposures"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    site_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    block_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    variant = Column(String(10), nullable=False)
    session_id = Column(String(100), nullable=True)
    converted = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class WebsiteWebhook(Base):
    """Outgoing webhook subscriptions per site (P3.10)."""
    __tablename__ = "wb_webhooks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    site_id = Column(UUID(as_uuid=True), ForeignKey("wb_sites.id", ondelete="CASCADE"), nullable=False, index=True)
    event = Column(String(50), nullable=False)   # site.published | form.submitted | order.placed
    url = Column(String(500), nullable=False)
    secret = Column(String(64), nullable=True)   # HMAC signing secret
    is_active = Column(Boolean, default=True)
    last_triggered_at = Column(DateTime, nullable=True)
    last_status_code = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    site = relationship("WebsiteSite")


class WebsiteMedia(Base):
    """Media library scoped to a site for the AI Media Adjuster."""
    __tablename__ = "wb_media"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    site_id = Column(UUID(as_uuid=True), ForeignKey("wb_sites.id", ondelete="CASCADE"), nullable=False, index=True)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)

    filename = Column(String(300), nullable=False)
    original_url = Column(String(500), nullable=False)
    adjusted_url = Column(String(500), nullable=True)   # AI-adjusted version
    thumbnail_url = Column(String(500), nullable=True)

    file_type = Column(String(50), nullable=True)   # image|video
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    file_size = Column(Integer, nullable=True)

    # AI adjustments applied
    adjustments = Column(JSON, nullable=False, default=dict)
    ai_tags = Column(JSON, nullable=False, default=list)
    ai_description = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
