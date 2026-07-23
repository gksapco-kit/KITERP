import { createBrowserRouter, Navigate } from 'react-router-dom'
import AuthLayout from '@/layouts/AuthLayout'
import DashboardLayout from '@/layouts/DashboardLayout'
import ProtectedRoute from './ProtectedRoute'

import Login from '@/pages/auth/Login'
import VendorHandoff from '@/pages/auth/Handoff'
import Register from '@/pages/auth/Register'
import SignupWelcome from '@/pages/auth/SignupWelcome'
import ForgotPassword from '@/pages/auth/ForgotPassword'
import Dashboard from '@/pages/dashboard/index'
import Orders from '@/pages/orders/index'
import QuotationsPage from '@/pages/quotations/index'
import OrderDetail from '@/pages/orders/OrderDetail'
import OrderAuditReport from '@/pages/orders/OrderAuditReport'
import Products from '@/pages/products/index'
import ProductForm from '@/pages/products/ProductForm'
import ProductAuditReport from '@/pages/products/ProductAuditReport'
import ProductConfiguratorPage from '@/pages/products/ProductConfiguratorPage'
import Services from '@/pages/services/index'
import ServiceForm from '@/pages/services/ServiceForm'
import ServiceAuditReport from '@/pages/services/ServiceAuditReport'
import Customers from '@/pages/customers/index'
import CustomerDetail from '@/pages/customers/CustomerDetail'
import ReviewsPage from '@/pages/reviews/index'
import TeamPage from '@/pages/team/index'
import RolesPage from '@/pages/roles/index'
import SettingsPage from '@/pages/settings/index'
import SupportActivityPage from '@/pages/settings/SupportActivity'
import AboutPage from '@/pages/about/index'
import CategoriesPage from '@/pages/categories/index'
import Inventory from '@/pages/inventory/index'
import StorageLocationsPage from '@/pages/inventory/StorageLocations'
import PlantsPage from '@/pages/inventory/Plants'
import InventorySettingsPage from '@/pages/inventory/InventorySettings'
import POS from '@/pages/pos/index'
import RestaurantFloorPage from '@/pages/restaurant/Floor'
import RestaurantKitchenPage from '@/pages/restaurant/Kitchen'
import RestaurantSetupPage from '@/pages/restaurant/Setup'
import RestaurantPOSPage from '@/pages/restaurant/RestaurantPOS'
import RestaurantOrderPage from '@/pages/restaurant/Order'
import RestaurantReservationsPage from '@/pages/restaurant/Reservations'
import RestaurantReportsPage from '@/pages/restaurant/Reports'
import RestaurantMenuPage from '@/pages/restaurant/Menu'
import RestaurantsPage from '@/pages/restaurant/Restaurants'
import SubscriptionsSalesPage from '@/pages/sales/Subscriptions'
import MarketplaceLeadsPage from '@/pages/sales/MarketplaceLeads'
import RentalHubPage from '@/pages/rental/RentalHub'
import InvoicesPage from '@/pages/invoices/index'
import InvoiceDetail from '@/pages/invoices/InvoiceDetail'
import InvoiceTemplatesPage from '@/pages/invoices/InvoiceTemplates'
import CouponsPage from '@/pages/coupons/index'
import ReportsPage from '@/pages/reports/index'
import PlansPage from '@/pages/plans/index'
import BookingsPage from '@/pages/bookings/index'
import BookingDetail from '@/pages/bookings/BookingDetail'
import ProjectsPage from '@/pages/projects/index'
import ProjectDetail from '@/pages/projects/ProjectDetail'
import NotificationsPage from '@/pages/notifications/index'
import NotificationSettingsPage from '@/pages/notifications/settings'
import SuppliersPage from '@/pages/suppliers/index'
import MasterDataReport from '@/pages/master-data/MasterDataReport'
import MasterDataNew    from '@/pages/master-data/MasterDataNew'
import PurchaseOrdersPage from '@/pages/purchase-orders/index'
import PurchaseOrderDetail from '@/pages/purchase-orders/PurchaseOrderDetail'
import POTemplatesPage from '@/pages/purchase-orders/POTemplates'
import PurchaseRequisitionsPage from '@/pages/procurement/PurchaseRequisitions'
import SourcingSetupPage from '@/pages/procurement/SourcingSetup'
import VendorInvoicesAPPage from '@/pages/procurement/VendorInvoicesAP'
import GoodsManagementPage from '@/pages/procurement/GoodsManagement'
import SpecialProcurementPage from '@/pages/procurement/SpecialProcurement'
import CreditDebitMemos from '@/pages/finance/CreditDebitMemos'
import ProductionOrdersPage from '@/pages/production/index'
import ProductionOrderDetailPage from '@/pages/production/OrderDetail'
import ProductionSchedulePage from '@/pages/production/Schedule'
import ProductionWorkCentersPage from '@/pages/production/WorkCenters'
import ProductionMRPPage from '@/pages/production/MRP'
import ProductionAnalyticsPage from '@/pages/production/Analytics'
import StoresPage from '@/pages/stores/index'
import ProfilePage from '@/pages/profile/index'
import RelationshipManagerPage from '@/pages/relationship-manager/index'

