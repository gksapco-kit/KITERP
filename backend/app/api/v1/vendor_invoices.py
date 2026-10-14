from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request, UploadFile, File
from fastapi.responses import JSONResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm.attributes import flag_modified
from uuid import UUID
import logging, math, re, uuid

from app.database import get_db
from app.api.deps import get_current_active_user, require_permission
from app.models.user import User
from app.models.vendor import Vendor
from app.services.vendor_service import VendorService
from app.services.invoice_service import InvoiceService
from app.schemas.invoice import InvoiceCreate, InvoiceUpdate, RecordPayment
from app.services.invoice_pdf import render_invoice_pdf
from app.services.media_upload import delete_stored_file
from app.services.document_assets import is_document_asset
from app.utils.document_settings import IMAGE_KEYS, MAX_SETTINGS_BYTES, sanitize_document_settings

_SETTINGS_BLOB_KEYS = ("invoice_settings", "quotation_settings", "pos_receipt_settings")


def _image_refs(blob) -> set:
    """Stored-file URLs referenced by a settings blob (inline data: URLs are not files)."""
    if not isinstance(blob, dict):
        return set()
    return {
        v for k, v in blob.items()
        if k in IMAGE_KEYS and isinstance(v, str) and v and not v.startswith("data:")
    }


async def _delete_orphaned_assets(removed: set, all_settings: dict, vendor: Vendor) -> None:
    """Delete template images that no saved settings (or the company logo) reference any more.

    The POS blob can reuse the invoice signature/logo, so a file is only removed when it is
    unreferenced across invoice, quotation AND POS settings.
    """
    still_used = {vendor.logo_url} if vendor.logo_url else set()
    for blob_key in _SETTINGS_BLOB_KEYS:
        still_used |= _image_refs(all_settings.get(blob_key))
    for url in removed - still_used:
        if is_document_asset(url):
            await delete_stored_file(url)

router = APIRouter(dependencies=[Depends(require_permission("invoices.view"))])

# Changing document templates / settings needs more than read access.
_require_manage = Depends(require_permission("invoices.manage"))

async def _read_settings_body(request: Request) -> dict:
    """Parse + validate a settings JSON body (size-capped, sanitised)."""
    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > MAX_SETTINGS_BYTES + 64 * 1024:
        raise HTTPException(413, "Settings payload too large")
    try:
        data = await request.json()
    except Exception:
        raise HTTPException(422, "Request body must be valid JSON")
    return sanitize_document_settings(data, strict=True)


async def _locked_vendor(db: AsyncSession, user: User) -> Vendor:
    """Load the current user's Vendor row with a row lock so concurrent settings
    saves (invoice / quotation / signature / other modules) can't overwrite each other."""
    vendor = await VendorService(db).get_by_user_id(user.id)
    if not vendor:
        raise HTTPException(404, "Vendor not found")
    result = await db.execute(
        select(Vendor).where(Vendor.id == vendor.id).with_for_update().execution_options(populate_existing=True)
    )
    db_vendor = result.scalar_one_or_none()
    if not db_vendor:
        raise HTTPException(404, "Vendor record not found")
    return db_vendor


async def _vendor_id(current_user: User = Depends(get_current_active_user), db: AsyncSession = Depends(get_db)) -> UUID:
    svc = VendorService(db)
    vendor = await svc.get_by_user_id(current_user.id)
    if not vendor:
        raise HTTPException(404, "No vendor found")
    return vendor.id


def _inv_dict(inv) -> dict:
    return {
        "id": str(inv.id), "vendor_id": str(inv.vendor_id),
        "store_id": str(inv.store_id) if getattr(inv, "store_id", None) else None,
        "customer_id": str(inv.customer_id) if inv.customer_id else None,
        "sales_area_id": str(inv.sales_area_id) if getattr(inv, "sales_area_id", None) else None,
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
        "extra_fields": getattr(inv, "extra_fields", None) or [],
        "reference_invoice_id": str(inv.reference_invoice_id) if inv.reference_invoice_id else None,
        "converted_from_id": str(inv.converted_from_id) if inv.converted_from_id else None,
        "created_by": str(inv.created_by) if inv.created_by else None,
        "created_at": inv.created_at.isoformat() if inv.created_at else None,
        "updated_at": inv.updated_at.isoformat() if inv.updated_at else None,
    }


@router.get("")
async def list_invoices(
    invoice_type: str = None,
    exclude_invoice_type: str = None,
    status: str = None,
    store_id: str = None,
    sales_area_id: str = None,
    search: str = None,
    customer_id: str = None,
    open_only: bool = Query(False),
    page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=1000),
    vid: UUID = Depends(_vendor_id), db: AsyncSession = Depends(get_db),
):
    svc = InvoiceService(db)
    items, total = await svc.list_invoices(
        vid, invoice_type, exclude_invoice_type, status, page, size,
        store_id=store_id, search=search, sales_area_id=sales_area_id,
        customer_id=customer_id, open_only=open_only,
    )
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
        if data.extra_fields is not None:
            payload["extra_fields"] = [f.model_dump() for f in data.extra_fields]
        inv = await svc.create_invoice(vid, payload, user.id)
        return JSONResponse(content=_inv_dict(inv), status_code=201)
    except ValueError as e:
        raise HTTPException(400, str(e))


