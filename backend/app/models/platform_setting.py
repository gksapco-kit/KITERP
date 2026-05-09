# app/models/platform_setting.py
from sqlalchemy import Column, String, Text, DateTime
from sqlalchemy.sql import func
from app.database import Base


class PlatformSetting(Base):
    """Global key-value store for platform-wide configuration (admin-only)."""
    __tablename__ = "platform_setting"

    key = Column(String(100), primary_key=True)
    value = Column(Text, nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
