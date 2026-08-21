import { useMemo, useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { rentalApi } from './api'
import type { RentalOverview, RentalKpi } from './rentalConstants'
import { formatCurrency, cn } from '@/lib/utils'
import {
  TrendArea, TrendDual, BarsChart, DonutChart, HBarsChart,
} from '@/components/charts/reportCharts'
import {
  BarChart3, TrendingUp, TrendingDown, Calendar, ArrowRight,
  Download, X, Maximize2, RefreshCw, Clock, Truck, CreditCard,
  Users, Package, IndianRupee, Receipt, AlertTriangle, Percent,
  FileDown, Printer, CalendarDays, RotateCcw, UserPlus,
  ShieldAlert, Boxes, Tag, Activity,
} from 'lucide-react'

// ════════════════════════════════════════════════════════════════════════════
// Date-range presets
// ════════════════════════════════════════════════════════════════════════════
type RangeKey = 'today' | '7d' | '30d' | '90d' | 'mtd' | 'qtd' | 'fy' | 'custom'

const RANGES: { key: RangeKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: '90d', label: '90 days' },
  { key: 'mtd', label: 'This month' },
  { key: 'qtd', label: 'This quarter' },
  { key: 'fy', label: 'This FY' },
  { key: 'custom', label: 'Custom' },
]

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function rangeToDates(key: RangeKey, customFrom: string, customTo: string): { from: string; to: string } {
  const today = new Date()
  const to = iso(today)
  const start = new Date(today)
  switch (key) {
    case 'today': return { from: to, to }
    case '7d': start.setDate(today.getDate() - 6); return { from: iso(start), to }
    case '30d': start.setDate(today.getDate() - 29); return { from: iso(start), to }
    case '90d': start.setDate(today.getDate() - 89); return { from: iso(start), to }
    case 'mtd': return { from: iso(new Date(today.getFullYear(), today.getMonth(), 1)), to }
    case 'qtd': {
      const q = Math.floor(today.getMonth() / 3) * 3
      return { from: iso(new Date(today.getFullYear(), q, 1)), to }
    }
    case 'fy': {
      const y = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1
      return { from: iso(new Date(y, 3, 1)), to }
    }
    case 'custom':
      return { from: customFrom || to, to: customTo || to }
  }
}

