from typing import List, Optional, Tuple
from uuid import UUID
from datetime import datetime, timezone, date as date_type
import secrets

from sqlalchemy import select, and_, delete, func as sqlfunc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.restaurant import RestaurantZone, RestaurantTable, RestaurantOrder, RestaurantKOT, RestaurantReservation
from app.models.pos import POSTransaction

TABLE_STATUSES = ("free", "seated", "ordering", "billed", "dirty")
KOT_STATUSES = ("new", "preparing", "ready", "done")
ORDER_STATUSES = ("open", "billed", "closed", "voided")


class RestaurantService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Zones ───────────────────────────────────────────────────────

    async def list_zones(self, vendor_id: UUID) -> List[RestaurantZone]:
        r = await self.db.execute(
            select(RestaurantZone)
            .where(RestaurantZone.vendor_id == vendor_id)
            .order_by(RestaurantZone.sort_order, RestaurantZone.name)
        )
        return list(r.scalars().all())

    async def create_zone(self, vendor_id: UUID, name: str, sort_order: int = 0) -> RestaurantZone:
        z = RestaurantZone(vendor_id=vendor_id, name=name.strip(), sort_order=sort_order or 0)
        self.db.add(z)
        await self.db.commit()
        await self.db.refresh(z)
        return z

    async def update_zone(self, vendor_id: UUID, zone_id: UUID, *, name: Optional[str] = None, sort_order: Optional[int] = None) -> Optional[RestaurantZone]:
        z = await self.db.get(RestaurantZone, zone_id)
        if not z or z.vendor_id != vendor_id:
            return None
        if name is not None:
            z.name = name.strip()
        if sort_order is not None:
            z.sort_order = sort_order
        await self.db.commit()
        await self.db.refresh(z)
        return z

    async def delete_zone(self, vendor_id: UUID, zone_id: UUID) -> bool:
        z = await self.db.get(RestaurantZone, zone_id)
        if not z or z.vendor_id != vendor_id:
            return False
        await self.db.execute(delete(RestaurantTable).where(RestaurantTable.zone_id == zone_id))
        self.db.delete(z)
        await self.db.commit()
        return True

    # ── Tables ──────────────────────────────────────────────────────

    async def list_tables(self, vendor_id: UUID, zone_id: Optional[UUID] = None) -> List[Tuple[RestaurantTable, Optional[str]]]:
        q = (
            select(RestaurantTable, RestaurantZone.name)
            .outerjoin(RestaurantZone, RestaurantTable.zone_id == RestaurantZone.id)
            .where(RestaurantTable.vendor_id == vendor_id)
            .order_by(RestaurantTable.sort_order, RestaurantTable.label)
        )
        if zone_id:
            q = q.where(RestaurantTable.zone_id == zone_id)
        r = await self.db.execute(q)
        return [(row[0], row[1]) for row in r.all()]

    async def create_table(
        self,
        vendor_id: UUID,
        label: str,
        *,
        zone_id: Optional[UUID] = None,
        capacity: int = 4,
        sort_order: int = 0,
        is_active: bool = True,
    ) -> RestaurantTable:
        if zone_id:
            z = await self.db.get(RestaurantZone, zone_id)
            if not z or z.vendor_id != vendor_id:
                raise ValueError("Invalid zone")
        t = RestaurantTable(
            vendor_id=vendor_id,
            zone_id=zone_id,
            label=label.strip(),
            capacity=capacity,
            sort_order=sort_order or 0,
            is_active=is_active,
            status="free",
        )
        self.db.add(t)
        await self.db.commit()
        await self.db.refresh(t)
        return t

    async def patch_table(self, vendor_id: UUID, table_id: UUID, fields: dict) -> Optional[RestaurantTable]:
        t = await self.db.get(RestaurantTable, table_id)
        if not t or t.vendor_id != vendor_id:
            return None
        if "zone_id" in fields:
            zid = fields["zone_id"]
            if zid is None:
                t.zone_id = None
            else:
                z = await self.db.get(RestaurantZone, UUID(str(zid)))
                if not z or z.vendor_id != vendor_id:
                    raise ValueError("Invalid zone")
                t.zone_id = z.id
        if "label" in fields and fields["label"] is not None:
            t.label = str(fields["label"]).strip()
        if "capacity" in fields and fields["capacity"] is not None:
            t.capacity = int(fields["capacity"])
        if "sort_order" in fields and fields["sort_order"] is not None:
            t.sort_order = int(fields["sort_order"])
        if "is_active" in fields and fields["is_active"] is not None:
            t.is_active = bool(fields["is_active"])
        await self.db.commit()
        await self.db.refresh(t)
        return t

    async def delete_table(self, vendor_id: UUID, table_id: UUID) -> bool:
        t = await self.db.get(RestaurantTable, table_id)
        if not t or t.vendor_id != vendor_id:
            return False
        self.db.delete(t)
        await self.db.commit()
        return True

    async def get_table(self, vendor_id: UUID, table_id: UUID) -> Optional[RestaurantTable]:
        t = await self.db.get(RestaurantTable, table_id)
        if not t or t.vendor_id != vendor_id:
            return None
        return t

    async def set_table_status(self, vendor_id: UUID, table_id: UUID, status: str) -> Optional[RestaurantTable]:
        if status not in TABLE_STATUSES:
            raise ValueError(f"Invalid table status: {status}")
        t = await self.db.get(RestaurantTable, table_id)
        if not t or t.vendor_id != vendor_id:
            return None
        t.status = status
        await self.db.commit()
        await self.db.refresh(t)
        return t

    # ── QR Token ────────────────────────────────────────────────────

    async def generate_qr_token(self, vendor_id: UUID, table_id: UUID) -> Optional[RestaurantTable]:
        t = await self.db.get(RestaurantTable, table_id)
        if not t or t.vendor_id != vendor_id:
            return None
        t.qr_token = secrets.token_urlsafe(24)
        await self.db.commit()
        await self.db.refresh(t)
        return t

    async def get_table_by_qr_token(self, qr_token: str) -> Optional[RestaurantTable]:
        r = await self.db.execute(
            select(RestaurantTable).where(RestaurantTable.qr_token == qr_token)
        )
        return r.scalar_one_or_none()

    # ── Orders (open tabs) ───────────────────────────────────────────

    async def create_order(
        self,
        vendor_id: UUID,
        table_id: UUID,
        covers: int = 1,
        server_name: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> RestaurantOrder:
        table = await self.db.get(RestaurantTable, table_id)
        if not table or table.vendor_id != vendor_id:
            raise ValueError("Invalid table")
        # Reject if a non-closed order already exists for this table
        existing = await self._get_open_order_for_table(vendor_id, table_id)
        if existing:
            raise ValueError("Table already has an open order")
        order = RestaurantOrder(
            vendor_id=vendor_id,
            table_id=table_id,
            status="open",
            covers=covers,
            server_name=server_name,
            notes=notes,
            items=[],
        )
        self.db.add(order)
        table.status = "seated"
        await self.db.commit()
        await self.db.refresh(order)
        return order

    async def _get_open_order_for_table(self, vendor_id: UUID, table_id: UUID) -> Optional[RestaurantOrder]:
        r = await self.db.execute(
            select(RestaurantOrder)
            .where(
                RestaurantOrder.vendor_id == vendor_id,
                RestaurantOrder.table_id == table_id,
                RestaurantOrder.status.in_(["open", "billed"]),
            )
            .limit(1)
        )
        return r.scalar_one_or_none()

    async def get_order(self, vendor_id: UUID, order_id: UUID) -> Optional[RestaurantOrder]:
        o = await self.db.get(RestaurantOrder, order_id)
        if not o or o.vendor_id != vendor_id:
            return None
        return o

    async def list_orders(
        self,
        vendor_id: UUID,
        *,
        status: Optional[str] = None,
        limit: int = 100,
    ) -> List[Tuple[RestaurantOrder, Optional[str]]]:
        q = (
            select(RestaurantOrder, RestaurantTable.label)
            .outerjoin(RestaurantTable, RestaurantOrder.table_id == RestaurantTable.id)
            .where(RestaurantOrder.vendor_id == vendor_id)
            .order_by(RestaurantOrder.created_at.desc())
            .limit(limit)
        )
        if status:
            q = q.where(RestaurantOrder.status == status)
        else:
            q = q.where(RestaurantOrder.status.in_(["open", "billed"]))
        r = await self.db.execute(q)
        return [(row[0], row[1]) for row in r.all()]

    async def add_items_to_order(self, vendor_id: UUID, order_id: UUID, new_items: list) -> Optional[RestaurantOrder]:
        o = await self.get_order(vendor_id, order_id)
        if not o:
            return None
        if o.status not in ("open",):
            raise ValueError("Cannot add items to an order that is not open")
        current = list(o.items or [])
        for new_item in new_items:
            merged = False
            product_id = new_item.get("product_id")
            if product_id:
                for existing in current:
                    if existing.get("product_id") == product_id:
                        existing["qty"] = existing.get("qty", 0) + new_item.get("qty", 1)
                        merged = True
                        break
            if not merged:
                current.append(new_item)
        from sqlalchemy import update as sqla_update
        await self.db.execute(
            sqla_update(RestaurantOrder)
            .where(RestaurantOrder.id == order_id)
            .values(items=current, updated_at=datetime.now(timezone.utc))
        )
        await self.db.commit()
        await self.db.refresh(o)
        o.items = current
        return o

    async def update_order_items(self, vendor_id: UUID, order_id: UUID, items: list) -> Optional[RestaurantOrder]:
        """Replace the full items list (for qty adjustments / removals)."""
        o = await self.get_order(vendor_id, order_id)
        if not o:
            return None
        if o.status not in ("open",):
            raise ValueError("Cannot modify items on a non-open order")
        from sqlalchemy import update as sqla_update
        await self.db.execute(
            sqla_update(RestaurantOrder)
            .where(RestaurantOrder.id == order_id)
            .values(items=items, updated_at=datetime.now(timezone.utc))
        )
        await self.db.commit()
        await self.db.refresh(o)
        return o

    async def send_kot(
        self,
        vendor_id: UUID,
        order_id: UUID,
        items: list,
        notes: Optional[str] = None,
    ) -> RestaurantKOT:
        o = await self.get_order(vendor_id, order_id)
        if not o:
            raise ValueError("Order not found")
        if o.status not in ("open",):
            raise ValueError("Cannot send KOT on a non-open order")
        # Count existing KOTs for this order to assign kot_number
        count_r = await self.db.execute(
            select(sqlfunc.count()).where(RestaurantKOT.order_id == order_id)
        )
        kot_number = (count_r.scalar() or 0) + 1
        kot = RestaurantKOT(
            vendor_id=vendor_id,
            order_id=order_id,
            table_id=o.table_id,
            kot_number=kot_number,
            status="new",
            items=items,
            notes=notes,
        )
        self.db.add(kot)

        # Accumulate sent items onto order.items so Order.tsx can show them
        # and the "Request Bill" button remains enabled after a KOT is sent.
        from sqlalchemy import update as sqla_update
        current = list(o.items or [])
        for new_item in items:
            merged = False
            product_id = new_item.get("product_id")
            if product_id:
                for existing in current:
                    if existing.get("product_id") == product_id:
                        existing["qty"] = existing.get("qty", 0) + new_item.get("qty", 1)
                        merged = True
                        break
            if not merged:
                current.append(new_item)
        await self.db.execute(
            sqla_update(RestaurantOrder)
            .where(RestaurantOrder.id == order_id)
            .values(items=current, updated_at=datetime.now(timezone.utc))
        )

        # Mark table as ordering if it was only seated
        if o.table_id:
            table = await self.db.get(RestaurantTable, o.table_id)
            if table and table.status == "seated":
                table.status = "ordering"
        await self.db.commit()
        await self.db.refresh(kot)
        return kot

    async def request_bill(self, vendor_id: UUID, order_id: UUID) -> Optional[RestaurantOrder]:
        o = await self.get_order(vendor_id, order_id)
        if not o:
            return None
        if o.status != "open":
            raise ValueError("Only open orders can be billed")
        o.status = "billed"
        if o.table_id:
            table = await self.db.get(RestaurantTable, o.table_id)
            if table:
                table.status = "billed"
        await self.db.commit()
        await self.db.refresh(o)
        return o

    async def close_order(self, vendor_id: UUID, order_id: UUID, pos_transaction_id: UUID) -> Optional[RestaurantOrder]:
        o = await self.get_order(vendor_id, order_id)
        if not o:
            return None
        if o.status not in ("open", "billed"):
            raise ValueError("Order cannot be closed in its current state")
        o.status = "closed"
        o.pos_transaction_id = pos_transaction_id
        if o.table_id:
            table = await self.db.get(RestaurantTable, o.table_id)
            if table:
                table.status = "dirty"
        await self.db.commit()
        await self.db.refresh(o)
        return o

    async def void_order(self, vendor_id: UUID, order_id: UUID) -> Optional[RestaurantOrder]:
        o = await self.get_order(vendor_id, order_id)
        if not o:
            return None
        if o.status not in ("open", "billed"):
            raise ValueError("Only open/billed orders can be voided")
        o.status = "voided"
        if o.table_id:
            table = await self.db.get(RestaurantTable, o.table_id)
            if table:
                table.status = "free"
        await self.db.commit()
        await self.db.refresh(o)
        return o

    # ── KOTs ────────────────────────────────────────────────────────

    async def list_kots(
        self,
        vendor_id: UUID,
        *,
        include_done: bool = False,
        limit: int = 100,
    ) -> List[Tuple[RestaurantKOT, Optional[str], Optional[int]]]:
        """Returns (kot, table_label, order_covers)."""
        q = (
            select(RestaurantKOT, RestaurantTable.label, RestaurantOrder.covers)
            .outerjoin(RestaurantTable, RestaurantKOT.table_id == RestaurantTable.id)
            .outerjoin(RestaurantOrder, RestaurantKOT.order_id == RestaurantOrder.id)
            .where(RestaurantKOT.vendor_id == vendor_id)
            .order_by(RestaurantKOT.created_at.asc())
            .limit(limit)
        )
        if not include_done:
            q = q.where(RestaurantKOT.status != "done")
        r = await self.db.execute(q)
        return [(row[0], row[1], row[2]) for row in r.all()]

    async def get_kots_for_order(self, vendor_id: UUID, order_id: UUID) -> List[RestaurantKOT]:
        r = await self.db.execute(
            select(RestaurantKOT)
            .where(
                RestaurantKOT.vendor_id == vendor_id,
                RestaurantKOT.order_id == order_id,
            )
            .order_by(RestaurantKOT.kot_number)
        )
        return list(r.scalars().all())

    async def update_kot_status(self, vendor_id: UUID, kot_id: UUID, status: str) -> Optional[RestaurantKOT]:
        if status not in KOT_STATUSES:
            raise ValueError(f"Invalid KOT status: {status}")
        kot = await self.db.get(RestaurantKOT, kot_id)
        if not kot or kot.vendor_id != vendor_id:
            return None
        kot.status = status
        await self.db.commit()
        await self.db.refresh(kot)
        return kot

    # ── Reservations ────────────────────────────────────────────────

    async def create_reservation(
        self,
        vendor_id: UUID,
        guest_name: str,
        reservation_date: date_type,
        reservation_time: str,
        party_size: int = 2,
        *,
        table_id: Optional[UUID] = None,
        guest_phone: Optional[str] = None,
        guest_email: Optional[str] = None,
        notes: Optional[str] = None,
        source: str = "online",
    ) -> RestaurantReservation:
        r = RestaurantReservation(
            vendor_id=vendor_id,
            table_id=table_id,
            guest_name=guest_name.strip(),
            guest_phone=guest_phone,
            guest_email=guest_email,
            reservation_date=reservation_date,
            reservation_time=reservation_time,
            party_size=party_size,
            notes=notes,
            source=source,
            status="pending",
        )
        self.db.add(r)
        await self.db.commit()
        await self.db.refresh(r)
        return r

    async def list_reservations(
        self,
        vendor_id: UUID,
        *,
        date_from: Optional[date_type] = None,
        date_to: Optional[date_type] = None,
        status: Optional[str] = None,
        limit: int = 100,
    ) -> List[Tuple[RestaurantReservation, Optional[str]]]:
        q = (
            select(RestaurantReservation, RestaurantTable.label)
            .outerjoin(RestaurantTable, RestaurantReservation.table_id == RestaurantTable.id)
            .where(RestaurantReservation.vendor_id == vendor_id)
            .order_by(RestaurantReservation.reservation_date, RestaurantReservation.reservation_time)
            .limit(limit)
        )
        if date_from:
            q = q.where(RestaurantReservation.reservation_date >= date_from)
        if date_to:
            q = q.where(RestaurantReservation.reservation_date <= date_to)
        if status:
            q = q.where(RestaurantReservation.status == status)
        r = await self.db.execute(q)
        return [(row[0], row[1]) for row in r.all()]

    async def get_reservation(self, vendor_id: UUID, reservation_id: UUID) -> Optional[RestaurantReservation]:
        r = await self.db.get(RestaurantReservation, reservation_id)
        if not r or r.vendor_id != vendor_id:
            return None
        return r

    async def update_reservation_status(
        self, vendor_id: UUID, reservation_id: UUID, status: str, table_id: Optional[UUID] = None
    ) -> Optional[RestaurantReservation]:
        r = await self.get_reservation(vendor_id, reservation_id)
        if not r:
            return None
        r.status = status
        if table_id is not None:
            r.table_id = table_id
        await self.db.commit()
        await self.db.refresh(r)
        return r

    async def delete_reservation(self, vendor_id: UUID, reservation_id: UUID) -> bool:
        r = await self.get_reservation(vendor_id, reservation_id)
        if not r:
            return False
        await self.db.delete(r)
        await self.db.commit()
        return True

    # ── Legacy kitchen tickets (POS-based, kept for backward compat) ─

    async def list_kitchen_tickets(
        self,
        vendor_id: UUID,
        *,
        include_done: bool = False,
        limit: int = 80,
    ) -> List[Tuple[POSTransaction, Optional[str]]]:
        now = datetime.now(timezone.utc)
        day_start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
        q = (
            select(POSTransaction, RestaurantTable.label)
            .outerjoin(RestaurantTable, POSTransaction.restaurant_table_id == RestaurantTable.id)
            .where(
                and_(
                    POSTransaction.vendor_id == vendor_id,
                    POSTransaction.kitchen_ticket_status.isnot(None),
                    POSTransaction.status == "completed",
                    POSTransaction.created_at >= day_start,
                )
            )
            .order_by(POSTransaction.created_at.desc())
            .limit(limit)
        )
        if not include_done:
            q = q.where(POSTransaction.kitchen_ticket_status != "done")
        r = await self.db.execute(q)
        return [(row[0], row[1]) for row in r.all()]

    async def update_kitchen_ticket_status(
        self,
        vendor_id: UUID,
        txn_id: UUID,
        kitchen_ticket_status: str,
    ) -> Optional[POSTransaction]:
        txn = await self.db.get(POSTransaction, txn_id)
        if not txn or txn.vendor_id != vendor_id:
            return None
        if not txn.kitchen_ticket_status:
            return None
        if kitchen_ticket_status not in ("new", "preparing", "ready", "done"):
            raise ValueError("Invalid kitchen status")
        txn.kitchen_ticket_status = kitchen_ticket_status
        await self.db.commit()
        await self.db.refresh(txn)
        return txn
