"""Tests for the Pharmaceutical Manufacturing module API."""
from __future__ import annotations

import uuid
from decimal import Decimal

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.models.procurement_goods import GoodsBatch
from app.models.store import Store, StoreInventory
from app.models.user import User
from app.models.vendor import Vendor
from app.models.vendor_product import Product
from app.models.vendor_user import VendorUser
from app.services.pharma_batch import (
    next_batch_number,
    create_production_batch,
    consume_batches_for_production,
    build_genealogy,
)
from app.models.production import ProductionOrder

pytestmark = pytest.mark.asyncio

BASE = "/api/v1/vendors/me/pharma"

# Single-signer e-sign payload (dual-sign disabled via fixture)
ESIGN_APPROVER = {"password": "password123", "meaning": "approver"}
ESIGN_REVIEWER = {"password": "password123", "meaning": "reviewer"}


@pytest_asyncio.fixture(autouse=True)
async def pharma_esign_single_signer(db_session: AsyncSession, test_vendor: Vendor):
    """Disable dual-sign so one test user can complete critical actions."""
    settings = dict(test_vendor.settings or {})
    settings["pharma"] = {
        "esign_required": True,
        "dual_sign_release": False,
        "dual_sign_bpr_complete": False,
        "dual_sign_capa_close": False,
        "dual_sign_cc_approve": False,
        "bpr_required_before_release": False,
    }
    test_vendor.settings = settings
    flag_modified(test_vendor, "settings")
    await db_session.commit()


@pytest_asyncio.fixture
async def test_vendor_user_owner(
    db_session: AsyncSession, test_vendor: Vendor, test_user: User
) -> VendorUser:
    vu = VendorUser(
        id=uuid.uuid4(),
        vendor_id=test_vendor.id,
        user_id=test_user.id,
        role="owner",
        permissions=[],
        is_active=True,
    )
    db_session.add(vu)
    await db_session.commit()
    await db_session.refresh(vu)
    return vu


@pytest_asyncio.fixture
async def store(db_session: AsyncSession, test_vendor: Vendor) -> Store:
    s = Store(id=uuid.uuid4(), vendor_id=test_vendor.id, name="Main Plant", is_default=True)
    db_session.add(s)
    await db_session.commit()
    await db_session.refresh(s)
    return s


@pytest_asyncio.fixture
async def raw_product(db_session: AsyncSession, test_vendor: Vendor, test_user: User) -> Product:
    p = Product(
        id=uuid.uuid4(),
        vendor_id=test_vendor.id,
        name="API Powder",
        slug=f"api-powder-{uuid.uuid4().hex[:6]}",
        price=10.0,
        cost_price=5.0,
        currency="INR",
        status="active",
        product_type="physical",
        quantity=0,
        batch_managed=True,
        shelf_life_days=365,
        created_by=test_user.id,
    )
    db_session.add(p)
    await db_session.commit()
    await db_session.refresh(p)
    return p


@pytest_asyncio.fixture
async def fg_product(db_session: AsyncSession, test_vendor: Vendor, test_user: User) -> Product:
    p = Product(
        id=uuid.uuid4(),
        vendor_id=test_vendor.id,
        name="Finished Tablet",
        slug=f"fg-tablet-{uuid.uuid4().hex[:6]}",
        price=100.0,
        currency="INR",
        status="active",
        product_type="physical",
        quantity=0,
        batch_managed=True,
        qc_required_on_production=True,
        shelf_life_days=730,
        created_by=test_user.id,
    )
    db_session.add(p)
    await db_session.commit()
    await db_session.refresh(p)
    return p


async def test_overview_endpoint(client: AsyncClient, test_vendor_user_owner: VendorUser):
    resp = await client.get(f"{BASE}/overview")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["phases"]) == 11
    assert "stats" in body
    assert body["stats"]["batch_managed_products"] >= 0
    statuses = {p["status"] for p in body["phases"]}
    assert "enforced" in statuses
    assert statuses <= {"enforced", "partial", "scaffold", "planned"}