// HR pages
import HRDepartmentsPage from '@/pages/hr/departments'
import HRDesignationsPage from '@/pages/hr/designations'
import HREmployeesPage from '@/pages/hr/employees/index'
import HREmployeeDetailPage from '@/pages/hr/employees/EmployeeDetail'
import HRAttendancePage from '@/pages/hr/attendance/index'
import MyAttendancePage from '@/pages/hr/attendance/MyAttendance'
import AttendanceReportPage from '@/pages/hr/attendance/AttendanceReport'
import HRLeaveRequestsPage from '@/pages/hr/leaves/index'
import LeavePoliciesPage from '@/pages/hr/leaves/Policies'
import HolidaysPage from '@/pages/hr/leaves/Holidays'
import MyLeavesPage from '@/pages/hr/leaves/MyLeaves'
import HRSalaryPage from '@/pages/hr/salary/index'
import HRPayrollPage from '@/pages/hr/payroll/index'
import HRPayrollDetailPage from '@/pages/hr/payroll/PayrollDetail'
import HROffersPage from '@/pages/hr/offers/index'
import HROfferTemplatesPage from '@/pages/hr/offers/Templates'

// HR Extended modules
import HRRecruitmentPage from '@/pages/hr/recruitment/index'
import HRJobDetailPage from '@/pages/hr/recruitment/JobDetail'
import HROnboardingPage from '@/pages/hr/onboarding/index'
import MyOnboardingPage from '@/pages/hr/onboarding/MyOnboarding'
import HRPerformancePage from '@/pages/hr/performance/index'
import HRCycleDetailPage from '@/pages/hr/performance/CycleDetail'
import HRReviewDetailPage from '@/pages/hr/performance/ReviewDetail'
import MyPerformancePage from '@/pages/hr/performance/MyPerformance'
import HRCompliancePage from '@/pages/hr/compliance/index'
import HRPolicyDetailPage from '@/pages/hr/compliance/PolicyDetail'
import MyPoliciesPage from '@/pages/hr/compliance/MyPolicies'
import HRTrainingPage from '@/pages/hr/training/index'
import HRProgramDetailPage from '@/pages/hr/training/ProgramDetail'
import MyTrainingPage from '@/pages/hr/training/MyTraining'
import CourseLearningPage from '@/pages/hr/training/CourseLearning'
import MyESSPage from '@/pages/hr/ess/MyESS'
import HRAnnouncementsPage from '@/pages/hr/announcements/index'
import MyAnnouncementsPage from '@/pages/hr/announcements/MyAnnouncements'
import HRExpensesPage from '@/pages/hr/expenses/index'
import MyExpensesPage from '@/pages/hr/expenses/MyExpenses'
import HRHelpdeskPage from '@/pages/hr/helpdesk/index'
import MyTicketsPage from '@/pages/hr/helpdesk/MyTickets'
import HRTicketDetailPage from '@/pages/hr/helpdesk/TicketDetail'

