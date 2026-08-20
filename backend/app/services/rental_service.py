from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from math import ceil
import re
from uuid import UUID
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import select, func, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.rental import RentalAsset, RentalAssetStore, RentalAssetUnit, RentalBooking, RentalBookingUnit, RentalReturn

ACTIVE_BOOKING_STATUSES = ("pending", "approved", "confirmed", "active")
# Once approved (or later), display-window / booking date changes must keep covering these.
LOCKED_BOOKING_STATUSES = ("approved", "confirmed", "active")
BOOKABLE_ASSET_STATUSES = ("available", "partially_occupied", "reserved")


def _normalize_duration_rates(raw, hourly=0, per_minute=0) -> list[dict]:
    rows: list[dict] = []
    if isinstance(raw, list):
        for item in raw:
            if not isinstance(item, dict):
                continue
            try:
                minutes = int(float(item.get("minutes") or 0))
                rate = float(item.get("rate") or 0)
            except (TypeError, ValueError):
                continue
            if minutes > 0 and rate > 0:
                rows.append({"minutes": minutes, "rate": round(rate, 2)})
    by_min: dict[int, dict] = {}
    for row in rows:
        by_min[row["minutes"]] = row
    rows = sorted(by_min.values(), key=lambda r: r["minutes"])
    if not rows:
        if float(per_minute or 0) > 0:
            rows.append({"minutes": 1, "rate": float(per_minute)})
        if float(hourly or 0) > 0:
            rows.append({"minutes": 60, "rate": float(hourly)})
    return rows


def _duration_legacy_rates(rows: list[dict]) -> tuple[float, float]:
    hourly = next((r["rate"] for r in rows if r["minutes"] == 60), 0.0)
    per_minute = next((r["rate"] for r in rows if r["minutes"] == 1), 0.0)
    return float(hourly or 0), float(per_minute or 0)


def _parse_duration_plan_minutes(plan: str) -> Optional[int]:
    p = (plan or "").lower()
    if p == "per_minute":
        return 1
    if p == "hourly":
        return 60
    if p.startswith("dur_"):
        try:
            minutes = int(p[4:])
        except ValueError:
            return None
        return minutes if minutes > 0 else None
    return None


def _asset_duration_rates(asset: RentalAsset) -> list[dict]:
    return _normalize_duration_rates(
        getattr(asset, "duration_rates", None),
        float(getattr(asset, "hourly_rate", 0) or 0),
        float(getattr(asset, "per_minute_rate", 0) or 0),
    )


def _normalize_period_rates(raw, daily=0, weekly=0, monthly=0, yearly=0) -> list[dict]:
    rows: list[dict] = []
    if isinstance(raw, list):
        for item in raw:
            if not isinstance(item, dict):
                continue
            try:
                days = int(float(item.get("days") or 0))
                rate = float(item.get("rate") or 0)
            except (TypeError, ValueError):
                continue
            if days > 0 and rate > 0:
                rows.append({"days": days, "rate": round(rate, 2)})
    by_days: dict[int, dict] = {}
    for row in rows:
        by_days[row["days"]] = row
    rows = sorted(by_days.values(), key=lambda r: r["days"])
    if not rows:
        if float(daily or 0) > 0:
            rows.append({"days": 1, "rate": float(daily)})
        if float(weekly or 0) > 0:
            rows.append({"days": 7, "rate": float(weekly)})
        if float(monthly or 0) > 0:
            rows.append({"days": 30, "rate": float(monthly)})
        if float(yearly or 0) > 0:
            rows.append({"days": 365, "rate": float(yearly)})
    return rows


def _period_legacy_rates(rows: list[dict]) -> tuple[float, float, float, float]:
    daily = next((r["rate"] for r in rows if r["days"] == 1), 0.0)
    weekly = next((r["rate"] for r in rows if r["days"] == 7), 0.0)
    monthly = next((r["rate"] for r in rows if r["days"] == 30), 0.0)
    yearly = next((r["rate"] for r in rows if r["days"] == 365), 0.0)
    return float(daily or 0), float(weekly or 0), float(monthly or 0), float(yearly or 0)


def _parse_period_plan_days(plan: str) -> Optional[int]:
    p = (plan or "").lower()
    if p == "daily":
        return 1
    if p == "weekly":
        return 7
    if p == "monthly":
        return 30
    if p == "yearly":
        return 365
    if p.startswith("per_"):
        try:
            days = int(p[4:])
        except ValueError:
            return None
        return days if days > 0 else None
    return None


def _asset_period_rates(asset: RentalAsset) -> list[dict]:
    return _normalize_period_rates(
        getattr(asset, "period_rates", None),
        float(getattr(asset, "daily_rate", 0) or 0),
        float(getattr(asset, "weekly_rate", 0) or 0),
        float(getattr(asset, "monthly_rate", 0) or 0),
        float(getattr(asset, "yearly_rate", 0) or 0),
    )


def _normalize_additional_charges(raw) -> list[dict]:
    """Named extras: amount or percent of rental; shown independently or together."""
    rows: list[dict] = []
    if not isinstance(raw, list):
        return rows
    for item in raw:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or "").strip()
        if not name:
            continue
        charge_type = str(item.get("charge_type") or "amount").strip().lower()
        if charge_type not in ("amount", "percent"):
            charge_type = "amount"
        show_mode = str(item.get("show_mode") or "together").strip().lower()
        if show_mode not in ("independent", "together"):
            show_mode = "together"
        percent_of = str(item.get("percent_of") or "rental").strip().lower()
        if percent_of not in ("rental", "running", "grand", "deposit"):
            percent_of = "rental"
        try:
            value = float(item.get("value") or 0)
        except (TypeError, ValueError):
            continue
        if not (value > 0):
            continue
        if charge_type == "percent" and value > 100:
            value = 100.0
        row_id = str(item.get("id") or "").strip()
        rows.append({
            "id": row_id,
            "name": name[:120],
            "description": str(item.get("description") or "").strip()[:500],
            "charge_type": charge_type,
            "show_mode": show_mode,
            "percent_of": percent_of,
            "value": round(value, 2),
        })
    return rows


def _asset_additional_charges(asset: RentalAsset) -> list[dict]:
    return _normalize_additional_charges(getattr(asset, "additional_charges", None))


def _selected_additional_charges(charges: list[dict], selected_ids=None) -> list[dict]:
    """Together extras are always included. Independent extras need an explicit id list."""
    if selected_ids is None:
        return charges
    wanted = {str(x).strip() for x in selected_ids if str(x).strip()}
    out: list[dict] = []
    for charge in charges:
        mode = str(charge.get("show_mode") or "together")
        if mode != "independent":
            out.append(charge)
            continue
        cid = str(charge.get("id") or "").strip()
        name = str(charge.get("name") or "").strip()
        if cid in wanted or name in wanted:
            out.append(charge)
    return out