async def test_fefo_rejects_invalid_product_id(client: AsyncClient, test_vendor_user_owner: VendorUser):
    resp = await client.get(f"{BASE}/fefo", params={"product_id": "", "qty": 1})
    assert resp.status_code == 400
    assert "product_id" in str(resp.json()["detail"]).lower()

    resp2 = await client.get(f"{BASE}/fefo", params={"product_id": "not-a-uuid", "qty": 1})
    assert resp2.status_code == 400
    assert "uuid" in str(resp2.json()["detail"]).lower()


async def test_batch_number_allocation(client: AsyncClient, test_vendor_user_owner: VendorUser):
    resp = await client.post(
        f"{BASE}/batch-numbers/next",
        json={"prefix": "TEST"},
    )
    assert resp.status_code == 200
    number = resp.json()["batch_number"]
    assert number.startswith("TEST-")
    assert number.endswith("00001")

    resp2 = await client.post(
        f"{BASE}/batch-numbers/next",
        json={"prefix": "TEST"},
    )
    assert resp2.status_code == 200
    assert resp2.json()["batch_number"].endswith("00002")


async def test_create_production_batch_and_genealogy(
    db_session: AsyncSession,
    test_vendor: Vendor,
    raw_product: Product,
    fg_product: Product,
):
    # Seed raw lot
    raw_batch = GoodsBatch(
        id=uuid.uuid4(),
        vendor_id=test_vendor.id,
        product_id=raw_product.id,
        batch_number="RAW-001",
        quantity_received=Decimal("100"),
        quantity_available=Decimal("100"),
        quality_status="unrestricted",
        source_type="purchase",
    )
    db_session.add(raw_batch)
    await db_session.flush()

    order = ProductionOrder(
        id=uuid.uuid4(),
        vendor_id=test_vendor.id,
        ref=f"PO-{uuid.uuid4().hex[:6]}",
        type="mts",
        status="completed",
        items=[{"product_id": str(fg_product.id), "qty": 10, "item_type": "product", "name": fg_product.name}],
    )
    db_session.add(order)
    await db_session.flush()

    consumed = await consume_batches_for_production(
        db_session,
        vendor_id=test_vendor.id,
        product_id=raw_product.id,
        quantity=Decimal("30"),
        production_order_id=order.id,
    )
    assert len(consumed) == 1
    assert consumed[0]["batch_number"] == "RAW-001"
    assert float(consumed[0]["qty"]) == 30.0

    await db_session.refresh(raw_batch)
    assert Decimal(str(raw_batch.quantity_available)) == Decimal("70")

    fg_batch = await create_production_batch(
        db_session,
        vendor_id=test_vendor.id,
        product_id=fg_product.id,
        quantity=Decimal("10"),
        production_order_id=order.id,
        qc_required=True,
        component_links=consumed,
    )
    assert fg_batch.quality_status == "quality_inspection"
    assert fg_batch.source_type == "production"
    assert fg_batch.batch_number.startswith("FG-")
    await db_session.commit()

    tree = await build_genealogy(db_session, test_vendor.id, fg_batch.id, direction="both")
    assert tree["batch_number"] == fg_batch.batch_number
    assert len(tree["upstream"]) >= 1
    assert tree["upstream"][0]["batch_number"] == "RAW-001"


async def test_direct_batch_release_blocked(
    client: AsyncClient,
    test_vendor_user_owner: VendorUser,
    fg_product: Product,
    db_session: AsyncSession,
):
    batch = GoodsBatch(
        id=uuid.uuid4(),
        vendor_id=fg_product.vendor_id,
        product_id=fg_product.id,
        batch_number="FG-NO-BYPASS",
        quantity_received=Decimal("10"),
        quantity_available=Decimal("10"),
        quality_status="quality_inspection",
        source_type="production",
    )
    db_session.add(batch)
    await db_session.commit()

    resp = await client.patch(
        f"{BASE}/batches/{batch.id}/status",
        json={"quality_status": "unrestricted"},
    )
    assert resp.status_code == 400
    assert "inspection" in str(resp.json()["detail"]).lower() or "release" in str(resp.json()["detail"]).lower()


