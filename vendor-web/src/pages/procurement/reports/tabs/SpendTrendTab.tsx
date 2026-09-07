import { useQuery } from '@tanstack/react-query'
import { vendorApi } from '@/api/vendor'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, RefreshCw, Download } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { CHART_COLORS, compactCurrency, shortDate } from '@/components/charts/reportCharts'
import { cn } from '@/lib/utils'
import { filtersToParams, type ProcurementReportFilters } from '../useProcurementReportFilters'
import { exportCSV } from '@/pages/inventory/analytics/exportUtils'

const BUCKET_OPTIONS = [
  { value: 'day',   label: 'Daily' },
  { value: 'week',  label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
]

interface TrendPoint { bucket: string; committed: number; invoiced: number; paid: number }

export function SpendTrendTab({
  filters,
  setFilters,
  refreshKey = 0,
}: {
  filters: ProcurementReportFilters
  setFilters: (patch: Partial<ProcurementReportFilters>) => void
  refreshKey?: number
}) {
  const bucket = filters.bucket || 'month'
  const params = filtersToParams(filters, { bucket })

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['vendor', 'proc-analytics-spend-trend', params, refreshKey],
    queryFn: () => vendorApi.procurementAnalyticsSpendTrend(params),
  })

  const series: TrendPoint[] = data?.series ?? []

  function doExport() {
    exportCSV(
      'spend-trend.csv',
      ['Bucket', 'Committed', 'Invoiced', 'Paid'],
      series.map((s) => [s.bucket, s.committed, s.invoiced, s.paid]),
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex rounded-md border overflow-hidden">
          {BUCKET_OPTIONS.map((b) => (
            <button
              key={b.value}
              onClick={() => setFilters({ bucket: b.value as ProcurementReportFilters['bucket'] })}
              className={cn(
                'px-3 py-1.5 text-xs font-medium transition-colors',
                bucket === b.value
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted text-muted-foreground',
              )}
            >
              {b.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={doExport}><Download className="h-3.5 w-3.5 mr-1" />CSV</Button>
          <Button variant="ghost" size="icon" onClick={() => refetch()}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : series.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground text-sm">No trend data for this period</div>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground mb-4">Committed (PO) vs Invoiced vs Paid — shows commitment-to-cash lag</p>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={series} margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="bucket"
                  tickFormatter={(v) => {
                    try { return bucket === 'day' ? shortDate(v) : v.slice(0, 7) } catch { return v }
                  }}
                  tick={{ fontSize: 11 }}
                />
                <YAxis tickFormatter={compactCurrency} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v: number, name: string) => [
                    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v),
                    name,
                  ]}
                />
                <Legend />
                <Bar dataKey="committed" name="Committed" fill={CHART_COLORS[0]} radius={[3, 3, 0, 0]} />
                <Bar dataKey="invoiced"  name="Invoiced"  fill={CHART_COLORS[2]} radius={[3, 3, 0, 0]} />
                <Bar dataKey="paid"      name="Paid"      fill={CHART_COLORS[3]} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
