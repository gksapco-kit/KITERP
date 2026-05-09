# ArT (Ask r Task) – Vendor Management Technical Specification

## 1. Overview

This document provides detailed technical implementation specifications for the Vendor Management & Multi-Tenancy module, covering Backend APIs (FastAPI/Python), Frontend (React), and Database schemas (PostgreSQL + MongoDB).

---

## 2. Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Backend** | Python 3.11+ / FastAPI | API services, business logic |
| **Frontend** | React 18 + Vite | Vendor dashboard, onboarding UI |
| **Primary DB** | PostgreSQL 15+ | Transactional data, relationships |
| **Document DB** | MongoDB 7+ | Flexible schemas, vendor settings, catalogs |
| **ORM** | SQLAlchemy 2.0 + Pydantic | Database operations, validation |
| **ODM** | Motor / Beanie | MongoDB async operations |
| **Cache** | Redis | Session, tenant context, rate limiting |
| **Search** | Elasticsearch | Product/service search across vendors |
| **File Storage** | AWS S3 / Cloudflare R2 | Documents, images, assets |
| **Queue** | Celery + Redis | Background jobs, notifications |
| **Auth** | JWT + OAuth2 | Authentication & authorization |

---

## 3. Backend Specification (FastAPI)

### 3.1 Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                    # FastAPI application entry
│   ├── config.py                  # Configuration settings
│   ├── database.py                # Database connections
│   │
│   ├── api/
│   │   ├── __init__.py
│   │   ├── deps.py                # Dependencies (auth, db sessions)
│   │   └── v1/
│   │       ├── __init__.py
│   │       ├── router.py          # Main API router
│   │       ├── vendors.py         # Vendor endpoints
│   │       ├── vendor_users.py    # Vendor user management
│   │       ├── vendor_products.py # Product management
│   │       ├── vendor_services.py # Service management
│   │       ├── catalog.py         # Public storefront APIs
│   │       └── admin.py           # Platform admin APIs
│   │
│   ├── core/
│   │   ├── __init__.py
│   │   ├── security.py            # JWT, password hashing
│   │   ├── permissions.py         # RBAC implementation
│   │   └── exceptions.py          # Custom exceptions
│   │
│   ├── middleware/
│   │   ├── __init__.py
│   │   ├── tenant.py              # Multi-tenancy middleware
│   │   ├── cors.py                # CORS configuration
│   │   └── rate_limit.py          # Rate limiting
│   │
│   ├── models/
│   │   ├── __init__.py
│   │   ├── vendor.py              # Vendor SQLAlchemy models
│   │   ├── vendor_user.py         # Vendor user models
│   │   ├── vendor_product.py      # Product models
│   │   ├── vendor_service.py      # Service models
│   │   └── user.py                # User model
│   │
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── vendor.py              # Vendor Pydantic schemas
│   │   ├── vendor_user.py         # Vendor user schemas
│   │   ├── vendor_product.py      # Product schemas
│   │   ├── vendor_service.py      # Service schemas
│   │   └── common.py              # Common schemas
│   │
│   ├── services/
│   │   ├── __init__.py
│   │   ├── vendor_service.py      # Vendor business logic
│   │   ├── document_service.py    # Document upload logic
│   │   ├── notification_service.py # Email/SMS notifications
│   │   └── file_service.py        # S3 file operations
│   │
│   ├── repositories/
│   │   ├── __init__.py
│   │   ├── vendor_repo.py         # Vendor data access
│   │   ├── product_repo.py        # Product data access
│   │   └── base.py                # Base repository
│   │
│   ├── mongo/
│   │   ├── __init__.py
│   │   ├── models.py              # MongoDB/Beanie models
│   │   └── repositories.py        # MongoDB repositories
│   │
│   └── utils/
│       ├── __init__.py
│       ├── slug.py                # Slug generation
│       └── validators.py          # Custom validators
│
├── alembic/                       # Database migrations
│   ├── versions/
│   └── env.py
│
├── tests/
│   ├── __init__.py
│   ├── conftest.py
│   └── api/
│       └── test_vendors.py
│
├── requirements.txt
├── alembic.ini
├── Dockerfile
└── docker-compose.yml
```

### 3.2 Core Configuration

```python
# app/config.py
from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "ArT API"
    DEBUG: bool = False
    API_V1_PREFIX: str = "/api/v1"
    BASE_DOMAIN: str = "kiterp.com"
    
    # Database
    DATABASE_URL: str
    DATABASE_POOL_SIZE: int = 20
    
    # MongoDB
    MONGODB_URL: str
    MONGODB_DB_NAME: str = "kiterp"
    
    # Redis
    REDIS_URL: str
    
    # JWT
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # AWS S3
    AWS_ACCESS_KEY_ID: str
    AWS_SECRET_ACCESS_KEY: str
    AWS_REGION: str = "ap-south-1"
    AWS_S3_BUCKET: str
    AWS_CLOUDFRONT_URL: Optional[str] = None
    
    # Email
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    FROM_EMAIL: str = "noreply@kiterp.com"
    
    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
```

### 3.3 Database Connection

```python
# app/database.py
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from redis import asyncio as aioredis
from app.config import settings

# PostgreSQL
engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=settings.DATABASE_POOL_SIZE,
    echo=settings.DEBUG,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

Base = declarative_base()


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


# MongoDB
mongo_client: AsyncIOMotorClient = None


async def connect_mongodb():
    global mongo_client
    mongo_client = AsyncIOMotorClient(settings.MONGODB_URL)
    
    # Initialize Beanie with document models
    from app.mongo.models import VendorSettings, VendorProduct, VendorAnalytics
    
    await init_beanie(
        database=mongo_client[settings.MONGODB_DB_NAME],
        document_models=[VendorSettings, VendorProduct, VendorAnalytics]
    )


async def close_mongodb():
    global mongo_client
    if mongo_client:
        mongo_client.close()


# Redis
redis_client: aioredis.Redis = None


async def connect_redis():
    global redis_client
    redis_client = await aioredis.from_url(
        settings.REDIS_URL,
        encoding="utf-8",
        decode_responses=True
    )


async def close_redis():
    global redis_client
    if redis_client:
        await redis_client.close()


async def get_redis() -> aioredis.Redis:
    return redis_client
```

### 3.4 Pydantic Schemas

```python
# app/schemas/vendor.py
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional, List
from datetime import datetime
from enum import Enum
import re


class BusinessType(str, Enum):
    INDIVIDUAL = "individual"
    PARTNERSHIP = "partnership"
    LLC = "llc"
    CORPORATION = "corporation"
    PROPRIETORSHIP = "proprietorship"


class VendorStatus(str, Enum):
    PENDING = "pending"
    UNDER_REVIEW = "under_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    SUSPENDED = "suspended"
    DEACTIVATED = "deactivated"


class VerificationStatus(str, Enum):
    PENDING = "pending"
    DOCUMENTS_SUBMITTED = "documents_submitted"
    VERIFIED = "verified"
    REJECTED = "rejected"


# ============== Address ==============

class AddressCreate(BaseModel):
    street_address: str = Field(..., min_length=5, max_length=500)
    city: str = Field(..., min_length=2, max_length=100)
    state: str = Field(..., min_length=2, max_length=100)
    postal_code: str = Field(..., min_length=4, max_length=20)
    country: str = Field(default="India", max_length=100)
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)


class AddressResponse(AddressCreate):
    pass


# ============== Vendor Create ==============

