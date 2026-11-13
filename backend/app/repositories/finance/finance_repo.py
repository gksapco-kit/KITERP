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

    @staticmethod
    def _apply_entry_filters(q, vendor_id: UUID, status: str = None, source_type: str = None,
                             from_date: date = None, to_date: date = None,
                             company_id: UUID = None, search: str = None):
        """Shared by list + count so the total always matches the filtered list."""
        q = q.where(FinJournalEntry.vendor_id == vendor_id)
        if status:
            q = q.where(FinJournalEntry.status == status)
        if source_type:
            q = q.where(FinJournalEntry.source_type == source_type)
        if from_date:
            q = q.where(FinJournalEntry.entry_date >= from_date)
        if to_date:
            q = q.where(FinJournalEntry.entry_date <= to_date)
        if company_id:
            q = q.where(FinJournalEntry.company_id == company_id)
        if search and search.strip():
            like = f"%{search.strip()}%"
            q = q.where(or_(
                FinJournalEntry.entry_no.ilike(like),
                FinJournalEntry.reference.ilike(like),
                FinJournalEntry.narration.ilike(like),
            ))
        return q

    async def list_entries(self, vendor_id: UUID, status: str = None, source_type: str = None,
                           from_date: date = None, to_date: date = None,
                           skip: int = 0, limit: int = 50,
                           company_id: UUID = None, search: str = None) -> list[FinJournalEntry]:
        q = (select(FinJournalEntry)
             .options(selectinload(FinJournalEntry.lines).selectinload(FinJournalLine.account))
             .order_by(FinJournalEntry.entry_date.desc(), FinJournalEntry.created_at.desc()))
        q = self._apply_entry_filters(q, vendor_id, status, source_type, from_date, to_date,
                                      company_id, search)
        r = await self.db.execute(q.offset(skip).limit(limit))
        return list(r.scalars().all())

    async def count_entries(self, vendor_id: UUID, status: str = None, source_type: str = None,
                            from_date: date = None, to_date: date = None,
                            company_id: UUID = None, search: str = None) -> int:
        q = select(func.count()).select_from(FinJournalEntry)
        q = self._apply_entry_filters(q, vendor_id, status, source_type, from_date, to_date,
                                      company_id, search)
        r = await self.db.execute(q)
        return r.scalar() or 0

    async def get_entry(self, je_id: UUID, vendor_id: UUID) -> Optional[FinJournalEntry]:
        r = await self.db.execute(
            select(FinJournalEntry)
            .where(FinJournalEntry.id == je_id, FinJournalEntry.vendor_id == vendor_id)
            .options(
                selectinload(FinJournalEntry.lines).selectinload(FinJournalLine.account),
                selectinload(FinJournalEntry.lines).selectinload(FinJournalLine.cost_center),
                selectinload(FinJournalEntry.lines).selectinload(FinJournalLine.project),
            )
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
        from datetime import datetime, timezone
        je.status = "posted"
        je.posted_by_id = posted_by_id
        je.posted_at = datetime.now(timezone.utc)
        await self.db.flush()
        return je

    async def void_entry(self, je: FinJournalEntry, voided_by_id: UUID = None,
                         reason: str = "") -> FinJournalEntry:
        """
        Void a posted journal entry.
        Checks that the entry's period is not locked or closed before voiding.
        Records a FinAuditLog entry.
        """
        from app.models.finance import FinPeriod, FinAuditLog
        import uuid as _uuid
        from datetime import datetime, timezone

        # Block voiding if the period is locked/closed
        if je.period_id:
            r = await self.db.execute(
                select(FinPeriod).where(FinPeriod.id == je.period_id)
            )
            period = r.scalar_one_or_none()
            if period and period.status in ("closed", "locked"):
                raise ValueError(
                    f"Cannot void journal entry {je.entry_no}: "
                    f"accounting period is {period.status}. "
                    "Reopen the period first or post a correcting entry in an open period."
                )

        je.status = "void"
        await self.db.flush()

        # Audit log
        try:
            log_entry = FinAuditLog(
                id=_uuid.uuid4(),
                vendor_id=je.vendor_id,
                entity_type="journal_entry",
                entity_id=je.id,
                action="void",
                performed_by_id=voided_by_id,
                diff_json={"entry_no": je.entry_no, "reason": reason},
            )
            self.db.add(log_entry)
            await self.db.flush()
        except Exception:
            # the void itself is already flushed; never lose it over a logging failure, but say so
            import logging as _lg
            _lg.getLogger(__name__).exception("audit log write failed for void of JE %s", je.id)

        return je

    async def trial_balance(self, vendor_id: UUID, from_date: date = None,
                            to_date: date = None, company_id: UUID = None,
                            include_zero_balance: bool = False) -> list[dict]:
        """
        Returns per-account trial balance for posted entries only.
        Supports optional company_id filter for multi-company setups.
        """
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
                FinJournalEntry.vendor_id == vendor_id,   # belt-and-suspenders tenant guard
                FinJournalEntry.status == "posted",
            )
        )
        if from_date:
            q = q.where(FinJournalEntry.entry_date >= from_date)
        if to_date:
            q = q.where(FinJournalEntry.entry_date <= to_date)
        if company_id:
            q = q.where(FinJournalEntry.company_id == company_id)
        q = q.group_by(FinAccount.id, FinAccount.code, FinAccount.name,
                       FinAccount.account_type, FinAccount.account_subtype)
        q = q.order_by(FinAccount.code)
        r = await self.db.execute(q)
        rows = r.mappings().all()
        result = []
        for row in rows:
            dr = float(row["total_debit"])
            cr = float(row["total_credit"])
            balance = dr - cr
            if not include_zero_balance and dr == 0 and cr == 0:
                continue
            result.append({
                "account_id": str(row["id"]),
                "code": row["code"],
                "name": row["name"],
                "account_type": row["account_type"],
                "account_subtype": row["account_subtype"],
                "total_debit": dr,
                "total_credit": cr,
                "balance": balance,
            })
        return result

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
        """
        Apply (part of) a customer Payment to an Invoice.
        Both documents must belong to this tenant; the amount may not exceed the
        invoice's outstanding balance or the payment's unapplied amount.
        """
        from decimal import Decimal as _D
        from app.models.invoice import Invoice as _Inv
        from app.models.payment import Payment as _Pay

        applied = _D(str(data["amount_applied"]))
        if applied <= 0:
            raise ValueError("Applied amount must be positive.")

        inv = (await self.db.execute(select(_Inv).where(
            _Inv.id == data["invoice_id"], _Inv.vendor_id == vendor_id,
        ).with_for_update())).scalar_one_or_none()
        if inv is None:
            raise ValueError("Invoice not found for this vendor.")
        pay = (await self.db.execute(select(_Pay).where(
            _Pay.id == data["payment_id"], _Pay.vendor_id == vendor_id,
        ).with_for_update())).scalar_one_or_none()
        if pay is None:
            raise ValueError("Payment not found for this vendor.")
        if pay.status not in ("completed",):
            raise ValueError(f"Payment is '{pay.status}'; only completed payments can be applied.")

        prior_inv = (await self.db.execute(
            select(func.coalesce(func.sum(FinCustomerPaymentApplication.amount_applied), 0))
            .where(FinCustomerPaymentApplication.vendor_id == vendor_id,
                   FinCustomerPaymentApplication.invoice_id == inv.id)
        )).scalar() or 0
        prior_pay = (await self.db.execute(
            select(func.coalesce(func.sum(FinCustomerPaymentApplication.amount_applied), 0))
            .where(FinCustomerPaymentApplication.vendor_id == vendor_id,
                   FinCustomerPaymentApplication.payment_id == pay.id)
        )).scalar() or 0

        inv_outstanding = _D(str(inv.total or 0)) - _D(str(inv.amount_paid or 0)) - _D(str(prior_inv))
        pay_unapplied = _D(str(pay.amount or 0)) - _D(str(prior_pay))
        if applied > inv_outstanding:
            raise ValueError(f"Applied amount {applied} exceeds invoice outstanding {inv_outstanding}.")
        if applied > pay_unapplied:
            raise ValueError(f"Applied amount {applied} exceeds unapplied payment amount {pay_unapplied}.")

        app = FinCustomerPaymentApplication(
            id=uuid.uuid4(), vendor_id=vendor_id,
            payment_id=pay.id, invoice_id=inv.id, amount_applied=applied,
            created_by_id=data.get("created_by_id"),
        )
        self.db.add(app)
        await self.db.flush()
        return app