function prettyDate(d: string) {
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return d
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ════════════════════════════════════════════════════════════════════════════
// Report descriptor types
// ════════════════════════════════════════════════════════════════════════════
type ChartKind = 'area' | 'dual' | 'bars' | 'donut' | 'hbars' | 'stats'
type Col = { key: string; label: string; money?: boolean; pct?: boolean; align?: 'right' }
type Row = Record<string, string | number | null | undefined>

interface RentalReport {
  id: string
  title: string
  desc: string
  icon: React.ElementType
  accent: string
  bg: string
  chart: ChartKind
  money: boolean
  series: (o: RentalOverview) => { label: string; value: number }[]
  trend?: (o: RentalOverview) => { date: string; revenue: number; orders: number }[]
  columns: Col[]
  rows: (o: RentalOverview) => Row[]
  stat?: (o: RentalOverview) => { label: string; value: string }
}

const fmtMoney = (n: number) => formatCurrency(n || 0)
const fmtNum = (n: number) => (n || 0).toLocaleString('en-IN')

const REPORTS: RentalReport[] = [
  {
    id: 'trend',
    title: 'Rental Trend',
    desc: 'Daily revenue & booking volume over the period',
    icon: TrendingUp, accent: 'text-emerald-600', bg: 'bg-emerald-50',
    chart: 'area', money: true,
    trend: (o) => o.trend.map(t => ({ date: t.date, revenue: t.revenue, orders: t.bookings })),
    series: (o) => o.trend.map(t => ({ label: t.date, value: t.revenue })),
    columns: [
      { key: 'date', label: 'Date' },
      { key: 'bookings', label: 'Bookings', align: 'right' },
      { key: 'revenue', label: 'Revenue', align: 'right', money: true },
    ],
    rows: (o) => o.trend.map(t => ({ date: prettyDate(t.date), bookings: t.bookings, revenue: t.revenue })),
    stat: (o) => ({ label: 'Total revenue', value: fmtMoney(o.kpis.revenue.value) }),
  },
  {
    id: 'status',
    title: 'Bookings by Status',
    desc: 'Distribution across pending, active, completed, cancelled',
    icon: BarChart3, accent: 'text-blue-600', bg: 'bg-blue-50',
    chart: 'donut', money: false,
    series: (o) => o.by_status.map(r => ({ label: r.status, value: r.bookings })),
    columns: [
      { key: 'status', label: 'Status' },
      { key: 'bookings', label: 'Bookings', align: 'right' },
      { key: 'revenue', label: 'Revenue', align: 'right', money: true },
    ],
    rows: (o) => o.by_status.map(r => ({ status: r.status, bookings: r.bookings, revenue: r.revenue })),
    stat: (o) => ({ label: 'Total bookings', value: fmtNum(o.kpis.bookings.value) }),
  },
  {
    id: 'payment_status',
    title: 'Payment Status',
    desc: 'Paid vs unpaid vs partial vs refunded',
    icon: Percent, accent: 'text-fuchsia-600', bg: 'bg-fuchsia-50',
    chart: 'donut', money: false,
    series: (o) => o.by_payment_status.map(r => ({ label: r.status, value: r.bookings })),
    columns: [
      { key: 'status', label: 'Payment status' },
      { key: 'bookings', label: 'Bookings', align: 'right' },
      { key: 'revenue', label: 'Revenue', align: 'right', money: true },
    ],
    rows: (o) => o.by_payment_status.map(r => ({ status: r.status, bookings: r.bookings, revenue: r.revenue })),
    stat: (o) => ({ label: 'Outstanding', value: fmtMoney(o.kpis.outstanding.value) }),
  },
  {
    id: 'payment_method',
    title: 'Payment Methods',
    desc: 'Revenue split by tender type',
    icon: CreditCard, accent: 'text-indigo-600', bg: 'bg-indigo-50',
    chart: 'bars', money: true,
    series: (o) => o.by_payment_method.map(r => ({ label: r.method, value: r.revenue })),
    columns: [
      { key: 'method', label: 'Method' },
      { key: 'bookings', label: 'Bookings', align: 'right' },
      { key: 'revenue', label: 'Revenue', align: 'right', money: true },
    ],
    rows: (o) => o.by_payment_method.map(r => ({ method: r.method, bookings: r.bookings, revenue: r.revenue })),
  },
  {
    id: 'pricing_plan',
    title: 'Revenue by Pricing Plan',
    desc: 'Hourly, daily, weekly, monthly & yearly plan mix',
    icon: Tag, accent: 'text-violet-600', bg: 'bg-violet-50',
    chart: 'bars', money: true,
    series: (o) => o.by_pricing_plan.map(r => ({ label: r.plan, value: r.revenue })),
    columns: [
      { key: 'plan', label: 'Plan' },
      { key: 'bookings', label: 'Bookings', align: 'right' },
      { key: 'revenue', label: 'Revenue', align: 'right', money: true },
    ],
    rows: (o) => o.by_pricing_plan.map(r => ({ plan: r.plan, bookings: r.bookings, revenue: r.revenue })),
    stat: (o) => ({ label: 'Plans in use', value: String(o.by_pricing_plan.length) }),
  },
  {
    id: 'category',
    title: 'Revenue by Category',
    desc: 'Asset category contribution to total revenue',
    icon: Boxes, accent: 'text-teal-600', bg: 'bg-teal-50',
    chart: 'hbars', money: true,
    series: (o) => o.by_category.slice(0, 8).map(r => ({ label: r.category.replace(/_/g, ' '), value: r.revenue })),
    columns: [
      { key: 'category', label: 'Category' },
      { key: 'bookings', label: 'Bookings', align: 'right' },
      { key: 'revenue', label: 'Revenue', align: 'right', money: true },
    ],
    rows: (o) => o.by_category.map(r => ({ category: r.category.replace(/_/g, ' '), bookings: r.bookings, revenue: r.revenue })),
    stat: (o) => ({ label: 'Categories', value: String(o.by_category.length) }),
  },
  {
    id: 'top_assets',
    title: 'Top Assets',
    desc: 'Best-performing assets by rental revenue',
    icon: Package, accent: 'text-orange-600', bg: 'bg-orange-50',
    chart: 'hbars', money: true,
    series: (o) => o.top_assets.slice(0, 8).map(r => ({ label: r.name, value: r.revenue })),
    columns: [
      { key: 'name', label: 'Asset' },
      { key: 'category', label: 'Category' },
      { key: 'bookings', label: 'Bookings', align: 'right' },
      { key: 'revenue', label: 'Revenue', align: 'right', money: true },
      { key: 'utilization_pct', label: 'Utilization %', align: 'right' },
    ],
    rows: (o) => o.top_assets.map(r => ({
      name: r.name,
      category: r.category.replace(/_/g, ' '),
      bookings: r.bookings,
      revenue: r.revenue,
      utilization_pct: `${r.utilization_pct}%`,
    })),
    stat: (o) => ({ label: 'Assets booked', value: String(o.top_assets.length) }),
  },
  {
    id: 'top_customers',
    title: 'Top Customers',
    desc: 'Highest-spending rental customers',
    icon: Users, accent: 'text-pink-600', bg: 'bg-pink-50',
    chart: 'hbars', money: true,
    series: (o) => o.top_customers.slice(0, 8).map(r => ({ label: r.name, value: r.spent })),
    columns: [
      { key: 'name', label: 'Customer' },
      { key: 'email', label: 'Email' },
      { key: 'bookings', label: 'Bookings', align: 'right' },
      { key: 'spent', label: 'Spent', align: 'right', money: true },
    ],
    rows: (o) => o.top_customers.map(r => ({ name: r.name, email: r.email, bookings: r.bookings, spent: r.spent })),
    stat: (o) => ({ label: 'Customers', value: fmtNum(o.kpis.customers.value) }),
  },
  {
    id: 'return_conditions',
    title: 'Return Conditions',
    desc: 'Good / damaged / missing on processed returns',
    icon: RotateCcw, accent: 'text-rose-600', bg: 'bg-rose-50',
    chart: 'bars', money: false,
    series: (o) => o.return_conditions.map(r => ({ label: r.condition, value: r.count })),
    columns: [
      { key: 'condition', label: 'Condition' },
      { key: 'count', label: 'Returns', align: 'right' },
      { key: 'damage_charge', label: 'Damage Charges', align: 'right', money: true },
      { key: 'late_fee', label: 'Late Fees', align: 'right', money: true },
    ],
    rows: (o) => o.return_conditions.map(r => ({
      condition: r.condition,
      count: r.count,
      damage_charge: r.damage_charge,
      late_fee: r.late_fee,
    })),
    stat: (o) => ({
      label: 'Total late fees',
      value: fmtMoney(o.kpis.late_fees.value),
    }),
  },
  {
    id: 'hourly',
    title: 'Bookings by Hour',
    desc: 'Peak booking hours of the day',
    icon: Clock, accent: 'text-amber-600', bg: 'bg-amber-50',
    chart: 'bars', money: false,
    series: (o) => o.by_hour.map(r => ({ label: `${String(r.hour).padStart(2, '0')}h`, value: r.bookings })),
    columns: [
      { key: 'hour', label: 'Hour' },
      { key: 'bookings', label: 'Bookings', align: 'right' },
      { key: 'revenue', label: 'Revenue', align: 'right', money: true },
    ],
    rows: (o) => o.by_hour.map(r => ({
      hour: `${String(r.hour).padStart(2, '0')}:00`,
      bookings: r.bookings,
      revenue: r.revenue,
    })),
  },
  {
    id: 'dow',
    title: 'Bookings by Weekday',
    desc: 'Booking volume by day of week',
    icon: CalendarDays, accent: 'text-cyan-600', bg: 'bg-cyan-50',
    chart: 'bars', money: false,
    series: (o) => o.by_dow.map(r => ({ label: r.label, value: r.bookings })),
    columns: [
      { key: 'label', label: 'Weekday' },
      { key: 'bookings', label: 'Bookings', align: 'right' },
      { key: 'revenue', label: 'Revenue', align: 'right', money: true },
    ],
    rows: (o) => o.by_dow.map(r => ({ label: r.label, bookings: r.bookings, revenue: r.revenue })),
  },
  {
    id: 'overdue',
    title: 'Overdue Rentals',
    desc: 'Assets currently past return date',
    icon: AlertTriangle, accent: 'text-rose-600', bg: 'bg-rose-50',
    chart: 'stats', money: false,
    series: () => [],
    columns: [
      { key: 'bucket', label: 'Overdue bucket' },
      { key: 'count', label: 'Bookings', align: 'right' },
    ],
    rows: (o) => [
      { bucket: '1–7 days overdue', count: o.overdue.bucket_1_7 },
      { bucket: '8–30 days overdue', count: o.overdue.bucket_8_30 },
      { bucket: '30+ days overdue', count: o.overdue.bucket_30_plus },
      { bucket: 'Total overdue', count: o.overdue.total },
    ],
    stat: (o) => ({ label: 'Total overdue', value: String(o.overdue.total) }),
  },
  {
    id: 'delivery',
    title: 'Delivery Performance',
    desc: 'On-time delivery rate for door-delivery bookings',
    icon: Truck, accent: 'text-slate-600', bg: 'bg-slate-100',
    chart: 'stats', money: false,
    series: () => [],
    columns: [
      { key: 'metric', label: 'Metric' },
      { key: 'value', label: 'Value', align: 'right' },
    ],
    rows: (o) => [
      { metric: 'Bookings with delivery', value: o.delivery.total_with_delivery },
      { metric: 'Delivered', value: o.delivery.delivered },
      { metric: 'On-time deliveries', value: o.delivery.on_time },
      { metric: 'On-time rate (%)', value: `${o.delivery.on_time_pct}%` },
    ],
  },
  {
    id: 'asset_status',
    title: 'Asset Status Mix',
    desc: 'Current availability snapshot across your fleet',
    icon: Activity, accent: 'text-emerald-600', bg: 'bg-emerald-50',
    chart: 'donut', money: false,
    series: (o) => o.asset_status_mix.map(r => ({ label: r.status.replace(/_/g, ' '), value: r.count })),
    columns: [
      { key: 'status', label: 'Status' },
      { key: 'count', label: 'Assets', align: 'right' },
    ],
    rows: (o) => o.asset_status_mix.map(r => ({
      status: r.status.replace(/_/g, ' '),
      count: r.count,
    })),
    stat: (o) => ({
      label: 'Total assets',
      value: String(o.asset_status_mix.reduce((s, r) => s + r.count, 0)),
    }),
  },
]

// ════════════════════════════════════════════════════════════════════════════
// Presentational helpers
// ════════════════════════════════════════════════════════════════════════════
function DeltaBadge({ kpi, invert = false }: { kpi: RentalKpi; invert?: boolean }) {
  if (kpi.delta_pct === null || kpi.delta_pct === undefined) {
    return <span className="text-xs text-gray-400">— vs prev</span>
  }
  const up = kpi.delta_pct >= 0
  const good = invert ? !up : up
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-xs font-medium', good ? 'text-emerald-600' : 'text-rose-600')}>
      {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {Math.abs(kpi.delta_pct)}%
    </span>
  )
}

function MiniChart({ report, data }: { report: RentalReport; data: RentalOverview }) {
  if (report.chart === 'stats') {
    if (report.id === 'overdue') {
      const o = data.overdue
      const tiles = [
        { label: '1–7 days', value: String(o.bucket_1_7) },
        { label: '8–30 days', value: String(o.bucket_8_30) },
        { label: '30+ days', value: String(o.bucket_30_plus) },
        { label: 'Total overdue', value: String(o.total) },
      ]
      return (
        <div className="grid grid-cols-2 gap-2">
          {tiles.map(t => (
            <div key={t.label} className="rounded-lg bg-muted/50 px-3 py-2">
              <p className="text-[11px] text-gray-500">{t.label}</p>
              <p className="text-base font-semibold text-foreground">{t.value}</p>
            </div>
          ))}
        </div>
      )
    }
    if (report.id === 'delivery') {
      const d = data.delivery
      const tiles = [
        { label: 'With delivery', value: String(d.total_with_delivery) },
        { label: 'Delivered', value: String(d.delivered) },
        { label: 'On-time', value: String(d.on_time) },
        { label: 'On-time rate', value: `${d.on_time_pct}%` },
      ]
      return (
        <div className="grid grid-cols-2 gap-2">
          {tiles.map(t => (
            <div key={t.label} className="rounded-lg bg-muted/50 px-3 py-2">
              <p className="text-[11px] text-gray-500">{t.label}</p>
              <p className="text-base font-semibold text-foreground">{t.value}</p>
            </div>
          ))}
        </div>
      )
    }
    return null
  }
  if (report.chart === 'area' && report.trend) {
    return <TrendArea data={report.trend(data)} height={120} compact metric="revenue" />
  }
  const series = report.series(data)
  if (series.length === 0) {
    return <div className="h-[120px] grid place-items-center text-xs text-gray-400">No data</div>
  }
  if (report.chart === 'donut') return <DonutChart data={series} height={120} compact money={report.money} />
  if (report.chart === 'hbars') return <HBarsChart data={series.slice(0, 5)} height={120} money={report.money} />
  return <BarsChart data={series} height={120} compact money={report.money} />
}

function DetailChart({ report, data }: { report: RentalReport; data: RentalOverview }) {
  if (report.chart === 'stats') return null
  if (report.chart === 'area' && report.trend) {
    return <TrendDual data={report.trend(data)} height={320} countLabel="Bookings" />
  }
  const series = report.series(data)
  if (series.length === 0) {
    return <div className="h-[320px] grid place-items-center text-sm text-gray-400">No data for this period</div>
  }
  if (report.chart === 'donut') return <DonutChart data={series} height={320} money={report.money} />
  if (report.chart === 'hbars') {
    return <HBarsChart data={series.slice(0, 15)} height={Math.max(320, series.slice(0, 15).length * 34)} money={report.money} />
  }
  return <BarsChart data={series} height={320} money={report.money} />
}

// ════════════════════════════════════════════════════════════════════════════
// Export helpers
// ════════════════════════════════════════════════════════════════════════════
async function exportPdf(el: HTMLElement, filename: string) {
  const { default: html2canvas } = await import('html2canvas')
  const { jsPDF } = await import('jspdf')
  const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
  const imgData = canvas.toDataURL('image/png')
  const pdf = new jsPDF({
    orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
    unit: 'px',
    format: [canvas.width / 2, canvas.height / 2],
  })
  pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2)
  pdf.save(filename)
}

