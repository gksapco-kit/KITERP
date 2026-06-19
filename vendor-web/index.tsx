import.meta.env = {"BASE_URL": "/", "DEV": true, "MODE": "development", "PROD": false, "SSR": false, "VITE_API_URL": "http://127.0.0.1:8000/api/v1", "VITE_STOREFRONT_URL": "http://localhost:3002", "VITE_WATCH_POLLING": "1"};import __vite__cjsImport0_react_jsxDevRuntime from "/node_modules/.vite/deps/react_jsx-dev-runtime.js?v=cab320f1"; const jsxDEV = __vite__cjsImport0_react_jsxDevRuntime["jsxDEV"];
import { createBrowserRouter, Navigate } from "/node_modules/.vite/deps/react-router-dom.js?v=cab320f1";
import AuthLayout from "/src/layouts/AuthLayout.tsx";
import DashboardLayout from "/src/layouts/DashboardLayout.tsx";
import ProtectedRoute from "/src/routes/ProtectedRoute.tsx";
import Login from "/src/pages/auth/Login.tsx";
import VendorHandoff from "/src/pages/auth/Handoff.tsx";
import Register from "/src/pages/auth/Register.tsx";
import SignupWelcome from "/src/pages/auth/SignupWelcome.tsx";
import ForgotPassword from "/src/pages/auth/ForgotPassword.tsx";
import Dashboard from "/src/pages/dashboard/index.tsx";
import Orders from "/src/pages/orders/index.tsx";
import QuotationsPage from "/src/pages/quotations/index.tsx";
import OrderDetail from "/src/pages/orders/OrderDetail.tsx";
import OrderAuditReport from "/src/pages/orders/OrderAuditReport.tsx";
import Products from "/src/pages/products/index.tsx";
import ProductForm from "/src/pages/products/ProductForm.tsx";
import ProductAuditReport from "/src/pages/products/ProductAuditReport.tsx";
import Services from "/src/pages/services/index.tsx";
import ServiceForm from "/src/pages/services/ServiceForm.tsx";
import ServiceAuditReport from "/src/pages/services/ServiceAuditReport.tsx";
import CustomerDetail from "/src/pages/customers/CustomerDetail.tsx";
import ReviewsPage from "/src/pages/reviews/index.tsx";
import TeamPage from "/src/pages/team/index.tsx";
import RolesPage from "/src/pages/roles/index.tsx";
import SettingsPage from "/src/pages/settings/index.tsx";
import SupportActivityPage from "/src/pages/settings/SupportActivity.tsx";
import AboutPage from "/src/pages/about/index.tsx";
import CategoriesPage from "/src/pages/categories/index.tsx";
import Inventory from "/src/pages/inventory/index.tsx";
import StorageLocationsPage from "/src/pages/inventory/StorageLocations.tsx";
import POS from "/src/pages/pos/index.tsx";
import RestaurantFloorPage from "/src/pages/restaurant/Floor.tsx";
import RestaurantKitchenPage from "/src/pages/restaurant/Kitchen.tsx";
import RestaurantSetupPage from "/src/pages/restaurant/Setup.tsx";
import RestaurantOrderPage from "/src/pages/restaurant/Order.tsx";
import RestaurantReservationsPage from "/src/pages/restaurant/Reservations.tsx";
import RestaurantReportsPage from "/src/pages/restaurant/Reports.tsx";
import RestaurantMenuPage from "/src/pages/restaurant/Menu.tsx";
import WorkspaceHubPage from "/src/pages/workspace/Hub.tsx";
import SubscriptionsSalesPage from "/src/pages/sales/Subscriptions.tsx";
import MarketplaceLeadsPage from "/src/pages/sales/MarketplaceLeads.tsx";
import RentalHubPage from "/src/pages/rental/RentalHub.tsx";
import InvoicesPage from "/src/pages/invoices/index.tsx";
import InvoiceDetail from "/src/pages/invoices/InvoiceDetail.tsx";
import InvoiceTemplatesPage from "/src/pages/invoices/InvoiceTemplates.tsx";
import CouponsPage from "/src/pages/coupons/index.tsx";
import ReportsPage from "/src/pages/reports/index.tsx";
import PlansPage from "/src/pages/plans/index.tsx";
import BookingsPage from "/src/pages/bookings/index.tsx";
import BookingDetail from "/src/pages/bookings/BookingDetail.tsx";
import ProjectsPage from "/src/pages/projects/index.tsx";
import ProjectDetail from "/src/pages/projects/ProjectDetail.tsx";
import NotificationsPage from "/src/pages/notifications/index.tsx";
import NotificationSettingsPage from "/src/pages/notifications/settings.tsx";
import MasterDataReport from "/src/pages/master-data/MasterDataReport.tsx";
import MasterDataNew from "/src/pages/master-data/MasterDataNew.tsx";
import PurchaseOrdersPage from "/src/pages/purchase-orders/index.tsx";
import PurchaseOrderDetail from "/src/pages/purchase-orders/PurchaseOrderDetail.tsx";
import POTemplatesPage from "/src/pages/purchase-orders/POTemplates.tsx";
import CreditDebitMemos from "/src/pages/finance/CreditDebitMemos.tsx";
import ProductionOrdersPage from "/src/pages/production/index.tsx";
import StoresPage from "/src/pages/stores/index.tsx";
import ProfilePage from "/src/pages/profile/index.tsx";
import RelationshipManagerPage from "/src/pages/relationship-manager/index.tsx";
import HRDepartmentsPage from "/src/pages/hr/departments.tsx";
import HRDesignationsPage from "/src/pages/hr/designations.tsx";
import HREmployeesPage from "/src/pages/hr/employees/index.tsx";
import HREmployeeDetailPage from "/src/pages/hr/employees/EmployeeDetail.tsx";
import HRAttendancePage from "/src/pages/hr/attendance/index.tsx";
import MyAttendancePage from "/src/pages/hr/attendance/MyAttendance.tsx";
import AttendanceReportPage from "/src/pages/hr/attendance/AttendanceReport.tsx";
import HRLeaveRequestsPage from "/src/pages/hr/leaves/index.tsx";
import LeavePoliciesPage from "/src/pages/hr/leaves/Policies.tsx";
import HolidaysPage from "/src/pages/hr/leaves/Holidays.tsx";
import MyLeavesPage from "/src/pages/hr/leaves/MyLeaves.tsx";
import HRSalaryPage from "/src/pages/hr/salary/index.tsx";
import HRPayrollPage from "/src/pages/hr/payroll/index.tsx";
import HRPayrollDetailPage from "/src/pages/hr/payroll/PayrollDetail.tsx";
import HROffersPage from "/src/pages/hr/offers/index.tsx";
import HROfferTemplatesPage from "/src/pages/hr/offers/Templates.tsx";
import HRRecruitmentPage from "/src/pages/hr/recruitment/index.tsx";
import HRJobDetailPage from "/src/pages/hr/recruitment/JobDetail.tsx";
import HROnboardingPage from "/src/pages/hr/onboarding/index.tsx";
import MyOnboardingPage from "/src/pages/hr/onboarding/MyOnboarding.tsx";
import HRPerformancePage from "/src/pages/hr/performance/index.tsx";
import HRCycleDetailPage from "/src/pages/hr/performance/CycleDetail.tsx";
import HRReviewDetailPage from "/src/pages/hr/performance/ReviewDetail.tsx";
import MyPerformancePage from "/src/pages/hr/performance/MyPerformance.tsx";
import HRCompliancePage from "/src/pages/hr/compliance/index.tsx";
import HRPolicyDetailPage from "/src/pages/hr/compliance/PolicyDetail.tsx";
import MyPoliciesPage from "/src/pages/hr/compliance/MyPolicies.tsx";
import HRTrainingPage from "/src/pages/hr/training/index.tsx";
import HRProgramDetailPage from "/src/pages/hr/training/ProgramDetail.tsx";
import MyTrainingPage from "/src/pages/hr/training/MyTraining.tsx";
import CourseLearningPage from "/src/pages/hr/training/CourseLearning.tsx";
import MyESSPage from "/src/pages/hr/ess/MyESS.tsx";
import HRAnnouncementsPage from "/src/pages/hr/announcements/index.tsx";
import MyAnnouncementsPage from "/src/pages/hr/announcements/MyAnnouncements.tsx";
import HRExpensesPage from "/src/pages/hr/expenses/index.tsx";
import MyExpensesPage from "/src/pages/hr/expenses/MyExpenses.tsx";
import HRHelpdeskPage from "/src/pages/hr/helpdesk/index.tsx";
import MyTicketsPage from "/src/pages/hr/helpdesk/MyTickets.tsx";
import HRTicketDetailPage from "/src/pages/hr/helpdesk/TicketDetail.tsx";
import FinanceDashboard from "/src/pages/finance/index.tsx";
import FinanceBasic from "/src/pages/finance/BasicFinance.tsx";
import FinanceCostCenters from "/src/pages/finance/CostCenters.tsx";
import FinanceCOA from "/src/pages/finance/ChartOfAccounts.tsx";
import FinanceJournal from "/src/pages/finance/JournalEntries.tsx";
import FinanceTrialBalance from "/src/pages/finance/TrialBalance.tsx";
import FinanceAR from "/src/pages/finance/AccountsReceivable.tsx";
import FinanceAP from "/src/pages/finance/AccountsPayable.tsx";
import FinanceBank from "/src/pages/finance/BankCash.tsx";
import FinanceBudgets from "/src/pages/finance/BudgetsForecast.tsx";
import FinanceAssets from "/src/pages/finance/FixedAssets.tsx";
import FinanceTax from "/src/pages/finance/TaxReturns.tsx";
import FinancePnL from "/src/pages/finance/reports/ProfitLoss.tsx";
import FinanceBalanceSheet from "/src/pages/finance/reports/BalanceSheet.tsx";
import FinanceCashFlow from "/src/pages/finance/reports/CashFlow.tsx";
import FinanceCostAnalysis from "/src/pages/finance/reports/CostAnalysis.tsx";
import FinanceGLReport from "/src/pages/finance/reports/GLReport.tsx";
import FinanceCapital from "/src/pages/finance/Capital.tsx";
import FinanceApprovals from "/src/pages/finance/Approvals.tsx";
import FinanceAudit from "/src/pages/finance/AuditLog.tsx";
import FinancePeriodControl from "/src/pages/finance/PeriodControl.tsx";
import FinanceFieldRuleConfig from "/src/pages/finance/FieldRuleConfig.tsx";
import COLayout from "/src/layouts/COLayout.tsx";
import ControllingDashboardPage from "/src/pages/controlling/index.tsx";
import ControllingProductCostsPage from "/src/pages/controlling/ProductCosts.tsx";
import ControllingManufacturingOrdersPage from "/src/pages/controlling/ManufacturingOrders.tsx";
import ControllingSetupPage from "/src/pages/controlling/Setup.tsx";
import ControllingManufacturingOrderDetail from "/src/pages/controlling/ManufacturingOrderDetail.tsx";
import ControllingWipReport from "/src/pages/controlling/WipReport.tsx";
import ControllingGoodsMovementsPage from "/src/pages/controlling/GoodsMovements.tsx";
import ControllingActivityConfirmationsPage from "/src/pages/controlling/ActivityConfirmations.tsx";
import ControllingCostAllocationsPage from "/src/pages/controlling/CostAllocations.tsx";
import ControllingPeriodEndPage from "/src/pages/controlling/PeriodEnd.tsx";
import ControllingInternalOrdersPage from "/src/pages/controlling/InternalOrders.tsx";
import ControllingCostBookingsPage from "/src/pages/controlling/CostBookings.tsx";
import ControllingVarianceAnalysisPage from "/src/pages/controlling/VarianceAnalysis.tsx";
import ControllingProductionProcessPage from "/src/pages/controlling/ProductionProcess.tsx";
import ControllingInternalCostPage from "/src/pages/controlling/InternalCostManagement.tsx";
import ControllingRoutingPage from "/src/pages/controlling/Routing.tsx";
import CrmDashboard from "/src/pages/crm/index.tsx";
import CrmContacts from "/src/pages/crm/Contacts.tsx";
import CrmAccounts from "/src/pages/crm/Accounts.tsx";
import CrmLeads from "/src/pages/crm/Leads.tsx";
import CrmPipeline from "/src/pages/crm/Pipeline.tsx";
import CrmActivities from "/src/pages/crm/Activities.tsx";
import CrmInbox from "/src/pages/crm/Inbox.tsx";
import CrmTickets from "/src/pages/crm/Tickets.tsx";
import CrmTicketDetail from "/src/pages/crm/TicketDetail.tsx";
import CrmKnowledgeBase from "/src/pages/crm/KnowledgeBase.tsx";
import CrmSegments from "/src/pages/crm/Segments.tsx";
import CrmTemplates from "/src/pages/crm/Templates.tsx";
import DocumentTemplatesPage from "/src/pages/document-templates/index.tsx";
import SystemModulesPage from "/src/pages/system/Modules.tsx";
import SystemModelsPage from "/src/pages/system/Models.tsx";
import SystemTableDataPage from "/src/pages/system/TableData.tsx";
import SystemBrowseTablePage from "/src/pages/system/BrowseTable.tsx";
import VendorAdminRoute from "/src/routes/VendorAdminRoute.tsx";
import SystemStorefrontDisplayPage from "/src/pages/system/StorefrontDisplay.tsx";
import SystemSocialLinksPage from "/src/pages/system/SocialLinks.tsx";
import AssetsLayout from "/src/pages/system/assets/index.tsx";
import AssetImagesPage from "/src/pages/system/assets/Images.tsx";
import CrmCampaigns from "/src/pages/crm/Campaigns.tsx";
import CrmWorkflows from "/src/pages/crm/Workflows.tsx";
import CrmAIInsights from "/src/pages/crm/AIInsights.tsx";
import CrmIntegrations from "/src/pages/crm/Integrations.tsx";
import CrmReports from "/src/pages/crm/Reports.tsx";
import CrmAudit from "/src/pages/crm/Audit.tsx";
import CrmCareReminder from "/src/pages/crm/CareReminder.tsx";
import BlogManagerPage from "/src/pages/blog/index.tsx";
import WebsitesPage from "/src/pages/websites/index.tsx";
import WebsiteBuilder from "/src/pages/websites/Builder.tsx";
import WebsiteSubmissions from "/src/pages/websites/Submissions.tsx";
import WebsiteTemplateGallery from "/src/pages/websites/TemplateGallery.tsx";
import BusinessFrontHubPage from "/src/pages/business-front/index.tsx";
import StorefrontBrowserPreviewShell from "/src/pages/websites/StorefrontBrowserPreviewShell.tsx";
import LegacyBrowserPreviewRedirect from "/src/pages/websites/LegacyBrowserPreviewRedirect.tsx";
import PreviewDraftStorePathRedirect from "/src/pages/websites/PreviewDraftStorePathRedirect.tsx";
import CommissionLayout from "/src/pages/commission/index.tsx";
import CommissionPayees from "/src/pages/commission/Payees.tsx";
import CommissionPlans from "/src/pages/commission/Plans.tsx";
import CommissionAssignments from "/src/pages/commission/Assignments.tsx";
import CommissionAccruals from "/src/pages/commission/Accruals.tsx";
import CommissionPayouts from "/src/pages/commission/Payouts.tsx";
import CommissionReportPage from "/src/pages/commission/reports/CommissionReport.tsx";
const routerBasename = (import.meta.env.VITE_ROUTER_BASENAME || "").replace(/\/$/, "");
export const router = createBrowserRouter(
  [
    {
      path: "/preview/draft",
      element: /* @__PURE__ */ jsxDEV(StorefrontBrowserPreviewShell, {}, void 0, false, {
        fileName: "/app/src/routes/index.tsx",
        lineNumber: 211,
        columnNumber: 12
      }, this)
    },
    {
      path: "/preview/draft/store/:vendorSlug/*",
      element: /* @__PURE__ */ jsxDEV(PreviewDraftStorePathRedirect, {}, void 0, false, {
        fileName: "/app/src/routes/index.tsx",
        lineNumber: 215,
        columnNumber: 12
      }, this)
    },
    {
      path: "/websites/browser-preview",
      element: /* @__PURE__ */ jsxDEV(LegacyBrowserPreviewRedirect, {}, void 0, false, {
        fileName: "/app/src/routes/index.tsx",
        lineNumber: 219,
        columnNumber: 12
      }, this)
    },
    {
      path: "/login",
      element: /* @__PURE__ */ jsxDEV(AuthLayout, {}, void 0, false, {
        fileName: "/app/src/routes/index.tsx",
        lineNumber: 223,
        columnNumber: 12
      }, this),
      children: [{ index: true, element: /* @__PURE__ */ jsxDEV(Login, {}, void 0, false, {
        fileName: "/app/src/routes/index.tsx",
        lineNumber: 224,
        columnNumber: 38
      }, this) }]
    },
    {
      path: "/auth/handoff",
      element: /* @__PURE__ */ jsxDEV(AuthLayout, {}, void 0, false, {
        fileName: "/app/src/routes/index.tsx",
        lineNumber: 228,
        columnNumber: 12
      }, this),
      children: [{ index: true, element: /* @__PURE__ */ jsxDEV(VendorHandoff, {}, void 0, false, {
        fileName: "/app/src/routes/index.tsx",
        lineNumber: 229,
        columnNumber: 38
      }, this) }]
    },
    {
      path: "/register",
      element: /* @__PURE__ */ jsxDEV(Register, {}, void 0, false, {
        fileName: "/app/src/routes/index.tsx",
        lineNumber: 233,
        columnNumber: 12
      }, this)
    },
    {
      path: "/signup",
      element: /* @__PURE__ */ jsxDEV(Register, {}, void 0, false, {
        fileName: "/app/src/routes/index.tsx",
        lineNumber: 237,
        columnNumber: 12
      }, this)
    },
    {
      path: "/welcome",
      element: /* @__PURE__ */ jsxDEV(ProtectedRoute, { children: /* @__PURE__ */ jsxDEV(SignupWelcome, {}, void 0, false, {
        fileName: "/app/src/routes/index.tsx",
        lineNumber: 243,
        columnNumber: 9
      }, this) }, void 0, false, {
        fileName: "/app/src/routes/index.tsx",
        lineNumber: 242,
        columnNumber: 3
      }, this)
    },
    {
      path: "/forgot-password",
      element: /* @__PURE__ */ jsxDEV(AuthLayout, {}, void 0, false, {
        fileName: "/app/src/routes/index.tsx",
        lineNumber: 249,
        columnNumber: 12
      }, this),
      children: [{ index: true, element: /* @__PURE__ */ jsxDEV(ForgotPassword, {}, void 0, false, {
        fileName: "/app/src/routes/index.tsx",
        lineNumber: 250,
        columnNumber: 38
      }, this) }]
    },
    {
      path: "/",
      element: /* @__PURE__ */ jsxDEV(ProtectedRoute, { children: /* @__PURE__ */ jsxDEV(DashboardLayout, {}, void 0, false, {
        fileName: "/app/src/routes/index.tsx",
        lineNumber: 256,
        columnNumber: 9
      }, this) }, void 0, false, {
        fileName: "/app/src/routes/index.tsx",
        lineNumber: 255,
        columnNumber: 3
      }, this),
      children: [
        { index: true, element: /* @__PURE__ */ jsxDEV(Dashboard, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 260,
          columnNumber: 27
        }, this) },
        { path: "orders", element: /* @__PURE__ */ jsxDEV(Orders, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 261,
          columnNumber: 30
        }, this) },
        { path: "quotations", element: /* @__PURE__ */ jsxDEV(QuotationsPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 262,
          columnNumber: 34
        }, this) },
        { path: "quotations/templates", element: /* @__PURE__ */ jsxDEV(InvoiceTemplatesPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 263,
          columnNumber: 44
        }, this) },
        { path: "quotations/:id", element: /* @__PURE__ */ jsxDEV(InvoiceDetail, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 264,
          columnNumber: 38
        }, this) },
        { path: "orders/:id/audit", element: /* @__PURE__ */ jsxDEV(OrderAuditReport, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 265,
          columnNumber: 40
        }, this) },
        { path: "orders/:id", element: /* @__PURE__ */ jsxDEV(OrderDetail, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 266,
          columnNumber: 34
        }, this) },
        { path: "products", element: /* @__PURE__ */ jsxDEV(Products, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 267,
          columnNumber: 32
        }, this) },
        { path: "products/new", element: /* @__PURE__ */ jsxDEV(ProductForm, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 268,
          columnNumber: 36
        }, this) },
        { path: "products/:id/audit", element: /* @__PURE__ */ jsxDEV(ProductAuditReport, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 269,
          columnNumber: 42
        }, this) },
        { path: "products/:id", element: /* @__PURE__ */ jsxDEV(ProductForm, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 270,
          columnNumber: 36
        }, this) },
        { path: "services", element: /* @__PURE__ */ jsxDEV(Services, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 271,
          columnNumber: 32
        }, this) },
        { path: "services/new", element: /* @__PURE__ */ jsxDEV(ServiceForm, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 272,
          columnNumber: 36
        }, this) },
        { path: "services/:id/audit", element: /* @__PURE__ */ jsxDEV(ServiceAuditReport, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 273,
          columnNumber: 42
        }, this) },
        { path: "services/:id", element: /* @__PURE__ */ jsxDEV(ServiceForm, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 274,
          columnNumber: 36
        }, this) },
        { path: "categories", element: /* @__PURE__ */ jsxDEV(CategoriesPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 275,
          columnNumber: 34
        }, this) },
        { path: "master-data", element: /* @__PURE__ */ jsxDEV(MasterDataReport, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 276,
          columnNumber: 35
        }, this) },
        { path: "master-data/new", element: /* @__PURE__ */ jsxDEV(MasterDataNew, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 277,
          columnNumber: 39
        }, this) },
        { path: "suppliers", element: /* @__PURE__ */ jsxDEV(Navigate, { to: "/master-data", replace: true }, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 278,
          columnNumber: 33
        }, this) },
        { path: "purchase-orders", element: /* @__PURE__ */ jsxDEV(PurchaseOrdersPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 279,
          columnNumber: 39
        }, this) },
        { path: "purchase-orders/templates", element: /* @__PURE__ */ jsxDEV(POTemplatesPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 280,
          columnNumber: 49
        }, this) },
        { path: "purchase-orders/:id", element: /* @__PURE__ */ jsxDEV(PurchaseOrderDetail, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 281,
          columnNumber: 43
        }, this) },
        { path: "production", element: /* @__PURE__ */ jsxDEV(ProductionOrdersPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 282,
          columnNumber: 34
        }, this) },
        { path: "inventory", element: /* @__PURE__ */ jsxDEV(Inventory, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 283,
          columnNumber: 33
        }, this) },
        { path: "storage-locations", element: /* @__PURE__ */ jsxDEV(StorageLocationsPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 284,
          columnNumber: 41
        }, this) },
        { path: "pos", element: /* @__PURE__ */ jsxDEV(POS, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 285,
          columnNumber: 27
        }, this) },
        { path: "restaurant/floor", element: /* @__PURE__ */ jsxDEV(RestaurantFloorPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 286,
          columnNumber: 40
        }, this) },
        { path: "restaurant/kitchen", element: /* @__PURE__ */ jsxDEV(RestaurantKitchenPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 287,
          columnNumber: 42
        }, this) },
        { path: "restaurant/setup", element: /* @__PURE__ */ jsxDEV(RestaurantSetupPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 288,
          columnNumber: 40
        }, this) },
        { path: "restaurant/menu", element: /* @__PURE__ */ jsxDEV(RestaurantMenuPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 289,
          columnNumber: 39
        }, this) },
        { path: "restaurant/order/:orderId", element: /* @__PURE__ */ jsxDEV(RestaurantOrderPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 290,
          columnNumber: 49
        }, this) },
        { path: "restaurant/reservations", element: /* @__PURE__ */ jsxDEV(RestaurantReservationsPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 291,
          columnNumber: 47
        }, this) },
        { path: "restaurant/reports", element: /* @__PURE__ */ jsxDEV(RestaurantReportsPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 292,
          columnNumber: 42
        }, this) },
        { path: "workspace", element: /* @__PURE__ */ jsxDEV(WorkspaceHubPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 293,
          columnNumber: 33
        }, this) },
        { path: "subscriptions", element: /* @__PURE__ */ jsxDEV(SubscriptionsSalesPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 294,
          columnNumber: 37
        }, this) },
        { path: "marketplace", element: /* @__PURE__ */ jsxDEV(MarketplaceLeadsPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 295,
          columnNumber: 35
        }, this) },
        { path: "rental", element: /* @__PURE__ */ jsxDEV(RentalHubPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 296,
          columnNumber: 30
        }, this) },
        { path: "invoices", element: /* @__PURE__ */ jsxDEV(InvoicesPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 297,
          columnNumber: 32
        }, this) },
        { path: "invoices/templates", element: /* @__PURE__ */ jsxDEV(InvoiceTemplatesPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 298,
          columnNumber: 42
        }, this) },
        { path: "invoices/:id", element: /* @__PURE__ */ jsxDEV(InvoiceDetail, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 299,
          columnNumber: 36
        }, this) },
        { path: "memos", element: /* @__PURE__ */ jsxDEV(CreditDebitMemos, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 300,
          columnNumber: 29
        }, this) },
        { path: "coupons", element: /* @__PURE__ */ jsxDEV(CouponsPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 301,
          columnNumber: 31
        }, this) },
        { path: "reports", element: /* @__PURE__ */ jsxDEV(ReportsPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 302,
          columnNumber: 31
        }, this) },
        { path: "template", element: /* @__PURE__ */ jsxDEV(Navigate, { to: "/websites/templates?customize=1", replace: true }, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 303,
          columnNumber: 32
        }, this) },
        { path: "business-front", element: /* @__PURE__ */ jsxDEV(BusinessFrontHubPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 304,
          columnNumber: 38
        }, this) },
        { path: "storefront-builder", element: /* @__PURE__ */ jsxDEV(Navigate, { to: "/business-front", replace: true }, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 305,
          columnNumber: 42
        }, this) },
        { path: "blog", element: /* @__PURE__ */ jsxDEV(BlogManagerPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 306,
          columnNumber: 28
        }, this) },
        { path: "websites", element: /* @__PURE__ */ jsxDEV(WebsitesPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 307,
          columnNumber: 32
        }, this) },
        /* Static path must be above :siteId or "templates" is treated as a site id. */
        { path: "websites/templates", element: /* @__PURE__ */ jsxDEV(WebsiteTemplateGallery, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 309,
          columnNumber: 42
        }, this) },
        { path: "websites/:siteId", element: /* @__PURE__ */ jsxDEV(WebsiteBuilder, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 310,
          columnNumber: 40
        }, this) },
        { path: "websites/:siteId/submissions", element: /* @__PURE__ */ jsxDEV(WebsiteSubmissions, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 311,
          columnNumber: 52
        }, this) },
        { path: "website-templates", element: /* @__PURE__ */ jsxDEV(Navigate, { to: "/websites/templates", replace: true }, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 312,
          columnNumber: 41
        }, this) },
        { path: "customers", element: /* @__PURE__ */ jsxDEV(Navigate, { to: "/master-data", replace: true }, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 313,
          columnNumber: 33
        }, this) },
        { path: "customers/:id", element: /* @__PURE__ */ jsxDEV(CustomerDetail, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 314,
          columnNumber: 37
        }, this) },
        { path: "reviews", element: /* @__PURE__ */ jsxDEV(ReviewsPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 315,
          columnNumber: 31
        }, this) },
        { path: "stores", element: /* @__PURE__ */ jsxDEV(StoresPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 316,
          columnNumber: 30
        }, this) },
        { path: "team", element: /* @__PURE__ */ jsxDEV(TeamPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 317,
          columnNumber: 28
        }, this) },
        { path: "roles", element: /* @__PURE__ */ jsxDEV(RolesPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 318,
          columnNumber: 29
        }, this) },
        { path: "settings", element: /* @__PURE__ */ jsxDEV(SettingsPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 319,
          columnNumber: 32
        }, this) },
        { path: "settings/support-activity", element: /* @__PURE__ */ jsxDEV(SupportActivityPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 320,
          columnNumber: 49
        }, this) },
        { path: "about", element: /* @__PURE__ */ jsxDEV(AboutPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 321,
          columnNumber: 29
        }, this) },
        { path: "system/modules", element: /* @__PURE__ */ jsxDEV(SystemModulesPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 322,
          columnNumber: 38
        }, this) },
        { path: "system/models", element: /* @__PURE__ */ jsxDEV(SystemModelsPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 323,
          columnNumber: 37
        }, this) },
        { path: "system/table-data", element: /* @__PURE__ */ jsxDEV(VendorAdminRoute, { children: /* @__PURE__ */ jsxDEV(SystemTableDataPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 324,
          columnNumber: 59
        }, this) }, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 324,
          columnNumber: 41
        }, this) },
        { path: "system/browse-table", element: /* @__PURE__ */ jsxDEV(VendorAdminRoute, { children: /* @__PURE__ */ jsxDEV(SystemBrowseTablePage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 325,
          columnNumber: 61
        }, this) }, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 325,
          columnNumber: 43
        }, this) },
        { path: "system/storefront-display", element: /* @__PURE__ */ jsxDEV(SystemStorefrontDisplayPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 326,
          columnNumber: 49
        }, this) },
        { path: "system/social-links", element: /* @__PURE__ */ jsxDEV(SystemSocialLinksPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 327,
          columnNumber: 43
        }, this) },
        {
          path: "system/assets",
          element: /* @__PURE__ */ jsxDEV(AssetsLayout, {}, void 0, false, {
            fileName: "/app/src/routes/index.tsx",
            lineNumber: 330,
            columnNumber: 14
          }, this),
          children: [
            { index: true, element: /* @__PURE__ */ jsxDEV(Navigate, { to: "images", replace: true }, void 0, false, {
              fileName: "/app/src/routes/index.tsx",
              lineNumber: 332,
              columnNumber: 29
            }, this) },
            { path: "images", element: /* @__PURE__ */ jsxDEV(AssetImagesPage, {}, void 0, false, {
              fileName: "/app/src/routes/index.tsx",
              lineNumber: 333,
              columnNumber: 32
            }, this) }
          ]
        },
        { path: "profile", element: /* @__PURE__ */ jsxDEV(ProfilePage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 336,
          columnNumber: 31
        }, this) },
        { path: "relationship-manager", element: /* @__PURE__ */ jsxDEV(RelationshipManagerPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 337,
          columnNumber: 44
        }, this) },
        { path: "plans", element: /* @__PURE__ */ jsxDEV(PlansPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 338,
          columnNumber: 29
        }, this) },
        { path: "bookings", element: /* @__PURE__ */ jsxDEV(BookingsPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 339,
          columnNumber: 32
        }, this) },
        { path: "bookings/:id", element: /* @__PURE__ */ jsxDEV(BookingDetail, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 340,
          columnNumber: 36
        }, this) },
        { path: "projects", element: /* @__PURE__ */ jsxDEV(ProjectsPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 341,
          columnNumber: 32
        }, this) },
        { path: "projects/:id", element: /* @__PURE__ */ jsxDEV(ProjectDetail, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 342,
          columnNumber: 36
        }, this) },
        { path: "notifications", element: /* @__PURE__ */ jsxDEV(NotificationsPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 343,
          columnNumber: 37
        }, this) },
        { path: "notifications/settings", element: /* @__PURE__ */ jsxDEV(NotificationSettingsPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 344,
          columnNumber: 46
        }, this) },
        // HR routes
        { path: "hr/employees", element: /* @__PURE__ */ jsxDEV(HREmployeesPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 346,
          columnNumber: 36
        }, this) },
        { path: "hr/employees/:id", element: /* @__PURE__ */ jsxDEV(HREmployeeDetailPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 347,
          columnNumber: 40
        }, this) },
        { path: "hr/attendance", element: /* @__PURE__ */ jsxDEV(HRAttendancePage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 348,
          columnNumber: 37
        }, this) },
        { path: "hr/attendance/my", element: /* @__PURE__ */ jsxDEV(MyAttendancePage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 349,
          columnNumber: 40
        }, this) },
        { path: "hr/attendance/report", element: /* @__PURE__ */ jsxDEV(AttendanceReportPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 350,
          columnNumber: 44
        }, this) },
        { path: "hr/leaves", element: /* @__PURE__ */ jsxDEV(HRLeaveRequestsPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 351,
          columnNumber: 33
        }, this) },
        { path: "hr/leaves/policies", element: /* @__PURE__ */ jsxDEV(LeavePoliciesPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 352,
          columnNumber: 42
        }, this) },
        { path: "hr/leaves/holidays", element: /* @__PURE__ */ jsxDEV(HolidaysPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 353,
          columnNumber: 42
        }, this) },
        { path: "hr/leaves/my", element: /* @__PURE__ */ jsxDEV(MyLeavesPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 354,
          columnNumber: 36
        }, this) },
        { path: "hr/salary", element: /* @__PURE__ */ jsxDEV(HRSalaryPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 355,
          columnNumber: 33
        }, this) },
        { path: "hr/payroll", element: /* @__PURE__ */ jsxDEV(HRPayrollPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 356,
          columnNumber: 34
        }, this) },
        { path: "hr/payroll/:id", element: /* @__PURE__ */ jsxDEV(HRPayrollDetailPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 357,
          columnNumber: 38
        }, this) },
        { path: "hr/offers", element: /* @__PURE__ */ jsxDEV(HROffersPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 358,
          columnNumber: 33
        }, this) },
        { path: "hr/offers/templates", element: /* @__PURE__ */ jsxDEV(HROfferTemplatesPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 359,
          columnNumber: 43
        }, this) },
        { path: "hr/departments", element: /* @__PURE__ */ jsxDEV(HRDepartmentsPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 360,
          columnNumber: 38
        }, this) },
        { path: "hr/designations", element: /* @__PURE__ */ jsxDEV(HRDesignationsPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 361,
          columnNumber: 39
        }, this) },
        // HR Extended ─ Recruitment & Onboarding
        { path: "hr/recruitment", element: /* @__PURE__ */ jsxDEV(HRRecruitmentPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 364,
          columnNumber: 38
        }, this) },
        { path: "hr/recruitment/jobs/:id", element: /* @__PURE__ */ jsxDEV(HRJobDetailPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 365,
          columnNumber: 47
        }, this) },
        { path: "hr/onboarding", element: /* @__PURE__ */ jsxDEV(HROnboardingPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 366,
          columnNumber: 37
        }, this) },
        { path: "hr/my-onboarding", element: /* @__PURE__ */ jsxDEV(MyOnboardingPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 367,
          columnNumber: 40
        }, this) },
        // HR Extended ─ Performance
        { path: "hr/performance", element: /* @__PURE__ */ jsxDEV(HRPerformancePage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 370,
          columnNumber: 38
        }, this) },
        { path: "hr/performance/cycles/:id", element: /* @__PURE__ */ jsxDEV(HRCycleDetailPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 371,
          columnNumber: 49
        }, this) },
        { path: "hr/performance/reviews/:id", element: /* @__PURE__ */ jsxDEV(HRReviewDetailPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 372,
          columnNumber: 50
        }, this) },
        { path: "hr/my-performance", element: /* @__PURE__ */ jsxDEV(MyPerformancePage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 373,
          columnNumber: 41
        }, this) },
        // HR Extended ─ Compliance
        { path: "hr/compliance", element: /* @__PURE__ */ jsxDEV(HRCompliancePage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 376,
          columnNumber: 37
        }, this) },
        { path: "hr/compliance/policies/:id", element: /* @__PURE__ */ jsxDEV(HRPolicyDetailPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 377,
          columnNumber: 50
        }, this) },
        { path: "hr/my-policies", element: /* @__PURE__ */ jsxDEV(MyPoliciesPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 378,
          columnNumber: 38
        }, this) },
        // HR Extended ─ Training
        { path: "hr/training", element: /* @__PURE__ */ jsxDEV(HRTrainingPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 381,
          columnNumber: 35
        }, this) },
        { path: "hr/training/:id", element: /* @__PURE__ */ jsxDEV(HRProgramDetailPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 382,
          columnNumber: 39
        }, this) },
        { path: "hr/my-training", element: /* @__PURE__ */ jsxDEV(MyTrainingPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 383,
          columnNumber: 38
        }, this) },
        { path: "hr/my-training/:id", element: /* @__PURE__ */ jsxDEV(CourseLearningPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 384,
          columnNumber: 42
        }, this) },
        // HR Extended ─ Employee Self Service
        { path: "hr/me", element: /* @__PURE__ */ jsxDEV(MyESSPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 387,
          columnNumber: 29
        }, this) },
        { path: "hr/announcements", element: /* @__PURE__ */ jsxDEV(HRAnnouncementsPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 388,
          columnNumber: 40
        }, this) },
        { path: "hr/my-announcements", element: /* @__PURE__ */ jsxDEV(MyAnnouncementsPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 389,
          columnNumber: 43
        }, this) },
        { path: "hr/expenses", element: /* @__PURE__ */ jsxDEV(HRExpensesPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 390,
          columnNumber: 35
        }, this) },
        { path: "hr/my-expenses", element: /* @__PURE__ */ jsxDEV(MyExpensesPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 391,
          columnNumber: 38
        }, this) },
        { path: "hr/helpdesk", element: /* @__PURE__ */ jsxDEV(HRHelpdeskPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 392,
          columnNumber: 35
        }, this) },
        { path: "hr/my-helpdesk", element: /* @__PURE__ */ jsxDEV(MyTicketsPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 393,
          columnNumber: 38
        }, this) },
        { path: "hr/helpdesk/:id", element: /* @__PURE__ */ jsxDEV(HRTicketDetailPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 394,
          columnNumber: 39
        }, this) },
        // Finance routes
        { path: "finance", element: /* @__PURE__ */ jsxDEV(FinanceDashboard, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 397,
          columnNumber: 31
        }, this) },
        { path: "finance/basic", element: /* @__PURE__ */ jsxDEV(FinanceBasic, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 398,
          columnNumber: 37
        }, this) },
        { path: "finance/cost-centers", element: /* @__PURE__ */ jsxDEV(FinanceCostCenters, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 399,
          columnNumber: 44
        }, this) },
        { path: "finance/coa", element: /* @__PURE__ */ jsxDEV(FinanceCOA, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 400,
          columnNumber: 35
        }, this) },
        { path: "finance/journal", element: /* @__PURE__ */ jsxDEV(FinanceJournal, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 401,
          columnNumber: 39
        }, this) },
        { path: "finance/trial-balance", element: /* @__PURE__ */ jsxDEV(FinanceTrialBalance, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 402,
          columnNumber: 45
        }, this) },
        { path: "finance/ar", element: /* @__PURE__ */ jsxDEV(FinanceAR, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 403,
          columnNumber: 34
        }, this) },
        { path: "finance/ap", element: /* @__PURE__ */ jsxDEV(FinanceAP, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 404,
          columnNumber: 34
        }, this) },
        { path: "finance/bank", element: /* @__PURE__ */ jsxDEV(FinanceBank, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 405,
          columnNumber: 36
        }, this) },
        { path: "finance/budgets", element: /* @__PURE__ */ jsxDEV(FinanceBudgets, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 406,
          columnNumber: 39
        }, this) },
        { path: "finance/assets", element: /* @__PURE__ */ jsxDEV(FinanceAssets, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 407,
          columnNumber: 38
        }, this) },
        { path: "finance/tax", element: /* @__PURE__ */ jsxDEV(FinanceTax, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 408,
          columnNumber: 35
        }, this) },
        { path: "finance/reports/pnl", element: /* @__PURE__ */ jsxDEV(FinancePnL, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 409,
          columnNumber: 43
        }, this) },
        { path: "finance/reports/balance-sheet", element: /* @__PURE__ */ jsxDEV(FinanceBalanceSheet, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 410,
          columnNumber: 53
        }, this) },
        { path: "finance/reports/cash-flow", element: /* @__PURE__ */ jsxDEV(FinanceCashFlow, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 411,
          columnNumber: 49
        }, this) },
        { path: "finance/reports/cost-analysis", element: /* @__PURE__ */ jsxDEV(FinanceCostAnalysis, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 412,
          columnNumber: 53
        }, this) },
        { path: "finance/reports/gl", element: /* @__PURE__ */ jsxDEV(FinanceGLReport, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 413,
          columnNumber: 42
        }, this) },
        { path: "finance/capital", element: /* @__PURE__ */ jsxDEV(FinanceCapital, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 414,
          columnNumber: 39
        }, this) },
        { path: "finance/approvals", element: /* @__PURE__ */ jsxDEV(FinanceApprovals, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 415,
          columnNumber: 41
        }, this) },
        { path: "finance/audit", element: /* @__PURE__ */ jsxDEV(FinanceAudit, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 416,
          columnNumber: 37
        }, this) },
        { path: "finance/periods", element: /* @__PURE__ */ jsxDEV(FinancePeriodControl, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 417,
          columnNumber: 39
        }, this) },
        { path: "finance/field-rules", element: /* @__PURE__ */ jsxDEV(FinanceFieldRuleConfig, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 418,
          columnNumber: 43
        }, this) },
        // Controlling (CO) — nested under dedicated COLayout sub-sidebar
        {
          path: "controlling",
          element: /* @__PURE__ */ jsxDEV(COLayout, {}, void 0, false, {
            fileName: "/app/src/routes/index.tsx",
            lineNumber: 423,
            columnNumber: 14
          }, this),
          children: [
            { index: true, element: /* @__PURE__ */ jsxDEV(ControllingDashboardPage, {}, void 0, false, {
              fileName: "/app/src/routes/index.tsx",
              lineNumber: 425,
              columnNumber: 29
            }, this) },
            // Cost planning
            { path: "product-costs", element: /* @__PURE__ */ jsxDEV(ControllingProductCostsPage, {}, void 0, false, {
              fileName: "/app/src/routes/index.tsx",
              lineNumber: 427,
              columnNumber: 39
            }, this) },
            { path: "routing", element: /* @__PURE__ */ jsxDEV(ControllingRoutingPage, {}, void 0, false, {
              fileName: "/app/src/routes/index.tsx",
              lineNumber: 428,
              columnNumber: 33
            }, this) },
            { path: "setup", element: /* @__PURE__ */ jsxDEV(ControllingSetupPage, {}, void 0, false, {
              fileName: "/app/src/routes/index.tsx",
              lineNumber: 429,
              columnNumber: 31
            }, this) },
            // Orders
            { path: "orders", element: /* @__PURE__ */ jsxDEV(ControllingManufacturingOrdersPage, {}, void 0, false, {
              fileName: "/app/src/routes/index.tsx",
              lineNumber: 431,
              columnNumber: 32
            }, this) },
            { path: "orders/:id", element: /* @__PURE__ */ jsxDEV(ControllingManufacturingOrderDetail, {}, void 0, false, {
              fileName: "/app/src/routes/index.tsx",
              lineNumber: 432,
              columnNumber: 36
            }, this) },
            { path: "internal-orders", element: /* @__PURE__ */ jsxDEV(ControllingInternalOrdersPage, {}, void 0, false, {
              fileName: "/app/src/routes/index.tsx",
              lineNumber: 433,
              columnNumber: 41
            }, this) },
            // Production execution
            { path: "production-process", element: /* @__PURE__ */ jsxDEV(ControllingProductionProcessPage, {}, void 0, false, {
              fileName: "/app/src/routes/index.tsx",
              lineNumber: 435,
              columnNumber: 44
            }, this) },
            { path: "goods-movements", element: /* @__PURE__ */ jsxDEV(ControllingGoodsMovementsPage, {}, void 0, false, {
              fileName: "/app/src/routes/index.tsx",
              lineNumber: 436,
              columnNumber: 41
            }, this) },
            { path: "activity-confirmations", element: /* @__PURE__ */ jsxDEV(ControllingActivityConfirmationsPage, {}, void 0, false, {
              fileName: "/app/src/routes/index.tsx",
              lineNumber: 437,
              columnNumber: 48
            }, this) },
            { path: "cost-bookings", element: /* @__PURE__ */ jsxDEV(ControllingCostBookingsPage, {}, void 0, false, {
              fileName: "/app/src/routes/index.tsx",
              lineNumber: 438,
              columnNumber: 39
            }, this) },
            // Analysis & reporting
            { path: "wip", element: /* @__PURE__ */ jsxDEV(ControllingWipReport, {}, void 0, false, {
              fileName: "/app/src/routes/index.tsx",
              lineNumber: 440,
              columnNumber: 29
            }, this) },
            { path: "variance-analysis", element: /* @__PURE__ */ jsxDEV(ControllingVarianceAnalysisPage, {}, void 0, false, {
              fileName: "/app/src/routes/index.tsx",
              lineNumber: 441,
              columnNumber: 43
            }, this) },
            { path: "internal-cost", element: /* @__PURE__ */ jsxDEV(ControllingInternalCostPage, {}, void 0, false, {
              fileName: "/app/src/routes/index.tsx",
              lineNumber: 442,
              columnNumber: 39
            }, this) },
            // Period end
            { path: "cost-allocations", element: /* @__PURE__ */ jsxDEV(ControllingCostAllocationsPage, {}, void 0, false, {
              fileName: "/app/src/routes/index.tsx",
              lineNumber: 444,
              columnNumber: 42
            }, this) },
            { path: "period-end", element: /* @__PURE__ */ jsxDEV(ControllingPeriodEndPage, {}, void 0, false, {
              fileName: "/app/src/routes/index.tsx",
              lineNumber: 445,
              columnNumber: 36
            }, this) }
          ]
        },
        // CRM routes
        { path: "crm", element: /* @__PURE__ */ jsxDEV(CrmDashboard, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 450,
          columnNumber: 27
        }, this) },
        { path: "crm/contacts", element: /* @__PURE__ */ jsxDEV(CrmContacts, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 451,
          columnNumber: 36
        }, this) },
        { path: "crm/accounts", element: /* @__PURE__ */ jsxDEV(CrmAccounts, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 452,
          columnNumber: 36
        }, this) },
        { path: "crm/leads", element: /* @__PURE__ */ jsxDEV(CrmLeads, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 453,
          columnNumber: 33
        }, this) },
        { path: "crm/pipeline", element: /* @__PURE__ */ jsxDEV(CrmPipeline, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 454,
          columnNumber: 36
        }, this) },
        { path: "crm/activities", element: /* @__PURE__ */ jsxDEV(CrmActivities, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 455,
          columnNumber: 38
        }, this) },
        { path: "crm/inbox", element: /* @__PURE__ */ jsxDEV(CrmInbox, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 456,
          columnNumber: 33
        }, this) },
        { path: "crm/tickets", element: /* @__PURE__ */ jsxDEV(CrmTickets, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 457,
          columnNumber: 35
        }, this) },
        { path: "crm/tickets/:id", element: /* @__PURE__ */ jsxDEV(CrmTicketDetail, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 458,
          columnNumber: 39
        }, this) },
        { path: "crm/kb", element: /* @__PURE__ */ jsxDEV(CrmKnowledgeBase, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 459,
          columnNumber: 30
        }, this) },
        { path: "crm/segments", element: /* @__PURE__ */ jsxDEV(CrmSegments, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 460,
          columnNumber: 36
        }, this) },
        { path: "crm/templates", element: /* @__PURE__ */ jsxDEV(CrmTemplates, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 461,
          columnNumber: 37
        }, this) },
        { path: "document-templates", element: /* @__PURE__ */ jsxDEV(DocumentTemplatesPage, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 462,
          columnNumber: 42
        }, this) },
        { path: "crm/campaigns", element: /* @__PURE__ */ jsxDEV(CrmCampaigns, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 463,
          columnNumber: 37
        }, this) },
        { path: "crm/workflows", element: /* @__PURE__ */ jsxDEV(CrmWorkflows, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 464,
          columnNumber: 37
        }, this) },
        { path: "crm/ai", element: /* @__PURE__ */ jsxDEV(CrmAIInsights, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 465,
          columnNumber: 30
        }, this) },
        { path: "crm/integrations", element: /* @__PURE__ */ jsxDEV(CrmIntegrations, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 466,
          columnNumber: 40
        }, this) },
        { path: "crm/reports", element: /* @__PURE__ */ jsxDEV(CrmReports, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 467,
          columnNumber: 35
        }, this) },
        { path: "crm/audit", element: /* @__PURE__ */ jsxDEV(CrmAudit, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 468,
          columnNumber: 33
        }, this) },
        { path: "crm/care-reminder", element: /* @__PURE__ */ jsxDEV(CrmCareReminder, {}, void 0, false, {
          fileName: "/app/src/routes/index.tsx",
          lineNumber: 469,
          columnNumber: 41
        }, this) },
        // Commission routes
        {
          path: "commission",
          element: /* @__PURE__ */ jsxDEV(CommissionLayout, {}, void 0, false, {
            fileName: "/app/src/routes/index.tsx",
            lineNumber: 473,
            columnNumber: 14
          }, this),
          children: [
            { index: true, element: /* @__PURE__ */ jsxDEV(CommissionLayout, {}, void 0, false, {
              fileName: "/app/src/routes/index.tsx",
              lineNumber: 475,
              columnNumber: 29
            }, this) },
            { path: "payees", element: /* @__PURE__ */ jsxDEV(CommissionPayees, {}, void 0, false, {
              fileName: "/app/src/routes/index.tsx",
              lineNumber: 476,
              columnNumber: 32
            }, this) },
            { path: "plans", element: /* @__PURE__ */ jsxDEV(CommissionPlans, {}, void 0, false, {
              fileName: "/app/src/routes/index.tsx",
              lineNumber: 477,
              columnNumber: 31
            }, this) },
            { path: "assignments", element: /* @__PURE__ */ jsxDEV(CommissionAssignments, {}, void 0, false, {
              fileName: "/app/src/routes/index.tsx",
              lineNumber: 478,
              columnNumber: 37
            }, this) },
            { path: "accruals", element: /* @__PURE__ */ jsxDEV(CommissionAccruals, {}, void 0, false, {
              fileName: "/app/src/routes/index.tsx",
              lineNumber: 479,
              columnNumber: 34
            }, this) },
            { path: "payouts", element: /* @__PURE__ */ jsxDEV(CommissionPayouts, {}, void 0, false, {
              fileName: "/app/src/routes/index.tsx",
              lineNumber: 480,
              columnNumber: 33
            }, this) },
            { path: "reports", element: /* @__PURE__ */ jsxDEV(CommissionReportPage, {}, void 0, false, {
              fileName: "/app/src/routes/index.tsx",
              lineNumber: 481,
              columnNumber: 33
            }, this) }
          ]
        }
      ]
    },
    // Catch-all: redirect to root (which will redirect to login if not authenticated)
    {
      path: "*",
      element: /* @__PURE__ */ jsxDEV(Navigate, { to: "/", replace: true }, void 0, false, {
        fileName: "/app/src/routes/index.tsx",
        lineNumber: 489,
        columnNumber: 12
      }, this)
    }
  ],
  {
    basename: routerBasename || void 0
  }
);

