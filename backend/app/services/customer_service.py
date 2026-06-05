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

        if not customer or not verify_password(password, customer.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email/phone or password",
            )

        if not customer.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Account is disabled",
            )

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
        if data.phone is not None:
            customer.phone = data.phone
        if data.avatar_url is not None:
            customer.avatar_url = data.avatar_url
        if data.shipping_addresses is not None:
            customer.shipping_addresses = [a.model_dump() for a in data.shipping_addresses]
        if data.default_address_index is not None:
            customer.default_address_index = data.default_address_index

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
