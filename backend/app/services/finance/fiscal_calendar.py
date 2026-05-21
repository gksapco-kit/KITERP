"""
Fiscal year templates and period generation (standard monthly + optional audit windows).

Audit / adjustment windows are post-close: they must start after the fiscal
year’s end date so normal months can be locked while that window remains open
for back-dated document posting.

Posting prefers an *audit* period over a *standard* period when a posting date
falls in both (same-day windows).
"""
from __future__ import annotations

import calendar
import uuid
from datetime import date
from typing import List, Optional, Tuple, Set
from uuid import UUID

from sqlalchemy import and_, func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.finance import FinFiscalYear, FinFiscalYearCompany, FinPeriod
from app.schemas.finance.fiscal import AuditPeriodAdd, AuditPeriodIn, FiscalYearTemplatedCreate


def fiscal_year_bounds(
    template: str,
    year_anchor: int,
) -> Tuple[date, date, str]:
    """
    year_anchor: for jan_dec, calendar year; for jul_jun/apr_mar, the first year
    of the conventional FY label (e.g. 2026 for FY 2026-27).
    """
    if template == "jan_dec":
        s = date(year_anchor, 1, 1)
        e = date(year_anchor, 12, 31)
        return s, e, f"FY {year_anchor}"
    if template == "jul_jun":
        s = date(year_anchor, 7, 1)
        e = date(year_anchor + 1, 6, 30)
        return s, e, f"FY {year_anchor}-{str(year_anchor + 1)[2:]}"
    if template == "apr_mar":
        s = date(year_anchor, 4, 1)
        e = date(year_anchor + 1, 3, 31)
        return s, e, f"FY {year_anchor}-{str(year_anchor + 1)[2:]}"
    raise ValueError(f"Unknown template: {template}")


def iter_month_periods_in_range(fy_start: date, fy_end: date) -> List[Tuple[date, date, int, str]]:
    """
    One standard period per calendar month overlapping [fy_start, fy_end] (inclusive),
    with partial months at the ends if needed. Returns
    (seg_start, seg_end, period_number, label).
    """
    out: List[Tuple[date, date, int, str]] = []
    y, m = fy_start.year, fy_start.month
    n = 0
    while True:
        first = date(y, m, 1)
        last_day = calendar.monthrange(y, m)[1]
        last = date(y, m, last_day)
        if first > fy_end:
            break
        seg_a = max(first, fy_start)
        seg_b = min(last, fy_end)
        if seg_a <= seg_b:
            n += 1
            label = first.strftime("%b %Y")
            out.append((seg_a, seg_b, n, label))
        if last > fy_end:
            break
        if m == 12:
            y, m = y + 1, 1
        else:
            m += 1
    return out


async def any_fy_overlaps(
    db: AsyncSession,
    vendor_id: UUID,
    company_id: UUID,
    start: date,
    end: date,
    exclude_fy_id: Optional[UUID] = None,
) -> bool:
    f = await find_overlapping_fiscal_year(
        db, vendor_id, company_id, start, end, exclude_fy_id
    )
    return f is not None


async def find_overlapping_fiscal_year(
    db: AsyncSession,
    vendor_id: UUID,
    company_id: UUID,
    start: date,
    end: date,
    exclude_fy_id: Optional[UUID] = None,
) -> Optional[FinFiscalYear]:
    q = (
        select(FinFiscalYear)
        .join(
            FinFiscalYearCompany,
            and_(
                FinFiscalYearCompany.fiscal_year_id == FinFiscalYear.id,
                FinFiscalYearCompany.company_id == company_id,
            ),
        )
        .where(
            FinFiscalYear.vendor_id == vendor_id,
            FinFiscalYear.start_date <= end,
            FinFiscalYear.end_date >= start,
        )
    )
    if exclude_fy_id:
        q = q.where(FinFiscalYear.id != exclude_fy_id)
    r = await db.execute(q.limit(1))
    return r.scalar_one_or_none()


async def find_fiscal_year_by_variant(
    db: AsyncSession,
    vendor_id: UUID,
    variant_code: str,
) -> Optional[FinFiscalYear]:
    r = await db.execute(
        select(FinFiscalYear).where(
            FinFiscalYear.vendor_id == vendor_id,
            FinFiscalYear.variant_code == variant_code,
        ).limit(1)
    )
    return r.scalar_one_or_none()


