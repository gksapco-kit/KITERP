import { Link } from 'react-router-dom'
import { useCompanies } from '@/hooks/useFinance'
import { useControllingDashboard, useWipSummary } from '@/hooks/useControlling'
import { useState, useMemo } from 'react'
import { Select } from '@/components/ui/select'
import { formatCurrency } from '@/lib/utils'
import { Boxes, Factory, Gauge, Layers, ArrowRight, Package, Clock, GitMerge, CalendarClock, FolderOpen, Landmark, Building2 } from 'lucide-react'

function fmtMoney(s: string | number) {
  const n = typeof s === 'string' ? parseFloat(s) : s
  if (Number.isNaN(n)) return '—'
  return formatCurrency(n)
}

export default function ControllingDashboardPage() {
  const { data: companies = [] } = useCompanies()
  const [companyId, setCompanyId] = useState('')
  const activeCo = useMemo(
    () => companyId || companies.find(c => c.is_default)?.id || companies[0]?.id || '',
    [companyId, companies],
  )

  const { data: dash, isLoading: dLoading } = useControllingDashboard(activeCo || undefined)
  const { data: wip, isLoading: wLoading } = useWipSummary(activeCo || undefined)

  if (dLoading || wLoading) {
    return <div className="p-8 text-gray-500">Loading controlling dashboard…</div>
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Controlling (CO)</h1>
          <p className="text-sm text-gray-500 mt-1">
            Product Cost Planning, Manufacturing And Project Orders, Planned Vs Actual, WIP.
          </p>
        </div>
        {companies.length > 0 && (
          <label className="flex flex-col gap-1 text-xs text-gray-600">
            Business unit
            <Select
              className="min-w-[200px]"
              value={activeCo}
              onChange={setCompanyId}
              options={companies.map(c => ({ value: c.id, label: `${c.code} — ${c.name}` }))}
            />
          </label>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Boxes className="w-5 h-5 text-primary" />
            </div>
            <span className="text-sm font-medium text-gray-600">Active standard costs</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{dash?.active_standard_costs ?? 0}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Factory className="w-5 h-5 text-blue-700" />
            </div>
            <span className="text-sm font-medium text-gray-600">CO orders (all)</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{dash?.manufacturing_orders ?? 0}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <Gauge className="w-5 h-5 text-amber-700" />
            </div>
            <span className="text-sm font-medium text-gray-600">Open orders (WIP)</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{wip?.open_orders ?? dash?.wip_open_orders ?? 0}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Layers className="w-5 h-5 text-emerald-700" />
            </div>
            <span className="text-sm font-medium text-gray-600">WIP actual cost</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{fmtMoney(wip?.wip_actual_cost ?? dash?.wip_actual_cost ?? 0)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="font-semibold text-foreground mb-3">WIP Snapshot</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Planned value (open orders)</span>
              <span className="font-medium">{fmtMoney(wip?.wip_planned_value ?? dash?.wip_planned_value ?? 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Actual cost (open orders)</span>
              <span className="font-medium">{fmtMoney(wip?.wip_actual_cost ?? dash?.wip_actual_cost ?? 0)}</span>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="font-semibold text-gray-800 mb-3">Planning &amp; Cost Setup</h2>
          <ul className="space-y-2">
            {[
              ['/controlling/controlling-areas', 'Controlling Areas', 'Group company codes into a CO org unit', Building2],
              ['/controlling/product-costs', 'Product Cost Planning', 'Standard / Planned Costs & BOM Roll-Up', Boxes],
              ['/controlling/activity-types', 'Activity Types', 'Labor, machine hour, and other activity drivers', Gauge],
              ['/controlling/setup', 'Overhead Setup', 'Overhead pools and absorption rates', Gauge],
              ['/controlling/finance-integration', 'Finance Integration', 'CO settlement GL account mapping', Landmark],
              ['/controlling/cost-allocations', 'Cost Allocations', 'Period-End CC-To-CC Cost Center Allocations', GitMerge],
            ].map(([to, label, desc, Icon]) => (
              <li key={to as string}>
                <Link
                  to={to as string}
                  className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 hover:border-primary/30 hover:bg-accent/80 px-3 py-2 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {Icon && <Icon className="w-4 h-4 text-primary/80 shrink-0" />}
                    <div>
                      <p className="text-sm font-medium text-gray-900">{label as string}</p>
                      <p className="text-xs text-gray-500">{desc as string}</p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-primary shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="font-semibold text-gray-800 mb-3">Production &amp; Orders</h2>
          <ul className="space-y-2">
            {[
              ['/controlling/orders', 'Manufacturing & Project Orders', 'Assembly, Process, Internal Orders & Variance', Factory],
              ['/controlling/internal-orders', 'Internal & Project Orders', 'Budget Vs Actual For Internal Orders & Projects', FolderOpen],
              ['/controlling/goods-movements', 'Goods Movements', 'Component Issues (261), FG Receipts (101)', Package],
              ['/controlling/activity-confirmations', 'Activity Confirmations', 'Time Entry And Activity Cost Posting', Clock],
            ].map(([to, label, desc, Icon]) => (
              <li key={to as string}>
                <Link
                  to={to as string}
                  className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 hover:border-primary/30 hover:bg-accent/80 px-3 py-2 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {Icon && <Icon className="w-4 h-4 text-primary/80 shrink-0" />}
                    <div>
                      <p className="text-sm font-medium text-gray-900">{label as string}</p>
                      <p className="text-xs text-gray-500">{desc as string}</p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-primary shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="font-semibold text-gray-800 mb-3">Reporting &amp; Period End</h2>
          <ul className="space-y-2">
            {[
              ['/controlling/wip', 'WIP Report', 'Work In Process By Project, Order Kind, Or Status', Layers],
              ['/controlling/period-end', 'Period-End Closing', 'Variance Runs, Allocations, Close Checklist', CalendarClock],
            ].map(([to, label, desc, Icon]) => (
              <li key={to as string}>
                <Link
                  to={to as string}
                  className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 hover:border-primary/30 hover:bg-accent/80 px-3 py-2 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {Icon && <Icon className="w-4 h-4 text-primary/80 shrink-0" />}
                    <div>
                      <p className="text-sm font-medium text-gray-900">{label as string}</p>
                      <p className="text-xs text-gray-500">{desc as string}</p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-primary shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
