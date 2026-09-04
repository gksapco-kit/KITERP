/**
 * Procurement Spend Analytics Dashboard
 *
 * All aggregation now runs server-side via GET /vendors/me/procurement/analytics.
 * No more 500-row list fetches that triggered 422 errors.
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useProcurementAnalytics } from '@/hooks/useVendor'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  TrendingUp, PackageCheck, Receipt, RotateCcw, AlertTriangle,
  Users, CheckCircle2, Loader2,
} from 'lucide-react'
import type { ProcurementAnalytics } from '@/api/vendor'

// ─── helpers ───────────────────────────────────────────────────────
function pct(a: number, b: number) {
  if (!b) return '—'
  return `${Math.round((a / b) * 100)}%`
}

const AGING_ORDER = ['Current', '1–30 days', '31–60 days', '61–90 days', '90+ days', 'No due date']
const AGING_COLOR: Record<string, string> = {
  'Current':      'bg-green-100 text-green-700',
  '1–30 days':    'bg-yellow-100 text-yellow-700',
  '31–60 days':   'bg-amber-100 text-amber-700',
  '61–90 days':   'bg-orange-100 text-orange-700',
  '90+ days':     'bg-red-100 text-red-700',
  'No due date':  'bg-gray-100 text-gray-500',
}

// ─── KPI card ──────────────────────────────────────────────────────
function KPICard({ label, value, sub, icon: Icon, color = 'text-gray-700' }: {
  label: string
  value: string | number
  sub?: string
  icon: React.ElementType
  color?: string
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500 font-medium">{label}</p>
          <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        <div className={`p-2 rounded-lg bg-gray-50 ${color}`}><Icon className="w-5 h-5" /></div>
      </div>
    </Card>
  )
}

// ─── Main page ─────────────────────────────────────────────────────
export default function SpendAnalyticsPage() {
  const { data, isLoading, error } = useProcurementAnalytics()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-red-500">
        Failed to load analytics. Please try again.
      </div>
    )
  }

  const { kpis, top_suppliers, ap_aging, monthly_trend, recent_pos } = data as ProcurementAnalytics
  const maxTrend = Math.max(...monthly_trend.map(m => m.value), 1)

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Procurement Analytics</h1>
        <p className="text-sm text-gray-500 mt-0.5">Spend overview, AP aging, and supplier performance</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard
          label="Total PO Value"
          value={formatCurrency(kpis.total_po_value)}
          sub={`${kpis.total_po_count} orders`}
          icon={TrendingUp}
          color="text-blue-600"
        />
        <KPICard
          label="Outstanding AP"
          value={formatCurrency(kpis.open_ap_value)}
          sub={`${kpis.open_invoice_count} invoices`}
          icon={Receipt}
          color="text-amber-600"
        />
        <KPICard
          label="GRNs Processed"
          value={kpis.grn_count}
          sub={`${kpis.fulfilled_pos} POs fulfilled`}
          icon={PackageCheck}
          color="text-green-600"
        />
        <KPICard
          label="Return Value"
          value={formatCurrency(kpis.return_value)}
          sub={`${kpis.return_count} returns`}
          icon={RotateCcw}
          color="text-red-500"
        />
        <KPICard
          label="PO Fulfilment"
          value={pct(kpis.fulfilled_pos, kpis.total_po_count)}
          sub="received + closed"
          icon={CheckCircle2}
          color="text-teal-600"
        />
        <KPICard
          label="Active Suppliers"
          value={kpis.active_suppliers}
          sub={`${kpis.total_suppliers} total`}
          icon={Users}
          color="text-purple-600"
        />
      </div>

      {/* Monthly PO trend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Monthly PO Value (last 6 months)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-2 h-24">
            {monthly_trend.map(({ month, value }) => (
              <div key={month} className="flex-1 flex flex-col items-center gap-1">
                <div className="text-xs text-gray-400 font-mono">{value > 0 ? `₹${Math.round(value / 1000)}k` : '—'}</div>
                <div
                  className="w-full bg-blue-500 rounded-t transition-all"
                  style={{ height: `${Math.max(4, (value / maxTrend) * 64)}px` }}
                />
                <div className="text-[10px] text-gray-500">{month.slice(5)}/{month.slice(2, 4)}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top suppliers by spend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Top Suppliers by Spend</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {top_suppliers.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No invoice data yet</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr className="text-xs text-gray-500">
                    <th className="px-4 py-2 text-left font-medium">#</th>
                    <th className="px-4 py-2 text-left font-medium">Supplier</th>
                    <th className="px-4 py-2 text-right font-medium">Spend</th>
                    <th className="px-4 py-2 text-center font-medium">Invoices</th>
                    <th className="px-4 py-2 text-center font-medium">Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {top_suppliers.map((s, i) => (
                    <tr key={s.supplier_id ?? s.name} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                      <td className="px-4 py-2.5 text-gray-400 text-xs">{i + 1}</td>
                      <td className="px-4 py-2.5 font-medium">{s.name}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-blue-600">{formatCurrency(s.spend)}</td>
                      <td className="px-4 py-2.5 text-center">{s.invoice_count}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${s.paid_count === s.invoice_count ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                          {s.paid_count}/{s.invoice_count}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* AP Aging */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" /> AP Aging
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ap_aging.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-green-400 opacity-60" />
                <p className="text-sm text-gray-400">No outstanding AP — all invoices paid!</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {AGING_ORDER.filter(b => ap_aging.find(a => a.bucket === b)).map(b => {
                  const row = ap_aging.find(a => a.bucket === b)!
                  return (
                    <div key={b} className="flex items-center gap-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium w-28 text-center ${AGING_COLOR[b] ?? 'bg-gray-100 text-gray-600'}`}>
                        {b}
                      </span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${b === '90+ days' ? 'bg-red-500' : b === '61–90 days' ? 'bg-orange-400' : b === '31–60 days' ? 'bg-amber-400' : b === '1–30 days' ? 'bg-yellow-400' : 'bg-green-400'}`}
                          style={{ width: `${kpis.open_ap_value > 0 ? Math.min(100, (row.amount / kpis.open_ap_value) * 100) : 0}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold tabular-nums w-24 text-right">{formatCurrency(row.amount)}</span>
                      <span className="text-xs text-gray-400 w-16 text-right">{row.count} inv.</span>
                    </div>
                  )
                })}
                <div className="border-t pt-2 flex justify-between text-sm font-semibold">
                  <span>Total Outstanding</span>
                  <span className="text-amber-600">{formatCurrency(kpis.open_ap_value)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent POs */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Recent Purchase Orders</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-gray-50">
              <tr className="text-xs text-gray-500">
                <th className="px-4 py-2 text-left font-medium">PO #</th>
                <th className="px-4 py-2 text-left font-medium">Supplier</th>
                <th className="px-4 py-2 text-left font-medium">Date</th>
                <th className="px-4 py-2 text-right font-medium">Total</th>
                <th className="px-4 py-2 text-center font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {(recent_pos as Record<string, unknown>[]).map((po, i) => (
                <tr key={String(po.id)} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                  <td className="px-4 py-2.5 font-medium text-blue-600">{String(po.po_number ?? '—')}</td>
                  <td className="px-4 py-2.5">{String(po.supplier_name ?? '—')}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">{po.order_date ? formatDate(String(po.order_date)) : '—'}</td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{formatCurrency(Number(po.total ?? 0))}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      po.status === 'closed' ? 'bg-accent text-primary' :
                      po.status === 'received' ? 'bg-green-100 text-green-700' :
                      po.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                      po.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>{String(po.status ?? '')}</span>
                  </td>
                </tr>
              ))}
              {recent_pos.length === 0 && (
                <tr><td colSpan={5} className="text-center py-8 text-sm text-gray-400">No purchase orders yet</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
