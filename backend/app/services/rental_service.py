from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from math import ceil
import re
from uuid import UUID
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import select, func, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.rental import RentalAsset, RentalAssetStore, RentalAssetUnit, RentalBooking, RentalReturn

ACTIVE_BOOKING_STATUSES = ("pending", "approved", "confirmed", "active")
# Once approved (or later), display-window / booking date changes must keep covering these.
LOCKED_BOOKING_STATUSES = ("approved", "confirmed", "active")
BOOKABLE_ASSET_STATUSES = ("available", "partially_occupied", "reserved")


class RentalService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── serializers ──────────────────────────────────────────────

    def _available_capacity(self, a: RentalAsset) -> float:
        cap = float(a.capacity_max or 0)
        occ = float(a.current_occupancy or 0)
        # Damaged and lost units are not available for re-rental until repaired/written off
        damaged = float(a.damaged_qty or 0) if hasattr(a, "damaged_qty") else 0.0
        lost = float(a.lost_qty or 0) if hasattr(a, "lost_qty") else 0.0
        return max(0.0, cap - occ - damaged - lost)

    def _derive_asset_status(self, a: RentalAsset) -> str:
        if a.status in ("maintenance", "unavailable", "retired", "reserved"):
            return a.status
        avail = self._available_capacity(a)
        cap = float(a.capacity_max or 0)
        if cap <= 0:
            return a.status or "available"
        if avail <= 0:
            return "fully_occupied"
        if avail < cap:
            return "partially_occupied"
        return "available"

    # ── Slug helpers ──────────────────────────────────────────────

    @staticmethod
    def _slugify(text: str) -> str:
        text = text.lower().strip()
        text = re.sub(r"[^\w\s-]", "", text)
        text = re.sub(r"[\s_-]+", "-", text)
        return text.strip("-")[:120] or "asset"

    async def _slug_exists(self, vendor_id: UUID, slug: str, exclude_id: Optional[UUID] = None) -> bool:
        q = select(func.count()).select_from(RentalAsset).where(
            RentalAsset.vendor_id == vendor_id,
            RentalAsset.slug == slug,
        )
        if exclude_id:
            q = q.where(RentalAsset.id != exclude_id)
        result = await self.db.execute(q)
        return result.scalar_one() > 0

    async def _unique_slug(self, vendor_id: UUID, name: str, asset_code: Optional[str] = None, exclude_id: Optional[UUID] = None) -> str:
        base = self._slugify(name)
        slug = base
        if await self._slug_exists(vendor_id, slug, exclude_id):
            if asset_code:
                slug = f"{base}-{self._slugify(asset_code)}"
            counter = 2
            candidate = slug
            while await self._slug_exists(vendor_id, candidate, exclude_id):
                candidate = f"{slug}-{counter}"
                counter += 1
            slug = candidate
        return slug

    def _asset_dict(self, a: RentalAsset) -> dict:
        available = self._available_capacity(a)
        status = self._derive_asset_status(a)
        return {
            "id": str(a.id),
            "vendor_id": str(a.vendor_id),
            "name": a.name,
            "slug": a.slug if hasattr(a, "slug") else None,
            "asset_code": a.asset_code,
            "sku": a.sku,
            "product_id": str(a.product_id) if a.product_id else None,
            "category": a.category or "milk_dairy",
            "category_id": str(a.category_id) if (hasattr(a, "category_id") and a.category_id) else None,
            "asset_type": a.asset_type or "storage_rack",
            "short_description": getattr(a, "short_description", None),
            "description": a.description,
            "capacity_max": float(a.capacity_max or 0),
            "capacity_unit": a.capacity_unit or "units",
            "current_occupancy": float(a.current_occupancy or 0),
            "damaged_qty": float(a.damaged_qty or 0) if hasattr(a, "damaged_qty") else 0.0,
            "lost_qty": float(a.lost_qty or 0) if hasattr(a, "lost_qty") else 0.0,
            "available_capacity": available,
            "max_weight": float(a.max_weight) if a.max_weight is not None else None,
            "weight_unit": a.weight_unit or "kg",
            "currency": (getattr(a, "currency", None) or "INR").upper(),
            "daily_rate": float(a.daily_rate or 0),
            "weekly_rate": float(a.weekly_rate or 0),
            "monthly_rate": float(a.monthly_rate or 0),
            "deposit_amount": float(a.deposit_amount or 0),
            "extra_qty_charge": float(a.extra_qty_charge or 0),
            "extra_weight_charge": float(a.extra_weight_charge or 0),
            "price_per_unit": float(a.price_per_unit or 0) if hasattr(a, "price_per_unit") else 0.0,
            "pricing_uom": a.pricing_uom if hasattr(a, "pricing_uom") else None,
            "hourly_rate": float(a.hourly_rate or 0) if hasattr(a, "hourly_rate") else 0.0,
            "per_minute_rate": float(a.per_minute_rate or 0) if hasattr(a, "per_minute_rate") else 0.0,
            "yearly_rate": float(a.yearly_rate or 0) if hasattr(a, "yearly_rate") else 0.0,
            "sales_area_id": str(a.sales_area_id) if a.sales_area_id else None,
            "location": a.location,
            "section": a.section,
            "row_label": a.row_label,
            "rack_number": a.rack_number,
            "image_url": a.image_url,
            "media": list(a.media or []) if hasattr(a, "media") else [],
            "status": status,
            "display_start_date": a.display_start_date.isoformat() if a.display_start_date else None,
            "display_end_date": a.display_end_date.isoformat() if a.display_end_date else None,
            "is_active": bool(a.is_active) if a.is_active is not None else True,
            "is_visible": bool(a.is_visible) if hasattr(a, "is_visible") and a.is_visible is not None else True,
            "store_scope": (a.store_scope if hasattr(a, "store_scope") else None) or "all",
            "notes": a.notes,
            "parent_asset_id": str(a.parent_asset_id) if a.parent_asset_id else None,
            "is_bookable": bool(a.is_bookable) if a.is_bookable is not None else True,
            "unit_mode": a.unit_mode or "none",
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }

    def _parse_optional_date(self, value) -> Optional[date]:
        if value is None or value == "":
            return None
        if isinstance(value, date) and not isinstance(value, datetime):
            return value
        if isinstance(value, str):
            return date.fromisoformat(value[:10])
        return None

    def _fmt_date(self, value: Optional[date]) -> str:
        return value.isoformat() if value else "—"

    async def _locked_bookings_for_asset(self, asset_id: UUID) -> list[RentalBooking]:
        result = await self.db.execute(
            select(RentalBooking)
            .where(
                RentalBooking.asset_id == asset_id,
                RentalBooking.status.in_(LOCKED_BOOKING_STATUSES),
            )
            .order_by(RentalBooking.start_date.asc())
        )
        return list(result.scalars().all())

    def _validate_display_window_covers_bookings(
        self,
        display_start: Optional[date],
        display_end: Optional[date],
        bookings: list[RentalBooking],
    ) -> None:
        """Reject display-period changes that exclude approved/confirmed/active bookings."""
        if not bookings:
            return
        for b in bookings:
            ref = b.booking_number or str(b.id)[:8]
            period = f"{self._fmt_date(b.start_date)} → {self._fmt_date(b.end_date)}"
            if display_start and b.start_date and b.start_date < display_start:
                raise HTTPException(
                    400,
                    f"Cannot update display dates: approved booking {ref} "
                    f"({period}) starts before the new start date "
                    f"({self._fmt_date(display_start)}). "
                    f"Set start date on or before {self._fmt_date(b.start_date)}, "
                    f"or cancel/complete the booking first.",
                )
            if display_end and b.end_date and b.end_date > display_end:
                raise HTTPException(
                    400,
                    f"Cannot update display dates: approved booking {ref} "
                    f"({period}) ends after the new end date "
                    f"({self._fmt_date(display_end)}). "
                    f"Set end date on or after {self._fmt_date(b.end_date)}, "
                    f"or cancel/complete the booking first.",
                )

    def _booking_within_display_window(self, asset: RentalAsset, start: date, end: date) -> Optional[str]:
        """Return an error message if booking dates fall outside the asset display period."""
        if asset.display_start_date and start < asset.display_start_date:
            return (
                f"Booking start ({self._fmt_date(start)}) is before this asset's display start "
                f"({self._fmt_date(asset.display_start_date)}). "
                f"Choose a start date on or after {self._fmt_date(asset.display_start_date)}, "
                f"or widen the asset display period."
            )
        if asset.display_end_date and end > asset.display_end_date:
            return (
                f"Booking end ({self._fmt_date(end)}) is after this asset's display end "
                f"({self._fmt_date(asset.display_end_date)}). "
                f"Choose an end date on or before {self._fmt_date(asset.display_end_date)}, "
                f"or widen the asset display period."
            )
        if asset.display_start_date and end < asset.display_start_date:
            return "Booking is outside this asset's display period"
        if asset.display_end_date and start > asset.display_end_date:
            return "Booking is outside this asset's display period"
        return None

    def _ensure_display_window_covers_booking(self, asset: RentalAsset, start: date, end: date) -> bool:
        """Expand asset display window so it covers the booking. Returns True if changed."""
        changed = False
        if asset.display_start_date and start < asset.display_start_date:
            asset.display_start_date = start
            changed = True
        elif asset.display_start_date is None and asset.display_end_date is not None:
            # End bound only — set start so the approved booking is covered.
            asset.display_start_date = start
            changed = True
        if asset.display_end_date and end > asset.display_end_date:
            asset.display_end_date = end
            changed = True
        elif asset.display_end_date is None and asset.display_start_date is not None:
            asset.display_end_date = end
            changed = True
        return changed

    def _is_visible_on_storefront(self, a: dict, on_day: Optional[date] = None) -> bool:
        """List asset on storefront until its display window ends.

        Upcoming date ranges (start in the future) still appear so customers can
        see Available dates and book within that window. Only expired end dates hide the asset.
        """
        day = on_day or date.today()
        end = a.get("display_end_date")
        if end:
            end_d = date.fromisoformat(str(end)[:10]) if not isinstance(end, date) else end
            if day > end_d:
                return False
        return True

    def _booking_dict(self, b: RentalBooking, asset: Optional[RentalAsset] = None) -> dict:
        d = {
            "id": str(b.id),
            "vendor_id": str(b.vendor_id),
            "customer_id": str(b.customer_id) if b.customer_id else None,
            "sales_area_id": str(b.sales_area_id) if b.sales_area_id else None,
            "asset_id": str(b.asset_id),
            "booking_number": b.booking_number,
            "customer_name": b.customer_name,
            "customer_email": b.customer_email,
            "customer_phone": b.customer_phone,
            "quantity": float(b.quantity or 0),
            "weight_requested": float(b.weight_requested) if b.weight_requested is not None else None,
            "pricing_plan": b.pricing_plan or "daily",
            "start_date": b.start_date.isoformat() if b.start_date else None,
            "end_date": b.end_date.isoformat() if b.end_date else None,
            "status": b.status,
            "rental_amount": float(b.rental_amount or 0),
            "deposit_amount": float(b.deposit_amount or 0),
            "total_amount": float(b.total_amount or 0),
            "payment_status": b.payment_status or "unpaid",
            "payment_method": b.payment_method,
            "payment_reference": b.payment_reference,
            "paid_at": b.paid_at.isoformat() if b.paid_at else None,
            "delivery_status": b.delivery_status or "not_required",
            "van_number": b.van_number,
            "van_driver_name": b.van_driver_name,
            "van_driver_phone": b.van_driver_phone,
            "van_vehicle_type": b.van_vehicle_type,
            "estimated_delivery_at": b.estimated_delivery_at.isoformat() if b.estimated_delivery_at else None,
            "delivered_at": b.delivered_at.isoformat() if b.delivered_at else None,
            "delivery_notes": b.delivery_notes,
            "delivery_address": b.delivery_address,
            # Return fields
            "returned_at": b.returned_at.isoformat() if b.returned_at else None,
            "quantity_returned": float(b.quantity_returned) if b.quantity_returned is not None else None,
            "outstanding_quantity": round(float(b.quantity or 0) - float(b.quantity_returned or 0), 6),
            "return_condition": b.return_condition,
            "damage_charge": float(b.damage_charge or 0),
            "late_fee": float(b.late_fee or 0),
            "deposit_refunded": float(b.deposit_refunded or 0),
            "return_notes": b.return_notes,
            "timeline": b.timeline or [],
            "notes": b.notes,
            "created_at": b.created_at.isoformat() if b.created_at else None,
        }
        if asset:
            d["asset_name"] = asset.name
            d["asset_code"] = asset.asset_code
            d["asset_location"] = asset.location
            d["capacity_unit"] = asset.capacity_unit
            d["capacity_max"] = float(asset.capacity_max or 0)
        return d

    # ── helpers ──────────────────────────────────────────────────

    async def _get_asset(self, vendor_id: UUID, asset_id: UUID) -> RentalAsset:
        result = await self.db.execute(
            select(RentalAsset).where(RentalAsset.id == asset_id, RentalAsset.vendor_id == vendor_id)
        )
        asset = result.scalar_one_or_none()
        if not asset:
            raise HTTPException(404, "Rental asset not found")
        return asset

    async def _asset_code_prefix(self, vendor_id: UUID) -> str:
        """Generic master-ID prefix (default AST). Configurable via rental_settings.asset_code_prefix."""
        prefix = "AST"
        try:
            from app.models.vendor import Vendor
            result = await self.db.execute(select(Vendor.settings).where(Vendor.id == vendor_id))
            settings = result.scalar_one_or_none() or {}
            rs = (settings or {}).get("rental_settings") or {}
            raw = str(rs.get("asset_code_prefix") or "AST").strip().upper().rstrip("-")
            if raw:
                prefix = re.sub(r"[^A-Z0-9]", "", raw)[:6] or "AST"
        except Exception:
            pass
        return prefix

    async def _next_asset_code(self, vendor_id: UUID) -> str:
        prefix = await self._asset_code_prefix(vendor_id)
        result = await self.db.execute(
            select(func.count()).select_from(RentalAsset).where(RentalAsset.vendor_id == vendor_id)
        )
        n = int(result.scalar() or 0) + 1
        return f"{prefix}-{n:03d}"

    async def _next_booking_number(self, vendor_id: UUID) -> str:
        result = await self.db.execute(
            select(func.count()).select_from(RentalBooking).where(RentalBooking.vendor_id == vendor_id)
        )
        n = int(result.scalar() or 0) + 1
        return f"RB-{n:04d}"

    def _append_timeline(self, booking: RentalBooking, event: str, detail: str = ""):
        timeline = list(booking.timeline or [])
        timeline.append({
            "event": event,
            "detail": detail,
            "at": datetime.now(timezone.utc).isoformat(),
        })
        booking.timeline = timeline

    def _calc_rental_amount(self, asset: RentalAsset, start: date, end: date, plan: str, quantity: float) -> float:
        days = (end - start).days + 1
        if days < 1:
            days = 1
        plan = (plan or "daily").lower()
        if plan == "monthly" and float(asset.monthly_rate or 0) > 0:
            months = max(1, ceil(days / 30))
            base = float(asset.monthly_rate) * months
        elif plan == "weekly" and float(asset.weekly_rate or 0) > 0:
            weeks = max(1, ceil(days / 7))
            base = float(asset.weekly_rate) * weeks
        else:
            base = float(asset.daily_rate or 0) * days
            plan = "daily"
        # Extra quantity beyond a "base unit" of 1 is optional surcharge for dairy racks
        extra_qty = max(0.0, quantity - 1) * float(asset.extra_qty_charge or 0)
        return round(base + extra_qty, 2)

    async def _reserved_qty_for_range(
        self, asset_id: UUID, start: date, end: date, exclude_booking_id: Optional[UUID] = None
    ) -> float:
        q = select(func.coalesce(func.sum(RentalBooking.quantity), 0)).where(
            RentalBooking.asset_id == asset_id,
            RentalBooking.status.in_(ACTIVE_BOOKING_STATUSES),
            RentalBooking.start_date <= end,
            RentalBooking.end_date >= start,
        )
        if exclude_booking_id:
            q = q.where(RentalBooking.id != exclude_booking_id)
        result = await self.db.execute(q)
        return float(result.scalar() or 0)

    def _sync_occupancy_status(self, asset: RentalAsset):
        derived = self._derive_asset_status(asset)
        if asset.status not in ("maintenance", "unavailable", "retired"):
            asset.status = derived

    # ── dashboard ────────────────────────────────────────────────

    async def get_dashboard(self, vendor_id: UUID) -> dict:
        # Asset status counts — one aggregation query instead of fetching all rows
        asset_status_result = await self.db.execute(
            select(RentalAsset.status, func.count().label("cnt"))
            .where(RentalAsset.vendor_id == vendor_id)
            .group_by(RentalAsset.status)
        )
        status_counts: dict[str, int] = {}
        for row in asset_status_result.all():
            status_counts[row.status or "available"] = int(row.cnt)

        total = sum(status_counts.values())
        available = status_counts.get("available", 0)
        partially_occupied = status_counts.get("partially_occupied", 0)
        fully_occupied = status_counts.get("fully_occupied", 0)
        reserved = status_counts.get("reserved", 0)
        occupied = fully_occupied + partially_occupied + reserved
        maintenance = status_counts.get("maintenance", 0)

        # Booking counts + revenue — one aggregation query
        booking_agg_result = await self.db.execute(
            select(
                RentalBooking.status,
                func.count().label("cnt"),
                func.sum(RentalBooking.total_amount).label("total_amount_sum"),
            )
            .where(RentalBooking.vendor_id == vendor_id)
            .group_by(RentalBooking.status)
        )
        pending = 0
        revenue = 0.0
        for row in booking_agg_result.all():
            if row.status == "pending":
                pending = int(row.cnt)
            if row.status in ("confirmed", "active", "completed", "approved"):
                revenue += float(row.total_amount_sum or 0)

        # Small tail queries: 8 recent assets and 10 upcoming active bookings
        recent_assets_result = await self.db.execute(
            select(RentalAsset)
            .where(RentalAsset.vendor_id == vendor_id)
            .order_by(RentalAsset.created_at.desc())
            .limit(8)
        )
        recent_assets = [self._asset_dict(a) for a in recent_assets_result.scalars().all()]

        upcoming_result = await self.db.execute(
            select(RentalBooking)
            .where(
                RentalBooking.vendor_id == vendor_id,
                RentalBooking.status.in_(ACTIVE_BOOKING_STATUSES),
            )
            .order_by(RentalBooking.start_date.asc())
            .limit(10)
        )
        upcoming_raw = upcoming_result.scalars().all()
        asset_ids = {b.asset_id for b in upcoming_raw}
        assets_by_id: dict = {}
        if asset_ids:
            ar = await self.db.execute(select(RentalAsset).where(RentalAsset.id.in_(asset_ids)))
            assets_by_id = {a.id: a for a in ar.scalars().all()}
        upcoming_bookings = [self._booking_dict(b, assets_by_id.get(b.asset_id)) for b in upcoming_raw]

        return {
            "total_assets": total,
            "available": available,
            "occupied": occupied,
            "partially_occupied": partially_occupied,
            "maintenance": maintenance,
            "pending_bookings": pending,
            "rental_revenue": round(revenue, 2),
            "recent_assets": recent_assets,
            "upcoming_bookings": upcoming_bookings,
        }

    # ── assets ───────────────────────────────────────────────────

    async def list_assets(
        self,
        vendor_id: UUID,
        status: Optional[str] = None,
        category: Optional[str] = None,
        category_id: Optional[str] = None,
        q: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> list[dict]:
        query = select(RentalAsset).where(RentalAsset.vendor_id == vendor_id)
        if is_active is not None:
            query = query.where(RentalAsset.is_active == is_active)
        if category:
            query = query.where(RentalAsset.category == category)
        if category_id:
            query = query.where(RentalAsset.category_id == UUID(category_id))
        if q:
            like = f"%{q.lower()}%"
            from sqlalchemy import or_
            query = query.where(
                or_(
                    func.lower(RentalAsset.name).like(like),
                    func.lower(RentalAsset.asset_code).like(like),
                    func.lower(RentalAsset.location).like(like),
                    func.lower(RentalAsset.rack_number).like(like),
                )
            )
        query = query.order_by(RentalAsset.name)
        result = await self.db.execute(query)
        items = [self._asset_dict(a) for a in result.scalars().all()]
        # Status is derived in Python (capacity-based), so filter post-serialization
        if status:
            items = [a for a in items if a["status"] == status]

        # Annotate each asset with child_count (hierarchy) and unit_count (serialized)
        asset_ids = [UUID(a["id"]) for a in items]
        if asset_ids:
            child_rows = await self.db.execute(
                select(RentalAsset.parent_asset_id, func.count(RentalAsset.id).label("cnt"))
                .where(RentalAsset.parent_asset_id.in_(asset_ids))
                .group_by(RentalAsset.parent_asset_id)
            )
            child_counts: dict[str, int] = {str(r.parent_asset_id): r.cnt for r in child_rows}

            unit_rows = await self.db.execute(
                select(RentalAssetUnit.asset_id, func.count(RentalAssetUnit.id).label("cnt"))
                .where(RentalAssetUnit.asset_id.in_(asset_ids))
                .group_by(RentalAssetUnit.asset_id)
            )
            unit_counts: dict[str, int] = {str(r.asset_id): r.cnt for r in unit_rows}

            for a in items:
                a["child_count"] = child_counts.get(a["id"], 0)
                a["unit_count"] = unit_counts.get(a["id"], 0)

        return items

    async def get_asset(self, vendor_id: UUID, asset_id: UUID) -> dict:
        return self._asset_dict(await self._get_asset(vendor_id, asset_id))

    # ── Public / catalog-facing methods ─────────────────────────────────────

    def _storefront_where(self, vendor_id: UUID, store_id: Optional[UUID] = None):
        """Return SQLAlchemy WHERE clauses for the public catalog listing."""
        today = date.today()
        clauses = [
            RentalAsset.vendor_id == vendor_id,
            RentalAsset.is_active.is_(True),
            RentalAsset.is_visible.is_(True),
            # Exclude hard-unavailable states; capacity-derived statuses (fully_occupied, etc.)
            # are computed in Python, so we keep those rows and let _derive_asset_status decide.
            RentalAsset.status.notin_(["maintenance", "unavailable", "retired"]),
            # Display window: hide only when end date has passed.
            or_(
                RentalAsset.display_end_date.is_(None),
                RentalAsset.display_end_date >= today,
            ),
        ]
        if store_id:
            from app.services.catalog_store_scope import rental_asset_available_at_store
            clauses.append(rental_asset_available_at_store(store_id))
        return clauses

    async def list_catalog_assets(
        self,
        vendor_id: UUID,
        *,
        page: int = 1,
        size: int = 20,
        search: Optional[str] = None,
        category: Optional[str] = None,
        min_daily_rate: Optional[float] = None,
        max_daily_rate: Optional[float] = None,
        store_id: Optional[UUID] = None,
    ) -> tuple[list[dict], int]:
        """Paginated public catalog list — mirrors GET /catalog/products pattern."""
        where = self._storefront_where(vendor_id, store_id)

        if search:
            like = f"%{search.lower()}%"
            where.append(or_(
                func.lower(RentalAsset.name).like(like),
                func.lower(RentalAsset.description).like(like),
                func.lower(RentalAsset.location).like(like),
                func.lower(RentalAsset.asset_code).like(like),
            ))
        if category:
            where.append(func.lower(RentalAsset.category) == category.lower())
        if min_daily_rate is not None:
            where.append(RentalAsset.daily_rate >= min_daily_rate)
        if max_daily_rate is not None:
            where.append(RentalAsset.daily_rate <= max_daily_rate)

        count_q = select(func.count()).select_from(RentalAsset).where(*where)
        total = (await self.db.execute(count_q)).scalar_one()

        skip = (page - 1) * size
        items_q = (
            select(RentalAsset)
            .where(*where)
            .order_by(RentalAsset.name)
            .offset(skip)
            .limit(size)
        )
        rows = (await self.db.execute(items_q)).scalars().all()
        items = [self._asset_dict(r) for r in rows]
        return items, total

    async def get_catalog_asset_by_slug(self, vendor_id: UUID, slug: str) -> Optional[dict]:
        """Fetch a single asset by slug for the public catalog; applies all visibility gates."""
        where = self._storefront_where(vendor_id)
        where.append(RentalAsset.slug == slug)
        result = await self.db.execute(select(RentalAsset).where(*where))
        asset = result.scalar_one_or_none()
        if not asset:
            return None
        return self._asset_dict(asset)

    async def create_asset(self, vendor_id: UUID, data: dict) -> dict:
        code = data.get("asset_code") or await self._next_asset_code(vendor_id)
        display_start = self._parse_optional_date(data.get("display_start_date") or data.get("start_date"))
        display_end = self._parse_optional_date(data.get("display_end_date") or data.get("end_date"))
        if display_start and display_end and display_end < display_start:
            raise HTTPException(400, "Display end date must be on or after start date")
        slug = data.get("slug") or await self._unique_slug(vendor_id, data["name"], code)
        asset = RentalAsset(
            vendor_id=vendor_id,
            name=data["name"],
            slug=slug,
            asset_code=code,
            sku=data.get("sku") or code,
            product_id=UUID(data["product_id"]) if data.get("product_id") else None,
            category=data.get("category") or "milk_dairy",
            category_id=UUID(data["category_id"]) if data.get("category_id") else None,
            asset_type=data.get("asset_type") or "storage_rack",
            short_description=data.get("short_description") or None,
            description=data.get("description") or data.get("notes"),
            capacity_max=data.get("capacity_max", 1),
            capacity_unit=data.get("capacity_unit") or "units",
            current_occupancy=data.get("current_occupancy", 0),
            max_weight=data.get("max_weight"),
            weight_unit=data.get("weight_unit") or "kg",
            currency=(data.get("currency") or "INR").upper()[:3],
            daily_rate=data.get("daily_rate", 0),
            weekly_rate=data.get("weekly_rate", 0),
            monthly_rate=data.get("monthly_rate", 0),
            deposit_amount=data.get("deposit_amount", 0),
            extra_qty_charge=data.get("extra_qty_charge", 0),
            extra_weight_charge=data.get("extra_weight_charge", 0),
            price_per_unit=data.get("price_per_unit", 0),
            pricing_uom=data.get("pricing_uom") or None,
            hourly_rate=data.get("hourly_rate", 0),
            per_minute_rate=data.get("per_minute_rate", 0),
            yearly_rate=data.get("yearly_rate", 0),
            sales_area_id=UUID(data["sales_area_id"]) if data.get("sales_area_id") else None,
            location=data.get("location"),
            section=data.get("section"),
            row_label=data.get("row_label"),
            rack_number=data.get("rack_number"),
            image_url=data.get("image_url"),
            media=data.get("media") or [],
            status=data.get("status") or "available",
            display_start_date=display_start,
            display_end_date=display_end,
            notes=data.get("notes"),
            is_active=data.get("is_active", True),
            is_visible=data.get("is_visible", True),
            store_scope=data.get("store_scope") or "all",
            parent_asset_id=UUID(data["parent_asset_id"]) if data.get("parent_asset_id") else None,
            is_bookable=data.get("is_bookable", True),
            unit_mode=data.get("unit_mode") or "none",
        )
        self._sync_occupancy_status(asset)
        self.db.add(asset)
        await self.db.commit()
        await self.db.refresh(asset)

        # Sync store assignments when store_scope="selected"
        store_scope = data.get("store_scope") or "all"
        store_ids = data.get("store_ids")
        if store_scope == "selected" and store_ids is not None:
            from app.services.catalog_store_scope import sync_rental_asset_stores
            await sync_rental_asset_stores(self.db, vendor_id, asset.id, store_scope, store_ids)
            await self.db.commit()

        return self._asset_dict(asset)

    async def update_asset(self, vendor_id: UUID, asset_id: UUID, data: dict) -> dict:
        asset = await self._get_asset(vendor_id, asset_id)
        fields = [
            "asset_code", "sku", "category", "asset_type", "short_description", "description",
            "capacity_max", "capacity_unit", "max_weight", "weight_unit",
            "currency",
            "daily_rate", "weekly_rate", "monthly_rate", "deposit_amount",
            "extra_qty_charge", "extra_weight_charge",
            "price_per_unit", "pricing_uom",
            "hourly_rate", "per_minute_rate", "yearly_rate",
            "location", "section", "row_label", "rack_number", "image_url",
            "status", "notes", "is_active", "is_visible", "store_scope",
            "is_bookable", "unit_mode",
        ]
        for f in fields:
            if f in data:
                val = data[f]
                if f == "currency" and val is not None:
                    val = str(val).upper()[:3] or "INR"
                setattr(asset, f, val)
        # Re-slug when name changes (or explicit slug provided)
        if "name" in data:
            asset.name = data["name"]
            new_slug = data.get("slug") or await self._unique_slug(
                vendor_id, data["name"], asset.asset_code, exclude_id=asset_id
            )
            asset.slug = new_slug
        elif "slug" in data and data["slug"]:
            candidate = self._slugify(data["slug"])
            if await self._slug_exists(vendor_id, candidate, exclude_id=asset_id):
                raise HTTPException(400, f"Slug '{candidate}' is already in use")
            asset.slug = candidate
        if "sales_area_id" in data:
            asset.sales_area_id = UUID(data["sales_area_id"]) if data.get("sales_area_id") else None
        if "parent_asset_id" in data:
            raw = data.get("parent_asset_id")
            if raw and str(raw) != str(asset.id):  # prevent self-reference
                asset.parent_asset_id = UUID(str(raw))
            else:
                asset.parent_asset_id = None
        # Always apply display window when present (including explicit null to clear).
        dates_touched = False
        if "display_start_date" in data or "start_date" in data:
            raw_start = data["display_start_date"] if "display_start_date" in data else data.get("start_date")
            asset.display_start_date = self._parse_optional_date(raw_start)
            dates_touched = True
        if "display_end_date" in data or "end_date" in data:
            raw_end = data["display_end_date"] if "display_end_date" in data else data.get("end_date")
            asset.display_end_date = self._parse_optional_date(raw_end)
            dates_touched = True
        if asset.display_start_date and asset.display_end_date and asset.display_end_date < asset.display_start_date:
            raise HTTPException(400, "Display end date must be on or after start date")
        if dates_touched:
            locked = await self._locked_bookings_for_asset(asset.id)
            self._validate_display_window_covers_bookings(
                asset.display_start_date, asset.display_end_date, locked
            )
        if "product_id" in data:
            asset.product_id = UUID(data["product_id"]) if data.get("product_id") else None
        if "category_id" in data:
            asset.category_id = UUID(data["category_id"]) if data.get("category_id") else None
        self._sync_occupancy_status(asset)
        await self.db.commit()
        await self.db.refresh(asset)

        # Sync store assignments whenever store_scope or store_ids is touched
        if "store_scope" in data or "store_ids" in data:
            scope = data.get("store_scope") or getattr(asset, "store_scope", "all") or "all"
            store_ids = data.get("store_ids")
            from app.services.catalog_store_scope import sync_rental_asset_stores
            await sync_rental_asset_stores(self.db, vendor_id, asset.id, scope, store_ids)
            await self.db.commit()

        return self._asset_dict(asset)

    async def delete_asset(self, vendor_id: UUID, asset_id: UUID) -> None:
        """Delete a rental asset.

        Guard: refuses if there are active bookings (pending/approved/confirmed/active).
        """
        asset = await self._get_asset(vendor_id, asset_id)
        active = await self.db.execute(
            select(func.count()).select_from(RentalBooking).where(
                RentalBooking.asset_id == asset_id,
                RentalBooking.status.in_(ACTIVE_BOOKING_STATUSES),
            )
        )
        if active.scalar_one() > 0:
            raise HTTPException(
                409,
                "Cannot delete: this asset has active or pending bookings. "
                "Cancel or complete them first.",
            )
        await self.db.delete(asset)
        await self.db.commit()

    def list_storefront_assets(self, assets: list[dict]) -> list[dict]:
        today = date.today()
        return [
            a for a in assets
            if a.get("is_active", True)
            and a.get("status") in ("available", "partially_occupied", "reserved", None)
            and self._is_visible_on_storefront(a, today)
        ]

    # ── availability calendar ────────────────────────────────────

    async def get_availability_calendar(
        self, vendor_id: UUID, asset_id: UUID, from_date: date, to_date: date
    ) -> list[dict]:
        asset = await self._get_asset(vendor_id, asset_id)
        result = await self.db.execute(
            select(RentalBooking).where(
                RentalBooking.asset_id == asset.id,
                RentalBooking.status.in_((*ACTIVE_BOOKING_STATUSES, "completed")),
                RentalBooking.start_date <= to_date,
                RentalBooking.end_date >= from_date,
            )
        )
        bookings = result.scalars().all()
        # Pre-compute reserved qty per day in O(bookings × booking_length) instead of
        # O(days × bookings) — dramatically faster for long date ranges.
        day_qty: dict[date, float] = {}
        for b in bookings:
            cur_b = b.start_date
            while cur_b <= b.end_date:
                if from_date <= cur_b <= to_date:
                    day_qty[cur_b] = day_qty.get(cur_b, 0.0) + float(b.quantity or 0)
                cur_b = cur_b + timedelta(days=1)

        days = []
        cap = float(asset.capacity_max or 0)
        is_maintenance = asset.status == "maintenance"
        cur = from_date
        while cur <= to_date:
            qty = day_qty.get(cur, 0.0)
            avail = max(0.0, cap - qty)
            if is_maintenance:
                day_status = "maintenance"
            elif qty <= 0:
                day_status = "available"
            elif avail <= 0:
                day_status = "booked"
            else:
                day_status = "partial"
            days.append({
                "date": cur.isoformat(),
                "status": day_status,
                "reserved_qty": qty,
                "available_capacity": avail,
            })
            cur = cur + timedelta(days=1)
        return days

    # ── bookings ─────────────────────────────────────────────────

    async def list_bookings(
        self,
        vendor_id: UUID,
        status: Optional[str] = None,
        customer_id: Optional[UUID] = None,
        asset_id: Optional[UUID] = None,
        customer_email: Optional[str] = None,
        unlinked_email_only: bool = False,
        limit: Optional[int] = None,
        offset: int = 0,
    ) -> list[dict]:
        q = select(RentalBooking).where(RentalBooking.vendor_id == vendor_id)
        if status:
            # "in_progress" is a convenience group for all returnable statuses
            if status == "in_progress":
                q = q.where(RentalBooking.status.in_(("pending", "approved", "confirmed", "active")))
            else:
                q = q.where(RentalBooking.status == status)
        if customer_id:
            q = q.where(RentalBooking.customer_id == customer_id)
        if asset_id:
            q = q.where(RentalBooking.asset_id == asset_id)
        if customer_email:
            email = customer_email.strip().lower()
            q = q.where(func.lower(RentalBooking.customer_email) == email)
            if unlinked_email_only:
                q = q.where(RentalBooking.customer_id.is_(None))
        q = q.order_by(RentalBooking.start_date.desc(), RentalBooking.created_at.desc())
        if offset:
            q = q.offset(offset)
        if limit:
            q = q.limit(limit)
        result = await self.db.execute(q)
        bookings = result.scalars().all()
        asset_ids = {b.asset_id for b in bookings}
        assets_map: dict = {}
        if asset_ids:
            ar = await self.db.execute(select(RentalAsset).where(RentalAsset.id.in_(asset_ids)))
            assets_map = {a.id: a for a in ar.scalars().all()}
        return [self._booking_dict(b, assets_map.get(b.asset_id)) for b in bookings]

    async def get_booking(self, vendor_id: UUID, booking_id: UUID) -> dict:
        result = await self.db.execute(
            select(RentalBooking).where(RentalBooking.id == booking_id, RentalBooking.vendor_id == vendor_id)
        )
        booking = result.scalar_one_or_none()
        if not booking:
            raise HTTPException(404, "Rental booking not found")
        asset = await self._get_asset(vendor_id, booking.asset_id)
        return self._booking_dict(booking, asset)

    async def search_available_assets(
        self,
        vendor_id: UUID,
        *,
        quantity: float = 1,
        weight: Optional[float] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        category: Optional[str] = None,
    ) -> list[dict]:
        assets = await self.list_assets(vendor_id)
        out = []
        today = date.today()
        for a in assets:
            if not a.get("is_active", True):
                continue
            if a["status"] in ("maintenance", "unavailable", "retired", "fully_occupied"):
                continue
            if not self._is_visible_on_storefront(a, today):
                continue
            if category and a.get("category") != category:
                continue
            if float(a["available_capacity"]) < quantity:
                continue
            if weight is not None and a.get("max_weight") is not None and weight > float(a["max_weight"]):
                continue
            if start_date and end_date:
                reserved = await self._reserved_qty_for_range(UUID(a["id"]), start_date, end_date)
                free = float(a["capacity_max"]) - reserved
                if free < quantity:
                    continue
                a = {**a, "available_capacity": free, "period_reserved_qty": reserved}
            out.append(a)
        return out

    async def create_booking(self, vendor_id: UUID, data: dict) -> dict:
        asset = await self._get_asset(vendor_id, UUID(data["asset_id"]))
        if asset.status in ("maintenance", "unavailable", "retired"):
            raise HTTPException(400, "Asset is not available for booking")

        vendor_created = bool(
            data.get("created_by_vendor")
            or data.get("source") in ("vendor", "admin", "vendor_admin")
        )

        if not data.get("customer_name"):
            raise HTTPException(400, "Customer name is required")

        start = date.fromisoformat(data["start_date"]) if isinstance(data["start_date"], str) else data["start_date"]
        end = date.fromisoformat(data["end_date"]) if isinstance(data["end_date"], str) else data["end_date"]
        if end < start:
            raise HTTPException(400, "End date must be on or after start date")
        if start < date.today():
            raise HTTPException(400, "Start date cannot be in the past")
        window_err = self._booking_within_display_window(asset, start, end)
        if window_err:
            raise HTTPException(400, window_err)
        # Storefront must respect listing window; vendor desk can book listed or upcoming assets.
        if not vendor_created and not self._is_visible_on_storefront(self._asset_dict(asset)):
            raise HTTPException(400, "This asset is not currently listed for booking")

        quantity = float(data.get("quantity") or 1)
        if quantity <= 0:
            raise HTTPException(400, "Quantity must be greater than zero")
        if quantity > float(asset.capacity_max or 0):
            raise HTTPException(400, f"Requested quantity exceeds rack capacity ({asset.capacity_max})")

        weight = data.get("weight_requested")
        if weight is not None:
            weight = float(weight)
            if asset.max_weight is not None and weight > float(asset.max_weight):
                raise HTTPException(400, f"Requested weight exceeds maximum ({asset.max_weight} {asset.weight_unit})")

        reserved = await self._reserved_qty_for_range(asset.id, start, end)
        free = float(asset.capacity_max or 0) - reserved
        if quantity > free:
            raise HTTPException(409, f"Only {free:g} {asset.capacity_unit} available for those dates")

        plan = data.get("pricing_plan") or "daily"
        rental_amount = self._calc_rental_amount(asset, start, end, plan, quantity)
        if weight and float(asset.extra_weight_charge or 0) > 0:
            rental_amount += round(weight * float(asset.extra_weight_charge), 2)
        deposit = float(asset.deposit_amount or 0)
        total = round(rental_amount + deposit, 2)

        customer_id = UUID(data["customer_id"]) if data.get("customer_id") else None
        sales_area_id = (
            UUID(data["sales_area_id"]) if data.get("sales_area_id")
            else asset.sales_area_id
        )

        # Credit gate: clear prior dues + respect credit / max-payment limits
        from app.services.crm.credit_gate import (
            adjust_outstanding,
            assert_credit_allows_booking,
        )
        credit_row = await assert_credit_allows_booking(
            self.db,
            vendor_id,
            amount=Decimal(str(total)),
            customer_id=customer_id,
            party_name=data.get("customer_name"),
            party_phone=data.get("customer_phone"),
        )

        needs_delivery = bool(data.get("needs_delivery") or data.get("delivery_address"))
        initial_status = "pending"
        if vendor_created and data.get("auto_approve"):
            initial_status = "approved"
        elif vendor_created and data.get("status") in ("pending", "approved", "confirmed"):
            initial_status = data["status"]

        booking = RentalBooking(
            vendor_id=vendor_id,
            customer_id=customer_id,
            sales_area_id=sales_area_id,
            asset_id=asset.id,
            booking_number=await self._next_booking_number(vendor_id),
            customer_name=data["customer_name"],
            customer_email=data.get("customer_email"),
            customer_phone=data.get("customer_phone"),
            quantity=Decimal(str(quantity)),
            weight_requested=Decimal(str(weight)) if weight is not None else None,
            pricing_plan=plan,
            start_date=start,
            end_date=end,
            rental_amount=Decimal(str(rental_amount)),
            deposit_amount=Decimal(str(deposit)),
            total_amount=Decimal(str(total)),
            payment_status="unpaid",
            delivery_status="pending" if needs_delivery else "not_required",
            delivery_address=data.get("delivery_address"),
            notes=data.get("notes"),
            status=initial_status,
            timeline=[],
        )
        if vendor_created:
            self._append_timeline(booking, "Vendor Created", "Booking added by vendor admin")
            if initial_status == "approved":
                if booking.start_date and booking.end_date:
                    self._ensure_display_window_covers_booking(asset, booking.start_date, booking.end_date)
                self._append_timeline(booking, "Admin Approved", "Auto-approved when created by vendor")
        else:
            self._append_timeline(booking, "Booking Requested", "Customer submitted rental request")

        # Unpaid booking increases outstanding (cleared when payment recorded as paid)
        await adjust_outstanding(self.db, credit_row, Decimal(str(total)))

        self.db.add(booking)
        await self.db.commit()
        await self.db.refresh(booking)
        return self._booking_dict(booking, asset)

    async def update_booking_status(self, vendor_id: UUID, booking_id: UUID, status: str) -> dict:
        result = await self.db.execute(
            select(RentalBooking).where(RentalBooking.id == booking_id, RentalBooking.vendor_id == vendor_id)
        )
        booking = result.scalar_one_or_none()
        if not booking:
            raise HTTPException(404, "Rental booking not found")

        allowed = {"pending", "approved", "confirmed", "active", "completed", "cancelled", "rejected", "returned"}
        if status not in allowed:
            raise HTTPException(400, f"Invalid status: {status}")

        # Map legacy "returned" → completed
        if status == "returned":
            status = "completed"

        prev = booking.status
        booking.status = status
        asset = await self._get_asset(vendor_id, booking.asset_id)
        qty = float(booking.quantity or 0)

        if status == "approved":
            # Keep asset display period covering the approved booking dates.
            if booking.start_date and booking.end_date:
                if self._ensure_display_window_covers_booking(asset, booking.start_date, booking.end_date):
                    self._append_timeline(
                        booking,
                        "Display Period Updated",
                        f"Asset display dates expanded to cover "
                        f"{self._fmt_date(booking.start_date)} → {self._fmt_date(booking.end_date)}",
                    )
            self._append_timeline(booking, "Admin Approved", "Vendor approved the booking")
        elif status == "confirmed":
            self._append_timeline(booking, "Booking Confirmed", "Booking confirmed after payment/approval")
            if asset.status not in ("maintenance", "unavailable", "retired"):
                asset.status = "reserved"
        elif status == "active":
            self._append_timeline(booking, "Rental Active", "Asset allocated and rental period started")
            asset.current_occupancy = Decimal(str(float(asset.current_occupancy or 0) + qty))
            self._sync_occupancy_status(asset)
        elif status == "completed":
            self._append_timeline(booking, "Rental Completed", "Rental period finished")
            if prev == "active":
                asset.current_occupancy = Decimal(str(max(0.0, float(asset.current_occupancy or 0) - qty)))
            self._sync_occupancy_status(asset)
        elif status in ("cancelled", "rejected"):
            label = "Cancelled" if status == "cancelled" else "Rejected"
            self._append_timeline(booking, label, f"Booking {status}")
            if prev == "active":
                asset.current_occupancy = Decimal(str(max(0.0, float(asset.current_occupancy or 0) - qty)))
            self._sync_occupancy_status(asset)

        await self.db.commit()
        await self.db.refresh(booking)
        return self._booking_dict(booking, asset)

    async def extend_booking(self, vendor_id: UUID, booking_id: UUID, new_end_date: date) -> dict:
        result = await self.db.execute(
            select(RentalBooking).where(RentalBooking.id == booking_id, RentalBooking.vendor_id == vendor_id)
        )
        booking = result.scalar_one_or_none()
        if not booking:
            raise HTTPException(404, "Rental booking not found")
        if booking.status not in ("approved", "confirmed", "active"):
            raise HTTPException(
                400,
                f"Cannot update dates: booking is '{booking.status}'. "
                f"Only approved, confirmed, or active bookings can be extended.",
            )
        if new_end_date <= booking.end_date:
            raise HTTPException(400, "New end date must be after current end date")

        asset = await self._get_asset(vendor_id, booking.asset_id)
        window_err = self._booking_within_display_window(asset, booking.start_date, new_end_date)
        if window_err:
            raise HTTPException(
                400,
                f"Cannot extend booking dates. {window_err}",
            )
        # Check capacity for the extended window only
        ext_start = booking.end_date + timedelta(days=1)
        reserved = await self._reserved_qty_for_range(asset.id, ext_start, new_end_date, booking.id)
        free = float(asset.capacity_max or 0) - reserved
        if float(booking.quantity or 0) > free:
            raise HTTPException(409, "Insufficient capacity for the extended period")

        booking.end_date = new_end_date
        rental_amount = self._calc_rental_amount(
            asset, booking.start_date, new_end_date, booking.pricing_plan or "daily", float(booking.quantity or 1)
        )
        booking.rental_amount = Decimal(str(rental_amount))
        booking.total_amount = Decimal(str(round(rental_amount + float(booking.deposit_amount or 0), 2)))
        self._append_timeline(booking, "Rental Extended", f"Extended to {new_end_date.isoformat()}")
        await self.db.commit()
        await self.db.refresh(booking)
        return self._booking_dict(booking, asset)

    async def record_payment(self, vendor_id: UUID, booking_id: UUID, data: dict) -> dict:
        result = await self.db.execute(
            select(RentalBooking).where(RentalBooking.id == booking_id, RentalBooking.vendor_id == vendor_id)
        )
        booking = result.scalar_one_or_none()
        if not booking:
            raise HTTPException(404, "Rental booking not found")

        prev_status = booking.payment_status or "unpaid"
        booking.payment_status = data.get("payment_status") or "paid"
        booking.payment_method = data.get("payment_method")
        booking.payment_reference = data.get("payment_reference") or f"PAY-{booking.booking_number}"
        booking.paid_at = datetime.now(timezone.utc)
        self._append_timeline(booking, "Payment Received", f"Via {booking.payment_method or 'online'}")

        if booking.status == "approved":
            booking.status = "confirmed"
            self._append_timeline(booking, "Booking Confirmed", "Auto-confirmed after payment")
        elif booking.status == "pending" and data.get("auto_confirm"):
            booking.status = "confirmed"
            self._append_timeline(booking, "Booking Confirmed", "Confirmed with payment")

        # Clear outstanding when fully paid
        if booking.payment_status == "paid" and prev_status != "paid":
            from app.services.crm.credit_gate import adjust_outstanding, find_credit_control
            credit_row = await find_credit_control(
                self.db,
                vendor_id,
                customer_id=booking.customer_id,
                party_name=booking.customer_name,
                party_phone=booking.customer_phone,
            )
            await adjust_outstanding(
                self.db, credit_row, -Decimal(str(booking.total_amount or 0))
            )
        elif booking.payment_status == "partial" and prev_status == "unpaid":
            # Partial: leave remaining due — reduce outstanding by paid portion if provided
            paid_amt = data.get("amount_paid")
            if paid_amt is not None:
                from app.services.crm.credit_gate import adjust_outstanding, find_credit_control
                credit_row = await find_credit_control(
                    self.db,
                    vendor_id,
                    customer_id=booking.customer_id,
                    party_name=booking.customer_name,
                    party_phone=booking.customer_phone,
                )
                await adjust_outstanding(self.db, credit_row, -Decimal(str(paid_amt)))

        asset = await self._get_asset(vendor_id, booking.asset_id)
        if booking.status == "confirmed" and asset.status not in ("maintenance", "unavailable", "retired"):
            asset.status = "reserved"

        await self.db.commit()
        await self.db.refresh(booking)
        return self._booking_dict(booking, asset)

    async def update_delivery(self, vendor_id: UUID, booking_id: UUID, data: dict) -> dict:
        result = await self.db.execute(
            select(RentalBooking).where(RentalBooking.id == booking_id, RentalBooking.vendor_id == vendor_id)
        )
        booking = result.scalar_one_or_none()
        if not booking:
            raise HTTPException(404, "Rental booking not found")

        for f in (
            "delivery_status", "van_number", "van_driver_name", "van_driver_phone",
            "van_vehicle_type", "delivery_notes", "delivery_address",
        ):
            if f in data:
                setattr(booking, f, data[f])

        if data.get("estimated_delivery_at"):
            raw = data["estimated_delivery_at"]
            booking.estimated_delivery_at = (
                datetime.fromisoformat(raw.replace("Z", "+00:00")) if isinstance(raw, str) else raw
            )
        if data.get("delivery_status") == "delivered":
            booking.delivered_at = datetime.now(timezone.utc)
            self._append_timeline(booking, "Delivered", f"Van {booking.van_number or ''} delivered")
        elif data.get("delivery_status") == "assigned":
            self._append_timeline(
                booking, "Van Assigned",
                f"{booking.van_number or 'Van'} · {booking.van_driver_name or 'Driver'}",
            )
        elif data.get("delivery_status") == "in_transit":
            self._append_timeline(booking, "In Transit", f"Van {booking.van_number or ''} en route")

        asset = await self._get_asset(vendor_id, booking.asset_id)
        await self.db.commit()
        await self.db.refresh(booking)
        return self._booking_dict(booking, asset)

    async def process_return(self, vendor_id: UUID, booking_id: UUID, data: dict) -> dict:
        """Record the physical return of a rented asset (full or partial).

        Body fields:
          quantity_returned  – how many units came back (defaults to full booking qty)
          return_condition   – good | damaged | missing
          damage_charge      – extra charge for damage (defaults to 0)
          return_notes       – free-text note
        The late-fee is computed automatically from the daily rate when the asset
        is returned after its scheduled end_date. The deposit is settled:
          deposit_refunded = deposit_amount - damage_charge - late_fee  (min 0)
        """
        result = await self.db.execute(
            select(RentalBooking).where(RentalBooking.id == booking_id, RentalBooking.vendor_id == vendor_id)
        )
        booking = result.scalar_one_or_none()
        if not booking:
            raise HTTPException(404, "Rental booking not found")

        if booking.status not in ("active", "approved", "confirmed"):
            raise HTTPException(
                400,
                f"Cannot process return: booking is '{booking.status}'. "
                "Only active, approved, or confirmed bookings can be returned.",
            )

        asset = await self._get_asset(vendor_id, booking.asset_id)
        # booking.quantity is the originally booked amount — never mutated
        total_qty = float(booking.quantity or 1)
        already_returned = float(booking.quantity_returned or 0)
        outstanding_qty = round(total_qty - already_returned, 6)
        if outstanding_qty <= 0:
            raise HTTPException(400, "All units for this booking have already been returned")

        qty_returned = float(data.get("quantity_returned") or outstanding_qty)
        if qty_returned <= 0 or qty_returned > outstanding_qty + 1e-6:
            raise HTTPException(400, f"quantity_returned must be between 0.01 and {outstanding_qty}")

        condition = data.get("return_condition") or "good"
        if condition not in ("good", "damaged", "missing"):
            raise HTTPException(400, "return_condition must be one of: good, damaged, missing")

        now = datetime.now(timezone.utc)
        today_date = now.date()

        # Late-fee: each day past end_date charged at daily_rate (min 0)
        days_late = max(0, (today_date - booking.end_date).days) if booking.end_date else 0
        daily_rate = float(asset.daily_rate or 0)
        late_fee = round(days_late * daily_rate, 2)

        damage_charge = round(float(data.get("damage_charge") or 0), 2)
        deposit = float(booking.deposit_amount or 0)
        deposit_refunded = round(max(0.0, deposit - damage_charge - late_fee), 2)

        prev_status = booking.status

        # Adjust occupancy for the returned quantity (always: occupancy tracks rented-out units)
        if prev_status == "active":
            current_occ = float(asset.current_occupancy or 0)
            asset.current_occupancy = Decimal(str(max(0.0, current_occ - qty_returned)))

        # Condition-based pool accounting:
        #   good    → units go back into available capacity (no extra counter needed)
        #   damaged → units enter the damaged pool; require repair before re-rental
        #   missing → units are permanently lost from the pool
        if condition == "damaged":
            asset.damaged_qty = Decimal(str(round(float(asset.damaged_qty or 0) + qty_returned, 6)))
        elif condition == "missing":
            asset.lost_qty = Decimal(str(round(float(asset.lost_qty or 0) + qty_returned, 6)))

        self._sync_occupancy_status(asset)

        # Accumulate returned quantity; keep booking.quantity immutable
        new_total_returned = round(already_returned + qty_returned, 6)
        booking.quantity_returned = Decimal(str(new_total_returned))
        booking.returned_at = now
        booking.return_condition = condition
        booking.damage_charge = Decimal(str(damage_charge))
        booking.late_fee = Decimal(str(late_fee))
        booking.deposit_refunded = Decimal(str(deposit_refunded))
        booking.return_notes = data.get("return_notes") or None

        # Determine booking status
        qty_still_out = round(total_qty - new_total_returned, 6)
        if qty_still_out > 0.001:
            new_status = "active"
        else:
            new_status = "completed"
            booking.status = new_status

        # Build timeline detail
        detail_parts = [
            f"Qty returned: {qty_returned} of {total_qty} (outstanding: {outstanding_qty})",
            f"Condition: {condition}",
        ]
        if days_late > 0:
            detail_parts.append(f"Late by {days_late} day(s) · Late fee: ₹{late_fee:,.2f}")
        if damage_charge > 0:
            detail_parts.append(f"Damage charge: ₹{damage_charge:,.2f}")
        detail_parts.append(f"Deposit refunded: ₹{deposit_refunded:,.2f}")
        if qty_still_out > 0.001:
            detail_parts.append(f"Partial return — {qty_still_out:.4g} unit(s) still out")

        self._append_timeline(
            booking,
            "Asset Returned" if qty_still_out <= 0.001 else "Partial Return",
            " · ".join(detail_parts),
        )

        # Write immutable return history record
        unit_ids = data.get("unit_ids") or []
        return_record = RentalReturn(
            booking_id=booking.id,
            vendor_id=vendor_id,
            quantity_returned=Decimal(str(qty_returned)),
            return_condition=condition,
            damage_charge=Decimal(str(damage_charge)),
            late_fee=Decimal(str(late_fee)),
            deposit_refunded=Decimal(str(deposit_refunded)),
            return_notes=data.get("return_notes") or None,
            unit_ids=unit_ids,
        )
        self.db.add(return_record)

        # If serialized units were specified, mark them as returned
        if unit_ids:
            unit_result = await self.db.execute(
                select(RentalAssetUnit).where(
                    RentalAssetUnit.id.in_([UUID(u) for u in unit_ids]),
                    RentalAssetUnit.vendor_id == vendor_id,
                )
            )
            for unit in unit_result.scalars().all():
                if condition == "damaged":
                    unit.condition = "damaged"
                    unit.status = "maintenance"
                elif condition == "missing":
                    unit.condition = "lost"
                    unit.status = "retired"
                else:
                    unit.status = "available"

        # Adjust outstanding if there are extra charges (damage / late fee)
        extra_charges = damage_charge + late_fee
        if extra_charges > 0:
            from app.services.crm.credit_gate import adjust_outstanding, find_credit_control
            credit_row = await find_credit_control(
                self.db,
                vendor_id,
                customer_id=booking.customer_id,
                party_name=booking.customer_name,
                party_phone=booking.customer_phone,
            )
            await adjust_outstanding(self.db, credit_row, Decimal(str(extra_charges)))

        await self.db.commit()
        await self.db.refresh(booking)
        return self._booking_dict(booking, asset)

    # ── Sub-asset helpers ─────────────────────────────────────────────

    def _unit_dict(self, u: RentalAssetUnit) -> dict:
        return {
            "id": str(u.id),
            "asset_id": str(u.asset_id),
            "vendor_id": str(u.vendor_id),
            "serial_no": u.serial_no,
            "label": u.label,
            "condition": u.condition or "good",
            "status": u.status or "available",
            "notes": u.notes,
            "created_at": u.created_at.isoformat() if u.created_at else None,
            "updated_at": u.updated_at.isoformat() if u.updated_at else None,
        }

    async def list_asset_children(self, vendor_id: UUID, parent_id: UUID) -> list[dict]:
        result = await self.db.execute(
            select(RentalAsset).where(
                RentalAsset.vendor_id == vendor_id,
                RentalAsset.parent_asset_id == parent_id,
            ).order_by(RentalAsset.name)
        )
        return [self._asset_dict(a) for a in result.scalars().all()]

    async def list_asset_units(self, vendor_id: UUID, asset_id: UUID) -> list[dict]:
        await self._get_asset(vendor_id, asset_id)  # ownership check
        result = await self.db.execute(
            select(RentalAssetUnit).where(
                RentalAssetUnit.asset_id == asset_id,
                RentalAssetUnit.vendor_id == vendor_id,
            ).order_by(RentalAssetUnit.serial_no)
        )
        return [self._unit_dict(u) for u in result.scalars().all()]

    async def create_asset_unit(self, vendor_id: UUID, asset_id: UUID, data: dict) -> dict:
        asset = await self._get_asset(vendor_id, asset_id)
        if asset.unit_mode != "serialized":
            raise HTTPException(400, "Asset unit_mode must be 'serialized' to add units")
        if not data.get("serial_no"):
            raise HTTPException(400, "serial_no is required")
        unit = RentalAssetUnit(
            asset_id=asset_id,
            vendor_id=vendor_id,
            serial_no=data["serial_no"],
            label=data.get("label"),
            condition=data.get("condition") or "good",
            status=data.get("status") or "available",
            notes=data.get("notes"),
        )
        self.db.add(unit)
        await self.db.commit()
        await self.db.refresh(unit)
        return self._unit_dict(unit)

    async def update_asset_unit(self, vendor_id: UUID, asset_id: UUID, unit_id: UUID, data: dict) -> dict:
        await self._get_asset(vendor_id, asset_id)  # ownership check
        result = await self.db.execute(
            select(RentalAssetUnit).where(
                RentalAssetUnit.id == unit_id,
                RentalAssetUnit.asset_id == asset_id,
                RentalAssetUnit.vendor_id == vendor_id,
            )
        )
        unit = result.scalar_one_or_none()
        if not unit:
            raise HTTPException(404, "Unit not found")
        for f in ("serial_no", "label", "condition", "status", "notes"):
            if f in data:
                setattr(unit, f, data[f])
        await self.db.commit()
        await self.db.refresh(unit)
        return self._unit_dict(unit)

    async def bulk_create_asset_units(self, vendor_id: UUID, asset_id: UUID, data: dict) -> list[dict]:
        """Create a sequence of serialized units in one call.

        Body:
          prefix    – leading text, e.g. "AST-" or "CYL"  (may be empty)
          start     – first sequence number (int, default 1)
          end       – last sequence number (int, default start)
          padding   – zero-pad width, e.g. 3 → "001". 0 = no padding
          suffix    – optional trailing text after the number
          condition – good | damaged (default "good")

        Examples:
          {prefix:"CYL-", start:1, end:10, padding:3} → CYL-001 … CYL-010
          {prefix:"",     start:5, end:8,  padding:0, suffix:" Van"} → 5 Van … 8 Van
        """
        asset = await self._get_asset(vendor_id, asset_id)
        if asset.unit_mode != "serialized":
            raise HTTPException(400, "Asset unit_mode must be 'serialized' to bulk-add units")

        prefix = str(data.get("prefix") or "")
        suffix = str(data.get("suffix") or "")
        start = int(data.get("start") or 1)
        end = int(data.get("end") or start)
        padding = max(0, int(data.get("padding") or 0))
        condition = data.get("condition") or "good"

        if start < 1:
            raise HTTPException(400, "start must be >= 1")
        if end < start:
            raise HTTPException(400, "end must be >= start")
        count = end - start + 1
        if count > 500:
            raise HTTPException(400, "Cannot bulk-create more than 500 units at once")

        units = []
        for n in range(start, end + 1):
            num_str = str(n).zfill(padding) if padding > 0 else str(n)
            serial_no = f"{prefix}{num_str}{suffix}"
            unit = RentalAssetUnit(
                asset_id=asset_id,
                vendor_id=vendor_id,
                serial_no=serial_no,
                condition=condition,
                status="available",
            )
            self.db.add(unit)
            units.append(unit)

        await self.db.commit()
        for unit in units:
            await self.db.refresh(unit)
        return [self._unit_dict(u) for u in units]

    async def delete_asset_unit(self, vendor_id: UUID, asset_id: UUID, unit_id: UUID) -> dict:
        await self._get_asset(vendor_id, asset_id)  # ownership check
        result = await self.db.execute(
            select(RentalAssetUnit).where(
                RentalAssetUnit.id == unit_id,
                RentalAssetUnit.asset_id == asset_id,
                RentalAssetUnit.vendor_id == vendor_id,
            )
        )
        unit = result.scalar_one_or_none()
        if not unit:
            raise HTTPException(404, "Unit not found")
        if unit.status == "rented":
            raise HTTPException(400, "Cannot delete a unit that is currently rented out")
        await self.db.delete(unit)
        await self.db.commit()
        return {"ok": True}

    # ── Return history ─────────────────────────────────────────────────

    def _return_dict(self, r: RentalReturn) -> dict:
        return {
            "id": str(r.id),
            "booking_id": str(r.booking_id),
            "quantity_returned": float(r.quantity_returned),
            "return_condition": r.return_condition,
            "damage_charge": float(r.damage_charge or 0),
            "late_fee": float(r.late_fee or 0),
            "deposit_refunded": float(r.deposit_refunded or 0),
            "return_notes": r.return_notes,
            "unit_ids": r.unit_ids or [],
            "returned_at": r.returned_at.isoformat() if r.returned_at else None,
        }

    async def list_return_history(self, vendor_id: UUID, booking_id: UUID) -> list[dict]:
        # Verify ownership
        result = await self.db.execute(
            select(RentalBooking).where(
                RentalBooking.id == booking_id,
                RentalBooking.vendor_id == vendor_id,
            )
        )
        if not result.scalar_one_or_none():
            raise HTTPException(404, "Rental booking not found")
        result = await self.db.execute(
            select(RentalReturn).where(
                RentalReturn.booking_id == booking_id,
                RentalReturn.vendor_id == vendor_id,
            ).order_by(RentalReturn.returned_at.asc())
        )
        return [self._return_dict(r) for r in result.scalars().all()]

    async def customer_pay(self, vendor_id: UUID, booking_id: UUID, customer_id: UUID, data: dict) -> dict:
        result = await self.db.execute(
            select(RentalBooking).where(
                RentalBooking.id == booking_id,
                RentalBooking.vendor_id == vendor_id,
                RentalBooking.customer_id == customer_id,
            )
        )
        booking = result.scalar_one_or_none()
        if not booking:
            raise HTTPException(404, "Rental booking not found")
        return await self.record_payment(vendor_id, booking_id, {
            "payment_status": "paid",
            "payment_method": data.get("payment_method") or "online",
            "payment_reference": data.get("payment_reference"),
            "auto_confirm": True,
        })
