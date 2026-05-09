from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request, UploadFile, File
from fastapi.responses import JSONResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm.attributes import flag_modified
from uuid import UUID
import math, uuid, aiofiles
from pathlib import Path

from app.database import get_db
from app.api.deps import get_current_active_user
from app.models.user import User
from app.models.vendor import Vendor
from app.services.vendor_service import VendorService
from app.services.invoice_service import InvoiceService
from app.schemas.invoice import InvoiceCreate, InvoiceUpdate, RecordPayment
from app.utils.pdf_generator import generate_invoice_pdf

UPLOAD_DIR = Path("/app/uploads")

router = APIRouter()


async def _vendor_id(current_user: User = Depends(get_current_active_user), db: AsyncSession = Depends(get_db)) -> UUID:
    svc = VendorService(db)
    vendor = await svc.get_by_user_id(current_user.id)
    if not vendor:
        raise HTTPException(404, "No vendor found")
    return vendor.id


def _inv_dict(inv) -> dict:
    return {
        "id": str(inv.id), "vendor_id": str(inv.vendor_id),
        "customer_id": str(inv.customer_id) if inv.customer_id else None,
        "order_id": str(inv.order_id) if inv.order_id else None,
        "order_number": getattr(inv, "order_number", None),
        "booking_id": str(inv.booking_id) if getattr(inv, "booking_id", None) else None,
        "booking_number": getattr(inv, "booking_number", None),
        "invoice_number": inv.invoice_number, "invoice_type": inv.invoice_type,
        "document_type": inv.document_type,
        "customer_name": inv.customer_name, "customer_email": inv.customer_email,
        "customer_phone": inv.customer_phone, "customer_gstin": inv.customer_gstin,
        "billing_address": inv.billing_address, "shipping_address": inv.shipping_address,
        "vendor_name": inv.vendor_name, "vendor_gstin": inv.vendor_gstin,
        "items": inv.items or [], "item_count": inv.item_count or 0,
        "subtotal": float(inv.subtotal or 0), "discount_amount": float(inv.discount_amount or 0),
        "taxable_amount": float(inv.taxable_amount or 0),
        "cgst_amount": float(inv.cgst_amount or 0), "sgst_amount": float(inv.sgst_amount or 0),
        "igst_amount": float(inv.igst_amount or 0), "total_tax": float(inv.total_tax or 0),
        "round_off": float(inv.round_off or 0), "total": float(inv.total or 0),
        "amount_paid": float(inv.amount_paid or 0), "balance_due": float(inv.balance_due or 0),
        "financial_year": inv.financial_year, "status": inv.status,
        "due_date": str(inv.due_date) if inv.due_date else None,
        "payment_terms": inv.payment_terms,
        "is_gst": inv.is_gst, "place_of_supply": inv.place_of_supply,
        "is_inter_state": inv.is_inter_state,
        "notes": inv.notes, "terms_and_conditions": inv.terms_and_conditions,
        "reference_invoice_id": str(inv.reference_invoice_id) if inv.reference_invoice_id else None,
        "converted_from_id": str(inv.converted_from_id) if inv.converted_from_id else None,
        "created_by": str(inv.created_by) if inv.created_by else None,
        "created_at": inv.created_at.isoformat() if inv.created_at else None,
        "updated_at": inv.updated_at.isoformat() if inv.updated_at else None,
    }


@router.get("")
async def list_invoices(
    invoice_type: str = None, status: str = None,
    page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100),
    vid: UUID = Depends(_vendor_id), db: AsyncSession = Depends(get_db),
):
    svc = InvoiceService(db)
    items, total = await svc.list_invoices(vid, invoice_type, status, page, size)
    return JSONResponse(content={
        "items": [_inv_dict(i) for i in items], "total": total,
        "page": page, "size": size, "pages": math.ceil(total / size) if total else 0,
    })


@router.post("", status_code=201)
async def create_invoice(data: InvoiceCreate, user: User = Depends(get_current_active_user), vid: UUID = Depends(_vendor_id), db: AsyncSession = Depends(get_db)):
    svc = InvoiceService(db)
    try:
        payload = data.model_dump()
        payload["items"] = [i.model_dump() for i in data.items]
        inv = await svc.create_invoice(vid, payload, user.id)
        return JSONResponse(content=_inv_dict(inv), status_code=201)
    except ValueError as e:
        raise HTTPException(400, str(e))


# ── Invoice Settings ─────────────────────────────────────────────────────────
# IMPORTANT: These /settings routes MUST be declared before /{invoice_id} routes.
# FastAPI matches routes in registration order; if /{invoice_id} comes first,
# a request to /settings would be captured with invoice_id="settings" and then
# UUID("settings") would raise ValueError.

