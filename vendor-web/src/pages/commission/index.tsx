import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { UserCheck, BookOpen, Link2, ClipboardList, Wallet, BarChart2 } from 'lucide-react'

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
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Sales Commission</h1>
        <p className="text-gray-500 mb-8">Configure and manage commission earners, plans, accruals and payouts.</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to}
              className="group bg-white border border-gray-200 rounded-xl p-6 hover:border-blue-300 hover:shadow-sm transition-all">
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mb-4 group-hover:bg-blue-100">
                <Icon className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900">{label}</h3>
            </NavLink>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Sub-nav strip */}
      <div className="border-b border-gray-200 bg-white px-6">
        <div className="flex gap-1 overflow-x-auto">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  isActive
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-auto bg-gray-50">
        <Outlet />
      </div>
    </div>
  )
}