//# sourceMappingURL=data:application/json;base64,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dXRlciIsIk5hdmlnYXRlIiwiQXV0aExheW91dCIsIkRhc2hib2FyZExheW91dCIsIlByb3RlY3RlZFJvdXRlIiwiTG9naW4iLCJWZW5kb3JIYW5kb2ZmIiwiUmVnaXN0ZXIiLCJTaWdudXBXZWxjb21lIiwiRm9yZ290UGFzc3dvcmQiLCJEYXNoYm9hcmQiLCJPcmRlcnMiLCJRdW90YXRpb25zUGFnZSIsIk9yZGVyRGV0YWlsIiwiT3JkZXJBdWRpdFJlcG9ydCIsIlByb2R1Y3RzIiwiUHJvZHVjdEZvcm0iLCJQcm9kdWN0QXVkaXRSZXBvcnQiLCJTZXJ2aWNlcyIsIlNlcnZpY2VGb3JtIiwiU2VydmljZUF1ZGl0UmVwb3J0IiwiQ3VzdG9tZXJEZXRhaWwiLCJSZXZpZXdzUGFnZSIsIlRlYW1QYWdlIiwiUm9sZXNQYWdlIiwiU2V0dGluZ3NQYWdlIiwiU3VwcG9ydEFjdGl2aXR5UGFnZSIsIkFib3V0UGFnZSIsIkNhdGVnb3JpZXNQYWdlIiwiSW52ZW50b3J5IiwiU3RvcmFnZUxvY2F0aW9uc1BhZ2UiLCJQT1MiLCJSZXN0YXVyYW50Rmxvb3JQYWdlIiwiUmVzdGF1cmFudEtpdGNoZW5QYWdlIiwiUmVzdGF1cmFudFNldHVwUGFnZSIsIlJlc3RhdXJhbnRPcmRlclBhZ2UiLCJSZXN0YXVyYW50UmVzZXJ2YXRpb25zUGFnZSIsIlJlc3RhdXJhbnRSZXBvcnRzUGFnZSIsIlJlc3RhdXJhbnRNZW51UGFnZSIsIldvcmtzcGFjZUh1YlBhZ2UiLCJTdWJzY3JpcHRpb25zU2FsZXNQYWdlIiwiTWFya2V0cGxhY2VMZWFkc1BhZ2UiLCJSZW50YWxIdWJQYWdlIiwiSW52b2ljZXNQYWdlIiwiSW52b2ljZURldGFpbCIsIkludm9pY2VUZW1wbGF0ZXNQYWdlIiwiQ291cG9uc1BhZ2UiLCJSZXBvcnRzUGFnZSIsIlBsYW5zUGFnZSIsIkJvb2tpbmdzUGFnZSIsIkJvb2tpbmdEZXRhaWwiLCJQcm9qZWN0c1BhZ2UiLCJQcm9qZWN0RGV0YWlsIiwiTm90aWZpY2F0aW9uc1BhZ2UiLCJOb3RpZmljYXRpb25TZXR0aW5nc1BhZ2UiLCJNYXN0ZXJEYXRhUmVwb3J0IiwiTWFzdGVyRGF0YU5ldyIsIlB1cmNoYXNlT3JkZXJzUGFnZSIsIlB1cmNoYXNlT3JkZXJEZXRhaWwiLCJQT1RlbXBsYXRlc1BhZ2UiLCJDcmVkaXREZWJpdE1lbW9zIiwiUHJvZHVjdGlvbk9yZGVyc1BhZ2UiLCJTdG9yZXNQYWdlIiwiUHJvZmlsZVBhZ2UiLCJSZWxhdGlvbnNoaXBNYW5hZ2VyUGFnZSIsIkhSRGVwYXJ0bWVudHNQYWdlIiwiSFJEZXNpZ25hdGlvbnNQYWdlIiwiSFJFbXBsb3llZXNQYWdlIiwiSFJFbXBsb3llZURldGFpbFBhZ2UiLCJIUkF0dGVuZGFuY2VQYWdlIiwiTXlBdHRlbmRhbmNlUGFnZSIsIkF0dGVuZGFuY2VSZXBvcnRQYWdlIiwiSFJMZWF2ZVJlcXVlc3RzUGFnZSIsIkxlYXZlUG9saWNpZXNQYWdlIiwiSG9saWRheXNQYWdlIiwiTXlMZWF2ZXNQYWdlIiwiSFJTYWxhcnlQYWdlIiwiSFJQYXlyb2xsUGFnZSIsIkhSUGF5cm9sbERldGFpbFBhZ2UiLCJIUk9mZmVyc1BhZ2UiLCJIUk9mZmVyVGVtcGxhdGVzUGFnZSIsIkhSUmVjcnVpdG1lbnRQYWdlIiwiSFJKb2JEZXRhaWxQYWdlIiwiSFJPbmJvYXJkaW5nUGFnZSIsIk15T25ib2FyZGluZ1BhZ2UiLCJIUlBlcmZvcm1hbmNlUGFnZSIsIkhSQ3ljbGVEZXRhaWxQYWdlIiwiSFJSZXZpZXdEZXRhaWxQYWdlIiwiTXlQZXJmb3JtYW5jZVBhZ2UiLCJIUkNvbXBsaWFuY2VQYWdlIiwiSFJQb2xpY3lEZXRhaWxQYWdlIiwiTXlQb2xpY2llc1BhZ2UiLCJIUlRyYWluaW5nUGFnZSIsIkhSUHJvZ3JhbURldGFpbFBhZ2UiLCJNeVRyYWluaW5nUGFnZSIsIkNvdXJzZUxlYXJuaW5nUGFnZSIsIk15RVNTUGFnZSIsIkhSQW5ub3VuY2VtZW50c1BhZ2UiLCJNeUFubm91bmNlbWVudHNQYWdlIiwiSFJFeHBlbnNlc1BhZ2UiLCJNeUV4cGVuc2VzUGFnZSIsIkhSSGVscGRlc2tQYWdlIiwiTXlUaWNrZXRzUGFnZSIsIkhSVGlja2V0RGV0YWlsUGFnZSIsIkZpbmFuY2VEYXNoYm9hcmQiLCJGaW5hbmNlQmFzaWMiLCJGaW5hbmNlQ29zdENlbnRlcnMiLCJGaW5hbmNlQ09BIiwiRmluYW5jZUpvdXJuYWwiLCJGaW5hbmNlVHJpYWxCYWxhbmNlIiwiRmluYW5jZUFSIiwiRmluYW5jZUFQIiwiRmluYW5jZUJhbmsiLCJGaW5hbmNlQnVkZ2V0cyIsIkZpbmFuY2VBc3NldHMiLCJGaW5hbmNlVGF4IiwiRmluYW5jZVBuTCIsIkZpbmFuY2VCYWxhbmNlU2hlZXQiLCJGaW5hbmNlQ2FzaEZsb3ciLCJGaW5hbmNlQ29zdEFuYWx5c2lzIiwiRmluYW5jZUdMUmVwb3J0IiwiRmluYW5jZUNhcGl0YWwiLCJGaW5hbmNlQXBwcm92YWxzIiwiRmluYW5jZUF1ZGl0IiwiRmluYW5jZVBlcmlvZENvbnRyb2wiLCJGaW5hbmNlRmllbGRSdWxlQ29uZmlnIiwiQ09MYXlvdXQiLCJDb250cm9sbGluZ0Rhc2hib2FyZFBhZ2UiLCJDb250cm9sbGluZ1Byb2R1Y3RDb3N0c1BhZ2UiLCJDb250cm9sbGluZ01hbnVmYWN0dXJpbmdPcmRlcnNQYWdlIiwiQ29udHJvbGxpbmdTZXR1cFBhZ2UiLCJDb250cm9sbGluZ01hbnVmYWN0dXJpbmdPcmRlckRldGFpbCIsIkNvbnRyb2xsaW5nV2lwUmVwb3J0IiwiQ29udHJvbGxpbmdHb29kc01vdmVtZW50c1BhZ2UiLCJDb250cm9sbGluZ0FjdGl2aXR5Q29uZmlybWF0aW9uc1BhZ2UiLCJDb250cm9sbGluZ0Nvc3RBbGxvY2F0aW9uc1BhZ2UiLCJDb250cm9sbGluZ1BlcmlvZEVuZFBhZ2UiLCJDb250cm9sbGluZ0ludGVybmFsT3JkZXJzUGFnZSIsIkNvbnRyb2xsaW5nQ29zdEJvb2tpbmdzUGFnZSIsIkNvbnRyb2xsaW5nVmFyaWFuY2VBbmFseXNpc1BhZ2UiLCJDb250cm9sbGluZ1Byb2R1Y3Rpb25Qcm9jZXNzUGFnZSIsIkNvbnRyb2xsaW5nSW50ZXJuYWxDb3N0UGFnZSIsIkNvbnRyb2xsaW5nUm91dGluZ1BhZ2UiLCJDcm1EYXNoYm9hcmQiLCJDcm1Db250YWN0cyIsIkNybUFjY291bnRzIiwiQ3JtTGVhZHMiLCJDcm1QaXBlbGluZSIsIkNybUFjdGl2aXRpZXMiLCJDcm1JbmJveCIsIkNybVRpY2tldHMiLCJDcm1UaWNrZXREZXRhaWwiLCJDcm1Lbm93bGVkZ2VCYXNlIiwiQ3JtU2VnbWVudHMiLCJDcm1UZW1wbGF0ZXMiLCJEb2N1bWVudFRlbXBsYXRlc1BhZ2UiLCJTeXN0ZW1Nb2R1bGVzUGFnZSIsIlN5c3RlbU1vZGVsc1BhZ2UiLCJTeXN0ZW1UYWJsZURhdGFQYWdlIiwiU3lzdGVtQnJvd3NlVGFibGVQYWdlIiwiVmVuZG9yQWRtaW5Sb3V0ZSIsIlN5c3RlbVN0b3JlZnJvbnREaXNwbGF5UGFnZSIsIlN5c3RlbVNvY2lhbExpbmtzUGFnZSIsIkFzc2V0c0xheW91dCIsIkFzc2V0SW1hZ2VzUGFnZSIsIkNybUNhbXBhaWducyIsIkNybVdvcmtmbG93cyIsIkNybUFJSW5zaWdodHMiLCJDcm1JbnRlZ3JhdGlvbnMiLCJDcm1SZXBvcnRzIiwiQ3JtQXVkaXQiLCJDcm1DYXJlUmVtaW5kZXIiLCJCbG9nTWFuYWdlclBhZ2UiLCJXZWJzaXRlc1BhZ2UiLCJXZWJzaXRlQnVpbGRlciIsIldlYnNpdGVTdWJtaXNzaW9ucyIsIldlYnNpdGVUZW1wbGF0ZUdhbGxlcnkiLCJCdXNpbmVzc0Zyb250SHViUGFnZSIsIlN0b3JlZnJvbnRCcm93c2VyUHJldmlld1NoZWxsIiwiTGVnYWN5QnJvd3NlclByZXZpZXdSZWRpcmVjdCIsIlByZXZpZXdEcmFmdFN0b3JlUGF0aFJlZGlyZWN0IiwiQ29tbWlzc2lvbkxheW91dCIsIkNvbW1pc3Npb25QYXllZXMiLCJDb21taXNzaW9uUGxhbnMiLCJDb21taXNzaW9uQXNzaWdubWVudHMiLCJDb21taXNzaW9uQWNjcnVhbHMiLCJDb21taXNzaW9uUGF5b3V0cyIsIkNvbW1pc3Npb25SZXBvcnRQYWdlIiwicm91dGVyQmFzZW5hbWUiLCJpbXBvcnQiLCJlbnYiLCJWSVRFX1JPVVRFUl9CQVNFTkFNRSIsInJlcGxhY2UiLCJyb3V0ZXIiLCJwYXRoIiwiZWxlbWVudCIsImNoaWxkcmVuIiwiaW5kZXgiLCJiYXNlbmFtZSIsInVuZGVmaW5lZCJdLCJpZ25vcmVMaXN0IjpbXSwic291cmNlcyI6WyJpbmRleC50c3giXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgY3JlYXRlQnJvd3NlclJvdXRlciwgTmF2aWdhdGUgfSBmcm9tICdyZWFjdC1yb3V0ZXItZG9tJ1xuaW1wb3J0IEF1dGhMYXlvdXQgZnJvbSAnQC9sYXlvdXRzL0F1dGhMYXlvdXQnXG5pbXBvcnQgRGFzaGJvYXJkTGF5b3V0IGZyb20gJ0AvbGF5b3V0cy9EYXNoYm9hcmRMYXlvdXQnXG5pbXBvcnQgUHJvdGVjdGVkUm91dGUgZnJvbSAnLi9Qcm90ZWN0ZWRSb3V0ZSdcblxuaW1wb3J0IExvZ2luIGZyb20gJ0AvcGFnZXMvYXV0aC9Mb2dpbidcbmltcG9ydCBWZW5kb3JIYW5kb2ZmIGZyb20gJ0AvcGFnZXMvYXV0aC9IYW5kb2ZmJ1xuaW1wb3J0IFJlZ2lzdGVyIGZyb20gJ0AvcGFnZXMvYXV0aC9SZWdpc3RlcidcbmltcG9ydCBTaWdudXBXZWxjb21lIGZyb20gJ0AvcGFnZXMvYXV0aC9TaWdudXBXZWxjb21lJ1xuaW1wb3J0IEZvcmdvdFBhc3N3b3JkIGZyb20gJ0AvcGFnZXMvYXV0aC9Gb3Jnb3RQYXNzd29yZCdcbmltcG9ydCBEYXNoYm9hcmQgZnJvbSAnQC9wYWdlcy9kYXNoYm9hcmQvaW5kZXgnXG5pbXBvcnQgT3JkZXJzIGZyb20gJ0AvcGFnZXMvb3JkZXJzL2luZGV4J1xuaW1wb3J0IFF1b3RhdGlvbnNQYWdlIGZyb20gJ0AvcGFnZXMvcXVvdGF0aW9ucy9pbmRleCdcbmltcG9ydCBPcmRlckRldGFpbCBmcm9tICdAL3BhZ2VzL29yZGVycy9PcmRlckRldGFpbCdcbmltcG9ydCBPcmRlckF1ZGl0UmVwb3J0IGZyb20gJ0AvcGFnZXMvb3JkZXJzL09yZGVyQXVkaXRSZXBvcnQnXG5pbXBvcnQgUHJvZHVjdHMgZnJvbSAnQC9wYWdlcy9wcm9kdWN0cy9pbmRleCdcbmltcG9ydCBQcm9kdWN0Rm9ybSBmcm9tICdAL3BhZ2VzL3Byb2R1Y3RzL1Byb2R1Y3RGb3JtJ1xuaW1wb3J0IFByb2R1Y3RBdWRpdFJlcG9ydCBmcm9tICdAL3BhZ2VzL3Byb2R1Y3RzL1Byb2R1Y3RBdWRpdFJlcG9ydCdcbmltcG9ydCBTZXJ2aWNlcyBmcm9tICdAL3BhZ2VzL3NlcnZpY2VzL2luZGV4J1xuaW1wb3J0IFNlcnZpY2VGb3JtIGZyb20gJ0AvcGFnZXMvc2VydmljZXMvU2VydmljZUZvcm0nXG5pbXBvcnQgU2VydmljZUF1ZGl0UmVwb3J0IGZyb20gJ0AvcGFnZXMvc2VydmljZXMvU2VydmljZUF1ZGl0UmVwb3J0J1xuaW1wb3J0IEN1c3RvbWVycyBmcm9tICdAL3BhZ2VzL2N1c3RvbWVycy9pbmRleCdcbmltcG9ydCBDdXN0b21lckRldGFpbCBmcm9tICdAL3BhZ2VzL2N1c3RvbWVycy9DdXN0b21lckRldGFpbCdcbmltcG9ydCBSZXZpZXdzUGFnZSBmcm9tICdAL3BhZ2VzL3Jldmlld3MvaW5kZXgnXG5pbXBvcnQgVGVhbVBhZ2UgZnJvbSAnQC9wYWdlcy90ZWFtL2luZGV4J1xuaW1wb3J0IFJvbGVzUGFnZSBmcm9tICdAL3BhZ2VzL3JvbGVzL2luZGV4J1xuaW1wb3J0IFNldHRpbmdzUGFnZSBmcm9tICdAL3BhZ2VzL3NldHRpbmdzL2luZGV4J1xuaW1wb3J0IFN1cHBvcnRBY3Rpdml0eVBhZ2UgZnJvbSAnQC9wYWdlcy9zZXR0aW5ncy9TdXBwb3J0QWN0aXZpdHknXG5pbXBvcnQgQWJvdXRQYWdlIGZyb20gJ0AvcGFnZXMvYWJvdXQvaW5kZXgnXG5pbXBvcnQgQ2F0ZWdvcmllc1BhZ2UgZnJvbSAnQC9wYWdlcy9jYXRlZ29yaWVzL2luZGV4J1xuaW1wb3J0IEludmVudG9yeSBmcm9tICdAL3BhZ2VzL2ludmVudG9yeS9pbmRleCdcbmltcG9ydCBTdG9yYWdlTG9jYXRpb25zUGFnZSBmcm9tICdAL3BhZ2VzL2ludmVudG9yeS9TdG9yYWdlTG9jYXRpb25zJ1xuaW1wb3J0IFBPUyBmcm9tICdAL3BhZ2VzL3Bvcy9pbmRleCdcbmltcG9ydCBSZXN0YXVyYW50Rmxvb3JQYWdlIGZyb20gJ0AvcGFnZXMvcmVzdGF1cmFudC9GbG9vcidcbmltcG9ydCBSZXN0YXVyYW50S2l0Y2hlblBhZ2UgZnJvbSAnQC9wYWdlcy9yZXN0YXVyYW50L0tpdGNoZW4nXG5pbXBvcnQgUmVzdGF1cmFudFNldHVwUGFnZSBmcm9tICdAL3BhZ2VzL3Jlc3RhdXJhbnQvU2V0dXAnXG5pbXBvcnQgUmVzdGF1cmFudE9yZGVyUGFnZSBmcm9tICdAL3BhZ2VzL3Jlc3RhdXJhbnQvT3JkZXInXG5pbXBvcnQgUmVzdGF1cmFudFJlc2VydmF0aW9uc1BhZ2UgZnJvbSAnQC9wYWdlcy9yZXN0YXVyYW50L1Jlc2VydmF0aW9ucydcbmltcG9ydCBSZXN0YXVyYW50UmVwb3J0c1BhZ2UgZnJvbSAnQC9wYWdlcy9yZXN0YXVyYW50L1JlcG9ydHMnXG5pbXBvcnQgUmVzdGF1cmFudE1lbnVQYWdlIGZyb20gJ0AvcGFnZXMvcmVzdGF1cmFudC9NZW51J1xuaW1wb3J0IFdvcmtzcGFjZUh1YlBhZ2UgZnJvbSAnQC9wYWdlcy93b3Jrc3BhY2UvSHViJ1xuaW1wb3J0IFN1YnNjcmlwdGlvbnNTYWxlc1BhZ2UgZnJvbSAnQC9wYWdlcy9zYWxlcy9TdWJzY3JpcHRpb25zJ1xuaW1wb3J0IE1hcmtldHBsYWNlTGVhZHNQYWdlIGZyb20gJ0AvcGFnZXMvc2FsZXMvTWFya2V0cGxhY2VMZWFkcydcbmltcG9ydCBSZW50YWxIdWJQYWdlIGZyb20gJ0AvcGFnZXMvcmVudGFsL1JlbnRhbEh1YidcbmltcG9ydCBJbnZvaWNlc1BhZ2UgZnJvbSAnQC9wYWdlcy9pbnZvaWNlcy9pbmRleCdcbmltcG9ydCBJbnZvaWNlRGV0YWlsIGZyb20gJ0AvcGFnZXMvaW52b2ljZXMvSW52b2ljZURldGFpbCdcbmltcG9ydCBJbnZvaWNlVGVtcGxhdGVzUGFnZSBmcm9tICdAL3BhZ2VzL2ludm9pY2VzL0ludm9pY2VUZW1wbGF0ZXMnXG5pbXBvcnQgQ291cG9uc1BhZ2UgZnJvbSAnQC9wYWdlcy9jb3Vwb25zL2luZGV4J1xuaW1wb3J0IFJlcG9ydHNQYWdlIGZyb20gJ0AvcGFnZXMvcmVwb3J0cy9pbmRleCdcbmltcG9ydCBQbGFuc1BhZ2UgZnJvbSAnQC9wYWdlcy9wbGFucy9pbmRleCdcbmltcG9ydCBCb29raW5nc1BhZ2UgZnJvbSAnQC9wYWdlcy9ib29raW5ncy9pbmRleCdcbmltcG9ydCBCb29raW5nRGV0YWlsIGZyb20gJ0AvcGFnZXMvYm9va2luZ3MvQm9va2luZ0RldGFpbCdcbmltcG9ydCBQcm9qZWN0c1BhZ2UgZnJvbSAnQC9wYWdlcy9wcm9qZWN0cy9pbmRleCdcbmltcG9ydCBQcm9qZWN0RGV0YWlsIGZyb20gJ0AvcGFnZXMvcHJvamVjdHMvUHJvamVjdERldGFpbCdcbmltcG9ydCBOb3RpZmljYXRpb25zUGFnZSBmcm9tICdAL3BhZ2VzL25vdGlmaWNhdGlvbnMvaW5kZXgnXG5pbXBvcnQgTm90aWZpY2F0aW9uU2V0dGluZ3NQYWdlIGZyb20gJ0AvcGFnZXMvbm90aWZpY2F0aW9ucy9zZXR0aW5ncydcbmltcG9ydCBTdXBwbGllcnNQYWdlIGZyb20gJ0AvcGFnZXMvc3VwcGxpZXJzL2luZGV4J1xuaW1wb3J0IE1hc3RlckRhdGFSZXBvcnQgZnJvbSAnQC9wYWdlcy9tYXN0ZXItZGF0YS9NYXN0ZXJEYXRhUmVwb3J0J1xuaW1wb3J0IE1hc3RlckRhdGFOZXcgICAgZnJvbSAnQC9wYWdlcy9tYXN0ZXItZGF0YS9NYXN0ZXJEYXRhTmV3J1xuaW1wb3J0IFB1cmNoYXNlT3JkZXJzUGFnZSBmcm9tICdAL3BhZ2VzL3B1cmNoYXNlLW9yZGVycy9pbmRleCdcbmltcG9ydCBQdXJjaGFzZU9yZGVyRGV0YWlsIGZyb20gJ0AvcGFnZXMvcHVyY2hhc2Utb3JkZXJzL1B1cmNoYXNlT3JkZXJEZXRhaWwnXG5pbXBvcnQgUE9UZW1wbGF0ZXNQYWdlIGZyb20gJ0AvcGFnZXMvcHVyY2hhc2Utb3JkZXJzL1BPVGVtcGxhdGVzJ1xuaW1wb3J0IENyZWRpdERlYml0TWVtb3MgZnJvbSAnQC9wYWdlcy9maW5hbmNlL0NyZWRpdERlYml0TWVtb3MnXG5pbXBvcnQgUHJvZHVjdGlvbk9yZGVyc1BhZ2UgZnJvbSAnQC9wYWdlcy9wcm9kdWN0aW9uL2luZGV4J1xuaW1wb3J0IFN0b3Jlc1BhZ2UgZnJvbSAnQC9wYWdlcy9zdG9yZXMvaW5kZXgnXG5pbXBvcnQgUHJvZmlsZVBhZ2UgZnJvbSAnQC9wYWdlcy9wcm9maWxlL2luZGV4J1xuaW1wb3J0IFJlbGF0aW9uc2hpcE1hbmFnZXJQYWdlIGZyb20gJ0AvcGFnZXMvcmVsYXRpb25zaGlwLW1hbmFnZXIvaW5kZXgnXG5cbi8vIEhSIHBhZ2VzXG5pbXBvcnQgSFJEZXBhcnRtZW50c1BhZ2UgZnJvbSAnQC9wYWdlcy9oci9kZXBhcnRtZW50cydcbmltcG9ydCBIUkRlc2lnbmF0aW9uc1BhZ2UgZnJvbSAnQC9wYWdlcy9oci9kZXNpZ25hdGlvbnMnXG5pbXBvcnQgSFJFbXBsb3llZXNQYWdlIGZyb20gJ0AvcGFnZXMvaHIvZW1wbG95ZWVzL2luZGV4J1xuaW1wb3J0IEhSRW1wbG95ZWVEZXRhaWxQYWdlIGZyb20gJ0AvcGFnZXMvaHIvZW1wbG95ZWVzL0VtcGxveWVlRGV0YWlsJ1xuaW1wb3J0IEhSQXR0ZW5kYW5jZVBhZ2UgZnJvbSAnQC9wYWdlcy9oci9hdHRlbmRhbmNlL2luZGV4J1xuaW1wb3J0IE15QXR0ZW5kYW5jZVBhZ2UgZnJvbSAnQC9wYWdlcy9oci9hdHRlbmRhbmNlL015QXR0ZW5kYW5jZSdcbmltcG9ydCBBdHRlbmRhbmNlUmVwb3J0UGFnZSBmcm9tICdAL3BhZ2VzL2hyL2F0dGVuZGFuY2UvQXR0ZW5kYW5jZVJlcG9ydCdcbmltcG9ydCBIUkxlYXZlUmVxdWVzdHNQYWdlIGZyb20gJ0AvcGFnZXMvaHIvbGVhdmVzL2luZGV4J1xuaW1wb3J0IExlYXZlUG9saWNpZXNQYWdlIGZyb20gJ0AvcGFnZXMvaHIvbGVhdmVzL1BvbGljaWVzJ1xuaW1wb3J0IEhvbGlkYXlzUGFnZSBmcm9tICdAL3BhZ2VzL2hyL2xlYXZlcy9Ib2xpZGF5cydcbmltcG9ydCBNeUxlYXZlc1BhZ2UgZnJvbSAnQC9wYWdlcy9oci9sZWF2ZXMvTXlMZWF2ZXMnXG5pbXBvcnQgSFJTYWxhcnlQYWdlIGZyb20gJ0AvcGFnZXMvaHIvc2FsYXJ5L2luZGV4J1xuaW1wb3J0IEhSUGF5cm9sbFBhZ2UgZnJvbSAnQC9wYWdlcy9oci9wYXlyb2xsL2luZGV4J1xuaW1wb3J0IEhSUGF5cm9sbERldGFpbFBhZ2UgZnJvbSAnQC9wYWdlcy9oci9wYXlyb2xsL1BheXJvbGxEZXRhaWwnXG5pbXBvcnQgSFJPZmZlcnNQYWdlIGZyb20gJ0AvcGFnZXMvaHIvb2ZmZXJzL2luZGV4J1xuaW1wb3J0IEhST2ZmZXJUZW1wbGF0ZXNQYWdlIGZyb20gJ0AvcGFnZXMvaHIvb2ZmZXJzL1RlbXBsYXRlcydcblxuLy8gSFIgRXh0ZW5kZWQgbW9kdWxlc1xuaW1wb3J0IEhSUmVjcnVpdG1lbnRQYWdlIGZyb20gJ0AvcGFnZXMvaHIvcmVjcnVpdG1lbnQvaW5kZXgnXG5pbXBvcnQgSFJKb2JEZXRhaWxQYWdlIGZyb20gJ0AvcGFnZXMvaHIvcmVjcnVpdG1lbnQvSm9iRGV0YWlsJ1xuaW1wb3J0IEhST25ib2FyZGluZ1BhZ2UgZnJvbSAnQC9wYWdlcy9oci9vbmJvYXJkaW5nL2luZGV4J1xuaW1wb3J0IE15T25ib2FyZGluZ1BhZ2UgZnJvbSAnQC9wYWdlcy9oci9vbmJvYXJkaW5nL015T25ib2FyZGluZydcbmltcG9ydCBIUlBlcmZvcm1hbmNlUGFnZSBmcm9tICdAL3BhZ2VzL2hyL3BlcmZvcm1hbmNlL2luZGV4J1xuaW1wb3J0IEhSQ3ljbGVEZXRhaWxQYWdlIGZyb20gJ0AvcGFnZXMvaHIvcGVyZm9ybWFuY2UvQ3ljbGVEZXRhaWwnXG5pbXBvcnQgSFJSZXZpZXdEZXRhaWxQYWdlIGZyb20gJ0AvcGFnZXMvaHIvcGVyZm9ybWFuY2UvUmV2aWV3RGV0YWlsJ1xuaW1wb3J0IE15UGVyZm9ybWFuY2VQYWdlIGZyb20gJ0AvcGFnZXMvaHIvcGVyZm9ybWFuY2UvTXlQZXJmb3JtYW5jZSdcbmltcG9ydCBIUkNvbXBsaWFuY2VQYWdlIGZyb20gJ0AvcGFnZXMvaHIvY29tcGxpYW5jZS9pbmRleCdcbmltcG9ydCBIUlBvbGljeURldGFpbFBhZ2UgZnJvbSAnQC9wYWdlcy9oci9jb21wbGlhbmNlL1BvbGljeURldGFpbCdcbmltcG9ydCBNeVBvbGljaWVzUGFnZSBmcm9tICdAL3BhZ2VzL2hyL2NvbXBsaWFuY2UvTXlQb2xpY2llcydcbmltcG9ydCBIUlRyYWluaW5nUGFnZSBmcm9tICdAL3BhZ2VzL2hyL3RyYWluaW5nL2luZGV4J1xuaW1wb3J0IEhSUHJvZ3JhbURldGFpbFBhZ2UgZnJvbSAnQC9wYWdlcy9oci90cmFpbmluZy9Qcm9ncmFtRGV0YWlsJ1xuaW1wb3J0IE15VHJhaW5pbmdQYWdlIGZyb20gJ0AvcGFnZXMvaHIvdHJhaW5pbmcvTXlUcmFpbmluZydcbmltcG9ydCBDb3Vyc2VMZWFybmluZ1BhZ2UgZnJvbSAnQC9wYWdlcy9oci90cmFpbmluZy9Db3Vyc2VMZWFybmluZydcbmltcG9ydCBNeUVTU1BhZ2UgZnJvbSAnQC9wYWdlcy9oci9lc3MvTXlFU1MnXG5pbXBvcnQgSFJBbm5vdW5jZW1lbnRzUGFnZSBmcm9tICdAL3BhZ2VzL2hyL2Fubm91bmNlbWVudHMvaW5kZXgnXG5pbXBvcnQgTXlBbm5vdW5jZW1lbnRzUGFnZSBmcm9tICdAL3BhZ2VzL2hyL2Fubm91bmNlbWVudHMvTXlBbm5vdW5jZW1lbnRzJ1xuaW1wb3J0IEhSRXhwZW5zZXNQYWdlIGZyb20gJ0AvcGFnZXMvaHIvZXhwZW5zZXMvaW5kZXgnXG5pbXBvcnQgTXlFeHBlbnNlc1BhZ2UgZnJvbSAnQC9wYWdlcy9oci9leHBlbnNlcy9NeUV4cGVuc2VzJ1xuaW1wb3J0IEhSSGVscGRlc2tQYWdlIGZyb20gJ0AvcGFnZXMvaHIvaGVscGRlc2svaW5kZXgnXG5pbXBvcnQgTXlUaWNrZXRzUGFnZSBmcm9tICdAL3BhZ2VzL2hyL2hlbHBkZXNrL015VGlja2V0cydcbmltcG9ydCBIUlRpY2tldERldGFpbFBhZ2UgZnJvbSAnQC9wYWdlcy9oci9oZWxwZGVzay9UaWNrZXREZXRhaWwnXG5cbi8vIEZpbmFuY2UgcGFnZXMgKGxhenktaW1wb3J0ZWQgYXMgcmVhbCBmaWxlcyB3aWxsIGJlIGNyZWF0ZWQpXG5pbXBvcnQgRmluYW5jZURhc2hib2FyZCBmcm9tICdAL3BhZ2VzL2ZpbmFuY2UvaW5kZXgnXG5pbXBvcnQgRmluYW5jZUJhc2ljIGZyb20gJ0AvcGFnZXMvZmluYW5jZS9CYXNpY0ZpbmFuY2UnXG5pbXBvcnQgRmluYW5jZUNvc3RDZW50ZXJzIGZyb20gJ0AvcGFnZXMvZmluYW5jZS9Db3N0Q2VudGVycydcbmltcG9ydCBGaW5hbmNlQ09BIGZyb20gJ0AvcGFnZXMvZmluYW5jZS9DaGFydE9mQWNjb3VudHMnXG5pbXBvcnQgRmluYW5jZUpvdXJuYWwgZnJvbSAnQC9wYWdlcy9maW5hbmNlL0pvdXJuYWxFbnRyaWVzJ1xuaW1wb3J0IEZpbmFuY2VUcmlhbEJhbGFuY2UgZnJvbSAnQC9wYWdlcy9maW5hbmNlL1RyaWFsQmFsYW5jZSdcbmltcG9ydCBGaW5hbmNlQVIgZnJvbSAnQC9wYWdlcy9maW5hbmNlL0FjY291bnRzUmVjZWl2YWJsZSdcbmltcG9ydCBGaW5hbmNlQVAgZnJvbSAnQC9wYWdlcy9maW5hbmNlL0FjY291bnRzUGF5YWJsZSdcbmltcG9ydCBGaW5hbmNlQmFuayBmcm9tICdAL3BhZ2VzL2ZpbmFuY2UvQmFua0Nhc2gnXG5pbXBvcnQgRmluYW5jZUJ1ZGdldHMgZnJvbSAnQC9wYWdlcy9maW5hbmNlL0J1ZGdldHNGb3JlY2FzdCdcbmltcG9ydCBGaW5hbmNlQXNzZXRzIGZyb20gJ0AvcGFnZXMvZmluYW5jZS9GaXhlZEFzc2V0cydcbmltcG9ydCBGaW5hbmNlVGF4IGZyb20gJ0AvcGFnZXMvZmluYW5jZS9UYXhSZXR1cm5zJ1xuaW1wb3J0IEZpbmFuY2VQbkwgZnJvbSAnQC9wYWdlcy9maW5hbmNlL3JlcG9ydHMvUHJvZml0TG9zcydcbmltcG9ydCBGaW5hbmNlQmFsYW5jZVNoZWV0IGZyb20gJ0AvcGFnZXMvZmluYW5jZS9yZXBvcnRzL0JhbGFuY2VTaGVldCdcbmltcG9ydCBGaW5hbmNlQ2FzaEZsb3cgZnJvbSAnQC9wYWdlcy9maW5hbmNlL3JlcG9ydHMvQ2FzaEZsb3cnXG5pbXBvcnQgRmluYW5jZUNvc3RBbmFseXNpcyBmcm9tICdAL3BhZ2VzL2ZpbmFuY2UvcmVwb3J0cy9Db3N0QW5hbHlzaXMnXG5pbXBvcnQgRmluYW5jZUdMUmVwb3J0IGZyb20gJ0AvcGFnZXMvZmluYW5jZS9yZXBvcnRzL0dMUmVwb3J0J1xuaW1wb3J0IEZpbmFuY2VDYXBpdGFsIGZyb20gJ0AvcGFnZXMvZmluYW5jZS9DYXBpdGFsJ1xuaW1wb3J0IEZpbmFuY2VBcHByb3ZhbHMgZnJvbSAnQC9wYWdlcy9maW5hbmNlL0FwcHJvdmFscydcbmltcG9ydCBGaW5hbmNlQXVkaXQgZnJvbSAnQC9wYWdlcy9maW5hbmNlL0F1ZGl0TG9nJ1xuaW1wb3J0IEZpbmFuY2VQZXJpb2RDb250cm9sIGZyb20gJ0AvcGFnZXMvZmluYW5jZS9QZXJpb2RDb250cm9sJ1xuaW1wb3J0IEZpbmFuY2VGaWVsZFJ1bGVDb25maWcgZnJvbSAnQC9wYWdlcy9maW5hbmNlL0ZpZWxkUnVsZUNvbmZpZydcbmltcG9ydCBDT0xheW91dCBmcm9tICdAL2xheW91dHMvQ09MYXlvdXQnXG5pbXBvcnQgQ29udHJvbGxpbmdEYXNoYm9hcmRQYWdlIGZyb20gJ0AvcGFnZXMvY29udHJvbGxpbmcvaW5kZXgnXG5pbXBvcnQgQ29udHJvbGxpbmdQcm9kdWN0Q29zdHNQYWdlIGZyb20gJ0AvcGFnZXMvY29udHJvbGxpbmcvUHJvZHVjdENvc3RzJ1xuaW1wb3J0IENvbnRyb2xsaW5nTWFudWZhY3R1cmluZ09yZGVyc1BhZ2UgZnJvbSAnQC9wYWdlcy9jb250cm9sbGluZy9NYW51ZmFjdHVyaW5nT3JkZXJzJ1xuaW1wb3J0IENvbnRyb2xsaW5nU2V0dXBQYWdlIGZyb20gJ0AvcGFnZXMvY29udHJvbGxpbmcvU2V0dXAnXG5pbXBvcnQgQ29udHJvbGxpbmdNYW51ZmFjdHVyaW5nT3JkZXJEZXRhaWwgZnJvbSAnQC9wYWdlcy9jb250cm9sbGluZy9NYW51ZmFjdHVyaW5nT3JkZXJEZXRhaWwnXG5pbXBvcnQgQ29udHJvbGxpbmdXaXBSZXBvcnQgZnJvbSAnQC9wYWdlcy9jb250cm9sbGluZy9XaXBSZXBvcnQnXG5pbXBvcnQgQ29udHJvbGxpbmdHb29kc01vdmVtZW50c1BhZ2UgZnJvbSAnQC9wYWdlcy9jb250cm9sbGluZy9Hb29kc01vdmVtZW50cydcbmltcG9ydCBDb250cm9sbGluZ0FjdGl2aXR5Q29uZmlybWF0aW9uc1BhZ2UgZnJvbSAnQC9wYWdlcy9jb250cm9sbGluZy9BY3Rpdml0eUNvbmZpcm1hdGlvbnMnXG5pbXBvcnQgQ29udHJvbGxpbmdDb3N0QWxsb2NhdGlvbnNQYWdlIGZyb20gJ0AvcGFnZXMvY29udHJvbGxpbmcvQ29zdEFsbG9jYXRpb25zJ1xuaW1wb3J0IENvbnRyb2xsaW5nUGVyaW9kRW5kUGFnZSBmcm9tICdAL3BhZ2VzL2NvbnRyb2xsaW5nL1BlcmlvZEVuZCdcbmltcG9ydCBDb250cm9sbGluZ0ludGVybmFsT3JkZXJzUGFnZSBmcm9tICdAL3BhZ2VzL2NvbnRyb2xsaW5nL0ludGVybmFsT3JkZXJzJ1xuaW1wb3J0IENvbnRyb2xsaW5nQ29zdEJvb2tpbmdzUGFnZSBmcm9tICdAL3BhZ2VzL2NvbnRyb2xsaW5nL0Nvc3RCb29raW5ncydcbmltcG9ydCBDb250cm9sbGluZ1ZhcmlhbmNlQW5hbHlzaXNQYWdlIGZyb20gJ0AvcGFnZXMvY29udHJvbGxpbmcvVmFyaWFuY2VBbmFseXNpcydcbmltcG9ydCBDb250cm9sbGluZ1Byb2R1Y3Rpb25Qcm9jZXNzUGFnZSBmcm9tICdAL3BhZ2VzL2NvbnRyb2xsaW5nL1Byb2R1Y3Rpb25Qcm9jZXNzJ1xuaW1wb3J0IENvbnRyb2xsaW5nSW50ZXJuYWxDb3N0UGFnZSBmcm9tICdAL3BhZ2VzL2NvbnRyb2xsaW5nL0ludGVybmFsQ29zdE1hbmFnZW1lbnQnXG5pbXBvcnQgQ29udHJvbGxpbmdSb3V0aW5nUGFnZSBmcm9tICdAL3BhZ2VzL2NvbnRyb2xsaW5nL1JvdXRpbmcnXG5cbi8vIENSTSBwYWdlc1xuaW1wb3J0IENybURhc2hib2FyZCBmcm9tICdAL3BhZ2VzL2NybS9pbmRleCdcbmltcG9ydCBDcm1Db250YWN0cyBmcm9tICdAL3BhZ2VzL2NybS9Db250YWN0cydcbmltcG9ydCBDcm1BY2NvdW50cyBmcm9tICdAL3BhZ2VzL2NybS9BY2NvdW50cydcbmltcG9ydCBDcm1MZWFkcyBmcm9tICdAL3BhZ2VzL2NybS9MZWFkcydcbmltcG9ydCBDcm1QaXBlbGluZSBmcm9tICdAL3BhZ2VzL2NybS9QaXBlbGluZSdcbmltcG9ydCBDcm1BY3Rpdml0aWVzIGZyb20gJ0AvcGFnZXMvY3JtL0FjdGl2aXRpZXMnXG5pbXBvcnQgQ3JtSW5ib3ggZnJvbSAnQC9wYWdlcy9jcm0vSW5ib3gnXG5pbXBvcnQgQ3JtVGlja2V0cyBmcm9tICdAL3BhZ2VzL2NybS9UaWNrZXRzJ1xuaW1wb3J0IENybVRpY2tldERldGFpbCBmcm9tICdAL3BhZ2VzL2NybS9UaWNrZXREZXRhaWwnXG5pbXBvcnQgQ3JtS25vd2xlZGdlQmFzZSBmcm9tICdAL3BhZ2VzL2NybS9Lbm93bGVkZ2VCYXNlJ1xuaW1wb3J0IENybVNlZ21lbnRzIGZyb20gJ0AvcGFnZXMvY3JtL1NlZ21lbnRzJ1xuaW1wb3J0IENybVRlbXBsYXRlcyBmcm9tICdAL3BhZ2VzL2NybS9UZW1wbGF0ZXMnXG5pbXBvcnQgRG9jdW1lbnRUZW1wbGF0ZXNQYWdlIGZyb20gJ0AvcGFnZXMvZG9jdW1lbnQtdGVtcGxhdGVzL2luZGV4J1xuaW1wb3J0IFN5c3RlbU1vZHVsZXNQYWdlIGZyb20gJ0AvcGFnZXMvc3lzdGVtL01vZHVsZXMnXG5pbXBvcnQgU3lzdGVtTW9kZWxzUGFnZSBmcm9tICdAL3BhZ2VzL3N5c3RlbS9Nb2RlbHMnXG5pbXBvcnQgU3lzdGVtVGFibGVEYXRhUGFnZSBmcm9tICdAL3BhZ2VzL3N5c3RlbS9UYWJsZURhdGEnXG5pbXBvcnQgU3lzdGVtQnJvd3NlVGFibGVQYWdlIGZyb20gJ0AvcGFnZXMvc3lzdGVtL0Jyb3dzZVRhYmxlJ1xuaW1wb3J0IFZlbmRvckFkbWluUm91dGUgZnJvbSAnLi9WZW5kb3JBZG1pblJvdXRlJ1xuaW1wb3J0IFN5c3RlbVN0b3JlZnJvbnREaXNwbGF5UGFnZSBmcm9tICdAL3BhZ2VzL3N5c3RlbS9TdG9yZWZyb250RGlzcGxheSdcbmltcG9ydCBTeXN0ZW1Tb2NpYWxMaW5rc1BhZ2UgZnJvbSAnQC9wYWdlcy9zeXN0ZW0vU29jaWFsTGlua3MnXG5pbXBvcnQgQXNzZXRzTGF5b3V0IGZyb20gJ0AvcGFnZXMvc3lzdGVtL2Fzc2V0cydcbmltcG9ydCBBc3NldEltYWdlc1BhZ2UgZnJvbSAnQC9wYWdlcy9zeXN0ZW0vYXNzZXRzL0ltYWdlcydcbmltcG9ydCBDcm1DYW1wYWlnbnMgZnJvbSAnQC9wYWdlcy9jcm0vQ2FtcGFpZ25zJ1xuaW1wb3J0IENybVdvcmtmbG93cyBmcm9tICdAL3BhZ2VzL2NybS9Xb3JrZmxvd3MnXG5pbXBvcnQgQ3JtQUlJbnNpZ2h0cyBmcm9tICdAL3BhZ2VzL2NybS9BSUluc2lnaHRzJ1xuaW1wb3J0IENybUludGVncmF0aW9ucyBmcm9tICdAL3BhZ2VzL2NybS9JbnRlZ3JhdGlvbnMnXG5pbXBvcnQgQ3JtUmVwb3J0cyBmcm9tICdAL3BhZ2VzL2NybS9SZXBvcnRzJ1xuaW1wb3J0IENybUF1ZGl0IGZyb20gJ0AvcGFnZXMvY3JtL0F1ZGl0J1xuaW1wb3J0IENybUNhcmVSZW1pbmRlciBmcm9tICdAL3BhZ2VzL2NybS9DYXJlUmVtaW5kZXInXG5cbi8vIEJsb2cgTWFuYWdlclxuaW1wb3J0IEJsb2dNYW5hZ2VyUGFnZSBmcm9tICdAL3BhZ2VzL2Jsb2cvaW5kZXgnXG5cbi8vIFdlYnNpdGUgQnVpbGRlciBwYWdlc1xuaW1wb3J0IFdlYnNpdGVzUGFnZSBmcm9tICdAL3BhZ2VzL3dlYnNpdGVzL2luZGV4J1xuaW1wb3J0IFdlYnNpdGVCdWlsZGVyIGZyb20gJ0AvcGFnZXMvd2Vic2l0ZXMvQnVpbGRlcidcbmltcG9ydCBXZWJzaXRlU3VibWlzc2lvbnMgZnJvbSAnQC9wYWdlcy93ZWJzaXRlcy9TdWJtaXNzaW9ucydcbmltcG9ydCBXZWJzaXRlVGVtcGxhdGVHYWxsZXJ5IGZyb20gJ0AvcGFnZXMvd2Vic2l0ZXMvVGVtcGxhdGVHYWxsZXJ5J1xuaW1wb3J0IEJ1c2luZXNzRnJvbnRIdWJQYWdlIGZyb20gJ0AvcGFnZXMvYnVzaW5lc3MtZnJvbnQvaW5kZXgnXG5pbXBvcnQgU3RvcmVmcm9udEJyb3dzZXJQcmV2aWV3U2hlbGwgZnJvbSAnQC9wYWdlcy93ZWJzaXRlcy9TdG9yZWZyb250QnJvd3NlclByZXZpZXdTaGVsbCdcbmltcG9ydCBMZWdhY3lCcm93c2VyUHJldmlld1JlZGlyZWN0IGZyb20gJ0AvcGFnZXMvd2Vic2l0ZXMvTGVnYWN5QnJvd3NlclByZXZpZXdSZWRpcmVjdCdcbmltcG9ydCBQcmV2aWV3RHJhZnRTdG9yZVBhdGhSZWRpcmVjdCBmcm9tICdAL3BhZ2VzL3dlYnNpdGVzL1ByZXZpZXdEcmFmdFN0b3JlUGF0aFJlZGlyZWN0J1xuXG4vLyBDb21taXNzaW9uIHBhZ2VzXG5pbXBvcnQgQ29tbWlzc2lvbkxheW91dCBmcm9tICdAL3BhZ2VzL2NvbW1pc3Npb24vaW5kZXgnXG5pbXBvcnQgQ29tbWlzc2lvblBheWVlcyBmcm9tICdAL3BhZ2VzL2NvbW1pc3Npb24vUGF5ZWVzJ1xuaW1wb3J0IENvbW1pc3Npb25QbGFucyBmcm9tICdAL3BhZ2VzL2NvbW1pc3Npb24vUGxhbnMnXG5pbXBvcnQgQ29tbWlzc2lvbkFzc2lnbm1lbnRzIGZyb20gJ0AvcGFnZXMvY29tbWlzc2lvbi9Bc3NpZ25tZW50cydcbmltcG9ydCBDb21taXNzaW9uQWNjcnVhbHMgZnJvbSAnQC9wYWdlcy9jb21taXNzaW9uL0FjY3J1YWxzJ1xuaW1wb3J0IENvbW1pc3Npb25QYXlvdXRzIGZyb20gJ0AvcGFnZXMvY29tbWlzc2lvbi9QYXlvdXRzJ1xuaW1wb3J0IENvbW1pc3Npb25SZXBvcnRQYWdlIGZyb20gJ0AvcGFnZXMvY29tbWlzc2lvbi9yZXBvcnRzL0NvbW1pc3Npb25SZXBvcnQnXG5cbmNvbnN0IHJvdXRlckJhc2VuYW1lID0gKGltcG9ydC5tZXRhLmVudi5WSVRFX1JPVVRFUl9CQVNFTkFNRSB8fCAnJykucmVwbGFjZSgvXFwvJC8sICcnKVxuXG5leHBvcnQgY29uc3Qgcm91dGVyID0gY3JlYXRlQnJvd3NlclJvdXRlcihbXG4gIHtcbiAgICBwYXRoOiAnL3ByZXZpZXcvZHJhZnQnLFxuICAgIGVsZW1lbnQ6IDxTdG9yZWZyb250QnJvd3NlclByZXZpZXdTaGVsbCAvPixcbiAgfSxcbiAge1xuICAgIHBhdGg6ICcvcHJldmlldy9kcmFmdC9zdG9yZS86dmVuZG9yU2x1Zy8qJyxcbiAgICBlbGVtZW50OiA8UHJldmlld0RyYWZ0U3RvcmVQYXRoUmVkaXJlY3QgLz4sXG4gIH0sXG4gIHtcbiAgICBwYXRoOiAnL3dlYnNpdGVzL2Jyb3dzZXItcHJldmlldycsXG4gICAgZWxlbWVudDogPExlZ2FjeUJyb3dzZXJQcmV2aWV3UmVkaXJlY3QgLz4sXG4gIH0sXG4gIHtcbiAgICBwYXRoOiAnL2xvZ2luJyxcbiAgICBlbGVtZW50OiA8QXV0aExheW91dCAvPixcbiAgICBjaGlsZHJlbjogW3sgaW5kZXg6IHRydWUsIGVsZW1lbnQ6IDxMb2dpbiAvPiB9XSxcbiAgfSxcbiAge1xuICAgIHBhdGg6ICcvYXV0aC9oYW5kb2ZmJyxcbiAgICBlbGVtZW50OiA8QXV0aExheW91dCAvPixcbiAgICBjaGlsZHJlbjogW3sgaW5kZXg6IHRydWUsIGVsZW1lbnQ6IDxWZW5kb3JIYW5kb2ZmIC8+IH1dLFxuICB9LFxuICB7XG4gICAgcGF0aDogJy9yZWdpc3RlcicsXG4gICAgZWxlbWVudDogPFJlZ2lzdGVyIC8+LFxuICB9LFxuICB7XG4gICAgcGF0aDogJy9zaWdudXAnLFxuICAgIGVsZW1lbnQ6IDxSZWdpc3RlciAvPixcbiAgfSxcbiAge1xuICAgIHBhdGg6ICcvd2VsY29tZScsXG4gICAgZWxlbWVudDogKFxuICAgICAgPFByb3RlY3RlZFJvdXRlPlxuICAgICAgICA8U2lnbnVwV2VsY29tZSAvPlxuICAgICAgPC9Qcm90ZWN0ZWRSb3V0ZT5cbiAgICApLFxuICB9LFxuICB7XG4gICAgcGF0aDogJy9mb3Jnb3QtcGFzc3dvcmQnLFxuICAgIGVsZW1lbnQ6IDxBdXRoTGF5b3V0IC8+LFxuICAgIGNoaWxkcmVuOiBbeyBpbmRleDogdHJ1ZSwgZWxlbWVudDogPEZvcmdvdFBhc3N3b3JkIC8+IH1dLFxuICB9LFxuICB7XG4gICAgcGF0aDogJy8nLFxuICAgIGVsZW1lbnQ6IChcbiAgICAgIDxQcm90ZWN0ZWRSb3V0ZT5cbiAgICAgICAgPERhc2hib2FyZExheW91dCAvPlxuICAgICAgPC9Qcm90ZWN0ZWRSb3V0ZT5cbiAgICApLFxuICAgIGNoaWxkcmVuOiBbXG4gICAgICB7IGluZGV4OiB0cnVlLCBlbGVtZW50OiA8RGFzaGJvYXJkIC8+IH0sXG4gICAgICB7IHBhdGg6ICdvcmRlcnMnLCBlbGVtZW50OiA8T3JkZXJzIC8+IH0sXG4gICAgICB7IHBhdGg6ICdxdW90YXRpb25zJywgZWxlbWVudDogPFF1b3RhdGlvbnNQYWdlIC8+IH0sXG4gICAgICB7IHBhdGg6ICdxdW90YXRpb25zL3RlbXBsYXRlcycsIGVsZW1lbnQ6IDxJbnZvaWNlVGVtcGxhdGVzUGFnZSAvPiB9LFxuICAgICAgeyBwYXRoOiAncXVvdGF0aW9ucy86aWQnLCBlbGVtZW50OiA8SW52b2ljZURldGFpbCAvPiB9LFxuICAgICAgeyBwYXRoOiAnb3JkZXJzLzppZC9hdWRpdCcsIGVsZW1lbnQ6IDxPcmRlckF1ZGl0UmVwb3J0IC8+IH0sXG4gICAgICB7IHBhdGg6ICdvcmRlcnMvOmlkJywgZWxlbWVudDogPE9yZGVyRGV0YWlsIC8+IH0sXG4gICAgICB7IHBhdGg6ICdwcm9kdWN0cycsIGVsZW1lbnQ6IDxQcm9kdWN0cyAvPiB9LFxuICAgICAgeyBwYXRoOiAncHJvZHVjdHMvbmV3JywgZWxlbWVudDogPFByb2R1Y3RGb3JtIC8+IH0sXG4gICAgICB7IHBhdGg6ICdwcm9kdWN0cy86aWQvYXVkaXQnLCBlbGVtZW50OiA8UHJvZHVjdEF1ZGl0UmVwb3J0IC8+IH0sXG4gICAgICB7IHBhdGg6ICdwcm9kdWN0cy86aWQnLCBlbGVtZW50OiA8UHJvZHVjdEZvcm0gLz4gfSxcbiAgICAgIHsgcGF0aDogJ3NlcnZpY2VzJywgZWxlbWVudDogPFNlcnZpY2VzIC8+IH0sXG4gICAgICB7IHBhdGg6ICdzZXJ2aWNlcy9uZXcnLCBlbGVtZW50OiA8U2VydmljZUZvcm0gLz4gfSxcbiAgICAgIHsgcGF0aDogJ3NlcnZpY2VzLzppZC9hdWRpdCcsIGVsZW1lbnQ6IDxTZXJ2aWNlQXVkaXRSZXBvcnQgLz4gfSxcbiAgICAgIHsgcGF0aDogJ3NlcnZpY2VzLzppZCcsIGVsZW1lbnQ6IDxTZXJ2aWNlRm9ybSAvPiB9LFxuICAgICAgeyBwYXRoOiAnY2F0ZWdvcmllcycsIGVsZW1lbnQ6IDxDYXRlZ29yaWVzUGFnZSAvPiB9LFxuICAgICAgeyBwYXRoOiAnbWFzdGVyLWRhdGEnLCBlbGVtZW50OiA8TWFzdGVyRGF0YVJlcG9ydCAvPiB9LFxuICAgICAgeyBwYXRoOiAnbWFzdGVyLWRhdGEvbmV3JywgZWxlbWVudDogPE1hc3RlckRhdGFOZXcgLz4gfSxcbiAgICAgIHsgcGF0aDogJ3N1cHBsaWVycycsIGVsZW1lbnQ6IDxOYXZpZ2F0ZSB0bz1cIi9tYXN0ZXItZGF0YVwiIHJlcGxhY2UgLz4gfSxcbiAgICAgIHsgcGF0aDogJ3B1cmNoYXNlLW9yZGVycycsIGVsZW1lbnQ6IDxQdXJjaGFzZU9yZGVyc1BhZ2UgLz4gfSxcbiAgICAgIHsgcGF0aDogJ3B1cmNoYXNlLW9yZGVycy90ZW1wbGF0ZXMnLCBlbGVtZW50OiA8UE9UZW1wbGF0ZXNQYWdlIC8+IH0sXG4gICAgICB7IHBhdGg6ICdwdXJjaGFzZS1vcmRlcnMvOmlkJywgZWxlbWVudDogPFB1cmNoYXNlT3JkZXJEZXRhaWwgLz4gfSxcbiAgICAgIHsgcGF0aDogJ3Byb2R1Y3Rpb24nLCBlbGVtZW50OiA8UHJvZHVjdGlvbk9yZGVyc1BhZ2UgLz4gfSxcbiAgICAgIHsgcGF0aDogJ2ludmVudG9yeScsIGVsZW1lbnQ6IDxJbnZlbnRvcnkgLz4gfSxcbiAgICAgIHsgcGF0aDogJ3N0b3JhZ2UtbG9jYXRpb25zJywgZWxlbWVudDogPFN0b3JhZ2VMb2NhdGlvbnNQYWdlIC8+IH0sXG4gICAgICB7IHBhdGg6ICdwb3MnLCBlbGVtZW50OiA8UE9TIC8+IH0sXG4gICAgICB7IHBhdGg6ICdyZXN0YXVyYW50L2Zsb29yJywgZWxlbWVudDogPFJlc3RhdXJhbnRGbG9vclBhZ2UgLz4gfSxcbiAgICAgIHsgcGF0aDogJ3Jlc3RhdXJhbnQva2l0Y2hlbicsIGVsZW1lbnQ6IDxSZXN0YXVyYW50S2l0Y2hlblBhZ2UgLz4gfSxcbiAgICAgIHsgcGF0aDogJ3Jlc3RhdXJhbnQvc2V0dXAnLCBlbGVtZW50OiA8UmVzdGF1cmFudFNldHVwUGFnZSAvPiB9LFxuICAgICAgeyBwYXRoOiAncmVzdGF1cmFudC9tZW51JywgZWxlbWVudDogPFJlc3RhdXJhbnRNZW51UGFnZSAvPiB9LFxuICAgICAgeyBwYXRoOiAncmVzdGF1cmFudC9vcmRlci86b3JkZXJJZCcsIGVsZW1lbnQ6IDxSZXN0YXVyYW50T3JkZXJQYWdlIC8+IH0sXG4gICAgICB7IHBhdGg6ICdyZXN0YXVyYW50L3Jlc2VydmF0aW9ucycsIGVsZW1lbnQ6IDxSZXN0YXVyYW50UmVzZXJ2YXRpb25zUGFnZSAvPiB9LFxuICAgICAgeyBwYXRoOiAncmVzdGF1cmFudC9yZXBvcnRzJywgZWxlbWVudDogPFJlc3RhdXJhbnRSZXBvcnRzUGFnZSAvPiB9LFxuICAgICAgeyBwYXRoOiAnd29ya3NwYWNlJywgZWxlbWVudDogPFdvcmtzcGFjZUh1YlBhZ2UgLz4gfSxcbiAgICAgIHsgcGF0aDogJ3N1YnNjcmlwdGlvbnMnLCBlbGVtZW50OiA8U3Vic2NyaXB0aW9uc1NhbGVzUGFnZSAvPiB9LFxuICAgICAgeyBwYXRoOiAnbWFya2V0cGxhY2UnLCBlbGVtZW50OiA8TWFya2V0cGxhY2VMZWFkc1BhZ2UgLz4gfSxcbiAgICAgIHsgcGF0aDogJ3JlbnRhbCcsIGVsZW1lbnQ6IDxSZW50YWxIdWJQYWdlIC8+IH0sXG4gICAgICB7IHBhdGg6ICdpbnZvaWNlcycsIGVsZW1lbnQ6IDxJbnZvaWNlc1BhZ2UgLz4gfSxcbiAgICAgIHsgcGF0aDogJ2ludm9pY2VzL3RlbXBsYXRlcycsIGVsZW1lbnQ6IDxJbnZvaWNlVGVtcGxhdGVzUGFnZSAvPiB9LFxuICAgICAgeyBwYXRoOiAnaW52b2ljZXMvOmlkJywgZWxlbWVudDogPEludm9pY2VEZXRhaWwgLz4gfSxcbiAgICAgIHsgcGF0aDogJ21lbW9zJywgZWxlbWVudDogPENyZWRpdERlYml0TWVtb3MgLz4gfSxcbiAgICAgIHsgcGF0aDogJ2NvdXBvbnMnLCBlbGVtZW50OiA8Q291cG9uc1BhZ2UgLz4gfSxcbiAgICAgIHsgcGF0aDogJ3JlcG9ydHMnLCBlbGVtZW50OiA8UmVwb3J0c1BhZ2UgLz4gfSxcbiAgICAgIHsgcGF0aDogJ3RlbXBsYXRlJywgZWxlbWVudDogPE5hdmlnYXRlIHRvPVwiL3dlYnNpdGVzL3RlbXBsYXRlcz9jdXN0b21pemU9MVwiIHJlcGxhY2UgLz4gfSxcbiAgICAgIHsgcGF0aDogJ2J1c2luZXNzLWZyb250JywgZWxlbWVudDogPEJ1c2luZXNzRnJvbnRIdWJQYWdlIC8+IH0sXG4gICAgICB7IHBhdGg6ICdzdG9yZWZyb250LWJ1aWxkZXInLCBlbGVtZW50OiA8TmF2aWdhdGUgdG89XCIvYnVzaW5lc3MtZnJvbnRcIiByZXBsYWNlIC8+IH0sXG4gICAgICB7IHBhdGg6ICdibG9nJywgZWxlbWVudDogPEJsb2dNYW5hZ2VyUGFnZSAvPiB9LFxuICAgICAgeyBwYXRoOiAnd2Vic2l0ZXMnLCBlbGVtZW50OiA8V2Vic2l0ZXNQYWdlIC8+IH0sXG4gICAgICAvKiBTdGF0aWMgcGF0aCBtdXN0IGJlIGFib3ZlIDpzaXRlSWQgb3IgXCJ0ZW1wbGF0ZXNcIiBpcyB0cmVhdGVkIGFzIGEgc2l0ZSBpZC4gKi9cbiAgICAgIHsgcGF0aDogJ3dlYnNpdGVzL3RlbXBsYXRlcycsIGVsZW1lbnQ6IDxXZWJzaXRlVGVtcGxhdGVHYWxsZXJ5IC8+IH0sXG4gICAgICB7IHBhdGg6ICd3ZWJzaXRlcy86c2l0ZUlkJywgZWxlbWVudDogPFdlYnNpdGVCdWlsZGVyIC8+IH0sXG4gICAgICB7IHBhdGg6ICd3ZWJzaXRlcy86c2l0ZUlkL3N1Ym1pc3Npb25zJywgZWxlbWVudDogPFdlYnNpdGVTdWJtaXNzaW9ucyAvPiB9LFxuICAgICAgeyBwYXRoOiAnd2Vic2l0ZS10ZW1wbGF0ZXMnLCBlbGVtZW50OiA8TmF2aWdhdGUgdG89XCIvd2Vic2l0ZXMvdGVtcGxhdGVzXCIgcmVwbGFjZSAvPiB9LFxuICAgICAgeyBwYXRoOiAnY3VzdG9tZXJzJywgZWxlbWVudDogPE5hdmlnYXRlIHRvPVwiL21hc3Rlci1kYXRhXCIgcmVwbGFjZSAvPiB9LFxuICAgICAgeyBwYXRoOiAnY3VzdG9tZXJzLzppZCcsIGVsZW1lbnQ6IDxDdXN0b21lckRldGFpbCAvPiB9LFxuICAgICAgeyBwYXRoOiAncmV2aWV3cycsIGVsZW1lbnQ6IDxSZXZpZXdzUGFnZSAvPiB9LFxuICAgICAgeyBwYXRoOiAnc3RvcmVzJywgZWxlbWVudDogPFN0b3Jlc1BhZ2UgLz4gfSxcbiAgICAgIHsgcGF0aDogJ3RlYW0nLCBlbGVtZW50OiA8VGVhbVBhZ2UgLz4gfSxcbiAgICAgIHsgcGF0aDogJ3JvbGVzJywgZWxlbWVudDogPFJvbGVzUGFnZSAvPiB9LFxuICAgICAgeyBwYXRoOiAnc2V0dGluZ3MnLCBlbGVtZW50OiA8U2V0dGluZ3NQYWdlIC8+IH0sXG4gICAgICB7IHBhdGg6ICdzZXR0aW5ncy9zdXBwb3J0LWFjdGl2aXR5JywgZWxlbWVudDogPFN1cHBvcnRBY3Rpdml0eVBhZ2UgLz4gfSxcbiAgICAgIHsgcGF0aDogJ2Fib3V0JywgZWxlbWVudDogPEFib3V0UGFnZSAvPiB9LFxuICAgICAgeyBwYXRoOiAnc3lzdGVtL21vZHVsZXMnLCBlbGVtZW50OiA8U3lzdGVtTW9kdWxlc1BhZ2UgLz4gfSxcbiAgICAgIHsgcGF0aDogJ3N5c3RlbS9tb2RlbHMnLCBlbGVtZW50OiA8U3lzdGVtTW9kZWxzUGFnZSAvPiB9LFxuICAgICAgeyBwYXRoOiAnc3lzdGVtL3RhYmxlLWRhdGEnLCBlbGVtZW50OiA8VmVuZG9yQWRtaW5Sb3V0ZT48U3lzdGVtVGFibGVEYXRhUGFnZSAvPjwvVmVuZG9yQWRtaW5Sb3V0ZT4gfSxcbiAgICAgIHsgcGF0aDogJ3N5c3RlbS9icm93c2UtdGFibGUnLCBlbGVtZW50OiA8VmVuZG9yQWRtaW5Sb3V0ZT48U3lzdGVtQnJvd3NlVGFibGVQYWdlIC8+PC9WZW5kb3JBZG1pblJvdXRlPiB9LFxuICAgICAgeyBwYXRoOiAnc3lzdGVtL3N0b3JlZnJvbnQtZGlzcGxheScsIGVsZW1lbnQ6IDxTeXN0ZW1TdG9yZWZyb250RGlzcGxheVBhZ2UgLz4gfSxcbiAgICAgIHsgcGF0aDogJ3N5c3RlbS9zb2NpYWwtbGlua3MnLCBlbGVtZW50OiA8U3lzdGVtU29jaWFsTGlua3NQYWdlIC8+IH0sXG4gICAgICB7XG4gICAgICAgIHBhdGg6ICdzeXN0ZW0vYXNzZXRzJyxcbiAgICAgICAgZWxlbWVudDogPEFzc2V0c0xheW91dCAvPixcbiAgICAgICAgY2hpbGRyZW46IFtcbiAgICAgICAgICB7IGluZGV4OiB0cnVlLCBlbGVtZW50OiA8TmF2aWdhdGUgdG89XCJpbWFnZXNcIiByZXBsYWNlIC8+IH0sXG4gICAgICAgICAgeyBwYXRoOiAnaW1hZ2VzJywgZWxlbWVudDogPEFzc2V0SW1hZ2VzUGFnZSAvPiB9LFxuICAgICAgICBdLFxuICAgICAgfSxcbiAgICAgIHsgcGF0aDogJ3Byb2ZpbGUnLCBlbGVtZW50OiA8UHJvZmlsZVBhZ2UgLz4gfSxcbiAgICAgIHsgcGF0aDogJ3JlbGF0aW9uc2hpcC1tYW5hZ2VyJywgZWxlbWVudDogPFJlbGF0aW9uc2hpcE1hbmFnZXJQYWdlIC8+IH0sXG4gICAgICB7IHBhdGg6ICdwbGFucycsIGVsZW1lbnQ6IDxQbGFuc1BhZ2UgLz4gfSxcbiAgICAgIHsgcGF0aDogJ2Jvb2tpbmdzJywgZWxlbWVudDogPEJvb2tpbmdzUGFnZSAvPiB9LFxuICAgICAgeyBwYXRoOiAnYm9va2luZ3MvOmlkJywgZWxlbWVudDogPEJvb2tpbmdEZXRhaWwgLz4gfSxcbiAgICAgIHsgcGF0aDogJ3Byb2plY3RzJywgZWxlbWVudDogPFByb2plY3RzUGFnZSAvPiB9LFxuICAgICAgeyBwYXRoOiAncHJvamVjdHMvOmlkJywgZWxlbWVudDogPFByb2plY3REZXRhaWwgLz4gfSxcbiAgICAgIHsgcGF0aDogJ25vdGlmaWNhdGlvbnMnLCBlbGVtZW50OiA8Tm90aWZpY2F0aW9uc1BhZ2UgLz4gfSxcbiAgICAgIHsgcGF0aDogJ25vdGlmaWNhdGlvbnMvc2V0dGluZ3MnLCBlbGVtZW50OiA8Tm90aWZpY2F0aW9uU2V0dGluZ3NQYWdlIC8+IH0sXG4gICAgICAvLyBIUiByb3V0ZXNcbiAgICAgIHsgcGF0aDogJ2hyL2VtcGxveWVlcycsIGVsZW1lbnQ6IDxIUkVtcGxveWVlc1BhZ2UgLz4gfSxcbiAgICAgIHsgcGF0aDogJ2hyL2VtcGxveWVlcy86aWQnLCBlbGVtZW50OiA8SFJFbXBsb3llZURldGFpbFBhZ2UgLz4gfSxcbiAgICAgIHsgcGF0aDogJ2hyL2F0dGVuZGFuY2UnLCBlbGVtZW50OiA8SFJBdHRlbmRhbmNlUGFnZSAvPiB9LFxuICAgICAgeyBwYXRoOiAnaHIvYXR0ZW5kYW5jZS9teScsIGVsZW1lbnQ6IDxNeUF0dGVuZGFuY2VQYWdlIC8+IH0sXG4gICAgICB7IHBhdGg6ICdoci9hdHRlbmRhbmNlL3JlcG9ydCcsIGVsZW1lbnQ6IDxBdHRlbmRhbmNlUmVwb3J0UGFnZSAvPiB9LFxuICAgICAgeyBwYXRoOiAnaHIvbGVhdmVzJywgZWxlbWVudDogPEhSTGVhdmVSZXF1ZXN0c1BhZ2UgLz4gfSxcbiAgICAgIHsgcGF0aDogJ2hyL2xlYXZlcy9wb2xpY2llcycsIGVsZW1lbnQ6IDxMZWF2ZVBvbGljaWVzUGFnZSAvPiB9LFxuICAgICAgeyBwYXRoOiAnaHIvbGVhdmVzL2hvbGlkYXlzJywgZWxlbWVudDogPEhvbGlkYXlzUGFnZSAvPiB9LFxuICAgICAgeyBwYXRoOiAnaHIvbGVhdmVzL215JywgZWxlbWVudDogPE15TGVhdmVzUGFnZSAvPiB9LFxuICAgICAgeyBwYXRoOiAnaHIvc2FsYXJ5JywgZWxlbWVudDogPEhSU2FsYXJ5UGFnZSAvPiB9LFxuICAgICAgeyBwYXRoOiAnaHIvcGF5cm9sbCcsIGVsZW1lbnQ6IDxIUlBheXJvbGxQYWdlIC8+IH0sXG4gICAgICB7IHBhdGg6ICdoci9wYXlyb2xsLzppZCcsIGVsZW1lbnQ6IDxIUlBheXJvbGxEZXRhaWxQYWdlIC8+IH0sXG4gICAgICB7IHBhdGg6ICdoci9vZmZlcnMnLCBlbGVtZW50OiA8SFJPZmZlcnNQYWdlIC8+IH0sXG4gICAgICB7IHBhdGg6ICdoci9vZmZlcnMvdGVtcGxhdGVzJywgZWxlbWVudDogPEhST2ZmZXJUZW1wbGF0ZXNQYWdlIC8+IH0sXG4gICAgICB7IHBhdGg6ICdoci9kZXBhcnRtZW50cycsIGVsZW1lbnQ6IDxIUkRlcGFydG1lbnRzUGFnZSAvPiB9LFxuICAgICAgeyBwYXRoOiAnaHIvZGVzaWduYXRpb25zJywgZWxlbWVudDogPEhSRGVzaWduYXRpb25zUGFnZSAvPiB9LFxuXG4gICAgICAvLyBIUiBFeHRlbmRlZCDilIAgUmVjcnVpdG1lbnQgJiBPbmJvYXJkaW5nXG4gICAgICB7IHBhdGg6ICdoci9yZWNydWl0bWVudCcsICAgICAgICAgZWxlbWVudDogPEhSUmVjcnVpdG1lbnRQYWdlIC8+IH0sXG4gICAgICB7IHBhdGg6ICdoci9yZWNydWl0bWVudC9qb2JzLzppZCcsIGVsZW1lbnQ6IDxIUkpvYkRldGFpbFBhZ2UgLz4gfSxcbiAgICAgIHsgcGF0aDogJ2hyL29uYm9hcmRpbmcnLCAgICAgICAgICBlbGVtZW50OiA8SFJPbmJvYXJkaW5nUGFnZSAvPiB9LFxuICAgICAgeyBwYXRoOiAnaHIvbXktb25ib2FyZGluZycsICAgICAgIGVsZW1lbnQ6IDxNeU9uYm9hcmRpbmdQYWdlIC8+IH0sXG5cbiAgICAgIC8vIEhSIEV4dGVuZGVkIOKUgCBQZXJmb3JtYW5jZVxuICAgICAgeyBwYXRoOiAnaHIvcGVyZm9ybWFuY2UnLCAgICAgICAgIGVsZW1lbnQ6IDxIUlBlcmZvcm1hbmNlUGFnZSAvPiB9LFxuICAgICAgeyBwYXRoOiAnaHIvcGVyZm9ybWFuY2UvY3ljbGVzLzppZCcsICBlbGVtZW50OiA8SFJDeWNsZURldGFpbFBhZ2UgLz4gfSxcbiAgICAgIHsgcGF0aDogJ2hyL3BlcmZvcm1hbmNlL3Jldmlld3MvOmlkJywgZWxlbWVudDogPEhSUmV2aWV3RGV0YWlsUGFnZSAvPiB9LFxuICAgICAgeyBwYXRoOiAnaHIvbXktcGVyZm9ybWFuY2UnLCAgICAgIGVsZW1lbnQ6IDxNeVBlcmZvcm1hbmNlUGFnZSAvPiB9LFxuXG4gICAgICAvLyBIUiBFeHRlbmRlZCDilIAgQ29tcGxpYW5jZVxuICAgICAgeyBwYXRoOiAnaHIvY29tcGxpYW5jZScsICAgICAgICAgICAgICAgIGVsZW1lbnQ6IDxIUkNvbXBsaWFuY2VQYWdlIC8+IH0sXG4gICAgICB7IHBhdGg6ICdoci9jb21wbGlhbmNlL3BvbGljaWVzLzppZCcsICAgZWxlbWVudDogPEhSUG9saWN5RGV0YWlsUGFnZSAvPiB9LFxuICAgICAgeyBwYXRoOiAnaHIvbXktcG9saWNpZXMnLCAgICAgICAgICAgICAgIGVsZW1lbnQ6IDxNeVBvbGljaWVzUGFnZSAvPiB9LFxuXG4gICAgICAvLyBIUiBFeHRlbmRlZCDilIAgVHJhaW5pbmdcbiAgICAgIHsgcGF0aDogJ2hyL3RyYWluaW5nJywgICAgICAgICAgICBlbGVtZW50OiA8SFJUcmFpbmluZ1BhZ2UgLz4gfSxcbiAgICAgIHsgcGF0aDogJ2hyL3RyYWluaW5nLzppZCcsICAgICAgICBlbGVtZW50OiA8SFJQcm9ncmFtRGV0YWlsUGFnZSAvPiB9LFxuICAgICAgeyBwYXRoOiAnaHIvbXktdHJhaW5pbmcnLCAgICAgICAgIGVsZW1lbnQ6IDxNeVRyYWluaW5nUGFnZSAvPiB9LFxuICAgICAgeyBwYXRoOiAnaHIvbXktdHJhaW5pbmcvOmlkJywgICAgIGVsZW1lbnQ6IDxDb3Vyc2VMZWFybmluZ1BhZ2UgLz4gfSxcblxuICAgICAgLy8gSFIgRXh0ZW5kZWQg4pSAIEVtcGxveWVlIFNlbGYgU2VydmljZVxuICAgICAgeyBwYXRoOiAnaHIvbWUnLCAgICAgICAgICAgICAgICAgIGVsZW1lbnQ6IDxNeUVTU1BhZ2UgLz4gfSxcbiAgICAgIHsgcGF0aDogJ2hyL2Fubm91bmNlbWVudHMnLCAgICAgICBlbGVtZW50OiA8SFJBbm5vdW5jZW1lbnRzUGFnZSAvPiB9LFxuICAgICAgeyBwYXRoOiAnaHIvbXktYW5ub3VuY2VtZW50cycsICAgIGVsZW1lbnQ6IDxNeUFubm91bmNlbWVudHNQYWdlIC8+IH0sXG4gICAgICB7IHBhdGg6ICdoci9leHBlbnNlcycsICAgICAgICAgICAgZWxlbWVudDogPEhSRXhwZW5zZXNQYWdlIC8+IH0sXG4gICAgICB7IHBhdGg6ICdoci9teS1leHBlbnNlcycsICAgICAgICAgZWxlbWVudDogPE15RXhwZW5zZXNQYWdlIC8+IH0sXG4gICAgICB7IHBhdGg6ICdoci9oZWxwZGVzaycsICAgICAgICAgICAgZWxlbWVudDogPEhSSGVscGRlc2tQYWdlIC8+IH0sXG4gICAgICB7IHBhdGg6ICdoci9teS1oZWxwZGVzaycsICAgICAgICAgZWxlbWVudDogPE15VGlja2V0c1BhZ2UgLz4gfSxcbiAgICAgIHsgcGF0aDogJ2hyL2hlbHBkZXNrLzppZCcsICAgICAgICBlbGVtZW50OiA8SFJUaWNrZXREZXRhaWxQYWdlIC8+IH0sXG5cbiAgICAgIC8vIEZpbmFuY2Ugcm91dGVzXG4gICAgICB7IHBhdGg6ICdmaW5hbmNlJywgICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50OiA8RmluYW5jZURhc2hib2FyZCAvPiB9LFxuICAgICAgeyBwYXRoOiAnZmluYW5jZS9iYXNpYycsICAgICAgICAgICAgICAgICAgZWxlbWVudDogPEZpbmFuY2VCYXNpYyAvPiB9LFxuICAgICAgeyBwYXRoOiAnZmluYW5jZS9jb3N0LWNlbnRlcnMnLCAgICAgICAgICAgZWxlbWVudDogPEZpbmFuY2VDb3N0Q2VudGVycyAvPiB9LFxuICAgICAgeyBwYXRoOiAnZmluYW5jZS9jb2EnLCAgICAgICAgICAgICAgICAgICAgZWxlbWVudDogPEZpbmFuY2VDT0EgLz4gfSxcbiAgICAgIHsgcGF0aDogJ2ZpbmFuY2Uvam91cm5hbCcsICAgICAgICAgICAgICAgIGVsZW1lbnQ6IDxGaW5hbmNlSm91cm5hbCAvPiB9LFxuICAgICAgeyBwYXRoOiAnZmluYW5jZS90cmlhbC1iYWxhbmNlJywgICAgICAgICAgZWxlbWVudDogPEZpbmFuY2VUcmlhbEJhbGFuY2UgLz4gfSxcbiAgICAgIHsgcGF0aDogJ2ZpbmFuY2UvYXInLCAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnQ6IDxGaW5hbmNlQVIgLz4gfSxcbiAgICAgIHsgcGF0aDogJ2ZpbmFuY2UvYXAnLCAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnQ6IDxGaW5hbmNlQVAgLz4gfSxcbiAgICAgIHsgcGF0aDogJ2ZpbmFuY2UvYmFuaycsICAgICAgICAgICAgICAgICAgIGVsZW1lbnQ6IDxGaW5hbmNlQmFuayAvPiB9LFxuICAgICAgeyBwYXRoOiAnZmluYW5jZS9idWRnZXRzJywgICAgICAgICAgICAgICAgZWxlbWVudDogPEZpbmFuY2VCdWRnZXRzIC8+IH0sXG4gICAgICB7IHBhdGg6ICdmaW5hbmNlL2Fzc2V0cycsICAgICAgICAgICAgICAgICBlbGVtZW50OiA8RmluYW5jZUFzc2V0cyAvPiB9LFxuICAgICAgeyBwYXRoOiAnZmluYW5jZS90YXgnLCAgICAgICAgICAgICAgICAgICAgZWxlbWVudDogPEZpbmFuY2VUYXggLz4gfSxcbiAgICAgIHsgcGF0aDogJ2ZpbmFuY2UvcmVwb3J0cy9wbmwnLCAgICAgICAgICAgIGVsZW1lbnQ6IDxGaW5hbmNlUG5MIC8+IH0sXG4gICAgICB7IHBhdGg6ICdmaW5hbmNlL3JlcG9ydHMvYmFsYW5jZS1zaGVldCcsICBlbGVtZW50OiA8RmluYW5jZUJhbGFuY2VTaGVldCAvPiB9LFxuICAgICAgeyBwYXRoOiAnZmluYW5jZS9yZXBvcnRzL2Nhc2gtZmxvdycsICAgICAgZWxlbWVudDogPEZpbmFuY2VDYXNoRmxvdyAvPiB9LFxuICAgICAgeyBwYXRoOiAnZmluYW5jZS9yZXBvcnRzL2Nvc3QtYW5hbHlzaXMnLCAgZWxlbWVudDogPEZpbmFuY2VDb3N0QW5hbHlzaXMgLz4gfSxcbiAgICAgIHsgcGF0aDogJ2ZpbmFuY2UvcmVwb3J0cy9nbCcsICAgICAgICAgICAgIGVsZW1lbnQ6IDxGaW5hbmNlR0xSZXBvcnQgLz4gfSxcbiAgICAgIHsgcGF0aDogJ2ZpbmFuY2UvY2FwaXRhbCcsICAgICAgICAgICAgICAgIGVsZW1lbnQ6IDxGaW5hbmNlQ2FwaXRhbCAvPiB9LFxuICAgICAgeyBwYXRoOiAnZmluYW5jZS9hcHByb3ZhbHMnLCAgICAgICAgICAgICAgZWxlbWVudDogPEZpbmFuY2VBcHByb3ZhbHMgLz4gfSxcbiAgICAgIHsgcGF0aDogJ2ZpbmFuY2UvYXVkaXQnLCAgICAgICAgICAgICAgICAgIGVsZW1lbnQ6IDxGaW5hbmNlQXVkaXQgLz4gfSxcbiAgICAgIHsgcGF0aDogJ2ZpbmFuY2UvcGVyaW9kcycsICAgICAgICAgICAgICAgICBlbGVtZW50OiA8RmluYW5jZVBlcmlvZENvbnRyb2wgLz4gfSxcbiAgICAgIHsgcGF0aDogJ2ZpbmFuY2UvZmllbGQtcnVsZXMnLCAgICAgICAgICAgIGVsZW1lbnQ6IDxGaW5hbmNlRmllbGRSdWxlQ29uZmlnIC8+IH0sXG5cbiAgICAgIC8vIENvbnRyb2xsaW5nIChDTykg4oCUIG5lc3RlZCB1bmRlciBkZWRpY2F0ZWQgQ09MYXlvdXQgc3ViLXNpZGViYXJcbiAgICAgIHtcbiAgICAgICAgcGF0aDogJ2NvbnRyb2xsaW5nJyxcbiAgICAgICAgZWxlbWVudDogPENPTGF5b3V0IC8+LFxuICAgICAgICBjaGlsZHJlbjogW1xuICAgICAgICAgIHsgaW5kZXg6IHRydWUsICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50OiA8Q29udHJvbGxpbmdEYXNoYm9hcmRQYWdlIC8+IH0sXG4gICAgICAgICAgLy8gQ29zdCBwbGFubmluZ1xuICAgICAgICAgIHsgcGF0aDogJ3Byb2R1Y3QtY29zdHMnLCAgICAgICAgICAgICAgICAgICBlbGVtZW50OiA8Q29udHJvbGxpbmdQcm9kdWN0Q29zdHNQYWdlIC8+IH0sXG4gICAgICAgICAgeyBwYXRoOiAncm91dGluZycsICAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnQ6IDxDb250cm9sbGluZ1JvdXRpbmdQYWdlIC8+IH0sXG4gICAgICAgICAgeyBwYXRoOiAnc2V0dXAnLCAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnQ6IDxDb250cm9sbGluZ1NldHVwUGFnZSAvPiB9LFxuICAgICAgICAgIC8vIE9yZGVyc1xuICAgICAgICAgIHsgcGF0aDogJ29yZGVycycsICAgICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50OiA8Q29udHJvbGxpbmdNYW51ZmFjdHVyaW5nT3JkZXJzUGFnZSAvPiB9LFxuICAgICAgICAgIHsgcGF0aDogJ29yZGVycy86aWQnLCAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50OiA8Q29udHJvbGxpbmdNYW51ZmFjdHVyaW5nT3JkZXJEZXRhaWwgLz4gfSxcbiAgICAgICAgICB7IHBhdGg6ICdpbnRlcm5hbC1vcmRlcnMnLCAgICAgICAgICAgICAgICAgZWxlbWVudDogPENvbnRyb2xsaW5nSW50ZXJuYWxPcmRlcnNQYWdlIC8+IH0sXG4gICAgICAgICAgLy8gUHJvZHVjdGlvbiBleGVjdXRpb25cbiAgICAgICAgICB7IHBhdGg6ICdwcm9kdWN0aW9uLXByb2Nlc3MnLCAgICAgICAgICAgICAgZWxlbWVudDogPENvbnRyb2xsaW5nUHJvZHVjdGlvblByb2Nlc3NQYWdlIC8+IH0sXG4gICAgICAgICAgeyBwYXRoOiAnZ29vZHMtbW92ZW1lbnRzJywgICAgICAgICAgICAgICAgIGVsZW1lbnQ6IDxDb250cm9sbGluZ0dvb2RzTW92ZW1lbnRzUGFnZSAvPiB9LFxuICAgICAgICAgIHsgcGF0aDogJ2FjdGl2aXR5LWNvbmZpcm1hdGlvbnMnLCAgICAgICAgICBlbGVtZW50OiA8Q29udHJvbGxpbmdBY3Rpdml0eUNvbmZpcm1hdGlvbnNQYWdlIC8+IH0sXG4gICAgICAgICAgeyBwYXRoOiAnY29zdC1ib29raW5ncycsICAgICAgICAgICAgICAgICAgIGVsZW1lbnQ6IDxDb250cm9sbGluZ0Nvc3RCb29raW5nc1BhZ2UgLz4gfSxcbiAgICAgICAgICAvLyBBbmFseXNpcyAmIHJlcG9ydGluZ1xuICAgICAgICAgIHsgcGF0aDogJ3dpcCcsICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50OiA8Q29udHJvbGxpbmdXaXBSZXBvcnQgLz4gfSxcbiAgICAgICAgICB7IHBhdGg6ICd2YXJpYW5jZS1hbmFseXNpcycsICAgICAgICAgICAgICAgZWxlbWVudDogPENvbnRyb2xsaW5nVmFyaWFuY2VBbmFseXNpc1BhZ2UgLz4gfSxcbiAgICAgICAgICB7IHBhdGg6ICdpbnRlcm5hbC1jb3N0JywgICAgICAgICAgICAgICAgICAgZWxlbWVudDogPENvbnRyb2xsaW5nSW50ZXJuYWxDb3N0UGFnZSAvPiB9LFxuICAgICAgICAgIC8vIFBlcmlvZCBlbmRcbiAgICAgICAgICB7IHBhdGg6ICdjb3N0LWFsbG9jYXRpb25zJywgICAgICAgICAgICAgICAgZWxlbWVudDogPENvbnRyb2xsaW5nQ29zdEFsbG9jYXRpb25zUGFnZSAvPiB9LFxuICAgICAgICAgIHsgcGF0aDogJ3BlcmlvZC1lbmQnLCAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50OiA8Q29udHJvbGxpbmdQZXJpb2RFbmRQYWdlIC8+IH0sXG4gICAgICAgIF0sXG4gICAgICB9LFxuXG4gICAgICAvLyBDUk0gcm91dGVzXG4gICAgICB7IHBhdGg6ICdjcm0nLCAgICAgICAgICAgICAgICBlbGVtZW50OiA8Q3JtRGFzaGJvYXJkIC8+IH0sXG4gICAgICB7IHBhdGg6ICdjcm0vY29udGFjdHMnLCAgICAgICBlbGVtZW50OiA8Q3JtQ29udGFjdHMgLz4gfSxcbiAgICAgIHsgcGF0aDogJ2NybS9hY2NvdW50cycsICAgICAgIGVsZW1lbnQ6IDxDcm1BY2NvdW50cyAvPiB9LFxuICAgICAgeyBwYXRoOiAnY3JtL2xlYWRzJywgICAgICAgICAgZWxlbWVudDogPENybUxlYWRzIC8+IH0sXG4gICAgICB7IHBhdGg6ICdjcm0vcGlwZWxpbmUnLCAgICAgICBlbGVtZW50OiA8Q3JtUGlwZWxpbmUgLz4gfSxcbiAgICAgIHsgcGF0aDogJ2NybS9hY3Rpdml0aWVzJywgICAgIGVsZW1lbnQ6IDxDcm1BY3Rpdml0aWVzIC8+IH0sXG4gICAgICB7IHBhdGg6ICdjcm0vaW5ib3gnLCAgICAgICAgICBlbGVtZW50OiA8Q3JtSW5ib3ggLz4gfSxcbiAgICAgIHsgcGF0aDogJ2NybS90aWNrZXRzJywgICAgICAgIGVsZW1lbnQ6IDxDcm1UaWNrZXRzIC8+IH0sXG4gICAgICB7IHBhdGg6ICdjcm0vdGlja2V0cy86aWQnLCAgICBlbGVtZW50OiA8Q3JtVGlja2V0RGV0YWlsIC8+IH0sXG4gICAgICB7IHBhdGg6ICdjcm0va2InLCAgICAgICAgICAgICBlbGVtZW50OiA8Q3JtS25vd2xlZGdlQmFzZSAvPiB9LFxuICAgICAgeyBwYXRoOiAnY3JtL3NlZ21lbnRzJywgICAgICAgZWxlbWVudDogPENybVNlZ21lbnRzIC8+IH0sXG4gICAgICB7IHBhdGg6ICdjcm0vdGVtcGxhdGVzJywgICAgICAgICAgZWxlbWVudDogPENybVRlbXBsYXRlcyAvPiB9LFxuICAgICAgeyBwYXRoOiAnZG9jdW1lbnQtdGVtcGxhdGVzJywgICAgIGVsZW1lbnQ6IDxEb2N1bWVudFRlbXBsYXRlc1BhZ2UgLz4gfSxcbiAgICAgIHsgcGF0aDogJ2NybS9jYW1wYWlnbnMnLCAgICAgIGVsZW1lbnQ6IDxDcm1DYW1wYWlnbnMgLz4gfSxcbiAgICAgIHsgcGF0aDogJ2NybS93b3JrZmxvd3MnLCAgICAgIGVsZW1lbnQ6IDxDcm1Xb3JrZmxvd3MgLz4gfSxcbiAgICAgIHsgcGF0aDogJ2NybS9haScsICAgICAgICAgICAgIGVsZW1lbnQ6IDxDcm1BSUluc2lnaHRzIC8+IH0sXG4gICAgICB7IHBhdGg6ICdjcm0vaW50ZWdyYXRpb25zJywgICBlbGVtZW50OiA8Q3JtSW50ZWdyYXRpb25zIC8+IH0sXG4gICAgICB7IHBhdGg6ICdjcm0vcmVwb3J0cycsICAgICAgICBlbGVtZW50OiA8Q3JtUmVwb3J0cyAvPiB9LFxuICAgICAgeyBwYXRoOiAnY3JtL2F1ZGl0JywgICAgICAgICAgZWxlbWVudDogPENybUF1ZGl0IC8+IH0sXG4gICAgICB7IHBhdGg6ICdjcm0vY2FyZS1yZW1pbmRlcicsICBlbGVtZW50OiA8Q3JtQ2FyZVJlbWluZGVyIC8+IH0sXG4gICAgICAvLyBDb21taXNzaW9uIHJvdXRlc1xuICAgICAge1xuICAgICAgICBwYXRoOiAnY29tbWlzc2lvbicsXG4gICAgICAgIGVsZW1lbnQ6IDxDb21taXNzaW9uTGF5b3V0IC8+LFxuICAgICAgICBjaGlsZHJlbjogW1xuICAgICAgICAgIHsgaW5kZXg6IHRydWUsIGVsZW1lbnQ6IDxDb21taXNzaW9uTGF5b3V0IC8+IH0sXG4gICAgICAgICAgeyBwYXRoOiAncGF5ZWVzJywgZWxlbWVudDogPENvbW1pc3Npb25QYXllZXMgLz4gfSxcbiAgICAgICAgICB7IHBhdGg6ICdwbGFucycsIGVsZW1lbnQ6IDxDb21taXNzaW9uUGxhbnMgLz4gfSxcbiAgICAgICAgICB7IHBhdGg6ICdhc3NpZ25tZW50cycsIGVsZW1lbnQ6IDxDb21taXNzaW9uQXNzaWdubWVudHMgLz4gfSxcbiAgICAgICAgICB7IHBhdGg6ICdhY2NydWFscycsIGVsZW1lbnQ6IDxDb21taXNzaW9uQWNjcnVhbHMgLz4gfSxcbiAgICAgICAgICB7IHBhdGg6ICdwYXlvdXRzJywgZWxlbWVudDogPENvbW1pc3Npb25QYXlvdXRzIC8+IH0sXG4gICAgICAgICAgeyBwYXRoOiAncmVwb3J0cycsIGVsZW1lbnQ6IDxDb21taXNzaW9uUmVwb3J0UGFnZSAvPiB9LFxuICAgICAgICBdLFxuICAgICAgfSxcbiAgICBdLFxuICB9LFxuICAvLyBDYXRjaC1hbGw6IHJlZGlyZWN0IHRvIHJvb3QgKHdoaWNoIHdpbGwgcmVkaXJlY3QgdG8gbG9naW4gaWYgbm90IGF1dGhlbnRpY2F0ZWQpXG4gIHtcbiAgICBwYXRoOiAnKicsXG4gICAgZWxlbWVudDogPE5hdmlnYXRlIHRvPVwiL1wiIHJlcGxhY2UgLz4sXG4gIH0sXG5dLCB7XG4gIGJhc2VuYW1lOiByb3V0ZXJCYXNlbmFtZSB8fCB1bmRlZmluZWQsXG59KVxuIl0sImZpbGUiOiIvYXBwL3NyYy9yb3V0ZXMvaW5kZXgudHN4In0=