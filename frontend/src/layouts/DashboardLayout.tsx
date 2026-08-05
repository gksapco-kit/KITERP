import { useEffect, useState } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { useDocumentSeo, adminPageTitle } from '@/lib/documentSeo'
import {
  LayoutDashboard,
  Package,
  Wrench,
  Warehouse,
  Settings,
  LogOut,
  Store,
  Users,
  CreditCard,
  Headphones,
  ScrollText,
  AlertTriangle,
  Menu,
  Table2,
  LayoutTemplate,
  BarChart3,
  UsersRound,
  ShieldCheck,
  UserCog,
  Landmark,
  ChevronDown,
  X,
  type LucideIcon,
} from 'lucide-react'
import { cn, mediaUrl } from '@/lib/utils'
import { useLogout } from '@/hooks/useAuth'
import { useAuthStore } from '@/stores/authStore'
import { getDashboardUserRoleLabel, isPlatformStaff, isSuperuserAdmin } from '@/lib/platformAccess'
import { HR_ADMIN_BASE, HR_ADMIN_NAV_ITEMS, getHrAdminNavItem } from '@/lib/hrAdminNav'
import { CRM_ADMIN_BASE, CRM_ADMIN_NAV_ITEMS, getCrmAdminNavItem } from '@/lib/crmAdminNav'
import { FINANCE_ADMIN_BASE, FINANCE_ADMIN_NAV_ITEMS, getFinanceAdminNavItem } from '@/lib/financeAdminNav'
import { useVendorStore } from '@/stores/vendorStore'
import { Button } from '@/components/ui/button'
import ResponsiveViewportBadge from '@/components/dev/ResponsiveViewportBadge'

type NavItem = {
  to: string
  icon: LucideIcon
  label: string
  expandableHr?: boolean
  expandableCrm?: boolean
  expandableFinance?: boolean
}

const vendorNavItems: NavItem[] = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/dashboard/products', icon: Package, label: 'Products' },
  { to: '/dashboard/services', icon: Wrench, label: 'Services' },
  { to: '/dashboard/inventory', icon: Warehouse, label: 'Inventory' },
  { to: '/dashboard/settings', icon: Settings, label: 'Settings' },
]

const adminNavItemsSuperuser: NavItem[] = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/dashboard/vendors', icon: Users, label: 'Business Accounts' },
  { to: '/dashboard/plans', icon: CreditCard, label: 'Plans' },
  { to: '/dashboard/templates', icon: LayoutTemplate, label: 'All Templates' },
  { to: '/dashboard/website-analytics', icon: BarChart3, label: 'Website Analytics' },
  { to: '/dashboard/platform-team', icon: Headphones, label: 'Support team' },
  { to: '/dashboard/user-roles', icon: ShieldCheck, label: 'User Roles' },
  { to: '/dashboard/account-activity', icon: ScrollText, label: 'Account activity' },
  { to: CRM_ADMIN_BASE, icon: UsersRound, label: 'CRM Management', expandableCrm: true },
  { to: FINANCE_ADMIN_BASE, icon: Landmark, label: 'Finance Management', expandableFinance: true },
  { to: HR_ADMIN_BASE, icon: UserCog, label: 'HR Management', expandableHr: true },
  { to: '/dashboard/disputes', icon: AlertTriangle, label: 'Disputes' },
  { to: '/dashboard/table-data', icon: Table2, label: 'Table Data' },
  { to: '/dashboard/settings', icon: Settings, label: 'Settings' },
]

const adminNavItemsSupport: NavItem[] = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/dashboard/vendors', icon: Users, label: 'Business Accounts' },
  { to: '/dashboard/website-analytics', icon: BarChart3, label: 'Website Analytics' },
  { to: '/dashboard/account-activity', icon: ScrollText, label: 'Account activity' },
  { to: CRM_ADMIN_BASE, icon: UsersRound, label: 'CRM Management', expandableCrm: true },
  { to: FINANCE_ADMIN_BASE, icon: Landmark, label: 'Finance Management', expandableFinance: true },
  { to: HR_ADMIN_BASE, icon: UserCog, label: 'HR Management', expandableHr: true },
]

function ProfileAvatar({
  user,
  className,
  textClassName = 'text-sm font-bold',
}: {
  user: { full_name?: string; avatar_url?: string | null } | null | undefined
  className?: string
  textClassName?: string
}) {
  const initial = (user?.full_name || 'U').trim().charAt(0).toUpperCase() || 'U'
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-primary-foreground',
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

const adminPageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/vendors': 'Business Accounts',
  '/dashboard/plans': 'Plans',
  '/dashboard/templates': 'All Templates',
  '/dashboard/website-analytics': 'Website Analytics',
  '/dashboard/platform-team': 'Support Team',
  '/dashboard/user-roles': 'User Roles',
  '/dashboard/account-activity': 'Account Activity',
  '/dashboard/crm': 'CRM Management',
  '/dashboard/finance': 'Finance Management',
  '/dashboard/hr': 'HR Management',
  '/dashboard/disputes': 'Disputes',
  '/dashboard/table-data': 'Table Data',
  '/dashboard/settings': 'Settings',
  '/dashboard/products': 'Products',
  '/dashboard/services': 'Services',
  '/dashboard/inventory': 'Inventory',
}

