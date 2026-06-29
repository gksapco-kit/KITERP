# app/repositories/procurement_invoice_repo.py
from typing import Optional, List
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func as sqlfunc
from sqlalchemy.orm import selectinload
from decimal import Decimal

from app.repositories.base import BaseRepository
from app.models.procurement_invoice import VendorInvoice, VendorInvoiceItem
from app.models.procurement import PurchaseOrder, PurchaseOrderItem, PurchaseOrderReceipt


class VendorInvoiceRepository(BaseRepository[VendorInvoice]):
    def __init__(self, db: AsyncSession):
        super().__init__(VendorInvoice, db)

    async def get_by_vendor_and_id(
        self, vendor_id: UUID, invoice_id: UUID
    ) -> Optional[VendorInvoice]:
        result = await self.db.execute(
            select(VendorInvoice)
            .options(selectinload(VendorInvoice.items))
            .where(
                VendorInvoice.vendor_id == vendor_id,
                VendorInvoice.id == invoice_id,
            )
        )
        return result.scalar_one_or_none()

    async def get_by_invoice_number(
        self, vendor_id: UUID, invoice_number: str
    ) -> Optional[VendorInvoice]:
        result = await self.db.execute(
            select(VendorInvoice).where(
                VendorInvoice.vendor_id == vendor_id,
                VendorInvoice.invoice_number == invoice_number,
            )
        )
        return result.scalar_one_or_none()

    async def list_by_vendor(
        self,
        vendor_id: UUID,
        status: Optional[str] = None,
        match_status: Optional[str] = None,
        supplier_id: Optional[UUID] = None,
        skip: int = 0,
        limit: int = 20,
    ) -> tuple[List[VendorInvoice], int]:
        conditions = [VendorInvoice.vendor_id == vendor_id]
        if status:
            conditions.append(VendorInvoice.status == status)
        if match_status:
            conditions.append(VendorInvoice.match_status == match_status)
        if supplier_id:
            conditions.append(VendorInvoice.supplier_id == supplier_id)

        count_result = await self.db.execute(
            select(sqlfunc.count()).select_from(VendorInvoice).where(and_(*conditions))
        )
        total = count_result.scalar_one()

        result = await self.db.execute(
            select(VendorInvoice)
            .options(selectinload(VendorInvoice.items))
            .where(and_(*conditions))
            .order_by(VendorInvoice.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all()), total

    async def run_three_way_match(
        self,
        invoice: VendorInvoice,
        qty_tolerance_pct: float = 0.0,
        price_tolerance_pct: float = 0.0,
    ) -> VendorInvoice:
        """
        Perform a 3-way match (PO ↔ GR ↔ Invoice) for every line on this invoice.
        Updates each VendorInvoiceItem.match_status and the header match_status.
        Returns the updated invoice (caller must commit).
        """
        any_blocked = False
        any_unmatched = False

        for item in invoice.items:
            if item.po_item_id is None:
                item.match_status = "unmatched"
                any_unmatched = True
                continue

            # Pull PO line
            po_item_result = await self.db.execute(
                select(PurchaseOrderItem).where(PurchaseOrderItem.id == item.po_item_id)
            )
            po_item = po_item_result.scalar_one_or_none()
            if not po_item:
                item.match_status = "unmatched"
                any_unmatched = True
                continue

            item.ordered_qty = Decimal(str(po_item.quantity_ordered))
            item.received_qty = Decimal(str(po_item.quantity_received))
            item.po_unit_price = Decimal(str(po_item.unit_cost))

            # Qty variance
            item.qty_variance = item.invoiced_qty - item.received_qty

            # Price variance
            item.price_variance = item.unit_price - item.po_unit_price

            qty_ok = True
            price_ok = True

            if item.received_qty > 0:
                qty_diff_pct = abs(float(item.qty_variance) / float(item.received_qty)) * 100
                if qty_diff_pct > qty_tolerance_pct:
                    qty_ok = False
            elif float(item.invoiced_qty) > 0:
                qty_ok = False

            if float(item.po_unit_price) > 0:
                price_diff_pct = abs(float(item.price_variance) / float(item.po_unit_price)) * 100
                if price_diff_pct > price_tolerance_pct:
                    price_ok = False

            if qty_ok and price_ok:
                item.match_status = "matched"
            elif not qty_ok:
                item.match_status = "blocked_qty"
                any_blocked = True
            else:
                item.match_status = "blocked_price"
                any_blocked = True

        # Roll up to header
        all_statuses = {i.match_status for i in invoice.items}
        if all_statuses == {"matched"}:
            invoice.match_status = "matched"
        elif any_blocked:
            invoice.match_status = "blocked_qty" if "blocked_qty" in all_statuses else "blocked_price"
        elif any_unmatched:
            invoice.match_status = "unmatched"
        else:
            invoice.match_status = "partial"

        return invoice
