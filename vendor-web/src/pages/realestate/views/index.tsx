import { lazy, type ComponentType } from 'react'
import { EmptyState } from '../shared'

/** Hand-built tabs (`{"view": id}` in the backend module registry). Later phases register here. */
export const VIEWS: Record<string, ComponentType> = {
  print_templates: lazy(() => import('./PrintTemplates')),
  availability: lazy(() => import('./Availability')),
  pipeline: lazy(() => import('./Pipeline')),
  alerts: lazy(() => import('./Alerts')),
  access_control: lazy(() => import('./AccessControl')),
  // Phase 2 — collections, tax & finance
  overdue: lazy(() => import('./Overdue')),
  receivables: lazy(() => import('./Receivables')),
  finance_hub: lazy(() => import('./FinanceHub')),
  gst_summary: lazy(() => import('./GstSummary')),
  rera_account: lazy(() => import('./ReraAccount')),
  tax_reconciliation: lazy(() => import('./TaxReconciliation')),
  // Phase 3 — land & legal
  land_summary: lazy(() => import('./LandSummary')),
  approvals_tracker: lazy(() => import('./ApprovalsTracker')),
  // Phase 4 — project, construction, procurement, inventory, contractors
  gantt: lazy(() => import('./Gantt')),
  budget_vs_actual: lazy(() => import('./ProjectCosting')),
  project_costing: lazy(() => import('./ProjectCosting')),
  stock_balance: lazy(() => import('./StockBalance')),
  payables: lazy(() => import('./Payables')),
  // Phase 5 — post-sales
  care_summary: lazy(() => import('./CareSummary')),
  portal_access: lazy(() => import('./PortalAccess')),
  // Phase 6 — leasing, facility, society, assets
  leasing_overview: lazy(() => import('./ReportViews').then((m) => ({ default: m.LeasingOverview }))),
  renewals: lazy(() => import('./ReportViews').then((m) => ({ default: m.Renewals }))),
  facility_overview: lazy(() => import('./ReportViews').then((m) => ({ default: m.FacilityOverview }))),
  society_overview: lazy(() => import('./ReportViews').then((m) => ({ default: m.SocietyOverview }))),
  assets_overview: lazy(() => import('./ReportViews').then((m) => ({ default: m.AssetsOverview }))),
  workforce_overview: lazy(() => import('./ReportViews').then((m) => ({ default: m.WorkforceOverview }))),
  sales_mis: lazy(() => import('./ReportViews').then((m) => ({ default: m.SalesMis }))),
  collection_report: lazy(() => import('./ReportViews').then((m) => ({ default: m.CollectionReport }))),
  project_costing_report: lazy(() => import('./ReportViews').then((m) => ({ default: m.ProjectCostingReport }))),
  profitability: lazy(() => import('./ReportViews').then((m) => ({ default: m.Profitability }))),
  occupancy: lazy(() => import('./ReportViews').then((m) => ({ default: m.Occupancy }))),
  inventory_ageing: lazy(() => import('./ReportViews').then((m) => ({ default: m.InventoryAgeing }))),
}

export function MissingView({ id }: { id: string }) {
  return (
    <EmptyState
      title="This screen ships in a later phase"
      hint={`“${id}” is part of the phased real-estate roll-out and is not available yet.`}
    />
  )
}
