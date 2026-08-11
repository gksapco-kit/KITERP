"""
CRM collections: payment follow-ups, credit control, and sales area dues.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal
from math import ceil
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import case, func, literal, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.types import Date as DateType

from app.api.deps import require_permission
from app.database import get_db
from app.models.crm import CrmCreditControl, CrmPaymentFollowup
from app.models.customer import Customer
from app.models.invoice import Invoice
from app.models.sales_area import DistributionChannel, SalesDivision, SalesArea
from app.models.store import Store
from app.models.vendor_user import VendorUser
from app.schemas.crm.schemas import (
    CreditControlCheckRequest,
    CreditControlCheckResponse,
    CreditControlCreate,
    CreditControlResponse,
    CreditControlUpdate,
    PaginatedResponse,
    PaymentFollowupCreate,
    PaymentFollowupResponse,
    PaymentFollowupUpdate,
    SalesAreaDuesAgingMixin,
    SalesAreaDuesCustomerRow,
    SalesAreaDuesInvoiceRow,
    SalesAreaDuesSummaryResponse,
    SalesAreaDuesSummaryRow,
)
from app.services.crm.numbering import next_crm_number

router = APIRouter()


def _paginated(items, total, page, size):
    return {
        "items": items,
        "total": total,
        "page": page,
        "size": size,
        "pages": ceil(total / size) if total else 0,
    }


def _dec(v) -> Decimal:
    if v is None:
        return Decimal("0")
    return Decimal(str(v))


def _credit_payload(row: CrmCreditControl) -> dict:
    limit = _dec(row.credit_limit)
    outstanding = _dec(row.current_outstanding)
    available = limit - outstanding if limit > 0 else None
    data = CreditControlResponse.model_validate(row).model_dump()
    data["available_credit"] = available
    data["over_limit"] = bool(limit > 0 and outstanding > limit)
    return data


# ── Payment follow-ups ───────────────────────────────────────────────────────

@router.get("/payment-followups", response_model=PaginatedResponse)
async def list_payment_followups(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    q: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    priority: Optional[str] = None,
    channel: Optional[str] = None,
    vu: VendorUser = Depends(require_permission("crm.view")),
    db: AsyncSession = Depends(get_db),
):
    filters = [CrmPaymentFollowup.vendor_id == vu.vendor_id]
    if status_filter:
        filters.append(CrmPaymentFollowup.status == status_filter)
    if priority:
        filters.append(CrmPaymentFollowup.priority == priority)
    if channel:
        filters.append(CrmPaymentFollowup.channel == channel)
    if q and q.strip():
        term = f"%{q.strip()}%"
        filters.append(
            or_(
                CrmPaymentFollowup.party_name.ilike(term),
                CrmPaymentFollowup.number.ilike(term),
                CrmPaymentFollowup.invoice_ref.ilike(term),
                CrmPaymentFollowup.party_phone.ilike(term),
                CrmPaymentFollowup.party_email.ilike(term),
            )
        )

    total = (
        await db.execute(select(func.count()).select_from(CrmPaymentFollowup).where(*filters))
    ).scalar() or 0
    rows = (
        await db.execute(
            select(CrmPaymentFollowup)
            .where(*filters)
            .order_by(
                CrmPaymentFollowup.next_followup_at.asc().nulls_last(),
                CrmPaymentFollowup.created_at.desc(),
            )
            .offset((page - 1) * size)
            .limit(size)
        )
    ).scalars().all()
    items = [PaymentFollowupResponse.model_validate(r).model_dump() for r in rows]
    return _paginated(items, total, page, size)


@router.post(
    "/payment-followups",
    response_model=PaymentFollowupResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_payment_followup(
    data: PaymentFollowupCreate,
    vu: VendorUser = Depends(require_permission("crm.contacts.manage")),
    db: AsyncSession = Depends(get_db),
):
    try:
        number = await next_crm_number(
            db, vu.vendor_id, CrmPaymentFollowup, "PF", entity_type="payment_followup"
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    row = CrmPaymentFollowup(
        vendor_id=vu.vendor_id,
        number=number,
        owner_id=data.owner_id or vu.user_id,
        **data.model_dump(exclude={"owner_id"}),
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return PaymentFollowupResponse.model_validate(row).model_dump()


@router.get("/payment-followups/{followup_id}", response_model=PaymentFollowupResponse)
async def get_payment_followup(
    followup_id: UUID,
    vu: VendorUser = Depends(require_permission("crm.view")),
    db: AsyncSession = Depends(get_db),
):
    row = await db.get(CrmPaymentFollowup, followup_id)
    if not row or row.vendor_id != vu.vendor_id:
        raise HTTPException(status_code=404, detail="Payment follow-up not found")
    return PaymentFollowupResponse.model_validate(row).model_dump()


@router.put("/payment-followups/{followup_id}", response_model=PaymentFollowupResponse)
async def update_payment_followup(
    followup_id: UUID,
    data: PaymentFollowupUpdate,
    vu: VendorUser = Depends(require_permission("crm.contacts.manage")),
    db: AsyncSession = Depends(get_db),
):
    row = await db.get(CrmPaymentFollowup, followup_id)
    if not row or row.vendor_id != vu.vendor_id:
        raise HTTPException(status_code=404, detail="Payment follow-up not found")
    for key, val in data.model_dump(exclude_unset=True).items():
        setattr(row, key, val)
    await db.commit()
    await db.refresh(row)
    return PaymentFollowupResponse.model_validate(row).model_dump()


@router.delete("/payment-followups/{followup_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_payment_followup(
    followup_id: UUID,
    vu: VendorUser = Depends(require_permission("crm.contacts.manage")),
    db: AsyncSession = Depends(get_db),
):
    row = await db.get(CrmPaymentFollowup, followup_id)
    if not row or row.vendor_id != vu.vendor_id:
        raise HTTPException(status_code=404, detail="Payment follow-up not found")
    await db.delete(row)
    await db.commit()


# ── Credit control ───────────────────────────────────────────────────────────

@router.get("/credit-control", response_model=PaginatedResponse)
async def list_credit_controls(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    q: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    payment_blocked: Optional[bool] = None,
    vu: VendorUser = Depends(require_permission("crm.view")),
    db: AsyncSession = Depends(get_db),
):
    filters = [CrmCreditControl.vendor_id == vu.vendor_id]
    if status_filter:
        filters.append(CrmCreditControl.status == status_filter)
    if payment_blocked is not None:
        filters.append(CrmCreditControl.payment_blocked == payment_blocked)
    if q and q.strip():
        term = f"%{q.strip()}%"
        filters.append(
            or_(
                CrmCreditControl.party_name.ilike(term),
                CrmCreditControl.party_phone.ilike(term),
                CrmCreditControl.party_email.ilike(term),
            )
        )

    total = (
        await db.execute(select(func.count()).select_from(CrmCreditControl).where(*filters))
    ).scalar() or 0
    rows = (
        await db.execute(
            select(CrmCreditControl)
            .where(*filters)
            .order_by(CrmCreditControl.party_name.asc())
            .offset((page - 1) * size)
            .limit(size)
        )
    ).scalars().all()
    return _paginated([_credit_payload(r) for r in rows], total, page, size)


@router.post(
    "/credit-control",
    response_model=CreditControlResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_credit_control(
    data: CreditControlCreate,
    vu: VendorUser = Depends(require_permission("crm.contacts.manage")),
    db: AsyncSession = Depends(get_db),
):
    payload = data.model_dump()
    if payload.get("payment_blocked") and payload.get("status") == "active":
        payload["status"] = "blocked"
    if payload.get("status") == "blocked":
        payload["payment_blocked"] = True
    row = CrmCreditControl(vendor_id=vu.vendor_id, **payload)
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return _credit_payload(row)


@router.post("/credit-control/check", response_model=CreditControlCheckResponse)
async def check_credit_control(
    data: CreditControlCheckRequest,
    vu: VendorUser = Depends(require_permission("crm.view")),
    db: AsyncSession = Depends(get_db),
):
    """Enforce max payment amount, credit limit, and payment block for a party."""
    from app.services.crm.credit_gate import evaluate_credit, find_credit_control

    if (
        not data.credit_control_id
        and not data.customer_id
        and not data.contact_id
        and not (data.party_name and data.party_name.strip())
    ):
        raise HTTPException(
            status_code=400,
            detail="Provide credit_control_id, customer_id, contact_id, or party_name",
        )

    row = await find_credit_control(
        db,
        vu.vendor_id,
        credit_control_id=data.credit_control_id,
        customer_id=data.customer_id,
        contact_id=data.contact_id,
        party_name=data.party_name,
    )
    if data.credit_control_id and not row:
        raise HTTPException(status_code=404, detail="Credit control not found")

    return evaluate_credit(
        row,
        data.amount,
        require_zero_outstanding=bool(data.require_zero_outstanding),
    )


@router.get("/credit-control/{control_id}", response_model=CreditControlResponse)
async def get_credit_control(
    control_id: UUID,
    vu: VendorUser = Depends(require_permission("crm.view")),
    db: AsyncSession = Depends(get_db),
):
    row = await db.get(CrmCreditControl, control_id)
    if not row or row.vendor_id != vu.vendor_id:
        raise HTTPException(status_code=404, detail="Credit control not found")
    return _credit_payload(row)


@router.put("/credit-control/{control_id}", response_model=CreditControlResponse)
async def update_credit_control(
    control_id: UUID,
    data: CreditControlUpdate,
    vu: VendorUser = Depends(require_permission("crm.contacts.manage")),
    db: AsyncSession = Depends(get_db),
):
    row = await db.get(CrmCreditControl, control_id)
    if not row or row.vendor_id != vu.vendor_id:
        raise HTTPException(status_code=404, detail="Credit control not found")
    updates = data.model_dump(exclude_unset=True)
    for key, val in updates.items():
        setattr(row, key, val)
    if "payment_blocked" in updates and updates["payment_blocked"] and row.status == "active":
        row.status = "blocked"
    if "status" in updates and updates["status"] == "blocked":
        row.payment_blocked = True
    if "status" in updates and updates["status"] == "active" and "payment_blocked" not in updates:
        row.payment_blocked = False
    await db.commit()
    await db.refresh(row)
    return _credit_payload(row)


@router.delete("/credit-control/{control_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_credit_control(
    control_id: UUID,
    vu: VendorUser = Depends(require_permission("crm.contacts.manage")),
    db: AsyncSession = Depends(get_db),
):
    row = await db.get(CrmCreditControl, control_id)
    if not row or row.vendor_id != vu.vendor_id:
        raise HTTPException(status_code=404, detail="Credit control not found")
    await db.delete(row)
    await db.commit()


# ── Sales area dues ───────────────────────────────────────────────────────────

def _aging_expr(balance_col, due_col, as_of: date):
    """Return aging bucket aggregates.

    PostgreSQL: date - date = integer (days). No date_part needed.
    age > 0 means the due date has passed (overdue).
    """
    age = literal(as_of, type_=DateType()) - due_col
    return {
        "not_due": func.sum(case((age <= 0, balance_col), else_=0)),
        "days_1_30": func.sum(case(((age > 0) & (age <= 30), balance_col), else_=0)),
        "days_31_60": func.sum(case(((age > 30) & (age <= 60), balance_col), else_=0)),
        "days_61_90": func.sum(case(((age > 60) & (age <= 90), balance_col), else_=0)),
        "days_90_plus": func.sum(case((age > 90, balance_col), else_=0)),
        "overdue_due": func.sum(case((age > 0, balance_col), else_=0)),
    }


async def _load_sales_area_labels(
    db: AsyncSession, vendor_id: UUID, area_ids: set
) -> dict[UUID | None, dict]:
    """Return {sales_area_id -> {code, name, business_unit_id, business_unit_name}}."""
    labels: dict[UUID | None, dict] = {
        None: {
            "sales_area_code": None,
            "sales_area_name": "Unassigned",
            "business_unit_id": None,
            "business_unit_name": None,
        }
    }
    real_ids = {a for a in area_ids if a is not None}
    if not real_ids:
        return labels

    areas = (
        await db.execute(
            select(SalesArea)
            .where(SalesArea.id.in_(real_ids), SalesArea.vendor_id == vendor_id)
        )
    ).scalars().all()

    store_ids = {a.business_unit_id for a in areas}
    stores = {
        s.id: s
        for s in (
            await db.execute(select(Store).where(Store.id.in_(store_ids)))
        ).scalars().all()
    } if store_ids else {}

    dc_ids = {a.distribution_channel_id for a in areas}
    dcs = {
        c.id: c
        for c in (
            await db.execute(
                select(DistributionChannel).where(DistributionChannel.id.in_(dc_ids))
            )
        ).scalars().all()
    } if dc_ids else {}

    dv_ids = {a.division_id for a in areas}
    dvs = {
        d.id: d
        for d in (
            await db.execute(
                select(SalesDivision).where(SalesDivision.id.in_(dv_ids))
            )
        ).scalars().all()
    } if dv_ids else {}

    for a in areas:
        scope = stores.get(a.business_unit_id)
        root_bu = stores.get(scope.parent_id) if (scope and scope.parent_id) else scope
        dc = dcs.get(a.distribution_channel_id)
        dv = dvs.get(a.division_id)

        if a.name and a.name.strip() and a.name.strip().lower() != "null":
            display_name = a.name.strip()
        else:
            parts = []
            if scope:
                parts.append(scope.code or scope.name)
            if dc:
                parts.append(dc.name or dc.code)
            if dv:
                parts.append(dv.name or dv.code)
            display_name = " · ".join(p for p in parts if p) or a.code or "Sales area"

        labels[a.id] = {
            "sales_area_code": a.code,
            "sales_area_name": display_name,
            "business_unit_id": (root_bu or scope).id if (root_bu or scope) else None,
            "business_unit_name": (root_bu or scope).name if (root_bu or scope) else None,
        }

    return labels


def _open_invoice_filters(vendor_id: UUID):
    return [
        Invoice.vendor_id == vendor_id,
        Invoice.invoice_type == "invoice",
        Invoice.status.notin_(["draft", "void", "cancelled", "paid"]),
        Invoice.balance_due > 0,
    ]


def _digits(phone: Optional[str]) -> str:
    return "".join(ch for ch in (phone or "") if ch.isdigit())[-10:]


async def _backfill_open_invoice_sales_areas(db: AsyncSession, vendor_id: UUID) -> None:
    """Stamp customer + sales area onto open invoices that were created without them.

    New invoices send both ids; older ones often have only a name/phone snapshot,
    so dues would otherwise dump everything into Unassigned.
    """
    await db.execute(
        update(Invoice)
        .where(
            *_open_invoice_filters(vendor_id),
            Invoice.sales_area_id.is_(None),
            Invoice.customer_id == Customer.id,
            Customer.vendor_id == vendor_id,
            Customer.sales_area_id.isnot(None),
        )
        .values(sales_area_id=Customer.sales_area_id)
        .execution_options(synchronize_session=False)
    )

    orphans = (
        await db.execute(
            select(Invoice).where(
                *_open_invoice_filters(vendor_id),
                Invoice.sales_area_id.is_(None),
                Invoice.customer_id.is_(None),
            )
        )
    ).scalars().all()
    if orphans:
        customers = (
            await db.execute(select(Customer).where(Customer.vendor_id == vendor_id))
        ).scalars().all()
        by_phone: dict[str, Customer] = {}
        by_name: dict[str, Customer] = {}
        for cust in customers:
            digits = _digits(cust.phone)
            if digits:
                by_phone[digits] = cust
            name = (cust.full_name or "").strip().lower()
            if name:
                by_name[name] = cust
        for inv in orphans:
            digits = _digits(inv.customer_phone)
            cust = by_phone.get(digits) if digits else None
            if not cust and inv.customer_name:
                cust = by_name.get(inv.customer_name.strip().lower())
            if not cust:
                continue
            inv.customer_id = cust.id
            if cust.sales_area_id:
                inv.sales_area_id = cust.sales_area_id

    await db.flush()

    leftover = (
        await db.execute(
            select(Invoice).where(
                *_open_invoice_filters(vendor_id),
                Invoice.sales_area_id.is_(None),
            )
        )
    ).scalars().all()
    if leftover:
        areas = (
            await db.execute(
                select(SalesArea).where(
                    SalesArea.vendor_id == vendor_id,
                    or_(SalesArea.is_active.is_(True), SalesArea.is_active.is_(None)),
                ).order_by(SalesArea.is_default.desc(), SalesArea.created_at.asc())
            )
        ).scalars().all()
        fallback = next((a for a in areas if a.is_default), None)
        if fallback is None and len(areas) == 1:
            fallback = areas[0]
        if fallback is not None:
            for inv in leftover:
                inv.sales_area_id = fallback.id

    await db.commit()


def _open_invoice_base_query(vendor_id: UUID):
    """Core filter shared by both dues endpoints."""
    return select(Invoice).where(*_open_invoice_filters(vendor_id))


def _effective_sales_area_id():
    """Invoice sales area, falling back to the customer's default assignment."""
    return func.coalesce(Invoice.sales_area_id, Customer.sales_area_id)


