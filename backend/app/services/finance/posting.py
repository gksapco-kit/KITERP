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
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, case

from app.models.finance import (
    FinJournalEntry, FinJournalLine, FinAccount, FinPeriod, FinFiscalYear,
    FinFiscalYearCompany, FinCompany, FinApprovalPolicy, FinApprovalRequest,
)
from app.services.finance import field_rules as _field_rules
from app.services.finance import clearing as _clearing
from app.services.finance import posting_controls as _pc
from app.services.finance import rules_service as _rules
from app.services.finance import split_service as _split

log = logging.getLogger(__name__)

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


async def _next_entry_no(db: AsyncSession, vendor_id: UUID, source_type: str) -> str:
    prefix_map = {
        "invoice": "ARJ", "payment": "CRJ", "pos": "POS",
        "vendor_bill": "APJ", "vendor_payment": "VPJ",
        "payroll": "PAY", "expense": "EXP",
        "asset": "AST", "depreciation": "DEP", "disposal": "DIS",
        "loan": "LNJ", "investment": "INV", "fx": "FXJ",
        "opening": "OPN", "closing": "CLJ", "manual": "MNL",
        "commission_accrual": "CMJ", "commission_payment": "CMP",
        "co_cost_booking": "COJ",
    }
    prefix = prefix_map.get(source_type, "JNL")
    from sqlalchemy import func
    r = await db.execute(
        select(func.count()).select_from(FinJournalEntry).where(
            FinJournalEntry.vendor_id == vendor_id,
            FinJournalEntry.entry_no.like(f"{prefix}%"),
        )
    )
    count = r.scalar() or 0
    return f"{prefix}{str(count + 1).zfill(6)}"


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
    # Check for existing JE with same source (idempotent)
    existing_r = await db.execute(
        select(FinJournalEntry).where(
            FinJournalEntry.vendor_id == vendor_id,
            FinJournalEntry.source_type == source_type,
            FinJournalEntry.source_id == source_id,
            FinJournalEntry.status == "posted",
        )
    )
    existing = existing_r.scalar_one_or_none()
    if existing:
        # Void existing and re-post
        existing.status = "void"
        db.add(existing)

    _raw_date = payload.get("entry_date") or date.today()
    if isinstance(_raw_date, str):
        from datetime import date as _date_cls
        try:
            _raw_date = _date_cls.fromisoformat(_raw_date)
        except ValueError:
            _raw_date = date.today()
    entry_date: date = _raw_date
    cid = payload.get("company_id") if isinstance(payload, dict) else None
    if not cid:
        cid = await _resolve_default_company(db, vendor_id)
    period_id, fy_id = await _get_or_create_period(db, vendor_id, entry_date, cid)
    entry_no = await _next_entry_no(db, vendor_id, source_type)

    handler_map = {
        "invoice": _handle_invoice,
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
    }
    handler = handler_map.get(source_type)
    if not handler:
        log.warning("No posting handler for source_type=%s", source_type)
        return None

    lines = await handler(db, vendor_id, payload)
    if not lines:
        return None

    total_debit = sum(ln.debit for ln in lines)
    total_credit = sum(ln.credit for ln in lines)

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
        posted_at=datetime.utcnow(),
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


