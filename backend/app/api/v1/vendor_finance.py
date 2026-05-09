"""
Finance API — all 11 sub-routers for the Finance module.
Mounted at /vendors/me/finance/...
"""
from __future__ import annotations

import io
import csv
from datetime import date, datetime
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_vendor_user, require_permission, get_db
from app.models.vendor_user import VendorUser
from app.repositories.finance.finance_repo import (
    FinCOARepo, FinJournalRepo, FinARRepo, FinAPRepo, FinBankRepo,
    FinBudgetRepo, FinAssetRepo, FinTaxRepo, FinReportRepo,
    FinCapitalRepo, FinControlsRepo,
)
from app.services.finance.coa_seeder import seed_default_coa, seed_default_fiscal_year
from app.services.finance.fiscal_calendar import (
    append_audit_period,
    assign_fiscal_year_to_companies,
    clear_current_fiscal_years,
    create_fiscal_year_from_template,
    find_fiscal_year_by_variant,
    find_overlapping_fiscal_year,
    repair_wide_audit_periods_for_fiscal_year,
    set_fy_company_assignments,
)
from app.schemas.finance.fiscal import (
    AuditPeriodAdd,
    FiscalYearAssignCompanies,
    FiscalYearLegacyCreate,
    FiscalYearTemplatedCreate,
)
from app.services.finance import field_rules as field_rules_service
from app.services.finance.posting import (
    post_event,
    create_journal_draft,
    post_entry_with_approval_check,
    update_journal_draft,
)
from app.schemas.finance.journal import (
    JournalEntryCreate, JournalEntryUpdate,
    CompanyCreate, CostCenterCreate, ProjectCreate,
)
from app.models.finance import (
    FinCompany, FinCostCenter, FinProject, FinIntercompanyPartner,
    FinAccount,
)
from app.models.store import Store
from sqlalchemy import select, or_
from sqlalchemy.exc import IntegrityError

router = APIRouter()


def _d(obj) -> dict:
    """Convert SQLAlchemy model to dict, handling UUID and date."""
    if obj is None:
        return {}
    data = {}
    for col in obj.__table__.columns:
        v = getattr(obj, col.name)
        if hasattr(v, "isoformat"):
            v = v.isoformat()
        elif hasattr(v, "__str__") and not isinstance(v, (str, int, float, bool, dict, list)) and v is not None:
            v = str(v)
        data[col.name] = v
    return data


def _d_fiscal_year(fy) -> dict:
    out = _d(fy)
    asg = getattr(fy, "assignments", None) or []
    if asg:
        out["company_ids"] = [str(a.company_id) for a in asg]
        out["companies"] = [
            {"company_id": str(a.company_id), "is_current": bool(a.is_current)} for a in asg
        ]
    periods = getattr(fy, "periods", None) or []
    o = lg = cl = 0
    for p in periods:
        st = (getattr(p, "status", None) or "open").lower()
        if st == "open":
            o += 1
        elif st == "locked":
            lg += 1
        elif st == "closed":
            cl += 1
    out["period_counts"] = {"open": o, "locked": lg, "closed": cl}
    out["period_total"] = len(periods)
    return out


# ═══════════════════════════════════════════════════════════════════════════
# SETUP — COA seed endpoint
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/setup/seed-coa")
async def seed_coa(
    vu: VendorUser = Depends(require_permission("finance.coa.manage")),
    db: AsyncSession = Depends(get_db),
):
    await seed_default_coa(db, vu.vendor_id)
    await seed_default_fiscal_year(db, vu.vendor_id)
    await db.commit()
    return {"message": "Default Chart of Accounts and Fiscal Year created"}


# ═══════════════════════════════════════════════════════════════════════════
# CHART OF ACCOUNTS
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/coa")
async def list_accounts(
    account_type: Optional[str] = None,
    is_active: Optional[bool] = None,
    vu: VendorUser = Depends(require_permission("finance.view")),
    db: AsyncSession = Depends(get_db),
):
    accounts = await FinCOARepo(db).list_accounts(vu.vendor_id, account_type, is_active)
    return [_d(a) for a in accounts]


@router.post("/coa", status_code=201)
async def create_account(
    body: dict,
    vu: VendorUser = Depends(require_permission("finance.coa.manage")),
    db: AsyncSession = Depends(get_db),
):
    acc = await FinCOARepo(db).create_account(vu.vendor_id, body)
    await db.commit()
    return _d(acc)


@router.put("/coa/{account_id}")
async def update_account(
    account_id: UUID, body: dict,
    vu: VendorUser = Depends(require_permission("finance.coa.manage")),
    db: AsyncSession = Depends(get_db),
):
    repo = FinCOARepo(db)
    acc = await repo.get_account(account_id, vu.vendor_id)
    if not acc:
        raise HTTPException(404, "Account not found")
    acc = await repo.update_account(acc, body)
    await db.commit()
    return _d(acc)


# ═══════════════════════════════════════════════════════════════════════════
# FISCAL YEARS & PERIODS
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/fiscal-years")
async def list_fiscal_years(
    company_id: Optional[UUID] = Query(
        None,
        description="Filter fiscal years for a company code; omit to list all companies",
    ),
    vu: VendorUser = Depends(require_permission("finance.view")),
    db: AsyncSession = Depends(get_db),
):
    fys = await FinCOARepo(db).list_fiscal_years(vu.vendor_id, company_id)
    return [_d_fiscal_year(fy) for fy in fys]


