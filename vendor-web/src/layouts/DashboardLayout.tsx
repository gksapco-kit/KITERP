import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback, type CSSProperties, type ReactNode, type ElementType } from 'react'
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
  GripVertical, SlidersHorizontal, Database, Search, ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const SUPPORT_PHONE = (import.meta.env.VITE_SUPPORT_PHONE as string | undefined)?.trim()
const SUPPORT_CHAT_URL = (import.meta.env.VITE_SUPPORT_CHAT_URL as string | undefined)?.trim()
  || 'mailto:support@kiterp.com?subject=Vendor%20Dashboard%20Help'

function ProfileMenuLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-4 pt-1 pb-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  )
}
import { useLogout } from '@/hooks/useAuth'
import { useAuthStore } from '@/stores/authStore'
import { useThemeStore } from '@/stores/themeStore'
import { useVendorStore } from '@/stores/vendorStore'
import { getStorefrontAppOrigin } from '@/lib/storefrontPreviewUrl'
import { useESSProfile } from '@/hooks/useVendor'
import { useMyVendor, useStores } from '@/hooks/useVendor'
import { useBusinessUnitScopeLabel } from '@/hooks/useBusinessUnitScope'
import { Button } from '@/components/ui/button'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import { playTone, type ToneName } from '@/hooks/useNotificationSound'
import { useBrowserNotifications } from '@/hooks/useBrowserNotifications'
import { UniversalSearch } from '@/components/UniversalSearch'
import { buildNavIndex, type NavSearchEntry } from '@/lib/appSearchIndex'
import { isHrNavVisible } from '@/lib/hrModuleSettings'
import { buildHrEssLoginUrl, isHrEssLinkVisibleForStore } from '@/lib/hrStorefrontLinks'
import {
  isFinanceNavVisible,
  isCrmNavVisible,
  isCommissionNavVisible,
  isControllingNavVisible,
} from '@/lib/vendorModuleSettings'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  loadSectionIds,
  saveSectionIds,
  clearSavedNavOrder,
  orderSectionsById,
  loadNavPlacementsState,
  saveNavPlacementsState,
  buildDefaultPlacementsFromSections,
  reconcileNavPlacements,
} from '@/layouts/sidebarNavOrder'

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
  /** Full URL — renders as external link (new tab) instead of in-app route */
  externalHref?: string
}

/** Path without query string, no trailing slash (except root). */
function navItemPath(to: string): string {
  const base = to.split('?')[0]
  if (base.length > 1 && base.endsWith('/')) return base.slice(0, -1)
  return base
}

function pathnameMatchesNavItem(pathname: string, navPath: string): boolean {
  if (navPath === '/') return pathname === '/'
  if (pathname === navPath) return true
  return pathname.startsWith(`${navPath}/`)
}

/** Pick the single best-matching nav item (longest path wins — avoids parent + child both active). */
function resolveActiveNavTo(pathname: string, items: NavItem[]): string | null {
  let bestTo: string | null = null
  let bestLen = -1
  for (const item of items) {
    const path = navItemPath(item.to)
    if (!pathnameMatchesNavItem(pathname, path)) continue
    if (path.length > bestLen) {
      bestLen = path.length
      bestTo = item.to
    }
  }
  return bestTo
}

interface NavSection {
  /** Stable id for ordering / localStorage */
  id: string
  title: string
  /** Native `title` tooltip on the section header (defaults to `title`) */
  titleTooltip?: string
  /** Shown beside the section title in the sidebar */
  icon: ElementType
  /** Optional helper line under the title (e.g. My KIT) */
  subtitle?: string
  items: NavItem[]
}

type NavDragOverlayPayload =
  | { kind: 'item'; item: NavItem }
  | { kind: 'section'; title: string; subtitle?: string; Icon: ElementType }

