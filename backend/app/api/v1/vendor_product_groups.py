# app/api/v1/vendor_product_groups.py
import re
from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.api.deps import get_current_vendor_id
from app.models.product_group import ProductGroup, ProductGroupItem, MAX_HIERARCHY_DEPTH
from app.models.vendor_product import Product
from app.models.vendor_service import Service
from app.schemas.product_group import (
    ProductGroupCreate, ProductGroupUpdate, ProductGroupReparent,
    ProductGroupItemsAdd, ProductGroupItemUpdate,
)
from app.repositories.product_group_repo import ProductGroupRepository

router = APIRouter()


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def _slugify(name: str) -> str:
    slug = name.lower().strip()
    slug = re.sub(r"[^a-z0-9\s-]", "", slug)
    slug = re.sub(r"[\s]+", "-", slug)
    return re.sub(r"-+", "-", slug).strip("-")


def _group_to_dict(g: ProductGroup, item_count: Optional[int] = None, include_children: bool = False) -> dict:
    d = {
        "id": str(g.id),
        "vendor_id": str(g.vendor_id),
        "parent_id": str(g.parent_id) if g.parent_id else None,
        "code": g.code,
        "level": g.level or 0,
        "path": g.path or "",
        "name": g.name,
        "slug": g.slug,
        "description": g.description,
        "image_url": g.image_url,
        "group_types": g.group_types or ["general"],
        "is_active": g.is_active,
        "sort_order": g.sort_order or 0,
        "discount_type": g.discount_type or "none",
        "discount_value": float(g.discount_value or 0),
        "bundle_price": float(g.bundle_price) if g.bundle_price is not None else None,
        "bundle_discount_type": g.bundle_discount_type or "none",
        "bundle_discount_value": float(g.bundle_discount_value or 0),
        "item_count": item_count if item_count is not None else len(g.items or []),
        "created_at": g.created_at.isoformat() if g.created_at else None,
        "updated_at": g.updated_at.isoformat() if g.updated_at else None,
    }
    if include_children:
        d["children"] = []
    return d


def _tree_node_to_dict(node: dict, counts: dict) -> dict:
    """Recursively convert a tree node (from _build_tree) to a serializable dict."""
    g: ProductGroup = node["_model"]
    d = _group_to_dict(g, item_count=counts.get(g.id, 0), include_children=True)
    d["children"] = [_tree_node_to_dict(child, counts) for child in node["children"]]
    return d


def _item_to_dict(item: ProductGroupItem) -> dict:
    d = {
        "id": str(item.id),
        "group_id": str(item.group_id),
        "item_type": item.item_type,
        "quantity": float(item.quantity or 1),
        "sort_order": item.sort_order or 0,
        "created_at": item.created_at.isoformat() if item.created_at else None,
    }
    if item.item_type == "product" and item.product:
        p = item.product
        primary = next((i for i in (p.images or []) if i.is_primary), (p.images or [None])[0] if p.images else None)
        d.update({
            "item_id": str(p.id),
            "name": p.name,
            "sku": p.material_code,
            "price": float(p.price or 0),
            "image_url": primary.url if primary else None,
            "status": p.status,
        })
    elif item.item_type == "service" and item.service:
        s = item.service
        d.update({
            "item_id": str(s.id),
            "name": s.name,
            "sku": s.material_code,
            "price": float(s.price or 0),
            "image_url": s.image_url,
            "status": s.status,
        })
    else:
        d.update({"item_id": None, "name": "(deleted item)", "sku": None, "price": 0, "image_url": None, "status": None})
    return d


async def _resolve_parent(
    repo: ProductGroupRepository,
    vendor_id: UUID,
    parent_id_str: Optional[str],
) -> tuple[Optional[ProductGroup], int, str]:
    """
    Look up the parent group and return (parent, child_level, child_path_prefix).
    Returns (None, 0, "") if parent_id_str is None (root node).
    Raises HTTPException on not-found or depth exceeded.
    """
    if not parent_id_str:
        return None, 0, ""
    try:
        pid = UUID(parent_id_str)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid parent_id format")
    parent = await repo.get_by_vendor_and_id(vendor_id, pid)
    if not parent:
        raise HTTPException(status_code=400, detail="Parent product group not found")
    child_level = (parent.level or 0) + 1
    if child_level >= MAX_HIERARCHY_DEPTH:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum hierarchy depth ({MAX_HIERARCHY_DEPTH}) exceeded",
        )
    return parent, child_level, parent.path or parent.slug


