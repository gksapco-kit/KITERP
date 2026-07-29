"""Pharma batch helpers — number generation, FEFO allocation, audit append."""
from __future__ import annotations

import re
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID
import hashlib
import json

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.pharma import (
    PharmaBatchNumberModel,
    PharmaBatchSequence,
    BatchTransaction,
    PharmaAuditEvent,
    PharmaInspectionLot,
    PharmaBpr,
)
from app.models.procurement_goods import GoodsBatch
from app.models.vendor_product import Product
from app.models.storage_location import StorageLocation


# ── Pattern renderer ───────────────────────────────────────────────────────────

_VALID_TOKENS = re.compile(
    r"\{(?:PREFIX|YYYY|YY|YYYYMMDD|YYYYMM|MM|DD|SEQ)\}"
)


def render_batch_number(
    pattern: str,
    seq_value: int,
    *,
    prefix: str = "B",
    pad_width: int = 5,
    ref_date: Optional[date] = None,
) -> str:
    """Substitute pattern tokens and return the rendered batch number.

    Supported tokens:
      {PREFIX}    → prefix value
      {YYYY}      → 4-digit year
      {YY}        → 2-digit year
      {YYYYMMDD}  → compact date 20260728
      {YYYYMM}    → year-month  202607
      {MM}        → 2-digit month
      {DD}        → 2-digit day
      {SEQ}       → zero-padded counter
    """
    d = ref_date or date.today()
    num = str(seq_value).zfill(max(2, pad_width))
    result = pattern
    result = result.replace("{PREFIX}", prefix.upper())
    result = result.replace("{YYYYMMDD}", d.strftime("%Y%m%d"))
    result = result.replace("{YYYYMM}", d.strftime("%Y%m"))
    result = result.replace("{YYYY}", d.strftime("%Y"))
    result = result.replace("{YY}", d.strftime("%y"))
    result = result.replace("{MM}", d.strftime("%m"))
    result = result.replace("{DD}", d.strftime("%d"))
    result = result.replace("{SEQ}", num)
    return result


def validate_pattern(pattern: str) -> list[str]:
    """Return list of validation errors for a batch number pattern."""
    errors: list[str] = []
    if not pattern or not pattern.strip():
        errors.append("Pattern must not be empty.")
        return errors
    if "{SEQ}" not in pattern:
        errors.append("Pattern must contain the {SEQ} token.")
    if len(pattern) > 120:
        errors.append("Pattern must be ≤ 120 characters.")
    # Warn on unknown tokens
    unknown = re.findall(r"\{([A-Z0-9_]+)\}", pattern)
    known = {"PREFIX", "YYYY", "YY", "YYYYMMDD", "YYYYMM", "MM", "DD", "SEQ"}
    bad = [t for t in unknown if t not in known]
    if bad:
        errors.append(f"Unknown token(s): {', '.join('{' + t + '}' for t in bad)}")
    return errors


def _period_key_for(reset_period: str, ref_date: Optional[date] = None) -> str:
    """Return the counter bucket string for the given reset period."""
    d = ref_date or date.today()
    if reset_period == "yearly":
        return d.strftime("%Y")
    if reset_period == "monthly":
        return d.strftime("%Y%m")
    if reset_period == "daily":
        return d.strftime("%Y%m%d")
    return ""


# ── Model resolver ─────────────────────────────────────────────────────────────

async def resolve_batch_number_model(
    db: AsyncSession,
    vendor_id: UUID,
    purpose: str,
) -> Optional[PharmaBatchNumberModel]:
    """Return the active default model for the given purpose, or None.

    purpose values: manual | production | receipt | return | serial
    Falls back to the first active model if no is_default match.
    """
    q = (
        select(PharmaBatchNumberModel)
        .where(
            PharmaBatchNumberModel.vendor_id == vendor_id,
            PharmaBatchNumberModel.is_active.is_(True),
        )
        .order_by(
            PharmaBatchNumberModel.is_default.desc(),
            PharmaBatchNumberModel.created_at.asc(),
        )
    )
    rows: list[PharmaBatchNumberModel] = (await db.execute(q)).scalars().all()
    for m in rows:
        applies = {a.strip() for a in (m.applies_to or "").split(",")}
        if purpose in applies and m.is_default:
            return m
    # Fallback: any active model that applies
    for m in rows:
        applies = {a.strip() for a in (m.applies_to or "").split(",")}
        if purpose in applies:
            return m
    return None


# ── Core counter ───────────────────────────────────────────────────────────────

