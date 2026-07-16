# app/services/business_partner_service.py
"""
BusinessPartnerService orchestrates:
  1. Creating a BusinessPartner identity record
  2. Provisioning the backing domain rows (Customer / Supplier) per role
  3. Adding a new role to an existing BP
  4. Duplicate detection across name / phone / email / GSTIN
"""
from __future__ import annotations

import asyncio
from uuid import UUID
from typing import Optional, List

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_password_hash
from app.models.business_partner import BusinessPartner, BusinessPartnerRole
from app.models.customer import Customer
from app.models.procurement import Supplier
from app.repositories.business_partner_repo import BusinessPartnerRepository
from app.services.sms_service import is_valid_e164, normalize_e164

# Roles that map to the supplier table
_SUPPLIER_PARTY_TYPES = {"vendor", "employee", "partner", "contractor"}


def _normalize_phone(raw: Optional[str]) -> Optional[str]:
    if not raw or not str(raw).strip():
        return None
    phone = normalize_e164(str(raw).strip())
    if not is_valid_e164(phone):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Enter a valid mobile number (e.g. 9703200341 or +919703200341)",
        )
    # customer.phone is String(20)
    return phone[:20]


class BusinessPartnerService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = BusinessPartnerRepository(db)

    # ── Helpers ───────────────────────────────────────────────────

    def _bp_to_dict(self, bp: BusinessPartner) -> dict:
        return {
            "id": str(bp.id),
            "vendor_id": str(bp.vendor_id),
            "name": bp.name,
            "contact_name": bp.contact_name,
            "email": bp.email,
            "phone": bp.phone,
            "gstin": bp.gstin,
            "pan_number": bp.pan_number,
            "cin": bp.cin,
            "company_name": bp.company_name,
            "address": bp.address,
            "bank_name": bp.bank_name,
            "account_number": bp.account_number,
            "account_holder_name": bp.account_holder_name,
            "account_type": bp.account_type,
            "ifsc_code": bp.ifsc_code,
            "opening_balance": float(bp.opening_balance) if bp.opening_balance else 0,
            "notes": bp.notes,
            "avatar_url": bp.avatar_url,
            "is_active": bp.is_active,
            "party_status": bp.party_status,
            "payment_blocked": bp.payment_blocked,
            "hold_until": bp.hold_until.isoformat() if bp.hold_until else None,
            "roles": [self._role_to_dict(r) for r in (bp.roles or [])],
            "created_at": bp.created_at.isoformat() if bp.created_at else None,
            "updated_at": bp.updated_at.isoformat() if bp.updated_at else None,
        }

    def _role_to_dict(self, r: BusinessPartnerRole) -> dict:
        return {
            "id": str(r.id),
            "role": r.role,
            "customer_id": str(r.customer_id) if r.customer_id else None,
            "supplier_id": str(r.supplier_id) if r.supplier_id else None,
            "attributes": r.attributes or {},
            "is_active": r.is_active,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }

    async def _provision_customer(
        self, vendor_id: UUID, bp: BusinessPartner, customer_group: Optional[str] = None,
    ) -> Customer:
        """Create a Customer row seeded from the BP identity.

        `customer_group` (retail/wholesale/distributor/agent/dealer/…) drives which
        "party" price rules apply for this customer at checkout/POS — sourced from
        the customer role's `attributes.customer_group`.
        """
        raw_password = bp.phone or "Welcome@123"
        password_hash = await asyncio.to_thread(get_password_hash, raw_password)
        customer = Customer(
            vendor_id=vendor_id,
            full_name=bp.name,
            email=(bp.email or "").strip().lower() or None,
            phone=bp.phone,
            password_hash=password_hash,
            gstin=bp.gstin,
            pan_number=bp.pan_number,
            cin=bp.cin,
            company_name=bp.company_name or bp.name,
            billing_address=bp.address or {},
            notes=bp.notes,
            opening_balance=bp.opening_balance or 0,
            bank_name=bp.bank_name,
            account_number=bp.account_number,
            account_holder_name=bp.account_holder_name,
            account_type=bp.account_type or "savings",
            ifsc_code=bp.ifsc_code,
            customer_group=customer_group or "retail",
            is_active=True,
        )
        self.db.add(customer)
        await self.db.flush()
        return customer

    async def _provision_supplier(
        self, vendor_id: UUID, bp: BusinessPartner, party_type: str
    ) -> Supplier:
        """Create a Supplier row seeded from the BP identity."""
        addr = bp.address or {}
        supplier = Supplier(
            vendor_id=vendor_id,
            party_type=party_type,
            name=bp.name,
            contact_name=bp.contact_name,
            email=bp.email,
            phone=bp.phone,
            address=addr,
            gstin=bp.gstin,
            pan_number=bp.pan_number,
            cin=bp.cin,
            company_name=bp.company_name,
            opening_balance=bp.opening_balance or 0,
            bank_name=bp.bank_name,
            account_number=bp.account_number,
            account_holder_name=bp.account_holder_name,
            account_type=bp.account_type or "savings",
            ifsc_code=bp.ifsc_code,
            notes=bp.notes,
            is_active=True,
        )
        self.db.add(supplier)
        await self.db.flush()
        return supplier

    # ── Public API ────────────────────────────────────────────────

    async def find_duplicate(
        self,
        vendor_id: UUID,
        name: str,
        phone: Optional[str] = None,
        email: Optional[str] = None,
        gstin: Optional[str] = None,
        exclude_id: Optional[UUID] = None,
    ) -> Optional[BusinessPartner]:
        return await self.repo.find_duplicate(
            vendor_id, name, phone, email, gstin, exclude_id
        )

    async def create(
        self,
        vendor_id: UUID,
        data: dict,
        roles: List[dict],
    ) -> dict:
        """
        Create a new BusinessPartner and provision each requested role.
        `roles` is a list of {role: str, attributes: dict|None}.
        Raises 409 on duplicate (same name/phone/email/GSTIN already has a BP).
        """
        if data.get("phone"):
            data["phone"] = _normalize_phone(data.get("phone"))
        if data.get("email"):
            data["email"] = str(data["email"]).strip().lower() or None

        duplicate = await self.repo.find_duplicate(
            vendor_id,
            data.get("name", ""),
            data.get("phone"),
            data.get("email"),
            data.get("gstin"),
        )
        if duplicate:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "message": f"A business partner named '{duplicate.name}' already exists",
                    "existing_id": str(duplicate.id),
                    "existing_name": duplicate.name,
                    "existing_roles": [r.role for r in (duplicate.roles or [])],
                },
            )

        if not roles:
            roles = [{"role": "customer", "attributes": None}]

        bp = BusinessPartner(vendor_id=vendor_id, **data)
        await self.repo.create(bp)

        for role_data in roles:
            await self._add_role_internal(vendor_id, bp, role_data["role"], role_data.get("attributes"))

        await self.db.commit()
        await self.db.refresh(bp)
        return self._bp_to_dict(bp)

    async def add_role(self, vendor_id: UUID, bp_id: UUID, role: str, attributes: Optional[dict] = None) -> dict:
        """Extend an existing BP with a new role."""
        bp = await self.repo.get(vendor_id, bp_id)
        if not bp:
            raise HTTPException(status_code=404, detail="Business partner not found")

        existing = await self.repo.get_role(vendor_id, bp_id, role)
        if existing:
            raise HTTPException(
                status_code=409,
                detail=f"This partner already has the '{role}' role",
            )

        await self._add_role_internal(vendor_id, bp, role, attributes)
        await self.db.commit()
        await self.db.refresh(bp)
        return self._bp_to_dict(bp)

    async def _add_role_internal(
        self,
        vendor_id: UUID,
        bp: BusinessPartner,
        role: str,
        attributes: Optional[dict],
    ) -> BusinessPartnerRole:
        customer_id = None
        supplier_id = None

        if role == "customer":
            c = await self._provision_customer(vendor_id, bp, customer_group=(attributes or {}).get("customer_group"))
            customer_id = c.id
        else:
            # All non-customer roles map to a supplier row
            party_type = role if role in _SUPPLIER_PARTY_TYPES else "supplier"
            s = await self._provision_supplier(vendor_id, bp, party_type)
            supplier_id = s.id

        role_row = BusinessPartnerRole(
            vendor_id=vendor_id,
            business_partner_id=bp.id,
            role=role,
            customer_id=customer_id,
            supplier_id=supplier_id,
            attributes=attributes or {},
            is_active=True,
        )
        return await self.repo.add_role(role_row)

    async def remove_role(self, vendor_id: UUID, bp_id: UUID, role: str) -> dict:
        bp = await self.repo.get(vendor_id, bp_id)
        if not bp:
            raise HTTPException(status_code=404, detail="Business partner not found")
        removed = await self.repo.remove_role(vendor_id, bp_id, role)
        if not removed:
            raise HTTPException(status_code=404, detail=f"Role '{role}' not found on this partner")
        await self.db.commit()
        await self.db.refresh(bp)
        return self._bp_to_dict(bp)

    async def update(self, vendor_id: UUID, bp_id: UUID, data: dict) -> dict:
        bp = await self.repo.get(vendor_id, bp_id)
        if not bp:
            raise HTTPException(status_code=404, detail="Business partner not found")
        for k, v in data.items():
            if v is not None:
                setattr(bp, k, v)
        await self.db.commit()
        await self.db.refresh(bp)
        return self._bp_to_dict(bp)

    async def list(
        self,
        vendor_id: UUID,
        search: Optional[str] = None,
        role: Optional[str] = None,
        is_active: Optional[bool] = None,
        page: int = 1,
        size: int = 50,
    ) -> dict:
        skip = (page - 1) * size
        items, total = await self.repo.list(vendor_id, search, role, is_active, skip, size)
        return {
            "items": [self._bp_to_dict(bp) for bp in items],
            "total": total,
            "page": page,
            "size": size,
        }

    async def get(self, vendor_id: UUID, bp_id: UUID) -> dict:
        bp = await self.repo.get(vendor_id, bp_id)
        if not bp:
            raise HTTPException(status_code=404, detail="Business partner not found")
        return self._bp_to_dict(bp)
