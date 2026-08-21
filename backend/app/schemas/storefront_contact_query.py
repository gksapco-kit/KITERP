from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

_ALLOWED_SOURCES = {"talk_to_us", "website", "ads", "referral", "other", "platform_contact"}


class StorefrontContactQueryCreate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    first_name: Optional[str] = Field(None, max_length=80)
    last_name: Optional[str] = Field(None, max_length=80)
    title: Optional[str] = Field(None, max_length=120)
    company: Optional[str] = Field(None, max_length=200)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=40)
    message: str = Field(..., min_length=5, max_length=4000)
    source: Optional[str] = Field(None, max_length=80)
    hp_website: Optional[str] = Field(None, max_length=500)
    website: Optional[str] = Field(None, max_length=500)
    form_started_at: Optional[int] = None
    captcha_token: Optional[str] = Field(None, max_length=4000)

    @field_validator("name", "first_name", "last_name", "title", "company", "source", "phone")
    @classmethod
    def strip_optional(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        cleaned = v.strip()
        return cleaned or None

    @field_validator("message")
    @classmethod
    def strip_message(cls, v: str) -> str:
        return (v or "").strip()

    @field_validator("source")
    @classmethod
    def normalize_source(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return None
        key = v.strip().lower().replace(" ", "_")
        return key if key in _ALLOWED_SOURCES else "talk_to_us"

    @model_validator(mode="after")
    def require_name_and_contact(self):
        first = self.first_name or ""
        last = self.last_name or ""
        composed = " ".join(p for p in (first, last) if p).strip() or (self.name or "")
        if len(composed) < 2:
            raise ValueError("Provide your name")
        self.name = composed
        if not self.email and not self.phone:
            raise ValueError("Provide at least an email or phone number")
        return self


class StorefrontContactQueryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    vendor_id: UUID
    vendor_display_name: Optional[str] = None
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    message: str
    status: str
    created_at: Optional[datetime] = None


class StorefrontContactQueryListResponse(BaseModel):
    items: List[StorefrontContactQueryResponse]
    total: int
    page: int
    size: int
    pages: int


class StorefrontContactQueryStatusUpdate(BaseModel):
    status: str = Field(..., pattern=r"^(new|read|resolved)$")
