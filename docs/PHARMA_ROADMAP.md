# Pharma competitive roadmap

> **Audience:** product + eng  
> **Status today:** Phases **0–10 enforced** (Stages A–C MVP); honest limits remain on partner networks / formal validation  
> **Positioning:** Wholesale-ready path with GDP lite + EPCIS export + live-VRS-capable DSCSA verify. Configure VRS/NMVS credentials to go live; runs in local-stub mode otherwise. Not a drop-in TraceLink / SAP ATTP replacement.  
>
> **Wave 1 (2026-07-28):** Nav/master-data UX gaps closed — Complaints in sidebar, GDP/track-trace Overview deep links, GTIN/NDC/storage condition on Product form, SLoc GDP temp bands, Foundations product search, recall action rendering, MBR multi-op create.  
> **Wave 2 (2026-07-28):** Functional gaps — recall PDF export, serial disaggregate, CSV excursion import, N-approver matrix (min_approvers_* per action), GenealogyNode collapsible tree, StageC CSV import UI, collapsible genealogy.  
> **Wave 3 (2026-07-28):** Regulatory network integrations — DSCSA VRS live HTTP client (stub fallback), EU FMD NMVS live HTTP client (region-gated), proper SGTIN encoding with GS1 company prefix, approval-policy UX merged (no duplicate dual_sign toggles), VRS stub/live badge on verify panel, POS batch/expiry columns auto-enabled when pharma is on.

This roadmap turns competitive gaps into three commercial stages, mapped to the existing phase keys in `vendor_pharma` overview and `app/models/pharma.py`.

---

## Stage map

| Stage | Commercial goal | Phase focus | Exit criteria |
|-------|-----------------|-------------|---------------|
| **A — Regulated SMB MVP** | Sell to small manufacturers / pharmacies that need defensible GxP basics | Complete **7**, harden **0–6** | Credentialed e-sign on critical actions; hard process gates; lot restore on returns |
| **B — Regulated SMB+** | Compete with Odoo/ERPNext-class pharma + light QMS | Deepen **6**, finish usable **8** | Serial lifecycle enforced; QMS depth (OOS, multi-approver, effectiveness); BPR/CoA archive |
| **C — Wholesale / track-and-trace** | Wholesale, 3PL, US/EU distribution readiness | Extend **8** + new **9–10** | DSCSA/EPCIS path, GDP lite, NDC/GTIN, partner verification story |

Phases **0–6** stay “done” unless a hardening item below is required for Stage A exit.

---

## Phase reference (current product)

| ID | Key | Label | Status | Stage ownership |
|----|-----|-------|--------|-----------------|
| 0 | `foundations` | Foundations | enforced | A harden |
| 1 | `lot_stock` | Lot-first stock | enforced | A harden |
| 2 | `fefo` | FEFO & quarantine | enforced | A harden |
| 3 | `ebmr` | MBR / BPR | enforced | A/B deepen |
| 4 | `qc` | QC / CoA / Release | enforced | A/B deepen |
| 5 | `genealogy` | Genealogy & recall | enforced | B deepen |
| 6 | `qms` | QMS | enforced | B deepen |
| 7 | `esign` | E-sign & audit | **enforced** | Stage A done — harden dual-sign ops |
| 8 | `serialization` | Serialization | **enforced** (internal) | **B done → C extend** |
| 9 | `gdp` | GDP / cold chain | **enforced** (lite) | **C done** |
| 10 | `track_trace` | DSCSA / EPCIS / FMD | **enforced** (export + stub) | **C done** |

---

## Stage A — Regulated SMB MVP

**Goal:** A compliance-conscious buyer can treat KITERP as the system of record for lot release and critical approvals.

### Phase 7 — E-sign & audit (primary)

| Work item | Why it matters | Acceptance |
|-----------|----------------|------------|
| Password/OTP re-auth at sign time | Part 11 / Annex 11 expectation | Sign fails without fresh credential check |
| Meaning of signature (e.g. Author / Reviewer / Approver) | Legal/regulatory meaning | Stored on `PharmaAuditEvent` + UI |
| Dual sign on release, BPR complete, CAPA close, CC approve | Industry default for release | Configurable; at least release + BPR complete |
| Immutable signed payload + user id + timestamp + hash | Integrity | Existing hash extended with signer identity + meaning |
| Failed sign attempts logged | Audit readiness | Visible in `/pharma/audit` |

