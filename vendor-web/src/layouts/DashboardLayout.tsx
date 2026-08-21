import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback, type CSSProperties, type ReactNode, type ElementType } from 'react'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { useKiterpModalOpen } from '@/hooks/useKiterpModalOpen'
import { useViewportAnchoredPanel } from '@/hooks/useViewportAnchoredPanel'
import { createPortal } from 'react-dom'
import { Outlet, NavLink, useLocation, Link, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, ShoppingCart, Package, Wrench, Warehouse,
  Users, Settings, LogOut, Store, MessageSquare, MessageSquareText,
  UsersRound, ShieldCheck, Receipt, FileText, Tag, BarChart3, CreditCard, LayoutTemplate,
  FolderTree, Truck, ClipboardList, Calendar, Bell, List, PackageSearch, FileCheck, ArrowRightLeft,
  ChevronDown, ChevronRight, Check, Menu, FilePlus, Factory, PieChart,
  UserCog, Clock, Plane, DollarSign, Award, Building2, FileSignature, Dumbbell, Car, Ticket,
  HelpCircle, Phone, MessageCircle, User as UserIcon, Info, AlertCircle,
  Briefcase, Target, ShieldAlert, GraduationCap, Megaphone, Receipt as ReceiptIcon, LifeBuoy, UserCheck,
  Contact2, GitBranch, Workflow, Mail, BookOpen, Bot, Plug, History, Activity,
  Landmark, BookMarked, ArrowLeftRight, Scale, Banknote, TrendingUp, TrendingDown, Calculator,
  ScrollText, HardDrive, Coins, LineChart, CircleDollarSign, FilePieChart,
  Shuffle, ClipboardCheck, Heart, Layers, Percent, Link2, Wallet2, Sparkles,
  Lock, ListChecks, Boxes, Gauge, Globe, Newspaper, Moon, Sun, Image, Palette,
  UtensilsCrossed, ChefHat, LayoutGrid, RefreshCw, FolderKanban, FileBarChart,
  GripVertical, SlidersHorizontal, Database, Table2, Search, ExternalLink,
  PanelLeftClose, PanelLeft, Settings2, Hash, QrCode, Pill, FlaskConical, Microscope,
  ArrowLeft, ArrowRight, MoreHorizontal, Keyboard, Plus, Star, Save, MapPin, Quote, X,
  ThermometerSnowflake, Network, CalendarCheck2, CalendarDays, RotateCcw,
} from 'lucide-react'
import { APP_SAVE_REQUEST_EVENT, dispatchAppSaveRequest } from '@/lib/appSave'
import { isVendorAdminEmbed } from '@/lib/adminEmbed'
import { FieldMappingProvider } from '@/providers/FieldMappingProvider'
import { cn, mediaUrl, surfaceBorderClassName } from '@/lib/utils'

function ProfileAvatar({
  user,
  className,
  textClassName = 'text-xs font-bold',
}: {
  user: { full_name?: string; avatar_url?: string | null } | null | undefined
  className?: string
  textClassName?: string
}) {
  const initial = (user?.full_name || 'U').charAt(0).toUpperCase()
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[linear-gradient(140deg,hsl(var(--primary))_0%,hsl(var(--hero-via))_45%,hsl(var(--hero-to))_100%)] text-white',
        className,
      )}
    >
      {user?.avatar_url ? (
        <img
          src={mediaUrl(user.avatar_url)}
          alt={user.full_name || 'Profile'}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className={textClassName}>{initial}</span>
      )}
    </div>
  )
}

function profileFirstName(fullName?: string | null): string {
  const trimmed = fullName?.trim()
  if (!trimmed) return ''
  return trimmed.split(/\s+/)[0] ?? trimmed
}

const SUPPORT_PHONE = (import.meta.env.VITE_SUPPORT_PHONE as string | undefined)?.trim()
const SUPPORT_CHAT_URL = (import.meta.env.VITE_SUPPORT_CHAT_URL as string | undefined)?.trim()
  || 'mailto:support@kiterp.com?subject=Vendor%20Dashboard%20Help'

/** Desktop sidebar: full width, icon rail, or hidden. */
type SidebarMode = 'expanded' | 'rail' | 'hidden'

const LS_SIDEBAR_MODE = 'kiterp.vendor.sidebar.mode'
const LS_SIDEBAR_COLLAPSED_LEGACY = 'kiterp.vendor.sidebar.collapsed'
const LS_SIDEBAR_WIDTH = 'kiterp.vendor.sidebar.width'
/** Icon rail width — 30% wider than prior 56px rail (fits 45px icon targets + padding). */
const SIDEBAR_RAIL_WIDTH_PX = 73
/** Expanded sidebar width (px) — default matches former `w-64`. */
const SIDEBAR_WIDTH_DEFAULT_PX = 256
/** Minimum = icon rail width; drag left until icon-only menu. */
const SIDEBAR_WIDTH_MIN_PX = SIDEBAR_RAIL_WIDTH_PX
const SIDEBAR_WIDTH_MAX_PX = 480
const SIDEBAR_WIDTH_STEP_PX = 8
/** At or below this width, show icon-only nav (labels hidden) on desktop. */
const SIDEBAR_ICON_ONLY_MAX_PX = 96
/** Hysteresis on drag end — avoids mode flicker at the threshold. */
const SIDEBAR_ICON_ONLY_ENTER_PX = 88
const SIDEBAR_ICON_ONLY_EXIT_PX = 112

function loadSidebarWidthPx(): number {
  try {
    const raw = localStorage.getItem(LS_SIDEBAR_WIDTH)
    if (raw) {
      const n = Number.parseInt(raw, 10)
      if (Number.isFinite(n)) {
        return Math.min(SIDEBAR_WIDTH_MAX_PX, Math.max(SIDEBAR_WIDTH_MIN_PX, n))
      }
    }
  } catch {
    /* ignore */
  }
  return SIDEBAR_WIDTH_DEFAULT_PX
}

function clampSidebarWidthPx(w: number): number {
  return Math.min(SIDEBAR_WIDTH_MAX_PX, Math.max(SIDEBAR_WIDTH_MIN_PX, Math.round(w)))
}

function loadSidebarMode(): SidebarMode {
  try {
    const raw = localStorage.getItem(LS_SIDEBAR_MODE)
    if (raw === 'expanded' || raw === 'rail' || raw === 'hidden') return raw
    if (localStorage.getItem(LS_SIDEBAR_COLLAPSED_LEGACY) === '1') return 'hidden'
  } catch {
    /* ignore */
  }
  return 'expanded'
}

function ProfileMenuLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-4 pt-1 pb-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  )
}
import { useLogout } from '@/hooks/useAuth'
import { useAuthStore } from '@/stores/authStore'
import { useThemeStore } from '@/stores/themeStore'
import { useVendorStore } from '@/stores/vendorStore'
import { useRestaurantStore } from '@/stores/restaurantStore'
import { Select } from '@/components/ui/select'
import { getStorefrontAppOrigin } from '@/lib/storefrontPreviewUrl'
import { applyDocumentSeo, vendorAppPageTitle } from '@/lib/documentSeo'
import { useESSProfile } from '@/hooks/useVendor'
import { useMyVendor, useMyPlan, useStores, useOrderStats, useAccessibleVendors } from '@/hooks/useVendor'
import type { AccessibleVendorItem } from '@/hooks/useVendor'
import { useBusinessUnitScopeLabel } from '@/hooks/useBusinessUnitScope'
import { Button } from '@/components/ui/button'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import { vendorApi } from '@/api/vendor'
import { toast } from 'sonner'
import { playTone, type ToneName } from '@/hooks/useNotificationSound'
import { useBrowserNotifications } from '@/hooks/useBrowserNotifications'
import { useInboxUnreadCount, useNewLeadCount } from '@/hooks/useCrm'
import { useNewContactQueryCount } from '@/hooks/useContactQueries'
import { isAxiosAuthError } from '@/lib/errorMessages'
import { UniversalSearch } from '@/components/UniversalSearch'
import { KitErpThemePickerModal } from '@/components/KitErpThemePickerModal'
import { SidebarAppsPickerModal } from '@/components/SidebarAppsPickerModal'
import { getKitErpThemeOption } from '@/lib/kitErpThemes'
import { buildNavIndex, type NavSearchEntry } from '@/lib/appSearchIndex'
import { isHrNavVisible } from '@/lib/hrModuleSettings'
import {
  BUSINESS_UNIT_STORE_LABEL,
  BUSINESS_UNIT_STORE_SETTINGS_LINK,
} from '@/lib/businessUnitLabels'
import { buildHrEssLoginUrl, isHrEssLinkVisibleForStore } from '@/lib/hrStorefrontLinks'
import { BusinessUnitLogoThumb } from '@/components/business-units/BusinessUnitLogoThumb'
import {
  isFinanceNavVisible,
  isCrmNavVisible,
  isCommissionNavVisible,
  isControllingNavVisible,
  isProductionNavVisible,
  isPharmaNavVisible,
  isPosNavVisible,
  isRestaurantNavVisible,
  isBookingsNavVisible,
  isSubscriptionsNavVisible,
  isProjectsNavVisible,
  isRentalsNavVisible,
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
  CANONICAL_SIDEBAR_SECTION_IDS,
  ensurePinnedNavItemsInSection,
  loadSectionIds,
  saveSectionIds,
  clearSavedNavOrder,
  orderSectionsById,
  loadNavPlacementsState,
  saveNavPlacementsState,
  buildDefaultPlacementsFromSections,
  reconcileNavPlacements,
  resolveNavGroupCollapsed,
  RESET_USER_NAV_ORDER_EVENT,
  type NavOrderScope,
} from '@/layouts/sidebarNavOrder'
import {
  loadEnabledSectionIds,
  saveEnabledSectionIds,
  isPinnedSidebarSection,
  normalizeEnabledSectionIds,
  SIDEBAR_APP_DESCRIPTIONS,
  SIDEBAR_APPS_ADMIN_ONLY_MESSAGE,
} from '@/layouts/sidebarNavApps'
import {
  buildRailFlyoutTree,
  buildRailNavTree,
  buildSidebarNavTree,
  flyoutFocusKey,
  grpFocusKey,
  isSidebarTypingTarget,
  itemFocusKey,
  railFocusKey,
  resolveSidebarNavKeyAction,
  secFocusKey,
  type SidebarNavAction,
  type SidebarNavNode,
  type NavItemLike,
} from '@/layouts/sidebarKeyboardNav'
import { formatBadgeCount, countBadgeCircleClass } from '@/lib/countBadge'

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
  /** Vendor owner or admin only (hidden from regular staff). */
  requiresVendorAdmin?: boolean
  /** Full URL — renders as external link (new tab) instead of in-app route */
  externalHref?: string
}

function navCountBadgeClass(variant: 'nav' | 'flyout' = 'nav', count: number) {
  return cn(countBadgeCircleClass(count), variant === 'nav' && 'ml-0.5')
}

function headerNotificationBadgeClass(count: number) {
  return cn(
    'absolute -top-0.5 -right-0.5 border border-border shadow-sm',
    countBadgeCircleClass(count, 'red', 'sm'),
  )
}

function NavCountBadge({ count, variant = 'nav' }: { count: number; variant?: 'nav' | 'flyout' }) {
  if (count <= 0) return null
  return (
    <span className={navCountBadgeClass(variant, count)}>
      {formatBadgeCount(count)}
    </span>
  )
}

/**
 * Nav items after a row with `groupLabel` belong to that group until the next `groupLabel`.
 * (Only the first row per group sets `groupLabel` in config; siblings inherit for collapse.)
 */
function effectiveNavGroupLabels(items: Array<{ groupLabel?: string }>): (string | null)[] {
  let current: string | null = null
  return items.map((item) => {
    if (item.groupLabel) current = item.groupLabel
    return current
  })
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

/** Pick the single best-matching nav item (longest path wins; query params must match when present). */
function resolveActiveNavTo(pathname: string, search: string, items: NavItem[]): string | null {
  const locParams = new URLSearchParams(search)
  let bestTo: string | null = null
  let bestScore = -1

  for (const item of items) {
    const qIdx = item.to.indexOf('?')
    const path = navItemPath(item.to)
    if (!pathnameMatchesNavItem(pathname, path)) continue

    if (qIdx >= 0) {
      const itemParams = new URLSearchParams(item.to.slice(qIdx + 1))
      let paramsMatch = true
      itemParams.forEach((value, key) => {
        if (locParams.get(key) !== value) paramsMatch = false
      })
      if (!paramsMatch) continue
      const score = path.length + 1000
      if (score > bestScore) {
        bestScore = score
        bestTo = item.to
      }
    } else if (pathname === '/settings' && locParams.has('section') && item.to.includes('?')) {
      continue
    } else {
      const score = path.length
      if (score > bestScore) {
        bestScore = score
        bestTo = item.to
      }
    }
  }
  return bestTo
}

/** True when the current URL already matches this nav item (including child paths). */
function isNavRouteActive(pathname: string, search: string, navTo: string): boolean {
  const qIdx = navTo.indexOf('?')
  const path = qIdx >= 0 ? navTo.slice(0, qIdx) : navTo
  if (!pathnameMatchesNavItem(pathname, path)) return false
  if (qIdx < 0) return true
  const locParams = new URLSearchParams(search)
  const itemParams = new URLSearchParams(navTo.slice(qIdx + 1))
  let paramsMatch = true
  itemParams.forEach((value, key) => {
    if (locParams.get(key) !== value) paramsMatch = false
  })
  return paramsMatch
}

function sectionActiveNavTo(
  sectionId: string,
  activeNavTo: string | null,
  orderedNavItemsBySectionId: Map<string, NavItem[]>,
  displaySections: { id: string; items: NavItem[] }[],
): string | null {
  if (!activeNavTo) return null
  const items = orderedNavItemsBySectionId.get(sectionId) ?? displaySections.find((s) => s.id === sectionId)?.items ?? []
  return items.some((it) => it.to === activeNavTo) ? activeNavTo : null
}

const SETTINGS_SECTION_TITLES: Record<string, string> = {
  profile: 'Business Profile',
  contact: 'Contact Information',
  address: 'Addresses',
  tax: 'Tax & Compliance',
  'hours-availability': 'Offline Business Hours',
  'order-acceptance': 'Online Orders',
  'external-domain': 'External Domain',
  about: 'About',
}

function UniversalSaveToolbarButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={dispatchAppSaveRequest}
      title="Save changes on this page"
      aria-label="Save changes"
      className={className}
    >
      <Save className="h-3.5 w-3.5" />
    </button>
  )
}

/** Shared pill styling for top-bar controls (matches sidebar section row corners). */
const headerBarPillClass =
  'flex h-8 shrink-0 items-center rounded-lg border border-border/60 bg-muted/40 text-[11px] font-medium text-muted-foreground'

type HeaderQuickActionButtonsProps = {
  helpRef: React.Ref<HTMLDivElement>
  moreRef: React.Ref<HTMLDivElement>
  helpOpen: boolean
  setHelpOpen: React.Dispatch<React.SetStateAction<boolean>>
  moreOpen: boolean
  setMoreOpen: React.Dispatch<React.SetStateAction<boolean>>
  onOpenSearch: () => void
  onNavigateNotifications: () => void
  onNavigateSettings: () => void
}

