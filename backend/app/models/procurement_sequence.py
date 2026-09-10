# app/models/procurement_sequence.py
"""
Per-tenant document number sequences for all procurement documents.

One row per (vendor_id, store_scope, prefix).
  store_id = NULL  → vendor-wide default (store_scope = '')
  store_id = <uuid> → business-unit-specific override (store_scope = store_id::TEXT)

Callers SELECT … FOR UPDATE to guarantee gap-free, collision-free numbering.

Example prefixes: PR, PO, RFQ, SQ, GRN, GRNR, PRET (purchase return).
"""
from sqlalchemy import Column, String, Integer, Index, UniqueConstraint, ForeignKey, Computed
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy import DateTime
import uuid

from app.database import Base


class DocumentSequence(Base):
    __tablename__ = "proc_document_sequence"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id  = Column(UUID(as_uuid=True), nullable=False)
    # NULL = vendor-wide default; non-NULL = business-unit-specific override
    store_id   = Column(UUID(as_uuid=True), ForeignKey("store.id", ondelete="CASCADE"), nullable=True)
    prefix     = Column(String(20), nullable=False)

    # Range bounds (informational + enforced at API level)
    number_from = Column(Integer, nullable=False, default=1)
    number_to   = Column(Integer, nullable=False, default=999999)

    last_value = Column(Integer, nullable=False, default=0)
    width      = Column(Integer, nullable=False, default=6)

    # Generated column: COALESCE(store_id::TEXT, '') — used in unique constraint.
    # SQLAlchemy reads it as a regular column; it is never written by application code.
    store_scope = Column(
        String,
        Computed("COALESCE(store_id::TEXT, '')", persisted=True),
        nullable=False,
    )

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint(
            "vendor_id", "store_scope", "prefix",
            name="uq_proc_seq_vendor_scope_prefix",
        ),
        Index("ix_proc_seq_vendor", "vendor_id"),
    )
