import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  Bell,
  FileText,
  Globe,
  Landmark,
  LayoutGrid,
  LineChart,
  Package,
  Receipt,
  Search,
  Settings2,
  ShoppingCart,
  Users,
  Warehouse,
} from 'lucide-react'
import type { CampaignMockupVariant, ModuleCampaignFeature } from './moduleCampaignContent'
import type { LandingModule } from './landingData'

export type CampaignDemoSceneId =
  | 'dashboard'
  | 'crm'
  | 'products'
  | 'orders'
  | 'website'
  | 'pos'
  | 'finance'
  | 'inbox'
  | 'workspace'
  | 'form'
  | 'seo'
  | 'storefront'
  | 'hr'
  | 'analytics'
  | 'production'
  | 'settings'

/** One unique screen per campaign feature band — no repeated generic dashboard. */
export const FEATURE_DEMO_SCENE: Record<string, CampaignDemoSceneId> = {
  'unified-dashboard': 'dashboard',
  'inbox-notifications': 'inbox',
  'workspace-shortcuts': 'workspace',
  'website-builder': 'website',
  'seo-blog': 'seo',
  'storefront-display': 'storefront',
  'orders-quotations': 'orders',
  'pos-bookings': 'pos',
  'marketplace-projects': 'crm',
  'manufacturing-orders': 'production',
  'schedule-work-centers': 'production',
  'mrp-planning': 'analytics',
  'floor-service': 'pos',
  'kitchen-board': 'production',
  'reservations-menu': 'storefront',
  'commission-plans': 'form',
  'accruals-payouts': 'finance',
  'commission-reporting': 'analytics',
  'products-catalog': 'products',
  'stock-locations': 'products',
  'inventory-purchasing': 'orders',
  'requisitions-approvals': 'inbox',
  'goods-vendor-invoices': 'form',
  'sourcing-setup': 'products',
  'ledger-ar-ap': 'finance',
  'bank-assets-budgets': 'finance',
  'tax-reports': 'analytics',
  'cost-centers-planning': 'analytics',
  'manufacturing-variance': 'analytics',
  'allocations-period-end': 'finance',
  'customers-suppliers': 'form',
  'data-quality': 'inbox',
  'reviews-reputation': 'storefront',
  'leads-contacts': 'crm',
  'pipeline-deals': 'crm',
  'tickets-campaigns': 'inbox',
  'employee-records': 'hr',
  'attendance-leave': 'hr',
  'recruitment-payroll': 'form',
  'integrations': 'settings',
  'document-templates': 'form',
  'module-settings': 'settings',
}

const MODULE_HERO_SCENE: Partial<Record<string, CampaignDemoSceneId>> = {
  'my-kit': 'dashboard',
  'website-management': 'website',
  sales: 'orders',
  production: 'production',
  restaurant: 'pos',
  commission: 'finance',
  inventory: 'products',
  procurement: 'orders',
  finance: 'finance',
  controlling: 'analytics',
  'master-data': 'form',
  crm: 'crm',
  hr: 'hr',
  system: 'settings',
}

const MOCKUP_SCENE: Record<CampaignMockupVariant, CampaignDemoSceneId> = {
  dashboard: 'dashboard',
  form: 'form',
  split: 'inbox',
  pipeline: 'crm',
  mobile: 'storefront',
}

const SCENE_ICON: Record<CampaignDemoSceneId, LucideIcon> = {
  dashboard: BarChart3,
  crm: Users,
  products: Package,
  orders: ShoppingCart,
  website: Globe,
  pos: Receipt,
  finance: Landmark,
  inbox: Bell,
  workspace: LayoutGrid,
  form: FileText,
  seo: Search,
  storefront: ShoppingCart,
  hr: Users,
  analytics: LineChart,
  production: Warehouse,
  settings: Settings2,
}

const SCENE_FALLBACK: Record<
  CampaignDemoSceneId,
  {
    navLabel: string
    title: string
    subtitle: string
    chips: string[]
    statLabel: string
    statValue: string
    popupTitle: string
    popupPoints: string[]
  }
