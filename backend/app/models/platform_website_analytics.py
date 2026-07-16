"""Page views for the platform marketing site (kiterp.com), not vendor storefronts."""
from __future__ import annotations

import uuid

from sqlalchemy import Column, DateTime, Index, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID

from app.database import Base

PLATFORM_SITE_KEY = "platform"
PLATFORM_SITE_LABEL = "KITERP.com"
PLATFORM_VENDOR_ID = "__platform__"


class PlatformWebsitePageView(Base):
    __tablename__ = "platform_website_page_view"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    visitor_id = Column(String(120), nullable=True, index=True)
    event_type = Column(String(60), nullable=False, default="page_view")
    path = Column(String(500), nullable=False, default="/")
    payload = Column(JSONB, default=dict)
    occurred_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_platform_pv_occurred", "occurred_at"),
        Index("ix_platform_pv_path_time", "path", "occurred_at"),
    )