async def next_batch_number(
    db: AsyncSession,
    vendor_id: UUID,
    *,
    prefix: str = "B",
    plant_id: Optional[UUID] = None,
    product_id: Optional[UUID] = None,
    pad_width: int = 5,
    # Model-driven overrides (take priority when provided)
    model: Optional[PharmaBatchNumberModel] = None,
    purpose: Optional[str] = None,
) -> str:
    """Atomically allocate the next batch number for the given scope.

    When *model* is provided directly, or *purpose* is given and a model can be
    resolved, the model's pattern, prefix, pad_width, and reset_period govern
    the output.  Otherwise uses a simple ``{PREFIX}-{SEQ}`` hard-coded pattern
    (internal call sites before any model is configured).
    """
    # Resolve model by purpose when not provided directly
    if model is None and purpose:
        model = await resolve_batch_number_model(db, vendor_id, purpose)

    if model is not None:
        eff_prefix = (model.prefix or prefix or "B").strip().upper()[:40]
        eff_pad = max(2, int(model.pad_width or pad_width))
        eff_period = model.reset_period or "never"
        pattern = model.pattern
        scope = model.scope or "vendor"
    else:
        eff_prefix = (prefix or "B").strip().upper()[:40]
        eff_pad = max(2, int(pad_width))
        eff_period = "never"
        scope = "vendor"
        pattern = "{PREFIX}-{SEQ}"

    # Compute period bucket key
    period_key = _period_key_for(eff_period)

    # Determine scope FK
    eff_plant_id: Optional[UUID] = None
    eff_product_id: Optional[UUID] = None
    if scope in ("plant", "product"):
        eff_plant_id = plant_id
    if scope == "product":
        eff_product_id = product_id

    q = select(PharmaBatchSequence).where(
        PharmaBatchSequence.vendor_id == vendor_id,
        PharmaBatchSequence.prefix == eff_prefix,
        PharmaBatchSequence.period_key == period_key,
    )
    if eff_plant_id is None:
        q = q.where(PharmaBatchSequence.plant_id.is_(None))
    else:
        q = q.where(PharmaBatchSequence.plant_id == eff_plant_id)
    if eff_product_id is None:
        q = q.where(PharmaBatchSequence.product_id.is_(None))
    else:
        q = q.where(PharmaBatchSequence.product_id == eff_product_id)

    result = await db.execute(q.with_for_update())
    seq = result.scalar_one_or_none()
    if not seq:
        seq = PharmaBatchSequence(
            vendor_id=vendor_id,
            plant_id=eff_plant_id,
            product_id=eff_product_id,
            prefix=eff_prefix,
            period_key=period_key,
            last_number=0,
            pad_width=eff_pad,
        )
        db.add(seq)
        await db.flush()
        result = await db.execute(q.with_for_update())
        seq = result.scalar_one()

    seq.last_number = int(seq.last_number or 0) + 1
    seq.pad_width = max(int(seq.pad_width or eff_pad), eff_pad)

    return render_batch_number(
        pattern,
        seq.last_number,
        prefix=eff_prefix,
        pad_width=seq.pad_width,
    )


async def list_fefo_batches(
    db: AsyncSession,
    vendor_id: UUID,
    product_id: UUID,
    *,
    qty_needed: Optional[Decimal] = None,
    plant_id: Optional[UUID] = None,
    storage_location_id: Optional[UUID] = None,
    allow_expired: bool = False,
) -> list[GoodsBatch]:
    """Return unrestricted batches ordered by earliest expiry (FEFO)."""
    today = date.today()
    q = select(GoodsBatch).where(
        GoodsBatch.vendor_id == vendor_id,
        GoodsBatch.product_id == product_id,
        GoodsBatch.is_active.is_(True),
        GoodsBatch.quality_status == "unrestricted",
        GoodsBatch.quantity_available > 0,
    )
    if plant_id:
        q = q.where(GoodsBatch.plant_id == plant_id)
    if storage_location_id:
        q = q.where(GoodsBatch.storage_location_id == storage_location_id)
    if not allow_expired:
        q = q.where(
            (GoodsBatch.expiry_date.is_(None)) | (GoodsBatch.expiry_date >= today)
        )
    q = q.order_by(
        GoodsBatch.expiry_date.asc().nulls_last(),
        GoodsBatch.created_at.asc(),
    )
    rows = (await db.execute(q)).scalars().all()
    if qty_needed is None:
        return list(rows)

    needed = Decimal(str(qty_needed))
    picked: list[GoodsBatch] = []
    for b in rows:
        if needed <= 0:
            break
        avail = Decimal(str(b.quantity_available or 0))
        if avail <= 0:
            continue
        picked.append(b)
        needed -= avail
    return picked


async def allocate_fefo(
    db: AsyncSession,
    vendor_id: UUID,
    product_id: UUID,
    qty_needed: Decimal,
    *,
    plant_id: Optional[UUID] = None,
    storage_location_id: Optional[UUID] = None,
) -> list[dict[str, Any]]:
    """Return [{batch, qty}] covering qty_needed via FEFO. Raises if short."""
    batches = await list_fefo_batches(
        db,
        vendor_id,
        product_id,
        qty_needed=qty_needed,
        plant_id=plant_id,
        storage_location_id=storage_location_id,
    )
    remaining = Decimal(str(qty_needed))
    allocations: list[dict[str, Any]] = []
    for b in batches:
        if remaining <= 0:
            break
        avail = Decimal(str(b.quantity_available or 0))
        take = min(avail, remaining)
        if take <= 0:
            continue
        allocations.append({"batch": b, "qty": take})
        remaining -= take
    if remaining > 0:
        raise ValueError(
            f"Insufficient unrestricted FEFO stock for product {product_id}: short by {remaining}"
        )
    return allocations


async def record_batch_transaction(
    db: AsyncSession,
    *,
    vendor_id: UUID,
    txn_type: str,
    product_id: UUID,
    quantity: Decimal,
    source_type: Optional[str] = None,
    source_id: Optional[UUID] = None,
    document_number: Optional[str] = None,
    variant_id: Optional[UUID] = None,
    from_batch_id: Optional[UUID] = None,
    to_batch_id: Optional[UUID] = None,
    plant_id: Optional[UUID] = None,
    from_storage_location_id: Optional[UUID] = None,
    to_storage_location_id: Optional[UUID] = None,
    quality_status: Optional[str] = None,
    notes: Optional[str] = None,
    meta: Optional[dict] = None,
    performed_by: Optional[UUID] = None,
) -> BatchTransaction:
    txn = BatchTransaction(
        vendor_id=vendor_id,
        txn_type=txn_type,
        source_type=source_type,
        source_id=source_id,
        document_number=document_number,
        product_id=product_id,
        variant_id=variant_id,
        from_batch_id=from_batch_id,
        to_batch_id=to_batch_id,
        quantity=Decimal(str(quantity)),
        plant_id=plant_id,
        from_storage_location_id=from_storage_location_id,
        to_storage_location_id=to_storage_location_id,
        quality_status=quality_status,
        notes=notes,
        meta=meta or {},
        performed_by=performed_by,
    )
    db.add(txn)
    await db.flush()
    return txn


