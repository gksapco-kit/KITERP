from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from uuid import UUID
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any

from app.database import get_db
from app.api.deps import get_current_active_user, require_permission
from app.models.user import User
from app.models.invoice_template import InvoiceTemplate
from app.services.vendor_service import VendorService

router = APIRouter(dependencies=[Depends(require_permission("documents.templates.manage"))])

DEFAULT_SECTIONS = {
    "show_logo": True,
    "show_header": True,
    "show_customer_details": True,
    "show_customer_gstin": True,
    "show_shipping_address": True,
    "show_bank_details": True,
    "show_signature": True,
    "show_tax_breakdown": True,
    "show_notes": True,
    "show_terms": True,
}


class InvoiceTemplateCreate(BaseModel):
    name: str = Field(..., max_length=255)
    sections: Optional[Dict[str, Any]] = None
    bank_details: Optional[Dict[str, Any]] = None
    signature_url: Optional[str] = None
    header_text: Optional[str] = None
    footer_text: Optional[str] = None
    terms_text: Optional[str] = None


class InvoiceTemplateUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    sections: Optional[Dict[str, Any]] = None
    bank_details: Optional[Dict[str, Any]] = None
    signature_url: Optional[str] = None
    header_text: Optional[str] = None
    footer_text: Optional[str] = None
    terms_text: Optional[str] = None


async def _vendor_id(user: User, db: AsyncSession) -> UUID:
    svc = VendorService(db)
    vendor = await svc.get_by_user_id(user.id)
    if not vendor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor not found")
    return vendor.id


def _template_dict(t: InvoiceTemplate) -> dict:
    return {
        "id": str(t.id),
        "vendor_id": str(t.vendor_id),
        "name": t.name,
        "is_default": t.is_default,
        "sections": t.sections or DEFAULT_SECTIONS,
        "bank_details": t.bank_details or {},
        "signature_url": t.signature_url,
        "header_text": t.header_text,
        "footer_text": t.footer_text,
        "terms_text": t.terms_text,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
    }


@router.get("")
async def list_templates(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    vendor_id = await _vendor_id(current_user, db)
    result = await db.execute(
        select(InvoiceTemplate)
        .where(InvoiceTemplate.vendor_id == vendor_id)
        .order_by(InvoiceTemplate.created_at.desc())
    )
    templates = result.scalars().all()
    return JSONResponse(content={"items": [_template_dict(t) for t in templates]})


@router.post("")
async def create_template(
    data: InvoiceTemplateCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    vendor_id = await _vendor_id(current_user, db)

    template = InvoiceTemplate(
        vendor_id=vendor_id,
        name=data.name,
        sections=data.sections or DEFAULT_SECTIONS,
        bank_details=data.bank_details or {},
        signature_url=data.signature_url,
        header_text=data.header_text,
        footer_text=data.footer_text,
        terms_text=data.terms_text,
    )

    existing = await db.execute(
        select(InvoiceTemplate).where(InvoiceTemplate.vendor_id == vendor_id)
    )
    if not existing.scalars().first():
        template.is_default = True

    db.add(template)
    await db.commit()
    await db.refresh(template)
    return JSONResponse(content=_template_dict(template), status_code=201)


@router.put("/{template_id}")
async def update_template(
    template_id: UUID,
    data: InvoiceTemplateUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    vendor_id = await _vendor_id(current_user, db)
    result = await db.execute(
        select(InvoiceTemplate).where(
            InvoiceTemplate.id == template_id,
            InvoiceTemplate.vendor_id == vendor_id,
        )
    )
    template = result.scalars().first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(template, key, value)

    await db.commit()
    await db.refresh(template)
    return JSONResponse(content=_template_dict(template))


@router.delete("/{template_id}")
async def delete_template(
    template_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    vendor_id = await _vendor_id(current_user, db)
    result = await db.execute(
        select(InvoiceTemplate).where(
            InvoiceTemplate.id == template_id,
            InvoiceTemplate.vendor_id == vendor_id,
        )
    )
    template = result.scalars().first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    was_default = template.is_default
    await db.delete(template)
    await db.commit()

    if was_default:
        result = await db.execute(
            select(InvoiceTemplate)
            .where(InvoiceTemplate.vendor_id == vendor_id)
            .order_by(InvoiceTemplate.created_at.asc())
            .limit(1)
        )
        next_template = result.scalars().first()
        if next_template:
            next_template.is_default = True
            await db.commit()

    return JSONResponse(content={"detail": "Template deleted"})


@router.post("/{template_id}/set-default")
async def set_default_template(
    template_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    vendor_id = await _vendor_id(current_user, db)
    result = await db.execute(
        select(InvoiceTemplate).where(
            InvoiceTemplate.id == template_id,
            InvoiceTemplate.vendor_id == vendor_id,
        )
    )
    template = result.scalars().first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    await db.execute(
        update(InvoiceTemplate)
        .where(InvoiceTemplate.vendor_id == vendor_id)
        .values(is_default=False)
    )
    template.is_default = True
    await db.commit()
    await db.refresh(template)
    return JSONResponse(content=_template_dict(template))
