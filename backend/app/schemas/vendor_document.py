# app/schemas/vendor_document.py
from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


class DocumentType(str, Enum):
    BUSINESS_REGISTRATION = "business_registration"
    TAX_ID = "tax_id"
    ID_PROOF = "id_proof"
    ADDRESS_PROOF = "address_proof"
    BANK_PROOF = "bank_proof"


class DocumentStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class DocumentUpload(BaseModel):
    document_type: DocumentType
    notes: Optional[str] = Field(None, max_length=500)


class DocumentResponse(BaseModel):
    id: str
    vendor_id: str
    document_type: DocumentType
    file_url: str
    file_name: Optional[str] = None
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    status: DocumentStatus
    rejection_reason: Optional[str] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[str] = None
    created_at: Optional[str] = None


class DocumentReview(BaseModel):
    status: DocumentStatus
    rejection_reason: Optional[str] = Field(None, max_length=500)