function exportCsv(report: RentalReport, data: RentalOverview, rangeLabel: string) {
  const rows = report.rows(data)
  const header = report.columns.map(c => c.label).join(',')
  const body = rows.map(r =>
    report.columns.map(c => {
      const v = r[c.key]
      const s = v === null || v === undefined ? '' : String(v)
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }).join(','),
  ).join('\n')
  const csv = `${report.title} — ${rangeLabel}\n${header}\n${body}`
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `rental_${report.id}_${data.range.from}_${data.range.to}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ════════════════════════════════════════════════════════════════════════════
// Detail modal
// ════════════════════════════════════════════════════════════════════════════
function ReportDetailModal({
  report, data, rangeLabel, onClose,
}: {
  report: RentalReport; data: RentalOverview; rangeLabel: string; onClose: () => void
}) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [pdfLoading, setPdfLoading] = useState(false)

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', h); document.body.style.overflow = '' }
  }, [onClose])

  async function handlePdf() {
    if (!contentRef.current) return
    setPdfLoading(true)
    try {
      await exportPdf(contentRef.current, `rental_${report.id}_${data.range.from}_${data.range.to}.pdf`)
    } catch {
      toast.error('PDF export failed')
    } finally {
      setPdfLoading(false)
    }
  }

  function handlePrint() {
    if (!contentRef.current) return
    const win = window.open('', '_blank', 'width=1000,height=800')
    if (!win) return
    win.document.write(`
      <html><head><title>${report.title} — ${rangeLabel}</title>
      <style>
        body { font-family: system-ui, sans-serif; font-size: 13px; color: #111; padding: 24px; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        th { background: #f3f4f6; text-align: left; padding: 8px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; }
        td { padding: 7px 12px; border-bottom: 1px solid #e5e7eb; }
        .num { text-align: right; font-variant-numeric: tabular-nums; }
        h1 { font-size: 18px; margin: 0 0 4px; }
        p { color: #6b7280; font-size: 12px; margin: 0 0 16px; }
        @media print { @page { margin: 16mm; } }
      </style></head><body>
      <h1>${report.title}</h1>
      <p>${report.desc} &nbsp;·&nbsp; ${rangeLabel}</p>
      <table>
        <thead><tr>${report.columns.map(c => `<th${c.align === 'right' ? ' class="num"' : ''}>${c.label}</th>`).join('')}</tr></thead>
        <tbody>${report.rows(data).map(r =>
          `<tr>${report.columns.map(c => {
            const v = r[c.key]
            const display = c.money ? fmtMoney(Number(v) || 0) : (v ?? '—')
            return `<td${c.align === 'right' ? ' class="num"' : ''}>${display}</td>`
          }).join('')}</tr>`
        ).join('')}</tbody>
      </table>
      </body></html>
    `)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 400)
  }

  const rows = report.rows(data)
  const Icon = report.icon
  return (
    <div
      data-kiterp-modal
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 p-4 sm:p-8 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl rounded-xl border border-border bg-card shadow-xl my-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn('w-10 h-10 rounded-lg grid place-items-center shrink-0', report.bg)}>
              <Icon className={cn('w-5 h-5', report.accent)} />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-foreground truncate">{report.title}</h2>
              <p className="text-xs text-gray-500 truncate">{report.desc} · {rangeLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              onClick={() => exportCsv(report, data, rangeLabel)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-accent"
            >
              <FileDown className="w-3.5 h-3.5" /> CSV
            </button>
            <button
              onClick={handlePdf}
              disabled={pdfLoading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-accent disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" /> {pdfLoading ? 'Generating…' : 'PDF'}
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-accent"
            >
              <Printer className="w-3.5 h-3.5" /> Print
            </button>
            <button onClick={onClose} className="rounded-lg p-1.5 text-gray-500 hover:bg-accent" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div ref={contentRef} className="p-5 space-y-5">
          {report.chart !== 'stats' && (
            <div className="rounded-xl border border-border bg-background p-3">
              <DetailChart report={report} data={data} />
            </div>
          )}
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="max-h-[420px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/70 backdrop-blur">
                  <tr>
                    {report.columns.map(c => (
                      <th
                        key={c.key}
                        className={cn(
                          'px-4 py-2.5 text-xs font-semibold text-gray-600',
                          c.align === 'right' ? 'text-right' : 'text-left',
                        )}
                      >
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={report.columns.length} className="px-4 py-8 text-center text-gray-400">
                        No data for this period
                      </td>
                    </tr>
                  ) : rows.map((r, i) => (
                    <tr key={i} className="hover:bg-accent/50">
                      {report.columns.map(c => {
                        const v = r[c.key]
                        const display = c.money ? fmtMoney(Number(v) || 0) : (v ?? '—')
                        return (
                          <td
                            key={c.key}
                            className={cn(
                              'px-4 py-2.5',
                              c.align === 'right'
                                ? 'text-right tabular-nums font-medium text-foreground'
                                : 'text-gray-700',
                            )}
                          >
                            {display as React.ReactNode}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Quick links rail
// ════════════════════════════════════════════════════════════════════════════
const QUICK_LINKS = [
  { to: '/rental/bookings', label: 'All Bookings', icon: BarChart3 },
  { to: '/rental/assets', label: 'Asset Inventory', icon: Package },
  { to: '/rental/calendar', label: 'Rental Calendar', icon: Calendar },
  { to: '/rental/returns', label: 'Returns', icon: RotateCcw },
  { to: '/rental/filled-registrations', label: 'Registrations', icon: Receipt },
  { to: '/rental/dashboard', label: 'Dashboard', icon: Activity },
]

// ════════════════════════════════════════════════════════════════════════════
// Main page
// ════════════════════════════════════════════════════════════════════════════
export default function RentalReportsPage() {
  const [rangeKey, setRangeKey] = useState<RangeKey>('30d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [basis, setBasis] = useState<'booking' | 'rental_period'>('booking')
  const [openReport, setOpenReport] = useState<string | null>(null)

  const { from, to } = useMemo(
    () => rangeToDates(rangeKey, customFrom, customTo),
    [rangeKey, customFrom, customTo],
  )

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['rental-reports-overview', from, to, basis],
    queryFn: () => rentalApi.reportsOverview({ date_from: from, date_to: to, basis }),
    staleTime: 30_000,
  })

  const rangeLabel = `${prettyDate(from)} – ${prettyDate(to)}`

  const KPIS: {
    key: keyof RentalOverview['kpis']
    label: string
    icon: React.ElementType
    money?: boolean
    invert?: boolean
    accent: string
  }[] = [
    { key: 'revenue',          label: 'Rental Revenue',    icon: IndianRupee, money: true,  accent: 'text-emerald-600' },
    { key: 'bookings',         label: 'Bookings',          icon: BarChart3,                 accent: 'text-blue-600' },
    { key: 'avg_booking_value',label: 'Avg Booking Value', icon: Receipt,     money: true,  accent: 'text-indigo-600' },
    { key: 'net_revenue',      label: 'Net Revenue',       icon: TrendingUp,  money: true,  accent: 'text-teal-600' },
    { key: 'customers',        label: 'Customers',         icon: Users,                     accent: 'text-pink-600' },
    { key: 'new_customers',    label: 'New Customers',     icon: UserPlus,                  accent: 'text-cyan-600' },
    { key: 'deposits_held',    label: 'Deposits Held',     icon: ShieldAlert, money: true,  accent: 'text-violet-600' },
    { key: 'outstanding',      label: 'Outstanding',       icon: AlertTriangle,money: true, accent: 'text-orange-600', invert: true },
    { key: 'late_fees',        label: 'Late Fees',         icon: Percent,     money: true,  accent: 'text-rose-600',   invert: true },
    { key: 'damage_charges',   label: 'Damage Charges',    icon: Package,     money: true,  accent: 'text-amber-600',  invert: true },
    { key: 'deposits_refunded',label: 'Deposits Refunded', icon: RotateCcw,   money: true,  accent: 'text-lime-600' },
    { key: 'cancellation_rate',label: 'Cancellation Rate', icon: X,           money: false, accent: 'text-gray-500',   invert: true },
  ]

  return (
    <div className="space-y-5 max-w-[1500px]">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" /> Rental Report Analytics
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Date-range aware reporting across bookings, assets, customers and returns.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-accent"
        >
          <RefreshCw className={cn('w-4 h-4', isFetching && 'animate-spin')} /> Refresh
        </button>
      </div>

      {/* Filter bar */}
      <div className="sticky top-0 z-20 rounded-xl border border-border bg-card/95 backdrop-blur p-3 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
            <Calendar className="w-4 h-4" /> Period
          </div>
          <div className="flex flex-wrap items-center gap-1 bg-muted p-1 rounded-xl">
            {RANGES.map(r => (
              <button
                key={r.key}
                onClick={() => setRangeKey(r.key)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  rangeKey === r.key ? 'bg-card text-primary shadow-sm' : 'text-gray-600 hover:text-foreground',
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
          {rangeKey === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date" value={customFrom} max={customTo || undefined}
                onChange={e => setCustomFrom(e.target.value)}
                className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs"
              />
              <span className="text-gray-400 text-xs">to</span>
              <input
                type="date" value={customTo} min={customFrom || undefined}
                onChange={e => setCustomTo(e.target.value)}
                className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs"
              />
            </div>
          )}
          {/* Basis toggle */}
          <div className="flex items-center gap-1 bg-muted p-1 rounded-xl ml-auto">
            <button
              onClick={() => setBasis('booking')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                basis === 'booking' ? 'bg-card text-primary shadow-sm' : 'text-gray-600 hover:text-foreground',
              )}
              title="Attribute revenue to the date the booking was created"
            >
              Booking date
            </button>
            <button
              onClick={() => setBasis('rental_period')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                basis === 'rental_period' ? 'bg-card text-primary shadow-sm' : 'text-gray-600 hover:text-foreground',
              )}
              title="Attribute revenue to the rental start date"
            >
              Rental start date
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 text-xs text-gray-500 px-1">
          <span>
            Showing <strong className="text-foreground">{rangeLabel}</strong>
            {' · '}
            <span className="text-gray-400">basis: {basis === 'booking' ? 'booking date' : 'rental start date'}</span>
          </span>
          {data && (
            <span>vs previous period {prettyDate(data.range.prev_from)} – {prettyDate(data.range.prev_to)}</span>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl border border-border bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : !data ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-gray-500">
          Unable to load rental analytics. Try refreshing.
        </div>
      ) : (
        <>
          {/* KPI strip */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {KPIS.map(k => {
              const kpi = data.kpis[k.key]
              const Icon = k.icon
              return (
                <div key={k.key} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Icon className={cn('w-4 h-4', k.accent)} />
                    <DeltaBadge kpi={kpi} invert={k.invert} />
                  </div>
                  <p className="text-xl font-bold text-foreground tabular-nums">
                    {k.money ? fmtMoney(kpi.value) : (
                      k.key === 'cancellation_rate' ? `${kpi.value}%` : fmtNum(kpi.value)
                    )}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{k.label}</p>
                </div>
              )
            })}
          </div>

          {/* Quick links + featured trend */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
                <ArrowRight className="w-4 h-4 text-primary" /> Quick Links
              </h2>
              <div className="space-y-1">
                {QUICK_LINKS.map(l => {
                  const Icon = l.icon
                  return (
                    <Link
                      key={l.to} to={l.to}
                      className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-gray-700 hover:bg-accent transition-colors"
                    >
                      <Icon className="w-4 h-4 text-primary/80 shrink-0" />
                      <span className="font-medium">{l.label}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-gray-300 ml-auto" />
                    </Link>
                  )
                })}
              </div>
            </div>

            <div className="lg:col-span-3 rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Rental Trend</h2>
                  <p className="text-xs text-gray-500">Revenue & bookings over the selected period</p>
                </div>
                <button
                  onClick={() => setOpenReport('trend')}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  <Maximize2 className="w-3.5 h-3.5" /> Detail
                </button>
              </div>
              <TrendDual
                data={data.trend.map(t => ({ date: t.date, revenue: t.revenue, orders: t.bookings }))}
                height={240}
                countLabel="Bookings"
              />
            </div>
          </div>

          {/* Report cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {REPORTS.filter(r => r.id !== 'trend').map(report => {
              const Icon = report.icon
              const stat = report.stat?.(data)
              return (
                <div
                  key={report.id}
                  className="group rounded-xl border border-border bg-card p-4 hover:shadow-md hover:border-primary/30 transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <button
                      onClick={() => setOpenReport(report.id)}
                      className="flex items-center gap-2.5 min-w-0 text-left"
                    >
                      <div className={cn('w-9 h-9 rounded-lg grid place-items-center shrink-0', report.bg)}>
                        <Icon className={cn('w-5 h-5', report.accent)} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-foreground truncate">{report.title}</h3>
                        <p className="text-[11px] text-gray-500 truncate">{report.desc}</p>
                      </div>
                    </button>
                    <button
                      onClick={() => setOpenReport(report.id)}
                      className="rounded p-1 text-gray-300 hover:text-primary shrink-0 ml-2"
                      title="Expand detail"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    onClick={() => setOpenReport(report.id)}
                    className="w-full text-left min-h-[120px]"
                  >
                    <MiniChart report={report} data={data} />
                  </button>

                  {stat && (
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                      <span className="text-xs text-gray-500">{stat.label}</span>
                      <span className="text-sm font-semibold text-foreground tabular-nums">{stat.value}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {openReport && data && (
        <ReportDetailModal
          report={REPORTS.find(r => r.id === openReport)!}
          data={data}
          rangeLabel={rangeLabel}
          onClose={() => setOpenReport(null)}
        />
      )}
    </div>
  )
}
