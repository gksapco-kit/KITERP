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
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLogout } from '@/hooks/useAuth'
import { useAuthStore } from '@/stores/authStore'
import { isPlatformStaff, isSuperuserAdmin } from '@/lib/platformAccess'
import { useVendorStore } from '@/stores/vendorStore'
import { Button } from '@/components/ui/button'

const vendorNavItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/dashboard/products', icon: Package, label: 'Products' },
  { to: '/dashboard/services', icon: Wrench, label: 'Services' },
  { to: '/dashboard/inventory', icon: Warehouse, label: 'Inventory' },
  { to: '/dashboard/settings', icon: Settings, label: 'Settings' },
]

const adminNavItemsSuperuser = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/dashboard/vendors', icon: Users, label: 'Vendors' },
  { to: '/dashboard/plans', icon: CreditCard, label: 'Plans' },
  { to: '/dashboard/platform-team', icon: Headphones, label: 'Support team' },
  { to: '/dashboard/settings', icon: Settings, label: 'Settings' },
]

const adminNavItemsSupport = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/dashboard/vendors', icon: Users, label: 'Vendors' },
]

export default function DashboardLayout() {
  const logout = useLogout()
  const { user } = useAuthStore()
  const { vendor } = useVendorStore()

  const isAdmin = isPlatformStaff(user)
  const navItems = isAdmin
    ? isSuperuserAdmin(user)
      ? adminNavItemsSuperuser
      : adminNavItemsSupport
    : vendorNavItems
  const displayName = isAdmin
    ? isSuperuserAdmin(user)
      ? 'Admin Panel'
      : 'Support'
    : vendor?.display_name || 'ArT'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-200">
            <Store className="w-8 h-8 text-primary" />
            <span className="font-bold text-lg">{displayName}</span>
          </div>

          {/* User info */}
          <div className="px-6 py-3 border-b border-gray-100">
            <p className="text-sm font-medium text-gray-900 truncate">{user?.full_name}</p>
            <p className="text-xs text-gray-500 truncate">{user?.email || user?.phone || '—'}</p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/dashboard'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-gray-600 hover:bg-gray-100'
                  )
                }
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Footer */}
          <div className="px-4 py-4 border-t border-gray-200">
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-gray-600"
              onClick={logout}
            >
              <LogOut className="w-5 h-5" />
              Logout
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-64 p-8">
        <Outlet />
      </main>
    </div>
  )
}
