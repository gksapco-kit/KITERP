"""
Finance Auto-Posting Engine
===========================
Single entry point for creating General Ledger journal entries from any
operational event (invoice, payment, POS, procurement, payroll, expense, asset,
loan, manual).

Idempotent: keyed on (vendor_id, source_type, source_id). Re-posting an
already-posted event will void the old JE and create a new one.
"""
from __future__ import annotations

import uuid
import logging
from datetime import date, datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, case

from app.models.finance import (
    FinJournalEntry, FinJournalLine, FinAccount, FinPeriod, FinFiscalYear,
    FinFiscalYearCompany, FinCompany, FinApprovalPolicy, FinApprovalRequest,
    FinAuditLog, FinCostCenter, FinProject, FinIntercompanyPartner, FinJournalSplitItem,
    FinTaxCode,
)
from app.services.finance import field_rules as _field_rules
from app.services.finance import clearing as _clearing
from app.services.finance import posting_controls as _pc
from app.services.finance import rules_service as _rules
from app.services.finance import split_service as _split

log = logging.getLogger(__name__)

_BALANCE_TOLERANCE = Decimal("0.01")


async def _audit(
    db: AsyncSession,
    vendor_id: UUID,
    entity_type: str,
    entity_id: UUID,
    action: str,
    performed_by_id: Optional[UUID] = None,
    diff_json: Optional[dict] = None,
) -> None:
    """Write an immutable audit-log entry."""
    try:
        entry = FinAuditLog(
            id=uuid.uuid4(),
            vendor_id=vendor_id,
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            performed_by_id=performed_by_id,
            diff_json=diff_json or {},
        )
        db.add(entry)
        await db.flush()
    except Exception:
        log.warning("audit log write failed for %s/%s action=%s", entity_type, entity_id, action)

# ─────────────────────────────────────────────────────────────────────────────
# COA helpers — look up system accounts by their type/subtype
# ─────────────────────────────────────────────────────────────────────────────

async def _find_account(
    db: AsyncSession,
    vendor_id: UUID,
    account_type: str,
    account_subtype: Optional[str] = None,
    name_hint: Optional[str] = None,
) -> Optional[FinAccount]:
    q = select(FinAccount).where(
        FinAccount.vendor_id == vendor_id,
        FinAccount.account_type == account_type,
        FinAccount.is_active == True,
    )
    if account_subtype:
        q = q.where(FinAccount.account_subtype == account_subtype)
    if name_hint:
        q = q.where(FinAccount.name.ilike(f"%{name_hint}%"))
    result = await db.execute(q.limit(1))
    return result.scalar_one_or_none()


async def _find_account_by_name(
    db: AsyncSession, vendor_id: UUID, name: str
) -> Optional[FinAccount]:
    result = await db.execute(
        select(FinAccount).where(
            FinAccount.vendor_id == vendor_id,
            FinAccount.name.ilike(f"%{name}%"),
            FinAccount.is_active == True,
        ).limit(1)
    )
    return result.scalar_one_or_none()


async def _guard_no_recon_accounts(
    db: AsyncSession,
    vendor_id: UUID,
    account_ids: list[UUID],
) -> None:
    """
    Raise ValueError if any of the given account IDs is a reconciliation account.
    Reconciliation accounts (AR, AP, AccumDep, …) may only be posted to by
    subledger auto-posting handlers — never by manual journal entries.
    """
    if not account_ids:
        return
    r = await db.execute(
        select(FinAccount).where(
            FinAccount.id.in_(account_ids),
            FinAccount.vendor_id == vendor_id,
            FinAccount.is_reconciliation_account == True,
        ).limit(1)
    )
    blocked = r.scalar_one_or_none()
    if blocked:
        sub = blocked.reconciliation_subledger or "subledger"
        raise ValueError(
            f"Account '{blocked.code} – {blocked.name}' is a reconciliation (control) account "
            f"for the {sub} subledger. Manual posting to reconciliation accounts is not allowed. "
            f"Transactions are posted here automatically by the {sub} subledger."
        )


async def _get_or_create_period(
    db: AsyncSession,
    vendor_id: UUID,
    entry_date: date,
    company_id: Optional[UUID] = None,
) -> tuple[Optional[UUID], Optional[UUID]]:
    """Return (period_id, fiscal_year_id) for the given date and company."""
    q = (
        select(FinPeriod)
        .join(FinFiscalYear, FinFiscalYear.id == FinPeriod.fiscal_year_id)
        .where(
            FinPeriod.vendor_id == vendor_id,
            FinPeriod.start_date <= entry_date,
            FinPeriod.end_date >= entry_date,
            FinPeriod.status == "open",
        )
    )
    if company_id is not None:
        q = q.join(
            FinFiscalYearCompany,
            and_(
                FinFiscalYearCompany.fiscal_year_id == FinFiscalYear.id,
                FinFiscalYearCompany.company_id == company_id,
            ),
        )
    r = await db.execute(
        q.order_by(
            case((FinPeriod.period_kind == "audit", 0), else_=1),
            FinPeriod.start_date,
        ).limit(1)
    )
    period = r.scalar_one_or_none()
    if period:
        return period.id, period.fiscal_year_id
    return None, None


async def _resolve_draft_period(
    db: AsyncSession,
    vendor_id: UUID,
    entry_date: date,
    explicit_period_id: Optional[UUID],
    company_id: Optional[UUID] = None,
) -> tuple[Optional[UUID], Optional[UUID]]:
    """Resolve GL period: explicit id if provided (validated) else from posting date."""
    if explicit_period_id is not None:
        r = await db.execute(
            select(FinPeriod, FinFiscalYear)
            .join(FinFiscalYear, FinFiscalYear.id == FinPeriod.fiscal_year_id)
            .where(
                FinPeriod.id == explicit_period_id,
                FinPeriod.vendor_id == vendor_id,
            )
        )
        row = r.first()
        if not row:
            raise ValueError("Invalid accounting period.")
        p, fy = row[0], row[1]
        if p.status != "open":
            raise ValueError("Accounting period is not open for posting.")
        if not (p.start_date <= entry_date <= p.end_date):
            raise ValueError("Posting date must fall within the selected accounting period.")
        if company_id is not None:
            r_link = await db.execute(
                select(FinFiscalYearCompany).where(
                    FinFiscalYearCompany.fiscal_year_id == fy.id,
                    FinFiscalYearCompany.company_id == company_id,
                )
            )
            if r_link.scalar_one_or_none() is None:
                raise ValueError(
                    "The selected accounting period belongs to a different business unit than this document. "
                    "Align company and period, or pick a period for a company that uses this calendar."
                )
        return p.id, fy.id
    return await _get_or_create_period(db, vendor_id, entry_date, company_id)


_SOURCE_TO_DOC_TYPE = {
    "invoice": "DR", "credit_note": "DG", "sales_return": "RE",
    "payment": "DZ", "pos": "DR",
    "vendor_bill": "KR", "vendor_payment": "KZ",
    "payroll": "SA", "expense": "SA",
    "asset": "SA", "depreciation": "SA", "disposal": "SA",
    "inventory_adjustment": "SA", "cogs": "SA",
    "loan": "SA", "opening": "SA", "closing": "SA", "manual": "MNL",
    "commission_accrual": "SA", "commission_payment": "SA",
    "co_cost_booking": "SA", "fx": "SA",
}

_SOURCE_TO_PREFIX = {
    "invoice": "ARJ", "credit_note": "CNJ", "sales_return": "SRJ",
    "payment": "CRJ", "pos": "POS",
    "vendor_bill": "APJ", "vendor_payment": "VPJ",
    "payroll": "PAY", "expense": "EXP",
    "asset": "AST", "depreciation": "DEP", "disposal": "DIS",
    "inventory_adjustment": "INV", "cogs": "COG",
    "loan": "LNJ", "investment": "INV", "fx": "FXJ",
    "opening": "OPN", "closing": "CLJ", "manual": "MNL",
    "commission_accrual": "CMJ", "commission_payment": "CMP",
    "co_cost_booking": "COJ",
}


_DOC_TYPE_PREFIX = {
    "DR": "ARJ", "DG": "CNJ", "RE": "SRJ", "DZ": "CRJ", "KR": "APJ", "KZ": "VPJ",
    "SA": "JV", "MNL": "MNL",
}


def _fy_candidates(entry_date: Optional[date], fiscal_year: Optional[int]) -> list[int]:
    """Number-range fiscal years to try: explicit, Indian FY (Apr-Mar) start year, calendar year."""
    out: list[int] = []
    if fiscal_year:
        out.append(fiscal_year)
    d = entry_date or date.today()
    for y in (d.year if d.month >= 4 else d.year - 1, d.year):
        if y not in out:
            out.append(y)
    return out


async def _next_entry_no(db: AsyncSession, vendor_id: UUID, source_type: str,
                         fiscal_year: Optional[int] = None,
                         entry_date: Optional[date] = None) -> str:
    """
    Allocate the next document number from a row-locked FinNumberRange.

    If the tenant has no range for this document type, one is created on first use
    (unique constraint + savepoint make concurrent creation safe). The old
    count-based fallback raced under concurrent posting and violated the unique
    (vendor_id, entry_no) constraint.
    """
    from sqlalchemy.exc import IntegrityError
    from app.models.finance import FinNumberRange

    doc_type = _SOURCE_TO_DOC_TYPE.get(source_type, "SA")
    candidates = _fy_candidates(entry_date, fiscal_year)

    chosen: Optional[int] = None
    for fy in candidates:
        found = (await db.execute(
            select(FinNumberRange.id).where(
                FinNumberRange.vendor_id == vendor_id,
                FinNumberRange.document_type == doc_type,
                FinNumberRange.fiscal_year == fy,
            )
        )).first()
        if found:
            chosen = fy
            break

    if chosen is None:
        chosen = candidates[0]
        prefix = f"{_DOC_TYPE_PREFIX.get(doc_type, 'JV')}/{chosen}/"
        try:
            async with db.begin_nested():
                db.add(FinNumberRange(
                    id=uuid.uuid4(), vendor_id=vendor_id, document_type=doc_type,
                    fiscal_year=chosen, number_from=1, number_to=999_999_999,
                    current_number=1, prefix=prefix[:10], is_external=False,
                ))
                await db.flush()
        except IntegrityError:
            pass   # another transaction created it first — use theirs

    return await _rules.next_document_number(db, vendor_id, doc_type, chosen)


def _line(account: FinAccount, debit: Decimal = Decimal(0), credit: Decimal = Decimal(0),
          narration: str = "", vendor_id: UUID = None, store_id: UUID = None,
          party_type: str = None, party_id: UUID = None) -> FinJournalLine:
    ln = FinJournalLine(
        id=uuid.uuid4(),
        vendor_id=vendor_id,
        account_id=account.id,
        debit=debit,
        credit=credit,
        base_debit=debit,
        base_credit=credit,
        narration=narration,
        store_id=store_id,
        party_type=party_type,
        party_id=party_id,
    )
    return ln


# ─────────────────────────────────────────────────────────────────────────────
# Core posting function
# ─────────────────────────────────────────────────────────────────────────────

