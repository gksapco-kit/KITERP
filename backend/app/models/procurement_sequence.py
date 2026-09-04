# app/models/procurement_sequence.py
"""
Per-tenant document number sequences for all procurement documents.

One row per (vendor_id, prefix).  Callers SELECT … FOR UPDATE to
guarantee gap-free, collision-free numbering under concurrent load.

Example prefixes: PR, PO, RFQ, SQ, GRN, PRET (purchase return).
"""
from sqlalchemy import Column, String, Integer, Index, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy import DateTime
import uuid

from app.database import Base


class DocumentSequence(Base):
    __tablename__ = "proc_document_sequence"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), nullable=False)
    prefix = Column(String(20), nullable=False)
    last_value = Column(Integer, nullable=False, default=0)
    width = Column(Integer, nullable=False, default=6)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("vendor_id", "prefix", name="uq_proc_seq_vendor_prefix"),
        Index("ix_proc_seq_vendor", "vendor_id"),
    )