> = {
  dashboard: {
    navLabel: 'Dashboard',
    title: 'Your business at a glance',
    subtitle: 'Orders, revenue, and activity in one view.',
    chips: ['Today', 'This week', 'Live'],
    statLabel: 'Open tasks',
    statValue: '12',
    popupTitle: 'Real-time dashboard',
    popupPoints: ['Live KPIs update as work happens', 'Trend charts for quick decisions', 'Drill into any metric'],
  },
  crm: {
    navLabel: 'Pipeline',
    title: 'Track every deal stage',
    subtitle: 'Drag, qualify, and close from one board.',
    chips: ['New', 'Qualified', 'Won'],
    statLabel: 'Win rate',
    statValue: '32%',
    popupTitle: 'Sales pipeline',
    popupPoints: ['Stage-based deal cards', 'Owner and value on every card', 'Forecast from open pipeline'],
  },
  products: {
    navLabel: 'Catalog',
    title: 'Manage products & stock',
    subtitle: 'SKUs, variants, and availability together.',
    chips: ['In stock', 'Low stock', 'Draft'],
    statLabel: 'Active SKUs',
    statValue: '342',
    popupTitle: 'Catalog management',
    popupPoints: ['Variants and pricing in one place', 'Stock levels across locations', 'Bulk edits and alerts'],
  },
  orders: {
    navLabel: 'Orders',
    title: 'Fulfill orders faster',
    subtitle: 'Status, invoices, and updates in one list.',
    chips: ['New', 'Packed', 'Delivered'],
    statLabel: 'Open orders',
    statValue: '47',
    popupTitle: 'Order management',
    popupPoints: ['Timeline from order to delivery', 'Auto-generate invoices', 'Customer notifications'],
  },
  website: {
    navLabel: 'Builder',
    title: 'Compose pages from blocks',
    subtitle: 'Drag hero sections, grids, and forms into place.',
    chips: ['Hero', 'Grid', 'Footer'],
    statLabel: 'Live pages',
    statValue: '12',
    popupTitle: 'Website builder',
    popupPoints: ['Visual editor with live preview', 'Reusable sections across pages', 'Publish without code'],
  },
  pos: {
    navLabel: 'POS',
    title: 'Sell at the counter',
    subtitle: 'Touch checkout tied to shared stock.',
    chips: ['Register', 'Receipts', 'Payments'],
    statLabel: 'POS sales',
    statValue: '₹84K',
    popupTitle: 'Point of sale',
    popupPoints: ['Fast counter checkout', 'Shared stock with online', 'Cash, card & UPI'],
  },
  finance: {
    navLabel: 'Finance',
    title: 'Books that stay in sync',
    subtitle: 'Ledger, AR/AP, and reports from every sale.',
    chips: ['P&L', 'Balance sheet', 'Tax'],
    statLabel: 'Net margin',
    statValue: '18.4%',
    popupTitle: 'Accounting & finance',
    popupPoints: ['Every sale posts to ledger', 'P&L and balance sheet', 'Track receivables & payables'],
  },
  inbox: {
    navLabel: 'Inbox',
    title: 'Messages & approvals',
    subtitle: 'Unified inbox with read states and actions.',
    chips: ['Unread', 'Pending', 'Done'],
    statLabel: 'Unread',
    statValue: '8',
    popupTitle: 'Unified inbox',
    popupPoints: ['All channels in one feed', 'Approve or reply in context', 'Jump to the related record'],
  },
  workspace: {
    navLabel: 'Workspace',
    title: 'Launch any app',
    subtitle: 'Personalized launcher for every role.',
    chips: ['Pinned', 'Recent', 'All apps'],
    statLabel: 'Apps',
    statValue: '14',
    popupTitle: 'Workspace launcher',
    popupPoints: ['Role-based app grid', 'Mobile-friendly layout', 'One tap into any module'],
  },
  form: {
    navLabel: 'Record',
    title: 'Structured data entry',
    subtitle: 'Header, lines, totals — validated as you go.',
    chips: ['Draft', 'Submitted', 'Approved'],
    statLabel: 'Doc no.',
    statValue: '0042',
    popupTitle: 'Smart forms',
    popupPoints: ['Tabbed lines and details', 'Auto totals and validation', 'Audit trail on every change'],
  },
  seo: {
    navLabel: 'SEO & Blog',
    title: 'Optimize every URL',
    subtitle: 'Meta fields, previews, and scheduled posts.',
    chips: ['Meta', 'Blog', 'Schedule'],
    statLabel: 'Indexed pages',
    statValue: '24',
    popupTitle: 'SEO & content',
    popupPoints: ['Per-page SEO fields and previews', 'Blog categories and scheduling', 'Search-friendly URLs'],
  },
  storefront: {
    navLabel: 'Storefront',
    title: 'Your brand on display',
    subtitle: 'Homepage layouts, banners, and featured products.',
    chips: ['Home', 'Categories', 'Promo'],
    statLabel: 'Featured',
    statValue: '6',
    popupTitle: 'Storefront display',
    popupPoints: ['Customize homepage layouts', 'Highlight promotions', 'Consistent branding on mobile'],
  },
  hr: {
    navLabel: 'HR',
    title: 'People operations hub',
    subtitle: 'Employees, attendance, leave, and payroll.',
    chips: ['Active', 'On leave', 'Open roles'],
    statLabel: 'Headcount',
    statValue: '48',
    popupTitle: 'HR management',
    popupPoints: ['Employee profiles & documents', 'Attendance and leave balances', 'Payroll-ready records'],
  },
  analytics: {
    navLabel: 'Analytics',
    title: 'Variance & performance',
    subtitle: 'Cost centers, margins, and period comparisons.',
    chips: ['Plan', 'Actual', 'Variance'],
    statLabel: 'Variance',
    statValue: '−4.2%',
    popupTitle: 'Controlling reports',
    popupPoints: ['Plan vs actual by cost center', 'Manufacturing variance drill-down', 'Period-end allocations'],
  },
  production: {
    navLabel: 'Production',
    title: 'Shop floor control',
    subtitle: 'Work orders, schedules, and work centers.',
    chips: ['Planned', 'In progress', 'Done'],
    statLabel: 'Open MOs',
    statValue: '17',
    popupTitle: 'Manufacturing',
    popupPoints: ['Manufacturing orders on one board', 'Work center capacity view', 'Material requirements planning'],
  },
  settings: {
    navLabel: 'Settings',
    title: 'Configure your platform',
    subtitle: 'Integrations, templates, and module access.',
    chips: ['Integrations', 'Templates', 'Access'],
    statLabel: 'Modules',
    statValue: '14',
    popupTitle: 'System configuration',
    popupPoints: ['Connect external services', 'Document template library', 'Role-based module settings'],
  },
}

