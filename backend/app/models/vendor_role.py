# app/models/vendor_role.py
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.database import Base


# Default permission definitions
ALL_PERMISSIONS = [
    "dashboard.view",
    "products.view", "products.create", "products.edit", "products.delete",
    "services.view", "services.create", "services.edit", "services.delete",
    "orders.view", "orders.manage",
    "customers.view", "customers.manage",
    "reviews.view", "reviews.reply",
    "settings.view", "settings.edit",
    "team.view", "team.invite", "team.manage",
    "roles.view", "roles.manage",
    # HR permissions
    "hr.view", "hr.manage",
    "hr.attendance",
    "hr.leave_approve",
    "hr.salary_view", "hr.salary_manage",
    "hr.payroll",
    "hr.offers",
    # Extended HR modules
    "hr.recruitment",
    "hr.onboarding",
    "hr.performance",
    "hr.compliance",
    "hr.training",
    "hr.ess.admin",
    # CRM permissions
    "crm.view",
    "crm.contacts.manage",
    "crm.leads.manage",
    "crm.deals.manage",
    "crm.activities.manage",
    "crm.tickets.manage",
    "crm.kb.manage",
    "crm.campaigns.manage",
    "crm.segments.manage",
    "crm.workflows.manage",
    "crm.integrations.manage",
    "crm.reports.view",
    "crm.audit.view",
    "crm.ai.use",
    "crm.chat.handle",
    # Finance permissions
    "finance.view",
    "finance.coa.manage",
    "finance.journal.create", "finance.journal.post",
    "finance.ar.manage",
    "finance.ap.manage",
    "finance.bank.manage", "finance.bank.reconcile",
    "finance.budget.manage",
    "finance.assets.manage",
    "finance.tax.manage", "finance.tax.file",
    "finance.controls.manage", "finance.controls.approve",
    "finance.capital.manage",
    "finance.reports.view",
    "finance.audit.view",
    # Sales commission (payees, plans, assignments, payouts)
    "commission.read",
    "commission.manage",
]

DEFAULT_ROLE_PERMISSIONS = {
    "owner": ALL_PERMISSIONS,
    "admin": [p for p in ALL_PERMISSIONS if p not in ("roles.manage",)],
    "manager": [
        "dashboard.view",
        "products.view", "products.create", "products.edit",
        "services.view", "services.create", "services.edit",
        "orders.view", "orders.manage",
        "customers.view", "customers.manage",
        "reviews.view", "reviews.reply",
        "settings.view",
        "team.view",
        # HR: can view employees, manage attendance, approve leaves
        "hr.view", "hr.attendance", "hr.leave_approve",
        "hr.recruitment", "hr.onboarding", "hr.performance",
        # CRM (full)
        "crm.view", "crm.contacts.manage", "crm.leads.manage",
        "crm.deals.manage", "crm.activities.manage", "crm.tickets.manage",
        "crm.kb.manage", "crm.campaigns.manage", "crm.segments.manage",
        "crm.workflows.manage", "crm.reports.view", "crm.ai.use",
        "crm.chat.handle",
        # Finance (view + budgets + reports)
        "finance.view", "finance.budget.manage",
        "finance.reports.view", "finance.controls.approve",
        # Commission (outlet managers often configure payees / assignments)
        "commission.read", "commission.manage",
    ],
    "sales": [
        "dashboard.view",
        "products.view",
        "services.view",
        "orders.view", "orders.manage",
        "customers.view", "customers.manage",
        "reviews.view",
        # CRM (sales-focused)
        "crm.view", "crm.contacts.manage", "crm.leads.manage",
        "crm.deals.manage", "crm.activities.manage", "crm.tickets.manage",
        "crm.reports.view",
        "crm.ai.use",
    ],
    "staff": [
        "dashboard.view",
        "products.view",
        "services.view",
        "orders.view",
        "customers.view",
        "reviews.view",
        # CRM (read-only-ish + log support tickets)
        "crm.view", "crm.activities.manage", "crm.tickets.manage", "crm.chat.handle",
    ],
    "support": [
        "dashboard.view",
        "customers.view",
        "reviews.view", "reviews.reply",
        "crm.view", "crm.contacts.manage", "crm.activities.manage",
        "crm.tickets.manage", "crm.kb.manage", "crm.chat.handle",
        "crm.reports.view",
    ],
    "marketing": [
        "dashboard.view",
        "products.view",
        "customers.view",
        "crm.view", "crm.contacts.manage", "crm.leads.manage",
        "crm.campaigns.manage", "crm.segments.manage",
        "crm.workflows.manage", "crm.reports.view", "crm.ai.use",
    ],
    "accountant": [
        "dashboard.view",
        "orders.view",
        "customers.view",
        # Full Finance access (no tax.file — owner-only action)
        "finance.view",
        "finance.coa.manage",
        "finance.journal.create", "finance.journal.post",
        "finance.ar.manage",
        "finance.ap.manage",
        "finance.bank.manage", "finance.bank.reconcile",
        "finance.budget.manage",
        "finance.assets.manage",
        "finance.tax.manage",
        "finance.controls.manage", "finance.controls.approve",
        "finance.capital.manage",
        "finance.reports.view",
        "finance.audit.view",
        "commission.read", "commission.manage",
    ],
}


class VendorRole(Base):
    __tablename__ = "vendor_role"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    slug = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    permissions = Column(JSONB, default=[], nullable=False)
    is_system = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    users = relationship("VendorUser", back_populates="custom_role", foreign_keys="VendorUser.role_id")