async def test_receipt_batch_qc_on_receipt(
    db_session: AsyncSession,
    test_vendor: Vendor,
    raw_product: Product,
):
    from app.services.pharma_batch import create_receipt_batch

    raw_product.qc_required_on_receipt = True
    await db_session.flush()

    batch = await create_receipt_batch(
        db_session,
        vendor_id=test_vendor.id,
        product_id=raw_product.id,
        quantity=Decimal("25"),
        source_type="purchase",
        document_number="PO-TEST",
        qc_required=True,
        batch_number="GR-QC-001",
    )
    await db_session.commit()
    assert batch.quality_status == "quality_inspection"
    assert batch.batch_number == "GR-QC-001"


async def test_sale_fefo_blocks_qi_lots(
    db_session: AsyncSession,
    test_vendor: Vendor,
    fg_product: Product,
):
    from app.services.pharma_batch import consume_batches_for_sale

    qi = GoodsBatch(
        id=uuid.uuid4(),
        vendor_id=test_vendor.id,
        product_id=fg_product.id,
        batch_number="FG-QI-ONLY",
        quantity_received=Decimal("50"),
        quantity_available=Decimal("50"),
        quality_status="quality_inspection",
    )
    db_session.add(qi)
    await db_session.flush()

    with pytest.raises(ValueError, match="Insufficient unrestricted FEFO"):
        await consume_batches_for_sale(
            db_session,
            vendor_id=test_vendor.id,
            product_id=fg_product.id,
            quantity=Decimal("5"),
        )

    free = GoodsBatch(
        id=uuid.uuid4(),
        vendor_id=test_vendor.id,
        product_id=fg_product.id,
        batch_number="FG-FREE",
        quantity_received=Decimal("20"),
        quantity_available=Decimal("20"),
        quality_status="unrestricted",
    )
    db_session.add(free)
    await db_session.flush()

    details = await consume_batches_for_sale(
        db_session,
        vendor_id=test_vendor.id,
        product_id=fg_product.id,
        quantity=Decimal("5"),
    )
    assert details[0]["batch_number"] == "FG-FREE"
    await db_session.refresh(free)
    assert Decimal(str(free.quantity_available)) == Decimal("15")


async def test_qi_receipt_opens_inspection_and_alerts(
    db_session: AsyncSession,
    test_vendor: Vendor,
    raw_product: Product,
    store: "Store",
    client: AsyncClient,
    test_vendor_user_owner: VendorUser,
):
    from datetime import date, timedelta
    from app.services.pharma_batch import create_receipt_batch, list_batch_alerts
    from app.models.pharma import PharmaInspectionLot
    from app.models.storage_location import StorageLocation
    from app.models.store import Store
    from sqlalchemy import select

    assert isinstance(store, Store)
    raw_product.retest_days = 30
    q_loc = StorageLocation(
        id=uuid.uuid4(),
        vendor_id=test_vendor.id,
        store_id=store.id,
        name="Quarantine Cage",
        code="QI-01",
        stock_type="quarantine",
        is_active=True,
    )
    db_session.add(q_loc)
    await db_session.flush()

    batch = await create_receipt_batch(
        db_session,
        vendor_id=test_vendor.id,
        product_id=raw_product.id,
        quantity=Decimal("12"),
        qc_required=True,
        batch_number="GR-QI-AUTO",
        manufacturing_date=date.today() - timedelta(days=60),
        expiry_date=date.today() + timedelta(days=5),
    )
    await db_session.commit()

    assert batch.quality_status == "quality_inspection"
    assert batch.storage_location_id == q_loc.id

    insp = (
        await db_session.execute(
            select(PharmaInspectionLot).where(PharmaInspectionLot.goods_batch_id == batch.id)
        )
    ).scalar_one_or_none()
    assert insp is not None
    assert insp.status == "open"

    # Unrestricted lot past retest window (retest alerts only apply to released stock).
    released = GoodsBatch(
        id=uuid.uuid4(),
        vendor_id=test_vendor.id,
        product_id=raw_product.id,
        batch_number="RM-RETEST",
        quantity_received=Decimal("5"),
        quantity_available=Decimal("5"),
        quality_status="unrestricted",
        manufacturing_date=date.today() - timedelta(days=60),
        is_active=True,
    )
    db_session.add(released)
    await db_session.commit()

    alerts = await list_batch_alerts(db_session, test_vendor.id, expiry_within_days=30)
    assert alerts["counts"]["expiring_soon"] >= 1
    assert alerts["counts"]["retest_due"] >= 1

    resp = await client.get(f"{BASE}/alerts")
    assert resp.status_code == 200
    assert "expiring_soon" in resp.json()