async def create_production_batch(
    db: AsyncSession,
    *,
    vendor_id: UUID,
    product_id: UUID,
    quantity: Decimal,
    production_order_id: UUID,
    plant_id: Optional[UUID] = None,
    storage_location_id: Optional[UUID] = None,
    manufacturing_date: Optional[date] = None,
    batch_number: Optional[str] = None,
    qc_required: bool = False,
    component_links: Optional[list[dict[str, Any]]] = None,
) -> GoodsBatch:
    """Create a finished-goods GoodsBatch from production receipt.

    When ``component_links`` is provided ([{batch_id, qty}, ...]), also writes
    produce transactions with both from_batch_id and to_batch_id so genealogy
    and recalls can walk component → FG.
    """
    product = (
        await db.execute(
            select(Product).where(Product.id == product_id, Product.vendor_id == vendor_id)
        )
    ).scalar_one_or_none()

    expiry = None
    mfg = manufacturing_date or date.today()
    if product and product.shelf_life_days:
        from datetime import timedelta
        expiry = mfg + timedelta(days=int(product.shelf_life_days))

    number = batch_number or await next_batch_number(
        db, vendor_id, prefix="FG", plant_id=plant_id, product_id=product_id,
        purpose="production",
    )
    qty = Decimal(str(quantity))
    status = "quality_inspection" if qc_required else "unrestricted"

    batch = GoodsBatch(
        vendor_id=vendor_id,
        product_id=product_id,
        batch_number=number,
        manufacturing_date=mfg,
        expiry_date=expiry,
        plant_id=plant_id,
        storage_location_id=storage_location_id,
        quantity_received=qty,
        quantity_available=qty,
        quantity_reserved=Decimal("0"),
        quantity_consumed=Decimal("0"),
        source_type="production",
        source_id=production_order_id,
        quality_status=status,
        is_active=True,
    )
    db.add(batch)
    await db.flush()

    await record_batch_transaction(
        db,
        vendor_id=vendor_id,
        txn_type="produce",
        product_id=product_id,
        quantity=qty,
        source_type="production",
        source_id=production_order_id,
        to_batch_id=batch.id,
        plant_id=plant_id,
        to_storage_location_id=storage_location_id,
        quality_status=status,
        meta={"batch_number": number},
    )

    for link in component_links or []:
        from_id = link.get("batch_id")
        link_qty = link.get("qty")
        if not from_id or link_qty is None:
            continue
        try:
            from_uuid = UUID(str(from_id)) if not isinstance(from_id, UUID) else from_id
        except (ValueError, TypeError):
            continue
        await record_batch_transaction(
            db,
            vendor_id=vendor_id,
            txn_type="produce",
            product_id=product_id,
            quantity=Decimal(str(link_qty)),
            source_type="production",
            source_id=production_order_id,
            from_batch_id=from_uuid,
            to_batch_id=batch.id,
            plant_id=plant_id,
            to_storage_location_id=storage_location_id,
            quality_status=status,
            meta={
                "batch_number": number,
                "component_batch_number": link.get("batch_number"),
                "genealogy": True,
            },
        )
    if qc_required:
        await place_batch_in_quarantine(db, vendor_id=vendor_id, batch=batch)
        await ensure_qi_inspection(
            db,
            vendor_id=vendor_id,
            batch=batch,
            origin="production",
        )
    return batch


async def create_receipt_batch(
    db: AsyncSession,
    *,
    vendor_id: UUID,
    product_id: UUID,
    quantity: Decimal,
    source_id: Optional[UUID] = None,
    source_type: str = "purchase",
    document_number: Optional[str] = None,
    variant_id: Optional[UUID] = None,
    plant_id: Optional[UUID] = None,
    storage_location_id: Optional[UUID] = None,
    batch_number: Optional[str] = None,
    supplier_batch_number: Optional[str] = None,
    manufacturing_date: Optional[date] = None,
    expiry_date: Optional[date] = None,
    qc_required: bool = False,
    notes: Optional[str] = None,
) -> GoodsBatch:
    """Create a GoodsBatch on goods receipt / stock-in for batch-managed products."""
    product = (
        await db.execute(
            select(Product).where(Product.id == product_id, Product.vendor_id == vendor_id)
        )
    ).scalar_one_or_none()

    mfg = manufacturing_date or date.today()
    expiry = expiry_date
    if expiry is None and product and product.shelf_life_days:
        from datetime import timedelta
        expiry = mfg + timedelta(days=int(product.shelf_life_days))

    number = batch_number or await next_batch_number(
        db, vendor_id, prefix="GR", plant_id=plant_id, product_id=product_id,
        purpose="receipt",
    )
    qty = Decimal(str(quantity))
    status = "quality_inspection" if qc_required else "unrestricted"

    batch = GoodsBatch(
        vendor_id=vendor_id,
        product_id=product_id,
        variant_id=variant_id,
        batch_number=number,
        manufacturing_date=mfg,
        expiry_date=expiry,
        plant_id=plant_id,
        storage_location_id=storage_location_id,
        quantity_received=qty,
        quantity_available=qty,
        quantity_reserved=Decimal("0"),
        quantity_consumed=Decimal("0"),
        source_type=source_type,
        source_id=source_id,
        quality_status=status,
        supplier_batch_number=supplier_batch_number,
        notes=notes,
        is_active=True,
    )
    db.add(batch)
    await db.flush()

    await record_batch_transaction(
        db,
        vendor_id=vendor_id,
        txn_type="receive",
        product_id=product_id,
        quantity=qty,
        source_type=source_type,
        source_id=source_id,
        document_number=document_number,
        variant_id=variant_id,
        to_batch_id=batch.id,
        plant_id=plant_id,
        to_storage_location_id=storage_location_id,
        quality_status=status,
        notes=notes,
        meta={"batch_number": number, "supplier_batch_number": supplier_batch_number},
    )
    if qc_required:
        await place_batch_in_quarantine(db, vendor_id=vendor_id, batch=batch)
        await ensure_qi_inspection(
            db,
            vendor_id=vendor_id,
            batch=batch,
            origin="receipt" if source_type in ("purchase", "stock_in") else source_type,
        )
    return batch


