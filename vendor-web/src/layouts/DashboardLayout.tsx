import { useState, useEffect, useRef, type ReactNode } from 'react'
import { Outlet, NavLink, useLocation, Link } from 'react-router-dom'
import {
  LayoutDashboard, ShoppingCart, Package, Wrench, Warehouse,
  Users, Settings, LogOut, Store, MessageSquare,
  UsersRound, ShieldCheck, Receipt, FileText, Tag, BarChart3, Palette, CreditCard, LayoutTemplate,
  FolderTree, Truck, ClipboardList, Calendar, Bell,
  ChevronDown, ChevronRight, Check, Menu, FilePlus, Factory, PieChart,
  UserCog, Clock, Plane, DollarSign, Award, Building2, FileSignature,
  HelpCircle, Phone, MessageCircle, User, Info,
  Briefcase, Target, ShieldAlert, GraduationCap, Megaphone, Receipt as ReceiptIcon, LifeBuoy, UserCheck,
  Contact2, GitBranch, Workflow, Mail, BookOpen, Bot, Plug, History, Activity,
  Landmark, BookMarked, ArrowLeftRight, Scale, Banknote, TrendingUp, Calculator,
  ScrollText, HardDrive, Coins, LineChart, CircleDollarSign, FilePieChart,
  Shuffle, ClipboardCheck, Wand2, Heart, Layers, Percent, Link2, Wallet2, Sparkles,
  Lock, ListChecks, Boxes, Gauge, Globe, Newspaper, Moon, Sun,
  UtensilsCrossed, ChefHat, LayoutGrid, RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const SUPPORT_PHONE = (import.meta.env.VITE_SUPPORT_PHONE as string | undefined)?.trim()
const SUPPORT_CHAT_URL = (import.meta.env.VITE_SUPPORT_CHAT_URL as string | undefined)?.trim()
  || 'mailto:support@kiterp.com?subject=Vendor%20Dashboard%20Help'

function ProfileMenuLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-4 pt-1 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
      {children}
    </p>
  )
}
import { useLogout } from '@/hooks/useAuth'
import { useAuthStore } from '@/stores/authStore'
import { useThemeStore } from '@/stores/themeStore'
import { useVendorStore } from '@/stores/vendorStore'
import { useMyVendor, useStores } from '@/hooks/useVendor'
import { Button } from '@/components/ui/button'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import { playTone, type ToneName } from '@/hooks/useNotificationSound'
import { useBrowserNotifications } from '@/hooks/useBrowserNotifications'

interface NavItem {
  to: string
  icon: React.ElementType
  label: string
  labelSize?: string
  alwaysShow?: boolean
  requiresOffering?: string[]
  requiresPermission?: string
  /** When set, renders a coloured group-label divider above this item */
  groupLabel?: string
  groupColor?: 'blue' | 'amber' | 'emerald' | 'indigo' | 'rose' | 'violet'
  /** Restrict to a specific finance mode: 'basic' shows only when finance_mode=basic; 'advanced' shows only when finance_mode=advanced (or unset) */
  requiresFinanceMode?: 'basic' | 'advanced'
}

interface NavSection {
  title: string
  items: NavItem[]
}