class FinAPRepo:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_bills(self, vendor_id: UUID, status: str = None, supplier_id: UUID = None,
                         skip: int = 0, limit: int = 50, *,
                         pm_project_id=None) -> list[FinVendorBill]:
        q = (select(FinVendorBill).where(FinVendorBill.vendor_id == vendor_id)
             .options(selectinload(FinVendorBill.lines))
             .order_by(FinVendorBill.bill_date.desc()))
        if status:
            q = q.where(FinVendorBill.status == status)
        if supplier_id:
            q = q.where(FinVendorBill.supplier_id == supplier_id)
        if pm_project_id:
            q = q.where(FinVendorBill.pm_project_id == pm_project_id)
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
        # The supplier is owed the bill total less any TDS we deduct and deposit.
        bill.balance_due = (bill.total or 0) - (bill.tds_amount or 0)
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
        from decimal import Decimal as _D
        items_data = data.get("items", []) or []
        # Validate every bill belongs to this tenant, is payable and not over-allocated
        total = _D("0")
        clean_items = []
        for item in items_data:
            bill = await self.get_bill(item["bill_id"], vendor_id)
            if bill is None:
                raise ValueError(f"Bill {item['bill_id']} not found for this vendor.")
            if bill.status not in ("open", "partially_paid"):
                raise ValueError(f"Bill {bill.bill_no} is '{bill.status}' and cannot be paid.")
            amt = _D(str(item["amount"]))
            balance = _D(str(bill.balance_due if bill.balance_due is not None else bill.total or 0))
            if amt > balance:
                raise ValueError(
                    f"Payment run amount {amt} exceeds balance {balance} on bill {bill.bill_no}.")
            total += amt
            clean_items.append({"bill_id": bill.id, "amount": amt})
        if data.get("bank_account_id"):
            ba = await self.db.execute(select(FinBankAccount).where(
                FinBankAccount.id == data["bank_account_id"],
                FinBankAccount.vendor_id == vendor_id))
            if ba.scalar_one_or_none() is None:
                raise ValueError("Bank account not found for this vendor.")
        run_fields = {k: v for k, v in data.items()
                      if k in {"name", "payment_date", "bank_account_id", "notes"}}
        run = FinPaymentRun(id=uuid.uuid4(), vendor_id=vendor_id,
                            total_amount=total, **run_fields)
        self.db.add(run)
        await self.db.flush()
        for item in clean_items:
            self.db.add(FinPaymentRunItem(id=uuid.uuid4(), run_id=run.id, **item))
        await self.db.flush()
        return run

    async def record_vendor_payment(self, vendor_id: UUID, data: dict) -> FinVendorPayment:
        """
        Record an AP payment. All validation happens BEFORE anything is added
        to the session so a rejected payment leaves no partial state.
        """
        from decimal import Decimal as _D
        _SAFE_FIELDS = {
            "bill_id", "supplier_id", "amount", "payment_date",
            "payment_method", "reference_no", "bank_account_id", "notes",
        }
        safe = {k: v for k, v in data.items() if k in _SAFE_FIELDS}
        amount = _D(str(safe["amount"]))
        if amount <= 0:
            raise ValueError("Payment amount must be positive.")

        # Supplier must belong to this tenant
        from app.models.procurement import Supplier as _Sup
        sup = await self.db.execute(select(_Sup).where(
            _Sup.id == safe["supplier_id"], _Sup.vendor_id == vendor_id))
        if sup.scalar_one_or_none() is None:
            raise ValueError("Supplier not found for this vendor.")
        if safe.get("bank_account_id"):
            ba = await self.db.execute(select(FinBankAccount).where(
                FinBankAccount.id == safe["bank_account_id"],
                FinBankAccount.vendor_id == vendor_id))
            if ba.scalar_one_or_none() is None:
                raise ValueError("Bank account not found for this vendor.")

        bill = None
        if safe.get("bill_id"):
            r = await self.db.execute(
                select(FinVendorBill).where(
                    FinVendorBill.id == safe["bill_id"],
                    FinVendorBill.vendor_id == vendor_id,   # cross-tenant guard
                ).with_for_update()                         # serialise concurrent payments
            )
            bill = r.scalar_one_or_none()
            if bill is None:
                raise ValueError(f"Bill {safe['bill_id']} not found for this vendor.")
            if bill.supplier_id != safe["supplier_id"]:
                raise ValueError("Bill belongs to a different supplier.")
            if bill.status not in ("open", "partially_paid"):
                raise ValueError(f"Bill {bill.bill_no} is '{bill.status}' and cannot be paid.")
            balance = _D(str(bill.balance_due if bill.balance_due is not None else (bill.total or 0)))
            if amount > balance:
                raise ValueError(
                    f"Payment amount {amount} exceeds outstanding balance {balance} "
                    f"on bill {bill.bill_no}. Use a credit-note for overpayments."
                )

        vp = FinVendorPayment(id=uuid.uuid4(), vendor_id=vendor_id, **safe)
        self.db.add(vp)
        if bill is not None:
            paid = _D(str(bill.amount_paid or 0)) + amount
            bill.amount_paid = paid
            bill.balance_due = _D(str(bill.total or 0)) - paid
            bill.status = "paid" if bill.balance_due <= 0 else "partially_paid"
        await self.db.flush()
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
                         bank_account_id: UUID,
                         date_tolerance_days: int = 5) -> list[FinReconciliationMatch]:
        """
        Auto-match unreconciled statement lines to unreconciled GL journal lines.

        Matching rules (in order of strictness):
        1. Same amount (exact).
        2. Correct direction: bank statement debit ↔ GL credit (cash out) and vice versa.
        3. Date within ±date_tolerance_days of the GL entry date.
        4. Same bank account (bank_account_id filter on both sides).

        After matching:
        - statement line and journal line are both marked is_reconciled=True.
        - FinReconciliationMatch record created.
        """
        from datetime import timedelta

        # Fetch unreconciled statement lines for THIS bank account only
        r1 = await self.db.execute(
            select(FinBankStatementLine)
            .join(FinBankStatement, FinBankStatement.id == FinBankStatementLine.statement_id)
            .where(
                FinBankStatementLine.vendor_id == vendor_id,
                FinBankStatement.vendor_id == vendor_id,
                FinBankStatement.bank_account_id == bank_account_id,
                FinBankStatementLine.is_reconciled == False,
            )
        )
        stmt_lines = r1.scalars().all()

        # Fetch unreconciled posted GL lines for this bank account
        # The GL bank account is linked via FinBankAccount.gl_account_id
        ba_r = await self.db.execute(
            select(FinBankAccount).where(
                FinBankAccount.id == bank_account_id,
                FinBankAccount.vendor_id == vendor_id,
            )
        )
        ba = ba_r.scalar_one_or_none()
        gl_account_id = ba.gl_account_id if ba else None

        jl_where = [
            FinJournalLine.vendor_id == vendor_id,
            FinJournalEntry.status == "posted",
            FinJournalLine.clearing_date.is_(None),  # not yet reconciled/cleared
        ]
        if gl_account_id:
            jl_where.append(FinJournalLine.account_id == gl_account_id)

        r2 = await self.db.execute(
            select(FinJournalLine, FinJournalEntry.entry_date)
            .join(FinJournalEntry, FinJournalLine.journal_entry_id == FinJournalEntry.id)
            .where(*jl_where)
        )
        jl_rows = r2.all()

        # Index GL lines by (rounded_amount, direction)
        # direction: "cr" = cash received (GL credit = bank receipt), "dr" = cash out
        from collections import defaultdict
        _D = Decimal
        jl_index: dict[tuple, list] = defaultdict(list)
        for jl, entry_date in jl_rows:
            if jl.credit and jl.credit > 0:
                key = (round(_D(str(jl.credit)), 2), "cr")
                jl_index[key].append((jl, entry_date))
            if jl.debit and jl.debit > 0:
                key = (round(_D(str(jl.debit)), 2), "dr")
                jl_index[key].append((jl, entry_date))

        matches = []
        used_jl_ids: set = set()

        for sl in stmt_lines:
            sl_date = sl.transaction_date
            # Statement debit = cash out → matches GL credit
            # Statement credit = cash in → matches GL debit
            sl_dr = _D(str(sl.debit or 0))
            sl_cr = _D(str(sl.credit or 0))

            if sl_dr > 0:
                # Cash out: look for GL credit of same amount
                candidates = jl_index.get((round(sl_dr, 2), "cr"), [])
                direction_match = "cr"
            elif sl_cr > 0:
                # Cash in: look for GL debit of same amount
                candidates = jl_index.get((round(sl_cr, 2), "dr"), [])
                direction_match = "dr"
            else:
                continue

            best = None
            for jl, entry_date in candidates:
                if jl.id in used_jl_ids:
                    continue
                if sl_date and entry_date:
                    delta = abs((sl_date - entry_date).days)
                    if delta <= date_tolerance_days:
                        best = jl
                        break
                else:
                    best = jl   # no date info — take first available
                    break

            if best is None:
                continue

            used_jl_ids.add(best.id)
            amt = sl_dr if sl_dr > 0 else sl_cr
            match = FinReconciliationMatch(
                id=uuid.uuid4(),
                reconciliation_id=reconciliation_id,
                statement_line_id=sl.id,
                journal_line_id=best.id,
                amount=amt,
                match_type="auto_exact",
            )
            self.db.add(match)
            sl.is_reconciled = True
            sl.reconciliation_id = reconciliation_id
            # Mark the GL line as reconciled (set clearing_date)
            from datetime import date as _date
            best.clearing_date = _date.today()
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


