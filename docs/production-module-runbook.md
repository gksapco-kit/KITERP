# Production module – operations runbook

## Access model
| Action | Permission |
|---|---|
| View orders, work centers, analytics, shortages, reconciliation report | `production.view` |
| Create/edit/transition orders, operations, work centers; create PR from shortages; repair reconciliation | `production.manage` |
| Purchase requisitions created from shortages | also writes a PR (audited on the order) |

All routes additionally require the vendor's `production_enabled` module flag.

## Order lifecycle
`draft → confirmed → in_production → qc → completed`, plus `on_hold` and `cancelled`.
- Confirming reserves components (soft hold); cancelling/completing releases them.
- Products flagged `qc_required_on_production` must pass through `qc` before `completed`.
- Completion is one transaction: component issue, finished-goods receipt, valuation (moving average),
  controlling mirror (`co_manufacturing_order`) and the GL journal (`co_cost_booking`).
- Re-opening a completed order reverses all of the above from the stored `inventory_posting` snapshot.
  It is refused when COGS has already been settled for the order.

## Accounting prerequisites
Per company, `co_gl_mapping` needs **finished_goods**, **raw_material** and **wip** accounts.
Without a company/mapping the order still completes and the journal is recorded as `skipped` with a reason
(visible on the order's Items tab). A closed accounting period or unbalanced entry fails the completion.

Journal: Dr Finished Goods (total) / Cr Raw Materials (material) / Cr WIP (labor absorbed).

## Reconciliation (run after migration, and periodically)
- `GET  /api/v1/vendors/me/production/reconciliation` – list inconsistencies.
- `POST /api/v1/vendors/me/production/reconciliation/repair` – releases stale reservations only.

| Code | Meaning | Action |
|---|---|---|
| `stale_reservation` | Reservation still active for a completed/cancelled order | Auto-repair |
| `live_without_reservation` | Live order has no soft hold | Re-save the order or move it through confirm again |
| `completed_without_posting` | Completed but no stock posting (legacy) | Review manually; re-open and complete again |
| `posted_but_not_completed` | Posting snapshot on a non-completed order | Review manually |
| `stock_ledger_mismatch` | Stock ledger differs from the snapshot | Investigate adjustments after completion |
| `journal_missing` / `journal_not_posted` | GL entry absent or voided | Re-open and complete, or post manually |

Only reservation repair is automatic; stock and ledger issues are never changed without a human decision.

## Partial output
In `in_production` / `qc`, **Stock tab → Record output** books part of the order: components are consumed
pro rata (rounded down; the final completion takes the remainder), finished goods are received at material
cost, and reservations shrink accordingly. Labor is absorbed by the final receipt.
- `POST/GET /production-orders/{id}/outputs`, `DELETE …/outputs/{output_id}` (reverse).
- The last unit is never delivered by a partial output - complete the order instead.
- While outputs exist the order cannot go back to draft or be cancelled; reverse the outputs first.
- Re-opening a completed order reverses only the final receipt; recorded outputs stay.
- Not available for batch-managed products.

## BOM revisions and by-products
- BOM lines may carry `valid_from` / `valid_to`. MRP, shortages, reservations and completion use the lines
  effective **today**. The same component may repeat only with non-overlapping windows.
- A line flagged **by-product** is received into stock at completion (qty per unit x ordered qty) and takes
  `cost_share_pct` of the final receipt cost (shares total at most 100%). It is excluded from requirements.

## Standard routing
`GET/PUT /products/{id}/routing` keeps a template (name, work center, setup hours, hours per unit). When an
order with no operations leaves draft, the template is copied in (planned hours = setup + per-unit x qty).
An order with hand-made operations is never overwritten.

## Sales orders and scheduling
- `POST /production-orders/from-sales-order/{id}` drafts a make-to-order production order for the manufactured
  lines (those with a BOM); `shortfall_only` limits quantities to what stock cannot cover. Refused with 409 if a
  non-cancelled production order already carries that sales order number. The sales order page shows the link.
- `POST /production-orders/{id}/schedule` previews, `…/schedule/apply` stores planned start/end per operation.
  Single-queue forward scheduling: operations run in sequence and wait for the work center to be free
  (other open orders' planned end); duration = hours / `capacity_per_day` (8 h when unset). No shifts/holidays.
- `GET /production-orders/{id}/pick-list` and `…/job-card` feed the printable **Job card / pick list** (Routing tab).

## Scheduled jobs and cleanup
- Celery beat `production.daily` (also `app.tasks.production_jobs.run_daily_now()` for cron) sends at most one
  in-app digest per vendor per day: overdue orders, orders due within 3 days, ledger mismatches. It only reports.
- `python -m scripts.production_cleanup [--vendor ID] [--apply]` audits every vendor (dry run by default; exits
  non-zero when error-level issues exist). `--apply` only releases stale reservations.

## Deployment
1. Deploy backend (startup `ensure_production_hardening_columns` also applies the schema) or run Alembic up to
   `prod011_production_extensions` (chained after `re001_realestate_baseline`, which follows `prod010`).
2. Check reconciliation report; repair stale reservations.
3. Verify `co_gl_mapping` for each company that produces goods.
4. Grant `production.manage` to roles that edit production data (view-only roles see read-only screens).
5. Make sure a Celery beat process runs if the daily digest is wanted.

## Known limitations
- Quantities on stock are whole numbers (store inventory is integer); fractional units/UoM/variants are not
  supported. Changing this means a `StoreInventory`/valuation/ledger migration and is a separate project.
- Partial outputs carry material cost only; labor lands on the final receipt.
- By-products are not supported for batch-managed products.
- Scheduling is an estimate (single queue per work center), not an optimiser.
- FG unit cost is split evenly by quantity when an order has several finished products.
- Attachments are stored inline (base64) on the order; large files should be avoided.
- Row-level locking is verified only on PostgreSQL; the SQLite test harness cannot exercise concurrency.