class VendorCreate(BaseModel):
    business_name: str = Field(..., min_length=2, max_length=255)
    display_name: str = Field(..., min_length=2, max_length=255)
    slug: str = Field(..., min_length=3, max_length=100)
    business_type: BusinessType
    industry: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = Field(None, max_length=2000)
    primary_email: EmailStr
    primary_phone: str = Field(..., min_length=10, max_length=20)
    owner_name: str = Field(..., min_length=2, max_length=255)
    address: AddressCreate

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, v: str) -> str:
        if not re.match(r"^[a-z0-9-]+$", v):
            raise ValueError("Slug must contain only lowercase letters, numbers, and hyphens")
        if v.startswith("-") or v.endswith("-"):
            raise ValueError("Slug cannot start or end with a hyphen")
        return v.lower()

    @field_validator("primary_phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        # Remove non-digits for validation
        digits = re.sub(r"\D", "", v)
        if len(digits) < 10:
            raise ValueError("Phone number must have at least 10 digits")
        return v


class VendorUpdate(BaseModel):
    display_name: Optional[str] = Field(None, min_length=2, max_length=255)
    description: Optional[str] = Field(None, max_length=2000)
    support_email: Optional[EmailStr] = None
    support_phone: Optional[str] = None
    logo_url: Optional[str] = None
    banner_url: Optional[str] = None


# ============== Vendor Response ==============

class VendorResponse(BaseModel):
    id: str
    business_name: str
    display_name: str
    slug: str
    subdomain: str
    business_type: BusinessType
    industry: str
    description: Optional[str]
    primary_email: str
    primary_phone: str
    support_email: Optional[str]
    support_phone: Optional[str]
    street_address: Optional[str]
    city: Optional[str]
    state: Optional[str]
    postal_code: Optional[str]
    country: str
    logo_url: Optional[str]
    banner_url: Optional[str]
    status: VendorStatus
    verification_status: VerificationStatus
    verified_at: Optional[datetime]
    activated_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class VendorListResponse(BaseModel):
    items: List[VendorResponse]
    total: int
    page: int
    size: int
    pages: int


# ============== Slug Check ==============

class SlugCheckRequest(BaseModel):
    slug: str = Field(..., min_length=3, max_length=100)


class SlugCheckResponse(BaseModel):
    available: bool
    suggestions: Optional[List[str]] = None
```

```python
# app/schemas/vendor_document.py
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum


class DocumentType(str, Enum):
    BUSINESS_REGISTRATION = "business_registration"
    TAX_ID = "tax_id"
    ID_PROOF = "id_proof"
    ADDRESS_PROOF = "address_proof"
    BANK_PROOF = "bank_proof"


class DocumentStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class DocumentUpload(BaseModel):
    document_type: DocumentType
    notes: Optional[str] = Field(None, max_length=500)


class DocumentResponse(BaseModel):
    id: str
    vendor_id: str
    document_type: DocumentType
    file_url: str
    file_name: str
    file_size: int
    mime_type: str
    status: DocumentStatus
    rejection_reason: Optional[str]
    reviewed_by: Optional[str]
    reviewed_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class DocumentReview(BaseModel):
    status: DocumentStatus
    rejection_reason: Optional[str] = Field(None, max_length=500)
```

```python
# app/schemas/bank_account.py
from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime
from enum import Enum
import re


class AccountType(str, Enum):
    SAVINGS = "savings"
    CURRENT = "current"


class BankAccountCreate(BaseModel):
    bank_name: str = Field(..., min_length=2, max_length=255)
    account_number: str = Field(..., min_length=8, max_length=20)
    account_holder_name: str = Field(..., min_length=2, max_length=255)
    ifsc_code: str = Field(..., min_length=11, max_length=11)
    account_type: AccountType = AccountType.SAVINGS
    is_primary: bool = True

    @field_validator("ifsc_code")
    @classmethod
    def validate_ifsc(cls, v: str) -> str:
        if not re.match(r"^[A-Z]{4}0[A-Z0-9]{6}$", v.upper()):
            raise ValueError("Invalid IFSC code format")
        return v.upper()

    @field_validator("account_number")
    @classmethod
    def validate_account_number(cls, v: str) -> str:
        if not v.isdigit():
            raise ValueError("Account number must contain only digits")
        return v


class BankAccountUpdate(BaseModel):
    is_primary: Optional[bool] = None


class BankAccountResponse(BaseModel):
    id: str
    vendor_id: str
    bank_name: str
    account_number: str  # Masked in response
    account_holder_name: str
    ifsc_code: str
    account_type: AccountType
    is_primary: bool
    is_verified: bool
    verified_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True
```

### 3.5 SQLAlchemy Models

```python
# app/models/vendor.py
from sqlalchemy import (
    Column, String, Text, Boolean, DateTime, Enum, 
    ForeignKey, JSON, Numeric, Index
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from geoalchemy2 import Geography
import uuid
from app.database import Base


class Vendor(Base):
    __tablename__ = "vendor"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Basic Info
    business_name = Column(String(255), nullable=False)
    display_name = Column(String(255), nullable=False)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    business_type = Column(String(50), nullable=False)
    industry = Column(String(100))
    description = Column(Text)
    
    # Contact
    primary_email = Column(String(255), nullable=False)
    primary_phone = Column(String(20), nullable=False)
    support_email = Column(String(255))
    support_phone = Column(String(20))
    
    # Address
    street_address = Column(Text)
    city = Column(String(100))
    state = Column(String(100))
    postal_code = Column(String(20))
    country = Column(String(100), default="India")
    location = Column(Geography(geometry_type="POINT", srid=4326))
    
    # Branding
    logo_url = Column(Text)
    banner_url = Column(Text)
    theme_config = Column(JSONB, default={})
    custom_css = Column(Text)
    
    # Subdomain/Domain
    subdomain = Column(String(100), unique=True, nullable=False, index=True)
    custom_domain = Column(String(255), unique=True)
    domain_verified = Column(Boolean, default=False)
    
    # Status
    status = Column(String(30), default="pending", index=True)
    verification_status = Column(String(30), default="pending")
    verified_at = Column(DateTime(timezone=True))
    rejection_reason = Column(Text)
    
    # Settings
    settings = Column(JSONB, default={
        "timezone": "Asia/Kolkata",
        "currency": "INR",
        "language": "en",
        "notifications": {"email": True, "sms": True, "push": True},
        "features": {"products": True, "services": True, "appointments": False}
    })
    
    # Business Hours
    business_hours = Column(JSONB, default={})
    
    # Social Links
    social_links = Column(JSONB, default={})
    
    # Plan
    plan_id = Column(UUID(as_uuid=True), ForeignKey("vendor_plan.id"))
    plan_expires_at = Column(DateTime(timezone=True))
    
    # Audit
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    activated_at = Column(DateTime(timezone=True))
    deactivated_at = Column(DateTime(timezone=True))

    # Relationships
    documents = relationship("VendorDocument", back_populates="vendor", cascade="all, delete-orphan")
    bank_accounts = relationship("VendorBankAccount", back_populates="vendor", cascade="all, delete-orphan")
    owners = relationship("VendorOwner", back_populates="vendor", cascade="all, delete-orphan")
    users = relationship("VendorUser", back_populates="vendor", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_vendor_status_created", "status", "created_at"),
    )


class VendorDocument(Base):
    __tablename__ = "vendor_document"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    document_type = Column(String(50), nullable=False)
    file_url = Column(Text, nullable=False)
    file_name = Column(String(255))
    file_size = Column(Numeric)
    mime_type = Column(String(100))
    status = Column(String(30), default="pending")
    rejection_reason = Column(Text)
    reviewed_by = Column(UUID(as_uuid=True), ForeignKey("user.id"))
    reviewed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    vendor = relationship("Vendor", back_populates="documents")

    __table_args__ = (
        Index("idx_vendor_document_vendor", "vendor_id"),
        Index("idx_vendor_document_status", "status"),
    )


class VendorBankAccount(Base):
    __tablename__ = "vendor_bank_account"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    bank_name = Column(String(255), nullable=False)
    account_number = Column(String(50), nullable=False)
    account_holder_name = Column(String(255), nullable=False)
    ifsc_code = Column(String(20), nullable=False)
    account_type = Column(String(30), default="savings")
    is_primary = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    verified_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    vendor = relationship("Vendor", back_populates="bank_accounts")

    __table_args__ = (
        Index("idx_vendor_bank_vendor", "vendor_id"),
    )


class VendorOwner(Base):
    __tablename__ = "vendor_owner"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("user.id"), nullable=False)
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    phone = Column(String(20))
    id_type = Column(String(50))  # aadhaar, pan, passport
    id_number = Column(String(100))
    designation = Column(String(100), default="Owner")
    is_primary = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    vendor = relationship("Vendor", back_populates="owners")
```

### 3.6 Tenant Middleware

```python
# app/middleware/tenant.py
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from typing import Optional
import json
from app.config import settings
from app.database import redis_client, AsyncSessionLocal
from app.repositories.vendor_repo import VendorRepository


class TenantMiddleware(BaseHTTPMiddleware):
    """
    Middleware to resolve tenant (vendor) from subdomain or custom domain.
    Injects vendor context into request state.
    """
    
    RESERVED_SUBDOMAINS = {
        "www", "api", "admin", "app", "mail", 
        "ftp", "cdn", "static", "assets", "docs"
    }
    
    async def dispatch(self, request: Request, call_next):
        # Extract host
        host = request.headers.get("host", "")
        
        # Parse subdomain or custom domain
        subdomain = self._extract_subdomain(host)
        custom_domain = self._extract_custom_domain(host)
        
        # Skip tenant resolution for reserved/main domain
        if not subdomain and not custom_domain:
            request.state.vendor = None
            request.state.vendor_id = None
            return await call_next(request)
        
        if subdomain and subdomain.lower() in self.RESERVED_SUBDOMAINS:
            request.state.vendor = None
            request.state.vendor_id = None
            return await call_next(request)
        
        # Resolve tenant
        try:
            vendor = await self._resolve_tenant(subdomain, custom_domain)
            
            if not vendor:
                raise HTTPException(status_code=404, detail="Vendor not found")
            
            if vendor.get("status") != "approved":
                raise HTTPException(status_code=403, detail="Vendor is not active")
            
            # Inject into request state
            request.state.vendor = vendor
            request.state.vendor_id = vendor.get("id")
            
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail="Error resolving tenant")
        
        return await call_next(request)
    
    def _extract_subdomain(self, host: str) -> Optional[str]:
        """Extract subdomain from host header."""
        host_without_port = host.split(":")[0]
        base_domain = settings.BASE_DOMAIN
        
        if host_without_port.endswith(base_domain):
            parts = host_without_port.replace(f".{base_domain}", "").split(".")
            if parts and parts[0]:
                return parts[0]
        
        return None
    
    def _extract_custom_domain(self, host: str) -> Optional[str]:
        """Extract custom domain if not our base domain."""
        host_without_port = host.split(":")[0]
        base_domain = settings.BASE_DOMAIN
        
        if not host_without_port.endswith(base_domain):
            return host_without_port
        
        return None
    
    async def _resolve_tenant(
        self, 
        subdomain: Optional[str], 
        custom_domain: Optional[str]
    ) -> Optional[dict]:
        """Resolve tenant from cache or database."""
        cache_key = f"tenant:{subdomain or custom_domain}"
        
        # Try cache first
        if redis_client:
            cached = await redis_client.get(cache_key)
            if cached:
                return json.loads(cached)
        
        # Query database
        async with AsyncSessionLocal() as session:
            repo = VendorRepository(session)
            vendor = await repo.find_by_subdomain_or_domain(subdomain, custom_domain)
            
            if vendor:
                vendor_dict = {
                    "id": str(vendor.id),
                    "slug": vendor.slug,
                    "subdomain": vendor.subdomain,
                    "status": vendor.status,
                    "settings": vendor.settings,
                }
                
                # Cache for 5 minutes
                if redis_client:
                    await redis_client.set(
                        cache_key, 
                        json.dumps(vendor_dict), 
                        ex=300
                    )
                
                return vendor_dict
        
        return None


