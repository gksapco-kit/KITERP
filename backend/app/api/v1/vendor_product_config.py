# app/api/v1/vendor_product_config.py
"""
Metadata-driven Product Configuration Engine API.

Mounted at /vendors/me/products/{product_id}/config/*
- attributes: unlimited-depth nested attribute tree (Voltage -> Phase -> Cooling -> ...)
- options: choices inside an attribute
- rules: visual IF/THEN rule engine (no SQL) + real-time evaluate endpoint

This module only defines configuration *metadata* — SKUs/variants are generated
elsewhere (Phase 2: variant generator) from the attributes/options/rules defined here.
"""
from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.deps import get_current_vendor_id
from app.models.vendor_product import Product
from app.models.product_config import ProductConfigAttribute, ProductConfigOption, ProductConfigRule
from app.schemas.product_config import (
    ConfigAttributeCreate, ConfigAttributeUpdate,
    ConfigOptionCreate, ConfigOptionUpdate,
    ConfigRuleCreate, ConfigRuleUpdate, RuleEvaluateRequest,
)
from app.repositories.product_config_repo import (
    ConfigAttributeRepository, ConfigOptionRepository, ConfigRuleRepository,
)
from app.services.rule_engine import evaluate_rules

router = APIRouter()


# ── Serializers ───────────────────────────────────────────────────

def _option_dict(o: ProductConfigOption) -> dict:
    return {
        "id": str(o.id),
        "attribute_id": str(o.attribute_id),
        "parent_option_id": str(o.parent_option_id) if o.parent_option_id else None,
        "name": o.name,
        "display_name": o.display_name,
        "image_url": o.image_url,
        "icon": o.icon,
        "color_code": o.color_code,
        "price_delta": float(o.price_delta or 0),
        "sort_order": o.sort_order,
        "labels_i18n": o.labels_i18n or {},
        "is_active": o.is_active,
        "created_at": o.created_at.isoformat() if o.created_at else None,
        "updated_at": o.updated_at.isoformat() if o.updated_at else None,
    }


def _attribute_dict(a: ProductConfigAttribute, options: Optional[list] = None) -> dict:
    return {
        "id": str(a.id),
        "product_id": str(a.product_id),
        "parent_attribute_id": str(a.parent_attribute_id) if a.parent_attribute_id else None,
        "name": a.name,
        "display_name": a.display_name,
        "description": a.description,
        "input_type": a.input_type,
        "display_order": a.display_order,
        "is_required": a.is_required,
        "is_multiple": a.is_multiple,
        "default_value": a.default_value,
        "visibility_rule": a.visibility_rule,
        "validation_rule": a.validation_rule,
        "labels_i18n": a.labels_i18n or {},
        "is_active": a.is_active,
        "version_number": a.version_number,
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "updated_at": a.updated_at.isoformat() if a.updated_at else None,
        "options": [_option_dict(o) for o in (options or [])],
    }


def _rule_dict(r: ProductConfigRule) -> dict:
    return {
        "id": str(r.id),
        "product_id": str(r.product_id),
        "name": r.name,
        "description": r.description,
        "priority": r.priority,
        "execution_mode": r.execution_mode,
        "conditions": r.conditions,
        "actions": r.actions or [],
        "is_active": r.is_active,
        "version_number": r.version_number,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
    }


def _build_attribute_tree(attributes: list[ProductConfigAttribute], options_by_attr: dict) -> list[dict]:
    """Nest attributes by parent_attribute_id -> unlimited depth."""
    nodes = {a.id: _attribute_dict(a, options_by_attr.get(a.id, [])) for a in attributes}
    for node in nodes.values():
        node["children"] = []
    roots = []
    for a in attributes:
        node = nodes[a.id]
        if a.parent_attribute_id and a.parent_attribute_id in nodes:
            nodes[a.parent_attribute_id]["children"].append(node)
        else:
            roots.append(node)
    return roots


async def _get_owned_product(db: AsyncSession, vendor_id: UUID, product_id: UUID) -> Product:
    product = await db.get(Product, product_id)
    if not product or product.vendor_id != vendor_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    return product


# ── Attributes (tree) ─────────────────────────────────────────────

