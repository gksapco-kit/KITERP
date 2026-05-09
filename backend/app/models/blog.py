"""
Vendor Blog Posts — vendor-authored articles published on their storefront.
"""
from __future__ import annotations
import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Boolean, DateTime, ForeignKey, Integer, Text, JSON
)
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class VendorBlogPost(Base):
    __tablename__ = "vendor_blog_posts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)

    slug = Column(String(200), nullable=False)
    title = Column(String(300), nullable=False)
    excerpt = Column(String(600), nullable=True)
    content = Column(Text, nullable=True)          # markdown or HTML
    cover_url = Column(String(500), nullable=True)

    author_name = Column(String(150), nullable=True)
    author_avatar_url = Column(String(500), nullable=True)

    category = Column(String(100), nullable=True)
    tags = Column(JSON, nullable=False, default=list)   # list[str]
    reading_minutes = Column(Integer, nullable=True)

    is_published = Column(Boolean, default=False, nullable=False)
    published_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
