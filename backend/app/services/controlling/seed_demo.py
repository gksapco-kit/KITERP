"""Demo / dev seed data for Controlling (CO): masters, standard cost, sample manufacturing order."""
from __future__ import annotations

import uuid
from datetime import date, timedelta
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.controlling import (
    CoActivityType,
    CoManufacturingOrder,
    CoOrderCostLine,
    CoOverheadPool,
    CoOverheadRate,
    CoProductCostLine,
    CoProductCostVersion,
)
from app.models.finance import FinAccount
from app.models.vendor_product import Product
from app.services.finance.coa_seeder import (
    get_or_create_default_fin_company,
    seed_default_coa,
    seed_default_fiscal_year,
)
from app.services.controlling.settlement import get_gl_mapping, upsert_gl_mapping


async def _account_by_code(
    db: AsyncSession, vendor_id: UUID, code: str
) -> Optional[FinAccount]:
    r = await db.execute(
        select(FinAccount).where(
            FinAccount.vendor_id == vendor_id,
            FinAccount.code == code,
        )
    )
    return r.scalar_one_or_none()


async def _ensure_co_accounts(
    db: AsyncSession, vendor_id: UUID
) -> tuple[FinAccount, FinAccount, FinAccount, FinAccount]:
    """Return (wip, finished_goods, cogs, raw_material) FinAccount rows."""
    await seed_default_coa(db, vendor_id)
    inv = await _account_by_code(db, vendor_id, "1170")
    if not inv:
        raise RuntimeError("Default COA must include account 1170 (Inventory / Stock)")
    cogs = await _account_by_code(db, vendor_id, "5110")
    if not cogs:
        raise RuntimeError("Default COA must include account 5110 (Purchases / COGS)")

    wip = await _account_by_code(db, vendor_id, "1180")
    if not wip:
        wip = FinAccount(
            id=uuid.uuid4(),
            vendor_id=vendor_id,
            parent_id=inv.id,
            code="1180",
            name="Work in Process (CO)",
            account_type="Asset",
            account_subtype="Current Asset",
            is_active=True,
        )
        db.add(wip)
        await db.flush()

    fg = await _account_by_code(db, vendor_id, "1175")
    if not fg:
        fg = FinAccount(
            id=uuid.uuid4(),
            vendor_id=vendor_id,
            parent_id=inv.id,
            code="1175",
            name="Finished Goods (CO)",
            account_type="Asset",
            account_subtype="Current Asset",
            is_active=True,
        )
        db.add(fg)
        await db.flush()

    return wip, fg, cogs, inv


def _rollup_pcv_totals(pcv: CoProductCostVersion) -> None:
    mat = act = ovh = Decimal("0")
    for ln in pcv.lines:
        q = Decimal(str(ln.qty_per_output_unit or 0))
        u = Decimal(str(ln.unit_rate_planned or 0))
        ln.amount_planned = (q * u).quantize(Decimal("0.0001"))
        lt = (ln.line_type or "").lower()
        if lt == "material":
            mat += ln.amount_planned
        elif lt == "activity":
            act += ln.amount_planned
        elif lt == "overhead":
            ovh += ln.amount_planned
    pcv.material_total_planned = mat
    pcv.activity_total_planned = act
    pcv.overhead_total_planned = ovh
    pcv.rolled_up_unit_cost = mat + act + ovh


async def _ensure_product(
    db: AsyncSession,
    vendor_id: UUID,
    user_id: UUID,
    slug: str,
    name: str,
    price: Decimal,
) -> Product:
    r = await db.execute(
        select(Product).where(Product.vendor_id == vendor_id, Product.slug == slug)
    )
    p = r.scalar_one_or_none()
    if p:
        return p
    p = Product(
        id=uuid.uuid4(),
        vendor_id=vendor_id,
        name=name,
        slug=slug,
        price=price,
        status="active",
        created_by=user_id,
    )
    db.add(p)
    await db.flush()
    return p