_ASSET_WRITABLE_FIELDS = frozenset({
    "category_id", "asset_code", "name", "description", "acquisition_date",
    "purchase_cost", "salvage_value", "useful_life_years", "depreciation_method",
    "total_units_capacity", "location", "store_id", "serial_number", "notes", "status",
})


def _parse_asset_payload(data: dict) -> dict:
    """Normalise API payload into FinAsset column types."""
    clean: dict[str, Any] = {}
    for key, raw in data.items():
        if key not in _ASSET_WRITABLE_FIELDS:
            continue
        if raw is None or raw == "":
            if key in {"category_id", "store_id", "description", "location", "serial_number",
                       "notes", "total_units_capacity"}:
                clean[key] = None
            continue
        if key == "acquisition_date":
            if isinstance(raw, date):
                clean[key] = raw
            else:
                clean[key] = date.fromisoformat(str(raw)[:10])
        elif key in {"category_id", "store_id"}:
            clean[key] = raw if isinstance(raw, UUID) else UUID(str(raw))
        elif key in {"purchase_cost", "salvage_value", "total_units_capacity"}:
            clean[key] = float(raw)
        elif key == "useful_life_years":
            clean[key] = int(raw)
        else:
            clean[key] = raw
    return clean


_ASSET_CATEGORY_WRITABLE_FIELDS = frozenset({
    "name", "depreciation_method", "useful_life_years", "salvage_pct",
    "asset_account_id", "accum_dep_account_id", "dep_expense_account_id",
})

_ASSET_ACCOUNT_FK_FIELDS = frozenset({
    "asset_account_id", "accum_dep_account_id", "dep_expense_account_id",
})


def _parse_category_payload(data: dict) -> dict:
    """Normalise API payload into FinAssetCategory column types."""
    clean: dict[str, Any] = {}
    for key, raw in data.items():
        if key not in _ASSET_CATEGORY_WRITABLE_FIELDS:
            continue
        if key in _ASSET_ACCOUNT_FK_FIELDS:
            clean[key] = None if raw in (None, "") else (raw if isinstance(raw, UUID) else UUID(str(raw)))
        elif key == "useful_life_years":
            clean[key] = int(raw) if raw not in (None, "") else None
        elif key == "salvage_pct":
            clean[key] = float(raw) if raw not in (None, "") else 0
        else:
            clean[key] = raw
    return clean


_ASSET_MAINTENANCE_WRITABLE_FIELDS = frozenset({
    "asset_id", "maintenance_date", "description", "cost", "vendor_name", "status",
})


def _parse_maintenance_payload(data: dict) -> dict:
    """Normalise API payload into FinAssetMaintenance column types."""
    clean: dict[str, Any] = {}
    for key, raw in data.items():
        if key not in _ASSET_MAINTENANCE_WRITABLE_FIELDS:
            continue
        if raw is None or raw == "":
            if key in {"description", "vendor_name"}:
                clean[key] = None
            continue
        if key == "maintenance_date":
            clean[key] = raw if isinstance(raw, date) else date.fromisoformat(str(raw)[:10])
        elif key == "asset_id":
            clean[key] = raw if isinstance(raw, UUID) else UUID(str(raw))
        elif key == "cost":
            clean[key] = float(raw)
        else:
            clean[key] = raw
    return clean