async def _supersede_entry(db, vendor_id, existing, created_by_id) -> None:
    """
    Replace an already-posted entry because its source document was re-posted.

    * Period still open    -> void the old entry in place (it drops out of every
      report, so the ledger carries only the replacement).
    * Period closed/locked -> the old entry must stay untouched: post a dated
      reversal in the current open period and link it via reversed_by_id.
    Either way exactly one live entry remains per source document.
    """
    period = None
    if existing.period_id:
        period = (await db.execute(
            select(FinPeriod).where(FinPeriod.id == existing.period_id)
        )).scalar_one_or_none()

    if period is None or period.status == "open":
        existing.status = "void"
        await db.flush()
        await _audit(db, vendor_id, "journal_entry", existing.id, "superseded",
                     performed_by_id=created_by_id,
                     diff_json={"entry_no": existing.entry_no, "mode": "void"})
        return

    rev_date = date.today()
    rev_period_id, rev_fy_id = await _get_or_create_period(
        db, vendor_id, rev_date, existing.company_id)
    if rev_period_id is None:
        raise ValueError(
            f"Cannot re-post: entry {existing.entry_no} is in a {period.status} period "
            "and no open period exists for the reversal."
        )
    lines = (await db.execute(
        select(FinJournalLine).where(FinJournalLine.journal_entry_id == existing.id)
    )).scalars().all()
    rev_je = FinJournalEntry(
        id=uuid.uuid4(),
        vendor_id=vendor_id,
        company_id=existing.company_id,
        entry_no=await _next_entry_no(db, vendor_id, existing.source_type),
        entry_date=rev_date,
        period_id=rev_period_id,
        fiscal_year_id=rev_fy_id,
        source_type=existing.source_type,
        source_id=existing.source_id,
        status="posted",
        document_type=existing.document_type,
        narration=f"REVERSAL of {existing.entry_no}: {existing.narration or ''}",
        reference=existing.reference,
        currency=existing.currency,
        total_debit=existing.total_credit,
        total_credit=existing.total_debit,
        created_by_id=created_by_id,
        posted_by_id=created_by_id,
        posted_at=datetime.now(timezone.utc),
        reverses_id=existing.id,
    )
    db.add(rev_je)
    await db.flush()
    for o in lines:
        db.add(FinJournalLine(
            id=uuid.uuid4(), journal_entry_id=rev_je.id, vendor_id=vendor_id,
            account_id=o.account_id, debit=o.credit, credit=o.debit,
            base_debit=o.base_credit, base_credit=o.base_debit,
            currency=o.currency, fx_rate=o.fx_rate,
            narration=f"REV: {o.narration or ''}", sequence=o.sequence,
            cost_center_id=o.cost_center_id, project_id=o.project_id,
            party_type=o.party_type, party_id=o.party_id, store_id=o.store_id,
        ))
    existing.reversed_by_id = rev_je.id
    await db.flush()
    await _audit(db, vendor_id, "journal_entry", existing.id, "reversed",
                 performed_by_id=created_by_id,
                 diff_json={"entry_no": existing.entry_no, "reversal_id": str(rev_je.id)})


def _handler_map() -> dict:
    """source_type -> handler (resolved lazily; handlers are defined below)."""
    return {
        "invoice": _handle_invoice,
        "credit_note": _handle_credit_note,
        "sales_return": _handle_sales_return,
        "payment": _handle_payment,
        "pos": _handle_pos,
        "vendor_bill": _handle_vendor_bill,
        "vendor_payment": _handle_vendor_payment,
        "payroll": _handle_payroll,
        "expense": _handle_expense,
        "asset": _handle_asset_acquisition,
        "depreciation": _handle_depreciation,
        "disposal": _handle_asset_disposal,
        "loan": _handle_loan,
        "manual": _handle_manual,
        "commission_accrual": _handle_commission_accrual,
        "commission_payment": _handle_commission_payment,
        "co_cost_booking": _handle_co_cost_booking,
        "inventory_adjustment": _handle_inventory_adjustment,
        "cogs": _handle_cogs,
        "fx": _handle_fx,
        "opening": _handle_opening,
    }


async def post_event(
    db: AsyncSession,
    vendor_id: UUID,
    source_type: str,
    source_id: UUID,
    payload: dict[str, Any],
    created_by_id: Optional[UUID] = None,
) -> Optional[FinJournalEntry]:
    """
    Create (or replace) a journal entry for a financial event.

    payload keys vary by source_type — see handler functions below.
    Returns None if essential GL accounts are not configured.
    """
    # Check for an existing LIVE JE with same source (idempotent re-post).
    # Reversal entries (reverses_id set) and already-reversed originals
    # (reversed_by_id set) are excluded so repeated re-posts never see >1 row.
    existing_r = await db.execute(
        select(FinJournalEntry).where(
            FinJournalEntry.vendor_id == vendor_id,
            FinJournalEntry.source_type == source_type,
            FinJournalEntry.source_id == source_id,
            FinJournalEntry.status == "posted",
            FinJournalEntry.reverses_id.is_(None),
            FinJournalEntry.reversed_by_id.is_(None),
        ).order_by(FinJournalEntry.created_at.desc())
    )
    existing = existing_r.scalars().first()

    _raw_date = payload.get("entry_date") or date.today()
    if isinstance(_raw_date, str):
        from datetime import date as _date_cls
        try:
            _raw_date = _date_cls.fromisoformat(_raw_date)
        except ValueError:
            # never silently re-date a document to "today" — that books it in the wrong period
            raise ValueError(f"Invalid entry_date {_raw_date!r}; expected YYYY-MM-DD") from None
    entry_date: date = _raw_date
    cid = payload.get("company_id") if isinstance(payload, dict) else None
    if not cid:
        cid = await _resolve_default_company(db, vendor_id)
    handler_map = _handler_map()
    handler = handler_map.get(source_type)
    if not handler:
        log.warning("No posting handler for source_type=%s", source_type)
        return None

    lines = await handler(db, vendor_id, payload)
    if not lines:
        return None  # essential GL accounts not configured: safe no-op

    # Period guard (after the handler so an unconfigured tenant is a no-op)
    period_id, fy_id = await _get_or_create_period(db, vendor_id, entry_date, cid)
    if period_id is None:
        raise ValueError(
            f"No open accounting period found for {entry_date}. "
            "Open or create a period before posting."
        )

    total_debit = sum(ln.debit for ln in lines)
    total_credit = sum(ln.credit for ln in lines)

    # ── Balance guard ─────────────────────────────────────────────────────────
    if abs(total_debit - total_credit) > _BALANCE_TOLERANCE:
        raise ValueError(
            f"Auto-posting handler for '{source_type}' produced an unbalanced entry: "
            f"Dr {total_debit} ≠ Cr {total_credit}. "
            "Check that all required GL accounts are configured."
        )

    # ── Supersede the previous entry (only now that a replacement is ready) ──
    if existing is not None:
        await _supersede_entry(db, vendor_id, existing, created_by_id)

    entry_no = await _next_entry_no(db, vendor_id, source_type, entry_date=entry_date)

    je = FinJournalEntry(
        id=uuid.uuid4(),
        vendor_id=vendor_id,
        company_id=cid,
        entry_no=entry_no,
        entry_date=entry_date,
        period_id=period_id,
        fiscal_year_id=fy_id,
        source_type=source_type,
        source_id=source_id,
        status="posted",
        document_type=payload.get("document_type") or "SA",
        narration=payload.get("narration", ""),
        reference=payload.get("reference", ""),
        currency=payload.get("currency", "INR"),
        total_debit=total_debit,
        total_credit=total_credit,
        created_by_id=created_by_id,
        posted_by_id=created_by_id,
        posted_at=datetime.now(timezone.utc),
    )
    db.add(je)
    await db.flush()

    for ln in lines:
        ln.journal_entry_id = je.id
        db.add(ln)

    # Stamp open-item status on lines that hit reconcilable / control accounts
    await _clearing.stamp_open_items(db, vendor_id, lines)
    # Apply document splitting rules if configured
    await _split.apply_document_splitting(db, vendor_id, je.id)

    await _audit(db, vendor_id, "journal_entry", je.id, "posted",
                 performed_by_id=created_by_id,
                 diff_json={"source_type": source_type, "entry_no": entry_no,
                            "total_debit": str(total_debit), "total_credit": str(total_credit)})

    log.info("Posted JE %s (%s) vendor=%s dr=%.2f cr=%.2f",
             entry_no, source_type, vendor_id, total_debit, total_credit)
    return je


# ─────────────────────────────────────────────────────────────────────────────
# Event Handlers
# ─────────────────────────────────────────────────────────────────────────────

async def _handle_invoice(db, vendor_id, payload):
    """
    payload: {
        total: Decimal, subtotal: Decimal, cgst: Decimal, sgst: Decimal, igst: Decimal,
        customer_id: UUID, narration: str
    }
    Dr AR  /  Cr Sales Revenue, Cr GST Output
    """
    ar = await _find_account(db, vendor_id, "Asset", "Current Asset", "Accounts Receivable")
    sales = await _find_account(db, vendor_id, "Income", "Operating Income", "Sales")
    gst_out = await _find_account(db, vendor_id, "Liability", "Current Liability", "GST Output")

    if not (ar and sales):
        return None

    total = Decimal(str(payload.get("total", 0)))
    cgst = Decimal(str(payload.get("cgst", 0)))
    sgst = Decimal(str(payload.get("sgst", 0)))
    igst = Decimal(str(payload.get("igst", 0)))
    tax = cgst + sgst + igst
    revenue = total - tax

    lines = [
        _line(ar, debit=total, narration="AR - Invoice", vendor_id=vendor_id,
              party_type="customer", party_id=payload.get("customer_id")),
        _line(sales, credit=revenue, narration="Sales Revenue", vendor_id=vendor_id),
    ]
    if tax > 0 and gst_out:
        lines.append(_line(gst_out, credit=tax, narration="GST Output", vendor_id=vendor_id))
    return lines


async def _handle_credit_note(db, vendor_id, payload):
    """
    Credit Note — reversal of a sales invoice.
    Dr Sales Revenue (and GST Output)  /  Cr AR
    payload: {total, cgst, sgst, igst, customer_id, narration}
    """
    ar = await _find_account(db, vendor_id, "Asset", "Current Asset", "Accounts Receivable")
    sales = await _find_account(db, vendor_id, "Income", "Operating Income", "Sales")
    gst_out = await _find_account(db, vendor_id, "Liability", "Current Liability", "GST Output")

    if not (ar and sales):
        return None

    total = Decimal(str(payload.get("total", 0)))
    cgst = Decimal(str(payload.get("cgst", 0)))
    sgst = Decimal(str(payload.get("sgst", 0)))
    igst = Decimal(str(payload.get("igst", 0)))
    tax = cgst + sgst + igst
    revenue = total - tax

    lines = [
        _line(sales, debit=revenue, narration="Sales Reversal (CN)", vendor_id=vendor_id),
        _line(ar, credit=total, narration="AR - Credit Note", vendor_id=vendor_id,
              party_type="customer", party_id=payload.get("customer_id")),
    ]
    if tax > 0 and gst_out:
        lines.append(_line(gst_out, debit=tax, narration="GST Output Reversal (CN)", vendor_id=vendor_id))
    return lines


async def _handle_sales_return(db, vendor_id, payload):
    """
    Sales Return — Dr Sales Revenue, Dr Inventory, Cr AR, Cr COGS Reversal.
    payload: {total, cgst, sgst, igst, cogs_amount, customer_id, narration}
    """
    ar = await _find_account(db, vendor_id, "Asset", "Current Asset", "Accounts Receivable")
    sales = await _find_account(db, vendor_id, "Income", "Operating Income", "Sales")
    gst_out = await _find_account(db, vendor_id, "Liability", "Current Liability", "GST Output")
    inventory = await _find_account(db, vendor_id, "Asset", "Current Asset", "Inventory")
    cogs_acc = await _find_account(db, vendor_id, "Expense", "COGS", "Cost of Goods Sold")

    if not (ar and sales):
        return None

    total = Decimal(str(payload.get("total", 0)))
    cgst = Decimal(str(payload.get("cgst", 0)))
    sgst = Decimal(str(payload.get("sgst", 0)))
    igst = Decimal(str(payload.get("igst", 0)))
    tax = cgst + sgst + igst
    revenue = total - tax
    cogs_amount = Decimal(str(payload.get("cogs_amount", 0)))

    lines = [
        _line(sales, debit=revenue, narration="Sales Reversal (Return)", vendor_id=vendor_id),
        _line(ar, credit=total, narration="AR - Sales Return", vendor_id=vendor_id,
              party_type="customer", party_id=payload.get("customer_id")),
    ]
    if tax > 0 and gst_out:
        lines.append(_line(gst_out, debit=tax, narration="GST Reversal (Return)", vendor_id=vendor_id))
    if cogs_amount > 0 and inventory and cogs_acc:
        lines.append(_line(inventory, debit=cogs_amount, narration="Inventory Returned", vendor_id=vendor_id))
        lines.append(_line(cogs_acc, credit=cogs_amount, narration="COGS Reversed", vendor_id=vendor_id))
    return lines


