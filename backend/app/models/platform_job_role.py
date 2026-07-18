# app/models/platform_job_role.py
"""Custom (and catalog) job roles for platform support staff."""
from __future__ import annotations

import uuid

from sqlalchemy import Boolean, Column, DateTime, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.sql import func

from app.database import Base

# Permissions that can be granted on a custom platform job role.
PLATFORM_ROLE_PERMISSIONS: list[str] = [
    # Admin panel areas
    "admin.dashboard",
    "admin.vendors",
    "admin.website_analytics",
    "admin.account_activity",
    "admin.crm",
    "admin.plans",
    "admin.templates",
    "admin.disputes",
    "admin.table_data",
    "admin.settings",
    # Business accounts / vendor store via admin
    "vendors.create",
    "vendors.approve",
    "vendors.handoff",
    "vendors.scope_assigned",
    # Support hierarchy
    "staff.can_manage_team",
]

PLATFORM_ROLE_PERMISSION_LABELS: dict[str, str] = {
    "admin.dashboard": "Dashboard",
    "admin.vendors": "Business Accounts",
    "admin.website_analytics": "Website Analytics",
    "admin.account_activity": "Account activity",
    "admin.crm": "CRM",
    "admin.plans": "Plans",
    "admin.templates": "All Templates",
    "admin.disputes": "Disputes",
    "admin.table_data": "Table Data",
    "admin.settings": "Settings",
    "vendors.create": "Create business accounts",
    "vendors.approve": "Approve / reject vendors",
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