def get_current_vendor(request: Request) -> Optional[dict]:
    """Dependency to get current vendor from request state."""
    return getattr(request.state, "vendor", None)


def get_current_vendor_id(request: Request) -> Optional[str]:
    """Dependency to get current vendor ID from request state."""
    return getattr(request.state, "vendor_id", None)
```

### 3.7 Vendor Service

```python
# app/services/vendor_service.py
from typing import Optional, List, Tuple
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status, UploadFile
import re
from slugify import slugify

from app.models.vendor import Vendor, VendorDocument, VendorBankAccount, VendorOwner
from app.schemas.vendor import VendorCreate, VendorUpdate, SlugCheckResponse
from app.schemas.vendor_document import DocumentType
from app.schemas.bank_account import BankAccountCreate
from app.repositories.vendor_repo import VendorRepository
from app.services.file_service import FileService
from app.core.events import event_emitter


class VendorService:
    def __init__(
        self, 
        db: AsyncSession,
        file_service: FileService
    ):
        self.db = db
        self.repo = VendorRepository(db)
        self.file_service = file_service
    
    # ============== Registration ==============
    
    async def register(
        self, 
        user_id: UUID, 
        data: VendorCreate
    ) -> Vendor:
        """Register a new vendor."""
        # Check slug availability
        if await self.repo.slug_exists(data.slug):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Slug is already taken"
            )
        
        # Generate subdomain
        subdomain = self._generate_subdomain(data.slug)
        
        # Create vendor
        vendor = Vendor(
            business_name=data.business_name,
            display_name=data.display_name,
            slug=data.slug,
            subdomain=subdomain,
            business_type=data.business_type.value,
            industry=data.industry,
            description=data.description,
            primary_email=data.primary_email,
            primary_phone=data.primary_phone,
            street_address=data.address.street_address,
            city=data.address.city,
            state=data.address.state,
            postal_code=data.address.postal_code,
            country=data.address.country,
            status="pending",
            verification_status="pending",
        )
        
        # Set location if provided
        if data.address.latitude and data.address.longitude:
            vendor.location = f"POINT({data.address.longitude} {data.address.latitude})"
        
        self.db.add(vendor)
        await self.db.flush()
        
        # Create vendor owner
        owner = VendorOwner(
            vendor_id=vendor.id,
            user_id=user_id,
            full_name=data.owner_name,
            email=data.primary_email,
            phone=data.primary_phone,
            is_primary=True,
        )
        self.db.add(owner)
        
        await self.db.commit()
        await self.db.refresh(vendor)
        
        # Emit event
        await event_emitter.emit("vendor.registered", {"vendor_id": str(vendor.id), "user_id": str(user_id)})
        
        return vendor
    
    async def check_slug_availability(self, slug: str) -> SlugCheckResponse:
        """Check if a slug is available and provide suggestions if not."""
        normalized_slug = slugify(slug, lowercase=True)
        exists = await self.repo.slug_exists(normalized_slug)
        
        if not exists:
            return SlugCheckResponse(available=True)
        
        # Generate suggestions
        suggestions = await self._generate_slug_suggestions(normalized_slug)
        return SlugCheckResponse(available=False, suggestions=suggestions)
    
    async def _generate_slug_suggestions(self, base_slug: str) -> List[str]:
        """Generate alternative slug suggestions."""
        suggestions = []
        suffixes = ["store", "shop", "hub", "mart", "online"]
        
        for suffix in suffixes:
            suggestion = f"{base_slug}-{suffix}"
            if not await self.repo.slug_exists(suggestion):
                suggestions.append(suggestion)
            if len(suggestions) >= 3:
                break
        
        # Add numbered suggestions if needed
        counter = 1
        while len(suggestions) < 3:
            suggestion = f"{base_slug}{counter}"
            if not await self.repo.slug_exists(suggestion):
                suggestions.append(suggestion)
            counter += 1
        
        return suggestions[:3]
    
    def _generate_subdomain(self, slug: str) -> str:
        """Generate subdomain from slug."""
        return slugify(slug, lowercase=True)
    
    # ============== Document Management ==============
    
    async def upload_document(
        self,
        vendor_id: UUID,
        document_type: DocumentType,
        file: UploadFile,
    ) -> VendorDocument:
        """Upload a verification document."""
        # Validate file
        allowed_types = ["image/jpeg", "image/png", "application/pdf"]
        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid file type. Allowed: JPEG, PNG, PDF"
            )
        
        # Check file size (max 10MB)
        contents = await file.read()
        if len(contents) > 10 * 1024 * 1024:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File too large. Maximum size is 10MB"
            )
        await file.seek(0)
        
        # Upload to S3
        file_url = await self.file_service.upload_file(
            file=file,
            folder=f"vendors/{vendor_id}/documents",
        )
        
        # Create document record
        document = VendorDocument(
            vendor_id=vendor_id,
            document_type=document_type.value,
            file_url=file_url,
            file_name=file.filename,
            file_size=len(contents),
            mime_type=file.content_type,
            status="pending",
        )
        
        self.db.add(document)
        await self.db.commit()
        await self.db.refresh(document)
        
        return document
    
    async def get_documents(self, vendor_id: UUID) -> List[VendorDocument]:
        """Get all documents for a vendor."""
        return await self.repo.get_documents(vendor_id)
    
    # ============== Bank Account ==============
    
    async def add_bank_account(
        self,
        vendor_id: UUID,
        data: BankAccountCreate,
    ) -> VendorBankAccount:
        """Add a bank account for vendor payouts."""
        # If setting as primary, unset other primary accounts
        if data.is_primary:
            await self.repo.unset_primary_bank_accounts(vendor_id)
        
        account = VendorBankAccount(
            vendor_id=vendor_id,
            bank_name=data.bank_name,
            account_number=data.account_number,
            account_holder_name=data.account_holder_name,
            ifsc_code=data.ifsc_code,
            account_type=data.account_type.value,
            is_primary=data.is_primary,
        )
        
        self.db.add(account)
        await self.db.commit()
        await self.db.refresh(account)
        
        return account
    
    async def get_bank_accounts(self, vendor_id: UUID) -> List[VendorBankAccount]:
        """Get all bank accounts for a vendor."""
        return await self.repo.get_bank_accounts(vendor_id)
    
    # ============== Status Management ==============
    
    async def submit_for_review(self, vendor_id: UUID) -> Vendor:
        """Submit vendor for admin review."""
        vendor = await self.repo.get_by_id(vendor_id)
        if not vendor:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Vendor not found"
            )
        
        # Validate required documents
        documents = await self.get_documents(vendor_id)
        required_types = {"business_registration", "tax_id", "id_proof"}
        uploaded_types = {d.document_type for d in documents}
        
        missing = required_types - uploaded_types
        if missing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Missing required documents: {', '.join(missing)}"
            )
        
        # Validate bank account
        bank_accounts = await self.get_bank_accounts(vendor_id)
        if not any(acc.is_primary for acc in bank_accounts):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Primary bank account is required"
            )
        
        # Update status
        vendor.status = "under_review"
        vendor.verification_status = "documents_submitted"
        await self.db.commit()
        await self.db.refresh(vendor)
        
        # Emit event
        await event_emitter.emit("vendor.submitted_for_review", {"vendor_id": str(vendor_id)})
        
        return vendor
    
    async def approve_vendor(
        self, 
        vendor_id: UUID, 
        admin_id: UUID
    ) -> Vendor:
        """Approve a vendor (admin only)."""
        vendor = await self.repo.get_by_id(vendor_id)
        if not vendor:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Vendor not found"
            )
        
        from datetime import datetime, timezone
        
        vendor.status = "approved"
        vendor.verification_status = "verified"
        vendor.verified_at = datetime.now(timezone.utc)
        vendor.activated_at = datetime.now(timezone.utc)
        
        await self.db.commit()
        await self.db.refresh(vendor)
        
        # Emit event for notifications
        await event_emitter.emit("vendor.approved", {
            "vendor_id": str(vendor_id),
            "admin_id": str(admin_id)
        })
        
        return vendor
    
    async def reject_vendor(
        self,
        vendor_id: UUID,
        admin_id: UUID,
        reason: str,
    ) -> Vendor:
        """Reject a vendor (admin only)."""
        vendor = await self.repo.get_by_id(vendor_id)
        if not vendor:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Vendor not found"
            )
        
        vendor.status = "rejected"
        vendor.verification_status = "rejected"
        vendor.rejection_reason = reason
        
        await self.db.commit()
        await self.db.refresh(vendor)
        
        # Emit event
        await event_emitter.emit("vendor.rejected", {
            "vendor_id": str(vendor_id),
            "admin_id": str(admin_id),
            "reason": reason
        })
        
        return vendor
    
    # ============== Lookup ==============
    
    async def get_by_id(self, vendor_id: UUID) -> Optional[Vendor]:
        """Get vendor by ID."""
        return await self.repo.get_by_id(vendor_id)
    
    async def get_by_user_id(self, user_id: UUID) -> Optional[Vendor]:
        """Get vendor by owner user ID."""
        return await self.repo.get_by_user_id(user_id)
    
    async def update(self, vendor_id: UUID, data: VendorUpdate) -> Vendor:
        """Update vendor profile."""
        vendor = await self.repo.get_by_id(vendor_id)
        if not vendor:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Vendor not found"
            )
        
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(vendor, field, value)
        
        await self.db.commit()
        await self.db.refresh(vendor)
        
        return vendor