// Finance pages (lazy-imported as real files will be created)
import FinanceDashboard from '@/pages/finance/index'
import FinanceBasic from '@/pages/finance/BasicFinance'
import FinanceCostCenters from '@/pages/finance/CostCenters'
import FinanceCOA from '@/pages/finance/ChartOfAccounts'
import FinanceJournal from '@/pages/finance/JournalEntries'
import FinanceTrialBalance from '@/pages/finance/TrialBalance'
import FinanceAR from '@/pages/finance/AccountsReceivable'
import FinanceOpenItems from '@/pages/finance/OpenItems'
import FinanceStatementVersions from '@/pages/finance/FinancialStatementVersions'
import FinancePostingControls from '@/pages/finance/PostingControls'
import FinanceProfitCenters from '@/pages/finance/ProfitCenters'
import FinanceFxRevaluation from '@/pages/finance/FxRevaluation'
import FinancePostingRules from '@/pages/finance/PostingRules'
import FinanceDocumentSplitting from '@/pages/finance/DocumentSplitting'
import FinanceParallelLedgers from '@/pages/finance/ParallelLedgers'
import FinanceAP from '@/pages/finance/AccountsPayable'
import FinanceBank from '@/pages/finance/BankCash'
import FinanceBudgets from '@/pages/finance/BudgetsForecast'
import FinanceAssets from '@/pages/finance/FixedAssets'
import FinanceAssetReports from '@/pages/finance/AssetReports'
import FinanceAssetDepreciationSchedule from '@/pages/finance/AssetDepreciationSchedule'
import FinanceAssetGlReconciliation from '@/pages/finance/AssetGlReconciliation'
import FinanceTax from '@/pages/finance/TaxReturns'
import FinancePnL from '@/pages/finance/reports/ProfitLoss'
import FinanceBalanceSheet from '@/pages/finance/reports/BalanceSheet'
import FinanceCashFlow from '@/pages/finance/reports/CashFlow'
import FinanceCostAnalysis from '@/pages/finance/reports/CostAnalysis'
import FinanceGLReport from '@/pages/finance/reports/GLReport'
import FinanceCapital from '@/pages/finance/Capital'
import FinanceApprovals from '@/pages/finance/Approvals'
import FinanceAudit from '@/pages/finance/AuditLog'
import FinancePeriodControl from '@/pages/finance/PeriodControl'
import FinanceFieldRuleConfig from '@/pages/finance/FieldRuleConfig'
import COLayout from '@/layouts/COLayout'
import ControllingDashboardPage from '@/pages/controlling/index'
import ControllingProductCostsPage from '@/pages/controlling/ProductCosts'
import ControllingManufacturingOrdersPage from '@/pages/controlling/ManufacturingOrders'
import ControllingSetupPage from '@/pages/controlling/Setup'
import ControllingActivityTypesPage from '@/pages/controlling/ActivityTypes'
import ControllingFinanceIntegrationPage from '@/pages/controlling/FinanceIntegration'
import ControllingAreasPage from '@/pages/controlling/ControllingAreas'
import ControllingManufacturingOrderDetail from '@/pages/controlling/ManufacturingOrderDetail'
import ControllingWipReport from '@/pages/controlling/WipReport'
import ControllingGoodsMovementsPage from '@/pages/controlling/GoodsMovements'
import ControllingActivityConfirmationsPage from '@/pages/controlling/ActivityConfirmations'
import ControllingCostAllocationsPage from '@/pages/controlling/CostAllocations'
import ControllingPeriodEndPage from '@/pages/controlling/PeriodEnd'
import ControllingInternalOrdersPage from '@/pages/controlling/InternalOrders'
import ControllingCostBookingsPage from '@/pages/controlling/CostBookings'
import ControllingVarianceAnalysisPage from '@/pages/controlling/VarianceAnalysis'
import ControllingProductionProcessPage from '@/pages/controlling/ProductionProcess'
import ControllingInternalCostPage from '@/pages/controlling/InternalCostManagement'
import ControllingRoutingPage from '@/pages/controlling/Routing'

// CRM pages
import CrmDashboard from '@/pages/crm/index'
import CrmContacts from '@/pages/crm/Contacts'
import CrmAccounts from '@/pages/crm/Accounts'
import CrmLeads from '@/pages/crm/Leads'
import CrmPipeline from '@/pages/crm/Pipeline'
import CrmActivities from '@/pages/crm/Activities'
import CrmInbox from '@/pages/crm/Inbox'
import ContactQueries from '@/pages/queries/ContactQueries'
import CrmTickets from '@/pages/crm/Tickets'
import CrmTicketDetail from '@/pages/crm/TicketDetail'
import CrmKnowledgeBase from '@/pages/crm/KnowledgeBase'
import CrmSegments from '@/pages/crm/Segments'
import CrmTemplates from '@/pages/crm/Templates'
import DocumentTemplatesPage from '@/pages/document-templates/index'
import SystemModulesPage from '@/pages/system/Modules'
import SystemModelsPage from '@/pages/system/Models'
import SystemTableDataPage from '@/pages/system/TableData'
import SystemBrowseTablePage from '@/pages/system/BrowseTable'
import VendorAdminRoute from './VendorAdminRoute'
import SystemStorefrontDisplayPage from '@/pages/system/StorefrontDisplay'
import SystemSocialLinksPage from '@/pages/system/SocialLinks'
import CreateMessagesPage from '@/pages/system/CreateMessages'
import SystemUpiCheckoutPage from '@/pages/system/UpiCheckout'
import AssetsLayout from '@/pages/system/assets'
import AssetImagesPage from '@/pages/system/assets/Images'
import CrmCampaigns from '@/pages/crm/Campaigns'
import CrmWorkflows from '@/pages/crm/Workflows'
import CrmAIInsights from '@/pages/crm/AIInsights'
import CrmIntegrations from '@/pages/crm/Integrations'
import CrmReports from '@/pages/crm/Reports'
import CrmAudit from '@/pages/crm/Audit'
import CrmCareReminder from '@/pages/crm/CareReminder'

