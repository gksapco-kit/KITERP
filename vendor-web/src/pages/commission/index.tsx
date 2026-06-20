import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { UserCheck, BookOpen, Link2, ClipboardList, Wallet, BarChart2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/commission/payees', label: 'Payees', icon: UserCheck },
  { to: '/commission/plans', label: 'Plans', icon: BookOpen },
  { to: '/commission/assignments', label: 'Assignments', icon: Link2 },
  { to: '/commission/accruals', label: 'Accruals', icon: ClipboardList },
  { to: '/commission/payouts', label: 'Payouts', icon: Wallet },
  { to: '/commission/reports', label: 'Reports', icon: BarChart2 },
]

export default function CommissionLayout() {
  const location = useLocation()
  const isRoot = location.pathname === '/commission' || location.pathname === '/commission/'

  if (isRoot) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-foreground mb-2">Sales Commission</h1>
        <p className="text-muted-foreground mb-8">Configure and manage commission earners, plans, accruals and payouts.</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to}
              className="group bg-card border border-border rounded-xl p-6 hover:border-primary/40 hover:shadow-sm transition-all">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20">
                <Icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">{label}</h3>
            </NavLink>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="bg-card px-4 sm:px-6 lg:border-b lg:border-border">
        <div className="flex gap-0.5 overflow-x-auto scrollbar-none">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'relative flex shrink-0 items-center gap-2 px-3 py-3 text-sm font-medium whitespace-nowrap transition-colors sm:px-4',
                  'border-b-2 lg:-mb-px',
                  isActive
                    ? 'z-[1] border-primary text-primary'
                    : cn(
                        'text-muted-foreground hover:text-foreground',
                        'max-lg:border-border max-lg:hover:border-border/80',
                        'lg:border-transparent lg:hover:border-border',
                      ),
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-auto bg-background">
        <Outlet />
      </div>
    </div>
  )
}
