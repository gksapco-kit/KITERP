import { Link } from 'react-router-dom'
import {
  User, Megaphone, Receipt, LifeBuoy, GraduationCap, ShieldCheck,
  ChevronRight, FileText,
} from 'lucide-react'
import { useESSProfile } from '@/hooks/useVendor'
import type { ESSProfile } from '@/types'

export default function MyESSPage() {
  const { data, isLoading } = useESSProfile()
  if (isLoading || !data) return <div className="p-6 text-gray-400">Loading…</div>
  const profile = data as ESSProfile
  const emp = profile.employee
  const name = (emp?.vendor_user?.user?.full_name as string | undefined) ?? 'Employee'

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4 bg-gradient-to-r from-primary to-emerald-700 rounded-xl p-5 mb-6 text-white">
        <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
          <User className="w-7 h-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Hello, {name}</h1>
          <p className="text-sm opacity-90 mt-0.5">
            {emp?.designation?.name ?? 'Team member'}
            {emp?.department?.name && ` · ${emp.department.name}`}
            {emp?.employee_code && ` · ID ${emp.employee_code}`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <SummaryCard label="Pending Policies" value={profile.pending_policies?.length ?? 0}
          icon={ShieldCheck} color="amber" link="/hr/my-policies" />
        <SummaryCard label="Open Tickets" value={profile.ticket_summary?.open ?? 0}
          icon={LifeBuoy} color="blue" link="/hr/my-helpdesk" />
        <SummaryCard label="Submitted Claims" value={profile.expense_summary?.submitted ?? 0}
          icon={Receipt} color="green" link="/hr/my-expenses" />
        <SummaryCard label="Active Trainings" value={profile.training_summary?.enrolled ?? 0}
          icon={GraduationCap} color="purple" link="/hr/my-training" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="Quick Links" icon={FileText}>
          <ul className="divide-y">
            {[
              { to: '/profile',          label: 'My Profile',         icon: User },
              { to: '/hr/attendance/my', label: 'My Attendance',      icon: ShieldCheck },
              { to: '/hr/leaves/my',     label: 'My Leaves',          icon: ShieldCheck },
              { to: '/hr/my-policies',   label: 'Policies to Read',   icon: ShieldCheck },
              { to: '/hr/my-training',   label: 'My Training',        icon: GraduationCap },
              { to: '/hr/my-expenses',   label: 'My Expense Claims',  icon: Receipt },
              { to: '/hr/my-helpdesk',   label: 'My Helpdesk Tickets', icon: LifeBuoy },
              { to: '/hr/my-announcements', label: 'Announcements',   icon: Megaphone },
              { to: '/hr/my-onboarding', label: 'My Onboarding',      icon: ShieldCheck },
              { to: '/hr/my-performance', label: 'My Performance',    icon: ShieldCheck },
            ].map(l => (
              <li key={l.to}>
                <Link to={l.to} className="flex items-center justify-between p-3 hover:bg-gray-50">
                  <span className="flex items-center gap-2 text-sm text-gray-800">
                    <l.icon className="w-4 h-4 text-gray-400" />
                    {l.label}
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </Link>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Recent Announcements" icon={Megaphone}>
          {(profile.announcements ?? []).length === 0 ? (
            <p className="p-4 text-sm text-gray-400">No announcements right now.</p>
          ) : (
            <ul className="divide-y">
              {(profile.announcements ?? []).slice(0, 5).map(a => (
                <li key={a.id} className="p-3">
                  <p className="text-sm font-medium text-gray-900">{a.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{a.body}</p>
                  <p className="text-[10px] text-gray-400 mt-1 uppercase">{a.category ?? 'general'}</p>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t p-2 text-right">
            <Link to="/hr/my-announcements" className="text-xs text-blue-600 hover:underline">View all →</Link>
          </div>
        </Section>
      </div>
    </div>
  )
}

const COLORS: Record<string, string> = {
  amber:  'from-amber-500 to-orange-500',
  blue:   'from-blue-500 to-cyan-500',
  green:  'from-green-500 to-emerald-500',
  purple: 'from-primary to-emerald-600',
}

function SummaryCard({
  label, value, icon: Icon, color, link,
}: { label: string; value: number; icon: React.ElementType; color: string; link: string }) {
  return (
    <Link to={link}
      className={`bg-gradient-to-br ${COLORS[color]} text-white rounded-xl p-4 shadow hover:shadow-md transition`}>
      <div className="flex items-center justify-between mb-1">
        <Icon className="w-5 h-5 opacity-80" />
        <span className="text-3xl font-bold">{value}</span>
      </div>
      <p className="text-xs opacity-90">{label}</p>
    </Link>
  )
}

function Section({
  title, icon: Icon, children,
}: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 p-3 border-b bg-gray-50">
        <Icon className="w-4 h-4 text-gray-500" />
        <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
      </div>
      <div>{children}</div>
    </div>
  )
}
