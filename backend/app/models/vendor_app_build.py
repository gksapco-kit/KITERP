# app/models/vendor_app_build.py
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.database import Base


class VendorAppBuild(Base):
    """Tracks each branded-app build request for a vendor."""
    __tablename__ = "vendor_app_build"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)

    # Which platform(s) this build targets
    platform = Column(String(20), nullable=False)  # "android", "ios", "all"

    # EAS build profile used
    build_profile = Column(String(50), nullable=False, default="vendor-all")

    # Build lifecycle
    status = Column(String(30), nullable=False, default="pending")
    # pending -> config_generated -> building -> built -> submitted -> published -> failed

    # EAS Build IDs returned by `eas build`
    eas_build_id_android = Column(String(100))
    eas_build_id_ios = Column(String(100))

    # Download / store URLs once built
    artifact_url_android = Column(Text)
    artifact_url_ios = Column(Text)

    # Store submission tracking
    play_store_status = Column(String(30))
    app_store_status = Column(String(30))

    # The generated config.json snapshot used for this build
    config_snapshot = Column(JSONB, default={})

    # Error info if build failed
    error_message = Column(Text)

    # Who triggered the build
    triggered_by = Column(UUID(as_uuid=True), ForeignKey("user.id"))

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    built_at = Column(DateTime(timezone=True))
    published_at = Column(DateTime(timezone=True))

    vendor = relationship("Vendor")

    __table_args__ = (
        Index("idx_app_build_vendor", "vendor_id"),
        Index("idx_app_build_status", "status"),
        Index("idx_app_build_vendor_status", "vendor_id", "status"),
    )
