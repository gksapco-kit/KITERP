# Controlling (CO) module runbook

Scope: `backend/app/api/v1/vendor_controlling.py`, `backend/app/services/controlling/*`,
`backend/app/models/controlling.py`, `vendor-web/src/pages/controlling/*`.

## 1. Deploying

1. Back up the database.
2. Run Alembic: the CO chain is `co001` -> ... -> `co005` -> **`co006`** (`co006_controlling_hardening`).
   `co006` is safe to run on a live system:
   - new tables `co_number_sequence`, `co_variance_run_order`;
   - new columns with defaults (`co_manufacturing_order.qty_cogs_posted`, `co_cost_booking.status`,
     `co_gl_mapping.absorption_account_id`, `co_gl_mapping.post_wip_to_gl`);
   - CHECK constraints are added `NOT VALID` (new rows are checked, old rows are not scanned). Run
     `ALTER TABLE ... VALIDATE CONSTRAINT ...` later, in a quiet window, once you have cleaned any legacy rows;
   - `co_order_operation.work_center_id` now references `co_work_center`. Values that pointed at cost centres are set to NULL
     (they could never be resolved to a work centre).
3. Back-fills done by the migration: `qty_cogs_posted` from `qty_delivered` for orders whose COGS was already posted,
   the `goods_movement` counter from the highest existing `GMnnnnnn`, and descriptive `movement_type` codes.
4. Downgrade is supported but drops the new tables/columns, so only use it before the new features are in use.

## 2. Roles and permissions

| Action | Permission |
| --- | --- |
| Read everything | `finance.view` |
| Create/edit orders, goods movements, confirmations, allocations, variance runs, status transitions | `finance.edit` |
| Master data: cost versions, routings, work centres, overhead pools, activity types, GL mapping, budgets, controlling areas | `finance.coa.manage` |
| Post or reverse journals (completion, COGS, allocation, variance run) | `finance.journal.post` |

The UI hides or disables controls the user may not use; the API enforces the same rules. A dedicated `controlling.*` scheme is
deliberately not part of this release.

## 3. Costing model (decisions to keep in mind)

- **Cost lines**: when both quantity and rate are non-zero the amount is always `qty x rate` (rounded to 4 dp). A line with a
  zero quantity or rate keeps its explicit amount. Patching an amount alone sets qty=1 and rate=amount.
- **Order status** only changes through `POST /manufacturing-orders/{id}/transition`
  (`draft -> released -> in_progress -> completed -> closed`, `cancelled` from the first three). Create accepts only
  `draft | released | in_progress`.
- **Editable** = `draft | released | in_progress`, not a mirror order, no posted completion journal and not in an active
  posted variance run. Actuals (movements, confirmations) need `released | in_progress`. Receipts are also allowed on
  `completed`.
- **Mirror orders** (`ref_doc_type = production_order`) are controlled by the Production module and are read-only in CO.
- **Cancelling** is refused while posted goods movements, confirmations or settlements exist: reverse them first.
- **Numbering** (`MO-000001`, `GM000001`) is gapless and per vendor, taken from `co_number_sequence` inside the transaction.

### Settlement and GL

| Step | Journal | Notes |
| --- | --- | --- |
| Production completion | Dr Finished goods / Cr WIP | Uses *actual* cost. One live posting per order. Reverse to edit the order again. |
| COGS issue | Dr COGS / Cr Finished goods | Incremental: posts `qty_delivered - qty_cogs_posted`, capped by FG value. Reversal is LIFO. |
| Cost allocation | Dr receiver account / Cr sender account | Needs both accounts and an open period. |
| Variance run (optional) | Dr/Cr production variance vs COGS | Only when `post_to_gl` is ticked. |

Reversals create counter entries; the original journals stay in the ledger. A period that is closed gets a dated
counter-entry instead of a void.

### WIP accumulation mode (`co_gl_mapping.post_wip_to_gl`)

- Off (default): WIP only reaches the GL at production completion.
- On: component issues post Dr WIP / Cr Raw material and activity confirmations post Dr WIP / Cr Absorption while the
  order runs. Requires the WIP, raw material and absorption accounts; the API returns 422 if one is missing.
- Switch it on **before** an order starts. Switching mid-order leaves earlier actuals un-journalled, so the completion
  journal (which credits WIP for the full actual cost) would over-credit WIP. If you must switch mid-flight, post the
  difference manually.
- The project-costing path in `vendor_projects.py` does not post WIP journals.

### Variance runs

- A run covers orders completed or closed in the period (`completed_at`, falling back to `updated_at`) that no other active
  run covers (`co_variance_run_order`). A second run for the same month will therefore never double count.
- Posting freezes the covered orders. Reversing a run releases them. Deleting is only possible while the run is open.
- Before this release, posting with GL enabled used a source type with no handler and silently produced no journal. It now
  posts via `co_cost_booking` and fails loudly if accounts are missing.

### Cost versions

`draft -> active -> archived` (archived is final). Lines can only change while a version is `draft`. Activating needs at least
one line and archives the other active versions of the same product and company. The BOM roll-up rejects circular BOMs (422).

## 4. Operating tasks

| Task | How |
| --- | --- |
| Order is stuck "not editable" | Check status, `production_completion_journal_id`, and whether a posted variance run covers it. Reverse the completion (needs `finance.journal.post`) or reverse the variance run. |
| "COGS already posted for all delivered quantity" | Expected. Deliver more, or reverse the latest COGS journal. |
| Receipt return refused | A receipt cannot be reduced below `qty_cogs_posted`; reverse COGS first. |
| "Journal posting failed" | Missing/invalid GL mapping or closed period. Fix the mapping under Controlling -> Finance Integration. |
| Wrong confirmation | Un-journalled: delete it (hard delete undoes the cost). Journalled: reverse it. |
| Orphan numbering gap | Not expected. Gaps indicate a rolled-back transaction that was not the numbering one; investigate. |

## 5. Performance notes

- List endpoints (`manufacturing-orders`, `goods-movements`, `activity-confirmations`, `cost-allocations`, `variance-runs`,
  `internal-orders-report`) accept `limit` (1-2000, default 500) and `offset`, with a stable sort.
- The dashboard and period-end report use SQL aggregates instead of loading every open order.
- Period-end report: *open orders* and *WIP* are live snapshots; *completed orders*, *goods movements* and
  *confirmations* are limited to the selected month; *pending runs/allocations* use the selected period.
- Indexes added by `co006`: `ix_co_mo_vendor_company_created`, `ix_co_cb_vendor_company`, `ix_co_ocl_order_category`,
  `uq_co_gm_vendor_document_no`.

## 6. Tests

```
cd backend
python -m pytest tests/test_co_phase0.py tests/test_co_phase1.py tests/test_co_phase2_3.py tests/test_co_phase6.py tests/test_co_settlement.py -q
cd ../vendor-web && npx tsc --noEmit -p tsconfig.json   # filter the output to src/pages/controlling, src/hooks/useControlling, src/api/controlling
```

Coverage: tenant isolation and permissions (phase 1), state machine, locks, numbering, confirmation undo, movement reversal,
cost-version lifecycle, completion/COGS/allocation/variance posting and reversal (phase 2-3), pagination, period-aware report
and permission gating of the new endpoints (phase 6).

## 7. Known limitations

- No `controlling.*` permission scheme yet; `finance.*` permissions are used.
- A GL mapping field cannot be cleared from the UI (empty means "leave unchanged").
- Legacy rows that violate the new CHECK constraints are tolerated until `VALIDATE CONSTRAINT` is run.
- The vendor-web project has many unrelated TypeScript errors; the controlling files themselves type-check cleanly.
