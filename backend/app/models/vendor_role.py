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
    # Catalog
    "products.view", "products.create", "products.edit", "products.delete",
    "services.view", "services.create", "services.edit", "services.delete",
    # Sales & billing
    "orders.view", "orders.manage",
    "quotations.view", "quotations.manage",
    "bookings.view", "bookings.manage",
    "pos.view", "pos.manage", "pos.refund",
    "invoices.view", "invoices.manage",
    "memos.view", "memos.manage",
    "coupons.view", "coupons.manage",
    "subscriptions.view", "subscriptions.manage",
    "rentals.view", "rentals.manage",
    "production.view", "production.manage",
    "pharma.view", "pharma.manage", "pharma.release", "pharma.audit",
    "pharma.quality.manage", "pharma.deviation.manage",
    # Project management
    "projects.view", "projects.manage",
    # Customers & reviews
    "customers.view", "customers.manage",
    "reviews.view", "reviews.reply",
    # Inventory, procurement & master data
    "inventory.view", "inventory.manage",
    "procurement.view", "procurement.manage",
    "procurement.requisition.approve",
    "procurement.po.approve",
    "procurement.gr.post",
    "procurement.invoice.verify",
    "masterdata.view", "masterdata.manage",
    # Merchandising & loyalty
    "merchandising.view", "merchandising.manage",
    "loyalty.view", "loyalty.manage",
    # Restaurant operations
    "restaurant.view",
    "restaurant.floor",
    "restaurant.kitchen",
    "restaurant.reservations",
    "restaurant.reports",
    "restaurant.setup",
    # Commission
    "commission.read",
    "commission.manage",
    # Reports hub
    "reports.view",
    # Website builder
    "websites.view", "websites.manage",
    # Settings & access control
    "settings.view", "settings.edit",
    "team.view", "team.invite", "team.manage",
    "roles.view", "roles.manage",
    # Controlling (CO)
    "controlling.view",
    "controlling.costcenter.manage",
    "controlling.period_close",
    "controlling.variance.view",
    # Documents & system administration
    "documents.templates.manage",
    "system.modules",
    # HR permissions
    "hr.view", "hr.manage",
    "hr.attendance",
    "hr.leave_approve",
    "hr.salary_view", "hr.salary_manage",
    "hr.payroll",
    "hr.offers",
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
    "finance.edit",
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
]

