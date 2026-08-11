# app/services/vendor_service.py
from datetime import datetime, timezone
from typing import Optional, List
from uuid import UUID
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status, UploadFile
from slugify import slugify

from app.config import settings
from app.models.order import Order
from app.models.user import User
from app.models.vendor import Vendor, VendorDocument, VendorBankAccount, VendorOwner
from app.models.vendor_user import VendorUser
from app.schemas.vendor import VendorCreate, VendorUpdate, SlugCheckResponse
from app.schemas.vendor_document import DocumentType
from app.schemas.bank_account import BankAccountCreate
from app.repositories.vendor_repo import VendorRepository
from app.services.file_service import FileService
from app.services.user_cleanup import delete_user_if_orphan
from app.core.events import event_emitter


def mark_vendor_approved_active(vendor: Vendor) -> None:
    """Set vendor live — same outcome as admin ``approve_vendor`` (minus audit/admin id)."""
    vendor.status = "approved"
    vendor.verification_status = "verified"
    now = datetime.now(timezone.utc)
    vendor.verified_at = now
    vendor.activated_at = now


def apply_auto_approval_to_vendor_if_enabled(vendor: Vendor) -> bool:
    """If ``AUTO_APPROVE_NEW_VENDORS`` is on, mark vendor approved. Returns whether it was applied."""
    if not settings.AUTO_APPROVE_NEW_VENDORS:
        return False
    mark_vendor_approved_active(vendor)
    return True


