# app/config.py
from functools import lru_cache
from pathlib import Path
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve `.env` next to the `backend/` folder so DATABASE_URL matches CLI scripts even when
# uvicorn is started from the repo root (relative ".env" would otherwise miss backend/.env).
_BACKEND_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "KIT ERP API"
    DEBUG: bool = False
    API_V1_PREFIX: str = "/api/v1"
    BASE_DOMAIN: str = "kiterp.com"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/kiterp"
    DATABASE_POOL_SIZE: int = 20

    # Redis
    REDIS_URL: str = "redis://localhost:6379"

    # JWT
    JWT_SECRET_KEY: str = "your-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # AWS S3
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "ap-south-1"
    AWS_S3_BUCKET: str = "kiterp-uploads"
    AWS_CLOUDFRONT_URL: Optional[str] = None

    # Email
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    FROM_EMAIL: str = "noreply@kiterp.com"
    # SendGrid HTTP API (preferred over SMTP in Docker). Falls back to SMTP_PASSWORD if it starts with SG.
    SENDGRID_API_KEY: str = ""
    # Twilio Verify → SendGrid dynamic template (set subject in SendGrid or run scripts/fix_sendgrid_otp_subject.py)
    SENDGRID_OTP_TEMPLATE_ID: str = "d-14f75148da1a4b7d8a1a5f8cf9f388a5"

    # Vendor dashboard login (localhost / generic host): scope to one business when the same
    # email exists on multiple User rows. Subdomain hosts still set vendor via TenantMiddleware.
    VENDOR_LOGIN_DEFAULT_SLUG: Optional[str] = None

    # When True, new vendors skip manual super-admin approval (status/verification set like approve_vendor).
    # Set to false if platform operators must review each signup.
    AUTO_APPROVE_NEW_VENDORS: bool = True

    # Razorpay (online payments on business front checkout)
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""
    RAZORPAY_WEBHOOK_SECRET: str = ""

    # Twilio — prefer Verify for OTP (works internationally); SMS fallback needs TWILIO_FROM_NUMBER
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_FROM_NUMBER: str = ""
    TWILIO_VERIFY_SERVICE_SID: str = ""

    model_config = SettingsConfigDict(
        env_file=str(_BACKEND_ROOT / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
