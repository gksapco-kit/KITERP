import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { reApi } from '@/api/realestate'
import { Badge } from '@/components/ui/badge'
import { EmptyState, humanize } from '../shared'
import { Kpi, Loading, ProjectFilter, SimpleTable, money } from './parts'

type Row = {
  cost_head: string
  budget: number
  committed: number
  actual: number
  forecast: number
  variance: number
  variance_percent: number | null
  over_budget: boolean
  unbudgeted: boolean
}

type Costing = {
  project: string
  rows: Row[]
  totals: { budget: number; committed: number; actual: number; forecast: number; variance: number }
  over_budget_heads: string[]
  revenue: { sales_value: number; collected: number; bookings: number }
  margin: { collected_less_actual_cost: number; projected_margin: number | null }
}

/** Budget vs committed vs actual by cost head, plus revenue and margin. Used by Budget vs Actual and Project Costing. */
export default function ProjectCosting() {
  const [project, setProject] = useState('')
  const q = useQuery({
    queryKey: ['re-costing', project],
    queryFn: () => reApi.report<Costing>(`/projects/${project}/costing`),
    enabled: !!project,
  })
  const d = q.data
  return (
    <div className="space-y-4">
      <ProjectFilter value={project} onChange={setProject} />
      {!project && <EmptyState title="Choose a project" hint="Costs come from budgets, purchase orders, GRNs, contractor bills and land payments." />}
      {project && q.isLoading && <Loading />}
      {d && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label="Budget" value={money(d.totals.budget)} />
            <Kpi label="Actual spend" value={money(d.totals.actual)} />
            <Kpi label="Committed (open orders)" value={money(d.totals.committed)} tone="warn" />
            <Kpi label="Forecast variance" value={money(d.totals.variance)} tone={d.totals.variance < 0 ? 'bad' : 'good'} />
            <Kpi label="Sales value (bookings)" value={money(d.revenue.sales_value)} />
            <Kpi label="Collected" value={money(d.revenue.collected)} tone="good" />
            <Kpi label="Collected less actual cost" value={money(d.margin.collected_less_actual_cost)} tone={d.margin.collected_less_actual_cost < 0 ? 'bad' : 'good'} />
            <Kpi label="Projected margin" value={d.margin.projected_margin === null ? '—' : money(d.margin.projected_margin)} tone={(d.margin.projected_margin ?? 0) < 0 ? 'bad' : 'good'} />
          </div>
          <SimpleTable
            rows={d.rows}
            empty="No budgets or costs recorded for this project yet"
            cols={[
              { key: 'cost_head', label: 'Cost head', render: (r) => humanize(r.cost_head) },
              { key: 'budget', label: 'Budget', right: true, render: (r) => money(r.budget) },
              { key: 'actual', label: 'Actual', right: true, render: (r) => money(r.actual) },
              { key: 'committed', label: 'Committed', right: true, render: (r) => money(r.committed) },
              { key: 'forecast', label: 'Forecast', right: true, render: (r) => money(r.forecast) },
              {
                key: 'variance',
                label: 'Variance',
                right: true,
                render: (r) => <span className={r.variance < 0 ? 'text-red-600' : ''}>{money(r.variance)}{r.variance_percent !== null ? ` (${r.variance_percent}%)` : ''}</span>,
              },
              {
                key: 'flag',
                label: '',
                render: (r) => (r.over_budget ? <Badge variant="destructive">Over budget</Badge> : r.unbudgeted ? <Badge variant="warning">No budget</Badge> : null),
              },
            ]}
          />
        </>
      )}
    </div>
  )
}
