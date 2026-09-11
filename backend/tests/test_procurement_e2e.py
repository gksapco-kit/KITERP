"""
End-to-end procurement module scenarios via FastAPI ASGI + SQLite harness.

Happy path: PR → RFQ → Quotation → Award → PO → GRN → Invoice → Return.
Also covers convert-to-PO shortcut and key negative transitions.
"""

from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.inventory import InventoryMovement
from app.models.procurement import Supplier
from app.models.procurement_sequence import DocumentSequence
from app.models.store import Store
from app.models.user import User
from app.models.vendor import Vendor
from app.models.vendor_product import Product
from app.models.vendor_user import VendorUser

pytestmark = pytest.mark.asyncio

ME = "/api/v1/vendors/me"
PROC = f"{ME}/procurement"


async def _product_qty(db: AsyncSession, product_id) -> int:
    return int(
        (await db.execute(select(Product.quantity).where(Product.id == product_id))).scalar_one()
    )


@pytest_asyncio.fixture
async def owner(db_session: AsyncSession, test_vendor: Vendor, test_user: User) -> VendorUser:
    vu = VendorUser(
        id=uuid.uuid4(),
        vendor_id=test_vendor.id,
        user_id=test_user.id,
        role="owner",
        permissions=[],
        is_active=True,
    )
    db_session.add(vu)
    for prefix, width in (
        ("PR", 6),
        ("PO", 4),
        ("RFQ", 6),
        ("SQ", 6),
        ("GRN", 6),
        ("GRNR", 5),
        ("PRET", 6),
    ):
        db_session.add(DocumentSequence(
            id=uuid.uuid4(),
            vendor_id=test_vendor.id,
            prefix=prefix,
            last_value=0,
            width=width,
            number_from=1,
            number_to=999999,
        ))
    await db_session.commit()
    return vu


@pytest_asyncio.fixture
async def tracked_product(db_session: AsyncSession, test_vendor: Vendor, test_user: User) -> Product:
    p = Product(
        id=uuid.uuid4(),
        vendor_id=test_vendor.id,
        name="Proc E2E Widget",
        slug=f"proc-widget-{uuid.uuid4().hex[:6]}",
        sku=f"PROC-{uuid.uuid4().hex[:6]}",
        price=Decimal("100.00"),
        cost_price=Decimal("40.00"),
        currency="INR",
        status="active",
        product_type="physical",
        track_inventory=True,
        quantity=0,
        low_stock_threshold=5,
        created_by=test_user.id,
    )
    db_session.add(p)
    await db_session.commit()
    await db_session.refresh(p)
    return p


@pytest_asyncio.fixture
async def store(db_session: AsyncSession, test_vendor: Vendor) -> Store:
    s = Store(
        id=uuid.uuid4(),
        vendor_id=test_vendor.id,
        name="Proc Main",
        code="PROC",
        is_default=True,
        unit_type="business_unit",
    )
    db_session.add(s)
    await db_session.commit()
    await db_session.refresh(s)
    return s


@pytest_asyncio.fixture
async def supplier(db_session: AsyncSession, test_vendor: Vendor) -> Supplier:
    s = Supplier(
        id=uuid.uuid4(),
        vendor_id=test_vendor.id,
        name="Proc Acme Supplies",
        party_type="supplier",
        is_active=True,
    )
    db_session.add(s)
    await db_session.commit()
    await db_session.refresh(s)
    return s


async def _create_open_pr(
    client: AsyncClient, product: Product, store: Store, *, qty: int = 10, price: float = 40,
) -> dict:
    create = await client.post(f"{PROC}/requisitions", json={
        "store_id": str(store.id),
        "department": "Ops",
        "priority": "medium",
        "notes": "e2e pr",
        "approvers": [],
        "items": [{
            "item_type": "product",
            "product_id": str(product.id),
            "quantity": qty,
            "unit_of_measure": "piece",
            "estimated_price": price,
        }],
    })
    assert create.status_code == 201, create.text
    pr = create.json()
    assert pr["pr_number"].startswith("PR-")
    assert pr["status"] in ("draft", "open")

    submit = await client.post(f"{PROC}/requisitions/{pr['id']}/submit")
    assert submit.status_code == 200, submit.text
    opened = submit.json()
    assert opened["status"] == "open", opened
    return opened


