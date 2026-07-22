# app/services/procurement_service.py
import logging
import re
from uuid import UUID
from datetime import datetime, timezone, date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status

from app.models.procurement import (
    Supplier, PurchaseOrder, PurchaseOrderItem, PurchaseOrderReceipt,
)
from app.models.vendor_product import Product
from app.services.inventory_service import InventoryService

log = logging.getLogger(__name__)


def _normalize_supplier_name(name: str | None) -> str:
    return (name or "").strip().lower()


def _normalize_supplier_phone(phone: str | None) -> str:
    if not phone:
        return ""
    return re.sub(r"\D", "", phone)


class SupplierService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def find_duplicate(
        self,
        vendor_id: UUID,
        name: str,
        phone: str | None = None,
        email: str | None = None,
        exclude_id: UUID | None = None,
    ) -> Supplier | None:
        """Match on case-insensitive name, or normalized phone / email when provided."""
        norm_name = _normalize_supplier_name(name)
        if not norm_name:
            return None

        stmt = select(Supplier).where(Supplier.vendor_id == vendor_id)
        if exclude_id:
            stmt = stmt.where(Supplier.id != exclude_id)
        result = await self.db.execute(stmt)
        candidates = list(result.scalars().all())

        norm_phone = _normalize_supplier_phone(phone)
        norm_email = (email or "").strip().lower()

        for s in candidates:
            if _normalize_supplier_name(s.name) == norm_name:
                return s
            if norm_phone and _normalize_supplier_phone(s.phone) == norm_phone:
                return s
            if norm_email and (s.email or "").strip().lower() == norm_email:
                return s
        return None

    async def create(self, vendor_id: UUID, data: dict) -> Supplier:
        duplicate = await self.find_duplicate(
            vendor_id,
            data.get("name", ""),
            data.get("phone"),
            data.get("email"),
        )
        if duplicate:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"A supplier named '{duplicate.name}' already exists for this business",
            )
        supplier = Supplier(vendor_id=vendor_id, **data)
        self.db.add(supplier)
        await self.db.commit()
        await self.db.refresh(supplier)
        return supplier

    async def update(self, vendor_id: UUID, supplier_id: UUID, data: dict) -> Supplier:
        supplier = await self._get(vendor_id, supplier_id)
        for k, v in data.items():
            if v is not None:
                setattr(supplier, k, v)
        await self.db.commit()
        await self.db.refresh(supplier)
        return supplier

    async def deactivate(self, vendor_id: UUID, supplier_id: UUID) -> Supplier:
        supplier = await self._get(vendor_id, supplier_id)
        supplier.is_active = False
        await self.db.commit()
        await self.db.refresh(supplier)
        return supplier

    async def delete(self, vendor_id: UUID, supplier_id: UUID) -> None:
        from sqlalchemy import delete as sa_delete

        from app.models.business_partner import BusinessPartner, BusinessPartnerRole

        supplier = await self._get(vendor_id, supplier_id)

        role_rows = (
            await self.db.execute(
                select(BusinessPartnerRole.business_partner_id).where(
                    BusinessPartnerRole.supplier_id == supplier_id
                )
            )
        ).all()
        bp_ids = {row[0] for row in role_rows if row[0]}
        await self.db.execute(
            sa_delete(BusinessPartnerRole).where(BusinessPartnerRole.supplier_id == supplier_id)
        )
        for bp_id in bp_ids:
            remaining = int(
                await self.db.scalar(
                    select(func.count())
                    .select_from(BusinessPartnerRole)
                    .where(BusinessPartnerRole.business_partner_id == bp_id)
                )
                or 0
            )
            if remaining == 0:
                await self.db.execute(sa_delete(BusinessPartner).where(BusinessPartner.id == bp_id))

        try:
            await self.db.delete(supplier)
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Cannot delete supplier — they have linked purchase orders. Deactivate instead.",
            )

    async def get(self, vendor_id: UUID, supplier_id: UUID) -> Supplier:
        return await self._get(vendor_id, supplier_id)

    async def list(
        self, vendor_id: UUID,
        search: str | None = None,
        is_active: bool | None = None,
    ) -> tuple[list[Supplier], int]:
        conditions = [Supplier.vendor_id == vendor_id]
        if is_active is not None:
            conditions.append(Supplier.is_active == is_active)
        if search:
            conditions.append(
                Supplier.name.ilike(f"%{search}%")
                | Supplier.contact_name.ilike(f"%{search}%")
                | Supplier.email.ilike(f"%{search}%")
            )

        count_stmt = select(func.count()).select_from(Supplier).where(and_(*conditions))
        total = (await self.db.execute(count_stmt)).scalar() or 0

        stmt = (
            select(Supplier)
            .where(and_(*conditions))
            .order_by(Supplier.created_at.desc())
        )
        result = await self.db.execute(stmt)
        items = list(result.scalars().all())
        return items, total

    async def _get(self, vendor_id: UUID, supplier_id: UUID) -> Supplier:
        stmt = select(Supplier).where(
            Supplier.id == supplier_id,
            Supplier.vendor_id == vendor_id,
        )
        result = await self.db.execute(stmt)
        supplier = result.scalar_one_or_none()
        if not supplier:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")
        return supplier


