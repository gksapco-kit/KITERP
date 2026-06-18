import logging
from uuid import UUID
from datetime import datetime, timezone, date, time
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from fastapi import HTTPException, status

from app.models.booking import Booking
from app.models.vendor_service import Service, ServiceAvailability

log = logging.getLogger(__name__)


class BookingService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _next_booking_number(self, vendor_id: UUID) -> str:
        stmt = (
            select(func.count())
            .select_from(Booking)
            .where(Booking.vendor_id == vendor_id)
        )
        count = (await self.db.execute(stmt)).scalar() or 0
        return f"BK-{count + 1:05d}"

    async def create(
        self,
        vendor_id: UUID,
        customer_id: UUID,
        data: dict,
    ) -> Booking:
        service_id = UUID(data["service_id"])
        result = await self.db.execute(
            select(Service).where(Service.id == service_id, Service.vendor_id == vendor_id)
        )
        service = result.scalar_one_or_none()
        if not service:
            raise HTTPException(status_code=404, detail="Service not found")
        if service.status != "active":
            raise HTTPException(status_code=400, detail="Service is not currently available")

        booking_date = data["booking_date"]
        if isinstance(booking_date, str):
            booking_date = date.fromisoformat(booking_date)
        if booking_date < date.today():
            raise HTTPException(status_code=400, detail="Booking date cannot be in the past")

        start_time = data.get("start_time")
        if start_time and isinstance(start_time, str):
            start_time = time.fromisoformat(start_time)

        end_time = None
        duration = service.duration_minutes
        if start_time and duration:
            from datetime import timedelta
            dt_start = datetime.combine(booking_date, start_time)
            dt_end = dt_start + timedelta(minutes=duration)
            end_time = dt_end.time()

        price = float(service.price or 0)
        tax_rate = float(service.tax_rate or service.gst_rate or 0)
        subtotal = round(price, 2)
        tax_amount = round(subtotal * tax_rate / 100, 2) if tax_rate else 0
        total = round(subtotal + tax_amount, 2)

        booking_number = await self._next_booking_number(vendor_id)

        booking = Booking(
            vendor_id=vendor_id,
            store_id=UUID(str(data["store_id"])) if data.get("store_id") else None,
            customer_id=customer_id,
            service_id=service_id,
            booking_number=booking_number,
            service_name=service.name,
            service_price=Decimal(str(price)),
            booking_date=booking_date,
            start_time=start_time,
            end_time=end_time,
            duration_minutes=duration,
            status="pending",
            customer_name=data.get("customer_name"),
            customer_email=data.get("customer_email"),
            customer_phone=data.get("customer_phone"),
            notes=data.get("notes"),
            subtotal=Decimal(str(subtotal)),
            tax_amount=Decimal(str(tax_amount)),
            total=Decimal(str(total)),
            payment_status="pending",
            payment_method=data.get("payment_method", "cod"),
        )
        self.db.add(booking)
        await self.db.commit()
        await self.db.refresh(booking)

        try:
            service.booking_count = (service.booking_count or 0) + 1
            await self.db.commit()
        except Exception:
            pass

        return booking

    async def get_available_slots(
        self,
        vendor_id: UUID,
        service_id: UUID,
        booking_date: date,
    ) -> list[dict]:
        from datetime import timedelta

        result = await self.db.execute(
            select(Service).where(Service.id == service_id, Service.vendor_id == vendor_id)
        )
        service = result.scalar_one_or_none()
        if not service:
            raise HTTPException(status_code=404, detail="Service not found")

        if booking_date < date.today():
            return []

        dow = booking_date.weekday()  # 0=Monday, matches service_availability.day_of_week
        avail_result = await self.db.execute(
            select(ServiceAvailability).where(
                ServiceAvailability.service_id == service_id,
                ServiceAvailability.day_of_week == dow,
                ServiceAvailability.is_available.is_(True),
            )
        )
        windows = list(avail_result.scalars().all())
        if not windows:
            windows = [
                type("_Win", (), {"start_time": "09:00", "end_time": "17:00"})(),
            ]

        duration = service.duration_minutes or 60
        slots: list[dict] = []

        for window in windows:
            start_t = time.fromisoformat(window.start_time)
            end_t = time.fromisoformat(window.end_time)
            cursor = datetime.combine(booking_date, start_t)
            end_dt = datetime.combine(booking_date, end_t)
            step = timedelta(minutes=duration)
            while cursor + step <= end_dt:
                slot_end = cursor + step
                slots.append({
                    "start": cursor.isoformat(),
                    "end": slot_end.isoformat(),
                    "start_time": cursor.strftime("%H:%M"),
                    "available": True,
                })
                cursor = slot_end

        booked_result = await self.db.execute(
            select(Booking).where(
                Booking.service_id == service_id,
                Booking.booking_date == booking_date,
                Booking.status.notin_(["cancelled", "rejected"]),
            )
        )
        booked_times = {
            b.start_time.strftime("%H:%M")
            for b in booked_result.scalars().all()
            if b.start_time
        }

        now = datetime.now()
        for slot in slots:
            slot_dt = datetime.fromisoformat(slot["start"])
            if slot["start_time"] in booked_times:
                slot["available"] = False
            elif booking_date == date.today() and slot_dt <= now:
                slot["available"] = False

        return slots

    async def list_by_customer(
        self,
        vendor_id: UUID,
        customer_id: UUID,
        skip: int = 0,
        limit: int = 20,
        status_filter: str | None = None,
    ) -> tuple[list[Booking], int]:
        conditions = [
            Booking.vendor_id == vendor_id,
            Booking.customer_id == customer_id,
        ]
        if status_filter:
            conditions.append(Booking.status == status_filter)

        count_stmt = select(func.count()).select_from(Booking).where(and_(*conditions))
        total = (await self.db.execute(count_stmt)).scalar() or 0

        stmt = (
            select(Booking)
            .where(and_(*conditions))
            .order_by(Booking.booking_date.desc(), Booking.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all()), total

    async def get(
        self, vendor_id: UUID, customer_id: UUID, booking_id: UUID,
    ) -> Booking:
        stmt = select(Booking).where(
            Booking.id == booking_id,
            Booking.vendor_id == vendor_id,
            Booking.customer_id == customer_id,
        )
        result = await self.db.execute(stmt)
        booking = result.scalar_one_or_none()
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")
        return booking

    async def cancel(
        self, vendor_id: UUID, customer_id: UUID, booking_id: UUID, reason: str | None = None,
    ) -> Booking:
        booking = await self.get(vendor_id, customer_id, booking_id)
        if booking.status in ("completed", "cancelled"):
            raise HTTPException(
                status_code=400,
                detail=f"Cannot cancel a {booking.status} booking",
            )
        booking.status = "cancelled"
        booking.cancel_reason = reason
        await self.db.commit()
        await self.db.refresh(booking)
        return booking
