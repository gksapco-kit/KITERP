import { Link } from 'react-router-dom'
import {
  User, Megaphone, Receipt, LifeBuoy, GraduationCap, ShieldCheck,
  ChevronRight, FileText, Clock, Plane, CreditCard, Target, ListChecks,
} from 'lucide-react'
import { useESSProfile } from '@/hooks/useESS'
import { useVendor } from '@/contexts/VendorContext'
import { useHrAuthStore } from '@/stores/hrAuthStore'

export default function ESSDashboard() {
  const { storePath } = useVendor()
  const { employee } = useHrAuthStore()
  const { data: profile, isLoading } = useESSProfile()

  const name = employee?.full_name ?? 'Employee'

  if (isLoading) {
    return <div className="p-8 text-center text-gray-400">Loading your dashboard…</div>
  }

  const emp = profile?.employee
  const designation = emp?.designation?.name ?? ''
  const department = emp?.department?.name ?? ''
  const code = emp?.employee_code ?? ''

  const wl = profile?.work_location as
    | { store?: { id?: string; name?: string; code?: string } | null; tagged_to_type?: string | null; tagged_to_label?: string | null }
    | undefined
  const locationLine = (() => {
    if (wl?.store?.name) {
      const code = wl.store.code ? ` · ${wl.store.code}` : ''
      return `${wl.store.name}${code}`
    }
    if (wl?.tagged_to_label) {
      return [wl.tagged_to_type, wl.tagged_to_label].filter(Boolean).join(' · ')
    }
    return ''
  })()

  const summary = [
    { label: 'Pending Policies', value: profile?.pending_policies?.length ?? 0, icon: ShieldCheck, color: 'from-amber-500 to-orange-500', path: '/policies' },
    { label: 'Open Tickets', value: profile?.ticket_summary?.open ?? 0, icon: LifeBuoy, color: 'from-blue-500 to-cyan-500', path: '/helpdesk' },
    { label: 'Expense Claims', value: profile?.expense_summary?.submitted ?? 0, icon: Receipt, color: 'from-green-500 to-emerald-500', path: '/expenses' },
    { label: 'Active Trainings', value: profile?.training_summary?.enrolled ?? 0, icon: GraduationCap, color: 'from-purple-500 to-pink-500', path: '/training' },
  ]

  const quickLinks = [
    { to: '/hr/attendance', label: 'My Attendance', icon: Clock },
    { to: '/hr/leaves', label: 'My Leaves', icon: Plane },
    { to: '/hr/payslips', label: 'Payslips', icon: CreditCard },
    { to: '/hr/policies', label: 'Policies to read', icon: ShieldCheck },
    { to: '/hr/training', label: 'My Training', icon: GraduationCap },
    { to: '/hr/performance', label: 'My Performance', icon: Target },
    { to: '/hr/expenses', label: 'My Expense Claims', icon: Receipt },
    { to: '/hr/helpdesk', label: 'Help Desk Tickets', icon: LifeBuoy },
    { to: '/hr/announcements', label: 'Announcements', icon: Megaphone },
    { to: '/hr/onboarding', label: 'My Onboarding', icon: ListChecks },
  ]

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Welcome banner */}
      <div className="flex items-center gap-4 bg-slate-800 rounded-xl p-5 text-white">
        <div className="w-14 h-14 rounded-full bg-white/15 flex items-center justify-center shrink-0">
          <User className="w-7 h-7" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold truncate">Hello, {name.split(' ')[0]}</h1>
          <p className="text-sm text-slate-300 mt-0.5">
            {[designation, department, code && `ID ${code}`, locationLine && `Outlet: ${locationLine}`]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {summary.map(({ label, value, icon: Icon, color, path }) => (
          <Link
            key={label}
            to={storePath(`/hr${path}`)}
            className={`bg-gradient-to-br ${color} text-white rounded-xl p-4 hover:opacity-90 transition`}
          >
            <div className="flex items-center justify-between mb-1">
              <Icon className="w-5 h-5 opacity-80" />
              <span className="text-3xl font-bold">{value}</span>
            </div>
            <p className="text-xs opacity-90">{label}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Quick links */}
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 p-3 border-b bg-gray-50">
            <FileText className="w-4 h-4 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-700">Quick Links</h2>
          </div>
          <ul className="divide-y">
            {quickLinks.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <Link to={storePath(to)} className="flex items-center justify-between p-3 hover:bg-gray-50">
                  <span className="flex items-center gap-2 text-sm text-gray-800">
                    <Icon className="w-4 h-4 text-gray-400" />
                    {label}
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Recent announcements */}
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 p-3 border-b bg-gray-50">
            <Megaphone className="w-4 h-4 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-700">Recent Announcements</h2>
          </div>
          {(profile?.announcements ?? []).length === 0 ? (
            <p className="p-4 text-sm text-gray-400">No announcements right now.</p>
          ) : (
            <ul className="divide-y">
              {(profile?.announcements ?? []).slice(0, 5).map((a: any) => (
                <li key={a.id} className="p-3">
                  <p className="text-sm font-medium text-gray-900">{a.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{a.body}</p>
                  <p className="text-[10px] text-gray-400 mt-1 uppercase">{a.category ?? 'general'}</p>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t p-2 text-right">
            <Link to={storePath('/hr/announcements')} className="text-xs text-blue-600 hover:underline">
              View all →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
