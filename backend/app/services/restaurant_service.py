from typing import List, Optional, Tuple
from uuid import UUID
from datetime import datetime, timezone

from sqlalchemy import select, and_, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.restaurant import RestaurantZone, RestaurantTable
from app.models.pos import POSTransaction


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
        )
        self.db.add(t)
        await self.db.commit()
        await self.db.refresh(t)
        return t

    async def patch_table(self, vendor_id: UUID, table_id: UUID, fields: dict) -> Optional[RestaurantTable]:
        """Apply only keys present in fields (from model_dump(exclude_unset=True))."""
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

    # ── Kitchen ─────────────────────────────────────────────────────

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