DEFAULT_ROLE_PERMISSIONS = {
    "owner": ALL_PERMISSIONS,
    "admin": [p for p in ALL_PERMISSIONS if p not in ("roles.manage",)],
    "manager": [
        "dashboard.view",
        "products.view", "products.create", "products.edit",
        "services.view", "services.create", "services.edit",
        "orders.view", "orders.manage",
        "quotations.view", "quotations.manage",
        "bookings.view", "bookings.manage",
        "pos.view", "pos.manage", "pos.refund",
        "invoices.view", "invoices.manage",
        "memos.view", "memos.manage",
        "coupons.view", "coupons.manage",
        "subscriptions.view", "subscriptions.manage",
        "rentals.view", "rentals.manage",
        "production.view", "production.manage",
        # pharma.release and pharma.audit require qa_officer — managers get view+manage only
        "pharma.view", "pharma.manage",
        "projects.view", "projects.manage",
        "customers.view", "customers.manage",
        "reviews.view", "reviews.reply",
        "inventory.view", "inventory.manage",
        "procurement.view", "procurement.manage",
        "procurement.requisition.approve", "procurement.po.approve",
        "masterdata.view", "masterdata.manage",
        "merchandising.view", "merchandising.manage",
        "loyalty.view", "loyalty.manage",
        "reports.view",
        "settings.view",
        "team.view",
        # HR: outlet managers — attendance, leave, recruitment pipeline
        "hr.view", "hr.attendance", "hr.leave_approve",
        "hr.recruitment", "hr.onboarding", "hr.performance",
        # CRM (full)
        "crm.view", "crm.contacts.manage", "crm.leads.manage",
        "crm.deals.manage", "crm.activities.manage", "crm.tickets.manage",
        "crm.kb.manage", "crm.campaigns.manage", "crm.segments.manage",
        "crm.workflows.manage", "crm.reports.view", "crm.ai.use",
        "crm.chat.handle",
        # Finance (view + budgets + reports + CO read + controlling approvals)
        "finance.view", "finance.edit", "finance.budget.manage",
        "finance.reports.view", "finance.controls.approve",
        "controlling.view", "controlling.variance.view",
        # Commission
        "commission.read", "commission.manage",
        # Restaurant + POS
        "restaurant.view", "restaurant.floor", "restaurant.kitchen",
        "restaurant.reservations", "restaurant.reports", "restaurant.setup",
        # Website builder
        "websites.view", "websites.manage",
    ],
    "sales": [
        "dashboard.view",
        "products.view",
        "services.view",
        "orders.view", "orders.manage",
        "quotations.view", "quotations.manage",
        "bookings.view", "bookings.manage",
        "pos.view", "pos.manage",
        "invoices.view",
        "coupons.view",
        "subscriptions.view",
        "customers.view", "customers.manage",
        "reviews.view", "reviews.reply",
        "reports.view",
        # CRM (sales-focused)
        "crm.view", "crm.contacts.manage", "crm.leads.manage",
        "crm.deals.manage", "crm.activities.manage", "crm.tickets.manage",
        "crm.reports.view",
        "crm.ai.use",
        # Commission (read own accruals)
        "commission.read",
        # Restaurant floor staff often take orders
        "restaurant.view", "restaurant.floor",
    ],
    "staff": [
        "dashboard.view",
        "products.view",
        "services.view",
        "orders.view",
        "quotations.view",
        "bookings.view",
        "projects.view",
        "pos.view",
        "inventory.view",
        "customers.view",
        "reviews.view",
        # CRM (read-only-ish + log support tickets)
        "crm.view", "crm.activities.manage", "crm.tickets.manage", "crm.chat.handle",
        # Restaurant kitchen / floor
        "restaurant.view", "restaurant.floor", "restaurant.kitchen",
    ],
    "support": [
        "dashboard.view",
        "orders.view",
        "customers.view",
        "reviews.view", "reviews.reply",
        "bookings.view",
        "crm.view", "crm.contacts.manage", "crm.activities.manage",
        "crm.tickets.manage", "crm.kb.manage", "crm.chat.handle",
        "crm.reports.view",
    ],
    "marketing": [
        "dashboard.view",
        "products.view",
        "customers.view",
        "coupons.view", "coupons.manage",
        "merchandising.view", "merchandising.manage",
        "loyalty.view", "loyalty.manage",
        "websites.view", "websites.manage",
        "reports.view",
        "crm.view", "crm.contacts.manage", "crm.leads.manage",
        "crm.campaigns.manage", "crm.segments.manage",
        "crm.workflows.manage", "crm.reports.view", "crm.ai.use",
    ],
    "cashier": [
        "dashboard.view",
        "products.view",
        "orders.view",
        "quotations.view",
        "pos.view", "pos.manage",
        "invoices.view",
        "inventory.view",
        "customers.view",
        "restaurant.view", "restaurant.floor",
    ],
    "technician": [
        "dashboard.view",
        "bookings.view", "bookings.manage",
        "services.view",
        "customers.view",
        "orders.view",
        "inventory.view",
    ],
    "delivery_staff": [
        "dashboard.view",
        "orders.view", "orders.manage",
        "customers.view",
    ],
    "accountant": [
        "dashboard.view",
        "orders.view",
        "customers.view",
        "invoices.view", "invoices.manage",
        "memos.view", "memos.manage",
        "procurement.view", "procurement.invoice.verify",
        "reports.view",
        # Full Finance access (no tax.file — owner-only action)
        "finance.view", "finance.edit",
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
    # ── New specialist roles ─────────────────────────────────────────────────
    "warehouse": [
        "dashboard.view",
        "inventory.view", "inventory.manage",
        "procurement.view", "procurement.gr.post",
        "masterdata.view",
        "products.view",
        "orders.view",
        "reports.view",
    ],
    "purchaser": [
        "dashboard.view",
        "procurement.view", "procurement.manage",
        "procurement.requisition.approve",
        "procurement.po.approve",
        "procurement.gr.post",
        "masterdata.view", "masterdata.manage",
        "inventory.view",
        "products.view",
        "invoices.view",
        "reports.view",
    ],
    "production_planner": [
        "dashboard.view",
        "production.view", "production.manage",
        "inventory.view", "inventory.manage",
        "procurement.view", "procurement.manage",
        "procurement.gr.post",
        "masterdata.view",
        "products.view",
        "reports.view",
    ],
    # QA officer owns the pharma release/audit gate (intentionally removed from manager)
    "qa_officer": [
        "dashboard.view",
        "pharma.view", "pharma.manage",
        "pharma.release", "pharma.audit",
        "pharma.quality.manage", "pharma.deviation.manage",
        "inventory.view",
        "masterdata.view",
        "reports.view",
    ],
    "hr_manager": [
        "dashboard.view",
        "hr.view", "hr.manage",
        "hr.attendance", "hr.leave_approve",
        "hr.salary_view", "hr.salary_manage",
        "hr.payroll",
        "hr.offers",
        "hr.recruitment", "hr.onboarding",
        "hr.performance", "hr.compliance",
        "hr.training", "hr.ess.admin",
        "team.view",
        "reports.view",
    ],
    "project_manager": [
        "dashboard.view",
        "projects.view", "projects.manage",
        "team.view",
        "customers.view",
        "reports.view",
        "crm.view", "crm.activities.manage",
    ],
    "restaurant_manager": [
        "dashboard.view",
        "restaurant.view", "restaurant.floor", "restaurant.kitchen",
        "restaurant.reservations", "restaurant.reports", "restaurant.setup",
        "pos.view", "pos.manage", "pos.refund",
        "orders.view", "orders.manage",
        "invoices.view",
        "inventory.view", "inventory.manage",
        "customers.view",
        "team.view",
        "reports.view",
        "commission.read",
        "finance.view", "finance.reports.view",
    ],
    "waiter": [
        "dashboard.view",
        "restaurant.view", "restaurant.floor", "restaurant.reservations",
        "orders.view", "orders.manage",
        "pos.view", "pos.manage",
        "customers.view",
    ],
    "kitchen_staff": [
        "dashboard.view",
        "restaurant.view", "restaurant.kitchen",
        "orders.view",
        "inventory.view",
    ],
    "finance_controller": [
        "dashboard.view",
        "finance.view", "finance.edit",
        "finance.coa.manage",
        "finance.journal.create", "finance.journal.post",
        "finance.ar.manage", "finance.ap.manage",
        "finance.bank.manage", "finance.bank.reconcile",
        "finance.budget.manage",
        "finance.assets.manage",
        "finance.tax.manage", "finance.tax.file",
        "finance.controls.manage", "finance.controls.approve",
        "finance.capital.manage",
        "finance.reports.view",
        "finance.audit.view",
        "controlling.view", "controlling.costcenter.manage",
        "controlling.period_close", "controlling.variance.view",
        "reports.view",
        "procurement.view", "procurement.invoice.verify",
    ],
    # Issued only via admin → vendor-web handoff; not inviteable from team UI.
    "platform_staff": ALL_PERMISSIONS,
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
