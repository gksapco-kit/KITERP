/**
 * VarianceAnalysis — cross-order variance analysis with price/usage/overhead
 * breakdown, filterable by order kind, status, company.
 */
import { Fragment, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, TrendingDown, TrendingUp, Minus } from 'lucide-react'
import { useCompanies } from '@/hooks/useFinance'
import { useManufacturingOrders } from '@/hooks/useControlling'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'

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
  if (value === 0) {
    return (
      <span className="text-muted-foreground flex items-center gap-1 justify-end">
        <Minus className="w-3 h-3" /> 0
      </span>
    )
  }
  if (value > 0) {
    return (
      <span className="text-red-500 dark:text-red-400 font-semibold flex items-center gap-1 justify-end">
        <TrendingUp className="w-3 h-3" /> +{formatCurrency(value)}
      </span>
    )
  }
  return (
    <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 justify-end">
      <TrendingDown className="w-3 h-3" /> {formatCurrency(value)}
    </span>
  )
}

const statusColor = (s: string) => {
  const m: Record<string, string> = {
    draft: 'bg-muted text-muted-foreground',
    released: 'bg-blue-500/15 text-blue-600 dark:text-blue-300',
    in_progress: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    completed: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    closed: 'bg-muted text-muted-foreground',
    cancelled: 'bg-red-500/15 text-red-600 dark:text-red-300',
  }
  return m[s] ?? 'bg-muted text-muted-foreground'
}

