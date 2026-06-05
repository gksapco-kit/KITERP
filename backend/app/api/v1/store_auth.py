# app/api/v1/store_auth.py
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from pydantic import BaseModel

from app.database import get_db
from app.api.deps import get_store_vendor_id, get_current_active_customer
from app.models.customer import Customer
from app.schemas.customer import CustomerCreate, CustomerLogin, CustomerUpdate, CustomerPasswordChange
from app.services.customer_service import CustomerService
from app.core.security import decode_token, create_access_token, create_refresh_token

router = APIRouter()


def customer_to_dict(c: Customer) -> dict:
    return {
        "id": str(c.id),
        "vendor_id": str(c.vendor_id),
        "full_name": c.full_name,
        "email": c.email,
        "phone": c.phone,
        "avatar_url": c.avatar_url,
        "shipping_addresses": c.shipping_addresses or [],
        "default_address_index": c.default_address_index or 0,
        "is_active": c.is_active,
        "total_orders": c.total_orders or 0,
        "total_spent": float(c.total_spent or 0),
        "notification_preferences": c.notification_preferences or {},
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register_customer(
    data: CustomerCreate,
    vendor_id: UUID = Depends(get_store_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Register a new customer for a vendor store."""
    service = CustomerService(db)
    customer = await service.register(vendor_id, data)
    return JSONResponse(content=customer_to_dict(customer), status_code=201)


@router.post("/login")
async def login_customer(
    data: CustomerLogin,
    vendor_id: UUID = Depends(get_store_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Customer login for a vendor store."""
    service = CustomerService(db)
    tokens = await service.login(vendor_id, data.login, data.password)
    return {
        "access_token": tokens.access_token,
        "refresh_token": tokens.refresh_token,
        "token_type": tokens.token_type,
    }


class RefreshRequest(BaseModel):
    refresh_token: str


@router.post("/refresh")
async def refresh_customer_token(
    data: RefreshRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Refresh customer access token."""
    try:
        payload = decode_token(data.refresh_token)
        if not payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token: failed to decode",
            )
        
        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token: wrong token type",
            )
        
        if payload.get("role") != "customer":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token: wrong role",
            )

        customer_id = payload.get("sub")
        vendor_id = payload.get("vendor_id")
        
        # Try to get vendor_id from header if not in token (for backwards compatibility)
        if not vendor_id:
            from app.middleware.tenant import get_tenant_vendor_id
            # Try tenant middleware first
            tenant_vendor_id = get_tenant_vendor_id(request)
            if tenant_vendor_id:
                vendor_id = tenant_vendor_id
            else:
                # Try header-based resolution
                header_id = request.headers.get("x-vendor-id")
                if header_id:
                    vendor_id = header_id
                else:
                    header_slug = request.headers.get("x-vendor-slug")
                    if header_slug:
                        from app.repositories.vendor_repo import VendorRepository
                        repo_vendor = VendorRepository(db)
                        vendor = await repo_vendor.find_by_slug(header_slug)
                        if vendor:
                            vendor_id = str(vendor.id)
        
        if not customer_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload: missing customer ID",
            )
        
        if not vendor_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload: missing vendor ID. Please log in again.",
            )

        from app.repositories.customer_repo import CustomerRepository
        repo = CustomerRepository(db)
        customer = await repo.get_by_vendor_and_id(UUID(vendor_id), UUID(customer_id))

        if not customer:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Customer not found",
            )
        
        if not customer.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Account is disabled",
            )
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"Error refreshing token: {e}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token refresh failed: {str(e)}",
        )

    token_data = {
        "sub": str(customer.id),
        "vendor_id": str(vendor_id),
        "email": customer.email,
        "role": "customer",
    }
    access_token = create_access_token(data=token_data)
    refresh_token = create_refresh_token(data=token_data)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }


@router.get("/me")
async def get_me(
    customer: Customer = Depends(get_current_active_customer),
):
    """Get current customer profile."""
    return JSONResponse(content=customer_to_dict(customer))


@router.put("/me")
async def update_me(
    data: CustomerUpdate,
    customer: Customer = Depends(get_current_active_customer),
    vendor_id: UUID = Depends(get_store_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Update current customer profile."""
    service = CustomerService(db)
    updated = await service.update_profile(vendor_id, customer.id, data)
    return JSONResponse(content=customer_to_dict(updated))


@router.get("/notification-preferences")
async def get_notification_preferences(
    customer: Customer = Depends(get_current_active_customer),
):
    return JSONResponse(content=customer.notification_preferences or {})


@router.put("/notification-preferences")
async def update_notification_preferences(
    body: dict,
    customer: Customer = Depends(get_current_active_customer),
    db: AsyncSession = Depends(get_db),
):
    prefs = dict(customer.notification_preferences or {})
    prefs.update(body)
    customer.notification_preferences = prefs
    await db.commit()
    await db.refresh(customer)
    return JSONResponse(content=prefs)


@router.post("/change-password")
async def change_password(
    data: CustomerPasswordChange,
    customer: Customer = Depends(get_current_active_customer),
    vendor_id: UUID = Depends(get_store_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Change the logged-in customer's password."""
    service = CustomerService(db)
    await service.change_password(vendor_id, customer.id, data)
    return JSONResponse(content={"ok": True, "message": "Password updated"})