const allSections: NavSection[] = [
  {
    id: 'my-kit',
    title: 'My Kit',
    titleTooltip: 'My Kit',
    icon: Sparkles,
    items: [
      { to: '/', icon: BarChart3, label: 'Dashboard', alwaysShow: true },
      { to: '/settings', icon: Settings, label: 'Settings', alwaysShow: true },
      { to: '/notifications', icon: Bell, label: 'Notifications', alwaysShow: true },
      { to: '/crm/inbox', icon: MessageSquare, label: 'Inbox', alwaysShow: true },
      { to: '/workspace', icon: LayoutGrid, label: 'Workspace Apps', alwaysShow: true },
      { to: '/relationship-manager', icon: UsersRound, label: 'Relationship Manager', alwaysShow: true },
    ],
  },
  {
    id: 'sales',
    title: 'Sales Management',
    icon: ShoppingCart,
    items: [
      { to: '/orders', icon: ShoppingCart, label: 'Orders', requiresPermission: 'orders.view' },
      { to: '/bookings', icon: Calendar, label: 'Bookings', requiresOffering: ['services', 'both'] },
      { to: '/pos', icon: Receipt, label: 'POS', requiresOffering: ['products', 'both'] },
      { to: '/restaurant/floor', icon: UtensilsCrossed, label: 'Restaurant Floor', requiresOffering: ['products', 'both'] },
      { to: '/restaurant/kitchen', icon: ChefHat, label: 'Kitchen Board', requiresOffering: ['products', 'both'] },
      { to: '/restaurant/setup', icon: Settings, label: 'Restaurant Tables', requiresOffering: ['products', 'both'] },
      { to: '/subscriptions', icon: RefreshCw, label: 'Subscriptions', alwaysShow: true },
      { to: '/rental', icon: Truck, label: 'Rentals', alwaysShow: true },
      { to: '/production', icon: Factory, label: 'Production Orders', requiresOffering: ['products', 'both'] },
      { to: '/invoices', icon: FileText, label: 'Invoices' },
      { to: '/memos', icon: FilePlus, label: 'Credit / Debit Memos' },
      { to: '/coupons', icon: Tag, label: 'Coupons' },
    ],
  },
  {
    id: 'commission',
    title: 'Commission Management',
    icon: Percent,
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
    id: 'inventory',
    title: 'Inventory Management',
    icon: Warehouse,
    items: [
      { to: '/products', icon: Package, label: 'Products', requiresOffering: ['products', 'both'], requiresPermission: 'products.view' },
      { to: '/services', icon: Wrench, label: 'Services', requiresOffering: ['services', 'both'], requiresPermission: 'services.view' },
      { to: '/categories', icon: FolderTree, label: 'Categories' },
      { to: '/inventory', icon: Warehouse, label: 'Inventory', requiresOffering: ['products', 'both'] },
      { to: '/purchase-orders', icon: ClipboardList, label: 'Purchase Orders', requiresOffering: ['products', 'both'] },
    ],
  },
  {
    id: 'finance',
    title: 'Finance Management',
    icon: Landmark,
    items: [
      // ── Basic Finance mode ─────────────────────────────────────────────────
      { to: '/finance/basic', icon: Landmark, label: 'Finance', requiresPermission: 'finance.view', requiresFinanceMode: 'basic' },
      // ── Advanced Finance mode ──────────────────────────────────────────────
      { to: '/finance', icon: Landmark, label: 'Finance Dashboard', requiresPermission: 'finance.view', requiresFinanceMode: 'advanced' },
      { to: '/stores', icon: Building2, label: 'Business Units', requiresPermission: 'finance.view', requiresFinanceMode: 'advanced' },
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
      { to: '/finance/periods', icon: Lock, label: 'Posting Periods', requiresPermission: 'finance.coa.manage', requiresFinanceMode: 'advanced' },
      { to: '/finance/field-rules', icon: ListChecks, label: 'GL Field Rules', requiresPermission: 'finance.coa.manage', requiresFinanceMode: 'advanced' },
      { to: '/finance/audit', icon: ShieldCheck, label: 'Audit Log', requiresPermission: 'finance.audit.view', requiresFinanceMode: 'advanced' },
      { to: '/reports', icon: LayoutDashboard, label: 'Reports' },
    ],
  },
  {
    id: 'controlling',
    title: 'Controlling Management',
    icon: Gauge,
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
      { to: '/controlling/internal-orders',          icon: Boxes,         label: 'Internal & Project Orders',  requiresPermission: 'finance.view', labelSize: 'text-sm' },
      // ── Production Execution
      { to: '/controlling/production-process',       icon: TrendingUp,    label: 'Production Process',         requiresPermission: 'finance.view', groupLabel: 'Production Execution',  groupColor: 'emerald' },
      { to: '/controlling/goods-movements',          icon: Package,       label: 'Goods Movements',            requiresPermission: 'finance.view' },
      { to: '/controlling/activity-confirmations',   icon: Clock,         label: 'Activity Confirmations',     requiresPermission: 'finance.view', labelSize: 'text-sm' },
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
    id: 'master-data',
    title: 'Master Data Management',
    icon: Database,
    items: [
      { to: '/master-data', icon: PieChart, label: 'Master Data — Customers & Suppliers', labelSize: 'text-sm', alwaysShow: true },
      { to: '/reviews', icon: MessageSquare, label: 'Reviews', requiresPermission: 'reviews.view' },
    ],
  },
  {
    id: 'crm',
    title: 'CRM Management',
    icon: UsersRound,
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
    id: 'hr',
    title: 'HR Management',
    icon: Briefcase,
    items: [
      { to: '/hr/employees', icon: UserCog, label: 'Employees', requiresPermission: 'hr.view' },
      { to: '/hr/attendance', icon: Clock, label: 'Attendance', requiresPermission: 'hr.view' },
      { to: '/hr/leaves', icon: Plane, label: 'Leave Requests', requiresPermission: 'hr.view' },
      { to: '/hr/recruitment', icon: Briefcase, label: 'Recruitment', requiresPermission: 'hr.manage' },
      { to: '/hr/onboarding', icon: UserCheck, label: 'Onboarding', requiresPermission: 'hr.manage' },
      { to: '/hr/performance', icon: Target, label: 'Performance', requiresPermission: 'hr.manage' },
      { to: '/hr/training', icon: GraduationCap, label: 'Training', requiresPermission: 'hr.manage' },
      { to: '/hr/compliance', icon: ShieldAlert, label: 'Compliance', requiresPermission: 'hr.manage' },
      { to: '/hr/announcements', icon: Megaphone, label: 'Announcements', requiresPermission: 'hr.manage' },
      { to: '/hr/expenses', icon: ReceiptIcon, label: 'Expense Claims', requiresPermission: 'hr.manage' },
      { to: '/hr/helpdesk', icon: LifeBuoy, label: 'Helpdesk', requiresPermission: 'hr.manage' },
      { to: '/hr/payroll', icon: DollarSign, label: 'Payroll', requiresPermission: 'hr.salary_view' },
      { to: '/hr/offers', icon: FileSignature, label: 'Offer Letters', requiresPermission: 'hr.offers' },
      { to: '/hr/departments', icon: Building2, label: 'Departments', requiresPermission: 'hr.manage' },
      { to: '/hr/designations', icon: Award, label: 'Designations', requiresPermission: 'hr.manage' },
    ],
  },
  {
    id: 'system',
    title: 'System Configuration',
    icon: Settings,
    items: [
      { to: '/websites', icon: Globe, label: 'Website Builder', alwaysShow: true },
      { to: '/websites/templates', icon: Sparkles, label: 'Website Templates', alwaysShow: true },
      { to: '/storefront-builder', icon: Wand2, label: 'Business Front Builder', alwaysShow: true },
      { to: '/system/storefront-display', icon: SlidersHorizontal, label: 'Business Front Display', alwaysShow: true },
      { to: '/system/social-links', icon: Globe, label: 'Social & Web Links', alwaysShow: true },
      { to: '/blog', icon: Newspaper, label: 'Blog Manager', alwaysShow: true },
      { to: '/document-templates', icon: LayoutTemplate, label: 'Document Templates', alwaysShow: true },
      { to: '/invoices/templates', icon: FileText, label: 'Invoice Templates', alwaysShow: true },
      { to: '/purchase-orders/templates', icon: ClipboardList, label: 'PO Templates', alwaysShow: true },
      { to: '/system/modules', icon: Layers, label: 'Module Settings', alwaysShow: true },
      { to: '/team', icon: UsersRound, label: 'Staff Access Control', requiresPermission: 'team.view' },
      { to: '/roles', icon: ShieldCheck, label: 'Roles', requiresPermission: 'roles.view' },
    ],
  },
]

const DEFAULT_SECTION_IDS = allSections.map((s) => s.id)

/** Insert a divider between consecutive sections when the rail group changes (DnD-safe: divider lives inside each sortable shell). */
const SECTION_RAIL_GROUP = new Map<string, string>([
  ['my-kit', 'personal'],
  ['sales', 'operations'],
  ['commission', 'operations'],
  ['inventory', 'operations'],
  ['finance', 'ledger'],
  ['controlling', 'ledger'],
  ['master-data', 'relationships'],
  ['crm', 'relationships'],
  ['hr', 'workforce'],
  ['system', 'platform'],
])
function railGroupForSection(id: string) {
  return SECTION_RAIL_GROUP.get(id) ?? 'other'
}

const SID_SEC = 'sb-sec:'
const SID_ITM = 'sb-itm:'

function secDndId(sectionId: string) {
  return `${SID_SEC}${sectionId}`
}
function parseSecDndId(id: string): string | null {
  if (!id.startsWith(SID_SEC)) return null
  return id.slice(SID_SEC.length)
}
function itmDndId(sectionId: string, to: string) {
  return `${SID_ITM}${sectionId}:${encodeURIComponent(to)}`
}
function parseItmDndId(id: string): { sectionId: string; to: string } | null {
  if (!id.startsWith(SID_ITM)) return null
  const rest = id.slice(SID_ITM.length)
  const ci = rest.indexOf(':')
  if (ci === -1) return null
  return { sectionId: rest.slice(0, ci), to: decodeURIComponent(rest.slice(ci + 1)) }
}

/**
 * Nested module + item `SortableContext`s share one `DndContext`. When dragging a link, consider all link
 * droppables plus module rows (drop on a module to append there). When dragging a module, only module droppables.
 */
const navCollisionDetection: CollisionDetection = (args) => {
  const activeId = String(args.active.id)
  const activeItem = parseItmDndId(activeId)
  if (activeItem) {
    const filtered = args.droppableContainers.filter((c) => {
      const id = String(c.id)
      return parseItmDndId(id) != null || parseSecDndId(id) != null
    })
    if (filtered.length === 0) return closestCenter(args)
    return closestCenter({ ...args, droppableContainers: filtered })
  }
  if (parseSecDndId(activeId) != null) {
    const filtered = args.droppableContainers.filter((c) => parseSecDndId(String(c.id)) != null)
    if (filtered.length === 0) return closestCenter(args)
    return closestCenter({ ...args, droppableContainers: filtered })
  }
  return closestCenter(args)
}

function SortableSectionShell({
  sectionId,
  prepend,
  sortDisabled,
  /** Mint ring while this module is the drop target (reorder modules or drop a link here). */
  outlineAsDropTarget,
  children,
}: {
  sectionId: string
  prepend?: ReactNode
  /** When true, section cannot be dragged (e.g. browse mode hides drag handles). */
  sortDisabled?: boolean
  outlineAsDropTarget?: boolean
  children: (
    listeners: ReturnType<typeof useSortable>['listeners'],
    attributes: ReturnType<typeof useSortable>['attributes'],
  ) => ReactNode
}) {
  const id = secDndId(sectionId)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: Boolean(sortDisabled),
  })
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 2 : undefined,
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'mb-0 rounded-md transition-shadow duration-150 motion-reduce:transition-none',
        isDragging && 'opacity-95 shadow-md ring-1 ring-border/40',
        outlineAsDropTarget &&
          'ring-2 ring-sidebar-primary ring-offset-2 ring-offset-sidebar shadow-md transition-[box-shadow] duration-100',
      )}
    >
      {prepend}
      {children(listeners, attributes)}
    </div>
  )
}