def _apply_additional_charges(subtotal: float, charges: list[dict], selected_ids=None, deposit: float = 0.0) -> float:
    extra = 0.0
    dep = float(deposit or 0)
    for charge in _selected_additional_charges(charges, selected_ids):
        value = float(charge.get("value") or 0)
        if value <= 0:
            continue
        if charge.get("charge_type") == "percent":
            basis = str(charge.get("percent_of") or "rental")
            if basis == "running":
                base = float(subtotal) + extra
            elif basis == "grand":
                base = float(subtotal) + extra + dep
            elif basis == "deposit":
                base = dep
            else:
                base = float(subtotal)
            extra += base * (value / 100.0)
        else:
            extra += value
    return round(float(subtotal) + extra, 2)


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

    async def _annotate_asset_counts(self, items: list[dict]) -> None:
        """Add child_count / unit_count / available_child_count for list & catalog UIs."""
        if not items:
            return
        asset_ids = [UUID(a["id"]) for a in items]
        child_rows = await self.db.execute(
            select(RentalAsset.parent_asset_id, func.count(RentalAsset.id).label("cnt"))
            .where(RentalAsset.parent_asset_id.in_(asset_ids))
            .group_by(RentalAsset.parent_asset_id)
        )
        child_counts: dict[str, int] = {str(r.parent_asset_id): int(r.cnt) for r in child_rows}

        unit_rows = await self.db.execute(
            select(RentalAssetUnit.asset_id, func.count(RentalAssetUnit.id).label("cnt"))
            .where(RentalAssetUnit.asset_id.in_(asset_ids))
            .group_by(RentalAssetUnit.asset_id)
        )
        unit_counts: dict[str, int] = {str(r.asset_id): int(r.cnt) for r in unit_rows}

        hierarchy_ids = [
            UUID(a["id"]) for a in items
            if (a.get("unit_mode") or "none") == "hierarchy" and child_counts.get(a["id"], 0) > 0
        ]
        available_child_counts: dict[str, int] = {}
        if hierarchy_ids:
            kids_result = await self.db.execute(
                select(RentalAsset).where(RentalAsset.parent_asset_id.in_(hierarchy_ids))
            )
            by_parent: dict[str, list[RentalAsset]] = {}
            for child in kids_result.scalars().all():
                if not child.parent_asset_id:
                    continue
                by_parent.setdefault(str(child.parent_asset_id), []).append(child)
            hard_unavailable = {"maintenance", "unavailable", "retired"}
            for pid, kids in by_parent.items():
                available_child_counts[pid] = sum(
                    1
                    for c in kids
                    if self._derive_asset_status(c) not in hard_unavailable
                    and self._available_capacity(c) > 0
                )

        for a in items:
            a["child_count"] = child_counts.get(a["id"], 0)
            a["unit_count"] = unit_counts.get(a["id"], 0)
            if (a.get("unit_mode") or "none") == "hierarchy":
                a["available_child_count"] = available_child_counts.get(a["id"], 0)

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
            "additional_charges": _asset_additional_charges(a),
            "price_per_unit": float(a.price_per_unit or 0) if hasattr(a, "price_per_unit") else 0.0,
            "pricing_uom": a.pricing_uom if hasattr(a, "pricing_uom") else None,
            "hourly_rate": float(a.hourly_rate or 0) if hasattr(a, "hourly_rate") else 0.0,
            "per_minute_rate": float(a.per_minute_rate or 0) if hasattr(a, "per_minute_rate") else 0.0,
            "duration_rates": _asset_duration_rates(a),
            "period_rates": _asset_period_rates(a),
            "yearly_rate": float(a.yearly_rate or 0) if hasattr(a, "yearly_rate") else 0.0,
            "tax_rate": float(getattr(a, "tax_rate", 0) or 0),
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
            "store_ids": [],
            "notes": a.notes,
            "delivery_info": getattr(a, "delivery_info", None),
            "delivery_enabled": bool(getattr(a, "delivery_enabled", False)),
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
            "start_time": b.start_time.strftime("%H:%M") if getattr(b, "start_time", None) else None,
            "end_time": b.end_time.strftime("%H:%M") if getattr(b, "end_time", None) else None,
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
            d["unit_mode"] = asset.unit_mode or "none"
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

    async def _get_rental_settings(self, vendor_id: UUID) -> dict:
        """Read vendor.settings.rental_settings, returning {} on any error."""
        try:
            from app.models.vendor import Vendor
            result = await self.db.execute(select(Vendor.settings).where(Vendor.id == vendor_id))
            settings = result.scalar_one_or_none() or {}
            return (settings or {}).get("rental_settings") or {}
        except Exception:
            return {}

    async def _asset_code_prefix(self, vendor_id: UUID) -> str:
        """Generic master-ID prefix (default AST). Configurable via rental_settings.asset_code_prefix."""
        prefix = "AST"
        try:
            rs = await self._get_rental_settings(vendor_id)
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

    async def _next_booking_number(self, vendor_id: UUID, *, prefix: Optional[str] = None) -> str:
        """Generate the next sequential booking number for the vendor.

        Uses MAX over existing booking numbers (not COUNT) to stay correct after
        deletions and to avoid the COUNT race condition under concurrent inserts.
        The prefix is read from vendor rental_settings.booking_number_prefix (default RNT).
        """
        if prefix is None:
            rs = await self._get_rental_settings(vendor_id)
            raw_prefix = str(rs.get("booking_number_prefix") or "RNT").strip().upper()
            prefix = re.sub(r"[^A-Z0-9]", "", raw_prefix)[:6] or "RNT"

        like_pattern = f"{prefix}-%"
        result = await self.db.execute(
            select(RentalBooking.booking_number)
            .where(
                RentalBooking.vendor_id == vendor_id,
                RentalBooking.booking_number.like(like_pattern),
            )
            .order_by(RentalBooking.booking_number.desc())
            .limit(1)
        )
        last = result.scalar_one_or_none()
        n = 1
        if last:
            try:
                n = int(last.rsplit("-", 1)[-1]) + 1
            except (ValueError, IndexError):
                n = 1
        return f"{prefix}-{n:04d}"

    def _append_timeline(self, booking: RentalBooking, event: str, detail: str = ""):
        timeline = list(booking.timeline or [])
        timeline.append({
            "event": event,
            "detail": detail,
            "at": datetime.now(timezone.utc).isoformat(),
        })
        booking.timeline = timeline

    def _parse_optional_time(self, value) -> Optional[time]:
        if value is None or value == "":
            return None
        if isinstance(value, time):
            return value
        if isinstance(value, str):
            raw = value.strip()
            for fmt in ("%H:%M:%S", "%H:%M"):
                try:
                    return datetime.strptime(raw[:8] if fmt == "%H:%M:%S" else raw[:5], fmt).time()
                except ValueError:
                    continue
        return None

    def _calc_rental_amount(
        self,
        asset: RentalAsset,
        start: date,
        end: date,
        plan: str,
        quantity: float,
        start_time: Optional[time] = None,
        end_time: Optional[time] = None,
        additional_charge_ids=None,
    ) -> float:
        plan = (plan or "daily").lower()
        days = (end - start).days + 1
        if days < 1:
            days = 1
        deposit = float(getattr(asset, "deposit_amount", 0) or 0)

        slot_minutes = _parse_duration_plan_minutes(plan)
        if slot_minutes:
            slot = next((r for r in _asset_duration_rates(asset) if r["minutes"] == slot_minutes), None)
            if slot and float(slot["rate"] or 0) > 0:
                if start_time is not None and end_time is not None:
                    start_dt = datetime.combine(start, start_time)
                    end_dt = datetime.combine(end, end_time)
                    if end_dt < start_dt:
                        end_dt += timedelta(days=1)
                    elapsed = slot_minutes if end_dt == start_dt else max(
                        1, int((end_dt - start_dt).total_seconds() // 60)
                    )
                    blocks = max(1, ceil(elapsed / slot_minutes))
                    base = float(slot["rate"]) * blocks
                else:
                    base = float(slot["rate"]) * days
                extra_qty = max(0.0, quantity - 1) * float(asset.extra_qty_charge or 0)
                return _apply_additional_charges(
                    round(base + extra_qty, 2),
                    _asset_additional_charges(asset),
                    additional_charge_ids,
                    deposit,
                )

        slot_days = _parse_period_plan_days(plan)
        period_slots = _asset_period_rates(asset)
        if slot_days:
            slot = next((r for r in period_slots if r["days"] == slot_days), None)
            if slot and float(slot["rate"] or 0) > 0:
                blocks = max(1, ceil(days / slot_days))
                base = float(slot["rate"]) * blocks
                extra_qty = max(0.0, quantity - 1) * float(asset.extra_qty_charge or 0)
                return _apply_additional_charges(
                    round(base + extra_qty, 2),
                    _asset_additional_charges(asset),
                    additional_charge_ids,
                    deposit,
                )

        # Legacy fallback when no period_rates match
        if plan == "yearly" and float(asset.yearly_rate or 0) > 0:
            years = max(1, ceil(days / 365))
            base = float(asset.yearly_rate) * years
        elif plan == "monthly" and float(asset.monthly_rate or 0) > 0:
            months = max(1, ceil(days / 30))
            base = float(asset.monthly_rate) * months
        elif plan == "weekly" and float(asset.weekly_rate or 0) > 0:
            weeks = max(1, ceil(days / 7))
            base = float(asset.weekly_rate) * weeks
        else:
            base = float(asset.daily_rate or 0) * days

        extra_qty = max(0.0, quantity - 1) * float(asset.extra_qty_charge or 0)
        return _apply_additional_charges(
            round(base + extra_qty, 2),
            _asset_additional_charges(asset),
            additional_charge_ids,
            deposit,
        )

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

    async def _free_serialized_units_for_range(
        self,
        vendor_id: UUID,
        asset_id: UUID,
        start: date,
        end: date,
        exclude_booking_id: Optional[UUID] = None,
    ) -> float:
        """Return available unit slots for a serialized-unit asset over a date range.

        For serialized assets the physical unit status is the ground truth:
        - Units in 'rented' / 'maintenance' / 'retired' status are already out of the pool.
        - Pending / approved / confirmed bookings have NOT yet physically claimed units
          (that happens at 'active'), so we subtract their reserved quantities from the
          physically-available count to avoid double-booking future slots.
        - Active bookings are already reflected by the physical 'rented' status, so we
          deliberately exclude them from the quantity subtraction.
        """
        avail_result = await self.db.execute(
            select(func.count()).select_from(RentalAssetUnit).where(
                RentalAssetUnit.asset_id == asset_id,
                RentalAssetUnit.vendor_id == vendor_id,
                RentalAssetUnit.status == "available",
            )
        )
        physically_available = int(avail_result.scalar() or 0)

        # Quantities locked by not-yet-active bookings (units still physically "available")
        pre_active_q = select(func.coalesce(func.sum(RentalBooking.quantity), 0)).where(
            RentalBooking.asset_id == asset_id,
            RentalBooking.status.in_(("pending", "approved", "confirmed")),
            RentalBooking.start_date <= end,
            RentalBooking.end_date >= start,
        )
        if exclude_booking_id:
            pre_active_q = pre_active_q.where(RentalBooking.id != exclude_booking_id)
        pre_active_result = await self.db.execute(pre_active_q)
        pre_active_reserved = float(pre_active_result.scalar() or 0)

        return max(0.0, physically_available - pre_active_reserved)

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

        await self._annotate_asset_counts(items)
        return items

    async def get_asset(self, vendor_id: UUID, asset_id: UUID) -> dict:
        asset = await self._get_asset(vendor_id, asset_id)
        d = self._asset_dict(asset)
        await self._annotate_asset_counts([d])
        from app.services.catalog_store_scope import get_rental_asset_store_ids
        d["store_ids"] = await get_rental_asset_store_ids(self.db, asset.id)
        return d

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
        await self._annotate_asset_counts(items)
        return items, total

    async def get_catalog_asset_by_slug(self, vendor_id: UUID, slug: str) -> Optional[dict]:
        """Fetch a single asset by slug for the public catalog; applies all visibility gates."""
        where = self._storefront_where(vendor_id)
        where.append(RentalAsset.slug == slug)
        result = await self.db.execute(select(RentalAsset).where(*where))
        asset = result.scalar_one_or_none()
        if not asset:
            return None
        d = self._asset_dict(asset)
        await self._annotate_asset_counts([d])
        return d

    async def create_asset(self, vendor_id: UUID, data: dict) -> dict:
        code = data.get("asset_code") or await self._next_asset_code(vendor_id)
        display_start = self._parse_optional_date(data.get("display_start_date") or data.get("start_date"))
        display_end = self._parse_optional_date(data.get("display_end_date") or data.get("end_date"))
        if display_start and display_end and display_end < display_start:
            raise HTTPException(400, "Display end date must be on or after start date")
        slug = data.get("slug") or await self._unique_slug(vendor_id, data["name"], code)
        duration_rows = _normalize_duration_rates(
            data.get("duration_rates"),
            data.get("hourly_rate", 0),
            data.get("per_minute_rate", 0),
        )
        hourly_rate, per_minute_rate = _duration_legacy_rates(duration_rows)
        if data.get("duration_rates") is None:
            hourly_rate = data.get("hourly_rate", 0)
            per_minute_rate = data.get("per_minute_rate", 0)
        period_rows = _normalize_period_rates(
            data.get("period_rates"),
            data.get("daily_rate", 0),
            data.get("weekly_rate", 0),
            data.get("monthly_rate", 0),
            data.get("yearly_rate", 0),
        )
        daily_rate, weekly_rate, monthly_rate, yearly_rate = _period_legacy_rates(period_rows)
        if data.get("period_rates") is None:
            daily_rate = data.get("daily_rate", 0)
            weekly_rate = data.get("weekly_rate", 0)
            monthly_rate = data.get("monthly_rate", 0)
            yearly_rate = data.get("yearly_rate", 0)
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
            daily_rate=daily_rate,
            weekly_rate=weekly_rate,
            monthly_rate=monthly_rate,
            deposit_amount=data.get("deposit_amount", 0),
            extra_qty_charge=data.get("extra_qty_charge", 0),
            extra_weight_charge=data.get("extra_weight_charge", 0),
            additional_charges=_normalize_additional_charges(data.get("additional_charges")),
            price_per_unit=data.get("price_per_unit", 0),
            pricing_uom=data.get("pricing_uom") or None,
            duration_rates=duration_rows,
            period_rates=period_rows,
            hourly_rate=hourly_rate,
            per_minute_rate=per_minute_rate,
            yearly_rate=yearly_rate,
            tax_rate=data.get("tax_rate", 0),
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
            delivery_info=(str(data["delivery_info"]).strip() or None) if data.get("delivery_info") is not None else None,
            delivery_enabled=bool(data.get("delivery_enabled", False)),
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

        # Sync store assignments (clears when scope is "all")
        store_scope = data.get("store_scope") or "all"
        store_ids = data.get("store_ids")
        if store_scope == "selected" or store_ids is not None:
            from app.services.catalog_store_scope import sync_rental_asset_stores, get_rental_asset_store_ids
            await sync_rental_asset_stores(self.db, vendor_id, asset.id, store_scope, store_ids)
            await self.db.commit()

        d = self._asset_dict(asset)
        from app.services.catalog_store_scope import get_rental_asset_store_ids
        d["store_ids"] = await get_rental_asset_store_ids(self.db, asset.id)
        return d

    async def update_asset(self, vendor_id: UUID, asset_id: UUID, data: dict) -> dict:
        asset = await self._get_asset(vendor_id, asset_id)
        if "duration_rates" in data:
            duration_rows = _normalize_duration_rates(
                data.get("duration_rates"),
                data.get("hourly_rate", getattr(asset, "hourly_rate", 0)),
                data.get("per_minute_rate", getattr(asset, "per_minute_rate", 0)),
            )
            data["duration_rates"] = duration_rows
            data["hourly_rate"], data["per_minute_rate"] = _duration_legacy_rates(duration_rows)
        if "period_rates" in data:
            period_rows = _normalize_period_rates(
                data.get("period_rates"),
                data.get("daily_rate", getattr(asset, "daily_rate", 0)),
                data.get("weekly_rate", getattr(asset, "weekly_rate", 0)),
                data.get("monthly_rate", getattr(asset, "monthly_rate", 0)),
                data.get("yearly_rate", getattr(asset, "yearly_rate", 0)),
            )
            data["period_rates"] = period_rows
            (
                data["daily_rate"],
                data["weekly_rate"],
                data["monthly_rate"],
                data["yearly_rate"],
            ) = _period_legacy_rates(period_rows)
        if "additional_charges" in data:
            data["additional_charges"] = _normalize_additional_charges(data.get("additional_charges"))
        fields = [
            "asset_code", "sku", "category", "asset_type", "short_description", "description",
            "capacity_max", "capacity_unit", "max_weight", "weight_unit",
            "currency",
            "daily_rate", "weekly_rate", "monthly_rate", "deposit_amount",
            "extra_qty_charge", "extra_weight_charge",
            "additional_charges",
            "price_per_unit", "pricing_uom",
            "hourly_rate", "per_minute_rate", "yearly_rate",
            "duration_rates", "period_rates",
            "tax_rate",
            "location", "section", "row_label", "rack_number", "image_url",
            "status", "notes", "delivery_info", "delivery_enabled", "is_active", "is_visible", "store_scope",
            "is_bookable", "unit_mode",
        ]
        for f in fields:
            if f in data:
                val = data[f]
                if f == "currency" and val is not None:
                    val = str(val).upper()[:3] or "INR"
                if f == "delivery_info" and val is not None:
                    val = str(val).strip() or None
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
            from app.services.catalog_store_scope import sync_rental_asset_stores, get_rental_asset_store_ids
            await sync_rental_asset_stores(self.db, vendor_id, asset.id, scope, store_ids)
            await self.db.commit()

        d = self._asset_dict(asset)
        from app.services.catalog_store_scope import get_rental_asset_store_ids
        d["store_ids"] = await get_rental_asset_store_ids(self.db, asset.id)
        return d

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

    def _booking_qty_by_day(
        self, bookings, from_date: date, to_date: date
    ) -> dict:
        day_qty: dict[date, float] = {}
        for b in bookings:
            if not b.start_date or not b.end_date:
                continue
            cur_b = b.start_date
            while cur_b <= b.end_date:
                if from_date <= cur_b <= to_date:
                    day_qty[cur_b] = day_qty.get(cur_b, 0.0) + float(b.quantity or 0)
                cur_b = cur_b + timedelta(days=1)
        return day_qty

    _DEFAULT_SLOT_TIME = time(10, 0)
    _NEXT_AVAILABLE_HORIZON_DAYS = 90

    def _next_available_slot(
        self,
        *,
        on: date,
        today: date,
        capacity: float,
        bookings: list,
        display_start: Optional[date] = None,
        display_end: Optional[date] = None,
        blocked: bool = False,
    ) -> tuple[Optional[str], Optional[str]]:
        """Earliest date/time this resource can be booked from `on` onward.

        Time is omitted when the free day is today so the UI can use local clock time.
        Future free days default to 10:00 (storefront pickup clock). Same-day hourly
        bookings that end today surface that end time.
        """
        if blocked:
            return None, None
        effective_cap = capacity if capacity > 0 else 1.0

        start_search = on
        if display_start and display_start > start_search:
            start_search = display_start
        if start_search < today:
            start_search = today
        if display_end and start_search > display_end:
            return None, None

        horizon = start_search + timedelta(days=self._NEXT_AVAILABLE_HORIZON_DAYS)
        qty_by_day = self._booking_qty_by_day(bookings, start_search, horizon)

        cursor = start_search
        while cursor <= horizon:
            if display_end and cursor > display_end:
                return None, None
            reserved = float(qty_by_day.get(cursor, 0.0))
            if reserved < effective_cap:
                slot_time = None if cursor == today else self._DEFAULT_SLOT_TIME.strftime("%H:%M")
                return cursor.isoformat(), slot_time

            overlapping = [
                b for b in bookings
                if b.start_date and b.end_date and b.start_date <= cursor <= b.end_date
            ]
            if overlapping and all(
                b.end_date == cursor and getattr(b, "end_time", None) for b in overlapping
            ):
                latest = max(b.end_time for b in overlapping)
                return cursor.isoformat(), latest.strftime("%H:%M")
            cursor = cursor + timedelta(days=1)

        ends = [b.end_date for b in bookings if getattr(b, "end_date", None)]
        if not ends:
            return None, None
        nxt = max(ends) + timedelta(days=1)
        if display_end and nxt > display_end:
            return None, None
        return nxt.isoformat(), self._DEFAULT_SLOT_TIME.strftime("%H:%M")

    def _calendar_days_from_qty(
        self,
        *,
        from_date: date,
        to_date: date,
        day_qty: dict,
        capacity: float,
        is_maintenance: bool,
    ) -> list[dict]:
        days = []
        cur = from_date
        while cur <= to_date:
            qty = float(day_qty.get(cur, 0.0) or 0)
            avail = max(0.0, capacity - qty)
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

    def _aggregate_resource_days(self, resources: list[dict], from_date: date, to_date: date) -> list[dict]:
        """Roll variant/unit rows up into a parent month view (X left)."""
        by_date: dict[str, list[dict]] = {}
        for res in resources:
            for d in res.get("days") or []:
                by_date.setdefault(d["date"], []).append(d)
        out = []
        cur = from_date
        while cur <= to_date:
            key = cur.isoformat()
            cells = by_date.get(key, [])
            reserved = sum(float(c.get("reserved_qty") or 0) for c in cells)
            avail = sum(float(c.get("available_capacity") or 0) for c in cells)
            statuses = {c.get("status") for c in cells}
            if not cells:
                status = "available"
            elif statuses <= {"booked", "unavailable", "maintenance"}:
                status = "booked"
            elif "maintenance" in statuses and len(statuses) == 1:
                status = "maintenance"
            elif reserved <= 0 and "booked" not in statuses:
                status = "available"
            elif avail <= 0:
                status = "booked"
            else:
                status = "partial"
            out.append({
                "date": key,
                "status": status,
                "reserved_qty": reserved,
                "available_capacity": avail,
            })
            cur = cur + timedelta(days=1)
        return out

    async def _calendar_resources_for_children(
        self,
        children: list,
        selected_id: UUID,
        from_date: date,
        to_date: date,
    ) -> list[dict]:
        if not children:
            return []
        ids = [c.id for c in children]
        result = await self.db.execute(
            select(RentalBooking).where(
                RentalBooking.asset_id.in_(ids),
                RentalBooking.status.in_((*ACTIVE_BOOKING_STATUSES, "completed")),
                RentalBooking.start_date <= to_date,
                RentalBooking.end_date >= from_date,
            )
        )
        by_asset: dict = {}
        for b in result.scalars().all():
            by_asset.setdefault(b.asset_id, []).append(b)

        resources = []
        for child in children:
            cap = float(child.capacity_max or 0)
            days = self._calendar_days_from_qty(
                from_date=from_date,
                to_date=to_date,
                day_qty=self._booking_qty_by_day(by_asset.get(child.id, []), from_date, to_date),
                capacity=cap,
                is_maintenance=child.status == "maintenance",
            )
            resources.append({
                "id": str(child.id),
                "kind": "child",
                "label": child.name,
                "code": child.asset_code,
                "highlight": child.id == selected_id,
                "selectable": True,
                "days": days,
            })
        return resources

    async def _calendar_resources_for_units(
        self,
        vendor_id: UUID,
        asset: RentalAsset,
        from_date: date,
        to_date: date,
    ) -> list[dict]:
        units_result = await self.db.execute(
            select(RentalAssetUnit).where(
                RentalAssetUnit.asset_id == asset.id,
                RentalAssetUnit.vendor_id == vendor_id,
            ).order_by(RentalAssetUnit.serial_no)
        )
        units = list(units_result.scalars().all())
        if not units:
            return []

        assign_result = await self.db.execute(
            select(RentalBookingUnit, RentalBooking)
            .join(RentalBooking, RentalBookingUnit.booking_id == RentalBooking.id)
            .where(
                RentalBooking.asset_id == asset.id,
                RentalBookingUnit.released_at.is_(None),
                RentalBooking.status.in_((*ACTIVE_BOOKING_STATUSES, "completed")),
                RentalBooking.start_date <= to_date,
                RentalBooking.end_date >= from_date,
            )
        )
        ranges_by_unit: dict = {}
        for bku, booking in assign_result.all():
            ranges_by_unit.setdefault(bku.unit_id, []).append(booking)

        resources = []
        for unit in units:
            blocked = (unit.condition in ("lost", "retired")) or (unit.status in ("retired", "maintenance"))
            bookings = ranges_by_unit.get(unit.id, [])
            days = []
            cur = from_date
            while cur <= to_date:
                hit = next((b for b in bookings if b.start_date <= cur <= b.end_date), None)
                if blocked:
                    status = "maintenance" if unit.status == "maintenance" else "unavailable"
                    reserved, avail, detail = 1.0, 0.0, (unit.status or unit.condition or "unavailable")
                elif hit:
                    status, reserved, avail = "booked", 1.0, 0.0
                    who = (hit.customer_name or "").strip()
                    detail = f"Booked{f' · {who}' if who else ''}"
                else:
                    status, reserved, avail, detail = "available", 0.0, 1.0, None
                days.append({
                    "date": cur.isoformat(),
                    "status": status,
                    "reserved_qty": reserved,
                    "available_capacity": avail,
                    "detail": detail,
                })
                cur = cur + timedelta(days=1)
            resources.append({
                "id": str(unit.id),
                "kind": "unit",
                "label": unit.label or unit.serial_no,
                "code": unit.serial_no if unit.label else None,
                "highlight": False,
                "selectable": False,
                "days": days,
            })
        return resources

    async def get_availability_calendar(
        self, vendor_id: UUID, asset_id: UUID, from_date: date, to_date: date
    ) -> dict:
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
        days = self._calendar_days_from_qty(
            from_date=from_date,
            to_date=to_date,
            day_qty=self._booking_qty_by_day(bookings, from_date, to_date),
            capacity=float(asset.capacity_max or 0),
            is_maintenance=asset.status == "maintenance",
        )

        resources: list[dict] = []
        resource_kind = None

        # Hierarchy: show every child variant (or siblings, if a child is selected).
        children_result = await self.db.execute(
            select(RentalAsset).where(
                RentalAsset.vendor_id == vendor_id,
                RentalAsset.parent_asset_id == (asset.parent_asset_id or asset.id),
            ).order_by(RentalAsset.name)
        )
        children = list(children_result.scalars().all())
        if children:
            resources = await self._calendar_resources_for_children(
                children, asset.id, from_date, to_date,
            )
            resource_kind = "child"
            days = self._aggregate_resource_days(resources, from_date, to_date)
        elif asset.unit_mode == "serialized":
            resources = await self._calendar_resources_for_units(
                vendor_id, asset, from_date, to_date,
            )
            if resources:
                resource_kind = "unit"
                days = self._aggregate_resource_days(resources, from_date, to_date)

        return {
            "days": days,
            "resources": resources,
            "resource_kind": resource_kind,
        }

    async def get_day_availability(self, vendor_id: UUID, on: date) -> dict:
        """Flatten every bookable parent / child / unit into a list for one day."""
        assets_result = await self.db.execute(
            select(RentalAsset).where(RentalAsset.vendor_id == vendor_id).order_by(RentalAsset.name)
        )
        assets = list(assets_result.scalars().all())
        children_by_parent: dict = {}
        for a in assets:
            if a.parent_asset_id:
                children_by_parent.setdefault(a.parent_asset_id, []).append(a)

        today = date.today()
        horizon = on + timedelta(days=self._NEXT_AVAILABLE_HORIZON_DAYS)

        bookings_result = await self.db.execute(
            select(RentalBooking).where(
                RentalBooking.vendor_id == vendor_id,
                RentalBooking.status.in_((*ACTIVE_BOOKING_STATUSES, "completed")),
                RentalBooking.start_date <= on,
                RentalBooking.end_date >= on,
            )
        )
        bookings = list(bookings_result.scalars().all())
        qty_by_asset: dict = {}
        for b in bookings:
            qty_by_asset[b.asset_id] = qty_by_asset.get(b.asset_id, 0.0) + float(b.quantity or 0)

        future_result = await self.db.execute(
            select(RentalBooking).where(
                RentalBooking.vendor_id == vendor_id,
                RentalBooking.status.in_(ACTIVE_BOOKING_STATUSES),
                RentalBooking.end_date >= on,
                RentalBooking.start_date <= horizon,
            )
        )
        future_by_asset: dict = {}
        for b in future_result.scalars().all():
            future_by_asset.setdefault(b.asset_id, []).append(b)

        units_result = await self.db.execute(
            select(RentalAssetUnit).where(RentalAssetUnit.vendor_id == vendor_id).order_by(RentalAssetUnit.serial_no)
        )
        units = list(units_result.scalars().all())
        units_by_asset: dict = {}
        for u in units:
            units_by_asset.setdefault(u.asset_id, []).append(u)

        assign_result = await self.db.execute(
            select(RentalBookingUnit, RentalBooking)
            .join(RentalBooking, RentalBookingUnit.booking_id == RentalBooking.id)
            .where(
                RentalBooking.vendor_id == vendor_id,
                RentalBookingUnit.released_at.is_(None),
                RentalBooking.status.in_((*ACTIVE_BOOKING_STATUSES, "completed")),
                RentalBooking.start_date <= on,
                RentalBooking.end_date >= on,
            )
        )
        booked_unit_ids = {bku.unit_id for bku, _ in assign_result.all()}

        future_assign_result = await self.db.execute(
            select(RentalBookingUnit, RentalBooking)
            .join(RentalBooking, RentalBookingUnit.booking_id == RentalBooking.id)
            .where(
                RentalBooking.vendor_id == vendor_id,
                RentalBookingUnit.released_at.is_(None),
                RentalBooking.status.in_(ACTIVE_BOOKING_STATUSES),
                RentalBooking.end_date >= on,
                RentalBooking.start_date <= horizon,
            )
        )
        future_by_unit: dict = {}
        for bku, b in future_assign_result.all():
            future_by_unit.setdefault(bku.unit_id, []).append(b)

        def day_row(
            *,
            asset_id,
            parent_id,
            kind: str,
            label: str,
            code,
            capacity: float,
            reserved: float,
            is_maintenance: bool,
            is_blocked: bool = False,
            unit_id=None,
            next_bookings: Optional[list] = None,
            display_start: Optional[date] = None,
            display_end: Optional[date] = None,
        ) -> dict:
            if is_blocked:
                status = "unavailable"
                avail = 0.0
            elif is_maintenance:
                status = "unavailable"
                avail = 0.0
            elif reserved <= 0:
                status = "available"
                avail = max(0.0, capacity)
            elif capacity > 0 and reserved < capacity:
                status = "partial"
                avail = max(0.0, capacity - reserved)
            else:
                status = "booked"
                avail = 0.0
            if is_blocked or is_maintenance:
                next_date, next_time = None, None
            elif reserved >= max(capacity, 1.0) and not next_bookings:
                # Occupied in inventory but no dated booking to project a free slot from.
                next_date, next_time = None, None
            else:
                next_date, next_time = self._next_available_slot(
                    on=on,
                    today=today,
                    capacity=capacity,
                    bookings=list(next_bookings or []),
                    display_start=display_start,
                    display_end=display_end,
                    blocked=False,
                )
            return {
                "id": str(unit_id or asset_id),
                "asset_id": str(asset_id),
                "parent_asset_id": str(parent_id) if parent_id else None,
                "unit_id": str(unit_id) if unit_id else None,
                "kind": kind,
                "label": label,
                "code": code,
                "status": status,
                "reserved_qty": reserved,
                "available_capacity": avail,
                "next_available_date": next_date,
                "next_available_time": next_time,
            }

        def in_display_window(asset: RentalAsset) -> bool:
            if asset.display_start_date and on < asset.display_start_date:
                return False
            if asset.display_end_date and on > asset.display_end_date:
                return False
            return True

        items: list[dict] = []
        for parent in assets:
            if parent.parent_asset_id:
                continue
            if parent.is_active is False:
                continue
            kids = children_by_parent.get(parent.id, [])
            if kids:
                for child in kids:
                    if child.is_active is False:
                        continue
                    if not in_display_window(child) and not in_display_window(parent):
                        continue
                    items.append(day_row(
                        asset_id=child.id,
                        parent_id=parent.id,
                        kind="child",
                        label=f"{parent.name} · {child.name}",
                        code=child.asset_code or parent.asset_code,
                        capacity=float(child.capacity_max or 0),
                        reserved=float(qty_by_asset.get(child.id, 0.0)),
                        is_maintenance=child.status == "maintenance" or parent.status == "maintenance",
                        next_bookings=future_by_asset.get(child.id, []),
                        display_start=child.display_start_date or parent.display_start_date,
                        display_end=child.display_end_date or parent.display_end_date,
                    ))
                continue

            if not in_display_window(parent):
                continue

            if parent.unit_mode == "serialized":
                parent_units = units_by_asset.get(parent.id, [])
                if not parent_units:
                    items.append(day_row(
                        asset_id=parent.id,
                        parent_id=None,
                        kind="asset",
                        label=parent.name,
                        code=parent.asset_code,
                        capacity=float(parent.capacity_max or 0),
                        reserved=float(qty_by_asset.get(parent.id, 0.0)),
                        is_maintenance=parent.status == "maintenance",
                        next_bookings=future_by_asset.get(parent.id, []),
                        display_start=parent.display_start_date,
                        display_end=parent.display_end_date,
                    ))
                    continue
                for unit in parent_units:
                    blocked = (unit.condition in ("lost", "retired")) or (unit.status in ("retired", "maintenance"))
                    reserved = 1.0 if (unit.id in booked_unit_ids or unit.status == "rented") else 0.0
                    items.append(day_row(
                        asset_id=parent.id,
                        parent_id=None,
                        kind="unit",
                        label=f"{parent.name} · {unit.label or unit.serial_no}",
                        code=unit.serial_no if unit.label else parent.asset_code,
                        capacity=1.0,
                        reserved=reserved,
                        is_maintenance=unit.status == "maintenance" or parent.status == "maintenance",
                        is_blocked=blocked and unit.status != "maintenance",
                        unit_id=unit.id,
                        next_bookings=future_by_unit.get(unit.id, []),
                        display_start=parent.display_start_date,
                        display_end=parent.display_end_date,
                    ))
                continue

            if parent.is_bookable is False:
                continue
            items.append(day_row(
                asset_id=parent.id,
                parent_id=None,
                kind="asset",
                label=parent.name,
                code=parent.asset_code,
                capacity=float(parent.capacity_max or 0),
                reserved=float(qty_by_asset.get(parent.id, 0.0)),
                is_maintenance=parent.status == "maintenance",
                next_bookings=future_by_asset.get(parent.id, []),
                display_start=parent.display_start_date,
                display_end=parent.display_end_date,
            ))

        counts = {"all": len(items), "available": 0, "partial": 0, "booked": 0, "unavailable": 0}
        for it in items:
            counts[it["status"]] = counts.get(it["status"], 0) + 1

        return {"date": on.isoformat(), "items": items, "counts": counts}

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
                asset_id = UUID(a["id"])
                if a.get("unit_mode") == "serialized":
                    free = await self._free_serialized_units_for_range(
                        vendor_id, asset_id, start_date, end_date
                    )
                    reserved = float(a.get("unit_count", 0)) - free
                else:
                    reserved = await self._reserved_qty_for_range(asset_id, start_date, end_date)
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
        start_time = self._parse_optional_time(data.get("start_time"))
        end_time = self._parse_optional_time(data.get("end_time"))
        if start_time and end_time and start == end and end_time < start_time:
            raise HTTPException(400, "End time must be on or after start time on the same day")
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

        if asset.unit_mode == "serialized":
            free = await self._free_serialized_units_for_range(vendor_id, asset.id, start, end)
        else:
            reserved = await self._reserved_qty_for_range(asset.id, start, end)
            free = float(asset.capacity_max or 0) - reserved
        if quantity > free:
            raise HTTPException(409, f"Only {free:g} {asset.capacity_unit} available for those dates")

        plan = data.get("pricing_plan") or "daily"
        charge_ids = data.get("additional_charge_ids")
        if charge_ids is not None and not isinstance(charge_ids, list):
            charge_ids = None
        rental_amount = self._calc_rental_amount(
            asset,
            start,
            end,
            plan,
            quantity,
            start_time=start_time,
            end_time=end_time,
            additional_charge_ids=charge_ids,
        )
        if weight and float(asset.extra_weight_charge or 0) > 0:
            rental_amount += round(weight * float(asset.extra_weight_charge), 2)
        deposit = float(asset.deposit_amount or 0)
        total = round(rental_amount + deposit, 2)

        customer_id = UUID(data["customer_id"]) if data.get("customer_id") else None
        sales_area_id = (
            UUID(data["sales_area_id"]) if data.get("sales_area_id")
            else asset.sales_area_id
        )

        # Read vendor rental settings to apply per-vendor behaviour toggles
        rental_settings = await self._get_rental_settings(vendor_id)
        credit_gate_enabled = rental_settings.get("credit_gate_enabled", True)
        require_deposit = rental_settings.get("require_deposit", True)
        auto_approve_storefront = rental_settings.get("auto_approve_storefront", False)

        if require_deposit and deposit <= 0:
            raise HTTPException(400, "A deposit is required for this rental. Please contact the vendor.")

        from app.services.crm.credit_gate import (
            adjust_outstanding,
            assert_credit_allows_booking,
        )
        if credit_gate_enabled:
            # Credit gate: block new bookings for parties with outstanding dues
            credit_row = await assert_credit_allows_booking(
                self.db,
                vendor_id,
                amount=Decimal(str(total)),
                customer_id=customer_id,
                party_name=data.get("customer_name"),
                party_phone=data.get("customer_phone"),
            )
        else:
            # Gate disabled — still need the credit row for outstanding tracking
            from app.services.crm.credit_gate import find_credit_control
            credit_row = await find_credit_control(
                self.db,
                vendor_id,
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
        elif not vendor_created and auto_approve_storefront:
            # Vendor has opted in to auto-approving customer-placed bookings
            initial_status = "approved"

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
            start_time=start_time,
            end_time=end_time,
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
            if initial_status == "approved":
                if booking.start_date and booking.end_date:
                    self._ensure_display_window_covers_booking(asset, booking.start_date, booking.end_date)
                self._append_timeline(booking, "Auto-Approved", "Storefront booking auto-approved per vendor settings")

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
            # Auto-assign serialized units when the rental goes live
            if asset.unit_mode == "serialized":
                await self._auto_assign_units(vendor_id, booking, int(float(booking.quantity or 1)))
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
        if asset.unit_mode == "serialized":
            free = await self._free_serialized_units_for_range(
                vendor_id, asset.id, ext_start, new_end_date, booking.id
            )
        else:
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
            # Close the join rows for these units
            bku_result = await self.db.execute(
                select(RentalBookingUnit).where(
                    RentalBookingUnit.booking_id == booking.id,
                    RentalBookingUnit.unit_id.in_([UUID(u) for u in unit_ids]),
                    RentalBookingUnit.released_at.is_(None),
                )
            )
            for bku in bku_result.scalars().all():
                bku.released_at = datetime.now(timezone.utc)
        else:
            # No specific units listed — close ALL open assignment rows for this booking
            # (happens when the whole booking is returned without specifying units)
            all_bku_result = await self.db.execute(
                select(RentalBookingUnit, RentalAssetUnit)
                .join(RentalAssetUnit, RentalBookingUnit.unit_id == RentalAssetUnit.id)
                .where(
                    RentalBookingUnit.booking_id == booking.id,
                    RentalBookingUnit.released_at.is_(None),
                )
            )
            for bku, unit in all_bku_result.all():
                bku.released_at = datetime.now(timezone.utc)
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

    def _booking_unit_dict(self, bku: RentalBookingUnit, unit: RentalAssetUnit) -> dict:
        return {
            "id": str(bku.id),
            "booking_id": str(bku.booking_id),
            "unit_id": str(bku.unit_id),
            "serial_no": unit.serial_no,
            "label": unit.label,
            "condition": unit.condition or "good",
            "status": unit.status or "rented",
            "assigned_at": bku.assigned_at.isoformat() if bku.assigned_at else None,
            "released_at": bku.released_at.isoformat() if bku.released_at else None,
            "assigned_by": bku.assigned_by,
            "notes": bku.notes,
        }

    # ── Unit assignment helpers ───────────────────────────────────────

    async def _auto_assign_units(
        self,
        vendor_id: UUID,
        booking: RentalBooking,
        qty_needed: int,
        assigned_by: str = "system",
    ) -> list[RentalAssetUnit]:
        """Pick `qty_needed` available units from the booking's asset, create join rows,
        and mark each unit as 'rented'. Returns the list of assigned units."""
        existing_result = await self.db.execute(
            select(func.count()).select_from(RentalBookingUnit).where(
                RentalBookingUnit.booking_id == booking.id,
                RentalBookingUnit.released_at.is_(None),
            )
        )
        already = existing_result.scalar_one() or 0
        still_need = max(0, qty_needed - already)
        if still_need == 0:
            return []

        avail_result = await self.db.execute(
            select(RentalAssetUnit).where(
                RentalAssetUnit.asset_id == booking.asset_id,
                RentalAssetUnit.vendor_id == vendor_id,
                RentalAssetUnit.status == "available",
            ).limit(still_need)
        )
        units = avail_result.scalars().all()

        for unit in units:
            unit.status = "rented"
            bku = RentalBookingUnit(
                booking_id=booking.id,
                unit_id=unit.id,
                vendor_id=vendor_id,
                assigned_by=assigned_by,
            )
            self.db.add(bku)

        if units:
            serials = ", ".join(u.serial_no for u in units)
            self._append_timeline(
                booking,
                "Units Assigned",
                f"Auto-assigned {len(units)} unit(s): {serials}",
            )
        return list(units)

    async def get_booking_units(self, vendor_id: UUID, booking_id: UUID) -> list[dict]:
        """Return all active (not released) unit assignments for a booking."""
        result = await self.db.execute(
            select(RentalBooking).where(
                RentalBooking.id == booking_id,
                RentalBooking.vendor_id == vendor_id,
            )
        )
        if not result.scalar_one_or_none():
            raise HTTPException(404, "Rental booking not found")

        bku_result = await self.db.execute(
            select(RentalBookingUnit, RentalAssetUnit)
            .join(RentalAssetUnit, RentalBookingUnit.unit_id == RentalAssetUnit.id)
            .where(
                RentalBookingUnit.booking_id == booking_id,
                RentalBookingUnit.released_at.is_(None),
            )
            .order_by(RentalAssetUnit.serial_no)
        )
        return [self._booking_unit_dict(bku, unit) for bku, unit in bku_result.all()]

    async def assign_units_to_booking(
        self, vendor_id: UUID, booking_id: UUID, data: dict
    ) -> list[dict]:
        """Assign specific or auto-picked units to a booking.

        Body:
          unit_ids   – optional list of specific unit UUIDs to assign
          auto       – if True and unit_ids empty, auto-pick from available pool
          assigned_by – label for the timeline event (defaults to 'vendor')
        """
        result = await self.db.execute(
            select(RentalBooking, RentalAsset)
            .join(RentalAsset, RentalBooking.asset_id == RentalAsset.id)
            .where(RentalBooking.id == booking_id, RentalBooking.vendor_id == vendor_id)
        )
        row = result.first()
        if not row:
            raise HTTPException(404, "Rental booking not found")
        booking, asset = row

        if asset.unit_mode != "serialized":
            raise HTTPException(400, "This asset does not use serialized unit tracking")

        assigned_by = data.get("assigned_by") or "vendor"
        unit_ids = data.get("unit_ids") or []

        if unit_ids:
            unit_result = await self.db.execute(
                select(RentalAssetUnit).where(
                    RentalAssetUnit.id.in_([UUID(u) for u in unit_ids]),
                    RentalAssetUnit.asset_id == asset.id,
                    RentalAssetUnit.vendor_id == vendor_id,
                )
            )
            units = unit_result.scalars().all()
            if len(units) != len(unit_ids):
                raise HTTPException(400, "One or more unit IDs are invalid for this asset")

            for unit in units:
                if unit.status not in ("available",):
                    raise HTTPException(
                        400,
                        f"Unit {unit.serial_no} is not available (status: {unit.status}). "
                        "Use reassign to swap a rented unit.",
                    )
                unit.status = "rented"
                bku = RentalBookingUnit(
                    booking_id=booking.id,
                    unit_id=unit.id,
                    vendor_id=vendor_id,
                    assigned_by=assigned_by,
                )
                self.db.add(bku)

            serials = ", ".join(u.serial_no for u in units)
            self._append_timeline(booking, "Units Assigned", f"Assigned: {serials}")
        else:
            qty = int(float(booking.quantity or 1))
            await self._auto_assign_units(vendor_id, booking, qty, assigned_by)

        await self.db.commit()
        return await self.get_booking_units(vendor_id, booking_id)

    async def reassign_unit(
        self,
        vendor_id: UUID,
        booking_id: UUID,
        from_unit_id: UUID,
        data: dict,
    ) -> list[dict]:
        """Swap a currently-assigned unit for a replacement.

        Body:
          to_unit_id  – UUID of the replacement unit (must be 'available')
          notes       – optional reason for the swap
          assigned_by – optional label
        """
        result = await self.db.execute(
            select(RentalBooking, RentalAsset)
            .join(RentalAsset, RentalBooking.asset_id == RentalAsset.id)
            .where(RentalBooking.id == booking_id, RentalBooking.vendor_id == vendor_id)
        )
        row = result.first()
        if not row:
            raise HTTPException(404, "Rental booking not found")
        booking, asset = row

        # Find the active assignment row for the outgoing unit
        bku_result = await self.db.execute(
            select(RentalBookingUnit, RentalAssetUnit)
            .join(RentalAssetUnit, RentalBookingUnit.unit_id == RentalAssetUnit.id)
            .where(
                RentalBookingUnit.booking_id == booking_id,
                RentalBookingUnit.unit_id == from_unit_id,
                RentalBookingUnit.released_at.is_(None),
            )
        )
        row2 = bku_result.first()
        if not row2:
            raise HTTPException(404, "Unit is not currently assigned to this booking")
        old_bku, from_unit = row2

        to_unit_id_str = data.get("to_unit_id")
        if not to_unit_id_str:
            raise HTTPException(400, "to_unit_id is required")
        to_unit_id = UUID(str(to_unit_id_str))

        to_unit_result = await self.db.execute(
            select(RentalAssetUnit).where(
                RentalAssetUnit.id == to_unit_id,
                RentalAssetUnit.asset_id == asset.id,
                RentalAssetUnit.vendor_id == vendor_id,
            )
        )
        to_unit = to_unit_result.scalar_one_or_none()
        if not to_unit:
            raise HTTPException(404, "Replacement unit not found for this asset")
        if to_unit.status != "available":
            raise HTTPException(
                400,
                f"Replacement unit {to_unit.serial_no} is not available (status: {to_unit.status})",
            )

        notes = data.get("notes")
        assigned_by = data.get("assigned_by") or "vendor"

        # Release the old assignment
        old_bku.released_at = datetime.now(timezone.utc)
        old_bku.notes = (old_bku.notes or "") + (f" [reassigned: {notes}]" if notes else " [reassigned]")

        # Mark old unit available, new unit rented
        from_unit.status = "available"
        to_unit.status = "rented"

        # Open a new assignment row for the replacement
        new_bku = RentalBookingUnit(
            booking_id=booking_id,
            unit_id=to_unit_id,
            vendor_id=vendor_id,
            assigned_by=assigned_by,
            notes=notes,
        )
        self.db.add(new_bku)

        self._append_timeline(
            booking,
            "Unit Reassigned",
            f"{from_unit.serial_no} → {to_unit.serial_no}" + (f" · Reason: {notes}" if notes else ""),
        )

        await self.db.commit()
        return await self.get_booking_units(vendor_id, booking_id)

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