const allSections: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { to: '/', icon: BarChart3, label: 'Dashboard', alwaysShow: true },
      { to: '/notifications', icon: Bell, label: 'Notifications', alwaysShow: true },
      { to: '/crm/inbox', icon: MessageSquare, label: 'Inbox', alwaysShow: true },
      { to: '/workspace', icon: LayoutGrid, label: 'Workspace apps', alwaysShow: true },
    ],
  },
  {
    title: 'Sales Management',
    items: [
      { to: '/orders', icon: ShoppingCart, label: 'Orders', requiresPermission: 'orders.view' },
      { to: '/bookings', icon: Calendar, label: 'Bookings', requiresOffering: ['services', 'both'] },
      { to: '/pos', icon: Receipt, label: 'POS', requiresOffering: ['products', 'both'] },
      { to: '/restaurant/floor', icon: UtensilsCrossed, label: 'Restaurant floor', requiresOffering: ['products', 'both'] },
      { to: '/restaurant/kitchen', icon: ChefHat, label: 'Kitchen board', requiresOffering: ['products', 'both'] },
      { to: '/restaurant/setup', icon: Settings, label: 'Restaurant tables', requiresOffering: ['products', 'both'] },
      { to: '/subscriptions', icon: RefreshCw, label: 'Subscriptions', alwaysShow: true },
      { to: '/rental', icon: Truck, label: 'Rentals', alwaysShow: true },
      { to: '/production', icon: Factory, label: 'Production Orders', requiresOffering: ['products', 'both'] },
      { to: '/invoices', icon: FileText, label: 'Invoices' },
      { to: '/memos', icon: FilePlus, label: 'Credit / Debit Memos' },
      { to: '/coupons', icon: Tag, label: 'Coupons' },
    ],
  },
  {
    title: 'Commission',
    items: [
      { to: '/commission', icon: Percent, label: 'Overview', requiresPermission: 'commission.read' },
      { to: '/commission/payees', icon: UserCheck, label: 'Payees', requiresPermission: 'commission.manage' },
      { to: '/commission/plans', icon: BookOpen, label: 'Plans', requiresPermission: 'commission.manage' },
      { to: '/commission/assignments', icon: Link2, label: 'Assignments', requiresPermission: 'commission.manage' },
      { to: '/commission/accruals', icon: ClipboardList, label: 'Accruals', requiresPermission: 'commission.read' },
      { to: '/commission/payouts', icon: Wallet2, label: 'Payouts', requiresPermission: 'commission.manage' },
      { to: '/commission/reports', icon: PieChart, label: 'Reports', requiresPermission: 'commission.read' },
    ],
  },
  {
    title: 'Inventory Management',
    items: [
      { to: '/products', icon: Package, label: 'Products', requiresOffering: ['products', 'both'], requiresPermission: 'products.view' },
      { to: '/services', icon: Wrench, label: 'Services', requiresOffering: ['services', 'both'], requiresPermission: 'services.view' },
      { to: '/categories', icon: FolderTree, label: 'Categories' },
      { to: '/inventory', icon: Warehouse, label: 'Inventory', requiresOffering: ['products', 'both'] },
      { to: '/purchase-orders', icon: ClipboardList, label: 'Purchase Orders', requiresOffering: ['products', 'both'] },
    ],
  },
  {
    title: 'Finance Management',
    items: [
      // ── Basic Finance mode ─────────────────────────────────────────────────
      { to: '/finance/basic', icon: Landmark, label: 'Finance', requiresPermission: 'finance.view', requiresFinanceMode: 'basic' },
      // ── Advanced Finance mode ──────────────────────────────────────────────
      { to: '/finance', icon: Landmark, label: 'Finance Dashboard', requiresPermission: 'finance.view', requiresFinanceMode: 'advanced' },
      { to: '/stores', icon: Building2, label: 'Company Codes', requiresPermission: 'finance.view', requiresFinanceMode: 'advanced' },
      { to: '/finance/cost-centers', icon: Layers, label: 'Cost Centers', requiresPermission: 'finance.view', requiresFinanceMode: 'advanced' },
      { to: '/finance/coa', icon: BookMarked, label: 'Chart of Accounts', requiresPermission: 'finance.view', requiresFinanceMode: 'advanced' },
      { to: '/finance/journal', icon: ScrollText, label: 'Journal Entries', requiresPermission: 'finance.view', requiresFinanceMode: 'advanced' },
      { to: '/finance/trial-balance', icon: Scale, label: 'Trial Balance', requiresPermission: 'finance.reports.view', requiresFinanceMode: 'advanced' },
      { to: '/finance/ar', icon: ArrowLeftRight, label: 'Accounts Receivable', requiresPermission: 'finance.ar.manage', requiresFinanceMode: 'advanced' },
      { to: '/finance/ap', icon: Banknote, label: 'Accounts Payable', requiresPermission: 'finance.ap.manage', requiresFinanceMode: 'advanced' },
      { to: '/finance/bank', icon: Coins, label: 'Bank & Cash', requiresPermission: 'finance.bank.manage', requiresFinanceMode: 'advanced' },
      { to: '/finance/budgets', icon: Calculator, label: 'Budgets & Forecasts', requiresPermission: 'finance.budget.manage', requiresFinanceMode: 'advanced' },
      { to: '/finance/assets', icon: HardDrive, label: 'Fixed Assets', requiresPermission: 'finance.assets.manage', requiresFinanceMode: 'advanced' },
      { to: '/finance/tax', icon: CircleDollarSign, label: 'Tax Returns', requiresPermission: 'finance.tax.manage', requiresFinanceMode: 'advanced' },
      { to: '/finance/reports/pnl', icon: LineChart, label: 'P&L Statement', requiresPermission: 'finance.reports.view', requiresFinanceMode: 'advanced' },
      { to: '/finance/reports/balance-sheet', icon: FilePieChart, label: 'Balance Sheet', requiresPermission: 'finance.reports.view', requiresFinanceMode: 'advanced' },
      { to: '/finance/reports/cash-flow', icon: TrendingUp, label: 'Cash Flow', requiresPermission: 'finance.reports.view', requiresFinanceMode: 'advanced' },
      { to: '/finance/reports/cost-analysis', icon: BarChart3, label: 'Cost Analysis', requiresPermission: 'finance.reports.view', requiresFinanceMode: 'advanced' },
      { to: '/finance/reports/gl', icon: BookOpen, label: 'GL Line Item Report', requiresPermission: 'finance.reports.view', requiresFinanceMode: 'advanced' },
      { to: '/finance/capital', icon: Shuffle, label: 'Loans & Investments', requiresPermission: 'finance.capital.manage', requiresFinanceMode: 'advanced' },
      { to: '/finance/approvals', icon: ClipboardCheck, label: 'Approvals', requiresPermission: 'finance.controls.approve', requiresFinanceMode: 'advanced' },
      { to: '/finance/periods', icon: Lock, label: 'Posting periods', requiresPermission: 'finance.coa.manage', requiresFinanceMode: 'advanced' },
      { to: '/finance/field-rules', icon: ListChecks, label: 'GL field rules', requiresPermission: 'finance.coa.manage', requiresFinanceMode: 'advanced' },
      { to: '/finance/audit', icon: ShieldCheck, label: 'Audit Log', requiresPermission: 'finance.audit.view', requiresFinanceMode: 'advanced' },
      { to: '/reports', icon: LayoutDashboard, label: 'Reports' },
    ],
  },
  {
    title: 'Controlling (CO)',
    items: [
      { to: '/controlling', icon: Gauge, label: 'CO Dashboard', requiresPermission: 'finance.view' },
      // ── Cost Planning
      { to: '/controlling/product-costs',            icon: Boxes,         label: 'Product Cost Planning',      requiresPermission: 'finance.view', groupLabel: 'Cost Planning', groupColor: 'blue' },
      { to: '/controlling/routing',                  icon: GitBranch,     label: 'Work Centres & Routing',     requiresPermission: 'finance.view' },
      { to: '/controlling/setup',                    icon: Layers,        label: 'Activity Types & Overhead',  requiresPermission: 'finance.view' },
      // ── Production Orders
      { to: '/controlling/orders',                   icon: Factory,       label: 'All Orders',                 requiresPermission: 'finance.view', groupLabel: 'Production Orders',     groupColor: 'amber' },
      { to: '/controlling/orders?kind=assembly',     icon: Workflow,      label: 'Assembly Orders',            requiresPermission: 'finance.view' },
      { to: '/controlling/orders?kind=process',      icon: ArrowLeftRight,label: 'Process Orders',             requiresPermission: 'finance.view' },
      { to: '/controlling/internal-orders',          icon: Boxes,         label: 'Internal & Project Orders',  requiresPermission: 'finance.view', labelSize: 'text-[11px]' },
      // ── Production Execution
      { to: '/controlling/production-process',       icon: TrendingUp,    label: 'Production Process',         requiresPermission: 'finance.view', groupLabel: 'Production Execution',  groupColor: 'emerald' },
      { to: '/controlling/goods-movements',          icon: Package,       label: 'Goods Movements',            requiresPermission: 'finance.view' },
      { to: '/controlling/activity-confirmations',   icon: Clock,         label: 'Activity Confirmations',     requiresPermission: 'finance.view', labelSize: 'text-[11px]' },
      { to: '/controlling/cost-bookings',            icon: Receipt,       label: 'Cost Bookings',              requiresPermission: 'finance.view' },
      // ── Analysis & Reporting
      { to: '/controlling/wip',                      icon: ClipboardList, label: 'WIP Report',                 requiresPermission: 'finance.view', groupLabel: 'Analysis & Reporting', groupColor: 'indigo' },
      { to: '/controlling/variance-analysis',        icon: BarChart3,     label: 'Variance Analysis',          requiresPermission: 'finance.view' },
      { to: '/controlling/internal-cost',            icon: BookOpen,      label: 'Internal Cost Mgmt',         requiresPermission: 'finance.view' },
      // ── Period End
      { to: '/controlling/cost-allocations',         icon: GitBranch,     label: 'Cost Allocations',           requiresPermission: 'finance.view', groupLabel: 'Period End',            groupColor: 'rose' },
      { to: '/controlling/period-end',               icon: Calendar,      label: 'Period-End Closing',         requiresPermission: 'finance.view' },
    ],
  },
  {
    title: 'Master Data Management',
    items: [
      { to: '/master-data', icon: PieChart, label: 'Master Data — Customers & Suppliers', labelSize: 'text-[11px]', alwaysShow: true },
      { to: '/reviews', icon: MessageSquare, label: 'Reviews', requiresPermission: 'reviews.view' },
    ],
  },
  {
    title: 'CRM',
    items: [
      { to: '/crm', icon: LayoutDashboard, label: 'CRM Dashboard', requiresPermission: 'crm.view' },
      { to: '/crm/contacts', icon: Contact2, label: 'Contacts', requiresPermission: 'crm.view' },
      { to: '/crm/accounts', icon: Building2, label: 'Accounts', requiresPermission: 'crm.view' },
      { to: '/crm/leads', icon: Target, label: 'Leads', requiresPermission: 'crm.view' },
      { to: '/crm/pipeline', icon: GitBranch, label: 'Pipeline', requiresPermission: 'crm.view' },
      { to: '/crm/activities', icon: Activity, label: 'Activities & Tasks', requiresPermission: 'crm.view' },
      { to: '/crm/tickets', icon: LifeBuoy, label: 'Tickets', requiresPermission: 'crm.view' },
      { to: '/crm/kb', icon: BookOpen, label: 'Knowledge Base', requiresPermission: 'crm.view' },
      { to: '/crm/segments', icon: UsersRound, label: 'Segments', requiresPermission: 'crm.view' },
      { to: '/crm/templates', icon: Mail, label: 'Email Templates', requiresPermission: 'crm.view' },
      { to: '/crm/campaigns', icon: Megaphone, label: 'Campaigns', requiresPermission: 'crm.view' },
      { to: '/crm/care-reminder', icon: Heart, label: 'Care & Reminders', requiresPermission: 'crm.view' },
      { to: '/crm/workflows', icon: Workflow, label: 'Workflows', requiresPermission: 'crm.workflows.manage' },
      { to: '/crm/ai', icon: Bot, label: 'AI Insights', requiresPermission: 'crm.ai.use' },
      { to: '/crm/integrations', icon: Plug, label: 'Integrations', requiresPermission: 'crm.integrations.manage' },
      { to: '/crm/reports', icon: BarChart3, label: 'CRM Reports', requiresPermission: 'crm.reports.view' },
      { to: '/crm/audit', icon: History, label: 'Audit Log', requiresPermission: 'crm.audit.view' },
    ],
  },
  {
    title: 'Human Resources Management',
    items: [
      { to: '/hr/me', icon: UserCheck, label: 'My ESS Hub', alwaysShow: true },
      { to: '/hr/employees', icon: UserCog, label: 'Employees', requiresPermission: 'hr.view' },
      { to: '/hr/attendance', icon: Clock, label: 'Attendance', requiresPermission: 'hr.view' },
      { to: '/hr/attendance/my', icon: Clock, label: 'My Attendance', alwaysShow: true },
      { to: '/hr/leaves', icon: Plane, label: 'Leave Requests', requiresPermission: 'hr.view' },
      { to: '/hr/leaves/my', icon: Plane, label: 'My Leaves', alwaysShow: true },
      { to: '/hr/recruitment', icon: Briefcase, label: 'Recruitment', requiresPermission: 'hr.manage' },
      { to: '/hr/onboarding', icon: UserCheck, label: 'Onboarding', requiresPermission: 'hr.manage' },
      { to: '/hr/my-onboarding', icon: UserCheck, label: 'My Onboarding', alwaysShow: true },
      { to: '/hr/performance', icon: Target, label: 'Performance', requiresPermission: 'hr.manage' },
      { to: '/hr/my-performance', icon: Target, label: 'My Performance', alwaysShow: true },
      { to: '/hr/training', icon: GraduationCap, label: 'Training', requiresPermission: 'hr.manage' },
      { to: '/hr/my-training', icon: GraduationCap, label: 'My Training', alwaysShow: true },
      { to: '/hr/compliance', icon: ShieldAlert, label: 'Compliance', requiresPermission: 'hr.manage' },
      { to: '/hr/my-policies', icon: ShieldAlert, label: 'My Policies', alwaysShow: true },
      { to: '/hr/announcements', icon: Megaphone, label: 'Announcements', requiresPermission: 'hr.manage' },
      { to: '/hr/my-announcements', icon: Megaphone, label: 'My Announcements', alwaysShow: true },
      { to: '/hr/expenses', icon: ReceiptIcon, label: 'Expense Claims', requiresPermission: 'hr.manage' },
      { to: '/hr/my-expenses', icon: ReceiptIcon, label: 'My Expenses', alwaysShow: true },
      { to: '/hr/helpdesk', icon: LifeBuoy, label: 'Helpdesk', requiresPermission: 'hr.manage' },
      { to: '/hr/my-helpdesk', icon: LifeBuoy, label: 'My Tickets', alwaysShow: true },
      { to: '/hr/payroll', icon: DollarSign, label: 'Payroll', requiresPermission: 'hr.salary_view' },
      { to: '/hr/offers', icon: FileSignature, label: 'Offer Letters', requiresPermission: 'hr.offers' },
      { to: '/hr/departments', icon: Building2, label: 'Departments', requiresPermission: 'hr.manage' },
      { to: '/hr/designations', icon: Award, label: 'Designations', requiresPermission: 'hr.manage' },
    ],
  },
  {
    title: 'Configuration',
    items: [
      { to: '/websites', icon: Globe, label: 'Website Builder', alwaysShow: true },
      { to: '/websites/templates', icon: Sparkles, label: 'Website templates', alwaysShow: true },
      { to: '/storefront-builder', icon: Wand2, label: 'Storefront Builder', alwaysShow: true },
      { to: '/blog', icon: Newspaper, label: 'Blog Manager', alwaysShow: true },
      { to: '/document-templates', icon: LayoutTemplate, label: 'Document Templates', alwaysShow: true },
      { to: '/team', icon: UsersRound, label: 'Team', requiresPermission: 'team.view' },
      { to: '/roles', icon: ShieldCheck, label: 'Roles', requiresPermission: 'roles.view' },
      { to: '/plans', icon: CreditCard, label: 'Plans & Billing', alwaysShow: true },
      { to: '/settings', icon: Settings, label: 'Settings', requiresPermission: 'settings.view' },
    ],
  },
]