const filterSelectCls = 'form-select min-w-[10rem]'

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

  const analyzed = useMemo(
    () => orders.map(o => ({ ...o, ...computeVariance(o.cost_lines ?? []) })),
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
        <h1 className="text-2xl font-bold text-foreground">Variance Analysis</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cross-Order Planned Vs Actual Cost Analysis With Price, Usage, Overhead And Scrap Variance Breakdown.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-4 text-card-foreground">
          <p className="text-xs text-muted-foreground mb-1">Orders analyzed</p>
          <p className="text-2xl font-bold text-foreground">{analyzed.length}</p>
          <p className="text-xs text-muted-foreground mt-1">
            <span className="text-red-500 dark:text-red-400 font-medium">{unfavorableCount} unfavorable</span>
            {' · '}
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">{favorableCount} favorable</span>
          </p>
        </div>
        <div className="rounded-xl border border-blue-200/80 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 p-4">
          <p className="text-xs text-blue-600 dark:text-blue-300 mb-1">Total planned</p>
          <p className="text-2xl font-bold text-blue-700 dark:text-blue-200">{formatCurrency(totals.planned)}</p>
        </div>
        <div className="rounded-xl border border-amber-200/80 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-4">
          <p className="text-xs text-amber-600 dark:text-amber-300 mb-1">Total actual</p>
          <p className="text-2xl font-bold text-amber-700 dark:text-amber-200">{formatCurrency(totals.actual)}</p>
        </div>
        <div
          className={cn(
            'rounded-xl border p-4',
            totals.variance > 0 && 'bg-red-50 dark:bg-red-500/10 border-red-200/80 dark:border-red-500/30',
            totals.variance < 0 && 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200/80 dark:border-emerald-500/30',
            totals.variance === 0 && 'bg-card border-border',
          )}
        >
          <p
            className={cn(
              'text-xs mb-1',
              totals.variance > 0 && 'text-red-600 dark:text-red-300',
              totals.variance < 0 && 'text-emerald-600 dark:text-emerald-300',
              totals.variance === 0 && 'text-muted-foreground',
            )}
          >
            Net variance {totals.variance > 0 ? '(unfavorable)' : totals.variance < 0 ? '(favorable)' : ''}
          </p>
          <p
            className={cn(
              'text-2xl font-bold',
              totals.variance > 0 && 'text-red-700 dark:text-red-200',
              totals.variance < 0 && 'text-emerald-700 dark:text-emerald-200',
              totals.variance === 0 && 'text-foreground',
            )}
          >
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
          <div key={label} className="rounded-lg border border-border bg-card p-3 text-card-foreground" title={help}>
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <VariancePill value={value} />
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {companies.length > 1 && (
          <select value={activeCo} onChange={e => setCompanyId(e.target.value)} className={filterSelectCls}>
            {companies.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
          </select>
        )}
        <select value={kindFilter} onChange={e => setKindFilter(e.target.value)} className={filterSelectCls}>
          {ORDER_KINDS.map(k => <option key={k} value={k}>{k || 'All kinds'}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={filterSelectCls}>
          {STATUSES.map(s => <option key={s} value={s}>{s || 'All statuses'}</option>)}
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)} className={filterSelectCls}>
          <option value="variance">Sort: largest variance first</option>
          <option value="actual">Sort: highest actual cost</option>
          <option value="order_no">Sort: order number</option>
        </select>
      </div>

      {/* Orders grid */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-border bg-muted/40">
          <h2 className="text-sm font-semibold text-foreground">Orders — variance summary</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Click a row to expand cost line detail.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-[12px] border-b border-border">
              <tr>
                <th className="px-4 py-3 font-medium text-muted-foreground">Order</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Kind / Status</th>
                <th className="px-4 py-3 font-medium text-muted-foreground text-right">Planned</th>
                <th className="px-4 py-3 font-medium text-muted-foreground text-right">Actual</th>
                <th className="px-4 py-3 font-medium text-muted-foreground text-right">Variance</th>
                <th className="px-4 py-3 font-medium text-muted-foreground text-right">Price Var</th>
                <th className="px-4 py-3 font-medium text-muted-foreground text-right">Usage Var</th>
                <th className="px-4 py-3 font-medium text-muted-foreground text-right">OH Var</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">Loading…</td>
                </tr>
              )}
              {!isLoading && sorted.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                    No orders with cost data.
                  </td>
                </tr>
              )}
              {sorted.map(o => {
                const varColor =
                  o.variance > 0
                    ? 'text-red-600 dark:text-red-400'
                    : o.variance < 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-muted-foreground'
                const isExpanded = expandedId === o.id
                return (
                  <Fragment key={o.id}>
                    <tr
                      className={cn(
                        'hover:bg-muted/40 cursor-pointer transition-colors',
                        isExpanded && 'bg-accent/50',
                      )}
                      onClick={() => setExpandedId(isExpanded ? null : o.id)}
                    >
                      <td className="px-4 py-3">
                        <p className="font-mono text-xs font-medium text-foreground">{o.order_no}</p>
                        {o.title && (
                          <p className="text-xs text-muted-foreground truncate max-w-[180px]">{o.title}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-medium text-muted-foreground">{o.order_kind}</span>
                          <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium w-fit', statusColor(o.status))}>
                            {o.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-foreground">{formatCurrency(o.totalP)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-foreground">{formatCurrency(o.totalA)}</td>
                      <td className={cn('px-4 py-3 text-right tabular-nums font-semibold', varColor)}>
                        {o.variance >= 0 ? '+' : ''}{formatCurrency(o.variance)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-xs">
                        <VariancePill value={o.priceVar} />
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-xs">
                        <VariancePill value={o.usageVar} />
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-xs">
                        <VariancePill value={o.overheadVar} />
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to={`/controlling/orders/${o.id}`}
                          onClick={e => e.stopPropagation()}
                          className="text-primary hover:text-primary/80"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                    {isExpanded && (o.cost_lines ?? []).length > 0 && (
                      <tr className="bg-muted/30">
                        <td colSpan={9} className="px-4 py-4">
                          <div className="rounded-lg border border-border bg-card overflow-hidden">
                            <div className="px-3 py-2 border-b border-border bg-muted/40">
                              <h3 className="text-xs font-medium text-foreground">
                                Cost lines — {o.order_no}
                              </h3>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead className="bg-muted/50 text-muted-foreground border-b border-border">
                                  <tr>
                                    <th className="px-3 py-2 text-left font-medium">Category</th>
                                    <th className="px-3 py-2 text-left font-medium">Description</th>
                                    <th className="px-3 py-2 text-right font-medium">Qty Plan</th>
                                    <th className="px-3 py-2 text-right font-medium">Qty Act</th>
                                    <th className="px-3 py-2 text-right font-medium">Rate Plan</th>
                                    <th className="px-3 py-2 text-right font-medium">Rate Act</th>
                                    <th className="px-3 py-2 text-right font-medium">Amt Plan</th>
                                    <th className="px-3 py-2 text-right font-medium">Amt Act</th>
                                    <th className="px-3 py-2 text-right font-medium">Variance</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                  {(o.cost_lines ?? []).map(ln => {
                                    const lineVar = parseFloat(ln.amount_actual) - parseFloat(ln.amount_planned)
                                    return (
                                      <tr key={ln.id} className="hover:bg-muted/30">
                                        <td className="px-3 py-1.5 font-medium text-foreground">{ln.category}</td>
                                        <td className="px-3 py-1.5 text-muted-foreground">{ln.description ?? '—'}</td>
                                        <td className="px-3 py-1.5 text-right tabular-nums text-foreground">
                                          {parseFloat(ln.qty_planned).toFixed(2)}
                                        </td>
                                        <td className="px-3 py-1.5 text-right tabular-nums text-foreground">
                                          {parseFloat(ln.qty_actual).toFixed(2)}
                                        </td>
                                        <td className="px-3 py-1.5 text-right tabular-nums text-foreground">
                                          {formatCurrency(parseFloat(ln.rate_planned))}
                                        </td>
                                        <td className="px-3 py-1.5 text-right tabular-nums text-foreground">
                                          {formatCurrency(parseFloat(ln.rate_actual))}
                                        </td>
                                        <td className="px-3 py-1.5 text-right tabular-nums text-foreground">
                                          {formatCurrency(parseFloat(ln.amount_planned))}
                                        </td>
                                        <td className="px-3 py-1.5 text-right tabular-nums text-foreground">
                                          {formatCurrency(parseFloat(ln.amount_actual))}
                                        </td>
                                        <td
                                          className={cn(
                                            'px-3 py-1.5 text-right tabular-nums font-semibold',
                                            lineVar > 0 && 'text-red-600 dark:text-red-400',
                                            lineVar < 0 && 'text-emerald-600 dark:text-emerald-400',
                                            lineVar === 0 && 'text-muted-foreground',
                                          )}
                                        >
                                          {lineVar >= 0 ? '+' : ''}{formatCurrency(lineVar)}
                                        </td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
            {sorted.length > 0 && (
              <tfoot className="bg-muted/50 border-t-2 border-border font-semibold text-sm">
                <tr>
                  <td colSpan={2} className="px-4 py-3 text-foreground">Totals ({sorted.length} orders)</td>
                  <td className="px-4 py-3 text-right tabular-nums text-foreground">{formatCurrency(totals.planned)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-foreground">{formatCurrency(totals.actual)}</td>
                  <td
                    className={cn(
                      'px-4 py-3 text-right tabular-nums',
                      totals.variance > 0 && 'text-red-700 dark:text-red-300',
                      totals.variance < 0 && 'text-emerald-700 dark:text-emerald-300',
                      totals.variance === 0 && 'text-foreground',
                    )}
                  >
                    {totals.variance >= 0 ? '+' : ''}{formatCurrency(totals.variance)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-xs">
                    <VariancePill value={totals.price} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-xs">
                    <VariancePill value={totals.usage} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-xs">
                    <VariancePill value={totals.overhead} />
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}
