# Real Estate module - pilot rollout runbook

Use this before switching the module on for a first customer, and again for each new tenant.

## 1. Environment (once per deployment)

| Item | Requirement |
| --- | --- |
| Database | PostgreSQL only. SQLite is for unit tests; row locks and the concurrency guarantees need Postgres. |
| `CRM_ENCRYPTION_KEY` | **Set explicitly** (any long random string or a Fernet key) and back it up with the database backups. Integration secrets are stored encrypted with it. If it is lost or changed, saved secrets can no longer be read and must be re-entered. When unset, a key is derived from the JWT secret (development only). |
| Migrations | `alembic upgrade heads` (revision `re001_realestate_baseline` creates the `re_*` tables and adds any missing columns). The app also runs the same idempotent step at start-up. |
| Workers | One Celery **worker** and one Celery **beat** process must be running. Beat drives: `realestate.outbox` (every minute: customer email/SMS), `realestate.daily` (block/lease/warranty expiry, ledger-posting retries, optional auto-billing, overdue reminders, alert digest, one-time encryption of legacy secrets). Without them nothing is sent and nothing expires automatically. |
| Reverse proxy | Serve the portal (`/public/realestate`) over HTTPS only. The portal sends `Cache-Control: no-store` and `Referrer-Policy: no-referrer`; keep those headers. |
| Rate limits | The portal is limited per IP and per link (reads 120/min, writes 20/min). Put the proxy's real client IP in `X-Forwarded-For`. |

## 2. Tenant set-up checklist

1. **Finance**: chart of accounts, posting rules for the Real Estate events (demand, receipt, vendor bill/payment, commission) and an *open accounting period*. Until then documents save but are listed under Administration -> GL Posting Issues; retry after fixing.
2. **Roles**: assign the `re_*` roles or the `realestate.*` permissions. Roles created before this release do **not** get `realestate.pii` automatically; add it for anyone who must see full PAN, KYC numbers, bank accounts and KYC scans (accounts, legal, CRM manager, owners). Everyone else sees only the last four characters.
3. **Masters**: projects (GST %, stamp duty %, registration %, delayed-payment interest %), towers/floors/units, price lists, payment plans (each totals 100%), number ranges, templates (preview each one).
4. **Integrations** (Administration -> Integrations): enter credentials. "Test" only checks that required fields are filled; it does **not** call the provider.
5. **Automation** (Administration -> Automation), all off by default:
   - `notifications` = `{"email": true, "sms": true, "overdue_reminders": true, "reminder_every_days": 7}`
   - `auto_billing` = `{"rent": true, "maintenance": true}`
   - `alert_digest` = `{"enabled": true}`
6. **Opening data**: load existing customers, bookings and receipts before the first demand is raised, so balances are right from day one.

## 3. Pilot plan

- One project, a small team, one full billing cycle (demand -> receipt -> TDS entry -> GST summary -> RERA account -> reconciliation).
- Compare the system's GST summary, TDS register, RERA account and receivables ageing against the books for the same period. Differences are bugs or set-up errors; resolve before widening.
- Train by role: sales (leads to booking), accounts (receipts, TDS, GL issues), site (progress, stock), legal (agreements, approvals).
- Exit criteria: no open GL posting issues, Administration -> Notifications shows no critical items older than a day, reconciliation reports no unexplained differences, and sign-off from the accountant (section 5).

## 4. Monitoring

Administration -> Notifications (also in the daily digest to staff) now includes system health:

| Alert | Meaning | Action |
| --- | --- | --- |
| "N document(s) not posted to the ledger" | A receipt/demand/bill could not be posted. | GL Posting Issues: fix accounts or period, then Retry. The daily job retries up to 10 times by itself. |
| "N customer message(s) could not be delivered" | Email/SMS failed 3 times. | Check recipient or provider, then "Retry sending" in the Communication log. |
| "N message(s) waiting for over 30 minutes" | The outbox job is not running. | Check Celery worker and beat. |

Also watch application logs for `Real-estate daily job failed` and `Real-estate outbox failed` (one vendor's failure never stops the others).

## 5. Compliance items for the accountant to confirm

The behaviour below is covered by worked-example tests (`backend/tests/test_realestate_phase12.py`). These points are interpretations that should be confirmed for your jurisdiction and facts:

1. **GST**: the project GST % is applied to the full agreement value (the 5% / 1% headline rates already embed the land deduction). Confirm the rate per project type and that ITC is not claimed on 5%/1% projects.
2. **TDS 194-IA**: 1% on every payment when consideration is 50 lakh or more. The law tests the *higher of* price and stamp-duty value; the system uses the agreement value unless a stamp-duty value is supplied to the calculator (no booking field stores it yet). Check units sold below circle rate.
3. **Form 26QB** due date is shown as 30 days after the end of the month of deduction.
4. **RERA 70% account**: the reserve is 70% of amounts collected *including the GST component*. Confirm whether your auditors want it on the pre-GST amount. Withdrawals are limited to certified completion % of the deposited reserve, less earlier withdrawals (a simplification of the cost-based formula in Form 3).
5. **Delayed-payment interest** is simple interest per project rate, actual days / 365, on the outstanding principal of each overdue demand. Confirm the rate against the agreement for sale / state RERA rules.
6. **Pre-agreement cap**: demands above 10% before the agreement for sale are blocked (RERA s.13).

## 6. Data protection (DPDP Act aligned)

- **Purpose**: personal data (identity, contact, KYC, PAN, bank) is processed to perform the sale/lease contract and meet tax and RERA obligations.
- **Access**: PAN, Aadhaar last four, KYC numbers, bank account numbers and KYC file links are masked for roles without `realestate.pii`. Integration secrets are encrypted at rest, shown masked, and never written to the audit log. The customer portal uses revocable, expiring links and sends the token only in a header.
- **Retention**: keep transaction, tax and KYC records for at least 8 years after the last transaction (income-tax and RERA record-keeping), then review for deletion. Leads that never convert should be reviewed after 24 months.
- **Erasure / correction requests**: correct through the customer record. Do not delete customers with bookings, receipts or tax entries (the database prevents it); for those, restrict processing and document the legal basis for retention. Erase leads and communications that have no legal retention need.
- **Breach**: revoke affected portal links (customer -> portal access), rotate integration secrets, and notify per your incident process.

## 7. Known gaps (not in this release)

- **eSign** of agreements and **online payment through the portal** (gateway checkout and automatic reconciliation) are not built: they need a provider account and sandbox credentials. Receipts are recorded by staff.
- WhatsApp messaging is not implemented (email and SMS only).
- KYC and document files are stored as links; there are no short-lived signed download URLs yet. Links are hidden from roles without `realestate.pii`, but anyone who has a raw link can open it unless the storage bucket itself is private.
- Searching customers by PAN still works for roles without `realestate.pii` (results are masked); acceptable for the pilot, tighten if required.

## 8. Rollback

The module is additive: new `re_*` tables and nullable/defaulted columns only. To pause a tenant, disable the Real Estate module in Modules (data is retained). Turn off `notifications` and `auto_billing` first if they were enabled.
