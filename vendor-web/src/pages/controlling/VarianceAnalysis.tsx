/**
 * VarianceAnalysis — cross-order variance analysis with price/usage/overhead
 * breakdown, filterable by order kind, status, company.
 */
import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, TrendingDown, TrendingUp, Minus } from 'lucide-react'
import { useCompanies } from '@/hooks/useFinance'
import { useManufacturingOrders } from '@/hooks/useControlling'
import { formatCurrency } from '@/lib/utils'

const ORDER_KINDS = ['', 'assembly', 'process', 'project', 'internal']
const STATUSES = ['', 'draft', 'released', 'in_progress', 'completed', 'closed']

interface OrderRow {
  id: string
  order_no: string
  title: string | null
  order_kind: string
  status: string
  cost_lines: CostLine[]
}

interface CostLine {
  id: string
  category: string
  description: string | null
  qty_planned: string
  qty_actual: string
  rate_planned: string
  rate_actual: string
  amount_planned: string
  amount_actual: string
}

function computeVariance(lines: CostLine[]) {
  let totalP = 0, totalA = 0, priceVar = 0, usageVar = 0, overheadVar = 0, scrapVar = 0
  for (const ln of lines) {
    const p = parseFloat(ln.amount_planned)
    const a = parseFloat(ln.amount_actual)
    const qp = parseFloat(ln.qty_planned)
    const qa = parseFloat(ln.qty_actual)
    const rp = parseFloat(ln.rate_planned)
    const ra = parseFloat(ln.rate_actual)
    totalP += p
    totalA += a
    if (ln.category === 'overhead') overheadVar += a - p
    else if (ln.category === 'scrap') scrapVar += a - p
    else if (ln.category === 'material') {
      priceVar += (ra - rp) * qa
      usageVar += (qa - qp) * rp
    } else {
      priceVar += a - p
    }
  }
  return { totalP, totalA, variance: totalA - totalP, priceVar, usageVar, overheadVar, scrapVar }
}

function VariancePill({ value }: { value: number }) {
  if (value === 0) return <span className="text-gray-400 flex items-center gap-1"><Minus className="w-3 h-3" /> 0</span>
  if (value > 0) return (
    <span className="text-red-600 font-semibold flex items-center gap-1">
      <TrendingUp className="w-3 h-3" /> +{formatCurrency(value)}
    </span>
  )
  return (
    <span className="text-emerald-600 font-semibold flex items-center gap-1">
      <TrendingDown className="w-3 h-3" /> {formatCurrency(value)}
    </span>
  )
}

const statusColor = (s: string) => {
  const m: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-500',
    released: 'bg-blue-100 text-blue-600',
    in_progress: 'bg-amber-100 text-amber-700',
    completed: 'bg-emerald-100 text-emerald-700',
    closed: 'bg-gray-200 text-gray-500',
    cancelled: 'bg-red-100 text-red-600',
  }
  return m[s] ?? 'bg-gray-100 text-gray-500'
}