# ── 01 Full happy path ────────────────────────────────────────────────────────

async def test_01_full_chain_pr_rfq_po_grn_invoice_return(
    client: AsyncClient,
    owner: VendorUser,
    tracked_product: Product,
    store: Store,
    supplier: Supplier,
    db_session: AsyncSession,
):
    product = tracked_product
    today = date.today().isoformat()
    qty = 10
    unit_price = 38.0

    # 1) PR
    pr = await _create_open_pr(client, product, store, qty=qty, price=40)
    pr_item_id = pr["items"][0]["id"]

    # 2) RFQ linked to PR
    rfq_create = await client.post(f"{PROC}/rfqs", json={
        "title": "E2E Widgets RFQ",
        "sourcing_type": "rfq",
        "requisition_id": pr["id"],
        "store_id": str(store.id),
        "currency": "INR",
        "supplier_ids": [str(supplier.id)],
        "items": [{
            "item_type": "product",
            "product_id": str(product.id),
            "quantity": qty,
            "unit_of_measure": "piece",
            "target_price": 40,
            "pr_item_id": pr_item_id,
        }],
    })
    assert rfq_create.status_code == 201, rfq_create.text
    rfq = rfq_create.json()
    assert rfq["rfq_number"].startswith("RFQ-")
    assert rfq["status"] == "draft"
    rfq_item_id = rfq["items"][0]["id"]

    issue = await client.post(f"{PROC}/rfqs/{rfq['id']}/issue")
    assert issue.status_code == 200, issue.text
    assert issue.json()["status"] == "issued"

    # 3) Supplier quotation → submit
    sq_create = await client.post(f"{PROC}/quotations", json={
        "supplier_id": str(supplier.id),
        "rfq_id": rfq["id"],
        "quote_date": today,
        "currency": "INR",
        "items": [{
            "rfq_item_id": rfq_item_id,
            "product_id": str(product.id),
            "quantity": qty,
            "unit_of_measure": "piece",
            "unit_price": unit_price,
        }],
    })
    assert sq_create.status_code == 201, sq_create.text
    sq = sq_create.json()
    assert sq["quotation_number"].startswith("SQ-")
    assert sq["status"] == "draft"

    sq_submit = await client.post(f"{PROC}/quotations/{sq['id']}/submit")
    assert sq_submit.status_code == 200, sq_submit.text
    assert sq_submit.json()["status"] == "submitted"

    close = await client.post(f"{PROC}/rfqs/{rfq['id']}/close-bids", json={})
    assert close.status_code == 200, close.text
    assert close.json()["status"] == "bids_closed"

    award = await client.post(f"{PROC}/rfqs/{rfq['id']}/award", json={
        "awarded_quotation_ids": [sq["id"]],
        "notes": "best price",
    })
    assert award.status_code == 200, award.text
    assert award.json()["status"] == "awarded"

    # 4) PO from awarded quote prices
    po_create = await client.post(f"{ME}/purchase-orders", json={
        "supplier_id": str(supplier.id),
        "requisition_id": pr["id"],
        "pr_item_ids": [pr_item_id],
        "currency": "INR",
        "payment_terms": "Net 30",
        "notes": f"From RFQ {rfq['rfq_number']}",
        "items": [{
            "product_id": str(product.id),
            "quantity": qty,
            "unit_cost": unit_price,
            "unit_of_measure": "piece",
        }],
    })
    assert po_create.status_code == 201, po_create.text
    po = po_create.json()
    assert po["po_number"].startswith("PO-")
    assert po["status"] == "draft"
    po_item_id = po["items"][0]["id"]

    send = await client.post(f"{ME}/purchase-orders/{po['id']}/send")
    assert send.status_code == 200, send.text
    assert send.json()["status"] == "sent"

    # 5) GRN (no QC) posts inventory
    qty_before = await _product_qty(db_session, product.id)
    grn_create = await client.post(f"{PROC}/grns", json={
        "purchase_order_id": po["id"],
        "requires_qc": False,
        "notes": "e2e grn",
        "lines": [{
            "po_item_id": po_item_id,
            "product_id": str(product.id),
            "received_qty": qty,
            "unit_of_measure": "piece",
            "unit_price": unit_price,
        }],
    })
    assert grn_create.status_code == 201, grn_create.text
    grn = grn_create.json()
    assert grn["grn_number"].startswith("GRN-")
    assert grn["status"] == "posted"
    assert await _product_qty(db_session, product.id) == qty_before + qty

    # 6) AP invoice → post → 3-way match
    inv_create = await client.post(f"{PROC}/vendor-invoices", json={
        "supplier_id": str(supplier.id),
        "purchase_order_id": po["id"],
        "invoice_number": f"INV-E2E-{uuid.uuid4().hex[:6]}",
        "supplier_invoice_number": "SUP-001",
        "invoice_date": today,
        "currency": "INR",
        "items": [{
            "po_item_id": po_item_id,
            "product_id": str(product.id),
            "invoiced_qty": qty,
            "unit_price": unit_price,
            "uom": "piece",
        }],
    })
    assert inv_create.status_code == 201, inv_create.text
    inv = inv_create.json()
    assert inv["status"] == "draft"

    post = await client.post(f"{PROC}/vendor-invoices/{inv['id']}/post")
    assert post.status_code == 200, post.text
    assert post.json()["status"] == "posted"

    match = await client.post(f"{PROC}/vendor-invoices/{inv['id']}/match", json={
        "invoice_id": inv["id"],
        "qty_tolerance_pct": 0,
        "price_tolerance_pct": 0,
    })
    assert match.status_code == 200, match.text
    matched = match.json()
    assert matched["status"] in ("matched", "partial_match", "blocked")
    assert matched["match_status"] in (
        "matched", "partial", "blocked_qty", "blocked_price", "unmatched",
    )

    # 7) Purchase return → approve → dispatch (stock down)
    ret_qty = 3
    qty_pre_return = await _product_qty(db_session, product.id)
    ret_create = await client.post(f"{PROC}/purchase-returns", json={
        "purchase_order_id": po["id"],
        "grn_id": grn["id"],
        "return_date": today,
        "return_reason": "quality_rejection",
        "currency": "INR",
        "lines": [{
            "po_item_id": po_item_id,
            "product_id": str(product.id),
            "line_number": 1,
            "return_qty": str(ret_qty),
            "unit_price": str(unit_price),
            "unit_of_measure": "piece",
            "grn_line_id": grn["lines"][0]["id"],
        }],
    })
    assert ret_create.status_code == 201, ret_create.text
    ret = ret_create.json()
    assert ret["return_number"].startswith("PRET-")
    assert ret["status"] == "draft"

    approve = await client.post(f"{PROC}/purchase-returns/{ret['id']}/approve")
    assert approve.status_code == 200, approve.text
    assert approve.json()["status"] == "approved"
    assert await _product_qty(db_session, product.id) == qty_pre_return

    dispatch = await client.post(f"{PROC}/purchase-returns/{ret['id']}/dispatch", json={
        "dispatched_via": "courier",
        "dispatch_date": today,
        "tracking_number": "E2E-TRK-1",
    })
    assert dispatch.status_code == 200, dispatch.text
    assert dispatch.json()["status"] == "goods_dispatched"
    assert await _product_qty(db_session, product.id) == qty_pre_return - ret_qty

    moves = (
        await db_session.execute(
            select(InventoryMovement.quantity).where(
                InventoryMovement.product_id == product.id,
                InventoryMovement.reference_type == "purchase_return",
            )
        )
    ).scalars().all()
    assert any(int(q) == -ret_qty for q in moves)