export function resolveCampaignDemoScene(
  moduleId: string,
  mockup: CampaignMockupVariant,
  options?: {
    hero?: boolean
    feature?: Pick<ModuleCampaignFeature, 'id' | 'eyebrow' | 'mockup'>
  },
): CampaignDemoSceneId {
  if (options?.hero) {
    return MODULE_HERO_SCENE[moduleId] ?? MOCKUP_SCENE[mockup]
  }

  const featureId = options?.feature?.id
  if (featureId && FEATURE_DEMO_SCENE[featureId]) {
    return FEATURE_DEMO_SCENE[featureId]
  }

  if (mockup === 'dashboard') {
    return MODULE_HERO_SCENE[moduleId] ?? 'dashboard'
  }

  return MOCKUP_SCENE[mockup]
}

export function getCampaignSceneIcon(sceneId: CampaignDemoSceneId): LucideIcon {
  return SCENE_ICON[sceneId]
}

export type CampaignSceneDisplay = {
  navLabel: string
  title: string
  subtitle: string
  chips: string[]
  statLabel: string
  statValue: string
  popupTitle: string
  popupPoints: string[]
  icon: LucideIcon
}

export function getCampaignSceneDisplay(
  sceneId: CampaignDemoSceneId,
  module: LandingModule,
  feature?: Pick<ModuleCampaignFeature, 'eyebrow' | 'title' | 'accentPhrase' | 'body' | 'bullets'>,
): CampaignSceneDisplay {
  const icon = getCampaignSceneIcon(sceneId)
  const fallback = SCENE_FALLBACK[sceneId]

  if (feature) {
    const title = [feature.title, feature.accentPhrase].filter(Boolean).join(' ')
    return {
      navLabel: feature.eyebrow ?? fallback.navLabel,
      title,
      subtitle: feature.body,
      chips: feature.bullets.slice(0, 3),
      statLabel: fallback.statLabel,
      statValue: fallback.statValue,
      popupTitle: feature.eyebrow ?? title,
      popupPoints: feature.bullets.slice(0, 4),
      icon,
    }
  }

  return { ...fallback, icon }
}

export type CampaignDemoLayoutKind =
  | 'sidebar'
  | 'topnav'
  | 'split'
  | 'canvas'
  | 'pos'
  | 'mobile-shell'
  | 'kanban'
  | 'form-doc'