// Blog Manager
import BlogManagerPage from '@/pages/blog/index'

// Website Builder pages
import WebsitesPage from '@/pages/websites/index'
import WebsiteBuilder from '@/pages/websites/Builder'
import SEOManagementPage from '@/pages/websites/SEOManagement'
import WebsiteAnalyticsPage from '@/pages/websites/WebsiteAnalytics'
import WebsiteSubmissions from '@/pages/websites/Submissions'
import WebsiteTemplateGallery from '@/pages/websites/TemplateGallery'
import StorefrontBrowserPreviewShell from '@/pages/websites/StorefrontBrowserPreviewShell'
import LegacyBrowserPreviewRedirect from '@/pages/websites/LegacyBrowserPreviewRedirect'
import PreviewDraftStorePathRedirect from '@/pages/websites/PreviewDraftStorePathRedirect'

// Commission pages
import CommissionLayout from '@/pages/commission/index'
import CommissionPayees from '@/pages/commission/Payees'
import CommissionPlans from '@/pages/commission/Plans'
import CommissionAssignments from '@/pages/commission/Assignments'
import CommissionAccruals from '@/pages/commission/Accruals'
import CommissionPayouts from '@/pages/commission/Payouts'
import CommissionReportPage from '@/pages/commission/reports/CommissionReport'
import StoreCoveragePage from '@/pages/sales/StoreCoverage'
import SalesManagerPage from '@/pages/sales/SalesManager'
import SalesAreaSetupPage from '@/pages/sales/SalesAreaSetup'
import SalesPlansPage from '@/pages/sales/Plans'
import SalesPropertiesPage from '@/pages/sales/Properties'
import SalesCoursesPage from '@/pages/sales/Courses'
import SalesFitnessClassesPage from '@/pages/sales/FitnessClasses'
import SalesVehiclesPage from '@/pages/sales/Vehicles'
import SalesEventsPage from '@/pages/sales/Events'
import SalesRecurringBookingsPage from '@/pages/sales/RecurringBookings'
import SalesTestimonialsPage from '@/pages/sales/Testimonials'
import SalesBookingWizardStepsPage from '@/pages/sales/BookingWizardSteps'
import SalesBookingResourcesPage from '@/pages/sales/BookingResources'
import DeliveryConditionsPage from '@/pages/sales/DeliveryConditions'

const routerBasename = (import.meta.env.VITE_ROUTER_BASENAME || '').replace(/\/$/, '')

