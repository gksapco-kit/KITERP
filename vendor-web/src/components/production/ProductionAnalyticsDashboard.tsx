import { useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  Loader2, Factory, CheckCircle2, Clock, AlertTriangle, TrendingUp, TrendingDown,
  IndianRupee, Timer,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useProductionAnalytics } from '@/hooks/useProductionOrders'

const CHART_COLORS = ['#64C3A0', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#ef4444']

const axisStyle = { fontSize: 11, fill: 'var(--muted-foreground, #6b7280)' }
const tooltipStyle = {
  contentStyle: {
    background: 'var(--popover, #fff)', border: '1px solid var(--border, #e5e7eb)',
    borderRadius: 8, fontSize: 12, color: 'var(--popover-foreground, #111827)',
  },
  labelStyle: { color: 'var(--muted-foreground, #6b7280)', fontSize: 11 },
}

function shortDate(d: string) {
  const dt = new Date(d)
  return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

function money(n: number) {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

const STATUS_COLORS: Record<string, string> = {
  draft: '#9ca3af', confirmed: '#3b82f6', in_production: '#f59e0b',
  qc: '#64C3A0', completed: '#22c55e', on_hold: '#f97316', cancelled: '#ef4444',
}

const RANGE_PRESETS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
]

function KpiCard({ icon: Icon, label, value, sub, accent }: {
  icon: typeof Factory; label: string; value: string; sub?: string; accent?: string
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', accent || 'bg-primary/10 text-primary')}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  )
}

interface ProductionAnalyticsDashboardProps {
  storeId?: string | null
}

export function ProductionAnalyticsDashboard({ storeId }: ProductionAnalyticsDashboardProps) {
  const [rangeDays, setRangeDays] = useState(30)
  const dateTo = new Date().toISOString().slice(0, 10)
  const dateFrom = new Date(Date.now() - rangeDays * 86400_000).toISOString().slice(0, 10)

  const { data, isLoading } = useProductionAnalytics({
    store_id: storeId || undefined,
    date_from: dateFrom,
    date_to: dateTo,
  })

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading production analytics…
      </div>
    )
  }

  const { totals, cost, by_status, trend, top_delayed, work_center_utilization, by_store } = data
  const variancePositive = cost.variance > 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <div className="flex items-center bg-muted rounded-xl p-1 gap-0.5">
          {RANGE_PRESETS.map(r => (
            <button key={r.days} onClick={() => setRangeDays(r.days)}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-all', rangeDays === r.days ? 'bg-card shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground')}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard icon={Factory} label="Total Orders" value={String(totals.orders)} />
        <KpiCard icon={CheckCircle2} label="Completed" value={String(totals.completed)} accent="bg-green-500/15 text-green-700" />
        <KpiCard icon={Clock} label="In Progress" value={String(totals.in_progress)} accent="bg-amber-500/15 text-amber-700" />
        <KpiCard
          icon={AlertTriangle}
          label="On-Time Rate"
          value={totals.on_time_rate != null ? `${totals.on_time_rate}%` : '—'}
          sub={totals.late > 0 ? `${totals.late} late` : undefined}
          accent={totals.on_time_rate != null && totals.on_time_rate < 80 ? 'bg-red-500/15 text-red-700' : 'bg-green-500/15 text-green-700'}
        />
        <KpiCard icon={Timer} label="Avg Cycle Time" value={totals.avg_cycle_days != null ? `${totals.avg_cycle_days}d` : '—'} />
        <KpiCard
          icon={IndianRupee}
          label="Cost Variance"
          value={cost.planned_total > 0 ? `${cost.variance_pct}%` : '—'}
          sub={cost.planned_total > 0 ? `${money(cost.actual_total)} actual` : 'No cost data yet'}
          accent={variancePositive ? 'bg-red-500/15 text-red-700' : 'bg-green-500/15 text-green-700'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Throughput trend */}
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-4">
          <p className="text-sm font-bold text-foreground mb-3">Order Throughput</p>
          {trend.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">No orders in this range</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={trend} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="grad-created" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS[1]} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CHART_COLORS[1]} stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="grad-completed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS[0]} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={CHART_COLORS[0]} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border, #eef0f2)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={shortDate} tick={axisStyle} tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
                <Tooltip {...tooltipStyle} labelFormatter={(l) => shortDate(String(l))} />
                <Area type="monotone" name="Created" dataKey="created" stroke={CHART_COLORS[1]} strokeWidth={2} fill="url(#grad-created)" />
                <Area type="monotone" name="Completed" dataKey="completed" stroke={CHART_COLORS[0]} strokeWidth={2} fill="url(#grad-completed)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Status breakdown */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-sm font-bold text-foreground mb-3">By Status</p>
          {by_status.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">No data</div>
          ) : (
            <div className="space-y-2.5">
              {by_status.map(s => (
                <div key={s.status} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: STATUS_COLORS[s.status] || '#9ca3af' }} />
                  <span className="text-xs text-muted-foreground flex-1 capitalize">{s.status.replace('_', ' ')}</span>
                  <span className="text-sm font-bold text-foreground">{s.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Cost roll-up */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-foreground">Cost Roll-up (Planned vs Actual)</p>
            {cost.planned_total > 0 && (
              <span className={cn('inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full', variancePositive ? 'bg-red-500/15 text-red-700' : 'bg-green-500/15 text-green-700')}>
                {variancePositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {cost.variance_pct}%
              </span>
            )}
          </div>
          {cost.planned_total === 0 && cost.actual_total === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">No cost data yet — reserve materials or log operation hours on production orders</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={[
                  { label: 'Material', planned: cost.planned_material, actual: cost.actual_material },
                  { label: 'Labor', planned: cost.planned_labor, actual: cost.actual_labor },
                ]}
                margin={{ top: 8, right: 12, left: 4, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border, #eef0f2)" vertical={false} />
                <XAxis dataKey="label" tick={axisStyle} tickLine={false} axisLine={false} />
                <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={48} tickFormatter={money} />
                <Tooltip {...tooltipStyle} formatter={(v: number) => money(v)} />
                <Bar dataKey="planned" name="Planned" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} />
                <Bar dataKey="actual" name="Actual" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Work center utilization */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-sm font-bold text-foreground mb-3">Work Center Hours (Planned vs Actual)</p>
          {work_center_utilization.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">No routing operations logged yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={work_center_utilization} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border, #eef0f2)" horizontal={false} />
                <XAxis type="number" tick={axisStyle} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" tick={axisStyle} tickLine={false} axisLine={false} width={110} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="planned_hours" name="Planned Hrs" fill={CHART_COLORS[1]} radius={[0, 4, 4, 0]} />
                <Bar dataKey="actual_hours" name="Actual Hrs" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top delayed orders */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-sm font-bold text-foreground mb-3">Most Delayed Completions</p>
          {top_delayed.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">No delayed orders in this range 🎉</div>
          ) : (
            <div className="space-y-2">
              {top_delayed.map(d => (
                <div key={d.id} className="flex items-center justify-between text-xs border-b border-border/60 pb-2 last:border-0 last:pb-0">
                  <div>
                    <p className="font-mono font-bold text-foreground">{d.ref}</p>
                    <p className="text-muted-foreground">Target {d.target_date} · Completed {d.completed_date}</p>
                  </div>
                  <span className="font-bold text-red-600">+{d.days_late}d</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Throughput by store */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-sm font-bold text-foreground mb-3">By Business Unit</p>
          {by_store.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">No data</div>
          ) : (
            <div className="space-y-2">
              {by_store.map((s, i) => (
                <div key={s.store_id || 'none'} className="flex items-center gap-2 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                  <span className="flex-1 text-foreground font-medium truncate">{s.store_name}</span>
                  <span className="text-muted-foreground">{s.completed}/{s.orders} completed</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
