# app/schemas/user.py
from pydantic import BaseModel, EmailStr, Field, model_validator
from typing import Optional
from datetime import datetime


class UserCreate(BaseModel):
    email: Optional[EmailStr] = None
    password: str = Field(..., min_length=8, max_length=100)
    full_name: str = Field(..., min_length=2, max_length=255)
    phone: Optional[str] = Field(None, min_length=10, max_length=20)

    @model_validator(mode="after")
    def require_email_or_phone(self):
        if not self.email and not self.phone:
            raise ValueError("Either email or phone is required")
        return self


class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=255)
    phone: Optional[str] = Field(None, min_length=10, max_length=20)
    avatar_url: Optional[str] = None


class UserResponse(BaseModel):
    """User response - all fields are JSON-safe types (str, not UUID)."""
    id: str
    email: Optional[str] = None
    full_name: str
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    is_email_verified: bool
    is_phone_verified: bool
    is_active: bool
    is_superuser: bool = False
    platform_staff_role: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: Optional[str] = None
    email: Optional[str] = None


class LoginRequest(BaseModel):
    login: str = Field(..., min_length=3, description="Email address or phone number")
    password: str = Field(..., min_length=1)
