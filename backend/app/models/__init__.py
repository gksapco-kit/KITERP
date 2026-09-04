# app/models/__init__.py
from app.models.user import User
from app.models.vendor import Vendor, VendorDocument, VendorBankAccount, VendorOwner
from app.models.vendor_rm_query import VendorRmQuery
from app.models.user_contact_change_request import UserContactChangeRequest
from app.models.vendor_user import VendorUser
from app.models.vendor_role import VendorRole
from app.models.vendor_product import Product, ProductVariant, ProductImage, ProductPriceRule, ProductModifierGroup, ProductModifierOption
from app.models.product_config import ProductConfigAttribute, ProductConfigOption, ProductConfigRule
from app.models.vendor_service import Service, ServiceAvailability, ServicePlan, ServiceBOMItem, ServiceResource
from app.models.vendor_plan import VendorPlan
from app.models.customer import Customer
from app.models.cart import Cart
from app.models.wishlist import Wishlist
from app.models.customer_subscription import CustomerSubscription
from app.models.order import (
    Order, OrderStatusHistory, OrderLine, OrderLineSchedule,
    OrderDelivery, DeliveryLine, OrderPartner, OrderPricingCondition,
)
from app.models.payment import Payment
from app.models.review import Review
from app.models.inventory import InventoryMovement
from app.models.inventory_count import StockCount, StockCountLine
from app.models.stock_transfer_order import StockTransferOrder, StockTransferOrderLine
from app.models.stock_cost_layer import StockCostLayer
from app.models.vendor_app_build import VendorAppBuild
from app.models.pos import POSSession, POSTransaction
from app.models.restaurant import (
    RestaurantZone, RestaurantTable, RestaurantOrder, RestaurantKOT, RestaurantReservation,
    RestaurantMenu, RestaurantMenuCategory, RestaurantMenuZoneLink,
)
from app.models.invoice import Invoice
from app.models.coupon import Coupon, CouponUsage
from app.models.lead import Lead, Quote
from app.models.rental import (
    RentalAsset, RentalAssetStore, RentalBooking,
    RentalRegistrationForm, RentalRegistrationSubmission,
)
from app.models.order_dispute import OrderDispute
from app.models.storefront_contact_query import StorefrontContactQuery
from app.models.platform_career_application import PlatformCareerApplication
from app.models.booking import Booking
from app.models.project import Project, ProjectTask
from app.models.notification import Notification
from app.models.vendor_category import VendorCategory
from app.models.product_group import ProductGroup, ProductGroupItem
from app.models.procurement import (
    Supplier, PurchaseOrder, PurchaseOrderItem, PurchaseOrderReceipt,
    PurchaseOrderDeliverySchedule, PurchaseOrderApproval,
)
from app.models.procurement_sequence import DocumentSequence
from app.models.procurement_supplier import (
    SupplierCategory, SupplierCategoryLink,
    SupplierContact, SupplierAddress,
    SupplierDocument, SupplierOnboarding, SupplierPerformance,
)
from app.models.procurement_rfq import RequestForQuotation, RequestForQuotationItem, RFQSupplier
from app.models.procurement_quotation import SupplierQuotation, SupplierQuotationItem
from app.models.procurement_grn import (
    GoodsReceiptNote, GRNLine, GRNQCInspection, GRNReversal, GRNReversalLine,
)
from app.models.procurement_sourcing import PurchasingInfoRecord, SourceList
from app.models.procurement_requisition import (
    PurchaseRequisition, PurchaseRequisitionItem, PurchaseRequisitionApproval,
)
from app.models.procurement_invoice import VendorInvoice, VendorInvoiceItem, VendorInvoicePayment, VendorInvoiceApproval
from app.models.procurement_approver_rule import ProcurementApproverRule
from app.models.procurement_goods import GoodsBatch, GoodsMovementDocument
from app.models.procurement_return import PurchaseReturn, PurchaseReturnLine
from app.models.pharma import (
    PharmaBatchNumberModel,
    PharmaBatchSequence, BatchTransaction, PharmaMbr, PharmaBpr,
    PharmaQcSpec, PharmaInspectionLot, PharmaRecall,
    PharmaDeviation, PharmaCapa, PharmaChangeControl,
    PharmaAuditEvent, PharmaSerialUnit,
    PharmaTempExcursion, PharmaEpcisEvent, PharmaTradingPartner,
    PharmaWholesaleLicenseHistory,
    PharmaWholesaleLicenseDocument,
    PharmaComplaint,
    PharmaSignerGroup, PharmaSignerGroupMember,
    PharmaApprovalRule, PharmaApprovalRuleStep,
    PharmaOrgRegion,
)
from app.models.procurement_special import (
    MaterialValuation, SubcontractingOrder, ConsignmentStock, ServiceEntrySheet,
)
from app.models.invoice_template import InvoiceTemplate
from app.models.merchandising import Bundle, BundleItem, UpsellMapping
from app.models.loyalty import LoyaltyProgram, LoyaltyAccount, LoyaltyTransaction
from app.models.platform_setting import PlatformSetting
from app.models.platform_staff_audit import PlatformStaffAuditLog
from app.models.platform_job_role import PlatformJobRole
from app.models.vendor_platform_audit import VendorPlatformAuditLog
from app.models.platform_website_analytics import PlatformWebsitePageView
from app.models.mrp import ProductBOMItem, StockReservation
from app.models.production import ProductionOrder
from app.models.production_routing import WorkCenter, ProductionOperation
from app.models.store import Store, StoreInventory, ProductStore, ServiceStore
from app.models.sales_area import SalesDivision, DistributionChannel, DeliveryChannel, SalesArea
from app.models.storage_location import StorageLocation
from app.models.plant import Plant
from app.models.storage_location import StorageLocation
from app.models.hr import (
    Department, Designation, EmployeeProfile, EmployeeDocument,
    AttendanceRecord, LeavePolicy, LeaveBalance, LeaveRequest, Holiday,
    SalaryStructure, PayrollRun, PayrollEntry, OfferLetter, OfferLetterTemplate,
)
from app.models.hr_recruit import (
    JobPosting, Candidate, JobApplication, InterviewRound,
    OnboardingTemplate, OnboardingTemplateItem,
    OnboardingChecklist, OnboardingTask,
)
from app.models.hr_performance import (
    ReviewCycle, PerformanceGoal, PerformanceReview, ReviewKPIScore, Feedback,
)
from app.models.hr_compliance import (
    Policy, PolicyAcknowledgement, ComplianceCertification, ComplianceAuditLog,
)
from app.models.hr_training import (
    TrainingProgram, TrainingCourse, QuizQuestion,
    TrainingEnrollment, CourseCompletion, TrainingCertificate,
)
from app.models.hr_ess import (
    Announcement, AnnouncementRead, ExpenseClaim,
    HelpdeskTicket, HelpdeskTicketComment,
)
from app.models.crm import (
    CrmAccount, CrmContact, CrmLead,
    CrmPipeline, CrmStage, CrmDeal,
    CrmActivity, CrmCommunicationLog, CrmCallRecording,
    CrmSlaPolicy, CrmTicket, CrmTicketComment, CrmKbArticle,
    CrmSegment, CrmEmailTemplate, CrmCampaign, CrmCampaignStep,
    CrmCampaignEnrollment, CrmEmailEvent, CrmSuppressionEntry,
    CrmWorkflow, CrmWorkflowRun,
    CrmIntegration, CrmAuditLog, CrmAiInsight,
    CrmChatConversation, CrmChatMessage, CrmJourneyEvent,
    CrmLeadIntakeToken, CrmNumberRange,
    CrmPaymentFollowup, CrmCreditControl,
)

