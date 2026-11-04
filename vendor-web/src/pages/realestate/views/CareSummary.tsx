import { useQuery } from '@tanstack/react-query'
import { reApi } from '@/api/realestate'
import { humanize } from '../shared'
import { Kpi, Loading, SimpleTable } from './parts'

type Summary = {
  tickets: {
    total: number
    open: number
    sla: { on_track: number; at_risk: number; breached: number }
    by_category: Record<string, number>
    sla_met_percent: number | null
    avg_first_response_hours: number | null
  }
  feedback: { count: number; avg_rating: number | null; nps: number | null }
  warranties: { active: number; expiring_60_days: number }
  handovers: Record<string, number>
}

export default function CareSummary() {
  const q = useQuery({ queryKey: ['re-care-summary'], queryFn: () => reApi.report<Summary>('/care/summary') })
  if (q.isLoading || !q.data) return <Loading />
  const d = q.data
  const cats = Object.entries(d.tickets.by_category).map(([category, count]) => ({ category, count }))
  const handovers = Object.entries(d.handovers).map(([status, count]) => ({ status, count }))
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Open tickets" value={d.tickets.open} tone={d.tickets.open ? 'warn' : 'good'} />
        <Kpi label="SLA breached" value={d.tickets.sla.breached} tone={d.tickets.sla.breached ? 'bad' : 'good'} />
        <Kpi label="SLA at risk" value={d.tickets.sla.at_risk} tone={d.tickets.sla.at_risk ? 'warn' : 'good'} />
        <Kpi label="Resolved within SLA" value={d.tickets.sla_met_percent === null ? '—' : `${d.tickets.sla_met_percent}%`} />
        <Kpi label="Avg. first response" value={d.tickets.avg_first_response_hours === null ? '—' : `${d.tickets.avg_first_response_hours} h`} />
        <Kpi label="Customer rating" value={d.feedback.avg_rating === null ? '—' : `${d.feedback.avg_rating} / 5`} tone="good" />
        <Kpi label="Net promoter score" value={d.feedback.nps === null ? '—' : d.feedback.nps} tone={(d.feedback.nps ?? 0) < 0 ? 'bad' : 'good'} />
        <Kpi label="Warranties expiring (60d)" value={`${d.warranties.expiring_60_days} of ${d.warranties.active} active`} tone={d.warranties.expiring_60_days ? 'warn' : undefined} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-semibold">Tickets by category</h3>
          <SimpleTable
            rows={cats}
            empty="No tickets yet"
            cols={[
              { key: 'category', label: 'Category', render: (r) => humanize(r.category) },
              { key: 'count', label: 'Tickets', right: true },
            ]}
          />
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold">Handovers</h3>
          <SimpleTable
            rows={handovers}
            empty="No handovers yet"
            cols={[
              { key: 'status', label: 'Status', render: (r) => humanize(r.status) },
              { key: 'count', label: 'Units', right: true },
            ]}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Structural-defect claims carry a 30-day rectification deadline (RERA s.14(3)); other tickets follow the priority SLA
        (urgent 4h · high 24h · medium 72h · low 7 days).
      </p>
    </div>
  )
}