**Exit for phase 7:** Overview status moves `partial` → `enforced` (or `validated` if IQ/OQ docs exist). Note must no longer say “not full Part 11.”

### Hardening phases 0–6 (required for Stage A)

| Phase | Work item | Acceptance |
|-------|-----------|------------|
| 1 / 2 | POS & order **returns restore lot qty** (and quality status rules) | Return increases `quantity_available` on original/return lot |
| 2 | FEFO on all material issues that deplete batch-managed stock | No silent non-lot GI for batch-managed SKUs |
| 3 | Optional vendor setting: **BPR required** before FG unrestricted | Cannot release FG without completed BPR when enabled |
| 4 | Retest-due alert → **open retest inspection** (or one-click) | Retest path from alert to QI |
| 4 | CoA / BPR **PDF archive** (stored file, not only HTML print) | Downloadable from release / BPR |
| 0 | Alembic migrations for pharma tables (replace startup-only DDL for prod) | `alembic upgrade` creates/updates pharma schema |

### Stage A non-goals

- Full DSCSA trading-partner network  
- DEA / controlled substances  
- Veeva-class document control / training LMS  

---

## Stage B — Regulated SMB+

**Goal:** Compete with mid-market pharma ERP add-ons on QMS depth and usable serialization.

### Phase 6 — QMS deepen

| Work item | Acceptance |
|-----------|------------|
| OOS / OOT investigation object (or typed deviation) linked to inspection | Create from failed IPC/QC result |
| Multi-approver matrices (role-based) | CC / CAPA / release support N approvers |
| CAPA effectiveness due date + reminder | Cannot close early without check; overdue visible on overview |
| Complaint intake → optional deviation | Basic complaint record |
| Training / competency gate (lightweight) | User must have “qualified” flag for `pharma.release` when setting on |

### Phase 3 / 4 / 5 — Manufacturing & evidence UX

| Work item | Acceptance |
|-----------|------------|
| Richer MBR/QC editors (not hardcoded sample ops only) | Edit ops/IPC/clearance in UI |
| Visual genealogy tree (not raw JSON) | Expandable parent/child UI |
| Recall: export impacted customers/orders + action templates | CSV/PDF export from recall |
| Enforce produce → component genealogy when pharma production runs | Genealogy always populated for FG |

### Phase 8 — Serialization (usable product)

| Work item | Acceptance |
|-----------|------------|
| Hierarchy: unit → pack → case → pallet with parent links | UI + API for aggregate/disaggregate |
| Status workflow: active → shipped → recalled → destroyed | Transitions audited + e-signed |
| Enforce `serial_managed` on sale/ship (like `batch_managed`) | Sale/ship fails without allocated serials |
| Commission on GR/production when serial-managed | Serials created/linked automatically or via scan |

**Exit for phase 8 (Stage B):** Overview status `scaffold` → `enforced` for **internal** serialization (not yet regulatory network).

---

## Stage C — Wholesale / track-and-trace

**Goal:** Credible path for licensed wholesale and US/EU track-and-trace evaluation.

### Phase 8 extend + Phase 10 — Track & trace

| Work item | Notes |
|-----------|--------|
| GTIN / NDC (or regional ID) on product | Master data |
| EPCIS event model (commission, pack, ship, receive) | Export JSON/XML |
| DSCSA verification / saleable returns hooks | Start with API + partner stub; TraceLink-class full network later |
| EU FMD decommission path (if EU customers) | Behind region flag |

### Phase 9 — GDP lite

| Work item | Notes |
|-----------|--------|
| Storage condition on SLoc / batch (e.g. 2–8 °C) | Master + lot |
| Temperature excursion log | Manual or sensor import later |
| Licensed wholesale flags / customer license check (lite) | Block ship if expired license when enabled |

### Controlled substances (optional track)

Only if market demand: DEA schedule, perpetual inventory, Form 222 — **separate epic**, not blocking Stage C MVP.

---

## Suggested delivery order (engineering)

