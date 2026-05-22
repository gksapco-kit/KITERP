/**
 * InternalCostManagement — overview of internal cost flows:
 * cost center actual spending, overhead pool utilization, allocation runs,
 * and internal recharge summary.
 */
import { useState, useMemo } from 'react'
import { Building2, GitMerge, TrendingUp, AlertCircle, BarChart2 } from 'lucide-react'
import { useCompanies } from '@/hooks/useFinance'
import {
  useActivityTypes,
  useOverheadPools,
  useOverheadRates,
  useCostAllocations,
  useManufacturingOrders,
} from '@/hooks/useControlling'
import { formatCurrency } from '@/lib/utils'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

interface OverheadPoolRow {
  id: string
  code: string
  name: string
  allocation_base: string
  is_active: boolean
}

interface ActivityTypeRow {
  id: string
  code: string
  name: string
  uom: string
  is_active: boolean
}

interface AllocRow {
  id: string
  allocation_cycle: string | null
  period_year: number
  period_month: number
  allocation_method: string
  allocation_value: string
  allocated_amount: string
  status: string
}

interface OrderRow {
  id: string
  order_no: string
  title: string | null
  order_kind: string
  status: string
  cost_lines: Array<{ category: string; amount_actual: string }>
}

function CostCenterCard({ name, totalActual, byCategory }: {
  name: string
  totalActual: number
  byCategory: Record<string, number>
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Building2 className="w-4 h-4 text-primary/80" />
        <p className="font-semibold text-gray-900 text-sm truncate">{name}</p>
      </div>
      <div className="space-y-2">
        {Object.entries(byCategory).map(([cat, amt]) => (
          <div key={cat} className="flex items-center gap-2 text-xs">
            <span className="w-20 text-gray-500 capitalize">{cat}</span>
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary/50 rounded-full"
                style={{ width: totalActual > 0 ? `${(amt / totalActual) * 100}%` : '0%' }}
              />
            </div>
            <span className="w-20 text-right font-medium text-gray-700">{formatCurrency(amt)}</span>
          </div>
        ))}
      </div>
      <div className="border-t border-gray-100 pt-2 flex justify-between text-xs">
        <span className="text-gray-500">Total actual spend</span>
        <span className="font-bold text-gray-900">{formatCurrency(totalActual)}</span>
      </div>
    </div>
  )
}