@router.get("/{product_id}/config/attributes")
async def list_config_attributes(
    product_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    await _get_owned_product(db, vendor_id, product_id)
    attr_repo = ConfigAttributeRepository(db)
    attributes = await attr_repo.list_for_product(vendor_id, product_id)

    opt_repo = ConfigOptionRepository(db)
    options = await opt_repo.list_for_attributes([a.id for a in attributes])
    options_by_attr: dict = {}
    for o in options:
        options_by_attr.setdefault(o.attribute_id, []).append(o)

    tree = _build_attribute_tree(attributes, options_by_attr)
    return JSONResponse(content={"items": tree, "total_attributes": len(attributes), "total_options": len(options)})


@router.post("/{product_id}/config/attributes", status_code=201)
async def create_config_attribute(
    product_id: UUID,
    data: ConfigAttributeCreate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    await _get_owned_product(db, vendor_id, product_id)

    parent_id = None
    if data.parent_attribute_id:
        parent_id = UUID(data.parent_attribute_id)
        parent = await db.get(ProductConfigAttribute, parent_id)
        if not parent or parent.vendor_id != vendor_id or parent.product_id != product_id:
            raise HTTPException(404, "Parent attribute not found")

    attr = ProductConfigAttribute(
        vendor_id=vendor_id,
        product_id=product_id,
        parent_attribute_id=parent_id,
        name=data.name.strip(),
        display_name=data.display_name.strip(),
        description=data.description,
        input_type=data.input_type.value,
        display_order=data.display_order,
        is_required=data.is_required,
        is_multiple=data.is_multiple,
        default_value=data.default_value,
        visibility_rule=data.visibility_rule,
        validation_rule=data.validation_rule,
        labels_i18n=data.labels_i18n or {},
        is_active=data.is_active,
    )
    db.add(attr)
    await db.commit()
    await db.refresh(attr)
    return JSONResponse(content=_attribute_dict(attr, []), status_code=201)


@router.patch("/{product_id}/config/attributes/{attribute_id}")
async def update_config_attribute(
    product_id: UUID,
    attribute_id: UUID,
    data: ConfigAttributeUpdate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    attr = await db.get(ProductConfigAttribute, attribute_id)
    if not attr or attr.vendor_id != vendor_id or attr.product_id != product_id:
        raise HTTPException(404, "Attribute not found")

    if data.version_number is not None and data.version_number != attr.version_number:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "This attribute was changed by someone else — reload and try again.",
        )

    fields = data.model_dump(exclude_unset=True, exclude={"version_number", "parent_attribute_id"})
    if "input_type" in fields and fields["input_type"] is not None:
        fields["input_type"] = fields["input_type"].value if hasattr(fields["input_type"], "value") else fields["input_type"]
    for field, val in fields.items():
        setattr(attr, field, val)

    if data.parent_attribute_id is not None:
        if data.parent_attribute_id == "":
            attr.parent_attribute_id = None
        else:
            new_parent_id = UUID(data.parent_attribute_id)
            if new_parent_id == attr.id:
                raise HTTPException(400, "An attribute cannot depend on itself")
            attr.parent_attribute_id = new_parent_id

    attr.version_number = (attr.version_number or 1) + 1
    await db.commit()
    await db.refresh(attr)

    opt_repo = ConfigOptionRepository(db)
    options = await opt_repo.list_for_attributes([attr.id])
    return JSONResponse(content=_attribute_dict(attr, options))


@router.delete("/{product_id}/config/attributes/{attribute_id}", status_code=204)
async def delete_config_attribute(
    product_id: UUID,
    attribute_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    attr = await db.get(ProductConfigAttribute, attribute_id)
    if not attr or attr.vendor_id != vendor_id or attr.product_id != product_id:
        raise HTTPException(404, "Attribute not found")
    await db.delete(attr)  # cascades to children + options
    await db.commit()


# ── Options ───────────────────────────────────────────────────────

@router.post("/{product_id}/config/attributes/{attribute_id}/options", status_code=201)
async def create_config_option(
    product_id: UUID,
    attribute_id: UUID,
    data: ConfigOptionCreate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    attr = await db.get(ProductConfigAttribute, attribute_id)
    if not attr or attr.vendor_id != vendor_id or attr.product_id != product_id:
        raise HTTPException(404, "Attribute not found")

    parent_option_id = UUID(data.parent_option_id) if data.parent_option_id else None
    option = ProductConfigOption(
        vendor_id=vendor_id,
        attribute_id=attribute_id,
        parent_option_id=parent_option_id,
        name=data.name.strip(),
        display_name=data.display_name.strip(),
        image_url=data.image_url,
        icon=data.icon,
        color_code=data.color_code,
        price_delta=data.price_delta,
        sort_order=data.sort_order,
        labels_i18n=data.labels_i18n or {},
        is_active=data.is_active,
    )
    db.add(option)
    await db.commit()
    await db.refresh(option)
    return JSONResponse(content=_option_dict(option), status_code=201)


@router.patch("/{product_id}/config/options/{option_id}")
async def update_config_option(
    product_id: UUID,
    option_id: UUID,
    data: ConfigOptionUpdate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    option = await db.get(ProductConfigOption, option_id)
    if not option or option.vendor_id != vendor_id:
        raise HTTPException(404, "Option not found")

    fields = data.model_dump(exclude_unset=True, exclude={"parent_option_id"})
    for field, val in fields.items():
        setattr(option, field, val)
    if data.parent_option_id is not None:
        option.parent_option_id = UUID(data.parent_option_id) if data.parent_option_id else None

    await db.commit()
    await db.refresh(option)
    return JSONResponse(content=_option_dict(option))


@router.delete("/{product_id}/config/options/{option_id}", status_code=204)
async def delete_config_option(
    product_id: UUID,
    option_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    option = await db.get(ProductConfigOption, option_id)
    if not option or option.vendor_id != vendor_id:
        raise HTTPException(404, "Option not found")
    await db.delete(option)
    await db.commit()


# ── Rules (visual IF/THEN engine) ─────────────────────────────────

@router.get("/{product_id}/config/rules")
async def list_config_rules(
    product_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    await _get_owned_product(db, vendor_id, product_id)
    rule_repo = ConfigRuleRepository(db)
    rules = await rule_repo.list_for_product(vendor_id, product_id)
    return JSONResponse(content={"items": [_rule_dict(r) for r in rules]})


@router.post("/{product_id}/config/rules", status_code=201)
async def create_config_rule(
    product_id: UUID,
    data: ConfigRuleCreate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    await _get_owned_product(db, vendor_id, product_id)
    rule = ProductConfigRule(
        vendor_id=vendor_id,
        product_id=product_id,
        name=data.name.strip(),
        description=data.description,
        priority=data.priority,
        execution_mode=data.execution_mode.value,
        conditions=data.conditions,
        actions=data.actions,
        is_active=data.is_active,
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return JSONResponse(content=_rule_dict(rule), status_code=201)


@router.patch("/{product_id}/config/rules/{rule_id}")
async def update_config_rule(
    product_id: UUID,
    rule_id: UUID,
    data: ConfigRuleUpdate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    rule = await db.get(ProductConfigRule, rule_id)
    if not rule or rule.vendor_id != vendor_id or rule.product_id != product_id:
        raise HTTPException(404, "Rule not found")

    if data.version_number is not None and data.version_number != rule.version_number:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "This rule was changed by someone else — reload and try again.",
        )

    fields = data.model_dump(exclude_unset=True, exclude={"version_number"})
    if "execution_mode" in fields and fields["execution_mode"] is not None:
        fields["execution_mode"] = fields["execution_mode"].value if hasattr(fields["execution_mode"], "value") else fields["execution_mode"]
    for field, val in fields.items():
        setattr(rule, field, val)

    rule.version_number = (rule.version_number or 1) + 1
    await db.commit()
    await db.refresh(rule)
    return JSONResponse(content=_rule_dict(rule))


@router.delete("/{product_id}/config/rules/{rule_id}", status_code=204)
async def delete_config_rule(
    product_id: UUID,
    rule_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    rule = await db.get(ProductConfigRule, rule_id)
    if not rule or rule.vendor_id != vendor_id or rule.product_id != product_id:
        raise HTTPException(404, "Rule not found")
    await db.delete(rule)
    await db.commit()


@router.post("/{product_id}/config/rules/evaluate")
async def evaluate_config_rules(
    product_id: UUID,
    data: RuleEvaluateRequest,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Server-side re-validation of a configuration selection against every active rule.
    The frontend runs the same logic instantly via lib/ruleEngine.ts for live UX;
    this endpoint is the source of truth before a save/variant-generation is accepted."""
    await _get_owned_product(db, vendor_id, product_id)
    rule_repo = ConfigRuleRepository(db)
    rules = await rule_repo.list_for_product(vendor_id, product_id, active_only=True)
    result = evaluate_rules([_rule_dict(r) for r in rules], data.selection)
    return JSONResponse(content=result.to_dict())
