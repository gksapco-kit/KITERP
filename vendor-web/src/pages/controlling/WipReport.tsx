import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCompanies } from '@/hooks/useFinance'
import { useWipReport } from '@/hooks/useControlling'
import { formatCurrency } from '@/lib/utils'
import { ArrowLeft } from 'lucide-react'

export default function ControllingWipReportPage() {
  const { data: companies = [] } = useCompanies()
  const [companyId, setCompanyId] = useState('')
  const [groupBy, setGroupBy] = useState<'project' | 'order_kind' | 'status'>('project')
  const activeCo = useMemo(
    () => companyId || companies.find(c => c.is_default)?.id || companies[0]?.id || '',
    [companyId, companies],
  )

  const { data, isLoading } = useWipReport(
    activeCo ? { company_id: activeCo, group_by: groupBy } : { group_by: groupBy },
  )

  const fmt = (s: string) => {
    const n = parseFloat(s)
    return Number.isNaN(n) ? '—' : formatCurrency(n)
  }

  return (
    <div className="p-6 max-w-6xl space-y-6">
      <Link to="/controlling" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
        <ArrowLeft className="w-4 h-4" /> CO Dashboard
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">WIP report</h1>
          <p className="text-sm text-gray-500 mt-1">Open orders (draft / released / in progress) by project, kind, or status.</p>
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          {companies.length > 0 && (
            <label className="flex flex-col gap-1 text-xs text-gray-600">
              Company
              <select
                value={activeCo}
                onChange={e => setCompanyId(e.target.value)}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white min-w-[160px]"
              >
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.code}</option>
                ))}
              </select>
            </label>
          )}
          <label className="flex flex-col gap-1 text-xs text-gray-600">
            Group by
            <select
              value={groupBy}
              onChange={e => setGroupBy(e.target.value as typeof groupBy)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white"
            >
              <option value="project">Project / internal</option>
              <option value="order_kind">Order kind</option>
              <option value="status">Status</option>
            </select>
          </label>
        </div>
      </div>

      {isLoading ? (
        <div className="text-gray-500">Loading…</div>
      ) : (
        <div className="space-y-6">
          {(data?.groups ?? []).map((g: {
            key: string
            label: string
            open_orders: number
            wip_planned: string
            wip_actual: string
            orders: Array<{
              order_id: string
              order_no: string
              title?: string
              planned: string
              actual: string
              variance: string
            }>
          }) => (
            <div key={g.key} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 flex flex-wrap justify-between gap-2 border-b border-gray-100">
                <div>
                  <h2 className="font-semibold text-gray-900">{g.label}</h2>
                  <p className="text-xs text-gray-500">{g.open_orders} open order(s)</p>
                </div>
                <div className="text-sm text-right">
                  <span className="text-gray-600">Planned </span>
                  <span className="font-medium tabular-nums">{fmt(g.wip_planned)}</span>
                  <span className="text-gray-400 mx-2">|</span>
                  <span className="text-gray-600">Actual </span>
                  <span className="font-medium tabular-nums">{fmt(g.wip_actual)}</span>
                </div>
              </div>
              <table className="w-full text-sm">
                <thead className="text-left text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-2">Order</th>
                    <th className="px-4 py-2">Title</th>
                    <th className="px-4 py-2 text-right">Planned</th>
                    <th className="px-4 py-2 text-right">Actual</th>
                    <th className="px-4 py-2 text-right">Var</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {(g.orders ?? []).map(o => (
                    <tr key={o.order_id} className="border-t border-gray-100">
                      <td className="px-4 py-2 font-mono font-medium">{o.order_no}</td>
                      <td className="px-4 py-2 text-gray-700">{o.title ?? '—'}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{fmt(o.planned)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{fmt(o.actual)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{fmt(o.variance)}</td>
                      <td className="px-4 py-2 text-right">
                        <Link to={`/controlling/orders/${o.order_id}`} className="text-primary text-xs hover:underline">
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
