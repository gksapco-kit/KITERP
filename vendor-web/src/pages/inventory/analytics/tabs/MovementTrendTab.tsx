import { useQuery } from '@tanstack/react-query'
import { vendorApi } from '@/api/vendor'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Loader2, RefreshCw, Download } from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend,
} from 'recharts'
import { CHART_COLORS, shortDate, compactCurrency } from '@/components/charts/reportCharts'
import { filtersToParams, type AnalyticsFilters } from '../useAnalyticsFilters'
import { exportCSV } from '../exportUtils'

const BUCKET_OPTIONS = [
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
]

interface TrendPoint {
  date: string
  inbound_value: number
  outbound_value: number
  adjustment_value: number
  movements: number
}

const axisStyle = { fontSize: 11, fill: 'var(--muted-foreground, #6b7280)' }
const tooltipStyle = {
  contentStyle: {
    background: 'var(--popover, #fff)',
    border: '1px solid var(--border, #e5e7eb)',
    borderRadius: 8,
    fontSize: 12,
  },
}

export function MovementTrendTab({
  filters,
  setFilters,
  refreshKey = 0,
}: {
  filters: AnalyticsFilters
  setFilters: (p: Partial<AnalyticsFilters>) => void
  refreshKey?: number
}) {
  const params = filtersToParams(filters, { bucket: filters.bucket })
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['vendor', 'inv-analytics-trend', params, refreshKey],
    queryFn: () => vendorApi.inventoryAnalyticsMovementTrend(params),
  })

  const series: TrendPoint[] = data?.series ?? []

  function doExport() {
    exportCSV(
      'movement-trend.csv',
      ['Date', 'Inbound Value', 'Outbound Value', 'Adjustment Value', 'Movements'],
      series.map((p) => [p.date, p.inbound_value, p.outbound_value, p.adjustment_value, p.movements]),
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground">Bucket</span>
        <Select
          value={filters.bucket}
          onChange={(v) => setFilters({ bucket: v as AnalyticsFilters['bucket'] })}
          options={BUCKET_OPTIONS}
          className="w-28"
        />
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={doExport}><Download className="h-3.5 w-3.5 mr-1" />CSV</Button>
          <Button variant="ghost" size="icon" onClick={() => refetch()}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : series.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">No movements in the selected period</div>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Inventory Movement Value over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={series} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border, #eef0f2)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={shortDate}
                  tick={axisStyle}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                />
                <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={56} tickFormatter={compactCurrency} />
                <Tooltip
                  {...tooltipStyle}
                  labelFormatter={(l) => shortDate(String(l))}
                  formatter={(v: number, n: string) => [`₹${new Intl.NumberFormat('en-IN').format(Math.round(v))}`, n]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="inbound_value"    name="Inbound"    stackId="a" fill={CHART_COLORS[0]} radius={[0, 0, 0, 0]} />
                <Bar dataKey="outbound_value"   name="Outbound"   stackId="b" fill={CHART_COLORS[6]} radius={[0, 0, 0, 0]} />
                <Bar dataKey="adjustment_value" name="Adjustment" stackId="c" fill={CHART_COLORS[3]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