async def _handle_inventory_adjustment(db, vendor_id, payload):
    """
    Inventory write-up / write-down.
    Dr Inventory / Cr Inventory Adjustment Expense (or vice-versa).
    payload: {adjustment_amount (positive=gain, negative=loss), narration}
    """
    inventory = await _find_account(db, vendor_id, "Asset", "Current Asset", "Inventory")
    adj_acc = await _find_account(db, vendor_id, "Expense", "Operating Expense", "Inventory Adjustment")
    if not inventory:
        return None

    amount = Decimal(str(payload.get("adjustment_amount", 0)))
    if amount == 0:
        return None

    if amount > 0:  # inventory gain
        if not adj_acc:
            adj_acc = await _find_account(db, vendor_id, "Income", "Other Income")
        if not adj_acc:
            return None
        return [
            _line(inventory, debit=amount, narration="Inventory Write-Up", vendor_id=vendor_id),
            _line(adj_acc, credit=amount, narration="Inventory Gain", vendor_id=vendor_id),
        ]
    else:  # inventory loss
        loss = abs(amount)
        if not adj_acc:
            return None
        return [
            _line(adj_acc, debit=loss, narration="Inventory Write-Down", vendor_id=vendor_id),
            _line(inventory, credit=loss, narration="Inventory Loss", vendor_id=vendor_id),
        ]


async def _handle_cogs(db, vendor_id, payload):
    """
    COGS recognition on sale.
    Dr COGS  /  Cr Inventory
    payload: {cogs_amount, narration}
    """
    cogs_acc = await _find_account(db, vendor_id, "Expense", "COGS", "Cost of Goods Sold")
    inventory = await _find_account(db, vendor_id, "Asset", "Current Asset", "Inventory")

    if not (cogs_acc and inventory):
        return None

    amount = Decimal(str(payload.get("cogs_amount", 0)))
    if amount <= 0:
        return None

    return [
        _line(cogs_acc, debit=amount, narration="Cost of Goods Sold", vendor_id=vendor_id),
        _line(inventory, credit=amount, narration="Inventory Consumed", vendor_id=vendor_id),
    ]


async def _handle_payment(db, vendor_id, payload):
    """
    Dr Bank/Cash  /  Cr AR
    payload: {amount, bank_account_gl_id, customer_id, narration}
    """
    bank_gl_id = payload.get("bank_account_gl_id")
    if bank_gl_id:
        r = await db.execute(select(FinAccount).where(
            FinAccount.id == bank_gl_id, FinAccount.vendor_id == vendor_id))
        bank = r.scalar_one_or_none()
    else:
        bank = await _find_account(db, vendor_id, "Asset", "Current Asset", "Bank")
    ar = await _find_account(db, vendor_id, "Asset", "Current Asset", "Accounts Receivable")
    if not (bank and ar):
        return None

    amount = Decimal(str(payload.get("amount", 0)))
    return [
        _line(bank, debit=amount, narration="Cash Receipt", vendor_id=vendor_id),
        _line(ar, credit=amount, narration="AR Cleared", vendor_id=vendor_id,
              party_type="customer", party_id=payload.get("customer_id")),
    ]


async def _handle_pos(db, vendor_id, payload):
    """
    POS session close: aggregate sales + tax
    payload: {cash_total, card_total, upi_total, tax_total, narration}
    """
    cash_acc = await _find_account(db, vendor_id, "Asset", "Current Asset", "Cash")
    bank_acc = await _find_account(db, vendor_id, "Asset", "Current Asset", "Bank")
    sales = await _find_account(db, vendor_id, "Income", "Operating Income", "Sales")
    gst_out = await _find_account(db, vendor_id, "Liability", "Current Liability", "GST Output")
    if not (sales and (cash_acc or bank_acc)):
        return None

    cash = Decimal(str(payload.get("cash_total", 0)))
    card = Decimal(str(payload.get("card_total", 0)))
    upi = Decimal(str(payload.get("upi_total", 0)))
    tax = Decimal(str(payload.get("tax_total", 0)))
    total = cash + card + upi
    revenue = total - tax

    lines = []
    if cash > 0 and cash_acc:
        lines.append(_line(cash_acc, debit=cash, narration="POS Cash", vendor_id=vendor_id))
    if (card + upi) > 0 and bank_acc:
        lines.append(_line(bank_acc, debit=card + upi, narration="POS Card/UPI", vendor_id=vendor_id))
    lines.append(_line(sales, credit=revenue, narration="POS Revenue", vendor_id=vendor_id))
    if tax > 0 and gst_out:
        lines.append(_line(gst_out, credit=tax, narration="GST Output - POS", vendor_id=vendor_id))
    return lines


async def _handle_vendor_bill(db, vendor_id, payload):
    """
    Dr Expense + GST Input  /  Cr AP

    Two modes:
    - Simple (default): single aggregate expense line.
      payload: {subtotal, tax_amount, total, supplier_id, expense_account_id?,
                narration, cost_center_id?, project_id?}
    - Per-line: when payload contains "bill_lines", each entry drives its own
      expense debit line (using the line's account_id / dimensions).
      payload: {total, tax_amount, supplier_id, narration,
                bill_lines: [{account_id, amount, cost_center_id?, project_id?, narration?}]}
    """
    ap = await _find_account(db, vendor_id, "Liability", "Current Liability", "Accounts Payable")
    gst_in = await _find_account(db, vendor_id, "Asset", "Current Asset", "GST Input")
    if not ap:
        return None

    tax = Decimal(str(payload.get("tax_amount", 0)))
    total = Decimal(str(payload.get("total", 0)))
    supplier_id = payload.get("supplier_id")
    narration = payload.get("narration", "Vendor Bill")

    # TDS deducted at source (Sec 194x): the supplier is owed (total - TDS); the TDS
    # is a liability to the government until deposited.
    tds = Decimal(str(payload.get("tds_amount") or 0))
    tds_acc = None
    if tds > 0:
        tds_acc = await _find_account(db, vendor_id, "Liability", "Current Liability", "TDS Payable")
        if tds_acc is None:
            raise ValueError("TDS is deducted on this bill but no 'TDS Payable' account exists.")
        if tds >= total:
            raise ValueError("TDS cannot be equal to or exceed the bill total.")
    ap_credit = total - tds

    bill_lines = payload.get("bill_lines") or []

    if bill_lines:
        # Per-line mode: one expense debit per bill line, each with its own GL account
        # and cost dimensions (cost_center_id, project_id).
        out: list[FinJournalLine] = []
        for spec in bill_lines:
            acc_id = _uuid_or_none(spec.get("account_id"))
            if acc_id:
                r = await db.execute(
                    select(FinAccount).where(
                        FinAccount.id == acc_id, FinAccount.vendor_id == vendor_id
                    )
                )
                exp_acc = r.scalar_one_or_none()
            else:
                exp_acc = await _find_account(db, vendor_id, "Expense", "COGS", "Purchase")
            if not exp_acc:
                continue
            amt = Decimal(str(spec.get("amount", 0)))
            if amt <= 0:
                continue
            ln = _line(
                exp_acc,
                debit=amt,
                narration=spec.get("narration") or narration,
                vendor_id=vendor_id,
                party_type="supplier",
                party_id=supplier_id,
            )
            ln.cost_center_id = _uuid_or_none(spec.get("cost_center_id"))
            ln.project_id = _uuid_or_none(spec.get("project_id"))
            out.append(ln)

        if not out:
            return None

        subtotal = sum(ln.debit for ln in out)
        out.append(
            _line(ap, credit=ap_credit, narration=f"AP - {narration}", vendor_id=vendor_id,
                  party_type="supplier", party_id=supplier_id)
        )
        if tax > 0 and gst_in:
            out.append(_line(gst_in, debit=tax, narration="GST Input Credit", vendor_id=vendor_id))
        if tds_acc is not None:
            out.append(_line(tds_acc, credit=tds, narration=f"TDS Payable {payload.get('tds_section') or ''}".strip(),
                             vendor_id=vendor_id, party_type="supplier", party_id=supplier_id))
        return out

    # Simple aggregate mode (backwards-compatible).
    exp_acc_id = payload.get("expense_account_id")
    if exp_acc_id:
        r = await db.execute(select(FinAccount).where(
            FinAccount.id == exp_acc_id, FinAccount.vendor_id == vendor_id))
        expense = r.scalar_one_or_none()
    else:
        expense = await _find_account(db, vendor_id, "Expense", "COGS", "Purchase")
    if not expense:
        return None

    subtotal = Decimal(str(payload.get("subtotal", 0)))
    exp_line = _line(expense, debit=subtotal, narration="Purchase Expense", vendor_id=vendor_id,
                     party_type="supplier", party_id=supplier_id)
    # Stamp header-level dimensions onto the aggregate expense line.
    exp_line.cost_center_id = _uuid_or_none(payload.get("cost_center_id"))
    exp_line.project_id = _uuid_or_none(payload.get("project_id"))

    lines = [
        exp_line,
        _line(ap, credit=ap_credit, narration="AP - Vendor Bill", vendor_id=vendor_id,
              party_type="supplier", party_id=supplier_id),
    ]
    if tax > 0 and gst_in:
        lines.append(_line(gst_in, debit=tax, narration="GST Input Credit", vendor_id=vendor_id))
    if tds_acc is not None:
        lines.append(_line(tds_acc, credit=tds, narration=f"TDS Payable {payload.get('tds_section') or ''}".strip(),
                           vendor_id=vendor_id, party_type="supplier", party_id=supplier_id))
    return lines


async def _handle_vendor_payment(db, vendor_id, payload):
    """
    Dr AP  /  Cr Bank
    payload: {amount, supplier_id, bank_account_gl_id, narration}
    """
    ap = await _find_account(db, vendor_id, "Liability", "Current Liability", "Accounts Payable")
    bank_gl_id = payload.get("bank_account_gl_id")
    if bank_gl_id:
        r = await db.execute(select(FinAccount).where(
            FinAccount.id == bank_gl_id, FinAccount.vendor_id == vendor_id))
        bank = r.scalar_one_or_none()
    else:
        bank = await _find_account(db, vendor_id, "Asset", "Current Asset", "Bank")
    if not (ap and bank):
        return None

    amount = Decimal(str(payload.get("amount", 0)))
    return [
        _line(ap, debit=amount, narration="AP Payment", vendor_id=vendor_id,
              party_type="supplier", party_id=payload.get("supplier_id")),
        _line(bank, credit=amount, narration="Bank Payment", vendor_id=vendor_id),
    ]


