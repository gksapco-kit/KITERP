from datetime import datetime, timedelta, timezone
from decimal import Decimal
from math import radians, cos, sin, asin, sqrt
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.lead import Lead, Quote
from app.models.order import Order
from app.models.vendor import Vendor
from app.models.customer import Customer
from app.schemas.marketplace import MarketplaceLeadCreate, MarketplaceQuoteCreate


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    lat1, lng1, lat2, lng2 = map(radians, [lat1, lng1, lat2, lng2])
    dlat = lat2 - lat1
    dlng = lng2 - lng1
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlng / 2) ** 2
    return 6371 * 2 * asin(sqrt(a))


class MarketplaceService:
    def __init__(self, db: AsyncSession):
        self.db = db

    def _lead_to_dict(
        self,
        lead: Lead,
        quotes: list | None = None,
        vendor_names: dict | None = None,
        order_info: dict | None = None,
    ) -> dict:
        vendor_names = vendor_names or {}
        order_info = order_info or {}
        qrows = quotes if quotes is not None else []
        return {
            "id": str(lead.id),
            "customer_id": str(lead.customer_id) if lead.customer_id else None,
            "customer_name": lead.customer_name,
            "customer_phone": lead.customer_phone,
            "customer_email": lead.customer_email,
            "category": lead.category,
            "subcategory": lead.subcategory,
            "title": lead.title,
            "description": lead.description,
            "budget_min": lead.budget_min,
            "budget_max": lead.budget_max,
            "location_text": lead.location_text,
            "location_lat": lead.location_lat,
            "location_lng": lead.location_lng,
            "radius_km": lead.radius_km or 10,
            "photos": lead.photos or [],
            "status": lead.status,
            "quote_count": lead.quote_count or 0,
            "created_at": lead.created_at,
            "expires_at": lead.expires_at,
            "order_id": order_info.get("order_id"),
            "order_number": order_info.get("order_number"),
            "quotes": [
                {
                    "id": str(q.id),
                    "lead_id": str(q.lead_id),
                    "vendor_id": str(q.vendor_id),
                    "vendor_name": vendor_names.get(str(q.vendor_id)),
                    "price": q.price,
                    "estimated_time": q.estimated_time,
                    "conditions": q.conditions,
                    "message": q.message,
                    "status": q.status,
                    "is_selected": q.is_selected or False,
                    "created_at": q.created_at,
                }
                for q in qrows
            ],
        }

    async def create_lead(self, customer: Customer, data: MarketplaceLeadCreate) -> dict:
        lead = Lead(
            customer_id=customer.id,
            customer_name=customer.full_name,
            customer_phone=customer.phone,
            customer_email=customer.email,
            category=data.category,
            subcategory=data.subcategory,
            title=data.title,
            description=data.description,
            budget_min=data.budget_min,
            budget_max=data.budget_max,
            location_text=data.location_text,
            location_lat=data.location_lat,
            location_lng=data.location_lng,
            radius_km=data.radius_km,
            photos=data.photos,
            status="open",
            quote_count=0,
            expires_at=datetime.now(timezone.utc) + timedelta(days=30),
        )
        self.db.add(lead)
        await self.db.commit()
        await self.db.refresh(lead)
        await self._notify_nearby_vendors(lead)
        return self._lead_to_dict(lead)

    async def _notify_nearby_vendors(self, lead: Lead) -> None:
        if lead.location_lat is None or lead.location_lng is None:
            return
        from app.services.notification_service import NotificationService

        result = await self.db.execute(
            select(Vendor).where(
                Vendor.status.in_(("active", "approved")),
                Vendor.latitude.isnot(None),
                Vendor.longitude.isnot(None),
            )
        )
        notif = NotificationService(self.db)
        radius = lead.radius_km or 10
        for vendor in result.scalars().all():
            try:
                dist = _haversine_km(
                    float(lead.location_lat),
                    float(lead.location_lng),
                    float(vendor.latitude),
                    float(vendor.longitude),
                )
            except (TypeError, ValueError):
                continue
            if dist > radius:
                continue
            if vendor.business_type and lead.category:
                bt = (vendor.business_type or "").lower()
                cat = lead.category.lower()
                if bt not in cat and cat not in bt and lead.category != "general":
                    continue
            await notif.notify_marketplace_lead(
                vendor_id=vendor.id,
                lead_title=lead.title,
                lead_id=lead.id,
                category=lead.category,
            )

    async def _orders_for_leads(self, customer_id: UUID, lead_ids: list[UUID]) -> dict[str, dict]:
        if not lead_ids:
            return {}
        result = await self.db.execute(
            select(Order).where(Order.customer_id == customer_id, Order.source == "marketplace")
        )
        lead_id_strs = {str(lid) for lid in lead_ids}
        mapping: dict[str, dict] = {}
        for order in result.scalars().all():
            for item in order.items or []:
                lid = item.get("marketplace_lead_id")
                if lid in lead_id_strs and lid not in mapping:
                    mapping[lid] = {
                        "order_id": str(order.id),
                        "order_number": order.order_number,
                    }
        return mapping

    async def list_customer_leads(self, customer_id: UUID) -> list[dict]:
        result = await self.db.execute(
            select(Lead).where(Lead.customer_id == customer_id).order_by(Lead.created_at.desc())
        )
        leads = result.scalars().all()
        assigned_ids = [l.id for l in leads if l.status == "assigned"]
        order_map = await self._orders_for_leads(customer_id, assigned_ids)
        out = []
        for lead in leads:
            quotes = await self._quotes_for_lead(lead.id)
            vendor_names = await self._vendor_names([q.vendor_id for q in quotes])
            out.append(
                self._lead_to_dict(
                    lead,
                    quotes,
                    vendor_names,
                    order_map.get(str(lead.id)),
                )
            )
        return out

    async def get_customer_lead(self, customer_id: UUID, lead_id: UUID) -> dict:
        lead = await self._get_lead(lead_id)
        if lead.customer_id != customer_id:
            raise HTTPException(404, "Lead not found")
        quotes = await self._quotes_for_lead(lead_id)
        vendor_names = await self._vendor_names([q.vendor_id for q in quotes])
        return self._lead_to_dict(lead, quotes, vendor_names)

    async def accept_quote(self, customer_id: UUID, lead_id: UUID, quote_id: UUID) -> dict:
        lead = await self._get_lead(lead_id)
        if lead.customer_id != customer_id:
            raise HTTPException(404, "Lead not found")
        result = await self.db.execute(
            select(Quote).where(Quote.id == quote_id, Quote.lead_id == lead_id)
        )
        quote = result.scalar_one_or_none()
        if not quote:
            raise HTTPException(404, "Quote not found")
        await self.db.execute(
            update(Quote).where(Quote.lead_id == lead_id).values(is_selected=False, status="submitted")
        )
        quote.is_selected = True
        quote.status = "accepted"
        lead.status = "assigned"

        order = await self._create_order_from_quote(lead, quote, customer_id)

        await self.db.commit()
        result_dict = await self.get_customer_lead(customer_id, lead_id)
        result_dict["order_id"] = str(order.id)
        result_dict["order_number"] = order.order_number
        return result_dict

    async def _create_order_from_quote(self, lead: Lead, quote: Quote, customer_id: UUID) -> Order:
        from app.repositories.order_repo import OrderRepository

        repo = OrderRepository(self.db)
        order_number = await repo.get_next_order_number(quote.vendor_id)
        price = float(quote.price or 0)
        items = [
            {
                "name": lead.title,
                "qty": 1,
                "price": price,
                "description": quote.message or lead.description,
                "marketplace_lead_id": str(lead.id),
                "marketplace_quote_id": str(quote.id),
            }
        ]
        from app.services.store_resolver import resolve_store_id as _resolve_txn_store_id
        mp_store_id = await _resolve_txn_store_id(self.db, quote.vendor_id)
        order = Order(
            order_number=order_number,
            vendor_id=quote.vendor_id,
            customer_id=customer_id,
            store_id=mp_store_id,
            items=items,
            item_count=1,
            subtotal=Decimal(str(price)),
            tax_amount=Decimal("0"),
            discount_amount=Decimal("0"),
            shipping_amount=Decimal("0"),
            total=Decimal(str(price)),
            status="confirmed",
            payment_status="pending",
            payment_method="marketplace",
            notes=f"Marketplace quote accepted. {quote.conditions or ''}".strip(),
            source="marketplace",
            confirmed_at=datetime.now(timezone.utc),
        )
        self.db.add(order)
        await self.db.flush()

        try:
            from app.services.notification_service import NotificationService
            from app.services.order_notification_service import send_order_placed_notifications
            from app.repositories.customer_repo import CustomerRepository

            vendor = await self.db.get(Vendor, quote.vendor_id)
            await NotificationService(self.db).notify_order_received(
                vendor_id=quote.vendor_id,
                vendor_phone=getattr(vendor, "phone", None),
                vendor_name=getattr(vendor, "business_name", None),
                order_number=order_number,
                total=price,
                order_id=order.id,
            )
            if vendor:
                customer = await CustomerRepository(self.db).get_by_vendor_and_id(
                    quote.vendor_id, customer_id,
                )
                await send_order_placed_notifications(
                    self.db,
                    vendor=vendor,
                    order=order,
                    customer=customer,
                )
        except Exception:
            pass
        return order

    async def list_open_leads_for_vendor(self, vendor: Vendor, *, limit: int = 50) -> list[dict]:
        q = select(Lead).where(Lead.status == "open").order_by(Lead.created_at.desc()).limit(limit)
        if vendor.business_type:
            q = q.where(
                (Lead.category.ilike(f"%{vendor.business_type}%"))
                | (Lead.category == "general")
            )
        result = await self.db.execute(q)
        leads = list(result.scalars().all())
        if vendor.latitude is not None and vendor.longitude is not None:
            filtered = []
            for lead in leads:
                if lead.location_lat is None or lead.location_lng is None:
                    filtered.append(lead)
                    continue
                try:
                    dist = _haversine_km(
                        float(lead.location_lat),
                        float(lead.location_lng),
                        float(vendor.latitude),
                        float(vendor.longitude),
                    )
                    if dist <= (lead.radius_km or 50):
                        filtered.append(lead)
                except (TypeError, ValueError):
                    filtered.append(lead)
            leads = filtered
        return [self._lead_to_dict(l) for l in leads]

    async def submit_quote(self, vendor: Vendor, lead_id: UUID, data: MarketplaceQuoteCreate) -> dict:
        lead = await self._get_lead(lead_id)
        if lead.status not in ("open", "quoted"):
            raise HTTPException(400, "This lead is no longer accepting quotes")

        existing = await self.db.execute(
            select(Quote).where(Quote.lead_id == lead_id, Quote.vendor_id == vendor.id)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(400, "You have already submitted a quote for this lead")

        quote = Quote(
            lead_id=lead_id,
            vendor_id=vendor.id,
            price=data.price,
            estimated_time=data.estimated_time,
            conditions=data.conditions,
            message=data.message,
            status="submitted",
        )
        self.db.add(quote)
        lead.quote_count = (lead.quote_count or 0) + 1
        if lead.status == "open":
            lead.status = "quoted"
        await self.db.commit()
        await self.db.refresh(quote)
        return {
            "id": str(quote.id),
            "lead_id": str(lead_id),
            "vendor_id": str(vendor.id),
            "vendor_name": vendor.business_name,
            "price": quote.price,
            "estimated_time": quote.estimated_time,
            "conditions": quote.conditions,
            "message": quote.message,
            "status": quote.status,
            "is_selected": False,
            "created_at": quote.created_at,
        }

    async def list_vendor_quotes(self, vendor_id: UUID) -> list[dict]:
        result = await self.db.execute(
            select(Quote, Lead.title)
            .join(Lead, Lead.id == Quote.lead_id)
            .where(Quote.vendor_id == vendor_id)
            .order_by(Quote.created_at.desc())
        )
        rows = []
        for quote, lead_title in result.all():
            rows.append({
                "id": str(quote.id),
                "lead_id": str(quote.lead_id),
                "lead_title": lead_title,
                "vendor_id": str(quote.vendor_id),
                "price": quote.price,
                "estimated_time": quote.estimated_time,
                "status": quote.status,
                "is_selected": quote.is_selected or False,
                "created_at": quote.created_at,
            })
        return rows

    async def _get_lead(self, lead_id: UUID) -> Lead:
        result = await self.db.execute(select(Lead).where(Lead.id == lead_id))
        lead = result.scalar_one_or_none()
        if not lead:
            raise HTTPException(404, "Lead not found")
        return lead

    async def _quotes_for_lead(self, lead_id: UUID) -> list[Quote]:
        result = await self.db.execute(
            select(Quote).where(Quote.lead_id == lead_id).order_by(Quote.created_at.asc())
        )
        return list(result.scalars().all())

    async def _vendor_names(self, vendor_ids: list[UUID]) -> dict[str, str]:
        if not vendor_ids:
            return {}
        result = await self.db.execute(select(Vendor).where(Vendor.id.in_(vendor_ids)))
        return {str(v.id): v.business_name for v in result.scalars().all()}
