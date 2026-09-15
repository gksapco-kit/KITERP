import { lazy } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import AuthLayout from '@/layouts/AuthLayout'
import DashboardLayout from '@/layouts/DashboardLayout'
import ProtectedRoute from './ProtectedRoute'
import PermissionRoute from './PermissionRoute'
import VendorAdminRoute from './VendorAdminRoute'
import LegacyBrowserPreviewRedirect from '@/pages/websites/LegacyBrowserPreviewRedirect'
import PreviewDraftStorePathRedirect from '@/pages/websites/PreviewDraftStorePathRedirect'

// Lazy page modules — keeps /login from transforming the entire app in Vite
const Login = lazy(() => import('@/pages/auth/Login'))
const VendorHandoff = lazy(() => import('@/pages/auth/Handoff'))
const Register = lazy(() => import('@/pages/auth/Register'))
const SignupWelcome = lazy(() => import('@/pages/auth/SignupWelcome'))
const ForgotPassword = lazy(() => import('@/pages/auth/ForgotPassword'))
const Dashboard = lazy(() => import('@/pages/dashboard/index'))
const Orders = lazy(() => import('@/pages/orders/index'))
const QuotationsPage = lazy(() => import('@/pages/quotations/index'))
const OrderDetail = lazy(() => import('@/pages/orders/OrderDetail'))
const OrderAuditReport = lazy(() => import('@/pages/orders/OrderAuditReport'))
const Products = lazy(() => import('@/pages/products/index'))
const ProductForm = lazy(() => import('@/pages/products/ProductForm'))
const ProductAuditReport = lazy(() => import('@/pages/products/ProductAuditReport'))
const ProductConfiguratorPage = lazy(() => import('@/pages/products/ProductConfiguratorPage'))
const Services = lazy(() => import('@/pages/services/index'))
const ServiceForm = lazy(() => import('@/pages/services/ServiceForm'))
const ServiceAuditReport = lazy(() => import('@/pages/services/ServiceAuditReport'))
const Customers = lazy(() => import('@/pages/customers/index'))
const CustomerDetail = lazy(() => import('@/pages/customers/CustomerDetail'))
const ReviewsPage = lazy(() => import('@/pages/reviews/index'))
const TeamPage = lazy(() => import('@/pages/team/index'))
const RolesPage = lazy(() => import('@/pages/roles/index'))
const SettingsPage = lazy(() => import('@/pages/settings/index'))
const SupportActivityPage = lazy(() => import('@/pages/settings/SupportActivity'))
const AboutPage = lazy(() => import('@/pages/about/index'))
const CategoriesPage = lazy(() => import('@/pages/categories/index'))
const ProductGroupsPage = lazy(() => import('@/pages/productGroups/index'))
const ProductGroupDetailPage = lazy(() => import('@/pages/productGroups/ProductGroupDetail'))
const Inventory = lazy(() => import('@/pages/inventory/index'))
const StockCountPage = lazy(() => import('@/pages/inventory/StockCount'))
const ExpiryDashboardPage = lazy(() => import('@/pages/inventory/ExpiryDashboard'))
const ReservationsPage = lazy(() => import('@/pages/inventory/Reservations'))
const TransferOrdersPage = lazy(() => import('@/pages/inventory/TransferOrders'))
const InventoryReportsPage = lazy(() => import('@/pages/inventory/InventoryReports'))
const InventoryAnalyticsPage = lazy(() => import('@/pages/inventory/analytics/index'))
const StorageLocationsPage = lazy(() => import('@/pages/inventory/StorageLocations'))
const PlantsPage = lazy(() => import('@/pages/inventory/Plants'))
const InventorySettingsPage = lazy(() => import('@/pages/inventory/InventorySettings'))
const POS = lazy(() => import('@/pages/pos/index'))
const RestaurantFloorPage = lazy(() => import('@/pages/restaurant/Floor'))
const RestaurantKitchenPage = lazy(() => import('@/pages/restaurant/Kitchen'))
const RestaurantSetupPage = lazy(() => import('@/pages/restaurant/Setup'))
const RestaurantPOSPage = lazy(() => import('@/pages/restaurant/RestaurantPOS'))
const RestaurantOrderPage = lazy(() => import('@/pages/restaurant/Order'))
const RestaurantReservationsPage = lazy(() => import('@/pages/restaurant/Reservations'))
const RestaurantReportsPage = lazy(() => import('@/pages/restaurant/Reports'))
const RestaurantMenuPage = lazy(() => import('@/pages/restaurant/Menu'))
const RestaurantsPage = lazy(() => import('@/pages/restaurant/Restaurants'))
const SubscriptionsSalesPage = lazy(() => import('@/pages/sales/Subscriptions'))
const MarketplaceLeadsPage = lazy(() => import('@/pages/sales/MarketplaceLeads'))
const RentalDashboardPage = lazy(() => import('@/pages/rental/RentalDashboardPage'))
const RentalAssetsPage = lazy(() => import('@/pages/rental/RentalAssetsPage'))
const RentalAssetFormPage = lazy(() => import('@/pages/rental/RentalAssetFormPage'))
const RentalBookingsPage = lazy(() => import('@/pages/rental/RentalBookingsPage'))
const RentalBookingDetailPage = lazy(() => import('@/pages/rental/RentalBookingDetailPage'))
const RentalCalendarPage = lazy(() => import('@/pages/rental/RentalCalendarPage'))
const RentalReturnsPage = lazy(() => import('@/pages/rental/RentalReturnsPage'))
const RentalReportsPage = lazy(() => import('@/pages/rental/RentalReportsPage'))
const RentalSettingsPage = lazy(() => import('@/pages/rental/RentalSettingsPage'))
const RentalRegistrationFormsPage = lazy(() => import('@/pages/rental/RentalRegistrationFormsPage'))
const RentalFilledRegistrationsPage = lazy(() => import('@/pages/rental/RentalFilledRegistrationsPage'))
const InvoicesPage = lazy(() => import('@/pages/invoices/index'))
const InvoiceDetail = lazy(() => import('@/pages/invoices/InvoiceDetail'))
const InvoiceTemplatesPage = lazy(() => import('@/pages/invoices/InvoiceTemplates'))
const CouponsPage = lazy(() => import('@/pages/coupons/index'))
const ReportsPage = lazy(() => import('@/pages/reports/index'))
const PlansPage = lazy(() => import('@/pages/plans/index'))
const BookingsPage = lazy(() => import('@/pages/bookings/index'))
const BookingDetail = lazy(() => import('@/pages/bookings/BookingDetail'))
const ProjectsPage = lazy(() => import('@/pages/projects/index'))
const ProjectDetail = lazy(() => import('@/pages/projects/ProjectDetail'))
const NotificationsPage = lazy(() => import('@/pages/notifications/index'))
const NotificationSettingsPage = lazy(() => import('@/pages/notifications/settings'))
const SuppliersPage = lazy(() => import('@/pages/suppliers/index'))
const MasterDataReport = lazy(() => import('@/pages/master-data/MasterDataReport'))
const MasterDataNew = lazy(() => import('@/pages/master-data/MasterDataNew'))
const PurchaseOrdersPage = lazy(() => import('@/pages/purchase-orders/index'))
const PurchaseOrderDetail = lazy(() => import('@/pages/purchase-orders/PurchaseOrderDetail'))
const POTemplatesPage = lazy(() => import('@/pages/purchase-orders/POTemplates'))
const CreatePurchaseOrderPage = lazy(() => import('@/pages/purchase-orders/CreatePurchaseOrderPage'))
const PurchaseOrderEditPage = lazy(() => import('@/pages/purchase-orders/PurchaseOrderEditPage'))
const PurchaseRequisitionsPage = lazy(() => import('@/pages/procurement/PurchaseRequisitions'))
const CreatePurchaseRequisitionPage = lazy(() => import('@/pages/procurement/CreatePurchaseRequisitionPage'))
const SupplierManagementPage = lazy(() => import('@/pages/procurement/SupplierManagement'))
const SourcingSetupPage = lazy(() => import('@/pages/procurement/SourcingSetup'))
const VendorInvoicesAPPage = lazy(() => import('@/pages/procurement/VendorInvoicesAP'))
const GoodsManagementPage = lazy(() => import('@/pages/procurement/GoodsManagement'))
const MaterialValuationPage = lazy(() => import('@/pages/inventory/MaterialValuation'))
const SpecialProcurementPage = lazy(() => import('@/pages/procurement/SpecialProcurement'))
const ProcurementFieldConfigPage = lazy(() => import('@/pages/procurement/FieldConfig'))
const ApprovalWorkflowPage = lazy(() => import('@/pages/procurement/ApprovalWorkflow'))
const RFQQuotationsPage = lazy(() => import('@/pages/procurement/RFQQuotations'))
const GoodsReceiptNotePage = lazy(() => import('@/pages/procurement/GoodsReceiptNote'))
const PurchaseReturnsPage = lazy(() => import('@/pages/procurement/PurchaseReturns'))
const SpendAnalyticsPage = lazy(() => import('@/pages/procurement/SpendAnalytics'))
const ProcurementReportsPage = lazy(() => import('@/pages/procurement/reports'))
const BudgetControlsPage = lazy(() => import('@/pages/procurement/BudgetControls'))
const ProcurementNumberRangesPage = lazy(() => import('@/pages/procurement/NumberRanges'))
const CreditDebitMemos = lazy(() => import('@/pages/finance/CreditDebitMemos'))
const ProductionOrdersPage = lazy(() => import('@/pages/production/index'))
const ProductionOrderDetailPage = lazy(() => import('@/pages/production/OrderDetail'))
const ProductionSchedulePage = lazy(() => import('@/pages/production/Schedule'))
const ProductionWorkCentersPage = lazy(() => import('@/pages/production/WorkCenters'))
const ProductionMRPPage = lazy(() => import('@/pages/production/MRP'))
const ProductionAnalyticsPage = lazy(() => import('@/pages/production/Analytics'))
const PharmaOverviewPage = lazy(() => import('@/pages/pharma/Overview'))
const PharmaSettingsPage = lazy(() => import('@/pages/pharma/Settings'))
const PharmaSettingsBatchNumberingPage = lazy(() => import('@/pages/pharma/SettingsBatchNumbering'))
const PharmaSettingsSequenceDetailPage = lazy(() => import('@/pages/pharma/SettingsSequenceDetail'))
const PharmaSettingsEsignPage = lazy(() => import('@/pages/pharma/SettingsEsign'))
const PharmaSettingsStoragePage = lazy(() => import('@/pages/pharma/SettingsStorage'))
const PharmaSettingsRegulatoryPage = lazy(() => import('@/pages/pharma/SettingsRegulatory'))
const PharmaSettingsProductsPage = lazy(() => import('@/pages/pharma/SettingsProducts'))
const PharmaBatchDetailPage = lazy(() => import('@/pages/pharma/BatchDetail'))
const PharmaBatchesPage = lazy(() => import('@/pages/pharma/Batches').then(m => ({ default: m.PharmaBatchesPage })))
const PharmaMovementsPage = lazy(() => import('@/pages/pharma/Batches').then(m => ({ default: m.PharmaMovementsPage })))
const PharmaFefoPage = lazy(() => import('@/pages/pharma/Batches').then(m => ({ default: m.PharmaFefoPage })))
const PharmaQuarantinePage = lazy(() => import('@/pages/pharma/Batches').then(m => ({ default: m.PharmaQuarantinePage })))
const PharmaMbrPage = lazy(() => import('@/pages/pharma/Quality').then(m => ({ default: m.PharmaMbrPage })))
const PharmaBprPage = lazy(() => import('@/pages/pharma/Quality').then(m => ({ default: m.PharmaBprPage })))
const PharmaQcSpecsPage = lazy(() => import('@/pages/pharma/Quality').then(m => ({ default: m.PharmaQcSpecsPage })))
const PharmaInspectionsPage = lazy(() => import('@/pages/pharma/Quality').then(m => ({ default: m.PharmaInspectionsPage })))
const PharmaReleasePage = lazy(() => import('@/pages/pharma/Quality').then(m => ({ default: m.PharmaReleasePage })))
const PharmaGenealogyPage = lazy(() => import('@/pages/pharma/TraceQms').then(m => ({ default: m.PharmaGenealogyPage })))
const PharmaRecallsPage = lazy(() => import('@/pages/pharma/TraceQms').then(m => ({ default: m.PharmaRecallsPage })))
const PharmaComplaintsPage = lazy(() => import('@/pages/pharma/TraceQms').then(m => ({ default: m.PharmaComplaintsPage })))
const PharmaDeviationsPage = lazy(() => import('@/pages/pharma/TraceQms').then(m => ({ default: m.PharmaDeviationsPage })))
const PharmaCapasPage = lazy(() => import('@/pages/pharma/TraceQms').then(m => ({ default: m.PharmaCapasPage })))
const PharmaChangeControlPage = lazy(() => import('@/pages/pharma/TraceQms').then(m => ({ default: m.PharmaChangeControlPage })))
const PharmaAuditPage = lazy(() => import('@/pages/pharma/TraceQms').then(m => ({ default: m.PharmaAuditPage })))
const PharmaSerializationPage = lazy(() => import('@/pages/pharma/TraceQms').then(m => ({ default: m.PharmaSerializationPage })))
const PharmaGdpPage = lazy(() => import('@/pages/pharma/StageC').then(m => ({ default: m.PharmaGdpPage })))
const PharmaTrackTracePage = lazy(() => import('@/pages/pharma/StageC').then(m => ({ default: m.PharmaTrackTracePage })))
const PharmaWholesaleLicensePage = lazy(() => import('@/pages/pharma/WholesaleLicense'))
const PharmaReportingManagerPage = lazy(() => import('@/pages/pharma/ReportingManager'))
const StoresPage = lazy(() => import('@/pages/stores/index'))
const ProfilePage = lazy(() => import('@/pages/profile/index'))
const RelationshipManagerPage = lazy(() => import('@/pages/relationship-manager/index'))
const HRDepartmentsPage = lazy(() => import('@/pages/hr/departments'))
const HRDesignationsPage = lazy(() => import('@/pages/hr/designations'))
const HREmployeesPage = lazy(() => import('@/pages/hr/employees/index'))
const HREmployeeDetailPage = lazy(() => import('@/pages/hr/employees/EmployeeDetail'))
const HRAttendancePage = lazy(() => import('@/pages/hr/attendance/index'))
const MyAttendancePage = lazy(() => import('@/pages/hr/attendance/MyAttendance'))
const AttendanceReportPage = lazy(() => import('@/pages/hr/attendance/AttendanceReport'))
const FieldTrackingPage = lazy(() => import('@/pages/hr/tracking/index'))
const HRLeaveRequestsPage = lazy(() => import('@/pages/hr/leaves/index'))
const LeavePoliciesPage = lazy(() => import('@/pages/hr/leaves/Policies'))
const HolidaysPage = lazy(() => import('@/pages/hr/leaves/Holidays'))
const MyLeavesPage = lazy(() => import('@/pages/hr/leaves/MyLeaves'))
const HRSalaryPage = lazy(() => import('@/pages/hr/salary/index'))
const HRPayrollPage = lazy(() => import('@/pages/hr/payroll/index'))
const HRPayrollDetailPage = lazy(() => import('@/pages/hr/payroll/PayrollDetail'))
const HROffersPage = lazy(() => import('@/pages/hr/offers/index'))
const HROfferTemplatesPage = lazy(() => import('@/pages/hr/offers/Templates'))
const HRRecruitmentPage = lazy(() => import('@/pages/hr/recruitment/index'))
const HRJobDetailPage = lazy(() => import('@/pages/hr/recruitment/JobDetail'))
const HROnboardingPage = lazy(() => import('@/pages/hr/onboarding/index'))
const MyOnboardingPage = lazy(() => import('@/pages/hr/onboarding/MyOnboarding'))
const HRPerformancePage = lazy(() => import('@/pages/hr/performance/index'))
const HRCycleDetailPage = lazy(() => import('@/pages/hr/performance/CycleDetail'))
const HRReviewDetailPage = lazy(() => import('@/pages/hr/performance/ReviewDetail'))
const MyPerformancePage = lazy(() => import('@/pages/hr/performance/MyPerformance'))
const HRCompliancePage = lazy(() => import('@/pages/hr/compliance/index'))
const HRPolicyDetailPage = lazy(() => import('@/pages/hr/compliance/PolicyDetail'))
const MyPoliciesPage = lazy(() => import('@/pages/hr/compliance/MyPolicies'))
const HRTrainingPage = lazy(() => import('@/pages/hr/training/index'))
const HRProgramDetailPage = lazy(() => import('@/pages/hr/training/ProgramDetail'))
const MyTrainingPage = lazy(() => import('@/pages/hr/training/MyTraining'))
const CourseLearningPage = lazy(() => import('@/pages/hr/training/CourseLearning'))
const MyESSPage = lazy(() => import('@/pages/hr/ess/MyESS'))
const HRAnnouncementsPage = lazy(() => import('@/pages/hr/announcements/index'))
const MyAnnouncementsPage = lazy(() => import('@/pages/hr/announcements/MyAnnouncements'))
const HRExpensesPage = lazy(() => import('@/pages/hr/expenses/index'))
const MyExpensesPage = lazy(() => import('@/pages/hr/expenses/MyExpenses'))
const HRHelpdeskPage = lazy(() => import('@/pages/hr/helpdesk/index'))
const MyTicketsPage = lazy(() => import('@/pages/hr/helpdesk/MyTickets'))
const HRTicketDetailPage = lazy(() => import('@/pages/hr/helpdesk/TicketDetail'))
const FinanceDashboard = lazy(() => import('@/pages/finance/index'))
const FinanceBasic = lazy(() => import('@/pages/finance/BasicFinance'))
const FinanceCostCenters = lazy(() => import('@/pages/finance/CostCenters'))
const FinanceCOA = lazy(() => import('@/pages/finance/ChartOfAccounts'))
const FinanceJournal = lazy(() => import('@/pages/finance/JournalEntries'))
const FinanceTrialBalance = lazy(() => import('@/pages/finance/TrialBalance'))
const FinanceAR = lazy(() => import('@/pages/finance/AccountsReceivable'))
const FinanceOpenItems = lazy(() => import('@/pages/finance/OpenItems'))
const FinanceStatementVersions = lazy(() => import('@/pages/finance/FinancialStatementVersions'))
const FinancePostingControls = lazy(() => import('@/pages/finance/PostingControls'))
const FinanceProfitCenters = lazy(() => import('@/pages/finance/ProfitCenters'))
const FinanceFxRevaluation = lazy(() => import('@/pages/finance/FxRevaluation'))
const FinancePostingRules = lazy(() => import('@/pages/finance/PostingRules'))
const FinanceDocumentSplitting = lazy(() => import('@/pages/finance/DocumentSplitting'))
const FinanceParallelLedgers = lazy(() => import('@/pages/finance/ParallelLedgers'))
const FinanceAP = lazy(() => import('@/pages/finance/AccountsPayable'))
const FinanceBank = lazy(() => import('@/pages/finance/BankCash'))
const FinanceBudgets = lazy(() => import('@/pages/finance/BudgetsForecast'))
const FinanceAssets = lazy(() => import('@/pages/finance/FixedAssets'))
const FinanceAssetReports = lazy(() => import('@/pages/finance/AssetReports'))
const FinanceAssetDepreciationSchedule = lazy(() => import('@/pages/finance/AssetDepreciationSchedule'))
const FinanceAssetGlReconciliation = lazy(() => import('@/pages/finance/AssetGlReconciliation'))
const FinanceTax = lazy(() => import('@/pages/finance/TaxReturns'))
const FinancePnL = lazy(() => import('@/pages/finance/reports/ProfitLoss'))
const FinanceBalanceSheet = lazy(() => import('@/pages/finance/reports/BalanceSheet'))
const FinanceCashFlow = lazy(() => import('@/pages/finance/reports/CashFlow'))
const FinanceCostAnalysis = lazy(() => import('@/pages/finance/reports/CostAnalysis'))
const FinanceGLReport = lazy(() => import('@/pages/finance/reports/GLReport'))
const FinanceCapital = lazy(() => import('@/pages/finance/Capital'))
const FinanceApprovals = lazy(() => import('@/pages/finance/Approvals'))
const FinanceAudit = lazy(() => import('@/pages/finance/AuditLog'))
const FinancePeriodControl = lazy(() => import('@/pages/finance/PeriodControl'))
const FinanceFieldRuleConfig = lazy(() => import('@/pages/finance/FieldRuleConfig'))
const FinancePaymentTerms = lazy(() => import('@/pages/finance/PaymentTerms'))
const COLayout = lazy(() => import('@/layouts/COLayout'))
const ControllingDashboardPage = lazy(() => import('@/pages/controlling/index'))
const ControllingProductCostsPage = lazy(() => import('@/pages/controlling/ProductCosts'))
const ControllingManufacturingOrdersPage = lazy(() => import('@/pages/controlling/ManufacturingOrders'))
const ControllingSetupPage = lazy(() => import('@/pages/controlling/Setup'))
const ControllingActivityTypesPage = lazy(() => import('@/pages/controlling/ActivityTypes'))
const ControllingFinanceIntegrationPage = lazy(() => import('@/pages/controlling/FinanceIntegration'))
const ControllingAreasPage = lazy(() => import('@/pages/controlling/ControllingAreas'))
const ControllingManufacturingOrderDetail = lazy(() => import('@/pages/controlling/ManufacturingOrderDetail'))
const ControllingWipReport = lazy(() => import('@/pages/controlling/WipReport'))
const ControllingGoodsMovementsPage = lazy(() => import('@/pages/controlling/GoodsMovements'))
const ControllingActivityConfirmationsPage = lazy(() => import('@/pages/controlling/ActivityConfirmations'))
const ControllingCostAllocationsPage = lazy(() => import('@/pages/controlling/CostAllocations'))
const ControllingPeriodEndPage = lazy(() => import('@/pages/controlling/PeriodEnd'))
const ControllingInternalOrdersPage = lazy(() => import('@/pages/controlling/InternalOrders'))
const ControllingCostBookingsPage = lazy(() => import('@/pages/controlling/CostBookings'))
const ControllingVarianceAnalysisPage = lazy(() => import('@/pages/controlling/VarianceAnalysis'))
const ControllingProductionProcessPage = lazy(() => import('@/pages/controlling/ProductionProcess'))
const ControllingInternalCostPage = lazy(() => import('@/pages/controlling/InternalCostManagement'))
const ControllingRoutingPage = lazy(() => import('@/pages/controlling/Routing'))
const CrmDashboard = lazy(() => import('@/pages/crm/index'))
const CrmContacts = lazy(() => import('@/pages/crm/Contacts'))
const CrmAccounts = lazy(() => import('@/pages/crm/Accounts'))
const CrmLeads = lazy(() => import('@/pages/crm/Leads'))
const CrmNumberRanges = lazy(() => import('@/pages/crm/NumberRanges'))
const CrmPipeline = lazy(() => import('@/pages/crm/Pipeline'))
const CrmActivities = lazy(() => import('@/pages/crm/Activities'))
const CrmInbox = lazy(() => import('@/pages/crm/Inbox'))
const ContactQueries = lazy(() => import('@/pages/queries/ContactQueries'))
const CrmTickets = lazy(() => import('@/pages/crm/Tickets'))
const CrmTicketDetail = lazy(() => import('@/pages/crm/TicketDetail'))
const CrmKnowledgeBase = lazy(() => import('@/pages/crm/KnowledgeBase'))
const CrmSegments = lazy(() => import('@/pages/crm/Segments'))
const CrmTemplates = lazy(() => import('@/pages/crm/Templates'))
const DocumentTemplatesPage = lazy(() => import('@/pages/document-templates/index'))
const SystemModulesPage = lazy(() => import('@/pages/system/Modules'))
const SystemModelsPage = lazy(() => import('@/pages/system/Models'))
const SystemTableDataPage = lazy(() => import('@/pages/system/TableData'))
const SystemBrowseTablePage = lazy(() => import('@/pages/system/BrowseTable'))
const SystemStorefrontDisplayPage = lazy(() => import('@/pages/system/StorefrontDisplay'))
const SystemSocialLinksPage = lazy(() => import('@/pages/system/SocialLinks'))
const CreateMessagesPage = lazy(() => import('@/pages/system/CreateMessages'))
const SystemUpiCheckoutPage = lazy(() => import('@/pages/system/UpiCheckout'))
const AssetsLayout = lazy(() => import('@/pages/system/assets'))
const AssetImagesPage = lazy(() => import('@/pages/system/assets/Images'))
const CrmCampaigns = lazy(() => import('@/pages/crm/Campaigns'))
const CrmWorkflows = lazy(() => import('@/pages/crm/Workflows'))
const CrmAIInsights = lazy(() => import('@/pages/crm/AIInsights'))
const CrmIntegrations = lazy(() => import('@/pages/crm/Integrations'))
const CrmReports = lazy(() => import('@/pages/crm/Reports'))
const CrmAudit = lazy(() => import('@/pages/crm/Audit'))
const CrmCareReminder = lazy(() => import('@/pages/crm/CareReminder'))
const CrmPaymentFollowups = lazy(() => import('@/pages/crm/PaymentFollowups'))
const CrmCreditControl = lazy(() => import('@/pages/crm/CreditControl'))
const CrmSalesAreaDues = lazy(() => import('@/pages/crm/SalesAreaDues'))
const BlogManagerPage = lazy(() => import('@/pages/blog/index'))
const WebsitesPage = lazy(() => import('@/pages/websites/index'))
const WebsiteBuilder = lazy(() => import('@/pages/websites/Builder'))
const SEOManagementPage = lazy(() => import('@/pages/websites/SEOManagement'))
const WebsiteAnalyticsPage = lazy(() => import('@/pages/websites/WebsiteAnalytics'))
const WebsiteSubmissions = lazy(() => import('@/pages/websites/Submissions'))
const WebsiteTemplateGallery = lazy(() => import('@/pages/websites/TemplateGallery'))
const StorefrontBrowserPreviewShell = lazy(() => import('@/pages/websites/StorefrontBrowserPreviewShell'))
const CommissionLayout = lazy(() => import('@/pages/commission/index'))
const CommissionPayees = lazy(() => import('@/pages/commission/Payees'))
const CommissionPlans = lazy(() => import('@/pages/commission/Plans'))
const CommissionAssignments = lazy(() => import('@/pages/commission/Assignments'))
const CommissionAccruals = lazy(() => import('@/pages/commission/Accruals'))
const CommissionPayouts = lazy(() => import('@/pages/commission/Payouts'))
const CommissionReportPage = lazy(() => import('@/pages/commission/reports/CommissionReport'))
const StoreCoveragePage = lazy(() => import('@/pages/sales/StoreCoverage'))
const SalesManagerPage = lazy(() => import('@/pages/sales/SalesManager'))
const SalesAreaSetupPage = lazy(() => import('@/pages/sales/SalesAreaSetup'))
const SalesPlansPage = lazy(() => import('@/pages/sales/Plans'))
const SalesPropertiesPage = lazy(() => import('@/pages/sales/Properties'))
const SalesCoursesPage = lazy(() => import('@/pages/sales/Courses'))
const SalesFitnessClassesPage = lazy(() => import('@/pages/sales/FitnessClasses'))
const SalesVehiclesPage = lazy(() => import('@/pages/sales/Vehicles'))
const SalesEventsPage = lazy(() => import('@/pages/sales/Events'))
const SalesRecurringBookingsPage = lazy(() => import('@/pages/sales/RecurringBookings'))
const SalesTestimonialsPage = lazy(() => import('@/pages/sales/Testimonials'))
const SalesBookingWizardStepsPage = lazy(() => import('@/pages/sales/BookingWizardSteps'))
const SalesBookingResourcesPage = lazy(() => import('@/pages/sales/BookingResources'))
const DeliveryConditionsPage = lazy(() => import('@/pages/sales/DeliveryConditions'))

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
      { path: 'product-groups', element: <ProductGroupsPage /> },
      { path: 'product-groups/:id', element: <ProductGroupDetailPage /> },
      { path: 'master-data', element: <MasterDataReport /> },
      { path: 'master-data/new', element: <MasterDataNew /> },
      { path: 'suppliers', element: <Navigate to="/master-data" replace /> },
      { path: 'procurement/suppliers', element: <SupplierManagementPage /> },
      { path: 'purchase-orders', element: <PurchaseOrdersPage /> },
      { path: 'purchase-orders/new', element: <CreatePurchaseOrderPage /> },
      { path: 'purchase-orders/templates', element: <POTemplatesPage /> },
      { path: 'purchase-orders/:id', element: <PurchaseOrderDetail /> },
      { path: 'purchase-orders/:id/edit', element: <PurchaseOrderEditPage /> },
      { path: 'procurement/requisitions', element: <PurchaseRequisitionsPage /> },
      { path: 'procurement/requisitions/new', element: <CreatePurchaseRequisitionPage /> },
      { path: 'procurement/sourcing', element: <SourcingSetupPage /> },
      { path: 'procurement/vendor-invoices', element: <VendorInvoicesAPPage /> },
      { path: 'procurement/goods', element: <GoodsManagementPage /> },
      { path: 'inventory/material-valuation', element: <MaterialValuationPage /> },
      { path: 'procurement/special', element: <SpecialProcurementPage /> },
      { path: 'procurement/configure', element: <ProcurementFieldConfigPage /> },
      { path: 'procurement/workflow', element: <ApprovalWorkflowPage /> },
      { path: 'procurement/rfq-quotations', element: <RFQQuotationsPage /> },
      { path: 'procurement/grn', element: <GoodsReceiptNotePage /> },
      { path: 'procurement/purchase-returns', element: <PurchaseReturnsPage /> },
      { path: 'procurement/analytics', element: <SpendAnalyticsPage /> },
      { path: 'procurement/reports', element: <ProcurementReportsPage /> },
      { path: 'procurement/budget-controls', element: <BudgetControlsPage /> },
      { path: 'procurement/number-ranges', element: <ProcurementNumberRangesPage /> },
      { path: 'production', element: <ProductionOrdersPage /> },
      { path: 'production/orders/:orderId', element: <ProductionOrderDetailPage /> },
      { path: 'production/schedule', element: <ProductionSchedulePage /> },
      { path: 'production/work-centers', element: <ProductionWorkCentersPage /> },
      { path: 'production/mrp', element: <ProductionMRPPage /> },
      { path: 'production/analytics', element: <ProductionAnalyticsPage /> },
      { path: 'pharma', element: <PharmaOverviewPage /> },
      { path: 'pharma/settings', element: <PharmaSettingsPage /> },
      { path: 'pharma/settings/batch-numbering', element: <PharmaSettingsBatchNumberingPage /> },
      { path: 'pharma/settings/batch-numbering/:sequenceId', element: <PharmaSettingsSequenceDetailPage /> },
      { path: 'pharma/settings/esign', element: <PharmaSettingsEsignPage /> },
      { path: 'pharma/settings/storage', element: <PharmaSettingsStoragePage /> },
      { path: 'pharma/settings/regulatory', element: <PharmaSettingsRegulatoryPage /> },
      { path: 'pharma/settings/products', element: <PharmaSettingsProductsPage /> },
      { path: 'pharma/batches', element: <PharmaBatchesPage /> },
      { path: 'pharma/batches/:batchId', element: <PharmaBatchDetailPage /> },
      { path: 'pharma/movements', element: <PharmaMovementsPage /> },
      { path: 'pharma/fefo', element: <PharmaFefoPage /> },
      { path: 'pharma/quarantine', element: <PharmaQuarantinePage /> },
      { path: 'pharma/mbr', element: <PharmaMbrPage /> },
      { path: 'pharma/bpr', element: <PharmaBprPage /> },
      { path: 'pharma/qc-specs', element: <PharmaQcSpecsPage /> },
      { path: 'pharma/inspections', element: <PharmaInspectionsPage /> },
      { path: 'pharma/release', element: <PharmaReleasePage /> },
      { path: 'pharma/genealogy', element: <PharmaGenealogyPage /> },
      { path: 'pharma/recalls', element: <PharmaRecallsPage /> },
      { path: 'pharma/complaints', element: <PharmaComplaintsPage /> },
      { path: 'pharma/deviations', element: <PharmaDeviationsPage /> },
      { path: 'pharma/capas', element: <PharmaCapasPage /> },
      { path: 'pharma/change-control', element: <PharmaChangeControlPage /> },
      { path: 'pharma/audit', element: <PharmaAuditPage /> },
      { path: 'pharma/serialization', element: <PharmaSerializationPage /> },
      { path: 'pharma/gdp', element: <PharmaGdpPage /> },
      { path: 'pharma/wholesale-license', element: <PharmaWholesaleLicensePage /> },
      { path: 'pharma/track-trace', element: <PharmaTrackTracePage /> },
      { path: 'pharma/reports', element: <PharmaReportingManagerPage /> },
      { path: 'inventory', element: <Inventory /> },
      { path: 'inventory/stock-counts', element: <StockCountPage /> },
      { path: 'inventory/expiry', element: <ExpiryDashboardPage /> },
      { path: 'inventory/reservations', element: <ReservationsPage /> },
      { path: 'inventory/transfer-orders', element: <TransferOrdersPage /> },
      { path: 'inventory/reports', element: <InventoryReportsPage /> },
      { path: 'inventory/analytics', element: <InventoryAnalyticsPage /> },
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
      { path: 'rental', element: <Navigate to="/rental/dashboard" replace /> },
      { path: 'rental/dashboard', element: <RentalDashboardPage /> },
      { path: 'rental/assets', element: <RentalAssetsPage /> },
      { path: 'rental/assets/new', element: <RentalAssetFormPage /> },
      { path: 'rental/assets/:assetId/edit', element: <RentalAssetFormPage /> },
      { path: 'rental/assets/:assetId', element: <RentalAssetFormPage /> },
      { path: 'rental/bookings', element: <RentalBookingsPage /> },
      { path: 'rental/bookings/:bookingId', element: <RentalBookingDetailPage /> },
      { path: 'rental/calendar', element: <RentalCalendarPage /> },
      { path: 'rental/returns', element: <RentalReturnsPage /> },
      { path: 'rental/filled-registrations', element: <RentalFilledRegistrationsPage /> },
      { path: 'rental/reports', element: <RentalReportsPage /> },
      { path: 'rental/registration-forms', element: <RentalRegistrationFormsPage /> },
      { path: 'rental/settings', element: <RentalSettingsPage /> },
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
      { path: 'projects', element: <PermissionRoute permission="projects.view"><ProjectsPage /></PermissionRoute> },
      { path: 'projects/:id', element: <PermissionRoute permission="projects.view"><ProjectDetail /></PermissionRoute> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'queries', element: <ContactQueries /> },
      { path: 'notifications/settings', element: <NotificationSettingsPage /> },
      // HR routes
      { path: 'hr/employees', element: <HREmployeesPage /> },
      { path: 'hr/employees/:id', element: <HREmployeeDetailPage /> },
      { path: 'hr/attendance', element: <HRAttendancePage /> },
      { path: 'hr/attendance/my', element: <MyAttendancePage /> },
      { path: 'hr/attendance/report', element: <AttendanceReportPage /> },
      { path: 'hr/tracking', element: <FieldTrackingPage /> },
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
      { path: 'finance/tax-codes',              element: <FinanceTax defaultTab="codes" /> },
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
      { path: 'finance/payment-terms',          element: <FinancePaymentTerms /> },

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
      { path: 'crm/number-ranges',  element: <CrmNumberRanges /> },
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
      { path: 'crm/payment-followups', element: <CrmPaymentFollowups /> },
      { path: 'crm/credit-control', element: <CrmCreditControl /> },
      { path: 'crm/sales-area-dues', element: <CrmSalesAreaDues /> },
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
