from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator


class StorefrontContactQueryCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=40)
    message: str = Field(..., min_length=5, max_length=4000)

    @field_validator("name", "message")
    @classmethod
    def strip_required(cls, v: str) -> str:
        return (v or "").strip()

    @field_validator("phone")
    @classmethod
    def strip_phone(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        cleaned = v.strip()
        return cleaned or None

    @model_validator(mode="after")
    def require_email_or_phone(self):
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