class FinAssetRepo:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_categories(self, vendor_id: UUID) -> list[FinAssetCategory]:
        r = await self.db.execute(
            select(FinAssetCategory).where(FinAssetCategory.vendor_id == vendor_id)
            .order_by(FinAssetCategory.name)
        )
        return list(r.scalars().all())

    async def get_category(self, category_id: UUID, vendor_id: UUID) -> Optional[FinAssetCategory]:
        r = await self.db.execute(
            select(FinAssetCategory).where(
                FinAssetCategory.id == category_id, FinAssetCategory.vendor_id == vendor_id)
        )
        return r.scalar_one_or_none()

    async def create_category(self, vendor_id: UUID, data: dict) -> FinAssetCategory:
        payload = _parse_category_payload(data)
        if not payload.get("name"):
            raise ValueError("Category name is required")
        cat = FinAssetCategory(id=uuid.uuid4(), vendor_id=vendor_id, **payload)
        self.db.add(cat)
        await self.db.flush()
        return cat

    async def update_category(self, cat: FinAssetCategory, data: dict) -> FinAssetCategory:
        payload = _parse_category_payload(data)
        if "name" in payload and not payload["name"]:
            raise ValueError("Category name is required")
        for k, v in payload.items():
            setattr(cat, k, v)
        await self.db.flush()
        return cat

    async def list_assets_by_bill(self, vendor_id: UUID, bill_id: UUID) -> list[FinAsset]:
        r = await self.db.execute(
            select(FinAsset).where(FinAsset.vendor_id == vendor_id, FinAsset.vendor_bill_id == bill_id)
        )
        return list(r.scalars().all())

    async def create_asset_from_bill_line(self, vendor_id: UUID, data: dict) -> FinAsset:
        """
        Capitalize a specific vendor bill line into a Fixed Asset register entry.
        The bill must already be posted — this does NOT post a new GL entry, since the
        bill's own posting already debited the GL for the purchase. Run the Asset
        Reconciliation report afterward to confirm the new subledger entry matches the
        GL balance of the category's Fixed Asset account; if the bill was booked to a
        different account, adjust the bill's posting account or re-map the category.
        """
        bill_line_id = data.get("bill_line_id")
        if not bill_line_id:
            raise ValueError("bill_line_id is required")
        line = (await self.db.execute(
            select(FinVendorBillLine).where(FinVendorBillLine.id == UUID(str(bill_line_id)))
        )).scalar_one_or_none()
        if not line:
            raise ValueError("Vendor bill line not found")
        bill = (await self.db.execute(
            select(FinVendorBill).where(FinVendorBill.id == line.bill_id, FinVendorBill.vendor_id == vendor_id)
        )).scalar_one_or_none()
        if not bill:
            raise ValueError("Vendor bill not found")
        if bill.status in ("draft", "void"):
            raise ValueError("Bill must be posted to the GL before it can be capitalized")

        existing = (await self.db.execute(
            select(FinAsset).where(FinAsset.vendor_id == vendor_id, FinAsset.vendor_bill_id == bill.id,
                                    FinAsset.purchase_cost == line.line_total)
        )).scalars().all()
        if existing:
            raise ValueError("This bill has already been capitalized as an asset")

        cost = float(line.line_total or 0)
        if cost <= 0:
            raise ValueError("Bill line has no capitalizable amount")

        category_id = data.get("category_id")
        if category_id:
            category = await self.get_category(UUID(str(category_id)), vendor_id)
            if not category:
                raise ValueError("Asset category not found")

        payload = _parse_asset_payload({
            **data,
            "acquisition_date": data.get("acquisition_date") or bill.bill_date,
            "purchase_cost": cost,
        })
        if not payload.get("asset_code") or not payload.get("name"):
            raise ValueError("asset_code and name are required")

        asset = FinAsset(
            id=uuid.uuid4(), vendor_id=vendor_id, vendor_bill_id=bill.id,
            journal_entry_id=bill.journal_entry_id, **payload,
        )
        asset.current_value = asset.purchase_cost
        self.db.add(asset)
        await self.db.flush()
        return asset

    async def get_category_accounts(self, asset: FinAsset) -> dict:
        """
        Resolve category-mapped GL accounts for posting acquire/depreciate/dispose events.
        Queries by category_id directly rather than touching asset.category, since that
        relationship may not be eager-loaded on freshly-created/updated asset instances
        (accessing an unloaded relationship attribute would fail under async SQLAlchemy).
        """
        if not asset.category_id:
            return {}
        r = await self.db.execute(
            select(FinAssetCategory).where(FinAssetCategory.id == asset.category_id)
        )
        cat = r.scalar_one_or_none()
        if not cat:
            return {}
        out: dict[str, UUID] = {}
        if cat.asset_account_id:
            out["asset_account_id"] = cat.asset_account_id
        if cat.accum_dep_account_id:
            out["accum_dep_account_id"] = cat.accum_dep_account_id
        if cat.dep_expense_account_id:
            out["dep_expense_account_id"] = cat.dep_expense_account_id
        return out

    async def list_assets(self, vendor_id: UUID, status: str = None,
                          category_id: UUID = None, store_id: UUID = None) -> list[FinAsset]:
        q = (select(FinAsset).where(FinAsset.vendor_id == vendor_id)
             .options(selectinload(FinAsset.category))
             .order_by(FinAsset.asset_code))
        if status:
            q = q.where(FinAsset.status == status)
        if category_id:
            q = q.where(FinAsset.category_id == category_id)
        if store_id:
            q = q.where(FinAsset.store_id == store_id)
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
        payload = _parse_asset_payload(data)
        if not payload.get("asset_code") or not payload.get("name"):
            raise ValueError("asset_code and name are required")
        if not payload.get("acquisition_date"):
            raise ValueError("acquisition_date is required")
        if payload.get("purchase_cost") is None:
            raise ValueError("purchase_cost is required")
        asset = FinAsset(id=uuid.uuid4(), vendor_id=vendor_id, **payload)
        asset.current_value = asset.purchase_cost
        self.db.add(asset)
        await self.db.flush()
        return asset

    async def update_asset(self, asset: FinAsset, data: dict) -> FinAsset:
        payload = _parse_asset_payload(data)
        for k, v in payload.items():
            setattr(asset, k, v)
        await self.db.flush()
        return asset

    async def record_depreciation(self, vendor_id: UUID, asset: FinAsset,
                                  amount: Decimal, period_id: UUID = None,
                                  je_id: UUID = None, units: Decimal = None) -> FinAssetDepreciationEntry:
        amount = Decimal(str(amount))
        current_value = Decimal(str(asset.current_value or 0))
        accumulated = Decimal(str(asset.accumulated_depreciation or 0))
        book_value_after = current_value - amount
        entry = FinAssetDepreciationEntry(
            id=uuid.uuid4(),
            asset_id=asset.id,
            vendor_id=vendor_id,
            period_id=period_id,
            depreciation_date=date.today(),
            amount=amount,
            units_produced=Decimal(str(units)) if units is not None else None,
            book_value_after=book_value_after,
            journal_entry_id=je_id,
        )
        self.db.add(entry)
        asset.accumulated_depreciation = accumulated + amount
        asset.current_value = book_value_after
        if units is not None:
            asset.units_consumed = Decimal(str(asset.units_consumed or 0)) + Decimal(str(units))
        await self.db.flush()
        return entry

    async def calculate_depreciation(self, asset: FinAsset, units: Decimal = None) -> Decimal:
        """
        Calculate depreciation amount for one period.

        `units` is required (and only used) for the units_of_production method — it
        represents the output/usage (e.g. machine hours, units manufactured) for the
        period being depreciated.
        """
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
        elif method == "units_of_production":
            capacity = Decimal(str(asset.total_units_capacity or 0))
            if capacity <= 0 or units is None:
                return Decimal(0)
            units = Decimal(str(units))
            remaining_capacity = capacity - Decimal(str(asset.units_consumed or 0))
            units = min(units, max(remaining_capacity, Decimal(0)))
            rate_per_unit = (cost - salvage) / capacity
            depreciable_remaining = Decimal(str(asset.current_value or 0)) - salvage
            return round(min(units * rate_per_unit, max(depreciable_remaining, Decimal(0))), 4)
        return Decimal(0)

    async def dispose_asset(self, vendor_id: UUID, asset: FinAsset,
                            data: dict, je_id: UUID = None) -> FinAssetDisposal:
        disposal_date = data.get("disposal_date")
        if isinstance(disposal_date, str):
            disposal_date = date.fromisoformat(disposal_date[:10])
        elif not disposal_date:
            disposal_date = date.today()
        sale_price = Decimal(str(data.get("sale_price", 0) or 0))
        book_value = Decimal(str(asset.current_value or 0))
        gain_loss = sale_price - book_value

        disposal = FinAssetDisposal(
            id=uuid.uuid4(), asset_id=asset.id, vendor_id=vendor_id,
            disposal_date=disposal_date,
            disposal_method=data.get("disposal_method", "scrapped"),
            sale_price=sale_price,
            book_value_at_disposal=book_value,
            gain_loss=gain_loss,
            notes=data.get("notes"),
            journal_entry_id=je_id,
        )
        self.db.add(disposal)
        asset.status = "disposed"
        asset.disposal_date = disposal_date
        asset.disposal_value = sale_price
        await self.db.flush()
        return disposal

    async def list_maintenance(self, vendor_id: UUID, asset_id: UUID = None) -> list[FinAssetMaintenance]:
        q = select(FinAssetMaintenance).where(FinAssetMaintenance.vendor_id == vendor_id)
        if asset_id:
            q = q.where(FinAssetMaintenance.asset_id == asset_id)
        r = await self.db.execute(q.order_by(FinAssetMaintenance.maintenance_date.desc()))
        return list(r.scalars().all())

    async def create_maintenance(self, vendor_id: UUID, data: dict) -> FinAssetMaintenance:
        payload = _parse_maintenance_payload(data)
        if not payload.get("asset_id"):
            raise ValueError("asset_id is required")
        if not payload.get("maintenance_date"):
            raise ValueError("maintenance_date is required")
        m = FinAssetMaintenance(id=uuid.uuid4(), vendor_id=vendor_id, **payload)
        self.db.add(m)
        await self.db.flush()
        return m

    async def asset_kpis(self, vendor_id: UUID, from_date: date, to_date: date) -> dict:
        """Fixed Asset KPIs for the Finance Dashboard: NBV, count, accum. dep, period depreciation."""
        r = await self.db.execute(
            select(
                func.count(FinAsset.id),
                func.coalesce(func.sum(FinAsset.current_value), 0),
                func.coalesce(func.sum(FinAsset.accumulated_depreciation), 0),
            ).where(FinAsset.vendor_id == vendor_id, FinAsset.status == "active")
        )
        count, nbv, accum_dep = r.one()
        dep_r = await self.db.execute(
            select(func.coalesce(func.sum(FinAssetDepreciationEntry.amount), 0)).where(
                FinAssetDepreciationEntry.vendor_id == vendor_id,
                FinAssetDepreciationEntry.depreciation_date >= from_date,
                FinAssetDepreciationEntry.depreciation_date <= to_date,
            )
        )
        return {
            "active_asset_count": int(count or 0),
            "net_book_value": float(nbv or 0),
            "accumulated_depreciation": float(accum_dep or 0),
            "depreciation_this_period": float(dep_r.scalar() or 0),
        }

    async def asset_subledger_reconciliation(self, vendor_id: UUID, as_of: date) -> dict:
        """
        Compares the Fixed Asset subledger (sum of purchase_cost / accumulated_depreciation
        across active assets, grouped by their category's mapped GL account) against the
        posted GL balance of those same accounts — a control check for accounts like 1290
        (Accumulated Depreciation). Disposed assets are excluded since the disposal JE has
        already reversed their cost/accum-dep out of these accounts.
        """
        r = await self.db.execute(
            select(FinAsset)
            .where(FinAsset.vendor_id == vendor_id, FinAsset.status == "active")
            .options(selectinload(FinAsset.category))
        )
        assets = list(r.scalars().all())

        cost_by_account: dict[UUID, float] = {}
        accum_by_account: dict[UUID, float] = {}
        for a in assets:
            cat = a.category
            if cat and cat.asset_account_id:
                cost_by_account[cat.asset_account_id] = (
                    cost_by_account.get(cat.asset_account_id, 0.0) + float(a.purchase_cost or 0))
            if cat and cat.accum_dep_account_id:
                accum_by_account[cat.accum_dep_account_id] = (
                    accum_by_account.get(cat.accum_dep_account_id, 0.0) + float(a.accumulated_depreciation or 0))

        account_ids = set(cost_by_account) | set(accum_by_account)
        if not account_ids:
            return {"as_of": str(as_of), "lines": []}

        gl_rows = (await self.db.execute(
            select(
                FinAccount.id, FinAccount.code, FinAccount.name,
                func.coalesce(func.sum(FinJournalLine.debit), 0).label("dr"),
                func.coalesce(func.sum(FinJournalLine.credit), 0).label("cr"),
            )
            .join(FinJournalLine, FinJournalLine.account_id == FinAccount.id)
            .join(FinJournalEntry, FinJournalLine.journal_entry_id == FinJournalEntry.id)
            .where(
                FinAccount.id.in_(account_ids),
                FinJournalEntry.status == "posted",
                FinJournalEntry.entry_date <= as_of,
            )
            .group_by(FinAccount.id, FinAccount.code, FinAccount.name)
        )).all()
        gl_by_account = {row.id: row for row in gl_rows}

        lines = []
        for acc_id in account_ids:
            row = gl_by_account.get(acc_id)
            if row:
                code, name, dr, cr = row.code, row.name, float(row.dr), float(row.cr)
            else:
                acc = (await self.db.execute(
                    select(FinAccount).where(FinAccount.id == acc_id))).scalar_one_or_none()
                code, name, dr, cr = (acc.code if acc else None), (acc.name if acc else None), 0.0, 0.0
            if acc_id in cost_by_account:
                lines.append({
                    "account_id": str(acc_id), "account_code": code, "account_name": name,
                    "role": "fixed_asset",
                    "subledger_balance": cost_by_account[acc_id],
                    "gl_balance": dr - cr,  # debit-normal
                    "variance": cost_by_account[acc_id] - (dr - cr),
                })
            if acc_id in accum_by_account:
                lines.append({
                    "account_id": str(acc_id), "account_code": code, "account_name": name,
                    "role": "accumulated_depreciation",
                    "subledger_balance": accum_by_account[acc_id],
                    "gl_balance": cr - dr,  # contra-asset, credit-normal
                    "variance": accum_by_account[acc_id] - (cr - dr),
                })
        lines.sort(key=lambda l: (l["account_code"] or "", l["role"]))
        return {"as_of": str(as_of), "lines": lines}

    async def depreciation_schedule(self, vendor_id: UUID, from_date: date, to_date: date,
                                     category_id: UUID = None, store_id: UUID = None) -> list[dict]:
        q = (
            select(FinAssetDepreciationEntry, FinAsset)
            .join(FinAsset, FinAssetDepreciationEntry.asset_id == FinAsset.id)
            .options(selectinload(FinAsset.category))
            .where(
                FinAssetDepreciationEntry.vendor_id == vendor_id,
                FinAssetDepreciationEntry.depreciation_date >= from_date,
                FinAssetDepreciationEntry.depreciation_date <= to_date,
            )
        )
        if category_id:
            q = q.where(FinAsset.category_id == category_id)
        if store_id:
            q = q.where(FinAsset.store_id == store_id)
        q = q.order_by(FinAssetDepreciationEntry.depreciation_date, FinAsset.asset_code)
        rows = (await self.db.execute(q)).all()
        return [
            {
                "id": str(entry.id),
                "asset_id": str(asset.id),
                "asset_code": asset.asset_code,
                "asset_name": asset.name,
                "category_name": asset.category.name if asset.category else None,
                "depreciation_date": str(entry.depreciation_date),
                "amount": float(entry.amount or 0),
                "book_value_after": float(entry.book_value_after or 0) if entry.book_value_after is not None else None,
            }
            for entry, asset in rows
        ]