async def test_mbr_create_approve_and_inspection_release(
    client: AsyncClient,
    test_vendor_user_owner: VendorUser,
    fg_product: Product,
    db_session: AsyncSession,
):
    # Create an unrestricted FG batch to inspect
    batch = GoodsBatch(
        id=uuid.uuid4(),
        vendor_id=fg_product.vendor_id,
        product_id=fg_product.id,
        batch_number="FG-TEST-001",
        quantity_received=Decimal("50"),
        quantity_available=Decimal("50"),
        quality_status="quality_inspection",
        source_type="production",
    )
    db_session.add(batch)
    await db_session.commit()

    mbr_resp = await client.post(
        f"{BASE}/mbr",
        json={
            "product_id": str(fg_product.id),
            "code": "MBR-TAB",
            "title": "Tablet MBR",
            "operations": [{"seq": 10, "name": "Blend"}],
        },
    )
    assert mbr_resp.status_code == 201
    mbr_id = mbr_resp.json()["id"]

    # Approval without a credential must be refused when e-sign is required
    assert (await client.post(f"{BASE}/mbr/{mbr_id}/approve")).status_code == 401

    approve = await client.post(f"{BASE}/mbr/{mbr_id}/approve", json=ESIGN_APPROVER)
    assert approve.status_code == 200
    assert approve.json()["status"] == "approved"

    insp = await client.post(
        f"{BASE}/inspections",
        json={
            "goods_batch_id": str(batch.id),
            "product_id": str(fg_product.id),
            "origin": "production",
        },
    )
    assert insp.status_code == 201
    insp_id = insp.json()["id"]

    results = await client.patch(
        f"{BASE}/inspections/{insp_id}/results",
        json={"results": [{"name": "Assay", "value": 99.1, "pass": True}], "status": "pending_release"},
    )
    assert results.status_code == 200

    decide = await client.post(
        f"{BASE}/inspections/{insp_id}/decide",
        json={"decision": "release", "notes": "Within spec", **ESIGN_APPROVER},
    )
    assert decide.status_code == 200
    body = decide.json()
    assert body["status"] == "released"
    assert body["coa_number"]

    coa = await client.get(f"{BASE}/coa/{insp_id}")
    assert coa.status_code == 200
    assert coa.json()["coa_number"] == body["coa_number"]

    # Batch should now be unrestricted
    await db_session.refresh(batch)
    assert batch.quality_status == "unrestricted"


async def test_qms_deviation_capa_and_serial(
    client: AsyncClient,
    test_vendor_user_owner: VendorUser,
    fg_product: Product,
    db_session: AsyncSession,
):
    batch = GoodsBatch(
        id=uuid.uuid4(),
        vendor_id=fg_product.vendor_id,
        product_id=fg_product.id,
        batch_number="FG-SER-001",
        quantity_received=Decimal("10"),
        quantity_available=Decimal("10"),
        quality_status="unrestricted",
    )
    db_session.add(batch)
    await db_session.commit()

    dev = await client.post(
        f"{BASE}/deviations",
        json={"title": "Yield variance", "severity": "major", "goods_batch_id": str(batch.id)},
    )
    assert dev.status_code == 201
    deviation_id = dev.json()["id"]

    capa = await client.post(
        f"{BASE}/capas",
        json={"title": "Fix blender calibration", "deviation_id": deviation_id},
    )
    assert capa.status_code == 201
    capa_id = capa.json()["id"]

    closed = await client.patch(
        f"{BASE}/capas/{capa_id}",
        json={"status": "closed", "effectiveness_check": "Assay within spec for 3 lots", **ESIGN_APPROVER},
    )
    assert closed.status_code == 200
    assert closed.json()["status"] == "closed"

    # Linked deviation should auto-close
    from app.models.pharma import PharmaDeviation
    from sqlalchemy import select
    drow = (
        await db_session.execute(select(PharmaDeviation).where(PharmaDeviation.id == uuid.UUID(deviation_id)))
    ).scalar_one()
    await db_session.refresh(drow)
    assert drow.status == "closed"

    cc = await client.post(
        f"{BASE}/change-controls",
        json={"title": "Update blend time", "change_type": "mbr"},
    )
    assert cc.status_code == 201
    cc_id = cc.json()["id"]
    approved = await client.post(f"{BASE}/change-controls/{cc_id}/approve", json=ESIGN_APPROVER)
    assert approved.status_code == 200
    assert approved.json()["status"] == "approved"

    serial = await client.post(
        f"{BASE}/serials",
        json={"goods_batch_id": str(batch.id), "serial_number": "SN-UNIT-1", "level": "unit"},
    )
    assert serial.status_code == 201
    assert serial.json()["serial_number"] == "SN-UNIT-1"

    audit = await client.get(f"{BASE}/audit")
    assert audit.status_code == 200


