# app/api/v1/vendor_customers.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field, EmailStr, model_validator
import math
import re
import logging
import httpx

from app.database import get_db
from app.api.deps import get_current_active_user
from app.models.user import User
from app.models.customer import Customer
from app.models.platform_setting import PlatformSetting
from app.services.vendor_service import VendorService
from app.repositories.customer_repo import CustomerRepository
from app.repositories.order_repo import OrderRepository
from app.utils.validators import validate_gstin

router = APIRouter()

_PAN_RE = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]$")

# ── Indian state code map (first 2 digits of GSTIN) ──────────────────────────
GSTIN_STATE_CODES: dict[str, str] = {
    "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab",
    "04": "Chandigarh", "05": "Uttarakhand", "06": "Haryana",
    "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar",
    "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland",
    "14": "Manipur", "15": "Mizoram", "16": "Tripura", "17": "Meghalaya",
    "18": "Assam", "19": "West Bengal", "20": "Jharkhand", "21": "Odisha",
    "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
    "26": "Dadra & Nagar Haveli and Daman & Diu", "27": "Maharashtra",
    "29": "Karnataka", "30": "Goa", "31": "Lakshadweep", "32": "Kerala",
    "33": "Tamil Nadu", "34": "Puducherry",
    "35": "Andaman & Nicobar Islands", "36": "Telangana",
    "37": "Andhra Pradesh", "38": "Ladakh", "97": "Other Territory",
}


async def _get_vendor(user: User, db: AsyncSession):
    service = VendorService(db)
    vendor = await service.get_by_user_id(user.id)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return vendor


async def _get_vendor_id(user: User, db: AsyncSession) -> UUID:
    vendor = await _get_vendor(user, db)
    return vendor.id


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class BillingAddress(BaseModel):
    street: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None


class VendorCreateCustomer(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=255)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=20)
    password: Optional[str] = Field(None, min_length=6, max_length=100)
    shipping_addresses: Optional[list] = None
    # GST / business
    gstin: Optional[str] = Field(None, max_length=15)
    pan_number: Optional[str] = Field(None, max_length=10)
    cin: Optional[str] = Field(None, max_length=21)
    company_name: Optional[str] = Field(None, max_length=255)
    billing_address: Optional[BillingAddress] = None
    notes: Optional[str] = None
    # Accounting
    opening_balance: Optional[float] = Field(None, ge=-9999999999.99, le=9999999999.99)
    # Bank
    bank_name: Optional[str] = Field(None, max_length=100)
    account_number: Optional[str] = Field(None, max_length=30)
    account_holder_name: Optional[str] = Field(None, max_length=255)
    account_type: Optional[str] = Field(None, pattern=r"^(savings|current)$")
    ifsc_code: Optional[str] = Field(None, max_length=15)

    @model_validator(mode="after")
    def require_email_or_phone(self):
        if not self.email and not self.phone:
            raise ValueError("Either email or phone is required")
        return self

    @model_validator(mode="after")
    def validate_gstin_and_pan(self):
        if self.gstin:
            self.gstin = self.gstin.upper().strip()
            ok, err = validate_gstin(self.gstin)
            if not ok:
                raise ValueError(err or "Invalid GSTIN format")
            if not self.pan_number:
                self.pan_number = self.gstin[2:12]
        if self.pan_number:
            self.pan_number = self.pan_number.upper().strip()
            if not _PAN_RE.match(self.pan_number):
                raise ValueError("Invalid PAN format (must be 10 chars, e.g. ABCDE1234F)")
        return self


