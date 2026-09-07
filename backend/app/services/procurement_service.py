# app/services/procurement_service.py
from __future__ import annotations

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
    Supplier, PurchaseOrder, PurchaseOrderItem, PurchaseOrderReceipt, PurchaseOrderApproval,
)
from app.models.procurement_supplier import SupplierOnboarding
from app.models.vendor_user import VendorUser
from app.models.vendor_product import Product
from app.models.plant import Plant
from app.models.storage_location import StorageLocation
from app.models.procurement_special import MaterialValuation
from app.services.inventory_service import InventoryService
from app.services.store_inventory_service import apply_store_inventory_delta, sync_product_quantity_from_stores
from app.services.store_resolver import get_default_store_id
from app.services.procurement_org_context import resolve_po_org_context
from app.utils.procurement_utils import next_doc_number
from app.utils.gst_utils import split_gst_rate, is_intra_state, gstin_state_code

log = logging.getLogger(__name__)


# Tax types that increase the purchase order value. Withholding taxes
# (TDS/TCS/Income) are deducted at payment time, not added to the PO, so a line
# carrying one of those codes is priced at net.
_ADDITIVE_TAX_TYPES = {"CGST", "SGST", "IGST", "UTGST", "GST", "VAT", "CESS"}


async def _load_tax_codes(db: AsyncSession, vendor_id: UUID) -> dict[str, tuple[str, float]]:
    """Active tax codes for a vendor as {UPPERCASE_CODE: (tax_type, rate)}."""
    from app.models.finance import FinTaxCode

    rows = await db.execute(
        select(FinTaxCode).where(
            FinTaxCode.vendor_id == vendor_id,
            FinTaxCode.is_active.is_(True),
        )
    )
    return {
        (tc.code or "").strip().upper(): ((tc.tax_type or "").strip().upper(), float(tc.rate or 0))
        for tc in rows.scalars().all()
    }