async def _handle_payment(db, vendor_id, payload):
    """
    Dr Bank/Cash  /  Cr AR
    payload: {amount, bank_account_gl_id, customer_id, narration}
    """
    bank_gl_id = payload.get("bank_account_gl_id")
    if bank_gl_id:
        r = await db.execute(select(FinAccount).where(FinAccount.id == bank_gl_id))
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
    payload: {subtotal, tax_amount, total, supplier_id, expense_account_id, narration}
    """
    ap = await _find_account(db, vendor_id, "Liability", "Current Liability", "Accounts Payable")
    exp_acc_id = payload.get("expense_account_id")
    if exp_acc_id:
        r = await db.execute(select(FinAccount).where(FinAccount.id == exp_acc_id))
        expense = r.scalar_one_or_none()
    else:
        expense = await _find_account(db, vendor_id, "Expense", "Operating Expense", "Purchase")
    gst_in = await _find_account(db, vendor_id, "Asset", "Current Asset", "GST Input")
    if not (ap and expense):
        return None

    subtotal = Decimal(str(payload.get("subtotal", 0)))
    tax = Decimal(str(payload.get("tax_amount", 0)))
    total = Decimal(str(payload.get("total", 0)))

    lines = [
        _line(expense, debit=subtotal, narration="Purchase Expense", vendor_id=vendor_id,
              party_type="supplier", party_id=payload.get("supplier_id")),
        _line(ap, credit=total, narration="AP - Vendor Bill", vendor_id=vendor_id,
              party_type="supplier", party_id=payload.get("supplier_id")),
    ]
    if tax > 0 and gst_in:
        lines.append(_line(gst_in, debit=tax, narration="GST Input Credit", vendor_id=vendor_id))
    return lines


async def _handle_vendor_payment(db, vendor_id, payload):
    """
    Dr AP  /  Cr Bank
    payload: {amount, supplier_id, bank_account_gl_id, narration}
    """
    ap = await _find_account(db, vendor_id, "Liability", "Current Liability", "Accounts Payable")
    bank_gl_id = payload.get("bank_account_gl_id")
    if bank_gl_id:
        r = await db.execute(select(FinAccount).where(FinAccount.id == bank_gl_id))
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
    Dr Salary Expense  /  Cr Salary Payable + TDS Payable
    payload: {gross_total, net_total, tds_total, narration}
    """
    salary_exp = await _find_account(db, vendor_id, "Expense", "Operating Expense", "Salary")
    salary_pay = await _find_account(db, vendor_id, "Liability", "Current Liability", "Salary Payable")
    tds_pay = await _find_account(db, vendor_id, "Liability", "Current Liability", "TDS Payable")
    if not (salary_exp and salary_pay):
        return None

    gross = Decimal(str(payload.get("gross_total", 0)))
    net = Decimal(str(payload.get("net_total", 0)))
    tds = Decimal(str(payload.get("tds_total", 0)))

    lines = [
        _line(salary_exp, debit=gross, narration="Salary Expense", vendor_id=vendor_id),
        _line(salary_pay, credit=net, narration="Salary Payable", vendor_id=vendor_id),
    ]
    if tds > 0 and tds_pay:
        lines.append(_line(tds_pay, credit=tds, narration="TDS Payable", vendor_id=vendor_id))
    return lines


async def _handle_expense(db, vendor_id, payload):
    """
    Dr Expense Account  /  Cr Bank/Cash
    payload: {amount, expense_account_id, bank_account_gl_id, narration}
    """
    exp_acc_id = payload.get("expense_account_id")
    if exp_acc_id:
        r = await db.execute(select(FinAccount).where(FinAccount.id == exp_acc_id))
        expense = r.scalar_one_or_none()
    else:
        expense = await _find_account(db, vendor_id, "Expense", "Operating Expense")
    bank_gl_id = payload.get("bank_account_gl_id")
    if bank_gl_id:
        r = await db.execute(select(FinAccount).where(FinAccount.id == bank_gl_id))
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
        r = await db.execute(select(FinAccount).where(FinAccount.id == asset_acc_id))
        asset_acc = r.scalar_one_or_none()
    else:
        asset_acc = await _find_account(db, vendor_id, "Asset", "Fixed Asset")
    credit_acc_id = payload.get("credit_account_id")
    if credit_acc_id:
        r = await db.execute(select(FinAccount).where(FinAccount.id == credit_acc_id))
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
        r1 = await db.execute(select(FinAccount).where(FinAccount.id == dep_exp_id))
        dep_exp = r1.scalar_one_or_none()
        r2 = await db.execute(select(FinAccount).where(FinAccount.id == accum_id))
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
    if gain_loss > 0:
        gain_acc = await _find_account(db, vendor_id, "Income", "Other Income", "Gain on Disposal")
        if gain_acc:
            lines.append(_line(gain_acc, credit=gain_loss, narration="Gain on Disposal", vendor_id=vendor_id))
    elif gain_loss < 0:
        loss_acc = await _find_account(db, vendor_id, "Expense", "Operating Expense", "Loss on Disposal")
        if loss_acc:
            lines.append(_line(loss_acc, debit=abs(gain_loss), narration="Loss on Disposal", vendor_id=vendor_id))
    return lines


async def _handle_loan(db, vendor_id, payload):
    """
    loan_event: disbursement or repayment
    payload: {event: 'disbursement'|'repayment', principal, interest, loan_account_id, bank_account_id, interest_account_id}
    """
    event = payload.get("event", "repayment")
    loan_gl_id = payload.get("loan_account_id")
    bank_gl_id = payload.get("bank_account_id")
    interest_gl_id = payload.get("interest_account_id")
    r1 = await db.execute(select(FinAccount).where(FinAccount.id == loan_gl_id)) if loan_gl_id else None
    loan_acc = r1.scalar_one_or_none() if r1 else await _find_account(db, vendor_id, "Liability", "Long-term Liability", "Loan")
    r2 = await db.execute(select(FinAccount).where(FinAccount.id == bank_gl_id)) if bank_gl_id else None
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
            r3 = await db.execute(select(FinAccount).where(FinAccount.id == interest_gl_id)) if interest_gl_id else None
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
        r = await db.execute(select(FinAccount).where(FinAccount.id == bank_account_id))
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

        r = await db.execute(select(FinAccount).where(FinAccount.id == ld["account_id"]))
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


