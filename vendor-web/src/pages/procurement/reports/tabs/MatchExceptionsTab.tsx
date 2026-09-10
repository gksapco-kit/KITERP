import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { vendorApi } from '@/api/vendor'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Loader2, RefreshCw, Download, FileX } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DonutChart, type CatDatum } from '@/components/charts/reportCharts'
import { filtersToParams, type ProcurementReportFilters } from '../useProcurementReportFilters'
import { exportCSV } from '@/pages/inventory/analytics/exportUtils'

const INR = '₹'
function fmt(n: number) {
  if (n >= 1e7) return `${INR}${(n / 1e7).toFixed(2)} Cr`
  if (n >= 1e5) return `${INR}${(n / 1e5).toFixed(2)} L`
  return `${INR}${n.toFixed(2)}`
}

const MATCH_OPTIONS = [
  { value: '', label: 'All Exception Types' },
  { value: 'blocked_qty', label: 'Quantity Block' },
  { value: 'blocked_price', label: 'Price Block' },
  { value: 'partial', label: 'Partial Match' },
]

const MATCH_CFG: Record<string, { label: string; cls: string }> = {
  blocked_qty:   { label: 'Qty Block',  cls: 'bg-red-100 text-red-700 dark:bg-red-950/30' },
  blocked_price: { label: 'Price Block', cls: 'bg-orange-100 text-orange-700 dark:bg-orange-950/30' },
  partial:       { label: 'Partial',    cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30' },
}

function AgeDot({ days }: { days: number }) {
  const color = days <= 7 ? 'bg-green-400' : days <= 30 ? 'bg-yellow-400' : 'bg-red-500'
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <span className={`inline-block h-2 w-2 rounded-full ${color}`} />
      {days}d
    </span>
  )
}

interface SummaryRow { match_status: string; count: number; value: number }
interface ExceptionItem {
  invoice_id: string; supplier_id: string | null; supplier_name: string
  match_status: string; invoice_status: string; total: number; age_days: number
}

export function MatchExceptionsTab({ filters, refreshKey = 0 }: { filters: ProcurementReportFilters; refreshKey?: number }) {
  const [matchStatus, setMatchStatus] = useState('')
  const params = filtersToParams(filters, {
    match_status: matchStatus || undefined,
    limit: 500,
  })

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['vendor', 'proc-analytics-match-exceptions', params, refreshKey],
    queryFn: () => vendorApi.procurementAnalyticsMatchExceptions(params),
  })

  const items: ExceptionItem[] = data?.items ?? []
  const summary: SummaryRow[] = data?.summary ?? []

  const donutData: CatDatum[] = summary.map(row => {
    const cfg = MATCH_CFG[row.match_status] ?? { label: row.match_status, cls: '' }
    return { label: cfg.label, value: row.value }
  }).filter(d => d.value > 0)

  function doExport() {
    exportCSV(
      'match-exceptions.csv',
      ['Supplier', 'Exception Type', 'Invoice Value', 'Age (days)', 'Invoice Status'],
      items.map(i => [
        i.supplier_name,
        MATCH_CFG[i.match_status]?.label ?? i.match_status,
        i.total,
        i.age_days,
        i.invoice_status,
      ]),
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive flex items-center justify-between">
          <span>Failed to load match exceptions. Please try again.</span>
          <Button variant="ghost" size="sm" onClick={() => refetch()}><RefreshCw className="h-3.5 w-3.5 mr-1" />Retry</Button>
        </div>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={matchStatus} onChange={setMatchStatus} options={MATCH_OPTIONS} className="w-48" />
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={doExport}><Download className="h-3.5 w-3.5 mr-1" />CSV</Button>
          <Button variant="ghost" size="icon" onClick={() => refetch()}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Summary pills */}
      <div className="grid grid-cols-3 gap-3">
        {summary.map((row) => {
          const cfg = MATCH_CFG[row.match_status] ?? { label: row.match_status, cls: 'bg-gray-100 text-gray-600' }
          return (
            <button
              key={row.match_status}
              onClick={() => setMatchStatus(matchStatus === row.match_status ? '' : row.match_status)}
              className={cn(
                'rounded-lg border p-3 text-left hover:shadow-sm transition-all',
                cfg.cls,
                matchStatus === row.match_status && 'ring-2 ring-primary',
              )}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <FileX className="h-3.5 w-3.5" />
                <p className="text-xs font-medium">{cfg.label}</p>
              </div>
              <p className="text-2xl font-bold">{row.count}</p>
              <p className="text-xs opacity-75">{fmt(row.value)}</p>
            </button>
          )
        })}
      </div>

      {/* Exception type donut */}
      {donutData.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4" style={{ maxWidth: 320 }}>
          <div className="flex items-center gap-2 mb-2">
            <FileX className="w-4 h-4 text-red-500" />
            <h3 className="text-sm font-semibold text-foreground">Exception by Value</h3>
          </div>
          <DonutChart data={donutData} height={200} money />
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Supplier</th>
                    <th className="py-2 px-3 text-center text-xs font-medium text-muted-foreground">Exception</th>
                    <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">Invoice Value</th>
                    <th className="py-2 px-3 text-center text-xs font-medium text-muted-foreground">Age</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const cfg = MATCH_CFG[item.match_status] ?? { label: item.match_status, cls: 'bg-gray-100 text-gray-600' }
                    return (
                      <tr key={item.invoice_id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-2 px-3">
                          <div className="font-medium">{item.supplier_name}</div>
                          <div className="text-xs text-muted-foreground font-mono">{item.invoice_id.slice(0, 8)}…</div>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className={cn('text-xs font-semibold px-1.5 py-0.5 rounded', cfg.cls)}>{cfg.label}</span>
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-xs">{fmt(item.total)}</td>
                        <td className="py-2 px-3 text-center"><AgeDot days={item.age_days} /></td>
                      </tr>
                    )
                  })}
                  {items.length === 0 && (
                    <tr><td colSpan={4} className="py-12 text-center text-muted-foreground">No match exceptions for this period</td></tr>
                  )}
                </tbody>
              </table>
          </div>
        </div>
      )}
    </div>
  )
}
