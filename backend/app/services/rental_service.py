from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from math import ceil
from uuid import UUID
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.rental import RentalAsset, RentalBooking

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
        return max(0.0, cap - occ)

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

    def _asset_dict(self, a: RentalAsset) -> dict:
        available = self._available_capacity(a)
        status = self._derive_asset_status(a)
        return {
            "id": str(a.id),
            "vendor_id": str(a.vendor_id),
            "name": a.name,
            "asset_code": a.asset_code,
            "sku": a.sku,
            "product_id": str(a.product_id) if a.product_id else None,
            "category": a.category or "milk_dairy",
            "asset_type": a.asset_type or "storage_rack",
            "description": a.description,
            "capacity_max": float(a.capacity_max or 0),
            "capacity_unit": a.capacity_unit or "units",
            "current_occupancy": float(a.current_occupancy or 0),
            "available_capacity": available,
            "max_weight": float(a.max_weight) if a.max_weight is not None else None,
            "weight_unit": a.weight_unit or "kg",
            "daily_rate": float(a.daily_rate or 0),
            "weekly_rate": float(a.weekly_rate or 0),
            "monthly_rate": float(a.monthly_rate or 0),
            "deposit_amount": float(a.deposit_amount or 0),
            "extra_qty_charge": float(a.extra_qty_charge or 0),
            "extra_weight_charge": float(a.extra_weight_charge or 0),
            "sales_area_id": str(a.sales_area_id) if a.sales_area_id else None,
            "location": a.location,
            "section": a.section,
            "row_label": a.row_label,
            "rack_number": a.rack_number,
            "image_url": a.image_url,
            "status": status,
            "display_start_date": a.display_start_date.isoformat() if a.display_start_date else None,
            "display_end_date": a.display_end_date.isoformat() if a.display_end_date else None,
            "is_active": bool(a.is_active) if a.is_active is not None else True,
            "notes": a.notes,
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

    async def _next_asset_code(self, vendor_id: UUID) -> str:
        result = await self.db.execute(
            select(func.count()).select_from(RentalAsset).where(RentalAsset.vendor_id == vendor_id)
        )
        n = int(result.scalar() or 0) + 1
        return f"RACK-{n:03d}"

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
        assets = await self.list_assets(vendor_id)
        bookings = await self.list_bookings(vendor_id)

        total = len(assets)
        available = sum(1 for a in assets if a["status"] == "available")
        occupied = sum(1 for a in assets if a["status"] in ("fully_occupied", "partially_occupied", "reserved"))
        maintenance = sum(1 for a in assets if a["status"] == "maintenance")
        pending = sum(1 for b in bookings if b["status"] == "pending")
        revenue = sum(
            float(b["rental_amount"] or 0)
            for b in bookings
            if b["status"] in ("confirmed", "active", "completed") and b.get("payment_status") == "paid"
        )
        # Also count approved paid bookings
        revenue_alt = sum(
            float(b["total_amount"] or 0)
            for b in bookings
            if b["status"] not in ("cancelled", "rejected", "pending")
        )

        return {
            "total_assets": total,
            "available": available,
            "occupied": occupied,
            "partially_occupied": sum(1 for a in assets if a["status"] == "partially_occupied"),
            "maintenance": maintenance,
            "pending_bookings": pending,
            "rental_revenue": round(revenue or revenue_alt, 2),
            "recent_assets": assets[:8],
            "upcoming_bookings": [
                b for b in bookings
                if b["status"] in ACTIVE_BOOKING_STATUSES
            ][:10],
        }

    # ── assets ───────────────────────────────────────────────────

    async def list_assets(self, vendor_id: UUID, status: Optional[str] = None) -> list[dict]:
        result = await self.db.execute(
            select(RentalAsset).where(RentalAsset.vendor_id == vendor_id).order_by(RentalAsset.name)
        )
        items = [self._asset_dict(a) for a in result.scalars().all()]
        if status:
            items = [a for a in items if a["status"] == status]
        return items

    async def get_asset(self, vendor_id: UUID, asset_id: UUID) -> dict:
        return self._asset_dict(await self._get_asset(vendor_id, asset_id))

    async def create_asset(self, vendor_id: UUID, data: dict) -> dict:
        code = data.get("asset_code") or await self._next_asset_code(vendor_id)
        display_start = self._parse_optional_date(data.get("display_start_date") or data.get("start_date"))
        display_end = self._parse_optional_date(data.get("display_end_date") or data.get("end_date"))
        if display_start and display_end and display_end < display_start:
            raise HTTPException(400, "Display end date must be on or after start date")
        asset = RentalAsset(
            vendor_id=vendor_id,
            name=data["name"],
            asset_code=code,
            sku=data.get("sku") or code,
            product_id=UUID(data["product_id"]) if data.get("product_id") else None,
            category=data.get("category") or "milk_dairy",
            asset_type=data.get("asset_type") or "storage_rack",
            description=data.get("description") or data.get("notes"),
            capacity_max=data.get("capacity_max", 1),
            capacity_unit=data.get("capacity_unit") or "units",
            current_occupancy=data.get("current_occupancy", 0),
            max_weight=data.get("max_weight"),
            weight_unit=data.get("weight_unit") or "kg",
            daily_rate=data.get("daily_rate", 0),
            weekly_rate=data.get("weekly_rate", 0),
            monthly_rate=data.get("monthly_rate", 0),
            deposit_amount=data.get("deposit_amount", 0),
            extra_qty_charge=data.get("extra_qty_charge", 0),
            extra_weight_charge=data.get("extra_weight_charge", 0),
            sales_area_id=UUID(data["sales_area_id"]) if data.get("sales_area_id") else None,
            location=data.get("location"),
            section=data.get("section"),
            row_label=data.get("row_label"),
            rack_number=data.get("rack_number"),
            image_url=data.get("image_url"),
            status=data.get("status") or "available",
            display_start_date=display_start,
            display_end_date=display_end,
            notes=data.get("notes"),
            is_active=data.get("is_active", True),
        )
        self._sync_occupancy_status(asset)
        self.db.add(asset)
        await self.db.commit()
        await self.db.refresh(asset)
        return self._asset_dict(asset)

    async def update_asset(self, vendor_id: UUID, asset_id: UUID, data: dict) -> dict:
        asset = await self._get_asset(vendor_id, asset_id)
        fields = [
            "name", "asset_code", "sku", "category", "asset_type", "description",
            "capacity_max", "capacity_unit", "current_occupancy", "max_weight", "weight_unit",
            "daily_rate", "weekly_rate", "monthly_rate", "deposit_amount",
            "extra_qty_charge", "extra_weight_charge",
            "location", "section", "row_label", "rack_number", "image_url",
            "status", "notes", "is_active",
        ]
        for f in fields:
            if f in data:
                setattr(asset, f, data[f])
        if "sales_area_id" in data:
            asset.sales_area_id = UUID(data["sales_area_id"]) if data.get("sales_area_id") else None
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
        self._sync_occupancy_status(asset)
        await self.db.commit()
        await self.db.refresh(asset)
        return self._asset_dict(asset)

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
        days = []
        cur = from_date
        while cur <= to_date:
            day_qty = 0.0
            day_status = "available"
            if asset.status == "maintenance":
                day_status = "maintenance"
            else:
                for b in bookings:
                    if b.start_date <= cur <= b.end_date:
                        day_qty += float(b.quantity or 0)
                avail = float(asset.capacity_max or 0) - day_qty
                if day_qty <= 0:
                    day_status = "available"
                elif avail <= 0:
                    day_status = "booked"
                else:
                    day_status = "partial"
            days.append({
                "date": cur.isoformat(),
                "status": day_status,
                "reserved_qty": day_qty,
                "available_capacity": max(0.0, float(asset.capacity_max or 0) - day_qty),
            })
            cur = cur + timedelta(days=1)
        return days

    # ── bookings ─────────────────────────────────────────────────

    async def list_bookings(
        self, vendor_id: UUID, status: Optional[str] = None, customer_id: Optional[UUID] = None
    ) -> list[dict]:
        q = select(RentalBooking).where(RentalBooking.vendor_id == vendor_id)
        if status:
            q = q.where(RentalBooking.status == status)
        if customer_id:
            q = q.where(RentalBooking.customer_id == customer_id)
        q = q.order_by(RentalBooking.start_date.desc())
        result = await self.db.execute(q)
        bookings = result.scalars().all()
        asset_ids = {b.asset_id for b in bookings}
        assets = {}
        if asset_ids:
            ar = await self.db.execute(select(RentalAsset).where(RentalAsset.id.in_(asset_ids)))
            assets = {a.id: a for a in ar.scalars().all()}
        return [self._booking_dict(b, assets.get(b.asset_id)) for b in bookings]

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