async def seed_co_demo_data(
    db: AsyncSession,
    vendor_id: UUID,
    created_by_user_id: UUID,
    *,
    demo_order_no: str = "CO-DEMO-001",
    skip_if_order_exists: bool = True,
) -> dict[str, Any]:
    """
    Create CO demo masters, active standard cost, and one manufacturing order with cost lines.

    Requires finance COA + fiscal year (creates via coa_seeder if missing).
    Idempotent when skip_if_order_exists and demo_order_no already present.
    """
    await seed_default_coa(db, vendor_id)
    await seed_default_fiscal_year(db, vendor_id)
    company = await get_or_create_default_fin_company(db, vendor_id)

    wip, fg, cogs_acc, rm = await _ensure_co_accounts(db, vendor_id)
    await upsert_gl_mapping(
        db,
        vendor_id,
        company.id,
        wip_account_id=wip.id,
        finished_goods_account_id=fg.id,
        cogs_account_id=cogs_acc.id,
        raw_material_account_id=rm.id,
        notes="Auto seed — Controlling demo",
    )
    await db.flush()
    gl = await get_gl_mapping(db, vendor_id, company.id)

    if skip_if_order_exists:
        r0 = await db.execute(
            select(CoManufacturingOrder).where(
                CoManufacturingOrder.vendor_id == vendor_id,
                CoManufacturingOrder.order_no == demo_order_no,
            )
        )
        existing_mo = r0.scalar_one_or_none()
        if existing_mo:
            return {
                "skipped": True,
                "company_id": str(company.id),
                "manufacturing_order_id": str(existing_mo.id),
                "gl_mapping_id": str(gl.id) if gl else None,
            }

    r_act = await db.execute(
        select(CoActivityType).where(
            CoActivityType.vendor_id == vendor_id,
            CoActivityType.company_id == company.id,
            CoActivityType.code == "LAB",
        )
    )
    act = r_act.scalar_one_or_none()
    if not act:
        act = CoActivityType(
            id=uuid.uuid4(),
            vendor_id=vendor_id,
            company_id=company.id,
            code="LAB",
            name="Assembly labor (demo)",
            uom="H",
        )
        db.add(act)
        await db.flush()

    r_pool = await db.execute(
        select(CoOverheadPool).where(
            CoOverheadPool.vendor_id == vendor_id,
            CoOverheadPool.company_id == company.id,
            CoOverheadPool.code == "FAC",
        )
    )
    pool = r_pool.scalar_one_or_none()
    if not pool:
        pool = CoOverheadPool(
            id=uuid.uuid4(),
            vendor_id=vendor_id,
            company_id=company.id,
            code="FAC",
            name="Facility burden (demo)",
            allocation_base="labor_hours",
        )
        db.add(pool)
        await db.flush()
        db.add(
            CoOverheadRate(
                id=uuid.uuid4(),
                pool_id=pool.id,
                effective_from=date.today() - timedelta(days=400),
                rate_per_unit=Decimal("25.0000"),
            )
        )
        await db.flush()

    comp = await _ensure_product(
        db, vendor_id, created_by_user_id,
        "co-seed-component", "CO Seed Component", Decimal("12"),
    )
    fg_prod = await _ensure_product(
        db, vendor_id, created_by_user_id,
        "co-seed-finished-good", "CO Seed Finished Good", Decimal("199"),
    )

    r_cv = await db.execute(
        select(CoProductCostVersion).where(
            CoProductCostVersion.vendor_id == vendor_id,
            CoProductCostVersion.company_id == company.id,
            CoProductCostVersion.product_id == fg_prod.id,
            CoProductCostVersion.version_code == "STANDARD-1",
        )
    )
    pcv = r_cv.scalar_one_or_none()
    if not pcv:
        pcv = CoProductCostVersion(
            id=uuid.uuid4(),
            vendor_id=vendor_id,
            company_id=company.id,
            product_id=fg_prod.id,
            version_code="STANDARD-1",
            valid_from=date.today() - timedelta(days=60),
            status="active",
        )
        db.add(pcv)
        await db.flush()
        db.add_all(
            [
                CoProductCostLine(
                    id=uuid.uuid4(),
                    version_id=pcv.id,
                    line_type="material",
                    description="Component",
                    component_product_id=comp.id,
                    qty_per_output_unit=Decimal("2"),
                    unit_rate_planned=Decimal("12"),
                    sequence=1,
                ),
                CoProductCostLine(
                    id=uuid.uuid4(),
                    version_id=pcv.id,
                    line_type="activity",
                    description="Labor",
                    activity_type_id=act.id,
                    qty_per_output_unit=Decimal("0.5"),
                    unit_rate_planned=Decimal("80"),
                    sequence=2,
                ),
                CoProductCostLine(
                    id=uuid.uuid4(),
                    version_id=pcv.id,
                    line_type="overhead",
                    description="Facility",
                    overhead_pool_id=pool.id,
                    qty_per_output_unit=Decimal("0.5"),
                    unit_rate_planned=Decimal("25"),
                    sequence=3,
                ),
            ]
        )
        await db.flush()
        await db.refresh(pcv, ["lines"])
        _rollup_pcv_totals(pcv)

    mo = CoManufacturingOrder(
        id=uuid.uuid4(),
        vendor_id=vendor_id,
        company_id=company.id,
        order_no=demo_order_no,
        title="Demo assembly — seeded",
        order_kind="assembly",
        status="in_progress",
        product_id=fg_prod.id,
        qty_planned=Decimal("10"),
        qty_delivered=Decimal("4"),
        standard_cost_version_id=pcv.id,
    )
    db.add(mo)
    await db.flush()

    db.add_all(
        [
            CoOrderCostLine(
                id=uuid.uuid4(),
                order_id=mo.id,
                category="material",
                description="Components",
                product_id=comp.id,
                qty_planned=Decimal("20"),
                rate_planned=Decimal("12"),
                amount_planned=Decimal("240"),
                qty_actual=Decimal("20"),
                rate_actual=Decimal("12.5"),
                amount_actual=Decimal("250"),
                sequence=1,
            ),
            CoOrderCostLine(
                id=uuid.uuid4(),
                order_id=mo.id,
                category="activity",
                description="Labor",
                activity_type_id=act.id,
                qty_planned=Decimal("5"),
                rate_planned=Decimal("80"),
                amount_planned=Decimal("400"),
                qty_actual=Decimal("5"),
                rate_actual=Decimal("84"),
                amount_actual=Decimal("420"),
                sequence=2,
            ),
            CoOrderCostLine(
                id=uuid.uuid4(),
                order_id=mo.id,
                category="overhead",
                description="Facility",
                overhead_pool_id=pool.id,
                qty_planned=Decimal("5"),
                rate_planned=Decimal("25"),
                amount_planned=Decimal("125"),
                qty_actual=Decimal("5"),
                rate_actual=Decimal("28"),
                amount_actual=Decimal("140"),
                sequence=3,
            ),
        ]
    )
    await db.flush()

    return {
        "skipped": False,
        "company_id": str(company.id),
        "manufacturing_order_id": str(mo.id),
        "product_fg_id": str(fg_prod.id),
        "product_component_id": str(comp.id),
        "standard_cost_version_id": str(pcv.id),
        "activity_type_id": str(act.id),
        "overhead_pool_id": str(pool.id),
        "gl_mapping_id": str(gl.id) if gl else None,
        "wip_account_code": wip.code,
        "finished_goods_account_code": fg.code,
        "cogs_account_code": cogs_acc.code,
    }
