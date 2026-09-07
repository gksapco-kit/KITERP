import { useQuery } from '@tanstack/react-query'
import { vendorApi } from '@/api/vendor'
import { Button } from '@/components/ui/button'
import {
  Loader2, RefreshCw, Download, ClipboardCheck, TrendingUp, AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell, ReferenceLine,
} from 'recharts'
import { CHART_COLORS } from '@/components/charts/reportCharts'
import { filtersToParams, type AnalyticsFilters } from '../useAnalyticsFilters'
import { exportCSV } from '../exportUtils'

interface CountRecord {
  count_id: string; reference: string | null; count_date: string | null
  count_type: string; lines_counted: number; accurate_lines: number
  ira_pct: number | null; total_variance_units: number
}

const axisStyle = { fontSize: 11, fill: 'var(--muted-foreground, #6b7280)' }
const tooltipStyle = {
  contentStyle: {
    background: 'var(--popover, #fff)',
    border: '1px solid var(--border, #e5e7eb)',
    borderRadius: 8,
    fontSize: 12,
    color: 'var(--popover-foreground, #111827)',
  },
  labelStyle: { color: 'var(--muted-foreground, #6b7280)', fontSize: 11 },
}

function shortLabel(s: string | null, id: string) {
  if (!s) return id.slice(0, 8)
  return s.length > 14 ? `${s.slice(0, 12)}…` : s
}

function IraBadge({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-xs text-muted-foreground">—</span>
  const cls =
    pct >= 95 ? 'text-green-600 bg-green-100 dark:bg-green-950/30' :
    pct >= 80 ? 'text-yellow-600 bg-yellow-100 dark:bg-yellow-950/30' :
                'text-red-500 bg-red-100 dark:bg-red-950/30'
  return <span className={cn('text-xs font-semibold px-2 py-0.5 rounded', cls)}>{pct}%</span>
}

export function CountAccuracyTab({ filters, refreshKey = 0 }: { filters: AnalyticsFilters; refreshKey?: number }) {
  const params = filtersToParams(filters)
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['vendor', 'inv-analytics-count-accuracy', params, refreshKey],
    queryFn: () => vendorApi.inventoryAnalyticsCountAccuracy(params),
  })

  const d = data ?? {}
  const counts: CountRecord[] = d.counts ?? []
  const overallIra: number | null = d.overall_ira_pct ?? null
  const totalCounts: number = d.total_counts ?? 0
  const totalLines: number = d.total_lines ?? 0

  const iraChartData = counts
    .filter(c => c.count_date && c.ira_pct != null)
    .map(c => ({ date: c.count_date!, ira_pct: c.ira_pct! }))

  const varianceChartData = counts
    .slice(0, 15)
    .map(c => ({ label: shortLabel(c.reference, c.count_id), value: c.total_variance_units }))

  const hasVariance = varianceChartData.some(d => d.value > 0)

  function doExport() {
    exportCSV(
      'count-accuracy.csv',
      ['Reference', 'Date', 'Type', 'Lines Counted', 'Accurate Lines', 'Variance Units', 'IRA %'],
      counts.map(c => [
        c.reference ?? c.count_id.slice(0, 8),
        c.count_date ?? '',
        c.count_type,
        c.lines_counted,
        c.accurate_lines,
        c.total_variance_units,
        c.ira_pct ?? '',
      ]),
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={doExport}>
          <Download className="h-3.5 w-3.5 mr-1" />CSV
        </Button>
        <Button variant="ghost" size="icon" onClick={() => refetch()}><RefreshCw className="h-4 w-4" /></Button>
      </div>

      {/* IRA KPI tile — Sales card style */}
      <div className="rounded-xl border border-border bg-card p-5 flex items-center gap-5">
        <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/20 grid place-items-center shrink-0">
          <ClipboardCheck className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <p className="text-xs text-blue-600 font-medium">Overall Inventory Record Accuracy (IRA)</p>
          <p className="text-4xl font-bold text-blue-700">{overallIra != null ? `${overallIra}%` : '—'}</p>
          <p className="text-xs text-muted-foreground mt-1">{totalCounts} count sessions · {totalLines.toLocaleString()} lines</p>
        </div>
        {overallIra != null && (
          <div className="ml-auto text-right shrink-0">
            <p className="text-xs text-gray-400">Target</p>
            <p className={cn('text-lg font-bold', overallIra >= 95 ? 'text-emerald-600' : 'text-amber-600')}>
              {overallIra >= 95 ? '✓ On target' : `${(95 - overallIra).toFixed(1)}% below target`}
            </p>
          </div>
        )}
      </div>

      {/* Charts — only when there are sessions to plot */}
      {iraChartData.length > 1 && (
        <div className={cn('grid gap-4', hasVariance ? 'lg:grid-cols-2' : 'grid-cols-1')}>
          {/* IRA Trend */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-semibold text-foreground">IRA Trend</h3>
              <p className="text-xs text-gray-500">Accuracy % per count session</p>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={iraChartData} margin={{ top: 8, right: 32, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border, #eef0f2)" vertical={false} />
                <XAxis dataKey="date" tick={axisStyle} tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis
                  domain={[0, 100]}
                  tick={axisStyle}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                  tickFormatter={(v: number) => `${v}%`}
                />
                <Tooltip
                  {...tooltipStyle}
                  formatter={(v: number) => [`${v}%`, 'IRA']}
                />
                <ReferenceLine
                  y={95}
                  stroke="#22c55e"
                  strokeDasharray="4 3"
                  label={{ value: '95% target', position: 'right', fontSize: 10, fill: '#22c55e' }}
                />
                <Line
                  type="monotone"
                  dataKey="ira_pct"
                  stroke={CHART_COLORS[0]}
                  strokeWidth={2}
                  dot={{ r: 3, fill: CHART_COLORS[0], strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Variance units per session */}
          {hasVariance && (
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-semibold text-foreground">Variance by Session</h3>
                <p className="text-xs text-gray-500">Units with discrepancies</p>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={varianceChartData} margin={{ top: 4, right: 12, left: 4, bottom: 32 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border, #eef0f2)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={axisStyle}
                    tickLine={false}
                    axisLine={false}
                    angle={-20}
                    textAnchor="end"
                    height={44}
                  />
                  <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={32} />
                  <Tooltip {...tooltipStyle} formatter={(v: number) => [v, 'Variance units']} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {varianceChartData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
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
                  <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Reference</th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Date</th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Type</th>
                  <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">Lines</th>
                  <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">Accurate</th>
                  <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">Variance Units</th>
                  <th className="py-2 px-3 text-center text-xs font-medium text-muted-foreground">IRA</th>
                </tr>
              </thead>
              <tbody>
                {counts.map((c) => (
                  <tr key={c.count_id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-2 px-3 font-mono text-xs">{c.reference || c.count_id.slice(0, 8)}</td>
                    <td className="py-2 px-3 text-xs text-muted-foreground">{c.count_date ?? '—'}</td>
                    <td className="py-2 px-3 text-xs capitalize">{c.count_type?.replace('_', ' ')}</td>
                    <td className="py-2 px-3 text-right font-mono text-xs">{c.lines_counted}</td>
                    <td className="py-2 px-3 text-right font-mono text-xs">{c.accurate_lines}</td>
                    <td className="py-2 px-3 text-right font-mono text-xs">{c.total_variance_units}</td>
                    <td className="py-2 px-3 text-center"><IraBadge pct={c.ira_pct} /></td>
                  </tr>
                ))}
                {counts.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted-foreground">
                      No completed stock counts in this period
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