async def _require_approval_if_needed(
    db: AsyncSession,
    vendor_id: UUID,
    je: FinJournalEntry,
    amount: Decimal,
    requested_by_id: Optional[UUID],
) -> None:
    """
    Check active FinApprovalPolicy for journal_entry.
    If matched, create a FinApprovalRequest and stamp the JE.
    """
    r = await db.execute(
        select(FinApprovalPolicy).where(
            FinApprovalPolicy.vendor_id == vendor_id,
            FinApprovalPolicy.entity_type == "journal_entry",
            FinApprovalPolicy.is_active == True,
        ).limit(1)
    )
    policy = r.scalar_one_or_none()
    if not policy:
        return

    # Trigger if threshold is None (always) or amount >= threshold
    if policy.threshold_amount is None or amount >= policy.threshold_amount:
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


async def create_journal_draft(
    db: AsyncSession,
    vendor_id: UUID,
    payload: "JournalEntryCreate",  # type: ignore[name-defined]
    created_by_id: Optional[UUID] = None,
) -> FinJournalEntry:
    """
    Enterprise path: validate and persist a draft JE with optional approval gating.
    Uses Pydantic-validated payload (already balanced).
    """
    from app.schemas.finance.journal import JournalEntryCreate as _Schema  # local import avoids circular

    entry_date = payload.entry_date
    company_id = payload.company_id
    if not company_id:
        company_id = await _resolve_default_company(db, vendor_id)
    period_id, fy_id = await _resolve_draft_period(
        db, vendor_id, entry_date, payload.period_id, company_id
    )
    entry_no = await _next_entry_no(db, vendor_id, payload.source_type)

    fr = await _field_rules.effective_field_rules(
        db, vendor_id, "journal_entry", company_id, created_by_id
    )
    if fr:
        _field_rules.assert_journal_mandatory(payload, fr)

    # Reconciliation account guard — applies to all manual / enterprise drafts
    line_account_ids = [ln_in.account_id for ln_in in payload.lines]
    await _guard_no_recon_accounts(db, vendor_id, line_account_ids)

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
        currency=payload.currency,
        created_by_id=created_by_id,
    )
    db.add(je)
    await db.flush()

    total_debit = Decimal("0")
    total_credit = Decimal("0")

    for seq, ln_in in enumerate(payload.lines):
        debit = ln_in.debit
        credit = ln_in.credit
        fx = ln_in.fx_rate
        base_debit = (debit * fx).quantize(Decimal("0.0001"))
        base_credit = (credit * fx).quantize(Decimal("0.0001"))
        total_debit += debit
        total_credit += credit

        ln = FinJournalLine(
            id=uuid.uuid4(),
            journal_entry_id=je.id,
            vendor_id=vendor_id,
            account_id=ln_in.account_id,
            store_id=ln_in.store_id,
            party_type=ln_in.party_type,
            party_id=ln_in.party_id,
            debit=debit,
            credit=credit,
            currency=ln_in.currency,
            fx_rate=fx,
            base_debit=base_debit,
            base_credit=base_credit,
            narration=ln_in.description or "",
            sequence=ln_in.sequence if ln_in.sequence else seq,
            cost_center_id=ln_in.cost_center_id,
            project_id=ln_in.project_id,
            intercompany_partner_id=ln_in.intercompany_partner_id,
            value_date=ln_in.value_date or entry_date,
            ref_doc_type=ln_in.ref_doc_type,
            ref_doc_id=ln_in.ref_doc_id,
            ref_doc_no=ln_in.ref_doc_no,
            tax_code=ln_in.tax_code,
            tax_amount=ln_in.tax_amount,
            assignment=ln_in.assignment,
        )
        db.add(ln)

    je.total_debit = total_debit
    je.total_credit = total_credit
    await db.flush()

    # Stamp open-item status for lines hitting reconcilable / control accounts
    lines_created = (await db.execute(
        select(FinJournalLine).where(FinJournalLine.journal_entry_id == je.id)
    )).scalars().all()
    await _clearing.stamp_open_items(db, vendor_id, list(lines_created))
    # Apply document splitting rules if configured
    await _split.apply_document_splitting(db, vendor_id, je.id)

    # Trigger approval if a policy exists
    await _require_approval_if_needed(db, vendor_id, je, total_debit, created_by_id)

    log.info("Created draft JE %s vendor=%s dr=%.2f cr=%.2f status=%s",
             entry_no, vendor_id, total_debit, total_credit, je.status)
    return je