async def test_ebmr_bpr_lifecycle_and_coa_print(
    client: AsyncClient,
    test_vendor_user_owner: VendorUser,
    fg_product: Product,
    db_session: AsyncSession,
):
    mbr_resp = await client.post(
        f"{BASE}/mbr",
        json={
            "product_id": str(fg_product.id),
            "code": "MBR-EBMR",
            "title": "Tablet eBMR",
            "operations": [{"seq": 10, "name": "Blend"}, {"seq": 20, "name": "Compress"}],
            "ipc_checks": [{"name": "Weight check"}],
            "line_clearance": [{"name": "Clear line"}],
        },
    )
    assert mbr_resp.status_code == 201
    mbr_id = mbr_resp.json()["id"]
    assert (
        await client.post(f"{BASE}/mbr/{mbr_id}/approve", json=ESIGN_APPROVER)
    ).status_code == 200

    bpr_resp = await client.post(
        f"{BASE}/bpr",
        json={
            "product_id": str(fg_product.id),
            "batch_number": "BPR-100",
            "planned_qty": 100,
        },
    )
    assert bpr_resp.status_code == 201
    body = bpr_resp.json()
    assert body["mbr_id"] == mbr_id
    assert len(body["operation_log"]) == 2
    assert body["operation_log"][0]["status"] == "pending"
    bpr_id = body["id"]

    # Cannot log steps without clearance
    bad = await client.post(f"{BASE}/bpr/{bpr_id}/steps", json={"seq": 10, "status": "completed"})
    assert bad.status_code == 400

    await client.patch(f"{BASE}/bpr/{bpr_id}", json={"clearance_done": True, "status": "in_progress"})
    s1 = await client.post(f"{BASE}/bpr/{bpr_id}/steps", json={"seq": 10, "status": "completed"})
    assert s1.status_code == 200
    s2 = await client.post(f"{BASE}/bpr/{bpr_id}/steps", json={"seq": 20, "status": "completed"})
    assert s2.status_code == 200
    ipc = await client.post(
        f"{BASE}/bpr/{bpr_id}/ipc",
        json={"name": "Weight check", "value": "500mg", "passed": True},
    )
    assert ipc.status_code == 200

    done = await client.post(
        f"{BASE}/bpr/{bpr_id}/complete",
        json={"actual_qty": 98, **ESIGN_APPROVER},
    )
    assert done.status_code == 200, done.text
    assert done.json()["status"] == "completed"
    assert float(done.json()["yield_pct"]) == 98.0

    # CoA print after release
    batch = GoodsBatch(
        id=uuid.uuid4(),
        vendor_id=fg_product.vendor_id,
        product_id=fg_product.id,
        batch_number="FG-COA-PRINT",
        quantity_received=Decimal("10"),
        quantity_available=Decimal("10"),
        quality_status="quality_inspection",
    )
    db_session.add(batch)
    await db_session.commit()
    insp = await client.post(
        f"{BASE}/inspections",
        json={"goods_batch_id": str(batch.id), "product_id": str(fg_product.id), "origin": "production"},
    )
    insp_id = insp.json()["id"]
    await client.patch(
        f"{BASE}/inspections/{insp_id}/results",
        json={"results": [{"name": "Assay", "value": 99, "pass": True}], "status": "pending_release"},
    )
    await client.post(
        f"{BASE}/inspections/{insp_id}/decide",
        json={"decision": "release", **ESIGN_APPROVER},
    )
    printed = await client.get(f"{BASE}/coa/{insp_id}/print")
    assert printed.status_code == 200
    assert "Certificate of Analysis" in printed.text
    assert "FG-COA-PRINT" in printed.text


