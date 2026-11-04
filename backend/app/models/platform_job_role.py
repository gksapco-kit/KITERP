# app/models/platform_job_role.py
"""Custom (and catalog) job roles for platform support staff."""
from __future__ import annotations

import uuid

from sqlalchemy import Boolean, Column, DateTime, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.sql import func

from app.core.platform_modules import (
    DERIVED_MODULE_KEYS,
    module_grant,
    module_permission_keys,
    module_permission_labels,
)
from app.database import Base

# Permissions that can be granted on a custom platform job role.
#
# Admin panel areas listed here are the ones support staff can actually be given in the
# admin sidebar. Plans, All Templates, Disputes, Table Data, Settings, Support team,
# User Roles and Vendor App Builds are Super Admin only (enforced by the admin pages and
# API), so they are intentionally not grantable here.
#
# CRM / Finance / HR are granted per sub-module (``<module>.<slug>.view|manage``, see
# ``app.core.platform_modules``). ``admin.crm`` / ``admin.finance`` / ``admin.hr`` are
# derived from those and are not grantable themselves (legacy roles that only hold the
# module key are expanded to full access when resolved).
PLATFORM_ROLE_PERMISSIONS: list[str] = [
    # Admin panel areas
    "admin.dashboard",
    "admin.vendors",
    "admin.website_analytics",
    "admin.account_activity",
    # CRM / Finance / HR sub-modules
    *module_permission_keys(),
    # Business accounts / vendor store via admin
    # (Approve / reject / edit vendors is Super Admin only, so it is not grantable.)
    "vendors.create",
    "vendors.handoff",
    "vendors.scope_assigned",
    # Support hierarchy
    "staff.can_manage_team",
]

# Everything a Super Admin effectively holds (grantable keys + derived module keys).
ALL_PLATFORM_PERMISSIONS: list[str] = [
    *PLATFORM_ROLE_PERMISSIONS,
    *DERIVED_MODULE_KEYS.values(),
]

PLATFORM_ROLE_PERMISSION_LABELS: dict[str, str] = {
    "admin.dashboard": "Dashboard",
    "admin.vendors": "Business Accounts",
    "admin.website_analytics": "Website Analytics",
    "admin.account_activity": "Account activity",
    "admin.crm": "CRM Management",
    "admin.finance": "Finance Management",
    "admin.hr": "HR Management",
    **module_permission_labels(),
    "vendors.create": "Create business accounts",
    "vendors.handoff": "Open vendor store via admin handoff",
    "vendors.scope_assigned": "Only assigned vendor stores (RM-style)",
    "staff.can_manage_team": "Can be selected as team manager (Reports to)",
}

# Default permission sets for built-in job roles (not stored in DB).
SUPPORT_DEFAULT_PERMS: list[str] = [
    "admin.dashboard",
    "admin.vendors",
    "admin.website_analytics",
    "admin.account_activity",
    "admin.crm",
    "admin.finance",
    "admin.hr",
    "vendors.create",
    "vendors.handoff",
]

BUILTIN_PLATFORM_JOB_ROLE_DEFS: dict[str, dict] = {
    "sales": {
        "name": "Sales",
        "description": "Support staff focused on sales outreach and account follow-up.",
        "permissions": list(SUPPORT_DEFAULT_PERMS),
    },
    "crm": {
        "name": "CRM",
        "description": "Support staff working leads, contacts, and pipeline in platform CRM.",
        "permissions": list(SUPPORT_DEFAULT_PERMS),
    },
    "consulting": {
        "name": "Consulting",
        "description": "Default support job role for onboarding and consulting help.",
        "permissions": list(SUPPORT_DEFAULT_PERMS),
    },
    "relationship_manager": {
        "name": "Relationship manager",
        "description": "Account owner for assigned business accounts only.",
        "permissions": [
            "admin.dashboard",
            "admin.vendors",
            "admin.website_analytics",
            "admin.account_activity",
            "admin.crm",
            "admin.finance",
            "admin.hr",
            "vendors.handoff",
            "vendors.scope_assigned",
        ],
    },
    "team_manager": {
        "name": "Team manager",
        "description": "Manages reporting lines for other support users (Reports to).",
        "permissions": [
            *SUPPORT_DEFAULT_PERMS,
            "staff.can_manage_team",
        ],
    },
}

