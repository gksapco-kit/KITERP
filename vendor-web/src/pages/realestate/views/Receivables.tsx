import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { reApi } from '@/api/realestate'
import { Kpi, Loading, ProjectFilter, SimpleTable, money } from './parts'

type Summary = {
  bookings: number; payable_total: number; collected: number; collected_percent: number
  demanded: number; demanded_outstanding: number; overdue: number; overdue_count: number
  by_project: { project: string; bookings: number; payable: number; collected: number; percent: number }[]
  monthly: { month: string; collected: number }[]
}
type AgeRow = { customer: string; not_due?: number; d0_30?: number; d31_60?: number; d61_90?: number; d90_plus?: number; total?: number }
type Ageing = { rows: AgeRow[]; totals: Record<string, number> }

export default function Receivables() {
  const [projectId, setProjectId] = useState('')
  const summary = useQuery({
    queryKey: ['re-collections-summary', projectId],
    queryFn: () => reApi.report<Summary>('/collections/summary', { project_id: projectId }),
  })
  const ageing = useQuery({ queryKey: ['re-ageing'], queryFn: () => reApi.report<Ageing>('/collections/receivables-ageing') })
  if (summary.isLoading || ageing.isLoading) return <Loading />
  const s = summary.data
  const a = ageing.data
  const max = Math.max(1, ...(s?.monthly.map((m) => m.collected) ?? [1]))

  return (
    <div className="space-y-5">
      <ProjectFilter value={projectId} onChange={setProjectId} />
      {s && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Kpi label="Receivable (contract)" value={money(s.payable_total)} />
            <Kpi label="Collected" value={`${money(s.collected)} (${s.collected_percent}%)`} tone="good" />
            <Kpi label="Demanded, outstanding" value={money(s.demanded_outstanding)} tone="warn" />
            <Kpi label="Overdue" value={money(s.overdue)} tone={s.overdue ? 'bad' : 'good'} />
            <Kpi label="Active bookings" value={s.bookings} />
          </div>

          <SimpleTable
            rows={s.by_project}
            empty="No active bookings"
            cols={[
              { key: 'project', label: 'Project' },
              { key: 'bookings', label: 'Bookings', right: true },
              { key: 'payable', label: 'Receivable', right: true, render: (r) => money(r.payable) },
              { key: 'collected', label: 'Collected', right: true, render: (r) => money(r.collected) },
              { key: 'percent', label: '%', right: true, render: (r) => `${r.percent}%` },
            ]}
          />

          {s.monthly.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="mb-3 text-sm font-semibold">Collections by month</h3>
              <div className="space-y-1.5">
                {s.monthly.map((m) => (
                  <div key={m.month} className="flex items-center gap-3 text-xs">
                    <span className="w-16 shrink-0 text-muted-foreground">{m.month}</span>
                    <div className="h-4 flex-1 rounded bg-muted">
                      <div className="h-4 rounded bg-primary/70" style={{ width: `${(m.collected / max) * 100}%` }} />
                    </div>
                    <span className="w-28 shrink-0 text-right tabular-nums">{money(m.collected)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div>
        <h3 className="mb-2 text-sm font-semibold">Receivables ageing by customer</h3>
        <SimpleTable<AgeRow>
          rows={a?.rows ?? []}
          empty="No outstanding demands"
          cols={[
            { key: 'customer', label: 'Customer' },
            { key: 'not_due', label: 'Not due', right: true, render: (r) => money(r.not_due) },
            { key: 'd0_30', label: '0–30', right: true, render: (r) => money(r.d0_30) },
            { key: 'd31_60', label: '31–60', right: true, render: (r) => money(r.d31_60) },
            { key: 'd61_90', label: '61–90', right: true, render: (r) => money(r.d61_90) },
            { key: 'd90_plus', label: '90+', right: true, render: (r) => money(r.d90_plus) },
            { key: 'total', label: 'Total', right: true, render: (r) => <strong>{money(r.total)}</strong> },
          ]}
        />
      </div>
    </div>
  )
}