export const router = createBrowserRouter([
  {
    path: '/preview/draft',
    element: <StorefrontBrowserPreviewShell />,
  },
  {
    path: '/preview/draft/store/:vendorSlug/*',
    element: <PreviewDraftStorePathRedirect />,
  },
  {
    path: '/websites/browser-preview',
    element: <LegacyBrowserPreviewRedirect />,
  },
  {
    path: '/login',
    element: <AuthLayout />,
    children: [{ index: true, element: <Login /> }],
  },
  {
    path: '/auth/handoff',
    element: <AuthLayout />,
    children: [{ index: true, element: <VendorHandoff /> }],
  },
  {
    path: '/register',
    element: <Register />,
  },
  {
    path: '/signup',
    element: <Register />,
  },
  {
    path: '/welcome',
    element: (
      <ProtectedRoute>
        <SignupWelcome />
      </ProtectedRoute>
    ),
  },
  {
    path: '/forgot-password',
    element: <AuthLayout />,
    children: [{ index: true, element: <ForgotPassword /> }],
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'orders', element: <Orders /> },
      { path: 'quotations', element: <QuotationsPage /> },
      { path: 'quotations/templates', element: <InvoiceTemplatesPage /> },
      { path: 'quotations/:id', element: <InvoiceDetail /> },
      { path: 'orders/:id/audit', element: <OrderAuditReport /> },
      { path: 'orders/:id', element: <OrderDetail /> },
      { path: 'products', element: <Products /> },
      { path: 'products/new', element: <ProductForm /> },
      { path: 'products/:id/audit', element: <ProductAuditReport /> },
      { path: 'products/:id/configure', element: <ProductConfiguratorPage /> },
      { path: 'products/:id', element: <ProductForm /> },
      { path: 'services', element: <Services /> },
      { path: 'services/new', element: <ServiceForm /> },
      { path: 'services/:id/audit', element: <ServiceAuditReport /> },
      { path: 'services/:id', element: <ServiceForm /> },
      { path: 'categories', element: <CategoriesPage /> },
      { path: 'master-data', element: <MasterDataReport /> },
      { path: 'master-data/new', element: <MasterDataNew /> },
      { path: 'suppliers', element: <Navigate to="/master-data" replace /> },
      { path: 'purchase-orders', element: <PurchaseOrdersPage /> },
      { path: 'purchase-orders/templates', element: <POTemplatesPage /> },
      { path: 'purchase-orders/:id', element: <PurchaseOrderDetail /> },
      { path: 'procurement/requisitions', element: <PurchaseRequisitionsPage /> },
      { path: 'procurement/sourcing', element: <SourcingSetupPage /> },
      { path: 'procurement/vendor-invoices', element: <VendorInvoicesAPPage /> },
      { path: 'procurement/goods', element: <GoodsManagementPage /> },
      { path: 'procurement/special', element: <SpecialProcurementPage /> },
      { path: 'production', element: <ProductionOrdersPage /> },
      { path: 'production/orders/:orderId', element: <ProductionOrderDetailPage /> },
      { path: 'production/schedule', element: <ProductionSchedulePage /> },
      { path: 'production/work-centers', element: <ProductionWorkCentersPage /> },
      { path: 'production/mrp', element: <ProductionMRPPage /> },
      { path: 'production/analytics', element: <ProductionAnalyticsPage /> },
      { path: 'inventory', element: <Inventory /> },
      { path: 'inventory/settings', element: <InventorySettingsPage /> },
      { path: 'storage-locations', element: <StorageLocationsPage /> },
      { path: 'plants', element: <PlantsPage /> },
      { path: 'pos', element: <POS /> },
      { path: 'restaurant/outlets', element: <RestaurantsPage /> },
      { path: 'restaurant/floor', element: <RestaurantFloorPage /> },
      { path: 'restaurant/kitchen', element: <RestaurantKitchenPage /> },
      { path: 'restaurant/pos', element: <RestaurantPOSPage /> },
      { path: 'restaurant/setup', element: <RestaurantSetupPage /> },
      { path: 'restaurant/menu', element: <RestaurantMenuPage /> },
      { path: 'restaurant/order/:orderId', element: <RestaurantOrderPage /> },
      { path: 'restaurant/reservations', element: <RestaurantReservationsPage /> },
      { path: 'restaurant/reports', element: <RestaurantReportsPage /> },
      { path: 'subscriptions', element: <SubscriptionsSalesPage /> },
      { path: 'marketplace', element: <MarketplaceLeadsPage /> },
      { path: 'sales/coverage', element: <StoreCoveragePage /> },
      { path: 'sales/delivery-conditions', element: <DeliveryConditionsPage /> },
      { path: 'sales/manager', element: <SalesManagerPage /> },
      { path: 'sales/sales-area', element: <SalesAreaSetupPage /> },
      { path: 'sales/plans', element: <SalesPlansPage /> },
      { path: 'sales/properties', element: <SalesPropertiesPage /> },
      { path: 'sales/courses', element: <SalesCoursesPage /> },
      { path: 'sales/fitness-classes', element: <SalesFitnessClassesPage /> },
      { path: 'sales/vehicles', element: <SalesVehiclesPage /> },
      { path: 'sales/events', element: <SalesEventsPage /> },
      { path: 'sales/recurring-bookings', element: <SalesRecurringBookingsPage /> },
      { path: 'sales/testimonials', element: <SalesTestimonialsPage /> },
      { path: 'sales/booking-wizard', element: <SalesBookingWizardStepsPage /> },
      { path: 'sales/booking-resources', element: <SalesBookingResourcesPage /> },
      { path: 'rental', element: <RentalHubPage /> },
      { path: 'invoices', element: <InvoicesPage /> },
      { path: 'invoices/templates', element: <InvoiceTemplatesPage /> },
      { path: 'invoices/:id', element: <InvoiceDetail /> },
      { path: 'memos', element: <CreditDebitMemos /> },
      { path: 'coupons', element: <CouponsPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'template', element: <Navigate to="/websites/templates?customize=1" replace /> },
      { path: 'business-front', element: <Navigate to="/websites" replace /> },
      { path: 'storefront-builder', element: <Navigate to="/websites" replace /> },
      { path: 'blog', element: <BlogManagerPage /> },
      { path: 'websites', element: <WebsitesPage /> },
      /* Static path must be above :siteId or "templates" is treated as a site id. */
      { path: 'websites/templates', element: <WebsiteTemplateGallery /> },
      { path: 'websites/seo', element: <SEOManagementPage /> },
      { path: 'websites/analytics', element: <WebsiteAnalyticsPage /> },
      { path: 'websites/:siteId', element: <WebsiteBuilder /> },
      { path: 'websites/:siteId/submissions', element: <WebsiteSubmissions /> },
      { path: 'website-templates', element: <Navigate to="/websites/templates" replace /> },
      { path: 'customers', element: <Navigate to="/master-data" replace /> },
      { path: 'customers/:id', element: <CustomerDetail /> },
      { path: 'reviews', element: <ReviewsPage /> },
      { path: 'stores', element: <StoresPage /> },
      { path: 'team', element: <TeamPage /> },
      { path: 'roles', element: <RolesPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'settings/support-activity', element: <SupportActivityPage /> },
      { path: 'about', element: <AboutPage /> },
      { path: 'system/modules', element: <SystemModulesPage /> },
      { path: 'system/models', element: <SystemModelsPage /> },
      { path: 'system/table-data', element: <VendorAdminRoute><SystemTableDataPage /></VendorAdminRoute> },
      { path: 'system/browse-table', element: <VendorAdminRoute><SystemBrowseTablePage /></VendorAdminRoute> },
      { path: 'system/storefront-display', element: <SystemStorefrontDisplayPage /> },
      { path: 'system/social-links', element: <SystemSocialLinksPage /> },
      { path: 'system/messages', element: <CreateMessagesPage /> },
      { path: 'system/upi-checkout', element: <SystemUpiCheckoutPage /> },
      {
        path: 'system/assets',
        element: <AssetsLayout />,
        children: [
          { index: true, element: <Navigate to="images" replace /> },
          { path: 'images', element: <AssetImagesPage /> },
        ],
      },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'relationship-manager', element: <RelationshipManagerPage /> },
      { path: 'plans', element: <PlansPage /> },
      { path: 'bookings', element: <BookingsPage /> },
      { path: 'bookings/:id', element: <BookingDetail /> },
      { path: 'projects', element: <ProjectsPage /> },
      { path: 'projects/:id', element: <ProjectDetail /> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'queries', element: <ContactQueries /> },
      { path: 'notifications/settings', element: <NotificationSettingsPage /> },
      // HR routes
      { path: 'hr/employees', element: <HREmployeesPage /> },
      { path: 'hr/employees/:id', element: <HREmployeeDetailPage /> },
      { path: 'hr/attendance', element: <HRAttendancePage /> },
      { path: 'hr/attendance/my', element: <MyAttendancePage /> },
      { path: 'hr/attendance/report', element: <AttendanceReportPage /> },
      { path: 'hr/leaves', element: <HRLeaveRequestsPage /> },
      { path: 'hr/leaves/policies', element: <LeavePoliciesPage /> },
      { path: 'hr/leaves/holidays', element: <HolidaysPage /> },
      { path: 'hr/leaves/my', element: <MyLeavesPage /> },
      { path: 'hr/salary', element: <HRSalaryPage /> },
      { path: 'hr/payroll', element: <HRPayrollPage /> },
      { path: 'hr/payroll/:id', element: <HRPayrollDetailPage /> },
      { path: 'hr/offers', element: <HROffersPage /> },
      { path: 'hr/offers/templates', element: <HROfferTemplatesPage /> },
      { path: 'hr/departments', element: <HRDepartmentsPage /> },
      { path: 'hr/designations', element: <HRDesignationsPage /> },

      // HR Extended ─ Recruitment & Onboarding
      { path: 'hr/recruitment',         element: <HRRecruitmentPage /> },
      { path: 'hr/recruitment/jobs/:id', element: <HRJobDetailPage /> },
      { path: 'hr/onboarding',          element: <HROnboardingPage /> },
      { path: 'hr/my-onboarding',       element: <MyOnboardingPage /> },

      // HR Extended ─ Performance
      { path: 'hr/performance',         element: <HRPerformancePage /> },
      { path: 'hr/performance/cycles/:id',  element: <HRCycleDetailPage /> },
      { path: 'hr/performance/reviews/:id', element: <HRReviewDetailPage /> },
      { path: 'hr/my-performance',      element: <MyPerformancePage /> },

      // HR Extended ─ Compliance
      { path: 'hr/compliance',                element: <HRCompliancePage /> },
      { path: 'hr/compliance/policies/:id',   element: <HRPolicyDetailPage /> },
      { path: 'hr/my-policies',               element: <MyPoliciesPage /> },

      // HR Extended ─ Training
      { path: 'hr/training',            element: <HRTrainingPage /> },
      { path: 'hr/training/:id',        element: <HRProgramDetailPage /> },
      { path: 'hr/my-training',         element: <MyTrainingPage /> },
      { path: 'hr/my-training/:id',     element: <CourseLearningPage /> },

      // HR Extended ─ Employee Self Service
      { path: 'hr/me',                  element: <MyESSPage /> },
      { path: 'hr/announcements',       element: <HRAnnouncementsPage /> },
      { path: 'hr/my-announcements',    element: <MyAnnouncementsPage /> },
      { path: 'hr/expenses',            element: <HRExpensesPage /> },
      { path: 'hr/my-expenses',         element: <MyExpensesPage /> },
      { path: 'hr/helpdesk',            element: <HRHelpdeskPage /> },
      { path: 'hr/my-helpdesk',         element: <MyTicketsPage /> },
      { path: 'hr/helpdesk/:id',        element: <HRTicketDetailPage /> },

      // Finance routes
      { path: 'finance',                        element: <FinanceDashboard /> },
      { path: 'finance/basic',                  element: <FinanceBasic /> },
      { path: 'finance/coa',                    element: <FinanceCOA /> },
      { path: 'finance/journal',                element: <FinanceJournal /> },
      { path: 'finance/trial-balance',          element: <FinanceTrialBalance /> },
      { path: 'finance/statement-versions',     element: <FinanceStatementVersions /> },
      { path: 'finance/posting-controls',       element: <FinancePostingControls /> },
      { path: 'finance/profit-centers',         element: <FinanceProfitCenters /> },
      { path: 'finance/fx-revaluation',         element: <FinanceFxRevaluation /> },
      { path: 'finance/posting-rules',          element: <FinancePostingRules /> },
      { path: 'finance/document-splitting',     element: <FinanceDocumentSplitting /> },
      { path: 'finance/parallel-ledgers',       element: <FinanceParallelLedgers /> },
      { path: 'finance/ar',                     element: <FinanceAR /> },
      { path: 'finance/open-items',             element: <FinanceOpenItems /> },
      { path: 'finance/ap',                     element: <FinanceAP /> },
      { path: 'finance/bank',                   element: <FinanceBank /> },
      { path: 'finance/budgets',                element: <FinanceBudgets /> },
      { path: 'finance/assets',                         element: <FinanceAssets /> },
      { path: 'finance/assets/reports',                 element: <FinanceAssetReports /> },
      { path: 'finance/assets/depreciation-schedule',   element: <FinanceAssetDepreciationSchedule /> },
      { path: 'finance/assets/gl-reconciliation',       element: <FinanceAssetGlReconciliation /> },
      { path: 'finance/tax',                    element: <FinanceTax /> },
      { path: 'finance/reports/pnl',            element: <FinancePnL /> },
      { path: 'finance/reports/balance-sheet',  element: <FinanceBalanceSheet /> },
      { path: 'finance/reports/cash-flow',      element: <FinanceCashFlow /> },
      { path: 'finance/reports/cost-analysis',  element: <FinanceCostAnalysis /> },
      { path: 'finance/reports/gl',             element: <FinanceGLReport /> },
      { path: 'finance/capital',                element: <FinanceCapital /> },
      { path: 'finance/approvals',              element: <FinanceApprovals /> },
      { path: 'finance/audit',                  element: <FinanceAudit /> },
      { path: 'finance/periods',                 element: <FinancePeriodControl /> },
      { path: 'finance/field-rules',            element: <FinanceFieldRuleConfig /> },

      // Controlling (CO) — nested under dedicated COLayout sub-sidebar
      {
        path: 'controlling',
        element: <COLayout />,
        children: [
          { index: true,                             element: <ControllingDashboardPage /> },
          // Cost planning
          { path: 'product-costs',                   element: <ControllingProductCostsPage /> },
          { path: 'routing',                         element: <ControllingRoutingPage /> },
          { path: 'setup',                           element: <ControllingSetupPage /> },
          { path: 'controlling-areas',                element: <ControllingAreasPage /> },
          { path: 'activity-types',                  element: <ControllingActivityTypesPage /> },
          { path: 'finance-integration',           element: <ControllingFinanceIntegrationPage /> },
          // Orders
          { path: 'orders',                          element: <ControllingManufacturingOrdersPage /> },
          { path: 'orders/:id',                      element: <ControllingManufacturingOrderDetail /> },
          { path: 'internal-orders',                 element: <ControllingInternalOrdersPage /> },
          // Production execution
          { path: 'production-process',              element: <ControllingProductionProcessPage /> },
          { path: 'goods-movements',                 element: <ControllingGoodsMovementsPage /> },
          { path: 'activity-confirmations',          element: <ControllingActivityConfirmationsPage /> },
          { path: 'cost-bookings',                   element: <ControllingCostBookingsPage /> },
          // Analysis & reporting
          { path: 'wip',                             element: <ControllingWipReport /> },
          { path: 'variance-analysis',               element: <ControllingVarianceAnalysisPage /> },
          { path: 'internal-cost',                   element: <ControllingInternalCostPage /> },
          // Period end
          { path: 'cost-allocations',                element: <ControllingCostAllocationsPage /> },
          { path: 'period-end',                      element: <ControllingPeriodEndPage /> },
          // Cost Centers (moved from Finance)
          { path: 'cost-centers',                    element: <FinanceCostCenters /> },
        ],
      },

      // CRM routes
      { path: 'crm',                element: <CrmDashboard /> },
      { path: 'crm/contacts',       element: <CrmContacts /> },
      { path: 'crm/accounts',       element: <CrmAccounts /> },
      { path: 'crm/leads',          element: <CrmLeads /> },
      { path: 'crm/pipeline',       element: <CrmPipeline /> },
      { path: 'crm/activities',     element: <CrmActivities /> },
      { path: 'crm/inbox',          element: <CrmInbox /> },
      { path: 'crm/tickets',        element: <CrmTickets /> },
      { path: 'crm/tickets/:id',    element: <CrmTicketDetail /> },
      { path: 'crm/kb',             element: <CrmKnowledgeBase /> },
      { path: 'crm/segments',       element: <CrmSegments /> },
      { path: 'crm/templates',          element: <CrmTemplates /> },
      { path: 'document-templates',     element: <DocumentTemplatesPage /> },
      { path: 'crm/campaigns',      element: <CrmCampaigns /> },
      { path: 'crm/workflows',      element: <CrmWorkflows /> },
      { path: 'crm/ai',             element: <CrmAIInsights /> },
      { path: 'crm/integrations',   element: <CrmIntegrations /> },
      { path: 'crm/reports',        element: <CrmReports /> },
      { path: 'crm/audit',          element: <CrmAudit /> },
      { path: 'crm/care-reminder',  element: <CrmCareReminder /> },
      // Commission routes
      {
        path: 'commission',
        element: <CommissionLayout />,
        children: [
          { index: true, element: <CommissionLayout /> },
          { path: 'payees', element: <CommissionPayees /> },
          { path: 'plans', element: <CommissionPlans /> },
          { path: 'assignments', element: <CommissionAssignments /> },
          { path: 'accruals', element: <CommissionAccruals /> },
          { path: 'payouts', element: <CommissionPayouts /> },
          { path: 'reports', element: <CommissionReportPage /> },
        ],
      },
    ],
  },
  // Catch-all: redirect to root (which will redirect to login if not authenticated)
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
], {
  basename: routerBasename || undefined,
  future: {
    v7_relativeSplatPath: true,
    v7_fetcherPersist: true,
    v7_normalizeFormMethod: true,
    v7_partialHydration: true,
    v7_skipActionErrorRevalidation: true,
  },
})
