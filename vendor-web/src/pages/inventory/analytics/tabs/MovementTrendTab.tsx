import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { vendorApi } from '@/api/vendor'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Loader2, RefreshCw, Download, AlertTriangle } from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend,
} from 'recharts'
import { CHART_COLORS, shortDate, compactCurrency } from '@/components/charts/reportCharts'
import { filtersToParams, type AnalyticsFilters } from '../useAnalyticsFilters'
import { exportCSV } from '../exportUtils'
import { TabError } from '../TabError'

const BUCKET_OPTIONS = [
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
]

type Metric = 'value' | 'qty'

interface TrendPoint {
  date: string
  inbound_value: number
  outbound_value: number
  adjustment_value: number
  inbound_qty: number
  outbound_qty: number
  adjustment_qty: number
  movements: number
}

interface TrendTotals {
  movements: number
  uncosted_movements: number
  inbound_value: number
  outbound_value: number
  adjustment_value: number
  inbound_qty: number
  outbound_qty: number
  adjustment_qty: number
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

const nf = new Intl.NumberFormat('en-IN')
const money = (n: number) => `₹${nf.format(Math.round(n))}`
const qtyFmt = (n: number) => nf.format(Math.round(n * 100) / 100)

function bucketLabel(d: string, bucket: AnalyticsFilters['bucket']) {
  if (bucket === 'month') {
    const dt = new Date(d)
    if (Number.isNaN(dt.getTime())) return d
    return dt.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
  }
  if (bucket === 'week') return `Wk ${shortDate(d)}`
  return shortDate(d)
}

function prettyDate(d?: string) {
  if (!d) return ''
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return d
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn('text-lg font-semibold mt-0.5', tone)}>{value}</div>
    </div>
  )
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
  const [metric, setMetric] = useState<Metric>('value')
  const params = filtersToParams(filters, { bucket: filters.bucket })
  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ['vendor', 'inv-analytics-trend', params, refreshKey],
    queryFn: () => vendorApi.inventoryAnalyticsMovementTrend(params),
  })

  const series: TrendPoint[] = data?.series ?? []
  const totals: TrendTotals | undefined = data?.totals
  const hasMovements = (totals?.movements ?? series.reduce((n, p) => n + p.movements, 0)) > 0
  const isValue = metric === 'value'

  function doExport() {
    exportCSV(
      'movement-trend.csv',
      [
        'Date', 'Inbound Value', 'Outbound Value', 'Adjustment Value',
        'Inbound Qty', 'Outbound Qty', 'Adjustment Qty', 'Movements',
      ],
      series.map((p) => [
        p.date, p.inbound_value, p.outbound_value, p.adjustment_value,
        p.inbound_qty, p.outbound_qty, p.adjustment_qty, p.movements,
      ]),
    )
  }

  const fmt = (n: number) => (isValue ? money(n) : qtyFmt(n))
  const inbound = isValue ? totals?.inbound_value : totals?.inbound_qty
  const outbound = isValue ? totals?.outbound_value : totals?.outbound_qty
  const net = (inbound ?? 0) - (outbound ?? 0)

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
        <div className="flex items-center gap-1 bg-muted p-1 rounded-lg ml-2">
          {(['value', 'qty'] as Metric[]).map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={cn(
                'px-3 py-1 rounded-md text-xs font-medium transition-colors',
                metric === m ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {m === 'value' ? 'Value (₹)' : 'Quantity'}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={doExport} disabled={!hasMovements}>
            <Download className="h-3.5 w-3.5 mr-1" />CSV
          </Button>
          <Button variant="ghost" size="icon" onClick={() => refetch()}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      {isError ? (
        <TabError title="Movement trend could not be loaded" onRetry={() => refetch()} isFetching={isFetching} />
      ) : isLoading ? (
        <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !hasMovements ? (
        <div className="text-center py-16 text-muted-foreground space-y-1">
          <div>No movements in the selected period</div>
          <div className="text-xs">
            Checked {prettyDate(data?.date_from)} – {prettyDate(data?.date_to)}
            {filters.store_id ? ' for the selected unit' : ' across all units'}.
            Try a longer period such as 90 days or This FY
            {filters.store_id ? ', or switch to All Business Units' : ''}.
          </div>
          {!filters.store_id && (
            <div className="text-xs">Store-to-store transfers are only shown when a single unit is selected.</div>
          )}
        </div>
      ) : (
        <>
          {totals && totals.uncosted_movements > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                {totals.uncosted_movements} movement{totals.uncosted_movements === 1 ? '' : 's'} are on products with no
                cost price, so they add no ₹ value. Set cost prices to include them, or switch to Quantity.
              </span>
            </div>
          )}

          {totals && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="Inbound" value={fmt(inbound ?? 0)} tone="text-emerald-600" />
              <Stat label="Outbound" value={fmt(outbound ?? 0)} tone="text-rose-600" />
              <Stat label="Net change" value={`${net > 0 ? '+' : net < 0 ? '−' : ''}${fmt(Math.abs(net))}`} />
              <Stat label="Movements" value={nf.format(totals.movements)} />
            </div>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                Inventory Movement {isValue ? 'Value' : 'Quantity'} over Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={series} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border, #eef0f2)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d) => bucketLabel(String(d), filters.bucket)}
                    tick={axisStyle}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={24}
                  />
                  <YAxis
                    tick={axisStyle}
                    tickLine={false}
                    axisLine={false}
                    width={56}
                    tickFormatter={isValue ? compactCurrency : (n: number) => nf.format(n)}
                  />
                  <Tooltip
                    {...tooltipStyle}
                    labelFormatter={(l) => bucketLabel(String(l), filters.bucket)}
                    formatter={(v: number, n: string) => [fmt(v), n]}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey={isValue ? 'inbound_value' : 'inbound_qty'} name="Inbound" stackId="a" fill={CHART_COLORS[0]} />
                  <Bar dataKey={isValue ? 'outbound_value' : 'outbound_qty'} name="Outbound" stackId="b" fill={CHART_COLORS[6]} />
                  <Bar dataKey={isValue ? 'adjustment_value' : 'adjustment_qty'} name="Adjustment" stackId="c" fill={CHART_COLORS[3]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
