"""
Finance Repository — all data access for the Finance module.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import select, func, and_, or_, desc, delete as sa_delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.finance import (
    FinAccount, FinFiscalYear, FinFiscalYearCompany, FinPeriod, FinExchangeRate,
    FinJournalEntry, FinJournalLine, FinRecurringTemplate,
    FinCustomerPaymentApplication, FinArAgingSnapshot,
    FinVendorBill, FinVendorBillLine, FinVendorPayment,
    FinPaymentRun, FinPaymentRunItem, FinApAgingSnapshot,
    FinBankAccount, FinBankStatement, FinBankStatementLine,
    FinBankReconciliation, FinReconciliationMatch,
    FinBudget, FinBudgetLine, FinForecast, FinForecastLine,
    FinTaxCode, FinTaxReturn,
    FinAssetCategory, FinAsset, FinAssetDepreciationEntry,
    FinAssetDisposal, FinAssetMaintenance,
    FinLoan, FinLoanScheduleLine, FinInvestment, FinInvestmentValuation,
    FinApprovalPolicy, FinApprovalRequest, FinApprovalStep, FinAuditLog,
    FinFieldRule,
)
from app.models.invoice import Invoice
from app.models.customer import Customer


class FinCOARepo:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_accounts(self, vendor_id: UUID, account_type: str = None,
                            is_active: bool = None) -> list[FinAccount]:
        q = select(FinAccount).where(FinAccount.vendor_id == vendor_id)
        if account_type:
            q = q.where(FinAccount.account_type == account_type)
        if is_active is not None:
            q = q.where(FinAccount.is_active == is_active)
        q = q.order_by(FinAccount.code)
        r = await self.db.execute(q)
        return list(r.scalars().all())

    async def get_account(self, aid: UUID, vendor_id: UUID) -> Optional[FinAccount]:
        r = await self.db.execute(
            select(FinAccount).where(FinAccount.id == aid, FinAccount.vendor_id == vendor_id)
        )
        return r.scalar_one_or_none()

    async def create_account(self, vendor_id: UUID, data: dict) -> FinAccount:
        acc = FinAccount(id=uuid.uuid4(), vendor_id=vendor_id, **data)
        self.db.add(acc)
        await self.db.flush()
        return acc

    async def update_account(self, acc: FinAccount, data: dict) -> FinAccount:
        for k, v in data.items():
            setattr(acc, k, v)
        await self.db.flush()
        return acc

    async def list_fiscal_years(
        self, vendor_id: UUID, company_id: Optional[UUID] = None
    ) -> list[FinFiscalYear]:
        q = select(FinFiscalYear).where(FinFiscalYear.vendor_id == vendor_id)
        if company_id is not None:
            q = (
                q.join(
                    FinFiscalYearCompany,
                    and_(
                        FinFiscalYearCompany.fiscal_year_id == FinFiscalYear.id,
                        FinFiscalYearCompany.company_id == company_id,
                    ),
                )
                .distinct()
            )
        r = await self.db.execute(
            q.options(
                selectinload(FinFiscalYear.periods),
                selectinload(FinFiscalYear.assignments),
            ).order_by(FinFiscalYear.start_date.desc())
        )
        return list(r.scalars().all())

    async def get_fiscal_year(self, fy_id: UUID, vendor_id: UUID) -> Optional[FinFiscalYear]:
        r = await self.db.execute(
            select(FinFiscalYear).where(
                FinFiscalYear.id == fy_id, FinFiscalYear.vendor_id == vendor_id
            ).options(
                selectinload(FinFiscalYear.periods),
                selectinload(FinFiscalYear.assignments),
            )
        )
        return r.scalar_one_or_none()

    async def create_fiscal_year(self, vendor_id: UUID, data: dict) -> FinFiscalYear:
        fy = FinFiscalYear(id=uuid.uuid4(), vendor_id=vendor_id, **data)
        self.db.add(fy)
        await self.db.flush()
        return fy

    async def list_periods(self, vendor_id: UUID, fy_id: UUID = None) -> list[FinPeriod]:
        q = select(FinPeriod).where(FinPeriod.vendor_id == vendor_id)
        if fy_id:
            q = q.where(FinPeriod.fiscal_year_id == fy_id)
        r = await self.db.execute(q.order_by(FinPeriod.start_date))
        return list(r.scalars().all())

    async def close_period(self, period: FinPeriod, closed_by_id: UUID) -> FinPeriod:
        period.status = "closed"
        period.closed_at = datetime.now(timezone.utc)
        period.closed_by_id = closed_by_id
        await self.db.flush()
        return period

    async def lock_period(self, period: FinPeriod) -> FinPeriod:
        """Block posting without full period close (temporary control)."""
        if period.status == "closed":
            raise ValueError("Period is already closed; reopen it first if you need to change status.")
        period.status = "locked"
        await self.db.flush()
        return period

    async def reopen_period(self, period: FinPeriod) -> FinPeriod:
        """Re-open a locked or closed period for posting (admin use)."""
        period.status = "open"
        period.closed_at = None
        period.closed_by_id = None
        await self.db.flush()
        return period

    async def get_period(self, period_id: UUID, vendor_id: UUID) -> Optional[FinPeriod]:
        r = await self.db.execute(
            select(FinPeriod).where(FinPeriod.id == period_id, FinPeriod.vendor_id == vendor_id)
        )
        return r.scalar_one_or_none()

    async def list_field_rules(self, vendor_id: UUID, entity_type: str = None) -> list[FinFieldRule]:
        q = select(FinFieldRule).where(FinFieldRule.vendor_id == vendor_id)
        if entity_type:
            q = q.where(FinFieldRule.entity_type == entity_type)
        r = await self.db.execute(q.order_by(FinFieldRule.entity_type, FinFieldRule.scope, FinFieldRule.field_key))
        return list(r.scalars().all())

    async def get_field_rule(self, rule_id: UUID, vendor_id: UUID) -> Optional[FinFieldRule]:
        r = await self.db.execute(
            select(FinFieldRule).where(FinFieldRule.id == rule_id, FinFieldRule.vendor_id == vendor_id)
        )
        return r.scalar_one_or_none()

    async def create_field_rule(self, vendor_id: UUID, data: dict) -> FinFieldRule:
        row = FinFieldRule(id=uuid.uuid4(), vendor_id=vendor_id, **data)
        self.db.add(row)
        await self.db.flush()
        return row

    async def update_field_rule(self, row: FinFieldRule, data: dict) -> FinFieldRule:
        for k, v in data.items():
            if k in ("scope", "company_id", "vendor_user_id", "entity_type", "field_key", "requirement"):
                setattr(row, k, v)
        await self.db.flush()
        return row

    async def delete_field_rule(self, row: FinFieldRule) -> None:
        await self.db.execute(sa_delete(FinFieldRule).where(FinFieldRule.id == row.id))
        await self.db.flush()

    async def list_exchange_rates(self, vendor_id: UUID, from_currency: str = None) -> list[FinExchangeRate]:
        q = select(FinExchangeRate).where(FinExchangeRate.vendor_id == vendor_id)
        if from_currency:
            q = q.where(FinExchangeRate.from_currency == from_currency)
        r = await self.db.execute(q.order_by(FinExchangeRate.effective_date.desc()))
        return list(r.scalars().all())

    async def create_exchange_rate(self, vendor_id: UUID, data: dict) -> FinExchangeRate:
        er = FinExchangeRate(id=uuid.uuid4(), vendor_id=vendor_id, **data)
        self.db.add(er)
        await self.db.flush()
        return er


class FinJournalRepo:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_entries(self, vendor_id: UUID, status: str = None, source_type: str = None,
                           from_date: date = None, to_date: date = None,
                           skip: int = 0, limit: int = 50) -> list[FinJournalEntry]:
        q = (select(FinJournalEntry)
             .where(FinJournalEntry.vendor_id == vendor_id)
             .options(selectinload(FinJournalEntry.lines).selectinload(FinJournalLine.account))
             .order_by(FinJournalEntry.entry_date.desc(), FinJournalEntry.created_at.desc()))
        if status:
            q = q.where(FinJournalEntry.status == status)
        if source_type:
            q = q.where(FinJournalEntry.source_type == source_type)
        if from_date:
            q = q.where(FinJournalEntry.entry_date >= from_date)
        if to_date:
            q = q.where(FinJournalEntry.entry_date <= to_date)
        r = await self.db.execute(q.offset(skip).limit(limit))
        return list(r.scalars().all())

    async def count_entries(self, vendor_id: UUID, status: str = None) -> int:
        q = select(func.count()).select_from(FinJournalEntry).where(
            FinJournalEntry.vendor_id == vendor_id)
        if status:
            q = q.where(FinJournalEntry.status == status)
        r = await self.db.execute(q)
        return r.scalar() or 0

    async def get_entry(self, je_id: UUID, vendor_id: UUID) -> Optional[FinJournalEntry]:
        r = await self.db.execute(
            select(FinJournalEntry)
            .where(FinJournalEntry.id == je_id, FinJournalEntry.vendor_id == vendor_id)
            .options(selectinload(FinJournalEntry.lines).selectinload(FinJournalLine.account))
        )
        return r.scalar_one_or_none()

    async def create_entry(self, vendor_id: UUID, data: dict) -> FinJournalEntry:
        lines_data = data.pop("lines", [])
        je = FinJournalEntry(id=uuid.uuid4(), vendor_id=vendor_id, **data)
        self.db.add(je)
        await self.db.flush()
        for ld in lines_data:
            ln = FinJournalLine(id=uuid.uuid4(), journal_entry_id=je.id, vendor_id=vendor_id, **ld)
            self.db.add(ln)
        await self.db.flush()
        return je

    async def post_entry(self, je: FinJournalEntry, posted_by_id: UUID) -> FinJournalEntry:
        from datetime import datetime
        je.status = "posted"
        je.posted_by_id = posted_by_id
        je.posted_at = datetime.utcnow()
        await self.db.flush()
        return je

    async def void_entry(self, je: FinJournalEntry) -> FinJournalEntry:
        je.status = "void"
        await self.db.flush()
        return je

    async def trial_balance(self, vendor_id: UUID, from_date: date = None,
                            to_date: date = None) -> list[dict]:
        q = (
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
                FinAccount.vendor_id == vendor_id,
                FinJournalEntry.status == "posted",
            )
        )
        if from_date:
            q = q.where(FinJournalEntry.entry_date >= from_date)
        if to_date:
            q = q.where(FinJournalEntry.entry_date <= to_date)
        q = q.group_by(FinAccount.id, FinAccount.code, FinAccount.name,
                       FinAccount.account_type, FinAccount.account_subtype)
        q = q.order_by(FinAccount.code)
        r = await self.db.execute(q)
        rows = r.mappings().all()
        return [
            {
                "account_id": str(row["id"]),
                "code": row["code"],
                "name": row["name"],
                "account_type": row["account_type"],
                "account_subtype": row["account_subtype"],
                "total_debit": float(row["total_debit"]),
                "total_credit": float(row["total_credit"]),
                "balance": float(row["total_debit"]) - float(row["total_credit"]),
            }
            for row in rows
        ]

    async def ledger_for_account(self, vendor_id: UUID, account_id: UUID,
                                 from_date: date = None, to_date: date = None) -> list[dict]:
        q = (
            select(FinJournalLine, FinJournalEntry)
            .join(FinJournalEntry, FinJournalLine.journal_entry_id == FinJournalEntry.id)
            .where(
                FinJournalLine.vendor_id == vendor_id,
                FinJournalLine.account_id == account_id,
                FinJournalEntry.status == "posted",
            )
            .order_by(FinJournalEntry.entry_date, FinJournalEntry.entry_no)
        )
        if from_date:
            q = q.where(FinJournalEntry.entry_date >= from_date)
        if to_date:
            q = q.where(FinJournalEntry.entry_date <= to_date)
        r = await self.db.execute(q)
        rows = r.all()
        running = Decimal(0)
        result = []
        for ln, je in rows:
            running += ln.debit - ln.credit
            result.append({
                "date": str(je.entry_date),
                "entry_no": je.entry_no,
                "narration": ln.narration or je.narration,
                "debit": float(ln.debit),
                "credit": float(ln.credit),
                "balance": float(running),
                "source_type": je.source_type,
                "source_id": str(je.source_id) if je.source_id else None,
            })
        return result

    async def ledger_for_party(
        self,
        vendor_id: UUID,
        party_type: str,
        party_id: UUID,
        from_date: date = None,
        to_date: date = None,
    ) -> list[dict]:
        """Return posted journal lines for a specific party (customer/supplier/employee/contractor)."""
        q = (
            select(FinJournalLine, FinJournalEntry, FinAccount)
            .join(FinJournalEntry, FinJournalLine.journal_entry_id == FinJournalEntry.id)
            .join(FinAccount, FinJournalLine.account_id == FinAccount.id)
            .where(
                FinJournalLine.vendor_id == vendor_id,
                FinJournalLine.party_type == party_type,
                FinJournalLine.party_id == party_id,
                FinJournalEntry.status == "posted",
            )
            .order_by(FinJournalEntry.entry_date, FinJournalEntry.entry_no)
        )
        if from_date:
            q = q.where(FinJournalEntry.entry_date >= from_date)
        if to_date:
            q = q.where(FinJournalEntry.entry_date <= to_date)
        r = await self.db.execute(q)
        rows = r.all()
        running = Decimal(0)
        result = []
        for ln, je, acc in rows:
            running += ln.debit - ln.credit
            result.append({
                "date": str(je.entry_date),
                "entry_no": je.entry_no,
                "account_code": acc.code,
                "account_name": acc.name,
                "account_type": acc.account_type,
                "narration": ln.narration or je.narration,
                "debit": float(ln.debit),
                "credit": float(ln.credit),
                "balance": float(running),
                "source_type": je.source_type,
                "source_id": str(je.source_id) if je.source_id else None,
                "ref_doc_type": ln.ref_doc_type,
                "ref_doc_no": ln.ref_doc_no,
            })
        return result

    async def ledger_for_cost_center(
        self,
        vendor_id: UUID,
        cost_center_id: UUID,
        from_date: date = None,
        to_date: date = None,
    ) -> list[dict]:
        """Return posted journal lines for a specific cost center."""
        q = (
            select(FinJournalLine, FinJournalEntry, FinAccount)
            .join(FinJournalEntry, FinJournalLine.journal_entry_id == FinJournalEntry.id)
            .join(FinAccount, FinJournalLine.account_id == FinAccount.id)
            .where(
                FinJournalLine.vendor_id == vendor_id,
                FinJournalLine.cost_center_id == cost_center_id,
                FinJournalEntry.status == "posted",
            )
            .order_by(FinJournalEntry.entry_date, FinJournalEntry.entry_no)
        )
        if from_date:
            q = q.where(FinJournalEntry.entry_date >= from_date)
        if to_date:
            q = q.where(FinJournalEntry.entry_date <= to_date)
        r = await self.db.execute(q)
        rows = r.all()
        running = Decimal(0)
        result = []
        for ln, je, acc in rows:
            running += ln.debit - ln.credit
            result.append({
                "date": str(je.entry_date),
                "entry_no": je.entry_no,
                "account_code": acc.code,
                "account_name": acc.name,
                "account_type": acc.account_type,
                "narration": ln.narration or je.narration,
                "debit": float(ln.debit),
                "credit": float(ln.credit),
                "balance": float(running),
                "source_type": je.source_type,
                "source_id": str(je.source_id) if je.source_id else None,
            })
        return result


class FinARRepo:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def ar_aging(self, vendor_id: UUID, as_of: date = None) -> list[dict]:
        as_of = as_of or date.today()
        r = await self.db.execute(
            select(Invoice).where(
                Invoice.vendor_id == vendor_id,
                Invoice.invoice_type == "invoice",
                Invoice.status.notin_(["draft", "void", "cancelled"]),
            )
        )
        invoices = r.scalars().all()
        buckets: dict[UUID, dict] = {}
        for inv in invoices:
            bal = float(inv.balance_due or 0)
            if bal <= 0:
                continue
            cid = inv.customer_id
            if cid not in buckets:
                buckets[cid] = {"customer_id": str(cid), "current": 0,
                                "1_30": 0, "31_60": 0, "61_90": 0, "90_plus": 0}
            due = inv.invoice_date or inv.created_at.date() if inv.created_at else as_of
            age = (as_of - due).days if isinstance(due, date) else 0
            if age <= 0:
                buckets[cid]["current"] += bal
            elif age <= 30:
                buckets[cid]["1_30"] += bal
            elif age <= 60:
                buckets[cid]["31_60"] += bal
            elif age <= 90:
                buckets[cid]["61_90"] += bal
            else:
                buckets[cid]["90_plus"] += bal
        return list(buckets.values())

    async def list_payment_applications(self, vendor_id: UUID,
                                        invoice_id: UUID = None) -> list[FinCustomerPaymentApplication]:
        q = select(FinCustomerPaymentApplication).where(
            FinCustomerPaymentApplication.vendor_id == vendor_id)
        if invoice_id:
            q = q.where(FinCustomerPaymentApplication.invoice_id == invoice_id)
        r = await self.db.execute(q)
        return list(r.scalars().all())

    async def apply_payment(self, vendor_id: UUID, data: dict) -> FinCustomerPaymentApplication:
        app = FinCustomerPaymentApplication(id=uuid.uuid4(), vendor_id=vendor_id, **data)
        self.db.add(app)
        await self.db.flush()
        return app


class FinAPRepo:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_bills(self, vendor_id: UUID, status: str = None, supplier_id: UUID = None,
                         skip: int = 0, limit: int = 50) -> list[FinVendorBill]:
        q = (select(FinVendorBill).where(FinVendorBill.vendor_id == vendor_id)
             .options(selectinload(FinVendorBill.lines))
             .order_by(FinVendorBill.bill_date.desc()))
        if status:
            q = q.where(FinVendorBill.status == status)
        if supplier_id:
            q = q.where(FinVendorBill.supplier_id == supplier_id)
        r = await self.db.execute(q.offset(skip).limit(limit))
        return list(r.scalars().all())

    async def get_bill(self, bill_id: UUID, vendor_id: UUID) -> Optional[FinVendorBill]:
        r = await self.db.execute(
            select(FinVendorBill)
            .where(FinVendorBill.id == bill_id, FinVendorBill.vendor_id == vendor_id)
            .options(selectinload(FinVendorBill.lines))
        )
        return r.scalar_one_or_none()

    async def create_bill(self, vendor_id: UUID, data: dict) -> FinVendorBill:
        lines_data = data.pop("lines", [])
        bill = FinVendorBill(id=uuid.uuid4(), vendor_id=vendor_id, **data)
        self.db.add(bill)
        await self.db.flush()
        for i, ld in enumerate(lines_data):
            ln = FinVendorBillLine(id=uuid.uuid4(), bill_id=bill.id, sequence=i, **ld)
            self.db.add(ln)
        await self.db.flush()
        return bill

    async def update_bill(self, bill: FinVendorBill, data: dict) -> FinVendorBill:
        for k, v in data.items():
            if k != "lines":
                setattr(bill, k, v)
        await self.db.flush()
        return bill

    async def post_bill(self, bill: FinVendorBill) -> FinVendorBill:
        bill.status = "open"
        bill.balance_due = bill.total
        await self.db.flush()
        return bill

    async def list_payment_runs(self, vendor_id: UUID, status: str = None) -> list[FinPaymentRun]:
        q = (select(FinPaymentRun).where(FinPaymentRun.vendor_id == vendor_id)
             .options(selectinload(FinPaymentRun.items))
             .order_by(FinPaymentRun.created_at.desc()))
        if status:
            q = q.where(FinPaymentRun.status == status)
        r = await self.db.execute(q)
        return list(r.scalars().all())

    async def create_payment_run(self, vendor_id: UUID, data: dict) -> FinPaymentRun:
        items_data = data.pop("items", [])
        run = FinPaymentRun(id=uuid.uuid4(), vendor_id=vendor_id, **data)
        self.db.add(run)
        await self.db.flush()
        for item in items_data:
            ri = FinPaymentRunItem(id=uuid.uuid4(), run_id=run.id, **item)
            self.db.add(ri)
        await self.db.flush()
        return run

    async def record_vendor_payment(self, vendor_id: UUID, data: dict) -> FinVendorPayment:
        vp = FinVendorPayment(id=uuid.uuid4(), vendor_id=vendor_id, **data)
        self.db.add(vp)
        await self.db.flush()
        # Update bill balance
        if vp.bill_id:
            r = await self.db.execute(
                select(FinVendorBill).where(FinVendorBill.id == vp.bill_id))
            bill = r.scalar_one_or_none()
            if bill:
                bill.amount_paid = (bill.amount_paid or 0) + vp.amount
                bill.balance_due = bill.total - bill.amount_paid
                bill.status = "paid" if bill.balance_due <= 0 else "partially_paid"
        return vp

    async def ap_aging(self, vendor_id: UUID, as_of: date = None) -> list[dict]:
        as_of = as_of or date.today()
        r = await self.db.execute(
            select(FinVendorBill).where(
                FinVendorBill.vendor_id == vendor_id,
                FinVendorBill.status.in_(["open", "partially_paid"]),
            )
        )
        bills = r.scalars().all()
        buckets: dict[UUID, dict] = {}
        for b in bills:
            bal = float(b.balance_due or 0)
            if bal <= 0:
                continue
            sid = b.supplier_id
            if sid not in buckets:
                buckets[sid] = {"supplier_id": str(sid), "current": 0,
                                "1_30": 0, "31_60": 0, "61_90": 0, "90_plus": 0}
            due = b.due_date or b.bill_date
            age = (as_of - due).days if due else 0
            if age <= 0:
                buckets[sid]["current"] += bal
            elif age <= 30:
                buckets[sid]["1_30"] += bal
            elif age <= 60:
                buckets[sid]["31_60"] += bal
            elif age <= 90:
                buckets[sid]["61_90"] += bal
            else:
                buckets[sid]["90_plus"] += bal
        return list(buckets.values())


class FinBankRepo:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_bank_accounts(self, vendor_id: UUID) -> list[FinBankAccount]:
        r = await self.db.execute(
            select(FinBankAccount).where(FinBankAccount.vendor_id == vendor_id)
            .order_by(FinBankAccount.name)
        )
        return list(r.scalars().all())

    async def get_bank_account(self, ba_id: UUID, vendor_id: UUID) -> Optional[FinBankAccount]:
        r = await self.db.execute(
            select(FinBankAccount).where(
                FinBankAccount.id == ba_id, FinBankAccount.vendor_id == vendor_id)
        )
        return r.scalar_one_or_none()

    async def create_bank_account(self, vendor_id: UUID, data: dict) -> FinBankAccount:
        ba = FinBankAccount(id=uuid.uuid4(), vendor_id=vendor_id, **data)
        self.db.add(ba)
        await self.db.flush()
        return ba

    async def update_bank_account(self, ba: FinBankAccount, data: dict) -> FinBankAccount:
        for k, v in data.items():
            setattr(ba, k, v)
        await self.db.flush()
        return ba

    async def create_statement(self, vendor_id: UUID, data: dict) -> FinBankStatement:
        lines_data = data.pop("lines", [])
        stmt = FinBankStatement(id=uuid.uuid4(), vendor_id=vendor_id, **data)
        self.db.add(stmt)
        await self.db.flush()
        for i, ld in enumerate(lines_data):
            ln = FinBankStatementLine(id=uuid.uuid4(), statement_id=stmt.id, vendor_id=vendor_id, **ld)
            self.db.add(ln)
        await self.db.flush()
        return stmt

    async def list_statements(self, vendor_id: UUID, bank_account_id: UUID = None) -> list[FinBankStatement]:
        q = select(FinBankStatement).where(FinBankStatement.vendor_id == vendor_id)
        if bank_account_id:
            q = q.where(FinBankStatement.bank_account_id == bank_account_id)
        r = await self.db.execute(q.order_by(FinBankStatement.statement_date.desc()))
        return list(r.scalars().all())

    async def get_statement(self, stmt_id: UUID, vendor_id: UUID) -> Optional[FinBankStatement]:
        r = await self.db.execute(
            select(FinBankStatement)
            .where(FinBankStatement.id == stmt_id, FinBankStatement.vendor_id == vendor_id)
            .options(selectinload(FinBankStatement.lines))
        )
        return r.scalar_one_or_none()

    async def create_reconciliation(self, vendor_id: UUID, data: dict) -> FinBankReconciliation:
        rec = FinBankReconciliation(id=uuid.uuid4(), vendor_id=vendor_id, **data)
        self.db.add(rec)
        await self.db.flush()
        return rec

    async def list_reconciliations(self, vendor_id: UUID,
                                   bank_account_id: UUID = None) -> list[FinBankReconciliation]:
        q = (select(FinBankReconciliation).where(FinBankReconciliation.vendor_id == vendor_id)
             .order_by(FinBankReconciliation.reconciliation_date.desc()))
        if bank_account_id:
            q = q.where(FinBankReconciliation.bank_account_id == bank_account_id)
        r = await self.db.execute(q)
        return list(r.scalars().all())

    async def auto_match(self, vendor_id: UUID, reconciliation_id: UUID,
                         bank_account_id: UUID) -> list[FinReconciliationMatch]:
        """Simple heuristic: match unreconciled statement lines to journal lines by amount+date."""
        r1 = await self.db.execute(
            select(FinBankStatementLine).where(
                FinBankStatementLine.vendor_id == vendor_id,
                FinBankStatementLine.is_reconciled == False,
            )
        )
        stmt_lines = r1.scalars().all()

        r2 = await self.db.execute(
            select(FinJournalLine).join(FinJournalEntry, FinJournalLine.journal_entry_id == FinJournalEntry.id)
            .where(FinJournalLine.vendor_id == vendor_id, FinJournalEntry.status == "posted")
        )
        jl_lines = r2.scalars().all()

        matches = []
        jl_by_amount: dict[Decimal, list] = {}
        for jl in jl_lines:
            amt = jl.debit or jl.credit
            jl_by_amount.setdefault(amt, []).append(jl)

        for sl in stmt_lines:
            amt = sl.debit or sl.credit
            candidates = jl_by_amount.get(amt, [])
            if candidates:
                jl = candidates.pop(0)
                match = FinReconciliationMatch(
                    id=uuid.uuid4(),
                    reconciliation_id=reconciliation_id,
                    statement_line_id=sl.id,
                    journal_line_id=jl.id,
                    amount=amt,
                    match_type="exact",
                )
                self.db.add(match)
                sl.is_reconciled = True
                sl.reconciliation_id = reconciliation_id
                matches.append(match)

        await self.db.flush()
        return matches


class FinBudgetRepo:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_budgets(self, vendor_id: UUID, fy_id: UUID = None) -> list[FinBudget]:
        q = (select(FinBudget).where(FinBudget.vendor_id == vendor_id)
             .options(selectinload(FinBudget.lines))
             .order_by(FinBudget.created_at.desc()))
        if fy_id:
            q = q.where(FinBudget.fiscal_year_id == fy_id)
        r = await self.db.execute(q)
        return list(r.scalars().all())

    async def get_budget(self, bid: UUID, vendor_id: UUID) -> Optional[FinBudget]:
        r = await self.db.execute(
            select(FinBudget).where(FinBudget.id == bid, FinBudget.vendor_id == vendor_id)
            .options(selectinload(FinBudget.lines))
        )
        return r.scalar_one_or_none()

    async def create_budget(self, vendor_id: UUID, data: dict) -> FinBudget:
        lines_data = data.pop("lines", [])
        b = FinBudget(id=uuid.uuid4(), vendor_id=vendor_id, **data)
        self.db.add(b)
        await self.db.flush()
        for ld in lines_data:
            ln = FinBudgetLine(id=uuid.uuid4(), budget_id=b.id, **ld)
            self.db.add(ln)
        await self.db.flush()
        return b

    async def update_budget(self, b: FinBudget, data: dict) -> FinBudget:
        for k, v in data.items():
            if k != "lines":
                setattr(b, k, v)
        await self.db.flush()
        return b

    async def budget_variance(self, vendor_id: UUID, budget_id: UUID) -> list[dict]:
        b = await self.get_budget(budget_id, vendor_id)
        if not b:
            return []
        result = []
        for ln in b.lines:
            # Get actual from journal
            r = await self.db.execute(
                select(
                    func.coalesce(func.sum(FinJournalLine.debit - FinJournalLine.credit), 0)
                ).join(FinJournalEntry, FinJournalLine.journal_entry_id == FinJournalEntry.id)
                .where(
                    FinJournalLine.account_id == ln.account_id,
                    FinJournalEntry.vendor_id == vendor_id,
                    FinJournalEntry.status == "posted",
                )
            )
            actual = float(r.scalar() or 0)
            result.append({
                "account_id": str(ln.account_id),
                "period_id": str(ln.period_id) if ln.period_id else None,
                "budget": float(ln.amount),
                "actual": actual,
                "variance": actual - float(ln.amount),
                "variance_pct": round((actual - float(ln.amount)) / float(ln.amount) * 100, 2)
                                if ln.amount else 0,
            })
        return result

    async def list_forecasts(self, vendor_id: UUID) -> list[FinForecast]:
        r = await self.db.execute(
            select(FinForecast).where(FinForecast.vendor_id == vendor_id)
            .options(selectinload(FinForecast.lines))
            .order_by(FinForecast.created_at.desc())
        )
        return list(r.scalars().all())

    async def create_forecast(self, vendor_id: UUID, data: dict) -> FinForecast:
        lines_data = data.pop("lines", [])
        f = FinForecast(id=uuid.uuid4(), vendor_id=vendor_id, **data)
        self.db.add(f)
        await self.db.flush()
        for ld in lines_data:
            fl = FinForecastLine(id=uuid.uuid4(), forecast_id=f.id, **ld)
            self.db.add(fl)
        await self.db.flush()
        return f


class FinAssetRepo:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_categories(self, vendor_id: UUID) -> list[FinAssetCategory]:
        r = await self.db.execute(
            select(FinAssetCategory).where(FinAssetCategory.vendor_id == vendor_id)
        )
        return list(r.scalars().all())

    async def create_category(self, vendor_id: UUID, data: dict) -> FinAssetCategory:
        cat = FinAssetCategory(id=uuid.uuid4(), vendor_id=vendor_id, **data)
        self.db.add(cat)
        await self.db.flush()
        return cat

    async def list_assets(self, vendor_id: UUID, status: str = None,
                          category_id: UUID = None) -> list[FinAsset]:
        q = (select(FinAsset).where(FinAsset.vendor_id == vendor_id)
             .options(selectinload(FinAsset.category))
             .order_by(FinAsset.asset_code))
        if status:
            q = q.where(FinAsset.status == status)
        if category_id:
            q = q.where(FinAsset.category_id == category_id)
        r = await self.db.execute(q)
        return list(r.scalars().all())

    async def get_asset(self, aid: UUID, vendor_id: UUID) -> Optional[FinAsset]:
        r = await self.db.execute(
            select(FinAsset).where(FinAsset.id == aid, FinAsset.vendor_id == vendor_id)
            .options(selectinload(FinAsset.category),
                     selectinload(FinAsset.depreciation_entries),
                     selectinload(FinAsset.maintenance_records))
        )
        return r.scalar_one_or_none()

    async def create_asset(self, vendor_id: UUID, data: dict) -> FinAsset:
        asset = FinAsset(id=uuid.uuid4(), vendor_id=vendor_id, **data)
        asset.current_value = asset.purchase_cost
        self.db.add(asset)
        await self.db.flush()
        return asset

    async def update_asset(self, asset: FinAsset, data: dict) -> FinAsset:
        for k, v in data.items():
            setattr(asset, k, v)
        await self.db.flush()
        return asset

    async def record_depreciation(self, vendor_id: UUID, asset: FinAsset,
                                  amount: Decimal, period_id: UUID = None,
                                  je_id: UUID = None) -> FinAssetDepreciationEntry:
        entry = FinAssetDepreciationEntry(
            id=uuid.uuid4(),
            asset_id=asset.id,
            vendor_id=vendor_id,
            period_id=period_id,
            depreciation_date=date.today(),
            amount=amount,
            book_value_after=float(asset.current_value or 0) - float(amount),
            journal_entry_id=je_id,
        )
        self.db.add(entry)
        asset.accumulated_depreciation = (asset.accumulated_depreciation or 0) + float(amount)
        asset.current_value = (asset.current_value or 0) - float(amount)
        await self.db.flush()
        return entry

    async def calculate_depreciation(self, asset: FinAsset) -> Decimal:
        """Calculate depreciation amount for one period."""
        if not asset.purchase_cost:
            return Decimal(0)
        cost = Decimal(str(asset.purchase_cost))
        salvage = Decimal(str(asset.salvage_value or 0))
        life = asset.useful_life_years or 5
        method = asset.depreciation_method or "straight_line"
        if method == "straight_line":
            annual = (cost - salvage) / life
            return round(annual / 12, 4)  # monthly
        elif method == "wdv":
            rate = Decimal("2") / Decimal(str(life))
            current = Decimal(str(asset.current_value or cost))
            return round(current * rate / 12, 4)
        return Decimal(0)

    async def dispose_asset(self, vendor_id: UUID, asset: FinAsset,
                            data: dict, je_id: UUID = None) -> FinAssetDisposal:
        disposal = FinAssetDisposal(
            id=uuid.uuid4(), asset_id=asset.id, vendor_id=vendor_id,
            journal_entry_id=je_id, **data
        )
        self.db.add(disposal)
        asset.status = "disposed"
        asset.disposal_date = data.get("disposal_date")
        asset.disposal_value = data.get("sale_price", 0)
        await self.db.flush()
        return disposal

    async def list_maintenance(self, vendor_id: UUID, asset_id: UUID = None) -> list[FinAssetMaintenance]:
        q = select(FinAssetMaintenance).where(FinAssetMaintenance.vendor_id == vendor_id)
        if asset_id:
            q = q.where(FinAssetMaintenance.asset_id == asset_id)
        r = await self.db.execute(q.order_by(FinAssetMaintenance.maintenance_date.desc()))
        return list(r.scalars().all())

    async def create_maintenance(self, vendor_id: UUID, data: dict) -> FinAssetMaintenance:
        m = FinAssetMaintenance(id=uuid.uuid4(), vendor_id=vendor_id, **data)
        self.db.add(m)
        await self.db.flush()
        return m


class FinTaxRepo:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_tax_codes(self, vendor_id: UUID) -> list[FinTaxCode]:
        r = await self.db.execute(
            select(FinTaxCode).where(FinTaxCode.vendor_id == vendor_id)
            .order_by(FinTaxCode.code)
        )
        return list(r.scalars().all())

    async def create_tax_code(self, vendor_id: UUID, data: dict) -> FinTaxCode:
        tc = FinTaxCode(id=uuid.uuid4(), vendor_id=vendor_id, **data)
        self.db.add(tc)
        await self.db.flush()
        return tc

    async def list_returns(self, vendor_id: UUID, return_type: str = None) -> list[FinTaxReturn]:
        q = select(FinTaxReturn).where(FinTaxReturn.vendor_id == vendor_id)
        if return_type:
            q = q.where(FinTaxReturn.return_type == return_type)
        r = await self.db.execute(q.order_by(FinTaxReturn.period_start.desc()))
        return list(r.scalars().all())

    async def get_return(self, tr_id: UUID, vendor_id: UUID) -> Optional[FinTaxReturn]:
        r = await self.db.execute(
            select(FinTaxReturn).where(
                FinTaxReturn.id == tr_id, FinTaxReturn.vendor_id == vendor_id)
        )
        return r.scalar_one_or_none()

    async def create_return(self, vendor_id: UUID, data: dict) -> FinTaxReturn:
        tr = FinTaxReturn(id=uuid.uuid4(), vendor_id=vendor_id, **data)
        self.db.add(tr)
        await self.db.flush()
        return tr

    async def update_return(self, tr: FinTaxReturn, data: dict) -> FinTaxReturn:
        for k, v in data.items():
            setattr(tr, k, v)
        await self.db.flush()
        return tr

    async def compute_gstr1(self, vendor_id: UUID, period_start: date,
                            period_end: date) -> dict:
        """Build GSTR-1 JSON from existing invoices."""
        r = await self.db.execute(
            select(Invoice).where(
                Invoice.vendor_id == vendor_id,
                Invoice.invoice_type == "invoice",
                Invoice.status.notin_(["draft", "void", "cancelled"]),
            )
        )
        invoices = r.scalars().all()
        b2b = []
        b2c_large = []
        b2c_small = []
        for inv in invoices:
            if not inv.created_at:
                continue
            inv_date = inv.created_at.date()
            if not (period_start <= inv_date <= period_end):
                continue
            row = {
                "invoice_number": inv.invoice_number,
                "invoice_date": str(inv_date),
                "total": float(inv.total or 0),
                "taxable_value": float(inv.taxable_amount or 0),
                "cgst": float(inv.cgst_amount or 0) if hasattr(inv, "cgst_amount") else 0,
                "sgst": float(inv.sgst_amount or 0) if hasattr(inv, "sgst_amount") else 0,
                "igst": float(inv.igst_amount or 0) if hasattr(inv, "igst_amount") else 0,
                "place_of_supply": getattr(inv, "place_of_supply", None),
                "customer_gstin": inv.customer_gstin,
            }
            if inv.customer_gstin:
                b2b.append(row)
            elif float(inv.total or 0) >= 250000:
                b2c_large.append(row)
            else:
                b2c_small.append(row)
        return {
            "period": f"{period_start} to {period_end}",
            "b2b": b2b,
            "b2cl": b2c_large,
            "b2cs": b2c_small,
            "total_invoices": len(invoices),
            "total_taxable": sum(float(i.taxable_amount or 0) for i in invoices),
            "total_tax": sum(float(getattr(i, "total_tax_amount", i.tax_amount) or 0) for i in invoices),
        }

    async def compute_gstr3b(self, vendor_id: UUID, period_start: date,
                             period_end: date) -> dict:
        gstr1 = await self.compute_gstr1(vendor_id, period_start, period_end)
        total_outward_tax = gstr1["total_tax"]
        # Inward supplies (ITC) from vendor bills
        r = await self.db.execute(
            select(func.coalesce(func.sum(FinVendorBill.tax_amount), 0))
            .where(
                FinVendorBill.vendor_id == vendor_id,
                FinVendorBill.bill_date >= period_start,
                FinVendorBill.bill_date <= period_end,
                FinVendorBill.status != "void",
            )
        )
        itc = float(r.scalar() or 0)
        return {
            "period": f"{period_start} to {period_end}",
            "outward_tax_liability": total_outward_tax,
            "inward_itc": itc,
            "net_payable": max(0, total_outward_tax - itc),
            "total_taxable_turnover": gstr1["total_taxable"],
        }


class FinReportRepo:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _account_balance(self, vendor_id: UUID, account_type: str,
                                from_date: date, to_date: date) -> dict[str, float]:
        r = await self.db.execute(
            select(
                FinAccount.id,
                FinAccount.name,
                FinAccount.account_subtype,
                func.coalesce(func.sum(FinJournalLine.debit), 0).label("dr"),
                func.coalesce(func.sum(FinJournalLine.credit), 0).label("cr"),
            )
            .join(FinJournalLine, FinJournalLine.account_id == FinAccount.id)
            .join(FinJournalEntry, FinJournalLine.journal_entry_id == FinJournalEntry.id)
            .where(
                FinAccount.vendor_id == vendor_id,
                FinAccount.account_type == account_type,
                FinJournalEntry.status == "posted",
                FinJournalEntry.entry_date >= from_date,
                FinJournalEntry.entry_date <= to_date,
            )
            .group_by(FinAccount.id, FinAccount.name, FinAccount.account_subtype)
        )
        return {
            row["id"]: {
                "id": str(row["id"]),
                "name": row["name"],
                "subtype": row["account_subtype"],
                "balance": float(row["dr"]) - float(row["cr"]),
            }
            for row in r.mappings().all()
        }

    async def profit_and_loss(self, vendor_id: UUID,
                              from_date: date, to_date: date) -> dict:
        income = await self._account_balance(vendor_id, "Income", from_date, to_date)
        expense = await self._account_balance(vendor_id, "Expense", from_date, to_date)
        total_income = sum(abs(v["balance"]) for v in income.values())
        total_expense = sum(abs(v["balance"]) for v in expense.values())
        return {
            "period": f"{from_date} to {to_date}",
            "income": list(income.values()),
            "expenses": list(expense.values()),
            "total_income": total_income,
            "total_expenses": total_expense,
            "net_profit": total_income - total_expense,
        }

    async def balance_sheet(self, vendor_id: UUID, as_of: date) -> dict:
        assets = await self._account_balance(vendor_id, "Asset", date(2000, 1, 1), as_of)
        liabilities = await self._account_balance(vendor_id, "Liability", date(2000, 1, 1), as_of)
        equity = await self._account_balance(vendor_id, "Equity", date(2000, 1, 1), as_of)
        total_assets = sum(abs(v["balance"]) for v in assets.values())
        total_liab = sum(abs(v["balance"]) for v in liabilities.values())
        total_equity = sum(abs(v["balance"]) for v in equity.values())
        return {
            "as_of": str(as_of),
            "assets": list(assets.values()),
            "liabilities": list(liabilities.values()),
            "equity": list(equity.values()),
            "total_assets": total_assets,
            "total_liabilities": total_liab,
            "total_equity": total_equity,
            "check": total_assets - total_liab - total_equity,
        }

    async def cash_flow(self, vendor_id: UUID, from_date: date, to_date: date) -> dict:
        """Direct method cash flow from bank/cash accounts."""
        bank_accs = await self.db.execute(
            select(FinAccount).where(
                FinAccount.vendor_id == vendor_id,
                FinAccount.account_type == "Asset",
                FinAccount.account_subtype == "Current Asset",
                or_(FinAccount.name.ilike("%bank%"), FinAccount.name.ilike("%cash%")),
            )
        )
        bank_acc_ids = [a.id for a in bank_accs.scalars().all()]
        if not bank_acc_ids:
            return {"error": "No bank/cash accounts found"}

        r = await self.db.execute(
            select(
                FinJournalEntry.source_type,
                func.sum(FinJournalLine.debit).label("inflows"),
                func.sum(FinJournalLine.credit).label("outflows"),
            )
            .join(FinJournalLine, FinJournalLine.journal_entry_id == FinJournalEntry.id)
            .where(
                FinJournalLine.vendor_id == vendor_id,
                FinJournalLine.account_id.in_(bank_acc_ids),
                FinJournalEntry.status == "posted",
                FinJournalEntry.entry_date >= from_date,
                FinJournalEntry.entry_date <= to_date,
            )
            .group_by(FinJournalEntry.source_type)
        )
        rows = r.mappings().all()
        operating_in = sum(float(row["inflows"] or 0)
                          for row in rows if row["source_type"] in ("invoice", "payment", "pos"))
        operating_out = sum(float(row["outflows"] or 0)
                           for row in rows if row["source_type"] in ("vendor_payment", "payroll", "expense"))
        investing_in = sum(float(row["inflows"] or 0)
                          for row in rows if row["source_type"] in ("disposal",))
        investing_out = sum(float(row["outflows"] or 0)
                           for row in rows if row["source_type"] in ("asset",))
        financing_in = sum(float(row["inflows"] or 0)
                          for row in rows if row["source_type"] in ("loan",))
        financing_out = sum(float(row["outflows"] or 0)
                           for row in rows if row["source_type"] in ("loan",))
        return {
            "period": f"{from_date} to {to_date}",
            "operating": {"inflows": operating_in, "outflows": operating_out,
                          "net": operating_in - operating_out},
            "investing": {"inflows": investing_in, "outflows": investing_out,
                          "net": investing_in - investing_out},
            "financing": {"inflows": financing_in, "outflows": financing_out,
                          "net": financing_in - financing_out},
            "net_change": (operating_in - operating_out) + (investing_in - investing_out)
                         + (financing_in - financing_out),
        }

    async def cost_analysis(self, vendor_id: UUID, from_date: date, to_date: date) -> dict:
        """Break down expenses into fixed vs variable and compute margins."""
        expense_data = await self._account_balance(vendor_id, "Expense", from_date, to_date)
        income_data = await self._account_balance(vendor_id, "Income", from_date, to_date)
        total_revenue = sum(abs(v["balance"]) for v in income_data.values())
        cogs = sum(abs(v["balance"]) for v in expense_data.values() if v.get("subtype") == "COGS")
        opex = sum(abs(v["balance"]) for v in expense_data.values() if v.get("subtype") == "Operating Expense")
        gross_profit = total_revenue - cogs
        net_profit = total_revenue - cogs - opex
        return {
            "period": f"{from_date} to {to_date}",
            "total_revenue": total_revenue,
            "cogs": cogs,
            "gross_profit": gross_profit,
            "gross_margin_pct": round(gross_profit / total_revenue * 100, 2) if total_revenue else 0,
            "operating_expenses": opex,
            "net_profit": net_profit,
            "net_margin_pct": round(net_profit / total_revenue * 100, 2) if total_revenue else 0,
            "expense_breakdown": list(expense_data.values()),
        }


class FinCapitalRepo:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_loans(self, vendor_id: UUID, status: str = None) -> list[FinLoan]:
        q = (select(FinLoan).where(FinLoan.vendor_id == vendor_id)
             .options(selectinload(FinLoan.schedule_lines))
             .order_by(FinLoan.created_at.desc()))
        if status:
            q = q.where(FinLoan.status == status)
        r = await self.db.execute(q)
        return list(r.scalars().all())

    async def get_loan(self, lid: UUID, vendor_id: UUID) -> Optional[FinLoan]:
        r = await self.db.execute(
            select(FinLoan).where(FinLoan.id == lid, FinLoan.vendor_id == vendor_id)
            .options(selectinload(FinLoan.schedule_lines))
        )
        return r.scalar_one_or_none()

    async def create_loan(self, vendor_id: UUID, data: dict) -> FinLoan:
        loan = FinLoan(id=uuid.uuid4(), vendor_id=vendor_id, **data)
        loan.outstanding_balance = loan.principal
        self.db.add(loan)
        await self.db.flush()
        return loan

    async def generate_schedule(self, loan: FinLoan) -> list[FinLoanScheduleLine]:
        """Generate EMI schedule (reducing balance method)."""
        if not (loan.principal and loan.interest_rate and loan.tenure_months):
            return []
        P = Decimal(str(loan.principal))
        r = Decimal(str(loan.interest_rate)) / Decimal("100") / Decimal("12")
        n = loan.tenure_months
        if r == 0:
            emi = P / n
        else:
            emi = P * r * (1 + r) ** n / ((1 + r) ** n - 1)
        emi = round(emi, 2)
        balance = P
        lines = []
        start = loan.disbursement_date or date.today()
        for i in range(n):
            interest = round(balance * r, 2)
            principal = round(emi - interest, 2)
            balance = round(balance - principal, 2)
            due = date(start.year + (start.month + i - 1) // 12,
                       (start.month + i - 1) % 12 + 1, 1)
            sl = FinLoanScheduleLine(
                id=uuid.uuid4(),
                loan_id=loan.id,
                installment_no=i + 1,
                due_date=due,
                principal_amount=principal,
                interest_amount=interest,
                total_emi=emi,
                outstanding_after=balance if balance > 0 else Decimal(0),
                status="pending",
            )
            self.db.add(sl)
            lines.append(sl)
        await self.db.flush()
        return lines

    async def list_investments(self, vendor_id: UUID, status: str = None) -> list[FinInvestment]:
        q = (select(FinInvestment).where(FinInvestment.vendor_id == vendor_id)
             .options(selectinload(FinInvestment.valuations))
             .order_by(FinInvestment.investment_date.desc()))
        if status:
            q = q.where(FinInvestment.status == status)
        r = await self.db.execute(q)
        return list(r.scalars().all())

    async def create_investment(self, vendor_id: UUID, data: dict) -> FinInvestment:
        inv = FinInvestment(id=uuid.uuid4(), vendor_id=vendor_id, **data)
        inv.current_value = inv.amount_invested
        self.db.add(inv)
        await self.db.flush()
        return inv

    async def add_valuation(self, vendor_id: UUID, investment_id: UUID,
                             data: dict) -> FinInvestmentValuation:
        r = await self.db.execute(
            select(FinInvestment).where(
                FinInvestment.id == investment_id, FinInvestment.vendor_id == vendor_id)
        )
        inv = r.scalar_one_or_none()
        if inv:
            inv.current_value = data.get("market_value")
            inv.realized_gain_loss = float(data.get("market_value", 0)) - float(inv.amount_invested)
        val = FinInvestmentValuation(id=uuid.uuid4(), investment_id=investment_id, **data)
        self.db.add(val)
        await self.db.flush()
        return val

    def calculate_roi(self, amount_invested: float, current_value: float,
                      investment_date: date) -> dict:
        gain = current_value - amount_invested
        roi_pct = (gain / amount_invested * 100) if amount_invested else 0
        days = (date.today() - investment_date).days or 1
        annualized = roi_pct * 365 / days
        return {
            "amount_invested": amount_invested,
            "current_value": current_value,
            "gain_loss": gain,
            "roi_pct": round(roi_pct, 2),
            "annualized_roi_pct": round(annualized, 2),
            "holding_days": days,
        }


class FinControlsRepo:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_policies(self, vendor_id: UUID) -> list[FinApprovalPolicy]:
        r = await self.db.execute(
            select(FinApprovalPolicy).where(FinApprovalPolicy.vendor_id == vendor_id)
        )
        return list(r.scalars().all())

    async def create_policy(self, vendor_id: UUID, data: dict) -> FinApprovalPolicy:
        p = FinApprovalPolicy(id=uuid.uuid4(), vendor_id=vendor_id, **data)
        self.db.add(p)
        await self.db.flush()
        return p

    async def list_requests(self, vendor_id: UUID, status: str = None,
                            entity_type: str = None) -> list[FinApprovalRequest]:
        q = (select(FinApprovalRequest).where(FinApprovalRequest.vendor_id == vendor_id)
             .options(selectinload(FinApprovalRequest.steps))
             .order_by(FinApprovalRequest.created_at.desc()))
        if status:
            q = q.where(FinApprovalRequest.status == status)
        if entity_type:
            q = q.where(FinApprovalRequest.entity_type == entity_type)
        r = await self.db.execute(q)
        return list(r.scalars().all())

    async def create_request(self, vendor_id: UUID, data: dict) -> FinApprovalRequest:
        req = FinApprovalRequest(id=uuid.uuid4(), vendor_id=vendor_id, **data)
        self.db.add(req)
        await self.db.flush()
        return req

    async def action_step(self, request: FinApprovalRequest, step_number: int,
                          approver_id: UUID, action: str, comments: str = None) -> FinApprovalRequest:
        from datetime import datetime
        r = await self.db.execute(
            select(FinApprovalStep).where(
                FinApprovalStep.request_id == request.id,
                FinApprovalStep.step_number == step_number,
            )
        )
        step = r.scalar_one_or_none()
        if not step:
            step = FinApprovalStep(id=uuid.uuid4(), request_id=request.id,
                                   step_number=step_number, approver_id=approver_id)
            self.db.add(step)
        step.status = action
        step.action_at = datetime.utcnow()
        step.comments = comments
        request.status = action
        request.resolved_at = datetime.utcnow() if action != "pending" else None
        await self.db.flush()
        return request

    async def list_audit_logs(self, vendor_id: UUID, entity_type: str = None,
                              entity_id: UUID = None, skip: int = 0,
                              limit: int = 100) -> list[FinAuditLog]:
        q = (select(FinAuditLog).where(FinAuditLog.vendor_id == vendor_id)
             .order_by(FinAuditLog.created_at.desc()))
        if entity_type:
            q = q.where(FinAuditLog.entity_type == entity_type)
        if entity_id:
            q = q.where(FinAuditLog.entity_id == entity_id)
        r = await self.db.execute(q.offset(skip).limit(limit))
        return list(r.scalars().all())

    async def log_action(self, vendor_id: UUID, entity_type: str, entity_id: UUID,
                         action: str, performed_by_id: UUID, diff_json: dict = None,
                         ip: str = None) -> FinAuditLog:
        entry = FinAuditLog(
            id=uuid.uuid4(),
            vendor_id=vendor_id,
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            performed_by_id=performed_by_id,
            diff_json=diff_json,
            ip_address=ip,
        )
        self.db.add(entry)
        await self.db.flush()
        return entry