# Roles that only work inside one module: they can find a store (Business Accounts) and open
# it, and see/manage only the listed sub-modules of their module.
_MODULE_ROLE_BASE: list[str] = ["admin.dashboard", "admin.vendors", "vendors.handoff"]


def _module_role(name: str, description: str, permissions: list[str]) -> dict:
    return {
        "name": name,
        "description": description,
        "permissions": [*_MODULE_ROLE_BASE, *permissions],
    }


BUILTIN_PLATFORM_JOB_ROLE_DEFS.update(
    {
        # ── CRM ────────────────────────────────────────────────────────────
        "crm_manager": _module_role(
            "CRM Manager",
            "Full access to every CRM sub-module.",
            module_grant("crm", manage="all"),
        ),
        "crm_sales_executive": _module_role(
            "CRM Sales Executive",
            "Works contacts, leads, pipeline and tasks; read-only elsewhere in CRM.",
            module_grant(
                "crm",
                view=["dashboard", "reports", "payment-followups", "tickets", "kb",
                      "segments", "campaigns", "templates", "care-reminder", "number-ranges"],
                manage=["contacts", "leads", "pipeline", "activities", "ai"],
            ),
        ),
        "crm_support_agent": _module_role(
            "CRM Support Agent",
            "Handles tickets, knowledge base and customer contacts.",
            module_grant(
                "crm",
                view=["dashboard", "leads", "pipeline", "reports"],
                manage=["contacts", "tickets", "kb", "activities", "care-reminder"],
            ),
        ),
        "crm_marketing": _module_role(
            "CRM Marketing",
            "Segments, email templates, campaigns and workflows.",
            module_grant(
                "crm",
                view=["dashboard", "contacts", "leads", "reports"],
                manage=["segments", "templates", "campaigns", "workflows", "ai"],
            ),
        ),
        # ── Finance ────────────────────────────────────────────────────────
        "finance_controller": _module_role(
            "Finance Controller",
            "Full access to every Finance sub-module.",
            module_grant("finance", manage="all"),
        ),
        "finance_accountant": _module_role(
            "Accountant",
            "Day-to-day accounting; no posting controls or approvals.",
            module_grant(
                "finance",
                view=["dashboard", "trial-balance", "statement-versions", "profit-centers",
                      "fx-revaluation", "posting-rules", "parallel-ledgers", "field-rules",
                      "reports-pnl", "reports-balance-sheet", "reports-cash-flow",
                      "reports-cost-analysis", "reports-gl", "audit"],
                manage=["coa", "journal", "ar", "open-items", "ap", "bank", "assets",
                        "assets-reports", "assets-depreciation", "assets-gl-reconciliation",
                        "budgets", "tax", "periods"],
            ),
        ),
        "finance_viewer": _module_role(
            "Finance Viewer",
            "Read-only access to ledgers and financial reports.",
            module_grant(
                "finance",
                view=["dashboard", "coa", "journal", "trial-balance", "statement-versions",
                      "profit-centers", "parallel-ledgers", "reports-pnl",
                      "reports-balance-sheet", "reports-cash-flow", "reports-cost-analysis",
                      "reports-gl", "audit"],
            ),
        ),
        # ── HR ─────────────────────────────────────────────────────────────
        "hr_manager": _module_role(
            "HR Manager",
            "Full access to every HR sub-module.",
            module_grant("hr", manage="all"),
        ),
        "hr_recruiter": _module_role(
            "HR Recruiter",
            "Recruitment and onboarding; read-only employee directory.",
            module_grant(
                "hr",
                view=["employees", "departments", "designations"],
                manage=["recruitment", "onboarding"],
            ),
        ),
        "hr_payroll_officer": _module_role(
            "HR Payroll Officer",
            "Payroll, salary structures and attendance; read-only leave and employees.",
            module_grant(
                "hr",
                view=["employees", "leaves", "leave-policies", "holidays", "departments",
                      "designations"],
                manage=["payroll", "salary", "attendance", "attendance-report"],
            ),
        ),
    }
)


class PlatformJobRole(Base):
    """User-defined platform support job role (slug stored on user.platform_staff_job_role)."""

    __tablename__ = "platform_job_role"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    slug = Column(String(64), nullable=False, unique=True, index=True)
    description = Column(Text, nullable=True)
    permissions = Column(JSONB, default=list, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