from app.models.commission import (
    CommissionPayee, CommissionPlan, CommissionRule,
    CommissionAssignment, CommissionAccrual,
    CommissionPayoutRun, CommissionPayoutItem, CommissionApprovalLog,
)

from app.models.controlling import (
    CoActivityType, CoOverheadPool, CoOverheadRate,
    CoProductCostVersion, CoProductCostLine,
    CoManufacturingOrder, CoOrderCostLine, CoOrderOperation,
    CoGlMapping, CoCostBooking,
    CoActivityConfirmation, CoGoodsMovement,
    CoCostAllocation, CoBudgetLine, CoVarianceRun,
    CoWorkCenter, CoRouting, CoRoutingOperation,
)
from app.models.controlling_area import CoControllingArea

from app.models.business_partner import BusinessPartner, BusinessPartnerRole
from app.models.blog import VendorBlogPost
from app.models.pricing_plan import VendorPricingPlan
from app.models.vendor_property import VendorProperty
from app.models.vendor_course import VendorCourse
from app.models.vendor_fitness_class import VendorFitnessClass
from app.models.vendor_vehicle import VendorVehicle
from app.models.vendor_event import VendorEvent
from app.models.vendor_recurring_plan import VendorRecurringPlan
from app.models.vendor_testimonial import VendorTestimonial
from app.models.vendor_booking_wizard_step import VendorBookingWizardStep
from app.models.vendor_booking_resource import VendorBookingResource
from app.models.schema_field_mapping import SchemaFieldMapping