async def _consume_fefo_allocations(
    db: AsyncSession,
    *,
    vendor_id: UUID,
    product_id: UUID,
    quantity: Decimal,
    txn_type: str,
    source_type: str,
    source_id: Optional[UUID] = None,
    plant_id: Optional[UUID] = None,
    storage_location_id: Optional[UUID] = None,
    document_number: Optional[str] = None,
) -> list[dict[str, Any]]:
    """Shared FEFO consume used by production issue and sales."""
    allocations = await allocate_fefo(
        db,
        vendor_id,
        product_id,
        Decimal(str(quantity)),
        plant_id=plant_id,
        storage_location_id=storage_location_id,
    )
    details: list[dict[str, Any]] = []
    for item in allocations:
        batch: GoodsBatch = item["batch"]
        take: Decimal = item["qty"]
        batch.quantity_available = Decimal(str(batch.quantity_available or 0)) - take
        batch.quantity_consumed = Decimal(str(batch.quantity_consumed or 0)) + take
        await record_batch_transaction(
            db,
            vendor_id=vendor_id,
            txn_type=txn_type,
            product_id=product_id,
            quantity=take,
            source_type=source_type,
            source_id=source_id,
            document_number=document_number,
            from_batch_id=batch.id,
            plant_id=plant_id or batch.plant_id,
            from_storage_location_id=storage_location_id or batch.storage_location_id,
            quality_status=batch.quality_status,
            meta={"batch_number": batch.batch_number},
        )
        details.append({
            "batch_id": str(batch.id),
            "batch_number": batch.batch_number,
            "qty": float(take),
            "expiry_date": batch.expiry_date.isoformat() if batch.expiry_date else None,
        })
    return details


async def consume_batches_for_production(
    db: AsyncSession,
    *,
    vendor_id: UUID,
    product_id: UUID,
    quantity: Decimal,
    production_order_id: UUID,
    plant_id: Optional[UUID] = None,
    storage_location_id: Optional[UUID] = None,
) -> list[dict[str, Any]]:
    """FEFO-consume component batches; returns allocation details."""
    return await _consume_fefo_allocations(
        db,
        vendor_id=vendor_id,
        product_id=product_id,
        quantity=quantity,
        txn_type="issue",
        source_type="production",
        source_id=production_order_id,
        plant_id=plant_id,
        storage_location_id=storage_location_id,
    )


async def consume_batches_for_sale(
    db: AsyncSession,
    *,
    vendor_id: UUID,
    product_id: UUID,
    quantity: Decimal,
    source_id: Optional[UUID] = None,
    source_type: str = "sale",
    plant_id: Optional[UUID] = None,
    storage_location_id: Optional[UUID] = None,
    document_number: Optional[str] = None,
) -> list[dict[str, Any]]:
    """FEFO-consume unrestricted non-expired lots for POS / order sales."""
    return await _consume_fefo_allocations(
        db,
        vendor_id=vendor_id,
        product_id=product_id,
        quantity=quantity,
        txn_type="sale",
        source_type=source_type,
        source_id=source_id,
        plant_id=plant_id,
        storage_location_id=storage_location_id,
        document_number=document_number,
    )