@router.get("/sales-area-dues/summary", response_model=SalesAreaDuesSummaryResponse)
async def sales_area_dues_summary(
    as_of: Optional[date] = Query(None),
    store_id: Optional[str] = Query(None),
    sales_area_id: Optional[str] = Query(None),
    overdue_only: bool = Query(False),
    vu: VendorUser = Depends(require_permission("crm.view")),
    db: AsyncSession = Depends(get_db),
):
    """Per-sales-area KPI: customer count, invoice count, total outstanding, aging buckets."""
    await _backfill_open_invoice_sales_areas(db, vu.vendor_id)
    today = as_of or date.today()
    due_col = func.coalesce(Invoice.due_date, func.cast(Invoice.created_at, DateType()))

    age_exprs = _aging_expr(Invoice.balance_due, due_col, today)

    effective_area = _effective_sales_area_id()
    q = (
        select(
            effective_area.label("sales_area_id"),
            func.count(Invoice.customer_id.distinct()).label("customer_count"),
            func.count(Invoice.id).label("open_invoice_count"),
            func.sum(Invoice.balance_due).label("total_due"),
            age_exprs["not_due"].label("not_due"),
            age_exprs["days_1_30"].label("days_1_30"),
            age_exprs["days_31_60"].label("days_31_60"),
            age_exprs["days_61_90"].label("days_61_90"),
            age_exprs["days_90_plus"].label("days_90_plus"),
            age_exprs["overdue_due"].label("overdue_due"),
        )
        .select_from(Invoice)
        .outerjoin(Customer, Customer.id == Invoice.customer_id)
        .where(
            Invoice.vendor_id == vu.vendor_id,
            Invoice.invoice_type == "invoice",
            Invoice.status.notin_(["draft", "void", "cancelled", "paid"]),
            Invoice.balance_due > 0,
        )
        .group_by(effective_area)
    )

    if store_id:
        q = q.where(Invoice.store_id == UUID(store_id))
    if sales_area_id == "unassigned":
        q = q.where(effective_area.is_(None))
    elif sales_area_id:
        q = q.where(effective_area == UUID(sales_area_id))
    if overdue_only:
        q = q.where((literal(today, type_=DateType()) - due_col) > 0)

    rows = (await db.execute(q)).mappings().all()
    area_ids = {r["sales_area_id"] for r in rows}
    labels = await _load_sales_area_labels(db, vu.vendor_id, area_ids)

    areas: list[SalesAreaDuesSummaryRow] = []
    total_agg: dict[str, Decimal] = {
        "total_due": Decimal("0"),
        "not_due": Decimal("0"),
        "days_1_30": Decimal("0"),
        "days_31_60": Decimal("0"),
        "days_61_90": Decimal("0"),
        "days_90_plus": Decimal("0"),
        "overdue_due": Decimal("0"),
    }

    for r in rows:
        aid = r["sales_area_id"]
        lbl = labels.get(aid, labels[None])
        area_row = SalesAreaDuesSummaryRow(
            sales_area_id=aid,
            sales_area_code=lbl["sales_area_code"],
            sales_area_name=lbl["sales_area_name"],
            business_unit_id=lbl["business_unit_id"],
            business_unit_name=lbl["business_unit_name"],
            customer_count=r["customer_count"] or 0,
            open_invoice_count=r["open_invoice_count"] or 0,
            total_due=Decimal(str(r["total_due"] or 0)),
            not_due=Decimal(str(r["not_due"] or 0)),
            days_1_30=Decimal(str(r["days_1_30"] or 0)),
            days_31_60=Decimal(str(r["days_31_60"] or 0)),
            days_61_90=Decimal(str(r["days_61_90"] or 0)),
            days_90_plus=Decimal(str(r["days_90_plus"] or 0)),
            overdue_due=Decimal(str(r["overdue_due"] or 0)),
        )
        areas.append(area_row)
        for k in total_agg:
            total_agg[k] += getattr(area_row, k)

    areas.sort(key=lambda a: (a.sales_area_name or ""))
    return SalesAreaDuesSummaryResponse(
        areas=areas,
        totals=SalesAreaDuesAgingMixin(**total_agg),
    )