class PurchaseOrderService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.inventory_svc = InventoryService(db)

    # ── PO Number Generation ─────────────────────────────────────

    async def _next_po_number(self, vendor_id: UUID) -> str:
        stmt = (
            select(func.count())
            .select_from(PurchaseOrder)
            .where(PurchaseOrder.vendor_id == vendor_id)
        )
        count = (await self.db.execute(stmt)).scalar() or 0
        return f"PO-{count + 1:04d}"

    # ── Create ───────────────────────────────────────────────────

    async def create(
        self, vendor_id: UUID, data: dict, created_by: UUID | None = None,
    ) -> PurchaseOrder:
        supplier_svc = SupplierService(self.db)
        await supplier_svc._get(vendor_id, UUID(data["supplier_id"]))

        po_number = await self._next_po_number(vendor_id)

        subtotal = 0.0
        po_items = []
        for item_data in data["items"]:
            qty = item_data["quantity"]
            cost = item_data["unit_cost"]
            line_total = round(qty * cost, 2)
            subtotal += line_total
            po_items.append(PurchaseOrderItem(
                product_id=UUID(item_data["product_id"]),
                variant_id=UUID(item_data["variant_id"]) if item_data.get("variant_id") else None,
                quantity_ordered=qty,
                unit_cost=cost,
                total_cost=line_total,
                plant_id=UUID(item_data["plant_id"]) if item_data.get("plant_id") else None,
                storage_location_id=(
                    UUID(item_data["storage_location_id"])
                    if item_data.get("storage_location_id") else None
                ),
                notes=item_data.get("notes") or item_data.get("description"),
            ))

        total = round(subtotal, 2)

        po = PurchaseOrder(
            vendor_id=vendor_id,
            supplier_id=UUID(data["supplier_id"]),
            po_number=po_number,
            status="draft",
            expected_delivery_date=data.get("expected_delivery_date"),
            notes=data.get("notes"),
            subtotal=subtotal,
            tax_amount=0,
            total=total,
            created_by=created_by,
            items=po_items,
        )
        self.db.add(po)
        await self.db.commit()

        return await self._get(vendor_id, po.id)

    # ── Update (draft only) ──────────────────────────────────────

    async def update(self, vendor_id: UUID, po_id: UUID, data: dict) -> PurchaseOrder:
        po = await self._get(vendor_id, po_id)
        if po.status != "draft":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only draft purchase orders can be edited",
            )

        if data.get("supplier_id"):
            supplier_svc = SupplierService(self.db)
            await supplier_svc._get(vendor_id, UUID(data["supplier_id"]))
            po.supplier_id = UUID(data["supplier_id"])

        if data.get("expected_delivery_date") is not None:
            po.expected_delivery_date = data["expected_delivery_date"]
        if data.get("notes") is not None:
            po.notes = data["notes"]

        if data.get("items") is not None:
            for old_item in list(po.items):
                await self.db.delete(old_item)
            await self.db.flush()

            subtotal = 0.0
            new_items = []
            for item_data in data["items"]:
                qty = item_data["quantity"]
                cost = item_data["unit_cost"]
                line_total = round(qty * cost, 2)
                subtotal += line_total
                new_items.append(PurchaseOrderItem(
                    purchase_order_id=po.id,
                    product_id=UUID(item_data["product_id"]),
                    variant_id=UUID(item_data["variant_id"]) if item_data.get("variant_id") else None,
                    quantity_ordered=qty,
                    unit_cost=cost,
                    total_cost=line_total,
                    plant_id=UUID(item_data["plant_id"]) if item_data.get("plant_id") else None,
                    storage_location_id=(
                        UUID(item_data["storage_location_id"])
                        if item_data.get("storage_location_id") else None
                    ),
                    notes=item_data.get("notes") or item_data.get("description"),
                ))
            self.db.add_all(new_items)
            po.subtotal = subtotal
            po.total = round(subtotal, 2)

        await self.db.commit()
        return await self._get(vendor_id, po_id)

    # ── Send ─────────────────────────────────────────────────────

    async def send(self, vendor_id: UUID, po_id: UUID) -> PurchaseOrder:
        po = await self._get(vendor_id, po_id)
        if po.status != "draft":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only draft purchase orders can be sent",
            )
        po.status = "sent"
        po.order_date = date.today()
        await self.db.commit()
        return await self._get(vendor_id, po_id)

    # ── Receive Items ────────────────────────────────────────────

    async def receive_items(
        self, vendor_id: UUID, po_id: UUID, data: dict, received_by: UUID | None = None,
    ) -> PurchaseOrder:
        po = await self._get(vendor_id, po_id, load_receipts=True)
        if po.status not in ("sent", "partial_received"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Can only receive items for sent or partially received POs",
            )

        items_map = {str(item.id): item for item in po.items}
        receipt_items_log = []

        for entry in data["items"]:
            po_item = items_map.get(entry["item_id"])
            if not po_item:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"PO item {entry['item_id']} not found",
                )

            remaining = po_item.quantity_ordered - po_item.quantity_received
            if entry["quantity"] > remaining:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot receive {entry['quantity']} units for item {entry['item_id']}. "
                           f"Only {remaining} remaining.",
                )

            po_item.quantity_received += entry["quantity"]

            receipt_items_log.append({
                "item_id": str(po_item.id),
                "product_id": str(po_item.product_id),
                "variant_id": str(po_item.variant_id) if po_item.variant_id else None,
                "quantity_received": entry["quantity"],
            })

            try:
                product = await self.db.get(Product, po_item.product_id)
                if product and product.track_inventory:
                    await self.inventory_svc.record_movement(
                        vendor_id=vendor_id,
                        product_id=po_item.product_id,
                        movement_type="purchase",
                        quantity=abs(entry["quantity"]),
                        reason=f"PO {po.po_number} received",
                        reference_type="purchase_order",
                        reference_id=po.id,
                        variant_id=po_item.variant_id,
                        auto_commit=False,
                    )
            except Exception as e:
                log.warning("Inventory update failed for PO item %s: %s", entry["item_id"], e)

        receipt = PurchaseOrderReceipt(
            purchase_order_id=po.id,
            received_by=received_by,
            notes=data.get("notes"),
            items=receipt_items_log,
        )
        self.db.add(receipt)

        all_received = all(
            item.quantity_received >= item.quantity_ordered for item in po.items
        )
        if all_received:
            po.status = "received"
            po.received_at = datetime.now(timezone.utc)
        else:
            po.status = "partial_received"

        await self.db.commit()
        return await self._get(vendor_id, po_id, load_receipts=True)

    # ── Close ────────────────────────────────────────────────────

    async def close(self, vendor_id: UUID, po_id: UUID) -> PurchaseOrder:
        po = await self._get(vendor_id, po_id)
        if po.status != "received":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only fully received purchase orders can be closed",
            )
        po.status = "closed"
        po.closed_at = datetime.now(timezone.utc)
        await self.db.commit()
        return await self._get(vendor_id, po_id)

    # ── Cancel ───────────────────────────────────────────────────

    async def cancel(self, vendor_id: UUID, po_id: UUID) -> PurchaseOrder:
        po = await self._get(vendor_id, po_id)
        if po.status not in ("draft", "sent"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only draft or sent purchase orders can be cancelled",
            )
        po.status = "cancelled"
        await self.db.commit()
        return await self._get(vendor_id, po_id)

    # ── List ─────────────────────────────────────────────────────

    async def list(
        self, vendor_id: UUID,
        status_filter: str | None = None,
        supplier_id: UUID | None = None,
        page: int = 1, size: int = 20,
    ) -> tuple[list[PurchaseOrder], int]:
        conditions = [PurchaseOrder.vendor_id == vendor_id]
        if status_filter:
            conditions.append(PurchaseOrder.status == status_filter)
        if supplier_id:
            conditions.append(PurchaseOrder.supplier_id == supplier_id)

        count_stmt = select(func.count()).select_from(PurchaseOrder).where(and_(*conditions))
        total = (await self.db.execute(count_stmt)).scalar() or 0

        stmt = (
            select(PurchaseOrder)
            .options(selectinload(PurchaseOrder.supplier))
            .options(selectinload(PurchaseOrder.items).selectinload(PurchaseOrderItem.product))
            .where(and_(*conditions))
            .order_by(PurchaseOrder.created_at.desc())
            .offset((page - 1) * size)
            .limit(size)
        )
        result = await self.db.execute(stmt)
        items = list(result.scalars().unique().all())
        return items, total

    # ── Get Single ───────────────────────────────────────────────

    async def get(self, vendor_id: UUID, po_id: UUID) -> PurchaseOrder:
        return await self._get(vendor_id, po_id, load_receipts=True)

    async def _get(
        self, vendor_id: UUID, po_id: UUID, load_receipts: bool = False,
    ) -> PurchaseOrder:
        stmt = (
            select(PurchaseOrder)
            .options(selectinload(PurchaseOrder.supplier))
            .options(selectinload(PurchaseOrder.items).selectinload(PurchaseOrderItem.product))
            .where(
                PurchaseOrder.id == po_id,
                PurchaseOrder.vendor_id == vendor_id,
            )
        )
        if load_receipts:
            stmt = stmt.options(selectinload(PurchaseOrder.receipts))
        result = await self.db.execute(stmt)
        po = result.scalar_one_or_none()
        if not po:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Purchase order not found",
            )
        return po