from app.models.website import (
    WebsiteSite, WebsitePage, WebsiteBlock, WebsiteMedia, WebsiteRedirect,
    WebsiteFormSubmission, WebsitePageRevision, WebsiteBuilderPreview,
    WebsiteBlockTranslation, WebsiteSymbol, WebsiteABExposure,
    WebsiteWebhook, PlatformWebsiteTemplate,
)

from app.models.finance import (
    FinCompany, FinCostCenter, FinProject, FinIntercompanyPartner,
    FinAccount, FinFiscalYear, FinFiscalYearCompany, FinPeriod, FinFieldRule, FinExchangeRate,
    FinJournalEntry, FinJournalLine, FinRecurringTemplate,
    FinCustomerPaymentApplication, FinArAgingSnapshot,
    FinVendorBill, FinVendorBillLine, FinVendorPayment,
    FinPaymentRun, FinPaymentRunItem, FinApAgingSnapshot,
    FinBankAccount, FinBankStatement, FinBankStatementLine,
    FinBankReconciliation, FinReconciliationMatch,
    FinBudget, FinBudgetLine, FinForecast, FinForecastLine,
    FinTaxCode, FinTaxReturn,
    FinAssetCategory, FinAsset, FinAssetDepreciationEntry,
    FinAssetDisposal, FinAssetMaintenance,
    FinLoan, FinLoanScheduleLine, FinInvestment, FinInvestmentValuation,
    FinApprovalPolicy, FinApprovalRequest, FinApprovalStep, FinAuditLog,
    FinBasicTransaction,
)

