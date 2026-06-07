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
    ) -> InventoryMovement:
        """
        Core method: record a stock movement and update the product/variant quantity.
        quantity should be positive for stock-in, negative for stock-out.
        Set auto_commit=False when calling from within another service's transaction.
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
    ) -> InventoryMovement:
        """
        Like record_movement but does NOT commit — used when the caller
        manages the DB transaction (e.g. POS service, order service).
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
        threshold = getattr(entity, "low_stock_threshold", None) or 5
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
            pass

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
    ) -> InventoryMovement:
        """Auto-deduct stock when a sale/order occurs."""
        return await self.record_movement(
            vendor_id=vendor_id,
            product_id=product_id,
            movement_type="sale",
            quantity=-abs(quantity),
            reason="Sold",
            reference_type=reference_type,
            reference_id=reference_id,
            variant_id=variant_id,
            auto_commit=auto_commit,
        )

    async def return_stock(
        self, vendor_id: UUID, product_id: UUID, quantity: int,
        reference_id: UUID | None = None, variant_id: UUID | None = None,
        auto_commit: bool = False,
    ) -> InventoryMovement:
        """Return stock from a sale return or cancelled order."""
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

    async def get_movement_history(
        self, vendor_id: UUID, product_id: UUID | None = None,
        movement_type: str | None = None,
        store_id: UUID | None = None,
        storage_location_id: UUID | None = None,
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
        stmt = (
            select(Product)
            .where(
                Product.vendor_id == vendor_id,
                Product.track_inventory == True,
                Product.quantity <= Product.low_stock_threshold,
                Product.status == "active",
            )
            .order_by(Product.quantity.asc())
        )
        if store_id:
            stmt = stmt.where(product_available_at_store(store_id))
        result = await self.db.execute(stmt)
        products = list(result.scalars().all())

        return [
            {
                "product_id": str(p.id),
                "product_name": p.name,
                "sku": p.sku,
                "current_quantity": p.quantity or 0,
                "low_stock_threshold": p.low_stock_threshold or 5,
                "category": p.category,
            }
            for p in products
        ]