function HeaderQuickActionButtons({
  helpRef,
  moreRef,
  helpOpen,
  setHelpOpen,
  moreOpen,
  setMoreOpen,
  onOpenSearch,
  onNavigateNotifications,
  onNavigateSettings,
}: HeaderQuickActionButtonsProps) {
  const menuClass =
    'absolute right-0 top-full z-[100] mt-1.5 w-52 overflow-hidden rounded-lg border border-border bg-card py-1 shadow-lg'
  const iconBtn =
    'flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground lg:h-7 lg:w-7'

  return (
    <div
      className={cn(headerBarPillClass, 'h-9 gap-0.5 p-0.5 lg:h-8')}
      aria-label="Page actions"
    >
      <div className="flex items-center gap-0.5" role="group" aria-label="Navigation">
        <button
          type="button"
          onClick={() => window.history.back()}
          title="Go back"
          aria-label="Go back"
          className={iconBtn}
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>

        <button
          type="button"
          onClick={() => window.history.forward()}
          title="Go forward"
          aria-label="Go forward"
          className={cn(iconBtn, 'hidden md:flex')}
        >
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>

        <UniversalSaveToolbarButton className={cn(iconBtn, 'hidden md:flex')} />

        <div ref={helpRef} className="relative hidden shrink-0 md:block">
          <button
            type="button"
            title="Help & support"
            aria-label="Help"
            onClick={() => { setHelpOpen(v => !v); setMoreOpen(false) }}
            className={cn(iconBtn, helpOpen && 'bg-background text-foreground shadow-sm')}
          >
            <HelpCircle className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
          {helpOpen && (
            <div className={menuClass}>
              <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Help & Support</p>
              <a href="https://docs.kiterp.com" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2.5 px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
                onClick={() => setHelpOpen(false)}>
                <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground" /> Documentation
              </a>
              <a href="mailto:support@kiterp.com"
                className="flex items-center gap-2.5 px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
                onClick={() => setHelpOpen(false)}>
                <Mail className="h-4 w-4 shrink-0 text-muted-foreground" /> Email support
              </a>
              <a href="https://wa.me/918000000000" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2.5 px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
                onClick={() => setHelpOpen(false)}>
                <MessageCircle className="h-4 w-4 shrink-0 text-muted-foreground" /> WhatsApp chat
              </a>
            </div>
          )}
        </div>

        <div ref={moreRef} className="relative shrink-0">
          <button
            type="button"
            title="More options"
            aria-label="More options"
            onClick={() => { setMoreOpen(v => !v); setHelpOpen(false) }}
            className={cn(iconBtn, moreOpen && 'bg-background text-foreground shadow-sm')}
          >
            <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
          {moreOpen && (
            <div className={menuClass}>
              <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Quick Actions</p>
              <button type="button"
                className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
                onClick={() => { onOpenSearch(); setMoreOpen(false) }}>
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 text-left">Search</span>
                <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground md:inline">⌘K</kbd>
              </button>
              <button type="button"
                className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted md:hidden"
                onClick={() => { window.history.forward(); setMoreOpen(false) }}>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" /> Go forward
              </button>
              <a href="https://docs.kiterp.com" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2.5 px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted md:hidden"
                onClick={() => setMoreOpen(false)}>
                <HelpCircle className="h-4 w-4 shrink-0 text-muted-foreground" /> Help & support
              </a>
              <button type="button"
                className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
                onClick={() => { onNavigateNotifications(); setMoreOpen(false) }}>
                <Bell className="h-4 w-4 shrink-0 text-muted-foreground" /> Notifications
              </button>
              <div className="mx-3 my-1 border-t border-border" />
              <button type="button"
                className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
                onClick={() => { onNavigateSettings(); setMoreOpen(false) }}>
                <Settings className="h-4 w-4 shrink-0 text-muted-foreground" /> Settings
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mx-0.5 hidden h-4 w-px shrink-0 bg-border/80 lg:block" aria-hidden />

      <button
        type="button"
        onClick={() => { setHelpOpen(false); setMoreOpen(false); onOpenSearch() }}
        className="hidden h-7 min-w-[7.5rem] items-center gap-1.5 rounded-md px-2 text-muted-foreground transition-colors hover:bg-background hover:text-foreground lg:flex"
        aria-label="Search"
      >
        <Search className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
        <span className="min-w-0 flex-1 truncate text-left text-[11px]">Search…</span>
        <kbd className="rounded border border-border/80 bg-background/80 px-1 py-px font-mono text-[9px] text-muted-foreground/80">⌘K</kbd>
      </button>
    </div>
  )
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

/**
 * A module section only survives the permission filter if at least one of its already-filtered
 * items is gated on a permission in the section's own namespace. Cross-cutting permissions like
 * `reports.view` or `pos.view` can render items *inside* a section they belong to, but they
 * cannot cause an *unrelated* section to appear. Absent from the map = no namespace check (my-kit
 * is all alwaysShow by design and always shows).
 *
 * Logic: sectionHasOwnershipItem = filtered items includes ≥1 item whose requiresPermission starts
 * with one of the listed prefixes, OR has no requiresPermission but the section is in the map
 * (alwaysShow items inside a mapped section don't count as "ownership" items — they can't pull
 * the whole section in, but they will render if the section is already visible for another reason).
 */
const SECTION_PERMISSION_NAMESPACES: Record<string, string[]> = {
  'website-management': ['websites'],
  sales: ['orders', 'quotations', 'bookings', 'projects', 'pos', 'subscriptions', 'invoices', 'memos', 'coupons'],
  inventory: ['products', 'services', 'inventory', 'procurement'],
  'master-data': ['masterdata'],
  crm: ['crm'],
  rental: ['rentals'],
  production: ['production'],
  pharma: ['pharma'],
  restaurant: ['restaurant'],
  commission: ['commission'],
  procurement: ['procurement'],
  finance: ['finance'],
  controlling: ['controlling'],
  hr: ['hr'],
  system: ['system', 'team', 'roles', 'documents', 'settings'],
}

function sectionHasOwnershipItem(sectionId: string, filteredItems: NavItem[]): boolean {
  const namespaces = SECTION_PERMISSION_NAMESPACES[sectionId]
  if (!namespaces) return true // no constraint (e.g. my-kit)
  return filteredItems.some((item) => {
    if (!item.requiresPermission) return false
    return namespaces.some((ns) => item.requiresPermission!.startsWith(ns + '.') || item.requiresPermission === ns)
  })
}

const allSections: NavSection[] = [
  {
    id: 'my-kit',
    title: 'My Kit',
    titleTooltip: 'My Kit',
    icon: Sparkles,
    items: [
      { to: '/', icon: BarChart3, label: 'Dashboard', alwaysShow: true },
      { to: '/notifications', icon: Bell, label: 'Notifications', alwaysShow: true },
      { to: '/crm/inbox', icon: MessageSquare, label: 'Inbox', alwaysShow: true },
      { to: '/queries', icon: MessageSquareText, label: 'Queries', alwaysShow: true },
      { to: '/relationship-manager', icon: UsersRound, label: 'Relationship Manager', alwaysShow: true },
      { to: '/settings', icon: Settings, label: BUSINESS_UNIT_STORE_SETTINGS_LINK, alwaysShow: true },
    ],
  },
  {
    id: 'website-management',
    title: 'Website Management',
    icon: Globe,
    items: [
      { to: '/websites', icon: Globe, label: 'Business Website Builder', requiresPermission: 'websites.view' },
      { to: '/websites/templates', icon: Sparkles, label: 'Business Website Templates', requiresPermission: 'websites.view' },
      { to: '/system/storefront-display', icon: SlidersHorizontal, label: 'Business Front Display', requiresPermission: 'websites.view' },
      { to: '/system/social-links', icon: Globe, label: 'Social & Web Links', requiresPermission: 'websites.view' },
      { to: '/blog', icon: Newspaper, label: 'Blog Manager', requiresPermission: 'websites.manage' },
      { to: '/websites/seo', icon: Search, label: 'SEO Management', requiresPermission: 'websites.manage' },
      { to: '/websites/analytics', icon: BarChart3, label: 'Website Analytics', requiresPermission: 'reports.view' },
    ],
  },
  {
    id: 'sales',
    title: 'Sales Management',
    icon: ShoppingCart,
    items: [
      { to: '/sales/manager', icon: BarChart3, label: 'Sales Reporting Manager', requiresPermission: 'reports.view' },
      { to: '/orders', icon: ShoppingCart, label: 'Orders', requiresPermission: 'orders.view', groupLabel: 'Core Sales', groupColor: 'blue' },
      { to: '/quotations', icon: ScrollText, label: 'Quotations', requiresPermission: 'quotations.view' },
      { to: '/bookings', icon: Calendar, label: 'Bookings', requiresOffering: ['services', 'both'], requiresPermission: 'bookings.view' },
      { to: '/sales/delivery-conditions', icon: PackageSearch, label: 'Delivery Conditions', requiresPermission: 'orders.view' },
      { to: '/projects', icon: FolderKanban, label: 'Projects', requiresPermission: 'projects.view' },
      { to: '/pos', icon: Receipt, label: 'POS', requiresOffering: ['products', 'both'], requiresPermission: 'pos.view' },
      { to: '/subscriptions', icon: RefreshCw, label: 'Subscriptions', requiresPermission: 'subscriptions.view', groupLabel: 'Recurring Revenue', groupColor: 'violet' },
      { to: '/sales/plans', icon: Hash, label: 'Pricing Plans', requiresPermission: 'subscriptions.view' },
      { to: '/sales/recurring-bookings', icon: RefreshCw, label: 'Recurring Bookings', requiresPermission: 'orders.view' },
      { to: '/invoices', icon: FileText, label: 'Invoices', requiresPermission: 'invoices.view', groupLabel: 'Billing & Adjustments', groupColor: 'amber' },
      { to: '/memos', icon: FilePlus, label: 'Credit / Debit Memos', requiresPermission: 'memos.view' },
      { to: '/coupons', icon: Tag, label: 'Coupons', requiresPermission: 'coupons.view' },
      { to: '/sales/properties', icon: Building2, label: 'Property Listings', requiresPermission: 'products.view', groupLabel: 'Industry Catalogs', groupColor: 'indigo' },
      { to: '/sales/courses', icon: GraduationCap, label: 'Course Catalog', requiresPermission: 'products.view' },
      { to: '/sales/fitness-classes', icon: Dumbbell, label: 'Fitness Schedule', requiresPermission: 'bookings.view' },
      { to: '/sales/vehicles', icon: Car, label: 'Vehicle Inventory', requiresPermission: 'products.view' },
      { to: '/sales/events', icon: Ticket, label: 'Ticketed Events', requiresPermission: 'orders.view' },
      { to: '/sales/booking-wizard', icon: Workflow, label: 'Booking Wizard', requiresPermission: 'bookings.view' },
      { to: '/sales/booking-resources', icon: Warehouse, label: 'Resources', requiresPermission: 'bookings.view' },
      { to: '/sales/coverage', icon: MapPin, label: 'Store Coverage', requiresPermission: 'orders.view', groupLabel: 'Territory & Coverage', groupColor: 'emerald' },
      { to: '/sales/sales-area', icon: LayoutGrid, label: 'Sales Area', requiresPermission: 'orders.view' },
      { to: '/crm/sales-area-dues', icon: MapPin, label: 'Sales Area Dues', requiresPermission: 'crm.view' },
      { to: '/marketplace', icon: Target, label: 'Marketplace Leads', requiresPermission: 'orders.view', groupLabel: 'Growth & Social Proof', groupColor: 'rose' },
      { to: '/sales/testimonials', icon: Quote, label: 'Testimonials', requiresPermission: 'reviews.view' },
      { to: '/reviews', icon: MessageSquare, label: 'Reviews', requiresPermission: 'reviews.view' },
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
      { to: '/product-groups', icon: Layers, label: 'Product Groups' },
      { to: '/inventory', icon: Warehouse, label: 'Inventory', requiresOffering: ['products', 'both'], requiresPermission: 'inventory.view' },
      { to: '/inventory/settings', icon: Settings, label: 'Inventory Config', requiresOffering: ['products', 'both'], requiresPermission: 'inventory.view' },
      { to: '/plants', icon: Factory, label: 'Plants', requiresOffering: ['products', 'both'], requiresPermission: 'inventory.view' },
      { to: '/storage-locations', icon: Boxes, label: 'Storage Locations', requiresOffering: ['products', 'both'], requiresPermission: 'inventory.view' },
      { to: '/procurement/goods', icon: PackageSearch, label: 'Goods Management', requiresPermission: 'procurement.view', groupLabel: 'Goods & Valuation', groupColor: 'emerald' },
      { to: '/inventory/material-valuation', icon: Scale, label: 'Material Valuation', requiresPermission: 'inventory.view' },
    ],
  },
  {
    id: 'master-data',
    title: 'Master Data Management',
    icon: Database,
    items: [
      { to: '/master-data', icon: PieChart, label: 'Master Data — Customers & Suppliers', labelSize: 'text-sm', requiresPermission: 'masterdata.view' },
    ],
  },
  {
    id: 'crm',
    title: 'CRM Management',
    icon: UsersRound,
    items: [
      { to: '/crm', icon: LayoutDashboard, label: 'CRM Dashboard', requiresPermission: 'crm.view' },
      { to: '/crm/contacts', icon: Contact2, label: 'Contacts', requiresPermission: 'crm.view' },
      { to: '/crm/leads', icon: Target, label: 'Leads', requiresPermission: 'crm.view' },
      { to: '/crm/number-ranges', icon: Hash, label: 'Number Ranges', requiresPermission: 'crm.leads.manage' },
      { to: '/crm/pipeline', icon: GitBranch, label: 'Pipeline', requiresPermission: 'crm.view' },
      { to: '/crm/activities', icon: Activity, label: 'Tasks', requiresPermission: 'crm.view' },
      { to: '/crm/tickets', icon: LifeBuoy, label: 'Tickets', requiresPermission: 'crm.view' },
      { to: '/crm/kb', icon: BookOpen, label: 'Knowledge Base', requiresPermission: 'crm.view' },
      { to: '/crm/segments', icon: UsersRound, label: 'Segments', requiresPermission: 'crm.view' },
      { to: '/crm/templates', icon: Mail, label: 'Email Templates', requiresPermission: 'crm.view' },
      { to: '/crm/campaigns', icon: Megaphone, label: 'Campaigns', requiresPermission: 'crm.view' },
      { to: '/crm/care-reminder', icon: Heart, label: 'Care & Reminders', requiresPermission: 'crm.view' },
      { to: '/crm/payment-followups', icon: Banknote, label: 'Payment Follow-ups', requiresPermission: 'crm.view' },
      { to: '/crm/credit-control', icon: ShieldCheck, label: 'Credit Control', requiresPermission: 'crm.view' },
      { to: '/crm/workflows', icon: Workflow, label: 'Workflows', requiresPermission: 'crm.workflows.manage' },
      { to: '/crm/ai', icon: Bot, label: 'AI Insights', requiresPermission: 'crm.ai.use' },
      { to: '/crm/reports', icon: BarChart3, label: 'CRM Reports', requiresPermission: 'crm.reports.view' },
      { to: '/crm/audit', icon: History, label: 'Audit Log', requiresPermission: 'crm.audit.view' },
    ],
  },
  {
    id: 'rental',
    title: 'Rental Management',
    icon: Truck,
    items: [
      { to: '/rental/dashboard', icon: LayoutDashboard, label: 'Overview', requiresPermission: 'rentals.view', groupLabel: 'Operations', groupColor: 'blue' },
      { to: '/rental/assets', icon: Package, label: 'Assets', requiresPermission: 'rentals.view' },
      { to: '/rental/bookings', icon: CalendarCheck2, label: 'Bookings', requiresPermission: 'rentals.view' },
      { to: '/rental/calendar', icon: CalendarDays, label: 'Availability Calendar', requiresPermission: 'rentals.view' },
      { to: '/rental/returns', icon: RotateCcw, label: 'Returns & Settlements', requiresPermission: 'rentals.view' },
      { to: '/rental/filled-registrations', icon: ClipboardList, label: 'Filled Registrations', requiresPermission: 'rentals.view' },
      { to: '/rental/reports', icon: BarChart3, label: 'Rental Report Analytics', requiresPermission: 'reports.view', groupLabel: 'Insights', groupColor: 'violet' },
      { to: '/rental/registration-forms', icon: FileSignature, label: 'Registration Forms', requiresPermission: 'rentals.manage', groupLabel: 'Configuration', groupColor: 'slate' },
      { to: '/rental/settings', icon: Settings2, label: 'Settings', requiresPermission: 'rentals.manage' },
    ],
  },
  {
    id: 'production',
    title: 'Production Management',
    icon: Factory,
    items: [
      { to: '/production', icon: Factory, label: 'Production Orders', requiresOffering: ['products', 'both'], requiresPermission: 'production.view' },
      { to: '/production/schedule', icon: Calendar, label: 'Schedule', requiresOffering: ['products', 'both'], requiresPermission: 'production.view' },
      { to: '/production/work-centers', icon: GitBranch, label: 'Work Centers & Routing', requiresOffering: ['products', 'both'], requiresPermission: 'production.view' },
      { to: '/production/mrp', icon: Layers, label: 'Material Requirements (MRP)', requiresOffering: ['products', 'both'], requiresPermission: 'production.view' },
      { to: '/production/analytics', icon: BarChart3, label: 'Analytics', requiresOffering: ['products', 'both'], requiresPermission: 'production.view' },
    ],
  },
  {
    id: 'pharma',
    title: 'Pharmaceutical Manufacturing',
    icon: Pill,
    items: [
      { to: '/pharma', icon: Pill, label: 'Overview', requiresOffering: ['products', 'both'], requiresPermission: 'pharma.view', groupLabel: 'Foundations', groupColor: 'emerald' },
      { to: '/pharma/reports', icon: BarChart3, label: 'Reporting Manager', requiresOffering: ['products', 'both'], requiresPermission: 'pharma.view' },
      { to: '/pharma/settings', icon: Settings2, label: 'Foundations', requiresOffering: ['products', 'both'], requiresPermission: 'pharma.view' },
      { to: '/pharma/batches', icon: Package, label: 'Batches', requiresOffering: ['products', 'both'], requiresPermission: 'pharma.view', groupLabel: 'Lot control', groupColor: 'blue' },
      { to: '/pharma/movements', icon: ArrowRightLeft, label: 'Lot movements', requiresOffering: ['products', 'both'], requiresPermission: 'pharma.view' },
      { to: '/pharma/fefo', icon: Layers, label: 'FEFO', requiresOffering: ['products', 'both'], requiresPermission: 'pharma.view', groupLabel: 'Quarantine', groupColor: 'amber' },
      { to: '/pharma/quarantine', icon: ShieldAlert, label: 'Quarantine', requiresOffering: ['products', 'both'], requiresPermission: 'pharma.view' },
      { to: '/pharma/mbr', icon: ClipboardList, label: 'Master Batch Record', requiresOffering: ['products', 'both'], requiresPermission: 'pharma.manage', groupLabel: 'eBMR', groupColor: 'violet' },
      { to: '/pharma/bpr', icon: FileText, label: 'Batch Production Record', requiresOffering: ['products', 'both'], requiresPermission: 'pharma.manage' },
      { to: '/pharma/qc-specs', icon: FlaskConical, label: 'QC Specs', requiresOffering: ['products', 'both'], requiresPermission: 'pharma.view', groupLabel: 'Quality', groupColor: 'teal' },
      { to: '/pharma/inspections', icon: Microscope, label: 'Inspections', requiresOffering: ['products', 'both'], requiresPermission: 'pharma.view' },
      { to: '/pharma/release', icon: ClipboardCheck, label: 'Release & CoA', requiresOffering: ['products', 'both'], requiresPermission: 'pharma.release' },
      { to: '/pharma/genealogy', icon: GitBranch, label: 'Genealogy', requiresOffering: ['products', 'both'], requiresPermission: 'pharma.view', groupLabel: 'Traceability', groupColor: 'rose' },
      { to: '/pharma/recalls', icon: AlertCircle, label: 'Recalls', requiresOffering: ['products', 'both'], requiresPermission: 'pharma.manage' },
      { to: '/pharma/deviations', icon: ShieldAlert, label: 'Deviations', requiresOffering: ['products', 'both'], requiresPermission: 'pharma.manage', groupLabel: 'QMS', groupColor: 'orange' },
      { to: '/pharma/capas', icon: ListChecks, label: 'CAPA', requiresOffering: ['products', 'both'], requiresPermission: 'pharma.manage' },
      { to: '/pharma/change-control', icon: Workflow, label: 'Change control', requiresOffering: ['products', 'both'], requiresPermission: 'pharma.manage' },
      { to: '/pharma/complaints', icon: MessageSquare, label: 'Complaints', requiresOffering: ['products', 'both'], requiresPermission: 'pharma.manage' },
      { to: '/pharma/audit', icon: History, label: 'E-sign & audit', requiresOffering: ['products', 'both'], requiresPermission: 'pharma.audit', groupLabel: 'Compliance', groupColor: 'slate' },
      { to: '/pharma/serialization', icon: QrCode, label: 'Serialization', requiresOffering: ['products', 'both'], requiresPermission: 'pharma.manage' },
      { to: '/pharma/gdp', icon: ThermometerSnowflake, label: 'GDP / cold chain', requiresOffering: ['products', 'both'], requiresPermission: 'pharma.manage', groupLabel: 'Wholesale', groupColor: 'cyan' },
      { to: '/pharma/wholesale-license', icon: FileCheck, label: 'Wholesale license', requiresOffering: ['products', 'both'], requiresPermission: 'pharma.manage' },
      { to: '/pharma/track-trace', icon: Network, label: 'Track & trace', requiresOffering: ['products', 'both'], requiresPermission: 'pharma.manage' },
    ],
  },
  {
    id: 'restaurant',
    title: 'Restaurant',
    icon: UtensilsCrossed,
    items: [
      { to: '/restaurant/floor', icon: UtensilsCrossed, label: 'Restaurant Floor', requiresOffering: ['products', 'both'], requiresPermission: 'restaurant.floor', groupLabel: 'Operations', groupColor: 'emerald' },
      { to: '/restaurant/kitchen', icon: ChefHat, label: 'Kitchen Board', requiresOffering: ['products', 'both'], requiresPermission: 'restaurant.kitchen' },
      { to: '/restaurant/menu', icon: List, label: 'Dine-in Menu', requiresOffering: ['products', 'both'], requiresPermission: 'restaurant.setup' },
      { to: '/restaurant/reservations', icon: Calendar, label: 'Reservations', requiresOffering: ['products', 'both'], requiresPermission: 'restaurant.reservations' },
      { to: '/restaurant/reports', icon: BarChart3, label: 'Restaurant Reports', requiresOffering: ['products', 'both'], requiresPermission: 'restaurant.reports' },
      { to: '/restaurant/setup', icon: Settings, label: 'Table Setup', requiresOffering: ['products', 'both'], requiresPermission: 'restaurant.setup' },
      { to: '/restaurant/outlets', icon: UtensilsCrossed, label: 'Restaurants', requiresOffering: ['products', 'both'], requiresPermission: 'restaurant.view', groupLabel: 'Setup', groupColor: 'blue' },
      { to: '/restaurant/pos', icon: Store, label: 'Restaurant POS', requiresOffering: ['products', 'both'], requiresPermission: 'pos.view' },
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
    id: 'procurement',
    title: 'Procurement Management',
    icon: Truck,
    items: [
      { to: '/purchase-orders', icon: ClipboardList, label: 'Purchase Orders', requiresPermission: 'procurement.view', groupLabel: 'Purchasing', groupColor: 'blue' },
      { to: '/procurement/requisitions', icon: FileText, label: 'Purchase Requisitions', requiresPermission: 'procurement.view' },
      { to: '/procurement/sourcing', icon: Database, label: 'Sourcing Setup', requiresPermission: 'procurement.view' },
      { to: '/procurement/configure', icon: SlidersHorizontal, label: 'Configure', requiresPermission: 'procurement.view' },
      { to: '/procurement/special', icon: FileCheck, label: 'Special Procurement', requiresPermission: 'procurement.view' },
      { to: '/procurement/vendor-invoices', icon: Banknote, label: 'Vendor Invoices (AP)', requiresPermission: 'procurement.view', groupLabel: 'Accounts Payable', groupColor: 'amber' },
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
      // ── General Accounting
      { to: '/stores', icon: Building2, label: 'Business Units', requiresPermission: 'settings.edit', requiresFinanceMode: 'advanced', groupLabel: 'General Accounting', groupColor: 'blue' },
      { to: '/finance/coa', icon: BookMarked, label: 'Chart of Accounts', requiresPermission: 'finance.view', requiresFinanceMode: 'advanced' },
      { to: '/finance/journal', icon: ScrollText, label: 'Journal Entries', requiresPermission: 'finance.view', requiresFinanceMode: 'advanced' },
      { to: '/finance/trial-balance', icon: Scale, label: 'Trial Balance', requiresPermission: 'finance.reports.view', requiresFinanceMode: 'advanced' },
      { to: '/finance/statement-versions', icon: BarChart3, label: 'Statement Versions (FSV)', requiresPermission: 'finance.coa.manage', requiresFinanceMode: 'advanced' },
      { to: '/finance/posting-controls', icon: ShieldCheck, label: 'Posting Controls', requiresPermission: 'finance.coa.manage', requiresFinanceMode: 'advanced' },
      { to: '/finance/profit-centers', icon: TrendingUp, label: 'Profit Centers & Segments', requiresPermission: 'finance.coa.manage', requiresFinanceMode: 'advanced' },
      { to: '/finance/fx-revaluation', icon: ArrowLeftRight, label: 'FX Reval & Year-End Close', requiresPermission: 'finance.coa.manage', requiresFinanceMode: 'advanced' },
      { to: '/finance/posting-rules', icon: ListChecks, label: 'Posting Rules & Number Ranges', requiresPermission: 'finance.coa.manage', requiresFinanceMode: 'advanced' },
      { to: '/finance/parallel-ledgers', icon: BookMarked, label: 'Parallel Ledgers / Multi-GAAP', requiresPermission: 'finance.coa.manage', requiresFinanceMode: 'advanced' },
      { to: '/finance/periods', icon: Lock, label: 'Posting Periods', requiresPermission: 'finance.coa.manage', requiresFinanceMode: 'advanced' },
      { to: '/finance/field-rules', icon: ListChecks, label: 'GL Field Rules', requiresPermission: 'finance.coa.manage', requiresFinanceMode: 'advanced' },
      // ── Accounts Receivable
      { to: '/finance/ar', icon: ArrowLeftRight, label: 'Accounts Receivable', requiresPermission: 'finance.ar.manage', requiresFinanceMode: 'advanced', groupLabel: 'Accounts Receivable', groupColor: 'emerald' },
      { to: '/finance/open-items', icon: ListChecks, label: 'Open-Item Clearing', requiresPermission: 'finance.ar.manage', requiresFinanceMode: 'advanced' },
      // ── Accounts Payable
      { to: '/finance/ap', icon: Banknote, label: 'Accounts Payable', requiresPermission: 'finance.ap.manage', requiresFinanceMode: 'advanced', groupLabel: 'Accounts Payable', groupColor: 'amber' },
      // ── Bank & Cash
      { to: '/finance/bank', icon: Coins, label: 'Bank & Cash', requiresPermission: 'finance.bank.manage', requiresFinanceMode: 'advanced', groupLabel: 'Bank & Cash', groupColor: 'emerald' },
      // ── Asset Accounting
      { to: '/finance/assets', icon: HardDrive, label: 'Fixed Assets', requiresPermission: 'finance.assets.manage', requiresFinanceMode: 'advanced', groupLabel: 'Asset Accounting', groupColor: 'indigo' },
      { to: '/finance/assets/reports', icon: FileBarChart, label: 'Asset Register', requiresPermission: 'finance.assets.manage', requiresFinanceMode: 'advanced' },
      { to: '/finance/assets/depreciation-schedule', icon: TrendingDown, label: 'Depreciation Schedule', requiresPermission: 'finance.assets.manage', requiresFinanceMode: 'advanced' },
      { to: '/finance/assets/gl-reconciliation', icon: Scale, label: 'GL Reconciliation', requiresPermission: 'finance.assets.manage', requiresFinanceMode: 'advanced' },
      // ── Planning & Treasury
      { to: '/finance/budgets', icon: Calculator, label: 'Budgets & Forecasts', requiresPermission: 'finance.budget.manage', requiresFinanceMode: 'advanced', groupLabel: 'Planning & Treasury', groupColor: 'violet' },
      { to: '/finance/capital', icon: Shuffle, label: 'Loans & Investments', requiresPermission: 'finance.capital.manage', requiresFinanceMode: 'advanced' },
      // ── Financial Reporting
      { to: '/finance/reports/pnl', icon: LineChart, label: 'P&L Statement', requiresPermission: 'finance.reports.view', requiresFinanceMode: 'advanced', groupLabel: 'Financial Reporting', groupColor: 'rose' },
      { to: '/finance/reports/balance-sheet', icon: FilePieChart, label: 'Balance Sheet', requiresPermission: 'finance.reports.view', requiresFinanceMode: 'advanced' },
      { to: '/finance/reports/cash-flow', icon: TrendingUp, label: 'Cash Flow', requiresPermission: 'finance.reports.view', requiresFinanceMode: 'advanced' },
      { to: '/finance/reports/cost-analysis', icon: BarChart3, label: 'Cost Analysis', requiresPermission: 'finance.reports.view', requiresFinanceMode: 'advanced' },
      { to: '/finance/reports/gl', icon: BookOpen, label: 'GL Line Item Report', requiresPermission: 'finance.reports.view', requiresFinanceMode: 'advanced' },
      { to: '/reports', icon: LayoutDashboard, label: 'Reports', requiresPermission: 'reports.view' },
      // ── Governance
      { to: '/finance/approvals', icon: ClipboardCheck, label: 'Approvals', requiresPermission: 'finance.controls.approve', requiresFinanceMode: 'advanced', groupLabel: 'Governance', groupColor: 'blue' },
      { to: '/finance/audit', icon: ShieldCheck, label: 'Audit Log', requiresPermission: 'finance.audit.view', requiresFinanceMode: 'advanced' },
      { to: '/finance/tax', icon: CircleDollarSign, label: 'Tax Returns', requiresPermission: 'finance.tax.manage', requiresFinanceMode: 'advanced' },
    ],
  },
  {
    id: 'controlling',
    title: 'Controlling Management',
    icon: Gauge,
    items: [
      { to: '/controlling', icon: Gauge, label: 'CO Dashboard', requiresPermission: 'controlling.view' },
      // ── Organization
      { to: '/controlling/controlling-areas',        icon: Building2,     label: 'Controlling Areas',           requiresPermission: 'controlling.costcenter.manage', groupLabel: 'Organization', groupColor: 'indigo' },
      // ── Integration
      { to: '/controlling/finance-integration',      icon: Landmark,      label: 'Finance Integration',        requiresPermission: 'controlling.view', groupLabel: 'Integration', groupColor: 'violet' },
      // ── Cost Centres
      { to: '/controlling/cost-centers',             icon: Layers,        label: 'Cost Centers',               requiresPermission: 'controlling.costcenter.manage', groupLabel: 'Cost Centres', groupColor: 'blue' },
      { to: '/controlling/activity-types',           icon: Activity,      label: 'Activity Types',             requiresPermission: 'controlling.costcenter.manage' },
      // ── Cost Planning
      { to: '/controlling/product-costs',            icon: Boxes,         label: 'Product Cost Planning',      requiresPermission: 'controlling.view', groupLabel: 'Cost Planning', groupColor: 'blue' },
      { to: '/controlling/routing',                  icon: GitBranch,     label: 'Work Centres & Routing',     requiresPermission: 'controlling.view' },
      { to: '/controlling/setup',                    icon: Percent,       label: 'Overhead Setup',             requiresPermission: 'controlling.costcenter.manage' },
      // ── Production Orders
      { to: '/controlling/orders',                   icon: Factory,       label: 'All Orders',                 requiresPermission: 'controlling.view', groupLabel: 'Production Orders',     groupColor: 'amber' },
      { to: '/controlling/orders?kind=assembly',     icon: Workflow,      label: 'Assembly Orders',            requiresPermission: 'controlling.view' },
      { to: '/controlling/orders?kind=process',      icon: ArrowLeftRight,label: 'Process Orders',             requiresPermission: 'controlling.view' },
      { to: '/controlling/internal-orders',          icon: Boxes,         label: 'Internal & Project Orders',  requiresPermission: 'controlling.view', labelSize: 'text-sm' },
      // ── Production Execution
      { to: '/controlling/production-process',       icon: TrendingUp,    label: 'Production Process',         requiresPermission: 'controlling.view', groupLabel: 'Production Execution',  groupColor: 'emerald' },
      { to: '/controlling/goods-movements',          icon: Package,       label: 'Goods Movements',            requiresPermission: 'controlling.view' },
      { to: '/controlling/activity-confirmations',   icon: Clock,         label: 'Activity Confirmations',     requiresPermission: 'controlling.view', labelSize: 'text-sm' },
      { to: '/controlling/cost-bookings',            icon: Receipt,       label: 'Cost Bookings',              requiresPermission: 'controlling.view' },
      // ── Analysis & Reporting
      { to: '/controlling/wip',                      icon: ClipboardList, label: 'WIP Report',                 requiresPermission: 'controlling.variance.view', groupLabel: 'Analysis & Reporting', groupColor: 'indigo' },
      { to: '/controlling/variance-analysis',        icon: BarChart3,     label: 'Variance Analysis',          requiresPermission: 'controlling.variance.view' },
      { to: '/controlling/internal-cost',            icon: BookOpen,      label: 'Internal Cost Mgmt',         requiresPermission: 'controlling.variance.view' },
      // ── Period End
      { to: '/controlling/cost-allocations',         icon: GitBranch,     label: 'Cost Allocations',           requiresPermission: 'controlling.period_close', groupLabel: 'Period End',            groupColor: 'rose' },
      { to: '/controlling/period-end',               icon: Calendar,      label: 'Period-End Closing',         requiresPermission: 'controlling.period_close' },
    ],
  },
  {
    id: 'hr',
    title: 'HR Management',
    icon: Briefcase,
    items: [
      { to: '/hr/employees', icon: UserCog, label: 'Employees', requiresPermission: 'hr.view' },
      { to: '/hr/attendance', icon: Clock, label: 'Attendance', requiresPermission: 'hr.view' },
      { to: '/hr/tracking', icon: MapPin, label: 'Field Tracking', requiresPermission: 'hr.attendance' },
      { to: '/hr/leaves', icon: Plane, label: 'Leave Requests', requiresPermission: 'hr.view' },
      { to: '/hr/recruitment', icon: Briefcase, label: 'Recruitment', requiresPermission: 'hr.recruitment' },
      { to: '/hr/onboarding', icon: UserCheck, label: 'Onboarding', requiresPermission: 'hr.onboarding' },
      { to: '/hr/performance', icon: Target, label: 'Performance', requiresPermission: 'hr.performance' },
      { to: '/hr/training', icon: GraduationCap, label: 'Training', requiresPermission: 'hr.training' },
      { to: '/hr/compliance', icon: ShieldAlert, label: 'Compliance', requiresPermission: 'hr.compliance' },
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
    icon: Settings2,
    items: [
      { to: '/document-templates', icon: LayoutTemplate, label: 'Document Templates', requiresPermission: 'documents.templates.manage' },
      { to: '/system/modules', icon: Layers, label: 'Module Settings', requiresPermission: 'system.modules' },
      { to: '/crm/integrations', icon: Plug, label: 'Integrations', requiresPermission: 'crm.integrations.manage' },
      { to: '/system/messages', icon: MessageSquare, label: 'Create Messages', requiresPermission: 'settings.edit' },
      { to: '/system/models', icon: Database, label: 'Models', requiresVendorAdmin: true, groupLabel: 'Database', groupColor: 'indigo' },
      { to: '/system/table-data', icon: Table2, label: 'Table Data', requiresVendorAdmin: true },
      { to: '/system/browse-table', icon: List, label: 'Browse Table', requiresVendorAdmin: true },
      { to: '/team', icon: UsersRound, label: 'Staff Access Control', requiresPermission: 'team.view', groupLabel: 'Access Control', groupColor: 'emerald' },
      { to: '/roles', icon: ShieldCheck, label: 'Roles', requiresPermission: 'roles.view' },
      { to: '/system/upi-checkout', icon: QrCode, label: 'UPI Checkout', alwaysShow: true },
      { to: '/system/assets/images', icon: Image, label: 'Images', alwaysShow: true, groupLabel: 'Gallery', groupColor: 'violet' },
    ],
  },
]

const DEFAULT_SECTION_IDS = CANONICAL_SIDEBAR_SECTION_IDS.slice() as string[]

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
    transition: isDragging ? transition : undefined,
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
          'flex w-full items-center gap-0 rounded-md transition-[box-shadow] duration-100',
          NAV_ROW_MIN_H,
          outlineDropTarget &&
            'ring-2 ring-sidebar-primary ring-offset-2 ring-offset-sidebar shadow-sm',
        )}
      >
        {children(listeners, attributes)}
      </div>
    </div>
  )
}

/** Active leaf — theme cap on outer row corner (see .sidebar-nav-link-active). */
const navLinkActive =
  'sidebar-nav-link-active font-medium text-foreground ring-0'
const navLinkInactive =
  'font-normal text-sidebar-foreground rounded-lg hover:bg-sidebar-accent hover:text-sidebar-accent-foreground dark:hover:bg-muted/35 dark:hover:text-foreground active:opacity-90'

/** Icon-rail flyout menu items — dedicated styles (not sidebar tree cap). */
const RAIL_FLYOUT_ITEM =
  'sidebar-nav-rail-flyout-item flex w-full min-w-0 items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/45'
const RAIL_FLYOUT_ITEM_ACTIVE = 'sidebar-nav-rail-flyout-item-active font-medium text-foreground'
const RAIL_FLYOUT_ITEM_IDLE = 'font-normal text-foreground'
const RAIL_FLYOUT_ITEM_FOCUS = 'sidebar-nav-rail-flyout-item-focus'
const RAIL_FLYOUT_ICON_ACTIVE = 'sidebar-nav-rail-flyout-icon-active'

/** Icon-rail flyout height estimate — must include header, footer, and list padding for viewport clamping. */
function estimateRailFlyoutHeight(itemCount: number, groupCount: number): number {
  const headerPx = 52
  const footerPx = 44
  const listPadPx = 12
  const rowPx = 40
  const groupHeaderPx = 28
  const natural = headerPx + footerPx + listPadPx + itemCount * rowPx + groupCount * groupHeaderPx
  const viewportCap = Math.max(220, window.innerHeight - 16)
  const designCap = 32 * 16
  return Math.min(natural, viewportCap, designCap)
}

const navRowTransition = 'transition-[color,opacity] duration-75 ease-out motion-reduce:transition-none'
const navSubRowTransition = 'transition-[color,opacity] duration-75 ease-out motion-reduce:transition-none'
const navExpandTransition =
  'transition-[grid-template-rows] duration-200 ease-[cubic-bezier(0.33,1,0.68,1)] motion-reduce:transition-none'

/** Sidebar horizontal rhythm: icon column + label column align across section headers, items, logout. */
const NAV_ICON_COL = 'flex h-6 w-6 shrink-0 items-center justify-center'
/** Icon-only rail — 25% larger than prior h-9 / h-4 (36px / 16px). */
const RAIL_ICON_BTN_CLASS = 'flex h-[2.8125rem] w-[2.8125rem] items-center justify-center rounded-lg'
const RAIL_ICON_CLASS = 'h-5 w-5'
const NAV_DRAG_COL = 'flex h-7 w-5 shrink-0 items-center justify-center'
/** Nav row vertical rhythm — slim but enough height for crisp labels */
const NAV_ROW_PAD_Y = 'py-0.5'
const NAV_ROW_MIN_H = 'min-h-[1.375rem]'
const NAV_GROUP_ROW_MIN_H = 'min-h-[0.9375rem]'
/** Sidebar label weights — ~40% lighter than prior bold/semibold/medium */
const NAV_FONT_BRAND = 'font-semibold'
const NAV_FONT_SECTION_ACTIVE = 'font-medium'
const NAV_FONT_SECTION = 'font-normal'
const NAV_FONT_GROUP = 'font-medium'
const NAV_FONT_TAB = 'font-medium'
/** Section row fills — light tint on the full row */
const NAV_SECTION_BG_ACTIVE = 'bg-muted/25'
const NAV_SECTION_BG_ACTIVE_COLLAPSED = 'sidebar-nav-section-active-collapsed'
const NAV_SECTION_BG_HOVER = 'hover:bg-muted/22 dark:hover:bg-muted/30'
/** Module icon tiles — theme hover lift via .sidebar-nav-icon-tile (globals.css). */
const NAV_SECTION_ICON_BG = 'sidebar-nav-icon-tile'
const NAV_SECTION_ICON_BG_ACTIVE = 'sidebar-nav-icon-tile-active'
/** Keyboard focus — CSS classes (see globals.css); no border-l on rounded rows */
const navSectionKbFocus = 'sidebar-nav-kb-focus-section'
const navGroupKbFocus = 'bg-muted/25 text-foreground'
const navLinkKbFocus = 'sidebar-nav-kb-focus'
const navLinkKbFocusActive = 'sidebar-nav-kb-focus-active'
const navRailKbFocus = 'ring-2 ring-inset ring-sidebar-primary/30'

/**
 * Nested nav tree — mint rail + elbows; whole-pixel strokes (crisp when zoomed out).
 * Trunk x from panel left = 30px (see SortableSectionShell layout).
 */
const NAV_TREE_PANEL_CLASS = '[--tree-x:1.875rem] [--tree-link-gap:0.5rem]'
/** Indented rail for nested group children (Cost Planning, Production Orders, …). */
const NAV_TREE_SUB_PANEL_CLASS = '[--tree-sub-x:2.75rem]'
/** Template 2 — compact merged submodule list (tight pill stack). */
const NAV_SUB_STACK = 'sidebar-nav-sub-stack'
const navTreeTrunkLine =
  'sidebar-nav-tree-trunk pointer-events-none absolute left-[calc(var(--tree-x)-0.5px)] top-0 bottom-2 z-0 w-px bg-sidebar-primary'
/** Short trunk scoped to a subgroup block only (not the whole module). */
const navTreeSubgroupTrunk =
  'sidebar-nav-tree-trunk pointer-events-none absolute left-[calc(var(--tree-sub-x)-0.5px)] top-0 bottom-0 z-0 w-px bg-sidebar-primary'
/** Rounded elbow from vertical trunk toward each row (see .sidebar-nav-tree-elbow). */
const navTreeElbowBase =
  'sidebar-nav-tree-elbow pointer-events-none absolute top-1/2 z-[1] -translate-y-full'
const navTreeElbowLine = cn(navTreeElbowBase, 'sidebar-nav-tree-elbow-section')
const navTreeSubElbowLine = cn(navTreeElbowBase, 'sidebar-nav-tree-elbow-sub')
/** Shared layout + state classes for sidebar leaf links. */
function navItemLinkClass(
  item: NavItem,
  opts: { isActive: boolean; isKbFocused: boolean; tree: 'section' | 'sub' },
) {
  const { isActive, isKbFocused, tree } = opts
  const isHighlighted = isActive || isKbFocused
  const isSubTree = tree === 'sub'
  /** Submodule rows — same rounded-lg shape as main module headers. */
  const subRowShape = cn('min-h-[1.625rem] rounded-lg py-1 pl-3.5 pr-3', NAV_ROW_PAD_Y)

  return cn(
    'relative z-[1] group/nav flex min-w-0 flex-1 items-center gap-1.5 outline-none focus-visible:outline-none',
    isSubTree
      ? cn(subRowShape, isHighlighted && 'relative z-[2]')
      : isHighlighted
        ? cn('relative z-[2] min-h-[1.75rem] rounded-lg py-1 pl-3.5 pr-3', NAV_ROW_PAD_Y)
        : cn('rounded-lg pl-2.5 pr-2.5', NAV_ROW_MIN_H, NAV_ROW_PAD_Y),
    tree === 'sub'
      ? 'ml-[calc(var(--tree-sub-x)+var(--tree-link-gap)-1.25rem)]'
      : 'ml-[calc(var(--tree-x)+var(--tree-link-gap)-1.25rem)]',
    item.labelSize ?? 'text-sm',
    'leading-snug',
    isSubTree ? navSubRowTransition : navRowTransition,
    isActive
      ? cn(navLinkActive, isKbFocused && navLinkKbFocusActive)
      : isKbFocused
        ? cn(navLinkInactive, navLinkKbFocus)
        : navLinkInactive,
  )
}

type NavItemBlock<T extends { to: string }> =
  | { kind: 'items'; entries: { item: T; idx: number }[] }
  | { kind: 'group'; label: string; grpKey: string; entries: { item: T; idx: number }[] }

function buildNavItemBlocks<T extends { to: string }>(
  items: T[],
  groups: (string | null)[],
  sectionTitle: string,
): NavItemBlock<T>[] {
  const blocks: NavItemBlock<T>[] = []
  let i = 0
  while (i < items.length) {
    if (!groups[i]) {
      const entries: { item: T; idx: number }[] = []
      while (i < items.length && !groups[i]) {
        entries.push({ item: items[i], idx: i })
        i++
      }
      blocks.push({ kind: 'items', entries })
      continue
    }
    const label = groups[i]!
    const entries: { item: T; idx: number }[] = []
    while (i < items.length && groups[i] === label) {
      entries.push({ item: items[i], idx: i })
      i++
    }
    blocks.push({ kind: 'group', label, grpKey: `${sectionTitle}:${label}`, entries })
  }
  return blocks
}

const pageTitles: Record<string, string> = {
  '/': 'Dashboard — Analytics',
  '/orders': 'Orders',
  '/quotations': 'Quotations',
  '/quotations/templates': 'Quotation Templates',
  '/products': 'Products',
  '/products/new': 'New Product',
  '/services': 'Services',
  '/services/new': 'New Service',
  '/categories': 'Categories',
  '/product-groups': 'Product Groups',
  '/product-groups/:id': 'Group Detail',
  '/purchase-orders': 'Purchase Orders',
  '/procurement/requisitions': 'Purchase Requisitions',
  '/procurement/sourcing': 'Sourcing Setup',
  '/procurement/vendor-invoices': 'Vendor Invoices (AP)',
  '/procurement/goods': 'Goods Management',
  '/inventory/material-valuation': 'Material Valuation',
  '/procurement/special': 'Special Procurement',
  '/procurement/configure': 'Configure',
  '/production': 'Production Orders',
  '/production/schedule': 'Production Schedule',
  '/production/work-centers': 'Work Centers & Routing',
  '/production/mrp': 'Material Requirements (MRP)',
  '/production/analytics': 'Production Analytics',
  '/inventory': 'Inventory',
  '/inventory/settings': 'Inventory Config',
  '/plants': 'Plants',
  '/storage-locations': 'Storage Locations',
  '/pos': 'Point of Sale',
  '/restaurant/outlets': 'Restaurants',
  '/restaurant/floor': 'Restaurant Floor',
  '/restaurant/pos': 'Restaurant POS',
  '/restaurant/kitchen': 'Kitchen Board',
  '/restaurant/setup': 'Restaurant Setup',
  '/restaurant/menu': 'Dine-in Menu',
  '/restaurant/reservations': 'Reservations',
  '/restaurant/reports': 'Restaurant Reports',
  '/relationship-manager': 'Relationship Manager',
  '/settings/support-activity': 'Support audit',
  '/subscriptions': 'Subscriptions Catalog',
  '/marketplace': 'Marketplace Leads',
  '/rental': 'Rental Management',
  '/rental/dashboard': 'Overview',
  '/rental/assets': 'Assets',
  '/rental/bookings': 'Bookings',
  '/rental/calendar': 'Availability Calendar',
  '/rental/returns': 'Returns & Settlements',
  '/rental/filled-registrations': 'Filled Registrations',
  '/rental/reports': 'Rental Report Analytics',
  '/rental/registration-forms': 'Registration Forms',
  '/rental/settings': 'Rental Settings',
  '/invoices': 'Invoices',
  '/memos': 'Credit & Debit Memos',
  '/coupons': 'Coupons',
  '/bookings': 'Bookings',
  '/projects': 'Projects',
  '/notifications': 'Notifications',
  '/master-data': 'Master Data — Customers / Suppliers',
  '/reviews': 'Reviews',
  '/reports': 'Reports',
  '/storefront-builder': 'Business Website Builder',
  '/document-templates': 'Document Templates',
  '/invoices/templates': 'Invoice Templates',
  '/purchase-orders/templates': 'PO Templates',
  '/websites': 'Business Website Builder',
  '/websites/seo': 'SEO Management',
  '/websites/analytics': 'Website Analytics',
  '/websites/templates': 'Business Website Templates',
  '/blog': 'Blog Manager',
  '/finance/basic': 'Finance',
  '/finance/assets': 'Fixed Assets',
  '/finance/assets/reports': 'Asset Register',
  '/finance/assets/depreciation-schedule': 'Depreciation Schedule',
  '/finance/assets/gl-reconciliation': 'GL Reconciliation',
  '/stores': 'Business Units',
  '/team': 'Staff Access Control',

  '/roles': 'Roles',
  '/plans': 'Plans & Billing',
  '/settings': 'Settings',
  '/system/modules': 'Module Settings',
  '/system/models': 'Models',
  '/system/table-data': 'Table Data',
  '/system/browse-table': 'Browse Table',
  '/system/storefront-display': 'Business Front Display',
  '/system/social-links': 'Social & Web Links',
  '/system/upi-checkout': 'UPI Checkout',
  '/system/assets': 'Gallery',
  '/system/assets/images': 'Images',

  '/sales/coverage': 'Store Coverage',
  '/sales/sales-area': 'Sales Area',
  '/sales/plans': 'Pricing Plans',
  '/sales/properties': 'Property Listings',
  '/sales/courses': 'Course Catalog',
  '/sales/fitness-classes': 'Fitness Schedule',
  '/sales/vehicles': 'Vehicle Inventory',
  '/sales/events': 'Ticketed Events',
  '/sales/recurring-bookings': 'Recurring Bookings',
  '/sales/testimonials': 'Testimonials',
  '/sales/booking-wizard': 'Booking Wizard',
  '/sales/booking-resources': 'Resources',
  '/crm': 'CRM Dashboard',
  '/crm/contacts': 'Contacts',
  '/crm/leads': 'Leads',
  '/crm/number-ranges': 'Number Ranges',
  '/crm/pipeline': 'Sales Pipeline',
  '/crm/activities': 'Tasks',
  '/crm/inbox': 'Inbox',
  '/queries': 'Queries',
  '/crm/tickets': 'Support Tickets',
  '/crm/kb': 'Knowledge Base',
  '/crm/segments': 'Segments',
  '/crm/templates': 'Email Templates',
  '/crm/campaigns': 'Marketing Campaigns',
  '/crm/care-reminder': 'Care & Reminders',
  '/crm/sales-area-dues': 'Sales Area Dues',
  '/crm/payment-followups': 'Payment Follow-ups',
  '/crm/credit-control': 'Credit Control',
  '/crm/workflows': 'Workflow Automation',
  '/crm/ai': 'AI Insights',
  '/crm/integrations': 'Integrations',
  '/crm/reports': 'CRM Reports',
  '/crm/audit': 'Audit Log',

  '/controlling': 'Controlling (CO) Dashboard',
  '/controlling/controlling-areas': 'Controlling Areas',
  '/controlling/cost-centers': 'Cost Centers',
  '/controlling/activity-types': 'Activity Types',
  '/controlling/product-costs': 'Product Cost Planning',
  '/controlling/routing': 'Work Centres & Routing',
  '/controlling/orders': 'Manufacturing & Project Orders',
  '/controlling/setup': 'Overhead Setup',
  '/controlling/wip': 'WIP Report',
  '/controlling/internal-orders': 'Internal & Project Orders',
  '/controlling/goods-movements': 'Goods Movements',
  '/controlling/activity-confirmations': 'Activity Confirmations',
  '/controlling/cost-bookings': 'Cost Bookings',
  '/controlling/variance-analysis': 'Variance Analysis',
  '/controlling/internal-cost': 'Internal Cost Management',
  '/controlling/cost-allocations': 'Cost Allocations',
  '/controlling/period-end': 'Period-End Closing',
  '/controlling/finance-integration': 'Finance Integration',
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

// ── Restaurant scope banner ────────────────────────────────────────────────

function RestaurantScopeBanner() {
  const location = useLocation()
  const { selectedRestaurant, setSelectedRestaurant } = useRestaurantStore()
  const isRestaurantPage = location.pathname.startsWith('/restaurant/') && location.pathname !== '/restaurant/outlets'
  const { data } = useQuery({
    queryKey: ['restaurants'],
    queryFn: () => import('@/api/vendor').then(m => m.vendorApi.listRestaurants()),
    enabled: isRestaurantPage,
    staleTime: 30_000,
  })
  const restaurants = data?.items ?? []

  const outletOptions = useMemo(
    () => [
      { value: '', label: 'All restaurants', hint: 'Business unit scope — no outlet filter' },
      ...restaurants.map(r => ({ value: r.id, label: r.name })),
    ],
    [restaurants],
  )

  // Keep selected outlet in sync when list refetches (e.g. after Setup saves timer settings)
  useEffect(() => {
    if (!selectedRestaurant?.id || !restaurants.length) return
    const fresh = restaurants.find(r => r.id === selectedRestaurant.id)
    if (fresh && fresh.updated_at !== selectedRestaurant.updated_at) {
      setSelectedRestaurant(fresh)
    }
  }, [restaurants, selectedRestaurant?.id, selectedRestaurant?.updated_at, setSelectedRestaurant])

  if (!isRestaurantPage || restaurants.length === 0) return null

  const isFiltered = !!selectedRestaurant

  return (
    <div
      role="region"
      aria-label="Restaurant outlet scope"
      className={cn(
        'mb-4 flex items-center gap-2.5 rounded-xl border px-3 py-2 sm:gap-3 sm:px-4 sm:py-2.5',
        isFiltered
          ? 'border-primary/30 bg-primary/[0.07] shadow-sm shadow-primary/5'
          : 'border-border/70 bg-muted/30',
      )}
    >
      <span
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
          isFiltered
            ? 'bg-primary/15 text-primary'
            : 'bg-background text-muted-foreground ring-1 ring-border/60',
        )}
        aria-hidden
      >
        <UtensilsCrossed className="h-4 w-4" />
      </span>

      <span className="hidden shrink-0 text-sm font-medium text-muted-foreground sm:inline">
        Restaurant
      </span>

      <Select
        value={selectedRestaurant?.id ?? ''}
        onChange={id => {
          const r = restaurants.find(x => x.id === id)
          setSelectedRestaurant(r ?? null)
        }}
        options={outletOptions}
        placeholder="All restaurants"
        aria-label="Select restaurant outlet"
        wrapperClassName="min-w-0 flex-1"
        triggerClassName={cn(
          'h-9 min-h-9 border-0 bg-transparent px-1 shadow-none hover:bg-muted/40 rounded-md',
          'font-semibold text-foreground focus-visible:ring-2 focus-visible:ring-ring/50',
          isFiltered && 'text-primary',
        )}
      />

      {isFiltered ? (
        <button
          type="button"
          onClick={() => setSelectedRestaurant(null)}
          aria-label="Clear restaurant filter — show all outlets"
          title="Show all restaurants"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      ) : null}
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DashboardLayout() {
  const logout = useLogout()
  const { user, accessToken } = useAuthStore()
  const sessionReady = Boolean(accessToken)
  const { vendor, selectedStore, setSelectedStore, favouriteStoreId, setFavouriteStoreId, setVendor, clearVendor } = useVendorStore()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  /** Hide chrome edge controls while a full-screen modal overlay is open. */
  const kiterpModalOpen = useKiterpModalOpen()
  /** Desktop sidebar layout (persisted in this browser). */
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>(loadSidebarMode)
  /** Expanded sidebar width (desktop); persisted per browser. */
  const [sidebarWidthPx, setSidebarWidthPx] = useState(loadSidebarWidthPx)
  const [isSidebarResizing, setIsSidebarResizing] = useState(false)
  const isSidebarResizingRef = useRef(false)
  const sidebarResizeRafRef = useRef(0)
  const sidebarWidthPxRef = useRef(sidebarWidthPx)
  const lastExpandedSidebarWidthPxRef = useRef(
    sidebarWidthPx > SIDEBAR_ICON_ONLY_MAX_PX ? sidebarWidthPx : SIDEBAR_WIDTH_DEFAULT_PX,
  )
  /** Section id for floating submenu when sidebar is in icon-rail mode. */
  const [railFlyoutSectionId, setRailFlyoutSectionId] = useState<string | null>(null)
  /** Icon under the pointer — suppresses route highlight so only one rail tile reads as selected. */
  const [railHoverSectionId, setRailHoverSectionId] = useState<string | null>(null)
  const [railFlyoutTop, setRailFlyoutTop] = useState(56)
  const railFlyoutRef = useRef<HTMLDivElement>(null)
  const railSectionButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  /** Desktop: narrow width → icons only + flyout submenus (same as icon-rail mode). */
  const showIconOnlyNav =
    sidebarMode !== 'hidden' && sidebarWidthPx <= SIDEBAR_ICON_ONLY_MAX_PX
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
  const storePickerRef = useRef<HTMLDivElement>(null)
  const storePickerMenuRef = useRef<HTMLDivElement>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [kitThemePickerOpen, setKitThemePickerOpen] = useState(false)
  const [appsPickerOpen, setAppsPickerOpen] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const profilePanelRef = useRef<HTMLDivElement>(null)
  const navScrollRef = useRef<HTMLElement>(null)
  const sectionScrollAnchors = useRef<Map<string, HTMLDivElement>>(new Map())
  const pendingScrollSectionId = useRef<string | null>(null)
  /** After keyboard collapse, keep focus on the module row without scrollIntoView jump. */
  const skipNavFocusScrollRef = useRef(false)
  /** Arrow-key focus target in the sidebar module tree */
  const [navFocusKey, setNavFocusKey] = useState<string | null>(null)
  const navFocusRefs = useRef(new Map<string, HTMLElement>())

  const dark = useThemeStore(s => s.dark)
  const toggleDark = useThemeStore(s => s.toggleDark)
  const colorTheme = useThemeStore(s => s.colorTheme)
  const layoutTemplate = useThemeStore(s => s.layoutTemplate)
  const isTemplate2 = layoutTemplate === 'template2'
  const activeKitTheme = getKitErpThemeOption(colorTheme)

  const { data: storesData, refetch: refetchStores } = useStores()
  const stores = [...(storesData?.stores ?? [])].sort((a, b) => {
    const an = parseInt(a.code ?? '', 10)
    const bn = parseInt(b.code ?? '', 10)
    if (!isNaN(an) && !isNaN(bn)) return an - bn
    if (!isNaN(an)) return -1
    if (!isNaN(bn)) return 1
    return (a.code ?? '').localeCompare(b.code ?? '')
  })
  /** "All business units" only when there are multiple outlets to filter between. */
  const showAllLocationsOption = stores.length > 1

  // Auto-select favourite store on login when no store is currently selected
  useEffect(() => {
    if (!favouriteStoreId || selectedStore || stores.length === 0) return
    const fav = stores.find(s => s.id === favouriteStoreId)
    if (fav) setSelectedStore({ id: fav.id, name: fav.name, code: fav.code, description: fav.description })
  }, [favouriteStoreId, stores.length])

  const setStoreDefaultMutation = useMutation({
    mutationFn: (id: string) => vendorApi.updateStore(id, { is_default: true }),
    onSuccess: () => { void refetchStores() },
  })

  const toggleStoreOpenMutation = useMutation({
    mutationFn: ({ id, is_open }: { id: string; is_open: boolean }) =>
      vendorApi.updateStore(id, { is_open }),
    onSuccess: () => { void refetchStores() },
  })

  const openStorePicker = () => {
    setStorePickerOpen((v) => {
      const next = !v
      if (next) void refetchStores()
      return next
    })
  }

  const storePickerPos = useViewportAnchoredPanel(storePickerOpen, storePickerRef, { panelWidth: 320 })
  const profilePanelPos = useViewportAnchoredPanel(profileOpen, profileMenuRef, { panelWidth: 288 })

  const activeStoreFromApi = selectedStore ? stores.find((s) => s.id === selectedStore.id) : undefined
  /** Single-store tenants: treat the sole outlet as the active context even before persisted selection updates. */
  const rowForHeader =
    activeStoreFromApi ?? (stores.length === 1 ? stores[0] : undefined)
  const allBusinessUnitsMode = showAllLocationsOption && !selectedStore
  const storeHeaderName =
    rowForHeader?.name ??
    selectedStore?.name ??
    (allBusinessUnitsMode ? 'All business units' : vendor?.display_name ?? BUSINESS_UNIT_STORE_LABEL)
  const storeHeaderSubtitle = rowForHeader
    ? rowForHeader.description || rowForHeader.code || BUSINESS_UNIT_STORE_LABEL
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
    if (!storePickerOpen) return
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target
      if (!(t instanceof Node)) return
      if (storePickerRef.current?.contains(t) || storePickerMenuRef.current?.contains(t)) return
      setStorePickerOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [storePickerOpen])

  useEffect(() => {
    if (!profileOpen) return
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target
      if (!(t instanceof Node)) return
      if (profileMenuRef.current?.contains(t) || profilePanelRef.current?.contains(t)) return
      setProfileOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [profileOpen])

  useEffect(() => {
    try {
      localStorage.setItem(LS_SIDEBAR_MODE, sidebarMode)
    } catch {
      /* ignore quota / private mode */
    }
  }, [sidebarMode])

  useLayoutEffect(() => {
    sidebarWidthPxRef.current = sidebarWidthPx
  }, [sidebarWidthPx])

  const persistSidebarWidth = useCallback((w: number) => {
    try {
      localStorage.setItem(LS_SIDEBAR_WIDTH, String(w))
    } catch {
      /* ignore */
    }
  }, [])

  const setSidebarWidthClamped = useCallback((w: number, opts?: { syncModeLive?: boolean }) => {
    const next = clampSidebarWidthPx(w)
    sidebarWidthPxRef.current = next
    if (next > SIDEBAR_ICON_ONLY_MAX_PX) {
      lastExpandedSidebarWidthPxRef.current = next
    }
    setSidebarWidthPx(next)
    if (opts?.syncModeLive && isSidebarResizingRef.current) {
      setSidebarMode((m) => {
        if (m === 'hidden') return m
        if (next >= SIDEBAR_ICON_ONLY_EXIT_PX) return 'expanded'
        if (next <= SIDEBAR_ICON_ONLY_ENTER_PX) return 'rail'
        return m
      })
    }
    return next
  }, [])

  const syncSidebarModeToWidth = useCallback(
    (w: number) => {
      setSidebarMode((m) => {
        if (m === 'hidden') return m
        if (m === 'rail') {
          return w >= SIDEBAR_ICON_ONLY_EXIT_PX ? 'expanded' : 'rail'
        }
        return w <= SIDEBAR_ICON_ONLY_ENTER_PX ? 'rail' : 'expanded'
      })
      if (w <= SIDEBAR_ICON_ONLY_ENTER_PX) {
        setSidebarWidthClamped(SIDEBAR_RAIL_WIDTH_PX)
      }
    },
    [setSidebarWidthClamped],
  )

  const resetSidebarWidth = useCallback(() => {
    const next = setSidebarWidthClamped(SIDEBAR_WIDTH_DEFAULT_PX)
    syncSidebarModeToWidth(next)
    persistSidebarWidth(next)
  }, [persistSidebarWidth, setSidebarWidthClamped, syncSidebarModeToWidth])

  const startSidebarResize = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (sidebarMode === 'hidden') return
      e.preventDefault()
      e.stopPropagation()
      const startX = e.clientX
      const startW = sidebarWidthPxRef.current
      const handle = e.currentTarget
      setIsSidebarResizing(true)
      isSidebarResizingRef.current = true
      setRailFlyoutSectionId(null)
      handle.setPointerCapture(e.pointerId)

      const onMove = (ev: PointerEvent) => {
        const targetW = startW + (ev.clientX - startX)
        cancelAnimationFrame(sidebarResizeRafRef.current)
        sidebarResizeRafRef.current = requestAnimationFrame(() => {
          setSidebarWidthClamped(targetW, { syncModeLive: true })
        })
      }
      const onEnd = (ev: PointerEvent) => {
        cancelAnimationFrame(sidebarResizeRafRef.current)
        setIsSidebarResizing(false)
        isSidebarResizingRef.current = false
        if (handle.hasPointerCapture(ev.pointerId)) {
          handle.releasePointerCapture(ev.pointerId)
        }
        handle.removeEventListener('pointermove', onMove)
        handle.removeEventListener('pointerup', onEnd)
        handle.removeEventListener('pointercancel', onEnd)
        const w = sidebarWidthPxRef.current
        syncSidebarModeToWidth(w)
        persistSidebarWidth(sidebarWidthPxRef.current)
      }
      handle.addEventListener('pointermove', onMove)
      handle.addEventListener('pointerup', onEnd)
      handle.addEventListener('pointercancel', onEnd)
    },
    [persistSidebarWidth, setSidebarWidthClamped, sidebarMode, syncSidebarModeToWidth],
  )

  const onSidebarResizeKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (sidebarMode === 'hidden') return
      let delta = 0
      if (e.key === 'ArrowRight') delta = SIDEBAR_WIDTH_STEP_PX
      else if (e.key === 'ArrowLeft') delta = -SIDEBAR_WIDTH_STEP_PX
      else if (e.key === 'Home') {
        e.preventDefault()
        resetSidebarWidth()
        return
      } else return
      e.preventDefault()
      const next = setSidebarWidthClamped(sidebarWidthPxRef.current + delta)
      syncSidebarModeToWidth(next)
      persistSidebarWidth(next)
    },
    [persistSidebarWidth, resetSidebarWidth, setSidebarWidthClamped, sidebarMode, syncSidebarModeToWidth],
  )

  useEffect(() => {
    if (isSidebarResizingRef.current) return
    if (sidebarMode !== 'rail' || sidebarWidthPx === SIDEBAR_RAIL_WIDTH_PX) return
    if (sidebarWidthPx > SIDEBAR_ICON_ONLY_MAX_PX) {
      setSidebarMode('expanded')
      return
    }
    setSidebarWidthClamped(SIDEBAR_RAIL_WIDTH_PX)
  }, [sidebarMode, sidebarWidthPx, setSidebarWidthClamped])

  useEffect(() => {
    setRailFlyoutSectionId(null)
    setRailHoverSectionId(null)
  }, [location.pathname, location.search])

  useEffect(() => {
    if (!railFlyoutSectionId) return
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target
      if (!(t instanceof Node)) return
      if (railFlyoutRef.current?.contains(t)) return
      for (const btn of railSectionButtonRefs.current.values()) {
        if (btn.contains(t)) return
      }
      setRailFlyoutSectionId(null)
    }
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setRailFlyoutSectionId(null)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [railFlyoutSectionId])

  const toggleSidebarDesktop = useCallback(() => {
    setSidebarMode((m) => {
      if (m === 'expanded') {
        if (sidebarWidthPxRef.current > SIDEBAR_ICON_ONLY_MAX_PX) {
          lastExpandedSidebarWidthPxRef.current = sidebarWidthPxRef.current
        }
        setSidebarWidthClamped(SIDEBAR_RAIL_WIDTH_PX)
        persistSidebarWidth(SIDEBAR_RAIL_WIDTH_PX)
        return 'rail'
      }
      if (m === 'rail') return 'hidden'
      const restore = lastExpandedSidebarWidthPxRef.current
      setSidebarWidthClamped(restore)
      persistSidebarWidth(restore)
      return 'expanded'
    })
    setRailFlyoutSectionId(null)
  }, [persistSidebarWidth, setSidebarWidthClamped])

  const closeMobileSidebar = useCallback(() => setSidebarOpen(false), [])

  useEscapeToClose(closeMobileSidebar, sidebarOpen)
  useEscapeToClose(() => setRailFlyoutSectionId(null), !!railFlyoutSectionId)
  useEscapeToClose(() => setStorePickerOpen(false), storePickerOpen)
  useEscapeToClose(() => setProfileOpen(false), profileOpen)

  const prevUnreadRef = useRef<number | null>(null)
  const { show: showBrowserNotif, permission } = useBrowserNotifications()

  useMyVendor()
  const { data: accessibleVendorsData } = useAccessibleVendors()
  const accessibleVendors = accessibleVendorsData?.items ?? []
  const qcLayout = useQueryClient()

  const { data: myPlanData } = useMyPlan()
  const planFeatures = myPlanData?.plan?.features as Record<string, unknown> | undefined

  // Fetch unread count every 30 s
  const { data: stats } = useQuery<{ unread: number; total: number }>({
    queryKey: ['notifications', 'stats'],
    queryFn: async () => {
      const res = await apiClient.get('/vendors/me/notifications/stats')
      return res.data
    },
    enabled: sessionReady,
    refetchInterval: (query) =>
      query.state.error && isAxiosAuthError(query.state.error) ? false : 30_000,
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
    enabled: sessionReady,
    staleTime: 60_000,
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

  const showRmSupportAudit =
    location.pathname === '/relationship-manager' &&
    !!vendor?.id &&
    !!vendorRole?.vendor_id &&
    vendorRole.vendor_id === vendor.id &&
    (vendorRole.role === 'owner' || vendorRole.role === 'platform_staff')

  const navOrderScope = useMemo((): NavOrderScope | null => {
    if (!user?.id) return null
    const roleKey = vendorRole?.role_id ?? vendorRole?.role ?? vendorRole?.role_name ?? 'member'
    return { userId: user.id, roleKey: String(roleKey) }
  }, [user?.id, vendorRole?.role_id, vendorRole?.role, vendorRole?.role_name])

  const financeMode = ((vendor?.settings as Record<string, unknown> | undefined)?.finance_mode as string | undefined) ?? 'advanced'

  const vendorSettings = vendor?.settings as Record<string, unknown> | undefined

  const hrNavVisible = useMemo(
    () => isHrNavVisible(vendorSettings, selectedStore?.id),
    [vendorSettings, selectedStore?.id],
  )

  const financeNavVisible = useMemo(() => isFinanceNavVisible(vendorSettings), [vendorSettings])
  const crmNavVisible = useMemo(() => isCrmNavVisible(vendorSettings), [vendorSettings])
  const { data: inboxCount = 0 } = useInboxUnreadCount(sessionReady && crmNavVisible)
  const { data: newLeadCount = 0 } = useNewLeadCount(sessionReady && crmNavVisible)
  const { data: newQueryCount = 0 } = useNewContactQueryCount(sessionReady)
  const commissionNavVisible = useMemo(() => isCommissionNavVisible(vendorSettings), [vendorSettings])
  const controllingNavVisible = useMemo(() => isControllingNavVisible(vendorSettings), [vendorSettings])
  const productionNavVisible = useMemo(
    () => isProductionNavVisible(vendorSettings, vendor?.offering_type),
    [vendorSettings, vendor?.offering_type],
  )
  const pharmaNavVisible = useMemo(
    () => isPharmaNavVisible(vendorSettings, vendor?.offering_type),
    [vendorSettings, vendor?.offering_type],
  )

  const rentalNavVisible = useMemo(
    () => isRentalsNavVisible(vendorSettings),
    [vendorSettings],
  )

  const canViewOrders = isOwnerOrAdmin || permissions.includes('orders.view')
  const { data: orderStats } = useOrderStats(sessionReady && canViewOrders)
  const pendingOrderCount = orderStats?.pending_orders ?? 0

  const getNavBadgeCount = useCallback(
    (to: string) => {
      if (to === '/notifications') return unreadCount
      if (to === '/crm/inbox') return inboxCount
      if (to === '/crm/leads') return newLeadCount
      if (to === '/orders') return pendingOrderCount
      if (to === '/queries') return newQueryCount
      return 0
    },
    [unreadCount, inboxCount, newLeadCount, pendingOrderCount, newQueryCount],
  )

  const filterItem = useCallback(
    (item: NavItem) => {
      if (item.requiresVendorAdmin && !isOwnerOrAdmin) return false
      if (item.alwaysShow) return true
      if (item.to === '/pos' && !isPosNavVisible(vendorSettings, vendor?.offering_type, planFeatures)) return false
      if (
        item.to.startsWith('/restaurant/') &&
        !isRestaurantNavVisible(vendorSettings, vendor?.offering_type, planFeatures)
      ) {
        return false
      }
      if (item.to === '/bookings' && !isBookingsNavVisible(vendorSettings, vendor?.offering_type)) return false
      if (item.to === '/projects' && !isProjectsNavVisible(vendorSettings)) return false
      if (item.to === '/subscriptions' && !isSubscriptionsNavVisible(vendorSettings)) return false
      // offering_type no longer gates nav — module toggles control visibility instead
      // Wait for the session to be ready before showing permission-gated items so modules don't
      // flash visible on first load before permissions resolve.
      if (item.requiresPermission) {
        if (!sessionReady) return false
        if (vendorRole && !isOwnerOrAdmin && !permissions.includes(item.requiresPermission)) return false
      }
      if (item.requiresFinanceMode) {
        if (item.requiresFinanceMode !== financeMode) return false
      }
      return true
    },
    [vendor, vendor?.offering_type, vendorSettings, vendorRole, isOwnerOrAdmin, permissions, financeMode, planFeatures, sessionReady],
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
          if (section.id === 'production' && !productionNavVisible) return false
          if (section.id === 'pharma' && !pharmaNavVisible) return false
          if (section.id === 'rental' && !rentalNavVisible) return false
          if (
            section.id === 'restaurant' &&
            !isRestaurantNavVisible(vendorSettings, vendor?.offering_type, planFeatures)
          ) {
            return false
          }
          return true
        })
        .map((section) => ({ ...section, items: section.items.filter(filterItem) }))
        // A section must have at least one item gated on its own permission namespace —
        // cross-cutting permissions (reports.view, pos.view, etc.) can render items they
        // belong to but cannot make an unrelated module appear.
        .filter((section) => section.items.length > 0 && sectionHasOwnershipItem(section.id, section.items)),
    [
      filterItem,
      hrNavVisible, financeNavVisible, crmNavVisible, commissionNavVisible,
      controllingNavVisible, productionNavVisible, pharmaNavVisible, rentalNavVisible,
      vendorSettings, vendor?.offering_type, planFeatures,
    ],
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

  const [sectionOrder, setSectionOrder] = useState<string[]>(DEFAULT_SECTION_IDS)
  const [itemPlacements, setItemPlacements] = useState<Record<string, string[]>>({})

  useEffect(() => {
    if (!navOrderScope) return
    setSectionOrder(loadSectionIds(DEFAULT_SECTION_IDS, navOrderScope))
  }, [navOrderScope])

  useEffect(() => {
    if (!navOrderScope) return
    saveSectionIds(sectionOrder, navOrderScope)
  }, [sectionOrder, navOrderScope])

  useEffect(() => {
    if (!displaySections.length || !navOrderScope) return
    setItemPlacements((prev) =>
      reconcileNavPlacements(
        Object.keys(prev).length ? prev : loadNavPlacementsState(displaySections, navOrderScope),
        displaySections,
      ),
    )
  }, [displaySections, navOrderScope])

  useEffect(() => {
    if (!navOrderScope || !Object.keys(itemPlacements).length) return
    saveNavPlacementsState(itemPlacements, navOrderScope)
  }, [itemPlacements, navOrderScope])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const orderedVisibleSections = useMemo(
    () => orderSectionsById(displaySections, sectionOrder),
    [displaySections, sectionOrder],
  )

  const allVisibleSectionIds = useMemo(
    () => orderedVisibleSections.map((s) => s.id),
    [orderedVisibleSections],
  )

  const [enabledSectionIds, setEnabledSectionIds] = useState<string[]>(allVisibleSectionIds)
  const skipEnabledSectionsSaveRef = useRef(true)

  useEffect(() => {
    if (!navOrderScope) return
    skipEnabledSectionsSaveRef.current = true
    setEnabledSectionIds(loadEnabledSectionIds(allVisibleSectionIds, navOrderScope))
  }, [navOrderScope, allVisibleSectionIds.join('|')])

  useEffect(() => {
    if (!navOrderScope) return
    if (skipEnabledSectionsSaveRef.current) {
      skipEnabledSectionsSaveRef.current = false
      return
    }
    saveEnabledSectionIds(enabledSectionIds, allVisibleSectionIds, navOrderScope)
  }, [enabledSectionIds, allVisibleSectionIds, navOrderScope])

  const sidebarSections = useMemo(
    () =>
      orderedVisibleSections.filter((s) => enabledSectionIds.includes(s.id)),
    [orderedVisibleSections, enabledSectionIds],
  )

  const optionalAppsCount = useMemo(
    () => orderedVisibleSections.filter((s) => !isPinnedSidebarSection(s.id)).length,
    [orderedVisibleSections],
  )

  const enabledOptionalAppsCount = useMemo(
    () =>
      sidebarSections.filter((s) => !isPinnedSidebarSection(s.id)).length,
    [sidebarSections],
  )

  const showAppsPickerHint =
    optionalAppsCount > 0 && enabledOptionalAppsCount < optionalAppsCount

  useEffect(() => {
    const activeSection = displaySections.find((s) =>
      s.items.some((it) => isNavRouteActive(location.pathname, location.search, it.to)),
    )
    if (activeSection) {
      setEnabledSectionIds((prev) =>
        prev.includes(activeSection.id) ? prev : [...prev, activeSection.id],
      )
    }
  }, [location.pathname, location.search, displaySections])

  useEffect(() => {
    if (railFlyoutSectionId && !enabledSectionIds.includes(railFlyoutSectionId)) {
      setRailFlyoutSectionId(null)
    }
  }, [enabledSectionIds, railFlyoutSectionId])

  // ── Universal Search ───────────────────────────────────────────────────────
  const [searchOpen, setSearchOpen] = useState(false)

  // ── Header utility buttons ─────────────────────────────────────────────────
  const navigate = useNavigate()

  const switchVendor = useCallback((item: AccessibleVendorItem) => {
    if (item.id === vendor?.id) return
    setProfileOpen(false)
    // Set the bare vendor stub so the X-Vendor-Id header updates before any re-fetch
    clearVendor()
    setVendor({
      id: item.id,
      display_name: item.display_name,
      business_name: item.business_name,
      slug: item.slug,
      logo_url: item.logo_url,
    } as Parameters<typeof setVendor>[0])
    // Clear all tenant-scoped cached data so nothing bleeds across accounts
    qcLayout.removeQueries()
    navigate('/', { replace: true })
  }, [vendor?.id, clearVendor, setVendor, qcLayout, navigate])

  const [helpOpen, setHelpOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const helpRef = useRef<HTMLDivElement>(null)
  const moreRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (helpRef.current && !helpRef.current.contains(e.target as Node)) setHelpOpen(false)
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

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
      m.set(s.id, ensurePinnedNavItemsInSection(s.id, list, byTo))
    }
    return m
  }, [displaySections, itemPlacements])

  const appsPickerSections = useMemo(
    () =>
      orderedVisibleSections.map((s) => {
        const items = orderedNavItemsBySectionId.get(s.id) ?? s.items
        return {
          id: s.id,
          title: s.title,
          titleTooltip: s.titleTooltip,
          icon: s.icon,
          itemCount: items.length,
          description: SIDEBAR_APP_DESCRIPTIONS[s.id],
          submenuLabels: items.map((it) => it.label),
          submenuItems: (() => {
            let currentGroup: string | undefined
            return items.map((it) => {
              if (it.groupLabel) currentGroup = it.groupLabel
              return {
                label: it.label,
                path: it.externalHref ?? it.to,
                external: Boolean(it.externalHref),
                group: currentGroup,
                icon: it.icon,
              }
            })
          })(),
        }
      }),
    [orderedVisibleSections, orderedNavItemsBySectionId],
  )

  const flatVisibleNavItems = useMemo(
    () => displaySections.flatMap((s) => orderedNavItemsBySectionId.get(s.id) ?? s.items),
    [displaySections, orderedNavItemsBySectionId],
  )

  const activeNavTo = useMemo(
    () => resolveActiveNavTo(location.pathname, location.search, flatVisibleNavItems),
    [location.pathname, location.search, flatVisibleNavItems],
  )

  useLayoutEffect(() => {
    if (!railFlyoutSectionId) return
    const el = railFlyoutRef.current
    if (!el) return
    const margin = 8
    const { bottom } = el.getBoundingClientRect()
    if (bottom > window.innerHeight - margin) {
      const shift = bottom - (window.innerHeight - margin)
      setRailFlyoutTop((prev) => Math.max(margin, prev - shift))
    }
  }, [railFlyoutSectionId, orderedNavItemsBySectionId, displaySections])

  const resetNavOrderToDefaults = useCallback(() => {
    if (navOrderScope) clearSavedNavOrder(navOrderScope)
    setSectionOrder(loadSectionIds(DEFAULT_SECTION_IDS, navOrderScope))
    setItemPlacements(buildDefaultPlacementsFromSections(displaySections))
    setNavReorderMode(false)
    setNavActiveDndId(null)
    setNavDndOverId(null)
    setNavDragOverlay(null)
    setSidebarOpen(true)
  }, [navOrderScope, displaySections])

  useEffect(() => {
    function onResetUserNavOrder() {
      resetNavOrderToDefaults()
    }
    window.addEventListener(RESET_USER_NAV_ORDER_EVENT, onResetUserNavOrder)
    return () => window.removeEventListener(RESET_USER_NAV_ORDER_EVENT, onResetUserNavOrder)
  }, [resetNavOrderToDefaults])

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

  /** Auto-expand the sidebar section (and group) that contains the active page. */
  useEffect(() => {
    if (!activeNavTo || navReorderMode) return

    const section = displaySections.find((s) => {
      const items = orderedNavItemsBySectionId.get(s.id) ?? s.items
      return items.some((it) => it.to === activeNavTo)
    })
    if (!section) return

    setCollapsedSections((prev) => {
      if (prev[section.title] === false) return prev
      pendingScrollSectionId.current = section.id
      return { ...prev, [section.title]: false }
    })

    const items = orderedNavItemsBySectionId.get(section.id) ?? section.items
    const itemGroups = effectiveNavGroupLabels(items)
    const blocks = buildNavItemBlocks(items, itemGroups, section.title)
    for (const block of blocks) {
      if (block.kind !== 'group') continue
      const hasActive = block.entries.some(({ item }) => item.to === activeNavTo)
      if (!hasActive) continue
      setCollapsedGroups((prev) => {
        if (prev[block.grpKey] === false) return prev
        return { ...prev, [block.grpKey]: false }
      })
      break
    }
  }, [activeNavTo, displaySections, orderedNavItemsBySectionId, navReorderMode])

  const toggleSection = useCallback((title: string, sectionId: string) => {
    const activeInSection = sectionActiveNavTo(
      sectionId,
      activeNavTo,
      orderedNavItemsBySectionId,
      displaySections,
    )
    setCollapsedSections((prev) => {
      const wasCollapsed = prev[title] ?? true
      if (!wasCollapsed) {
        return { ...prev, [title]: true }
      }
      pendingScrollSectionId.current = sectionId
      if (activeInSection && !isNavRouteActive(location.pathname, location.search, activeInSection)) {
        navigate(activeInSection)
      }
      if (activeInSection) {
        setNavFocusKey(itemFocusKey(sectionId, activeInSection))
      }
      // Accordion: keep only the clicked section expanded.
      const next: Record<string, boolean> = {}
      for (const s of sidebarSections) {
        next[s.title] = s.title !== title
      }
      return next
    })
  }, [
    activeNavTo,
    displaySections,
    location.pathname,
    location.search,
    navigate,
    orderedNavItemsBySectionId,
    sidebarSections,
  ])

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

  const toggleGroup = useCallback((grpKey: string, sectionId: string, groupItems: NavItem[]) => {
    const activeInGroup =
      activeNavTo && groupItems.some((it) => it.to === activeNavTo) ? activeNavTo : null
    setCollapsedGroups((prev) => {
      const wasCollapsed = resolveNavGroupCollapsed(grpKey, prev)
      if (!wasCollapsed) {
        return { ...prev, [grpKey]: true }
      }
      if (activeInGroup && !isNavRouteActive(location.pathname, location.search, activeInGroup)) {
        navigate(activeInGroup)
      }
      if (activeInGroup) {
        setNavFocusKey(itemFocusKey(sectionId, activeInGroup))
      }
      return { ...prev, [grpKey]: false }
    })
  }, [activeNavTo, location.pathname, location.search, navigate])

  const roleBadge = vendorRole?.role_name || 'Member'
  const profileName = user?.full_name?.trim() || ''
  const profileDisplayName = profileFirstName(user?.full_name) || profileName
  const profileHoverTitle = profileName
    ? roleBadge
      ? `${profileName} — ${roleBadge}`
      : profileName
    : undefined
  const { heading: settingsScopeHeading } = useBusinessUnitScopeLabel()

  const settingsSection = new URLSearchParams(location.search).get('section')
  const settingsSectionTitle =
    location.pathname === '/settings' && settingsSection
      ? SETTINGS_SECTION_TITLES[settingsSection]
      : null

  const pageTitle =
    settingsSectionTitle
      ? `${settingsSectionTitle} — Settings`
      : location.pathname === '/settings'
      ? `Settings — ${settingsScopeHeading}`
      : pageTitles[location.pathname] ||
        (location.pathname.startsWith('/products/') ? 'Product Details' :
         location.pathname.startsWith('/services/') ? 'Service Details' :
         location.pathname.startsWith('/orders/') ? 'Order Details' :
         location.pathname.startsWith('/production/orders/') ? 'Production Order' :
         location.pathname.startsWith('/customers/') ? 'Customer Details' :
         location.pathname.startsWith('/quotations/templates') ? 'Quotation Templates' :
         location.pathname.startsWith('/quotations/') ? 'Quotation Details' :
         location.pathname.startsWith('/invoices/') ? 'Invoice Details' :
         location.pathname.startsWith('/purchase-orders/') ? 'Purchase Order' :
         location.pathname.startsWith('/projects/') ? 'Project Details' :
         location.pathname.startsWith('/controlling/orders/') ? 'CO Manufacturing Order' :
         location.pathname.startsWith('/rental/bookings/') ? 'Booking Details' :
         location.pathname.startsWith('/rental/assets/') ? 'Asset Details' :
         'Dashboard')

  useEffect(() => {
    const title = vendorAppPageTitle(pageTitle)
    applyDocumentSeo({
      title,
      description: pageTitle === 'Dashboard'
        ? 'KITERP vendor dashboard for products, orders, websites, CRM, finance, HR, and business operations.'
        : `${pageTitle} — KITERP vendor business dashboard.`,
      noindex: true,
    })
  }, [pageTitle])

  const storePickerMenu =
    storePickerOpen && storePickerPos
      ? createPortal(
          <>
            <button
              type="button"
              aria-label="Close business unit menu"
              className="fixed inset-0 z-[99] bg-black/20 sm:bg-transparent sm:pointer-events-none"
              onClick={() => setStorePickerOpen(false)}
            />
            <div
              ref={storePickerMenuRef}
              role="listbox"
              aria-label={`Select ${BUSINESS_UNIT_STORE_LABEL}`}
              style={{
                top: storePickerPos.top,
                left: storePickerPos.left,
                width: storePickerPos.width,
              }}
              className="fixed z-[100] max-h-[min(28rem,calc(100dvh-5rem))] overflow-hidden overflow-y-auto rounded-xl border border-border bg-card shadow-xl"
            >
        <div className="border-b border-border bg-muted px-4 py-2.5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground leading-snug">
            {BUSINESS_UNIT_STORE_LABEL}
          </p>
        </div>

        {showAllLocationsOption && (
          <button
            type="button"
            role="option"
            aria-selected={!selectedStore}
            onClick={() => { setSelectedStore(null); setStorePickerOpen(false) }}
            className={cn(
              'w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent transition-colors',
              !selectedStore && 'bg-primary/10 dark:bg-primary/20',
            )}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Store className="h-3.5 w-3.5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">All business units</p>
              <p className="text-xs text-muted-foreground">No filter applied</p>
            </div>
            {!selectedStore && <Check className="h-4 w-4 shrink-0 text-primary" />}
          </button>
        )}

        {stores.length > 0 && (
          <div className={cn('border-border', showAllLocationsOption && 'border-t')}>
            {stores.map((s) => {
              const isFav = favouriteStoreId === s.id
              const isDefault = (s as any).is_default === true
              const isSelected = selectedStore?.id === s.id
              const isOpen = (s as any).is_open !== false
              return (
                <div
                  key={s.id}
                  className={cn(
                    'group flex items-center gap-2 px-3 py-2 hover:bg-accent transition-colors',
                    isSelected && 'bg-primary/10 dark:bg-primary/20',
                  )}
                >
                  {/* Main select area */}
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      setSelectedStore({ id: s.id, name: s.name, code: s.code, description: s.description })
                      setStorePickerOpen(false)
                    }}
                    className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                  >
                    <div className={cn('relative shrink-0', !isOpen && 'opacity-50')}>
                      <BusinessUnitLogoThumb
                        store={s}
                        vendor={vendor}
                        className="h-7 w-7"
                        iconClassName="h-3.5 w-3.5 text-muted-foreground"
                      />
                      {!isOpen && !isFav && (
                        <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-card" />
                      )}
                      {isFav && (
                        <Star className="absolute -right-1 -top-1 h-3 w-3 fill-amber-400 text-amber-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1 text-sm font-medium text-foreground truncate">
                        {s.name}
                        {isDefault && (
                          <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-px text-[10px] font-medium text-primary">default</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {s.code && `#${s.code}`}{s.description ? ` · ${s.description}` : ''}
                      </p>
                    </div>
                    {isSelected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                  </button>

                  {/* Open/Closed toggle + Favourite + Default action buttons */}
                  <div className="flex shrink-0 items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    {/* Open / Closed toggle */}
                    <button
                      type="button"
                      title={isOpen ? 'Mark as Closed (hides from website)' : 'Mark as Open'}
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleStoreOpenMutation.mutate({ id: s.id, is_open: !isOpen })
                      }}
                      disabled={toggleStoreOpenMutation.isPending}
                      className={cn(
                        'flex h-6 items-center justify-center rounded-md px-1.5 text-[10px] font-semibold transition-colors',
                        isOpen
                          ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-900/30 dark:text-rose-400',
                      )}
                    >
                      {isOpen ? 'Open' : 'Closed'}
                    </button>
                    <button
                      type="button"
                      title={isFav ? 'Remove favourite' : 'Set as favourite (auto-selects on login)'}
                      onClick={(e) => {
                        e.stopPropagation()
                        setFavouriteStoreId(isFav ? null : s.id)
                        if (!isFav) {
                          setSelectedStore({ id: s.id, name: s.name, code: s.code, description: s.description })
                        }
                      }}
                      className={cn(
                        'flex h-6 w-6 items-center justify-center rounded-md transition-colors',
                        isFav ? 'text-amber-500 hover:bg-amber-50' : 'text-muted-foreground hover:bg-muted hover:text-amber-500',
                      )}
                    >
                      <Star className={cn('h-3.5 w-3.5', isFav && 'fill-amber-400')} />
                    </button>
                    <button
                      type="button"
                      title={isDefault ? 'Already the default unit' : 'Set as organisational default'}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (!isDefault) setStoreDefaultMutation.mutate(s.id)
                      }}
                      disabled={isDefault}
                      className={cn(
                        'flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold transition-colors',
                        isDefault ? 'cursor-default text-primary/60' : 'text-muted-foreground hover:bg-muted hover:text-primary',
                      )}
                    >
                      D
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {stores.length === 0 && (
          <p className="px-4 py-3 text-xs text-muted-foreground text-center">No business units configured yet</p>
        )}

        <div className="border-t border-border px-3 py-2.5">
          <Link
            to="/settings"
            onClick={() => setStorePickerOpen(false)}
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-sm font-medium text-foreground hover:bg-accent transition-colors"
          >
            <Settings className="w-4 h-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">{BUSINESS_UNIT_STORE_SETTINGS_LINK}</span>
            <ChevronRight className="w-4 h-4 ml-auto shrink-0 text-muted-foreground" />
          </Link>
        </div>
            </div>
          </>,
          document.body,
        )
      : null

  const sidebarDesktopToggleLabel =
    sidebarMode === 'expanded'
      ? 'Icon-only menu'
      : sidebarMode === 'rail'
        ? 'Hide menu'
        : 'Show menu'

  const toggleRailSection = useCallback(
    (sectionId: string) => {
      const btn = railSectionButtonRefs.current.get(sectionId)
      if (!btn) return
      const rect = btn.getBoundingClientRect()
      const section = sidebarSections.find((s) => s.id === sectionId)
      const items = section
        ? (orderedNavItemsBySectionId.get(section.id) ?? section.items)
        : []
      const groupCount = new Set(
        effectiveNavGroupLabels(items).filter((g): g is string => Boolean(g)),
      ).size
      const estimatedH = estimateRailFlyoutHeight(items.length, groupCount)
      const maxTop = Math.max(8, window.innerHeight - estimatedH - 8)
      const top = Math.min(Math.max(8, rect.top - 6), maxTop)
      setRailFlyoutTop(top)
      setRailHoverSectionId(null)
      setRailFlyoutSectionId((prev) => (prev === sectionId ? null : sectionId))
    },
    [sidebarSections, orderedNavItemsBySectionId],
  )

  const railFlyoutSection = railFlyoutSectionId
    ? sidebarSections.find((s) => s.id === railFlyoutSectionId)
    : null
  const railFlyoutItems = railFlyoutSection
    ? (orderedNavItemsBySectionId.get(railFlyoutSection.id) ?? railFlyoutSection.items)
    : []

  const registerNavFocusRef = useCallback((key: string, el: HTMLElement | null) => {
    if (el) navFocusRefs.current.set(key, el)
    else navFocusRefs.current.delete(key)
  }, [])

  const sidebarNavNodes = useMemo(
    () =>
      buildSidebarNavTree(
        sidebarSections,
        orderedNavItemsBySectionId,
        collapsedSections,
        collapsedGroups,
        (items: NavItemLike[], groups, sectionTitle) => buildNavItemBlocks(items, groups, sectionTitle),
        (items: NavItemLike[]) => effectiveNavGroupLabels(items),
      ),
    [sidebarSections, orderedNavItemsBySectionId, collapsedSections, collapsedGroups],
  )

  const railNavNodes = useMemo(
    () => buildRailNavTree(sidebarSections),
    [sidebarSections],
  )

  const railFlyoutNavNodes = useMemo(
    () =>
      railFlyoutSectionId
        ? buildRailFlyoutTree(railFlyoutSectionId, railFlyoutItems)
        : [],
    [railFlyoutSectionId, railFlyoutItems],
  )

  const railFlyoutActiveKey = useMemo(() => {
    if (!railFlyoutSectionId || !activeNavTo) return null
    const activeInFlyout = railFlyoutItems.some((it) => it.to === activeNavTo)
    return activeInFlyout ? flyoutFocusKey(railFlyoutSectionId, activeNavTo) : null
  }, [railFlyoutSectionId, railFlyoutItems, activeNavTo])

  const navigateToNavItem = useCallback(
    (to: string, focusKey?: string) => {
      if (!isNavRouteActive(location.pathname, location.search, to)) {
        navigate(to)
      }
      if (focusKey) setNavFocusKey(focusKey)
      setSidebarOpen(false)
      closeMobileSidebar()
    },
    [location.pathname, location.search, navigate, closeMobileSidebar],
  )

  const openRailFlyout = useCallback(
    (sectionId: string, focusKey?: string, navigateTo?: string) => {
      const btn = railSectionButtonRefs.current.get(sectionId)
      if (!btn) return
      const rect = btn.getBoundingClientRect()
      const section = sidebarSections.find((s) => s.id === sectionId)
      const items = section
        ? (orderedNavItemsBySectionId.get(section.id) ?? section.items)
        : []
      const groupCount = new Set(
        effectiveNavGroupLabels(items).filter((g): g is string => Boolean(g)),
      ).size
      const estimatedH = estimateRailFlyoutHeight(items.length, groupCount)
      const maxTop = Math.max(8, window.innerHeight - estimatedH - 8)
      const top = Math.min(Math.max(8, rect.top - 6), maxTop)
      setRailFlyoutTop(top)
      setRailFlyoutSectionId(sectionId)
      if (navigateTo) {
        navigateToNavItem(navigateTo, focusKey)
      } else if (focusKey) {
        setNavFocusKey(focusKey)
      }
    },
    [sidebarSections, orderedNavItemsBySectionId, navigateToNavItem],
  )

  const applySidebarNavAction = useCallback(
    (action: SidebarNavAction) => {
      switch (action.type) {
        case 'focus':
          setNavFocusKey(action.key)
          break
        case 'navigate':
          navigateToNavItem(action.to, action.focusKey)
          break
        case 'expandSection':
          setCollapsedSections((prev) => {
            if (prev[action.title] === false) return prev
            pendingScrollSectionId.current = action.sectionId
            const next: Record<string, boolean> = {}
            for (const s of sidebarSections) {
              next[s.title] = s.title !== action.title
            }
            return next
          })
          if (action.navigateTo) {
            navigateToNavItem(action.navigateTo, action.focusKey)
          } else {
            setNavFocusKey(action.focusKey ?? secFocusKey(action.sectionId))
          }
          break
        case 'collapseSection':
          skipNavFocusScrollRef.current = true
          setCollapsedSections((prev) => ({ ...prev, [action.title]: true }))
          setNavFocusKey(secFocusKey(action.sectionId))
          break
        case 'expandGroup':
          setCollapsedGroups((prev) => ({ ...prev, [action.grpKey]: false }))
          if (action.navigateTo) {
            navigateToNavItem(action.navigateTo, action.focusKey)
          } else {
            setNavFocusKey(action.focusKey ?? grpFocusKey(action.grpKey))
          }
          break
        case 'collapseGroup':
          setCollapsedGroups((prev) => ({ ...prev, [action.grpKey]: true }))
          setNavFocusKey(grpFocusKey(action.grpKey))
          break
        case 'openRailFlyout':
          openRailFlyout(action.sectionId, action.focusKey, action.navigateTo)
          if (!action.navigateTo) {
            setNavFocusKey(action.focusKey ?? railFocusKey(action.sectionId))
          }
          break
        case 'closeRailFlyout':
          setRailFlyoutSectionId(null)
          if (action.focusKey) setNavFocusKey(action.focusKey)
          break
      }
    },
    [openRailFlyout, navigateToNavItem, sidebarSections],
  )

  const handleSidebarNavKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>, nodes: Array<SidebarNavNode>) => {
      if (navReorderMode || !nodes.length) return
      if (isSidebarTypingTarget(e.target)) return
      const navigationKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter', ' ']
      if (!navigationKeys.includes(e.key)) return

      const focusedInTree =
        e.currentTarget.contains(document.activeElement) ||
        navFocusKey != null
      const ctrlMainMenuJump =
        (e.ctrlKey || e.metaKey) && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')
      if (!focusedInTree && e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && !ctrlMainMenuJump) return

      const action = resolveSidebarNavKeyAction(e.key, nodes, navFocusKey, {
        collapsedSections,
        collapsedGroups,
        railFlyoutSectionId,
        railFlyoutFirstKey: railFlyoutNavNodes[0]?.key ?? null,
        railFlyoutActiveKey,
        activeNavTo,
        ctrlKey: e.ctrlKey || e.metaKey,
        mainMenuNodes: nodes.some((n) => n.kind === 'flyout') ? railNavNodes : undefined,
      })
      if (!action) return
      e.preventDefault()
      e.stopPropagation()
      applySidebarNavAction(action)
    },
    [
      navReorderMode,
      navFocusKey,
      collapsedSections,
      collapsedGroups,
      railFlyoutSectionId,
      railFlyoutNavNodes,
      railFlyoutActiveKey,
      activeNavTo,
      applySidebarNavAction,
      railNavNodes,
    ],
  )

  useLayoutEffect(() => {
    if (!navFocusKey) return
    const el = navFocusRefs.current.get(navFocusKey)
    if (!el) return
    el.focus({ preventScroll: true })
    if (!skipNavFocusScrollRef.current) {
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }
    skipNavFocusScrollRef.current = false
  }, [navFocusKey, collapsedSections, collapsedGroups, railFlyoutSectionId])

  const RailFlyoutSectionIcon = railFlyoutSection?.icon

  const railFlyoutMenu =
    railFlyoutSection && railFlyoutSectionId && RailFlyoutSectionIcon
      ? createPortal(
          <>
            <div
              className="fixed inset-x-0 bottom-0 top-14 z-[69] hidden lg:block"
              aria-hidden
              onClick={() => setRailFlyoutSectionId(null)}
            />
            <div
              ref={railFlyoutRef}
              role="menu"
              aria-label={railFlyoutSection.title}
              onKeyDown={(e) => handleSidebarNavKeyDown(e, railFlyoutNavNodes)}
              className={cn(
                'fixed z-[70] flex w-[min(18rem,calc(100vw-5.5rem))] max-h-[min(32rem,calc(100dvh-1rem))] flex-col overflow-hidden',
                'rounded-xl border border-border/80 bg-card shadow-xl ring-1 ring-black/[0.04] dark:ring-white/10',
                'animate-in fade-in-0 slide-in-from-left-2 duration-200 motion-reduce:animate-none',
                'before:pointer-events-none before:absolute before:-left-[5px] before:top-6 before:z-10 before:h-2.5 before:w-2.5 before:rotate-45 before:border-b before:border-l before:border-border/80 before:bg-card',
              )}
              style={{ left: SIDEBAR_RAIL_WIDTH_PX + 8, top: railFlyoutTop }}
            >
              <div className="flex shrink-0 items-center gap-2.5 border-b border-border/80 bg-card/95 px-3 py-2.5 backdrop-blur-sm">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary/15 text-sidebar-primary ring-1 ring-sidebar-primary/20">
                  <RailFlyoutSectionIcon className="h-4 w-4" strokeWidth={2} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{railFlyoutSection.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {railFlyoutItems.length} {railFlyoutItems.length === 1 ? 'page' : 'pages'}
                  </p>
                </div>
              </div>

              <div
                className="sidebar-scroll sidebar-nav-rail-flyout-list min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5 [scrollbar-gutter:stable]"
                aria-label={`${railFlyoutSection.title} pages`}
              >
                {(() => {
                  const flyoutGroups = effectiveNavGroupLabels(railFlyoutItems)
                  return railFlyoutItems.map((item, itemIdx) => {
                    const gl = flyoutGroups[itemIdx]
                    const prevGl = itemIdx > 0 ? flyoutGroups[itemIdx - 1] : null
                    const showGroupHeader = Boolean(gl) && gl !== prevGl
                    const flyItemKey = flyoutFocusKey(railFlyoutSectionId, item.to)
                    return (
                      <div key={`${item.to}-${item.label}`} className={showGroupHeader && itemIdx > 0 ? 'mt-1' : undefined}>
                        {showGroupHeader && gl ? (
                          <div className="flex items-center gap-2 px-2 pb-1 pt-2 first:pt-0.5">
                            <span className="h-px min-w-[0.5rem] flex-1 bg-border/80" aria-hidden />
                            <p className="shrink-0 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                              {gl}
                            </p>
                            <span className="h-px flex-1 bg-border/80" aria-hidden />
                          </div>
                        ) : null}
                        {item.externalHref ? (
                          <a
                            href={item.externalHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            role="menuitem"
                            title={item.label}
                            ref={(el) => registerNavFocusRef(flyItemKey, el)}
                            onFocus={() => setNavFocusKey(flyItemKey)}
                            onClick={() => {
                              setRailFlyoutSectionId(null)
                              closeMobileSidebar()
                            }}
                            className={cn(
                              RAIL_FLYOUT_ITEM,
                              RAIL_FLYOUT_ITEM_IDLE,
                              navFocusKey === flyItemKey && RAIL_FLYOUT_ITEM_FOCUS,
                            )}
                          >
                            <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2} aria-hidden />
                            <span className="min-w-0 flex-1 truncate">{item.label}</span>
                            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" aria-hidden />
                          </a>
                        ) : (
                          (() => {
                            const isKbFocused = navFocusKey === flyItemKey
                            return (
                          <NavLink
                            to={item.to}
                            role="menuitem"
                            title={item.label}
                            ref={(el) => registerNavFocusRef(flyItemKey, el)}
                            onFocus={() => setNavFocusKey(flyItemKey)}
                            onClick={() => {
                              setRailFlyoutSectionId(null)
                              closeMobileSidebar()
                            }}
                            className="block outline-none"
                          >
                            {({ isActive }) => (
                              <span
                                className={cn(
                                  RAIL_FLYOUT_ITEM,
                                  isActive ? RAIL_FLYOUT_ITEM_ACTIVE : RAIL_FLYOUT_ITEM_IDLE,
                                  isKbFocused && RAIL_FLYOUT_ITEM_FOCUS,
                                )}
                              >
                                <span
                                  className={cn(
                                    'flex h-7 w-7 shrink-0 items-center justify-center',
                                    isActive
                                      ? RAIL_FLYOUT_ICON_ACTIVE
                                      : 'sidebar-nav-icon-tile sidebar-nav-icon-tile-hoverable',
                                  )}
                                >
                                  <item.icon className="h-4 w-4" strokeWidth={2} aria-hidden />
                                </span>
                                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                                {getNavBadgeCount(item.to) > 0 ? (
                                  <NavCountBadge count={getNavBadgeCount(item.to)} variant="flyout" />
                                ) : isActive ? (
                                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-sidebar-primary/80" aria-hidden />
                                ) : null}
                              </span>
                            )}
                          </NavLink>
                            )
                          })()
                        )}
                      </div>
                    )
                  })
                })()}
              </div>

              <div className="shrink-0 border-t border-border/80 bg-muted/15 p-1.5">
                <button
                  type="button"
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  onClick={() => {
                    const restore = lastExpandedSidebarWidthPxRef.current
                    setSidebarMode('expanded')
                    setSidebarWidthClamped(restore)
                    persistSidebarWidth(restore)
                    setRailFlyoutSectionId(null)
                  }}
                >
                  <PanelLeft className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                  Expand full menu
                </button>
              </div>
            </div>
          </>,
          document.body,
        )
      : null

  const sidebarContent = (
    <div className="flex h-full min-h-0 flex-col">
      {/* Sidebar header: KIT ERP brand | Apps */}
      <div
        className={cn(
          'flex h-14 w-full shrink-0 items-center gap-2 border-b border-sidebar-border bg-muted/30',
          showIconOnlyNav ? 'justify-center px-1.5' : 'px-2 sm:px-2.5',
        )}
      >
        {/* KIT ERP brand — dashboard home; icon-only rail click expands sidebar */}
        <button
          type="button"
          title={showIconOnlyNav ? 'Expand menu' : 'KIT ERP — Dashboard'}
          onClick={() => {
            if (showIconOnlyNav) {
              const restore = lastExpandedSidebarWidthPxRef.current
              setSidebarMode('expanded')
              setSidebarWidthClamped(restore)
              persistSidebarWidth(restore)
              setRailFlyoutSectionId(null)
              return
            }
            navigate('/')
          }}
          className={cn(
            'flex min-w-0 items-center gap-2 rounded-lg text-left transition-colors',
            showIconOnlyNav
              ? 'lg:cursor-pointer lg:justify-center lg:flex-none lg:p-1.5 lg:hover:bg-muted/50'
              : 'min-w-0 flex-1 cursor-pointer p-1 -m-1 hover:bg-muted/50',
          )}
        >
          <span
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[linear-gradient(140deg,hsl(var(--primary))_0%,hsl(var(--hero-via))_45%,hsl(var(--hero-to))_100%)] text-white shadow-sm ring-1 ring-black/10',
              showIconOnlyNav && 'lg:h-10 lg:w-10',
            )}
            aria-hidden
          >
            <Store className={cn('h-4 w-4', showIconOnlyNav && 'lg:h-5 lg:w-5')} strokeWidth={1.5} />
          </span>
          <span
            className={cn(
              'text-sm tracking-wide text-sidebar-foreground',
              NAV_FONT_BRAND,
              showIconOnlyNav && 'lg:hidden',
            )}
          >
            KIT ERP
          </span>
        </button>
        <button
          type="button"
          onClick={() => setAppsPickerOpen(true)}
          aria-label="Choose sidebar apps"
          className={cn(
            'flex shrink-0 items-center gap-1.5 rounded-full bg-background/90 px-2.5 py-1 text-xs uppercase tracking-wide shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            surfaceBorderClassName,
            NAV_FONT_TAB,
            'text-muted-foreground hover:border-primary/35 hover:bg-muted/50 hover:text-foreground',
            showAppsPickerHint && 'border-primary/30 text-foreground',
            showIconOnlyNav && 'lg:px-2',
          )}
        >
          <LayoutGrid className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className={cn(showIconOnlyNav && 'lg:hidden')}>Apps</span>
          {showAppsPickerHint ? (
            <span
              className="rounded-full bg-primary/15 px-1.5 text-[10px] font-semibold leading-none text-primary"
              aria-hidden
            >
              {enabledOptionalAppsCount}
            </span>
          ) : null}
        </button>
      </div>

      {/* Icon rail — desktop semi-collapsed mode */}
      <nav
        aria-label="Module icons"
        tabIndex={navReorderMode ? undefined : 0}
        className={cn(
          'hidden min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto py-2 outline-none',
          showIconOnlyNav && 'lg:flex',
          !showIconOnlyNav && 'lg:hidden',
        )}
        onMouseLeave={() => setRailHoverSectionId(null)}
        onFocus={(e) => {
          if (e.target !== e.currentTarget || navFocusKey || !railNavNodes[0]) return
          setNavFocusKey(railNavNodes[0].key)
        }}
        onKeyDown={(e) => handleSidebarNavKeyDown(e, railNavNodes)}
      >
        {sidebarSections.map((section) => {
          const SectionIcon = section.icon
          const items = orderedNavItemsBySectionId.get(section.id) ?? section.items
          const sectionHasActive = items.some((it) => activeNavTo === it.to)
          const flyoutOpen = railFlyoutSectionId === section.id
          const isRailActive =
            railFlyoutSectionId != null
              ? flyoutOpen
              : railHoverSectionId == null && sectionHasActive
          const sectionRailKey = railFocusKey(section.id)
          return (
            <div key={section.id} className="flex justify-center px-1.5 py-0.5">
              <button
                type="button"
                ref={(node) => {
                  if (node) railSectionButtonRefs.current.set(section.id, node)
                  else railSectionButtonRefs.current.delete(section.id)
                  registerNavFocusRef(sectionRailKey, node)
                }}
                title={section.titleTooltip ?? section.title}
                aria-label={section.title}
                aria-expanded={flyoutOpen}
                aria-haspopup="menu"
                aria-current={isRailActive ? 'true' : undefined}
                onFocus={() => setNavFocusKey(sectionRailKey)}
                onMouseEnter={() => setRailHoverSectionId(section.id)}
                onMouseLeave={() => {
                  setRailHoverSectionId((prev) => (prev === section.id ? null : prev))
                }}
                onClick={() => toggleRailSection(section.id)}
                className={cn(
                  RAIL_ICON_BTN_CLASS,
                  'sidebar-nav-rail-btn',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35',
                  isRailActive && 'sidebar-nav-rail-btn-active',
                  navFocusKey === sectionRailKey && navRailKbFocus,
                )}
              >
                <SectionIcon className={cn(RAIL_ICON_CLASS)} strokeWidth={2} aria-hidden />
              </button>
            </div>
          )
        })}
      </nav>

      {/* Full navigation — hidden on desktop when icon rail is active */}
      <div
        className={cn(
          'flex min-h-0 min-w-0 flex-1 flex-col',
          showIconOnlyNav && 'lg:hidden',
          !showIconOnlyNav && 'lg:flex',
        )}
      >
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
          tabIndex={navReorderMode ? undefined : 0}
          className="sidebar-scroll sidebar-scroll-intent sidebar-scroll-left flex min-h-0 flex-1 flex-col overflow-y-auto px-2 pb-1 pt-0.5 outline-none"
          aria-label="Main navigation"
          onFocus={(e) => {
            if (e.target !== e.currentTarget || navFocusKey || !sidebarNavNodes[0]) return
            setNavFocusKey(sidebarNavNodes[0].key)
          }}
          onKeyDown={(e) => handleSidebarNavKeyDown(e, sidebarNavNodes)}
        >
          <div className="mb-0.5 flex shrink-0 items-center justify-between gap-2 px-0.5 py-1">
            <span className={cn('text-xs uppercase tracking-wide text-muted-foreground/80', NAV_FONT_TAB)}>
              Modules
            </span>
            <div className="flex shrink-0 items-center gap-1">
              {navReorderMode && (
                <button
                  type="button"
                  aria-label="Reset menu order to default and exit reorder mode"
                  onClick={resetNavOrderToDefaults}
                  className={cn(
                    'rounded-md px-2 py-px text-xs uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                    NAV_FONT_TAB,
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
                        for (const s of sidebarSections) {
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
                  'rounded-md px-2 py-px text-xs uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  NAV_FONT_TAB,
                  navReorderMode
                    ? 'bg-primary text-white shadow-sm hover:bg-primary/90 dark:bg-primary dark:hover:bg-accent'
                    : 'text-muted-foreground/90 hover:bg-muted/60 hover:text-foreground',
                )}
              >
                {navReorderMode ? 'Done' : 'Reorder'}
              </button>
            </div>
          </div>

          {showAppsPickerHint && !navReorderMode ? (
            <p className="mb-1 px-1.5 text-[11px] leading-snug text-muted-foreground">
              <button
                type="button"
                className="font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 rounded-sm"
                onClick={() => setAppsPickerOpen(true)}
              >
                Add apps
              </button>
              {' '}
              to show more modules in your sidebar.
            </p>
          ) : null}

          <SortableContext
            id="nav-sections-order"
            items={sidebarSections.map((s) => secDndId(s.id))}
            strategy={verticalListSortingStrategy}
          >
            {sidebarSections.map((section) => {
              const isSectionCollapsed = collapsedSections[section.title] ?? true
              const orderedItems = orderedNavItemsBySectionId.get(section.id) ?? section.items
              const sectionHasActive = orderedItems.some((it) => activeNavTo === it.to)

              const SectionIcon = section.icon
              const sectionPanelId = `nav-section-${section.id}`
              const sortLocked = !navReorderMode
              const secDnd = secDndId(section.id)
              const sectionFocusKey = secFocusKey(section.id)
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
                >
                  {(secListeners, secAttributes) => (
                    <>
                      <div className={cn('flex items-center gap-0.5', NAV_ROW_MIN_H)}>
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
                          ref={(el) => registerNavFocusRef(sectionFocusKey, el)}
                          aria-expanded={!isSectionCollapsed}
                          aria-controls={sectionPanelId}
                          onFocus={() => setNavFocusKey(sectionFocusKey)}
                          className={cn(
                            'group/sec flex min-w-0 flex-1 items-center gap-1.5 rounded-lg px-1 text-left',
                            NAV_ROW_MIN_H,
                            NAV_ROW_PAD_Y,
                            navRowTransition,
                            sectionHasActive && !isSectionCollapsed
                              ? cn(
                                  isTemplate2 ? 'sidebar-nav-section-active-expanded px-2' : NAV_SECTION_BG_ACTIVE,
                                  'text-foreground',
                                )
                              : sectionHasActive && isSectionCollapsed
                                ? cn(NAV_SECTION_BG_ACTIVE_COLLAPSED, 'text-foreground')
                                : cn('text-muted-foreground hover:text-foreground', NAV_SECTION_BG_HOVER),
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35 focus-visible:ring-offset-1 focus-visible:ring-offset-background',
                            navFocusKey === sectionFocusKey && navSectionKbFocus,
                          )}
                          onClick={() => toggleSection(section.title, section.id)}
                        >
                          <span
                            className={cn(
                              NAV_ICON_COL,
                              NAV_SECTION_ICON_BG,
                              sectionHasActive && NAV_SECTION_ICON_BG_ACTIVE,
                            )}
                          >
                            <SectionIcon className="h-4 w-4" strokeWidth={2} aria-hidden />
                          </span>
                          <div className={cn('min-w-0 flex-1', NAV_ROW_PAD_Y)}>
                            <span
                              className={cn(
                                'block truncate text-sm leading-snug tracking-normal',
                                sectionHasActive ? NAV_FONT_SECTION_ACTIVE : NAV_FONT_SECTION,
                                sectionHasActive ? 'text-foreground' : 'text-sidebar-foreground',
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
                                'h-4 w-4 transition-transform duration-200 ease-out motion-reduce:transition-none',
                                isSectionCollapsed ? '-rotate-90' : 'rotate-180',
                                sectionHasActive && (isSectionCollapsed || isTemplate2)
                                  ? 'text-primary'
                                  : 'text-muted-foreground/70',
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
                            className={cn(
                              'relative ml-1 py-1',
                              isTemplate2 && 'py-0.5',
                              NAV_TREE_PANEL_CLASS,
                              NAV_TREE_SUB_PANEL_CLASS,
                            )}
                            role="group"
                            aria-label={`${section.title} pages`}
                          >
                            {/* Full module rail — spans all pages in this section */}
                            <span aria-hidden className={navTreeTrunkLine} />
                            <SortableContext
                              id={`nav-items-${section.id}`}
                              items={orderedItems.map((i) => itmDndId(section.id, i.to))}
                              strategy={verticalListSortingStrategy}
                            >
                              <div className={cn(isTemplate2 ? NAV_SUB_STACK : 'space-y-px')}>
                                {(() => {
                                  const itemGroups = effectiveNavGroupLabels(orderedItems)
                                  const blocks = buildNavItemBlocks(orderedItems, itemGroups, section.title)

                                  const renderNavRow = (
                                    item: NavItem,
                                    tree: 'section' | 'sub',
                                    tabIndexOff: boolean,
                                  ) => {
                                    const elbow = tree === 'sub' ? navTreeSubElbowLine : navTreeElbowLine
                                    const thisItemDndId = itmDndId(section.id, item.to)
                                    const itemKey = itemFocusKey(section.id, item.to)
                                    const routeActive = activeNavTo === item.to
                                    const isItemKbFocused = navFocusKey === itemKey
                                    return (
                                      <SortableItemShell
                                        key={item.to + item.label}
                                        sectionId={section.id}
                                        itemTo={item.to}
                                        sortDisabled={sortLocked}
                                        outlineDropTarget={navReorderMode && navDndOverId === thisItemDndId}
                                        hideSourceWhileDragging={
                                          navReorderMode && navActiveDndId === thisItemDndId
                                        }
                                      >
                                        {(itemListeners, itemAttributes) => (
                                          <div
                                            className={cn(
                                              'relative flex w-full min-w-0 flex-1 items-center gap-0.5',
                                              NAV_ROW_MIN_H,
                                            )}
                                          >
                                            <span aria-hidden className={elbow} />
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
                                                tabIndex={isSectionCollapsed || tabIndexOff ? -1 : undefined}
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
                                                ref={(el) => registerNavFocusRef(itemKey, el)}
                                                tabIndex={isSectionCollapsed || tabIndexOff ? -1 : undefined}
                                                onFocus={() => setNavFocusKey(itemKey)}
                                                onClick={() => setSidebarOpen(false)}
                                                className={navItemLinkClass(item, {
                                                  isActive: false,
                                                  isKbFocused: isItemKbFocused,
                                                  tree,
                                                })}
                                              >
                                                <span className={cn(NAV_ICON_COL, 'text-muted-foreground/80 group-hover/nav:text-sidebar-primary')}>
                                                  <item.icon className="h-4 w-4" strokeWidth={2} aria-hidden />
                                                </span>
                                                <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
                                              </a>
                                            ) : (
                                              <NavLink
                                                to={item.to}
                                                title={item.label}
                                                ref={(el) => registerNavFocusRef(itemKey, el)}
                                                tabIndex={isSectionCollapsed || tabIndexOff ? -1 : undefined}
                                                onFocus={() => setNavFocusKey(itemKey)}
                                                onClick={() => setSidebarOpen(false)}
                                                className={({ isPending }) =>
                                                  navItemLinkClass(item, {
                                                    isActive: routeActive || isPending,
                                                    isKbFocused: isItemKbFocused,
                                                    tree,
                                                  })
                                                }
                                              >
                                                {({ isPending }) => {
                                                  const isItemActive = routeActive || isPending
                                                  return (
                                                    <>
                                                <span
                                                  className={cn(
                                                    NAV_ICON_COL,
                                                    isItemActive
                                                      ? 'text-inherit'
                                                      : 'text-muted-foreground/80 group-hover/nav:text-sidebar-primary',
                                                  )}
                                                >
                                                  <item.icon className="h-4 w-4" strokeWidth={2} aria-hidden />
                                                </span>
                                                <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
                                                <NavCountBadge count={getNavBadgeCount(item.to)} />
                                                    </>
                                                  )
                                                }}
                                              </NavLink>
                                            )}
                                          </div>
                                        )}
                                      </SortableItemShell>
                                    )
                                  }

                                  return blocks.map((block, blockIdx) => {
                                    if (block.kind === 'items') {
                                      return (
                                        <div key={`sec-items-${blockIdx}`} className={cn('relative', isTemplate2 ? NAV_SUB_STACK : 'space-y-px')}>
                                          {block.entries.map(({ item }) =>
                                            renderNavRow(item, 'section', isSectionCollapsed),
                                          )}
                                        </div>
                                      )
                                    }

                                    const isGroupCollapsed = resolveNavGroupCollapsed(block.grpKey, collapsedGroups)
                                    const groupHasActive = block.entries.some(
                                      ({ item }) => activeNavTo === item.to,
                                    )
                                    const groupFocusKey = grpFocusKey(block.grpKey)

                                    return (
                                      <div key={block.grpKey} className={cn('relative', blockIdx > 0 && 'mt-0.5')}>
                                        <button
                                          type="button"
                                          ref={(el) => registerNavFocusRef(groupFocusKey, el)}
                                          tabIndex={isSectionCollapsed ? -1 : undefined}
                                          onFocus={() => setNavFocusKey(groupFocusKey)}
                                          onClick={() =>
                                            toggleGroup(
                                              block.grpKey,
                                              section.id,
                                              block.entries.map(({ item }) => item),
                                            )
                                          }
                                          aria-expanded={!isGroupCollapsed}
                                          className={cn(
                                            // Clear trunk + elbow (link-gap + elbow-r) so the rail never clips the label.
                                            'relative flex w-full items-center gap-1.5 rounded-md pr-1 pl-[calc(var(--tree-x)+var(--tree-link-gap)+0.5rem)] text-left text-xs uppercase tracking-wide',
                                            NAV_GROUP_ROW_MIN_H,
                                            NAV_ROW_PAD_Y,
                                            NAV_FONT_GROUP,
                                            navRowTransition,
                                            'text-muted-foreground/80 hover:bg-muted/20 hover:text-foreground',
                                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35 focus-visible:ring-offset-1 focus-visible:ring-offset-background',
                                            groupHasActive && cn(NAV_FONT_SECTION_ACTIVE, 'text-foreground'),
                                            navFocusKey === groupFocusKey && navGroupKbFocus,
                                          )}
                                        >
                                          <span aria-hidden className={navTreeElbowLine} />
                                          <span className="relative z-[2] flex min-w-0 flex-1 items-center gap-1.5">
                                            {groupHasActive && (
                                              <span className="h-1 w-1 shrink-0 rounded-full bg-accent dark:bg-primary/50" />
                                            )}
                                            <span className="truncate">{block.label}</span>
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
                                        {!isGroupCollapsed && (
                                          <div className={cn('relative', isTemplate2 ? NAV_SUB_STACK : 'space-y-px')}>
                                            <span aria-hidden className={navTreeSubgroupTrunk} />
                                            {block.entries.map(({ item }) =>
                                              renderNavRow(item, 'sub', isSectionCollapsed),
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })
                                })()}
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
                      'pointer-events-none flex min-w-[13rem] max-w-[17rem] items-center gap-0.5 rounded-lg border border-sidebar-border/80 bg-sidebar pl-1 pr-2 text-sidebar-foreground shadow-xl ring-2 ring-sidebar-primary/50',
                      NAV_ROW_MIN_H,
                      NAV_ROW_PAD_Y,
                    )}
                  >
                    <span className={NAV_DRAG_COL}>
                      <GripVertical className="h-2.5 w-2.5 text-muted-foreground" strokeWidth={2} aria-hidden />
                    </span>
                    <span className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg py-0.5 pl-1 pr-0">
                      <span className={cn(NAV_ICON_COL, 'text-muted-foreground')}>
                        <OI className="h-4 w-4" strokeWidth={2} aria-hidden />
                      </span>
                      <span
                        className={cn(
                          'min-w-0 flex-1 truncate text-left',
                          NAV_FONT_SECTION,
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
                      'pointer-events-none flex min-w-[13rem] max-w-[17rem] items-center gap-1.5 rounded-lg border border-sidebar-border/80 bg-sidebar px-2 text-sidebar-foreground shadow-xl ring-2 ring-sidebar-primary/50',
                      NAV_ROW_MIN_H,
                      NAV_ROW_PAD_Y,
                    )}
                  >
                    <span
                      className={cn(
                        NAV_ICON_COL,
                        'rounded-md bg-muted/60 text-muted-foreground ring-1 ring-border/25',
                      )}
                    >
                      <OI className="h-4 w-4" strokeWidth={2} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className={cn('block truncate text-xs leading-snug', NAV_FONT_SECTION_ACTIVE)}>{pl.title}</span>
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
      </div>

      {/* Logout — clear footer action */}
      <div
        className={cn(
          'shrink-0 px-2 py-2',
          showIconOnlyNav && 'lg:px-1.5',
        )}
      >
        <button
          type="button"
          onClick={logout}
          title="Logout"
          className={cn(
            'flex w-full items-center gap-1.5 rounded-lg border border-border bg-background px-2 text-sm font-medium text-foreground shadow-none',
            NAV_ROW_MIN_H,
            NAV_ROW_PAD_Y,
            NAV_FONT_SECTION,
            navRowTransition,
            showIconOnlyNav && 'lg:justify-center lg:px-1',
            'hover:border-red-300 hover:bg-red-50 hover:text-red-700',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200 focus-visible:ring-offset-0',
            'dark:hover:border-red-800 dark:hover:bg-red-950/40 dark:hover:text-red-300',
          )}
        >
          <span
            className={cn(
              NAV_ICON_COL,
              'text-red-600 dark:text-red-400',
              showIconOnlyNav && 'lg:h-[1.875rem] lg:w-[1.875rem]',
            )}
          >
            <LogOut className={cn('h-4 w-4', showIconOnlyNav && 'lg:h-5 lg:w-5')} aria-hidden />
          </span>
          <span className={cn('min-w-0 flex-1 truncate text-left', showIconOnlyNav && 'lg:hidden')}>Logout</span>
        </button>
      </div>
    </div>
  )

  const sidebarWidthStyle =
    sidebarMode !== 'hidden'
      ? ({ '--sidebar-width': `${sidebarWidthPx}px` } as CSSProperties)
      : undefined

  /** Platform admin iframe: same HR (and other) pages without vendor chrome. */
  if (isVendorAdminEmbed()) {
    return (
      <div className="min-h-screen overflow-x-clip bg-background font-sans text-foreground">
        <main className="min-w-0 overflow-x-clip [overscroll-behavior-y:none] p-4 sm:p-6 lg:p-8 bg-background font-sans text-sm">
          <RestaurantScopeBanner />
          <FieldMappingProvider>
            <Outlet />
          </FieldMappingProvider>
        </main>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen overflow-x-clip bg-background font-sans text-foreground"
      style={sidebarWidthStyle}
    >
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 z-40 lg:hidden backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar — single instance so nav scroll ref targets the visible panel */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 min-w-0 border-r border-sidebar-border bg-sidebar font-sans text-sidebar-foreground text-sm shadow-sm',
          'max-lg:w-[min(17.5rem,100vw)] max-lg:max-w-[min(100vw,18rem)]',
          'transition-[transform,filter] duration-200 ease-out motion-reduce:transition-none',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          sidebarMode === 'hidden' ? 'lg:-translate-x-full' : 'lg:translate-x-0',
          isSidebarResizing && 'transition-none will-change-[width]',
          kiterpModalOpen
            ? 'z-0 pointer-events-none'
            : 'z-50 lg:z-30',
        )}
        aria-hidden={kiterpModalOpen || undefined}
        style={
          sidebarMode !== 'hidden'
            ? {
                ['--sidebar-width' as string]: `${sidebarWidthPx}px`,
                width: sidebarOpen
                  ? `min(${sidebarWidthPx}px, 100vw)`
                  : sidebarWidthPx,
                maxWidth: sidebarOpen
                  ? `min(${sidebarWidthPx}px, 100vw)`
                  : SIDEBAR_WIDTH_MAX_PX,
              }
            : undefined
        }
      >
        {sidebarContent}
        {sidebarMode !== 'hidden' && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize sidebar. Drag left for icon-only menu, right for full labels. Double-click or Home resets width."
            aria-valuemin={SIDEBAR_WIDTH_MIN_PX}
            aria-valuemax={SIDEBAR_WIDTH_MAX_PX}
            aria-valuenow={sidebarWidthPx}
            tabIndex={0}
            onPointerDown={startSidebarResize}
            onDoubleClick={resetSidebarWidth}
            onKeyDown={onSidebarResizeKeyDown}
            className={cn(
              'absolute right-0 top-0 bottom-0 z-[55] hidden w-3 cursor-col-resize touch-none lg:block',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/50',
            )}
          />
        )}
      </aside>

      {/* Desktop: collapse control centered on sidebar × header divider junction */}
      {/* z-[85]: above sticky header (z-[80]); hidden while modals are open so it does not sit on the dialog */}
      <button
        type="button"
        onClick={toggleSidebarDesktop}
        aria-expanded={sidebarMode !== 'hidden'}
        aria-label={sidebarDesktopToggleLabel}
        title={sidebarDesktopToggleLabel}
        aria-hidden={kiterpModalOpen || undefined}
        tabIndex={kiterpModalOpen ? -1 : undefined}
        className={cn(
          'fixed z-[85] hidden h-7 w-7 items-center justify-center border border-border bg-card text-muted-foreground shadow-sm',
          'hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
          'top-14 -translate-y-1/2 lg:flex',
          (isSidebarResizing || kiterpModalOpen) && 'lg:pointer-events-none lg:opacity-0',
          !isSidebarResizing && !kiterpModalOpen && 'transition-[left,opacity] duration-200 ease-out motion-reduce:transition-none',
          sidebarMode === 'hidden' && 'left-0 rounded-r-md border-l-0',
          sidebarMode !== 'hidden' && 'lg:left-[var(--sidebar-width)] -translate-x-1/2 rounded-md',
        )}
      >
        {sidebarMode === 'hidden' ? (
          <PanelLeft className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
        ) : (
          <PanelLeftClose className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
        )}
      </button>

      {railFlyoutMenu}

      {/* Main content */}
      <div
        className={cn(
          'overflow-x-clip',
          sidebarMode === 'hidden' && 'lg:ml-0',
          sidebarMode !== 'hidden' && 'lg:ml-[var(--sidebar-width)]',
          isSidebarResizing && 'will-change-[margin-left]',
          !isSidebarResizing && 'transition-[margin-left] duration-200 ease-out motion-reduce:transition-none',
        )}
        style={
          sidebarMode !== 'hidden'
            ? ({ ['--sidebar-width' as string]: `${sidebarWidthPx}px` } as CSSProperties)
            : undefined
        }
      >
        {/* Top bar — title left; toolbar packed at the right end */}
        {/* z-[80]: keep header actions (bell, profile) above rail-flyout dismiss layer (z-[69]). */}
        {/* When a [data-kiterp-modal] is open, drop below the overlay (z-[100]) and inert the bar. */}
        <header
          className={cn(
            'sticky top-0 overflow-visible bg-card/95 backdrop-blur-md',
            'shadow-[0_1px_0_0_hsl(var(--border)),0_4px_12px_-2px_rgba(15,23,42,0.08)]',
            'dark:shadow-[0_1px_0_0_hsl(var(--border)),0_4px_14px_-2px_rgba(0,0,0,0.35)]',
            'transition-[box-shadow,z-index] duration-150 ease-out motion-reduce:transition-none',
            kiterpModalOpen
              ? 'z-0 pointer-events-none select-none shadow-none backdrop-blur-none bg-card'
              : 'z-[80]',
          )}
          aria-hidden={kiterpModalOpen || undefined}
        >
          <div className="flex h-14 w-full min-w-0 items-center gap-1.5 px-2 sm:gap-2 sm:px-3">
            {/* Title — flexes on mobile so the toolbar never overflows */}
            <div className="flex h-9 min-w-0 flex-1 items-center gap-1 sm:h-8 lg:max-w-[14rem] lg:flex-none lg:shrink-0 lg:gap-1.5">
              <button
                type="button"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted lg:hidden"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open menu"
                tabIndex={kiterpModalOpen ? -1 : undefined}
              >
                <Menu className="h-5 w-5" />
              </button>

              <h1
                className="min-w-0 flex-1 truncate text-[15px] font-semibold leading-tight text-foreground sm:text-base sm:leading-none"
                title={pageTitle}
              >
                {location.pathname === '/settings'
                  ? settingsSectionTitle
                    ? `${settingsSectionTitle} · Settings`
                    : `Settings · ${settingsScopeHeading}`
                  : pageTitle}
              </h1>
            </div>

            <div className="min-h-px min-w-0 flex-1 max-lg:hidden" aria-hidden />

            {/* Toolbar — pinned to the right end; condensed below lg */}
            <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
              {showRmSupportAudit ? (
                <Link
                  to="/settings/support-activity"
                  className="hidden h-8 shrink-0 items-center gap-1 rounded-md border border-primary/20 bg-primary/5 px-2 text-[11px] font-medium text-primary transition-colors hover:bg-primary/10 md:inline-flex"
                >
                  <HelpCircle className="h-3 w-3 shrink-0" />
                  Support audit
                </Link>
              ) : null}
              <HeaderQuickActionButtons
                helpRef={helpRef}
                moreRef={moreRef}
                helpOpen={helpOpen}
                setHelpOpen={setHelpOpen}
                moreOpen={moreOpen}
                setMoreOpen={setMoreOpen}
                onOpenSearch={() => setSearchOpen(true)}
                onNavigateNotifications={() => navigate('/notifications')}
                onNavigateSettings={() => navigate('/settings')}
              />

              <div ref={storePickerRef} className="relative shrink-0">
                <button
                  type="button"
                  onClick={openStorePicker}
                  aria-expanded={storePickerOpen}
                  aria-haspopup="listbox"
                  title={storeHeaderName}
                  className={cn(
                    headerBarPillClass,
                    'h-9 w-9 justify-center gap-0 p-0 lg:h-8 lg:w-[min(12rem,28vw)] lg:min-w-[9rem] lg:gap-1 lg:px-2',
                    storePillActive
                      ? 'border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/15 hover:bg-primary/90 hover:border-primary'
                      : 'transition-colors hover:bg-muted hover:text-foreground',
                  )}
                >
                  {rowForHeader ? (
                    <BusinessUnitLogoThumb
                      store={rowForHeader}
                      vendor={vendor}
                      variant={storePillActive ? 'onPrimary' : 'default'}
                      className="h-5 w-5"
                      iconClassName={cn('h-3 w-3 shrink-0', storePillActive ? 'text-white' : 'text-current')}
                    />
                  ) : (
                    <span
                      className={cn(
                        'flex h-5 w-5 shrink-0 items-center justify-center rounded',
                        storePillActive
                          ? 'bg-white/15 text-white'
                          : 'bg-muted text-muted-foreground',
                      )}
                      aria-hidden
                    >
                      <Store className="h-3 w-3 shrink-0" />
                    </span>
                  )}
                  <span className="hidden min-w-0 flex-1 truncate lg:block" title={storeHeaderName}>
                    {storeHeaderName}
                  </span>
                  <ChevronDown
                    className={cn(
                      'hidden h-3 w-3 shrink-0 opacity-70 transition-transform duration-200 motion-reduce:transition-none lg:block',
                      storePickerOpen && 'rotate-180',
                    )}
                  />
                </button>
                {storePickerMenu}
              </div>

              <button
                type="button"
                title="Notifications"
                aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
                onClick={() => {
                  setStorePickerOpen(false)
                  setProfileOpen(false)
                  setRailFlyoutSectionId(null)
                  setHelpOpen(false)
                  setMoreOpen(false)
                  navigate('/notifications')
                }}
                className="relative z-[81] flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/40 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:h-8 lg:w-8"
              >
                <Bell className="h-3.5 w-3.5" />
                {unreadCount > 0 && (
                  <span className={cn(headerNotificationBadgeClass(unreadCount), 'pointer-events-none')}>
                    {formatBadgeCount(unreadCount)}
                  </span>
                )}
              </button>

              <div ref={profileMenuRef} className="relative flex shrink-0 items-center">
                <button
                  type="button"
                  onClick={() => setProfileOpen(v => !v)}
                  title={profileHoverTitle}
                  aria-label={profileHoverTitle ?? 'Open profile menu'}
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-md p-0.5 lg:h-8 lg:w-auto lg:max-w-[9.5rem] lg:min-w-0 lg:gap-1 lg:justify-start lg:py-0.5 lg:pl-0.5 lg:pr-1',
                    profileOpen ? 'bg-muted ring-1 ring-border/60' : 'hover:bg-muted/70',
                  )}
                >
                  <ProfileAvatar
                    user={user}
                    className="h-5 w-5 shrink-0 ring-1 ring-primary/20"
                  />
                  <span className="hidden min-w-0 flex-1 truncate text-left text-[11px] leading-tight lg:block" title={profileHoverTitle}>
                    <span className="font-medium text-foreground">{profileDisplayName}</span>
                    <span className="text-muted-foreground"> · {roleBadge}</span>
                  </span>
                  <ChevronDown className={cn('hidden h-3 w-3 shrink-0 text-muted-foreground lg:block', profileOpen && 'rotate-180')} />
                </button>

                {profileOpen && profilePanelPos && createPortal(
                  <>
                    <button
                      type="button"
                      aria-label="Close profile menu"
                      className="fixed inset-0 z-[99] bg-black/20 sm:bg-transparent sm:pointer-events-none"
                      onClick={() => setProfileOpen(false)}
                    />
                    <div
                      ref={profilePanelRef}
                      style={{
                        top: profilePanelPos.top,
                        left: profilePanelPos.left,
                        width: profilePanelPos.width,
                      }}
                      className="fixed z-[100] flex max-h-[min(32rem,calc(100dvh-4.5rem))] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
                    >
                      {/* User header — fixed at top of panel */}
                      <div className="shrink-0 border-b border-white/10 bg-[linear-gradient(90deg,hsl(var(--primary))_0%,hsl(var(--hero-via))_42%,hsl(var(--hero-to))_100%)] px-4 py-3 text-white">
                        <div className="flex items-center gap-3">
                          <ProfileAvatar
                            user={user}
                            className="h-10 w-10 shadow-md ring-1 ring-white/15"
                            textClassName="text-sm font-bold"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-white" title={profileName || undefined}>
                              {user?.full_name}
                            </p>
                            <span className="mt-0.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium bg-white/15 text-white ring-1 ring-white/25">
                              <ShieldCheck className="h-2.5 w-2.5" aria-hidden />
                              {roleBadge}
                            </span>
                            {user?.email && (
                              <p className="mt-1 truncate text-xs text-emerald-100/85" title={user.email}>
                                {user.email}
                              </p>
                            )}
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
                              'relative h-6 w-11 shrink-0 rounded-full border-2 overflow-hidden transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                              dark
                                ? 'border-transparent bg-primary'
                                : 'border-gray-300 bg-gray-200 dark:border-gray-500 dark:bg-gray-600',
                            )}
                          >
                            <span
                              className={cn(
                                'pointer-events-none absolute top-[2px] left-[2px] block h-[18px] w-[18px] rounded-full bg-white shadow ring-1 ring-black/5 transition-transform duration-200 ease-out',
                                dark && 'translate-x-5',
                              )}
                            />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setProfileOpen(false)
                            setKitThemePickerOpen(true)
                          }}
                          className="flex w-full items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-accent"
                        >
                          <Palette className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="flex-1 text-left">Change KIT ERP theme</span>
                          <span className="inline-flex items-center gap-1 shrink-0">
                            {activeKitTheme.swatches.slice(0, 2).map((color, i) => (
                              <span
                                key={`${activeKitTheme.id}-${i}`}
                                className="h-3 w-3 rounded-full border border-border/80"
                                style={{ backgroundColor: color }}
                                aria-hidden
                              />
                            ))}
                          </span>
                        </button>
                        <Link
                          to="/profile"
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-accent"
                        >
                          <UserIcon className="w-4 h-4 text-muted-foreground" />
                          <span className="flex-1">My Profile</span>
                        </Link>
                        <Link
                          to="/notifications"
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-accent"
                        >
                          <Bell className="w-4 h-4 text-muted-foreground" />
                          <span className="flex-1">Notifications</span>
                          {unreadCount > 0 && (
                            <span className={countBadgeCircleClass(unreadCount)}>
                              {formatBadgeCount(unreadCount)}
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

                      {/* Business switcher — only visible when the user has access to multiple accounts */}
                      {accessibleVendors.length > 1 && (
                        <div className="py-1 border-t border-border">
                          <ProfileMenuLabel>Switch Business</ProfileMenuLabel>
                          {accessibleVendors.map((v) => {
                            const isActive = v.id === vendor?.id
                            return (
                              <button
                                key={v.id}
                                type="button"
                                onClick={() => switchVendor(v)}
                                className={cn(
                                  'flex w-full items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-accent transition-colors text-left',
                                  isActive && 'bg-primary/10 dark:bg-primary/15',
                                )}
                              >
                                {v.logo_url ? (
                                  <img src={v.logo_url} alt="" className="h-6 w-6 shrink-0 rounded-md object-cover" />
                                ) : (
                                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-[10px] font-bold text-muted-foreground uppercase">
                                    {(v.display_name || v.business_name || '?')[0]}
                                  </span>
                                )}
                                <span className="min-w-0 flex-1 truncate">{v.display_name || v.business_name}</span>
                                {isActive && (
                                  <Check className="h-4 w-4 shrink-0 text-primary" />
                                )}
                              </button>
                            )
                          })}
                        </div>
                      )}

                      {/* Workspace section */}
                      <div className="py-1 border-t border-border">
                        <ProfileMenuLabel>Workspace</ProfileMenuLabel>
                        <Link
                          to="/settings"
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-accent"
                        >
                          <Settings className="w-4 h-4 text-muted-foreground" />
                          <span className="flex-1">{BUSINESS_UNIT_STORE_SETTINGS_LINK}</span>
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
                            <span className="text-xs text-muted-foreground font-mono truncate max-w-[110px]">{SUPPORT_PHONE}</span>
                          </a>
                        ) : (
                          <Link
                            to="/settings"
                            onClick={() => setProfileOpen(false)}
                            className="flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-accent"
                          >
                            <Phone className="w-4 h-4 text-muted-foreground" />
                            <span className="flex-1">Call support</span>
                            <span className="text-xs text-muted-foreground">Set phone</span>
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
                          to="/about"
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-accent"
                        >
                          <Info className="w-4 h-4 text-muted-foreground" />
                          <span className="flex-1">About &amp; version</span>
                        </Link>
                      </div>
                      </div>

                      {/* Logout — always visible at bottom */}
                      <div className="shrink-0 px-2 py-2">
                        <button
                          type="button"
                          onClick={() => { setProfileOpen(false); logout() }}
                          className="flex w-full items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-medium text-foreground hover:border-red-300 hover:bg-red-50 hover:text-red-700 dark:hover:border-red-800 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                        >
                          <LogOut className="h-4 w-4 text-red-600 dark:text-red-400" />
                          <span className="flex-1 text-left">Logout</span>
                        </button>
                      </div>
                    </div>
                  </>,
                  document.body,
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

        <KitErpThemePickerModal
          open={kitThemePickerOpen}
          onClose={() => setKitThemePickerOpen(false)}
        />

        <SidebarAppsPickerModal
          open={appsPickerOpen}
          onClose={() => setAppsPickerOpen(false)}
          sections={appsPickerSections}
          enabledIds={enabledSectionIds}
          onEnabledChange={(ids) => {
            if (!isOwnerOrAdmin) {
              toast.error(SIDEBAR_APPS_ADMIN_ONLY_MESSAGE)
              return
            }
            setEnabledSectionIds(normalizeEnabledSectionIds(ids, allVisibleSectionIds))
          }}
        />

        {/* Page content */}
        <main className="min-w-0 overflow-x-clip [overscroll-behavior-y:none] p-4 sm:p-6 lg:p-8 bg-background font-sans text-sm">
          <RestaurantScopeBanner />
          <FieldMappingProvider>
            <Outlet />
          </FieldMappingProvider>
        </main>
      </div>
    </div>
  )
}
