import { useRef, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { vendorApi } from '@/api/vendor'
import { formatCurrency, cn } from '@/lib/utils'
import {
  TrendDual, DonutChart, BarsChart, HBarsChart,
  compactCurrency, type CatDatum,
} from '@/components/charts/reportCharts'
import {
  IndianRupee, Package, ArrowDownToLine, ArrowUpFromLine, RefreshCw,
  TrendingUp, CalendarDays, AlertTriangle, Boxes, ClipboardCheck,
  ArrowRight, Maximize2, ExternalLink, Layers, Truck, Clock, FileText,
  ShoppingCart, Heart, Flame, Scale, X, Download, Printer,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { filtersToParams, type AnalyticsFilters } from '../useAnalyticsFilters'
import { exportCSV } from '../exportUtils'

const fmtMoney = (n: number) => formatCurrency(n || 0)
const fmtNum = (n: number) => (n || 0).toLocaleString('en-IN')

// ── DeltaBadge (consistent with Sales page) ──────────────────────────────────

function DeltaBadge({ pct, invert = false }: { pct: number | null | undefined; invert?: boolean }) {
  if (pct === null || pct === undefined) {
    return <span className="text-xs text-gray-400">— vs prev</span>
  }
  const up = pct >= 0
  const good = invert ? !up : up
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-xs font-medium', good ? 'text-emerald-600' : 'text-rose-600')}>
      {up ? <TrendingUp className="w-3 h-3" /> : <ArrowUpFromLine className="w-3 h-3 rotate-180" />}
      {Math.abs(pct)}%
    </span>
  )
}

// ── Quick Links ───────────────────────────────────────────────────────────────

const QUICK_LINKS: { to: string; label: string; icon: React.ElementType }[] = [
  { to: '/inventory',                  label: 'Stock Overview',    icon: Layers },
  { to: '/inventory/stock-counts',     label: 'Stock Counts',      icon: ClipboardCheck },
  { to: '/inventory/transfer-orders',  label: 'Transfer Orders',   icon: Truck },
  { to: '/inventory/expiry',           label: 'Expiry Dashboard',  icon: Clock },
  { to: '/inventory/reports',          label: 'Inventory Reports', icon: FileText },
  { to: '/purchase-orders',            label: 'Purchase Orders',   icon: ShoppingCart },
  { to: '/procurement/grn',            label: 'Goods Receipt',     icon: Package },
  { to: '/inventory/reservations',     label: 'Reservations',      icon: Boxes },
]

// ── KPI config ────────────────────────────────────────────────────────────────

type OverviewData = {
  period?: { date_from: string; date_to: string; days: number }
  stock_value?: { current: number; skus: number }
  inbound_value?: { current: number; delta_pct: number | null }
  outbound_value?: { current: number; delta_pct: number | null }
  stockouts?: number
  excess_value?: number
  expiry_at_risk_90d?: number
  count_accuracy_pct?: number | null
  turnover_ratio?: number | null
  days_sales_of_inventory?: number | null
}

// ── Snapshot report descriptor ────────────────────────────────────────────────
// Drives the lower report-card grid. Each card defines how to derive CatDatum[]
// from its snapshot API response, which chart type to show, and which tab to
// navigate to on expand/drill-down.

type ChartType = 'donut' | 'hbars' | 'bars'

interface SnapReport {
  id: string
  title: string
  desc: string
  icon: React.ElementType
  accent: string
  bg: string
  chart: ChartType
  money: boolean
  tab: 'health' | 'expiry' | 'shrinkage' | 'atp' | 'valuation' | 'transit'
  series: (snap: unknown) => CatDatum[]
  stat: (snap: unknown) => { label: string; value: string } | null
  csvHeaders: string[]
  csvRows: (snap: unknown) => (string | number | null | undefined)[][]
}

const SNAP_REPORTS: SnapReport[] = [
  {
    id: 'health', title: 'Stock Health', desc: 'Inventory status distribution across products',
    icon: Heart, accent: 'text-rose-600', bg: 'bg-rose-50', chart: 'donut', money: false,
    tab: 'health',
    series: (s: unknown) => {
      const snap = s as { summary?: Record<string, { count: number; value: number }> }
      const sm = snap?.summary ?? {}
      const LABELS: Record<string, string> = { stockout: 'Stockout', below_reorder: 'Below Reorder', healthy: 'Healthy', excess: 'Excess' }
      return Object.entries(LABELS)
        .map(([k, l]) => ({ label: l, value: sm[k]?.count ?? 0 }))
        .filter(d => d.value > 0)
    },
    stat: (s: unknown) => {
      const snap = s as { total?: number }
      return snap?.total != null ? { label: 'Products tracked', value: fmtNum(snap.total) } : null
    },
    csvHeaders: ['Status', 'Count', 'Value'],
    csvRows: (s: unknown) => {
      const snap = s as { summary?: Record<string, { count: number; value: number }> }
      return Object.entries(snap?.summary ?? {}).map(([k, v]) => [k, v.count, v.value])
    },
  },
  {
    id: 'expiry', title: 'Expiry Risk', desc: 'Batch value at risk by expiry horizon',
    icon: Clock, accent: 'text-amber-600', bg: 'bg-amber-50', chart: 'donut', money: true,
    tab: 'expiry',
    series: (s: unknown) => {
      const snap = s as { summary?: Record<string, { count: number; value: number }> }
      const sm = snap?.summary ?? {}
      const LABELS: Record<string, string> = {
        expired: 'Expired', '0_30d': '0–30 days', '31_90d': '31–90 days',
        '91_180d': '91–180 days', '180d_plus': '180+ days',
      }
      return Object.entries(LABELS)
        .map(([k, l]) => ({ label: l, value: sm[k]?.value ?? 0 }))
        .filter(d => d.value > 0)
    },
    stat: (s: unknown) => {
      const snap = s as { total_value_at_risk?: number }
      return snap?.total_value_at_risk != null
        ? { label: 'Total at risk', value: fmtMoney(snap.total_value_at_risk) }
        : null
    },
    csvHeaders: ['Bucket', 'Count', 'Value at Risk'],
    csvRows: (s: unknown) => {
      const snap = s as { summary?: Record<string, { count: number; value: number }> }
      return Object.entries(snap?.summary ?? {}).map(([k, v]) => [k, v.count, v.value])
    },
  },
  {
    id: 'shrinkage', title: 'Shrinkage', desc: 'Stock loss by movement type',
    icon: Flame, accent: 'text-orange-600', bg: 'bg-orange-50', chart: 'bars', money: true,
    tab: 'shrinkage',
    series: (s: unknown) => {
      const snap = s as { grouped?: { label: string; total_value: number }[] }
      return (snap?.grouped ?? []).slice(0, 8).map(g => ({ label: g.label, value: g.total_value }))
    },
    stat: (s: unknown) => {
      const snap = s as { total_value?: number }
      return snap?.total_value != null ? { label: 'Total shrinkage', value: fmtMoney(snap.total_value) } : null
    },
    csvHeaders: ['Group', 'Total Units', 'Total Value', 'Events'],
    csvRows: (s: unknown) => {
      const snap = s as { grouped?: { label: string; total_units: number; total_value: number; events: number }[] }
      return (snap?.grouped ?? []).map(g => [g.label, g.total_units, g.total_value, g.events])
    },
  },
  {
    id: 'atp', title: 'Available-to-Promise', desc: 'Fulfilment readiness by commitment status',
    icon: Boxes, accent: 'text-cyan-600', bg: 'bg-cyan-50', chart: 'donut', money: false,
    tab: 'atp',
    series: (s: unknown) => {
      const snap = s as { summary?: Record<string, { count: number }> }
      const sm = snap?.summary ?? {}
      const LABELS: Record<string, string> = { available: 'Available', fully_reserved: 'Fully Reserved', overcommitted: 'Overcommitted' }
      return Object.entries(LABELS)
        .map(([k, l]) => ({ label: l, value: sm[k]?.count ?? 0 }))
        .filter(d => d.value > 0)
    },
    stat: (s: unknown) => {
      const snap = s as { total_atp_value?: number }
      return snap?.total_atp_value != null ? { label: 'ATP value', value: fmtMoney(snap.total_atp_value) } : null
    },
    csvHeaders: ['Status', 'Count'],
    csvRows: (s: unknown) => {
      const snap = s as { summary?: Record<string, { count: number }> }
      return Object.entries(snap?.summary ?? {}).map(([k, v]) => [k, v.count])
    },
  },
  {
    id: 'valuation', title: 'Valuation Methods', desc: 'Total inventory value by costing method',
    icon: Scale, accent: 'text-violet-600', bg: 'bg-violet-50', chart: 'hbars', money: true,
    tab: 'valuation',
    series: (s: unknown) => {
      const snap = s as { totals?: { cost_price_value?: number; map_value?: number; standard_value?: number; fifo_value?: number } }
      const t = snap?.totals ?? {}
      return [
        { label: 'Cost Price', value: t.cost_price_value ?? 0 },
        { label: 'MAP',        value: t.map_value ?? 0 },
        { label: 'Standard',   value: t.standard_value ?? 0 },
        { label: 'FIFO',       value: t.fifo_value ?? 0 },
      ].filter(d => d.value > 0)
    },
    stat: (s: unknown) => {
      const snap = s as { totals?: { cost_price_value?: number } }
      return snap?.totals?.cost_price_value != null
        ? { label: 'Cost price total', value: fmtMoney(snap.totals.cost_price_value) }
        : null
    },
    csvHeaders: ['Method', 'Value'],
    csvRows: (s: unknown) => {
      const snap = s as { totals?: Record<string, number> }
      return Object.entries(snap?.totals ?? {}).map(([k, v]) => [k, v])
    },
  },
  {
    id: 'transit', title: 'In-Transit', desc: 'Transfer pipeline and lead-time distribution',
    icon: Truck, accent: 'text-blue-600', bg: 'bg-blue-50', chart: 'donut', money: false,
    tab: 'transit',
    series: (s: unknown) => {
      const snap = s as { in_transit?: { days_in_transit?: number | null }[] }
      const transfers = snap?.in_transit ?? []
      const buckets: Record<string, number> = {}
      for (const t of transfers) {
        const d = t.days_in_transit ?? 0
        const k = d <= 3 ? '0–3 days' : d <= 7 ? '4–7 days' : d <= 14 ? '8–14 days' : '15+ days'
        buckets[k] = (buckets[k] ?? 0) + 1
      }
      return Object.entries(buckets)
        .map(([label, value]) => ({ label, value }))
        .filter(d => d.value > 0)
    },
    stat: (s: unknown) => {
      const snap = s as { in_transit_value?: number; in_transit?: unknown[] }
      return snap?.in_transit_value != null
        ? { label: `${snap.in_transit?.length ?? 0} transfers · value`, value: fmtMoney(snap.in_transit_value) }
        : null
    },
    csvHeaders: ['Reference', 'Days', 'Value'],
    csvRows: (s: unknown) => {
      const snap = s as { in_transit?: { order_id: string; reference?: string | null; days_in_transit?: number | null; value: number }[] }
      return (snap?.in_transit ?? []).map(t => [t.reference ?? t.order_id.slice(0, 8), t.days_in_transit ?? '', t.value])
    },
  },
]

// ── MiniChart ─────────────────────────────────────────────────────────────────

function MiniChart({ report, snapData }: { report: SnapReport; snapData: unknown }) {
  const series = report.series(snapData)
  if (series.length === 0) return <div className="h-[120px] grid place-items-center text-xs text-gray-400">No data</div>
  if (report.chart === 'donut') return <DonutChart data={series} height={120} compact money={report.money} />
  if (report.chart === 'hbars') return <HBarsChart data={series.slice(0, 5)} height={120} money={report.money} />
  return <BarsChart data={series} height={120} compact money={report.money} />
}

function DetailChart({ report, snapData }: { report: SnapReport; snapData: unknown }) {
  const series = report.series(snapData)
  if (series.length === 0) return <div className="h-[320px] grid place-items-center text-sm text-gray-400">No data for this period</div>
  if (report.chart === 'donut') return <DonutChart data={series} height={320} money={report.money} />
  if (report.chart === 'hbars') return <HBarsChart data={series.slice(0, 15)} height={Math.max(320, series.slice(0, 15).length * 34)} money={report.money} />
  return <BarsChart data={series} height={320} money={report.money} />
}

// ── Report detail modal (mirrors Sales ReportDetailModal) ─────────────────────

function ReportModal({
  report,
  snapData,
  onClose,
  onGoTab,
}: {
  report: SnapReport
  snapData: unknown
  onClose: () => void
  onGoTab: (tab: SnapReport['tab']) => void
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
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ])
      const canvas = await html2canvas(contentRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [canvas.width / 2, canvas.height / 2] })
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2)
      pdf.save(`inventory-${report.id}.pdf`)
    } finally {
      setPdfLoading(false)
    }
  }

  function handlePrint() {
    if (!contentRef.current) return
    const rows = report.csvRows(snapData)
    const win = window.open('', '_blank', 'width=1000,height=800')
    if (!win) return
    win.document.write(`
      <html><head><title>${report.title}</title>
      <style>
        body{font-family:system-ui,sans-serif;font-size:13px;color:#111;padding:24px;}
        table{width:100%;border-collapse:collapse;margin-top:12px;}
        th{background:#f3f4f6;text-align:left;padding:8px 12px;font-size:11px;text-transform:uppercase;letter-spacing:.05em;}
        td{padding:7px 12px;border-bottom:1px solid #e5e7eb;}
        .num{text-align:right;}
        h1{font-size:18px;margin:0 0 4px;}
        p{color:#6b7280;font-size:12px;margin:0 0 16px;}
        @media print{@page{margin:16mm;}}
      </style></head><body>
      <h1>${report.title}</h1><p>${report.desc}</p>
      <table>
        <thead><tr>${report.csvHeaders.map(h => `<th>${h}</th>`).join('')}</tr></thead>
        <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c ?? '—'}</td>`).join('')}</tr>`).join('')}</tbody>
      </table></body></html>
    `)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 400)
  }

  function handleCsv() {
    exportCSV(`inventory-${report.id}.csv`, report.csvHeaders, report.csvRows(snapData))
  }

  const Icon = report.icon
  return (
    <div
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
              <p className="text-xs text-gray-500 truncate">{report.desc}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              onClick={() => { onClose(); onGoTab(report.tab) }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-primary hover:bg-accent"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Full Tab
            </button>
            <button
              onClick={handleCsv}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-accent"
            >
              <Download className="w-3.5 h-3.5" /> CSV
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
          <div className="rounded-xl border border-border bg-background p-3">
            <DetailChart report={report} snapData={snapData} />
          </div>
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="max-h-[380px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/70 backdrop-blur">
                  <tr>
                    {report.csvHeaders.map(h => (
                      <th key={h} className="px-4 py-2.5 text-xs font-semibold text-gray-600 text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {report.csvRows(snapData).map((row, i) => (
                    <tr key={i} className="hover:bg-accent/50">
                      {row.map((cell, j) => (
                        <td key={j} className="px-4 py-2.5 text-gray-700">{cell ?? '—'}</td>
                      ))}
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

// ── OverviewTab ───────────────────────────────────────────────────────────────

export function OverviewTab({
  filters,
  refreshKey = 0,
  onGoTab,
}: {
  filters: AnalyticsFilters
  refreshKey?: number
  onGoTab?: (tab: 'trend' | 'turnover' | 'health' | 'expiry' | 'accuracy' | 'shrinkage' | 'atp' | 'valuation' | 'transit') => void
}) {
  const params = filtersToParams(filters)
  const [openReport, setOpenReport] = useState<string | null>(null)

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['vendor', 'inv-analytics-overview', params, refreshKey],
    queryFn: () => vendorApi.inventoryAnalyticsOverview(params),
  })

  const { data: trendData } = useQuery({
    queryKey: ['vendor', 'inv-analytics-trend-overview', params, refreshKey],
    queryFn: () => vendorApi.inventoryAnalyticsMovementTrend({ ...params, bucket: 'day' }),
  })

  // Snapshot queries for the report-card grid (lightweight, cached)
  const snapParams = filtersToParams(filters, { limit: 100 })
  const { data: healthSnap } = useQuery({
    queryKey: ['vendor', 'inv-analytics-health', snapParams],
    queryFn: () => vendorApi.inventoryAnalyticsStockHealth(snapParams),
  })
  const { data: expirySnap } = useQuery({
    queryKey: ['vendor', 'inv-analytics-expiry', snapParams],
    queryFn: () => vendorApi.inventoryAnalyticsExpiryRisk(snapParams),
  })
  const { data: shrinkageSnap } = useQuery({
    queryKey: ['vendor', 'inv-analytics-shrinkage', snapParams],
    queryFn: () => vendorApi.inventoryAnalyticsShrinkage(snapParams),
  })
  const { data: atpSnap } = useQuery({
    queryKey: ['vendor', 'inv-analytics-atp', snapParams],
    queryFn: () => vendorApi.inventoryAnalyticsATP(snapParams),
  })
  const { data: valuationSnap } = useQuery({
    queryKey: ['vendor', 'inv-analytics-valuation-comparison', snapParams],
    queryFn: () => vendorApi.inventoryAnalyticsValuationComparison(snapParams),
  })
  const { data: transitSnap } = useQuery({
    queryKey: ['vendor', 'inv-analytics-in-transit', snapParams],
    queryFn: () => vendorApi.inventoryAnalyticsInTransit(snapParams),
  })

  const snapByReportId: Record<string, unknown> = {
    health:    healthSnap,
    expiry:    expirySnap,
    shrinkage: shrinkageSnap,
    atp:       atpSnap,
    valuation: valuationSnap,
    transit:   transitSnap,
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl border border-border bg-muted/40 animate-pulse" />
        ))}
      </div>
    )
  }

  const d = (data ?? {}) as OverviewData
  const sv = d.stock_value ?? { current: 0, skus: 0 }
  const inv = d.inbound_value ?? { current: 0, delta_pct: null }
  const out = d.outbound_value ?? { current: 0, delta_pct: null }

  const KPIS: {
    key: string
    label: string
    value: string
    delta?: number | null
    invert?: boolean
    icon: React.ElementType
    accent: string
    tab?: Parameters<NonNullable<typeof onGoTab>>[0]
  }[] = [
    { key: 'stock',    label: 'Total Stock Value',   value: fmtMoney(sv.current),                                   icon: IndianRupee,     accent: 'text-emerald-600', tab: 'health' },
    { key: 'skus',     label: 'Active SKUs',          value: fmtNum(sv.skus),                                        icon: Package,         accent: 'text-blue-600',   tab: 'health' },
    { key: 'inbound',  label: 'Inbound Value',        value: fmtMoney(inv.current),  delta: inv.delta_pct,           icon: ArrowDownToLine, accent: 'text-indigo-600', tab: 'trend' },
    { key: 'outbound', label: 'Outbound Value',       value: fmtMoney(out.current),  delta: out.delta_pct,           icon: ArrowUpFromLine, accent: 'text-orange-600', tab: 'trend' },
    { key: 'turnover', label: 'Inventory Turnover',   value: d.turnover_ratio != null ? `${d.turnover_ratio}×` : '—', icon: RefreshCw,     accent: 'text-pink-600',   tab: 'turnover' },
    { key: 'dsi',      label: 'Days of Inventory',    value: d.days_sales_of_inventory != null ? fmtNum(d.days_sales_of_inventory) : '—', icon: CalendarDays, accent: 'text-cyan-600', tab: 'turnover' },
    { key: 'stockouts',label: 'Stockouts',             value: fmtNum(d.stockouts ?? 0), invert: true,                icon: AlertTriangle,   accent: 'text-rose-600',   tab: 'health' },
    { key: 'excess',   label: 'Excess Stock Value',   value: fmtMoney(d.excess_value ?? 0), invert: true,            icon: Boxes,           accent: 'text-amber-600',  tab: 'health' },
    { key: 'expiry',   label: 'Expiry Risk (90d)',     value: fmtMoney(d.expiry_at_risk_90d ?? 0), invert: true,     icon: Clock,           accent: 'text-violet-600', tab: 'expiry' },
    { key: 'accuracy', label: 'Count Accuracy',        value: d.count_accuracy_pct != null ? `${d.count_accuracy_pct}%` : '—', icon: ClipboardCheck, accent: 'text-teal-600', tab: 'accuracy' },
  ]

  const trendSeries = ((trendData?.series ?? []) as { date: string; inbound_value: number; movements: number }[]).map(p => ({
    date: p.date,
    revenue: p.inbound_value,
    orders: p.movements,
  }))

  const openedReport = SNAP_REPORTS.find(r => r.id === openReport)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end">
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-accent"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', isFetching && 'animate-spin')} /> Refresh KPIs
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {KPIS.map(k => {
          const Icon = k.icon
          const inner = (
            <>
              <div className="flex items-center justify-between mb-2">
                <Icon className={cn('w-4 h-4', k.accent)} />
                <DeltaBadge pct={k.delta} invert={k.invert} />
              </div>
              <p className="text-xl font-bold text-foreground tabular-nums">{k.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{k.label}</p>
            </>
          )
          return k.tab && onGoTab ? (
            <button
              key={k.key}
              type="button"
              onClick={() => onGoTab(k.tab!)}
              className="rounded-xl border border-border bg-card p-4 text-left hover:border-primary/40 hover:shadow-sm transition-all"
            >
              {inner}
            </button>
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
                <Link
                  key={l.to}
                  to={l.to}
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
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-600" /> Movement Trend
              </h2>
              <p className="text-xs text-gray-500">Inbound value & movement volume over the selected period</p>
            </div>
            {onGoTab && (
              <button
                onClick={() => onGoTab('trend')}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <Maximize2 className="w-3.5 h-3.5" /> Detail
              </button>
            )}
          </div>
          {trendSeries.length === 0 ? (
            <div className="h-[240px] grid place-items-center text-sm text-gray-400">
              No movement data for this period
            </div>
          ) : (
            <TrendDual data={trendSeries} height={240} revLabel="Inbound" countLabel="Movements" />
          )}
        </div>
      </div>

      {/* Report cards grid — mirrors Sales Analytics UX */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
          <Maximize2 className="w-4 h-4 text-primary" /> Report Snapshots
          <span className="text-xs text-gray-400 font-normal ml-1">Click any card to expand with data table, CSV, PDF, Print</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {SNAP_REPORTS.map(report => {
            const Icon = report.icon
            const snapData = snapByReportId[report.id]
            const stat = report.stat(snapData)
            const series = report.series(snapData)
            const isEmpty = series.length === 0

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
                    {onGoTab && (
                      <button
                        onClick={() => onGoTab(report.tab as Parameters<NonNullable<typeof onGoTab>>[0])}
                        className="rounded p-1 text-gray-300 hover:text-primary"
                        title="Open full tab"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => setOpenReport(report.id)}
                  className="w-full text-left min-h-[120px]"
                >
                  {snapData === undefined ? (
                    <div className="h-[120px] grid place-items-center">
                      <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    </div>
                  ) : isEmpty ? (
                    <div className="h-[120px] grid place-items-center text-xs text-gray-400">No data</div>
                  ) : (
                    <MiniChart report={report} snapData={snapData} />
                  )}
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
      </div>

      {/* Detail modal */}
      {openReport && openedReport && (
        <ReportModal
          report={openedReport}
          snapData={snapByReportId[openReport]}
          onClose={() => setOpenReport(null)}
          onGoTab={(tab) => {
            setOpenReport(null)
            onGoTab?.(tab as Parameters<NonNullable<typeof onGoTab>>[0])
          }}
        />
      )}
    </div>
  )
}
