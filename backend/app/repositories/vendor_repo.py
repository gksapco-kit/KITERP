# app/repositories/vendor_repo.py
from typing import Optional, List, Dict, Any
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_, func, literal_column, cast, Float
from sqlalchemy.orm import selectinload

from app.models.vendor import Vendor, VendorDocument, VendorBankAccount, VendorOwner
from app.models.vendor_user import VendorUser
from app.repositories.base import BaseRepository
from app.utils.geo import bounding_box


class VendorRepository(BaseRepository[Vendor]):
    """Repository for vendor operations."""
    
    def __init__(self, db: AsyncSession):
        super().__init__(Vendor, db)
    
    async def get_by_id(self, id: UUID) -> Optional[Vendor]:
        """Get vendor by ID with relationships."""
        result = await self.db.execute(
            select(Vendor)
            .options(
                selectinload(Vendor.documents),
                selectinload(Vendor.bank_accounts),
                selectinload(Vendor.owners),
                selectinload(Vendor.relationship_manager),
            )
            .where(Vendor.id == id)
        )
        return result.scalar_one_or_none()
    
    async def slug_exists(self, slug: str) -> bool:
        """Check if a slug already exists."""
        result = await self.db.execute(
            select(func.count()).select_from(Vendor).where(Vendor.slug == slug)
        )
        return result.scalar_one() > 0
    
    async def subdomain_exists(self, subdomain: str) -> bool:
        """Check if a subdomain already exists."""
        result = await self.db.execute(
            select(func.count()).select_from(Vendor).where(Vendor.subdomain == subdomain)
        )
        return result.scalar_one() > 0
    
    async def find_by_slug(self, slug: str) -> Optional[Vendor]:
        """Find vendor by slug."""
        result = await self.db.execute(
            select(Vendor).where(Vendor.slug == slug)
        )
        return result.scalar_one_or_none()

    async def find_by_slug_ci(self, slug: str) -> Optional[Vendor]:
        """Find vendor by slug (case-insensitive)."""
        if not slug or not str(slug).strip():
            return None
        norm = str(slug).strip().lower()
        result = await self.db.execute(
            select(Vendor).where(func.lower(Vendor.slug) == norm)
        )
        return result.scalar_one_or_none()

    async def list_vendor_summaries_for_user_ids(self, user_ids: List[UUID]) -> List[Dict[str, Any]]:
        """Distinct businesses (slug + name) where these users have an active vendor_user row."""
        if not user_ids:
            return []
        result = await self.db.execute(
            select(Vendor.slug, Vendor.business_name)
            .join(VendorUser, VendorUser.vendor_id == Vendor.id)
            .where(
                VendorUser.user_id.in_(user_ids),
                VendorUser.is_active.is_(True),
            )
            .distinct()
        )
        rows = result.all()
        seen: set[str] = set()
        out: List[Dict[str, Any]] = []
        for slug, name in rows:
            if not slug:
                continue
            s = str(slug)
            if s in seen:
                continue
            seen.add(s)
            out.append({"slug": s, "name": str(name or s)})
        out.sort(key=lambda x: str(x.get("name") or "").lower())
        return out

    async def find_by_subdomain_or_domain(
        self,
        subdomain: Optional[str],
        custom_domain: Optional[str]
    ) -> Optional[Vendor]:
        """Find vendor by subdomain or custom domain."""
        conditions = []
        if subdomain:
            conditions.append(Vendor.subdomain == subdomain)
        if custom_domain:
            conditions.append(
                and_(
                    Vendor.custom_domain == custom_domain,
                    Vendor.domain_verified == True
                )
            )
        
        if not conditions:
            return None
        
        result = await self.db.execute(
            select(Vendor).where(or_(*conditions))
        )
        return result.scalar_one_or_none()
    
    async def get_by_user_id(
        self, user_id: UUID, preferred_vendor_id: Optional[UUID] = None
    ) -> Optional[Vendor]:
        """Resolve vendor for this user: primary VendorOwner row, else active VendorUser membership.

        When ``preferred_vendor_id`` is set (from ``X-Vendor-Id``), prefer membership / ownership
        on that vendor so platform staff can work in the correct tenant.
        """
        if preferred_vendor_id is not None:
            # Duplicate vendor_user rows (same user+vendor) break scalar_one_or_none(); pick one row.
            result = await self.db.execute(
                select(Vendor)
                .join(VendorUser, VendorUser.vendor_id == Vendor.id)
                .where(
                    and_(
                        VendorUser.user_id == user_id,
                        VendorUser.vendor_id == preferred_vendor_id,
                        VendorUser.is_active.is_(True),
                    )
                )
                .order_by(VendorUser.created_at.desc())
                .limit(1)
            )
            hit = result.scalars().first()
            if hit:
                return hit

            result = await self.db.execute(
                select(Vendor)
                .join(VendorOwner)
                .where(
                    and_(
                        Vendor.id == preferred_vendor_id,
                        VendorOwner.user_id == user_id,
                        VendorOwner.is_primary == True,
                    )
                )
                .order_by(VendorOwner.created_at.desc())
                .limit(1)
            )
            owner_hit = result.scalars().first()
            if owner_hit:
                return owner_hit

        # User may own multiple businesses (multiple primary rows) — never require exactly one.
        result = await self.db.execute(
            select(Vendor)
            .join(VendorOwner)
            .where(
                and_(
                    VendorOwner.user_id == user_id,
                    VendorOwner.is_primary == True,
                )
            )
            .order_by(Vendor.created_at.asc())
            .limit(1)
        )
        vendor = result.scalars().first()
        if vendor:
            return vendor

        result = await self.db.execute(
            select(Vendor)
            .join(VendorUser, VendorUser.vendor_id == Vendor.id)
            .where(and_(VendorUser.user_id == user_id, VendorUser.is_active.is_(True)))
            .order_by(VendorUser.created_at.asc())
            .limit(1)
        )
        return result.scalars().first()
    
    async def get_documents(self, vendor_id: UUID) -> List[VendorDocument]:
        """Get all documents for a vendor."""
        result = await self.db.execute(
            select(VendorDocument)
            .where(VendorDocument.vendor_id == vendor_id)
            .order_by(VendorDocument.created_at.desc())
        )
        return list(result.scalars().all())
    
    async def get_bank_accounts(self, vendor_id: UUID) -> List[VendorBankAccount]:
        """Get all bank accounts for a vendor."""
        result = await self.db.execute(
            select(VendorBankAccount)
            .where(VendorBankAccount.vendor_id == vendor_id)
            .order_by(VendorBankAccount.is_primary.desc())
        )
        return list(result.scalars().all())
    
    async def unset_primary_bank_accounts(self, vendor_id: UUID) -> None:
        """Unset primary flag on all bank accounts for vendor."""
        result = await self.db.execute(
            select(VendorBankAccount)
            .where(
                and_(
                    VendorBankAccount.vendor_id == vendor_id,
                    VendorBankAccount.is_primary == True
                )
            )
        )
        for account in result.scalars().all():
            account.is_primary = False
    
    async def list_vendors(
        self,
        skip: int = 0,
        limit: int = 20,
        status: Optional[str] = None,
        search: Optional[str] = None,
        relationship_manager_user_id: Optional[UUID] = None,
    ) -> tuple[List[Vendor], int]:
        """List vendors with filters and pagination."""
        query = select(Vendor).options(selectinload(Vendor.relationship_manager))
        count_query = select(func.count()).select_from(Vendor)

        if relationship_manager_user_id is not None:
            query = query.where(Vendor.relationship_manager_user_id == relationship_manager_user_id)
            count_query = count_query.where(
                Vendor.relationship_manager_user_id == relationship_manager_user_id
            )

        if status:
            query = query.where(Vendor.status == status)
            count_query = count_query.where(Vendor.status == status)

        if search:
            term = f"%{search}%"
            search_filter = or_(
                Vendor.business_name.ilike(term),
                Vendor.display_name.ilike(term),
                Vendor.slug.ilike(term),
                Vendor.primary_email.ilike(term),
                Vendor.primary_phone.ilike(term),
            )
            query = query.where(search_filter)
            count_query = count_query.where(search_filter)
        
        # Get total count
        count_result = await self.db.execute(count_query)
        total = count_result.scalar_one()
        
        # Get items
        query = query.order_by(Vendor.created_at.desc()).offset(skip).limit(limit)
        result = await self.db.execute(query)
        items = list(result.scalars().all())
        
        return items, total

    async def get_admin_dashboard_stats(self) -> dict:
        """Counts only (no full Vendor row load). Works even when ORM row shape is wide."""
        total = (
            await self.db.execute(select(func.count()).select_from(Vendor))
        ).scalar_one()
        approved = (
            await self.db.execute(
                select(func.count()).select_from(Vendor).where(Vendor.status == "approved")
            )
        ).scalar_one()
        pending_review = (
            await self.db.execute(
                select(func.count())
                .select_from(Vendor)
                .where(Vendor.status.in_(["pending", "under_review"]))
            )
        ).scalar_one()
        return {
            "total": int(total),
            "approved": int(approved),
            "pending_review": int(pending_review),
        }

    async def find_nearby(
        self,
        user_lat: float,
        user_lon: float,
        radius_km: Optional[float] = None,
        skip: int = 0,
        limit: int = 20,
        search: Optional[str] = None,
        offering_type: Optional[str] = None,
    ) -> tuple[List[dict], int]:
        """
        Find approved vendors whose service radius reaches the user's location.

        Uses a bounding-box pre-filter (fast index scan) then Haversine for
        precise distance.  Returns dicts with an extra ``distance_km`` key.
        If *radius_km* is None, each vendor's own service_radius_km is used.
        """
        # SQL-level Haversine expression
        haver = (
            literal_column("6371.0")
            * func.acos(
                func.least(
                    literal_column("1.0"),
                    func.cos(func.radians(cast(Vendor.latitude, Float)))
                    * func.cos(func.radians(user_lat))
                    * func.cos(func.radians(user_lon) - func.radians(cast(Vendor.longitude, Float)))
                    + func.sin(func.radians(cast(Vendor.latitude, Float)))
                    * func.sin(func.radians(user_lat)),
                )
            )
        )

        # Base filter: approved + has coordinates
        base_filter = and_(
            Vendor.status == "approved",
            Vendor.latitude.isnot(None),
            Vendor.longitude.isnot(None),
        )

        # Bounding-box pre-filter (generous to not miss anyone)
        max_radius = radius_km or 500  # generous upper bound for box
        bbox = bounding_box(user_lat, user_lon, max_radius)
        bbox_filter = and_(
            cast(Vendor.latitude, Float) >= bbox["min_lat"],
            cast(Vendor.latitude, Float) <= bbox["max_lat"],
            cast(Vendor.longitude, Float) >= bbox["min_lon"],
            cast(Vendor.longitude, Float) <= bbox["max_lon"],
        )

        combined = and_(base_filter, bbox_filter)

        # If a fixed radius is given use it, otherwise compare per-vendor
        if radius_km is not None:
            distance_filter = haver <= radius_km
        else:
            distance_filter = haver <= cast(Vendor.service_radius_km, Float)

        combined = and_(combined, distance_filter)

        if search:
            combined = and_(
                combined,
                or_(
                    Vendor.business_name.ilike(f"%{search}%"),
                    Vendor.display_name.ilike(f"%{search}%"),
                ),
            )

        if offering_type:
            combined = and_(
                combined,
                or_(
                    Vendor.offering_type == offering_type,
                    Vendor.offering_type == "both",
                ),
            )

        # Count
        count_q = select(func.count()).select_from(Vendor).where(combined)
        total = (await self.db.execute(count_q)).scalar_one()

        # Items with distance
        q = (
            select(Vendor, haver.label("distance_km"))
            .where(combined)
            .order_by(haver.asc())
            .offset(skip)
            .limit(limit)
        )
        rows = (await self.db.execute(q)).all()

        results: List[dict] = []
        for vendor, dist in rows:
            results.append({
                "vendor": vendor,
                "distance_km": round(dist, 2),
            })

        return results, total

    async def list_storefront_directory(
        self,
        search: Optional[str] = None,
        skip: int = 0,
        limit: int = 60,
    ) -> tuple[List[Vendor], int]:
        """Vendors visible on the public path storefront (approved or legacy active)."""
        live = Vendor.status.in_(("approved", "active"))
        query = select(Vendor).where(live)
        count_query = select(func.count()).select_from(Vendor).where(live)
        if search and search.strip():
            term = f"%{search.strip()}%"
            filt = or_(
                Vendor.slug.ilike(term),
                Vendor.business_name.ilike(term),
                Vendor.display_name.ilike(term),
            )
            query = query.where(filt)
            count_query = count_query.where(filt)
        total = (await self.db.execute(count_query)).scalar_one()
        query = (
            query.order_by(Vendor.slug.asc())
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(query)
        items = list(result.scalars().all())
        return items, total
