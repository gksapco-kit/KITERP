from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

_ALLOWED_SOURCES = {"website", "ads", "referral", "other", "talk_to_us"}


class PlatformLeadCreate(BaseModel):
    first_name: Optional[str] = Field(None, max_length=80)
    last_name: Optional[str] = Field(None, max_length=80)
    title: Optional[str] = Field(None, max_length=120)
    company: Optional[str] = Field(None, max_length=200)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=40)
    notes: Optional[str] = Field(None, max_length=4000)
    source: Optional[str] = Field(None, max_length=80)
    force: bool = Field(
        False,
        description="Create even when a matching lead already exists.",
    )

    @field_validator("first_name", "last_name", "title", "company", "notes", "source", "phone")
    @classmethod
    def strip_optional(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        cleaned = v.strip()
        return cleaned or None

    @field_validator("source")
    @classmethod
    def normalize_source(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return None
        key = v.strip().lower()
        return key if key in _ALLOWED_SOURCES else "website"

    @model_validator(mode="after")
    def require_identity(self):
        if not self.first_name and not self.last_name and not self.email and not self.phone:
            raise ValueError("Provide a name, email, or phone number")
        return self


class PlatformLeadLookup(BaseModel):
    """Partial identity for live duplicate checks while the visitor types."""
    first_name: Optional[str] = Field(None, max_length=80)
    last_name: Optional[str] = Field(None, max_length=80)
    email: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=40)

    @field_validator("first_name", "last_name", "email", "phone")
    @classmethod
    def strip_optional(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        cleaned = v.strip()
        return cleaned or None