function SortableItemShell({
  sectionId,
  itemTo,
  sortDisabled,
  prepend,
  outlineDropTarget,
  hideSourceWhileDragging,
  children,
}: {
  sectionId: string
  itemTo: string
  sortDisabled?: boolean
  /** Renders above the link row but inside the sortable node (keeps @dnd-kit/sortable siblings contiguous). */
  prepend?: ReactNode
  outlineDropTarget?: boolean
  hideSourceWhileDragging?: boolean
  children: (
    listeners: ReturnType<typeof useSortable>['listeners'],
    attributes: ReturnType<typeof useSortable>['attributes'],
  ) => ReactNode
}) {
  const id = itmDndId(sectionId, itemTo)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: Boolean(sortDisabled),
  })
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 2 : undefined,
    opacity: hideSourceWhileDragging && isDragging ? 0 : undefined,
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex w-full flex-col gap-0 rounded-md transition-opacity duration-150 motion-reduce:transition-none',
        isDragging && !hideSourceWhileDragging && 'opacity-90',
      )}
    >
      {prepend}
      <div
        className={cn(
          'flex min-h-[2rem] w-full items-center gap-0 rounded-md transition-[box-shadow] duration-100',
          outlineDropTarget &&
            'ring-2 ring-sidebar-primary ring-offset-2 ring-offset-sidebar shadow-sm',
        )}
      >
        {children(listeners, attributes)}
      </div>
    </div>
  )
}

/** Active leaf — mint fill (sidebar-primary / #64C3A0 palette); light text */
const navLinkActive =
  'border-l-2 border-transparent bg-sidebar-primary font-semibold text-sidebar-primary-foreground shadow-sm ring-1 ring-white/25 rounded-lg dark:shadow-md dark:shadow-black/25 dark:ring-white/20'
const navLinkInactive =
  'border-l-2 border-transparent font-normal text-sidebar-foreground rounded-lg hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:opacity-90'

const navRowTransition = 'transition-[background-color,color,border-color] duration-150 ease-out motion-reduce:transition-none'
const navExpandTransition =
  'transition-[grid-template-rows] duration-200 ease-[cubic-bezier(0.33,1,0.68,1)] motion-reduce:transition-none'

/** Sidebar horizontal rhythm: icon column + label column align across section headers, items, logout. */
const NAV_ICON_COL = 'flex h-5 w-5 shrink-0 items-center justify-center'
const NAV_DRAG_COL = 'flex h-7 w-5 shrink-0 items-center justify-center'
const NAV_ROW_PAD_Y = 'py-0.5'
/** Nav leaf row height — matches main content text-sm rhythm */
const NAV_ROW_MIN_H = 'min-h-[2rem]'

/**
 * Nested nav tree — mint rail + elbows; stroke ~30% thinner than prior 2px (~1.4px).
 * Trunk x from panel left = 30px (see SortableSectionShell layout).
 */
const NAV_TREE_PANEL_CLASS = '[--tree-x:1.875rem]'
const navTreeTrunkLine =
  'pointer-events-none absolute left-[var(--tree-x)] top-0 bottom-2 z-0 w-[1.4px] -translate-x-1/2 rounded-full bg-sidebar-primary dark:bg-sidebar-primary/80'