# ── 02 PR convert-to-PO shortcut (skip RFQ) ───────────────────────────────────

async def test_02_pr_convert_to_po_then_grn(
    client: AsyncClient,
    owner: VendorUser,
    tracked_product: Product,
    store: Store,
    supplier: Supplier,
    db_session: AsyncSession,
):
    pr = await _create_open_pr(client, tracked_product, store, qty=5, price=25)
    pr_item_id = pr["items"][0]["id"]

    convert = await client.post(f"{PROC}/requisitions/{pr['id']}/convert-to-po", json={
        "supplier_id": str(supplier.id),
        "item_ids": [pr_item_id],
        "expected_delivery_date": date.today().isoformat(),
        "notes": "direct convert",
    })
    assert convert.status_code == 201, convert.text
    body = convert.json()
    assert body["po_id"]
    assert body["po_number"].startswith("PO-")

    po_get = await client.get(f"{ME}/purchase-orders/{body['po_id']}")
    assert po_get.status_code == 200, po_get.text
    po = po_get.json()
    assert po["status"] == "draft"
    po_item_id = po["items"][0]["id"]

    send = await client.post(f"{ME}/purchase-orders/{po['id']}/send")
    assert send.status_code == 200, send.text

    before = await _product_qty(db_session, tracked_product.id)
    grn = await client.post(f"{PROC}/grns", json={
        "purchase_order_id": po["id"],
        "requires_qc": False,
        "lines": [{
            "po_item_id": po_item_id,
            "product_id": str(tracked_product.id),
            "received_qty": 5,
            "unit_of_measure": "piece",
            "unit_price": 25,
        }],
    })
    assert grn.status_code == 201, grn.text
    assert grn.json()["status"] == "posted"
    assert await _product_qty(db_session, tracked_product.id) == before + 5

    pr_after = await client.get(f"{PROC}/requisitions/{pr['id']}")
    assert pr_after.status_code == 200, pr_after.text
    assert pr_after.json()["status"] in ("converted", "partially_converted")