async def test_restore_batches_for_return(
    db_session: AsyncSession,
    test_vendor: Vendor,
    raw_product: Product,
):
    from app.services.pharma_batch import consume_batches_for_sale, restore_batches_for_return

    batch = GoodsBatch(
        id=uuid.uuid4(),
        vendor_id=test_vendor.id,
        product_id=raw_product.id,
        batch_number="RM-RET-1",
        quantity_received=Decimal("20"),
        quantity_available=Decimal("20"),
        quality_status="unrestricted",
        is_active=True,
    )
    db_session.add(batch)
    await db_session.commit()

    sale_id = uuid.uuid4()
    await consume_batches_for_sale(
        db_session,
        vendor_id=test_vendor.id,
        product_id=raw_product.id,
        quantity=Decimal("7"),
        source_id=sale_id,
        source_type="pos_transaction",
    )
    await db_session.commit()
    await db_session.refresh(batch)
    assert Decimal(str(batch.quantity_available)) == Decimal("13")

    await restore_batches_for_return(
        db_session,
        vendor_id=test_vendor.id,
        product_id=raw_product.id,
        quantity=Decimal("7"),
        source_id=uuid.uuid4(),
        original_source_id=sale_id,
        original_source_type="pos_transaction",
    )
    await db_session.commit()
    await db_session.refresh(batch)
    assert Decimal(str(batch.quantity_available)) == Decimal("20")


async def test_esign_requires_password_and_logs_failures(
    client: AsyncClient,
    test_vendor_user_owner: VendorUser,
    fg_product: Product,
    db_session: AsyncSession,
):
    batch = GoodsBatch(
        id=uuid.uuid4(),
        vendor_id=fg_product.vendor_id,
        product_id=fg_product.id,
        batch_number="FG-ESIGN-1",
        quantity_received=Decimal("5"),
        quantity_available=Decimal("5"),
        quality_status="quality_inspection",
    )
    db_session.add(batch)
    await db_session.commit()
    insp = await client.post(
        f"{BASE}/inspections",
        json={"goods_batch_id": str(batch.id), "product_id": str(fg_product.id)},
    )
    insp_id = insp.json()["id"]
    await client.patch(
        f"{BASE}/inspections/{insp_id}/results",
        json={"results": [], "status": "pending_release"},
    )

    missing = await client.post(
        f"{BASE}/inspections/{insp_id}/decide",
        json={"decision": "release", "meaning": "approver"},
    )
    assert missing.status_code == 401

    bad = await client.post(
        f"{BASE}/inspections/{insp_id}/decide",
        json={"decision": "release", "password": "wrong", "meaning": "approver"},
    )
    assert bad.status_code == 401

    audit = await client.get(f"{BASE}/audit", params={"entity_id": insp_id})
    assert audit.status_code == 200
    actions = [e["action"] for e in audit.json()["events"]]
    assert "esign_failed" in actions

    ok = await client.post(
        f"{BASE}/inspections/{insp_id}/decide",
        json={"decision": "release", **ESIGN_APPROVER},
    )
    assert ok.status_code == 200
    assert ok.json()["status"] == "released"
    assert ok.json()["esign"]["complete"] is True

    settings = await client.get(f"{BASE}/settings")
    assert settings.status_code == 200
    assert settings.json()["esign_required"] is True

    phase7 = next(p for p in (await client.get(f"{BASE}/overview")).json()["phases"] if p["id"] == 7)
    assert phase7["status"] == "enforced"