export default function VarianceAnalysisPage() {
  const { data: companies = [] } = useCompanies()
  const [companyId, setCompanyId] = useState('')
  const [kindFilter, setKindFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'variance' | 'order_no' | 'actual'>('variance')

  const activeCo = useMemo(
    () => companyId || companies.find(c => c.is_default)?.id || companies[0]?.id || '',
    [companyId, companies],
  )

  const { data: ordersRaw = [], isLoading } = useManufacturingOrders({
    company_id: activeCo || undefined,
    order_kind: kindFilter || undefined,
    status: statusFilter || undefined,
  })

  const orders = ordersRaw as OrderRow[]

  const analyzed = useMemo(() =>
    orders.map(o => ({ ...o, ...computeVariance(o.cost_lines ?? []) })),
    [orders],
  )

  const sorted = useMemo(() => {
    const copy = [...analyzed]
    if (sortBy === 'variance') copy.sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))
    else if (sortBy === 'actual') copy.sort((a, b) => b.totalA - a.totalA)
    else copy.sort((a, b) => a.order_no.localeCompare(b.order_no))
    return copy
  }, [analyzed, sortBy])

  const totals = useMemo(() => analyzed.reduce(
    (acc, o) => ({
      planned: acc.planned + o.totalP,
      actual: acc.actual + o.totalA,
      variance: acc.variance + o.variance,
      price: acc.price + o.priceVar,
      usage: acc.usage + o.usageVar,
      overhead: acc.overhead + o.overheadVar,
      scrap: acc.scrap + o.scrapVar,
    }),
    { planned: 0, actual: 0, variance: 0, price: 0, usage: 0, overhead: 0, scrap: 0 },
  ), [analyzed])

  const unfavorableCount = analyzed.filter(o => o.variance > 0).length
  const favorableCount = analyzed.filter(o => o.variance < 0).length

  return (
    <div className="p-6 max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Variance Analysis</h1>
        <p className="text-sm text-gray-500 mt-1">
          Cross-order planned vs actual cost analysis with price, usage, overhead and scrap variance breakdown.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500 mb-1">Orders analyzed</p>
          <p className="text-2xl font-bold text-gray-900">{analyzed.length}</p>
          <p className="text-xs text-gray-400 mt-1">
            <span className="text-red-500 font-medium">{unfavorableCount} unfavorable</span>
            {' · '}
            <span className="text-emerald-500 font-medium">{favorableCount} favorable</span>
          </p>
        </div>
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
          <p className="text-xs text-blue-600 mb-1">Total planned</p>
          <p className="text-2xl font-bold text-blue-700">{formatCurrency(totals.planned)}</p>
        </div>
        <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
          <p className="text-xs text-amber-600 mb-1">Total actual</p>
          <p className="text-2xl font-bold text-amber-700">{formatCurrency(totals.actual)}</p>
        </div>
        <div className={`rounded-xl border p-4 ${totals.variance > 0 ? 'bg-red-50 border-red-100' : totals.variance < 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-gray-50 border-gray-200'}`}>
          <p className={`text-xs mb-1 ${totals.variance > 0 ? 'text-red-600' : totals.variance < 0 ? 'text-emerald-600' : 'text-gray-500'}`}>
            Net variance {totals.variance > 0 ? '(unfavorable)' : totals.variance < 0 ? '(favorable)' : ''}
          </p>
          <p className={`text-2xl font-bold ${totals.variance > 0 ? 'text-red-700' : totals.variance < 0 ? 'text-emerald-700' : 'text-gray-700'}`}>
            {totals.variance >= 0 ? '+' : ''}{formatCurrency(totals.variance)}
          </p>
        </div>
      </div>

      {/* Variance breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Price variance', value: totals.price, help: 'Actual rate − planned rate × actual qty' },
          { label: 'Usage/Qty variance', value: totals.usage, help: 'Actual qty − planned qty × planned rate' },
          { label: 'Overhead variance', value: totals.overhead, help: 'Overhead actual − overhead planned' },
          { label: 'Scrap variance', value: totals.scrap, help: 'Scrap cost deviation from plan' },
        ].map(({ label, value, help }) => (
          <div key={label} className="rounded-lg border border-gray-200 bg-white p-3" title={help}>
            <p className="text-[11px] text-gray-500 mb-1">{label}</p>
            <VariancePill value={value} />
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {companies.length > 1 && (
          <select value={activeCo} onChange={e => setCompanyId(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white">
            {companies.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
          </select>
        )}
        <select value={kindFilter} onChange={e => setKindFilter(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white">
          {ORDER_KINDS.map(k => <option key={k} value={k}>{k || 'All kinds'}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white">
          {STATUSES.map(s => <option key={s} value={s}>{s || 'All statuses'}</option>)}
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white">
          <option value="variance">Sort: largest variance first</option>
          <option value="actual">Sort: highest actual cost</option>
          <option value="order_no">Sort: order number</option>
        </select>
      </div>

      {/* Main table */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-[12px]">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-600">Order</th>
              <th className="px-4 py-3 font-medium text-gray-600">Kind / Status</th>
              <th className="px-4 py-3 font-medium text-gray-600 text-right">Planned</th>
              <th className="px-4 py-3 font-medium text-gray-600 text-right">Actual</th>
              <th className="px-4 py-3 font-medium text-gray-600 text-right">Variance</th>
              <th className="px-4 py-3 font-medium text-gray-600 text-right">Price Var</th>
              <th className="px-4 py-3 font-medium text-gray-600 text-right">Usage Var</th>
              <th className="px-4 py-3 font-medium text-gray-600 text-right">OH Var</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">Loading…</td></tr>
            )}
            {!isLoading && sorted.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">No orders with cost data.</td></tr>
            )}
            {sorted.map(o => {
              const varColor = o.variance > 0 ? 'text-red-600' : o.variance < 0 ? 'text-emerald-600' : 'text-gray-500'
              const isExpanded = expandedId === o.id
              return (
                <>
                  <tr
                    key={o.id}
                    className={`hover:bg-gray-50 cursor-pointer ${isExpanded ? 'bg-violet-50/30' : ''}`}
                    onClick={() => setExpandedId(isExpanded ? null : o.id)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs font-semibold text-gray-900">{o.order_no}</p>
                      {o.title && <p className="text-[11px] text-gray-500 truncate max-w-[180px]">{o.title}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-gray-600">{o.order_kind}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium w-fit ${statusColor(o.status)}`}>{o.status}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-700">{formatCurrency(o.totalP)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-700">{formatCurrency(o.totalA)}</td>
                    <td className={`px-4 py-3 text-right tabular-nums font-semibold ${varColor}`}>
                      {o.variance >= 0 ? '+' : ''}{formatCurrency(o.variance)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-600 text-xs">
                      <VariancePill value={o.priceVar} />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-600 text-xs">
                      <VariancePill value={o.usageVar} />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-600 text-xs">
                      <VariancePill value={o.overheadVar} />
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/controlling/orders/${o.id}`}
                        onClick={e => e.stopPropagation()}
                        className="text-violet-500 hover:text-violet-700"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                  {isExpanded && (o.cost_lines ?? []).length > 0 && (
                    <tr key={`${o.id}-detail`} className="bg-gray-50/80">
                      <td colSpan={9} className="px-6 py-3">
                        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                          <table className="w-full text-xs">
                            <thead className="bg-gray-100 text-gray-600">
                              <tr>
                                <th className="px-3 py-2 text-left">Category</th>
                                <th className="px-3 py-2 text-left">Description</th>
                                <th className="px-3 py-2 text-right">Qty Plan</th>
                                <th className="px-3 py-2 text-right">Qty Act</th>
                                <th className="px-3 py-2 text-right">Rate Plan</th>
                                <th className="px-3 py-2 text-right">Rate Act</th>
                                <th className="px-3 py-2 text-right">Amt Plan</th>
                                <th className="px-3 py-2 text-right">Amt Act</th>
                                <th className="px-3 py-2 text-right">Variance</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {(o.cost_lines ?? []).map(ln => {
                                const lineVar = parseFloat(ln.amount_actual) - parseFloat(ln.amount_planned)
                                return (
                                  <tr key={ln.id}>
                                    <td className="px-3 py-1.5 font-medium text-gray-700">{ln.category}</td>
                                    <td className="px-3 py-1.5 text-gray-500">{ln.description ?? '—'}</td>
                                    <td className="px-3 py-1.5 text-right tabular-nums">{parseFloat(ln.qty_planned).toFixed(2)}</td>
                                    <td className="px-3 py-1.5 text-right tabular-nums">{parseFloat(ln.qty_actual).toFixed(2)}</td>
                                    <td className="px-3 py-1.5 text-right tabular-nums">{formatCurrency(parseFloat(ln.rate_planned))}</td>
                                    <td className="px-3 py-1.5 text-right tabular-nums">{formatCurrency(parseFloat(ln.rate_actual))}</td>
                                    <td className="px-3 py-1.5 text-right tabular-nums">{formatCurrency(parseFloat(ln.amount_planned))}</td>
                                    <td className="px-3 py-1.5 text-right tabular-nums">{formatCurrency(parseFloat(ln.amount_actual))}</td>
                                    <td className={`px-3 py-1.5 text-right tabular-nums font-semibold ${lineVar > 0 ? 'text-red-600' : lineVar < 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
                                      {lineVar >= 0 ? '+' : ''}{formatCurrency(lineVar)}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
          {sorted.length > 0 && (
            <tfoot className="bg-gray-50 border-t-2 border-gray-200 font-semibold text-sm">
              <tr>
                <td colSpan={2} className="px-4 py-3 text-gray-700">Totals ({sorted.length} orders)</td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-900">{formatCurrency(totals.planned)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-900">{formatCurrency(totals.actual)}</td>
                <td className={`px-4 py-3 text-right tabular-nums ${totals.variance > 0 ? 'text-red-700' : totals.variance < 0 ? 'text-emerald-700' : 'text-gray-700'}`}>
                  {totals.variance >= 0 ? '+' : ''}{formatCurrency(totals.variance)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-600 text-xs"><VariancePill value={totals.price} /></td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-600 text-xs"><VariancePill value={totals.usage} /></td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-600 text-xs"><VariancePill value={totals.overhead} /></td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