class VendorUpdateCustomer(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=255)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=20)
    is_active: Optional[bool] = None
    shipping_addresses: Optional[list] = None
    # GST / business
    gstin: Optional[str] = Field(None, max_length=15)
    pan_number: Optional[str] = Field(None, max_length=10)
    cin: Optional[str] = Field(None, max_length=21)
    company_name: Optional[str] = Field(None, max_length=255)
    billing_address: Optional[BillingAddress] = None
    notes: Optional[str] = None
    # Accounting
    opening_balance: Optional[float] = Field(None, ge=-9999999999.99, le=9999999999.99)
    # Bank
    bank_name: Optional[str] = Field(None, max_length=100)
    account_number: Optional[str] = Field(None, max_length=30)
    account_holder_name: Optional[str] = Field(None, max_length=255)
    account_type: Optional[str] = Field(None, pattern=r"^(savings|current)$")
    ifsc_code: Optional[str] = Field(None, max_length=15)

    @model_validator(mode="after")
    def validate_gstin_and_pan(self):
        if self.gstin:
            self.gstin = self.gstin.upper().strip()
            ok, err = validate_gstin(self.gstin)
            if not ok:
                raise ValueError(err or "Invalid GSTIN format")
            if not self.pan_number:
                self.pan_number = self.gstin[2:12]
        if self.pan_number:
            self.pan_number = self.pan_number.upper().strip()
            if not _PAN_RE.match(self.pan_number):
                raise ValueError("Invalid PAN format (must be 10 chars, e.g. ABCDE1234F)")
        return self