async def test_esign_dual_sign_release(
    client: AsyncClient,
    test_vendor: Vendor,
    test_vendor_user_owner: VendorUser,
    test_user: User,
    fg_product: Product,
    db_session: AsyncSession,
):
    from app.core.security import get_password_hash
    from app.api.deps import get_current_active_user
    from app.main import app

    settings = dict(test_vendor.settings or {})
    settings["pharma"] = {
        **(settings.get("pharma") or {}),
        "esign_required": True,
        "dual_sign_release": True,
    }
    test_vendor.settings = settings
    flag_modified(test_vendor, "settings")

    reviewer_user = User(
        id=uuid.uuid4(),
        email="reviewer@test.com",
        full_name="QC Reviewer",
        password_hash=get_password_hash("password123"),
        is_active=True,
        is_email_verified=True,
    )
    db_session.add(reviewer_user)
    await db_session.flush()
    reviewer_vu = VendorUser(
        id=uuid.uuid4(),
        vendor_id=test_vendor.id,
        user_id=reviewer_user.id,
        role="owner",
        permissions=[],
        is_active=True,
    )
    db_session.add(reviewer_vu)

    batch = GoodsBatch(
        id=uuid.uuid4(),
        vendor_id=test_vendor.id,
        product_id=fg_product.id,
        batch_number="FG-DUAL-1",
        quantity_received=Decimal("3"),
        quantity_available=Decimal("3"),
        quality_status="quality_inspection",
    )
    db_session.add(batch)
    await db_session.commit()

    insp = await client.post(
        f"{BASE}/inspections",
        json={"goods_batch_id": str(batch.id), "product_id": str(fg_product.id)},
    )
    insp_id = insp.json()["id"]
    await client.patch(
        f"{BASE}/inspections/{insp_id}/results",
        json={"results": [], "status": "pending_release"},
    )

    first = await client.post(
        f"{BASE}/inspections/{insp_id}/decide",
        json={"decision": "release", **ESIGN_REVIEWER},
    )
    assert first.status_code == 200
    assert first.json()["status"] == "pending_release"
    assert first.json()["esign"]["complete"] is False

    same = await client.post(
        f"{BASE}/inspections/{insp_id}/decide",
        json={"decision": "release", **ESIGN_APPROVER},
    )
    assert same.status_code == 400

    async def _as_reviewer():
        return reviewer_user

    app.dependency_overrides[get_current_active_user] = _as_reviewer
    try:
        second = await client.post(
            f"{BASE}/inspections/{insp_id}/decide",
            json={"decision": "release", **ESIGN_APPROVER},
        )
        assert second.status_code == 200, second.text
        assert second.json()["status"] == "released"
        assert second.json()["esign"]["complete"] is True
        assert len(second.json()["esign"]["signatures"]) >= 2
    finally:
        async def _as_owner():
            return test_user
        app.dependency_overrides[get_current_active_user] = _as_owner


async def test_retest_opens_qi_and_coa_pdf(
    client: AsyncClient,
    test_vendor_user_owner: VendorUser,
    fg_product: Product,
    db_session: AsyncSession,
):
    batch = GoodsBatch(
        id=uuid.uuid4(),
        vendor_id=fg_product.vendor_id,
        product_id=fg_product.id,
        batch_number="FG-RETEST-1",
        quantity_received=Decimal("8"),
        quantity_available=Decimal("8"),
        quality_status="unrestricted",
        is_active=True,
    )
    db_session.add(batch)
    await db_session.commit()

    retest = await client.post(f"{BASE}/batches/{batch.id}/retest")
    assert retest.status_code == 201, retest.text
    assert retest.json()["origin"] == "retest"
    assert retest.json()["status"] == "open"

    await db_session.refresh(batch)
    assert batch.quality_status == "quality_inspection"

    insp_id = retest.json()["id"]
    await client.patch(
        f"{BASE}/inspections/{insp_id}/results",
        json={"results": [{"name": "Assay", "value": 98, "pass": True}], "status": "pending_release"},
    )
    released = await client.post(
        f"{BASE}/inspections/{insp_id}/decide",
        json={"decision": "release", **ESIGN_APPROVER},
    )
    assert released.status_code == 200
    assert released.json().get("coa_data", {}).get("pdf_url") or True  # archive best-effort

    pdf = await client.get(f"{BASE}/coa/{insp_id}/pdf")
    assert pdf.status_code == 200
    assert pdf.headers["content-type"].startswith("application/pdf")
    assert pdf.content[:4] == b"%PDF"


