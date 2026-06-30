import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { formatCurrency } from '@/lib/utils'

// Shared palette — kept distinct & accessible, leads with the brand green.
export const CHART_COLORS = [
  '#64C3A0', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899',
  '#14b8a6', '#ef4444', '#22c55e', '#6366f1', '#f97316',
  '#0ea5e9', '#a855f7',
]

const axisStyle = { fontSize: 11, fill: 'var(--muted-foreground, #6b7280)' }

function compactCurrency(n: number) {
  if (Math.abs(n) >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(1)}Cr`
  if (Math.abs(n) >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)}L`
  if (Math.abs(n) >= 1_000) return `₹${(n / 1_000).toFixed(1)}k`
  return `₹${Math.round(n)}`
}

function shortDate(d: string) {
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return d
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

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

type TrendDatum = { date: string; revenue: number; orders: number; units?: number }

/** Revenue area trend. `compact` hides axes/grid for use inside small cards. */
export function TrendArea({ data, height = 220, compact = false, metric = 'revenue' }: {
  data: TrendDatum[]; height?: number; compact?: boolean; metric?: 'revenue' | 'orders'
}) {
  const color = metric === 'revenue' ? CHART_COLORS[0] : CHART_COLORS[1]
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={compact ? { top: 4, right: 4, left: 4, bottom: 0 } : { top: 8, right: 12, left: 4, bottom: 0 }}>
        <defs>
          <linearGradient id={`grad-${metric}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.35} />
            <stop offset="95%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        {!compact && <CartesianGrid strokeDasharray="3 3" stroke="var(--border, #eef0f2)" vertical={false} />}
        {!compact && <XAxis dataKey="date" tickFormatter={shortDate} tick={axisStyle} tickLine={false} axisLine={false} minTickGap={24} />}
        {!compact && (
          <YAxis
            tick={axisStyle}
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={(v: number) => (metric === 'revenue' ? compactCurrency(v) : String(v))}
          />
        )}
        <Tooltip
          {...tooltipStyle}
          labelFormatter={(l) => shortDate(String(l))}
          formatter={(v: number) => [metric === 'revenue' ? formatCurrency(v) : v, metric === 'revenue' ? 'Revenue' : 'Orders']}
        />
        <Area type="monotone" dataKey={metric} stroke={color} strokeWidth={2} fill={`url(#grad-${metric})`} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

/** Dual line: revenue + orders. */
export function TrendDual({ data, height = 280 }: { data: TrendDatum[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border, #eef0f2)" vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} tick={axisStyle} tickLine={false} axisLine={false} minTickGap={24} />
        <YAxis yAxisId="r" tick={axisStyle} tickLine={false} axisLine={false} width={52} tickFormatter={compactCurrency} />
        <YAxis yAxisId="o" orientation="right" tick={axisStyle} tickLine={false} axisLine={false} width={36} />
        <Tooltip {...tooltipStyle} labelFormatter={(l) => shortDate(String(l))} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line yAxisId="r" type="monotone" name="Revenue" dataKey="revenue" stroke={CHART_COLORS[0]} strokeWidth={2} dot={false} />
        <Line yAxisId="o" type="monotone" name="Orders" dataKey="orders" stroke={CHART_COLORS[1]} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

type CatDatum = { label: string; value: number }

/** Vertical bars for categorical revenue. */
export function BarsChart({ data, height = 260, compact = false, money = true }: {
  data: CatDatum[]; height?: number; compact?: boolean; money?: boolean
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={compact ? { top: 4, right: 4, left: 4, bottom: 0 } : { top: 8, right: 12, left: 4, bottom: 0 }}>
        {!compact && <CartesianGrid strokeDasharray="3 3" stroke="var(--border, #eef0f2)" vertical={false} />}
        {!compact && <XAxis dataKey="label" tick={axisStyle} tickLine={false} axisLine={false} interval={0} angle={data.length > 5 ? -18 : 0} textAnchor={data.length > 5 ? 'end' : 'middle'} height={data.length > 5 ? 48 : 24} />}
        {!compact && <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={48} tickFormatter={(v: number) => (money ? compactCurrency(v) : String(v))} />}
        <Tooltip {...tooltipStyle} formatter={(v: number) => [money ? formatCurrency(v) : v, money ? 'Revenue' : 'Count']} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Donut with side legend. */
export function DonutChart({ data, height = 260, compact = false, money = true }: {
  data: CatDatum[]; height?: number; compact?: boolean; money?: boolean
}) {
  const total = data.reduce((s, d) => s + d.value, 0)
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="label"
          innerRadius={compact ? '55%' : '58%'}
          outerRadius={compact ? '85%' : '80%'}
          paddingAngle={2}
        >
          {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
        </Pie>
        <Tooltip
          {...tooltipStyle}
          formatter={(v: number, n: string) => [
            `${money ? formatCurrency(v) : v}${total ? ` (${Math.round((v / total) * 100)}%)` : ''}`,
            n,
          ]}
        />
        {!compact && <Legend wrapperStyle={{ fontSize: 12 }} />}
      </PieChart>
    </ResponsiveContainer>
  )
}

/** Horizontal ranking bars — good for top products / customers. */
export function HBarsChart({ data, height = 280, money = true }: {
  data: CatDatum[]; height?: number; money?: boolean
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart layout="vertical" data={data} margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border, #eef0f2)" horizontal={false} />
        <XAxis type="number" tick={axisStyle} tickLine={false} axisLine={false} tickFormatter={(v: number) => (money ? compactCurrency(v) : String(v))} />
        <YAxis type="category" dataKey="label" tick={axisStyle} tickLine={false} axisLine={false} width={130} />
        <Tooltip {...tooltipStyle} formatter={(v: number) => [money ? formatCurrency(v) : v, money ? 'Revenue' : 'Value']} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
          {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