async def _handle_payroll(db, vendor_id, payload):
    """
    Payroll GL posting with full Indian deductions.

    Entries:
      Dr Salary Expense (gross)
      Cr Salary Payable       (net take-home)
      Cr TDS Payable          (income tax deducted at source)
      Cr PF Payable           (provident fund employee contribution)
      Cr ESI Payable          (employee state insurance employee contribution)
      Cr Prof Tax Payable     (professional tax)

    Employer-side deductions (PF employer, ESI employer) are extra Dr Expense / Cr Payable entries.

    payload: {
        gross_total, net_total, tds_total,
        pf_employee, pf_employer,
        esi_employee, esi_employer,
        professional_tax,
        narration
    }
    """
    salary_exp = await _find_account(db, vendor_id, "Expense", "Operating Expense", "Salary")
    salary_pay = await _find_account(db, vendor_id, "Liability", "Current Liability", "Salary Payable")
    tds_pay = await _find_account(db, vendor_id, "Liability", "Current Liability", "TDS Payable")
    pf_pay = await _find_account(db, vendor_id, "Liability", "Current Liability", "PF Payable")
    esi_pay = await _find_account(db, vendor_id, "Liability", "Current Liability", "ESI Payable")
    pt_pay = await _find_account(db, vendor_id, "Liability", "Current Liability", "Professional Tax Payable")
    pf_exp = await _find_account(db, vendor_id, "Expense", "Operating Expense", "PF Expense")
    esi_exp = await _find_account(db, vendor_id, "Expense", "Operating Expense", "ESI Expense")

    if not (salary_exp and salary_pay):
        return None

    gross = Decimal(str(payload.get("gross_total", 0)))
    net = Decimal(str(payload.get("net_total", 0)))
    tds = Decimal(str(payload.get("tds_total", 0)))
    pf_emp = Decimal(str(payload.get("pf_employee", 0)))
    pf_er = Decimal(str(payload.get("pf_employer", 0)))
    esi_emp = Decimal(str(payload.get("esi_employee", 0)))
    esi_er = Decimal(str(payload.get("esi_employer", 0)))
    pt = Decimal(str(payload.get("professional_tax", 0)))

    # Gross expense = salary gross + employer PF + employer ESI
    total_dr = gross + pf_er + esi_er

    lines = [
        _line(salary_exp, debit=gross, narration="Salary Expense", vendor_id=vendor_id),
        _line(salary_pay, credit=net, narration="Net Salary Payable", vendor_id=vendor_id),
    ]
    # Fail loudly (naming the account) instead of dropping a line and producing an
    # unbalanced / silently incomplete entry.
    _needed = [
        (tds, tds_pay, "TDS Payable"),
        (pf_emp, pf_pay, "PF Payable"), (pf_er, pf_pay, "PF Payable"), (pf_er, pf_exp, "PF Expense"),
        (esi_emp, esi_pay, "ESI Payable"), (esi_er, esi_pay, "ESI Payable"), (esi_er, esi_exp, "ESI Expense"),
        (pt, pt_pay, "Professional Tax Payable"),
    ]
    _missing = sorted({nm for amt, acc, nm in _needed if amt > 0 and acc is None})
    if _missing:
        raise ValueError(
            "Payroll cannot be posted: missing GL account(s): " + ", ".join(_missing)
            + ". Add them in Chart of Accounts."
        )
    # Any deduction not itemised above (loan/advance recovery, LWF, etc.) must still be
    # credited somewhere or the entry would not balance.
    other_ded = gross - net - tds - pf_emp - esi_emp - pt
    if other_ded > Decimal("0.005"):
        other_pay = await _find_account(db, vendor_id, "Liability", "Current Liability", "Other Payable")
        lines.append(_line(other_pay or salary_pay, credit=other_ded,
                           narration="Other Employee Deductions Payable", vendor_id=vendor_id))
    # Employee deductions to liabilities
    if tds > 0 and tds_pay:
        lines.append(_line(tds_pay, credit=tds, narration="TDS Payable", vendor_id=vendor_id))
    if pf_emp > 0 and pf_pay:
        lines.append(_line(pf_pay, credit=pf_emp, narration="PF Payable (Employee)", vendor_id=vendor_id))
    if esi_emp > 0 and esi_pay:
        lines.append(_line(esi_pay, credit=esi_emp, narration="ESI Payable (Employee)", vendor_id=vendor_id))
    if pt > 0 and pt_pay:
        lines.append(_line(pt_pay, credit=pt, narration="Professional Tax Payable", vendor_id=vendor_id))
    # Employer contributions (extra expense Dr / liability Cr)
    if pf_er > 0 and pf_exp and pf_pay:
        lines.append(_line(pf_exp, debit=pf_er, narration="PF Expense (Employer)", vendor_id=vendor_id))
        lines.append(_line(pf_pay, credit=pf_er, narration="PF Payable (Employer)", vendor_id=vendor_id))
    if esi_er > 0 and esi_exp and esi_pay:
        lines.append(_line(esi_exp, debit=esi_er, narration="ESI Expense (Employer)", vendor_id=vendor_id))
        lines.append(_line(esi_pay, credit=esi_er, narration="ESI Payable (Employer)", vendor_id=vendor_id))
    return lines


async def _handle_expense(db, vendor_id, payload):
    """
    Dr Expense Account  /  Cr Bank/Cash
    payload: {amount, expense_account_id, bank_account_gl_id, narration}
    """
    exp_acc_id = payload.get("expense_account_id")
    if exp_acc_id:
        r = await db.execute(select(FinAccount).where(
            FinAccount.id == exp_acc_id, FinAccount.vendor_id == vendor_id))
        expense = r.scalar_one_or_none()
    else:
        expense = await _find_account(db, vendor_id, "Expense", "Operating Expense")
    bank_gl_id = payload.get("bank_account_gl_id")
    if bank_gl_id:
        r = await db.execute(select(FinAccount).where(
            FinAccount.id == bank_gl_id, FinAccount.vendor_id == vendor_id))
        bank = r.scalar_one_or_none()
    else:
        bank = await _find_account(db, vendor_id, "Asset", "Current Asset", "Cash")
    if not (expense and bank):
        return None

    amount = Decimal(str(payload.get("amount", 0)))
    return [
        _line(expense, debit=amount, narration=payload.get("narration", "Expense"), vendor_id=vendor_id),
        _line(bank, credit=amount, narration="Cash/Bank Payment", vendor_id=vendor_id),
    ]


async def _handle_asset_acquisition(db, vendor_id, payload):
    """
    Dr Fixed Asset  /  Cr Bank or AP
    payload: {cost, asset_account_id, credit_account_id, narration}
    """
    asset_acc_id = payload.get("asset_account_id")
    if asset_acc_id:
        r = await db.execute(select(FinAccount).where(
            FinAccount.id == asset_acc_id, FinAccount.vendor_id == vendor_id))
        asset_acc = r.scalar_one_or_none()
    else:
        asset_acc = await _find_account(db, vendor_id, "Asset", "Fixed Asset")
    credit_acc_id = payload.get("credit_account_id")
    if credit_acc_id:
        r = await db.execute(select(FinAccount).where(
            FinAccount.id == credit_acc_id, FinAccount.vendor_id == vendor_id))
        credit_acc = r.scalar_one_or_none()
    else:
        credit_acc = await _find_account(db, vendor_id, "Asset", "Current Asset", "Bank")
    if not (asset_acc and credit_acc):
        return None

    cost = Decimal(str(payload.get("cost", 0)))
    return [
        _line(asset_acc, debit=cost, narration="Asset Acquisition", vendor_id=vendor_id),
        _line(credit_acc, credit=cost, narration="Payment for Asset", vendor_id=vendor_id),
    ]


async def _handle_depreciation(db, vendor_id, payload):
    """
    Dr Depreciation Expense  /  Cr Accumulated Depreciation
    payload: {amount, dep_expense_account_id, accum_dep_account_id, narration}
    """
    dep_exp_id = payload.get("dep_expense_account_id")
    accum_id = payload.get("accum_dep_account_id")
    if dep_exp_id and accum_id:
        r1 = await db.execute(select(FinAccount).where(
            FinAccount.id == dep_exp_id, FinAccount.vendor_id == vendor_id))
        dep_exp = r1.scalar_one_or_none()
        r2 = await db.execute(select(FinAccount).where(
            FinAccount.id == accum_id, FinAccount.vendor_id == vendor_id))
        accum = r2.scalar_one_or_none()
    else:
        dep_exp = await _find_account(db, vendor_id, "Expense", "Operating Expense", "Depreciation")
        accum = await _find_account(db, vendor_id, "Asset", "Fixed Asset", "Accumulated Depreciation")
    if not (dep_exp and accum):
        return None

    amount = Decimal(str(payload.get("amount", 0)))
    return [
        _line(dep_exp, debit=amount, narration="Depreciation Expense", vendor_id=vendor_id),
        _line(accum, credit=amount, narration="Accumulated Depreciation", vendor_id=vendor_id),
    ]


async def _handle_asset_disposal(db, vendor_id, payload):
    """
    Dr AccumDep + Cash/AP  /  Cr Fixed Asset + Gain or Dr Loss
    payload: {book_value, accum_dep, sale_price, gain_loss, asset_account_id,
              accum_dep_account_id, cash_account_id, gain_account_id, loss_account_id}
    """
    asset_acc_id = payload.get("asset_account_id")
    accum_id = payload.get("accum_dep_account_id")
    cash_id = payload.get("cash_account_id")
    r1 = await db.execute(select(FinAccount).where(FinAccount.id == asset_acc_id)) if asset_acc_id else None
    asset_acc = r1.scalar_one_or_none() if r1 else await _find_account(db, vendor_id, "Asset", "Fixed Asset")
    r2 = await db.execute(select(FinAccount).where(FinAccount.id == accum_id)) if accum_id else None
    accum = r2.scalar_one_or_none() if r2 else await _find_account(db, vendor_id, "Asset", "Fixed Asset", "Accumulated")
    r3 = await db.execute(select(FinAccount).where(FinAccount.id == cash_id)) if cash_id else None
    cash = r3.scalar_one_or_none() if r3 else await _find_account(db, vendor_id, "Asset", "Current Asset", "Bank")
    if not (asset_acc and accum and cash):
        return None

    cost = Decimal(str(payload.get("purchase_cost", 0)))
    acc_dep = Decimal(str(payload.get("accum_dep", 0)))
    sale_price = Decimal(str(payload.get("sale_price", 0)))
    gain_loss = sale_price - (cost - acc_dep)

    lines = [
        _line(accum, debit=acc_dep, narration="Remove Accum Depreciation", vendor_id=vendor_id),
        _line(asset_acc, credit=cost, narration="Remove Asset Cost", vendor_id=vendor_id),
        _line(cash, debit=sale_price, narration="Proceeds from Disposal", vendor_id=vendor_id),
    ]
    # A gain/loss line is mandatory (not optional) whenever gain_loss != 0 — otherwise
    # the journal entry would be unbalanced. If the account can't be resolved, bail
    # out entirely (return None) rather than posting a half-balanced entry.
    if gain_loss > 0:
        gain_id = payload.get("gain_account_id")
        gain_acc = (
            (await db.execute(select(FinAccount).where(FinAccount.id == gain_id))).scalar_one_or_none()
            if gain_id else
            await _find_account(db, vendor_id, "Income", "Other Income", "Gain on Asset Disposal")
        )
        if not gain_acc:
            log.warning("Asset disposal: no Gain on Disposal account configured for vendor %s", vendor_id)
            return None
        lines.append(_line(gain_acc, credit=gain_loss, narration="Gain on Disposal", vendor_id=vendor_id))
    elif gain_loss < 0:
        loss_id = payload.get("loss_account_id")
        loss_acc = (
            (await db.execute(select(FinAccount).where(FinAccount.id == loss_id))).scalar_one_or_none()
            if loss_id else
            await _find_account(db, vendor_id, "Expense", "Operating Expense", "Loss on Asset Disposal")
        )
        if not loss_acc:
            log.warning("Asset disposal: no Loss on Disposal account configured for vendor %s", vendor_id)
            return None
        lines.append(_line(loss_acc, debit=abs(gain_loss), narration="Loss on Disposal", vendor_id=vendor_id))
    return lines


async def _handle_loan(db, vendor_id, payload):
    """
    loan_event: disbursement or repayment
    payload: {event: 'disbursement'|'repayment', principal, interest, loan_account_id, bank_account_id, interest_account_id}
    """
    event = payload.get("event", "repayment")
    def _as_uuid(v):
        if v is None or v == "":
            return None
        return v if isinstance(v, UUID) else UUID(str(v))

    loan_gl_id = _as_uuid(payload.get("loan_account_id"))
    bank_gl_id = _as_uuid(payload.get("bank_account_id"))
    interest_gl_id = _as_uuid(payload.get("interest_account_id"))
    r1 = await db.execute(select(FinAccount).where(
        FinAccount.id == loan_gl_id, FinAccount.vendor_id == vendor_id)) if loan_gl_id else None
    loan_acc = r1.scalar_one_or_none() if r1 else await _find_account(db, vendor_id, "Liability", "Long-term Liability", "Loan")
    r2 = await db.execute(select(FinAccount).where(
        FinAccount.id == bank_gl_id, FinAccount.vendor_id == vendor_id)) if bank_gl_id else None
    bank = r2.scalar_one_or_none() if r2 else await _find_account(db, vendor_id, "Asset", "Current Asset", "Bank")
    if not (loan_acc and bank):
        return None

    principal = Decimal(str(payload.get("principal", 0)))
    interest = Decimal(str(payload.get("interest", 0)))

    if event == "disbursement":
        return [
            _line(bank, debit=principal, narration="Loan Disbursement", vendor_id=vendor_id),
            _line(loan_acc, credit=principal, narration="Loan Liability", vendor_id=vendor_id),
        ]
    else:  # repayment
        lines = [
            _line(loan_acc, debit=principal, narration="Loan Principal Repayment", vendor_id=vendor_id),
            _line(bank, credit=principal + interest, narration="Bank Payment - Loan EMI", vendor_id=vendor_id),
        ]
        if interest > 0:
            r3 = await db.execute(select(FinAccount).where(
                FinAccount.id == interest_gl_id, FinAccount.vendor_id == vendor_id)) if interest_gl_id else None
            int_acc = r3.scalar_one_or_none() if r3 else await _find_account(db, vendor_id, "Expense", "Operating Expense", "Interest")
            if int_acc:
                lines.insert(1, _line(int_acc, debit=interest, narration="Interest Expense", vendor_id=vendor_id))
        return lines