const pageTitles: Record<string, string> = {
  '/': 'Dashboard — Analytics',
  '/orders': 'Orders',
  '/products': 'Products',
  '/products/new': 'New Product',
  '/services': 'Services',
  '/services/new': 'New Service',
  '/categories': 'Categories',
  '/purchase-orders': 'Purchase Orders',
  '/production': 'Production Orders',
  '/inventory': 'Inventory',
  '/pos': 'Point of Sale',
  '/restaurant/floor': 'Restaurant floor',
  '/restaurant/kitchen': 'Kitchen board',
  '/restaurant/setup': 'Restaurant setup',
  '/workspace': 'Workspace apps',
  '/subscriptions': 'Subscriptions catalog',
  '/rental': 'Rentals',
  '/invoices': 'Invoices',
  '/memos': 'Credit & Debit Memos',
  '/coupons': 'Coupons',
  '/bookings': 'Bookings',
  '/notifications': 'Notifications',
  '/master-data': 'Master Data — Customers / Suppliers',
  '/reviews': 'Reviews',
  '/reports': 'Reports',
  '/template': 'Template',
  '/document-templates': 'Document Templates',
  '/websites': 'Website Builder',
  '/websites/templates': 'Website templates',
  '/storefront-builder': 'Storefront Builder',
  '/blog': 'Blog Manager',
  '/finance/basic': 'Finance',
  '/stores': 'Company Codes',
  '/team': 'Team',

  '/roles': 'Roles',
  '/plans': 'Plans & Billing',
  '/settings': 'Settings',

  '/crm': 'CRM Dashboard',
  '/crm/contacts': 'Contacts',
  '/crm/accounts': 'Accounts',
  '/crm/leads': 'Leads',
  '/crm/pipeline': 'Sales Pipeline',
  '/crm/activities': 'Activities & Tasks',
  '/crm/inbox': 'Inbox',
  '/crm/tickets': 'Support Tickets',
  '/crm/kb': 'Knowledge Base',
  '/crm/segments': 'Segments',
  '/crm/templates': 'Email Templates',
  '/crm/campaigns': 'Marketing Campaigns',
  '/crm/workflows': 'Workflow Automation',
  '/crm/ai': 'AI Insights',
  '/crm/integrations': 'Integrations',
  '/crm/reports': 'CRM Reports',
  '/crm/audit': 'Audit Log',

  '/controlling': 'Controlling (CO) Dashboard',
  '/controlling/product-costs': 'Product Cost Planning',
  '/controlling/routing': 'Work Centres & Routing',
  '/controlling/orders': 'Manufacturing & Project Orders',
  '/controlling/setup': 'Activities & Overhead Setup',
  '/controlling/wip': 'WIP Report',
  '/controlling/internal-orders': 'Internal & Project Orders',
  '/controlling/goods-movements': 'Goods Movements',
  '/controlling/activity-confirmations': 'Activity Confirmations',
  '/controlling/cost-bookings': 'Cost Bookings',
  '/controlling/variance-analysis': 'Variance Analysis',
  '/controlling/internal-cost': 'Internal Cost Management',
  '/controlling/cost-allocations': 'Cost Allocations',
  '/controlling/period-end': 'Period-End Closing',
  '/controlling/production-process': 'Production Process',
}