class VendorService:
    def __init__(
        self, 
        db: AsyncSession,
        file_service: Optional[FileService] = None
    ):
        self.db = db
        self.repo = VendorRepository(db)
        self.file_service = file_service or FileService()
    
    # ============== Registration ==============
    
    async def register(
        self, 
        user_id: UUID, 
        data: VendorCreate
    ) -> Vendor:
        """Register a new vendor."""
        # Check slug availability
        if await self.repo.slug_exists(data.slug):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Slug is already taken"
            )
        
        # Generate subdomain
        subdomain = self._generate_subdomain(data.slug)
        
        # Create vendor
        vendor = Vendor(
            business_name=data.business_name,
            display_name=data.display_name,
            slug=data.slug,
            subdomain=subdomain,
            business_type=data.business_type.value,
            offering_type=data.offering_type.value,
            industry=data.industry,
            description=data.description,
            primary_email=data.primary_email,
            primary_phone=data.primary_phone,
            street_address=data.address.street_address,
            city=data.address.city,
            state=data.address.state,
            postal_code=data.address.postal_code,
            country=data.address.country,
            latitude=data.address.latitude,
            longitude=data.address.longitude,
            service_radius_km=data.address.service_radius_km,
            logo_url=data.logo_url,
            banner_url=data.banner_url,
        )
        
        self.db.add(vendor)
        await self.db.flush()
        
        # Create vendor owner
        owner = VendorOwner(
            vendor_id=vendor.id,
            user_id=user_id,
            full_name=data.owner_name,
            email=data.primary_email,
            phone=data.primary_phone,
            is_primary=True,
        )
        self.db.add(owner)

        # Create VendorUser entry for the owner with full permissions
        vendor_user = VendorUser(
            vendor_id=vendor.id,
            user_id=user_id,
            role="owner",
            permissions=[],
            is_active=True,
        )
        self.db.add(vendor_user)

        from app.models.store import Store
        from app.utils.store_codes import allocate_default_business_store_code
        from app.utils.vendor_address import store_address_from_vendor

        await self.db.flush()
        store_code = await allocate_default_business_store_code(self.db, vendor.id)
        default_store = Store(
            vendor_id=vendor.id,
            name=(vendor.display_name or vendor.business_name or "")[:200] or "Main location",
            code=store_code,
            description=None,
            address=store_address_from_vendor(vendor),
            is_default=True,
            is_active=True,
        )
        self.db.add(default_store)

        from app.services.finance.coa_seeder import get_or_create_default_fin_company

        await get_or_create_default_fin_company(self.db, vendor.id)

        auto_approved = apply_auto_approval_to_vendor_if_enabled(vendor)

        await self.db.commit()
        await self.db.refresh(vendor)
        
        # Emit event
        await event_emitter.emit("vendor.registered", {
            "vendor_id": str(vendor.id),
            "user_id": str(user_id)
        })
        if auto_approved:
            await event_emitter.emit(
                "vendor.approved",
                {"vendor_id": str(vendor.id), "admin_id": None},
            )
        
        return vendor
    
    async def check_slug_availability(self, slug: str) -> SlugCheckResponse:
        """Check if a slug is available and provide suggestions if not."""
        normalized_slug = slugify(slug, lowercase=True)
        exists = await self.repo.slug_exists(normalized_slug)
        
        if not exists:
            return SlugCheckResponse(available=True)
        
        # Generate suggestions
        suggestions = await self._generate_slug_suggestions(normalized_slug)
        return SlugCheckResponse(available=False, suggestions=suggestions)
    
    async def _generate_slug_suggestions(self, base_slug: str) -> List[str]:
        """Generate alternative slug suggestions."""
        suggestions = []
        suffixes = ["store", "shop", "hub", "mart", "online"]
        
        for suffix in suffixes:
            suggestion = f"{base_slug}-{suffix}"
            if not await self.repo.slug_exists(suggestion):
                suggestions.append(suggestion)
            if len(suggestions) >= 3:
                break
        
        # Add numbered suggestions if needed
        counter = 1
        while len(suggestions) < 3:
            suggestion = f"{base_slug}{counter}"
            if not await self.repo.slug_exists(suggestion):
                suggestions.append(suggestion)
            counter += 1
        
        return suggestions[:3]
    
    def _generate_subdomain(self, slug: str) -> str:
        """Generate subdomain from slug."""
        return slugify(slug, lowercase=True)
    
    # ============== Document Management ==============
    
    async def upload_document(
        self,
        vendor_id: UUID,
        document_type: DocumentType,
        file: UploadFile,
    ) -> VendorDocument:
        """Upload a verification document."""
        # Validate file
        allowed_types = ["image/jpeg", "image/png", "application/pdf"]
        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid file type. Allowed: JPEG, PNG, PDF"
            )
        
        # Check file size (max 10MB)
        contents = await file.read()
        if len(contents) > 10 * 1024 * 1024:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File too large. Maximum size is 10MB"
            )
        await file.seek(0)
        
        file_url = await self.file_service.upload_file(
            file=file,
            folder=f"vendors/{vendor_id}/documents",
            content=contents,
        )
        
        # Create document record
        document = VendorDocument(
            vendor_id=vendor_id,
            document_type=document_type.value,
            file_url=file_url,
            file_name=file.filename,
            file_size=len(contents),
            mime_type=file.content_type,
            status="pending",
        )
        
        self.db.add(document)
        await self.db.commit()
        await self.db.refresh(document)
        
        return document
    
    async def get_documents(self, vendor_id: UUID) -> List[VendorDocument]:
        """Get all documents for a vendor."""
        return await self.repo.get_documents(vendor_id)
    
    # ============== Bank Account ==============
    
    async def add_bank_account(
        self,
        vendor_id: UUID,
        data: BankAccountCreate,
    ) -> VendorBankAccount:
        """Add a bank account for vendor payouts."""
        # If setting as primary, unset other primary accounts
        if data.is_primary:
            await self.repo.unset_primary_bank_accounts(vendor_id)
        
        account = VendorBankAccount(
            vendor_id=vendor_id,
            bank_name=data.bank_name,
            account_number=data.account_number,
            account_holder_name=data.account_holder_name,
            ifsc_code=data.ifsc_code,
            account_type=data.account_type.value,
            is_primary=data.is_primary,
        )
        
        self.db.add(account)
        await self.db.commit()
        await self.db.refresh(account)
        
        return account
    
    async def get_bank_accounts(self, vendor_id: UUID) -> List[VendorBankAccount]:
        """Get all bank accounts for a vendor."""
        return await self.repo.get_bank_accounts(vendor_id)
    
    # ============== Status Management ==============
    
    async def submit_for_review(self, vendor_id: UUID) -> Vendor:
        """Submit vendor for admin review."""
        vendor = await self.repo.get_by_id(vendor_id)
        if not vendor:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Vendor not found"
            )
        
        # Validate required documents
        documents = await self.get_documents(vendor_id)
        required_types = {"business_registration", "tax_id", "id_proof"}
        uploaded_types = {d.document_type for d in documents}
        
        missing = required_types - uploaded_types
        if missing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Missing required documents: {', '.join(missing)}"
            )
        
        # Validate bank account
        bank_accounts = await self.get_bank_accounts(vendor_id)
        if not any(acc.is_primary for acc in bank_accounts):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Primary bank account is required"
            )
        
        # Update status
        vendor.status = "under_review"
        vendor.verification_status = "documents_submitted"
        await self.db.commit()
        await self.db.refresh(vendor)
        
        # Emit event
        await event_emitter.emit("vendor.submitted_for_review", {
            "vendor_id": str(vendor_id)
        })
        
        return vendor
    
    async def approve_vendor(
        self, 
        vendor_id: UUID, 
        admin_id: UUID
    ) -> Vendor:
        """Approve a vendor (admin only)."""
        vendor = await self.repo.get_by_id(vendor_id)
        if not vendor:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Vendor not found"
            )
        
        mark_vendor_approved_active(vendor)

        await self.db.commit()
        await self.db.refresh(vendor)
        
        # Emit event for notifications
        await event_emitter.emit("vendor.approved", {
            "vendor_id": str(vendor_id),
            "admin_id": str(admin_id)
        })
        
        return vendor
    
    async def reject_vendor(
        self,
        vendor_id: UUID,
        admin_id: UUID,
        reason: str,
    ) -> Vendor:
        """Reject a vendor (admin only)."""
        vendor = await self.repo.get_by_id(vendor_id)
        if not vendor:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Vendor not found"
            )
        
        vendor.status = "rejected"
        vendor.verification_status = "rejected"
        vendor.rejection_reason = reason
        
        await self.db.commit()
        await self.db.refresh(vendor)
        
        # Emit event
        await event_emitter.emit("vendor.rejected", {
            "vendor_id": str(vendor_id),
            "admin_id": str(admin_id),
            "reason": reason
        })
        
        return vendor

    async def delete_vendor(self, vendor_id: UUID, admin_id: UUID) -> None:
        """Permanently delete a business account (superuser only)."""
        vendor = await self.repo.get_by_id(vendor_id)
        if not vendor:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Vendor not found",
            )

        order_count = await self.db.scalar(
            select(func.count()).select_from(Order).where(Order.vendor_id == vendor_id),
        )
        if order_count and order_count > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Cannot delete this business account because it has customer orders. "
                    "Reject or suspend it instead."
                ),
            )

        vu_ids_result = await self.db.execute(
            select(VendorUser.user_id).where(VendorUser.vendor_id == vendor_id),
        )
        owner_ids_result = await self.db.execute(
            select(VendorOwner.user_id).where(VendorOwner.vendor_id == vendor_id),
        )
        linked_user_ids = list(
            {row[0] for row in vu_ids_result.all()}
            | {row[0] for row in owner_ids_result.all()},
        )
        business_name = vendor.business_name

        try:
            await self.db.delete(vendor)
            await self.db.flush()
        except IntegrityError as exc:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Cannot delete this business account because it still has linked records "
                    "(payments, CRM data, etc.). Reject or suspend it instead."
                ),
            ) from exc

        for uid in linked_user_ids:
            user = await self.db.get(User, uid)
            if not user:
                continue
            try:
                await delete_user_if_orphan(self.db, user, force=True)
            except IntegrityError:
                await self.db.rollback()
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        "Business account was removed but the owner login could not be deleted "
                        "(linked orders or platform data). Contact support to free this email."
                    ),
                )

        await self.db.commit()

        await event_emitter.emit(
            "vendor.deleted",
            {
                "vendor_id": str(vendor_id),
                "admin_id": str(admin_id),
                "business_name": business_name,
            },
        )
    
    # ============== Lookup ==============
    
    async def get_by_id(self, vendor_id: UUID) -> Optional[Vendor]:
        """Get vendor by ID."""
        return await self.repo.get_by_id(vendor_id)
    
    async def get_by_user_id(
        self, user_id: UUID, preferred_vendor_id: Optional[UUID] = None
    ) -> Optional[Vendor]:
        """Get vendor for this user (owner or team); optional preferred tenant."""
        return await self.repo.get_by_user_id(user_id, preferred_vendor_id)
    
    async def update(self, vendor_id: UUID, data: VendorUpdate) -> Vendor:
        """Update vendor profile."""
        vendor = await self.repo.get_by_id(vendor_id)
        if not vendor:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Vendor not found"
            )
        
        update_data = data.model_dump(exclude_unset=True)
        if "social_links" in update_data and update_data["social_links"] is not None:
            from app.utils.social_link_normalize import normalize_social_links
            update_data["social_links"] = normalize_social_links(update_data["social_links"])
        for field, value in update_data.items():
            setattr(vendor, field, value)
            if field in ("settings", "theme_config", "store_holidays", "business_hours", "order_acceptance_hours"):
                from sqlalchemy.orm.attributes import flag_modified
                flag_modified(vendor, field)
        
        await self.db.commit()
        await self.db.refresh(vendor)
        
        return vendor