def _uuid_or_none(val: Any) -> Optional[UUID]:
    if val is None:
        return None
    if isinstance(val, UUID):
        return val
    return UUID(str(val))


async def _handle_co_cost_booking(db, vendor_id, payload):
    """
    Controlling (CO) — explicit journal lines from payload.
    payload: {
        lines: [
            { account_id, debit, credit, narration?, cost_center_id?, project_id?,
              ref_doc_type?, ref_doc_id?, assignment? }
        ],
        ref_doc_type?, ref_doc_id?, assignment?  — defaults for lines
    }
    """
    lines_spec = payload.get("lines") or []
    if not lines_spec:
        return None
    out: list[FinJournalLine] = []
    seq = 0
    ref_t = payload.get("ref_doc_type")
    ref_i = _uuid_or_none(payload.get("ref_doc_id"))
    assign = payload.get("assignment")
    for spec in lines_spec:
        aid = _uuid_or_none(spec.get("account_id"))
        if not aid:
            continue
        r = await db.execute(
            select(FinAccount).where(FinAccount.id == aid, FinAccount.vendor_id == vendor_id)
        )
        acc = r.scalar_one_or_none()
        if not acc:
            log.warning("co_cost_booking: account %s not found for vendor=%s", aid, vendor_id)
            return None
        dr = Decimal(str(spec.get("debit", 0)))
        cr = Decimal(str(spec.get("credit", 0)))
        rd = spec.get("ref_doc_id")
        out.append(
            FinJournalLine(
                id=uuid.uuid4(),
                vendor_id=vendor_id,
                account_id=acc.id,
                debit=dr,
                credit=cr,
                base_debit=dr,
                base_credit=cr,
                narration=spec.get("narration") or "",
                sequence=seq,
                cost_center_id=_uuid_or_none(spec.get("cost_center_id")),
                project_id=_uuid_or_none(spec.get("project_id")),
                ref_doc_type=spec.get("ref_doc_type") or ref_t,
                ref_doc_id=_uuid_or_none(rd) if rd is not None else ref_i,
                assignment=spec.get("assignment") or assign,
            )
        )
        seq += 1
    if not out:
        return None
    td = sum(ln.debit for ln in out)
    tc = sum(ln.credit for ln in out)
    if td != tc:
        log.warning("co_cost_booking: unbalanced lines dr=%s cr=%s", td, tc)
        return None
    return out


async def _handle_commission_accrual(db, vendor_id, payload):
    """
    payload: {
        amount: Decimal,
        payee_id: UUID,          # CommissionPayee id (used as party_id)
        store_id: UUID | None,
        currency: str,
        narration: str,
    }
    Dr Commission Expense  /  Cr Commission Payable
    """
    amount = Decimal(str(payload.get("amount", 0)))
    if amount <= 0:
        return None
    payee_id = payload.get("payee_id")
    store_id = payload.get("store_id")

    expense_acc = await _find_account_by_name(db, vendor_id, "Commission Expense")
    payable_acc = await _find_account_by_name(db, vendor_id, "Commission Payable")
    if not expense_acc or not payable_acc:
        log.warning("Commission GL accounts not found for vendor=%s — skipping accrual JE", vendor_id)
        return None

    dr = _line(expense_acc, debit=amount,
               narration=payload.get("narration", "Commission Expense"),
               vendor_id=vendor_id, store_id=store_id,
               party_type="commission_payee", party_id=payee_id)
    cr = _line(payable_acc, credit=amount,
               narration=payload.get("narration", "Commission Payable"),
               vendor_id=vendor_id, store_id=store_id,
               party_type="commission_payee", party_id=payee_id)
    return [dr, cr]


async def _handle_commission_payment(db, vendor_id, payload):
    """
    payload: {
        amount: Decimal,
        payee_id: UUID,
        bank_account_id: UUID | None,   # specific cash/bank account
        store_id: UUID | None,
        currency: str,
        narration: str,
    }
    Dr Commission Payable  /  Cr Bank/Cash
    """
    amount = Decimal(str(payload.get("amount", 0)))
    if amount <= 0:
        return None
    payee_id = payload.get("payee_id")
    store_id = payload.get("store_id")

    payable_acc = await _find_account_by_name(db, vendor_id, "Commission Payable")
    if not payable_acc:
        log.warning("Commission Payable account not found for vendor=%s — skipping payment JE", vendor_id)
        return None

    bank_account_id = payload.get("bank_account_id")
    if bank_account_id:
        r = await db.execute(select(FinAccount).where(
            FinAccount.id == bank_account_id, FinAccount.vendor_id == vendor_id))
        bank_acc = r.scalar_one_or_none()
    else:
        bank_acc = await _find_account(db, vendor_id, "Asset", "Bank")
        if not bank_acc:
            bank_acc = await _find_account(db, vendor_id, "Asset", "Cash")

    if not bank_acc:
        log.warning("No bank/cash account found for vendor=%s — skipping commission payment JE", vendor_id)
        return None

    dr = _line(payable_acc, debit=amount,
               narration=payload.get("narration", "Commission Payment"),
               vendor_id=vendor_id, store_id=store_id,
               party_type="commission_payee", party_id=payee_id)
    cr = _line(bank_acc, credit=amount,
               narration=payload.get("narration", "Commission Payment"),
               vendor_id=vendor_id, store_id=store_id)
    return [dr, cr]


async def _handle_fx(db, vendor_id, payload):
    """
    FX Revaluation adjustment entry.
    Dr/Cr: FX Loss Expense / FX Gain Income  vs  Unrealised FX Adjustment (Balance Sheet)

    payload: {
        currency: str,
        rate_used: float,
        total_gain: float,
        total_loss: float,
        net_adjustment: float,       # positive = net gain, negative = net loss
        entry_date: str,
        narration: str,
    }
    """
    net = Decimal(str(payload.get("net_adjustment", 0)))
    gain = Decimal(str(payload.get("total_gain", 0)))
    loss = Decimal(str(payload.get("total_loss", 0)))

    if net == 0:
        return None

    # Look up FX P&L accounts
    fx_gain_acc = await _find_account(db, vendor_id, "Income", "Other Income", "FX Gain")
    if not fx_gain_acc:
        fx_gain_acc = await _find_account(db, vendor_id, "Income", "Other Income")
    fx_loss_acc = await _find_account(db, vendor_id, "Expense", "Other Expense", "FX Loss")
    if not fx_loss_acc:
        fx_loss_acc = await _find_account(db, vendor_id, "Expense", "Other Expense")
    # Balance-sheet suspense for unrealised adjustments
    fx_bs_acc = await _find_account(db, vendor_id, "Asset", "Current Asset", "FX Reval Suspense")
    if not fx_bs_acc:
        fx_bs_acc = await _find_account(db, vendor_id, "Liability", "Current Liability", "FX Reval Suspense")

    narration = payload.get("narration", "FX Revaluation")
    lines = []

    if net > 0:
        missing = [name for name, acc in [("FX Gain (Income > Other Income)", fx_gain_acc),
                                           ("FX Reval Suspense (Asset or Liability > Current)", fx_bs_acc)]
                   if acc is None]
        if missing:
            raise ValueError(
                f"Cannot post FX gain JE: the following GL accounts are not configured — "
                + ", ".join(missing)
            )
        # Net gain: Dr FX Suspense / Cr FX Gain
        lines = [
            _line(fx_bs_acc, debit=net, narration=narration, vendor_id=vendor_id),
            _line(fx_gain_acc, credit=net, narration=narration, vendor_id=vendor_id),
        ]
    else:
        # net < 0 (net == 0 is already returned early above)
        missing = [name for name, acc in [("FX Loss (Expense > Other Expense)", fx_loss_acc),
                                           ("FX Reval Suspense (Asset or Liability > Current)", fx_bs_acc)]
                   if acc is None]
        if missing:
            raise ValueError(
                f"Cannot post FX loss JE: the following GL accounts are not configured — "
                + ", ".join(missing)
            )
        # Net loss: Dr FX Loss / Cr FX Suspense
        loss_amt = abs(net)
        lines = [
            _line(fx_loss_acc, debit=loss_amt, narration=narration, vendor_id=vendor_id),
            _line(fx_bs_acc, credit=loss_amt, narration=narration, vendor_id=vendor_id),
        ]

    return lines


async def _handle_opening(db, vendor_id, payload):
    """
    Opening-balance entry.
    payload: {lines: [{account_id, debit, credit, narration}]}
    Unlike manual entries, opening balances MAY hit reconciliation (AR/AP control)
    accounts — that is how legacy receivables/payables are brought in.
    Unknown accounts raise instead of being silently dropped.
    """
    lines = []
    for ld in payload.get("lines", []):
        r = await db.execute(select(FinAccount).where(
            FinAccount.id == ld["account_id"], FinAccount.vendor_id == vendor_id))
        acc = r.scalar_one_or_none()
        if acc is None:
            raise ValueError(f"Opening balance account {ld['account_id']} not found for this vendor.")
        lines.append(_line(
            acc,
            debit=Decimal(str(ld.get("debit", 0))),
            credit=Decimal(str(ld.get("credit", 0))),
            narration=ld.get("narration", "Opening Balance"),
            vendor_id=vendor_id,
        ))
    return lines if lines else None


async def _handle_manual(db, vendor_id, payload):
    """
    Manual journal entry.
    payload: {lines: [{account_id, debit, credit, narration, cost_center_id, project_id, assignment, text}]}
    Reconciliation accounts are blocked — they may only be posted to by subledger handlers.
    Tolerance limits, Field Status Group rules, substitutions, and validations are enforced.
    """
    lines_data = payload.get("lines", [])
    account_ids = [
        UUID(str(ld["account_id"])) for ld in lines_data if ld.get("account_id")
    ]
    await _guard_no_recon_accounts(db, vendor_id, account_ids)

    # Tolerance enforcement
    tol_lines = [
        {"amount": Decimal(str(ld.get("debit") or ld.get("credit") or 0))}
        for ld in lines_data
    ]
    user_tg_id = payload.get("user_tolerance_group_id")
    await _pc.enforce_tolerance(db, vendor_id, tol_lines, user_tg_id)

    # Document-level validation
    doc_context = {
        "total_lines": len(lines_data),
        "total_debit": sum(Decimal(str(ld.get("debit", 0))) for ld in lines_data),
        "total_credit": sum(Decimal(str(ld.get("credit", 0))) for ld in lines_data),
    }
    await _rules.run_validations(db, vendor_id, "document", doc_context)

    lines = []
    for ld in lines_data:
        # Line-level substitution first
        ld = await _rules.apply_substitutions(db, vendor_id, "line", ld)
        # Line-level validation
        line_context = dict(ld)
        await _rules.run_validations(db, vendor_id, "line", line_context)

        r = await db.execute(select(FinAccount).where(
            FinAccount.id == ld["account_id"], FinAccount.vendor_id == vendor_id))
        acc = r.scalar_one_or_none()
        if acc:
            # Field Status Group enforcement
            await _pc.enforce_field_status(db, acc.field_status_group_id, ld)
            lines.append(_line(
                acc,
                debit=Decimal(str(ld.get("debit", 0))),
                credit=Decimal(str(ld.get("credit", 0))),
                narration=ld.get("narration", ""),
                vendor_id=vendor_id,
            ))
    return lines if lines else None


# ─────────────────────────────────────────────────────────────────────────────
# Enterprise Journal Entry — draft creation + approval gating
# ─────────────────────────────────────────────────────────────────────────────

