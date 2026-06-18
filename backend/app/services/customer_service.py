# app/services/customer_service.py
import re
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.models.customer import Customer
from app.schemas.customer import CustomerCreate, CustomerUpdate, CustomerPasswordChange
from app.schemas.user import Token
from app.repositories.customer_repo import CustomerRepository
from app.core.security import (
    create_access_token,
    create_refresh_token,
    verify_password,
    get_password_hash,
    decode_token,
)

_PHONE_RE = re.compile(r"^\+?\d{7,15}$")


class CustomerService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = CustomerRepository(db)

    async def register(self, vendor_id: UUID, data: CustomerCreate) -> Customer:
        if data.email:
            existing = await self.repo.get_by_vendor_and_email(vendor_id, data.email)
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email already registered for this store",
                )

        if data.phone:
            existing_phone = await self.repo.get_by_vendor_and_phone(vendor_id, data.phone)
            if existing_phone:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Phone number already registered for this store",
                )

        customer = Customer(
            vendor_id=vendor_id,
            full_name=data.full_name,
            email=data.email,
            phone=data.phone,
            password_hash=get_password_hash(data.password),
        )
        self.db.add(customer)
        await self.db.commit()
        await self.db.refresh(customer)
        return customer

    async def login(self, vendor_id: UUID, login: str, password: str) -> Token:
        if _PHONE_RE.match(login):
            customer = await self.repo.get_by_vendor_and_phone(vendor_id, login)
        else:
            customer = await self.repo.get_by_vendor_and_email(vendor_id, login)

        if customer and verify_password(password, customer.password_hash or ""):
            if not customer.is_active:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Account is disabled",
                )
            return self._issue_customer_token(vendor_id, customer)

        # Fallback: a platform admin (User table, e.g. admin@kiterp.com) may sign in to any
        # storefront using the active password stored on their User row. We mirror them into a
        # Customer record for this vendor so the rest of the storefront (which expects a
        # customer-scoped token) keeps working unchanged.
        admin_customer = await self._try_platform_admin_login(vendor_id, login, password)
        if admin_customer is not None:
            return self._issue_customer_token(vendor_id, admin_customer)

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email/phone or password",
        )

    def _issue_customer_token(self, vendor_id: UUID, customer: Customer) -> Token:
        token_data = {
            "sub": str(customer.id),
            "vendor_id": str(vendor_id),
            "role": "customer",
        }
        if customer.email:
            token_data["email"] = customer.email
        access_token = create_access_token(data=token_data)
        refresh_token = create_refresh_token(data=token_data)
        return Token(access_token=access_token, refresh_token=refresh_token)

    async def _try_platform_admin_login(
        self, vendor_id: UUID, login: str, password: str,
    ) -> Customer | None:
        """Authenticate against the platform User table and, on success for an active
        platform admin, get-or-create a mirrored Customer row for this vendor."""
        from app.repositories.user_repo import UserRepository
        from app.utils.platform_staff import has_platform_staff_access

        user_repo = UserRepository(self.db)
        if _PHONE_RE.match(login):
            candidates = await user_repo.list_users_by_phone(login)
        else:
            candidates = await user_repo.list_users_by_email_ci(login)

        eligible = [
            u
            for u in candidates
            if u.password_hash
            and verify_password(password, u.password_hash)
            and u.is_active
            and has_platform_staff_access(u)
        ]
        if not eligible:
            return None
        admin = eligible[0]

        customer: Customer | None = None
        if admin.email:
            customer = await self.repo.get_by_vendor_and_email(vendor_id, admin.email)
        if customer is None and admin.phone:
            customer = await self.repo.get_by_vendor_and_phone(vendor_id, admin.phone)

        if customer is None:
            customer = Customer(
                vendor_id=vendor_id,
                full_name=admin.full_name or "Administrator",
                email=admin.email,
                phone=admin.phone,
                password_hash=admin.password_hash,
            )
            self.db.add(customer)
        else:
            # Keep the mirrored row aligned with the admin's current password / status.
            customer.password_hash = admin.password_hash
            customer.is_active = True

        await self.db.commit()
        await self.db.refresh(customer)
        return customer

    async def get_by_id(self, vendor_id: UUID, customer_id: UUID) -> Customer:
        customer = await self.repo.get_by_vendor_and_id(vendor_id, customer_id)
        if not customer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Customer not found",
            )
        return customer

    async def update_profile(
        self, vendor_id: UUID, customer_id: UUID, data: CustomerUpdate
    ) -> Customer:
        customer = await self.get_by_id(vendor_id, customer_id)

        if data.full_name is not None:
            customer.full_name = data.full_name
        if data.email is not None:
            new_email = str(data.email).strip().lower() if str(data.email).strip() else None
            current_email = (customer.email or "").strip().lower() or None
            if new_email != current_email:
                if new_email:
                    existing_email = await self.repo.get_by_vendor_and_email(vendor_id, new_email)
                    if existing_email and existing_email.id != customer.id:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Email already registered for this store",
                        )
                customer.email = new_email
        if data.phone is not None:
            from app.services.sms_service import normalize_e164, is_valid_e164

            raw = (data.phone or "").strip()
            if not raw:
                customer.phone = None
            else:
                phone = normalize_e164(raw)
                if not is_valid_e164(phone):
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail="Enter a valid mobile number (e.g. 9703200341 or +919703200341)",
                    )
                customer.phone = phone
        if data.avatar_url is not None:
            customer.avatar_url = data.avatar_url
        if data.shipping_addresses is not None:
            customer.shipping_addresses = [a.model_dump() for a in data.shipping_addresses]
        if data.default_address_index is not None:
            customer.default_address_index = data.default_address_index

        if not (customer.email or "").strip() and not (customer.phone or "").strip():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Keep at least one of email or phone on your account",
            )

        await self.db.commit()
        await self.db.refresh(customer)
        return customer

    async def change_password(
        self, vendor_id: UUID, customer_id: UUID, data: CustomerPasswordChange,
    ) -> None:
        customer = await self.get_by_id(vendor_id, customer_id)
        if not customer.password_hash:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Guest accounts cannot set a password here — please register first",
            )
        if not verify_password(data.current_password, customer.password_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect",
            )
        customer.password_hash = get_password_hash(data.new_password)
        await self.db.commit()

    async def get_or_create_guest(
        self, vendor_id: UUID, full_name: str, email: str, phone: str | None = None,
    ) -> Customer:
        existing = await self.repo.get_by_vendor_and_email(vendor_id, email)
        if existing:
            if full_name and existing.full_name != full_name:
                existing.full_name = full_name
            if phone and not existing.phone:
                existing.phone = phone
            await self.db.commit()
            await self.db.refresh(existing)
            return existing

        customer = Customer(
            vendor_id=vendor_id,
            full_name=full_name,
            email=email,
            phone=phone,
            password_hash="",
        )
        self.db.add(customer)
        await self.db.commit()
        await self.db.refresh(customer)
        return customer