__all__ = [
    "User",
    "Vendor",
    "VendorDocument",
    "VendorBankAccount",
    "VendorOwner",
    "VendorUser",
    "VendorRole",
    "Product",
    "ProductVariant",
    "ProductImage",
    "ProductConfigAttribute",
    "ProductConfigOption",
    "ProductConfigRule",
    "Service",
    "ServiceAvailability",
    "ServicePlan",
    "VendorPlan",
    "Customer",
    "Cart",
    "Order",
    "Payment",
    "Review",
    "InventoryMovement",
    "StockCount",
    "StockCountLine",
    "StockTransferOrder",
    "StockTransferOrderLine",
    "StockCostLayer",
    "VendorAppBuild",
    "POSSession",
    "POSTransaction",
    "RestaurantZone",
    "RestaurantTable",
    "RestaurantOrder",
    "RestaurantKOT",
    "RestaurantReservation",
    "RestaurantMenu",
    "RestaurantMenuCategory",
    "RestaurantMenuZoneLink",
    "Invoice",
    "Coupon",
    "CouponUsage",
    "Lead",
    "Quote",
    "RentalAssetStore",
    "StorefrontContactQuery",
    "PlatformCareerApplication",
    "Booking",
    "Project",
    "ProjectTask",
    "Notification",
    "VendorCategory",
    "ProductGroup",
    "ProductGroupItem",
    "Supplier",
    "PurchaseOrder",
    "PurchaseOrderItem",
    "PurchaseOrderReceipt",
    "PurchaseOrderDeliverySchedule",
    "PurchaseOrderApproval",
    "DocumentSequence",
    # Supplier management (Phase 1)
    "SupplierCategory",
    "SupplierCategoryLink",
    "SupplierContact",
    "SupplierAddress",
    "SupplierDocument",
    "SupplierOnboarding",
    "SupplierPerformance",
    # GRN (Phase 7)
    "GoodsReceiptNote",
    "GRNLine",
    "GRNQCInspection",
    "GRNReversal",
    "GRNReversalLine",
    # RFQ (Phase 3)
    "RequestForQuotation",
    "RequestForQuotationItem",
    "RFQSupplier",
    # Supplier Quotation (Phase 4)
    "SupplierQuotation",
    "SupplierQuotationItem",
    # Sourcing
    "PurchasingInfoRecord",
    "SourceList",
    # Requisition
    "PurchaseRequisition",
    "PurchaseRequisitionItem",
    "PurchaseRequisitionApproval",
    # Vendor Invoice
    "VendorInvoice",
    "VendorInvoiceItem",
    "VendorInvoicePayment",
    "VendorInvoiceApproval",
    # Approver matrix
    "ProcurementApproverRule",
    # Goods
    "GoodsBatch",
    "GoodsMovementDocument",
    # Purchase Returns (Phase 9)
    "PurchaseReturn",
    "PurchaseReturnLine",
    "PharmaBatchNumberModel",
    "PharmaBatchSequence",
    "BatchTransaction",
    "PharmaMbr",
    "PharmaBpr",
    "PharmaQcSpec",
    "PharmaInspectionLot",
    "PharmaRecall",
    "PharmaDeviation",
    "PharmaCapa",
    "PharmaChangeControl",
    "PharmaAuditEvent",
    "PharmaSerialUnit",
    "PharmaTempExcursion",
    "PharmaEpcisEvent",
    "PharmaTradingPartner",
    "PharmaWholesaleLicenseHistory",
    "PharmaWholesaleLicenseDocument",
    "PharmaSignerGroup",
    "PharmaSignerGroupMember",
    "PharmaApprovalRule",
    "PharmaApprovalRuleStep",
    "PharmaOrgRegion",
    # Special procurement
    "MaterialValuation",
    "SubcontractingOrder",
    "ConsignmentStock",
    "ServiceEntrySheet",
    "InvoiceTemplate",
    "Bundle",
    "BundleItem",
    "UpsellMapping",
    "ProductPriceRule",
    "ProductModifierGroup",
    "ProductModifierOption",
    "LoyaltyProgram",
    "LoyaltyAccount",
    "LoyaltyTransaction",
    "PlatformSetting",
    "PlatformStaffAuditLog",
    "PlatformJobRole",
    "VendorPlatformAuditLog",
    "ProductBOMItem",
    "StockReservation",
    "WorkCenter",
    "ProductionOperation",
    "Store",
    "StoreInventory",
    "StorageLocation",
    "Plant",
    # Sales & Distribution
    "SalesDivision",
    "DistributionChannel",
    "DeliveryChannel",
    "SalesArea",
    # HR
    "Department",
    "Designation",
    "EmployeeProfile",
    "EmployeeDocument",
    "AttendanceRecord",
    "LeavePolicy",
    "LeaveBalance",
    "LeaveRequest",
    "Holiday",
    "SalaryStructure",
    "PayrollRun",
    "PayrollEntry",
    "OfferLetter",
    "OfferLetterTemplate",
    # Recruitment & Onboarding
    "JobPosting", "Candidate", "JobApplication", "InterviewRound",
    "OnboardingTemplate", "OnboardingTemplateItem",
    "OnboardingChecklist", "OnboardingTask",
    # Performance
    "ReviewCycle", "PerformanceGoal", "PerformanceReview", "ReviewKPIScore", "Feedback",
    # Compliance
    "Policy", "PolicyAcknowledgement", "ComplianceCertification", "ComplianceAuditLog",
    # Training
    "TrainingProgram", "TrainingCourse", "QuizQuestion",
    "TrainingEnrollment", "CourseCompletion", "TrainingCertificate",
    # ESS
    "Announcement", "AnnouncementRead", "ExpenseClaim",
    "HelpdeskTicket", "HelpdeskTicketComment",
    # CRM
    "CrmAccount", "CrmContact", "CrmLead",
    "CrmPipeline", "CrmStage", "CrmDeal",
    "CrmActivity", "CrmCommunicationLog", "CrmCallRecording",
    "CrmSlaPolicy", "CrmTicket", "CrmTicketComment", "CrmKbArticle",
    "CrmSegment", "CrmEmailTemplate", "CrmCampaign", "CrmCampaignStep",
    "CrmCampaignEnrollment", "CrmEmailEvent", "CrmSuppressionEntry",
    "CrmWorkflow", "CrmWorkflowRun",
    "CrmIntegration", "CrmAuditLog", "CrmAiInsight",
    "CrmChatConversation", "CrmChatMessage", "CrmJourneyEvent",
    "CrmLeadIntakeToken",
    "CrmNumberRange",
    "CrmPaymentFollowup",
    "CrmCreditControl",
    # Finance — dimensions
    "FinCompany", "FinCostCenter", "FinProject", "FinIntercompanyPartner",
    # Finance
    "FinAccount", "FinFiscalYear", "FinFiscalYearCompany", "FinPeriod", "FinFieldRule", "FinExchangeRate",
    "FinJournalEntry", "FinJournalLine", "FinRecurringTemplate",
    "FinCustomerPaymentApplication", "FinArAgingSnapshot",
    "FinVendorBill", "FinVendorBillLine", "FinVendorPayment",
    "FinPaymentRun", "FinPaymentRunItem", "FinApAgingSnapshot",
    "FinBankAccount", "FinBankStatement", "FinBankStatementLine",
    "FinBankReconciliation", "FinReconciliationMatch",
    "FinBudget", "FinBudgetLine", "FinForecast", "FinForecastLine",
    "FinTaxCode", "FinTaxReturn",
    "FinAssetCategory", "FinAsset", "FinAssetDepreciationEntry",
    "FinAssetDisposal", "FinAssetMaintenance",
    "FinLoan", "FinLoanScheduleLine", "FinInvestment", "FinInvestmentValuation",
    "FinApprovalPolicy", "FinApprovalRequest", "FinApprovalStep", "FinAuditLog",
    "FinBasicTransaction",
    # Business Partner
    "BusinessPartner",
    "BusinessPartnerRole",
    # Blog CMS
    "VendorBlogPost",
    "SchemaFieldMapping",
    # Website Builder
    "WebsiteSite", "WebsitePage", "WebsiteBlock", "WebsiteMedia", "WebsiteRedirect",
    "WebsiteFormSubmission", "WebsitePageRevision", "WebsiteBuilderPreview",
    "WebsiteBlockTranslation", "WebsiteSymbol", "WebsiteABExposure",
    "WebsiteWebhook", "PlatformWebsiteTemplate",
    "PlatformWebsitePageView",
    # Controlling (CO)
    "CoControllingArea",
    "CoActivityType", "CoOverheadPool", "CoOverheadRate",
    "CoProductCostVersion", "CoProductCostLine",
    "CoManufacturingOrder", "CoOrderCostLine", "CoOrderOperation",
    "CoGlMapping", "CoCostBooking",
    "CoActivityConfirmation", "CoGoodsMovement",
    "CoCostAllocation", "CoBudgetLine", "CoVarianceRun",
    # Commission
    "CommissionPayee", "CommissionPlan", "CommissionRule",
    "CommissionAssignment", "CommissionAccrual",
    "CommissionPayoutRun", "CommissionPayoutItem", "CommissionApprovalLog",
]