function FinanceExpandableNav({
  onNavigate,
}: {
  onNavigate: () => void
}) {
  const location = useLocation()
  const onFinanceRoute =
    location.pathname === FINANCE_ADMIN_BASE || location.pathname.startsWith(`${FINANCE_ADMIN_BASE}/`)
  const [expanded, setExpanded] = useState(onFinanceRoute)

  useEffect(() => {
    if (onFinanceRoute) setExpanded(true)
  }, [onFinanceRoute])

  return (
    <div className="space-y-1">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls="admin-finance-submenu"
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          'flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors',
          onFinanceRoute
            ? 'bg-gray-100 text-gray-900'
            : 'text-gray-600 hover:bg-gray-100',
        )}
      >
        <Landmark className="h-5 w-5 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-left">Finance Management</span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200',
            expanded && 'rotate-180',
          )}
        />
      </button>

      {expanded ? (
        <div id="admin-finance-submenu" className="space-y-1 pl-3" role="group" aria-label="Finance Management pages">
          {FINANCE_ADMIN_NAV_ITEMS.map((item) => {
            const to = `${FINANCE_ADMIN_BASE}/${item.slug}`
            return (
              <NavLink
                key={item.slug}
                to={to}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-gray-600 hover:bg-gray-100',
                  )
                }
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
              </NavLink>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

function CrmExpandableNav({
  onNavigate,
}: {
  onNavigate: () => void
}) {
  const location = useLocation()
  const onCrmRoute = location.pathname === CRM_ADMIN_BASE || location.pathname.startsWith(`${CRM_ADMIN_BASE}/`)
  const [expanded, setExpanded] = useState(onCrmRoute)

  useEffect(() => {
    if (onCrmRoute) setExpanded(true)
  }, [onCrmRoute])

  return (
    <div className="space-y-1">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls="admin-crm-submenu"
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          'flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors',
          onCrmRoute
            ? 'bg-gray-100 text-gray-900'
            : 'text-gray-600 hover:bg-gray-100',
        )}
      >
        <UsersRound className="h-5 w-5 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-left">CRM Management</span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200',
            expanded && 'rotate-180',
          )}
        />
      </button>

      {expanded ? (
        <div id="admin-crm-submenu" className="space-y-1 pl-3" role="group" aria-label="CRM Management pages">
          {CRM_ADMIN_NAV_ITEMS.map((item) => {
            const to = `${CRM_ADMIN_BASE}/${item.slug}`
            return (
              <NavLink
                key={item.slug}
                to={to}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-gray-600 hover:bg-gray-100',
                  )
                }
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
              </NavLink>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

function HrExpandableNav({
  onNavigate,
}: {
  onNavigate: () => void
}) {
  const location = useLocation()
  const onHrRoute = location.pathname === HR_ADMIN_BASE || location.pathname.startsWith(`${HR_ADMIN_BASE}/`)
  const [expanded, setExpanded] = useState(onHrRoute)

  useEffect(() => {
    if (onHrRoute) setExpanded(true)
  }, [onHrRoute])

  return (
    <div className="space-y-1">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls="admin-hr-submenu"
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          'flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors',
          onHrRoute
            ? 'bg-gray-100 text-gray-900'
            : 'text-gray-600 hover:bg-gray-100',
        )}
      >
        <UserCog className="h-5 w-5 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-left">HR Management</span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200',
            expanded && 'rotate-180',
          )}
        />
      </button>

      {expanded ? (
        <div id="admin-hr-submenu" className="space-y-1 pl-3" role="group" aria-label="HR Management pages">
          {HR_ADMIN_NAV_ITEMS.map((item) => {
            const to = `${HR_ADMIN_BASE}/${item.slug}`
            return (
              <NavLink
                key={item.slug}
                to={to}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-gray-600 hover:bg-gray-100',
                  )
                }
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
              </NavLink>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

export default function DashboardLayout() {
  const logout = useLogout()
  const { user } = useAuthStore()
  const { vendor } = useVendorStore()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const isAdmin = isPlatformStaff(user)
  const navItems = isAdmin
    ? isSuperuserAdmin(user)
      ? adminNavItemsSuperuser
      : adminNavItemsSupport
    : vendorNavItems
  const displayName = isAdmin ? 'KIT ERP' : vendor?.display_name || 'KIT ERP'
  const roleLabel = getDashboardUserRoleLabel(user)

  const isHrIframeShell =
    location.pathname === HR_ADMIN_BASE || location.pathname.startsWith(`${HR_ADMIN_BASE}/`)
  const isCrmIframeShell =
    location.pathname === CRM_ADMIN_BASE || location.pathname.startsWith(`${CRM_ADMIN_BASE}/`)
  const isFinanceIframeShell =
    location.pathname === FINANCE_ADMIN_BASE || location.pathname.startsWith(`${FINANCE_ADMIN_BASE}/`)
  const isModuleIframeShell = isHrIframeShell || isCrmIframeShell || isFinanceIframeShell

  const hrSlug = location.pathname.startsWith(`${HR_ADMIN_BASE}/`)
    ? location.pathname.slice(HR_ADMIN_BASE.length + 1).split('/')[0]
    : undefined
  const hrItem = getHrAdminNavItem(hrSlug)

  const crmSlug = location.pathname.startsWith(`${CRM_ADMIN_BASE}/`)
    ? location.pathname.slice(CRM_ADMIN_BASE.length + 1).split('/')[0]
    : undefined
  const crmItem = getCrmAdminNavItem(crmSlug)

  const financeSlug = location.pathname.startsWith(`${FINANCE_ADMIN_BASE}/`)
    ? location.pathname.slice(FINANCE_ADMIN_BASE.length + 1).split('/')[0]
    : undefined
  const financeItem = getFinanceAdminNavItem(financeSlug)

  const pageLabel = financeItem
    ? `Finance · ${financeItem.label}`
    : crmItem
      ? `CRM · ${crmItem.label}`
      : hrItem
        ? `HR · ${hrItem.label}`
        : adminPageTitles[location.pathname]
          || (location.pathname.startsWith('/dashboard/vendors/') ? 'Business Account'
            : location.pathname.startsWith('/dashboard/platform-team/') ? 'Team Member'
              : location.pathname.startsWith(FINANCE_ADMIN_BASE) ? 'Finance Management'
                : location.pathname.startsWith(CRM_ADMIN_BASE) ? 'CRM Management'
                  : location.pathname.startsWith(HR_ADMIN_BASE) ? 'HR Management'
                    : 'Dashboard')

  useDocumentSeo({
    title: adminPageTitle(pageLabel),
    description: 'KIT ERP admin console for platform operations and business management.',
    noindex: true,
  })

  const closeSidebar = () => setSidebarOpen(false)

  return (
    <div className="min-h-screen overflow-x-hidden bg-gray-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 max-w-[min(16rem,100vw)] border-r border-gray-200 bg-white shadow-lg transition-transform duration-200 ease-out lg:z-30 lg:shadow-none',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo — h-14 matches HR Management toolbar and mobile header */}
          <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-gray-200 px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-2">
              <Store className="h-5 w-5 shrink-0 text-primary" />
              <span className="truncate text-sm font-bold text-gray-900">{displayName}</span>
            </div>
            <button
              type="button"
              aria-label="Close menu"
              className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 lg:hidden"
              onClick={closeSidebar}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* User info */}
          <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 sm:px-6">
            <ProfileAvatar user={user} className="h-10 w-10 shadow-sm ring-1 ring-black/5" />
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="truncate text-sm font-medium text-gray-900">{user?.full_name}</p>
              <p className="truncate text-xs text-gray-500">{user?.email || user?.phone || '—'}</p>
              {roleLabel ? (
                <p className="truncate pt-0.5 text-xs font-medium text-gray-700">{roleLabel}</p>
              ) : null}
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4 sm:px-4">
            {navItems.map((item) =>
              item.expandableCrm ? (
                <CrmExpandableNav key={item.to} onNavigate={closeSidebar} />
              ) : item.expandableFinance ? (
                <FinanceExpandableNav key={item.to} onNavigate={closeSidebar} />
              ) : item.expandableHr ? (
                <HrExpandableNav key={item.to} onNavigate={closeSidebar} />
              ) : (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/dashboard'}
                  onClick={closeSidebar}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-gray-600 hover:bg-gray-100',
                    )
                  }
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                </NavLink>
              ),
            )}
          </nav>

          {/* Footer */}
          <div className="px-3 py-3 sm:px-4">
            <Button
              type="button"
              variant="outline"
              className={cn(
                'h-11 w-full justify-start gap-3 rounded-lg border-border bg-background font-medium text-foreground shadow-none',
                'hover:border-red-300 hover:bg-red-50 hover:text-red-700',
                'focus-visible:ring-red-200',
              )}
              onClick={logout}
            >
              <LogOut className="h-5 w-5 shrink-0 text-red-600" />
              Logout
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="min-h-screen lg:ml-64">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-gray-200 bg-white/95 px-4 backdrop-blur lg:hidden">
          <button
            type="button"
            aria-label="Open menu"
            className="-ml-1 rounded-lg p-1.5 text-gray-600 hover:bg-gray-100"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900">{displayName}</span>
          <ProfileAvatar user={user} className="h-8 w-8 shadow-sm ring-1 ring-black/5" textClassName="text-xs font-bold" />
        </header>

        <main
          className={cn(
            'min-w-0 max-w-none',
            isModuleIframeShell ? 'p-0' : 'p-4 sm:p-6 lg:p-8',
          )}
        >
          <Outlet />
        </main>
      </div>
      <ResponsiveViewportBadge />
    </div>
  )
}
