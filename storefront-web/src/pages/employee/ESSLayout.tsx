import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useVendor } from '@/contexts/VendorContext'
import { useHrAuthStore } from '@/stores/hrAuthStore'
import {
  LayoutDashboard, Clock, Plane, CreditCard, GraduationCap,
  Target, Receipt, LifeBuoy, Megaphone, ListChecks, ShieldCheck, Store, UserCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useESSProfile } from '@/hooks/useESS'

const NAV = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '' },
  { label: 'My Profile', icon: UserCircle, path: '/profile' },
  { label: 'Attendance', icon: Clock, path: '/attendance' },
  { label: 'My Leaves', icon: Plane, path: '/leaves' },
  { label: 'Payslips', icon: CreditCard, path: '/payslips' },
  { label: 'Policies', icon: ShieldCheck, path: '/policies' },
  { label: 'Training', icon: GraduationCap, path: '/training' },
  { label: 'Performance', icon: Target, path: '/performance' },
  { label: 'Expenses', icon: Receipt, path: '/expenses' },
  { label: 'Help Desk', icon: LifeBuoy, path: '/helpdesk' },
  { label: 'Announcements', icon: Megaphone, path: '/announcements' },
  { label: 'Onboarding', icon: ListChecks, path: '/onboarding' },
]

export default function ESSLayout() {
  const { storePath } = useVendor()
  const { employee, logout, loginBranch } = useHrAuthStore()
  const navigate = useNavigate()
  const name = employee?.full_name?.split(' ')[0] ?? 'Employee'
  const { data: profile } = useESSProfile()
  const wl = profile?.work_location as
    | { store?: { name?: string; code?: string } | null; tagged_to_label?: string | null }
    | undefined
  const outletLabel = wl?.store?.name
    ? [wl.store.name, wl.store.code].filter(Boolean).join(' · ')
    : wl?.tagged_to_label || null

  const wlStoreId = (wl?.store as { id?: string } | undefined)?.id
  const hideLoginBranchLine =
    !!(loginBranch && wlStoreId && loginBranch.id === wlStoreId)

  return (
    <div className="ess-portal flex h-screen min-h-0 bg-gray-50 overflow-hidden">
      {/* Sidebar — nav scrolls; sign out pinned to bottom */}
      <aside className="w-56 shrink-0 bg-white border-r flex flex-col h-full min-h-0">
        {/* Portal header */}
        <div className="shrink-0 px-4 py-4 border-b bg-slate-800">
          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Employee Portal (ESS)</p>
          <p className="text-sm font-semibold text-white mt-0.5 truncate">Hello, {name}</p>
          {outletLabel && (
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-300 leading-tight">
              <Store className="w-3.5 h-3.5 shrink-0 text-slate-400" />
              <span className="truncate" title={outletLabel}>{outletLabel}</span>
            </p>
          )}
          {loginBranch && !hideLoginBranchLine && (
            <p className="mt-1.5 text-[10px] text-slate-400 leading-tight truncate" title={`${loginBranch.name ?? ''} ${loginBranch.code ?? ''}`}>
              Login link: {loginBranch.name ?? 'Store'}
              {loginBranch.code ? ` (${loginBranch.code})` : ''}
            </p>
          )}
        </div>

        {/* Nav links */}
        <nav className="flex-1 min-h-0 py-2 overflow-y-auto">
          {NAV.map(({ label, icon: Icon, path }) => (
            <NavLink
              key={path}
              to={storePath(`/hr${path}`)}
              end={path === ''}
              className={({ isActive }) => cn(
                'flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Sign out */}
        <div className="shrink-0 border-t p-3 bg-white">
          <button
            type="button"
            onClick={() => {
              logout()
              navigate(storePath('/hr/login'), { replace: true })
            }}
            className="flex items-center gap-2 text-xs text-red-600 hover:text-red-800 w-full py-1.5 px-2 rounded hover:bg-red-50"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-h-0 min-w-0 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