function OverheadPoolCard({ pool, rates }: { pool: OverheadPoolRow; rates: Array<{ effective_from: string; effective_to: string | null; rate_per_unit: string }> }) {
  const currentRate = rates.find(r => !r.effective_to || new Date(r.effective_to) >= new Date())
  return (
    <div className={`rounded-xl border p-4 ${pool.is_active ? 'border-emerald-100 bg-emerald-50' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="font-semibold text-gray-900 text-sm">{pool.code}</p>
          <p className="text-xs text-gray-500">{pool.name}</p>
        </div>
        <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full uppercase ${pool.is_active ? 'bg-emerald-200 text-emerald-800' : 'bg-gray-200 text-gray-500'}`}>
          {pool.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs mt-3">
        <div>
          <p className="text-gray-400">Allocation base</p>
          <p className="font-medium text-gray-700">{pool.allocation_base.replace(/_/g, ' ')}</p>
        </div>
        <div>
          <p className="text-gray-400">Current rate</p>
          <p className="font-medium text-gray-700">
            {currentRate ? formatCurrency(parseFloat(currentRate.rate_per_unit)) : '—'}
            {currentRate && <span className="text-gray-400"> / unit</span>}
          </p>
        </div>
      </div>
    </div>
  )
}

function PoolRatesWrapper({ pool }: { pool: OverheadPoolRow }) {
  const { data: rates = [] } = useOverheadRates(pool.id)
  return <OverheadPoolCard pool={pool} rates={rates as Array<{ effective_from: string; effective_to: string | null; rate_per_unit: string }>} />
}

export default function InternalCostManagementPage() {
  const { data: companies = [] } = useCompanies()
  const [companyId, setCompanyId] = useState('')
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1
  const [year, setYear] = useState(currentYear)
  const [month, setMonth] = useState(currentMonth)

  const activeCo = useMemo(
    () => companyId || companies.find(c => c.is_default)?.id || companies[0]?.id || '',
    [companyId, companies],
  )

  const { data: activityTypes = [] } = useActivityTypes(activeCo || undefined)
  const { data: overheadPools = [] } = useOverheadPools(activeCo || undefined)
  const { data: allocations = [] } = useCostAllocations({
    company_id: activeCo || undefined,
    period_year: year,
    period_month: month,
  })
  const { data: orders = [] } = useManufacturingOrders({
    company_id: activeCo || undefined,
  })

  // Aggregate cost by category across all orders (acts as cost center summary)
  const costSummary = useMemo(() => {
    const byCategory: Record<string, number> = {}
    let total = 0
    for (const o of orders as OrderRow[]) {
      for (const ln of o.cost_lines ?? []) {
        const cat = ln.category
        const amt = parseFloat(ln.amount_actual)
        byCategory[cat] = (byCategory[cat] ?? 0) + amt
        total += amt
      }
    }
    return { byCategory, total }
  }, [orders])

  // Internal order cost summary
  const internalOrderCosts = useMemo(() => {
    return (orders as OrderRow[])
      .filter(o => ['internal', 'project'].includes(o.order_kind))
      .map(o => {
        const actual = o.cost_lines?.reduce((s, ln) => s + parseFloat(ln.amount_actual), 0) ?? 0
        const byCategory: Record<string, number> = {}
        for (const ln of o.cost_lines ?? []) {
          byCategory[ln.category] = (byCategory[ln.category] ?? 0) + parseFloat(ln.amount_actual)
        }
        return { ...o, actual, byCategory }
      })
      .sort((a, b) => b.actual - a.actual)
  }, [orders])

  const totalAllocated = (allocations as AllocRow[]).reduce((s, a) => s + parseFloat(a.allocated_amount), 0)
  const postedAllocations = (allocations as AllocRow[]).filter(a => a.status === 'posted').length

  return (
    <div className="p-6 max-w-7xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Internal Cost Management</h1>
        <p className="text-sm text-gray-500 mt-1">
          Cost center spending, overhead pool utilization, allocation runs, and internal order recharge overview.
        </p>
      </div>

      {/* Period / company selector */}
      <div className="flex flex-wrap gap-3">
        {companies.length > 1 && (
          <select value={activeCo} onChange={e => setCompanyId(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white">
            {companies.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
          </select>
        )}
        <select value={year} onChange={e => setYear(Number(e.target.value))}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white">
          {[currentYear - 1, currentYear, currentYear + 1].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={month} onChange={e => setMonth(Number(e.target.value))}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white">
          {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
        </select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart2 className="w-4 h-4 text-gray-400" />
            <span className="text-xs text-gray-500">Total CO spend</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(costSummary.total)}</p>
        </div>
        <div className="rounded-xl border border-primary/20 bg-accent p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-primary/80" />
            <span className="text-xs text-primary">Activity types</span>
          </div>
          <p className="text-2xl font-bold text-primary">{(activityTypes as ActivityTypeRow[]).filter(a => a.is_active).length}</p>
        </div>
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <GitMerge className="w-4 h-4 text-blue-500" />
            <span className="text-xs text-blue-600">Allocated ({MONTHS[month - 1]})</span>
          </div>
          <p className="text-2xl font-bold text-blue-700">{formatCurrency(totalAllocated)}</p>
          <p className="text-xs text-blue-500 mt-1">{postedAllocations}/{(allocations as AllocRow[]).length} posted</p>
        </div>
        <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            <span className="text-xs text-amber-600">Internal/project orders</span>
          </div>
          <p className="text-2xl font-bold text-amber-700">{internalOrderCosts.length}</p>
        </div>
      </div>

      {/* Cost by category */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-primary/80" />
          Actual Cost by Category (all orders)
        </h2>
        <div className="space-y-3">
          {Object.entries(costSummary.byCategory)
            .sort(([, a], [, b]) => b - a)
            .map(([cat, amt]) => (
              <div key={cat} className="flex items-center gap-3">
                <span className="w-24 text-xs font-medium text-gray-600 capitalize">{cat}</span>
                <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-info"
                    style={{ width: costSummary.total > 0 ? `${(amt / costSummary.total) * 100}%` : '0%' }}
                  />
                </div>
                <span className="w-24 text-right text-xs font-medium text-gray-800">{formatCurrency(amt)}</span>
                <span className="w-12 text-right text-xs text-gray-400">
                  {costSummary.total > 0 ? `${((amt / costSummary.total) * 100).toFixed(1)}%` : '0%'}
                </span>
              </div>
            ))}
          {Object.keys(costSummary.byCategory).length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">No cost data yet — enter actual costs on manufacturing orders.</p>
          )}
        </div>
      </div>

      {/* Activity types */}
      <div>
        <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary/80" />
          Activity Types
        </h2>
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-600">Code</th>
                <th className="px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="px-4 py-3 font-medium text-gray-600">UoM</th>
                <th className="px-4 py-3 font-medium text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(activityTypes as ActivityTypeRow[]).length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400 text-sm">No activity types. Add them in Activities &amp; Overhead setup.</td></tr>
              )}
              {(activityTypes as ActivityTypeRow[]).map(a => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs font-medium text-gray-900">{a.code}</td>
                  <td className="px-4 py-3 text-gray-700">{a.name}</td>
                  <td className="px-4 py-3 text-gray-500">{a.uom}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${a.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                      {a.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Overhead pools */}
      <div>
        <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-primary/80" />
          Overhead Pools & Rates
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(overheadPools as OverheadPoolRow[]).length === 0 && (
            <div className="col-span-3 rounded-xl border border-dashed border-gray-200 p-8 text-center text-gray-400 text-sm">
              No overhead pools configured. Set them up in Activities &amp; Overhead setup.
            </div>
          )}
          {(overheadPools as OverheadPoolRow[]).map(pool => (
            <PoolRatesWrapper key={pool.id} pool={pool} />
          ))}
        </div>
      </div>

      {/* Period allocations */}
      <div>
        <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <GitMerge className="w-4 h-4 text-primary/80" />
          Cost Allocations — {MONTHS[month - 1]} {year}
        </h2>
        {(allocations as AllocRow[]).length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-gray-400 text-sm">
            No allocations for this period. Create them in Cost Allocations.
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium text-gray-600">Cycle</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Method</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-right">Value</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-right">Amount</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(allocations as AllocRow[]).map(a => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{a.allocation_cycle ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{a.allocation_method}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{parseFloat(a.allocation_value).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(parseFloat(a.allocated_amount))}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${a.status === 'posted' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {a.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Internal orders cost summary */}
      {internalOrderCosts.length > 0 && (
        <div>
          <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary/80" />
            Internal & Project Order Cost Centers
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {internalOrderCosts.map(o => (
              <CostCenterCard
                key={o.id}
                name={`${o.order_no}${o.title ? ` — ${o.title}` : ''}`}
                totalActual={o.actual}
                byCategory={o.byCategory}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