type SceneNavConfig = {
  layout: CampaignDemoLayoutKind
  path: string
  sidebar?: string[]
  topnav?: string[]
  active: string
  pageTitle?: string
}

const SCENE_NAV: Record<CampaignDemoSceneId, SceneNavConfig> = {
  dashboard: {
    layout: 'sidebar',
    path: 'my-kit/dashboard',
    sidebar: ['Dashboard', 'Inbox', 'Tasks', 'Reports'],
    active: 'Dashboard',
    pageTitle: 'Overview',
  },
  crm: {
    layout: 'kanban',
    path: 'crm/pipeline',
    topnav: ['Leads', 'Pipeline', 'Activities', 'Reports'],
    active: 'Pipeline',
  },
  products: {
    layout: 'sidebar',
    path: 'inventory/products',
    sidebar: ['Products', 'Categories', 'Stock', 'Transfers'],
    active: 'Products',
  },
  orders: {
    layout: 'topnav',
    path: 'sales/orders',
    topnav: ['Quotations', 'Orders', 'Invoices', 'Returns'],
    active: 'Orders',
    pageTitle: 'Sales orders',
  },
  website: {
    layout: 'canvas',
    path: 'website/builder/home',
    topnav: ['Pages', 'Blocks', 'Theme', 'Publish'],
    active: 'Blocks',
  },
  pos: {
    layout: 'pos',
    path: 'pos/register',
    topnav: ['Register', 'Orders', 'Sessions'],
    active: 'Register',
  },
  finance: {
    layout: 'sidebar',
    path: 'finance/ledger',
    sidebar: ['Ledger', 'Receivables', 'Payables', 'Reports'],
    active: 'Ledger',
    pageTitle: 'General ledger',
  },
  inbox: {
    layout: 'split',
    path: 'my-kit/inbox',
    sidebar: ['Inbox', 'Sent', 'Approvals'],
    active: 'Inbox',
  },
  workspace: {
    layout: 'mobile-shell',
    path: 'my-kit/apps',
    topnav: ['Pinned', 'Recent', 'All'],
    active: 'Pinned',
  },
  form: {
    layout: 'form-doc',
    path: 'records/new',
    topnav: ['Edit', 'Lines', 'Attachments', 'Audit'],
    active: 'Lines',
    pageTitle: 'New record',
  },
  seo: {
    layout: 'topnav',
    path: 'website/seo/blog',
    topnav: ['SEO', 'Blog', 'Redirects', 'Sitemap'],
    active: 'SEO',
    pageTitle: 'Page optimization',
  },
  storefront: {
    layout: 'canvas',
    path: 'website/storefront',
    topnav: ['Layout', 'Banners', 'Featured', 'Preview'],
    active: 'Layout',
  },
  hr: {
    layout: 'sidebar',
    path: 'hr/employees',
    sidebar: ['Employees', 'Attendance', 'Leave', 'Payroll'],
    active: 'Employees',
    pageTitle: 'Employee directory',
  },
  analytics: {
    layout: 'topnav',
    path: 'controlling/reports',
    topnav: ['Plan', 'Actual', 'Variance', 'Export'],
    active: 'Variance',
    pageTitle: 'Cost variance',
  },
  production: {
    layout: 'kanban',
    path: 'production/orders',
    topnav: ['Orders', 'Schedule', 'Work centers', 'MRP'],
    active: 'Orders',
  },
  settings: {
    layout: 'sidebar',
    path: 'system/settings',
    sidebar: ['Integrations', 'Templates', 'Modules', 'Access'],
    active: 'Integrations',
    pageTitle: 'System settings',
  },
}

export function getSceneNavConfig(
  sceneId: CampaignDemoSceneId,
  _module: LandingModule,
  displayNavLabel: string,
): SceneNavConfig {
  const base = SCENE_NAV[sceneId]
  const activeLabel = displayNavLabel.trim() || base.active

  const mapActive = (items: string[]) => {
    const idx = items.indexOf(base.active)
    if (idx < 0) return items
    return items.map((item, i) => (i === idx ? activeLabel : item))
  }

  return {
    ...base,
    active: activeLabel,
    sidebar: base.sidebar ? mapActive(base.sidebar) : undefined,
    topnav: base.topnav ? mapActive(base.topnav) : undefined,
  }
}
