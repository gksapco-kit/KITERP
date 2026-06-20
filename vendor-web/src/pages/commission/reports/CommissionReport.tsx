import { useState } from 'react'
import { SectionLabel } from '@/components/common/FieldLabel'
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import {
  useCommissionSummary, useByPayeeReport, useBySourceReport, useTrendReport,
} from '@/hooks/useCommission'
import { useThemeStore } from '@/stores/themeStore'
import { Input } from '@/components/ui/input'
import { TrendingUp, Users, Clock, DollarSign, Award } from 'lucide-react'
import {
  commissionBucketActive,
  commissionBucketInactive,
  commissionCard,
  commissionChartColors,
  commissionEmptyCell,
  commissionPageSub,
  commissionPageTitle,
} from '@/pages/commission/commissionUi'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#64C3A0', '#ec4899', '#06b6d4']
const BUCKET_OPTIONS = ['day', 'week', 'month', 'quarter']

function KPICard({ title, value, sub, icon: Icon, color }: { title: string; value: string; sub?: string; icon: React.ElementType; color: string }) {
  return (
    <div className={commissionCard}>
      <div className="flex items-start justify-between">
        <div>
          <SectionLabel>{title}</SectionLabel>
          <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
        <div className={`p-2.5 rounded-xl ${color}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
    </div>
  )
}

const fmtCurrency = (v: number) => `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 0 })}`
const fmtCurrencyFull = (v: number) => `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

export default function CommissionReportPage() {
  const dark = useThemeStore(s => s.dark)
  const chart = commissionChartColors(dark)

  const [bucket, setBucket] = useState('month')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const filters = Object.fromEntries(
    Object.entries({ date_from: dateFrom, date_to: dateTo }).filter(([, v]) => v)
  )

  const { data: summary } = useCommissionSummary(filters)
  const { data: byPayee = [] } = useByPayeeReport({ ...filters, limit: 10 })
  const { data: bySource } = useBySourceReport(filters)
  const { data: trend = [] } = useTrendReport({ ...filters, bucket })

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className={commissionPageTitle}>Commission Reports</h1>
          <p className={commissionPageSub}>Analytics across earners, sources and time</p>
        </div>
        <div className="flex items-center gap-3">
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-9 w-[10.5rem]" />
          <span className="text-muted-foreground">→</span>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-9 w-[10.5rem]" />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KPICard title="Total Accrued" value={fmtCurrency(summary?.total_accrued || 0)} icon={TrendingUp} color="bg-primary" />
        <KPICard title="Total Paid" value={fmtCurrency(summary?.total_paid || 0)} icon={DollarSign} color="bg-emerald-500" />
        <KPICard title="Pending Approval" value={fmtCurrency(summary?.pending_approval || 0)} icon={Clock} color="bg-amber-500" />
        <KPICard title="Avg per Sale" value={fmtCurrencyFull(summary?.avg_per_sale || 0)} sub={`${summary?.sale_count || 0} sales`} icon={Award} color="bg-primary" />
        <KPICard title="Top Payee" value={fmtCurrency(summary?.top_payee_amount || 0)} sub={summary?.top_payee_id ? `ID: ${summary.top_payee_id.slice(0, 8)}` : '—'} icon={Users} color="bg-pink-500" />
      </div>

      <div className={commissionCard}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-foreground">Commission Trend</h2>
          <div className="flex gap-1">
            {BUCKET_OPTIONS.map(b => (
              <button key={b} type="button" onClick={() => setBucket(b)}
                className={bucket === b ? commissionBucketActive : commissionBucketInactive}>
                {b}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={trend}>
            <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
            <XAxis dataKey="period" tick={{ fontSize: 11, fill: chart.tick }} tickFormatter={v => v.slice(0, 10)} />
            <YAxis tick={{ fontSize: 11, fill: chart.tick }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              formatter={(v: unknown) => fmtCurrencyFull(Number(v))}
              labelFormatter={l => `Period: ${l}`}
              contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '0.5rem', color: 'hsl(var(--foreground))' }}
            />
            <Legend wrapperStyle={{ color: chart.tick }} />
            <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} name="Commission" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className={commissionCard}>
          <h2 className="font-semibold text-foreground mb-4">Top 10 Earners</h2>
          {byPayee.length === 0 ? (
            <div className={`${commissionEmptyCell} text-sm py-12`}>No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={byPayee} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: chart.tick }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="payee_name" tick={{ fontSize: 10, fill: chart.tick }} width={90} />
                <Tooltip
                  formatter={(v: unknown) => fmtCurrencyFull(Number(v))}
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '0.5rem', color: 'hsl(var(--foreground))' }}
                />
                <Bar dataKey="total_commission" fill="#3b82f6" name="Commission" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className={commissionCard}>
          <h2 className="font-semibold text-foreground mb-4">By Channel</h2>
          {!bySource?.by_channel?.length ? (
            <div className={`${commissionEmptyCell} text-sm py-12`}>No data</div>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="60%" height={220}>
                <PieChart>
                  <Pie data={bySource.by_channel} dataKey="total" nameKey="channel" cx="50%" cy="50%" outerRadius={80} label={({ percent }) => percent != null ? `${(percent * 100).toFixed(0)}%` : ''}>
                    {bySource.by_channel.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: unknown) => fmtCurrencyFull(Number(v))}
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '0.5rem', color: 'hsl(var(--foreground))' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {bySource.by_channel.map((row, i) => (
                  <div key={row.channel} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="capitalize text-muted-foreground">{row.channel || 'Unknown'}</span>
                    </div>
                    <span className="font-medium text-foreground">{fmtCurrency(row.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {bySource?.by_source_type && bySource.by_source_type.length > 0 && (
        <div className={commissionCard}>
          <h2 className="font-semibold text-foreground mb-4">By Source Type</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={bySource.by_source_type}>
              <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
              <XAxis dataKey="source_type" tick={{ fontSize: 11, fill: chart.tick }} />
              <YAxis tick={{ fontSize: 11, fill: chart.tick }} tickFormatter={v => `₹${(Number(v ?? 0) / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(v) => fmtCurrencyFull(Number(v ?? 0))}
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '0.5rem', color: 'hsl(var(--foreground))' }}
              />
              <Bar dataKey="total" radius={[4, 4, 0, 0]} name="Commission">
                {bySource.by_source_type.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
