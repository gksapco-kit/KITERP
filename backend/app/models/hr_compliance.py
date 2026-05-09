"""Compliance Management — policies (with versioning + acknowledgements),
certifications tracking, and HR audit logs."""
from sqlalchemy import (
    Column, String, Text, Boolean, DateTime, Date,
    ForeignKey, Integer, UniqueConstraint, Index
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.database import Base


class Policy(Base):
    __tablename__ = "hr_policy"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)

    title = Column(String(200), nullable=False)
    category = Column(String(60))    # leave / conduct / it / pos / safety / pay
    summary = Column(Text)
    body = Column(Text)               # rich HTML
    version = Column(Integer, default=1)
    status = Column(String(20), default="draft")    # draft / published / archived
    effective_from = Column(Date)
    expires_on = Column(Date)
    requires_acknowledgement = Column(Boolean, default=True)
    audience = Column(String(40), default="all")    # all / department / designation
    audience_filter = Column(JSONB, default=dict)   # {"department_ids":[], "designation_ids":[]}
    attachment_url = Column(String(500))

    published_at = Column(DateTime(timezone=True))
    published_by = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="SET NULL"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    acknowledgements = relationship("PolicyAcknowledgement", back_populates="policy", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_hr_policy_vendor_status", "vendor_id", "status"),
    )


class PolicyAcknowledgement(Base):
    __tablename__ = "hr_policy_acknowledgement"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    policy_id = Column(UUID(as_uuid=True), ForeignKey("hr_policy.id", ondelete="CASCADE"), nullable=False, index=True)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("hr_employee_profile.id", ondelete="CASCADE"), nullable=False, index=True)
    policy_version = Column(Integer, default=1)
    acknowledged_at = Column(DateTime(timezone=True), server_default=func.now())
    ip_address = Column(String(45))
    notes = Column(Text)

    policy = relationship("Policy", back_populates="acknowledgements")

    __table_args__ = (
        UniqueConstraint("policy_id", "employee_id", "policy_version", name="uq_policy_ack_emp_version"),
    )


class ComplianceCertification(Base):
    __tablename__ = "hr_compliance_certification"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("hr_employee_profile.id", ondelete="CASCADE"), nullable=False, index=True)

    name = Column(String(200), nullable=False)
    type = Column(String(40))        # license / certification / training / clearance
    issued_by = Column(String(200))
    cert_number = Column(String(100))
    issued_on = Column(Date)
    expires_on = Column(Date)
    document_url = Column(String(500))
    notes = Column(Text)
    status = Column(String(20), default="active")   # active / expired / revoked

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_hr_cert_vendor_expiry", "vendor_id", "expires_on"),
    )


class ComplianceAuditLog(Base):
    __tablename__ = "hr_compliance_audit_log"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)

    actor_user_id = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="SET NULL"), nullable=True)
    actor_label = Column(String(200))
    action = Column(String(60), nullable=False)        # create / update / delete / publish / acknowledge / approve
    entity_type = Column(String(60), nullable=False)   # employee / payroll / policy / leave / etc
    entity_id = Column(UUID(as_uuid=True))
    summary = Column(String(400))
    diff = Column(JSONB, default=dict)                 # {field: [before, after]}
    ip_address = Column(String(45))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_hr_audit_vendor_when", "vendor_id", "created_at"),
        Index("ix_hr_audit_entity", "entity_type", "entity_id"),
    )