# ── Invoice Settings ─────────────────────────────────────────────────────────
# IMPORTANT: These /settings routes MUST be declared before /{invoice_id} routes.
# FastAPI matches routes in registration order; if /{invoice_id} comes first,
# a request to /settings would be captured with invoice_id="settings" and then
# UUID("settings") would raise ValueError.

def _stored_settings(vendor: Vendor, key: str) -> dict:
    """Read a settings blob, re-sanitising legacy data saved before validation existed."""
    return sanitize_document_settings((vendor.settings or {}).get(key, {}), strict=False)


async def _save_settings_blob(db: AsyncSession, user: User, key: str, data: dict) -> dict:
    db_vendor = await _locked_vendor(db, user)
    current_settings = dict(db_vendor.settings or {})
    removed = _image_refs(current_settings.get(key)) - _image_refs(data)
    current_settings[key] = data
    db_vendor.settings = current_settings
    flag_modified(db_vendor, "settings")
    await db.commit()
    if removed:
        await _delete_orphaned_assets(removed, current_settings, db_vendor)
    return data


@router.get("/settings")
async def get_invoice_settings(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    vendor = await VendorService(db).get_by_user_id(current_user.id)
    if not vendor:
        raise HTTPException(404, "Vendor not found")
    return JSONResponse(content=_stored_settings(vendor, "invoice_settings"))


@router.put("/settings", dependencies=[_require_manage])
async def update_invoice_settings(
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    data = await _read_settings_body(request)
    return JSONResponse(content=await _save_settings_blob(db, current_user, "invoice_settings", data))


@router.get("/settings/quotation")
async def get_quotation_settings(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    vendor = await VendorService(db).get_by_user_id(current_user.id)
    if not vendor:
        raise HTTPException(404, "Vendor not found")
    return JSONResponse(content=_stored_settings(vendor, "quotation_settings"))


@router.put("/settings/quotation", dependencies=[_require_manage])
async def update_quotation_settings(
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    data = await _read_settings_body(request)
    return JSONResponse(content=await _save_settings_blob(db, current_user, "quotation_settings", data))


# POS receipt overrides: merged on top of invoice_settings for POS sales. Stored per vendor
# on the server (not per browser) so every terminal and reprint uses the same template.
@router.get("/settings/pos")
async def get_pos_receipt_settings(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    vendor = await VendorService(db).get_by_user_id(current_user.id)
    if not vendor:
        raise HTTPException(404, "Vendor not found")
    return JSONResponse(content=_stored_settings(vendor, "pos_receipt_settings"))


@router.put("/settings/pos", dependencies=[_require_manage])
async def update_pos_receipt_settings(
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    data = await _read_settings_body(request)
    return JSONResponse(content=await _save_settings_blob(db, current_user, "pos_receipt_settings", data))


# ── Per-invoice routes ────────────────────────────────────────────────────────
# These wildcard routes must come AFTER all fixed-path routes above.

@router.get("/lookup")
async def lookup_invoice(
    number: str = Query(..., min_length=1),
    invoice_type: str = None,
    vid: UUID = Depends(_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    svc = InvoiceService(db)
    inv = await svc.get_by_number(vid, number, invoice_type=invoice_type or None)
    if not inv:
        raise HTTPException(404, "Invoice not found")
    return JSONResponse(content=_inv_dict(inv))


@router.get("/by-order/{order_id}")
async def get_invoice_by_order(order_id: str, vid: UUID = Depends(_vendor_id), db: AsyncSession = Depends(get_db)):
    svc = InvoiceService(db)
    inv = await svc.get_by_order_id(UUID(order_id), vid)
    if not inv:
        raise HTTPException(404, "No invoice found for this order")
    return JSONResponse(content=_inv_dict(inv))


@router.get("/{invoice_id}/pdf")
async def download_invoice_pdf(invoice_id: UUID, vid: UUID = Depends(_vendor_id), db: AsyncSession = Depends(get_db)):
    """Generate and return a downloadable PDF for the given invoice."""
    svc = InvoiceService(db)
    inv = await svc.get_invoice(invoice_id, vid)
    if not inv:
        raise HTTPException(404, "Invoice not found")
    try:
        pdf_bytes = await render_invoice_pdf(db, inv)
    except Exception:
        logging.getLogger(__name__).exception("PDF generation failed for invoice %s", invoice_id)
        raise HTTPException(500, "PDF generation failed. Please try again or contact support.")
    safe_number = re.sub(r"[^A-Za-z0-9._-]+", "-", str(inv.invoice_number or invoice_id))
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
        if data.extra_fields is not None:
            payload["extra_fields"] = [f.model_dump() for f in data.extra_fields]
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
