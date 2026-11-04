import { useQueries, useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { AlertTriangle, Building2, CalendarClock, ClipboardCheck, FileSignature, Home, Users } from 'lucide-react'
import { reApi } from '@/api/realestate'
import { PageHeader, humanize, useREMeta } from './shared'
import { VIEWS } from './views'

const total = (key: string, params: Record<string, string> = {}) => ({
  queryKey: ['re-count', key, params],
  queryFn: () => reApi.list(key, { ...params, size: 1 }).then((r) => r.total),
  staleTime: 30_000,
})

export default function RealEstateDashboard() {
  const { data: meta, isLoading, error } = useREMeta()
  const counts = useQueries({
    queries: [
      total('projects'),
      total('units'),
      total('units', { status: 'available' }),
      total('leads'),
      total('bookings', { status: 'confirmed' }),
      total('approval-requests', { status: 'pending' }),
    ],
  })
  const followups = useQuery({ queryKey: ['re-followups'], queryFn: reApi.followupSummary })
  const alerts = useQuery({ queryKey: ['re-alerts'], queryFn: reApi.alerts })

  if (error) {
    return (
      <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        Real Estate is not available. Check that the module is enabled and that your role has Real Estate access.
      </div>
    )
  }

  const [projects, units, available, leads, bookings, approvals] = counts.map((c) => c.data ?? 0)
  const tiles = [
    { label: 'Projects', value: projects, icon: Building2, to: '/realestate/property' },
    { label: 'Units', value: `${available} available / ${units}`, icon: Home, to: '/realestate/property?tab=availability' },
    { label: 'Leads', value: leads, icon: Users, to: '/realestate/sales' },
    { label: 'Confirmed bookings', value: bookings, icon: FileSignature, to: '/realestate/booking?tab=booking-forms' },
    { label: 'Pending approvals', value: approvals, icon: ClipboardCheck, to: '/realestate/admin?tab=approvals-inbox' },
    {
      label: 'Follow-ups overdue / today',
      value: `${followups.data?.overdue ?? 0} / ${followups.data?.today ?? 0}`,
      icon: CalendarClock,
      to: '/realestate/sales?tab=follow-ups',
    },
  ]

  return (
    <div>
      <PageHeader title="Real Estate" subtitle="Land to handover — projects, sales, collections, construction and operations." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {tiles.map((t) => (
          <Link key={t.label} to={t.to} className="rounded-xl border border-border bg-card p-3 transition hover:border-primary/40 hover:shadow-sm">
            <t.icon className="h-4 w-4 text-primary" />
            <p className="mt-2 text-lg font-semibold leading-tight">{t.value}</p>
            <p className="text-xs text-muted-foreground">{t.label}</p>
          </Link>
        ))}
      </div>

      {!!alerts.data?.total && (
        <div className="mt-4 rounded-xl border border-amber-300/60 bg-amber-50 p-3 dark:bg-amber-500/10">
          <div className="flex items-center gap-2 text-sm font-medium">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            {alerts.data.total} item{alerts.data.total === 1 ? '' : 's'} need attention
            {VIEWS.alerts && (
              <Link to="/realestate/admin?tab=notifications" className="ml-auto text-xs text-primary hover:underline">View all</Link>
            )}
          </div>
          <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
            {alerts.data.items.slice(0, 4).map((a, i) => (
              <li key={i}>{humanize(a.severity)} · {a.title} — {a.detail}</li>
            ))}
          </ul>
        </div>
      )}

      <h2 className="mb-2 mt-6 text-sm font-semibold text-muted-foreground">Modules</h2>
      {isLoading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {meta?.modules.map((m) => {
            const live = m.tabs.filter((t) => t.resource || (t.view && VIEWS[t.view]))
            return (
              <Link
                key={m.id}
                to={`/realestate/${m.id}`}
                className="rounded-xl border border-border bg-card p-3 transition hover:border-primary/40 hover:shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{m.no}. {m.title}</span>
                  {live.length === 0 && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">Soon</span>}
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {live.length ? live.map((t) => t.label).join(' · ') : 'Planned for a later phase'}
                </p>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
