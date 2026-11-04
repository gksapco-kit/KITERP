"""The 24 real-estate modules and their sub-module tabs (drives sidebar hubs and tab bars).

A tab is either ``{"resource": key}`` (generic table + form), optionally with ``"filter"``
query defaults, or ``{"view": id}`` for a hand-built UI component. Tabs whose resource is not
registered are dropped by ``GET /meta`` so phases can ship incrementally.
"""


def R(resource: str, label: str, **extra) -> dict:
    return {"resource": resource, "label": label, **extra}


def V(view: str, label: str, **extra) -> dict:
    return {"view": view, "label": label, **extra}


MODULES: list[dict] = [
    {"id": "property", "no": 1, "title": "Property Management", "tabs": [
        R("projects", "Project Master"), R("phases", "Phases"), R("towers", "Towers"),
        R("unit-types", "Unit Types"), R("units", "Unit Inventory"), V("availability", "Availability"),
        R("price-lists", "Price Lists"), R("valuations", "Property Valuation"),
    ]},
    {"id": "land", "no": 2, "title": "Land Bank & Acquisition", "tabs": [
        V("land_summary", "Land Bank Overview"), R("land-parcels", "Land Parcels"), R("landowners", "Landowner Details"),
        R("title-checks", "Title Verification"), R("acquisitions", "Acquisition"),
        R("acquisition-payments", "Acquisition Payments"), R("jdas", "JDA / JV"),
    ]},
    {"id": "sales", "no": 3, "title": "Sales & CRM", "tabs": [
        R("leads", "Leads"), V("pipeline", "Sales Pipeline"), R("enquiries", "Enquiries"),
        R("site-visits", "Site Visits"), R("quotations", "Quotations"), R("followups", "Follow-ups"),
    ]},
    {"id": "booking", "no": 4, "title": "Booking & Allotment", "tabs": [
        R("unit-blocks", "Unit Blocking"), R("bookings", "Booking Forms"),
        R("booking-applicants", "Co-applicants"), R("allotments", "Allotment Letters"),
        R("cancellations", "Cancellation"), R("refunds", "Refunds"),
    ]},
    {"id": "customers", "no": 5, "title": "Customer Management", "tabs": [
        R("customers", "Customer Master"), R("kyc-documents", "KYC"), R("agreements", "Agreements"),
        R("communications", "Communication"), V("portal_access", "Customer Portal"),
    ]},
    {"id": "collections", "no": 6, "title": "Payment & Collections", "tabs": [
        R("payment-plans", "Payment Plans"), R("payment-plan-stages", "Plan Stages"),
        R("payment-schedule", "Installments"), R("demands", "Demand Letters"), R("receipts", "Receipts"),
        V("overdue", "Overdue Tracking"),
    ]},
    {"id": "leasing", "no": 7, "title": "Leasing & Rentals", "tabs": [
        V("leasing_overview", "Overview"), R("tenants", "Tenant Management"), R("leases", "Lease Agreements"), R("rent-invoices", "Rent Billing"),
        R("lease-escalations", "Escalations"), V("renewals", "Renewals"), R("ops-receipts", "Rent Receipts", filter={"kind": "rent"}),
    ]},
    {"id": "projectmgmt", "no": 8, "title": "Project Management", "tabs": [
        R("wbs", "WBS / Planning"), R("milestones", "Milestones"), V("gantt", "Scheduling"),
        R("project-budgets", "Budgets"), V("budget_vs_actual", "Budget vs Actual"),
    ]},
    {"id": "construction", "no": 9, "title": "Construction Management", "tabs": [
        R("site-progress", "Site Progress"), R("boq-items", "BOQ"), R("work-orders", "Work Orders"),
        R("quality-checks", "Quality"), R("safety-incidents", "Safety"), R("inspections", "Inspections"),
    ]},
    {"id": "procurement", "no": 10, "title": "Procurement", "tabs": [
        R("purchase-requisitions", "Purchase Requisitions"), R("pr-lines", "Requisition Lines"), R("rfqs", "RFQ"),
        R("rfq-quotes", "Supplier Quotes"), R("purchase-orders", "Purchase Orders"), R("po-lines", "PO Lines"),
        R("suppliers", "Vendor Management"),
    ]},
    {"id": "inventory", "no": 11, "title": "Material & Inventory", "tabs": [
        R("materials", "Material Master"), R("site-stores", "Site Stores"), R("grns", "GRN"), R("grn-lines", "GRN Lines"),
        V("stock_balance", "Stock Balance"), R("stock-ledger", "Stock Ledger"),
        R("material-issues", "Material Issue"), R("issue-lines", "Issue Lines"),
        R("stock-transfers", "Transfers"), R("transfer-lines", "Transfer Lines"), R("wastage", "Wastage"),
    ]},
    {"id": "contractors", "no": 12, "title": "Contractor Management", "tabs": [
        R("contractors", "Contractor Master"), R("subcontracts", "Subcontracts"),
        R("work-certificates", "Work Certification"), R("retention-ledger", "Retention"),
        R("work-certificates", "Final Bills", filter={"is_final": "true"}),
    ]},
    {"id": "finance", "no": 13, "title": "Finance & Accounting", "tabs": [
        V("finance_hub", "Finance Hub"), V("project_costing", "Project Costing"),
        V("receivables", "Receivables (AR)"), V("payables", "Payables (AP)"),
    ]},
    {"id": "tax", "no": 14, "title": "Tax & Compliance", "tabs": [
        R("tax-filings", "Statutory Reports"), R("tds-entries", "TDS 194-IA"),
        R("rera-entries", "RERA Account"), V("gst_summary", "GST"), V("rera_account", "RERA Compliance"),
        V("tax_reconciliation", "Tax Reconciliation"),
    ]},
    {"id": "legal", "no": 15, "title": "Legal & Documentation", "tabs": [
        R("title-checks", "Land Titles"), R("statutory-approvals", "Approvals"), V("approvals_tracker", "Approval Readiness"),
        R("agreements", "Sale Deeds", filter={"agreement_type": "sale_deed"}),
        R("agreements", "Lease Deeds", filter={"agreement_type": "lease_deed"}),
        R("documents", "Digital Documents"),
    ]},
    {"id": "brokers", "no": 16, "title": "Broker Management", "tabs": [
        R("brokers", "Channel Partners"), R("leads", "Broker Leads", filter={"broker_id__notnull": "1"}),
        R("commission-rules", "Commission Rules"), R("commissions", "Commissions"),
        R("incentives", "Incentives"), R("settlements", "Settlements"),
    ]},
    {"id": "handover", "no": 17, "title": "Handover & Possession", "tabs": [
        R("handovers", "Handover Checklist"), R("snags", "Snag List"),
    ]},
    {"id": "care", "no": 18, "title": "Customer Care", "tabs": [
        V("care_summary", "SLA & Satisfaction"), R("tickets", "Complaints & Requests"), R("ticket-comments", "Conversations"),
        R("warranties", "Defect Liability & Warranty"), R("feedback", "Feedback"),
    ]},
    {"id": "facility", "no": 19, "title": "Facility Management", "tabs": [
        V("facility_overview", "Overview"), R("facility-work-orders", "Work Orders"), R("pm-schedules", "Preventive Maintenance"),
        R("utility-meters", "Utilities"), R("meter-readings", "Meter Readings"),
        R("housekeeping", "Housekeeping"), R("security-logs", "Security"),
    ]},
    {"id": "society", "no": 20, "title": "Society Management", "tabs": [
        V("society_overview", "Overview"), R("residents", "Residents"), R("maintenance-plans", "Maintenance Charges"),
        R("maintenance-bills", "Maintenance Billing"), R("ops-receipts", "Maintenance Receipts", filter={"kind": "maintenance"}), R("visitors", "Visitor Management"),
        R("notices", "Community Notices"),
    ]},
    {"id": "assets", "no": 21, "title": "Asset Management", "tabs": [
        V("assets_overview", "Overview"), R("assets", "Equipment Register"), R("asset-maintenance", "Maintenance"),
        R("asset-transfers", "Transfers"), R("asset-disposals", "Disposal"),
    ]},
    {"id": "workforce", "no": 22, "title": "HR & Workforce", "tabs": [
        V("workforce_overview", "Overview"), R("site-assignments", "Employees on Site"), R("labour", "Site Labour"),
        R("labour-attendance", "Attendance"), R("wage-sheets", "Payroll"),
    ]},
    {"id": "reports", "no": 23, "title": "Reports & Analytics", "tabs": [
        V("sales_mis", "Sales MIS"), V("collection_report", "Collection Reports"),
        V("project_costing_report", "Project Costing"), V("occupancy", "Occupancy"),
        V("profitability", "Profitability"), V("inventory_ageing", "Inventory Ageing"),
    ]},
    {"id": "admin", "no": 24, "title": "Administration", "tabs": [
        V("access_control", "Roles & Permissions"), R("approval-rules", "Approval Workflows"),
        R("approval-requests", "Approvals Inbox"), R("audit-logs", "Audit Logs"),
        V("alerts", "Notifications"), R("integrations", "Integrations"), R("number-ranges", "Number Ranges"),
        R("templates", "Templates"), V("print_templates", "Print Templates"),
        R("gl-failures", "GL Posting Issues"), R("automation-settings", "Automation"),
    ]},
]
