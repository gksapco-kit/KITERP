"""Per-vendor UI/API field metadata for schema columns (Models explorer)."""
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.sql import func
import uuid

from app.database import Base


class SchemaFieldMapping(Base):
    __tablename__ = "schema_field_mapping"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)

    table_name = Column(String(120), nullable=False)
    column_name = Column(String(120), nullable=False)
    ui_label = Column(String(200), nullable=False)
    help_short = Column(Text)
    help_full = Column(Text)
    screens = Column(JSONB, default=list)
    note = Column(Text)
    is_active = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("vendor_id", "table_name", "column_name", name="uq_schema_field_mapping_vendor_col"),
        Index("ix_schema_field_mapping_vendor_table", "vendor_id", "table_name"),
    )