```

### 3.8 API Endpoints

```python
# app/api/v1/vendors.py
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from uuid import UUID

from app.database import get_db
from app.api.deps import get_current_user, get_current_active_user
from app.models.user import User
from app.schemas.vendor import (
    VendorCreate, VendorUpdate, VendorResponse,
    SlugCheckRequest, SlugCheckResponse
)
from app.schemas.vendor_document import DocumentType, DocumentResponse, DocumentUpload
from app.schemas.bank_account import BankAccountCreate, BankAccountResponse
from app.services.vendor_service import VendorService
from app.services.file_service import FileService

router = APIRouter(prefix="/vendors", tags=["Vendors"])


def get_vendor_service(db: AsyncSession = Depends(get_db)) -> VendorService:
    file_service = FileService()
    return VendorService(db, file_service)


# ============== Public Endpoints ==============

@router.post("/register", response_model=VendorResponse, status_code=status.HTTP_201_CREATED)
async def register_vendor(
    data: VendorCreate,
    current_user: User = Depends(get_current_active_user),
    service: VendorService = Depends(get_vendor_service),
):
    """
    Register a new vendor.
    
    - Requires authenticated user
    - User becomes the vendor owner
    """
    vendor = await service.register(current_user.id, data)
    return vendor


@router.post("/check-slug", response_model=SlugCheckResponse)
async def check_slug_availability(
    data: SlugCheckRequest,
    service: VendorService = Depends(get_vendor_service),
):
    """
    Check if a slug is available for registration.
    
    - Returns availability status
    - Provides suggestions if slug is taken
    """
    return await service.check_slug_availability(data.slug)


# ============== Vendor Owner Endpoints ==============

@router.get("/me", response_model=VendorResponse)
async def get_my_vendor(
    current_user: User = Depends(get_current_active_user),
    service: VendorService = Depends(get_vendor_service),
):
    """Get current user's vendor profile."""
    vendor = await service.get_by_user_id(current_user.id)
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No vendor found for this user"
        )
    return vendor