async def post_entry_with_approval_check(
    db: AsyncSession,
    je: FinJournalEntry,
    posted_by_id: Optional[UUID],
) -> FinJournalEntry:
    """
    Post a draft JE, enforcing approval gate if required.
    Raises ValueError if approval is pending/rejected.
    """
    if je.requires_approval:
        if not je.approval_request_id:
            raise ValueError("Journal entry requires approval but has no approval request.")
        r = await db.execute(
            select(FinApprovalRequest).where(FinApprovalRequest.id == je.approval_request_id)
        )
        req = r.scalar_one_or_none()
        if req is None or req.status != "approved":
            raise ValueError(
                f"Journal entry {je.entry_no} requires approval "
                f"(current status: {req.status if req else 'unknown'})."
            )

    je.status = "posted"
    je.posted_by_id = posted_by_id
    je.posted_at = datetime.utcnow()
    await db.flush()
    log.info("Posted JE %s vendor=%s by=%s", je.entry_no, je.vendor_id, posted_by_id)
    return je


async def update_journal_draft(
    db: AsyncSession,
    je: FinJournalEntry,
    payload: "JournalEntryUpdate",  # type: ignore[name-defined]
    actor_vendor_user_id: Optional[UUID] = None,
) -> FinJournalEntry:
    """Update a draft JE header and/or replace all lines."""
    if je.status not in ("draft",):
        raise ValueError(f"Cannot edit JE in status '{je.status}'.")

    old_entry_date = je.entry_date

    if payload.entry_date is not None:
        je.entry_date = payload.entry_date
    if payload.document_date is not None:
        je.document_date = payload.document_date
    if payload.document_type is not None:
        je.document_type = payload.document_type
    if payload.reference is not None:
        je.reference = payload.reference
    if payload.narration is not None:
        je.narration = payload.narration
    if payload.header_text is not None:
        je.header_text = payload.header_text
    if payload.currency is not None:
        je.currency = payload.currency
    if payload.company_id is not None:
        je.company_id = payload.company_id

    if payload.lines is not None:
        # Delete existing lines and re-create
        from sqlalchemy import delete as sa_delete
        await db.execute(
            sa_delete(FinJournalLine).where(FinJournalLine.journal_entry_id == je.id)
        )
        total_debit = Decimal("0")
        total_credit = Decimal("0")
        for seq, ln_in in enumerate(payload.lines):
            debit = ln_in.debit
            credit = ln_in.credit
            fx = ln_in.fx_rate
            total_debit += debit
            total_credit += credit
            ln = FinJournalLine(
                id=uuid.uuid4(),
                journal_entry_id=je.id,
                vendor_id=je.vendor_id,
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
                narration=ln_in.description or "",
                sequence=ln_in.sequence if ln_in.sequence else seq,
                cost_center_id=ln_in.cost_center_id,
                project_id=ln_in.project_id,
                intercompany_partner_id=ln_in.intercompany_partner_id,
                value_date=ln_in.value_date or je.entry_date,
                ref_doc_type=ln_in.ref_doc_type,
                ref_doc_id=ln_in.ref_doc_id,
                ref_doc_no=ln_in.ref_doc_no,
                tax_code=ln_in.tax_code,
                tax_amount=ln_in.tax_amount,
                assignment=ln_in.assignment,
            )
            db.add(ln)
        je.total_debit = total_debit
        je.total_credit = total_credit

    date_changed = (
        payload.entry_date is not None
        and payload.entry_date != old_entry_date
    )
    company_id = je.company_id or await _resolve_default_company(db, je.vendor_id)
    if payload.period_id is not None:
        je.period_id, je.fiscal_year_id = await _resolve_draft_period(
            db, je.vendor_id, je.entry_date, payload.period_id, company_id
        )
    elif date_changed:
        period_id, fy_id = await _get_or_create_period(
            db, je.vendor_id, je.entry_date, company_id
        )
        je.period_id, je.fiscal_year_id = period_id, fy_id

    fru = await _field_rules.effective_field_rules(
        db, je.vendor_id, "journal_entry", je.company_id, actor_vendor_user_id
    )
    if fru:
        _field_rules.assert_journal_mandatory(je, fru)

    await db.flush()
    return je