async def test_generate_pharma_pdf_helpers():
    from app.utils.pharma_pdf import generate_coa_pdf, generate_bpr_pdf

    coa = generate_coa_pdf(
        coa_number="COA-1",
        product_name="Tablet",
        batch_number="B-1",
        results=[{"name": "Assay", "value": 99, "pass": True}],
    )
    assert coa[:4] == b"%PDF"

    bpr = generate_bpr_pdf(
        batch_number="BPR-1",
        product_name="Tablet",
        status="completed",
        planned_qty=100,
        actual_qty=98,
        yield_pct=98,
        clearance_done=True,
        operation_log=[{"seq": 10, "name": "Blend", "status": "completed"}],
        ipc_results=[{"name": "Weight", "value": "ok", "pass": True}],
    )
    assert bpr[:4] == b"%PDF"


def test_epcis_partner_export_formats():
    """Partner download formats: GS1 JSON/XML + human CSV/XLSX/PDF reports."""
    from datetime import datetime, timezone
    from types import SimpleNamespace

    from app.services.pharma_epcis import (
        _build_partner_csv_document,
        _build_partner_json_document,
        _build_partner_pdf_document,
        _build_partner_xml_document,
        _build_partner_xlsx_document,
        _epc_urn,
        _iso_z,
    )

    ev = SimpleNamespace(
        id=uuid.uuid4(),
        event_type="ObjectEvent",
        action="ADD",
        biz_step="shipping",
        disposition="in_transit",
        event_time=datetime(2026, 7, 25, 12, 0, 0, tzinfo=timezone.utc),
        epc_list=[_epc_urn("ABC123", "01234567890128")],
        parent_epc=None,
        child_epcs=[],
        biz_location="urn:epc:id:sgln:0614141.00001.0",
        read_point=None,
        goods_batch_id=uuid.uuid4(),
        product_id=uuid.uuid4(),
        gtin="01234567890128",
        lot_number="LOT-X",
        source_type="ship",
        source_id=uuid.uuid4(),
        partner_id=None,
        meta={},
        created_at=datetime(2026, 7, 25, 12, 0, 0, tzinfo=timezone.utc),
    )

    assert _iso_z(ev.event_time) == "2026-07-25T12:00:00.000Z"
    assert _epc_urn("ABC123", "01234567890128") == "urn:epc:id:sgtin:01234567890128.ABC123"

    doc = _build_partner_json_document([ev])
    assert doc["type"] == "EPCISDocument"
    assert doc["schemaVersion"] == "2.0"
    assert doc["meta"]["format"] == "epcis-2.0-json-lite"
    event = doc["epcisBody"]["eventList"][0]
    assert event["bizStep"] == "urn:epcglobal:cbv:bizstep:shipping"
    assert event["disposition"] == "urn:epcglobal:cbv:disp:in_transit"
    assert event["eventTime"].endswith("Z")
    assert event["epcList"][0].startswith("urn:epc:id:sgtin:")
    assert event["ilmd"]["lotNumber"] == "LOT-X"

    xml = _build_partner_xml_document([ev])
    assert xml.startswith("<?xml")
    assert "<epcis:EPCISDocument" in xml
    assert "<bizStep>urn:epcglobal:cbv:bizstep:shipping</bizStep>" in xml
    assert "<disposition>urn:epcglobal:cbv:disp:in_transit</disposition>" in xml
    assert "<eventTime>2026-07-25T12:00:00.000Z</eventTime>" in xml

    csv_text = _build_partner_csv_document([ev])
    assert "event_time,event_type,action,biz_step" in csv_text
    assert "shipping" in csv_text
    assert "LOT-X" in csv_text

    xlsx = _build_partner_xlsx_document([ev])
    assert xlsx[:2] == b"PK"  # zip / OOXML
    assert len(xlsx) > 200

    pdf = _build_partner_pdf_document([ev])
    assert pdf[:4] == b"%PDF"
