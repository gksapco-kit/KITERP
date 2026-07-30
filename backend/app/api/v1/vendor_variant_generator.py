# app/api/v1/vendor_variant_generator.py
"""
Variant Generator — turns Product Configuration metadata (attributes, options,
rules) into concrete Variant Instances (app.models.vendor_product.ProductVariant).

Flow: Preview (shows total combinations + lets the user exclude some) -> Generate
(creates only the accepted, still-valid, not-yet-existing variants). Dedup is
guaranteed by variant_hash (DB unique index + an in-request skip-existing check).
"""
from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.deps import get_current_vendor_id, require_permission
from app.models.vendor_product import Product, ProductVariant
from app.repositories.product_config_repo import (
    ConfigAttributeRepository, ConfigOptionRepository, ConfigRuleRepository,
)
from app.api.v1.vendor_product_config import _rule_dict
from app.schemas.variant_generator import (
    GenerateMode, VariantPreviewRequest, VariantPreviewResponse, VariantPreviewItem,
    VariantGenerateRequest, VariantGenerateResponse, InvalidVariantsResponse,
)
from app.services.variant_generator import (
    DEFAULT_MAX_COMBINATIONS, build_attribute_order, generate_candidate_combinations,
    compute_variant_hash, build_variant_sku, build_variant_barcode, build_variant_label,
    build_search_keywords, price_delta_sum, disambiguate_sku, is_selection_still_valid, _short_code,
)
from app.models.vendor import Vendor
from app.services.inventory_settings import is_auto_generate_barcode

router = APIRouter(dependencies=[Depends(require_permission("products.view"))])

PREVIEW_ITEMS_CAP = 9999


async def _vendor_auto_barcode(db: AsyncSession, vendor_id: UUID) -> bool:
    result = await db.execute(select(Vendor.settings).where(Vendor.id == vendor_id))
    settings = result.scalar_one_or_none()
    return is_auto_generate_barcode(settings if isinstance(settings, dict) else None)


async def _get_owned_product(db: AsyncSession, vendor_id: UUID, product_id: UUID) -> Product:
    product = await db.get(Product, product_id)
    if not product or product.vendor_id != vendor_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    return product


async def _load_context(db: AsyncSession, vendor_id: UUID, product_id: UUID):
    """Fetch attributes (with options) + active rules and build the DFS order
    the generator needs — shared by preview / generate / invalid-cleanup."""
    attr_repo = ConfigAttributeRepository(db)
    attributes = await attr_repo.list_for_product(vendor_id, product_id)

    opt_repo = ConfigOptionRepository(db)
    options = await opt_repo.list_for_attributes([a.id for a in attributes])
    options_by_attr: dict = {}
    for o in options:
        options_by_attr.setdefault(o.attribute_id, []).append(o)

    attribute_order = build_attribute_order(attributes, options_by_attr)

    rule_repo = ConfigRuleRepository(db)
    rules = await rule_repo.list_for_product(vendor_id, product_id, active_only=True)
    rule_dicts = [_rule_dict(r) for r in rules]

    return attribute_order, rule_dicts


async def _existing_variant_hashes(db: AsyncSession, product_id: UUID) -> set[str]:
    result = await db.execute(
        select(ProductVariant.variant_hash).where(
            ProductVariant.product_id == product_id,
            ProductVariant.variant_hash.is_not(None),
        )
    )
    return {h for (h,) in result.all() if h}


async def _existing_skus(db: AsyncSession, product_id: UUID) -> set[str]:
    result = await db.execute(
        select(ProductVariant.sku).where(ProductVariant.product_id == product_id, ProductVariant.sku.is_not(None))
    )
    return {s for (s,) in result.all() if s}