def _compute_effective_pricing(group: ProductGroup, ancestors: list) -> dict:
    """Walk from group → root and return the first non-'none' discount (most-specific wins)."""
    for node in [group] + list(reversed(ancestors)):
        if node.discount_type and node.discount_type != "none":
            return {
                "source_id": str(node.id),
                "source_name": node.name,
                "discount_type": node.discount_type,
                "discount_value": float(node.discount_value or 0),
                "inherited": node.id != group.id,
            }
    return {"source_id": None, "source_name": None, "discount_type": "none", "discount_value": 0, "inherited": False}


# ──────────────────────────────────────────────────────────────────────────────
# List endpoints
# ──────────────────────────────────────────────────────────────────────────────

@router.get("")
async def list_product_groups(
    tree: bool = Query(False, description="Return nested tree instead of flat list"),
    group_type: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    parent_id: Optional[str] = Query(None, description="Filter children of a specific parent (flat mode only)"),
    root_only: bool = Query(False, description="Only return root-level groups (flat mode only)"),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = ProductGroupRepository(db)
    if tree:
        nodes = await repo.get_tree(vendor_id, group_type=group_type, is_active=is_active, search=search)
        all_flat = await repo.list_all_flat(vendor_id, group_type=group_type, is_active=is_active, search=search)
        counts = await repo.item_counts([g.id for g in all_flat])
        return JSONResponse(content={"groups": [_tree_node_to_dict(n, counts) for n in nodes]})
    else:
        groups = await repo.list_all_flat(
            vendor_id,
            group_type=group_type,
            is_active=is_active,
            search=search,
            parent_id=parent_id,
            root_only=root_only,
        )
        counts = await repo.item_counts([g.id for g in groups])
        return JSONResponse(content={"groups": [_group_to_dict(g, item_count=counts.get(g.id, 0)) for g in groups]})


@router.get("/flat-options")
async def list_flat_options(
    exclude_id: Optional[str] = Query(None, description="Exclude this group and its descendants (for parent picker)"),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Returns a flat list of all groups with indent level — for parent picker dropdowns."""
    repo = ProductGroupRepository(db)
    all_groups = await repo.list_all_flat(vendor_id)

    excluded_ids: set[str] = set()
    if exclude_id:
        excluded_ids.add(exclude_id)
        # Also exclude all descendants so users can't create cycles
        try:
            exc_uuid = UUID(exclude_id)
            descendants = await repo.get_descendants(vendor_id, exc_uuid)
            excluded_ids.update(str(d.id) for d in descendants)
        except (ValueError, TypeError):
            pass

    options = []
    for g in all_groups:
        if str(g.id) in excluded_ids:
            continue
        options.append({
            "id": str(g.id),
            "name": g.name,
            "code": g.code,
            "level": g.level or 0,
            "label": ("  " * (g.level or 0)) + g.name,
        })
    return JSONResponse(content={"options": options})


# ──────────────────────────────────────────────────────────────────────────────
# Single group
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/{group_id}")
async def get_product_group(
    group_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = ProductGroupRepository(db)
    group = await repo.get_by_vendor_and_id(vendor_id, group_id, with_items=True)
    if not group:
        raise HTTPException(status_code=404, detail="Product group not found")

    # Eager-load product images (not available on the basic with_items load)
    result = await db.execute(
        select(ProductGroupItem)
        .where(ProductGroupItem.group_id == group_id)
        .options(
            selectinload(ProductGroupItem.product).selectinload(Product.images),
            selectinload(ProductGroupItem.service),
        )
        .order_by(ProductGroupItem.sort_order)
    )
    items = list(result.scalars().all())

    # Direct children
    children_list = await repo.list_all_flat(vendor_id, parent_id=str(group_id))
    children_counts = await repo.item_counts([c.id for c in children_list])

    # Ancestors (breadcrumb)
    ancestors = await repo.get_ancestors(vendor_id, group_id)
    effective_pricing = _compute_effective_pricing(group, ancestors)

    d = _group_to_dict(group, item_count=len(items))
    d["items"] = [_item_to_dict(i) for i in items]
    d["children"] = [_group_to_dict(c, item_count=children_counts.get(c.id, 0)) for c in children_list]
    d["ancestors"] = [{"id": str(a.id), "name": a.name, "slug": a.slug} for a in ancestors]
    d["effective_pricing"] = effective_pricing
    return JSONResponse(content=d)


# ──────────────────────────────────────────────────────────────────────────────
# Create / Update / Delete
# ──────────────────────────────────────────────────────────────────────────────

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_product_group(
    data: ProductGroupCreate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = ProductGroupRepository(db)
    slug = _slugify(data.name)

    existing = await repo.get_by_vendor_and_slug(vendor_id, slug)
    if existing:
        raise HTTPException(status_code=400, detail="A product group with this name already exists")

    parent, level, parent_path = await _resolve_parent(repo, vendor_id, data.parent_id)
    path = f"{parent_path}/{slug}" if parent_path else slug

    group = ProductGroup(
        vendor_id=vendor_id,
        parent_id=parent.id if parent else None,
        code=data.code,
        level=level,
        path=path,
        name=data.name,
        slug=slug,
        description=data.description,
        image_url=data.image_url,
        group_types=data.group_types or ["general"],
        sort_order=data.sort_order,
        is_active=data.is_active,
        discount_type=data.discount_type,
        discount_value=data.discount_value,
        bundle_price=data.bundle_price,
        bundle_discount_type=data.bundle_discount_type,
        bundle_discount_value=data.bundle_discount_value,
    )
    db.add(group)
    await db.commit()
    await db.refresh(group)
    return JSONResponse(content=_group_to_dict(group, item_count=0), status_code=201)


@router.put("/{group_id}")
async def update_product_group(
    group_id: UUID,
    data: ProductGroupUpdate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = ProductGroupRepository(db)
    group = await repo.get_by_vendor_and_id(vendor_id, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Product group not found")

    if data.name is not None:
        new_slug = _slugify(data.name)
        dup = await repo.get_by_vendor_and_slug(vendor_id, new_slug)
        if dup and dup.id != group.id:
            raise HTTPException(status_code=400, detail="A product group with this name already exists")
        group.name = data.name
        group.slug = new_slug
        # Recompute path after slug change
        parent_path = ""
        if group.parent_id:
            parent_obj = await repo.get_by_vendor_and_id(vendor_id, group.parent_id)
            parent_path = parent_obj.path if parent_obj else ""
        group.path = f"{parent_path}/{new_slug}" if parent_path else new_slug
        # Cascade path update to all descendants
        await repo.recompute_path_recursive(vendor_id, group.id, group.path, group.level or 0)

    if data.description is not None:
        group.description = data.description
    if "image_url" in data.model_fields_set:
        group.image_url = data.image_url or None
    if data.code is not None:
        group.code = data.code
    if data.group_types is not None:
        group.group_types = data.group_types
    if data.sort_order is not None:
        group.sort_order = data.sort_order
    if data.is_active is not None:
        group.is_active = data.is_active
    if data.discount_type is not None:
        group.discount_type = data.discount_type
    if data.discount_value is not None:
        group.discount_value = data.discount_value
    if "bundle_price" in data.model_fields_set:
        group.bundle_price = data.bundle_price
    if data.bundle_discount_type is not None:
        group.bundle_discount_type = data.bundle_discount_type
    if data.bundle_discount_value is not None:
        group.bundle_discount_value = data.bundle_discount_value

    # Handle inline reparent (parent_id in the update payload)
    if "parent_id" in data.model_fields_set:
        await _do_reparent(repo, db, vendor_id, group, data.parent_id)

    await db.commit()
    await db.refresh(group)
    counts = await repo.item_counts([group.id])
    return JSONResponse(content=_group_to_dict(group, item_count=counts.get(group.id, 0)))


@router.patch("/{group_id}/reparent")
async def reparent_product_group(
    group_id: UUID,
    data: ProductGroupReparent,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Move a group to a new parent (or to root). Used by drag-drop in the tree UI."""
    repo = ProductGroupRepository(db)
    group = await repo.get_by_vendor_and_id(vendor_id, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Product group not found")

    await _do_reparent(repo, db, vendor_id, group, data.parent_id)
    await db.commit()
    await db.refresh(group)
    return JSONResponse(content=_group_to_dict(group))


async def _do_reparent(
    repo: ProductGroupRepository,
    db: AsyncSession,
    vendor_id: UUID,
    group: ProductGroup,
    new_parent_id_str: Optional[str],
) -> None:
    """Shared logic for changing a group's parent. Handles cycle detection and path recomputation."""
    if new_parent_id_str:
        try:
            new_parent_uuid = UUID(new_parent_id_str)
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="Invalid parent_id format")

        if new_parent_uuid == group.id:
            raise HTTPException(status_code=400, detail="A group cannot be its own parent")

        # Cycle guard: reject if new parent is a descendant of this group
        if await repo.is_ancestor_of(vendor_id, group.id, new_parent_uuid):
            raise HTTPException(status_code=400, detail="Cannot reparent: target is a descendant of this group")

        new_parent = await repo.get_by_vendor_and_id(vendor_id, new_parent_uuid)
        if not new_parent:
            raise HTTPException(status_code=400, detail="Parent product group not found")

        new_level = (new_parent.level or 0) + 1
        if new_level >= MAX_HIERARCHY_DEPTH:
            raise HTTPException(
                status_code=400,
                detail=f"Maximum hierarchy depth ({MAX_HIERARCHY_DEPTH}) exceeded",
            )
        group.parent_id = new_parent_uuid
        group.level = new_level
        parent_path = new_parent.path or new_parent.slug
        group.path = f"{parent_path}/{group.slug}"
    else:
        group.parent_id = None
        group.level = 0
        group.path = group.slug

    await repo.recompute_path_recursive(vendor_id, group.id, group.path, group.level)


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product_group(
    group_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = ProductGroupRepository(db)
    group = await repo.get_by_vendor_and_id(vendor_id, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Product group not found")

    if await repo.has_children(group_id):
        raise HTTPException(
            status_code=400,
            detail="Cannot delete: this group has sub-groups. Move or delete the sub-groups first.",
        )

    await db.delete(group)
    await db.commit()


# ──────────────────────────────────────────────────────────────────────────────
# Items
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/{group_id}/items")
async def add_product_group_items(
    group_id: UUID,
    data: ProductGroupItemsAdd,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = ProductGroupRepository(db)
    group = await repo.get_by_vendor_and_id(vendor_id, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Product group not found")

    existing_keys = await repo.get_existing_member_keys(group_id)
    added, skipped, not_found = 0, 0, []

    for entry in data.items:
        try:
            item_uuid = UUID(entry.item_id)
        except (ValueError, TypeError):
            not_found.append(entry.item_id)
            continue

        if (entry.item_type, item_uuid) in existing_keys:
            skipped += 1
            continue

        if entry.item_type == "product":
            result = await db.execute(
                select(Product.id).where(Product.id == item_uuid, Product.vendor_id == vendor_id)
            )
            if not result.scalar_one_or_none():
                not_found.append(entry.item_id)
                continue
            db.add(ProductGroupItem(
                group_id=group_id, item_type="product", product_id=item_uuid, quantity=entry.quantity,
            ))
        else:
            result = await db.execute(
                select(Service.id).where(Service.id == item_uuid, Service.vendor_id == vendor_id)
            )
            if not result.scalar_one_or_none():
                not_found.append(entry.item_id)
                continue
            db.add(ProductGroupItem(
                group_id=group_id, item_type="service", service_id=item_uuid, quantity=entry.quantity,
            ))

        existing_keys.add((entry.item_type, item_uuid))
        added += 1

    await db.commit()
    return JSONResponse(content={"added": added, "skipped": skipped, "not_found": not_found})


@router.put("/{group_id}/items/{item_id}")
async def update_product_group_item(
    group_id: UUID,
    item_id: UUID,
    data: ProductGroupItemUpdate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = ProductGroupRepository(db)
    group = await repo.get_by_vendor_and_id(vendor_id, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Product group not found")

    item = await repo.get_item(group_id, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found in this group")

    if data.quantity is not None:
        item.quantity = data.quantity
    if data.sort_order is not None:
        item.sort_order = data.sort_order

    await db.commit()
    return JSONResponse(content={"ok": True})


@router.delete("/{group_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_product_group_item(
    group_id: UUID,
    item_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = ProductGroupRepository(db)
    group = await repo.get_by_vendor_and_id(vendor_id, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Product group not found")

    item = await repo.get_item(group_id, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found in this group")

    await db.delete(item)
    await db.commit()
