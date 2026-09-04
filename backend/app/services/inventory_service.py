from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, case, literal_column
from sqlalchemy.orm import selectinload
from uuid import UUID
import uuid as uuid_mod
import math

from app.models.inventory import InventoryMovement
from app.models.vendor_product import Product, ProductVariant
from app.models.store import Store, StoreInventory
from app.services.catalog_store_scope import product_available_at_store
from app.services.store_inventory_service import (
    apply_store_inventory_delta,
    get_store_inventory_row,
    sync_product_quantity_from_stores,
)
from app.services.store_resolver import get_default_store_id
from app.utils.procurement_utils import next_doc_number

# Per-movement-type document prefix.  Each prefix maps to its own
# DocumentSequence row so different movement types don't share a counter.
MOVEMENT_DOC_PREFIX: dict[str, str] = {
    "purchase": "GRC",
    "stock_in": "SIN",
    "stock_out": "SOU",
    "adjustment": "ADJ",
    "transfer": "TRF",
    "stock_count": "CNT",
    "purchase_return": "RTV",
    "sale": "SAL",
    "sale_return": "SRT",
    "initial": "INI",
    "write_off": "WOF",
}


class InventoryService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def record_movement(
        self,
        vendor_id: UUID,
        product_id: UUID,
        movement_type: str,
        quantity: int,
        performed_by: UUID | None = None,
        variant_id: UUID | None = None,
        reason: str | None = None,
        reference_type: str | None = None,
        reference_id: UUID | None = None,
        metadata: dict | None = None,
        auto_commit: bool = True,
        document_number: str | None = None,
        document_line_no: int = 1,
    ) -> InventoryMovement:
        """
        Core method: record a stock movement and update the product/variant quantity.
        quantity should be positive for stock-in, negative for stock-out.
        Set auto_commit=False when calling from within another service's transaction.

        document_number: pass an already-generated number (for multi-line postings
          where all lines share one document).  When None a new number is generated
          automatically using the DocumentSequence for this movement_type.
        document_line_no: 1-based line within the posting document.
        """
        if variant_id:
            stmt = select(ProductVariant).where(
                ProductVariant.id == variant_id,
                ProductVariant.product_id == product_id,
            )
            result = await self.db.execute(stmt)
            entity = result.scalar_one_or_none()
        else:
            stmt = select(Product).where(
                Product.id == product_id,
                Product.vendor_id == vendor_id,
            )
            result = await self.db.execute(stmt)
            entity = result.scalar_one_or_none()

        if not entity:
            raise ValueError("Product or variant not found")

        qty_before = entity.quantity or 0
        qty_after = qty_before + quantity

        if qty_after < 0 and movement_type not in ("adjustment",):
            raise ValueError(f"Insufficient stock. Available: {qty_before}, requested: {abs(quantity)}")

        entity.quantity = max(0, qty_after)

        if hasattr(entity, "stock_status"):
            if entity.quantity <= 0:
                entity.stock_status = "out_of_stock"
            elif entity.stock_status == "out_of_stock":
                entity.stock_status = "in_stock"

        # Generate document number if caller did not supply one
        if document_number is None:
            prefix = MOVEMENT_DOC_PREFIX.get(movement_type, "MOV")
            try:
                document_number = await next_doc_number(self.db, vendor_id, prefix, width=8)
            except Exception:
                document_number = None  # non-fatal: numbering is best-effort

        movement = InventoryMovement(
            id=uuid_mod.uuid4(),
            vendor_id=vendor_id,
            product_id=product_id,
            variant_id=variant_id,
            movement_type=movement_type,
            quantity=quantity,
            quantity_before=qty_before,
            quantity_after=entity.quantity,
            reason=reason,
            reference_type=reference_type or "manual",
            reference_id=reference_id,
            performed_by=performed_by,
            extra_data=metadata or {},
            document_number=document_number,
            document_line_no=document_line_no,
        )
        self.db.add(movement)

        if variant_id:
            await self._sync_parent_product_quantity(product_id)

        if auto_commit:
            await self.db.commit()
            await self._maybe_notify_low_stock(vendor_id, product_id, variant_id, entity)
        return movement

    async def record_movement_no_commit(
        self,
        vendor_id: UUID,
        product_id: UUID,
        movement_type: str,
        quantity: int,
        performed_by: UUID | None = None,
        variant_id: UUID | None = None,
        reason: str | None = None,
        reference_type: str | None = None,
        reference_id: UUID | None = None,
        metadata: dict | None = None,
        document_number: str | None = None,
        document_line_no: int = 1,
    ) -> InventoryMovement:
        """
        Like record_movement but does NOT commit — used when the caller
        manages the DB transaction (e.g. POS service, order service).

        document_number: pass an already-generated number (for multi-line postings).
          When None a number is generated via next_doc_number (flush-only, no commit).
        """
        if variant_id:
            stmt = select(ProductVariant).where(
                ProductVariant.id == variant_id,
                ProductVariant.product_id == product_id,
            )
            result = await self.db.execute(stmt)
            entity = result.scalar_one_or_none()
        else:
            stmt = select(Product).where(
                Product.id == product_id,
                Product.vendor_id == vendor_id,
            )
            result = await self.db.execute(stmt)
            entity = result.scalar_one_or_none()

        if not entity:
            raise ValueError("Product or variant not found")

        qty_before = entity.quantity or 0
        qty_after = qty_before + quantity

        # For sales we cap at 0 — never raise on POS/order context
        if qty_after < 0 and movement_type in ("adjustment",):
            raise ValueError(f"Insufficient stock. Available: {qty_before}")

        entity.quantity = max(0, qty_after)

        if hasattr(entity, "stock_status"):
            if entity.quantity <= 0:
                entity.stock_status = "out_of_stock"
            elif entity.stock_status == "out_of_stock":
                entity.stock_status = "in_stock"

        # Generate document number if caller did not supply one
        if document_number is None:
            prefix = MOVEMENT_DOC_PREFIX.get(movement_type, "MOV")
            try:
                document_number = await next_doc_number(self.db, vendor_id, prefix, width=8)
            except Exception:
                document_number = None  # non-fatal

        movement = InventoryMovement(
            id=uuid_mod.uuid4(),
            vendor_id=vendor_id,
            product_id=product_id,
            variant_id=variant_id,
            movement_type=movement_type,
            quantity=quantity,
            quantity_before=qty_before,
            quantity_after=entity.quantity,
            reason=reason,
            reference_type=reference_type or "manual",
            reference_id=reference_id,
            performed_by=performed_by,
            extra_data=metadata or {},
            document_number=document_number,
            document_line_no=document_line_no,
        )
        self.db.add(movement)

        if variant_id:
            await self._sync_parent_product_quantity(product_id)

        return movement

    async def _maybe_notify_low_stock(
        self,
        vendor_id: UUID,
        product_id: UUID,
        variant_id: UUID | None,
        entity,
    ) -> None:
        import logging as _logging
        _log = _logging.getLogger(__name__)
        threshold = getattr(entity, "low_stock_threshold", None)
        if threshold is None:
            threshold = 5
        qty = entity.quantity or 0
        if qty > threshold:
            return
        name = getattr(entity, "name", None) or getattr(entity, "sku", None) or "Product"
        try:
            from app.services.notification_service import NotificationService

            await NotificationService(self.db).notify_low_stock(
                vendor_id=vendor_id,
                product_name=str(name),
                quantity=qty,
                product_id=product_id,
            )
            await self.db.commit()
        except Exception:
            _log.warning(
                "Low-stock notification failed for product %s (vendor %s)", product_id, vendor_id,
                exc_info=True,
            )

    async def _sync_parent_product_quantity(self, product_id: UUID):
        """Sum variant quantities and update the parent product."""
        stmt = select(func.coalesce(func.sum(ProductVariant.quantity), 0)).where(
            ProductVariant.product_id == product_id,
            ProductVariant.is_active == True,
        )
        result = await self.db.execute(stmt)
        total = result.scalar()

        product = await self.db.get(Product, product_id)
        if product:
            product.quantity = total
            if product.track_inventory:
                if total <= 0:
                    product.stock_status = "out_of_stock"
                elif product.stock_status == "out_of_stock":
                    product.stock_status = "in_stock"

    async def stock_in(
        self, vendor_id: UUID, product_id: UUID, quantity: int,
        reason: str = "Stock received", performed_by: UUID | None = None,
        variant_id: UUID | None = None,
    ) -> InventoryMovement:
        return await self.record_movement(
            vendor_id=vendor_id,
            product_id=product_id,
            movement_type="stock_in",
            quantity=abs(quantity),
            reason=reason,
            performed_by=performed_by,
            variant_id=variant_id,
            reference_type="manual",
        )

    async def stock_out(
        self, vendor_id: UUID, product_id: UUID, quantity: int,
        reason: str = "Stock removed", performed_by: UUID | None = None,
        variant_id: UUID | None = None,
    ) -> InventoryMovement:
        return await self.record_movement(
            vendor_id=vendor_id,
            product_id=product_id,
            movement_type="stock_out",
            quantity=-abs(quantity),
            reason=reason,
            performed_by=performed_by,
            variant_id=variant_id,
            reference_type="manual",
        )

    async def adjust_stock(
        self, vendor_id: UUID, product_id: UUID, new_quantity: int,
        reason: str = "Manual adjustment", performed_by: UUID | None = None,
        variant_id: UUID | None = None,
    ) -> InventoryMovement:
        """Set stock to an absolute value — calculates the delta automatically."""
        if variant_id:
            entity = await self.db.get(ProductVariant, variant_id)
        else:
            entity = await self.db.get(Product, product_id)

        current = entity.quantity or 0 if entity else 0
        delta = new_quantity - current

        return await self.record_movement(
            vendor_id=vendor_id,
            product_id=product_id,
            movement_type="adjustment",
            quantity=delta,
            reason=reason,
            performed_by=performed_by,
            variant_id=variant_id,
            reference_type="manual",
        )

    async def deduct_for_sale(
        self, vendor_id: UUID, product_id: UUID, quantity: int,
        reference_id: UUID | None = None, reference_type: str = "order",
        variant_id: UUID | None = None, auto_commit: bool = False,
        customer_id: UUID | None = None,
    ) -> InventoryMovement:
        """Auto-deduct stock when a sale/order occurs."""
        await self._consume_pharma_lots_for_sale(
            vendor_id, product_id, quantity,
            reference_id=reference_id, reference_type=reference_type,
            customer_id=customer_id,
        )
        movement = await self.record_movement(
            vendor_id=vendor_id,
            product_id=product_id,
            movement_type="sale",
            quantity=-abs(quantity),
            reason="Sold",
            reference_type=reference_type,
            reference_id=reference_id,
            variant_id=variant_id,
            auto_commit=False,  # defer commit; we may add COGS data below
        )

        # Consume FIFO layers and stamp COGS onto the movement's extra_data
        try:
            from app.services.fifo_cost_service import FifoCostService
            fifo = FifoCostService(self.db)
            cogs_result = await fifo.consume_layers(
                vendor_id=vendor_id,
                product_id=product_id,
                quantity=float(quantity),
                variant_id=variant_id,
                auto_commit=False,
            )
            if cogs_result and cogs_result.get("cogs"):
                existing_meta = movement.extra_data or {}
                existing_meta["cogs"] = float(cogs_result["cogs"])
                existing_meta["cogs_lots"] = cogs_result.get("consumed_lots", [])
                movement.extra_data = existing_meta
        except Exception as _exc:  # noqa: BLE001
            # FIFO consume is best-effort — sale must not be blocked if layers are missing
            pass

        if auto_commit:
            await self.db.commit()

        return movement

    async def return_stock(
        self, vendor_id: UUID, product_id: UUID, quantity: int,
        reference_id: UUID | None = None, variant_id: UUID | None = None,
        auto_commit: bool = False,
        original_source_id: UUID | None = None,
        original_source_type: str | None = None,
    ) -> InventoryMovement:
        """Return stock from a sale return or cancelled order (restores pharma lots)."""
        await self._restore_pharma_lots_for_return(
            vendor_id, product_id, quantity,
            reference_id=reference_id,
            original_source_id=original_source_id or reference_id,
            original_source_type=original_source_type or "order",
        )
        return await self.record_movement(
            vendor_id=vendor_id,
            product_id=product_id,
            movement_type="sale_return",
            quantity=abs(quantity),
            reason="Sale return / order cancel",
            reference_type="order",
            reference_id=reference_id,
            variant_id=variant_id,
            auto_commit=auto_commit,
        )

    # ── Per-store (business unit) stock — StoreInventory is the source of truth ──

    async def _ensure_store_row(
        self, vendor_id: UUID, store_id: UUID, product_id: UUID, variant_id: UUID | None,
    ) -> StoreInventory:
        """Return the StoreInventory row for this (store, product/variant), seeding
        it on first touch. New rows are seeded from the product's current global
        quantity only at the vendor's default store; other stores start at 0 and
        must be stocked explicitly."""
        row = await get_store_inventory_row(self.db, store_id, product_id, variant_id, None)
        if row:
            return row

        if variant_id:
            entity = await self.db.get(ProductVariant, variant_id)
        else:
            entity = await self.db.get(Product, product_id)
        seed_qty = 0
        if entity is not None:
            default_store = await get_default_store_id(self.db, vendor_id)
            if default_store and default_store == store_id:
                seed_qty = int(entity.quantity or 0)

        row = StoreInventory(
            store_id=store_id,
            vendor_id=vendor_id,
            product_id=product_id,
            variant_id=variant_id,
            storage_location_id=None,
            quantity=seed_qty,
        )
        self.db.add(row)
        await self.db.flush()
        return row

    async def _rollup_after_store_change(
        self, vendor_id: UUID, product_id: UUID, variant_id: UUID | None,
    ) -> None:
        """Keep Product/Variant.quantity in sync as a derived rollup of stores."""
        await sync_product_quantity_from_stores(self.db, vendor_id, product_id, variant_id)
        if variant_id:
            await self._sync_parent_product_quantity(product_id)

    async def _record_store_movement(
        self, vendor_id: UUID, store_id: UUID, product_id: UUID, variant_id: UUID | None,
        movement_type: str, signed_qty: int, qty_before: int, qty_after: int,
        reason: str, reference_type: str | None, reference_id: UUID | None,
        performed_by: UUID | None = None,
    ) -> InventoryMovement:
        movement = InventoryMovement(
            id=uuid_mod.uuid4(),
            vendor_id=vendor_id,
            store_id=store_id,
            product_id=product_id,
            variant_id=variant_id,
            movement_type=movement_type,
            quantity=signed_qty,
            quantity_before=qty_before,
            quantity_after=qty_after,
            reason=reason,
            reference_type=reference_type or "manual",
            reference_id=reference_id,
            performed_by=performed_by,
        )
        self.db.add(movement)
        return movement

    async def deduct_for_sale_at_store(
        self, vendor_id: UUID, store_id: UUID, product_id: UUID, quantity: int,
        reference_id: UUID | None = None, reference_type: str = "pos_transaction",
        variant_id: UUID | None = None, customer_id: UUID | None = None,
        performed_by: UUID | None = None,
    ) -> InventoryMovement:
        """Deduct sold stock from a specific business unit's StoreInventory and
        re-derive the global product quantity. Never auto-commits (POS owns the txn)."""
        await self._consume_pharma_lots_for_sale(
            vendor_id, product_id, quantity,
            reference_id=reference_id, reference_type=reference_type,
            customer_id=customer_id,
        )
        row = await self._ensure_store_row(vendor_id, store_id, product_id, variant_id)
        qty_before = int(row.quantity or 0)
        await apply_store_inventory_delta(
            self.db, vendor_id, store_id, product_id, variant_id, -abs(quantity),
        )
        await self._rollup_after_store_change(vendor_id, product_id, variant_id)
        return await self._record_store_movement(
            vendor_id, store_id, product_id, variant_id,
            movement_type="sale", signed_qty=-abs(quantity),
            qty_before=qty_before, qty_after=qty_before - abs(quantity),
            reason="Sold", reference_type=reference_type, reference_id=reference_id,
            performed_by=performed_by,
        )

    async def _consume_pharma_lots_for_sale(
        self,
        vendor_id: UUID,
        product_id: UUID,
        quantity: int,
        *,
        reference_id: UUID | None = None,
        reference_type: str = "sale",
        serial_numbers: list[str] | None = None,
        customer_id: UUID | None = None,
    ) -> None:
        """FEFO-consume unrestricted lots; ship serials when serial_managed."""
        product = await self.db.get(Product, product_id)
        if not product:
            return
        from decimal import Decimal
        if customer_id:
            from app.services.pharma_esign import load_pharma_settings
            from app.services.pharma_gdp import assert_customer_wholesale_license
            from app.models.customer import Customer
            cfg = await load_pharma_settings(self.db, vendor_id)
            if cfg.get("wholesale_license_check"):
                cust = await self.db.get(Customer, customer_id)
                assert_customer_wholesale_license(cust, required=True)
        if getattr(product, "batch_managed", False):
            from app.services.pharma_batch import consume_batches_for_sale
            await consume_batches_for_sale(
                self.db,
                vendor_id=vendor_id,
                product_id=product_id,
                quantity=Decimal(abs(quantity)),
                source_id=reference_id,
                source_type=reference_type,
            )
        if getattr(product, "serial_managed", False):
            from app.services.pharma_serial import consume_serials_for_sale
            await consume_serials_for_sale(
                self.db,
                vendor_id=vendor_id,
                product_id=product_id,
                quantity=abs(quantity),
                source_id=reference_id,
                source_type=reference_type,
                serial_numbers=serial_numbers,
            )

    async def _restore_pharma_lots_for_return(
        self,
        vendor_id: UUID,
        product_id: UUID,
        quantity: int,
        *,
        reference_id: UUID | None = None,
        reference_type: str = "sale_return",
        original_source_id: UUID | None = None,
        original_source_type: str | None = None,
    ) -> None:
        """Restore lot qty for batch-managed products on return / cancel."""
        product = await self.db.get(Product, product_id)
        if not product or not getattr(product, "batch_managed", False):
            return
        from decimal import Decimal
        from app.services.pharma_batch import restore_batches_for_return
        await restore_batches_for_return(
            self.db,
            vendor_id=vendor_id,
            product_id=product_id,
            quantity=Decimal(abs(quantity)),
            source_id=reference_id,
            source_type=reference_type,
            original_source_id=original_source_id,
            original_source_type=original_source_type,
        )

    async def return_stock_at_store(
        self, vendor_id: UUID, store_id: UUID, product_id: UUID, quantity: int,
        reference_id: UUID | None = None, reference_type: str = "pos_transaction",
        variant_id: UUID | None = None,
        original_source_id: UUID | None = None,
        original_source_type: str | None = None,
        performed_by: UUID | None = None,
    ) -> InventoryMovement:
        """Return stock to a specific business unit and re-derive global quantity."""
        await self._restore_pharma_lots_for_return(
            vendor_id, product_id, quantity,
            reference_id=reference_id,
            reference_type=reference_type,
            original_source_id=original_source_id,
            original_source_type=original_source_type or "pos_transaction",
        )
        row = await self._ensure_store_row(vendor_id, store_id, product_id, variant_id)
        qty_before = int(row.quantity or 0)
        await apply_store_inventory_delta(
            self.db, vendor_id, store_id, product_id, variant_id, abs(quantity),
        )
        await self._rollup_after_store_change(vendor_id, product_id, variant_id)
        return await self._record_store_movement(
            vendor_id, store_id, product_id, variant_id,
            movement_type="sale_return", signed_qty=abs(quantity),
            qty_before=qty_before, qty_after=qty_before + abs(quantity),
            reason="Sale return / order cancel", reference_type=reference_type, reference_id=reference_id,
            performed_by=performed_by,
        )

    async def get_movement_history(
        self, vendor_id: UUID, product_id: UUID | None = None,
        movement_type: str | None = None,
        store_id: UUID | None = None,
        storage_location_id: UUID | None = None,
        document_number: str | None = None,
        performed_by: UUID | None = None,
        date_from=None,
        date_to=None,
        page: int = 1, size: int = 20,
    ) -> tuple[list[InventoryMovement], int]:
        conditions = [InventoryMovement.vendor_id == vendor_id]
        if product_id:
            conditions.append(InventoryMovement.product_id == product_id)
        if movement_type:
            conditions.append(InventoryMovement.movement_type == movement_type)
        if store_id:
            conditions.append(InventoryMovement.store_id == store_id)
        if storage_location_id:
            conditions.append(InventoryMovement.storage_location_id == storage_location_id)
        if document_number:
            conditions.append(InventoryMovement.document_number == document_number)
        if performed_by:
            conditions.append(InventoryMovement.performed_by == performed_by)
        if date_from:
            conditions.append(InventoryMovement.created_at >= date_from)
        if date_to:
            conditions.append(InventoryMovement.created_at <= date_to)

        count_stmt = select(func.count()).select_from(InventoryMovement).where(and_(*conditions))
        total = (await self.db.execute(count_stmt)).scalar() or 0

        stmt = (
            select(InventoryMovement)
            .where(and_(*conditions))
            .order_by(InventoryMovement.created_at.desc())
            .offset((page - 1) * size)
            .limit(size)
        )
        result = await self.db.execute(stmt)
        items = list(result.scalars().all())
        return items, total

    async def get_stock_summary(self, vendor_id: UUID, store_id: UUID | None = None) -> list[dict]:
        """Get stock summary for all products of a vendor, including variant and per-store breakdown."""
        # Load stores for this vendor
        stores_stmt = select(Store).where(Store.vendor_id == vendor_id, Store.is_active == True).order_by(Store.name)
        stores_result = await self.db.execute(stores_stmt)
        stores = list(stores_result.scalars().all())
        store_map = {str(s.id): s.name for s in stores}

        # Load all StoreInventory rows for this vendor
        si_stmt = select(StoreInventory).where(StoreInventory.vendor_id == vendor_id)
        si_result = await self.db.execute(si_stmt)
        si_rows = list(si_result.scalars().all())

        # Build nested map: product_id → store_id → quantity
        store_qty_map: dict[str, dict[str, int]] = {}
        for si in si_rows:
            pid = str(si.product_id)
            sid = str(si.store_id)
            store_qty_map.setdefault(pid, {})
            store_qty_map[pid][sid] = store_qty_map[pid].get(sid, 0) + (si.quantity or 0)

        stmt = (
            select(Product)
            .where(
                Product.vendor_id == vendor_id,
                Product.track_inventory == True,
            )
            .options(selectinload(Product.variants))
            .order_by(Product.name)
        )
        if store_id:
            stmt = stmt.where(product_available_at_store(store_id))
        result = await self.db.execute(stmt)
        products = list(result.scalars().all())

        last_movement_sub = (
            select(
                InventoryMovement.product_id,
                func.max(InventoryMovement.created_at).label("last_at"),
            )
            .where(InventoryMovement.vendor_id == vendor_id)
            .group_by(InventoryMovement.product_id)
            .subquery()
        )

        totals_sub = (
            select(
                InventoryMovement.product_id,
                func.coalesce(
                    func.sum(case(
                        (InventoryMovement.quantity > 0, InventoryMovement.quantity),
                        else_=literal_column("0"),
                    )), 0
                ).label("total_in"),
                func.coalesce(
                    func.sum(case(
                        (InventoryMovement.quantity < 0, func.abs(InventoryMovement.quantity)),
                        else_=literal_column("0"),
                    )), 0
                ).label("total_out"),
            )
            .where(InventoryMovement.vendor_id == vendor_id)
            .group_by(InventoryMovement.product_id)
            .subquery()
        )

        last_map = {}
        totals_map = {}

        lm_result = await self.db.execute(select(last_movement_sub))
        for row in lm_result:
            last_map[row.product_id] = row.last_at

        t_result = await self.db.execute(select(totals_sub))
        for row in t_result:
            totals_map[row.product_id] = {"in": row.total_in, "out": row.total_out}

        summaries = []
        for p in products:
            qty = p.quantity or 0
            threshold = p.low_stock_threshold or 5
            t = totals_map.get(p.id, {"in": 0, "out": 0})
            lm = last_map.get(p.id)

            # Build variant breakdown
            active_variants = [v for v in (p.variants or []) if v.is_active]
            variant_rows = []
            for v in active_variants:
                vqty = v.quantity or 0
                vthreshold = v.low_stock_threshold or threshold
                if vqty == 0:
                    vstatus = "out_of_stock"
                elif vqty <= vthreshold:
                    vstatus = "low_stock"
                else:
                    vstatus = "in_stock"
                variant_rows.append({
                    "id": str(v.id),
                    "name": v.name,
                    "sku": v.sku,
                    "barcode": v.barcode,
                    "quantity": vqty,
                    "cost_price": float(v.cost_price) if v.cost_price is not None else None,
                    "price": float(v.price) if v.price is not None else None,
                    "expiration_date": v.expiration_date.isoformat() if v.expiration_date else None,
                    "manufacture_date": v.manufacture_date.isoformat() if v.manufacture_date else None,
                    "best_before_date": v.best_before_date.isoformat() if v.best_before_date else None,
                    "low_stock_threshold": vthreshold,
                    "stock_status": vstatus,
                })

            # Per-store quantities
            pid_str = str(p.id)
            store_quantities = [
                {"store_id": sid, "store_name": store_map.get(sid, sid), "quantity": sq}
                for sid, sq in store_qty_map.get(pid_str, {}).items()
            ]

            summaries.append({
                "product_id": pid_str,
                "product_name": p.name,
                "sku": p.sku,
                "current_quantity": qty,
                "low_stock_threshold": threshold,
                "is_low_stock": qty <= threshold,
                "total_stock_in": t["in"],
                "total_stock_out": t["out"],
                "last_movement_at": lm.isoformat() if lm else None,
                "variants": variant_rows,
                "store_quantities": store_quantities,
            })

        return summaries

    async def get_low_stock_alerts(self, vendor_id: UUID, store_id: UUID | None = None) -> list[dict]:
        from app.models.store import StoreInventory
        from app.models.vendor_product import ProductVariant

        alerts: list[dict] = []

        if store_id:
            # Per-store mode: compare StoreInventory.quantity against per-store or product threshold.
            # Include both product-level and variant-level rows.
            si_stmt = (
                select(StoreInventory)
                .where(
                    StoreInventory.vendor_id == vendor_id,
                    StoreInventory.store_id == store_id,
                )
            )
            si_result = await self.db.execute(si_stmt)
            si_rows = list(si_result.scalars().all())

            # Build product/variant lookup sets to avoid duplicate DB hits
            product_ids = {r.product_id for r in si_rows}
            product_map: dict = {}
            if product_ids:
                prod_result = await self.db.execute(
                    select(Product).where(
                        Product.id.in_(product_ids),
                        Product.track_inventory == True,
                        Product.status == "active",
                    )
                )
                product_map = {p.id: p for p in prod_result.scalars().all()}

            variant_ids = {r.variant_id for r in si_rows if r.variant_id}
            variant_map: dict = {}
            if variant_ids:
                var_result = await self.db.execute(
                    select(ProductVariant).where(ProductVariant.id.in_(variant_ids))
                )
                variant_map = {v.id: v for v in var_result.scalars().all()}

            for row in si_rows:
                product = product_map.get(row.product_id)
                if not product:
                    continue
                variant = variant_map.get(row.variant_id) if row.variant_id else None
                # Use the store-level threshold first, fall back to product threshold, then default 5
                threshold = row.low_stock_threshold or product.low_stock_threshold or 5
                qty = row.quantity or 0
                reorder_point, reorder_qty = self._effective_reorder(product, variant)
                needs_reorder = bool(reorder_point is not None and qty <= reorder_point)
                if qty <= threshold or needs_reorder:
                    if row.variant_id:
                        name = f"{product.name} — {variant.name}" if variant else product.name
                        sku = (variant.sku if variant else None) or product.sku
                    else:
                        name = product.name
                        sku = product.sku
                    alerts.append({
                        "product_id": str(product.id),
                        "variant_id": str(row.variant_id) if row.variant_id else None,
                        "product_name": name,
                        "sku": sku,
                        "current_quantity": qty,
                        "low_stock_threshold": threshold,
                        "reorder_point": reorder_point,
                        "reorder_quantity": reorder_qty,
                        "needs_reorder": needs_reorder,
                        "category": product.category,
                        "store_id": str(store_id),
                    })

            alerts.sort(key=lambda x: x["current_quantity"])
            return alerts

        # Global mode: use Product.quantity vs Product.low_stock_threshold OR reorder_point
        from sqlalchemy import or_
        stmt = (
            select(Product)
            .where(
                Product.vendor_id == vendor_id,
                Product.track_inventory == True,
                Product.status == "active",
                or_(
                    Product.quantity <= Product.low_stock_threshold,
                    and_(
                        Product.reorder_point.isnot(None),
                        Product.quantity <= Product.reorder_point,
                    ),
                ),
            )
            .order_by(Product.quantity.asc())
        )
        result = await self.db.execute(stmt)
        products = list(result.scalars().all())

        for p in products:
            rp = getattr(p, "reorder_point", None)
            rq = getattr(p, "reorder_quantity", None)
            qty = p.quantity or 0
            alerts.append({
                "product_id": str(p.id),
                "variant_id": None,
                "product_name": p.name,
                "sku": p.sku,
                "current_quantity": qty,
                "low_stock_threshold": p.low_stock_threshold or 5,
                "reorder_point": rp,
                "reorder_quantity": rq,
                "needs_reorder": bool(rp is not None and qty <= rp),
                "category": p.category,
                "store_id": None,
            })
        return alerts

    @staticmethod
    def _effective_reorder(product: Product, variant: ProductVariant | None) -> tuple[int | None, int | None]:
        """A variant's own reorder settings win; otherwise the parent product's apply."""
        rp = product.reorder_point
        rq = product.reorder_quantity
        if variant is not None:
            if variant.reorder_point is not None:
                rp = variant.reorder_point
            if variant.reorder_quantity is not None:
                rq = variant.reorder_quantity
        return rp, rq

    async def get_reorder_alerts(self, vendor_id: UUID, store_id: UUID | None = None) -> list[dict]:
        """
        Return products/variants where quantity has reached or fallen below reorder_point.
        Only includes items where a reorder_point is configured on the variant or product.
        """
        from sqlalchemy import or_

        alerts: list[dict] = []

        if store_id:
            si_stmt = select(StoreInventory).where(
                StoreInventory.vendor_id == vendor_id,
                StoreInventory.store_id == store_id,
            )
            si_rows = list((await self.db.execute(si_stmt)).scalars().all())
            product_ids = {r.product_id for r in si_rows}
            product_map: dict = {}
            if product_ids:
                res = await self.db.execute(
                    select(Product).where(
                        Product.id.in_(product_ids),
                        Product.vendor_id == vendor_id,
                        Product.track_inventory == True,
                        Product.status == "active",
                    )
                )
                product_map = {p.id: p for p in res.scalars().all()}

            variant_ids = {r.variant_id for r in si_rows if r.variant_id}
            variant_map: dict = {}
            if variant_ids:
                var_result = await self.db.execute(
                    select(ProductVariant).where(ProductVariant.id.in_(variant_ids))
                )
                variant_map = {v.id: v for v in var_result.scalars().all()}

            for row in si_rows:
                product = product_map.get(row.product_id)
                if not product:
                    continue
                variant = variant_map.get(row.variant_id) if row.variant_id else None
                rp, rq = self._effective_reorder(product, variant)
                qty = row.quantity or 0
                if rp is None or qty > rp:
                    continue
                alerts.append({
                    "product_id": str(product.id),
                    "variant_id": str(row.variant_id) if row.variant_id else None,
                    "product_name": f"{product.name} — {variant.name}" if variant else product.name,
                    "sku": (variant.sku if variant else None) or product.sku,
                    "current_quantity": qty,
                    "reorder_point": rp,
                    "reorder_quantity": rq,
                    "low_stock_threshold": row.low_stock_threshold or product.low_stock_threshold or 5,
                    "category": product.category,
                    "store_id": str(store_id),
                })
        else:
            has_variant_reorder_point = (
                select(ProductVariant.id)
                .where(
                    ProductVariant.product_id == Product.id,
                    ProductVariant.reorder_point.isnot(None),
                )
                .exists()
            )
            stmt = (
                select(Product)
                .where(
                    Product.vendor_id == vendor_id,
                    Product.track_inventory == True,
                    Product.status == "active",
                    or_(Product.reorder_point.isnot(None), has_variant_reorder_point),
                )
                .options(selectinload(Product.variants))
                .order_by(Product.name)
            )
            products = list((await self.db.execute(stmt)).scalars().all())

            for p in products:
                # Where variants exist they hold the real stock, so evaluate them
                # individually instead of the product-level rollup.
                active_variants = [v for v in (p.variants or []) if v.is_active]
                if active_variants:
                    for v in active_variants:
                        rp, rq = self._effective_reorder(p, v)
                        qty = v.quantity or 0
                        if rp is None or qty > rp:
                            continue
                        alerts.append({
                            "product_id": str(p.id),
                            "variant_id": str(v.id),
                            "product_name": f"{p.name} — {v.name}",
                            "sku": v.sku or p.sku,
                            "current_quantity": qty,
                            "reorder_point": rp,
                            "reorder_quantity": rq,
                            "low_stock_threshold": v.low_stock_threshold or p.low_stock_threshold or 5,
                            "category": p.category,
                            "store_id": None,
                        })
                    continue

                rp, rq = self._effective_reorder(p, None)
                qty = p.quantity or 0
                if rp is None or qty > rp:
                    continue
                alerts.append({
                    "product_id": str(p.id),
                    "variant_id": None,
                    "product_name": p.name,
                    "sku": p.sku,
                    "current_quantity": qty,
                    "reorder_point": rp,
                    "reorder_quantity": rq,
                    "low_stock_threshold": p.low_stock_threshold or 5,
                    "category": p.category,
                    "store_id": None,
                })

        alerts.sort(key=lambda x: x["current_quantity"])
        return alerts
