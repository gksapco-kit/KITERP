import { Link, Navigate } from 'react-router-dom'
import { Loader2, Users, Target, TrendingUp, CheckSquare } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { isPlatformStaff } from '@/lib/platformAccess'
import { usePlatformCrmOverview, usePlatformLeads, usePlatformActivities } from '@/hooks/usePlatformCrm'
import CrmSubnav from './CrmSubnav'

function Stat({
  label,
  value,
  to,
  icon: Icon,
}: {
  label: string
  value: string | number
  to: string
  icon: typeof Users
}) {
  return (
    <Link
      to={to}
      className="rounded-xl border bg-white p-4 hover:border-gray-300 transition-colors"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
        <Icon className="h-4 w-4 text-gray-400" />
      </div>
      <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
    </Link>
  )
}

export default function PlatformCrmDashboard() {
  const { user } = useAuthStore()
  const allowed = isPlatformStaff(user)
  const { data: overview, isLoading } = usePlatformCrmOverview('30d')
  const { data: leads } = usePlatformLeads({ size: 5, page: 1 })
  const { data: activities } = usePlatformActivities({ size: 5, page: 1, status: 'open' })

  if (!allowed) return <Navigate to="/dashboard" replace />

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
      </div>
    )
  }

  const o = overview || {}

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-0.5">Platform</p>
        <h1 className="text-2xl font-bold text-gray-900">CRM</h1>
        <p className="text-sm text-gray-600 mt-1">
          KIT ERP sales pipeline — leads from the platform Contact Us page, contacts, deals, and tasks.
        </p>
      </div>

      <CrmSubnav />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Contacts" value={o.total_contacts ?? 0} to="/dashboard/crm/contacts" icon={Users} />
        <Stat label="Open leads" value={o.open_leads ?? 0} to="/dashboard/crm/leads" icon={Target} />
        <Stat label="Open deals" value={o.open_deals ?? 0} to="/dashboard/crm/pipeline" icon={TrendingUp} />
        <Stat
          label="Pending tasks"
          value={o.pending_activities ?? 0}
          to="/dashboard/crm/activities"
          icon={CheckSquare}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <section className="rounded-xl border bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Recent leads</h2>
            <Link to="/dashboard/crm/leads" className="text-xs text-primary hover:underline">
              View all
            </Link>
          </div>
          {(leads?.items ?? []).length === 0 ? (
            <p className="text-sm text-gray-500">No leads yet. Platform Contact Us submissions create leads automatically.</p>
          ) : (
            <ul className="space-y-2">
              {(leads?.items ?? []).map((lead) => (
                <li key={lead.id} className="flex justify-between gap-2 text-sm border-b border-gray-50 pb-2 last:border-0">
                  <span className="font-medium text-gray-900 truncate">
                    {[lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'Lead'}
                  </span>
                  <span className="text-xs capitalize text-gray-500 shrink-0">{lead.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Pending tasks</h2>
            <Link to="/dashboard/crm/activities" className="text-xs text-primary hover:underline">
              View all
            </Link>
          </div>
          {(activities?.items ?? []).length === 0 ? (
            <p className="text-sm text-gray-500">No pending tasks.</p>
          ) : (
            <ul className="space-y-2">
              {(activities?.items ?? []).map((a) => (
                <li key={a.id} className="flex justify-between gap-2 text-sm border-b border-gray-50 pb-2 last:border-0">
                  <span className="font-medium text-gray-900 truncate">{a.subject}</span>
                  <span className="text-xs capitalize text-gray-500 shrink-0">{a.type}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