@router.post("/{product_id}/config/variants/preview", response_model=VariantPreviewResponse)
async def preview_variants(
    product_id: UUID,
    data: VariantPreviewRequest,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    await _get_owned_product(db, vendor_id, product_id)
    attribute_order, rule_dicts = await _load_context(db, vendor_id, product_id)
    auto_barcode = await _vendor_auto_barcode(db, vendor_id)

    if not attribute_order:
        return JSONResponse(content=VariantPreviewResponse(
            total_combinations=0, new_count=0, existing_count=0, excluded_count=0,
            truncated=False, max_combinations=data.max_combinations or DEFAULT_MAX_COMBINATIONS, items=[],
        ).model_dump())

    max_combos = data.max_combinations or DEFAULT_MAX_COMBINATIONS
    candidates, truncated = generate_candidate_combinations(attribute_order, rule_dicts, max_combos)
    existing_hashes = await _existing_variant_hashes(db, product_id)
    excluded_set = set(data.excluded_hashes)

    new_count = existing_count = excluded_count = 0
    items = []
    for selection in candidates:
        h = compute_variant_hash(str(product_id), selection)
        status_label = "excluded" if h in excluded_set else ("exists" if h in existing_hashes else "new")
        if status_label == "excluded":
            excluded_count += 1
        elif status_label == "exists":
            existing_count += 1
        else:
            new_count += 1

        if data.mode == GenerateMode.MISSING and status_label == "exists":
            continue

        if len(items) < PREVIEW_ITEMS_CAP:
            items.append(VariantPreviewItem(
                variant_hash=h,
                label=build_variant_label(attribute_order, selection),
                sku_preview=build_variant_sku("SKU", attribute_order, selection),
                barcode_preview=build_variant_barcode(h) if auto_barcode else None,
                selection=selection,
                price_delta=price_delta_sum(attribute_order, selection),
                status=status_label,
            ))

    return JSONResponse(content=VariantPreviewResponse(
        total_combinations=len(candidates),
        new_count=new_count,
        existing_count=existing_count,
        excluded_count=excluded_count,
        truncated=truncated,
        max_combinations=max_combos,
        items=items,
    ).model_dump())


@router.post("/{product_id}/config/variants/generate", response_model=VariantGenerateResponse)
async def generate_variants(
    product_id: UUID,
    data: VariantGenerateRequest,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    product = await _get_owned_product(db, vendor_id, product_id)
    attribute_order, rule_dicts = await _load_context(db, vendor_id, product_id)
    auto_barcode = await _vendor_auto_barcode(db, vendor_id)

    if not attribute_order:
        raise HTTPException(400, "This product has no configuration attributes yet — add attributes and options first.")

    if data.mode == GenerateMode.SELECTED and data.selected_hashes is None:
        raise HTTPException(400, "selected_hashes is required when mode is 'selected'.")

    max_combos = data.max_combinations or DEFAULT_MAX_COMBINATIONS
    candidates, _truncated = generate_candidate_combinations(attribute_order, rule_dicts, max_combos)
    excluded_set = set(data.excluded_hashes)
    selected_set = set(data.selected_hashes) if data.selected_hashes is not None else None

    deleted_count = 0
    if data.mode == GenerateMode.REGENERATE:
        existing_r = await db.execute(
            select(ProductVariant).where(ProductVariant.product_id == product_id, ProductVariant.variant_hash.is_not(None))
        )
        to_delete = list(existing_r.scalars().all())
        deleted_count = len(to_delete)
        for v in to_delete:
            await db.delete(v)
        await db.flush()
        existing_hashes: set[str] = set()
    else:
        existing_hashes = await _existing_variant_hashes(db, product_id)

    used_skus = await _existing_skus(db, product_id)
    base_code = product.material_code or _short_code(product.name, 6)

    created_variants: list[ProductVariant] = []
    skipped_existing = 0

    for selection in candidates:
        h = compute_variant_hash(str(product_id), selection)
        if h in excluded_set:
            continue
        if selected_set is not None and h not in selected_set:
            continue
        if h in existing_hashes:
            skipped_existing += 1
            continue

        sku = build_variant_sku(base_code, attribute_order, selection)
        sku = disambiguate_sku(sku, used_skus, h)
        used_skus.add(sku)

        attrs_human = {}
        for attr in attribute_order:
            val = selection.get(attr["name"])
            if val is None:
                continue
            opt = next((o for o in attr["options"] if o["name"] == val), None)
            attrs_human[attr["display_name"]] = opt["display_name"] if opt else val

        delta = price_delta_sum(attribute_order, selection)
        base_price = data.base_price if data.base_price is not None else float(product.price or 0)

        variant = ProductVariant(
            product_id=product_id,
            name=build_variant_label(attribute_order, selection) or sku,
            sku=sku,
            barcode=build_variant_barcode(h) if auto_barcode else None,
            uom=product.uom or "piece",
            price=base_price + delta,
            cost_price=product.cost_price,
            currency=data.currency,
            is_taxable=product.is_taxable if product.is_taxable is not None else True,
            tax_rate=product.tax_rate,
            hsn_code=product.hsn_code,
            gst_rate=product.gst_rate,
            attributes=attrs_human,
            config_selection=selection,
            variant_hash=h,
            search_keywords=build_search_keywords(product.name, attribute_order, selection, sku),
            is_active=True,
        )
        db.add(variant)
        existing_hashes.add(h)
        created_variants.append(variant)

    await db.commit()
    for v in created_variants:
        await db.refresh(v)

    return JSONResponse(content=VariantGenerateResponse(
        created_count=len(created_variants),
        skipped_existing_count=skipped_existing,
        deleted_count=deleted_count,
        created_variant_ids=[str(v.id) for v in created_variants],
    ).model_dump())


@router.delete("/{product_id}/config/variants/invalid", response_model=InvalidVariantsResponse)
async def delete_invalid_variants(
    product_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Remove auto-generated variants that no longer satisfy the current
    attributes/options/rules (e.g. after metadata was edited)."""
    await _get_owned_product(db, vendor_id, product_id)
    attribute_order, rule_dicts = await _load_context(db, vendor_id, product_id)

    result = await db.execute(
        select(ProductVariant).where(
            ProductVariant.product_id == product_id,
            ProductVariant.variant_hash.is_not(None),
            ProductVariant.config_selection.is_not(None),
        )
    )
    variants = list(result.scalars().all())

    deleted_ids = []
    for v in variants:
        if not is_selection_still_valid(v.config_selection or {}, attribute_order, rule_dicts):
            deleted_ids.append(str(v.id))
            await db.delete(v)

    await db.commit()
    return JSONResponse(content=InvalidVariantsResponse(
        deleted_count=len(deleted_ids), deleted_variant_ids=deleted_ids,
    ).model_dump())