async def _resolve_default_company(db: AsyncSession, vendor_id: UUID) -> Optional[UUID]:
    """Return the default FinCompany id for this vendor, or None."""
    r = await db.execute(
        select(FinCompany).where(
            FinCompany.vendor_id == vendor_id,
            FinCompany.is_default == True,
            FinCompany.is_active == True,
        ).limit(1)
    )
    c = r.scalar_one_or_none()
    return c.id if c else None


# ─────────────────────────────────────────────────────────────────────────────
# Journal entry lifecycle
#
#   draft ──submit──▶ pending_approval ──approve──▶ approved ──post──▶ posted ──reverse──▶ (reversal JE)
#     ▲                    │    └──────reject────▶ rejected
#     └──────withdraw──────┘
#
# draft / approved / rejected entries are editable; ANY edit drops the existing
# approval and re-evaluates the approval policy against the new amount.
# ─────────────────────────────────────────────────────────────────────────────

JE_EDITABLE_STATUSES = ("draft", "approved", "rejected")
JE_POSTABLE_STATUSES = ("draft", "approved")
_JE_DIMENSION_SUBST_FIELDS = ("cost_center_id", "project_id", "assignment", "tax_code")


class JournalValidationError(ValueError):
    """ValueError carrying structured, per-line issues for the UI."""

    def __init__(self, message: str, issues: Optional[list[dict]] = None):
        super().__init__(message)
        self.issues = issues or []


def _issue(message: str, *, line: Optional[int] = None, field: Optional[str] = None,
           severity: str = "error") -> dict:
    return {"severity": severity, "line": line, "field": field, "message": message}


def _raise_if_errors(issues: list[dict]) -> None:
    errors = [i for i in issues if i.get("severity") == "error"]
    if not errors:
        return
    parts = []
    for i in errors:
        prefix = f"Line {i['line'] + 1}: " if i.get("line") is not None else ""
        parts.append(f"{prefix}{i['message']}")
    raise JournalValidationError("; ".join(parts), issues)


async def _ids_missing(db: AsyncSession, vendor_id: UUID, model: Any, ids: list) -> set:
    """Ids that do not exist for this tenant (blocks cross-tenant FK injection)."""
    wanted = {UUID(str(i)) for i in ids if i}
    if not wanted:
        return set()
    r = await db.execute(select(model.id).where(model.id.in_(wanted), model.vendor_id == vendor_id))
    return wanted - {row[0] for row in r.all()}


def _coerce_uuid(v: Any) -> Optional[UUID]:
    if v in (None, ""):
        return None
    return v if isinstance(v, UUID) else UUID(str(v))


async def validate_journal(
    db: AsyncSession,
    vendor_id: UUID,
    header: Any,
    lines: Optional[list],
    *,
    company_id: Optional[UUID],
    actor_id: Optional[UUID] = None,
) -> tuple[Optional[list], list[dict]]:
    """
    Single validation pipeline shared by create, update, simulate and posting.

    Runs: header field rules, tenant ownership of every referenced master record,
    account status / reconciliation guard, substitutions, line + document
    validation rules, Field Status Groups and tolerance limits.

    Returns (prepared_lines, issues). `prepared_lines` are the input lines with
    substitution results applied (None when `lines` is None). Nothing is raised
    here — callers decide via `_raise_if_errors`.
    """
    issues: list[dict] = []

    fr = await _field_rules.effective_field_rules(db, vendor_id, "journal_entry", company_id, actor_id)
    if fr:
        try:
            _field_rules.assert_journal_mandatory(header, fr)
        except ValueError as exc:
            issues.append(_issue(str(exc), field="header"))

    if company_id and await _ids_missing(db, vendor_id, FinCompany, [company_id]):
        issues.append(_issue("Business unit not found.", field="company_id"))

    if lines is None:
        return None, issues

    prepared = list(lines)
    if len(prepared) < 2:
        issues.append(_issue("A journal entry needs at least 2 lines."))

    total_dr = sum((ln.debit for ln in prepared), Decimal("0"))
    total_cr = sum((ln.credit for ln in prepared), Decimal("0"))
    if total_dr != total_cr:
        issues.append(_issue(f"Entry is not balanced: debit {total_dr} vs credit {total_cr}."))

    acc_ids = {ln.account_id for ln in prepared}
    accounts: dict[UUID, FinAccount] = {}
    if acc_ids:
        r = await db.execute(
            select(FinAccount).where(FinAccount.id.in_(acc_ids), FinAccount.vendor_id == vendor_id)
        )
        accounts = {a.id: a for a in r.scalars().all()}

    for idx, ln in enumerate(prepared):
        acc = accounts.get(ln.account_id)
        if acc is None:
            issues.append(_issue("Account not found.", line=idx, field="account_id"))
            continue
        if not acc.is_active:
            issues.append(_issue(f"Account {acc.code} – {acc.name} is inactive.", line=idx, field="account_id"))
        if acc.is_reconciliation_account:
            sub = acc.reconciliation_subledger or "subledger"
            issues.append(_issue(
                f"Account {acc.code} – {acc.name} is a reconciliation (control) account for the {sub} "
                f"subledger; it can only be posted by the {sub} subledger.",
                line=idx, field="account_id",
            ))

        ctx = ln.model_dump()
        ctx.update({
            "narration": ln.description, "text": ln.description,
            "account_code": acc.code, "account_type": acc.account_type,
        })
        try:
            new_ctx = await _rules.apply_substitutions(db, vendor_id, "line", ctx)
        except Exception as exc:  # misconfigured rule — surface it, don't 500
            log.exception("journal substitution failed")
            issues.append(_issue(f"Substitution rule failed: {exc}", line=idx))
            new_ctx = ctx

        patch: dict[str, Any] = {}
        for f in _JE_DIMENSION_SUBST_FIELDS:
            if new_ctx.get(f) != ctx.get(f):
                patch[f] = _coerce_uuid(new_ctx.get(f)) if f.endswith("_id") else new_ctx.get(f)
        for text_key in ("description", "narration", "text"):
            if new_ctx.get(text_key) != ctx.get(text_key):
                patch["description"] = new_ctx.get(text_key)
                break
        if patch:
            try:
                ln = ln.model_copy(update=patch)
                prepared[idx] = ln
                new_ctx.update(patch)
                issues.append(_issue(
                    "Substitution rule changed: " + ", ".join(sorted(patch)),
                    line=idx, severity="info",
                ))
            except Exception as exc:
                issues.append(_issue(f"Substitution produced an invalid value: {exc}", line=idx))

        try:
            await _rules.run_validations(db, vendor_id, "line", new_ctx)
        except ValueError as exc:
            issues.append(_issue(str(exc), line=idx))
        except Exception as exc:
            log.exception("journal line validation failed")
            issues.append(_issue(f"Validation rule failed: {exc}", line=idx))

        try:
            fsg_ctx = dict(new_ctx)
            await _pc.enforce_field_status(db, acc.field_status_group_id, fsg_ctx)
        except ValueError as exc:
            issues.append(_issue(f"{acc.code}: {exc}", line=idx))

    # Tenant ownership of every dimension reference (after substitution)
    from app.models.store import Store
    for model, attr, label in (
        (FinCostCenter, "cost_center_id", "Cost centre"),
        (FinProject, "project_id", "Project"),
        (FinIntercompanyPartner, "intercompany_partner_id", "Intercompany partner"),
        (Store, "store_id", "Store"),
    ):
        missing = await _ids_missing(db, vendor_id, model, [getattr(ln, attr) for ln in prepared])
        if missing:
            for idx, ln in enumerate(prepared):
                if getattr(ln, attr) and UUID(str(getattr(ln, attr))) in missing:
                    issues.append(_issue(f"{label} not found.", line=idx, field=attr))

    # Party must be a real customer / supplier of this tenant (and have a type)
    from app.models.customer import Customer
    from app.models.procurement import Supplier
    for party_type, model in (("customer", Customer), ("supplier", Supplier)):
        wanted = [ln.party_id for ln in prepared if ln.party_id and ln.party_type == party_type]
        missing = await _ids_missing(db, vendor_id, model, wanted)
        for idx, ln in enumerate(prepared):
            if ln.party_id and ln.party_type == party_type and UUID(str(ln.party_id)) in missing:
                issues.append(_issue(f"{party_type.title()} not found.", line=idx, field="party_id"))
    for idx, ln in enumerate(prepared):
        if ln.party_id and ln.party_type not in ("customer", "supplier"):
            issues.append(_issue("Choose a party type (customer or supplier) for the party.", line=idx, field="party_type"))

    # Tax code must exist (and be active) in this tenant's tax master
    used_tax_codes = {(ln.tax_code or "").strip().upper() for ln in prepared if (ln.tax_code or "").strip()}
    if used_tax_codes:
        r = await db.execute(
            select(FinTaxCode.code).where(
                FinTaxCode.vendor_id == vendor_id, FinTaxCode.is_active.is_(True),
            )
        )
        valid_tax_codes = {(c or "").strip().upper() for (c,) in r.all()}
        for idx, ln in enumerate(prepared):
            code = (ln.tax_code or "").strip()
            if code and code.upper() not in valid_tax_codes:
                issues.append(_issue(
                    f"Tax code '{code}' is not an active code in the tax master.",
                    line=idx, field="tax_code",
                ))

    try:
        await _rules.run_validations(db, vendor_id, "document", {
            "total_lines": len(prepared), "total_debit": total_dr, "total_credit": total_cr,
        })
    except ValueError as exc:
        issues.append(_issue(str(exc), field="document"))
    except Exception as exc:
        log.exception("journal document validation failed")
        issues.append(_issue(f"Validation rule failed: {exc}", field="document"))

    try:
        await _pc.enforce_tolerance(
            db, vendor_id,
            [{"amount": max(ln.debit, ln.credit)} for ln in prepared], None,
        )
    except ValueError as exc:
        issues.append(_issue(str(exc), field="document"))

    # Base-currency sanity (warning only: the GL is keyed on transaction amounts)
    base_dr = sum(((ln.debit * ln.fx_rate) for ln in prepared), Decimal("0"))
    base_cr = sum(((ln.credit * ln.fx_rate) for ln in prepared), Decimal("0"))
    if abs(base_dr - base_cr) > _BALANCE_TOLERANCE:
        issues.append(_issue(
            f"Balanced in transaction amounts but not in base currency "
            f"(base debit {base_dr:.2f} vs credit {base_cr:.2f}); check FX rates.",
            severity="warning",
        ))
    return prepared, issues


# ── approval helpers ─────────────────────────────────────────────────────────

async def _active_je_policy(db: AsyncSession, vendor_id: UUID) -> Optional[FinApprovalPolicy]:
    r = await db.execute(
        select(FinApprovalPolicy).where(
            FinApprovalPolicy.vendor_id == vendor_id,
            FinApprovalPolicy.entity_type == "journal_entry",
            FinApprovalPolicy.is_active == True,
        ).limit(1)
    )
    return r.scalar_one_or_none()


def _policy_applies(policy: Optional[FinApprovalPolicy], amount: Decimal) -> bool:
    return policy is not None and (
        policy.threshold_amount is None or amount >= policy.threshold_amount
    )


async def _cancel_open_approval(db: AsyncSession, je: FinJournalEntry) -> None:
    """Cancel the entry's open approval request (if any) and clear the approval stamp."""
    if je.approval_request_id:
        req = (await db.execute(
            select(FinApprovalRequest).where(FinApprovalRequest.id == je.approval_request_id)
        )).scalar_one_or_none()
        if req is not None and req.status == "pending":
            req.status = "cancelled"
            req.resolved_at = datetime.now(timezone.utc)
    je.requires_approval = False
    je.approval_request_id = None


