"""Shared MRP primitives: BOM explosion, stock lookups, and reservation locking.

Used by the vendor-facing MRP API (app/api/v1/vendor_mrp.py) and by the
production order lifecycle (app/services/production_materials.py,
app/services/production_inventory.py) so both paths compute material
requirements identically.
"""
from __future__ import annotations

from decimal import Decimal, ROUND_CEILING
from typing import Optional, List
from uuid import UUID

from sqlalchemy import select, func as sqlfunc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.mrp import ProductBOMItem
from app.models.vendor_product import Product
from app.models.store import StoreInventory

MAX_BOM_DEPTH = 20  # guards against pathological/cyclic BOM graphs


def ceil_decimal(value: Decimal) -> Decimal:
    """Round up to the nearest whole unit — StoreInventory.quantity is an Integer
    column, so any fractional BOM requirement must be over-reserved/over-consumed
    rather than under, to avoid silently going short on the shop floor."""
    return value.to_integral_value(rounding=ROUND_CEILING)


async def get_available_stock(
    db: AsyncSession, vendor_id: UUID, component_id: UUID, store_id: Optional[UUID],
) -> Decimal:
    """Read on-hand quantity. StoreInventory (summed across locations within the
    business unit) is authoritative when a store is specified; falls back to the
    global Product.quantity rollup for callers that don't scope by store."""
    if store_id:
        q = select(sqlfunc.coalesce(sqlfunc.sum(StoreInventory.quantity), 0)).where(
            StoreInventory.vendor_id == vendor_id,
            StoreInventory.store_id == store_id,
            StoreInventory.product_id == component_id,
        )
        total = (await db.execute(q)).scalar() or 0
        return Decimal(str(total))
    prod = await db.get(Product, component_id)
    return Decimal(str(prod.quantity)) if prod and prod.quantity is not None else Decimal("0")


async def explode_bom(
    db: AsyncSession,
    vendor_id: UUID,
    items: List[dict],
) -> dict[str, dict]:
    """
    Multi-level recursive BOM explosion.

    `items` is a list of {"product_id": str, "qty": Decimal, "name": Optional[str]}
    representing the top-level products being produced/ordered.

    Returns a dict keyed by leaf component_id (components with no BOM of their
    own — i.e. actual raw materials/stock items) → {
        "component_id", "product_obj", "required_qty" (Decimal, exact),
        "source_items" (set of originating product names), "no_bom" (bool),
        "max_depth" (int),
    }

    Intermediate assemblies (components that themselves have a BOM) are exploded
    further rather than reserved/consumed directly ("phantom" assemblies) —
    only leaf materials accumulate a requirement. Cyclic references (A→B→A)
    are detected via the recursion path and stop expansion at the cycle instead
    of recursing forever; a depth cap provides a hard backstop.
    """
    component_requirements: dict[str, dict] = {}

    async def _expand(product_id_str: str, qty: Decimal, source_name: str, path: tuple[str, ...], depth: int) -> None:
        if depth > MAX_BOM_DEPTH:
            return
        try:
            pid = UUID(product_id_str)
        except ValueError:
            return

        if product_id_str in path:
            # Cycle detected (A -> ... -> A): treat this occurrence as a leaf
            # requirement rather than expanding forever.
            _accumulate(product_id_str, qty, source_name, depth, no_bom=False)
            return

        bom_result = await db.execute(
            select(ProductBOMItem).where(
                ProductBOMItem.vendor_id == vendor_id,
                ProductBOMItem.product_id == pid,
            )
        )
        bom_items = bom_result.scalars().all()

        if not bom_items:
            # Leaf: no BOM of its own — this is a real material/stock item.
            _accumulate(product_id_str, qty, source_name, depth, no_bom=(depth == 1))
            return

        # Intermediate assembly — recurse into its components instead of
        # reserving the assembly itself (phantom assembly behaviour).
        next_path = path + (product_id_str,)
        for bom_item in bom_items:
            needed = qty * bom_item.qty_per_unit
            await _expand(str(bom_item.component_id), needed, source_name, next_path, depth + 1)

    def _accumulate(cid: str, qty: Decimal, source_name: str, depth: int, no_bom: bool) -> None:
        entry = component_requirements.get(cid)
        if entry is None:
            entry = {
                "component_id": cid,
                "product_obj": None,
                "required_qty": Decimal("0"),
                "source_items": set(),
                "no_bom": no_bom,
                "max_depth": depth,
            }
            component_requirements[cid] = entry
        entry["required_qty"] += qty
        entry["source_items"].add(source_name)
        entry["max_depth"] = max(entry["max_depth"], depth)
        if no_bom:
            entry["no_bom"] = True

    for req_item in items:
        name = req_item.get("name") or req_item.get("product_id")
        await _expand(str(req_item["product_id"]), Decimal(str(req_item["qty"])), name, (), 1)

    # Resolve product objects for every leaf component.
    for cid, entry in component_requirements.items():
        try:
            pid = UUID(cid)
        except ValueError:
            continue
        prod_result = await db.execute(select(Product).where(Product.id == pid))
        entry["product_obj"] = prod_result.scalar_one_or_none()

    return component_requirements


async def lock_product_scope(db: AsyncSession, vendor_id: UUID, store_id: Optional[UUID], product_id: UUID) -> None:
    """Serialize concurrent reserve/consume attempts for the same (vendor, store,
    product) so two requests can't both read 'available' stock before either
    commits. Postgres-only (advisory lock); a no-op elsewhere (e.g. SQLite in
    tests), which is acceptable since single-process test runs have no races.

    Checks the session's actual bound dialect (not the global settings.DATABASE_URL)
    so this stays correct when the DB session is swapped out, e.g. under tests."""
    bind = db.get_bind()
    if bind.dialect.name != "postgresql":
        return
    key = f"{vendor_id}:{store_id or 'global'}:{product_id}"
    await db.execute(select(sqlfunc.pg_advisory_xact_lock(sqlfunc.hashtext(key))))