async def clear_current_fiscal_years(
    db: AsyncSession, vendor_id: UUID, company_id: UUID
) -> None:
    await db.execute(
        update(FinFiscalYearCompany)
        .where(
            FinFiscalYearCompany.vendor_id == vendor_id,
            FinFiscalYearCompany.company_id == company_id,
            FinFiscalYearCompany.is_current.is_(True),  # noqa: E712
        )
        .values(is_current=False)
    )


async def max_period_number_for_fy(
    db: AsyncSession, vendor_id: UUID, fy_id: UUID
) -> int:
    r = await db.execute(
        select(func.coalesce(func.max(FinPeriod.period_number), 0)).where(
            FinPeriod.vendor_id == vendor_id,
            FinPeriod.fiscal_year_id == fy_id,
        )
    )
    v = r.scalar() or 0
    return int(v)


def _audit_period_numbers_start(next_after: int) -> int:
    return 13 if next_after <= 12 else next_after + 1


def expand_audit_periods_to_monthly(audits: List[AuditPeriodIn]) -> List[AuditPeriodIn]:
    """
    One audit date range is stored as one FinPeriod per calendar month (inclusive of partial months
    at the start/end, same rules as standard monthly periods). A single month range is unchanged.
    """
    out: List[AuditPeriodIn] = []
    for a in audits:
        segs = iter_month_periods_in_range(a.start_date, a.end_date)
        if len(segs) <= 1:
            out.append(a)
            continue
        for seg_start, seg_end, _n, mlabel in segs:
            nm = _short_audit_subperiod_name(a.name, mlabel)
            out.append(AuditPeriodIn(name=nm, start_date=seg_start, end_date=seg_end))
    return out


def _short_audit_subperiod_name(base: str, month_label: str) -> str:
    b = (base or "Audit").strip()
    s = f"{b} {month_label}"
    if len(s) <= 30:
        return s
    # Keep month label; trim base.
    keep = 30 - 1 - len(month_label)
    if keep < 1:
        return month_label[:30]
    return f"{b[:keep].rstrip()} {month_label}"[:30]


def _audit_window_fully_after_fy_close(apy: AuditPeriodIn, fy_end: date) -> bool:
    if apy.end_date < apy.start_date:
        return False
    return apy.start_date > fy_end


def validate_audit_periods_against_fy(
    audits: List[AuditPeriodIn],
    fy_start: date,
    fy_end: date,
) -> None:
    """Raises ValueError if an audit window is not entirely after the FY end (post-close window)."""
    for a in audits:
        if a.end_date < a.start_date:
            raise ValueError(
                f"Audit / adjustment period \"{a.name}\": end_date must be on or after start_date."
            )
        if _audit_window_fully_after_fy_close(a, fy_end):
            continue
        raise ValueError(
            f"Audit / adjustment period \"{a.name}\" ({a.start_date} to {a.end_date}) must lie "
            f"entirely after this fiscal year closes (after {fy_end}; FY {fy_start} to {fy_end}). "
            "Open that window from the first day after the fiscal year end so standard periods in that year can "
            "stay closed while entries use this open range for GL (document dates may still fall in the closed year)."
        )


async def set_fy_company_assignments(
    db: AsyncSession,
    vendor_id: UUID,
    fy: FinFiscalYear,
    company_ids: List[UUID],
    *,
    mark_current: bool,
) -> None:
    """Link the same fiscal year (shared calendar) to one or more business units."""
    seen: Set[UUID] = set()
    ordered: List[UUID] = []
    for cid in company_ids:
        if cid not in seen:
            seen.add(cid)
            ordered.append(cid)
    if mark_current:
        for cid in ordered:
            await clear_current_fiscal_years(db, vendor_id, cid)
    for cid in ordered:
        db.add(
            FinFiscalYearCompany(
                id=uuid.uuid4(),
                vendor_id=vendor_id,
                fiscal_year_id=fy.id,
                company_id=cid,
                is_current=mark_current,
            )
        )
    await db.flush()


async def build_standard_periods(
    db: AsyncSession,
    vendor_id: UUID,
    fy: FinFiscalYear,
) -> None:
    segs = iter_month_periods_in_range(fy.start_date, fy.end_date)
    for seg_start, seg_end, pnum, label in segs:
        p = FinPeriod(
            id=uuid.uuid4(),
            vendor_id=vendor_id,
            fiscal_year_id=fy.id,
            name=label,
            start_date=seg_start,
            end_date=seg_end,
            period_number=pnum,
            period_kind="standard",
            status="open",
        )
        db.add(p)
    await db.flush()