async def _require_approval_if_needed(
    db: AsyncSession,
    vendor_id: UUID,
    je: FinJournalEntry,
    amount: Decimal,
    requested_by_id: Optional[UUID],
) -> bool:
    """
    Check the active FinApprovalPolicy for journal_entry. If it applies, create a
    FinApprovalRequest and move the JE to pending_approval. Returns True if raised.
    """
    policy = await _active_je_policy(db, vendor_id)
    if not _policy_applies(policy, amount):
        return False
    req = FinApprovalRequest(
        id=uuid.uuid4(),
        vendor_id=vendor_id,
        policy_id=policy.id,
        entity_type="journal_entry",
        entity_id=je.id,
        status="pending",
        amount=amount,
        requested_by_id=requested_by_id,
        notes=f"Auto-raised for JE {je.entry_no} ({je.narration or ''})",
    )
    db.add(req)
    await db.flush()
    je.requires_approval = True
    je.approval_request_id = req.id
    je.status = "pending_approval"
    await db.flush()
    await _audit(db, vendor_id, "journal_entry", je.id, "submitted",
                 performed_by_id=requested_by_id,
                 diff_json={"entry_no": je.entry_no, "amount": str(amount)})
    return True


async def reconcile_approval_state(db: AsyncSession, jes: list[FinJournalEntry]) -> bool:
    """
    Bring pending_approval entries in line with their approval request
    (approved → approved, rejected → rejected, cancelled → draft).
    Also heals entries whose request was actioned before this sync existed.
    """
    pending = [je for je in jes if je.status == "pending_approval" and je.approval_request_id]
    if not pending:
        return False
    ids = {je.approval_request_id for je in pending}
    r = await db.execute(select(FinApprovalRequest).where(FinApprovalRequest.id.in_(ids)))
    reqs = {x.id: x for x in r.scalars().all()}
    changed = False
    for je in pending:
        req = reqs.get(je.approval_request_id)
        new_status = {"approved": "approved", "rejected": "rejected", "cancelled": "draft"}.get(
            req.status if req else ""
        )
        if not new_status:
            continue
        je.status = new_status
        if new_status == "draft":
            je.requires_approval = False
            je.approval_request_id = None
        changed = True
    if changed:
        await db.flush()
    return changed


async def apply_approval_decision_to_journal(
    db: AsyncSession,
    req: FinApprovalRequest,
    actor_id: Optional[UUID],
) -> Optional[FinJournalEntry]:
    """Called after an approval request is approved/rejected; syncs the JE status."""
    if req.entity_type != "journal_entry":
        return None
    je = (await db.execute(
        select(FinJournalEntry).where(
            FinJournalEntry.id == req.entity_id,
            FinJournalEntry.vendor_id == req.vendor_id,
        )
    )).scalar_one_or_none()
    if je is None or je.approval_request_id != req.id or je.status != "pending_approval":
        return je
    await reconcile_approval_state(db, [je])
    if je.status in ("approved", "rejected"):   # multi-level: intermediate sign-offs leave it pending
        await _audit(db, je.vendor_id, "journal_entry", je.id, je.status,
                     performed_by_id=actor_id, diff_json={"entry_no": je.entry_no})
    return je


async def submit_journal_for_approval(
    db: AsyncSession, je: FinJournalEntry, actor_id: Optional[UUID],
) -> bool:
    """Submit a draft/rejected entry. Returns True if an approval was raised, False if none needed."""
    if je.status not in ("draft", "rejected"):
        raise ValueError(f"Only draft or rejected entries can be submitted (current status: '{je.status}').")
    await _cancel_open_approval(db, je)
    je.status = "draft"
    raised = await _require_approval_if_needed(
        db, je.vendor_id, je, Decimal(str(je.total_debit or 0)), actor_id
    )
    await db.flush()
    return raised


async def withdraw_journal_approval(
    db: AsyncSession, je: FinJournalEntry, actor_id: Optional[UUID],
) -> FinJournalEntry:
    if je.status != "pending_approval":
        raise ValueError(f"Only entries pending approval can be withdrawn (current status: '{je.status}').")
    await _cancel_open_approval(db, je)
    je.status = "draft"
    await db.flush()
    await _audit(db, je.vendor_id, "journal_entry", je.id, "withdrawn",
                 performed_by_id=actor_id, diff_json={"entry_no": je.entry_no})
    return je


# ── line builder ─────────────────────────────────────────────────────────────

def _build_journal_line(
    *, je_id: UUID, vendor_id: UUID, ln_in: Any, seq: int, default_value_date: date,
) -> FinJournalLine:
    debit, credit, fx = ln_in.debit, ln_in.credit, ln_in.fx_rate
    is_fc_line = fx != Decimal("1")
    if ln_in.amount_fc is not None:
        amount_fc = ln_in.amount_fc
    elif is_fc_line:
        amount_fc = debit - credit            # signed: debit positive, credit negative
    else:
        amount_fc = None
    return FinJournalLine(
        id=uuid.uuid4(),
        journal_entry_id=je_id,
        vendor_id=vendor_id,
        account_id=ln_in.account_id,
        store_id=ln_in.store_id,
        party_type=ln_in.party_type,
        party_id=ln_in.party_id,
        debit=debit,
        credit=credit,
        currency=ln_in.currency,
        fx_rate=fx,
        base_debit=(debit * fx).quantize(Decimal("0.0001")),
        base_credit=(credit * fx).quantize(Decimal("0.0001")),
        amount_fc=amount_fc,
        exchange_rate=fx if is_fc_line else None,
        narration=ln_in.description or "",
        sequence=ln_in.sequence if ln_in.sequence else seq,
        cost_center_id=ln_in.cost_center_id,
        project_id=ln_in.project_id,
        intercompany_partner_id=ln_in.intercompany_partner_id,
        value_date=ln_in.value_date or default_value_date,
        ref_doc_type=ln_in.ref_doc_type,
        ref_doc_id=ln_in.ref_doc_id,
        ref_doc_no=ln_in.ref_doc_no,
        tax_code=ln_in.tax_code,
        tax_amount=ln_in.tax_amount,
        assignment=ln_in.assignment,
    )


async def _replace_lines_and_derive(
    db: AsyncSession, je: FinJournalEntry, lines_in: list, replace: bool,
) -> tuple[Decimal, Decimal]:
    """Persist lines, stamp open items and (re)apply document splitting."""
    from sqlalchemy import delete as sa_delete
    if replace:
        old_ids = select(FinJournalLine.id).where(FinJournalLine.journal_entry_id == je.id)
        await db.execute(sa_delete(FinJournalSplitItem).where(FinJournalSplitItem.journal_line_id.in_(old_ids)))
        await db.execute(sa_delete(FinJournalLine).where(FinJournalLine.journal_entry_id == je.id))
    total_dr = Decimal("0")
    total_cr = Decimal("0")
    for seq, ln_in in enumerate(lines_in):
        total_dr += ln_in.debit
        total_cr += ln_in.credit
        db.add(_build_journal_line(
            je_id=je.id, vendor_id=je.vendor_id, ln_in=ln_in, seq=seq,
            default_value_date=je.entry_date,
        ))
    je.total_debit = total_dr
    je.total_credit = total_cr
    await db.flush()
    created = (await db.execute(
        select(FinJournalLine).where(FinJournalLine.journal_entry_id == je.id)
    )).scalars().all()
    await _clearing.stamp_open_items(db, je.vendor_id, list(created))
    await _split.apply_document_splitting(db, je.vendor_id, je.id)
    return total_dr, total_cr


# ── create ───────────────────────────────────────────────────────────────────

async def create_journal_draft(
    db: AsyncSession,
    vendor_id: UUID,
    payload: "JournalEntryCreate",  # type: ignore[name-defined]
    created_by_id: Optional[UUID] = None,
    *,
    issues_out: Optional[list] = None,
) -> FinJournalEntry:
    """
    Validate and persist a draft JE, raising an approval request when the policy applies.
    Non-blocking findings (warnings/info) are appended to `issues_out` if given.
    """
    entry_date = payload.entry_date
    company_id = payload.company_id or await _resolve_default_company(db, vendor_id)

    lines_in, issues = await validate_journal(
        db, vendor_id, payload, payload.lines, company_id=company_id, actor_id=created_by_id,
    )
    _raise_if_errors(issues)

    period_id, fy_id = await _resolve_draft_period(
        db, vendor_id, entry_date, payload.period_id, company_id
    )
    if period_id is None:
        issues.append(_issue(
            f"No open accounting period covers {entry_date}; the entry can be saved but not posted.",
            field="entry_date", severity="warning",
        ))
    entry_no = await _next_entry_no(db, vendor_id, payload.source_type)

    attachments = [
        a.model_dump() if hasattr(a, "model_dump") else dict(a)
        for a in (getattr(payload, "attachments", None) or [])
    ]
    je = FinJournalEntry(
        id=uuid.uuid4(),
        vendor_id=vendor_id,
        company_id=company_id,
        entry_no=entry_no,
        entry_date=entry_date,
        document_date=payload.document_date or entry_date,
        document_type=payload.document_type,
        period_id=period_id,
        fiscal_year_id=fy_id,
        source_type=payload.source_type,
        source_id=uuid.uuid4(),      # new unique source id for manual drafts
        status="draft",
        narration=payload.narration or "",
        reference=payload.reference or "",
        header_text=payload.header_text or "",
        attachments=attachments,
        currency=payload.currency,
        created_by_id=created_by_id,
    )
    db.add(je)
    await db.flush()

    total_debit, _ = await _replace_lines_and_derive(db, je, lines_in, replace=False)
    await _require_approval_if_needed(db, vendor_id, je, total_debit, created_by_id)
    await _audit(db, vendor_id, "journal_entry", je.id, "created",
                 performed_by_id=created_by_id,
                 diff_json={"entry_no": entry_no, "total_debit": str(total_debit), "status": je.status})

    if issues_out is not None:
        issues_out.extend(issues)
    log.info("Created draft JE %s vendor=%s dr=%.2f status=%s", entry_no, vendor_id, total_debit, je.status)
    return je


# ── posting ──────────────────────────────────────────────────────────────────

async def check_journal_postable(db: AsyncSession, je: FinJournalEntry) -> list[dict]:
    """Everything `post_entry_with_approval_check` would enforce, without changing anything."""
    issues: list[dict] = []
    if je.status == "pending_approval":
        issues.append(_issue(f"Journal entry {je.entry_no} is awaiting approval."))
        return issues
    if je.status not in JE_POSTABLE_STATUSES:
        issues.append(_issue(
            f"Only draft or approved journal entries can be posted (current status: '{je.status}')."
        ))
        return issues

    amount = Decimal(str(je.total_debit or 0))
    if je.requires_approval:
        req = None
        if je.approval_request_id:
            req = (await db.execute(
                select(FinApprovalRequest).where(FinApprovalRequest.id == je.approval_request_id)
            )).scalar_one_or_none()
        if req is None or req.status != "approved":
            issues.append(_issue(
                f"Journal entry {je.entry_no} requires approval "
                f"(current status: {req.status if req else 'unknown'})."
            ))
    elif _policy_applies(await _active_je_policy(db, je.vendor_id), amount):
        issues.append(_issue(
            f"Journal entry {je.entry_no} requires approval under the active policy. "
            "Submit it for approval first."
        ))

    if je.period_id:
        period = (await db.execute(select(FinPeriod).where(FinPeriod.id == je.period_id))).scalar_one_or_none()
        if period is None or period.status != "open":
            issues.append(_issue(
                f"Accounting period is {period.status if period else 'missing'}. "
                "Reopen the period or change the entry date before posting.",
                field="entry_date",
            ))
    else:
        pid, _fy = await _get_or_create_period(db, je.vendor_id, je.entry_date, je.company_id)
        if pid is None:
            issues.append(_issue(f"No open accounting period covers {je.entry_date}.", field="entry_date"))

    lines = list((await db.execute(
        select(FinJournalLine).where(FinJournalLine.journal_entry_id == je.id)
    )).scalars().all())
    if len(lines) < 2:
        issues.append(_issue("A journal entry needs at least 2 lines."))
    dr = sum((Decimal(str(ln.debit or 0)) for ln in lines), Decimal("0"))
    cr = sum((Decimal(str(ln.credit or 0)) for ln in lines), Decimal("0"))
    if abs(dr - cr) > _BALANCE_TOLERANCE:
        issues.append(_issue(f"Entry is not balanced: debit {dr} vs credit {cr}."))
    if lines:
        accs = {a.id: a for a in (await db.execute(
            select(FinAccount).where(
                FinAccount.id.in_({ln.account_id for ln in lines}),
                FinAccount.vendor_id == je.vendor_id,
            )
        )).scalars().all()}
        for idx, ln in enumerate(lines):
            acc = accs.get(ln.account_id)
            if acc is None:
                issues.append(_issue("Account not found.", line=idx, field="account_id"))
            elif not acc.is_active:
                issues.append(_issue(f"Account {acc.code} – {acc.name} is inactive.", line=idx, field="account_id"))
            elif acc.is_reconciliation_account and je.source_type == "manual":
                issues.append(_issue(
                    f"Account {acc.code} – {acc.name} is a reconciliation (control) account.",
                    line=idx, field="account_id",
                ))
    return issues