def _split_line_tax(
    line_total: float,
    tax_code: str | None,
    tax_codes: dict[str, tuple[str, float]],
    intra_state: bool = False,
) -> dict[str, float]:
    """Resolve a line's tax code into per-bucket rates and amounts.

    For combined GST codes (tax_type == "GST"):
      - intra_state=True  → splits evenly into CGST + SGST
      - intra_state=False → places full rate in IGST

    Explicit CGST / SGST / IGST codes are honoured as-is (single-bucket).
    An unknown or blank code yields zeroes so a PO can be saved while the
    finance tax master is still being configured.

    Keep in sync with resolveLineTax in vendor-web/src/lib/procurementTax.ts.
    """
    zero = {
        "cgst_rate": 0.0, "sgst_rate": 0.0, "igst_rate": 0.0,
        "cgst_amount": 0.0, "sgst_amount": 0.0, "igst_amount": 0.0,
        "tax_amount": 0.0,
    }
    if not tax_code:
        return zero
    entry = tax_codes.get(str(tax_code).strip().upper())
    if not entry:
        return zero

    tax_type, rate = entry
    if tax_type not in _ADDITIVE_TAX_TYPES or rate <= 0:
        return zero

    result = dict(zero)

    if tax_type == "GST":
        # Combined GST code — split direction determined by place of supply.
        cgst_r, sgst_r, igst_r = split_gst_rate(rate, intra_state)
        result["cgst_rate"] = cgst_r
        result["sgst_rate"] = sgst_r
        result["igst_rate"] = igst_r
        result["cgst_amount"] = round(line_total * cgst_r / 100.0, 2)
        result["sgst_amount"] = round(line_total * sgst_r / 100.0, 2)
        result["igst_amount"] = round(line_total * igst_r / 100.0, 2)
    elif tax_type == "CGST":
        result["cgst_rate"] = rate
        result["cgst_amount"] = round(line_total * rate / 100.0, 2)
    elif tax_type in ("SGST", "UTGST"):
        result["sgst_rate"] = rate
        result["sgst_amount"] = round(line_total * rate / 100.0, 2)
    else:
        # IGST / VAT / CESS — single inter-state bucket.
        result["igst_rate"] = rate
        result["igst_amount"] = round(line_total * rate / 100.0, 2)

    result["tax_amount"] = round(
        result["cgst_amount"] + result["sgst_amount"] + result["igst_amount"], 2
    )
    return result


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
        # Check for name/phone/email duplicate against other suppliers
        if any(k in data for k in ("name", "phone", "email")):
            duplicate = await self.find_duplicate(
                vendor_id,
                data.get("name", supplier.name),
                data.get("phone", supplier.phone),
                data.get("email", supplier.email),
                exclude_id=supplier_id,
            )
            if duplicate:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"A supplier named '{duplicate.name}' already exists for this business",
                )
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

    async def reactivate(self, vendor_id: UUID, supplier_id: UUID) -> Supplier:
        supplier = await self._get(vendor_id, supplier_id)
        supplier.is_active = True
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
        page: int = 1,
        size: int = 100,
    ) -> tuple[list[Supplier], int]:
        conditions = [Supplier.vendor_id == vendor_id]
        if is_active is not None:
            conditions.append(Supplier.is_active == is_active)
        if search:
            conditions.append(
                Supplier.name.ilike(f"%{search}%")
                | Supplier.contact_name.ilike(f"%{search}%")
                | Supplier.email.ilike(f"%{search}%")
                | Supplier.gstin.ilike(f"%{search}%")
            )

        count_stmt = select(func.count()).select_from(Supplier).where(and_(*conditions))
        total = (await self.db.execute(count_stmt)).scalar() or 0

        offset = (page - 1) * size
        stmt = (
            select(Supplier)
            .where(and_(*conditions))
            .order_by(Supplier.name.asc())
            .offset(offset)
            .limit(size)
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
        return await next_doc_number(self.db, vendor_id, "PO", width=4)

    # ── Create ───────────────────────────────────────────────────

    async def create(
        self,
        vendor_id: UUID,
        data: dict,
        created_by: UUID | None = None,
        vendor_user_id: UUID | None = None,
    ) -> PurchaseOrder:
        supplier_svc = SupplierService(self.db)
        supplier = await supplier_svc._get(vendor_id, UUID(data["supplier_id"]))

        if not supplier.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot create a Purchase Order for an inactive supplier",
            )

        # Block PO creation if supplier onboarding is blacklisted
        ob_result = await self.db.execute(
            select(SupplierOnboarding).where(
                SupplierOnboarding.supplier_id == supplier.id,
                SupplierOnboarding.vendor_id == vendor_id,
            )
        )
        ob = ob_result.scalar_one_or_none()
        if ob and ob.status == "blacklisted":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot create a Purchase Order for a blacklisted supplier",
            )

        po_number = await self._next_po_number(vendor_id)

        # Resolve place of supply for intra/inter-state GST determination.
        # Fetch the vendor's GSTIN (recipient) to compare against the supplier's.
        from app.models.vendor import Vendor as VendorModel
        vendor_row = await self.db.get(VendorModel, vendor_id)
        vendor_gstin: str | None = getattr(vendor_row, "gstin", None)
        vendor_state: str | None = getattr(vendor_row, "state", None)

        supplier_gstin: str | None = supplier.gstin
        intra = is_intra_state(
            supplier_gstin=supplier_gstin,
            recipient_gstin=vendor_gstin,
            recipient_state_name=vendor_state if not vendor_gstin else None,
        )
        # Store the supplier's state code as the place of supply on the PO
        pos_code = gstin_state_code(supplier_gstin)

        tax_codes = await _load_tax_codes(self.db, vendor_id)

        subtotal = 0.0
        cgst_total = sgst_total = igst_total = 0.0
        po_items = []
        for item_data in data["items"]:
            qty = item_data["quantity"]
            cost = item_data["unit_cost"]
            line_total = round(qty * cost, 2)
            subtotal += line_total
            tax = _split_line_tax(line_total, item_data.get("tax_code"), tax_codes, intra_state=intra)
            cgst_total += tax["cgst_amount"]
            sgst_total += tax["sgst_amount"]
            igst_total += tax["igst_amount"]
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
                unit_of_measure=item_data.get("unit_of_measure") or "PCS",
                item_category=item_data.get("item_category") or "standard",
                tax_code=item_data.get("tax_code"),
                hsn_code=item_data.get("hsn_code"),
                account_assignment=item_data.get("account_assignment"),
                account_assignment_value=item_data.get("account_assignment_value"),
                cgst_rate=tax["cgst_rate"],
                sgst_rate=tax["sgst_rate"],
                igst_rate=tax["igst_rate"],
                cgst_amount=tax["cgst_amount"],
                sgst_amount=tax["sgst_amount"],
                igst_amount=tax["igst_amount"],
            ))

        subtotal = round(subtotal, 2)
        tax_amount = round(cgst_total + sgst_total + igst_total, 2)
        total = round(subtotal + tax_amount, 2)

        requisition_id = None
        if data.get("requisition_id"):
            try:
                requisition_id = UUID(str(data["requisition_id"]))
            except (TypeError, ValueError):
                requisition_id = None

        company_id, branch_id, header_plant_id = await resolve_po_org_context(
            self.db,
            vendor_id,
            branch_id=data.get("branch_id"),
            plant_id=data.get("plant_id"),
            company_id=data.get("company_id"),
            line_plant_ids=[i.get("plant_id") for i in data["items"]],
            vendor_user_id=vendor_user_id,
            user_id=created_by,
        )

        po = PurchaseOrder(
            vendor_id=vendor_id,
            supplier_id=UUID(data["supplier_id"]),
            po_number=po_number,
            status="draft",
            order_date=data.get("order_date") or date.today(),
            expected_delivery_date=data.get("expected_delivery_date"),
            notes=data.get("notes"),
            currency=data.get("currency") or "INR",
            payment_terms=data.get("payment_terms"),
            approver_message=data.get("approver_message"),
            place_of_supply=pos_code,
            company_id=company_id,
            branch_id=branch_id,
            plant_id=header_plant_id,
            subtotal=subtotal,
            cgst_amount=round(cgst_total, 2),
            sgst_amount=round(sgst_total, 2),
            igst_amount=round(igst_total, 2),
            tax_amount=tax_amount,
            total=total,
            created_by=created_by,
            requisition_id=requisition_id,
            items=po_items,
        )
        self.db.add(po)
        await self.db.flush()

        # Attach approvers if provided at creation time
        for apv in sorted(data.get("approvers") or [], key=lambda a: a.get("level", 1)):
            self.db.add(PurchaseOrderApproval(
                purchase_order_id=po.id,
                level=apv.get("level", 1),
                approver_id=UUID(apv["approver_id"]),
                status="pending",
            ))

        if requisition_id:
            await self._mark_requisition_converted(
                vendor_id=vendor_id,
                requisition_id=requisition_id,
                purchase_order_id=po.id,
                pr_item_ids=data.get("pr_item_ids") or [],
                po_items=data.get("items") or [],
            )

        await self.db.commit()

        return await self._get(vendor_id, po.id)

    async def _mark_requisition_converted(
        self,
        vendor_id: UUID,
        requisition_id: UUID,
        purchase_order_id: UUID,
        pr_item_ids: list,
        po_items: list,
    ) -> None:
        """Link converted PR lines to the new PO and update PR status."""
        from app.models.procurement_requisition import PurchaseRequisition, PurchaseRequisitionItem

        result = await self.db.execute(
            select(PurchaseRequisition)
            .options(selectinload(PurchaseRequisition.items))
            .where(
                PurchaseRequisition.id == requisition_id,
                PurchaseRequisition.vendor_id == vendor_id,
            )
        )
        pr = result.scalar_one_or_none()
        if not pr:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Purchase requisition not found",
            )
        if pr.status not in ("open", "approved", "partially_converted"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot convert a {pr.status} requisition",
            )

        selected_ids = {str(x) for x in (pr_item_ids or []) if x}
        # Fall back: match unconverted PR lines by product/service id from PO items
        po_product_ids = {
            str(i.get("product_id")) for i in po_items if i.get("product_id")
        }

        for item in pr.items or []:
            item_id = str(item.id)
            catalog_id = str(item.product_id or item.service_id or "")
            should_convert = (
                item_id in selected_ids
                if selected_ids
                else (catalog_id in po_product_ids and not item.is_converted)
            )
            if not should_convert:
                continue

            qty = float(item.quantity or 0)
            item.is_converted = True
            item.quantity_ordered = qty
            item.purchase_order_id = purchase_order_id

        remaining = [i for i in (pr.items or []) if not i.is_converted]
        pr.status = "partially_converted" if remaining else "converted"
        pr.audit_log = (pr.audit_log or []) + [{
            "action": "converted_to_po",
            "purchase_order_id": str(purchase_order_id),
            "at": datetime.now(timezone.utc).isoformat(),
        }]

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
        if data.get("order_date") is not None:
            po.order_date = data["order_date"]
        if data.get("notes") is not None:
            po.notes = data["notes"]
        if data.get("currency") is not None:
            po.currency = data["currency"]
        if data.get("payment_terms") is not None:
            po.payment_terms = data["payment_terms"]
        if data.get("approver_message") is not None:
            po.approver_message = data["approver_message"]

        if any(data.get(k) is not None for k in ("branch_id", "plant_id", "company_id")):
            po.company_id, po.branch_id, po.plant_id = await resolve_po_org_context(
                self.db,
                vendor_id,
                branch_id=data.get("branch_id") or po.branch_id,
                plant_id=data.get("plant_id") or po.plant_id,
                company_id=data.get("company_id") or po.company_id,
                line_plant_ids=[i.get("plant_id") for i in (data.get("items") or [])],
            )

        if data.get("items") is not None:
            for old_item in list(po.items):
                await self.db.delete(old_item)
            await self.db.flush()

            # Re-resolve place of supply in case supplier changed
            from app.models.vendor import Vendor as VendorModel
            vendor_row = await self.db.get(VendorModel, vendor_id)
            vendor_gstin = getattr(vendor_row, "gstin", None)
            vendor_state = getattr(vendor_row, "state", None)
            supplier_result = await self.db.execute(
                select(Supplier).where(Supplier.id == po.supplier_id)
            )
            current_supplier = supplier_result.scalar_one_or_none()
            supplier_gstin = getattr(current_supplier, "gstin", None) if current_supplier else None
            intra = is_intra_state(
                supplier_gstin=supplier_gstin,
                recipient_gstin=vendor_gstin,
                recipient_state_name=vendor_state if not vendor_gstin else None,
            )
            po.place_of_supply = gstin_state_code(supplier_gstin)

            tax_codes = await _load_tax_codes(self.db, vendor_id)

            subtotal = 0.0
            cgst_total = sgst_total = igst_total = 0.0
            new_items = []
            for item_data in data["items"]:
                qty = item_data["quantity"]
                cost = item_data["unit_cost"]
                line_total = round(qty * cost, 2)
                subtotal += line_total
                tax = _split_line_tax(line_total, item_data.get("tax_code"), tax_codes, intra_state=intra)
                cgst_total += tax["cgst_amount"]
                sgst_total += tax["sgst_amount"]
                igst_total += tax["igst_amount"]
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
                    unit_of_measure=item_data.get("unit_of_measure") or "PCS",
                    item_category=item_data.get("item_category") or "standard",
                    tax_code=item_data.get("tax_code"),
                    hsn_code=item_data.get("hsn_code"),
                    account_assignment=item_data.get("account_assignment"),
                    account_assignment_value=item_data.get("account_assignment_value"),
                    cgst_rate=tax["cgst_rate"],
                    sgst_rate=tax["sgst_rate"],
                    igst_rate=tax["igst_rate"],
                    cgst_amount=tax["cgst_amount"],
                    sgst_amount=tax["sgst_amount"],
                    igst_amount=tax["igst_amount"],
                ))
            self.db.add_all(new_items)
            po.subtotal = round(subtotal, 2)
            po.cgst_amount = round(cgst_total, 2)
            po.sgst_amount = round(sgst_total, 2)
            po.igst_amount = round(igst_total, 2)
            po.tax_amount = round(cgst_total + sgst_total + igst_total, 2)
            po.total = round(subtotal + float(po.tax_amount), 2)

        if "approvers" in data and data["approvers"] is not None:
            # Clear pending approvals and replace; preserve already-actioned ones
            existing = await self.db.execute(
                select(PurchaseOrderApproval).where(PurchaseOrderApproval.purchase_order_id == po.id)
            )
            for apv in existing.scalars().all():
                await self.db.delete(apv)
            await self.db.flush()
            for apv in sorted(data["approvers"], key=lambda a: a.get("level", 1)):
                self.db.add(PurchaseOrderApproval(
                    purchase_order_id=po.id,
                    level=apv.get("level", 1),
                    approver_id=UUID(apv["approver_id"]),
                    status="pending",
                ))
            # If approval_status was not_required but approvers are now set, mark pending
            if data["approvers"] and po.approval_status == "not_required":
                po.approval_status = "pending"
            elif not data["approvers"] and po.approval_status == "pending":
                po.approval_status = "not_required"

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
        if po.approval_status == "pending":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Purchase order is pending approval and cannot be sent until approved",
            )
        po.status = "sent"
        po.order_date = date.today()
        await self.db.commit()
        return await self._get(vendor_id, po_id)

    # ── Receive Items ────────────────────────────────────────────

    async def receive_items(
        self, vendor_id: UUID, po_id: UUID, data: dict, received_by: UUID | None = None,
    ) -> PurchaseOrder:
        from app.utils.procurement_utils import next_doc_number
        from app.services.inventory_service import MOVEMENT_DOC_PREFIX

        po = await self._get(vendor_id, po_id, load_receipts=True)
        if po.status not in ("sent", "partial_received"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Can only receive items for sent or partially received POs",
            )

        # Generate ONE document number for this entire receipt event so all
        # inventory movement lines share the same document reference.
        try:
            receipt_doc_number = await next_doc_number(
                self.db, vendor_id, MOVEMENT_DOC_PREFIX.get("purchase", "GRC"), width=8
            )
        except Exception:
            receipt_doc_number = None

        items_map = {str(item.id): item for item in po.items}
        receipt_items_log = []
        receipt_line_no = 0

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

            track_id = (entry.get("track_id") or "").strip() or None
            reference = (entry.get("reference") or "").strip() or None
            note_bits = [p for p in [
                f"Track: {track_id}" if track_id else None,
                f"Ref: {reference}" if reference else None,
            ] if p]
            lot_notes = " · ".join(note_bits) if note_bits else None

            def _as_uuid(raw):
                if not raw:
                    return None
                try:
                    return UUID(str(raw))
                except (TypeError, ValueError):
                    return None

            plant_id = _as_uuid(entry.get("plant_id")) or po_item.plant_id or _as_uuid(data.get("plant_id"))
            storage_location_id = (
                _as_uuid(entry.get("storage_location_id"))
                or po_item.storage_location_id
                or _as_uuid(data.get("storage_location_id"))
            )

            receipt_items_log.append({
                "item_id": str(po_item.id),
                "product_id": str(po_item.product_id),
                "variant_id": str(po_item.variant_id) if po_item.variant_id else None,
                "quantity_received": entry["quantity"],
                "batch_number": entry.get("batch_number"),
                "supplier_batch_number": entry.get("supplier_batch_number"),
                "manufacturing_date": (
                    entry["manufacturing_date"].isoformat()
                    if hasattr(entry.get("manufacturing_date"), "isoformat")
                    else entry.get("manufacturing_date")
                ),
                "expiry_date": (
                    entry["expiry_date"].isoformat()
                    if hasattr(entry.get("expiry_date"), "isoformat")
                    else entry.get("expiry_date")
                ),
                "track_id": track_id,
                "reference": reference,
                "plant_id": str(plant_id) if plant_id else None,
                "storage_location_id": str(storage_location_id) if storage_location_id else None,
            })

            product = None
            try:
                product = await self.db.get(Product, po_item.product_id)
                if product and product.track_inventory:
                    # Resolve the destination business unit for StoreInventory
                    store_id = await self._resolve_store_for_po_receipt(
                        vendor_id, plant_id, storage_location_id
                    )
                    if store_id:
                        try:
                            await apply_store_inventory_delta(
                                self.db, vendor_id, store_id,
                                po_item.product_id, po_item.variant_id,
                                abs(entry["quantity"]), storage_location_id,
                            )
                        except ValueError as e:
                            log.warning(
                                "PO %s item %s: StoreInventory delta failed (%s)",
                                po.po_number, entry["item_id"], e,
                            )

                    receipt_line_no += 1
                    movement = await self.inventory_svc.record_movement(
                        vendor_id=vendor_id,
                        product_id=po_item.product_id,
                        movement_type="purchase",
                        quantity=abs(entry["quantity"]),
                        reason=f"PO {po.po_number} received",
                        reference_type="purchase_order",
                        reference_id=po.id,
                        variant_id=po_item.variant_id,
                        auto_commit=False,
                        performed_by=received_by,
                        document_number=receipt_doc_number,
                        document_line_no=receipt_line_no,
                    )
                    if store_id:
                        movement.store_id = store_id
                        if storage_location_id:
                            movement.storage_location_id = storage_location_id
                        await sync_product_quantity_from_stores(
                            self.db, vendor_id, po_item.product_id, po_item.variant_id
                        )
                # Pharma: create lot on GR for batch-managed products (QI when required).
                if product and getattr(product, "batch_managed", False):
                    from decimal import Decimal
                    from app.services.pharma_batch import create_receipt_batch
                    qc_req = bool(getattr(product, "qc_required_on_receipt", False))
                    await create_receipt_batch(
                        self.db,
                        vendor_id=vendor_id,
                        product_id=po_item.product_id,
                        quantity=Decimal(str(entry["quantity"])),
                        source_id=po.id,
                        source_type="purchase",
                        document_number=po.po_number,
                        variant_id=po_item.variant_id,
                        plant_id=plant_id,
                        storage_location_id=storage_location_id,
                        batch_number=entry.get("batch_number"),
                        supplier_batch_number=entry.get("supplier_batch_number"),
                        manufacturing_date=entry.get("manufacturing_date"),
                        expiry_date=entry.get("expiry_date"),
                        qc_required=qc_req,
                        notes=lot_notes,
                    )
                    receipt_items_log[-1]["batch_managed"] = True
                    receipt_items_log[-1]["qc_required_on_receipt"] = qc_req

                # Upsert MaterialValuation for this product/plant
                receipt_qty = float(entry["quantity"])
                receipt_cost = float(po_item.unit_cost) if po_item.unit_cost else 0
                if po_item.product_id:
                    await self._upsert_material_valuation(
                        vendor_id=vendor_id,
                        product_id=po_item.product_id,
                        variant_id=po_item.variant_id,
                        plant_id=plant_id,
                        qty_signed=receipt_qty,
                        unit_cost=receipt_cost,
                    )

                    # Create FIFO cost layer for the received qty
                    from app.services.fifo_cost_service import FifoCostService
                    from app.services.cost_resolution import refresh_product_cost
                    fifo = FifoCostService(self.db)
                    await fifo.create_layer(
                        vendor_id=vendor_id,
                        product_id=po_item.product_id,
                        unit_cost=receipt_cost,
                        quantity=receipt_qty,
                        variant_id=po_item.variant_id,
                        source_type="purchase",
                        auto_commit=False,
                    )
                    # Refresh cached product.cost_price
                    await refresh_product_cost(
                        self.db, vendor_id, po_item.product_id, po_item.variant_id, plant_id
                    )
            except HTTPException:
                raise
            except ValueError as e:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
            except Exception as e:
                log.warning("Inventory update failed for PO item %s: %s", entry["item_id"], e)
                if product and getattr(product, "batch_managed", False):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Failed to create goods batch for PO item: {e}",
                    ) from e

        # Receipt header destination: explicit request → first line → None
        hdr_plant = None
        hdr_sloc = None
        try:
            hdr_plant = UUID(str(data["plant_id"])) if data.get("plant_id") else None
        except (TypeError, ValueError):
            hdr_plant = None
        try:
            hdr_sloc = UUID(str(data["storage_location_id"])) if data.get("storage_location_id") else None
        except (TypeError, ValueError):
            hdr_sloc = None
        if not hdr_plant and receipt_items_log:
            try:
                hdr_plant = UUID(receipt_items_log[0]["plant_id"]) if receipt_items_log[0].get("plant_id") else None
            except (TypeError, ValueError):
                hdr_plant = None
        if not hdr_sloc and receipt_items_log:
            try:
                hdr_sloc = (
                    UUID(receipt_items_log[0]["storage_location_id"])
                    if receipt_items_log[0].get("storage_location_id") else None
                )
            except (TypeError, ValueError):
                hdr_sloc = None

        receipt = PurchaseOrderReceipt(
            purchase_order_id=po.id,
            received_by=received_by,
            notes=data.get("notes"),
            plant_id=hdr_plant,
            storage_location_id=hdr_sloc,
            posting_date=data.get("posting_date"),
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

    # ── Store resolver for legacy PO receipt path ────────────────────

    async def _resolve_store_for_po_receipt(
        self,
        vendor_id: UUID,
        plant_id: UUID | None,
        storage_location_id: UUID | None,
    ) -> UUID | None:
        """Resolve the business-unit store_id for a PO goods receipt.

        Priority:
          1. storage_location_id → StorageLocation.store_id
          2. plant_id → Plant.store_id
          3. vendor's default store
        """
        from sqlalchemy import select as _select
        if storage_location_id:
            row = await self.db.execute(
                _select(StorageLocation.store_id).where(StorageLocation.id == storage_location_id)
            )
            store_id = row.scalars().first()
            if store_id:
                return store_id
        if plant_id:
            row = await self.db.execute(
                _select(Plant.store_id).where(Plant.id == plant_id)
            )
            store_id = row.scalars().first()
            if store_id:
                return store_id
        return await get_default_store_id(self.db, vendor_id)

    # ── Material Valuation Upsert (called on every goods receipt) ──

    async def _upsert_material_valuation(
        self,
        vendor_id: UUID,
        product_id: UUID,
        variant_id: UUID | None,
        plant_id: UUID | None,
        qty_signed: float,        # positive = receipt, negative = reversal / return
        unit_cost: float,
    ) -> None:
        """
        Create or update the MaterialValuation record for this product/plant.

        - moving_average : MAP = (old_value + qty * cost) / new_stock
        - standard       : total_stock / total_value updated; MAP not recomputed
        - fixed          : total_stock / total_value updated; MAP not recomputed
        On reversal (qty_signed < 0) the stock / value are decremented;
        MAP is recalculated from the remaining stock and value.
        """
        from decimal import Decimal
        from app.models.vendor_product import Product

        if unit_cost <= 0 and qty_signed > 0:
            return  # nothing useful to store

        # Read the product's valuation method
        prod_row = (await self.db.execute(
            select(Product).where(Product.id == product_id, Product.vendor_id == vendor_id)
        )).scalar_one_or_none()
        product_method = (prod_row.valuation_method if prod_row else None) or "moving_average"

        result = await self.db.execute(
            select(MaterialValuation).where(
                MaterialValuation.vendor_id == vendor_id,
                MaterialValuation.product_id == product_id,
                (
                    MaterialValuation.variant_id == variant_id
                    if variant_id else MaterialValuation.variant_id.is_(None)
                ),
                (
                    MaterialValuation.plant_id == plant_id
                    if plant_id else MaterialValuation.plant_id.is_(None)
                ),
            ).limit(1)
        )
        mv = result.scalar_one_or_none()

        qty = qty_signed
        cost = float(unit_cost)

        if mv is None:
            if qty <= 0:
                return  # no record to reverse
            initial_map = cost if product_method == "moving_average" else 0
            mv = MaterialValuation(
                vendor_id=vendor_id,
                product_id=product_id,
                variant_id=variant_id,
                plant_id=plant_id,
                valuation_method=product_method,
                currency="INR",
                moving_avg_price=Decimal(str(round(initial_map, 4))),
                standard_price=Decimal("0"),
                total_stock=Decimal(str(max(qty, 0))),
                total_value=Decimal(str(round(max(qty, 0) * cost, 2))),
                last_po_price=Decimal(str(cost)) if qty > 0 else Decimal("0"),
                last_purchase_date=date.today() if qty > 0 else None,
            )
            self.db.add(mv)
        else:
            cur_stock = float(mv.total_stock or 0)
            cur_value = float(mv.total_value or 0)
            new_stock = max(cur_stock + qty, 0)
            new_value = max(cur_value + qty * cost, 0)

            mv.total_stock = Decimal(str(round(new_stock, 4)))
            mv.total_value = Decimal(str(round(new_value, 2)))
            mv.valuation_method = product_method  # keep in sync with product setting

            if product_method == "moving_average":
                new_map = (new_value / new_stock) if new_stock > 0 else float(mv.moving_avg_price or 0)
                mv.moving_avg_price = Decimal(str(round(new_map, 4)))

            if qty > 0:
                mv.last_po_price = Decimal(str(round(cost, 4)))
                mv.last_purchase_date = date.today()

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
        pending_my_approval: bool = False,
        approver_id: UUID | None = None,
    ) -> tuple[list[PurchaseOrder], int]:
        if pending_my_approval and approver_id:
            return await self.list_pending_for_approver(vendor_id, approver_id, page=page, size=size)

        conditions = [PurchaseOrder.vendor_id == vendor_id]
        if status_filter:
            statuses = [s.strip() for s in status_filter.split(",") if s.strip()]
            if len(statuses) == 1:
                conditions.append(PurchaseOrder.status == statuses[0])
            elif len(statuses) > 1:
                conditions.append(PurchaseOrder.status.in_(statuses))
        if supplier_id:
            conditions.append(PurchaseOrder.supplier_id == supplier_id)

        count_stmt = select(func.count()).select_from(PurchaseOrder).where(and_(*conditions))
        total = (await self.db.execute(count_stmt)).scalar() or 0

        stmt = (
            select(PurchaseOrder)
            .options(selectinload(PurchaseOrder.supplier))
            .options(selectinload(PurchaseOrder.items).selectinload(PurchaseOrderItem.product))
            .options(
                selectinload(PurchaseOrder.approvals)
                .selectinload(PurchaseOrderApproval.approver)
                .selectinload(VendorUser.user)
            )
            .where(and_(*conditions))
            .order_by(PurchaseOrder.created_at.desc())
            .offset((page - 1) * size)
            .limit(size)
        )
        result = await self.db.execute(stmt)
        items = list(result.scalars().unique().all())
        return items, total

    async def list_pending_for_approver(
        self, vendor_id: UUID, approver_id: UUID, page: int = 1, size: int = 20,
    ) -> tuple[list[PurchaseOrder], int]:
        """POs in pending approval status whose current (lowest-level) pending step is for approver_id."""
        min_pending_level = (
            select(
                PurchaseOrderApproval.purchase_order_id,
                func.min(PurchaseOrderApproval.level).label("min_level"),
            )
            .where(PurchaseOrderApproval.status == "pending")
            .group_by(PurchaseOrderApproval.purchase_order_id)
            .subquery()
        )
        base = (
            select(PurchaseOrder)
            .join(PurchaseOrderApproval, PurchaseOrderApproval.purchase_order_id == PurchaseOrder.id)
            .join(
                min_pending_level,
                and_(
                    min_pending_level.c.purchase_order_id == PurchaseOrder.id,
                    PurchaseOrderApproval.level == min_pending_level.c.min_level,
                ),
            )
            .where(
                PurchaseOrder.vendor_id == vendor_id,
                PurchaseOrder.approval_status == "pending",
                PurchaseOrderApproval.approver_id == approver_id,
                PurchaseOrderApproval.status == "pending",
            )
        )
        count_result = await self.db.execute(
            select(func.count()).select_from(base.subquery())
        )
        total = count_result.scalar_one()

        result = await self.db.execute(
            base
            .options(selectinload(PurchaseOrder.supplier))
            .options(selectinload(PurchaseOrder.items).selectinload(PurchaseOrderItem.product))
            .options(
                selectinload(PurchaseOrder.approvals)
                .selectinload(PurchaseOrderApproval.approver)
                .selectinload(VendorUser.user)
            )
            .order_by(PurchaseOrder.created_at.desc())
            .offset((page - 1) * size)
            .limit(size)
        )
        return list(result.scalars().unique().all()), total

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
            .options(
                selectinload(PurchaseOrder.approvals)
                .selectinload(PurchaseOrderApproval.approver)
                .selectinload(VendorUser.user)
            )
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