class FinTaxRepo:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_tax_codes(self, vendor_id: UUID) -> list[FinTaxCode]:
        r = await self.db.execute(
            select(FinTaxCode).where(FinTaxCode.vendor_id == vendor_id)
            .order_by(FinTaxCode.code)
        )
        return list(r.scalars().all())

    async def get_tax_code(self, tc_id: UUID, vendor_id: UUID) -> Optional[FinTaxCode]:
        r = await self.db.execute(
            select(FinTaxCode).where(
                FinTaxCode.id == tc_id, FinTaxCode.vendor_id == vendor_id)
        )
        return r.scalar_one_or_none()

    @staticmethod
    def _validate_tax_code_value(code: str | None) -> str:
        """
        Normalise and validate a tax code string.

        Rules:
        - Must be non-empty after stripping.
        - No embedded spaces or percent signs (those belong in the name, not the code).
        - Max 20 characters (matches column width).
        """
        from fastapi import HTTPException
        if not code or not str(code).strip():
            raise HTTPException(400, "Tax code must not be blank")
        cleaned = str(code).strip()
        if " " in cleaned:
            raise HTTPException(400, "Tax code must not contain spaces — use the name field for descriptions")
        if "%" in cleaned:
            raise HTTPException(400, "Tax code must not contain '%' — store the rate in the rate field")
        if len(cleaned) > 20:
            raise HTTPException(400, "Tax code must not exceed 20 characters")
        return cleaned

    async def _assert_code_unique(self, vendor_id: UUID, code: str, exclude_id: UUID | None = None) -> None:
        from fastapi import HTTPException
        q = select(FinTaxCode.id).where(
            FinTaxCode.vendor_id == vendor_id,
            func.upper(FinTaxCode.code) == code.upper(),
        )
        if exclude_id:
            q = q.where(FinTaxCode.id != exclude_id)
        existing = await self.db.execute(q.limit(1))
        if existing.scalar_one_or_none():
            raise HTTPException(409, f"A tax code with code '{code.upper()}' already exists for this vendor")

    async def create_tax_code(self, vendor_id: UUID, data: dict) -> FinTaxCode:
        code = self._validate_tax_code_value(data.get("code"))
        await self._assert_code_unique(vendor_id, code)
        payload = {**data, "code": code}
        tc = FinTaxCode(id=uuid.uuid4(), vendor_id=vendor_id, **payload)
        self.db.add(tc)
        await self.db.flush()
        return tc

    _TAX_CODE_UPDATABLE = {"code", "name", "tax_type", "rate", "gl_account_id", "is_active"}

    async def update_tax_code(self, tc: FinTaxCode, data: dict) -> FinTaxCode:
        if "code" in data:
            data["code"] = self._validate_tax_code_value(data["code"])
            await self._assert_code_unique(tc.vendor_id, data["code"], exclude_id=tc.id)
        for k, v in data.items():
            if k in self._TAX_CODE_UPDATABLE:
                setattr(tc, k, v)
        await self.db.flush()
        return tc

    async def delete_tax_code(self, tc: FinTaxCode) -> None:
        await self.db.delete(tc)
        await self.db.flush()

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
        """
        Build GSTR-1 data from invoices and credit notes raised in the period.

        * Invoice date (not created_at) decides the period.
        * Place of supply is normalised to the 2-digit GST state code.
        * Tax is reported per rate (from the invoice lines).
        * B2B -> by recipient GSTIN; B2CL -> inter-state B2C above the date-dependent
          threshold; everything else B2CS aggregated by (supply type, state, rate).
        * Credit notes: registered -> CDNR; large inter-state B2C -> CDNUR; small B2C
          are netted into B2CS (negative).
        * HSN summary is rate-wise and read from the JSONB line items.
        * Totals are given for invoices, credit notes and net.
        """
        from decimal import Decimal as _D
        from app.models.vendor import Vendor as _Vendor
        from app.services.finance import gst as _gst

        vendor = await self.db.get(_Vendor, vendor_id)
        own_gstin = (getattr(vendor, "gstin", None) or "").strip()
        own_state = _gst.gstin_state(own_gstin) or _gst.normalize_state_code(getattr(vendor, "state", None))

        def _inv_date(inv) -> date:
            raw = getattr(inv, "invoice_date", None) or getattr(inv, "created_at", None)
            if raw is None:
                return period_start   # last resort
            return raw.date() if hasattr(raw, "date") else raw

        r = await self.db.execute(
            select(Invoice).where(
                Invoice.vendor_id == vendor_id,
                Invoice.invoice_type.in_(["invoice", "credit_note"]),
                Invoice.status.notin_(["draft", "void", "cancelled"]),
            )
        )
        all_docs = r.scalars().all()

        zero = _D("0")
        b2b: list[dict] = []
        b2cl: list[dict] = []
        b2cs_map: dict[tuple, dict] = {}
        b2b_cdns: list[dict] = []
        b2cs_cdns: list[dict] = []
        hsn_map: dict[tuple, dict] = {}
        tot = {"inv": {"taxable": zero, "cgst": zero, "sgst": zero, "igst": zero, "count": 0},
               "cn": {"taxable": zero, "cgst": zero, "sgst": zero, "igst": zero, "count": 0}}
        issues: list[str] = []

        def _fl(v):
            return float(_gst.q2(v))

        for inv in all_docs:
            d = _inv_date(inv)
            if not (period_start <= d <= period_end):
                continue
            is_cn = (getattr(inv, "invoice_type", "invoice") == "credit_note")
            sign = -1 if is_cn else 1

            cgst = _D(str(inv.cgst_amount or 0))
            sgst = _D(str(inv.sgst_amount or 0))
            igst = _D(str(inv.igst_amount or 0))
            taxable = _D(str(inv.taxable_amount if inv.taxable_amount is not None else (inv.subtotal or 0)))
            total = _D(str(inv.total or 0))
            gstin = (inv.customer_gstin or "").strip()

            pos_code = _gst.normalize_state_code(inv.place_of_supply, gstin) or own_state
            if not pos_code:
                issues.append(f"{inv.invoice_number}: place of supply could not be determined")
            inter = igst > 0 or bool(inv.is_inter_state) or bool(pos_code and own_state and pos_code != own_state)

            rls = _gst.rate_lines(inv.items or [])
            if not rls:   # no line detail: one synthetic line from the header
                tax = cgst + sgst + igst
                rate = ((tax / taxable) * 100).quantize(_D("0.01")) if taxable > 0 else zero
                rls = [{"rate": rate, "taxable": taxable, "cgst": cgst, "sgst": sgst,
                        "igst": igst, "cess": zero}]
            rl_json = [{"rate": float(x["rate"]), "taxable": _fl(x["taxable"]), "cgst": _fl(x["cgst"]),
                        "sgst": _fl(x["sgst"]), "igst": _fl(x["igst"]), "cess": _fl(x["cess"])} for x in rls]

            row = {
                "invoice_number": inv.invoice_number,
                "invoice_date": str(d),
                "total": _fl(total), "taxable_value": _fl(taxable),
                "cgst": _fl(cgst), "sgst": _fl(sgst), "igst": _fl(igst),
                "place_of_supply": inv.place_of_supply or "",
                "pos_code": pos_code, "customer_gstin": gstin,
                "is_inter_state": inter, "rate_lines": rl_json,
            }

            bucket = tot["cn" if is_cn else "inv"]
            bucket["taxable"] += taxable; bucket["cgst"] += cgst
            bucket["sgst"] += sgst; bucket["igst"] += igst; bucket["count"] += 1

            large_b2c = inter and not gstin and total > _gst.b2cl_threshold(d)
            if is_cn:
                if gstin:
                    b2b_cdns.append(row)
                elif large_b2c:
                    b2cs_cdns.append({**row, "report_in_cdnur": True})
                else:
                    b2cs_cdns.append({**row, "report_in_cdnur": False})
            elif gstin:
                b2b.append(row)
            elif large_b2c:
                b2cl.append(row)

            # B2CS: small B2C invoices, minus small B2C credit notes
            if not gstin and not large_b2c:
                for x in rls:
                    key = ("INTER" if inter else "INTRA", pos_code or "99", float(x["rate"]))
                    agg = b2cs_map.setdefault(key, {
                        "sply_ty": key[0], "pos_code": key[1], "rate": key[2],
                        "taxable": zero, "cgst": zero, "sgst": zero, "igst": zero, "cess": zero})
                    for f in ("taxable", "cgst", "sgst", "igst", "cess"):
                        agg[f] += sign * x[f]

            # HSN summary (rate-wise) from the JSONB line items
            for it in (inv.items or []):
                ln = _gst.line_tax(it)
                hk = (ln["hsn"] or "UNDEF", ln["uqc"], ln["rate"])
                h = hsn_map.setdefault(hk, {
                    "hsn_sac": hk[0], "uqc": hk[1], "rate": float(hk[2]), "desc": ln["desc"],
                    "quantity": zero, "taxable_value": zero, "cgst": zero, "sgst": zero,
                    "igst": zero, "cess": zero, "total_value": zero})
                h["quantity"] += sign * ln["qty"]
                for f_out, f_in in (("taxable_value", "taxable"), ("cgst", "cgst"), ("sgst", "sgst"),
                                    ("igst", "igst"), ("cess", "cess")):
                    h[f_out] += sign * ln[f_in]
                h["total_value"] += sign * (ln["taxable"] + ln["cgst"] + ln["sgst"] + ln["igst"] + ln["cess"])
                if hk[0] == "UNDEF":
                    issues.append(f"{inv.invoice_number}: line without HSN/SAC code")

        def _net(f):
            return tot["inv"][f] - tot["cn"][f]

        b2cs = [{
            "sply_ty": v["sply_ty"], "pos_code": v["pos_code"], "rate": v["rate"],
            "place_of_supply": v["pos_code"], "taxable": _fl(v["taxable"]),
            "taxable_value": _fl(v["taxable"]), "cgst": _fl(v["cgst"]), "sgst": _fl(v["sgst"]),
            "igst": _fl(v["igst"]), "cess": _fl(v["cess"]),
            "total": _fl(v["taxable"] + v["cgst"] + v["sgst"] + v["igst"] + v["cess"]),
        } for v in b2cs_map.values()]
        hsn_summary = [{
            "hsn_sac": h["hsn_sac"], "uqc": h["uqc"], "rate": h["rate"], "desc": h["desc"],
            "quantity": float(h["quantity"]), "taxable_value": _fl(h["taxable_value"]),
            "cgst": _fl(h["cgst"]), "sgst": _fl(h["sgst"]), "igst": _fl(h["igst"]),
            "cess": _fl(h["cess"]), "total_value": _fl(h["total_value"]),
        } for h in hsn_map.values()]

        inv_t, cn_t = tot["inv"], tot["cn"]
        return {
            "period": f"{period_start} to {period_end}",
            "supplier_gstin": own_gstin,
            "supplier_state_code": own_state,
            "b2b": b2b, "b2cl": b2cl, "b2cs": b2cs,
            "b2b_cdns": b2b_cdns, "b2cs_cdns": b2cs_cdns,
            "hsn_summary": hsn_summary,
            "total_invoices": inv_t["count"], "total_credit_notes": cn_t["count"],
            # invoices only (as filed in the invoice tables)
            "total_taxable": _fl(inv_t["taxable"]), "total_cgst": _fl(inv_t["cgst"]),
            "total_sgst": _fl(inv_t["sgst"]), "total_igst": _fl(inv_t["igst"]),
            "total_tax": _fl(inv_t["cgst"] + inv_t["sgst"] + inv_t["igst"]),
            # credit notes
            "cn_taxable": _fl(cn_t["taxable"]), "cn_cgst": _fl(cn_t["cgst"]),
            "cn_sgst": _fl(cn_t["sgst"]), "cn_igst": _fl(cn_t["igst"]),
            # net outward liability = invoices - credit notes (feeds GSTR-3B 3.1)
            "net_taxable": _fl(_net("taxable")), "net_cgst": _fl(_net("cgst")),
            "net_sgst": _fl(_net("sgst")), "net_igst": _fl(_net("igst")),
            "net_tax": _fl(_net("cgst") + _net("sgst") + _net("igst")),
            "data_issues": issues[:100],
        }

    async def compute_gstr3b(self, vendor_id: UUID, period_start: date,
                             period_end: date) -> dict:
        """
        GSTR-3B: outward liability (net of credit notes), eligible ITC by head, and
        net payable after set-off in the order prescribed by Sections 49/49A/49B.
        ITC comes only from bills posted to the ledger whose supplier has a GSTIN.
        """
        from decimal import Decimal as _D
        from app.models.procurement import Supplier as _Supplier
        from app.models.vendor import Vendor as _Vendor
        from app.services.finance import gst as _gst

        gstr1 = await self.compute_gstr1(vendor_id, period_start, period_end)
        out = {"igst": _D(str(gstr1["net_igst"])), "cgst": _D(str(gstr1["net_cgst"])),
               "sgst": _D(str(gstr1["net_sgst"]))}
        total_outward_tax = out["igst"] + out["cgst"] + out["sgst"]

        own = await self.db.get(_Vendor, vendor_id)
        own_gstin = getattr(own, "gstin", None)

        r = await self.db.execute(
            select(FinVendorBill, _Supplier.gstin)
            .join(_Supplier, _Supplier.id == FinVendorBill.supplier_id)
            .where(
                _Supplier.gstin.isnot(None),
                _Supplier.gstin != "",
                FinVendorBill.vendor_id == vendor_id,
                FinVendorBill.bill_date >= period_start,
                FinVendorBill.bill_date <= period_end,
                FinVendorBill.status.in_(["open", "partially_paid", "paid"]),
                FinVendorBill.journal_entry_id.isnot(None),
            )
        )
        itc = {"igst": _D("0"), "cgst": _D("0"), "sgst": _D("0")}
        bills = 0
        for bill, sup_gstin in r.all():
            bills += 1
            c, s_, i = (_D(str(bill.cgst_amount)) if bill.cgst_amount is not None else None,
                        _D(str(bill.sgst_amount)) if bill.sgst_amount is not None else None,
                        _D(str(bill.igst_amount)) if bill.igst_amount is not None else None)
            if c is None and s_ is None and i is None:
                split = _gst.infer_itc_split(_D(str(bill.tax_amount or 0)), sup_gstin, own_gstin)
            else:
                split = {"cgst": c or _D("0"), "sgst": s_ or _D("0"), "igst": i or _D("0")}
            for h in itc:
                itc[h] += split[h]
        itc_total = itc["igst"] + itc["cgst"] + itc["sgst"]

        so = _gst.gst_setoff(out, itc)
        pay = so["payable"]
        return {
            "period": f"{period_start} to {period_end}",
            # 3.1 Outward taxable supplies (net of credit notes)
            "outward_taxable": gstr1.get("net_taxable", 0),
            "outward_cgst": float(_gst.q2(out["cgst"])),
            "outward_sgst": float(_gst.q2(out["sgst"])),
            "outward_igst": float(_gst.q2(out["igst"])),
            "total_outward_tax": float(_gst.q2(total_outward_tax)),
            # 4 ITC available
            "itc_bills": bills,
            "itc_total": float(_gst.q2(itc_total)),
            "itc_cgst": float(_gst.q2(itc["cgst"])),
            "itc_sgst": float(_gst.q2(itc["sgst"])),
            "itc_igst": float(_gst.q2(itc["igst"])),
            # 6.1 Net tax payable after ITC set-off
            "net_cgst_payable": float(pay["cgst"]),
            "net_sgst_payable": float(pay["sgst"]),
            "net_igst_payable": float(pay["igst"]),
            "total_net_payable": float(pay["cgst"] + pay["sgst"] + pay["igst"]),
            "itc_carry_forward": {h: float(v) for h, v in so["itc_carry_forward"].items()},
            "total_taxable_turnover": gstr1.get("net_taxable", 0),
            "data_issues": gstr1.get("data_issues", []),
        }