@router.put("/me", response_model=VendorResponse)
async def update_my_vendor(
    data: VendorUpdate,
    current_user: User = Depends(get_current_active_user),
    service: VendorService = Depends(get_vendor_service),
):
    """Update current user's vendor profile."""
    vendor = await service.get_by_user_id(current_user.id)
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No vendor found for this user"
        )
    return await service.update(vendor.id, data)


# ============== Document Management ==============

@router.post("/me/documents", response_model=DocumentResponse)
async def upload_document(
    document_type: DocumentType = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    service: VendorService = Depends(get_vendor_service),
):
    """
    Upload a verification document.
    
    - Supported types: business_registration, tax_id, id_proof, address_proof
    - Allowed formats: JPEG, PNG, PDF
    - Maximum size: 10MB
    """
    vendor = await service.get_by_user_id(current_user.id)
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No vendor found for this user"
        )
    
    return await service.upload_document(vendor.id, document_type, file)


@router.get("/me/documents", response_model=List[DocumentResponse])
async def get_my_documents(
    current_user: User = Depends(get_current_active_user),
    service: VendorService = Depends(get_vendor_service),
):
    """Get all uploaded verification documents."""
    vendor = await service.get_by_user_id(current_user.id)
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No vendor found for this user"
        )
    
    return await service.get_documents(vendor.id)


# ============== Bank Account ==============

@router.post("/me/bank-account", response_model=BankAccountResponse)
async def add_bank_account(
    data: BankAccountCreate,
    current_user: User = Depends(get_current_active_user),
    service: VendorService = Depends(get_vendor_service),
):
    """Add a bank account for payouts."""
    vendor = await service.get_by_user_id(current_user.id)
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No vendor found for this user"
        )
    
    return await service.add_bank_account(vendor.id, data)


@router.get("/me/bank-accounts", response_model=List[BankAccountResponse])
async def get_bank_accounts(
    current_user: User = Depends(get_current_active_user),
    service: VendorService = Depends(get_vendor_service),
):
    """Get all bank accounts."""
    vendor = await service.get_by_user_id(current_user.id)
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No vendor found for this user"
        )
    
    return await service.get_bank_accounts(vendor.id)


# ============== Review Submission ==============

@router.post("/me/submit-review", response_model=VendorResponse)
async def submit_for_review(
    current_user: User = Depends(get_current_active_user),
    service: VendorService = Depends(get_vendor_service),
):
    """
    Submit vendor for admin review.
    
    Requirements:
    - All required documents uploaded
    - Primary bank account added
    """
    vendor = await service.get_by_user_id(current_user.id)
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No vendor found for this user"
        )
    
    return await service.submit_for_review(vendor.id)
```

### 3.9 Main Application

```python
# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import settings
from app.database import connect_mongodb, close_mongodb, connect_redis, close_redis
from app.middleware.tenant import TenantMiddleware
from app.api.v1.router import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await connect_mongodb()
    await connect_redis()
    yield
    # Shutdown
    await close_mongodb()
    await close_redis()