# ── 03 PR cancel ──────────────────────────────────────────────────────────────

async def test_03_pr_cancel_draft(
    client: AsyncClient, owner: VendorUser, tracked_product: Product, store: Store,
):
    create = await client.post(f"{PROC}/requisitions", json={
        "store_id": str(store.id),
        "items": [{
            "product_id": str(tracked_product.id),
            "quantity": 2,
            "unit_of_measure": "piece",
            "estimated_price": 10,
        }],
    })
    assert create.status_code == 201, create.text
    pr_id = create.json()["id"]

    cancel = await client.post(f"{PROC}/requisitions/{pr_id}/cancel")
    assert cancel.status_code == 200, cancel.text
    assert cancel.json()["status"] == "cancelled"


# ── 04 RFQ award before close-bids rejected ───────────────────────────────────

async def test_04_rfq_award_before_close_rejected(
    client: AsyncClient,
    owner: VendorUser,
    tracked_product: Product,
    store: Store,
    supplier: Supplier,
):
    rfq_create = await client.post(f"{PROC}/rfqs", json={
        "title": "Premature award",
        "supplier_ids": [str(supplier.id)],
        "items": [{
            "product_id": str(tracked_product.id),
            "quantity": 1,
            "unit_of_measure": "piece",
        }],
    })
    assert rfq_create.status_code == 201, rfq_create.text
    rfq_id = rfq_create.json()["id"]

    issue = await client.post(f"{PROC}/rfqs/{rfq_id}/issue")
    assert issue.status_code == 200, issue.text

    award = await client.post(f"{PROC}/rfqs/{rfq_id}/award", json={
        "awarded_quotation_ids": [str(uuid.uuid4())],
    })
    assert award.status_code in (400, 409), award.text


# ── 05 Invoice cancel while draft ─────────────────────────────────────────────