@router.post("/fiscal-years", status_code=201)
async def create_fiscal_year(
    body: dict,
    vu: VendorUser = Depends(require_permission("finance.coa.manage")),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a fiscal year.
    - With `template` (jan_dec | jul_jun | apr_mar | custom): generates monthly standard
      periods and optional `audit_periods` after the FY end (post-close windows for audit adjustments).
    - Without `template`: empty shell (name, start_date, end_date, company_id, variant_code) with no periods.
    """
    if body.get("template") is not None:
        try:
            p = FiscalYearTemplatedCreate.model_validate(body)
        except Exception as e:
            raise HTTPException(400, str(e)) from e
        cids = list(dict.fromkeys(p.company_ids))
        for cid in cids:
            r = await db.execute(
                select(FinCompany).where(
                    FinCompany.id == cid, FinCompany.vendor_id == vu.vendor_id
                )
            )
            if r.scalar_one_or_none() is None:
                raise HTTPException(404, f"Company not found for this tenant: {cid}")
        try:
            fy = await create_fiscal_year_from_template(db, vu.vendor_id, p)
        except ValueError as e:
            raise HTTPException(400, str(e)) from e
        await db.commit()
        fy = await FinCOARepo(db).get_fiscal_year(fy.id, vu.vendor_id)
        return _d_fiscal_year(fy) if fy else {}

    try:
        leg = FiscalYearLegacyCreate.model_validate(body)
    except Exception as e:
        raise HTTPException(400, str(e)) from e
    d = leg.model_dump()
    cids = list(dict.fromkeys(d["company_ids"]))
    for cid in cids:
        r = await db.execute(
            select(FinCompany).where(
                FinCompany.id == cid, FinCompany.vendor_id == vu.vendor_id
            )
        )
        if r.scalar_one_or_none() is None:
            raise HTTPException(404, f"Company not found for this tenant: {cid}")
    if await find_fiscal_year_by_variant(db, vu.vendor_id, d["variant_code"]):
        raise HTTPException(
            400,
            f"Variant code \"{d['variant_code']}\" is already in use for this organisation — choose another code.",
        )
    for cid in cids:
        other = await find_overlapping_fiscal_year(
            db, vu.vendor_id, cid, d["start_date"], d["end_date"], None
        )
        if other is not None:
            raise HTTPException(
                400,
                f"A fiscal year already exists for a selected company for that period: "
                f"\"{other.name}\" ({other.variant_code}, {other.start_date} to {other.end_date}). "
                f"You asked for {d['start_date']} to {d['end_date']}, which overlaps for that company. "
                "Remove that company, pick another variant, or use different dates.",
            )
    fy = await FinCOARepo(db).create_fiscal_year(
        vu.vendor_id,
        {k: d[k] for k in ("name", "start_date", "end_date", "status", "variant_code")},
    )
    if cids:
        await set_fy_company_assignments(
            db, vu.vendor_id, fy, cids, mark_current=bool(d["is_current"])
        )
    await db.commit()
    fy = await FinCOARepo(db).get_fiscal_year(fy.id, vu.vendor_id)
    return _d_fiscal_year(fy) if fy else {}


@router.post("/fiscal-years/{fy_id}/companies", status_code=201)
async def assign_fiscal_year_companies(
    fy_id: UUID,
    body: dict,
    vu: VendorUser = Depends(require_permission("finance.coa.manage")),
    db: AsyncSession = Depends(get_db),
):
    """Assign an existing shared fiscal year / variant to more company codes (no duplicate periods)."""
    try:
        p = FiscalYearAssignCompanies.model_validate(body)
    except Exception as e:
        raise HTTPException(400, str(e)) from e
    for cid in p.company_ids:
        r = await db.execute(
            select(FinCompany).where(
                FinCompany.id == cid, FinCompany.vendor_id == vu.vendor_id
            )
        )
        if r.scalar_one_or_none() is None:
            raise HTTPException(404, f"Company not found: {cid}")
    try:
        n = await assign_fiscal_year_to_companies(
            db, vu.vendor_id, fy_id, p.company_ids, mark_current=p.is_current
        )
    except ValueError as e:
        msg = str(e) or "Cannot assign"
        code = 404 if "not found" in msg.lower() else 400
        raise HTTPException(code, msg) from e
    await db.commit()
    return {"linked": n}


@router.post("/fiscal-years/{fy_id}/audit-periods", status_code=201)
async def add_fy_audit_period(
    fy_id: UUID,
    body: AuditPeriodAdd,
    vu: VendorUser = Depends(require_permission("finance.coa.manage")),
    db: AsyncSession = Depends(get_db),
):
    """Add a post-close audit / adjustment window for an existing fiscal year (dates after FY end)."""
    try:
        p = await append_audit_period(db, vu.vendor_id, fy_id, body)
    except ValueError as e:
        msg = str(e) or "Invalid audit period"
        raise HTTPException(404 if "not found" in msg.lower() else 400, msg) from e
    await db.commit()
    return _d(p)


@router.get("/fiscal-years/{fy_id}/periods")
async def list_periods(
    fy_id: UUID,
    vu: VendorUser = Depends(require_permission("finance.view")),
    db: AsyncSession = Depends(get_db),
):
    n = await repair_wide_audit_periods_for_fiscal_year(db, vu.vendor_id, fy_id)
    if n > 0:
        await db.commit()
    periods = await FinCOARepo(db).list_periods(vu.vendor_id, fy_id)
    return [_d(p) for p in periods]


@router.post("/periods/{period_id}/close")
async def close_period(
    period_id: UUID,
    vu: VendorUser = Depends(require_permission("finance.coa.manage")),
    db: AsyncSession = Depends(get_db),
):
    repo = FinCOARepo(db)
    period = await repo.get_period(period_id, vu.vendor_id)
    if not period:
        raise HTTPException(404, "Period not found")
    period = await repo.close_period(period, vu.id)
    await db.commit()
    return _d(period)


@router.post("/periods/{period_id}/lock")
async def lock_period(
    period_id: UUID,
    vu: VendorUser = Depends(require_permission("finance.coa.manage")),
    db: AsyncSession = Depends(get_db),
):
    repo = FinCOARepo(db)
    p = await repo.get_period(period_id, vu.vendor_id)
    if not p:
        raise HTTPException(404, "Period not found")
    try:
        p = await repo.lock_period(p)
    except ValueError as e:
        raise HTTPException(400, str(e))
    await db.commit()
    return _d(p)


@router.post("/periods/{period_id}/reopen")
async def reopen_period(
    period_id: UUID,
    vu: VendorUser = Depends(require_permission("finance.coa.manage")),
    db: AsyncSession = Depends(get_db),
):
    repo = FinCOARepo(db)
    p = await repo.get_period(period_id, vu.vendor_id)
    if not p:
        raise HTTPException(404, "Period not found")
    p = await repo.reopen_period(p)
    await db.commit()
    return _d(p)


class FieldRuleCreate(BaseModel):
    scope: str
    company_id: Optional[UUID] = None
    vendor_user_id: Optional[UUID] = None
    entity_type: str = "journal_entry"
    field_key: str
    requirement: str


@router.get("/field-rules")
async def list_field_rules(
    entity_type: Optional[str] = None,
    vu: VendorUser = Depends(require_permission("finance.coa.manage")),
    db: AsyncSession = Depends(get_db),
):
    rules = await FinCOARepo(db).list_field_rules(vu.vendor_id, entity_type)
    return [_d(r) for r in rules]


@router.get("/field-rules/effective")
async def get_effective_field_rules(
    entity_type: str = "journal_entry",
    company_id: Optional[UUID] = None,
    vu: VendorUser = Depends(require_permission("finance.view")),
    db: AsyncSession = Depends(get_db),
):
    """Merged rules (GL default → company → current user) for the entity."""
    m = await field_rules_service.effective_field_rules(
        db, vu.vendor_id, entity_type, company_id, vu.id
    )
    return {"entity_type": entity_type, "fields": m}


@router.post("/field-rules", status_code=201)
async def create_field_rule(
    body: FieldRuleCreate,
    vu: VendorUser = Depends(require_permission("finance.coa.manage")),
    db: AsyncSession = Depends(get_db),
):
    if body.scope not in ("gl", "company", "user"):
        raise HTTPException(400, "scope must be gl, company, or user")
    if body.scope == "company" and not body.company_id:
        raise HTTPException(400, "company_id is required for company scope")
    if body.scope == "user" and not body.vendor_user_id:
        raise HTTPException(400, "vendor_user_id is required for user scope")
    if body.requirement not in ("optional", "mandatory", "hidden"):
        raise HTTPException(400, "requirement must be optional, mandatory, or hidden")
    if body.scope in ("gl",) and (body.company_id or body.vendor_user_id):
        raise HTTPException(400, "GL scope must not set company or user")
    data = {
        "scope": body.scope,
        "company_id": body.company_id,
        "vendor_user_id": body.vendor_user_id,
        "entity_type": body.entity_type,
        "field_key": body.field_key,
        "requirement": body.requirement,
    }
    try:
        row = await FinCOARepo(db).create_field_rule(vu.vendor_id, data)
    except IntegrityError as e:
        raise HTTPException(400, "A rule already exists for this scope and field (duplicate).") from e
    except Exception as e:
        raise HTTPException(400, str(e)) from e
    await db.commit()
    return _d(row)


@router.put("/field-rules/{rule_id}")
async def update_field_rule(
    rule_id: UUID,
    body: FieldRuleCreate,
    vu: VendorUser = Depends(require_permission("finance.coa.manage")),
    db: AsyncSession = Depends(get_db),
):
    repo = FinCOARepo(db)
    row = await repo.get_field_rule(rule_id, vu.vendor_id)
    if not row:
        raise HTTPException(404, "Rule not found")
    if body.requirement not in ("optional", "mandatory", "hidden"):
        raise HTTPException(400, "Invalid requirement")
    data = {k: v for k, v in body.model_dump().items() if v is not None and k in (
        "scope", "company_id", "vendor_user_id", "entity_type", "field_key", "requirement"
    )}
    try:
        row = await repo.update_field_rule(row, data)
    except Exception as e:
        raise HTTPException(400, str(e))
    await db.commit()
    return _d(row)


@router.delete("/field-rules/{rule_id}")
async def delete_field_rule(
    rule_id: UUID,
    vu: VendorUser = Depends(require_permission("finance.coa.manage")),
    db: AsyncSession = Depends(get_db),
):
    repo = FinCOARepo(db)
    row = await repo.get_field_rule(rule_id, vu.vendor_id)
    if not row:
        raise HTTPException(404, "Rule not found")
    await repo.delete_field_rule(row)
    await db.commit()
    return {"ok": True}


@router.get("/exchange-rates")
async def list_exchange_rates(
    from_currency: Optional[str] = None,
    vu: VendorUser = Depends(require_permission("finance.view")),
    db: AsyncSession = Depends(get_db),
):
    rates = await FinCOARepo(db).list_exchange_rates(vu.vendor_id, from_currency)
    return [_d(r) for r in rates]


@router.post("/exchange-rates", status_code=201)
async def create_exchange_rate(
    body: dict,
    vu: VendorUser = Depends(require_permission("finance.coa.manage")),
    db: AsyncSession = Depends(get_db),
):
    er = await FinCOARepo(db).create_exchange_rate(vu.vendor_id, body)
    await db.commit()
    return _d(er)


# ═══════════════════════════════════════════════════════════════════════════
# JOURNAL ENTRIES
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/journal-entries")
async def list_journal_entries(
    status: Optional[str] = None,
    source_type: Optional[str] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    skip: int = 0,
    limit: int = 50,
    vu: VendorUser = Depends(require_permission("finance.view")),
    db: AsyncSession = Depends(get_db),
):
    repo = FinJournalRepo(db)
    entries = await repo.list_entries(vu.vendor_id, status, source_type, from_date, to_date, skip, limit)
    total = await repo.count_entries(vu.vendor_id, status)
    return {"items": [_d(e) for e in entries], "total": total}


@router.post("/journal-entries", status_code=201)
async def create_journal_entry(
    body: JournalEntryCreate,
    vu: VendorUser = Depends(require_permission("finance.journal.create")),
    db: AsyncSession = Depends(get_db),
):
    """Create a validated, balanced draft journal entry (enterprise path)."""
    je = await create_journal_draft(db, vu.vendor_id, body, created_by_id=vu.id)
    await db.commit()
    result = _d(je)
    result["lines"] = [_d(ln) for ln in je.lines]
    return result


@router.get("/journal-entries/{je_id}")
async def get_journal_entry(
    je_id: UUID,
    vu: VendorUser = Depends(require_permission("finance.view")),
    db: AsyncSession = Depends(get_db),
):
    je = await FinJournalRepo(db).get_entry(je_id, vu.vendor_id)
    if not je:
        raise HTTPException(404, "Journal entry not found")
    result = _d(je)
    result["lines"] = [_d(ln) for ln in je.lines]
    return result


@router.put("/journal-entries/{je_id}")
async def update_journal_entry(
    je_id: UUID,
    body: JournalEntryUpdate,
    vu: VendorUser = Depends(require_permission("finance.journal.create")),
    db: AsyncSession = Depends(get_db),
):
    """Edit a draft journal entry (header + lines replacement)."""
    je = await FinJournalRepo(db).get_entry(je_id, vu.vendor_id)
    if not je:
        raise HTTPException(404, "Journal entry not found")
    try:
        je = await update_journal_draft(db, je, body, actor_vendor_user_id=vu.id)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    await db.commit()
    result = _d(je)
    result["lines"] = [_d(ln) for ln in je.lines]
    return result


@router.post("/journal-entries/{je_id}/post")
async def post_journal_entry(
    je_id: UUID,
    vu: VendorUser = Depends(require_permission("finance.journal.post")),
    db: AsyncSession = Depends(get_db),
):
    repo = FinJournalRepo(db)
    je = await repo.get_entry(je_id, vu.vendor_id)
    if not je:
        raise HTTPException(404, "Journal entry not found")
    if je.status == "posted":
        raise HTTPException(400, "Already posted")
    try:
        je = await post_entry_with_approval_check(db, je, vu.id)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    await db.commit()
    return _d(je)


@router.post("/journal-entries/{je_id}/void")
async def void_journal_entry(
    je_id: UUID,
    vu: VendorUser = Depends(require_permission("finance.journal.post")),
    db: AsyncSession = Depends(get_db),
):
    repo = FinJournalRepo(db)
    je = await repo.get_entry(je_id, vu.vendor_id)
    if not je:
        raise HTTPException(404, "Journal entry not found")
    je = await repo.void_entry(je)
    await db.commit()
    return _d(je)


@router.post("/journal/manual")
async def manual_journal(
    body: dict,
    vu: VendorUser = Depends(require_permission("finance.journal.post")),
    db: AsyncSession = Depends(get_db),
):
    """Post a manual journal entry directly via the posting engine."""
    import uuid as _uuid
    je = await post_event(db, vu.vendor_id, "manual", _uuid.uuid4(),
                          body, created_by_id=vu.id)
    if not je:
        raise HTTPException(422, "Could not post journal — check that COA accounts exist")
    await db.commit()
    return _d(je)


# ═══════════════════════════════════════════════════════════════════════════
# MULTI-COMPANY — companies, cost centres, projects, intercompany
# ═══════════════════════════════════════════════════════════════════════════

async def _sync_fin_companies_from_stores(db: AsyncSession, vendor_id: UUID) -> None:
    """
    Ensure every active store (Company Codes page) with a code has a matching FinCompany row
    so finance pickers (cost centers, JEs, etc.) list the same codes.
    """
    r = await db.execute(
        select(Store)
        .where(Store.vendor_id == vendor_id, Store.is_active == True)
        .order_by(Store.is_default.desc(), Store.code, Store.name)
    )
    stores = r.scalars().all()
    r2 = await db.execute(select(FinCompany).where(FinCompany.vendor_id == vendor_id))
    by_code: dict[str, FinCompany] = {c.code: c for c in r2.scalars().all() if c and c.code}

    for s in stores:
        raw = (s.code or "").strip()
        if not raw:
            continue
        code = raw[:20]
        name = ((s.name or code).strip()[:200]) or code
        if code in by_code:
            co = by_code[code]
            if not co.is_active:
                co.is_active = True
            if name and co.name != name:
                co.name = name
            continue
        co = FinCompany(
            vendor_id=vendor_id,
            code=code,
            name=name,
            is_default=False,
            is_active=True,
        )
        db.add(co)
        by_code[code] = co
    await db.flush()

    # Mark default: align with the default store (same company code on GL side)
    dstore = (
        await db.execute(
            select(Store)
            .where(Store.vendor_id == vendor_id, Store.is_default == True, Store.is_active == True)
        )
    ).scalars().first()
    dcode = (dstore.code or "").strip()[:20] if dstore and (dstore.code or "").strip() else None
    fcos = (
        await db.execute(
            select(FinCompany).where(
                FinCompany.vendor_id == vendor_id,
                FinCompany.is_active == True,
            )
        )
    ).scalars().all()
    for fc in fcos:
        fc.is_default = bool(dcode and fc.code == dcode)
    if fcos and not dcode and not any(x.is_default for x in fcos):
        fcos.sort(key=lambda x: (x.code or ""))
        fcos[0].is_default = True
    await db.flush()


@router.get("/companies")
async def list_companies(
    vu: VendorUser = Depends(require_permission("finance.view")),
    db: AsyncSession = Depends(get_db),
):
    await _sync_fin_companies_from_stores(db, vu.vendor_id)
    await db.commit()

    r = await db.execute(
        select(FinCompany).where(FinCompany.vendor_id == vu.vendor_id, FinCompany.is_active == True)
        .order_by(FinCompany.code)
    )
    companies = r.scalars().all()
    if not companies:
        # Auto-create a default company on first access (no stores with codes yet)
        from app.models.vendor import Vendor
        vr = await db.execute(select(Vendor).where(Vendor.id == vu.vendor_id))
        vendor = vr.scalar_one_or_none()
        name = vendor.business_name if vendor else "Default Company"
        c = FinCompany(vendor_id=vu.vendor_id, code="1000", name=name, is_default=True)
        db.add(c)
        await db.commit()
        await db.refresh(c)
        companies = [c]
    return [_d(c) for c in companies]


@router.post("/companies", status_code=201)
async def create_company(
    body: CompanyCreate,
    vu: VendorUser = Depends(require_permission("finance.coa.manage")),
    db: AsyncSession = Depends(get_db),
):
    c = FinCompany(vendor_id=vu.vendor_id, **body.model_dump())
    db.add(c)
    await db.commit()
    await db.refresh(c)
    return _d(c)


@router.get("/cost-centers")
async def list_cost_centers(
    company_id: Optional[UUID] = None,
    vu: VendorUser = Depends(require_permission("finance.view")),
    db: AsyncSession = Depends(get_db),
):
    q = select(FinCostCenter).where(
        FinCostCenter.vendor_id == vu.vendor_id, FinCostCenter.is_active == True
    )
    if company_id:
        q = q.where(FinCostCenter.company_id == company_id)
    r = await db.execute(q.order_by(FinCostCenter.code))
    return [_d(cc) for cc in r.scalars().all()]


@router.post("/cost-centers", status_code=201)
async def create_cost_center(
    body: CostCenterCreate,
    vu: VendorUser = Depends(require_permission("finance.coa.manage")),
    db: AsyncSession = Depends(get_db),
):
    data = body.model_dump()
    # Auto-resolve company_id if not provided
    if not data.get("company_id"):
        r = await db.execute(
            select(FinCompany)
            .where(FinCompany.vendor_id == vu.vendor_id, FinCompany.is_active == True)
            .order_by(FinCompany.is_default.desc(), FinCompany.code)
            .limit(1)
        )
        default_co = r.scalar_one_or_none()
        if not default_co:
            raise HTTPException(status_code=400, detail="No company code found. Please create a company code first.")
        data["company_id"] = default_co.id
    cc = FinCostCenter(vendor_id=vu.vendor_id, **data)
    db.add(cc)
    await db.commit()
    await db.refresh(cc)
    return _d(cc)


@router.patch("/cost-centers/{cc_id}")
async def update_cost_center(
    cc_id: UUID,
    body: dict,
    vu: VendorUser = Depends(require_permission("finance.coa.manage")),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(
        select(FinCostCenter).where(FinCostCenter.id == cc_id, FinCostCenter.vendor_id == vu.vendor_id)
    )
    cc = r.scalar_one_or_none()
    if not cc:
        raise HTTPException(status_code=404, detail="Cost center not found")
    allowed = {"name", "description", "cc_group", "parent_id", "is_active", "code"}
    for k, v in body.items():
        if k in allowed:
            setattr(cc, k, v)
    await db.commit()
    await db.refresh(cc)
    return _d(cc)


@router.delete("/cost-centers/{cc_id}", status_code=204)
async def delete_cost_center(
    cc_id: UUID,
    vu: VendorUser = Depends(require_permission("finance.coa.manage")),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(
        select(FinCostCenter).where(FinCostCenter.id == cc_id, FinCostCenter.vendor_id == vu.vendor_id)
    )
    cc = r.scalar_one_or_none()
    if not cc:
        raise HTTPException(status_code=404, detail="Cost center not found")
    cc.is_active = False
    await db.commit()


@router.patch("/companies/{company_id}")
async def update_company(
    company_id: UUID,
    body: dict,
    vu: VendorUser = Depends(require_permission("finance.coa.manage")),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(
        select(FinCompany).where(FinCompany.id == company_id, FinCompany.vendor_id == vu.vendor_id)
    )
    co = r.scalar_one_or_none()
    if not co:
        raise HTTPException(status_code=404, detail="Company not found")
    allowed = {"name", "code", "currency", "country", "tax_id", "address", "is_default", "is_active"}
    for k, v in body.items():
        if k in allowed:
            setattr(co, k, v)
    await db.commit()
    await db.refresh(co)
    return _d(co)


@router.get("/projects")
async def list_projects(
    company_id: Optional[UUID] = None,
    status: Optional[str] = None,
    vu: VendorUser = Depends(require_permission("finance.view")),
    db: AsyncSession = Depends(get_db),
):
    from app.models.finance import FinProject
    q = select(FinProject).where(FinProject.vendor_id == vu.vendor_id)
    if company_id:
        q = q.where(FinProject.company_id == company_id)
    if status:
        q = q.where(FinProject.status == status)
    r = await db.execute(q.order_by(FinProject.code))
    return [_d(p) for p in r.scalars().all()]


@router.post("/projects", status_code=201)
async def create_project(
    body: ProjectCreate,
    vu: VendorUser = Depends(require_permission("finance.coa.manage")),
    db: AsyncSession = Depends(get_db),
):
    from app.models.finance import FinProject
    p = FinProject(vendor_id=vu.vendor_id, **body.model_dump())
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return _d(p)


@router.get("/intercompany-partners")
async def list_intercompany_partners(
    company_id: Optional[UUID] = None,
    vu: VendorUser = Depends(require_permission("finance.view")),
    db: AsyncSession = Depends(get_db),
):
    q = select(FinIntercompanyPartner).where(
        FinIntercompanyPartner.vendor_id == vu.vendor_id,
        FinIntercompanyPartner.is_active == True,
    )
    if company_id:
        q = q.where(FinIntercompanyPartner.company_id == company_id)
    r = await db.execute(q)
    return [_d(ip) for ip in r.scalars().all()]


# ═══════════════════════════════════════════════════════════════════════════
# TYPEAHEAD — account search + reference-document search
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/coa/search")
async def search_accounts(
    q: str = Query(default="", min_length=0),
    company_id: Optional[UUID] = None,
    account_type: Optional[str] = None,
    limit: int = Query(default=20, le=50),
    vu: VendorUser = Depends(require_permission("finance.view")),
    db: AsyncSession = Depends(get_db),
):
    """Typeahead: match accounts by code or name prefix."""
    stmt = select(FinAccount).where(
        FinAccount.vendor_id == vu.vendor_id,
        FinAccount.is_active == True,
    )
    if q:
        stmt = stmt.where(
            or_(
                FinAccount.code.ilike(f"{q}%"),
                FinAccount.name.ilike(f"%{q}%"),
            )
        )
    if account_type:
        stmt = stmt.where(FinAccount.account_type == account_type)
    stmt = stmt.order_by(FinAccount.code).limit(limit)
    r = await db.execute(stmt)
    accounts = r.scalars().all()
    return [
        {
            "id": str(a.id),
            "code": a.code,
            "name": a.name,
            "account_type": a.account_type,
            "account_subtype": a.account_subtype,
            "currency": a.currency,
        }
        for a in accounts
    ]


@router.get("/reference-docs/search")
async def search_reference_docs(
    doc_type: str = Query(...),
    q: str = Query(default=""),
    limit: int = Query(default=20, le=50),
    vu: VendorUser = Depends(require_permission("finance.view")),
    db: AsyncSession = Depends(get_db),
):
    """Typeahead for reference documents (PO / invoice / bill / payment)."""
    from app.models.procurement import PurchaseOrder
    from app.models.invoice import Invoice
    results = []

    if doc_type == "purchase_order":
        stmt = select(PurchaseOrder).where(
            PurchaseOrder.vendor_id == vu.vendor_id,
        )
        if q:
            stmt = stmt.where(PurchaseOrder.po_number.ilike(f"%{q}%"))
        r = await db.execute(stmt.limit(limit))
        for po in r.scalars().all():
            results.append({"id": str(po.id), "no": po.po_number, "label": f"{po.po_number}"})

    elif doc_type == "invoice":
        stmt = select(Invoice).where(Invoice.vendor_id == vu.vendor_id)
        if q:
            stmt = stmt.where(Invoice.invoice_number.ilike(f"%{q}%"))
        r = await db.execute(stmt.limit(limit))
        for inv in r.scalars().all():
            results.append({"id": str(inv.id), "no": inv.invoice_number, "label": f"{inv.invoice_number}"})

    elif doc_type in ("bill", "vendor_bill"):
        from app.models.finance import FinVendorBill
        stmt = select(FinVendorBill).where(FinVendorBill.vendor_id == vu.vendor_id)
        if q:
            stmt = stmt.where(FinVendorBill.bill_number.ilike(f"%{q}%"))
        r = await db.execute(stmt.limit(limit))
        for b in r.scalars().all():
            results.append({"id": str(b.id), "no": b.bill_number, "label": f"{b.bill_number}"})

    return results


@router.get("/trial-balance")
async def trial_balance(
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    vu: VendorUser = Depends(require_permission("finance.reports.view")),
    db: AsyncSession = Depends(get_db),
):
    today = date.today()
    data = await FinJournalRepo(db).trial_balance(
        vu.vendor_id,
        from_date or date(today.year, 4, 1),
        to_date or today,
    )
    return data


@router.get("/ledger/{account_id}")
async def account_ledger(
    account_id: UUID,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    vu: VendorUser = Depends(require_permission("finance.view")),
    db: AsyncSession = Depends(get_db),
):
    today = date.today()
    data = await FinJournalRepo(db).ledger_for_account(
        vu.vendor_id, account_id,
        from_date or date(today.year, 4, 1),
        to_date or today,
    )
    return data


@router.get("/ledger/party/{party_type}/{party_id}")
async def party_ledger(
    party_type: str,
    party_id: UUID,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    vu: VendorUser = Depends(require_permission("finance.view")),
    db: AsyncSession = Depends(get_db),
):
    """GL lines posted for a customer / supplier / employee / contractor / freelancer."""
    today = date.today()
    data = await FinJournalRepo(db).ledger_for_party(
        vu.vendor_id, party_type, party_id,
        from_date or date(today.year, 4, 1),
        to_date or today,
    )
    return data


@router.get("/ledger/cost-center/{cost_center_id}")
async def cost_center_ledger(
    cost_center_id: UUID,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    vu: VendorUser = Depends(require_permission("finance.view")),
    db: AsyncSession = Depends(get_db),
):
    """GL lines posted to a specific cost centre."""
    today = date.today()
    data = await FinJournalRepo(db).ledger_for_cost_center(
        vu.vendor_id, cost_center_id,
        from_date or date(today.year, 4, 1),
        to_date or today,
    )
    return data


@router.get("/ledger/summary")
async def ledger_summary(
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    account_type: Optional[str] = None,
    vu: VendorUser = Depends(require_permission("finance.view")),
    db: AsyncSession = Depends(get_db),
):
    """Aggregated debit/credit per account for all posted JEs in the period."""
    from app.models.finance import FinJournalLine, FinJournalEntry, FinAccount
    today = date.today()
    fd = from_date or date(today.year, 4, 1)
    td = to_date or today
    stmt = (
        select(
            FinAccount.id,
            FinAccount.code,
            FinAccount.name,
            FinAccount.account_type,
            FinAccount.account_subtype,
            func.coalesce(func.sum(FinJournalLine.debit), 0).label("total_debit"),
            func.coalesce(func.sum(FinJournalLine.credit), 0).label("total_credit"),
        )
        .join(FinJournalLine, FinJournalLine.account_id == FinAccount.id)
        .join(FinJournalEntry, FinJournalLine.journal_entry_id == FinJournalEntry.id)
        .where(
            FinAccount.vendor_id == vu.vendor_id,
            FinJournalEntry.status == "posted",
            FinJournalEntry.entry_date >= fd,
            FinJournalEntry.entry_date <= td,
        )
        .group_by(FinAccount.id, FinAccount.code, FinAccount.name, FinAccount.account_type, FinAccount.account_subtype)
        .order_by(FinAccount.code)
    )
    if account_type:
        stmt = stmt.where(FinAccount.account_type == account_type)
    r = await db.execute(stmt)
    rows = r.all()
    return [
        {
            "account_id": str(row.id),
            "code": row.code,
            "name": row.name,
            "account_type": row.account_type,
            "account_subtype": row.account_subtype,
            "total_debit": float(row.total_debit),
            "total_credit": float(row.total_credit),
            "net": float(row.total_debit - row.total_credit),
        }
        for row in rows
    ]


# ═══════════════════════════════════════════════════════════════════════════
# ACCOUNTS RECEIVABLE (AR)
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/ar/aging")
async def ar_aging(
    as_of: Optional[date] = None,
    vu: VendorUser = Depends(require_permission("finance.ar.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await FinARRepo(db).ar_aging(vu.vendor_id, as_of)


@router.post("/ar/apply-payment")
async def apply_payment(
    body: dict,
    vu: VendorUser = Depends(require_permission("finance.ar.manage")),
    db: AsyncSession = Depends(get_db),
):
    app = await FinARRepo(db).apply_payment(vu.vendor_id, body)
    await db.commit()
    return _d(app)


@router.get("/ar/applications")
async def list_payment_applications(
    invoice_id: Optional[UUID] = None,
    vu: VendorUser = Depends(require_permission("finance.ar.manage")),
    db: AsyncSession = Depends(get_db),
):
    apps = await FinARRepo(db).list_payment_applications(vu.vendor_id, invoice_id)
    return [_d(a) for a in apps]


# ═══════════════════════════════════════════════════════════════════════════
# ACCOUNTS PAYABLE (AP) — Vendor Bills
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/ap/bills")
async def list_bills(
    status: Optional[str] = None,
    supplier_id: Optional[UUID] = None,
    skip: int = 0, limit: int = 50,
    vu: VendorUser = Depends(require_permission("finance.ap.manage")),
    db: AsyncSession = Depends(get_db),
):
    bills = await FinAPRepo(db).list_bills(vu.vendor_id, status, supplier_id, skip, limit)
    return [_d(b) for b in bills]


@router.post("/ap/bills", status_code=201)
async def create_bill(
    body: dict,
    vu: VendorUser = Depends(require_permission("finance.ap.manage")),
    db: AsyncSession = Depends(get_db),
):
    repo = FinAPRepo(db)
    bill = await repo.create_bill(vu.vendor_id, body)
    await db.commit()
    return _d(bill)


@router.get("/ap/bills/{bill_id}")
async def get_bill(
    bill_id: UUID,
    vu: VendorUser = Depends(require_permission("finance.ap.manage")),
    db: AsyncSession = Depends(get_db),
):
    bill = await FinAPRepo(db).get_bill(bill_id, vu.vendor_id)
    if not bill:
        raise HTTPException(404, "Bill not found")
    result = _d(bill)
    result["lines"] = [_d(ln) for ln in bill.lines]
    return result


@router.put("/ap/bills/{bill_id}")
async def update_bill(
    bill_id: UUID, body: dict,
    vu: VendorUser = Depends(require_permission("finance.ap.manage")),
    db: AsyncSession = Depends(get_db),
):
    repo = FinAPRepo(db)
    bill = await repo.get_bill(bill_id, vu.vendor_id)
    if not bill:
        raise HTTPException(404, "Bill not found")
    bill = await repo.update_bill(bill, body)
    await db.commit()
    return _d(bill)


@router.post("/ap/bills/{bill_id}/post")
async def post_bill(
    bill_id: UUID,
    vu: VendorUser = Depends(require_permission("finance.ap.manage")),
    db: AsyncSession = Depends(get_db),
):
    repo = FinAPRepo(db)
    bill = await repo.get_bill(bill_id, vu.vendor_id)
    if not bill:
        raise HTTPException(404, "Bill not found")
    bill = await repo.post_bill(bill)
    # Auto-post to GL
    await post_event(db, vu.vendor_id, "vendor_bill", bill.id, {
        "subtotal": float(bill.subtotal or 0),
        "tax_amount": float(bill.tax_amount or 0),
        "total": float(bill.total or 0),
        "supplier_id": bill.supplier_id,
        "narration": f"Vendor Bill {bill.bill_no}",
    }, created_by_id=vu.id)
    await db.commit()
    return _d(bill)


@router.post("/ap/payments", status_code=201)
async def record_vendor_payment(
    body: dict,
    vu: VendorUser = Depends(require_permission("finance.ap.manage")),
    db: AsyncSession = Depends(get_db),
):
    repo = FinAPRepo(db)
    vp = await repo.record_vendor_payment(vu.vendor_id, body)
    await post_event(db, vu.vendor_id, "vendor_payment", vp.id, {
        "amount": float(vp.amount),
        "supplier_id": vp.supplier_id,
        "bank_account_gl_id": body.get("bank_account_gl_id"),
        "narration": f"Vendor Payment {vp.reference_no or ''}",
    }, created_by_id=vu.id)
    await db.commit()
    return _d(vp)


@router.get("/ap/aging")
async def ap_aging(
    as_of: Optional[date] = None,
    vu: VendorUser = Depends(require_permission("finance.ap.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await FinAPRepo(db).ap_aging(vu.vendor_id, as_of)


@router.get("/ap/payment-runs")
async def list_payment_runs(
    status: Optional[str] = None,
    vu: VendorUser = Depends(require_permission("finance.ap.manage")),
    db: AsyncSession = Depends(get_db),
):
    runs = await FinAPRepo(db).list_payment_runs(vu.vendor_id, status)
    return [_d(r) for r in runs]


@router.post("/ap/payment-runs", status_code=201)
async def create_payment_run(
    body: dict,
    vu: VendorUser = Depends(require_permission("finance.ap.manage")),
    db: AsyncSession = Depends(get_db),
):
    run = await FinAPRepo(db).create_payment_run(vu.vendor_id, body)
    await db.commit()
    return _d(run)


# ═══════════════════════════════════════════════════════════════════════════
# BANK / CASH
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/bank/accounts")
async def list_bank_accounts(
    vu: VendorUser = Depends(require_permission("finance.bank.manage")),
    db: AsyncSession = Depends(get_db),
):
    accounts = await FinBankRepo(db).list_bank_accounts(vu.vendor_id)
    return [_d(a) for a in accounts]


@router.post("/bank/accounts", status_code=201)
async def create_bank_account(
    body: dict,
    vu: VendorUser = Depends(require_permission("finance.bank.manage")),
    db: AsyncSession = Depends(get_db),
):
    acc = await FinBankRepo(db).create_bank_account(vu.vendor_id, body)
    await db.commit()
    return _d(acc)


@router.put("/bank/accounts/{ba_id}")
async def update_bank_account(
    ba_id: UUID, body: dict,
    vu: VendorUser = Depends(require_permission("finance.bank.manage")),
    db: AsyncSession = Depends(get_db),
):
    repo = FinBankRepo(db)
    acc = await repo.get_bank_account(ba_id, vu.vendor_id)
    if not acc:
        raise HTTPException(404, "Bank account not found")
    acc = await repo.update_bank_account(acc, body)
    await db.commit()
    return _d(acc)


@router.get("/bank/statements")
async def list_statements(
    bank_account_id: Optional[UUID] = None,
    vu: VendorUser = Depends(require_permission("finance.bank.manage")),
    db: AsyncSession = Depends(get_db),
):
    stmts = await FinBankRepo(db).list_statements(vu.vendor_id, bank_account_id)
    return [_d(s) for s in stmts]


@router.post("/bank/statements", status_code=201)
async def create_statement(
    body: dict,
    vu: VendorUser = Depends(require_permission("finance.bank.manage")),
    db: AsyncSession = Depends(get_db),
):
    stmt = await FinBankRepo(db).create_statement(vu.vendor_id, body)
    await db.commit()
    return _d(stmt)


@router.post("/bank/statements/upload-csv")
async def upload_statement_csv(
    bank_account_id: UUID,
    file: UploadFile = File(...),
    vu: VendorUser = Depends(require_permission("finance.bank.manage")),
    db: AsyncSession = Depends(get_db),
):
    """Parse a CSV bank statement and create lines."""
    content = await file.read()
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    lines = []
    for row in reader:
        # Try common column names
        txn_date = row.get("Date") or row.get("date") or row.get("Transaction Date", "")
        desc = row.get("Description") or row.get("Narration") or row.get("description", "")
        debit = float(row.get("Debit", 0) or row.get("debit", 0) or 0)
        credit = float(row.get("Credit", 0) or row.get("credit", 0) or 0)
        bal = float(row.get("Balance", 0) or row.get("balance", 0) or 0)
        if txn_date:
            lines.append({
                "transaction_date": txn_date,
                "description": desc,
                "debit": debit,
                "credit": credit,
                "balance": bal,
            })
    data = {
        "bank_account_id": str(bank_account_id),
        "statement_date": str(date.today()),
        "source": "csv",
        "lines": lines,
    }
    stmt = await FinBankRepo(db).create_statement(vu.vendor_id, data)
    await db.commit()
    return {"statement_id": str(stmt.id), "lines_imported": len(lines)}


@router.get("/bank/reconciliations")
async def list_reconciliations(
    bank_account_id: Optional[UUID] = None,
    vu: VendorUser = Depends(require_permission("finance.bank.reconcile")),
    db: AsyncSession = Depends(get_db),
):
    recs = await FinBankRepo(db).list_reconciliations(vu.vendor_id, bank_account_id)
    return [_d(r) for r in recs]


@router.post("/bank/reconciliations", status_code=201)
async def create_reconciliation(
    body: dict,
    vu: VendorUser = Depends(require_permission("finance.bank.reconcile")),
    db: AsyncSession = Depends(get_db),
):
    rec = await FinBankRepo(db).create_reconciliation(vu.vendor_id, body)
    await db.commit()
    return _d(rec)


@router.post("/bank/reconciliations/{rec_id}/auto-match")
async def auto_match_reconciliation(
    rec_id: UUID,
    body: dict,
    vu: VendorUser = Depends(require_permission("finance.bank.reconcile")),
    db: AsyncSession = Depends(get_db),
):
    matches = await FinBankRepo(db).auto_match(
        vu.vendor_id, rec_id, body.get("bank_account_id"))
    await db.commit()
    return {"matched": len(matches)}


# ═══════════════════════════════════════════════════════════════════════════
# BUDGETS & FORECASTS
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/budgets")
async def list_budgets(
    fy_id: Optional[UUID] = None,
    vu: VendorUser = Depends(require_permission("finance.budget.manage")),
    db: AsyncSession = Depends(get_db),
):
    budgets = await FinBudgetRepo(db).list_budgets(vu.vendor_id, fy_id)
    return [_d(b) for b in budgets]


@router.post("/budgets", status_code=201)
async def create_budget(
    body: dict,
    vu: VendorUser = Depends(require_permission("finance.budget.manage")),
    db: AsyncSession = Depends(get_db),
):
    b = await FinBudgetRepo(db).create_budget(vu.vendor_id, body)
    await db.commit()
    return _d(b)


@router.put("/budgets/{budget_id}")
async def update_budget(
    budget_id: UUID, body: dict,
    vu: VendorUser = Depends(require_permission("finance.budget.manage")),
    db: AsyncSession = Depends(get_db),
):
    repo = FinBudgetRepo(db)
    b = await repo.get_budget(budget_id, vu.vendor_id)
    if not b:
        raise HTTPException(404, "Budget not found")
    b = await repo.update_budget(b, body)
    await db.commit()
    return _d(b)


@router.get("/budgets/{budget_id}/variance")
async def budget_variance(
    budget_id: UUID,
    vu: VendorUser = Depends(require_permission("finance.budget.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await FinBudgetRepo(db).budget_variance(vu.vendor_id, budget_id)


@router.get("/forecasts")
async def list_forecasts(
    vu: VendorUser = Depends(require_permission("finance.budget.manage")),
    db: AsyncSession = Depends(get_db),
):
    forecasts = await FinBudgetRepo(db).list_forecasts(vu.vendor_id)
    return [_d(f) for f in forecasts]


@router.post("/forecasts", status_code=201)
async def create_forecast(
    body: dict,
    vu: VendorUser = Depends(require_permission("finance.budget.manage")),
    db: AsyncSession = Depends(get_db),
):
    f = await FinBudgetRepo(db).create_forecast(vu.vendor_id, body)
    await db.commit()
    return _d(f)


# ═══════════════════════════════════════════════════════════════════════════
# FIXED ASSETS
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/assets/categories")
async def list_asset_categories(
    vu: VendorUser = Depends(require_permission("finance.assets.manage")),
    db: AsyncSession = Depends(get_db),
):
    cats = await FinAssetRepo(db).list_categories(vu.vendor_id)
    return [_d(c) for c in cats]


@router.post("/assets/categories", status_code=201)
async def create_asset_category(
    body: dict,
    vu: VendorUser = Depends(require_permission("finance.assets.manage")),
    db: AsyncSession = Depends(get_db),
):
    cat = await FinAssetRepo(db).create_category(vu.vendor_id, body)
    await db.commit()
    return _d(cat)


@router.get("/assets")
async def list_assets(
    status: Optional[str] = None,
    category_id: Optional[UUID] = None,
    vu: VendorUser = Depends(require_permission("finance.assets.manage")),
    db: AsyncSession = Depends(get_db),
):
    assets = await FinAssetRepo(db).list_assets(vu.vendor_id, status, category_id)
    return [_d(a) for a in assets]


@router.post("/assets", status_code=201)
async def create_asset(
    body: dict,
    vu: VendorUser = Depends(require_permission("finance.assets.manage")),
    db: AsyncSession = Depends(get_db),
):
    repo = FinAssetRepo(db)
    asset = await repo.create_asset(vu.vendor_id, body)
    # Post GL entry for acquisition
    await post_event(db, vu.vendor_id, "asset", asset.id, {
        "cost": float(asset.purchase_cost),
        "narration": f"Asset Acquisition: {asset.name}",
    }, created_by_id=vu.id)
    await db.commit()
    return _d(asset)


@router.get("/assets/{asset_id}")
async def get_asset(
    asset_id: UUID,
    vu: VendorUser = Depends(require_permission("finance.assets.manage")),
    db: AsyncSession = Depends(get_db),
):
    asset = await FinAssetRepo(db).get_asset(asset_id, vu.vendor_id)
    if not asset:
        raise HTTPException(404, "Asset not found")
    result = _d(asset)
    result["depreciation_entries"] = [_d(e) for e in asset.depreciation_entries]
    result["maintenance_records"] = [_d(m) for m in asset.maintenance_records]
    return result


@router.put("/assets/{asset_id}")
async def update_asset(
    asset_id: UUID, body: dict,
    vu: VendorUser = Depends(require_permission("finance.assets.manage")),
    db: AsyncSession = Depends(get_db),
):
    repo = FinAssetRepo(db)
    asset = await repo.get_asset(asset_id, vu.vendor_id)
    if not asset:
        raise HTTPException(404, "Asset not found")
    asset = await repo.update_asset(asset, body)
    await db.commit()
    return _d(asset)


@router.post("/assets/{asset_id}/depreciate")
async def run_depreciation(
    asset_id: UUID,
    vu: VendorUser = Depends(require_permission("finance.assets.manage")),
    db: AsyncSession = Depends(get_db),
):
    repo = FinAssetRepo(db)
    asset = await repo.get_asset(asset_id, vu.vendor_id)
    if not asset:
        raise HTTPException(404, "Asset not found")
    if asset.status != "active":
        raise HTTPException(400, "Asset is not active")
    amount = await repo.calculate_depreciation(asset)
    je = await post_event(db, vu.vendor_id, "depreciation", asset.id, {
        "amount": float(amount),
        "narration": f"Depreciation: {asset.name}",
    }, created_by_id=vu.id)
    entry = await repo.record_depreciation(vu.vendor_id, asset, amount,
                                            je_id=je.id if je else None)
    await db.commit()
    return {"amount": float(amount), "book_value": float(asset.current_value or 0)}


@router.post("/assets/{asset_id}/dispose")
async def dispose_asset(
    asset_id: UUID, body: dict,
    vu: VendorUser = Depends(require_permission("finance.assets.manage")),
    db: AsyncSession = Depends(get_db),
):
    repo = FinAssetRepo(db)
    asset = await repo.get_asset(asset_id, vu.vendor_id)
    if not asset:
        raise HTTPException(404, "Asset not found")
    je = await post_event(db, vu.vendor_id, "disposal", asset.id, {
        "purchase_cost": float(asset.purchase_cost or 0),
        "accum_dep": float(asset.accumulated_depreciation or 0),
        "sale_price": float(body.get("sale_price", 0)),
        "narration": f"Asset Disposal: {asset.name}",
    }, created_by_id=vu.id)
    disposal = await repo.dispose_asset(vu.vendor_id, asset, body,
                                         je_id=je.id if je else None)
    await db.commit()
    return _d(disposal)


@router.get("/assets/maintenance")
async def list_maintenance(
    asset_id: Optional[UUID] = None,
    vu: VendorUser = Depends(require_permission("finance.assets.manage")),
    db: AsyncSession = Depends(get_db),
):
    records = await FinAssetRepo(db).list_maintenance(vu.vendor_id, asset_id)
    return [_d(r) for r in records]


@router.post("/assets/maintenance", status_code=201)
async def create_maintenance(
    body: dict,
    vu: VendorUser = Depends(require_permission("finance.assets.manage")),
    db: AsyncSession = Depends(get_db),
):
    m = await FinAssetRepo(db).create_maintenance(vu.vendor_id, body)
    await db.commit()
    return _d(m)


# ═══════════════════════════════════════════════════════════════════════════
# TAX
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/tax/codes")
async def list_tax_codes(
    vu: VendorUser = Depends(require_permission("finance.tax.manage")),
    db: AsyncSession = Depends(get_db),
):
    codes = await FinTaxRepo(db).list_tax_codes(vu.vendor_id)
    return [_d(c) for c in codes]


@router.post("/tax/codes", status_code=201)
async def create_tax_code(
    body: dict,
    vu: VendorUser = Depends(require_permission("finance.tax.manage")),
    db: AsyncSession = Depends(get_db),
):
    tc = await FinTaxRepo(db).create_tax_code(vu.vendor_id, body)
    await db.commit()
    return _d(tc)


@router.get("/tax/returns")
async def list_tax_returns(
    return_type: Optional[str] = None,
    vu: VendorUser = Depends(require_permission("finance.tax.manage")),
    db: AsyncSession = Depends(get_db),
):
    returns = await FinTaxRepo(db).list_returns(vu.vendor_id, return_type)
    return [_d(r) for r in returns]


@router.post("/tax/returns", status_code=201)
async def create_tax_return(
    body: dict,
    vu: VendorUser = Depends(require_permission("finance.tax.manage")),
    db: AsyncSession = Depends(get_db),
):
    tr = await FinTaxRepo(db).create_return(vu.vendor_id, body)
    await db.commit()
    return _d(tr)


@router.post("/tax/returns/{tr_id}/compute")
async def compute_tax_return(
    tr_id: UUID,
    vu: VendorUser = Depends(require_permission("finance.tax.manage")),
    db: AsyncSession = Depends(get_db),
):
    repo = FinTaxRepo(db)
    tr = await repo.get_return(tr_id, vu.vendor_id)
    if not tr:
        raise HTTPException(404, "Tax return not found")
    if tr.return_type in ("GSTR1",):
        computed = await repo.compute_gstr1(vu.vendor_id, tr.period_start, tr.period_end)
    elif tr.return_type in ("GSTR3B",):
        computed = await repo.compute_gstr3b(vu.vendor_id, tr.period_start, tr.period_end)
    else:
        computed = {"note": "Manual computation required for this return type"}
    tr = await repo.update_return(tr, {"status": "computed", "computed_json": computed,
                                       "total_tax_liability": computed.get("outward_tax_liability", 0),
                                       "total_itc": computed.get("inward_itc", 0),
                                       "net_payable": computed.get("net_payable", 0)})
    await db.commit()
    return {"computed": computed}


@router.post("/tax/returns/{tr_id}/file")
async def file_tax_return(
    tr_id: UUID, body: dict,
    vu: VendorUser = Depends(require_permission("finance.tax.file")),
    db: AsyncSession = Depends(get_db),
):
    repo = FinTaxRepo(db)
    tr = await repo.get_return(tr_id, vu.vendor_id)
    if not tr:
        raise HTTPException(404, "Tax return not found")
    tr = await repo.update_return(tr, {
        "status": "filed",
        "filing_reference": body.get("filing_reference"),
        "filed_at": datetime.utcnow(),
        "filed_by_id": vu.id,
    })
    await db.commit()
    return _d(tr)


# ═══════════════════════════════════════════════════════════════════════════
# REPORTS
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/reports/profit-loss")
async def profit_loss(
    from_date: date = Query(...),
    to_date: date = Query(...),
    vu: VendorUser = Depends(require_permission("finance.reports.view")),
    db: AsyncSession = Depends(get_db),
):
    return await FinReportRepo(db).profit_and_loss(vu.vendor_id, from_date, to_date)


@router.get("/reports/balance-sheet")
async def balance_sheet(
    as_of: date = Query(default=None),
    vu: VendorUser = Depends(require_permission("finance.reports.view")),
    db: AsyncSession = Depends(get_db),
):
    return await FinReportRepo(db).balance_sheet(vu.vendor_id, as_of or date.today())


@router.get("/reports/cash-flow")
async def cash_flow(
    from_date: date = Query(...),
    to_date: date = Query(...),
    vu: VendorUser = Depends(require_permission("finance.reports.view")),
    db: AsyncSession = Depends(get_db),
):
    return await FinReportRepo(db).cash_flow(vu.vendor_id, from_date, to_date)


@router.get("/reports/cost-analysis")
async def cost_analysis(
    from_date: date = Query(...),
    to_date: date = Query(...),
    vu: VendorUser = Depends(require_permission("finance.reports.view")),
    db: AsyncSession = Depends(get_db),
):
    return await FinReportRepo(db).cost_analysis(vu.vendor_id, from_date, to_date)


@router.get("/reports/dashboard")
async def finance_dashboard(
    vu: VendorUser = Depends(require_permission("finance.view")),
    db: AsyncSession = Depends(get_db),
):
    """Key metrics for the Finance Dashboard."""
    today = date.today()
    from_date = date(today.year if today.month >= 4 else today.year - 1, 4, 1)
    pnl = await FinReportRepo(db).profit_and_loss(vu.vendor_id, from_date, today)
    ar_aging = await FinARRepo(db).ar_aging(vu.vendor_id, today)
    ap_aging = await FinAPRepo(db).ap_aging(vu.vendor_id, today)
    bank_accounts = await FinBankRepo(db).list_bank_accounts(vu.vendor_id)
    total_cash = sum(float(a.current_balance or 0) for a in bank_accounts)
    total_ar = sum(r.get("current", 0) + r.get("1_30", 0) + r.get("31_60", 0) +
                  r.get("61_90", 0) + r.get("90_plus", 0) for r in ar_aging)
    total_ap = sum(r.get("current", 0) + r.get("1_30", 0) + r.get("31_60", 0) +
                  r.get("61_90", 0) + r.get("90_plus", 0) for r in ap_aging)
    return {
        "total_revenue": pnl.get("total_income", 0),
        "total_expenses": pnl.get("total_expenses", 0),
        "net_profit": pnl.get("net_profit", 0),
        "cash_position": total_cash,
        "total_ar_outstanding": total_ar,
        "total_ap_outstanding": total_ap,
        "period": f"{from_date} to {today}",
    }


# ═══════════════════════════════════════════════════════════════════════════
# CAPITAL — Loans & Investments
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/capital/loans")
async def list_loans(
    status: Optional[str] = None,
    vu: VendorUser = Depends(require_permission("finance.capital.manage")),
    db: AsyncSession = Depends(get_db),
):
    loans = await FinCapitalRepo(db).list_loans(vu.vendor_id, status)
    return [_d(l) for l in loans]


@router.post("/capital/loans", status_code=201)
async def create_loan(
    body: dict,
    vu: VendorUser = Depends(require_permission("finance.capital.manage")),
    db: AsyncSession = Depends(get_db),
):
    repo = FinCapitalRepo(db)
    loan = await repo.create_loan(vu.vendor_id, body)
    if body.get("generate_schedule"):
        await repo.generate_schedule(loan)
    # Post GL for disbursement
    await post_event(db, vu.vendor_id, "loan", loan.id, {
        "event": "disbursement",
        "principal": float(loan.principal),
        "loan_account_id": str(loan.gl_account_id) if loan.gl_account_id else None,
        "narration": f"Loan Disbursement: {loan.name}",
    }, created_by_id=vu.id)
    await db.commit()
    return _d(loan)


@router.get("/capital/loans/{loan_id}")
async def get_loan(
    loan_id: UUID,
    vu: VendorUser = Depends(require_permission("finance.capital.manage")),
    db: AsyncSession = Depends(get_db),
):
    loan = await FinCapitalRepo(db).get_loan(loan_id, vu.vendor_id)
    if not loan:
        raise HTTPException(404, "Loan not found")
    result = _d(loan)
    result["schedule"] = [_d(s) for s in loan.schedule_lines]
    return result


@router.post("/capital/loans/{loan_id}/generate-schedule")
async def generate_loan_schedule(
    loan_id: UUID,
    vu: VendorUser = Depends(require_permission("finance.capital.manage")),
    db: AsyncSession = Depends(get_db),
):
    repo = FinCapitalRepo(db)
    loan = await repo.get_loan(loan_id, vu.vendor_id)
    if not loan:
        raise HTTPException(404, "Loan not found")
    lines = await repo.generate_schedule(loan)
    await db.commit()
    return {"schedule_lines": len(lines)}


@router.get("/capital/investments")
async def list_investments(
    status: Optional[str] = None,
    vu: VendorUser = Depends(require_permission("finance.capital.manage")),
    db: AsyncSession = Depends(get_db),
):
    investments = await FinCapitalRepo(db).list_investments(vu.vendor_id, status)
    return [_d(i) for i in investments]


@router.post("/capital/investments", status_code=201)
async def create_investment(
    body: dict,
    vu: VendorUser = Depends(require_permission("finance.capital.manage")),
    db: AsyncSession = Depends(get_db),
):
    inv = await FinCapitalRepo(db).create_investment(vu.vendor_id, body)
    await db.commit()
    return _d(inv)


@router.post("/capital/investments/{inv_id}/valuations", status_code=201)
async def add_valuation(
    inv_id: UUID, body: dict,
    vu: VendorUser = Depends(require_permission("finance.capital.manage")),
    db: AsyncSession = Depends(get_db),
):
    val = await FinCapitalRepo(db).add_valuation(vu.vendor_id, inv_id, body)
    await db.commit()
    return _d(val)


@router.get("/capital/investments/{inv_id}/roi")
async def investment_roi(
    inv_id: UUID,
    vu: VendorUser = Depends(require_permission("finance.capital.manage")),
    db: AsyncSession = Depends(get_db),
):
    repo = FinCapitalRepo(db)
    investments = await repo.list_investments(vu.vendor_id)
    inv = next((i for i in investments if i.id == inv_id), None)
    if not inv:
        raise HTTPException(404, "Investment not found")
    return repo.calculate_roi(
        float(inv.amount_invested),
        float(inv.current_value or inv.amount_invested),
        inv.investment_date,
    )


# ═══════════════════════════════════════════════════════════════════════════
# INTERNAL CONTROLS & APPROVAL WORKFLOWS
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/controls/policies")
async def list_policies(
    vu: VendorUser = Depends(require_permission("finance.controls.manage")),
    db: AsyncSession = Depends(get_db),
):
    policies = await FinControlsRepo(db).list_policies(vu.vendor_id)
    return [_d(p) for p in policies]


@router.post("/controls/policies", status_code=201)
async def create_policy(
    body: dict,
    vu: VendorUser = Depends(require_permission("finance.controls.manage")),
    db: AsyncSession = Depends(get_db),
):
    p = await FinControlsRepo(db).create_policy(vu.vendor_id, body)
    await db.commit()
    return _d(p)


@router.get("/controls/approvals")
async def list_approvals(
    status: Optional[str] = None,
    entity_type: Optional[str] = None,
    vu: VendorUser = Depends(require_permission("finance.controls.approve")),
    db: AsyncSession = Depends(get_db),
):
    requests = await FinControlsRepo(db).list_requests(vu.vendor_id, status, entity_type)
    return [_d(r) for r in requests]


@router.post("/controls/approvals", status_code=201)
async def create_approval_request(
    body: dict,
    vu: VendorUser = Depends(require_permission("finance.view")),
    db: AsyncSession = Depends(get_db),
):
    body["requested_by_id"] = str(vu.id)
    req = await FinControlsRepo(db).create_request(vu.vendor_id, body)
    await db.commit()
    return _d(req)


@router.post("/controls/approvals/{req_id}/approve")
async def approve_request(
    req_id: UUID, body: dict,
    vu: VendorUser = Depends(require_permission("finance.controls.approve")),
    db: AsyncSession = Depends(get_db),
):
    repo = FinControlsRepo(db)
    requests = await repo.list_requests(vu.vendor_id)
    req = next((r for r in requests if r.id == req_id), None)
    if not req:
        raise HTTPException(404, "Approval request not found")
    req = await repo.action_step(req, body.get("step", 1), vu.id, "approved",
                                  body.get("comments"))
    await db.commit()
    return _d(req)


@router.post("/controls/approvals/{req_id}/reject")
async def reject_request(
    req_id: UUID, body: dict,
    vu: VendorUser = Depends(require_permission("finance.controls.approve")),
    db: AsyncSession = Depends(get_db),
):
    repo = FinControlsRepo(db)
    requests = await repo.list_requests(vu.vendor_id)
    req = next((r for r in requests if r.id == req_id), None)
    if not req:
        raise HTTPException(404, "Approval request not found")
    req = await repo.action_step(req, body.get("step", 1), vu.id, "rejected",
                                  body.get("comments"))
    await db.commit()
    return _d(req)


@router.get("/audit-log")
async def audit_log(
    entity_type: Optional[str] = None,
    entity_id: Optional[UUID] = None,
    skip: int = 0, limit: int = 100,
    vu: VendorUser = Depends(require_permission("finance.audit.view")),
    db: AsyncSession = Depends(get_db),
):
    logs = await FinControlsRepo(db).list_audit_logs(
        vu.vendor_id, entity_type, entity_id, skip, limit)
    return [_d(l) for l in logs]


# ─────────────────────────────────────────────────────────────────────────────
# BASIC TRANSACTIONS — simplified finance for small / basic users
# ─────────────────────────────────────────────────────────────────────────────

from app.models.finance import FinBasicTransaction
from datetime import date as _date


class BasicTxnCreate(BaseModel):
    txn_type: str           # income | expense | salary | transfer
    category: str
    amount: float
    txn_date: _date
    description: Optional[str] = None
    payment_method: Optional[str] = None
    reference: Optional[str] = None


class BasicTxnUpdate(BaseModel):
    txn_type: Optional[str] = None
    category: Optional[str] = None
    amount: Optional[float] = None
    txn_date: Optional[_date] = None
    description: Optional[str] = None
    payment_method: Optional[str] = None
    reference: Optional[str] = None


@router.get("/basic-transactions")
async def list_basic_transactions(
    txn_type: Optional[str] = None,
    skip: int = 0,
    limit: int = Query(200, le=500),
    vu: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(FinBasicTransaction).where(
        FinBasicTransaction.vendor_id == vu.vendor_id
    )
    if txn_type:
        q = q.where(FinBasicTransaction.txn_type == txn_type)
    q = q.order_by(FinBasicTransaction.txn_date.desc(), FinBasicTransaction.created_at.desc())
    q = q.offset(skip).limit(limit)
    result = await db.execute(q)
    return [_d(r) for r in result.scalars().all()]


@router.post("/basic-transactions", status_code=201)
async def create_basic_transaction(
    body: BasicTxnCreate,
    vu: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    txn = FinBasicTransaction(
        vendor_id=vu.vendor_id,
        txn_type=body.txn_type,
        category=body.category,
        amount=body.amount,
        txn_date=body.txn_date,
        description=body.description,
        payment_method=body.payment_method,
        reference=body.reference,
    )
    db.add(txn)
    await db.commit()
    await db.refresh(txn)
    return _d(txn)


@router.patch("/basic-transactions/{txn_id}")
async def update_basic_transaction(
    txn_id: UUID,
    body: BasicTxnUpdate,
    vu: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(FinBasicTransaction).where(
            FinBasicTransaction.id == txn_id,
            FinBasicTransaction.vendor_id == vu.vendor_id,
        )
    )
    txn = result.scalar_one_or_none()
    if not txn:
        raise HTTPException(404, "Transaction not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(txn, field, value)
    await db.commit()
    await db.refresh(txn)
    return _d(txn)


@router.delete("/basic-transactions/{txn_id}", status_code=204)
async def delete_basic_transaction(
    txn_id: UUID,
    vu: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(FinBasicTransaction).where(
            FinBasicTransaction.id == txn_id,
            FinBasicTransaction.vendor_id == vu.vendor_id,
        )
    )
    txn = result.scalar_one_or_none()
    if not txn:
        raise HTTPException(404, "Transaction not found")
    await db.delete(txn)
    await db.commit()