async def post_entry_with_approval_check(
    db: AsyncSession,
    je: FinJournalEntry,
    posted_by_id: Optional[UUID],
) -> FinJournalEntry:
    """
    Post a draft (or approved) JE, enforcing approval, period, balance and account checks.
    Raises ValueError / JournalValidationError otherwise.
    """
    await reconcile_approval_state(db, [je])
    issues = await check_journal_postable(db, je)
    _raise_if_errors(issues)

    if not je.period_id:
        je.period_id, je.fiscal_year_id = await _get_or_create_period(
            db, je.vendor_id, je.entry_date, je.company_id
        )

    je.status = "posted"
    je.posted_by_id = posted_by_id
    je.posted_at = datetime.now(timezone.utc)
    await db.flush()

    await _audit(db, je.vendor_id, "journal_entry", je.id, "posted",
                 performed_by_id=posted_by_id,
                 diff_json={"entry_no": je.entry_no, "total_debit": str(je.total_debit)})
    log.info("Posted JE %s vendor=%s by=%s", je.entry_no, je.vendor_id, posted_by_id)
    return je


async def reverse_journal_entry(
    db: AsyncSession,
    je: FinJournalEntry,
    *,
    reversal_date: Optional[date] = None,
    reason: str = "",
    user_id: Optional[UUID] = None,
) -> FinJournalEntry:
    """
    Reverse a posted entry with a linked, posted mirror entry (debits ↔ credits).
    The original stays 'posted' so the ledger keeps a full trail; both net to zero.
    """
    if je.status != "posted":
        raise ValueError("Only posted journal entries can be reversed.")
    if je.reversed_by_id:
        raise ValueError(f"Journal entry {je.entry_no} has already been reversed.")
    if je.reverses_id:
        raise ValueError("A reversal entry cannot itself be reversed.")

    lines = list((await db.execute(
        select(FinJournalLine).where(FinJournalLine.journal_entry_id == je.id)
        .order_by(FinJournalLine.sequence)
    )).scalars().all())
    if any(ln.open_item_status in ("cleared", "partial") for ln in lines):
        raise ValueError(
            "Some lines of this entry have been cleared against open items. "
            "Reverse the clearing first, or post a correcting entry."
        )

    rdate = reversal_date or date.today()
    period_id, fy_id = await _get_or_create_period(db, je.vendor_id, rdate, je.company_id)
    if period_id is None:
        raise ValueError(f"No open accounting period covers the reversal date {rdate}.")

    rev = FinJournalEntry(
        id=uuid.uuid4(),
        vendor_id=je.vendor_id,
        company_id=je.company_id,
        entry_no=await _next_entry_no(db, je.vendor_id, "reversal", entry_date=rdate),
        entry_date=rdate,
        document_date=rdate,
        document_type=je.document_type,
        period_id=period_id,
        fiscal_year_id=fy_id,
        source_type="reversal",
        source_id=uuid.uuid4(),
        status="posted",
        narration=f"Reversal of {je.entry_no}" + (f": {reason}" if reason else ""),
        reference=je.entry_no,
        header_text=je.header_text or "",
        currency=je.currency,
        reverses_id=je.id,
        created_by_id=user_id,
        posted_by_id=user_id,
        posted_at=datetime.now(timezone.utc),
        total_debit=je.total_credit,
        total_credit=je.total_debit,
    )
    db.add(rev)
    await db.flush()
    for seq, ln in enumerate(lines):
        db.add(FinJournalLine(
            id=uuid.uuid4(), journal_entry_id=rev.id, vendor_id=je.vendor_id,
            account_id=ln.account_id, store_id=ln.store_id,
            party_type=ln.party_type, party_id=ln.party_id,
            debit=ln.credit, credit=ln.debit,
            currency=ln.currency, fx_rate=ln.fx_rate,
            base_debit=ln.base_credit, base_credit=ln.base_debit,
            amount_fc=(-ln.amount_fc if ln.amount_fc is not None else None),
            exchange_rate=ln.exchange_rate,
            narration=f"Reversal: {ln.narration or ''}".strip(),
            sequence=seq,
            cost_center_id=ln.cost_center_id, project_id=ln.project_id,
            intercompany_partner_id=ln.intercompany_partner_id,
            value_date=rdate,
            ref_doc_type=ln.ref_doc_type, ref_doc_id=ln.ref_doc_id, ref_doc_no=ln.ref_doc_no,
            tax_code=ln.tax_code, tax_amount=ln.tax_amount, assignment=ln.assignment,
        ))
    await db.flush()
    je.reversed_by_id = rev.id
    new_lines = (await db.execute(
        select(FinJournalLine).where(FinJournalLine.journal_entry_id == rev.id)
    )).scalars().all()
    await _clearing.stamp_open_items(db, je.vendor_id, list(new_lines))
    await _split.apply_document_splitting(db, je.vendor_id, rev.id)
    await db.flush()

    await _audit(db, je.vendor_id, "journal_entry", je.id, "reversed", performed_by_id=user_id,
                 diff_json={"entry_no": je.entry_no, "reversal_no": rev.entry_no, "reason": reason})
    await _audit(db, je.vendor_id, "journal_entry", rev.id, "created", performed_by_id=user_id,
                 diff_json={"entry_no": rev.entry_no, "reverses": je.entry_no})
    return rev


# ── update ───────────────────────────────────────────────────────────────────

async def update_journal_draft(
    db: AsyncSession,
    je: FinJournalEntry,
    payload: "JournalEntryUpdate",  # type: ignore[name-defined]
    actor_vendor_user_id: Optional[UUID] = None,
) -> FinJournalEntry:
    """
    Edit a draft / approved / rejected JE (header and/or full line replacement).
    The approval policy is re-evaluated after every edit.
    """
    from types import SimpleNamespace

    if je.status == "pending_approval":
        raise ValueError("This entry is pending approval. Withdraw it from approval before editing.")
    if je.status not in JE_EDITABLE_STATUSES:
        raise ValueError(f"Cannot edit JE in status '{je.status}'.")

    company_id = payload.company_id if payload.company_id is not None else je.company_id
    company_id = company_id or await _resolve_default_company(db, je.vendor_id)
    header = SimpleNamespace(
        entry_date=payload.entry_date if payload.entry_date is not None else je.entry_date,
        document_date=payload.document_date if payload.document_date is not None else je.document_date,
        reference=payload.reference if payload.reference is not None else je.reference,
        narration=payload.narration if payload.narration is not None else je.narration,
        header_text=payload.header_text if payload.header_text is not None else je.header_text,
    )
    replace_lines = payload.lines is not None
    lines_in, issues = await validate_journal(
        db, je.vendor_id, header, payload.lines if replace_lines else None,
        company_id=company_id, actor_id=actor_vendor_user_id,
    )
    _raise_if_errors(issues)

    old_entry_date = je.entry_date
    for attr in ("entry_date", "document_date", "document_type", "reference",
                 "narration", "header_text", "currency", "company_id"):
        v = getattr(payload, attr)
        if v is not None:
            setattr(je, attr, v)

    if payload.attachments is not None:
        from sqlalchemy.orm.attributes import flag_modified
        je.attachments = [
            a.model_dump() if hasattr(a, "model_dump") else dict(a)
            for a in payload.attachments
        ]
        flag_modified(je, "attachments")

    if payload.period_id is not None:
        je.period_id, je.fiscal_year_id = await _resolve_draft_period(
            db, je.vendor_id, je.entry_date, payload.period_id, company_id
        )
    elif je.entry_date != old_entry_date or not je.period_id:
        je.period_id, je.fiscal_year_id = await _get_or_create_period(
            db, je.vendor_id, je.entry_date, company_id
        )

    if replace_lines:
        await _replace_lines_and_derive(db, je, lines_in, replace=True)

    # Any edit invalidates a previous approval; re-evaluate against the new amount.
    await _cancel_open_approval(db, je)
    je.status = "draft"
    await db.flush()
    await _require_approval_if_needed(
        db, je.vendor_id, je, Decimal(str(je.total_debit or 0)), actor_vendor_user_id
    )
    await _audit(db, je.vendor_id, "journal_entry", je.id, "updated",
                 performed_by_id=actor_vendor_user_id,
                 diff_json={"entry_no": je.entry_no, "lines_replaced": replace_lines, "status": je.status})
    return je


# ── simulation ───────────────────────────────────────────────────────────────

async def simulate_journal(
    db: AsyncSession,
    vendor_id: UUID,
    payload: "JournalEntryCreate",  # type: ignore[name-defined]
    *,
    actor_id: Optional[UUID] = None,
) -> dict:
    """
    Dry-run: run the exact create pipeline (validation, substitutions, document
    splitting, period + approval resolution) inside a SAVEPOINT and roll it back.
    Nothing is persisted; the entry number is provisional.
    """
    issues: list[dict] = []
    nested = await db.begin_nested()
    try:
        try:
            je = await create_journal_draft(db, vendor_id, payload, created_by_id=actor_id, issues_out=issues)
        except JournalValidationError as exc:
            return {"ok": False, "issues": exc.issues, "lines": [], "split_items": []}
        except ValueError as exc:
            return {"ok": False, "issues": [_issue(str(exc))], "lines": [], "split_items": []}

        lines = list((await db.execute(
            select(FinJournalLine).where(FinJournalLine.journal_entry_id == je.id)
            .order_by(FinJournalLine.sequence)
        )).scalars().all())
        accs = {a.id: a for a in (await db.execute(
            select(FinAccount).where(FinAccount.id.in_({ln.account_id for ln in lines}))
        )).scalars().all()} if lines else {}
        index_by_line = {ln.id: i for i, ln in enumerate(lines)}
        splits = await _split.get_split_items(db, je.id)

        period = None
        if je.period_id:
            period = (await db.execute(select(FinPeriod).where(FinPeriod.id == je.period_id))).scalar_one_or_none()
        post_blockers = await check_journal_postable(db, je)

        def _s(v: Any) -> Optional[str]:
            return None if v is None else str(v)

        return {
            "ok": True,
            "issues": issues,
            "entry": {
                "entry_no": je.entry_no,
                "provisional": True,
                "status_after_save": je.status,
                "entry_date": je.entry_date.isoformat(),
                "total_debit": _s(je.total_debit),
                "total_credit": _s(je.total_credit),
                "period_id": _s(je.period_id),
                "period_name": period.name if period else None,
                "period_status": period.status if period else None,
                "fiscal_year_id": _s(je.fiscal_year_id),
            },
            "approval": {
                "required": bool(je.requires_approval),
                "amount": _s(je.total_debit),
            },
            "can_post_after_save": not [b for b in post_blockers if b["severity"] == "error"],
            "post_blockers": post_blockers,
            "lines": [{
                "index": i,
                "account_id": _s(ln.account_id),
                "account_code": accs[ln.account_id].code if ln.account_id in accs else None,
                "account_name": accs[ln.account_id].name if ln.account_id in accs else None,
                "description": ln.narration or None,
                "debit": _s(ln.debit), "credit": _s(ln.credit),
                "base_debit": _s(ln.base_debit), "base_credit": _s(ln.base_credit),
                "currency": ln.currency, "fx_rate": _s(ln.fx_rate),
                "cost_center_id": _s(ln.cost_center_id), "project_id": _s(ln.project_id),
                "open_item": ln.open_item_status,
            } for i, ln in enumerate(lines)],
            "split_items": [{
                "line_index": index_by_line.get(s.journal_line_id),
                "debit": _s(s.debit), "credit": _s(s.credit), "split_pct": _s(s.split_pct),
                "profit_center_id": _s(s.profit_center_id), "segment_id": _s(s.segment_id),
            } for s in splits],
        }
    finally:
        await nested.rollback()