app = FastAPI(
    title=settings.APP_NAME,
    description="ArT (Ask r Task) API - Vendor Management Platform",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure properly in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Tenant Middleware
app.add_middleware(TenantMiddleware)

# API Routes
app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


@app.get("/")
async def root():
    return {
        "name": settings.APP_NAME,
        "version": "1.0.0",
        "docs": "/docs"
    }
```

### 3.10 Requirements

```txt
# requirements.txt

# FastAPI & Server
fastapi==0.109.0
uvicorn[standard]==0.27.0
python-multipart==0.0.6

# Database - PostgreSQL
sqlalchemy[asyncio]==2.0.25
asyncpg==0.29.0
alembic==1.13.1
geoalchemy2==0.14.3

# Database - MongoDB
motor==3.3.2
beanie==1.25.0

# Redis
redis==5.0.1

# Validation & Settings
pydantic==2.5.3
pydantic-settings==2.1.0
email-validator==2.1.0

# Authentication
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4

# AWS
boto3==1.34.23
aioboto3==12.3.0

# Utils
python-slugify==8.0.1
python-dateutil==2.8.2
httpx==0.26.0

# Background Tasks
celery==5.3.6

# Testing
pytest==7.4.4
pytest-asyncio==0.23.3
httpx==0.26.0
```

---

## 4. Frontend Specification (React + Vite)

### 4.1 Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | React 18 |
| Build Tool | Vite 5 |
| Language | TypeScript |
| Routing | React Router v6 |
| State | TanStack Query + Zustand |
| Forms | React Hook Form + Zod |
| Styling | Tailwind CSS + shadcn/ui |
| HTTP | Axios |

### 4.2 Project Structure

```
frontend/
├── public/
│   └── favicon.ico
├── src/
│   ├── main.tsx                    # Entry point
│   ├── App.tsx                     # Root component
│   ├── vite-env.d.ts
│   │
│   ├── api/
│   │   ├── client.ts               # Axios instance
│   │   ├── vendor.api.ts           # Vendor API calls
│   │   ├── product.api.ts          # Product API calls
│   │   ├── service.api.ts          # Service API calls
│   │   └── auth.api.ts             # Auth API calls
│   │
│   ├── components/
│   │   ├── ui/                     # shadcn/ui components
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── card.tsx
│   │   │   └── ...
│   │   │
│   │   ├── common/
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Loading.tsx
│   │   │   ├── ErrorBoundary.tsx
│   │   │   └── FileUploader.tsx
│   │   │
│   │   ├── vendor/
│   │   │   ├── OnboardingWizard.tsx
│   │   │   ├── SubdomainPicker.tsx
│   │   │   ├── DocumentUpload.tsx
│   │   │   ├── BankAccountForm.tsx
│   │   │   ├── VendorStatusBadge.tsx
│   │   │   └── VendorSidebar.tsx
│   │   │
│   │   ├── products/
│   │   │   ├── ProductForm.tsx
│   │   │   ├── ProductCard.tsx
│   │   │   ├── ProductTable.tsx
│   │   │   └── ProductFilters.tsx
│   │   │
│   │   └── services/
│   │       ├── ServiceForm.tsx
│   │       ├── ServiceCard.tsx
│   │       └── AvailabilityPicker.tsx
│   │
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useVendor.ts
│   │   ├── useProducts.ts
│   │   ├── useServices.ts
│   │   └── useTenant.ts
│   │
│   ├── layouts/
│   │   ├── AuthLayout.tsx
│   │   ├── DashboardLayout.tsx
│   │   ├── OnboardingLayout.tsx
│   │   └── StorefrontLayout.tsx
│   │
│   ├── pages/
│   │   ├── auth/
│   │   │   ├── Login.tsx
│   │   │   ├── Register.tsx
│   │   │   └── ForgotPassword.tsx
│   │   │
│   │   ├── onboarding/
│   │   │   ├── index.tsx           # Step 1: Basic Info
│   │   │   ├── Subdomain.tsx       # Step 2: Subdomain
│   │   │   ├── Address.tsx         # Step 3: Address
│   │   │   ├── Documents.tsx       # Step 4: Documents
│   │   │   ├── Banking.tsx         # Step 5: Banking
│   │   │   └── Review.tsx          # Step 6: Review
│   │   │
│   │   ├── dashboard/
│   │   │   ├── index.tsx           # Dashboard home
│   │   │   ├── Products.tsx
│   │   │   ├── ProductDetail.tsx
│   │   │   ├── Services.tsx
│   │   │   ├── ServiceDetail.tsx
│   │   │   ├── Orders.tsx
│   │   │   ├── Team.tsx
│   │   │   └── Settings.tsx
│   │   │
│   │   ├── storefront/
│   │   │   ├── Home.tsx
│   │   │   ├── Products.tsx
│   │   │   ├── ProductDetail.tsx
│   │   │   ├── Services.tsx
│   │   │   └── Cart.tsx
│   │   │
│   │   └── admin/
│   │       ├── Vendors.tsx
│   │       └── VendorDetail.tsx
│   │
│   ├── routes/
│   │   ├── index.tsx               # Route definitions
│   │   ├── ProtectedRoute.tsx
│   │   └── VendorRoute.tsx
│   │
│   ├── stores/
│   │   ├── authStore.ts            # Zustand auth store
│   │   ├── vendorStore.ts          # Vendor state
│   │   └── cartStore.ts            # Cart state
│   │
│   ├── types/
│   │   ├── vendor.ts
│   │   ├── product.ts
│   │   ├── service.ts
│   │   ├── user.ts
│   │   └── api.ts
│   │
│   ├── lib/
│   │   ├── utils.ts
│   │   └── validations/
│   │       ├── vendor.ts
│   │       └── product.ts
│   │
│   └── styles/
│       └── globals.css
│
├── index.html
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
├── package.json
└── .env
```

### 4.3 API Client Setup

```typescript
// src/api/client.ts
import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle errors
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config;
    
    // Handle 401 - Token expired
    if (error.response?.status === 401 && originalRequest) {
      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          const response = await axios.post(`${API_URL}/auth/refresh`, {
            refresh_token: refreshToken,
          });
          
          const { access_token } = response.data;
          localStorage.setItem('access_token', access_token);
          
          originalRequest.headers.Authorization = `Bearer ${access_token}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed - logout
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;
```

```typescript
// src/api/vendor.api.ts
import apiClient from './client';
import {
  Vendor,
  VendorCreate,
  VendorUpdate,
  VendorDocument,
  BankAccount,
  BankAccountCreate,
  SlugCheckResponse,
} from '@/types/vendor';

export const vendorApi = {
  // Registration
  register: async (data: VendorCreate): Promise<Vendor> => {
    const response = await apiClient.post('/vendors/register', data);
    return response.data;
  },

  checkSlug: async (slug: string): Promise<SlugCheckResponse> => {
    const response = await apiClient.post('/vendors/check-slug', { slug });
    return response.data;
  },

  // Profile
  getMyVendor: async (): Promise<Vendor> => {
    const response = await apiClient.get('/vendors/me');
    return response.data;
  },

  updateMyVendor: async (data: VendorUpdate): Promise<Vendor> => {
    const response = await apiClient.put('/vendors/me', data);
    return response.data;
  },

  // Documents
  uploadDocument: async (
    documentType: string,
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<VendorDocument> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('document_type', documentType);

    const response = await apiClient.post('/vendors/me/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (event) => {
        if (event.total && onProgress) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      },
    });
    return response.data;
  },

  getDocuments: async (): Promise<VendorDocument[]> => {
    const response = await apiClient.get('/vendors/me/documents');
    return response.data;
  },

  // Bank Account
  addBankAccount: async (data: BankAccountCreate): Promise<BankAccount> => {
    const response = await apiClient.post('/vendors/me/bank-account', data);
    return response.data;
  },

  getBankAccounts: async (): Promise<BankAccount[]> => {
    const response = await apiClient.get('/vendors/me/bank-accounts');
    return response.data;
  },

  // Submit for review
  submitForReview: async (): Promise<Vendor> => {
    const response = await apiClient.post('/vendors/me/submit-review');
    return response.data;
  },
};
```

### 4.4 React Hooks

```typescript
// src/hooks/useVendor.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vendorApi } from '@/api/vendor.api';
import { VendorCreate, VendorUpdate } from '@/types/vendor';
import { toast } from 'sonner';

export const vendorKeys = {
  all: ['vendor'] as const,
  me: () => [...vendorKeys.all, 'me'] as const,
  documents: () => [...vendorKeys.all, 'documents'] as const,
  bankAccounts: () => [...vendorKeys.all, 'bank-accounts'] as const,
};

export function useMyVendor() {
  return useQuery({
    queryKey: vendorKeys.me(),
    queryFn: vendorApi.getMyVendor,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
  });
}

export function useVendorDocuments() {
  return useQuery({
    queryKey: vendorKeys.documents(),
    queryFn: vendorApi.getDocuments,
  });
}

export function useBankAccounts() {
  return useQuery({
    queryKey: vendorKeys.bankAccounts(),
    queryFn: vendorApi.getBankAccounts,
  });
}

export function useRegisterVendor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: VendorCreate) => vendorApi.register(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vendorKeys.me() });
      toast.success('Vendor registered successfully!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Registration failed');
    },
  });
}

export function useUpdateVendor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: VendorUpdate) => vendorApi.updateMyVendor(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vendorKeys.me() });
      toast.success('Vendor updated successfully!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Update failed');
    },
  });
}

export function useUploadDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ documentType, file }: { documentType: string; file: File }) =>
      vendorApi.uploadDocument(documentType, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vendorKeys.documents() });
      toast.success('Document uploaded successfully!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Upload failed');
    },
  });
}

export function useAddBankAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: vendorApi.addBankAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vendorKeys.bankAccounts() });
      toast.success('Bank account added successfully!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to add bank account');
    },
  });
}

export function useSubmitForReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: vendorApi.submitForReview,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vendorKeys.me() });
      toast.success('Submitted for review!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Submission failed');
    },
  });
}

export function useCheckSlug() {
  return useMutation({
    mutationFn: (slug: string) => vendorApi.checkSlug(slug),
  });
}
```

### 4.5 Key Components

#### 4.5.1 Onboarding Wizard

```tsx
// src/components/vendor/OnboardingWizard.tsx
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle, Circle, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Step {
  id: string;
  title: string;
  description: string;
  path: string;
}

const steps: Step[] = [
  {
    id: 'basic',
    title: 'Basic Information',
    description: 'Business name, type, and contact',
    path: '/onboarding',
  },
  {
    id: 'subdomain',
    title: 'Choose Subdomain',
    description: 'Your unique store URL',
    path: '/onboarding/subdomain',
  },
  {
    id: 'address',
    title: 'Business Address',
    description: 'Location and address details',
    path: '/onboarding/address',
  },
  {
    id: 'documents',
    title: 'Verification Documents',
    description: 'Upload required documents',
    path: '/onboarding/documents',
  },
  {
    id: 'banking',
    title: 'Banking Details',
    description: 'Bank account for payouts',
    path: '/onboarding/banking',
  },
  {
    id: 'review',
    title: 'Review & Submit',
    description: 'Review and submit for approval',
    path: '/onboarding/review',
  },
];

interface OnboardingWizardProps {
  completedSteps: string[];
  children: React.ReactNode;
}

export function OnboardingWizard({ completedSteps, children }: OnboardingWizardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  
  const currentStep = steps.find(s => s.path === location.pathname)?.id || 'basic';

  const handleStepClick = (step: Step) => {
    const stepIndex = steps.findIndex(s => s.id === step.id);
    const currentIndex = steps.findIndex(s => s.id === currentStep);
    
    // Allow navigation to completed steps or next step
    if (completedSteps.includes(step.id) || stepIndex <= currentIndex + 1) {
      navigate(step.path);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Set Up Your Store</h1>
          <p className="text-gray-600 mt-2">
            Complete the following steps to launch your online store
          </p>
        </div>

        <div className="flex gap-8">
          {/* Steps Sidebar */}
          <div className="w-80 flex-shrink-0">
            <nav className="space-y-2">
              {steps.map((step, index) => {
                const isComplete = completedSteps.includes(step.id);
                const isCurrent = step.id === currentStep;
                const isAccessible =
                  isComplete || index <= steps.findIndex(s => s.id === currentStep) + 1;

                return (
                  <button
                    key={step.id}
                    onClick={() => handleStepClick(step)}
                    disabled={!isAccessible}
                    className={cn(
                      'w-full flex items-center gap-4 p-4 rounded-lg text-left transition-all',
                      isCurrent && 'bg-blue-50 border-2 border-blue-500',
                      isComplete && !isCurrent && 'bg-green-50',
                      !isComplete && !isCurrent && 'bg-white border border-gray-200',
                      !isAccessible && 'opacity-50 cursor-not-allowed',
                      isAccessible && !isCurrent && 'hover:bg-gray-50'
                    )}
                  >
                    <div
                      className={cn(
                        'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
                        isComplete && 'bg-green-500 text-white',
                        isCurrent && !isComplete && 'bg-blue-500 text-white',
                        !isComplete && !isCurrent && 'bg-gray-200 text-gray-600'
                      )}
                    >
                      {isComplete ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : (
                        <span className="text-sm font-medium">{index + 1}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          'font-medium',
                          isCurrent && 'text-blue-700',
                          isComplete && !isCurrent && 'text-green-700',
                          !isComplete && !isCurrent && 'text-gray-700'
                        )}
                      >
                        {step.title}
                      </p>
                      <p className="text-sm text-gray-500 truncate">{step.description}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Step Content */}
          <div className="flex-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

#### 4.5.2 Subdomain Picker

```tsx
// src/components/vendor/SubdomainPicker.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { debounce } from 'lodash-es';
import { CheckCircle, XCircle, Loader2, Globe } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useCheckSlug } from '@/hooks/useVendor';

const schema = z.object({
  slug: z
    .string()
    .min(3, 'Minimum 3 characters')
    .max(50, 'Maximum 50 characters')
    .regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers, and hyphens'),
});

type FormData = z.infer<typeof schema>;

interface SubdomainPickerProps {
  defaultValue?: string;
  onSelect: (slug: string) => void;
  baseDomain?: string;
}

export function SubdomainPicker({
  defaultValue = '',
  onSelect,
  baseDomain = 'kiterp.com',
}: SubdomainPickerProps) {
  const [availability, setAvailability] = useState<{
    available: boolean;
    suggestions?: string[];
  } | null>(null);

  const checkSlugMutation = useCheckSlug();

  const {
    register,
    watch,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { slug: defaultValue },
  });

  const slug = watch('slug');

  // Debounced availability check
  const debouncedCheck = useCallback(
    debounce(async (value: string) => {
      if (value.length < 3) {
        setAvailability(null);
        return;
      }

      const result = await checkSlugMutation.mutateAsync(value);
      setAvailability(result);
    }, 500),
    []
  );

  useEffect(() => {
    if (slug) {
      debouncedCheck(slug);
    } else {
      setAvailability(null);
    }
  }, [slug, debouncedCheck]);

  const onSubmit = (data: FormData) => {
    if (availability?.available) {
      onSelect(data.slug);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setValue('slug', suggestion);
  };

  const isChecking = checkSlugMutation.isPending;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Choose your store URL
        </label>

        {/* URL Preview */}
        <div className="flex items-center gap-2 p-4 bg-gray-50 rounded-lg border border-gray-200 mb-4">
          <Globe className="w-5 h-5 text-gray-400" />
          <span className="text-gray-500">https://</span>
          <span className="font-medium text-blue-600">{slug || 'your-store'}</span>
          <span className="text-gray-500">.{baseDomain}</span>
        </div>

        {/* Input */}
        <div className="relative">
          <Input
            {...register('slug')}
            placeholder="your-store-name"
            className="pr-10"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {isChecking && <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />}
            {!isChecking && availability?.available && (
              <CheckCircle className="w-5 h-5 text-green-500" />
            )}
            {!isChecking && availability && !availability.available && (
              <XCircle className="w-5 h-5 text-red-500" />
            )}
          </div>
        </div>

        {/* Error */}
        {errors.slug && (
          <p className="text-sm text-red-500 mt-1">{errors.slug.message}</p>
        )}

        {/* Availability Message */}
        {!isChecking && availability && (
          <div className="mt-2">
            {availability.available ? (
              <p className="text-sm text-green-600 flex items-center gap-1">
                <CheckCircle className="w-4 h-4" />
                This URL is available!
              </p>
            ) : (
              <div>
                <p className="text-sm text-red-600 flex items-center gap-1">
                  <XCircle className="w-4 h-4" />
                  This URL is already taken
                </p>

                {/* Suggestions */}
                {availability.suggestions && availability.suggestions.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm text-gray-600 mb-2">
                      Try one of these instead:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {availability.suggestions.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => handleSuggestionClick(suggestion)}
                          className="px-3 py-1 text-sm bg-blue-50 text-blue-700 rounded-full hover:bg-blue-100 transition-colors"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <Button
        type="submit"
        disabled={!availability?.available || isChecking}
        className="w-full"
      >
        Continue
      </Button>
    </form>
  );
}
```

#### 4.5.3 Document Upload

```tsx
// src/components/vendor/DocumentUpload.tsx
import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, CheckCircle, XCircle, Clock, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useUploadDocument } from '@/hooks/useVendor';
import { VendorDocument } from '@/types/vendor';
import { toast } from 'sonner';

interface DocumentUploadProps {
  documentType: string;
  title: string;
  description: string;
  required?: boolean;
  existingDocument?: VendorDocument;
  onUploadComplete?: (document: VendorDocument) => void;
}

export function DocumentUpload({
  documentType,
  title,
  description,
  required = false,
  existingDocument,
  onUploadComplete,
}: DocumentUploadProps) {
  const [uploadProgress, setUploadProgress] = useState(0);
  const uploadMutation = useUploadDocument();

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File too large. Maximum size is 10MB');
        return;
      }

      try {
        const document = await uploadMutation.mutateAsync({
          documentType,
          file,
        });
        onUploadComplete?.(document);
      } catch (error) {
        // Error handled by hook
      }
    },
    [documentType, uploadMutation, onUploadComplete]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg'],
      'application/pdf': ['.pdf'],
    },
    maxFiles: 1,
    disabled: uploadMutation.isPending,
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'rejected':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved':
        return 'Approved';
      case 'rejected':
        return 'Rejected';
      default:
        return 'Pending Review';
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-medium text-gray-900">
            {title}
            {required && <span className="text-red-500 ml-1">*</span>}
          </h4>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
        {existingDocument && (
          <div className="flex items-center gap-2">
            {getStatusIcon(existingDocument.status)}
            <span
              className={cn(
                'text-sm font-medium',
                existingDocument.status === 'approved' && 'text-green-600',
                existingDocument.status === 'rejected' && 'text-red-600',
                existingDocument.status === 'pending' && 'text-yellow-600'
              )}
            >
              {getStatusText(existingDocument.status)}
            </span>
          </div>
        )}
      </div>

      {existingDocument ? (
        <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
          <FileText className="w-10 h-10 text-gray-400" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 truncate">
              {existingDocument.file_name}
            </p>
            {existingDocument.status === 'rejected' &&
              existingDocument.rejection_reason && (
                <p className="text-sm text-red-600 mt-1">
                  Reason: {existingDocument.rejection_reason}
                </p>
              )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(existingDocument.file_url, '_blank')}
            >
              <Eye className="w-4 h-4" />
            </Button>
            {existingDocument.status !== 'approved' && (
              <div {...getRootProps()}>
                <input {...getInputProps()} />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={uploadMutation.isPending}
                >
                  Replace
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div
          {...getRootProps()}
          className={cn(
            'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
            isDragActive && 'border-blue-500 bg-blue-50',
            !isDragActive && 'border-gray-300 hover:border-gray-400',
            uploadMutation.isPending && 'pointer-events-none opacity-50'
          )}
        >
          <input {...getInputProps()} />

          {uploadMutation.isPending ? (
            <div className="space-y-3">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-sm text-gray-600">Uploading...</p>
            </div>
          ) : (
            <>
              <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">
                {isDragActive ? (
                  'Drop the file here'
                ) : (
                  <>
                    Drag & drop or{' '}
                    <span className="text-blue-600 font-medium">browse</span>
                  </>
                )}
              </p>
              <p className="text-sm text-gray-400 mt-1">PNG, JPG or PDF (max 10MB)</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
```

### 4.6 Routes Setup

```tsx
// src/routes/index.tsx
import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';

// Layouts
import AuthLayout from '@/layouts/AuthLayout';
import DashboardLayout from '@/layouts/DashboardLayout';
import OnboardingLayout from '@/layouts/OnboardingLayout';

// Auth Pages
import Login from '@/pages/auth/Login';
import Register from '@/pages/auth/Register';

// Onboarding Pages
import OnboardingBasic from '@/pages/onboarding';
import OnboardingSubdomain from '@/pages/onboarding/Subdomain';
import OnboardingAddress from '@/pages/onboarding/Address';
import OnboardingDocuments from '@/pages/onboarding/Documents';
import OnboardingBanking from '@/pages/onboarding/Banking';
import OnboardingReview from '@/pages/onboarding/Review';

// Dashboard Pages
import Dashboard from '@/pages/dashboard';
import Products from '@/pages/dashboard/Products';
import ProductDetail from '@/pages/dashboard/ProductDetail';
import Services from '@/pages/dashboard/Services';
import Orders from '@/pages/dashboard/Orders';
import Team from '@/pages/dashboard/Team';
import Settings from '@/pages/dashboard/Settings';

// Guards
import ProtectedRoute from './ProtectedRoute';
import VendorRoute from './VendorRoute';

export const router = createBrowserRouter([
  // Auth Routes
  {
    path: '/',
    element: <AuthLayout />,
    children: [
      { index: true, element: <Navigate to="/login" replace /> },
      { path: 'login', element: <Login /> },
      { path: 'register', element: <Register /> },
    ],
  },

  // Onboarding Routes
  {
    path: '/onboarding',
    element: (
      <ProtectedRoute>
        <OnboardingLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <OnboardingBasic /> },
      { path: 'subdomain', element: <OnboardingSubdomain /> },
      { path: 'address', element: <OnboardingAddress /> },
      { path: 'documents', element: <OnboardingDocuments /> },
      { path: 'banking', element: <OnboardingBanking /> },
      { path: 'review', element: <OnboardingReview /> },
    ],
  },

  // Dashboard Routes
  {
    path: '/dashboard',
    element: (
      <ProtectedRoute>
        <VendorRoute>
          <DashboardLayout />
        </VendorRoute>
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'products', element: <Products /> },
      { path: 'products/:id', element: <ProductDetail /> },
      { path: 'services', element: <Services /> },
      { path: 'orders', element: <Orders /> },
      { path: 'team', element: <Team /> },
      { path: 'settings', element: <Settings /> },
    ],
  },
]);
```

### 4.7 Package.json

```json
{
  "name": "art-vendor-frontend",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.21.0",
    "@tanstack/react-query": "^5.17.0",
    "zustand": "^4.4.7",
    "axios": "^1.6.5",
    "react-hook-form": "^7.49.2",
    "@hookform/resolvers": "^3.3.2",
    "zod": "^3.22.4",
    "react-dropzone": "^14.2.3",
    "lodash-es": "^4.17.21",
    "date-fns": "^3.2.0",
    "sonner": "^1.3.1",
    "lucide-react": "^0.303.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.0",
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-dropdown-menu": "^2.0.6",
    "@radix-ui/react-select": "^2.0.0",
    "@radix-ui/react-tabs": "^1.0.4",
    "@radix-ui/react-toast": "^1.1.5"
  },
  "devDependencies": {
    "@types/react": "^18.2.43",
    "@types/react-dom": "^18.2.17",
    "@types/lodash-es": "^4.17.12",
    "@typescript-eslint/eslint-plugin": "^6.14.0",
    "@typescript-eslint/parser": "^6.14.0",
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.16",
    "eslint": "^8.55.0",
    "eslint-plugin-react-hooks": "^4.6.0",
    "eslint-plugin-react-refresh": "^0.4.5",
    "postcss": "^8.4.32",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.2.2",
    "vite": "^5.0.8"
  }
}
```

---

## 5. Database Specification

### 5.1 PostgreSQL Schema

(Same as defined in VENDOR_MANAGEMENT_SPEC.md - see Section 4)

### 5.2 MongoDB Collections

(Same as defined previously - for flexible schemas like settings, products, analytics)

---

## 6. API Endpoint Summary

```
# Vendor Registration & Onboarding
POST   /api/v1/vendors/register              # Register new vendor
POST   /api/v1/vendors/check-slug            # Check slug availability
GET    /api/v1/vendors/me                    # Get my vendor profile
PUT    /api/v1/vendors/me                    # Update my vendor profile
POST   /api/v1/vendors/me/documents          # Upload verification document
GET    /api/v1/vendors/me/documents          # List my documents
POST   /api/v1/vendors/me/bank-account       # Add bank account
GET    /api/v1/vendors/me/bank-accounts      # List bank accounts
POST   /api/v1/vendors/me/submit-review      # Submit for admin review

# Vendor User Management
GET    /api/v1/vendors/me/users              # List vendor team members
POST   /api/v1/vendors/me/users/invite       # Invite team member
PUT    /api/v1/vendors/me/users/{id}         # Update team member
DELETE /api/v1/vendors/me/users/{id}         # Remove team member

# Products
GET    /api/v1/vendors/me/products           # List products
POST   /api/v1/vendors/me/products           # Create product
GET    /api/v1/vendors/me/products/{id}      # Get product
PUT    /api/v1/vendors/me/products/{id}      # Update product
DELETE /api/v1/vendors/me/products/{id}      # Delete product

# Services
GET    /api/v1/vendors/me/services           # List services
POST   /api/v1/vendors/me/services           # Create service
GET    /api/v1/vendors/me/services/{id}      # Get service
PUT    /api/v1/vendors/me/services/{id}      # Update service
DELETE /api/v1/vendors/me/services/{id}      # Delete service

# Public Catalog (Tenant-scoped)
GET    /api/v1/catalog/info                  # Get vendor info
GET    /api/v1/catalog/products              # List products
GET    /api/v1/catalog/products/{slug}       # Get product
GET    /api/v1/catalog/services              # List services
GET    /api/v1/catalog/services/{slug}       # Get service

# Platform Admin
GET    /api/v1/admin/vendors                 # List all vendors
GET    /api/v1/admin/vendors/{id}            # Get vendor details
PUT    /api/v1/admin/vendors/{id}/approve    # Approve vendor
PUT    /api/v1/admin/vendors/{id}/reject     # Reject vendor
```

---

## 7. Running the Application

### Backend (FastAPI)

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# or
.\venv\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements.txt

# Run migrations
alembic upgrade head

# Start server
uvicorn app.main:app --reload --port 8000
```

### Frontend (React + Vite)

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### Docker Compose (Full Stack)

```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql+asyncpg://postgres:postgres@postgres:5432/kiterp
      - MONGODB_URL=mongodb://mongo:27017
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - mongo
      - redis

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - VITE_API_URL=http://localhost:8000/api/v1

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: kiterp
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data

  mongo:
    image: mongo:7
    volumes:
      - mongo_data:/data/db

  redis:
    image: redis:7-alpine

volumes:
  postgres_data:
  mongo_data:
```

---

This specification now uses **Python FastAPI** for the backend and **React (Vite)** for the frontend, with PostgreSQL and MongoDB for databases.