async def restore_batches_for_return(
    db: AsyncSession,
    *,
    vendor_id: UUID,
    product_id: UUID,
    quantity: Decimal,
    source_id: Optional[UUID] = None,
    source_type: str = "sale_return",
    original_source_id: Optional[UUID] = None,
    original_source_type: Optional[str] = None,
) -> list[dict[str, Any]]:
    """
    Restore lot qty on returns / order cancel (Stage A hardening).

    Prefers reversing the original sale's BatchTransaction lines (LIFO).
    Falls back to most recent sale issues for the product, then to the
    newest unrestricted active lot.
    """
    qty_left = Decimal(str(quantity))
    if qty_left <= 0:
        return []

    details: list[dict[str, Any]] = []

    async def _restore_to_batch(batch: GoodsBatch, take: Decimal) -> None:
        nonlocal qty_left
        if take <= 0:
            return
        batch.quantity_available = Decimal(str(batch.quantity_available or 0)) + take
        consumed = Decimal(str(batch.quantity_consumed or 0))
        batch.quantity_consumed = max(Decimal("0"), consumed - take)
        # Returned stock re-enters unrestricted unless the lot is blocked/recalled
        if batch.quality_status == "blocked":
            pass
        elif batch.quality_status != "unrestricted":
            batch.quality_status = "unrestricted"
        await record_batch_transaction(
            db,
            vendor_id=vendor_id,
            txn_type="return",
            product_id=product_id,
            quantity=take,
            source_type=source_type,
            source_id=source_id,
            to_batch_id=batch.id,
            plant_id=batch.plant_id,
            to_storage_location_id=batch.storage_location_id,
            quality_status=batch.quality_status,
            meta={
                "batch_number": batch.batch_number,
                "original_source_id": str(original_source_id) if original_source_id else None,
            },
        )
        details.append({
            "batch_id": str(batch.id),
            "batch_number": batch.batch_number,
            "qty": float(take),
        })
        qty_left -= take

    # 1) Reverse specific sale transactions when original source is known
    sale_q = (
        select(BatchTransaction)
        .where(
            BatchTransaction.vendor_id == vendor_id,
            BatchTransaction.product_id == product_id,
            BatchTransaction.txn_type == "sale",
            BatchTransaction.from_batch_id.is_not(None),
        )
        .order_by(BatchTransaction.created_at.desc())
    )
    if original_source_id is not None:
        sale_q = sale_q.where(BatchTransaction.source_id == original_source_id)
        if original_source_type:
            sale_q = sale_q.where(BatchTransaction.source_type == original_source_type)
    else:
        # Prefer reversing the return's linked order/pos sale if source_id points at it —
        # otherwise most recent sales for this product.
        pass

    sale_txns = (await db.execute(sale_q.limit(50))).scalars().all()
    for txn in sale_txns:
        if qty_left <= 0:
            break
        batch = (
            await db.execute(
                select(GoodsBatch).where(
                    GoodsBatch.id == txn.from_batch_id,
                    GoodsBatch.vendor_id == vendor_id,
                )
            )
        ).scalar_one_or_none()
        if not batch:
            continue
        take = min(qty_left, Decimal(str(txn.quantity or 0)))
        await _restore_to_batch(batch, take)

    # 2) Fallback: put remainder on newest unrestricted lot
    if qty_left > 0:
        fallback = (
            await db.execute(
                select(GoodsBatch)
                .where(
                    GoodsBatch.vendor_id == vendor_id,
                    GoodsBatch.product_id == product_id,
                    GoodsBatch.is_active.is_(True),
                    GoodsBatch.quality_status == "unrestricted",
                )
                .order_by(GoodsBatch.created_at.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        if fallback:
            await _restore_to_batch(fallback, qty_left)
        else:
            # 3) Create a return lot so quantity is not lost
            bn = await next_batch_number(db, vendor_id, prefix="RET", purpose="return")
            batch = GoodsBatch(
                vendor_id=vendor_id,
                product_id=product_id,
                batch_number=bn,
                quantity_received=qty_left,
                quantity_available=qty_left,
                quantity_consumed=Decimal("0"),
                quality_status="unrestricted",
                source_type="return",
                source_id=source_id,
                notes="Auto-created on sale return (no prior lot to reverse)",
            )
            db.add(batch)
            await db.flush()
            await record_batch_transaction(
                db,
                vendor_id=vendor_id,
                txn_type="return",
                product_id=product_id,
                quantity=qty_left,
                source_type=source_type,
                source_id=source_id,
                to_batch_id=batch.id,
                quality_status="unrestricted",
                meta={"batch_number": bn, "auto_created": True},
            )
            details.append({
                "batch_id": str(batch.id),
                "batch_number": bn,
                "qty": float(qty_left),
                "auto_created": True,
            })
            qty_left = Decimal("0")

    return details


def _canonical_ts(dt: datetime) -> str:
    """UTC, fixed-precision timestamp so the digest survives a DB round-trip
    even on backends that do not preserve tzinfo."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")


def compute_pharma_audit_signature(
    *,
    vendor_id: UUID,
    entity_type: str,
    entity_id: UUID,
    action: str,
    meaning: Optional[str],
    actor_id: Optional[UUID],
    esign_verified: bool,
    created_at: datetime,
    old_value: Any = None,
    new_value: Any = None,
) -> str:
    """Part 11 evidence token over the full record content.

    Canonical JSON (sorted keys) so the digest can be recomputed from a stored
    row to prove the record was not altered after signing.
    """
    payload = json.dumps(
        {
            "vendor_id": str(vendor_id),
            "entity_type": entity_type,
            "entity_id": str(entity_id),
            "action": action,
            "meaning": meaning,
            "actor_id": str(actor_id) if actor_id else None,
            "esign_verified": bool(esign_verified),
            "created_at": _canonical_ts(created_at),
            "old_value": old_value,
            "new_value": new_value,
        },
        sort_keys=True,
        separators=(",", ":"),
        default=str,
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def verify_pharma_audit_signature(evt: PharmaAuditEvent) -> bool:
    """Recompute a stored event's digest; False means tampered or unsigned."""
    if not evt.signature_hash or evt.created_at is None:
        return False
    return evt.signature_hash == compute_pharma_audit_signature(
        vendor_id=evt.vendor_id,
        entity_type=evt.entity_type,
        entity_id=evt.entity_id,
        action=evt.action,
        meaning=evt.meaning,
        actor_id=evt.actor_id,
        esign_verified=evt.esign_verified,
        created_at=evt.created_at,
        old_value=evt.old_value,
        new_value=evt.new_value,
    )


async def append_pharma_audit(
    db: AsyncSession,
    *,
    vendor_id: UUID,
    entity_type: str,
    entity_id: UUID,
    action: str,
    actor_id: Optional[UUID] = None,
    actor_name: Optional[str] = None,
    meaning: Optional[str] = None,
    old_value: Any = None,
    new_value: Any = None,
    ip_address: Optional[str] = None,
    esign_verified: bool = False,
) -> PharmaAuditEvent:
    # created_at is set here (not by server_default) so it is part of the digest
    # and the hash stays verifiable against the persisted row.
    created_at = datetime.now(timezone.utc)
    sig = compute_pharma_audit_signature(
        vendor_id=vendor_id,
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        meaning=meaning,
        actor_id=actor_id,
        esign_verified=esign_verified,
        created_at=created_at,
        old_value=old_value,
        new_value=new_value,
    )
    evt = PharmaAuditEvent(
        vendor_id=vendor_id,
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        meaning=meaning,
        actor_id=actor_id,
        actor_name=actor_name,
        old_value=old_value,
        new_value=new_value,
        signature_hash=sig,
        ip_address=ip_address,
        esign_verified=esign_verified,
        created_at=created_at,
    )
    db.add(evt)
    await db.flush()
    return evt


async def build_genealogy(
    db: AsyncSession,
    vendor_id: UUID,
    batch_id: UUID,
    *,
    direction: str = "both",
    depth: int = 8,
) -> dict[str, Any]:
    """Forward/backward lot tree from batch_transaction links."""
    batch = (
        await db.execute(
            select(GoodsBatch).where(
                GoodsBatch.id == batch_id,
                GoodsBatch.vendor_id == vendor_id,
            )
        )
    ).scalar_one_or_none()
    if not batch:
        raise ValueError("Batch not found")

    async def _upstream(bid: UUID, remaining: int, seen: set[UUID]) -> list[dict]:
        if remaining <= 0 or bid in seen:
            return []
        seen.add(bid)
        txns = (
            await db.execute(
                select(BatchTransaction).where(
                    BatchTransaction.vendor_id == vendor_id,
                    BatchTransaction.to_batch_id == bid,
                    BatchTransaction.from_batch_id.is_not(None),
                )
            )
        ).scalars().all()
        nodes = []
        for t in txns:
            parent = (
                await db.execute(select(GoodsBatch).where(GoodsBatch.id == t.from_batch_id))
            ).scalar_one_or_none()
            if not parent:
                continue
            nodes.append({
                "batch_id": str(parent.id),
                "batch_number": parent.batch_number,
                "product_id": str(parent.product_id),
                "qty": float(t.quantity),
                "txn_type": t.txn_type,
                "children": await _upstream(parent.id, remaining - 1, seen),
            })
        return nodes

    async def _downstream(bid: UUID, remaining: int, seen: set[UUID]) -> list[dict]:
        if remaining <= 0 or bid in seen:
            return []
        seen.add(bid)
        txns = (
            await db.execute(
                select(BatchTransaction).where(
                    BatchTransaction.vendor_id == vendor_id,
                    BatchTransaction.from_batch_id == bid,
                    BatchTransaction.to_batch_id.is_not(None),
                )
            )
        ).scalars().all()
        # Also include produce/issue without to_batch (consumption)
        issue_txns = (
            await db.execute(
                select(BatchTransaction).where(
                    BatchTransaction.vendor_id == vendor_id,
                    BatchTransaction.from_batch_id == bid,
                )
            )
        ).scalars().all()
        nodes = []
        for t in txns:
            child = (
                await db.execute(select(GoodsBatch).where(GoodsBatch.id == t.to_batch_id))
            ).scalar_one_or_none()
            if not child:
                continue
            nodes.append({
                "batch_id": str(child.id),
                "batch_number": child.batch_number,
                "product_id": str(child.product_id),
                "qty": float(t.quantity),
                "txn_type": t.txn_type,
                "children": await _downstream(child.id, remaining - 1, seen),
            })
        for t in issue_txns:
            if t.to_batch_id:
                continue
            nodes.append({
                "batch_id": None,
                "batch_number": None,
                "product_id": str(t.product_id),
                "qty": float(t.quantity),
                "txn_type": t.txn_type,
                "source_type": t.source_type,
                "source_id": str(t.source_id) if t.source_id else None,
                "children": [],
            })
        return nodes

    root = {
        "batch_id": str(batch.id),
        "batch_number": batch.batch_number,
        "product_id": str(batch.product_id),
        "quality_status": batch.quality_status,
        "quantity_available": float(batch.quantity_available or 0),
        "expiry_date": batch.expiry_date.isoformat() if batch.expiry_date else None,
    }
    if direction in ("both", "backward", "upstream"):
        root["upstream"] = await _upstream(batch.id, depth, set())
    if direction in ("both", "forward", "downstream"):
        root["downstream"] = await _downstream(batch.id, depth, set())
    return root


async def find_sloc_by_stock_type(
    db: AsyncSession,
    vendor_id: UUID,
    stock_type: str,
    *,
    plant_id: Optional[UUID] = None,
    preferred_id: Optional[UUID] = None,
) -> Optional[StorageLocation]:
    """Pick a storage location of the given stock type (quarantine / unrestricted / rejected)."""
    if preferred_id:
        row = (
            await db.execute(
                select(StorageLocation).where(
                    StorageLocation.id == preferred_id,
                    StorageLocation.vendor_id == vendor_id,
                    StorageLocation.is_active.is_(True),
                )
            )
        ).scalar_one_or_none()
        if row and (row.stock_type or "unrestricted") == stock_type:
            return row

    q = select(StorageLocation).where(
        StorageLocation.vendor_id == vendor_id,
        StorageLocation.is_active.is_(True),
        StorageLocation.stock_type == stock_type,
    )
    if plant_id:
        q = q.where(
            (StorageLocation.plant_id == plant_id) | (StorageLocation.plant_id.is_(None))
        )
    q = q.order_by(StorageLocation.sort_order, StorageLocation.name).limit(1)
    return (await db.execute(q)).scalar_one_or_none()


async def place_batch_in_quarantine(
    db: AsyncSession,
    *,
    vendor_id: UUID,
    batch: GoodsBatch,
) -> Optional[UUID]:
    """Move QI batch onto a quarantine SLoc when one exists; return new location id."""
    current = None
    if batch.storage_location_id:
        current = (
            await db.execute(
                select(StorageLocation).where(StorageLocation.id == batch.storage_location_id)
            )
        ).scalar_one_or_none()
        if current and (current.stock_type or "") == "quarantine":
            return batch.storage_location_id

    target = await find_sloc_by_stock_type(
        db, vendor_id, "quarantine", plant_id=batch.plant_id
    )
    if not target:
        return batch.storage_location_id

    old_loc = batch.storage_location_id
    batch.storage_location_id = target.id
    await record_batch_transaction(
        db,
        vendor_id=vendor_id,
        txn_type="transfer",
        product_id=batch.product_id,
        quantity=Decimal(str(batch.quantity_available or 0)),
        source_type="quarantine",
        source_id=batch.id,
        from_batch_id=batch.id,
        to_batch_id=batch.id,
        plant_id=batch.plant_id,
        from_storage_location_id=old_loc,
        to_storage_location_id=target.id,
        quality_status=batch.quality_status,
        meta={"reason": "qi_quarantine_move", "batch_number": batch.batch_number},
    )
    return target.id


async def release_batch_from_quarantine(
    db: AsyncSession,
    *,
    vendor_id: UUID,
    batch: GoodsBatch,
    to_rejected: bool = False,
) -> Optional[UUID]:
    """On release/reject, move lot off quarantine SLoc when a target stock type exists."""
    stock_type = "rejected" if to_rejected else "unrestricted"
    current = None
    if batch.storage_location_id:
        current = (
            await db.execute(
                select(StorageLocation).where(StorageLocation.id == batch.storage_location_id)
            )
        ).scalar_one_or_none()
    if current and (current.stock_type or "unrestricted") == stock_type:
        return batch.storage_location_id
    # Only auto-move when currently in quarantine/rejected (or no location)
    if current and (current.stock_type or "unrestricted") not in ("quarantine", "rejected", "returns"):
        return batch.storage_location_id

    target = await find_sloc_by_stock_type(
        db, vendor_id, stock_type, plant_id=batch.plant_id
    )
    if not target:
        return batch.storage_location_id

    old_loc = batch.storage_location_id
    batch.storage_location_id = target.id
    await record_batch_transaction(
        db,
        vendor_id=vendor_id,
        txn_type="transfer",
        product_id=batch.product_id,
        quantity=Decimal(str(batch.quantity_available or 0)),
        source_type="release" if not to_rejected else "reject",
        source_id=batch.id,
        from_batch_id=batch.id,
        to_batch_id=batch.id,
        plant_id=batch.plant_id,
        from_storage_location_id=old_loc,
        to_storage_location_id=target.id,
        quality_status=batch.quality_status,
        meta={"reason": f"post_decision_{stock_type}", "batch_number": batch.batch_number},
    )
    return target.id


async def ensure_qi_inspection(
    db: AsyncSession,
    *,
    vendor_id: UUID,
    batch: GoodsBatch,
    origin: str = "receipt",
) -> PharmaInspectionLot:
    """Create an open inspection lot for a QI batch if one is not already open."""
    existing = (
        await db.execute(
            select(PharmaInspectionLot).where(
                PharmaInspectionLot.vendor_id == vendor_id,
                PharmaInspectionLot.goods_batch_id == batch.id,
                PharmaInspectionLot.status.in_(["open", "testing", "pending_release"]),
            ).limit(1)
        )
    ).scalar_one_or_none()
    if existing:
        return existing

    insp = PharmaInspectionLot(
        vendor_id=vendor_id,
        goods_batch_id=batch.id,
        product_id=batch.product_id,
        origin=origin,
        status="open",
        results=[],
        coa_data={},
    )
    db.add(insp)
    await db.flush()
    return insp


async def open_retest_inspection(
    db: AsyncSession,
    *,
    vendor_id: UUID,
    batch_id: UUID,
) -> PharmaInspectionLot:
    """
    Stage A: from retest-due alert → put lot in QI and open a retest inspection.
    """
    batch = (
        await db.execute(
            select(GoodsBatch).where(
                GoodsBatch.id == batch_id,
                GoodsBatch.vendor_id == vendor_id,
            )
        )
    ).scalar_one_or_none()
    if not batch:
        raise ValueError("Batch not found")

    batch.quality_status = "quality_inspection"
    await place_batch_in_quarantine(db, vendor_id=vendor_id, batch=batch)
    insp = await ensure_qi_inspection(
        db, vendor_id=vendor_id, batch=batch, origin="retest",
    )
    if insp.origin != "retest" and insp.status in ("open", "testing", "pending_release"):
        # Existing open insp — retarget as retest when starting from alert
        insp.origin = "retest"
    return insp


async def archive_coa_pdf(
    db: AsyncSession,
    *,
    vendor_id: UUID,
    insp: PharmaInspectionLot,
    batch: Optional[GoodsBatch] = None,
    product_name: str = "",
) -> Optional[str]:
    """Generate CoA PDF, store via FileService, return public URL."""
    from app.services.file_service import FileService
    from app.utils.pharma_pdf import generate_coa_pdf

    if batch is None:
        batch = (
            await db.execute(select(GoodsBatch).where(GoodsBatch.id == insp.goods_batch_id))
        ).scalar_one_or_none()
    coa = dict(insp.coa_data or {})
    pdf_bytes = generate_coa_pdf(
        coa_number=insp.coa_number or f"COA-{batch.batch_number if batch else insp.id}",
        product_name=product_name or str(insp.product_id),
        batch_number=batch.batch_number if batch else "",
        manufacturing_date=batch.manufacturing_date if batch else None,
        expiry_date=batch.expiry_date if batch else None,
        released_at=coa.get("released_at") or insp.decided_at,
        origin=insp.origin or "",
        results=insp.results or [],
        decision_notes=insp.decision_notes or "",
        signatures=coa.get("esignatures") or [],
    )
    fs = FileService()
    url = await fs.upload_bytes(
        pdf_bytes,
        folder=f"pharma/{vendor_id}/coa",
        ext=".pdf",
        content_type="application/pdf",
    )
    coa["pdf_url"] = url
    coa["pdf_archived_at"] = datetime.now(timezone.utc).isoformat()
    insp.coa_data = coa
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(insp, "coa_data")
    return url


async def archive_bpr_pdf(
    db: AsyncSession,
    *,
    vendor_id: UUID,
    bpr: PharmaBpr,
    product_name: str = "",
    signatures: Optional[list] = None,
) -> Optional[str]:
    from app.services.file_service import FileService
    from app.utils.pharma_pdf import generate_bpr_pdf

    pdf_bytes = generate_bpr_pdf(
        batch_number=bpr.batch_number,
        product_name=product_name or str(bpr.product_id),
        status=bpr.status,
        planned_qty=float(bpr.planned_qty) if bpr.planned_qty is not None else None,
        actual_qty=float(bpr.actual_qty) if bpr.actual_qty is not None else None,
        yield_pct=float(bpr.yield_pct) if bpr.yield_pct is not None else None,
        clearance_done=bool(bpr.clearance_done),
        operation_log=bpr.operation_log or [],
        ipc_results=bpr.ipc_results or [],
        notes=bpr.notes or "",
        completed_at=bpr.completed_at,
        signatures=signatures or [],
    )
    fs = FileService()
    url = await fs.upload_bytes(
        pdf_bytes,
        folder=f"pharma/{vendor_id}/bpr",
        ext=".pdf",
        content_type="application/pdf",
    )
    bpr.pdf_url = url
    return url


async def list_batch_alerts(
    db: AsyncSession,
    vendor_id: UUID,
    *,
    expiry_within_days: int = 30,
    limit: int = 100,
) -> dict[str, Any]:
    """Expiry and retest alerts for active lots with available qty."""
    from datetime import timedelta

    today = date.today()
    expiry_cutoff = today + timedelta(days=max(0, expiry_within_days))

    batches = (
        await db.execute(
            select(GoodsBatch).where(
                GoodsBatch.vendor_id == vendor_id,
                GoodsBatch.is_active.is_(True),
                GoodsBatch.quantity_available > 0,
            ).limit(500)
        )
    ).scalars().all()

    product_ids = {b.product_id for b in batches}
    products: dict[UUID, Product] = {}
    if product_ids:
        rows = (
            await db.execute(select(Product).where(Product.id.in_(product_ids)))
        ).scalars().all()
        products = {p.id: p for p in rows}

    expired: list[dict] = []
    expiring_soon: list[dict] = []
    retest_due: list[dict] = []

    for b in batches:
        prod = products.get(b.product_id)
        name = prod.name if prod else None
        base = {
            "batch_id": str(b.id),
            "batch_number": b.batch_number,
            "product_id": str(b.product_id),
            "product_name": name,
            "quality_status": b.quality_status,
            "quantity_available": float(b.quantity_available or 0),
            "expiry_date": b.expiry_date.isoformat() if b.expiry_date else None,
            "manufacturing_date": b.manufacturing_date.isoformat() if b.manufacturing_date else None,
        }
        if b.expiry_date:
            if b.expiry_date < today:
                expired.append({**base, "alert": "expired", "days_overdue": (today - b.expiry_date).days})
            elif b.expiry_date <= expiry_cutoff:
                expired_or = {**base, "alert": "expiring_soon", "days_remaining": (b.expiry_date - today).days}
                expiring_soon.append(expired_or)

        retest_days = getattr(prod, "retest_days", None) if prod else None
        if retest_days and b.manufacturing_date:
            due = b.manufacturing_date + timedelta(days=int(retest_days))
            if due <= today and b.quality_status == "unrestricted":
                retest_due.append({
                    **base,
                    "alert": "retest_due",
                    "retest_due_date": due.isoformat(),
                    "days_overdue": (today - due).days,
                })

    expired = expired[:limit]
    expiring_soon = expiring_soon[:limit]
    retest_due = retest_due[:limit]
    return {
        "expiry_within_days": expiry_within_days,
        "expired": expired,
        "expiring_soon": expiring_soon,
        "retest_due": retest_due,
        "counts": {
            "expired": len(expired),
            "expiring_soon": len(expiring_soon),
            "retest_due": len(retest_due),
        },
    }
