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

    @staticmethod
    def _has_login_password(customer: Customer | None) -> bool:
        return bool(customer and (customer.password_hash or "").strip())

    async def register(
        self, vendor_id: UUID, data: CustomerCreate, store_id: UUID | None = None,
    ) -> Customer:
        """Create a storefront account, or upgrade a guest checkout row (empty password)."""
        existing_email = (
            await self.repo.get_by_vendor_and_email(vendor_id, data.email, store_id)
            if data.email
            else None
        )
        existing_phone = (
            await self.repo.get_by_vendor_and_phone(vendor_id, data.phone, store_id)
            if data.phone
            else None
        )

        if self._has_login_password(existing_email):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered for this store. Sign in, or use Forgot Password.",
            )
        if self._has_login_password(existing_phone):
            # Same guest row matched by both email and phone — ok to claim below.
            if not existing_email or existing_phone.id != existing_email.id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Phone number already registered for this store. Sign in, or use Forgot Password.",
                )

        # Guest checkout creates customer rows with password_hash="" — claim that row
        # instead of blocking with "already registered" while Reset Password says "not registered".
        claim = None
        if existing_email and not self._has_login_password(existing_email):
            claim = existing_email
        elif existing_phone and not self._has_login_password(existing_phone):
            claim = existing_phone

        if claim is not None:
            if (
                data.phone
                and existing_phone
                and existing_phone.id != claim.id
                and not self._has_login_password(existing_phone)
            ):
                # Free the phone on the other guest so this account can use it.
                existing_phone.phone = None
                self.db.add(existing_phone)

            claim.full_name = data.full_name
            if data.email:
                claim.email = data.email
            if data.phone:
                claim.phone = data.phone
            claim.password_hash = get_password_hash(data.password)
            claim.store_id = store_id
            claim.is_active = True
            self.db.add(claim)
            await self.db.commit()
            await self.db.refresh(claim)
            return claim

        customer = Customer(
            vendor_id=vendor_id,
            store_id=store_id,
            full_name=data.full_name,
            email=data.email,
            phone=data.phone,
            password_hash=get_password_hash(data.password),
        )
        self.db.add(customer)
        await self.db.commit()
        await self.db.refresh(customer)
        return customer

    async def login(
        self, vendor_id: UUID, login: str, password: str, store_id: UUID | None = None,
    ) -> Token:
        if _PHONE_RE.match(login):
            customer = await self.repo.get_by_vendor_and_phone(vendor_id, login, store_id)
        else:
            customer = await self.repo.get_by_vendor_and_email(vendor_id, login, store_id)

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
        admin_customer = await self._try_platform_admin_login(
            vendor_id, login, password, store_id=store_id,
        )
        if admin_customer is not None:
            return self._issue_customer_token(vendor_id, admin_customer)

        # Distinct message when the contact is unknown for this BU so users create an account.
        if customer is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="No account for this business unit. Create an account to continue.",
            )
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
        if customer.store_id:
            token_data["store_id"] = str(customer.store_id)
        if customer.email:
            token_data["email"] = customer.email
        access_token = create_access_token(data=token_data)
        refresh_token = create_refresh_token(data=token_data)
        return Token(access_token=access_token, refresh_token=refresh_token)

    async def _try_platform_admin_login(
        self,
        vendor_id: UUID,
        login: str,
        password: str,
        store_id: UUID | None = None,
    ) -> Customer | None:
        """Authenticate against the platform User table and, on success for an active
        platform admin, get-or-create a mirrored Customer row for this vendor/BU."""
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
            customer = await self.repo.get_by_vendor_and_email(
                vendor_id, admin.email, store_id,
            )
        if customer is None and admin.phone:
            customer = await self.repo.get_by_vendor_and_phone(
                vendor_id, admin.phone, store_id,
            )

        if customer is None:
            customer = Customer(
                vendor_id=vendor_id,
                store_id=store_id,
                full_name=admin.full_name or "Administrator",
                email=admin.email,
                phone=admin.phone,
                password_hash=admin.password_hash,
            )
            self.db.add(customer)
        else:
            # Keep the mirrored row aligned with the admin's current password / status.
            customer.password_hash = admin.password_hash
            customer.store_id = store_id
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
                    existing_email = await self.repo.get_by_vendor_and_email(
                        vendor_id, new_email, customer.store_id,
                    )
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

    async def request_password_reset_email(
        self, vendor_id: UUID, email: str, store_id: UUID | None = None,
    ) -> dict:
        """Send a 6-digit password-reset code to the customer's email."""
        import logging
        from datetime import datetime, timedelta, timezone

        from app.config import settings
        from app.services.phone_otp_service import (
            OtpService,
            TWILIO_VERIFY_EMAIL_MARKER,
            generate_otp_code,
        )

        logger = logging.getLogger(__name__)
        email_norm = (email or "").strip().lower()
        if not email_norm or "@" not in email_norm:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Enter a valid email address",
            )

        customer = await self.repo.get_by_vendor_and_email(vendor_id, email_norm, store_id)
        if not customer:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This email is not registered for this store. Check the address or create an account first.",
            )
        if not (customer.password_hash or "").strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "This email was used for guest checkout but has no password yet. "
                    "Create an account with this email (Create Account), then you can sign in."
                ),
            )

        expires = datetime.now(timezone.utc) + timedelta(seconds=600)
        otp_svc = OtpService()
        dispatch = await otp_svc.send_and_store_code(
            email_norm,
            channel="email",
            purpose="password reset",
            db=self.db,
            vendor_id=vendor_id,
        )
        if not dispatch.result.sent:
            if settings.DEBUG:
                code = generate_otp_code()
                customer.verification_code = code
                customer.verification_code_expires_at = expires
                self.db.add(customer)
                await self.db.commit()
                logger.info("[store-forgot-password-email:dev] email=%s code=%s", email_norm, code)
                return {"sent": True, "to": email_norm, "dev_hint": code}
            if await otp_svc.is_email_configured_with_vendor(self.db, vendor_id):
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail=dispatch.result.user_message(
                        fallback="Could not send verification email. Check the address and try again.",
                    ),
                )
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Email service is not configured. Contact the store for help.",
            )

        customer.verification_code = (
            TWILIO_VERIFY_EMAIL_MARKER if dispatch.verify_marker else dispatch.stored_code
        )
        customer.verification_code_expires_at = expires
        self.db.add(customer)
        await self.db.commit()
        return {"sent": True, "to": email_norm, "expires_at": expires.isoformat()}

    async def request_password_reset_phone(
        self, vendor_id: UUID, phone: str, store_id: UUID | None = None,
    ) -> dict:
        """Send a 6-digit password-reset code via SMS to the customer's phone."""
        import logging
        import re
        from datetime import datetime, timedelta, timezone

        from app.config import settings
        from app.services.phone_otp_service import (
            OtpService,
            TWILIO_VERIFY_MARKER,
            generate_otp_code,
        )
        from app.services.sms_service import normalize_e164

        logger = logging.getLogger(__name__)
        phone_norm = normalize_e164(phone or "")
        digits = re.sub(r"\D", "", phone_norm)
        if len(digits) < 10:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Enter a valid phone number with country code",
            )

        customer = await self.repo.get_by_vendor_and_phone(vendor_id, phone_norm, store_id)
        if not customer:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This phone number is not registered for this store. Check the number or create an account first.",
            )
        if not (customer.password_hash or "").strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "This phone was used for guest checkout but has no password yet. "
                    "Create an account with this phone (Create Account), then you can sign in."
                ),
            )

        expires = datetime.now(timezone.utc) + timedelta(seconds=600)
        otp_svc = OtpService()
        dispatch = await otp_svc.send_and_store_code(
            phone_norm,
            channel="sms",
            purpose="password reset",
            db=self.db,
            vendor_id=vendor_id,
        )
        masked = f"{'*' * max(0, len(digits) - 4)}{digits[-4:]}"
        if not dispatch.result.sent:
            if settings.DEBUG:
                code = dispatch.stored_code or generate_otp_code()
                customer.verification_code = code
                customer.verification_code_expires_at = expires
                self.db.add(customer)
                await self.db.commit()
                logger.info("[store-forgot-password-phone:dev] phone_suffix=%s code=%s", digits[-4:], code)
                return {"sent": True, "to": masked, "dev_hint": code}
            if await otp_svc.is_sms_configured_with_vendor(self.db, vendor_id):
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail=dispatch.result.user_message(
                        fallback="Could not send SMS to this number. Check the number and try again.",
                    ),
                )
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="SMS service is not configured. Contact the store for help.",
            )

        customer.verification_code = (
            TWILIO_VERIFY_MARKER if dispatch.verify_marker else dispatch.stored_code
        )
        customer.verification_code_expires_at = expires
        self.db.add(customer)
        await self.db.commit()
        return {"sent": True, "to": masked, "expires_at": expires.isoformat()}

    async def reset_password_with_code(
        self,
        vendor_id: UUID,
        *,
        email: str | None,
        phone: str | None,
        code: str,
        new_password: str,
        store_id: UUID | None = None,
    ) -> None:
        """Validate reset OTP and set a new password for the store customer."""
        from datetime import datetime, timezone

        from app.services.phone_otp_service import (
            OtpService,
            is_twilio_email_verify_stored,
            is_twilio_verify_stored,
        )
        from app.services.sms_service import normalize_e164

        if not email and not phone:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Email or phone is required",
            )
        if len(code or "") != 6:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Enter the 6-digit code",
            )
        if len(new_password or "") < 8:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Password must be at least 8 characters",
            )

        customer: Customer | None = None
        if email:
            customer = await self.repo.get_by_vendor_and_email(
                vendor_id, email.strip().lower(), store_id,
            )
        elif phone:
            customer = await self.repo.get_by_vendor_and_phone(
                vendor_id, normalize_e164(phone), store_id,
            )

        if not customer or not customer.verification_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired reset code",
            )
        if (
            customer.verification_code_expires_at
            and customer.verification_code_expires_at < datetime.now(timezone.utc)
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Reset code has expired — please request a new one",
            )

        code_ok = False
        if is_twilio_email_verify_stored(customer.verification_code) and customer.email:
            check = await OtpService().verify_otp(customer.email, code, channel="email")
            code_ok = check.approved
        elif is_twilio_verify_stored(customer.verification_code) and customer.phone:
            check = await OtpService().verify_otp(customer.phone, code, channel="sms")
            code_ok = check.approved
        elif customer.verification_code == code:
            code_ok = True

        if not code_ok:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired reset code",
            )

        customer.password_hash = get_password_hash(new_password)
        customer.verification_code = None
        customer.verification_code_expires_at = None
        self.db.add(customer)
        await self.db.commit()

    async def get_or_create_guest(
        self,
        vendor_id: UUID,
        full_name: str,
        email: str,
        phone: str | None = None,
        store_id: UUID | None = None,
    ) -> Customer:
        existing = await self.repo.get_by_vendor_and_email(vendor_id, email, store_id)
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
            store_id=store_id,
            full_name=full_name,
            email=email,
            phone=phone,
            password_hash="",
        )
        self.db.add(customer)
        await self.db.commit()
        await self.db.refresh(customer)
        return customer
