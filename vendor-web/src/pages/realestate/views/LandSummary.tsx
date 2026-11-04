import { useQuery } from '@tanstack/react-query'
import { reApi } from '@/api/realestate'
import { humanize } from '../shared'
import { Kpi, Loading, SimpleTable, money } from './parts'

type Summary = {
  parcels: number
  total_area_sqft: number
  by_status: Record<string, { count: number; area_sqft: number; asking_price: number }>
  acquisitions: { count: number; total_cost: number; paid: number; outstanding: number }
  open_title_checks: number
  approvals: Record<string, number>
}

const acres = (sqft: number) => (sqft / 43560).toLocaleString('en-IN', { maximumFractionDigits: 2 })

export default function LandSummary() {
  const q = useQuery({ queryKey: ['re-land-summary'], queryFn: () => reApi.report<Summary>('/land/summary') })
  if (q.isLoading || !q.data) return <Loading />
  const d = q.data
  const rows = Object.entries(d.by_status).map(([status, v]) => ({ status, ...v }))
  const bad = (d.approvals.expired ?? 0) + (d.approvals.renewal_due ?? 0)
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Land parcels" value={d.parcels} />
        <Kpi label="Land bank" value={`${acres(d.total_area_sqft)} acres`} />
        <Kpi label="Acquisition cost" value={money(d.acquisitions.total_cost)} />
        <Kpi label="Paid / outstanding" value={`${money(d.acquisitions.paid)} / ${money(d.acquisitions.outstanding)}`} tone={d.acquisitions.outstanding ? 'warn' : 'good'} />
        <Kpi label="Open title checks" value={d.open_title_checks} tone={d.open_title_checks ? 'warn' : 'good'} />
        <Kpi label="Approvals approved" value={d.approvals.approved ?? 0} tone="good" />
        <Kpi label="Approvals expiring / expired" value={bad} tone={bad ? 'bad' : 'good'} />
        <Kpi label="Acquisitions (active)" value={d.acquisitions.count} />
      </div>
      <SimpleTable
        rows={rows}
        empty="No land parcels yet"
        cols={[
          { key: 'status', label: 'Status', render: (r) => humanize(r.status) },
          { key: 'count', label: 'Parcels', right: true },
          { key: 'area_sqft', label: 'Area (acres)', right: true, render: (r) => acres(r.area_sqft) },
          { key: 'asking_price', label: 'Asking price', right: true, render: (r) => money(r.asking_price) },
        ]}
      />
    </div>
  )
}
