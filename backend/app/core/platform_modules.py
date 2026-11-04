# app/core/platform_modules.py
"""Module / sub-module permission catalog for platform support job roles.

The admin app's CRM, Finance and HR areas are vendor-web screens opened through the
store handoff. Their API endpoints are already guarded by vendor permission keys
(``crm.leads.manage``, ``finance.ar.manage``, ``hr.payroll`` ...). This catalog:

* defines one platform permission per sub-module (``<module>.<slug>.view`` and
  ``<module>.<slug>.manage``) so job roles can be configured sub-module by sub-module;
* maps each platform permission to the vendor keys that must be granted to the
  handoff session so the *server* enforces the same limits (see ``vendor_permissions_for``).

Sub-module modes
----------------
* ``view_manage`` - separate View and Manage keys.
* ``access``      - one key (``.manage``). The API requires the manage key even to read
                    (e.g. Accounts Receivable), so a true view-only grant is impossible.
* ``view_only``   - one key (``.view``); the screen has no write operations (e.g. reports).

Slugs must match the admin sidebar slugs in ``frontend/src/lib/{crm,finance,hr}AdminNav.ts``.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Optional

MODULE_ORDER: tuple[str, ...] = ("crm", "finance", "hr")

# Stored in ``VendorUser.permissions`` for support-staff handoff sessions that must be
# limited to their job role's modules. Without it a ``platform_staff`` session is full-access
# (superusers and sessions created before this feature).
PLATFORM_SCOPED_MARKER = "platform.scoped"

MODE_VIEW_MANAGE = "view_manage"
MODE_ACCESS = "access"
MODE_VIEW_ONLY = "view_only"


@dataclass(frozen=True)
class SubModule:
    module: str
    slug: str
    label: str
    mode: str
    # Vendor permission keys granted by View (or by the single key for view_only).
    view: tuple[str, ...] = ()
    # Vendor permission keys granted by Manage (all keys for ``access`` mode).
    manage: tuple[str, ...] = ()

    @property
    def view_key(self) -> Optional[str]:
        return f"{self.module}.{self.slug}.view" if self.mode != MODE_ACCESS else None

    @property
    def manage_key(self) -> Optional[str]:
        return f"{self.module}.{self.slug}.manage" if self.mode != MODE_VIEW_ONLY else None


def _vm(module: str, slug: str, label: str, view: Iterable[str], manage: Iterable[str]) -> SubModule:
    return SubModule(module, slug, label, MODE_VIEW_MANAGE, tuple(view), tuple(manage))


def _ac(module: str, slug: str, label: str, keys: Iterable[str]) -> SubModule:
    return SubModule(module, slug, label, MODE_ACCESS, (), tuple(keys))


def _vo(module: str, slug: str, label: str, view: Iterable[str]) -> SubModule:
    return SubModule(module, slug, label, MODE_VIEW_ONLY, tuple(view), ())


MODULE_LABELS: dict[str, str] = {
    "crm": "CRM Management",
    "finance": "Finance Management",
    "hr": "HR Management",
}

_CRM_VIEW = ("crm.view",)

SUBMODULES: tuple[SubModule, ...] = (
    # ── CRM ────────────────────────────────────────────────────────────────
    _vo("crm", "dashboard", "CRM Dashboard", _CRM_VIEW),
    _vm("crm", "contacts", "Contacts", _CRM_VIEW, ("crm.contacts.manage",)),
    _vm("crm", "leads", "Leads", _CRM_VIEW, ("crm.leads.manage",)),
    _vm("crm", "linkedin", "LinkedIn", _CRM_VIEW, ()),
    _vm("crm", "pipeline", "Pipeline", _CRM_VIEW, ("crm.deals.manage",)),
    _vm("crm", "activities", "Tasks", _CRM_VIEW, ("crm.activities.manage",)),
    _vm("crm", "tickets", "Tickets", _CRM_VIEW, ("crm.tickets.manage",)),
    _vm("crm", "kb", "Knowledge Base", _CRM_VIEW, ("crm.kb.manage",)),
    _vm("crm", "segments", "Segments", _CRM_VIEW, ("crm.segments.manage",)),
    _vm("crm", "templates", "Email Templates", _CRM_VIEW, ("crm.campaigns.manage",)),
    _vm("crm", "campaigns", "Campaigns", _CRM_VIEW, ("crm.campaigns.manage",)),
    _vm("crm", "care-reminder", "Care & Reminders", _CRM_VIEW, ("crm.contacts.manage",)),
    _vm("crm", "workflows", "Workflows", _CRM_VIEW, ("crm.workflows.manage",)),
    _ac("crm", "ai", "AI Insights", ("crm.view", "crm.ai.use")),
    _vo("crm", "reports", "CRM Reports", ("crm.view", "crm.reports.view")),
    _vo("crm", "audit", "Audit Log", ("crm.view", "crm.audit.view")),
    _vm("crm", "number-ranges", "Number Ranges", _CRM_VIEW, ("crm.leads.manage",)),
    _vm("crm", "payment-followups", "Payment Follow-ups", _CRM_VIEW, ("crm.contacts.manage",)),
    # ── Finance ────────────────────────────────────────────────────────────
    _vo("finance", "dashboard", "Finance Dashboard", ("finance.view",)),
    _vm("finance", "coa", "Chart of Accounts", ("finance.view",), ("finance.coa.manage",)),
    _vm("finance", "journal", "Journal Entries", ("finance.view",),
        ("finance.journal.create", "finance.journal.post")),
    _vo("finance", "trial-balance", "Trial Balance", ("finance.view", "finance.reports.view")),
    _vm("finance", "statement-versions", "Statement Versions (FSV)", ("finance.view",),
        ("finance.coa.manage",)),
    _ac("finance", "posting-controls", "Posting Controls",
        ("finance.view", "finance.controls.manage")),
    _vm("finance", "profit-centers", "Profit Centers & Segments",
        ("finance.view", "finance.reports.view"), ("finance.coa.manage",)),
    _vm("finance", "fx-revaluation", "FX Reval & Year-End Close", ("finance.view",),
        ("finance.coa.manage", "finance.journal.post")),
    _vm("finance", "posting-rules", "Posting Rules & Number Ranges", ("finance.view",),
        ("finance.coa.manage",)),
    _vm("finance", "parallel-ledgers", "Parallel Ledgers / Multi-GAAP", ("finance.view",),
        ("finance.coa.manage",)),
    _ac("finance", "periods", "Posting Periods", ("finance.view", "finance.coa.manage")),
    _vm("finance", "field-rules", "GL Field Rules", ("finance.view",), ("finance.coa.manage",)),
    _ac("finance", "ar", "Accounts Receivable", ("finance.view", "finance.ar.manage")),
    _ac("finance", "open-items", "Open-Item Clearing", ("finance.view", "finance.ar.manage")),
    _ac("finance", "ap", "Accounts Payable", ("finance.view", "finance.ap.manage")),
    _ac("finance", "bank", "Bank & Cash",
        ("finance.view", "finance.bank.manage", "finance.bank.reconcile")),
    _ac("finance", "assets", "Fixed Assets", ("finance.view", "finance.assets.manage")),
    _ac("finance", "assets-reports", "Asset Register", ("finance.view", "finance.assets.manage")),
    _ac("finance", "assets-depreciation", "Depreciation Schedule",
        ("finance.view", "finance.assets.manage")),
    _ac("finance", "assets-gl-reconciliation", "GL Reconciliation",
        ("finance.view", "finance.assets.manage")),
    _ac("finance", "budgets", "Budgets & Forecasts", ("finance.view", "finance.budget.manage")),
    _ac("finance", "capital", "Loans & Investments", ("finance.view", "finance.capital.manage")),
    _vo("finance", "reports-pnl", "P&L Statement", ("finance.view", "finance.reports.view")),
    _vo("finance", "reports-balance-sheet", "Balance Sheet",
        ("finance.view", "finance.reports.view")),
    _vo("finance", "reports-cash-flow", "Cash Flow", ("finance.view", "finance.reports.view")),
    _vo("finance", "reports-cost-analysis", "Cost Analysis",
        ("finance.view", "finance.reports.view")),
    _vo("finance", "reports-gl", "GL Line Item Report", ("finance.view", "finance.reports.view")),
    _ac("finance", "approvals", "Approvals", ("finance.view", "finance.controls.approve")),
    _vo("finance", "audit", "Audit Log", ("finance.view", "finance.audit.view")),
    # Tax filing (finance.tax.file) stays owner-only and is never granted to support staff.
    _ac("finance", "tax", "Tax Returns",
        ("finance.view", "finance.tax.view", "finance.tax.manage")),
    # ── HR ─────────────────────────────────────────────────────────────────
    _vm("hr", "employees", "Employees", ("hr.view",), ("hr.manage",)),
    _ac("hr", "attendance", "Attendance", ("hr.view", "hr.attendance")),
    _ac("hr", "attendance-report", "Attendance Report", ("hr.view", "hr.attendance")),
    _ac("hr", "tracking", "Field Tracking", ("hr.view", "hr.attendance")),
    _vm("hr", "leaves", "Leave Requests", ("hr.view",), ("hr.leave_approve",)),
    _vm("hr", "leave-policies", "Leave Policies", ("hr.view",), ("hr.manage",)),
    _vm("hr", "holidays", "Holidays", ("hr.view",), ("hr.manage",)),
    _vm("hr", "recruitment", "Recruitment (incl. Careers)", ("hr.view",), ("hr.recruitment",)),
    _vm("hr", "onboarding", "Onboarding", ("hr.view",), ("hr.onboarding",)),
    _vm("hr", "performance", "Performance", ("hr.view",), ("hr.performance",)),
    _vm("hr", "training", "Training", ("hr.view",), ("hr.training",)),
    _vm("hr", "compliance", "Compliance", ("hr.view",), ("hr.compliance",)),
    _vm("hr", "announcements", "Announcements", ("hr.view",), ("hr.ess.admin",)),
    _vm("hr", "expenses", "Expense Claims", ("hr.view",), ("hr.ess.admin",)),
    _vm("hr", "helpdesk", "Helpdesk", ("hr.view",), ("hr.ess.admin",)),
    _ac("hr", "payroll", "Payroll", ("hr.view", "hr.payroll")),
    _vm("hr", "salary", "Salary Structures", ("hr.view", "hr.salary_view"), ("hr.salary_manage",)),
    _ac("hr", "offers", "Offer Letters", ("hr.view", "hr.offers")),
    _vm("hr", "departments", "Departments", ("hr.view",), ("hr.manage",)),
    _vm("hr", "designations", "Designations", ("hr.view",), ("hr.manage",)),
)

SUBMODULES_BY_MODULE: dict[str, tuple[SubModule, ...]] = {
    m: tuple(s for s in SUBMODULES if s.module == m) for m in MODULE_ORDER
}
_SUB_BY_KEY: dict[str, SubModule] = {}
for _s in SUBMODULES:
    if _s.view_key:
        _SUB_BY_KEY[_s.view_key] = _s
    if _s.manage_key:
        _SUB_BY_KEY[_s.manage_key] = _s

# Module-level "can open this admin area" keys. Derived from sub-module grants (not grantable).
DERIVED_MODULE_KEYS: dict[str, str] = {m: f"admin.{m}" for m in MODULE_ORDER}

_MODULE_PREFIXES: tuple[str, ...] = tuple(f"{m}." for m in MODULE_ORDER)


def is_vendor_module_permission(key: str) -> bool:
    """True for vendor keys that belong to the CRM / Finance / HR modules."""
    return key.startswith(_MODULE_PREFIXES)


def module_permission_keys() -> list[str]:
    """Every grantable module permission key, in catalog order."""
    keys: list[str] = []
    for s in SUBMODULES:
        if s.view_key:
            keys.append(s.view_key)
        if s.manage_key:
            keys.append(s.manage_key)
    return keys


def module_permission_labels() -> dict[str, str]:
    labels: dict[str, str] = {}
    for s in SUBMODULES:
        if s.mode == MODE_VIEW_MANAGE:
            labels[s.view_key] = f"{MODULE_LABELS[s.module]} · {s.label} (view)"
            labels[s.manage_key] = f"{MODULE_LABELS[s.module]} · {s.label} (manage)"
        elif s.mode == MODE_ACCESS:
            labels[s.manage_key] = f"{MODULE_LABELS[s.module]} · {s.label} (access)"
        else:
            labels[s.view_key] = f"{MODULE_LABELS[s.module]} · {s.label} (view)"
    return labels


def module_structure() -> list[dict]:
    """Structure for the User Roles screen (module → sub-module rows)."""
    out: list[dict] = []
    for m in MODULE_ORDER:
        out.append(
            {
                "module": m,
                "label": MODULE_LABELS[m],
                "submodules": [
                    {
                        "slug": s.slug,
                        "label": s.label,
                        "mode": s.mode,
                        "view_key": s.view_key,
                        "manage_key": s.manage_key,
                    }
                    for s in SUBMODULES_BY_MODULE[m]
                ],
            }
        )
    return out


def _all_keys_for_module(module: str) -> list[str]:
    keys: list[str] = []
    for s in SUBMODULES_BY_MODULE[module]:
        if s.view_key:
            keys.append(s.view_key)
        if s.manage_key:
            keys.append(s.manage_key)
    return keys


def module_grant(
    module: str,
    *,
    view: "str | Iterable[str]" = (),
    manage: "str | Iterable[str]" = (),
) -> list[str]:
    """Build platform keys for a module. ``"all"`` selects every sub-module.

    ``view`` slugs that are ``access``-mode are granted via their manage key. ``manage``
    slugs imply view. Unknown slugs raise so typos in role definitions fail loudly.
    """
    subs = {s.slug: s for s in SUBMODULES_BY_MODULE[module]}
    view_slugs = list(subs) if view == "all" else list(view)
    manage_slugs = list(subs) if manage == "all" else list(manage)
    keys: list[str] = []
    for slug in view_slugs + manage_slugs:
        s = subs[slug]  # KeyError on typos
        is_manage = slug in manage_slugs
        if s.mode == MODE_ACCESS:
            keys.append(s.manage_key)
        elif s.mode == MODE_VIEW_ONLY:
            keys.append(s.view_key)
        else:
            keys.append(s.view_key)
            if is_manage:
                keys.append(s.manage_key)
    return list(dict.fromkeys(keys))


def expand_platform_permissions(perms: Iterable[str]) -> list[str]:
    """Normalise a stored permission list into the effective platform permissions.

    * Legacy ``admin.crm`` / ``admin.finance`` / ``admin.hr`` with no sub-module keys of that
      module expands to full access (this is what those roles effectively had before).
    * Manage implies view.
    * ``admin.<module>`` is derived: present only if at least one sub-module is viewable.
    """
    s = set(perms or [])
    for module in MODULE_ORDER:
        admin_key = DERIVED_MODULE_KEYS[module]
        has_sub_keys = any(k.startswith(f"{module}.") and k in _SUB_BY_KEY for k in s)
        if admin_key in s and not has_sub_keys:
            s.update(_all_keys_for_module(module))
    for sub in SUBMODULES:
        if sub.mode == MODE_VIEW_MANAGE and sub.manage_key in s:
            s.add(sub.view_key)
    for module in MODULE_ORDER:
        admin_key = DERIVED_MODULE_KEYS[module]
        viewable = any(
            (sub.view_key in s) if sub.mode != MODE_ACCESS else (sub.manage_key in s)
            for sub in SUBMODULES_BY_MODULE[module]
        )
        if viewable:
            s.add(admin_key)
        else:
            s.discard(admin_key)
    return sorted(s)


def vendor_permissions_for(platform_perms: Iterable[str]) -> list[str]:
    """Vendor-web permission keys a support user's store-handoff session may use."""
    s = set(expand_platform_permissions(platform_perms))
    granted: list[str] = []
    for sub in SUBMODULES:
        viewable = (
            (sub.view_key in s) if sub.mode != MODE_ACCESS else (sub.manage_key in s)
        )
        if not viewable:
            continue
        if sub.mode in (MODE_VIEW_MANAGE, MODE_VIEW_ONLY):
            granted.extend(sub.view)
        if sub.manage_key and sub.manage_key in s:
            granted.extend(sub.manage)
    return list(dict.fromkeys(granted))


def can_access_submodule(platform_perms: Iterable[str], module: str, slug: str) -> bool:
    s = set(platform_perms or [])
    return f"{module}.{slug}.view" in s or f"{module}.{slug}.manage" in s
