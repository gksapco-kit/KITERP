# app/models/vendor_plan.py
from sqlalchemy import Column, String, Text, Boolean, DateTime, Numeric, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
import uuid
from app.database import Base


class VendorPlan(Base):
    __tablename__ = "vendor_plan"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    name = Column(String(100), nullable=False)
    slug = Column(String(100), unique=True, nullable=False)
    description = Column(Text)
    
    # Pricing
    price_monthly = Column(Numeric(12, 2), nullable=False)
    price_yearly = Column(Numeric(12, 2))
    currency = Column(String(3), default="INR")
    
    # Limits
    max_products = Column(Integer, default=-1)  # -1 = unlimited
    max_services = Column(Integer, default=-1)
    max_team_members = Column(Integer, default=1)
    max_storage_mb = Column(Integer, default=1000)
    
    # Features
    features = Column(JSONB, default={
        "custom_domain": False,
        "analytics": True,
        "api_access": False,
        "priority_support": False,
        "white_label": False,
        "branded_app": False,
    })
    
    # Status
    is_active = Column(Boolean, default=True)
    is_featured = Column(Boolean, default=False)
    sort_order = Column(Integer, default=0)
    
    # Audit
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
