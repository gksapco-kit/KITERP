import { useQuery } from '@tanstack/react-query'
import { vendorApi } from '@/api/vendor'
import { Button } from '@/components/ui/button'
import { Loader2, RefreshCw, Download, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { HBarsChart, type CatDatum } from '@/components/charts/reportCharts'
import { filtersToParams, type ProcurementReportFilters } from '../useProcurementReportFilters'
import { exportCSV } from '@/pages/inventory/analytics/exportUtils'

const INR = '₹'
function fmtMoney(n: number) {
  if (n >= 1e7) return `${INR}${(n / 1e7).toFixed(2)} Cr`
  if (n >= 1e5) return `${INR}${(n / 1e5).toFixed(2)} L`
  return `${INR}${n.toFixed(2)}`
}
function fmtPrice(n: number) { return `${INR}${n.toFixed(4)}` }

interface VarianceItem {
  product_id: string | null; product_name: string; line_count: number
  avg_po_price: number; avg_inv_price: number; avg_variance: number; variance_value: number
}

export function PriceVarianceTab({ filters, refreshKey = 0 }: { filters: ProcurementReportFilters; refreshKey?: number }) {
  const params = filtersToParams(filters, { limit: 500 })
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['vendor', 'proc-analytics-price-variance', params, refreshKey],
    queryFn: () => vendorApi.procurementAnalyticsPriceVariance(params),
  })

  const items: VarianceItem[] = data?.items ?? []
  const totalVariance: number = data?.total_variance_value ?? 0

  const varChartData: CatDatum[] = items
    .filter(i => i.variance_value !== 0)
    .slice(0, 12)
    .map(i => ({ label: i.product_name.length > 20 ? `${i.product_name.slice(0, 18)}…` : i.product_name, value: Math.abs(i.variance_value) }))

  function doExport() {
    exportCSV(
      'price-variance.csv',
      ['Product', 'Lines', 'Avg PO Price', 'Avg Invoice Price', 'Avg Variance', 'Variance Value'],
      items.map((i) => [i.product_name, i.line_count, i.avg_po_price, i.avg_inv_price, i.avg_variance, i.variance_value]),
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive flex items-center justify-between">
          <span>Failed to load price variance data. Please try again.</span>
          <Button variant="ghost" size="sm" onClick={() => refetch()}><RefreshCw className="h-3.5 w-3.5 mr-1" />Retry</Button>
        </div>
      )}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="rounded-xl border bg-red-50 dark:bg-red-950/20 px-4 py-2 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          <div>
            <p className="text-xs text-red-600 font-medium">Total Variance Exposure</p>
            <p className="text-xl font-bold text-red-700">{fmtMoney(totalVariance)}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={doExport}><Download className="h-3.5 w-3.5 mr-1" />CSV</Button>
          <Button variant="ghost" size="icon" onClick={() => refetch()}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Top variance chart */}
      {varChartData.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <h3 className="text-sm font-semibold text-foreground">Top Products by Variance Exposure</h3>
            <p className="text-xs text-gray-500">Absolute invoice price deviation value</p>
          </div>
          <HBarsChart data={varChartData} height={Math.max(200, varChartData.length * 34)} money />
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
                    <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Product</th>
                    <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">Lines</th>
                    <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">Avg PO Price</th>
                    <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">Avg Inv. Price</th>
                    <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">Avg Variance</th>
                    <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">Variance Value</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const overpaid = item.avg_variance > 0
                    return (
                      <tr key={item.product_id ?? idx} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-2 px-3 font-medium max-w-[220px] truncate">{item.product_name}</td>
                        <td className="py-2 px-3 text-right font-mono text-xs">{item.line_count}</td>
                        <td className="py-2 px-3 text-right font-mono text-xs">{fmtPrice(item.avg_po_price)}</td>
                        <td className="py-2 px-3 text-right font-mono text-xs">{fmtPrice(item.avg_inv_price)}</td>
                        <td className={cn('py-2 px-3 text-right font-mono text-xs font-semibold', overpaid ? 'text-red-500' : 'text-green-600')}>
                          {overpaid ? '+' : ''}{fmtPrice(item.avg_variance)}
                        </td>
                        <td className={cn('py-2 px-3 text-right font-mono text-xs font-semibold', overpaid ? 'text-red-500' : 'text-green-600')}>
                          {fmtMoney(item.variance_value)}
                        </td>
                      </tr>
                    )
                  })}
                  {items.length === 0 && (
                    <tr><td colSpan={6} className="py-12 text-center text-muted-foreground">No price variance data found</td></tr>
                  )}
                </tbody>
              </table>
          </div>
        </div>
      )}
    </div>
  )
}
