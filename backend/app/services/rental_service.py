from datetime import date, timedelta
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.rental import RentalAsset, RentalBooking


class RentalService:
    def __init__(self, db: AsyncSession):
        self.db = db

    def _asset_dict(self, a: RentalAsset) -> dict:
        return {
            "id": str(a.id),
            "vendor_id": str(a.vendor_id),
            "name": a.name,
            "sku": a.sku,
            "product_id": str(a.product_id) if a.product_id else None,
            "daily_rate": float(a.daily_rate or 0),
            "deposit_amount": float(a.deposit_amount or 0),
            "status": a.status,
            "notes": a.notes,
        }

    def _booking_dict(self, b: RentalBooking) -> dict:
        return {
            "id": str(b.id),
            "vendor_id": str(b.vendor_id),
            "asset_id": str(b.asset_id),
            "customer_name": b.customer_name,
            "customer_email": b.customer_email,
            "customer_phone": b.customer_phone,
            "start_date": b.start_date.isoformat(),
            "end_date": b.end_date.isoformat(),
            "status": b.status,
            "total_amount": float(b.total_amount or 0),
            "deposit_amount": float(b.deposit_amount or 0),
            "notes": b.notes,
        }

    async def list_assets(self, vendor_id: UUID) -> list[dict]:
        result = await self.db.execute(
            select(RentalAsset).where(RentalAsset.vendor_id == vendor_id).order_by(RentalAsset.name)
        )
        return [self._asset_dict(a) for a in result.scalars().all()]

    async def create_asset(self, vendor_id: UUID, data: dict) -> dict:
        asset = RentalAsset(
            vendor_id=vendor_id,
            name=data["name"],
            sku=data.get("sku"),
            product_id=UUID(data["product_id"]) if data.get("product_id") else None,
            daily_rate=data.get("daily_rate", 0),
            deposit_amount=data.get("deposit_amount", 0),
            notes=data.get("notes"),
        )
        self.db.add(asset)
        await self.db.commit()
        await self.db.refresh(asset)
        return self._asset_dict(asset)

    async def list_bookings(self, vendor_id: UUID) -> list[dict]:
        result = await self.db.execute(
            select(RentalBooking).where(RentalBooking.vendor_id == vendor_id).order_by(RentalBooking.start_date.desc())
        )
        return [self._booking_dict(b) for b in result.scalars().all()]

    async def create_booking(self, vendor_id: UUID, data: dict) -> dict:
        asset = await self._get_asset(vendor_id, UUID(data["asset_id"]))
        start = date.fromisoformat(data["start_date"]) if isinstance(data["start_date"], str) else data["start_date"]
        end = date.fromisoformat(data["end_date"]) if isinstance(data["end_date"], str) else data["end_date"]
        if end < start:
            raise HTTPException(400, "End date must be on or after start date")
        if start < date.today():
            raise HTTPException(400, "Start date cannot be in the past")

        conflict = await self.db.execute(
            select(RentalBooking).where(
                RentalBooking.asset_id == asset.id,
                RentalBooking.status.in_(["pending", "confirmed", "active"]),
                RentalBooking.start_date <= end,
                RentalBooking.end_date >= start,
            )
        )
        if conflict.scalars().first():
            raise HTTPException(409, "Asset is not available for those dates")

        days = (end - start).days + 1
        total = float(asset.daily_rate or 0) * days
        booking = RentalBooking(
            vendor_id=vendor_id,
            customer_id=UUID(data["customer_id"]) if data.get("customer_id") else None,
            asset_id=asset.id,
            customer_name=data["customer_name"],
            customer_email=data.get("customer_email"),
            customer_phone=data.get("customer_phone"),
            start_date=start,
            end_date=end,
            total_amount=Decimal(str(total)),
            deposit_amount=asset.deposit_amount or 0,
            notes=data.get("notes"),
            status="pending",
        )
        self.db.add(booking)
        await self.db.commit()
        await self.db.refresh(booking)
        return self._booking_dict(booking)

    async def update_booking_status(self, vendor_id: UUID, booking_id: UUID, status: str) -> dict:
        result = await self.db.execute(
            select(RentalBooking).where(RentalBooking.id == booking_id, RentalBooking.vendor_id == vendor_id)
        )
        booking = result.scalar_one_or_none()
        if not booking:
            raise HTTPException(404, "Rental booking not found")
        booking.status = status
        if status == "returned":
            asset = await self._get_asset(vendor_id, booking.asset_id)
            asset.status = "available"
        elif status == "active":
            asset = await self._get_asset(vendor_id, booking.asset_id)
            asset.status = "rented"
        await self.db.commit()
        await self.db.refresh(booking)
        return self._booking_dict(booking)

    async def _get_asset(self, vendor_id: UUID, asset_id: UUID) -> RentalAsset:
        result = await self.db.execute(
            select(RentalAsset).where(RentalAsset.id == asset_id, RentalAsset.vendor_id == vendor_id)
        )
        asset = result.scalar_one_or_none()
        if not asset:
            raise HTTPException(404, "Rental asset not found")
        return asset
