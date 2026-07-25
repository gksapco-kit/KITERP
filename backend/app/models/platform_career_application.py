"""Student / career applications from the platform Careers page."""
from sqlalchemy import Column, String, Text, DateTime, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid

from app.database import Base


class PlatformCareerApplication(Base):
    __tablename__ = "platform_career_application"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    phone = Column(String(40), nullable=True)
    college = Column(String(255), nullable=True)
    course = Column(String(255), nullable=True)
    graduation_year = Column(Integer, nullable=True)
    city = Column(String(120), nullable=True)
    linkedin_url = Column(String(500), nullable=True)
    cover_note = Column(Text, nullable=True)
    cv_url = Column(String(500), nullable=True)
    cv_filename = Column(String(255), nullable=True)
    photo_url = Column(String(500), nullable=True)
    photo_filename = Column(String(255), nullable=True)
    # Optional link to an open HR job posting (Recruitment → Jobs).
    job_posting_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    position_title = Column(String(200), nullable=True)
    status = Column(String(20), nullable=False, default="new")  # new | reviewed | shortlisted | rejected
    ip_address = Column(String(64), nullable=True)
    user_agent = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
