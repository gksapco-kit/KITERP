# app/api/v1/vendor_customers.py
import asyncio
import math
import re
import logging
import httpx
from datetime import date
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, EmailStr, model_validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.core.security import get_password_hash
from app.database import AsyncSessionLocal, get_db
from app.services.sms_service import normalize_e164, is_valid_e164
from app.api.deps import get_current_active_user, require_permission
from app.models.user import User
from app.models.customer import Customer
from app.models.platform_setting import PlatformSetting
from app.services.vendor_service import VendorService
from app.repositories.customer_repo import CustomerRepository
from app.repositories.order_repo import OrderRepository
from app.utils.validators import validate_gstin

router = APIRouter(dependencies=[Depends(require_permission("customers.view"))])
_log = logging.getLogger(__name__)

_PAN_RE = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]$")


def _normalize_customer_phone(raw: Optional[str]) -> Optional[str]:
    if not raw or not str(raw).strip():
        return None
    phone = normalize_e164(str(raw).strip())
    if not is_valid_e164(phone):
        raise HTTPException(
            status_code=422,
            detail="Enter a valid mobile number (e.g. 9703200341 or +919703200341)",
        )
    return phone


def _normalize_customer_email(raw: Optional[str]) -> Optional[str]:
    if not raw or not str(raw).strip():
        return None
    return str(raw).strip().lower()