def _customer_dict(customer: Customer) -> dict:
    return {
        "id": str(customer.id),
        "vendor_id": str(customer.vendor_id),
        "full_name": customer.full_name,
        "email": customer.email,
        "phone": customer.phone,
        "is_active": customer.is_active,
        "total_orders": customer.total_orders or 0,
        "total_spent": float(customer.total_spent or 0),
        "gstin": customer.gstin,
        "pan_number": customer.pan_number,
        "cin": customer.cin,
        "company_name": customer.company_name,
        "billing_address": customer.billing_address or {},
        "shipping_addresses": customer.shipping_addresses or [],
        "notes": customer.notes,
        "opening_balance": float(customer.opening_balance or 0),
        "bank_name": customer.bank_name,
        "account_number": customer.account_number,
        "account_holder_name": customer.account_holder_name,
        "account_type": customer.account_type,
        "ifsc_code": customer.ifsc_code,
        "created_at": customer.created_at.isoformat() if customer.created_at else None,
        "updated_at": customer.updated_at.isoformat() if customer.updated_at else None,
    }


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/gst-lookup")
async def gst_lookup(
    gstin: str = Query(..., min_length=15, max_length=15),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Validate a GSTIN and return extracted fields (offline) plus optional
    full party details via GSTINCheck API (requires gst_api_key in vendor settings).
    """
    gstin = gstin.upper().strip()
    ok, err = validate_gstin(gstin)
    if not ok:
        raise HTTPException(status_code=400, detail=err or "Invalid GSTIN format")

    # Offline extraction (always available, zero cost)
    state_code = gstin[:2]
    state = GSTIN_STATE_CODES.get(state_code, "")
    pan = gstin[2:12]

    result: dict = {
        "gstin": gstin,
        "pan_number": pan,
        "state_code": state_code,
        "state": state,
        "api_fetched": False,
        "trade_name": None,
        "legal_name": None,
        # Structured address dict -- always present so frontend can spread safely
        "address": {"street": None, "city": None, "state": state, "pincode": None},
        "status": None,
        "taxpayer_type": None,
        "registration_date": None,
    }

    # Optional: live API lookup via GSTINCheck.co.in
    # Priority: per-vendor key in vendor.settings > global platform key
    vendor = await _get_vendor(current_user, db)
    gst_api_key = None
    if vendor.settings and isinstance(vendor.settings, dict):
        gst_api_key = (
            vendor.settings.get("gst_api_key")
            or vendor.settings.get("gstincheck_api_key")
        )
    if not gst_api_key:
        # Fall back to the platform-level key set by admin
        platform_row = await db.get(PlatformSetting, "gst_api_key")
        if platform_row and platform_row.value:
            gst_api_key = platform_row.value

    if gst_api_key:
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(
                    f"https://sheet.gstincheck.co.in/check/{gst_api_key}/{gstin}"
                )
            if resp.status_code == 200:
                data = resp.json()
                if data.get("flag") is True and data.get("data"):
                    d = data["data"]

                    # GSTINCheck returns address in pradr.addr (structured) or pradr.adr (string)
                    pradr = d.get("pradr", {})
                    addr_obj = pradr.get("addr") or {}
                    # Build structured address from individual components
                    street_parts = [
                        addr_obj.get("bnm", ""),   # building name
                        addr_obj.get("flno", ""),   # floor number
                        addr_obj.get("bno", ""),    # building number
                        addr_obj.get("st", ""),     # street
                    ]
                    street = ", ".join(p for p in street_parts if p).strip(", ") or None
                    city = addr_obj.get("loc") or addr_obj.get("dst") or None
                    addr_state = GSTIN_STATE_CODES.get(gstin[:2], "") or addr_obj.get("stcd") or None
                    pincode = str(addr_obj.get("pncd", "")).strip() or None
                    # Fallback: parse the flat adr string if structured fields missing
                    if not street and not city:
                        flat_adr = pradr.get("adr", "") or ""
                        parts = [p.strip() for p in flat_adr.split(",") if p.strip()]
                        street = parts[0] if parts else None
                        city = parts[-2] if len(parts) >= 2 else None

                    result.update({
                        "api_fetched": True,
                        "trade_name": d.get("tradeNam") or d.get("tradeName") or None,
                        "legal_name": d.get("lgnm") or d.get("legalName") or None,
                        "address": {
                            "street": street,
                            "city": city,
                            "state": addr_state,
                            "pincode": pincode,
                        },
                        "status": d.get("sts") or d.get("status") or None,
                        "taxpayer_type": d.get("dty") or d.get("dtyp") or None,
                        "registration_date": d.get("rgdt") or d.get("regDate") or None,
                    })
        except Exception:
            # API failed -- return offline result silently
            pass

    return result


@router.get("")
async def list_customers(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=10000),
    search: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    vendor_id = await _get_vendor_id(current_user, db)
    repo = CustomerRepository(db)
    skip = (page - 1) * size
    items, total = await repo.list_by_vendor(vendor_id=vendor_id, skip=skip, limit=size, search=search)
    return {
        "items": [_customer_dict(c) for c in items],
        "total": total,
        "page": page,
        "size": size,
        "pages": math.ceil(total / size) if total > 0 else 0,
    }


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_customer(
    data: VendorCreateCustomer,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    vendor_id = await _get_vendor_id(current_user, db)
    repo = CustomerRepository(db)

    if data.email:
        existing = await repo.get_by_vendor_and_email(vendor_id, data.email)
        if existing:
            raise HTTPException(status_code=409, detail="A customer with this email already exists")

    if data.phone:
        existing_phone = await repo.get_by_vendor_and_phone(vendor_id, data.phone)
        if existing_phone:
            raise HTTPException(status_code=409, detail="A customer with this phone number already exists")

    # Duplicate GSTIN check
    if data.gstin:
        dup = await db.execute(
            select(Customer).where(Customer.vendor_id == vendor_id, Customer.gstin == data.gstin)
        )
        if dup.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="A customer with this GSTIN already exists")

    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    raw_password = data.password or data.phone or "Welcome@123"
    password_hash = pwd_context.hash(raw_password)

    customer = Customer(
        vendor_id=vendor_id,
        full_name=data.full_name,
        email=data.email,
        phone=data.phone,
        password_hash=password_hash,
        shipping_addresses=data.shipping_addresses or [],
        is_active=True,
        gstin=data.gstin,
        pan_number=data.pan_number,
        cin=data.cin,
        company_name=data.company_name,
        billing_address=data.billing_address.model_dump() if data.billing_address else {},
        notes=data.notes,
        opening_balance=data.opening_balance or 0,
        bank_name=data.bank_name,
        account_number=data.account_number,
        account_holder_name=data.account_holder_name,
        account_type=data.account_type or "savings",
        ifsc_code=data.ifsc_code,
    )
    db.add(customer)
    try:
        await db.commit()
        await db.refresh(customer)
        try:
            from app.services.crm.services import ContactService
            await ContactService(db).ensure_from_customer(vendor_id, customer)
        except Exception:
            logging.getLogger(__name__).exception(
                "CRM contact sync failed for customer %s", customer.id,
            )
        return JSONResponse(status_code=201, content=_customer_dict(customer))
    except IntegrityError as exc:
        await db.rollback()
        msg = str(exc).lower()
        if "email" in msg:
            raise HTTPException(status_code=409, detail="A customer with this email already exists")
        if "phone" in msg:
            raise HTTPException(status_code=409, detail="A customer with this phone number already exists")
        raise HTTPException(status_code=409, detail="A customer with this information already exists")


@router.put("/{customer_id}")
async def update_customer(
    customer_id: UUID,
    data: VendorUpdateCustomer,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    vendor_id = await _get_vendor_id(current_user, db)
    repo = CustomerRepository(db)
    customer = await repo.get_by_vendor_and_id(vendor_id, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    if data.full_name is not None:
        customer.full_name = data.full_name
    if data.email is not None:
        dup = await repo.get_by_vendor_and_email(vendor_id, data.email)
        if dup and dup.id != customer.id:
            raise HTTPException(status_code=409, detail="Email already in use by another customer")
        customer.email = data.email
    if data.phone is not None:
        customer.phone = data.phone
    if data.is_active is not None:
        customer.is_active = data.is_active
    if data.shipping_addresses is not None:
        customer.shipping_addresses = data.shipping_addresses
    if data.gstin is not None:
        # Duplicate check for GSTIN change
        if data.gstin != customer.gstin:
            dup_g = await db.execute(
                select(Customer).where(Customer.vendor_id == vendor_id, Customer.gstin == data.gstin)
            )
            if dup_g.scalar_one_or_none():
                raise HTTPException(status_code=409, detail="A customer with this GSTIN already exists")
        customer.gstin = data.gstin
    if data.pan_number is not None:
        customer.pan_number = data.pan_number
    if data.cin is not None:
        customer.cin = data.cin
    if data.company_name is not None:
        customer.company_name = data.company_name
    if data.billing_address is not None:
        customer.billing_address = data.billing_address.model_dump()
    if data.notes is not None:
        customer.notes = data.notes
    if data.opening_balance is not None:
        customer.opening_balance = data.opening_balance
    if data.bank_name is not None:
        customer.bank_name = data.bank_name
    if data.account_number is not None:
        customer.account_number = data.account_number
    if data.account_holder_name is not None:
        customer.account_holder_name = data.account_holder_name
    if data.account_type is not None:
        customer.account_type = data.account_type
    if data.ifsc_code is not None:
        customer.ifsc_code = data.ifsc_code

    await db.commit()
    await db.refresh(customer)
    try:
        from app.services.crm.services import ContactService
        await ContactService(db).ensure_from_customer(vendor_id, customer)
    except Exception:
        logging.getLogger(__name__).exception(
            "CRM contact sync failed for customer %s", customer.id,
        )
    return _customer_dict(customer)


@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_customer(
    customer_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    vendor_id = await _get_vendor_id(current_user, db)
    repo = CustomerRepository(db)
    customer = await repo.get_by_vendor_and_id(vendor_id, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    try:
        await db.delete(customer)
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Cannot delete customer — they have orders or other linked records",
        )


@router.get("/{customer_id}")
async def get_customer(
    customer_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    vendor_id = await _get_vendor_id(current_user, db)
    repo = CustomerRepository(db)
    customer = await repo.get_by_vendor_and_id(vendor_id, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return _customer_dict(customer)