@router.get("/sales-area-dues", response_model=PaginatedResponse)
async def list_sales_area_dues(
    sales_area_id: Optional[str] = Query(None),
    store_id: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    overdue_only: bool = Query(False),
    min_due: Optional[Decimal] = Query(None),
    as_of: Optional[date] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    vu: VendorUser = Depends(require_permission("crm.view")),
    db: AsyncSession = Depends(get_db),
):
    """Paginated list of customers with outstanding dues, optionally filtered by sales area."""
    await _backfill_open_invoice_sales_areas(db, vu.vendor_id)
    today = as_of or date.today()
    due_col = func.coalesce(Invoice.due_date, func.cast(Invoice.created_at, DateType()))
    age_exprs = _aging_expr(Invoice.balance_due, due_col, today)

    base_filters = [
        Invoice.vendor_id == vu.vendor_id,
        Invoice.invoice_type == "invoice",
        Invoice.status.notin_(["draft", "void", "cancelled", "paid"]),
        Invoice.balance_due > 0,
    ]

    if store_id:
        base_filters.append(Invoice.store_id == UUID(store_id))

    effective_area = _effective_sales_area_id()
    if sales_area_id == "unassigned":
        base_filters.append(effective_area.is_(None))
    elif sales_area_id:
        base_filters.append(effective_area == UUID(sales_area_id))

    # customer search — match against Invoice snapshot first, fall back to Customer table via join
    customer_search = None
    if q and q.strip():
        term = f"%{q.strip()}%"
        customer_search = or_(
            Invoice.customer_name.ilike(term),
            Invoice.customer_phone.ilike(term),
            Invoice.customer_email.ilike(term),
        )
        base_filters.append(customer_search)

    if overdue_only:
        base_filters.append((literal(today, type_=DateType()) - due_col) > 0)

    if min_due is not None:
        subq = (
            select(Invoice.customer_id, effective_area.label("sales_area_id"))
            .select_from(Invoice)
            .outerjoin(Customer, Customer.id == Invoice.customer_id)
            .where(*base_filters)
            .group_by(Invoice.customer_id, effective_area)
            .having(func.sum(Invoice.balance_due) >= min_due)
            .subquery()
        )
        base_filters = [
            Invoice.vendor_id == vu.vendor_id,
            Invoice.invoice_type == "invoice",
            Invoice.status.notin_(["draft", "void", "cancelled", "paid"]),
            Invoice.balance_due > 0,
            Invoice.customer_id == subq.c.customer_id,
            effective_area == subq.c.sales_area_id,
        ]

    agg_q = (
        select(
            effective_area.label("sales_area_id"),
            Invoice.customer_id,
            func.max(Invoice.customer_name).label("customer_name"),
            func.max(Invoice.customer_phone).label("phone"),
            func.max(Invoice.customer_email).label("email"),
            func.count(Invoice.id).label("open_invoices"),
            func.sum(Invoice.balance_due).label("total_due"),
            age_exprs["not_due"].label("not_due"),
            age_exprs["days_1_30"].label("days_1_30"),
            age_exprs["days_31_60"].label("days_31_60"),
            age_exprs["days_61_90"].label("days_61_90"),
            age_exprs["days_90_plus"].label("days_90_plus"),
            age_exprs["overdue_due"].label("overdue_due"),
            func.min(due_col).label("oldest_due_date"),
        )
        .select_from(Invoice)
        .outerjoin(Customer, Customer.id == Invoice.customer_id)
        .where(*base_filters)
        .group_by(effective_area, Invoice.customer_id)
    )

    # count
    count_q = select(func.count()).select_from(agg_q.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    # paginate
    agg_q = agg_q.order_by(
        func.sum(Invoice.balance_due).desc()
    ).offset((page - 1) * size).limit(size)

    rows = (await db.execute(agg_q)).mappings().all()

    # enrich: customer_group from customer master, credit info from crm_credit_control
    cust_ids = {r["customer_id"] for r in rows if r["customer_id"]}
    customer_map: dict[UUID, Customer] = {}
    if cust_ids:
        customer_map = {
            c.id: c
            for c in (
                await db.execute(select(Customer).where(Customer.id.in_(cust_ids)))
            ).scalars().all()
        }

    credit_map: dict[UUID, CrmCreditControl] = {}
    if cust_ids:
        credit_map = {
            cc.customer_id: cc
            for cc in (
                await db.execute(
                    select(CrmCreditControl).where(
                        CrmCreditControl.vendor_id == vu.vendor_id,
                        CrmCreditControl.customer_id.in_(cust_ids),
                    )
                )
            ).scalars().all()
            if cc.customer_id
        }

    invoice_q = (
        select(Invoice)
        .outerjoin(Customer, Customer.id == Invoice.customer_id)
        .where(*base_filters)
        .order_by(Invoice.created_at.desc())
    )
    open_invoices = (await db.execute(invoice_q)).scalars().all()
    invoices_by_key: dict[tuple, list] = {}
    for inv in open_invoices:
        key = (
            getattr(inv, "sales_area_id", None) or (
                customer_map.get(inv.customer_id).sales_area_id
                if inv.customer_id and customer_map.get(inv.customer_id)
                else None
            ),
            inv.customer_id,
        )
        invoices_by_key.setdefault(key, []).append(inv)

    items: list[dict] = []
    for r in rows:
        cid = r["customer_id"]
        cust = customer_map.get(cid) if cid else None
        cc = credit_map.get(cid) if cid else None
        oldest = r["oldest_due_date"]
        days_overdue: Optional[int] = None
        if oldest is not None:
            if hasattr(oldest, "date"):
                oldest = oldest.date()
            days_overdue = max(0, (today - oldest).days)

        area_id = r["sales_area_id"]
        inv_rows = invoices_by_key.get((area_id, cid), [])
        invoice_items = [
            SalesAreaDuesInvoiceRow(
                id=str(inv.id),
                invoice_number=inv.invoice_number,
                status=inv.status,
                created_at=inv.created_at.isoformat() if inv.created_at else None,
                due_date=inv.due_date,
                total=_dec(inv.total),
                balance_due=_dec(inv.balance_due),
            )
            for inv in inv_rows
        ]

        row_obj = SalesAreaDuesCustomerRow(
            sales_area_id=area_id,
            customer_id=cid,
            customer_name=r["customer_name"] or "(Unknown)",
            phone=r["phone"] or (cust.phone if cust else None),
            email=r["email"] or (cust.email if cust else None),
            customer_group=cust.customer_group if cust else None,
            open_invoices=r["open_invoices"] or 0,
            total_due=Decimal(str(r["total_due"] or 0)),
            not_due=Decimal(str(r["not_due"] or 0)),
            days_1_30=Decimal(str(r["days_1_30"] or 0)),
            days_31_60=Decimal(str(r["days_31_60"] or 0)),
            days_61_90=Decimal(str(r["days_61_90"] or 0)),
            days_90_plus=Decimal(str(r["days_90_plus"] or 0)),
            overdue_due=Decimal(str(r["overdue_due"] or 0)),
            oldest_due_date=oldest,
            days_overdue=days_overdue,
            credit_limit=_dec(cc.credit_limit) if cc else None,
            payment_blocked=cc.payment_blocked if cc else None,
            invoices=invoice_items,
        )
        items.append(row_obj.model_dump())

    return _paginated(items, total, page, size)
