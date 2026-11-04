# Finance module — go-live runbook

Audience: the person responsible for switching a tenant's books onto KIT ERP.
Every step names the screen or endpoint to use and the result that must be true before moving on.

## 0. Before anything (engineering, once per environment)

| # | Action | Done when |
|---|--------|-----------|
| 0.1 | Back up the Postgres database | Restore of the backup has been tested |
| 0.2 | Run migrations: `alembic upgrade heads` (finance chain `fin022 → fin023 → fin024 → fin025`) | No errors; `fin_posting_failure` table exists; `fin_vendor_bill` has `tds_*`/`cgst_amount` columns |
| 0.3 | Run the finance test suites against **Postgres** (`tests/test_finance_*.py`, `test_document_splitting.py`, `test_gl_clearing.py`, `test_fx_reval.py`, `test_ap_project_tagging.py`) | All pass. The suites normally run on SQLite; Postgres-only behaviour (advisory locks, row locks) is not exercised there |
| 0.4 | Confirm Celery beat is running and the finance jobs are scheduled | Depreciation, aging, recurring journals, tax pre-compute appear in beat schedule |
| 0.5 | **Decide the inventory accounting method** (see "Open decisions") | Written decision recorded |

## 1. Tenant setup

1. Business profile: legal name, **GSTIN**, state. GSTR-1/3B and the ITC split depend on the state code in the GSTIN.
2. Finance → Chart of Accounts: seed the default chart, then `POST /setup/ensure-accounts` (button **Add missing default accounts** on *Posting Health → Posting readiness*) so statutory accounts exist (PF, ESI, PT, TDS Payable, GST accounts, Inventory Adjustment).
3. Fiscal year and periods: create the Indian FY (Apr–Mar) with monthly periods; all periods you will post into must be **open**.
4. Number ranges: leave on auto (created on first use per document type and fiscal year).
5. Supplier master: GSTIN on every registered supplier (drives ITC eligibility and CGST/SGST vs IGST).
6. Approval policies / posting controls: configure before users start posting.

**Gate:** *Posting Health → Posting readiness* shows every row green, and *Go-live checklist* shows all checks passed.

## 2. Opening balances

1. Prepare a trial balance as of the cut-over date from the old system, signed off by the accountant.
2. Import via **Opening balances → import** (`POST /opening-balances/import`). It posts one balanced journal dated the as-of date; re-importing voids and replaces it.
3. Load open AR invoices and open AP bills as documents (not just in the opening journal) so ageing and payments work, and ensure the opening journal does not double count them (post the control-account balance in the opening journal **or** the documents, never both).

**Gate:** KIT trial balance equals the old system's trial balance, account by account.

## 3. Parallel run (minimum one full month-end)

1. Keep the old system as the book of record. Enter the same transactions in KIT.
2. Daily: open **Posting Health**. Target: zero open failures, zero unposted documents. Anything listed is a document that is saved but **not in the ledger**.
3. Weekly: compare trial balance, AR ageing, AP ageing and bank balance with the old system. Investigate every difference.
4. At month end rehearse the close:
   - *Posting Periods → Close* runs the checklist (draft journals, unposted documents, open failures, earlier open periods). Blockers must be zero.
   - Compute GSTR-1 and GSTR-3B for the month and compare with the old system's figures (taxable value, tax by head, ITC by head, net payable).
   - Run *Tax Returns → TDS by section* and compare to Form 26Q working. "Still to deposit" must equal the challans you expect to pay.
5. Reopen a period only with a written reason (stored in the audit log); lock a period after the return for it is filed.

**Exit criteria for the parallel run:** two consecutive month-end closes where KIT and the old system agree to the rupee on the trial balance, GST liability/ITC, TDS and bank, with no unresolved items on Posting Health.

## 4. Sign-off (all required)

| Role | Confirms |
|------|----------|
| Finance head / CA | Trial balance, GST and TDS reconcile for the parallel months |
| Operations owner | Every sales/purchase/payroll/POS flow posts (Posting Health clean for the period) |
| IT | Backups, migrations on Postgres, job schedule, monitoring on `fin_posting_failure` count |
| Management | Accepts the open decisions below |

## 5. Cut-over day

1. Freeze entry in the old system. Take final trial balance.
2. Import/true-up opening balances (section 2).
3. Run *Go-live checklist* and *Posting readiness* one more time.
4. Announce; old system becomes read-only.

## 6. Daily / monthly operations after go-live

- **Daily:** Posting Health (failures, unposted). A rising failure count means a configuration problem (usually a missing account or closed period), not a one-off.
- **Month end:** close checklist → close period → compute GSTR-1/3B → file → lock period; TDS by section → deposit challan → compare *Still to deposit*.
- **Never** edit a posted journal; reverse or re-post the source document (re-post voids the entry in an open period, or posts a reversal in a closed one).

## 7. Rollback

Before cut-over day: restore the pre-migration backup. After: do not roll back the schema (migrations are additive, `ADD COLUMN IF NOT EXISTS`); reverse incorrect entries through the ledger instead.

## Open decisions (must be answered by the business)

1. **Inventory / COGS method.** Purchases are currently *expensed* when the vendor bill is posted. Posting Dr COGS / Cr Inventory on sales as well would double count cost and push Inventory negative, so COGS and inventory-adjustment auto-posting is intentionally **not** wired. Choose *periodic* (expense on purchase, adjust with closing stock at period end) or *perpetual* (capitalise purchases to Inventory, relieve to COGS on sale). Perpetual needs additional work before go-live.
2. **Multi-company tenants:** historic journals with no business unit stay "all units" (the backfill only touches tenants with exactly one default company).

## Known limits at the time of writing

- Migrations have not been executed against a real Postgres instance by the engineering team's automated checks; do step 0.2/0.3 first.
- No load test has been run; the sizing for high-volume POS tenants is unverified.
- `tests/test_checkout_coupon_tax.py` has 3 pre-existing, unrelated shipping-test failures.
