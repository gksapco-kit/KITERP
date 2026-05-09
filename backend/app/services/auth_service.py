# app/services/auth_service.py
from typing import Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

import re

from app.models.user import User
from app.schemas.user import UserCreate, Token
from app.repositories.user_repo import UserRepository
from app.repositories.vendor_repo import VendorRepository
from app.core.security import (
    create_access_token,
    create_refresh_token,
    verify_password,
    get_password_hash,
    decode_token,
)
from app.utils.platform_staff import PLATFORM_SUPPORT_ROLE, has_platform_staff_access

_PHONE_RE = re.compile(r"^\+?\d{7,15}$")


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = UserRepository(db)
        self.vendor_repo = VendorRepository(db)

    async def register(self, data: UserCreate) -> User:
        if data.email and await self.repo.email_exists(data.email):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered",
            )

        if data.phone and await self.repo.phone_exists(data.phone):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Phone number already registered",
            )

        user = User(
            email=data.email,
            phone=data.phone,
            password_hash=get_password_hash(data.password),
            full_name=data.full_name,
        )

        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def login(self, login: str, password: str, vendor_id: Optional[UUID] = None) -> Token:
        login = str(login or "").strip()
        if not login:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="login and password are required",
            )

        if vendor_id is not None:
            if _PHONE_RE.match(login):
                candidates = await self.repo.list_users_by_phone_for_vendor(vendor_id, login)
            else:
                candidates = await self.repo.list_users_by_email_ci_for_vendor(vendor_id, login)
        else:
            if _PHONE_RE.match(login):
                candidates = await self.repo.list_users_by_phone(login)
            else:
                candidates = await self.repo.list_users_by_email_ci(login)

        matching = [u for u in candidates if verify_password(password, u.password_hash)]
        if len(matching) == 0:
            if vendor_id is not None and len(candidates) == 0:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="No team account on this business for that email or phone.",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email/phone or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        if len(matching) > 1:
            if vendor_id is None:
                hints = await self.vendor_repo.list_vendor_summaries_for_user_ids(
                    [u.id for u in matching]
                )
                if len(hints) == 1:
                    v = await self.vendor_repo.find_by_slug_ci(hints[0]["slug"])
                    if v:
                        return await self.login(login, password, vendor_id=v.id)
                if len(hints) > 1:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail={
                            "error": "ambiguous_login",
                            "message": (
                                "This email or phone is linked to more than one business. "
                                "Choose which business to sign in to."
                            ),
                            "vendors": hints,
                        },
                    )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Multiple accounts share this login with the same password. "
                    "Use a vendor-specific URL or contact support."
                    if vendor_id is None
                    else (
                        "Multiple team accounts match on this business — contact support "
                        "to fix duplicate logins."
                    )
                ),
            )
        user = matching[0]

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account is disabled",
            )

        token_data = {"sub": str(user.id)}
        if user.email:
            token_data["email"] = user.email
        access_token = create_access_token(data=token_data)
        refresh_token = create_refresh_token(data=token_data)

        return Token(
            access_token=access_token,
            refresh_token=refresh_token,
        )

    async def login_platform(self, login: str, password: str) -> Token:
        """
        Super Admin UI only: global lookup, never tenant-scoped.
        Allows ``is_superuser`` or ``platform_staff_role == support``.
        If duplicate emails exist and exactly one platform-eligible row matches, that row wins.
        """
        login = str(login or "").strip()
        if not login:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="login and password are required",
            )

        if _PHONE_RE.match(login):
            candidates = await self.repo.list_users_by_phone(login)
        else:
            candidates = await self.repo.list_users_by_email_ci(login)

        matching = [u for u in candidates if verify_password(password, u.password_hash)]
        eligible = [u for u in matching if has_platform_staff_access(u)]

        if len(eligible) > 1:
            supers = [u for u in eligible if u.is_superuser]
            if len(supers) == 1:
                eligible = supers
            elif len(supers) > 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Multiple administrator accounts match this login — contact support.",
                )
            else:
                supports = [
                    u for u in eligible if getattr(u, "platform_staff_role", None) == PLATFORM_SUPPORT_ROLE
                ]
                if len(supports) == 1:
                    eligible = supports
                else:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Multiple platform accounts share this login — contact support.",
                    )

        if len(eligible) == 0:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email/phone or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        if len(eligible) > 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Multiple accounts share this login — use the vendor dashboard with your business slug.",
            )

        user = eligible[0]
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account is disabled",
            )

        token_data = {"sub": str(user.id)}
        if user.email:
            token_data["email"] = user.email
        access_token = create_access_token(data=token_data)
        refresh_token = create_refresh_token(data=token_data)

        return Token(
            access_token=access_token,
            refresh_token=refresh_token,
        )

    async def refresh_tokens(self, refresh_token: str) -> Token:
        payload = decode_token(refresh_token)

        if not payload or payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token",
            )

        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload",
            )

        user = await self.repo.get_by_id(UUID(user_id))
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or inactive",
            )

        token_data = {"sub": str(user.id)}
        if user.email:
            token_data["email"] = user.email
        access_token = create_access_token(data=token_data)
        new_refresh_token = create_refresh_token(data=token_data)

        return Token(
            access_token=access_token,
            refresh_token=new_refresh_token,
        )
