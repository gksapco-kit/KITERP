import { useMemo, useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { vendorApi, type SalesOverview, type SalesKpi } from '@/api/vendor'
import { useStores } from '@/hooks/useVendor'
import { useVendorStore } from '@/stores/vendorStore'
import { formatCurrency, cn } from '@/lib/utils'
import { Select } from '@/components/ui/select'
import {
  TrendArea, TrendDual, BarsChart, DonutChart, HBarsChart,
} from './salesCharts'
import {
  BarChart3, TrendingUp, TrendingDown, ShoppingCart, Users, Package,
  IndianRupee, Receipt, FileText, Tag, Layers, Calendar, Store as StoreIcon,
  ArrowRight, Download, X, Maximize2, RefreshCw, Clock, Truck,
  CreditCard, UserPlus, PieChart as PieChartIcon, Percent, RotateCcw,
  CalendarDays, ScrollText, BadgePercent, Boxes, ExternalLink, Printer,
  FileDown,
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
    case 'today':
      return { from: to, to }
    case '7d':
      start.setDate(today.getDate() - 6); return { from: iso(start), to }
    case '30d':
      start.setDate(today.getDate() - 29); return { from: iso(start), to }
    case '90d':
      start.setDate(today.getDate() - 89); return { from: iso(start), to }
    case 'mtd':
      return { from: iso(new Date(today.getFullYear(), today.getMonth(), 1)), to }
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
// Report descriptors — each renders as a summary card + an expandable detail
// ════════════════════════════════════════════════════════════════════════════
type ChartKind = 'area' | 'dual' | 'bars' | 'donut' | 'hbars' | 'stats'
type Col = { key: string; label: string; money?: boolean; align?: 'right' }
type Row = Record<string, string | number | null | undefined>

interface SalesReport {
  id: string
  title: string
  desc: string
  icon: React.ElementType
  accent: string
  bg: string
  chart: ChartKind
  money: boolean
  /** trend points for area/dual, else {label,value} */
  series: (o: SalesOverview) => { label: string; value: number }[]
  trend?: (o: SalesOverview) => { date: string; revenue: number; orders: number; units: number }[]
  columns: Col[]
  rows: (o: SalesOverview) => Row[]
  stat?: (o: SalesOverview) => { label: string; value: string }
}

const fmtMoney = (n: number) => formatCurrency(n || 0)
const fmtNum = (n: number) => (n || 0).toLocaleString('en-IN')

const REPORTS: SalesReport[] = [
  {
    id: 'trend', title: 'Sales Trend', desc: 'Daily revenue & order volume over the period',
    icon: TrendingUp, accent: 'text-emerald-600', bg: 'bg-emerald-50', chart: 'area', money: true,
    trend: (o) => o.trend,
    series: (o) => o.trend.map(t => ({ label: t.date, value: t.revenue })),
    columns: [
      { key: 'date', label: 'Date' },
      { key: 'orders', label: 'Orders', align: 'right' },
      { key: 'units', label: 'Units', align: 'right' },
      { key: 'revenue', label: 'Revenue', align: 'right', money: true },
    ],
    rows: (o) => o.trend.map(t => ({ date: prettyDate(t.date), orders: t.orders, units: t.units, revenue: t.revenue })),
    stat: (o) => ({ label: 'Total revenue', value: fmtMoney(o.kpis.revenue.value) }),
  },
  {
    id: 'status', title: 'Orders by Status', desc: 'Distribution across fulfilment stages',
    icon: ShoppingCart, accent: 'text-blue-600', bg: 'bg-blue-50', chart: 'donut', money: false,
    series: (o) => o.by_status.map(r => ({ label: r.status, value: r.orders })),
    columns: [
      { key: 'status', label: 'Status' },
      { key: 'orders', label: 'Orders', align: 'right' },
      { key: 'revenue', label: 'Revenue', align: 'right', money: true },
    ],
    rows: (o) => o.by_status.map(r => ({ status: r.status, orders: r.orders, revenue: r.revenue })),
    stat: (o) => ({ label: 'Total orders', value: fmtNum(o.kpis.orders.value) }),
  },
  {
    id: 'source', title: 'Sales by Channel', desc: 'Online, POS, bookings & other sources',
    icon: PieChartIcon, accent: 'text-violet-600', bg: 'bg-violet-50', chart: 'donut', money: true,
    series: (o) => o.by_source.map(r => ({ label: r.source, value: r.revenue })),
    columns: [
      { key: 'source', label: 'Channel' },
      { key: 'orders', label: 'Orders', align: 'right' },
      { key: 'revenue', label: 'Revenue', align: 'right', money: true },
    ],
    rows: (o) => o.by_source.map(r => ({ source: r.source, orders: r.orders, revenue: r.revenue })),
    stat: (o) => ({ label: 'Channels', value: String(o.by_source.length) }),
  },
  {
    id: 'payment', title: 'Payment Methods', desc: 'Revenue split by tender type',
    icon: CreditCard, accent: 'text-indigo-600', bg: 'bg-indigo-50', chart: 'bars', money: true,
    series: (o) => o.by_payment_method.map(r => ({ label: r.method, value: r.revenue })),
    columns: [
      { key: 'method', label: 'Method' },
      { key: 'orders', label: 'Orders', align: 'right' },
      { key: 'revenue', label: 'Revenue', align: 'right', money: true },
    ],
    rows: (o) => o.by_payment_method.map(r => ({ method: r.method, orders: r.orders, revenue: r.revenue })),
  },
  {
    id: 'store', title: 'Sales by Business Unit', desc: 'Revenue contribution per outlet',
    icon: StoreIcon, accent: 'text-cyan-600', bg: 'bg-cyan-50', chart: 'hbars', money: true,
    series: (o) => o.by_store.slice(0, 8).map(r => ({ label: r.store_name, value: r.revenue })),
    columns: [
      { key: 'store_name', label: 'Business unit' },
      { key: 'orders', label: 'Orders', align: 'right' },
      { key: 'revenue', label: 'Revenue', align: 'right', money: true },
    ],
    rows: (o) => o.by_store.map(r => ({ store_name: r.store_name, orders: r.orders, revenue: r.revenue })),
    stat: (o) => ({ label: 'Units selling', value: String(o.by_store.length) }),
  },
  {
    id: 'top_products', title: 'Top Products', desc: 'Best sellers by revenue',
    icon: Package, accent: 'text-orange-600', bg: 'bg-orange-50', chart: 'hbars', money: true,
    series: (o) => o.top_products.slice(0, 8).map(r => ({ label: r.name, value: r.revenue })),
    columns: [
      { key: 'name', label: 'Product' },
      { key: 'qty', label: 'Units', align: 'right' },
      { key: 'revenue', label: 'Revenue', align: 'right', money: true },
    ],
    rows: (o) => o.top_products.map(r => ({ name: r.name, qty: r.qty, revenue: r.revenue })),
    stat: (o) => ({ label: 'Products sold', value: String(o.top_products.length) }),
  },
  {
    id: 'top_customers', title: 'Top Customers', desc: 'Highest-spending customers',
    icon: Users, accent: 'text-pink-600', bg: 'bg-pink-50', chart: 'hbars', money: true,
    series: (o) => o.top_customers.slice(0, 8).map(r => ({ label: r.name, value: r.spent })),
    columns: [
      { key: 'name', label: 'Customer' },
      { key: 'email', label: 'Email' },
      { key: 'orders', label: 'Orders', align: 'right' },
      { key: 'spent', label: 'Spent', align: 'right', money: true },
    ],
    rows: (o) => o.top_customers.map(r => ({ name: r.name, email: r.email, orders: r.orders, spent: r.spent })),
    stat: (o) => ({ label: 'Customers', value: fmtNum(o.kpis.customers.value) }),
  },
  {
    id: 'category', title: 'Sales by Category', desc: 'Revenue grouped by product category',
    icon: Boxes, accent: 'text-teal-600', bg: 'bg-teal-50', chart: 'bars', money: true,
    series: (o) => o.by_category.slice(0, 10).map(r => ({ label: r.category, value: r.revenue })),
    columns: [
      { key: 'category', label: 'Category' },
      { key: 'qty', label: 'Units', align: 'right' },
      { key: 'revenue', label: 'Revenue', align: 'right', money: true },
    ],
    rows: (o) => o.by_category.map(r => ({ category: r.category, qty: r.qty, revenue: r.revenue })),
    stat: (o) => ({ label: 'Categories', value: String(o.by_category.length) }),
  },
  {
    id: 'coupons', title: 'Coupons & Discounts', desc: 'Promo usage and discount value',
    icon: BadgePercent, accent: 'text-lime-600', bg: 'bg-lime-50', chart: 'hbars', money: true,
    series: (o) => o.coupons.slice(0, 8).map(r => ({ label: r.coupon, value: r.discount })),
    columns: [
      { key: 'coupon', label: 'Coupon' },
      { key: 'orders', label: 'Orders', align: 'right' },
      { key: 'discount', label: 'Discount', align: 'right', money: true },
    ],
    rows: (o) => o.coupons.map(r => ({ coupon: r.coupon, orders: r.orders, discount: r.discount })),
    stat: (o) => ({ label: 'Total discounts', value: fmtMoney(o.discounts.total_discount) }),
  },
  {
    id: 'hourly', title: 'Sales by Hour', desc: 'Peak ordering hours of the day',
    icon: Clock, accent: 'text-amber-600', bg: 'bg-amber-50', chart: 'bars', money: false,
    series: (o) => o.hourly.map(r => ({ label: `${String(r.hour).padStart(2, '0')}h`, value: r.orders })),
    columns: [
      { key: 'hour', label: 'Hour' },
      { key: 'orders', label: 'Orders', align: 'right' },
      { key: 'revenue', label: 'Revenue', align: 'right', money: true },
    ],
    rows: (o) => o.hourly.map(r => ({ hour: `${String(r.hour).padStart(2, '0')}:00`, orders: r.orders, revenue: r.revenue })),
  },
  {
    id: 'dow', title: 'Sales by Weekday', desc: 'Order volume by day of week',
    icon: CalendarDays, accent: 'text-rose-600', bg: 'bg-rose-50', chart: 'bars', money: false,
    series: (o) => o.by_dow.map(r => ({ label: r.label, value: r.orders })),
    columns: [
      { key: 'label', label: 'Weekday' },
      { key: 'orders', label: 'Orders', align: 'right' },
      { key: 'revenue', label: 'Revenue', align: 'right', money: true },
    ],
    rows: (o) => o.by_dow.map(r => ({ label: r.label, orders: r.orders, revenue: r.revenue })),
  },
  {
    id: 'paystatus', title: 'Payment Status', desc: 'Paid vs pending vs refunded',
    icon: Percent, accent: 'text-fuchsia-600', bg: 'bg-fuchsia-50', chart: 'donut', money: false,
    series: (o) => o.by_payment_status.map(r => ({ label: r.status, value: r.orders })),
    columns: [
      { key: 'status', label: 'Payment status' },
      { key: 'orders', label: 'Orders', align: 'right' },
      { key: 'revenue', label: 'Revenue', align: 'right', money: true },
    ],
    rows: (o) => o.by_payment_status.map(r => ({ status: r.status, orders: r.orders, revenue: r.revenue })),
  },
  {
    id: 'fulfillment', title: 'Fulfilment & Returns', desc: 'Delivery speed, cancellations & returns',
    icon: Truck, accent: 'text-slate-600', bg: 'bg-slate-100', chart: 'stats', money: false,
    series: () => [],
    columns: [
      { key: 'metric', label: 'Metric' },
      { key: 'value', label: 'Value', align: 'right' },
    ],
    rows: (o) => [
      { metric: 'Avg. time to ship (hrs)', value: o.fulfillment.avg_ship_hours },
      { metric: 'Avg. time to deliver (hrs)', value: o.fulfillment.avg_delivery_hours },
      { metric: 'Delivered orders', value: o.fulfillment.delivered_orders },
      { metric: 'Cancelled orders', value: o.fulfillment.cancelled_orders },
      { metric: 'Returned orders', value: o.fulfillment.returned_orders },
      { metric: 'Cancellation rate (%)', value: o.fulfillment.cancellation_rate },
    ],
  },
]

// ════════════════════════════════════════════════════════════════════════════
// Small presentational helpers
// ════════════════════════════════════════════════════════════════════════════
function DeltaBadge({ kpi, invert = false }: { kpi: SalesKpi; invert?: boolean }) {
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

function MiniChart({ report, data }: { report: SalesReport; data: SalesOverview }) {
  if (report.chart === 'stats') {
    const f = data.fulfillment
    const tiles = [
      { label: 'Avg ship', value: `${f.avg_ship_hours}h` },
      { label: 'Avg deliver', value: `${f.avg_delivery_hours}h` },
      { label: 'Delivered', value: fmtNum(f.delivered_orders) },
      { label: 'Cancel rate', value: `${f.cancellation_rate}%` },
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
  if (report.chart === 'area' && report.trend) {
    return <TrendArea data={report.trend(data)} height={120} compact metric="revenue" />
  }
  const series = report.series(data).map(s => ({ label: s.label, value: s.value }))
  if (series.length === 0) return <div className="h-[120px] grid place-items-center text-xs text-gray-400">No data</div>
  if (report.chart === 'donut') return <DonutChart data={series} height={120} compact money={report.money} />
  if (report.chart === 'hbars') return <HBarsChart data={series.slice(0, 5)} height={120} money={report.money} />
  return <BarsChart data={series} height={120} compact money={report.money} />
}

function DetailChart({ report, data }: { report: SalesReport; data: SalesOverview }) {
  if (report.chart === 'stats') return null
  if (report.chart === 'area' && report.trend) return <TrendDual data={report.trend(data)} height={320} />
  const series = report.series(data)
  if (series.length === 0) return <div className="h-[320px] grid place-items-center text-sm text-gray-400">No data for this period</div>
  if (report.chart === 'donut') return <DonutChart data={series} height={320} money={report.money} />
  if (report.chart === 'hbars') return <HBarsChart data={series.slice(0, 15)} height={Math.max(320, series.slice(0, 15).length * 34)} money={report.money} />
  return <BarsChart data={series} height={320} money={report.money} />
}

// Map Sales Manager report ids to the matching ReportId in /reports page
const REPORTS_PAGE_MAP: Record<string, string> = {
  trend:       'sales_overview',
  status:      'orders_status',
  source:      'sales_overview',
  payment:     'pos_report',
  store:       'sales_overview',
  top_products:'top_products',
  top_customers:'top_customers',
  category:    'top_products',
  coupons:     'coupons_report',
  hourly:      'sales_overview',
  dow:         'sales_overview',
  paystatus:   'orders_status',
  fulfillment: 'orders_status',
}

function reportsPageUrl(reportId: string, from: string, to: string, storeId?: string) {
  const p = new URLSearchParams()
  const mapped = REPORTS_PAGE_MAP[reportId]
  if (mapped) p.set('r', mapped)
  if (from) p.set('from', from)
  if (to) p.set('to', to)
  if (storeId) p.set('store', storeId)
  return `/reports?${p.toString()}`
}

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

function exportCsv(report: SalesReport, data: SalesOverview, rangeLabel: string) {
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
  a.download = `sales_${report.id}_${data.range.from}_${data.range.to}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function ReportDetailModal({ report, data, rangeLabel, from, to, storeId, onClose }: {
  report: SalesReport; data: SalesOverview; rangeLabel: string
  from: string; to: string; storeId?: string; onClose: () => void
}) {
  const navigate = useNavigate()
  const contentRef = useRef<HTMLDivElement>(null)
  const [pdfLoading, setPdfLoading] = useState(false)

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', h); document.body.style.overflow = '' }
  }, [onClose])

  const deepLink = reportsPageUrl(report.id, from, to, storeId)

  async function handlePdf() {
    if (!contentRef.current) return
    setPdfLoading(true)
    try {
      await exportPdf(contentRef.current, `sales_${report.id}_${from}_${to}.pdf`)
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
        p  { color: #6b7280; font-size: 12px; margin: 0 0 16px; }
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
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 sm:p-8 overflow-y-auto" onClick={onClose}>
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
              onClick={() => { onClose(); navigate(deepLink) }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-primary hover:bg-accent"
              title="Open in full Reports engine"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Full Report
            </button>
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
                      <th key={c.key} className={cn('px-4 py-2.5 text-xs font-semibold text-gray-600', c.align === 'right' ? 'text-right' : 'text-left')}>
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.length === 0 ? (
                    <tr><td colSpan={report.columns.length} className="px-4 py-8 text-center text-gray-400">No data for this period</td></tr>
                  ) : rows.map((r, i) => (
                    <tr key={i} className="hover:bg-accent/50">
                      {report.columns.map(c => {
                        const v = r[c.key]
                        const display = c.money ? fmtMoney(Number(v) || 0) : (v ?? '—')
                        return (
                          <td key={c.key} className={cn('px-4 py-2.5', c.align === 'right' ? 'text-right tabular-nums font-medium text-foreground' : 'text-gray-700')}>
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
// Quick links (Fiori-style left rail)
// ════════════════════════════════════════════════════════════════════════════
const QUICK_LINKS: { to: string; label: string; icon: React.ElementType }[] = [
  { to: '/orders', label: 'Manage Orders', icon: ShoppingCart },
  { to: '/pos', label: 'Point of Sale', icon: Receipt },
  { to: '/invoices', label: 'Invoices', icon: FileText },
  { to: '/quotations', label: 'Quotations', icon: ScrollText },
  { to: '/coupons', label: 'Coupons', icon: Tag },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/reports', label: 'All Reports', icon: BarChart3 },
  { to: '/inventory', label: 'Inventory', icon: Layers },
]

// ════════════════════════════════════════════════════════════════════════════
// Main page
// ════════════════════════════════════════════════════════════════════════════
export default function SalesManagerPage() {
  const { selectedStore } = useVendorStore()
  const { data: storeData } = useStores()
  const stores = storeData?.stores ?? []

  const [rangeKey, setRangeKey] = useState<RangeKey>('30d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [storeId, setStoreId] = useState<string>(selectedStore?.id ?? '')
  const [openReport, setOpenReport] = useState<string | null>(null)

  const { from, to } = useMemo(() => rangeToDates(rangeKey, customFrom, customTo), [rangeKey, customFrom, customTo])

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['sales-overview', from, to, storeId],
    queryFn: () => vendorApi.getSalesOverview({ date_from: from, date_to: to, store_id: storeId || undefined }),
    staleTime: 30_000,
  })

  const rangeLabel = `${prettyDate(from)} – ${prettyDate(to)}`
  const storeOptions = useMemo(
    () => [{ value: '', label: 'All Business Units' }, ...stores.map(s => ({ value: s.id, label: s.name }))],
    [stores],
  )

  const KPIS: {
    key: keyof SalesOverview['kpis']; label: string; icon: React.ElementType
    money?: boolean; invert?: boolean; accent: string; reportId?: string
  }[] = [
    { key: 'revenue',         label: 'Revenue',         icon: IndianRupee, money: true,  accent: 'text-emerald-600', reportId: 'trend' },
    { key: 'orders',          label: 'Orders',          icon: ShoppingCart,               accent: 'text-blue-600',   reportId: 'status' },
    { key: 'avg_order_value', label: 'Avg Order Value', icon: Receipt,     money: true,  accent: 'text-indigo-600', reportId: 'trend' },
    { key: 'units',           label: 'Units Sold',      icon: Package,                    accent: 'text-orange-600', reportId: 'top_products' },
    { key: 'customers',       label: 'Customers',       icon: Users,                      accent: 'text-pink-600',   reportId: 'top_customers' },
    { key: 'new_customers',   label: 'New Customers',   icon: UserPlus,                   accent: 'text-cyan-600',   reportId: 'top_customers' },
    { key: 'net_sales',       label: 'Net Sales',       icon: TrendingUp,  money: true,  accent: 'text-teal-600',   reportId: 'trend' },
    { key: 'discount',        label: 'Discounts',       icon: Percent,     money: true,  accent: 'text-lime-600',   invert: true, reportId: 'coupons' },
    { key: 'tax',             label: 'Tax Collected',   icon: BadgePercent,money: true,  accent: 'text-violet-600', reportId: 'paystatus' },
    { key: 'refunds',         label: 'Refunds',         icon: RotateCcw,   money: true,  accent: 'text-rose-600',   invert: true, reportId: 'fulfillment' },
  ]

  return (
    <div className="space-y-5 max-w-[1500px]">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" /> Sales Reporting Manager
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Summary & detailed sales reporting across orders, channels, products and customers.
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
              <input type="date" value={customFrom} max={customTo || undefined} onChange={e => setCustomFrom(e.target.value)}
                className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs" />
              <span className="text-gray-400 text-xs">to</span>
              <input type="date" value={customTo} min={customFrom || undefined} onChange={e => setCustomTo(e.target.value)}
                className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs" />
            </div>
          )}
          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 ml-auto">
            <StoreIcon className="w-4 h-4" /> Unit
          </div>
          <Select
            className="min-w-[200px]"
            value={storeId}
            onChange={setStoreId}
            options={storeOptions}
          />
        </div>
        <div className="flex items-center justify-between gap-2 text-xs text-gray-500 px-1">
          <span>Showing <strong className="text-foreground">{rangeLabel}</strong>{storeId ? ` · ${stores.find(s => s.id === storeId)?.name ?? ''}` : ' · all units'}</span>
          {data && <span>vs previous period {prettyDate(data.range.prev_from)} – {prettyDate(data.range.prev_to)}</span>}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl border border-border bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : !data ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-gray-500">
          Unable to load sales data. Try refreshing.
        </div>
      ) : (
        <>
          {/* KPI strip */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {KPIS.map(k => {
              const kpi = data.kpis[k.key]
              const Icon = k.icon
              const href = k.reportId ? reportsPageUrl(k.reportId, from, to, storeId || undefined) : undefined
              const inner = (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <Icon className={cn('w-4 h-4', k.accent)} />
                    <DeltaBadge kpi={kpi} invert={k.invert} />
                  </div>
                  <p className="text-xl font-bold text-foreground tabular-nums">
                    {k.money ? fmtMoney(kpi.value) : fmtNum(kpi.value)}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{k.label}</p>
                </>
              )
              return href ? (
                <Link key={k.key} to={href}
                  className="rounded-xl border border-border bg-card p-4 block hover:border-primary/40 hover:shadow-sm transition-all"
                  title={`Open ${k.label} in full Reports engine`}
                >
                  {inner}
                </Link>
              ) : (
                <div key={k.key} className="rounded-xl border border-border bg-card p-4">{inner}</div>
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
                    <Link key={l.to} to={l.to}
                      className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-gray-700 hover:bg-accent transition-colors">
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
                  <h2 className="text-sm font-semibold text-foreground">Sales Trend</h2>
                  <p className="text-xs text-gray-500">Revenue & orders over the selected period</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setOpenReport('trend')}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    <Maximize2 className="w-3.5 h-3.5" /> Detail
                  </button>
                  <Link
                    to={reportsPageUrl('trend', from, to, storeId || undefined)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-primary"
                    title="Open in full Reports engine"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Full Report
                  </Link>
                </div>
              </div>
              <TrendDual data={data.trend} height={240} />
            </div>
          </div>

          {/* Report cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {REPORTS.filter(r => r.id !== 'trend').map(report => {
              const Icon = report.icon
              const stat = report.stat?.(data)
              const deepHref = reportsPageUrl(report.id, from, to, storeId || undefined)
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
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <button
                        onClick={() => setOpenReport(report.id)}
                        className="rounded p-1 text-gray-300 hover:text-primary"
                        title="Expand detail"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>
                      <Link
                        to={deepHref}
                        className="rounded p-1 text-gray-300 hover:text-primary"
                        title="Open in full Reports engine"
                        onClick={e => e.stopPropagation()}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </div>
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
          from={from}
          to={to}
          storeId={storeId || undefined}
          onClose={() => setOpenReport(null)}
        />
      )}
    </div>
  )
}
