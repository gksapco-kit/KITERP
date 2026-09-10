import { useQuery } from '@tanstack/react-query'
import { vendorApi } from '@/api/vendor'
import { Button } from '@/components/ui/button'
import { Loader2, RefreshCw, Download, Star, BarChart2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import { HBarsChart, type CatDatum } from '@/components/charts/reportCharts'
import { filtersToParams, type ProcurementReportFilters } from '../useProcurementReportFilters'
import { exportCSV } from '@/pages/inventory/analytics/exportUtils'

const INR = '₹'
function fmt(n: number) {
  if (n >= 1e7) return `${INR}${(n / 1e7).toFixed(2)} Cr`
  if (n >= 1e5) return `${INR}${(n / 1e5).toFixed(2)} L`
  return `${INR}${n.toFixed(2)}`
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return <span className="text-muted-foreground text-xs">—</span>
  const color =
    score >= 80 ? 'text-green-600 bg-green-100 dark:bg-green-950/30' :
    score >= 60 ? 'text-yellow-600 bg-yellow-100 dark:bg-yellow-950/30' :
    'text-red-500 bg-red-100 dark:bg-red-950/30'
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full', color)}>
      <Star className="h-3 w-3" />
      {score}
    </span>
  )
}

function PctBar({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted-foreground text-xs">—</span>
  const color =
    value >= 90 ? 'bg-green-500' :
    value >= 70 ? 'bg-yellow-500' :
    'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <span className="text-xs font-mono w-10 text-right">{value}%</span>
    </div>
  )
}

interface ScorecardItem {
  supplier_id: string | null; name: string; po_count: number
  on_time_delivery_pct: number | null; quality_acceptance_pct: number | null
  invoice_match_rate_pct: number | null; return_rate_pct: number | null
  return_count: number; invoice_value: number; composite_score: number | null
}

export function SupplierScorecardTab({ filters, refreshKey = 0 }: { filters: ProcurementReportFilters; refreshKey?: number }) {
  const params = filtersToParams(filters, { limit: 500 })
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['vendor', 'proc-analytics-supplier-scorecard', params, refreshKey],
    queryFn: () => vendorApi.procurementAnalyticsSupplierScorecard(params),
  })

  const items: ScorecardItem[] = data?.items ?? []

  const scoreChartData: CatDatum[] = items
    .filter(i => i.composite_score != null)
    .slice(0, 12)
    .map(i => ({ label: i.name, value: i.composite_score! }))

  const onTimeChartData: CatDatum[] = items
    .filter(i => i.on_time_delivery_pct != null)
    .slice(0, 12)
    .map(i => ({ label: i.name, value: i.on_time_delivery_pct! }))

  function doExport() {
    exportCSV(
      'supplier-scorecard.csv',
      ['Supplier', 'POs', 'On-Time Delivery %', 'Quality %', 'Match Rate %', 'Return Rate %', 'Invoice Value', 'Score'],
      items.map((i) => [
        i.name, i.po_count, i.on_time_delivery_pct ?? '',
        i.quality_acceptance_pct ?? '', i.invoice_match_rate_pct ?? '',
        i.return_rate_pct ?? '', i.invoice_value, i.composite_score ?? '',
      ]),
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive flex items-center justify-between">
          <span>Failed to load supplier scorecard. Please try again.</span>
          <Button variant="ghost" size="sm" onClick={() => refetch()}><RefreshCw className="h-3.5 w-3.5 mr-1" />Retry</Button>
        </div>
      )}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{data?.total ?? 0} suppliers · composite score = avg of on-time, quality, match-rate</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={doExport}><Download className="h-3.5 w-3.5 mr-1" />CSV</Button>
          <Button variant="ghost" size="icon" onClick={() => refetch()}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Supplier score charts */}
      {(scoreChartData.length > 0 || onTimeChartData.length > 0) && (
        <div className="grid lg:grid-cols-2 gap-4">
          {scoreChartData.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Star className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-semibold text-foreground">Composite Score</h3>
                <p className="text-xs text-gray-500">Top suppliers by overall score</p>
              </div>
              <HBarsChart data={scoreChartData} height={Math.max(200, scoreChartData.length * 34)} money={false} />
            </div>
          )}
          {onTimeChartData.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <BarChart2 className="w-4 h-4 text-green-600" />
                <h3 className="text-sm font-semibold text-foreground">On-Time Delivery %</h3>
                <p className="text-xs text-gray-500">Delivery reliability by supplier</p>
              </div>
              <HBarsChart data={onTimeChartData} height={Math.max(200, onTimeChartData.length * 34)} money={false} />
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Supplier</th>
                    <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">POs</th>
                    <th className="py-2 px-3 text-xs font-medium text-muted-foreground min-w-[120px]">On-Time Delivery</th>
                    <th className="py-2 px-3 text-xs font-medium text-muted-foreground min-w-[120px]">Quality Accept.</th>
                    <th className="py-2 px-3 text-xs font-medium text-muted-foreground min-w-[120px]">Match Rate</th>
                    <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">Return Rate</th>
                    <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">Invoice Value</th>
                    <th className="py-2 px-3 text-center text-xs font-medium text-muted-foreground">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.supplier_id ?? item.name} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-2 px-3 font-medium max-w-[180px] truncate">{item.name}</td>
                      <td className="py-2 px-3 text-right font-mono text-xs">{item.po_count}</td>
                      <td className="py-2 px-3"><PctBar value={item.on_time_delivery_pct} /></td>
                      <td className="py-2 px-3"><PctBar value={item.quality_acceptance_pct} /></td>
                      <td className="py-2 px-3"><PctBar value={item.invoice_match_rate_pct} /></td>
                      <td className="py-2 px-3 text-right text-xs font-mono">
                        {item.return_rate_pct != null ? `${item.return_rate_pct}%` : '—'}
                      </td>
                      <td className="py-2 px-3 text-right text-xs font-mono">{fmt(item.invoice_value)}</td>
                      <td className="py-2 px-3 text-center"><ScoreBadge score={item.composite_score} /></td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr><td colSpan={8} className="py-12 text-center text-muted-foreground">No supplier data for this period</td></tr>
                  )}
                </tbody>
              </table>
          </div>
        </div>
      )}
    </div>
  )
}