```text
A1  Part 11 e-sign (phase 7)
A2  Returns restore lots + FEFO hard-fail consistency (phases 1–2)
A3  BPR-required setting + CoA/BPR PDF archive (phases 3–4)
A4  Retest workflow + Alembic pharma migrations (phases 0, 4)
── Stage A exit ──
B1  Serial lifecycle + serial_managed enforcement (phase 8)
B2  QMS OOS / multi-approver / effectiveness (phase 6)
B3  Genealogy UI + recall export + MBR editor (phases 3, 5)
── Stage B exit ──
C1  NDC/GTIN + EPCIS events (phase 10)             ← DONE (Wave 1/2)
C2  GDP storage + excursion log (phase 9)            ← DONE (Wave 1/2)
C3  DSCSA VRS live client + NMVS client             ← DONE (Wave 3, credential-gated)
C4  Proper SGTIN with GS1 company prefix            ← DONE (Wave 3)
```

---

## Wave 3 — Regulatory network integration (2026-07-28)

All items are credential-gated: features run in stub/local mode until the vendor
configures real partner endpoints in Foundations → Regulatory integrations.

| Item | File(s) changed | Notes |
|------|-----------------|-------|
| DSCSA VRS live HTTP client | `pharma_epcis.py` `dscsa_verify_stub()` | POST to VRS with Bearer token; retry/timeout; fallback to local on error; result includes `partner_call: live\|stub\|error` |
| EU FMD NMVS live HTTP client | `pharma_epcis.py` `fmd_decommission()` | POST to NMVS on decommission; credential-gated; NMVS response stored in EPCIS event meta |
| Proper SGTIN encoding | `pharma_epcis.py` `_epc_urn()` `_reencode_epc()` | When `gs1_company_prefix` set, export re-encodes lite SGTINs to `urn:epc:id:sgtin:{cp}.{item_ref}.{sn}` |
| Approval policy UX | `Settings.tsx` | Removed duplicate `dual_sign_*` toggles; single table with approver-count select + live dual-sign badge; count change auto-syncs dual_sign boolean |
| VRS stub/live badge | `StageC.tsx` | Verify panel shows green "VRS live" / muted "Local registry" / red "VRS error" badge based on API response |
| POS batch/expiry defaults | `POSSearchGrid.tsx` `pos/index.tsx` | Batch No. and Expiry columns auto-enabled on first load when pharma is on |
| Regulatory integrations card | `Settings.tsx` | GS1 prefix, VRS endpoint+key, NMVS endpoint+key (EU-region gated); VRS/NMVS live/stub status badges |

---

## Overview API / UI contract

Keep exposing phases **0–8** from `GET /vendors/me/pharma/overview`. When Stage C work starts:

- Add phases **9** (`gdp`) and **10** (`track_trace`) with `status: planned | scaffold | partial | enforced`.
- Update phase **7** / **8** `note` strings as acceptance criteria land (Overview cards are the live status board).
- Phases **7** and **8** are `enforced` after Stages A and B.

Frontend: `vendor-web` Overview already renders `phases[]`; new ids automatically appear once the API returns them.

---

## Competitive positioning by stage

| Stage | Honest pitch | Do not claim |
|-------|--------------|--------------|
| **Now (0–10 / Stage C)** | Wholesale-ready with GDP lite + EPCIS export path | Drop-in TraceLink replacement without partner certifications |
| **After A** | GxP-ready SMB manufacturing with e-sign | Full Veeva QMS replacement |
| **After B** | Mid-market pharma ops + internal serialization | Trading-partner track-and-trace network |
| **After C** | Wholesale-ready with GDP lite + EPCIS export path | Drop-in TraceLink replacement without partner certifications |

---

## Out of scope (until explicitly pulled in)

- Full LIMS instrument integration  
- Environmental monitoring / cleanroom EMS  
- Stability study protocols  
- Supplier qualification / audit management suite  
- Formal CSV / IQ-OQ-PQ validation package for FDA inspection (sales can offer as services after Stage A)

---

## Code anchors

| Area | Path |
|------|------|
| Phase map (model) | `backend/app/models/pharma.py` |
| Overview phases payload | `backend/app/api/v1/vendor_pharma.py` → `GET .../overview` |
| Batch / FEFO / audit helpers | `backend/app/services/pharma_batch.py` |
| Vendor UI | `vendor-web/src/pages/pharma/*` |
| Tests | `backend/tests/test_pharma_module.py` |