def _audit_spans_multiple_calendar_months(sd: date, ed: date) -> bool:
    if ed < sd:
        return False
    segs = iter_month_periods_in_range(sd, ed)
    return len(segs) > 1


async def repair_wide_audit_periods_for_fiscal_year(
    db: AsyncSession,
    vendor_id: UUID,
    fy_id: UUID,
) -> int:
    """
    One-time/legacy repair: split fin_period rows (audit) that still span more than one
    calendar month into one row per month, matching :func:`expand_audit_periods_to_monthly`.
    Returns how many *new* period rows were inserted.
    """
    r = await db.execute(
        select(FinPeriod)
        .where(
            FinPeriod.vendor_id == vendor_id,
            FinPeriod.fiscal_year_id == fy_id,
            FinPeriod.period_kind == "audit",
        )
        .order_by(FinPeriod.period_number)
    )
    jobs = [p for p in r.scalars().all() if _audit_spans_multiple_calendar_months(p.start_date, p.end_date)]
    if not jobs:
        return 0
    # Same fiscal year, ascending period_number (shift later numbers before inserting in the gap)
    inserted = 0
    for ref in jobs:
        r0 = await db.execute(
            select(FinPeriod).where(FinPeriod.id == ref.id, FinPeriod.vendor_id == vendor_id)
        )
        cur = r0.scalar_one_or_none()
        if not cur or (cur.period_kind or "standard") != "audit":
            continue
        segs = iter_month_periods_in_range(cur.start_date, cur.end_date)
        if len(segs) <= 1:
            continue
        pnum = int(cur.period_number or 0)
        off = len(segs) - 1
        name_base = (cur.name or "Audit").strip()
        s0, e0, _n0, lab0 = segs[0]
        nm0 = _short_audit_subperiod_name(name_base, lab0)

        await db.execute(
            text(
                "UPDATE fin_period SET period_number = period_number + :off "
                "WHERE vendor_id = CAST(:vid AS uuid) AND fiscal_year_id = CAST(:fy AS uuid) "
                "AND period_number > :pnum"
            ),
            {"off": off, "vid": str(vendor_id), "fy": str(fy_id), "pnum": pnum},
        )
        cur.name = nm0
        cur.start_date = s0
        cur.end_date = e0
        await db.flush()

        for j, (ss, ee, _nj, mlab) in enumerate(segs[1:], start=1):
            p = FinPeriod(
                id=uuid.uuid4(),
                vendor_id=vendor_id,
                fiscal_year_id=fy_id,
                name=_short_audit_subperiod_name(name_base, mlab),
                start_date=ss,
                end_date=ee,
                period_number=pnum + j,
                period_kind="audit",
                status=cur.status or "open",
                closed_at=cur.closed_at,
                closed_by_id=cur.closed_by_id,
            )
            db.add(p)
            inserted += 1
        await db.flush()
    return inserted


async def add_audit_periods(
    db: AsyncSession,
    vendor_id: UUID,
    fy: FinFiscalYear,
    audits: List[AuditPeriodIn],
) -> List[FinPeriod]:
    if not audits:
        return []
    m = await max_period_number_for_fy(db, vendor_id, fy.id)
    n = _audit_period_numbers_start(m)
    validate_audit_periods_against_fy(audits, fy.start_date, fy.end_date)
    expanded = expand_audit_periods_to_monthly(audits)
    created: List[FinPeriod] = []
    for a in expanded:
        p = FinPeriod(
            id=uuid.uuid4(),
            vendor_id=vendor_id,
            fiscal_year_id=fy.id,
            name=a.name,
            start_date=a.start_date,
            end_date=a.end_date,
            period_number=n,
            period_kind="audit",
            status="open",
        )
        db.add(p)
        created.append(p)
        n += 1
    await db.flush()
    return created