// ── Helpers: quiet-hours check ────────────────────────────────────────────────

const DAY_KEYS = ['sun','mon','tue','wed','thu','fri','sat']

function currentHHMM() {
  const now = new Date()
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`
}

function timeInRange(hhmm: string, start: string, end: string): boolean {
  if (start > end) return hhmm >= start || hhmm < end  // overnight
  return hhmm >= start && hhmm < end
}

function isSilenced(prefs: {
  notifications_enabled?: boolean
  sync_with_store_hours: boolean
  schedule_enabled: boolean
  schedule_mode: string
  schedule_slots: { days: string[]; start: string; end: string }[]
}, businessHours?: Record<string, { open: string; close: string; closed?: boolean }>): boolean {
  // Master switch
  if (prefs.notifications_enabled === false) return true

  if (!prefs.schedule_enabled) return false

  const now = new Date()
  const hhmm = currentHHMM()
  const dayShort = DAY_KEYS[now.getDay()]

  // Sync with store hours overrides slot-based rules
  if (prefs.sync_with_store_hours && businessHours) {
    const fullDay = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][now.getDay()]
    const today = businessHours[fullDay] ?? businessHours[dayShort]
    if (!today || today.closed || hhmm < today.open || hhmm > today.close) return true
    return false
  }

  const slots = prefs.schedule_slots ?? []

  if (prefs.schedule_mode === 'quiet') {
    // Silence if NOW falls inside ANY silence period
    return slots.some(s => {
      const daysMatch = s.days.length === 0 || s.days.includes(dayShort)
      return daysMatch && timeInRange(hhmm, s.start, s.end)
    })
  }

  // Active-windows mode: silence unless NOW is inside at least one active window
  if (slots.length === 0) return false
  const inAnySlot = slots.some(s => {
    const daysMatch = s.days.length === 0 || s.days.includes(dayShort)
    return daysMatch && timeInRange(hhmm, s.start, s.end)
  })
  return !inAnySlot
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DashboardLayout() {
  const logout = useLogout()
  const { user } = useAuthStore()
  const { vendor, selectedStore, setSelectedStore } = useVendorStore()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({})
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const [storePickerOpen, setStorePickerOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  const dark = useThemeStore(s => s.dark)
  const toggleDark = useThemeStore(s => s.toggleDark)

  const { data: storesData, refetch: refetchStores } = useStores()
  const stores = storesData?.stores ?? []
  /** "All locations" only makes sense when there are multiple outlets to filter between. */
  const showAllLocationsOption = stores.length > 1

  const openStorePicker = () => {
    setStorePickerOpen((v) => {
      const next = !v
      if (next) void refetchStores()
      return next
    })
  }

  const activeStoreFromApi = selectedStore ? stores.find((s) => s.id === selectedStore.id) : undefined
  /** Single-store tenants: treat the sole outlet as the active context even before persisted selection updates. */
  const rowForHeader =
    activeStoreFromApi ?? (stores.length === 1 ? stores[0] : undefined)
  const storeHeaderName =
    rowForHeader?.name ?? selectedStore?.name ?? vendor?.display_name ?? 'Select Store'
  const storeHeaderSubtitle = rowForHeader
    ? rowForHeader.description || rowForHeader.code || 'Store'
    : showAllLocationsOption
      ? 'All locations — pick a store to filter'
      : vendor?.business_type || 'Business'
  const storePillActive = Boolean(rowForHeader)

  useEffect(() => {
    if (!selectedStore?.id || stores.length === 0) return
    const cur = selectedStore
    const fresh = stores.find((s) => s.id === cur.id)
    if (!fresh) {
      setSelectedStore(null)
      return
    }
    if (
      fresh.name !== cur.name ||
      fresh.description !== cur.description ||
      fresh.code !== cur.code
    ) {
      setSelectedStore({
        id: fresh.id,
        name: fresh.name,
        code: fresh.code,
        description: fresh.description,
      })
    }
  }, [stores, selectedStore, setSelectedStore])

  // Persist selection for single-outlet vendors (no meaningful "all locations" mode).
  useEffect(() => {
    if (stores.length !== 1) return
    const only = stores[0]
    if (!only) return
    if (selectedStore?.id === only.id) return
    setSelectedStore({
      id: only.id,
      name: only.name,
      code: only.code,
      description: only.description ?? undefined,
    })
  }, [stores, selectedStore, setSelectedStore])

  const prevUnreadRef = useRef<number | null>(null)
  const { show: showBrowserNotif, permission } = useBrowserNotifications()

  useMyVendor()

  // Fetch unread count every 30 s
  const { data: stats } = useQuery<{ unread: number; total: number }>({
    queryKey: ['notifications', 'stats'],
    queryFn: async () => {
      const res = await apiClient.get('/vendors/me/notifications/stats')
      return res.data
    },
    refetchInterval: 30_000,
    retry: 1,
  })

  // Fetch notification preferences (for sound/schedule/repeat/delivery)
  const { data: notifPrefs } = useQuery<{
    notifications_enabled: boolean
    sound_enabled: boolean; sound_tone: string; volume: number
    sync_with_store_hours: boolean
    schedule_enabled: boolean; schedule_mode: string
    schedule_slots: { id: string; days: string[]; start: string; end: string }[]
    repeat_enabled: boolean; repeat_interval_min: number
    notify_mode: string; digest_time: string
  }>({
    queryKey: ['notification-preferences'],
    queryFn: async () => {
      const res = await apiClient.get('/vendors/me/notifications/preferences')
      return res.data
    },
    staleTime: 60_000,
    retry: 1,
  })

  const bh = vendor?.business_hours as Record<string, { open: string; close: string; closed?: boolean }> | undefined

  // Core sound + browser notification fire — used by both instant and digest timers
  function _doFire(unread: number, title = 'New notification') {
    if (!notifPrefs) return
    const silenced = isSilenced(notifPrefs, bh)
    if (silenced) return
    if (notifPrefs.sound_enabled) {
      playTone((notifPrefs.sound_tone as ToneName) || 'chime', notifPrefs.volume ?? 70)
    }
    if (permission === 'granted') {
      showBrowserNotif(
        title,
        `You have ${unread} unread notification${unread !== 1 ? 's' : ''}.`,
        { tag: 'vendor-notif' },
      )
    }
  }

  function fireAlert(unread: number) {
    // In digest modes, individual events are silent — the digest timer handles firing
    if (notifPrefs?.notify_mode && notifPrefs.notify_mode !== 'instant') return
    _doFire(unread)
  }

  // Play sound + browser notification when unread count increases
  useEffect(() => {
    const unread = stats?.unread ?? 0
    if (prevUnreadRef.current === null) { prevUnreadRef.current = unread; return }
    if (unread > prevUnreadRef.current) fireAlert(unread)
    prevUnreadRef.current = unread
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats?.unread])

  // Repeat alert interval (only in instant mode)
  useEffect(() => {
    if (!notifPrefs?.repeat_enabled) return
    if (notifPrefs.notify_mode && notifPrefs.notify_mode !== 'instant') return
    const ms = (notifPrefs.repeat_interval_min ?? 5) * 60_000
    const timer = setInterval(() => {
      const unread = prevUnreadRef.current ?? 0
      if (unread > 0) _doFire(unread)
    }, ms)
    return () => clearInterval(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifPrefs?.repeat_enabled, notifPrefs?.repeat_interval_min, notifPrefs?.notify_mode])

  // Digest timer — fires once per hour (:00) or at configured daily time
  useEffect(() => {
    const mode = notifPrefs?.notify_mode
    if (!mode || mode === 'instant') return

    const timer = setInterval(() => {
      const unread = prevUnreadRef.current ?? 0
      if (unread === 0) return

      const now = new Date()
      let shouldFire = false

      if (mode === 'digest_hourly') {
        shouldFire = now.getMinutes() === 0
      } else if (mode === 'digest_daily') {
        const [h, m] = (notifPrefs.digest_time || '09:00').split(':').map(Number)
        shouldFire = now.getHours() === h && now.getMinutes() === m
      }

      if (shouldFire) {
        const label = mode === 'digest_hourly' ? 'Hourly digest' : 'Daily digest'
        _doFire(unread, label)
      }
    }, 60_000) // check every minute

    return () => clearInterval(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifPrefs?.notify_mode, notifPrefs?.digest_time])

  const unreadCount = stats?.unread ?? 0

  const vendorRole = user?.vendor_role
  const permissions = vendorRole?.permissions || []
  const isOwnerOrAdmin = vendorRole?.role === 'owner' || vendorRole?.role === 'admin' || vendorRole?.role_name?.toLowerCase() === 'owner' || vendorRole?.role_name?.toLowerCase() === 'admin'

  const financeMode = ((vendor?.settings as Record<string, unknown> | undefined)?.finance_mode as string | undefined) ?? 'advanced'

  const filterItem = (item: NavItem) => {
    if (item.alwaysShow) return true
    if (item.requiresOffering && vendor?.offering_type) {
      if (!item.requiresOffering.includes(vendor.offering_type)) return false
    }
    if (item.requiresPermission && vendorRole && !isOwnerOrAdmin) {
      if (!permissions.includes(item.requiresPermission)) return false
    }
    if (item.requiresFinanceMode) {
      if (item.requiresFinanceMode !== financeMode) return false
    }
    return true
  }

  const visibleSections = allSections
    .map(section => ({ ...section, items: section.items.filter(filterItem) }))
    .filter(section => section.items.length > 0)

  const toggleSection = (title: string) => {
    setCollapsedSections(prev => ({ ...prev, [title]: !prev[title] }))
  }

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const roleBadge = vendorRole?.role_name || 'Member'

  const pageTitle = pageTitles[location.pathname] ||
    (location.pathname.startsWith('/products/') ? 'Product Details' :
     location.pathname.startsWith('/services/') ? 'Service Details' :
     location.pathname.startsWith('/orders/') ? 'Order Details' :
     location.pathname.startsWith('/customers/') ? 'Customer Details' :
     location.pathname.startsWith('/invoices/') ? 'Invoice Details' :
     location.pathname.startsWith('/purchase-orders/') ? 'Purchase Order' :
     location.pathname.startsWith('/controlling/orders/') ? 'CO manufacturing order' :
     'Dashboard')

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Store Selector + User Role */}
      <div className="relative border-b border-border">
        <button
          type="button"
          onClick={openStorePicker}
          className="w-full flex items-center gap-3 px-4 py-4 hover:bg-muted transition-colors"
        >
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center shadow-md shrink-0">
            <Store className="w-6 h-6 text-white" />
          </div>
          <div className="min-w-0 flex-1 text-left">
            <p className="text-sm font-bold text-foreground truncate leading-tight">
              {storeHeaderName}
            </p>
            <p className="text-[11px] text-muted-foreground truncate mt-0.5">
              {storeHeaderSubtitle}
            </p>
            <div className="flex items-center gap-0.5 mt-1">
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-violet-100 text-violet-700">
                <ShieldCheck className="w-2.5 h-2.5" />
                {roleBadge}
              </span>
            </div>
          </div>
          <ChevronDown className={cn(
            'w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200',
            storePickerOpen && 'rotate-180'
          )} />
        </button>

        {/* In-page store picker dropdown */}
        {storePickerOpen && (
          <>
            {/* Transparent overlay to close picker on outside click */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setStorePickerOpen(false)}
            />
            <div className="absolute top-full left-0 right-0 z-50 bg-card border border-border shadow-xl rounded-b-xl overflow-hidden">
              {/* Header */}
              <div className="px-4 py-2.5 bg-muted border-b border-border">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Select Store</p>
              </div>

              {showAllLocationsOption && (
                <button
                  type="button"
                  onClick={() => { setSelectedStore(null); setStorePickerOpen(false) }}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-accent transition-colors',
                    !selectedStore && 'bg-violet-500/10 dark:bg-violet-950/40'
                  )}
                >
                  <div className="w-7 h-7 rounded-md bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center shrink-0">
                    <LayoutDashboard className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{vendor?.display_name || 'Business'}</p>
                    <p className="text-[10px] text-muted-foreground">All locations (no store filter)</p>
                  </div>
                  {!selectedStore && <Check className="w-4 h-4 text-violet-600 shrink-0" />}
                </button>
              )}

              {stores.length > 0 && (
                <div className={cn('border-border', showAllLocationsOption && 'border-t')}>
                  {stores.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setSelectedStore({ id: s.id, name: s.name, code: s.code, description: s.description })
                        setStorePickerOpen(false)
                      }}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-accent transition-colors',
                        selectedStore?.id === s.id && 'bg-violet-500/10 dark:bg-violet-950/40'
                      )}
                    >
                      <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center shrink-0">
                        <Store className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{s.description || s.code || 'Store'}</p>
                      </div>
                      {selectedStore?.id === s.id && <Check className="w-4 h-4 text-violet-600 shrink-0" />}
                    </button>
                  ))}
                </div>
              )}

              {stores.length === 0 && (
                <p className="px-4 py-3 text-xs text-muted-foreground text-center">No companies configured yet</p>
              )}

              {/* Company Codes link */}
              <div className="border-t border-border px-4 py-2">
                <Link
                  to="/stores"
                  onClick={() => setStorePickerOpen(false)}
                  className="flex items-center gap-1.5 text-[11px] text-violet-600 hover:text-violet-800 font-medium transition-colors"
                >
                  <Settings className="w-3 h-3" />
                  Manage company codes
                  <ChevronRight className="w-3 h-3 ml-auto" />
                </Link>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-1 sidebar-scroll">
        {visibleSections.map((section) => {
          const isSectionCollapsed = collapsedSections[section.title] ?? false

          // ── Build sub-groups (for sections that use groupLabel) ──────────────
          type SubGroup = { label?: string; color?: string; key: string; items: NavItem[] }
          const subGroups: SubGroup[] = []
          let cur: SubGroup = { key: section.title + ':__top__', items: [] }
          for (const item of section.items) {
            if (item.groupLabel) {
              if (cur.items.length > 0) subGroups.push(cur)
              const key = section.title + ':' + item.groupLabel
              cur = { label: item.groupLabel, color: item.groupColor, key, items: [item] }
            } else {
              cur.items.push(item)
            }
          }
          if (cur.items.length > 0) subGroups.push(cur)

          const groupBg: Record<string, string> = {
            blue:    'bg-muted hover:bg-muted/80',
            amber:   'bg-muted hover:bg-muted/80',
            emerald: 'bg-muted hover:bg-muted/80',
            indigo:  'bg-muted hover:bg-muted/80',
            rose:    'bg-muted hover:bg-muted/80',
            violet:  'bg-muted hover:bg-muted/80',
          }
          const groupActive: Record<string, string> = {
            blue:    'bg-violet-600 text-white shadow-sm shadow-violet-200',
            amber:   'bg-violet-600 text-white shadow-sm shadow-violet-200',
            emerald: 'bg-violet-600 text-white shadow-sm shadow-violet-200',
            indigo:  'bg-violet-600 text-white shadow-sm shadow-violet-200',
            rose:    'bg-violet-600 text-white shadow-sm shadow-violet-200',
            violet:  'bg-violet-600 text-white shadow-sm shadow-violet-200',
          }

          return (
            <div key={section.title}>
              {/* Section header */}
              <button
                type="button"
                className="w-full flex items-center justify-between px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => toggleSection(section.title)}
              >
                {section.title}
                <ChevronDown className={cn('w-3 h-3 transition-transform duration-200', isSectionCollapsed && '-rotate-90')} />
              </button>

              {!isSectionCollapsed && (
                <div className="mt-0.5 mb-2 space-y-0.5">
                  {subGroups.map((grp) => {
                    const isGroupCollapsed = collapsedGroups[grp.key] ?? false
                    const hasActiveItem = grp.items.some(i => {
                      const base = i.to.split('?')[0]
                      return location.pathname === base || (base !== '/' && location.pathname.startsWith(base + '/'))
                    })

                    return (
                      <div key={grp.key}>
                        {/* Coloured sub-group header (only when groupLabel present) */}
                        {grp.label && (
                          <button
                            type="button"
                            onClick={() => toggleGroup(grp.key)}
                            className={cn(
                              'w-full flex items-center justify-between px-2.5 py-1.5 mt-1.5 mb-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider transition-colors',
                              grp.color ? groupBg[grp.color] : 'bg-muted hover:bg-muted/80',
                              hasActiveItem ? 'text-violet-700' : 'text-muted-foreground',
                            )}
                          >
                            <span className="flex items-center gap-1.5">
                              {hasActiveItem && <span className="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0" />}
                              {grp.label}
                            </span>
                            <ChevronDown className={cn(
                              'w-3 h-3 transition-transform duration-200 shrink-0',
                              hasActiveItem ? 'text-violet-500' : 'text-muted-foreground',
                              isGroupCollapsed && '-rotate-90',
                            )} />
                          </button>
                        )}

                        {/* Items — hidden when sub-group collapsed */}
                        {!isGroupCollapsed && (
                          <div className={cn('space-y-0.5', grp.label && 'pl-0.5')}>
                            {grp.items.map((item) => {
                              const itemColor = grp.color
                              return (
                                <NavLink
                                  key={item.to + item.label}
                                  to={item.to}
                                  end={item.to === '/' || item.to === '/websites'}
                                  onClick={() => setSidebarOpen(false)}
                                  className={({ isActive }) =>
                                    cn(
                                      'group flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium transition-all duration-150',
                                      item.labelSize ?? 'text-[13px]',
                                      isActive
                                        ? (itemColor ? groupActive[itemColor] : 'bg-violet-600 text-white shadow-sm shadow-violet-200')
                                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                                    )
                                  }
                                >
                                  <item.icon className="w-4 h-4 shrink-0" />
                                  <span className="flex-1 truncate leading-tight">{item.label}</span>
                                  {item.to === '/notifications' && unreadCount > 0 && (
                                    <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold">
                                      {unreadCount > 99 ? '99+' : unreadCount}
                                    </span>
                                  )}
                                </NavLink>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 py-3 border-t border-border">
        <button
          type="button"
          onClick={logout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 z-40 lg:hidden backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar - desktop */}
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-60 bg-card border-r border-border z-30">
        {sidebarContent}
      </aside>

      {/* Sidebar - mobile */}
      <aside className={cn(
        'fixed inset-y-0 left-0 w-72 bg-card border-r border-border z-50 transform transition-transform duration-300 lg:hidden',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        {sidebarContent}
      </aside>

      {/* Main content */}
      <div className="lg:ml-60">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-card/80 backdrop-blur-md border-b border-border">
          <div className="flex items-center justify-between h-14 px-4 lg:px-8">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="lg:hidden p-2 -ml-2 rounded-lg text-muted-foreground hover:bg-muted"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="w-5 h-5" />
              </button>
              <h1 className="text-lg font-semibold text-foreground">{pageTitle}</h1>
            </div>
            <div className="flex items-center gap-2">
              {/* Active store pill */}
              <button
                type="button"
                onClick={openStorePicker}
                className={cn(
                  'hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
                  storePillActive
                    ? 'bg-violet-600 text-white border-violet-600 shadow-sm shadow-violet-200 hover:bg-violet-700'
                    : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'
                )}
              >
                <Store className="w-3.5 h-3.5" />
                {rowForHeader ? storeHeaderName : stores.length > 1 ? 'All locations' : (vendor?.display_name ?? 'Business')}
                <ChevronDown className="w-3 h-3 opacity-70" />
              </button>

              <Link to="/notifications" className="relative p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors inline-flex">
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none ring-2 ring-background">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Link>
              {/* Profile dropdown — name + avatar trigger */}
              <div className="relative ml-2 pl-3 border-l border-border">
                <button
                  type="button"
                  onClick={() => setProfileOpen(v => !v)}
                  className={cn(
                    'flex items-center gap-2 pr-1.5 pl-1 py-1 rounded-full transition-colors',
                    profileOpen ? 'bg-violet-500/10 dark:bg-violet-950/40' : 'hover:bg-muted',
                  )}
                >
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold">
                    {(user?.full_name || 'U').charAt(0).toUpperCase()}
                  </div>
                  <span className="hidden sm:inline text-sm font-medium text-foreground truncate max-w-[120px]">
                    {user?.full_name}
                  </span>
                  <ChevronDown className={cn('w-3.5 h-3.5 text-muted-foreground transition-transform', profileOpen && 'rotate-180')} />
                </button>

                {profileOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                    <div className="absolute top-full right-0 mt-2 z-50 w-72 bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
                      {/* User header */}
                      <div className="px-4 py-3 bg-gradient-to-br from-violet-500/10 to-blue-500/10 dark:from-slate-800 dark:to-slate-900 border-b border-border">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center text-white font-bold shrink-0">
                            {(user?.full_name || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-foreground truncate">{user?.full_name}</p>
                            {user?.email && <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>}
                            <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-background text-violet-700 border border-violet-200 dark:border-violet-800">
                              <ShieldCheck className="w-2.5 h-2.5" />
                              {roleBadge}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Account section */}
                      <div className="py-1">
                        <ProfileMenuLabel>Account</ProfileMenuLabel>
                        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border">
                          <div className="flex items-center gap-2 text-sm text-foreground">
                            {dark ? <Moon className="w-4 h-4 text-violet-400 shrink-0" /> : <Sun className="w-4 h-4 text-amber-500 shrink-0" />}
                            <span>Dark mode</span>
                          </div>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={dark}
                            aria-label={dark ? 'Disable dark mode' : 'Enable dark mode'}
                            onClick={(e) => {
                              e.preventDefault()
                              toggleDark()
                            }}
                            className={cn(
                              'relative h-6 w-11 shrink-0 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                              dark ? 'bg-violet-600 border-violet-500' : 'bg-muted border-border',
                            )}
                          >
                            <span
                              className={cn(
                                'pointer-events-none absolute top-0.5 left-0.5 block h-5 w-5 rounded-full bg-card shadow ring-1 ring-border transition-transform duration-200 ease-out',
                                dark && 'translate-x-5',
                              )}
                            />
                          </button>
                        </div>
                        <Link
                          to="/profile"
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-accent"
                        >
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span className="flex-1">My Profile</span>
                        </Link>
                        <Link
                          to="/settings"
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-accent"
                        >
                          <Settings className="w-4 h-4 text-muted-foreground" />
                          <span className="flex-1">Settings</span>
                        </Link>
                        <Link
                          to="/notifications"
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-accent"
                        >
                          <Bell className="w-4 h-4 text-muted-foreground" />
                          <span className="flex-1">Notifications</span>
                          {unreadCount > 0 && (
                            <span className="inline-flex items-center justify-center min-w-[18px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold">
                              {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                          )}
                        </Link>
                        <Link
                          to="/plans"
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-accent"
                        >
                          <CreditCard className="w-4 h-4 text-muted-foreground" />
                          <span className="flex-1">Plans &amp; Billing</span>
                        </Link>
                      </div>

                      {/* Workspace section */}
                      <div className="py-1 border-t border-border">
                        <ProfileMenuLabel>Workspace</ProfileMenuLabel>
                        <Link
                          to="/stores"
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-accent"
                        >
                          <Store className="w-4 h-4 text-muted-foreground" />
                          <span className="flex-1">Company Codes</span>
                        </Link>
                        {(isOwnerOrAdmin || permissions.includes('team.view')) && (
                          <Link
                            to="/team"
                            onClick={() => setProfileOpen(false)}
                            className="flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-accent"
                          >
                            <UsersRound className="w-4 h-4 text-muted-foreground" />
                            <span className="flex-1">Team members</span>
                          </Link>
                        )}
                        {(isOwnerOrAdmin || permissions.includes('roles.view')) && (
                          <Link
                            to="/roles"
                            onClick={() => setProfileOpen(false)}
                            className="flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-accent"
                          >
                            <ShieldCheck className="w-4 h-4 text-muted-foreground" />
                            <span className="flex-1">Roles &amp; permissions</span>
                          </Link>
                        )}
                      </div>

                      {/* Help & support section */}
                      <div className="py-1 border-t border-border">
                        <ProfileMenuLabel>Help &amp; support</ProfileMenuLabel>
                        {SUPPORT_PHONE ? (
                          <a
                            href={`tel:${SUPPORT_PHONE.replace(/[^\d+]/g, '')}`}
                            onClick={() => setProfileOpen(false)}
                            className="flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-accent"
                          >
                            <Phone className="w-4 h-4 text-violet-600" />
                            <span className="flex-1">Call support</span>
                            <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[110px]">{SUPPORT_PHONE}</span>
                          </a>
                        ) : (
                          <Link
                            to="/settings"
                            onClick={() => setProfileOpen(false)}
                            className="flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-accent"
                          >
                            <Phone className="w-4 h-4 text-muted-foreground" />
                            <span className="flex-1">Call support</span>
                            <span className="text-[10px] text-muted-foreground">Set phone</span>
                          </Link>
                        )}
                        <a
                          href={SUPPORT_CHAT_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-accent"
                        >
                          <MessageCircle className="w-4 h-4 text-emerald-600" />
                          <span className="flex-1">Chat with support</span>
                        </a>
                        <Link
                          to="/settings"
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-accent"
                        >
                          <HelpCircle className="w-4 h-4 text-muted-foreground" />
                          <span className="flex-1">Help center</span>
                        </Link>
                        <Link
                          to="/settings"
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-accent"
                        >
                          <Info className="w-4 h-4 text-muted-foreground" />
                          <span className="flex-1">About &amp; version</span>
                        </Link>
                      </div>

                      {/* Logout */}
                      <div className="py-1 border-t border-border">
                        <button
                          type="button"
                          onClick={() => { setProfileOpen(false); logout() }}
                          className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                        >
                          <LogOut className="w-4 h-4" />
                          <span className="flex-1 text-left">Logout</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

        </header>

        {/* Page content */}
        <main className="p-4 lg:p-8 bg-background">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
