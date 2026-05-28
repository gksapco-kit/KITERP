import { useState } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
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
  Menu,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLogout } from '@/hooks/useAuth'
import { useAuthStore } from '@/stores/authStore'
import { getDashboardUserRoleLabel, isPlatformStaff, isSuperuserAdmin } from '@/lib/platformAccess'
import { useVendorStore } from '@/stores/vendorStore'
import { Button } from '@/components/ui/button'
import ResponsiveViewportBadge from '@/components/dev/ResponsiveViewportBadge'

const vendorNavItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/dashboard/products', icon: Package, label: 'Products' },
  { to: '/dashboard/services', icon: Wrench, label: 'Services' },
  { to: '/dashboard/inventory', icon: Warehouse, label: 'Inventory' },
  { to: '/dashboard/settings', icon: Settings, label: 'Settings' },
]

const adminNavItemsSuperuser = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/dashboard/vendors', icon: Users, label: 'Business Accounts' },
  { to: '/dashboard/plans', icon: CreditCard, label: 'Plans' },
  { to: '/dashboard/platform-team', icon: Headphones, label: 'Support team' },
  { to: '/dashboard/account-activity', icon: ScrollText, label: 'Account activity' },
  { to: '/dashboard/settings', icon: Settings, label: 'Settings' },
]

const adminNavItemsSupport = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/dashboard/vendors', icon: Users, label: 'Business Accounts' },
  { to: '/dashboard/account-activity', icon: ScrollText, label: 'Account activity' },
]

export default function DashboardLayout() {
  const logout = useLogout()
  const { user } = useAuthStore()
  const { vendor } = useVendorStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const isAdmin = isPlatformStaff(user)
  const navItems = isAdmin
    ? isSuperuserAdmin(user)
      ? adminNavItemsSuperuser
      : adminNavItemsSupport
    : vendorNavItems
  const displayName = isAdmin ? 'KIT ERP' : vendor?.display_name || 'KIT ERP'
  const roleLabel = getDashboardUserRoleLabel(user)

  const closeSidebar = () => setSidebarOpen(false)

  return (
    <div className="min-h-screen overflow-x-clip bg-gray-50">
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
          {/* Logo */}
          <div className="flex items-center justify-between gap-2 border-b border-gray-200 px-4 py-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-2">
              <Store className="h-8 w-8 shrink-0 text-primary" />
              <span className="truncate text-lg font-bold">{displayName}</span>
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
          <div className="space-y-0.5 border-b border-gray-100 px-4 py-3 sm:px-6">
            <p className="truncate text-sm font-medium text-gray-900">{user?.full_name}</p>
            <p className="truncate text-xs text-gray-500">{user?.email || user?.phone || '—'}</p>
            {roleLabel ? (
              <p className="truncate pt-0.5 text-xs font-medium text-gray-700">{roleLabel}</p>
            ) : null}
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4 sm:px-4">
            {navItems.map((item) => (
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
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Footer */}
          <div className="border-t border-gray-200 px-3 py-4 sm:px-4">
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-gray-600"
              onClick={logout}
            >
              <LogOut className="h-5 w-5" />
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
          <span className="min-w-0 truncate text-sm font-semibold text-gray-900">{displayName}</span>
        </header>

        <main className="min-w-0 max-w-none p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
      <ResponsiveViewportBadge />
    </div>
  )
}
