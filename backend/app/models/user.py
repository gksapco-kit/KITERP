# app/models/user.py
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
from app.database import Base


class User(Base):
    __tablename__ = "user"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Email/phone are not globally unique: the same contact may exist on different
    # vendors; team invite and auth resolve by vendor context + password where needed.
    email = Column(String(255), nullable=True, index=True)
    phone = Column(String(20), nullable=True, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    avatar_url = Column(String(500))
    is_email_verified = Column(Boolean, default=False)
    is_phone_verified = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    # Platform admin app (port 3000): "support" = help desk; full control uses is_superuser.
    platform_staff_role = Column(String(20), nullable=True, index=True)
    # Job function for support staff: sales | crm | consulting | relationship_manager | team_manager
    platform_staff_job_role = Column(String(32), nullable=True, index=True)
    platform_staff_manager_id = Column(
        UUID(as_uuid=True),
        ForeignKey("user.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    # OTP verification (used by email-resend, phone-OTP, and domain-deactivation flows)
    # Stored as "<purpose>:<code>" e.g. "domain-off:123456" — max 64 chars
    verification_code = Column(String(64), nullable=True)
    verification_code_expires_at = Column(DateTime(timezone=True), nullable=True)
    # HR portal one-time / temporary password shown to admin until employee logs in
    portal_temp_password = Column(String(100), nullable=True)
    portal_temp_password_expires_at = Column(DateTime(timezone=True), nullable=True)
    # Email-change flow (separate so an in-flight change doesn't clobber a normal
    # email/phone verification request)
    pending_email = Column(String(255), nullable=True)
    email_change_code = Column(String(6), nullable=True)
    email_change_expires_at = Column(DateTime(timezone=True), nullable=True)
    totp_secret = Column(String(64), nullable=True)
    is_2fa_enabled = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