/** Rounded elbow toward row content; stroke matches trunk. */
const navTreeElbowLine =
  'pointer-events-none absolute left-[var(--tree-x)] top-1/2 z-0 h-[9px] w-[9px] -translate-y-full rounded-bl-[5px] border-b-[1.4px] border-l-[1.4px] border-sidebar-primary dark:border-sidebar-primary/80'

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
  '/restaurant/floor': 'Restaurant Floor',
  '/restaurant/kitchen': 'Kitchen Board',
  '/restaurant/setup': 'Restaurant Setup',
  '/workspace': 'Workspace Apps',
  '/relationship-manager': 'Relationship Manager',
  '/subscriptions': 'Subscriptions Catalog',
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
  '/invoices/templates': 'Invoice Templates',
  '/purchase-orders/templates': 'PO Templates',
  '/websites': 'Website Builder',
  '/websites/templates': 'Website Templates',
  '/storefront-builder': 'Business Front Builder',
  '/blog': 'Blog Manager',
  '/finance/basic': 'Finance',
  '/stores': 'Business Units',
  '/team': 'Staff Access Control',

  '/roles': 'Roles',
  '/plans': 'Plans & Billing',
  '/settings': 'Settings',
  '/system/modules': 'Module Settings',
  '/system/storefront-display': 'Business Front Display',
  '/system/social-links': 'Social & Web Links',

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
  /** Drag handles and section reordering only while this is on (reduces visual noise). */
  const [navReorderMode, setNavReorderMode] = useState(false)
  /** @dnd-kit drag feedback: cursor overlay + drop highlights */
  const [navActiveDndId, setNavActiveDndId] = useState<string | null>(null)
  const [navDndOverId, setNavDndOverId] = useState<string | null>(null)
  const [navDragOverlay, setNavDragOverlay] = useState<NavDragOverlayPayload | null>(null)
  /** Default: all sections collapsed; only My Kit starts expanded. */
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({ 'My Kit': false })
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const [storePickerOpen, setStorePickerOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const navScrollRef = useRef<HTMLElement>(null)
  const sectionScrollAnchors = useRef<Map<string, HTMLDivElement>>(new Map())
  const pendingScrollSectionId = useRef<string | null>(null)

  const dark = useThemeStore(s => s.dark)
  const toggleDark = useThemeStore(s => s.toggleDark)

  const { data: storesData, refetch: refetchStores } = useStores()
  const stores = storesData?.stores ?? []
  /** "All business units" only when there are multiple outlets to filter between. */
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
  const allBusinessUnitsMode = showAllLocationsOption && !selectedStore
  const storeHeaderName =
    rowForHeader?.name ??
    selectedStore?.name ??
    (allBusinessUnitsMode ? 'All business units' : vendor?.display_name ?? 'Select Business Unit')
  const storeHeaderSubtitle = rowForHeader
    ? rowForHeader.description || rowForHeader.code || 'Business unit'
    : allBusinessUnitsMode
      ? 'No filter applied'
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

  useEffect(() => {
    if (!profileOpen) return
    const onPointerDown = (e: PointerEvent) => {
      const root = profileMenuRef.current
      const t = e.target
      if (!root || !(t instanceof Node) || root.contains(t)) return
      setProfileOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [profileOpen])

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

  const vendorSettings = vendor?.settings as Record<string, unknown> | undefined

  const hrNavVisible = useMemo(
    () => isHrNavVisible(vendorSettings, selectedStore?.id),
    [vendorSettings, selectedStore?.id],
  )

  const financeNavVisible = useMemo(() => isFinanceNavVisible(vendorSettings), [vendorSettings])
  const crmNavVisible = useMemo(() => isCrmNavVisible(vendorSettings), [vendorSettings])
  const commissionNavVisible = useMemo(() => isCommissionNavVisible(vendorSettings), [vendorSettings])
  const controllingNavVisible = useMemo(() => isControllingNavVisible(vendorSettings), [vendorSettings])

  const filterItem = useCallback(
    (item: NavItem) => {
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
    },
    [vendor, vendor?.offering_type, vendor?.settings, vendorRole, isOwnerOrAdmin, permissions, financeMode],
  )

  const visibleSections = useMemo(
    () =>
      allSections
        .filter((section) => {
          if (section.id === 'hr' && !hrNavVisible) return false
          if (section.id === 'finance' && !financeNavVisible) return false
          if (section.id === 'crm' && !crmNavVisible) return false
          if (section.id === 'commission' && !commissionNavVisible) return false
          if (section.id === 'controlling' && !controllingNavVisible) return false
          return true
        })
        .map((section) => ({ ...section, items: section.items.filter(filterItem) }))
        .filter((section) => section.items.length > 0),
    [filterItem, hrNavVisible, financeNavVisible, crmNavVisible, commissionNavVisible, controllingNavVisible],
  )

  const { data: essProfile } = useESSProfile()
  const employeePortalUrl = useMemo(() => {
    const slug = vendor?.slug?.trim()
    if (!slug) return null
    const storeId = selectedStore?.id
    const branch =
      storeId && isHrEssLinkVisibleForStore(storeId, vendorSettings)
        ? stores.find((s) => s.id === storeId)?.code ?? null
        : null
    return buildHrEssLoginUrl(slug, branch)
  }, [vendor?.slug, vendorSettings, selectedStore?.id, stores])
  const hasLinkedEmployeeProfile = Boolean(
    (essProfile as { employee?: unknown } | null | undefined)?.employee,
  )

  /** HR admin nav + optional business front ESS link when this login is tied to an employee record */
  const displaySections = useMemo(
    () =>
      visibleSections.map((section) => {
        if (section.id !== 'hr' || !hasLinkedEmployeeProfile || !employeePortalUrl) {
          return section
        }
        const portalItem: NavItem = {
          to: '#employee-portal',
          icon: ExternalLink,
          label: 'Employee Portal',
          externalHref: employeePortalUrl,
          alwaysShow: true,
        }
        return { ...section, items: [portalItem, ...section.items] }
      }),
    [visibleSections, hasLinkedEmployeeProfile, employeePortalUrl],
  )

  const [sectionOrder, setSectionOrder] = useState<string[]>(() => loadSectionIds(DEFAULT_SECTION_IDS))
  const [itemPlacements, setItemPlacements] = useState<Record<string, string[]>>({})

  useEffect(() => {
    saveSectionIds(sectionOrder)
  }, [sectionOrder])

  useEffect(() => {
    if (!displaySections.length) return
    setItemPlacements((prev) =>
      reconcileNavPlacements(
        Object.keys(prev).length ? prev : loadNavPlacementsState(displaySections),
        displaySections,
      ),
    )
  }, [displaySections])

  useEffect(() => {
    if (!Object.keys(itemPlacements).length) return
    saveNavPlacementsState(itemPlacements)
  }, [itemPlacements])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const orderedVisibleSections = useMemo(
    () => orderSectionsById(displaySections, sectionOrder),
    [displaySections, sectionOrder],
  )

  // ── Universal Search ───────────────────────────────────────────────────────
  const [searchOpen, setSearchOpen] = useState(false)

  const navSearchIndex = useMemo<NavSearchEntry[]>(
    () => buildNavIndex(orderedVisibleSections as Parameters<typeof buildNavIndex>[0]),
    [orderedVisibleSections],
  )

  useEffect(() => {
    function onKeyDown(e: globalThis.KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
  // ──────────────────────────────────────────────────────────────────────────

  const orderedNavItemsBySectionId = useMemo(() => {
    const byTo = new Map<string, NavItem>()
    for (const s of displaySections) {
      for (const it of s.items) {
        byTo.set(it.to, it)
      }
    }
    const m = new Map<string, NavItem[]>()
    for (const s of displaySections) {
      const keys = itemPlacements[s.id]
      const list: NavItem[] = []
      if (keys?.length) {
        for (const to of keys) {
          const it = byTo.get(to)
          if (it) list.push(it)
        }
      } else {
        list.push(...s.items)
      }
      m.set(s.id, list)
    }
    return m
  }, [displaySections, itemPlacements])

  const flatVisibleNavItems = useMemo(
    () => displaySections.flatMap((s) => orderedNavItemsBySectionId.get(s.id) ?? s.items),
    [displaySections, orderedNavItemsBySectionId],
  )

  const activeNavTo = useMemo(
    () => resolveActiveNavTo(location.pathname, flatVisibleNavItems),
    [location.pathname, flatVisibleNavItems],
  )

  function resetNavOrderToDefaults() {
    clearSavedNavOrder()
    setSectionOrder(loadSectionIds(DEFAULT_SECTION_IDS))
    setItemPlacements(buildDefaultPlacementsFromSections(displaySections))
    setNavReorderMode(false)
    setNavActiveDndId(null)
    setNavDndOverId(null)
    setNavDragOverlay(null)
    setSidebarOpen(true)
  }

  function handleNavDragEnd(event: DragEndEvent) {
    try {
      const { active, over } = event
      if (!over || active.id === over.id) return
      const a = String(active.id)
      const b = String(over.id)
      const secA = parseSecDndId(a)
      const secB = parseSecDndId(b)
      if (secA && secB) {
        setSectionOrder((prev) => {
          const oi = prev.indexOf(secA)
          const ni = prev.indexOf(secB)
          if (oi < 0 || ni < 0) return prev
          return arrayMove(prev, oi, ni)
        })
        return
      }
      const itA = parseItmDndId(a)
      const itB = parseItmDndId(b)
      const overSectionId = parseSecDndId(b)
      if (!itA) return

      if (itB) {
        if (itA.sectionId === itB.sectionId) {
          setItemPlacements((prev) => {
            const sid = itA.sectionId
            const list = [...(prev[sid] ?? [])]
            const oi = list.indexOf(itA.to)
            const ni = list.indexOf(itB.to)
            if (oi < 0 || ni < 0) return prev
            return { ...prev, [sid]: arrayMove(list, oi, ni) }
          })
          return
        }
        setItemPlacements((prev) => {
          const fromSid = itA.sectionId
          const toSid = itB.sectionId
          const fromList = [...(prev[fromSid] ?? [])]
          const toList = [...(prev[toSid] ?? [])]
          const fi = fromList.indexOf(itA.to)
          if (fi < 0) return prev
          fromList.splice(fi, 1)
          const ti = toList.indexOf(itB.to)
          const insertAt = ti >= 0 ? ti : toList.length
          toList.splice(insertAt, 0, itA.to)
          return { ...prev, [fromSid]: fromList, [toSid]: toList }
        })
        return
      }

      if (overSectionId) {
        if (itA.sectionId === overSectionId) return
        setItemPlacements((prev) => {
          const fromSid = itA.sectionId
          const toSid = overSectionId
          const fromList = [...(prev[fromSid] ?? [])]
          const toList = [...(prev[toSid] ?? [])]
          const fi = fromList.indexOf(itA.to)
          if (fi < 0) return prev
          fromList.splice(fi, 1)
          toList.push(itA.to)
          return { ...prev, [fromSid]: fromList, [toSid]: toList }
        })
      }
    } finally {
      setNavActiveDndId(null)
      setNavDndOverId(null)
      setNavDragOverlay(null)
    }
  }

  const handleNavDragStart = useCallback(
    (event: DragStartEvent) => {
      const id = String(event.active.id)
      setNavActiveDndId(id)
      setNavDndOverId(null)
      const it = parseItmDndId(id)
      if (it) {
        for (const s of displaySections) {
          for (const item of s.items) {
            if (item.to === it.to) {
              setNavDragOverlay({ kind: 'item', item })
              return
            }
          }
        }
        setNavDragOverlay(null)
        return
      }
      const sid = parseSecDndId(id)
      if (sid) {
        const sec = displaySections.find((s) => s.id === sid)
        if (sec) {
          setNavDragOverlay({ kind: 'section', title: sec.title, subtitle: sec.subtitle, Icon: sec.icon })
        } else {
          setNavDragOverlay(null)
        }
      } else {
        setNavDragOverlay(null)
      }
    },
    [displaySections],
  )

  const handleNavDragOver = useCallback((event: DragOverEvent) => {
    setNavDndOverId(event.over ? String(event.over.id) : null)
  }, [])

  const registerSectionScrollAnchor = useCallback((sectionId: string, node: HTMLDivElement | null) => {
    if (node) sectionScrollAnchors.current.set(sectionId, node)
    else sectionScrollAnchors.current.delete(sectionId)
  }, [])

  const toggleSection = useCallback((title: string, sectionId: string) => {
    setCollapsedSections((prev) => {
      const wasCollapsed = prev[title] ?? true
      if (!wasCollapsed) {
        return { ...prev, [title]: true }
      }
      pendingScrollSectionId.current = sectionId
      return { ...prev, [title]: false }
    })
  }, [])

  useLayoutEffect(() => {
    const sectionId = pendingScrollSectionId.current
    if (!sectionId) return
    pendingScrollSectionId.current = null

    const ensureSectionVisibleInNav = () => {
      const nav = navScrollRef.current
      const anchor = sectionScrollAnchors.current.get(sectionId)
      if (!nav || !anchor) return

      const pad = 4
      const navRect = nav.getBoundingClientRect()
      const anchorRect = anchor.getBoundingClientRect()

      const headerAboveTop = anchorRect.top < navRect.top + pad
      const bottomCutOff = anchorRect.bottom > navRect.bottom - pad

      // Always scroll so the section header aligns with the top of the nav
      // whenever the section doesn't fully fit, or the header is hidden
      if (headerAboveTop || bottomCutOff) {
        nav.scrollTop = Math.max(0, nav.scrollTop + (anchorRect.top - navRect.top) - pad)
      }
    }

    ensureSectionVisibleInNav()
    const afterExpand = window.setTimeout(ensureSectionVisibleInNav, 220)
    return () => window.clearTimeout(afterExpand)
  }, [collapsedSections])

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const roleBadge = vendorRole?.role_name || 'Member'
  const { heading: settingsScopeHeading } = useBusinessUnitScopeLabel()

  const pageTitle =
    location.pathname === '/settings'
      ? `Settings — ${settingsScopeHeading}`
      : pageTitles[location.pathname] ||
        (location.pathname.startsWith('/products/') ? 'Product Details' :
         location.pathname.startsWith('/services/') ? 'Service Details' :
         location.pathname.startsWith('/orders/') ? 'Order Details' :
         location.pathname.startsWith('/customers/') ? 'Customer Details' :
         location.pathname.startsWith('/invoices/') ? 'Invoice Details' :
         location.pathname.startsWith('/purchase-orders/') ? 'Purchase Order' :
         location.pathname.startsWith('/controlling/orders/') ? 'CO manufacturing order' :
         'Dashboard')

  const storePickerMenu = storePickerOpen ? (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={() => setStorePickerOpen(false)}
        aria-hidden
      />
      <div
        className="absolute top-full right-0 z-50 mt-1.5 w-72 max-w-[min(18rem,calc(100vw-1rem))] overflow-hidden rounded-xl border border-border bg-card shadow-xl"
        role="listbox"
        aria-label="Select business unit"
      >
        <div className="border-b border-border bg-muted px-4 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Select Business Unit</p>
        </div>

        {showAllLocationsOption && (
          <button
            type="button"
            role="option"
            aria-selected={!selectedStore}
            onClick={() => { setSelectedStore(null); setStorePickerOpen(false) }}
            className={cn(
              'w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-accent transition-colors',
              !selectedStore && 'bg-primary/10 dark:bg-primary/20',
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">All business units</p>
              <p className="text-xs text-muted-foreground">No filter applied</p>
            </div>
            {!selectedStore && <Check className="w-4 h-4 text-primary shrink-0" />}
          </button>
        )}

        {stores.length > 0 && (
          <div className={cn('border-border', showAllLocationsOption && 'border-t')}>
            {stores.map((s) => (
              <button
                key={s.id}
                type="button"
                role="option"
                aria-selected={selectedStore?.id === s.id}
                onClick={() => {
                  setSelectedStore({ id: s.id, name: s.name, code: s.code, description: s.description })
                  setStorePickerOpen(false)
                }}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-accent transition-colors',
                  selectedStore?.id === s.id && 'bg-primary/10 dark:bg-primary/20',
                )}
              >
                <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center shrink-0">
                  <Store className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{s.description || s.code || 'Business unit'}</p>
                </div>
                {selectedStore?.id === s.id && <Check className="w-4 h-4 text-primary shrink-0" />}
              </button>
            ))}
          </div>
        )}

        {stores.length === 0 && (
          <p className="px-4 py-3 text-xs text-muted-foreground text-center">No business units configured yet</p>
        )}

        <div className="border-t border-border px-4 py-2">
          <Link
            to="/settings"
            onClick={() => setStorePickerOpen(false)}
            className="flex items-center gap-1.5 text-xs text-primary hover:text-primary font-medium transition-colors"
          >
            <Settings className="w-3 h-3" />
            Settings
            <ChevronRight className="w-3 h-3 ml-auto" />
          </Link>
        </div>
      </div>
    </>
  ) : null

  const sidebarContent = (
    <div className="flex h-full min-h-0 flex-col">
      {/* Active business unit context (selector lives in top bar) */}
      <div className="border-b border-sidebar-border bg-muted/30 px-2.5 py-2">
        <p className="truncate text-sm font-semibold leading-tight text-sidebar-foreground">{storeHeaderName}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{storeHeaderSubtitle}</p>
        <div className="mt-1 flex items-center gap-0.5">
          <span className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-xs font-semibold bg-primary/15 text-primary dark:bg-primary/20 dark:text-primary-foreground/90">
            <ShieldCheck className="h-2.5 w-2.5" />
            {roleBadge}
          </span>
        </div>
      </div>

      {/* Navigation — reorder mode shows drag handles (order saved in this browser) */}
      <DndContext
        sensors={sensors}
        collisionDetection={navCollisionDetection}
        onDragStart={handleNavDragStart}
        onDragOver={handleNavDragOver}
        onDragEnd={handleNavDragEnd}
        onDragCancel={() => {
          setNavActiveDndId(null)
          setNavDndOverId(null)
          setNavDragOverlay(null)
        }}
      >
        <nav
          ref={navScrollRef}
          className="sidebar-scroll sidebar-scroll-intent flex min-h-0 flex-1 flex-col overflow-y-auto px-2 pb-1 pt-0.5"
          aria-label="Main navigation"
        >
          <div className="mb-0.5 flex shrink-0 items-center justify-between gap-2 px-0.5 py-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
              Modules
            </span>
            <div className="flex shrink-0 items-center gap-1">
              {navReorderMode && (
                <button
                  type="button"
                  aria-label="Reset menu order to default and exit reorder mode"
                  onClick={resetNavOrderToDefaults}
                  className={cn(
                    'rounded-md px-2 py-0.5 text-xs font-semibold uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                    'text-muted-foreground/90 hover:bg-muted/60 hover:text-foreground',
                  )}
                >
                  Reset
                </button>
              )}
              <button
                type="button"
                aria-pressed={navReorderMode}
                aria-label={navReorderMode ? 'Finish customizing menu order' : 'Reorder menu sections and items'}
                onClick={() => {
                  setNavReorderMode((prev) => {
                    if (!prev) {
                      setCollapsedSections((old) => {
                        const next = { ...old }
                        for (const s of displaySections) {
                          next[s.title] = false
                        }
                        return next
                      })
                      setCollapsedGroups({})
                    } else {
                      setNavActiveDndId(null)
                      setNavDndOverId(null)
                      setNavDragOverlay(null)
                    }
                    return !prev
                  })
                }}
                className={cn(
                  'rounded-md px-2 py-0.5 text-xs font-semibold uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  navReorderMode
                    ? 'bg-primary text-white shadow-sm hover:bg-primary/90 dark:bg-primary dark:hover:bg-accent'
                    : 'text-muted-foreground/90 hover:bg-muted/60 hover:text-foreground',
                )}
              >
                {navReorderMode ? 'Done' : 'Reorder'}
              </button>
            </div>
          </div>

          <SortableContext
            id="nav-sections-order"
            items={orderedVisibleSections.map((s) => secDndId(s.id))}
            strategy={verticalListSortingStrategy}
          >
            {orderedVisibleSections.map((section, sectionIdx) => {
              const isSectionCollapsed = collapsedSections[section.title] ?? true
              const orderedItems = orderedNavItemsBySectionId.get(section.id) ?? section.items
              const sectionHasActive = orderedItems.some((it) => activeNavTo === it.to)
              const prevSectionId = sectionIdx > 0 ? orderedVisibleSections[sectionIdx - 1]?.id : null
              const showRailDivider =
                prevSectionId != null && railGroupForSection(section.id) !== railGroupForSection(prevSectionId)

              const SectionIcon = section.icon
              const sectionPanelId = `nav-section-${section.id}`
              const sortLocked = !navReorderMode
              const secDnd = secDndId(section.id)
              const activeSec = navActiveDndId ? parseSecDndId(navActiveDndId) : null
              const activeIt = navActiveDndId ? parseItmDndId(navActiveDndId) : null
              const outlineSectionDrop =
                navReorderMode &&
                navDndOverId === secDnd &&
                ((activeIt != null) || (activeSec != null && navActiveDndId !== secDnd))

              return (
                <div
                  key={section.id}
                  ref={(node) => registerSectionScrollAnchor(section.id, node)}
                >
                <SortableSectionShell
                  sectionId={section.id}
                  sortDisabled={sortLocked}
                  outlineAsDropTarget={outlineSectionDrop}
                  prepend={
                    showRailDivider ? (
                      <div
                        className="mx-2 my-1 h-px bg-border/[0.1] dark:hidden"
                        role="separator"
                        aria-hidden
                      />
                    ) : null
                  }
                >
                  {(secListeners, secAttributes) => (
                    <>
                      <div className="flex min-h-[2rem] items-center gap-0.5">
                        {navReorderMode ? (
                          <button
                            type="button"
                            aria-label={`Drag to reorder ${section.title}`}
                            className={cn(
                              NAV_DRAG_COL,
                              'touch-none cursor-grab rounded text-muted-foreground/40 transition-colors hover:bg-muted/40 hover:text-muted-foreground/70 active:cursor-grabbing',
                            )}
                            {...secListeners}
                            {...secAttributes}
                          >
                            <GripVertical className="h-2.5 w-2.5" strokeWidth={2} aria-hidden />
                          </button>
                        ) : (
                          <span className={NAV_DRAG_COL} aria-hidden />
                        )}
                        <button
                          type="button"
                          title={section.titleTooltip ?? section.title}
                          id={`${sectionPanelId}-trigger`}
                          aria-expanded={!isSectionCollapsed}
                          aria-controls={sectionPanelId}
                          className={cn(
                            'group/sec flex min-h-[2rem] min-w-0 flex-1 items-center gap-1.5 rounded-lg px-1 py-0.5 text-left',
                            navRowTransition,
                            sectionHasActive && !isSectionCollapsed
                              ? 'bg-muted/50 text-foreground'
                              : sectionHasActive
                                ? 'bg-muted/35 text-foreground'
                                : 'text-muted-foreground hover:bg-muted/45 hover:text-foreground',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35 focus-visible:ring-offset-1 focus-visible:ring-offset-background',
                          )}
                          onClick={() => toggleSection(section.title, section.id)}
                        >
                          <span
                            className={cn(
                              NAV_ICON_COL,
                              'rounded-md bg-muted/60 text-muted-foreground ring-1 ring-border/25 dark:bg-zinc-800/50 dark:ring-border/25',
                              sectionHasActive && 'bg-muted text-foreground ring-border/35 dark:bg-sidebar-accent dark:text-sidebar-accent-foreground',
                            )}
                          >
                            <SectionIcon className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                          </span>
                          <div className="min-w-0 flex-1 py-0.5">
                            <span
                              className={cn(
                                'block truncate text-sm leading-snug tracking-normal',
                                sectionHasActive ? 'font-semibold text-foreground' : 'font-medium text-sidebar-foreground',
                              )}
                            >
                              {section.title}
                            </span>
                            {section.subtitle ? (
                              <span className="mt-px block truncate text-xs font-normal leading-snug text-muted-foreground">
                                {section.subtitle}
                              </span>
                            ) : null}
                          </div>
                          <span className="flex h-7 w-6 shrink-0 items-center justify-center pr-1" aria-hidden>
                            <ChevronDown
                              className={cn(
                                'h-3.5 w-3.5 text-muted-foreground/70 transition-transform duration-200 ease-out motion-reduce:transition-none',
                                isSectionCollapsed ? '-rotate-90' : 'rotate-180',
                              )}
                            />
                          </span>
                        </button>
                      </div>

                      <div
                        className={cn(
                          'grid overflow-hidden',
                          navExpandTransition,
                          isSectionCollapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]',
                        )}
                      >
                        <div
                          id={sectionPanelId}
                          role="region"
                          aria-labelledby={`${sectionPanelId}-trigger`}
                          className={cn(
                            'min-h-0 overflow-hidden',
                            isSectionCollapsed && 'pointer-events-none select-none',
                          )}
                          aria-hidden={isSectionCollapsed}
                        >
                          <div
                            className={cn('relative ml-1 space-y-px py-1', NAV_TREE_PANEL_CLASS)}
                            role="group"
                            aria-label={`${section.title} pages`}
                          >
                            <span aria-hidden className={navTreeTrunkLine} />
                            <SortableContext
                              id={`nav-items-${section.id}`}
                              items={orderedItems.map((i) => itmDndId(section.id, i.to))}
                              strategy={verticalListSortingStrategy}
                            >
                              <div className="space-y-px">
                                {orderedItems.map((item, itemIdx) => {
                                  const gl = item.groupLabel ?? null
                                  const prevGl = itemIdx > 0 ? (orderedItems[itemIdx - 1]?.groupLabel ?? null) : null
                                  const showGroupHeader = Boolean(gl) && gl !== prevGl
                                  const grpKey = gl != null ? `${section.title}:${gl}` : ''
                                  const isGroupCollapsed = grpKey ? (collapsedGroups[grpKey] ?? false) : false
                                  const subgroupKey = item.groupLabel ? `${section.title}:${item.groupLabel}` : ''
                                  const inCollapsedSubgroup = Boolean(
                                    item.groupLabel && (collapsedGroups[subgroupKey] ?? false),
                                  )

                                  const groupHeader =
                                    showGroupHeader && gl != null ? (
                                      <button
                                        key={`hdr-${grpKey}`}
                                        type="button"
                                        tabIndex={isSectionCollapsed ? -1 : undefined}
                                        onClick={() => toggleGroup(grpKey)}
                                        aria-expanded={!isGroupCollapsed}
                                        className={cn(
                                          'relative flex min-h-[1.875rem] w-full items-center gap-1.5 rounded-md py-0.5 pr-1 pl-[calc(var(--tree-x)+0.5rem)] text-left text-xs font-semibold uppercase tracking-wide',
                                          itemIdx > 0 ? 'mt-0.5' : 'mt-0',
                                          navRowTransition,
                                          'text-muted-foreground/80 hover:bg-muted/35 hover:text-foreground',
                                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35 focus-visible:ring-offset-1 focus-visible:ring-offset-background',
                                          orderedItems.some((it) => (it.groupLabel ?? null) === gl && activeNavTo === it.to) && 'font-semibold text-foreground',
                                        )}
                                      >
                                        <span aria-hidden className={navTreeElbowLine} />
                                        <span className="flex min-w-0 flex-1 items-center gap-1.5">
                                          {orderedItems.some((it) => (it.groupLabel ?? null) === gl && activeNavTo === it.to) && (
                                            <span className="h-1 w-1 shrink-0 rounded-full bg-accent dark:bg-primary/50" />
                                          )}
                                          <span className="truncate">{gl}</span>
                                        </span>
                                        <span className="flex h-6 w-5 shrink-0 items-center justify-center pr-1" aria-hidden>
                                          <ChevronDown
                                            className={cn(
                                              'h-3 w-3 text-muted-foreground/65 transition-transform duration-200 ease-out motion-reduce:transition-none',
                                              isGroupCollapsed ? '-rotate-90' : 'rotate-180',
                                            )}
                                          />
                                        </span>
                                      </button>
                                    ) : null

                                  const thisItemDndId = itmDndId(section.id, item.to)
                                  return (
                                    <SortableItemShell
                                      key={item.to + item.label}
                                      sectionId={section.id}
                                      itemTo={item.to}
                                      sortDisabled={sortLocked}
                                      prepend={groupHeader}
                                      outlineDropTarget={navReorderMode && navDndOverId === thisItemDndId}
                                      hideSourceWhileDragging={
                                        navReorderMode && navActiveDndId === thisItemDndId
                                      }
                                    >
                                      {(itemListeners, itemAttributes) => (
                                        <div
                                          className={cn(
                                            'relative flex min-h-[2rem] w-full min-w-0 flex-1 items-center gap-0.5',
                                            inCollapsedSubgroup && 'hidden',
                                          )}
                                        >
                                          <span aria-hidden className={navTreeElbowLine} />
                                          {navReorderMode ? (
                                            <button
                                              type="button"
                                              aria-label={`Drag to reorder ${item.label}`}
                                              className={cn(
                                                NAV_DRAG_COL,
                                                'touch-none cursor-grab rounded text-muted-foreground/40 transition-colors hover:bg-muted/40 hover:text-muted-foreground/70 active:cursor-grabbing',
                                              )}
                                              {...itemListeners}
                                              {...itemAttributes}
                                              tabIndex={isSectionCollapsed || inCollapsedSubgroup ? -1 : undefined}
                                            >
                                              <GripVertical className="h-2.5 w-2.5" strokeWidth={2} aria-hidden />
                                            </button>
                                          ) : (
                                            <span className={NAV_DRAG_COL} aria-hidden />
                                          )}
                                          {item.externalHref ? (
                                            <a
                                              href={item.externalHref}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              title={`${item.label} (opens in new tab)`}
                                              tabIndex={isSectionCollapsed || inCollapsedSubgroup ? -1 : undefined}
                                              onClick={() => setSidebarOpen(false)}
                                              className="group/nav flex min-w-0 flex-1 rounded-lg pl-5 outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/45 focus-visible:ring-offset-0"
                                            >
                                              <span
                                                className={cn(
                                                  'relative z-[1] flex min-h-[2rem] min-w-0 flex-1 items-center gap-1.5 rounded-lg py-0.5 pl-1 pr-2',
                                                  item.labelSize ?? 'text-sm',
                                                  'leading-snug',
                                                  navRowTransition,
                                                  navLinkInactive,
                                                )}
                                              >
                                                <span className={cn(NAV_ICON_COL, 'text-muted-foreground/80 group-hover/nav:text-foreground')}>
                                                  <item.icon className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                                                </span>
                                                <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
                                              </span>
                                            </a>
                                          ) : (
                                          <NavLink
                                            to={item.to}
                                            title={item.label}
                                            tabIndex={isSectionCollapsed || inCollapsedSubgroup ? -1 : undefined}
                                            onClick={() => setSidebarOpen(false)}
                                            className="group/nav flex min-w-0 flex-1 rounded-lg pl-5 outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/45 focus-visible:ring-offset-0"
                                          >
                                            {() => {
                                              const isActive = activeNavTo === item.to
                                              return (
                                              <span
                                                className={cn(
                                                  'relative z-[1] flex min-h-[2rem] min-w-0 flex-1 items-center gap-1.5 rounded-lg py-0.5 pl-1 pr-2',
                                                  item.labelSize ?? 'text-sm',
                                                  'leading-snug',
                                                  navRowTransition,
                                                  isActive ? navLinkActive : navLinkInactive,
                                                )}
                                              >
                                                <span
                                                  className={cn(
                                                    NAV_ICON_COL,
                                                    isActive
                                                      ? 'text-sidebar-primary-foreground'
                                                      : 'text-muted-foreground/80 group-hover/nav:text-foreground',
                                                  )}
                                                >
                                                  <item.icon className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                                                </span>
                                                <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
                                                {item.to === '/notifications' && unreadCount > 0 && (
                                                  <span className="ml-0.5 inline-flex h-3.5 min-w-[0.875rem] shrink-0 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white tabular-nums">
                                                    {unreadCount > 99 ? '99+' : unreadCount}
                                                  </span>
                                                )}
                                              </span>
                                              )
                                            }}
                                          </NavLink>
                                          )}
                                        </div>
                                      )}
                                    </SortableItemShell>
                                  )
                                })}
                              </div>
                            </SortableContext>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </SortableSectionShell>
                </div>
              )
            })}
          </SortableContext>
        </nav>
        <DragOverlay zIndex={100} dropAnimation={null}>
          {navReorderMode && navDragOverlay ? (
            navDragOverlay.kind === 'item' ? (
              (() => {
                const item = navDragOverlay.item
                const OI = item.icon
                return (
                  <div
                    className={cn(
                      'pointer-events-none flex min-h-[2rem] min-w-[13rem] max-w-[17rem] items-center gap-0.5 rounded-lg border border-sidebar-border/80 bg-sidebar py-0.5 pl-1 pr-2 text-sidebar-foreground shadow-xl ring-2 ring-sidebar-primary/50',
                    )}
                  >
                    <span className={NAV_DRAG_COL}>
                      <GripVertical className="h-2.5 w-2.5 text-muted-foreground" strokeWidth={2} aria-hidden />
                    </span>
                    <span className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg py-0.5 pl-1 pr-0">
                      <span className={cn(NAV_ICON_COL, 'text-muted-foreground')}>
                        <OI className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                      </span>
                      <span
                        className={cn(
                          'min-w-0 flex-1 truncate text-left font-medium',
                          item.labelSize ?? 'text-sm',
                        )}
                      >
                        {item.label}
                      </span>
                    </span>
                  </div>
                )
              })()
            ) : (
              (() => {
                const pl = navDragOverlay
                const OI = pl.Icon
                return (
                  <div
                    className={cn(
                      'pointer-events-none flex min-h-[2rem] min-w-[13rem] max-w-[17rem] items-center gap-1.5 rounded-lg border border-sidebar-border/80 bg-sidebar px-2 py-1 text-sidebar-foreground shadow-xl ring-2 ring-sidebar-primary/50',
                    )}
                  >
                    <span
                      className={cn(
                        NAV_ICON_COL,
                        'rounded-md bg-muted/60 text-muted-foreground ring-1 ring-border/25',
                      )}
                    >
                      <OI className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold leading-snug">{pl.title}</span>
                      {pl.subtitle ? (
                        <span className="mt-px block truncate text-xs text-muted-foreground">{pl.subtitle}</span>
                      ) : null}
                    </div>
                  </div>
                )
              })()
            )
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Logout — separated from primary nav */}
      <div className="shrink-0 border-t border-border/15 bg-muted/10 px-2 py-1 dark:bg-muted/5">
        <button
          type="button"
          onClick={logout}
          className={cn(
            'flex w-full items-center gap-1.5 rounded-md px-1 py-0.5 text-sm font-medium text-sidebar-foreground',
            NAV_ROW_MIN_H,
            navRowTransition,
            'hover:bg-red-500/10 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35 focus-visible:ring-offset-0 dark:hover:bg-red-950/30 dark:hover:text-red-300',
          )}
        >
          <span className={cn(NAV_ICON_COL, 'text-muted-foreground')}>
            <LogOut className="h-3.5 w-3.5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1 truncate text-left">Logout</span>
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 z-40 lg:hidden backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar — single instance so nav scroll ref targets the visible panel */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-[min(17.5rem,100vw)] min-w-0 max-w-[min(100vw,18rem)] border-r border-sidebar-border bg-sidebar font-sans text-sidebar-foreground text-sm shadow-sm lg:z-30 lg:w-64 lg:min-w-[14rem]',
          'transition-transform duration-200 ease-out motion-reduce:transition-none lg:translate-x-0 lg:transition-none',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {sidebarContent}
      </aside>

      {/* Main content */}
      <div className="lg:ml-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 overflow-visible border-b border-border bg-card/80 backdrop-blur-md">
          {/*
            Title + search must shrink (min-w-0). Actions stay full width (shrink-0).
            Do not use overflow-hidden here — it clips the unit picker when the row is tight.
          */}
          <div className="flex h-14 min-w-0 items-center gap-2 px-3 sm:gap-3 sm:px-4 lg:px-8">
            {/* Title — truncates first */}
            <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
              <button
                type="button"
                className="lg:hidden shrink-0 rounded-lg p-2 -ml-1 text-muted-foreground hover:bg-muted"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </button>
              {location.pathname === '/settings' ? (
                <div
                  className="flex min-w-0 items-baseline gap-1.5 overflow-hidden sm:gap-2"
                  title={`Settings — ${settingsScopeHeading}`}
                >
                  <h1 className="shrink-0 text-sm font-semibold text-foreground sm:text-base lg:text-lg">
                    Settings
                  </h1>
                  <span className="hidden min-w-0 truncate text-xs font-medium text-muted-foreground md:inline sm:text-sm">
                    {settingsScopeHeading}
                  </span>
                </div>
              ) : (
                <h1
                  className="min-w-0 truncate text-sm font-semibold text-foreground sm:text-base lg:text-lg"
                  title={pageTitle}
                >
                  {pageTitle}
                </h1>
              )}
            </div>

            {/* Search — fixed max width, yields space to actions */}
            <div className="hidden shrink min-w-0 md:flex md:justify-center">
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="flex h-9 w-40 min-w-0 items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 text-muted-foreground transition-all hover:border-primary/30 hover:bg-muted hover:text-foreground lg:w-48 xl:w-56"
              >
                <Search className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-left text-xs">Search pages, records…</span>
                <kbd className="hidden shrink-0 lg:inline-flex items-center gap-0.5 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-mono">
                  ⌘K
                </kbd>
              </button>
            </div>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="shrink-0 rounded-lg p-2 text-muted-foreground hover:bg-muted md:hidden"
              aria-label="Open search"
            >
              <Search className="h-5 w-5" />
            </button>

            {/* Actions — priority: never clipped */}
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <div className="relative">
                <button
                  type="button"
                  onClick={openStorePicker}
                  aria-expanded={storePickerOpen}
                  aria-haspopup="listbox"
                  title={storeHeaderName}
                  className={cn(
                    'flex min-w-[2.75rem] max-w-[11.5rem] items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-semibold transition-all sm:max-w-[12.5rem] lg:max-w-[14rem]',
                    storePillActive
                      ? 'border-primary bg-primary text-white shadow-sm shadow-primary/20 hover:bg-primary/90'
                      : 'border-border bg-muted text-muted-foreground hover:bg-muted/80',
                  )}
                >
                  <Store className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden min-w-0 truncate sm:inline">{storeHeaderName}</span>
                  <ChevronDown
                    className={cn(
                      'h-3 w-3 shrink-0 opacity-70 transition-transform duration-200 motion-reduce:transition-none',
                      storePickerOpen && 'rotate-180',
                    )}
                  />
                </button>
                {storePickerMenu}
              </div>

              <Link
                to="/notifications"
                className="relative inline-flex shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-background">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Link>
              <div ref={profileMenuRef} className="relative shrink-0 border-l border-border pl-2 sm:pl-3">
                <button
                  type="button"
                  onClick={() => setProfileOpen(v => !v)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full py-1 pl-1 pr-1.5 transition-colors sm:pr-2',
                    profileOpen ? 'bg-muted ring-1 ring-border' : 'hover:bg-muted',
                  )}
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(140deg,hsl(var(--primary))_0%,hsl(var(--hero-via))_45%,hsl(var(--hero-to))_100%)] text-xs font-bold text-white shadow-sm ring-1 ring-black/15">
                    {(user?.full_name || 'U').charAt(0).toUpperCase()}
                  </div>
                  <span className="hidden min-w-0 max-w-[5.5rem] truncate text-sm font-medium text-foreground md:inline lg:max-w-[7rem]">
                    {user?.full_name}
                  </span>
                  <ChevronDown className={cn('hidden h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform md:block', profileOpen && 'rotate-180')} />
                </button>

                {profileOpen && (
                    <div className="absolute top-full right-0 z-[100] mt-2 flex w-72 max-h-[min(32rem,calc(100dvh-4.5rem))] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
                      {/* User header — fixed at top of panel */}
                      <div className="shrink-0 border-b border-white/10 bg-[linear-gradient(90deg,hsl(var(--primary))_0%,hsl(var(--hero-via))_42%,hsl(var(--hero-to))_100%)] px-4 py-3 text-white">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(140deg,hsl(var(--primary))_0%,hsl(var(--hero-via))_45%,hsl(var(--hero-to))_100%)] text-sm font-bold text-white shadow-md ring-1 ring-white/15">
                            {(user?.full_name || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-white">{user?.full_name}</p>
                            {user?.email && <p className="truncate text-xs text-emerald-100/85">{user.email}</p>}
                            <span className="mt-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-white/15 text-white ring-1 ring-white/25">
                              <ShieldCheck className="h-2.5 w-2.5" />
                              {roleBadge}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                      {/* Account section */}
                      <div className="py-1">
                        <ProfileMenuLabel>Account</ProfileMenuLabel>
                        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border">
                          <div className="flex items-center gap-2 text-sm text-foreground">
                            {dark ? <Moon className="w-4 h-4 text-primary/70 shrink-0" /> : <Sun className="w-4 h-4 text-amber-500 shrink-0" />}
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
                              dark ? 'bg-primary border-primary' : 'bg-muted border-border',
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
                          <span className="flex-1">Business Units</span>
                        </Link>
                        {(isOwnerOrAdmin || permissions.includes('team.view')) && (
                          <Link
                            to="/team"
                            onClick={() => setProfileOpen(false)}
                            className="flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-accent"
                          >
                            <UsersRound className="w-4 h-4 text-muted-foreground" />
                            <span className="flex-1">Staff Access Control</span>
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
                            <Phone className="w-4 h-4 text-primary" />
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
                      </div>

                      {/* Logout — always visible at bottom */}
                      <div className="shrink-0 border-t border-border bg-card py-1">
                        <button
                          type="button"
                          onClick={() => { setProfileOpen(false); logout() }}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                        >
                          <LogOut className="h-4 w-4" />
                          <span className="flex-1 text-left">Logout</span>
                        </button>
                      </div>
                    </div>
                )}
              </div>
            </div>
          </div>

        </header>

        {/* Universal Search palette */}
        <UniversalSearch
          open={searchOpen}
          onClose={() => setSearchOpen(false)}
          navEntries={navSearchIndex}
        />

        {/* Page content */}
        <main className="p-4 lg:p-8 bg-background font-sans text-sm">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