async def _sync_crm_contact_after_customer(vendor_id: UUID, customer_id: UUID) -> None:
    """Best-effort CRM sync in a fresh session so create responses are not delayed."""
    from app.services.crm.services import ContactService

    async with AsyncSessionLocal() as db:
        customer = await db.get(Customer, customer_id)
        if not customer:
            return
        try:
            await ContactService(db).ensure_from_customer(vendor_id, customer)
        except Exception:
            _log.exception("CRM contact sync failed for customer %s", customer_id)

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
    wholesale_license_number: Optional[str] = Field(None, max_length=80)
    wholesale_license_expires: Optional[str] = None  # YYYY-MM-DD
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
    linked_customer_id: Optional[UUID] = None
    # Pricing group — drives which "party" price rules apply at checkout/POS
    # (retail, wholesale, distributor, agent, dealer, vip, employee, institutional, government, custom).
    customer_group: Optional[str] = Field(None, max_length=50)

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
    wholesale_license_number: Optional[str] = Field(None, max_length=80)
    wholesale_license_expires: Optional[str] = None  # YYYY-MM-DD
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
    customer_group: Optional[str] = Field(None, max_length=50)

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
        "customer_group": customer.customer_group or "retail",
        "linked_customer_id": str(customer.linked_customer_id) if customer.linked_customer_id else None,
        "is_active": customer.is_active,
        "total_orders": customer.total_orders or 0,
        "total_spent": float(customer.total_spent or 0),
        "gstin": customer.gstin,
        "pan_number": customer.pan_number,
        "cin": customer.cin,
        "company_name": customer.company_name,
        "wholesale_license_number": getattr(customer, "wholesale_license_number", None),
        "wholesale_license_expires": (
            customer.wholesale_license_expires.isoformat()
            if getattr(customer, "wholesale_license_expires", None)
            else None
        ),
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
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    vendor_id = await _get_vendor_id(current_user, db)
    repo = CustomerRepository(db)

    email = _normalize_customer_email(str(data.email) if data.email else None)
    phone = _normalize_customer_phone(data.phone)

    if not email and not phone:
        raise HTTPException(status_code=422, detail="Either email or phone is required")

    linked_customer_id = data.linked_customer_id
    if linked_customer_id:
        parent = await repo.get_by_vendor_and_id(vendor_id, linked_customer_id)
        if not parent:
            raise HTTPException(status_code=400, detail="Linked customer not found")

    # Duplicate GSTIN check (business identifier stays unique per vendor)
    if data.gstin:
        dup = await db.execute(
            select(Customer).where(Customer.vendor_id == vendor_id, Customer.gstin == data.gstin)
        )
        if dup.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="A customer with this GSTIN already exists")

    raw_password = data.password or phone or "Welcome@123"
    password_hash = await asyncio.to_thread(get_password_hash, raw_password)

    customer = Customer(
        vendor_id=vendor_id,
        full_name=data.full_name.strip(),
        email=email,
        phone=phone,
        linked_customer_id=linked_customer_id,
        password_hash=password_hash,
        shipping_addresses=data.shipping_addresses or [],
        is_active=True,
        customer_group=data.customer_group or "retail",
        gstin=data.gstin,
        pan_number=data.pan_number,
        cin=data.cin,
        company_name=data.company_name,
        wholesale_license_number=data.wholesale_license_number,
        wholesale_license_expires=(
            date.fromisoformat(data.wholesale_license_expires)
            if data.wholesale_license_expires
            else None
        ),
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
    except IntegrityError as exc:
        await db.rollback()
        msg = str(exc).lower()
        if "email" in msg:
            raise HTTPException(status_code=409, detail="A customer with this email already exists")
        if "phone" in msg:
            raise HTTPException(status_code=409, detail="A customer with this phone number already exists")
        raise HTTPException(status_code=409, detail="A customer with this information already exists")

    if customer.wholesale_license_number:
        from app.services.pharma_gdp import record_wholesale_license_history

        await record_wholesale_license_history(
            db,
            vendor_id=vendor_id,
            customer_id=customer.id,
            action="set",
            license_number=customer.wholesale_license_number,
            license_expires=customer.wholesale_license_expires,
            detail="Wholesale license set on customer create",
        )
        await db.commit()

    background_tasks.add_task(_sync_crm_contact_after_customer, vendor_id, customer.id)
    return JSONResponse(status_code=201, content=_customer_dict(customer))


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
        new_email = _normalize_customer_email(str(data.email) if data.email else None)
        if new_email != (customer.email or None):
            dup = await repo.get_by_vendor_and_email(vendor_id, new_email) if new_email else None
            if dup and dup.id != customer.id:
                raise HTTPException(status_code=409, detail="Email already in use by another customer")
        customer.email = new_email
    if data.phone is not None:
        customer.phone = _normalize_customer_phone(data.phone) if data.phone else None
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

    license_changed = False
    prev_license_number = getattr(customer, "wholesale_license_number", None)
    prev_license_expires = getattr(customer, "wholesale_license_expires", None)
    if data.wholesale_license_number is not None:
        customer.wholesale_license_number = data.wholesale_license_number or None
        license_changed = True
    if data.wholesale_license_expires is not None:
        customer.wholesale_license_expires = (
            date.fromisoformat(data.wholesale_license_expires)
            if data.wholesale_license_expires
            else None
        )
        license_changed = True
    if license_changed and (
        (prev_license_number or None) != (customer.wholesale_license_number or None)
        or prev_license_expires != customer.wholesale_license_expires
    ):
        from app.services.pharma_gdp import record_wholesale_license_history

        new_num = customer.wholesale_license_number
        if not new_num:
            action = "cleared"
        elif not prev_license_number:
            action = "set"
        else:
            action = "updated"
        await record_wholesale_license_history(
            db,
            vendor_id=vendor_id,
            customer_id=customer.id,
            action=action,
            license_number=new_num,
            license_expires=customer.wholesale_license_expires,
            previous_license_number=prev_license_number,
            previous_license_expires=prev_license_expires,
            detail=f"Wholesale license {action}",
        )

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
    if data.customer_group is not None:
        customer.customer_group = data.customer_group

    await db.commit()
    await db.refresh(customer)
    asyncio.create_task(_sync_crm_contact_after_customer(vendor_id, customer.id))
    return _customer_dict(customer)


@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_customer(
    customer_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a master-data customer.

    Clears soft links created on master-data create (business-partner role, CRM,
    cart/wishlist, etc.). Blocks only when transactional history exists.
    """
    from sqlalchemy import delete as sa_delete, func, select, update

    from app.models.booking import Booking
    from app.models.business_partner import BusinessPartner, BusinessPartnerRole
    from app.models.cart import Cart
    from app.models.coupon import CouponUsage
    from app.models.crm import CrmChatConversation, CrmContact, CrmJourneyEvent
    from app.models.customer_subscription import CustomerSubscription
    from app.models.invoice import Invoice
    from app.models.loyalty import LoyaltyAccount, LoyaltyTransaction
    from app.models.notification import Notification
    from app.models.order import Order
    from app.models.order_dispute import OrderDispute
    from app.models.pos import POSTransaction
    from app.models.rental import RentalBooking
    from app.models.review import Review
    from app.models.wishlist import Wishlist

    vendor_id = await _get_vendor_id(current_user, db)
    repo = CustomerRepository(db)
    customer = await repo.get_by_vendor_and_id(vendor_id, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    async def _count(model) -> int:
        return int(
            await db.scalar(
                select(func.count()).select_from(model).where(model.customer_id == customer_id)
            )
            or 0
        )

    blockers: list[str] = []
    if await _count(Order):
        blockers.append("orders")
    if await _count(Invoice):
        blockers.append("invoices")
    if await _count(POSTransaction):
        blockers.append("POS sales")
    if await _count(Booking):
        blockers.append("bookings")
    if await _count(CustomerSubscription):
        blockers.append("subscriptions")
    if await _count(RentalBooking):
        blockers.append("rentals")
    if blockers:
        raise HTTPException(
            status_code=409,
            detail=(
                "Cannot delete customer — they have linked "
                + ", ".join(blockers)
                + ". Deactivate the record instead."
            ),
        )

    # Soft / disposable links from master-data create & storefront activity
    role_rows = (
        await db.execute(
            select(BusinessPartnerRole.business_partner_id).where(
                BusinessPartnerRole.customer_id == customer_id
            )
        )
    ).all()
    bp_ids = {row[0] for row in role_rows if row[0]}

    await db.execute(
        sa_delete(BusinessPartnerRole).where(BusinessPartnerRole.customer_id == customer_id)
    )
    for bp_id in bp_ids:
        remaining = int(
            await db.scalar(
                select(func.count())
                .select_from(BusinessPartnerRole)
                .where(BusinessPartnerRole.business_partner_id == bp_id)
            )
            or 0
        )
        if remaining == 0:
            await db.execute(sa_delete(BusinessPartner).where(BusinessPartner.id == bp_id))

    await db.execute(
        update(CrmContact).where(CrmContact.customer_id == customer_id).values(customer_id=None)
    )
    await db.execute(
        update(CrmChatConversation)
        .where(CrmChatConversation.customer_id == customer_id)
        .values(customer_id=None)
    )
    await db.execute(
        update(CrmJourneyEvent)
        .where(CrmJourneyEvent.customer_id == customer_id)
        .values(customer_id=None)
    )
    await db.execute(
        update(Customer)
        .where(Customer.linked_customer_id == customer_id)
        .values(linked_customer_id=None)
    )
    await db.execute(
        update(OrderDispute).where(OrderDispute.customer_id == customer_id).values(customer_id=None)
    )

    await db.execute(sa_delete(LoyaltyTransaction).where(LoyaltyTransaction.customer_id == customer_id))
    await db.execute(sa_delete(LoyaltyAccount).where(LoyaltyAccount.customer_id == customer_id))
    await db.execute(sa_delete(CouponUsage).where(CouponUsage.customer_id == customer_id))
    await db.execute(sa_delete(Review).where(Review.customer_id == customer_id))
    await db.execute(sa_delete(Cart).where(Cart.customer_id == customer_id))
    await db.execute(sa_delete(Wishlist).where(Wishlist.customer_id == customer_id))
    await db.execute(sa_delete(Notification).where(Notification.customer_id == customer_id))

    try:
        await db.delete(customer)
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Cannot delete customer — they have linked records. Deactivate instead.",
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