async def create_fiscal_year_from_template(
    db: AsyncSession,
    vendor_id: UUID,
    payload: FiscalYearTemplatedCreate,
) -> FinFiscalYear:
    if payload.template == "custom":
        fy_start, fy_end = payload.start_date, payload.end_date
        name = payload.name or f"Custom FY {fy_start.isoformat()} / {fy_end.isoformat()}"
    else:
        fy_start, fy_end, dname = fiscal_year_bounds(payload.template, payload.year_anchor)  # type: ignore[arg-type]
        name = payload.name or dname

    vcode = str(payload.variant_code)
    if await find_fiscal_year_by_variant(db, vendor_id, vcode) is not None:
        raise ValueError(
            f"A fiscal year with variant code \"{vcode}\" already exists for this organisation. "
            "Use a different code or assign that calendar to more business units from the fiscal year list."
        )

    company_ids = list(dict.fromkeys(payload.company_ids))
    for cid in company_ids:
        other = await find_overlapping_fiscal_year(
            db, vendor_id, cid, fy_start, fy_end, None
        )
        if other is not None:
            raise ValueError(
                f"A fiscal year already exists for one of the selected companies for that period: "
                f"\"{other.name}\" ({other.variant_code}, {other.start_date} to {other.end_date}). "
                f"You are trying to create {fy_start} to {fy_end}, which overlaps for that business unit. "
                "Remove that company from the list, or use a different start year / pattern."
            )

    fy = FinFiscalYear(
        id=uuid.uuid4(),
        vendor_id=vendor_id,
        variant_code=vcode,
        name=name,
        start_date=fy_start,
        end_date=fy_end,
        status="open",
    )
    db.add(fy)
    await db.flush()

    if company_ids:
        await set_fy_company_assignments(
            db, vendor_id, fy, company_ids, mark_current=bool(payload.is_current)
        )

    await build_standard_periods(db, vendor_id, fy)
    if payload.audit_periods:
        await add_audit_periods(db, vendor_id, fy, list(payload.audit_periods))
    return fy


async def append_audit_period(
    db: AsyncSession,
    vendor_id: UUID,
    fy_id: UUID,
    body: AuditPeriodAdd,
) -> FinPeriod:
    """
    If start/end cover multiple calendar months, one FinPeriod is created per month; this returns
    the first of those (same naming as add_audit_periods).
    """
    r = await db.execute(
        select(FinFiscalYear).where(
            FinFiscalYear.id == fy_id, FinFiscalYear.vendor_id == vendor_id
        )
    )
    fy = r.scalar_one_or_none()
    if not fy:
        raise ValueError("Fiscal year not found")
    ap = AuditPeriodIn(name=body.name, start_date=body.start_date, end_date=body.end_date)
    rows = await add_audit_periods(db, vendor_id, fy, [ap])
    return rows[0]


async def assign_fiscal_year_to_companies(
    db: AsyncSession,
    vendor_id: UUID,
    fy_id: UUID,
    company_ids: List[UUID],
    *,
    mark_current: bool = False,
) -> int:
    """
    Attach an existing shared calendar (fiscal year) to additional business units.
    Returns the number of new assignment rows created.
    """
    r = await db.execute(
        select(FinFiscalYear).where(
            FinFiscalYear.id == fy_id, FinFiscalYear.vendor_id == vendor_id
        )
    )
    fy = r.scalar_one_or_none()
    if not fy:
        raise ValueError("Fiscal year not found")
    ordered: List[UUID] = list(dict.fromkeys(company_ids))
    created = 0
    for cid in ordered:
        r0 = await db.execute(
            select(FinFiscalYearCompany).where(
                FinFiscalYearCompany.fiscal_year_id == fy_id,
                FinFiscalYearCompany.company_id == cid,
            )
        )
        if r0.scalar_one_or_none() is not None:
            if mark_current:
                await clear_current_fiscal_years(db, vendor_id, cid)
                await db.execute(
                    update(FinFiscalYearCompany)
                    .where(
                        FinFiscalYearCompany.fiscal_year_id == fy_id,
                        FinFiscalYearCompany.company_id == cid,
                    )
                    .values(is_current=True)
                )
            continue
        other = await find_overlapping_fiscal_year(
            db, vendor_id, cid, fy.start_date, fy.end_date, None
        )
        if other is not None and other.id != fy_id:
            raise ValueError(
                f"This company already has a different fiscal year covering that period: "
                f"\"{other.name}\" ({other.variant_code}, {other.start_date} to {other.end_date}). "
                "Close or remove the overlapping year first, or pick another business unit."
            )
        if mark_current:
            await clear_current_fiscal_years(db, vendor_id, cid)
        db.add(
            FinFiscalYearCompany(
                id=uuid.uuid4(),
                vendor_id=vendor_id,
                fiscal_year_id=fy_id,
                company_id=cid,
                is_current=mark_current,
            )
        )
        created += 1
    await db.flush()
    return created