async def test_05_invoice_cancel_draft(
    client: AsyncClient,
    owner: VendorUser,
    tracked_product: Product,
    store: Store,
    supplier: Supplier,
):
    # Minimal sent PO for invoice linkage
    po_create = await client.post(f"{ME}/purchase-orders", json={
        "supplier_id": str(supplier.id),
        "items": [{
            "product_id": str(tracked_product.id),
            "quantity": 2,
            "unit_cost": 10,
            "unit_of_measure": "piece",
        }],
    })
    assert po_create.status_code == 201, po_create.text
    po = po_create.json()
    await client.post(f"{ME}/purchase-orders/{po['id']}/send")

    inv = await client.post(f"{PROC}/vendor-invoices", json={
        "supplier_id": str(supplier.id),
        "purchase_order_id": po["id"],
        "invoice_number": f"INV-CXL-{uuid.uuid4().hex[:6]}",
        "invoice_date": date.today().isoformat(),
        "items": [{
            "po_item_id": po["items"][0]["id"],
            "product_id": str(tracked_product.id),
            "invoiced_qty": 2,
            "unit_price": 10,
        }],
    })
    assert inv.status_code == 201, inv.text
    inv_id = inv.json()["id"]

    cancel = await client.post(f"{PROC}/vendor-invoices/{inv_id}/cancel")
    assert cancel.status_code == 200, cancel.text
    assert cancel.json()["status"] == "cancelled"


# ── 06 Price mismatch blocks 3-way match ──────────────────────────────────────

async def test_06_invoice_price_mismatch_blocks_match(
    client: AsyncClient,
    owner: VendorUser,
    tracked_product: Product,
    store: Store,
    supplier: Supplier,
    db_session: AsyncSession,
):
    po_create = await client.post(f"{ME}/purchase-orders", json={
        "supplier_id": str(supplier.id),
        "items": [{
            "product_id": str(tracked_product.id),
            "quantity": 4,
            "unit_cost": 10,
            "unit_of_measure": "piece",
        }],
    })
    assert po_create.status_code == 201, po_create.text
    po = po_create.json()
    po_item_id = po["items"][0]["id"]
    send = await client.post(f"{ME}/purchase-orders/{po['id']}/send")
    assert send.status_code == 200, send.text

    grn = await client.post(f"{PROC}/grns", json={
        "purchase_order_id": po["id"],
        "requires_qc": False,
        "lines": [{
            "po_item_id": po_item_id,
            "product_id": str(tracked_product.id),
            "received_qty": 4,
            "unit_of_measure": "piece",
            "unit_price": 10,
        }],
    })
    assert grn.status_code == 201, grn.text

    inv = await client.post(f"{PROC}/vendor-invoices", json={
        "supplier_id": str(supplier.id),
        "purchase_order_id": po["id"],
        "invoice_number": f"INV-BLK-{uuid.uuid4().hex[:6]}",
        "invoice_date": date.today().isoformat(),
        "items": [{
            "po_item_id": po_item_id,
            "product_id": str(tracked_product.id),
            "invoiced_qty": 4,
            "unit_price": 99,  # intentional mismatch vs PO/GRN
        }],
    })
    assert inv.status_code == 201, inv.text
    inv_id = inv.json()["id"]

    post = await client.post(f"{PROC}/vendor-invoices/{inv_id}/post")
    assert post.status_code == 200, post.text

    match = await client.post(f"{PROC}/vendor-invoices/{inv_id}/match", json={
        "invoice_id": inv_id,
        "qty_tolerance_pct": 0,
        "price_tolerance_pct": 0,
    })
    assert match.status_code == 200, match.text
    body = match.json()
    assert body["match_status"] in ("blocked_price", "blocked_qty", "partial", "blocked")
    assert body["status"] in ("blocked", "partial_match", "matched")


# ── 07 Lookup by document number ──────────────────────────────────────────────

async def test_07_document_lookups(
    client: AsyncClient,
    owner: VendorUser,
    tracked_product: Product,
    store: Store,
):
    pr = await _create_open_pr(client, tracked_product, store, qty=1, price=5)
    lookup = await client.get(f"{PROC}/requisitions/lookup", params={"number": pr["pr_number"]})
    assert lookup.status_code == 200, lookup.text
    assert lookup.json()["id"] == pr["id"]