class FinReportRepo:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _account_balance(self, vendor_id: UUID, account_type: str,
                                from_date: date, to_date: date,
                                company_id: UUID = None) -> dict[str, float]:
        """
        Return per-account balances (dr - cr) for the given type and date range.
        All computations happen in the database — only summary rows are returned.
        company_id filter is applied when provided.
        """
        q = (
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
        if company_id:
            q = q.where(FinJournalEntry.company_id == company_id)
        r = await self.db.execute(q)
        return {
            row["id"]: {
                "id": str(row["id"]),
                "name": row["name"],
                "subtype": row["account_subtype"],
                # raw balance: positive = more debits, negative = more credits
                "balance": float(row["dr"]) - float(row["cr"]),
            }
            for row in r.mappings().all()
        }

    async def profit_and_loss(self, vendor_id: UUID,
                              from_date: date, to_date: date,
                              company_id: UUID = None) -> dict:
        """
        P&L for the period. Income accounts have natural credit balances:
        (debit - credit) is negative for income — we negate it for reporting.
        Expense accounts have natural debit balances: (debit - credit) is positive.
        We always report both as positive amounts in the statement.
        """
        income_raw = await self._account_balance(vendor_id, "Income", from_date, to_date,
                                                 company_id=company_id)
        expense_raw = await self._account_balance(vendor_id, "Expense", from_date, to_date,
                                                  company_id=company_id)

        def _signed_income(v: dict) -> dict:
            """Income accounts: natural credit balance → negate (dr-cr) to get positive income."""
            raw = v["balance"]   # dr - cr, normally negative for income accounts
            amount = -raw        # positive = revenue earned, negative = returns/contra
            return {**v, "amount": amount, "balance": amount}

        def _signed_expense(v: dict) -> dict:
            """Expense accounts: natural debit balance → (dr-cr) is positive."""
            amount = v["balance"]  # dr - cr, positive for normal expenses
            return {**v, "amount": amount, "balance": amount}

        income_lines = [_signed_income(v) for v in income_raw.values()]
        expense_lines = [_signed_expense(v) for v in expense_raw.values()]

        total_income = sum(v["amount"] for v in income_lines)
        total_expense = sum(v["amount"] for v in expense_lines)
        gross_profit = total_income - sum(
            v["amount"] for v in expense_lines
            if (v.get("subtype") or "").upper() in ("COGS", "COST OF GOODS SOLD")
        )

        return {
            "period": f"{from_date} to {to_date}",
            "income": income_lines,
            "expenses": expense_lines,
            "total_income": round(total_income, 2),
            "total_expenses": round(total_expense, 2),
            "gross_profit": round(gross_profit, 2),
            "net_profit": round(total_income - total_expense, 2),
        }

    async def balance_sheet(self, vendor_id: UUID, as_of: date,
                            company_id: UUID = None) -> dict:
        """
        Returns a Current/Non-Current classified balance sheet.

        Sign convention (double-entry):
          - Asset accounts: natural DEBIT balance → (dr - cr) is positive → report as positive
          - Liability/Equity accounts: natural CREDIT balance → (dr - cr) is negative → report as positive
          - Contra accounts (accumulated depreciation, contra-equity) have opposite signs

        Retained earnings = cumulative net income up to as_of minus dividends.
        Opening retained earnings are read from the Equity "Retained Earnings" account;
        if not found, P&L net income from inception is folded in.
        """
        # All history up to as_of (inception date chosen conservatively)
        _INCEPTION = date(1970, 1, 1)
        assets_raw = await self._account_balance(vendor_id, "Asset", _INCEPTION, as_of,
                                                 company_id=company_id)
        liab_raw = await self._account_balance(vendor_id, "Liability", _INCEPTION, as_of,
                                               company_id=company_id)
        equity_raw = await self._account_balance(vendor_id, "Equity", _INCEPTION, as_of,
                                                 company_id=company_id)

        # Compute retained earnings from P&L (income - expense since inception)
        income_raw = await self._account_balance(vendor_id, "Income", _INCEPTION, as_of,
                                                 company_id=company_id)
        expense_raw = await self._account_balance(vendor_id, "Expense", _INCEPTION, as_of,
                                                  company_id=company_id)
        # Income: (dr-cr) is negative for normal credits → negate
        total_income = sum(-v["balance"] for v in income_raw.values())
        total_expense = sum(v["balance"] for v in expense_raw.values())
        retained_earnings = total_income - total_expense

        def _asset_line(v: dict) -> dict:
            """Assets: normal debit balance → report as-is."""
            return {"id": v["id"], "name": v["name"], "subtype": v.get("subtype", ""), "amount": round(v["balance"], 2)}

        def _liab_equity_line(v: dict) -> dict:
            """Liabilities/Equity: normal credit balance → negate (dr-cr) to get positive."""
            return {"id": v["id"], "name": v["name"], "subtype": v.get("subtype", ""), "amount": round(-v["balance"], 2)}

        current_assets = [_asset_line(v) for v in assets_raw.values() if v.get("subtype") == "Current Asset"]
        non_current_assets = [_asset_line(v) for v in assets_raw.values() if v.get("subtype") != "Current Asset"]
        current_liabilities = [_liab_equity_line(v) for v in liab_raw.values() if v.get("subtype") == "Current Liability"]
        non_current_liabilities = [_liab_equity_line(v) for v in liab_raw.values() if v.get("subtype") != "Current Liability"]
        equity_lines = [_liab_equity_line(v) for v in equity_raw.values()]

        total_current_assets = round(sum(l["amount"] for l in current_assets), 2)
        total_non_current_assets = round(sum(l["amount"] for l in non_current_assets), 2)
        total_current_liabilities = round(sum(l["amount"] for l in current_liabilities), 2)
        total_non_current_liabilities = round(sum(l["amount"] for l in non_current_liabilities), 2)
        total_assets = round(total_current_assets + total_non_current_assets, 2)
        total_liabilities = round(total_current_liabilities + total_non_current_liabilities, 2)
        total_equity_explicit = round(sum(l["amount"] for l in equity_lines), 2)
        total_equity = round(total_equity_explicit + retained_earnings, 2)

        return {
            "as_of": str(as_of),
            "current_assets": current_assets,
            "non_current_assets": non_current_assets,
            "total_current_assets": total_current_assets,
            "total_non_current_assets": total_non_current_assets,
            "current_liabilities": current_liabilities,
            "non_current_liabilities": non_current_liabilities,
            "total_current_liabilities": total_current_liabilities,
            "total_non_current_liabilities": total_non_current_liabilities,
            "equity": equity_lines,
            "retained_earnings": round(retained_earnings, 2),
            "total_equity": total_equity,
            "total_liabilities": total_liabilities,
            "total_assets": total_assets,
            # Accounting equation check: should be ~0.00 if GL is balanced
            "check": round(total_assets - total_liabilities - total_equity, 2),
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

        # Multi-level policies: the server decides which level this approval satisfies
        # (never the client), each level needs a different approver, and the request only
        # becomes 'approved' once the last level signs off. Rejection at any level is final.
        levels = 1
        if request.policy_id:
            policy = (await self.db.execute(
                select(FinApprovalPolicy).where(FinApprovalPolicy.id == request.policy_id)
            )).scalar_one_or_none()
            levels = max(1, int(policy.levels or 1)) if policy else 1
        if levels > 1 and action == "approved":
            if request.status != "pending":
                raise ValueError(f"This approval request is already {request.status}.")
            done = (await self.db.execute(
                select(FinApprovalStep).where(
                    FinApprovalStep.request_id == request.id,
                    FinApprovalStep.status == "approved",
                )
            )).scalars().all()
            if any(s.approver_id == approver_id for s in done):
                raise ValueError("You already approved an earlier level; a different approver must sign off the next level.")
            step_number = len(done) + 1
            self.db.add(FinApprovalStep(
                id=uuid.uuid4(), request_id=request.id, step_number=step_number,
                approver_id=approver_id, status="approved",
                action_at=datetime.utcnow(), comments=comments,
            ))
            if step_number >= levels:
                request.status = "approved"
                request.resolved_at = datetime.utcnow()
            await self.db.flush()
            return request

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