@router.get("/settings")
async def get_invoice_settings(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    svc = VendorService(db)
    vendor = await svc.get_by_user_id(current_user.id)
    if not vendor:
        raise HTTPException(404, "Vendor not found")
    settings = vendor.settings or {}
    return JSONResponse(content=settings.get("invoice_settings", {}))


@router.put("/settings")
async def update_invoice_settings(
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    data = await request.json()
    svc = VendorService(db)
    vendor = await svc.get_by_user_id(current_user.id)
    if not vendor:
        raise HTTPException(404, "Vendor not found")
    result = await db.execute(select(Vendor).where(Vendor.id == vendor.id))
    db_vendor = result.scalar_one_or_none()
    if not db_vendor:
        raise HTTPException(404, "Vendor record not found")
    current_settings = dict(db_vendor.settings or {})
    current_settings["invoice_settings"] = data
    db_vendor.settings = current_settings
    flag_modified(db_vendor, "settings")
    await db.commit()
    return JSONResponse(content=data)


@router.post("/settings/signature")
async def upload_invoice_signature(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a signature image for use on invoices."""
    svc = VendorService(db)
    vendor = await svc.get_by_user_id(current_user.id)
    if not vendor:
        raise HTTPException(404, "Vendor not found")

    allowed_types = {"image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"}
    if file.content_type not in allowed_types:
        raise HTTPException(400, "Only image files are allowed for signature")

    contents = await file.read()
    if len(contents) > 2 * 1024 * 1024:
        raise HTTPException(400, "Signature image must be under 2 MB")

    ext = (file.filename or "sig.png").rsplit(".", 1)[-1].lower()
    filename = f"{uuid.uuid4().hex}.{ext}"
    folder = UPLOAD_DIR / "vendor-signatures"
    folder.mkdir(parents=True, exist_ok=True)
    filepath = folder / filename
    async with aiofiles.open(str(filepath), "wb") as f:
        await f.write(contents)

    url = f"/uploads/vendor-signatures/{filename}"

    result = await db.execute(select(Vendor).where(Vendor.id == vendor.id))
    db_vendor = result.scalar_one_or_none()
    current_settings = dict(db_vendor.settings or {})
    inv_settings = dict(current_settings.get("invoice_settings", {}))
    inv_settings["signature_url"] = url
    current_settings["invoice_settings"] = inv_settings
    db_vendor.settings = current_settings
    flag_modified(db_vendor, "settings")
    await db.commit()
    return JSONResponse(content={"signature_url": url})


# ── Per-invoice routes ────────────────────────────────────────────────────────
# These wildcard routes must come AFTER all fixed-path routes above.

@router.get("/by-order/{order_id}")
async def get_invoice_by_order(order_id: str, vid: UUID = Depends(_vendor_id), db: AsyncSession = Depends(get_db)):
    svc = InvoiceService(db)
    inv = await svc.get_by_order_id(UUID(order_id), vid)
    if not inv:
        raise HTTPException(404, "No invoice found for this order")
    return JSONResponse(content=_inv_dict(inv))


@router.get("/{invoice_id}/pdf")
async def download_invoice_pdf(invoice_id: str, vid: UUID = Depends(_vendor_id), db: AsyncSession = Depends(get_db)):
    """Generate and return a downloadable PDF for the given invoice."""
    svc = InvoiceService(db)
    inv = await svc.get_invoice(UUID(invoice_id), vid)
    if not inv:
        raise HTTPException(404, "Invoice not found")
    try:
        pdf_bytes = generate_invoice_pdf(inv)
    except Exception as e:
        raise HTTPException(500, f"PDF generation failed: {e}")
    safe_number = (inv.invoice_number or invoice_id).replace("/", "-")
    filename = f"{safe_number}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{invoice_id}")
async def get_invoice(invoice_id: str, vid: UUID = Depends(_vendor_id), db: AsyncSession = Depends(get_db)):
    svc = InvoiceService(db)
    try:
        inv = await svc.get_invoice(UUID(invoice_id), vid)
    except ValueError:
        raise HTTPException(400, f"Invalid invoice ID: {invoice_id!r}")
    if not inv:
        raise HTTPException(404, "Invoice not found")
    return JSONResponse(content=_inv_dict(inv))


@router.put("/{invoice_id}")
async def update_invoice(invoice_id: str, data: InvoiceUpdate, vid: UUID = Depends(_vendor_id), db: AsyncSession = Depends(get_db)):
    svc = InvoiceService(db)
    try:
        payload = data.model_dump(exclude_unset=True)
        if data.items:
            payload["items"] = [i.model_dump() for i in data.items]
        inv = await svc.update_invoice(UUID(invoice_id), vid, payload)
        return JSONResponse(content=_inv_dict(inv))
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/{invoice_id}/payment")
async def record_payment(invoice_id: str, data: RecordPayment, vid: UUID = Depends(_vendor_id), db: AsyncSession = Depends(get_db)):
    svc = InvoiceService(db)
    try:
        inv = await svc.record_payment(UUID(invoice_id), vid, data.amount)
        return JSONResponse(content=_inv_dict(inv))
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/{estimate_id}/convert", status_code=201)
async def convert_estimate(estimate_id: str, user: User = Depends(get_current_active_user), vid: UUID = Depends(_vendor_id), db: AsyncSession = Depends(get_db)):
    svc = InvoiceService(db)
    try:
        inv = await svc.convert_estimate_to_invoice(UUID(estimate_id), vid, user.id)
        return JSONResponse(content=_inv_dict(inv), status_code=201)
    except ValueError as e:
        raise HTTPException(400, str(e))
