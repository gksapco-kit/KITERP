import { useRef, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { vendorApi } from '@/api/vendor'
import { formatCurrency, cn } from '@/lib/utils'
import {
  TrendDual, DonutChart, BarsChart, HBarsChart,
  type CatDatum,
} from '@/components/charts/reportCharts'
import {
  IndianRupee, ShoppingCart, Receipt, Wallet, CreditCard, Package,
  CheckCircle2, RotateCcw, GitMerge, ThumbsUp, ArrowRight, Maximize2,
  ExternalLink, RefreshCw, TrendingUp, FileText, Users, ClipboardList,
  Star, Clock, AlertTriangle, FileX, X, Download, Printer,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { filtersToParams, type ProcurementReportFilters } from '../useProcurementReportFilters'
import { exportCSV } from '@/pages/inventory/analytics/exportUtils'

const fmtMoney = (n: number) => formatCurrency(n || 0)
const fmtNum = (n: number) => (n || 0).toLocaleString('en-IN')

// ── DeltaBadge ────────────────────────────────────────────────────────────────

function DeltaBadge({ pct, invert = false }: { pct: number | null | undefined; invert?: boolean }) {
  if (pct === null || pct === undefined) {
    return <span className="text-xs text-gray-400">— vs prev</span>
  }
  const up = pct >= 0
  const good = invert ? !up : up
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-xs font-medium', good ? 'text-emerald-600' : 'text-rose-600')}>
      {up ? <TrendingUp className="w-3 h-3" /> : <RotateCcw className="w-3 h-3" />}
      {Math.abs(pct)}%
    </span>
  )
}

// ── Quick Links ───────────────────────────────────────────────────────────────

const QUICK_LINKS: { to: string; label: string; icon: React.ElementType }[] = [
  { to: '/purchase-orders',                label: 'Purchase Orders',    icon: ShoppingCart },
  { to: '/procurement/requisitions',       label: 'Requisitions',       icon: ClipboardList },
  { to: '/procurement/suppliers',          label: 'Suppliers',          icon: Users },
  { to: '/procurement/rfq-quotations',     label: 'RFQ & Quotations',   icon: FileText },
  { to: '/procurement/grn',               label: 'Goods Receipt',      icon: Package },
  { to: '/procurement/vendor-invoices',    label: 'Vendor Invoices',    icon: Receipt },
  { to: '/procurement/purchase-returns',   label: 'Purchase Returns',   icon: RotateCcw },
  { to: '/procurement/analytics',          label: 'Spend Analytics',    icon: TrendingUp },
]

// ── KPI type ──────────────────────────────────────────────────────────────────

type OverviewKpis = {
  po_value: { value: number; prev: number; delta_pct: number | null }
  po_count: number
  invoiced_value: number
  paid_value: number
  open_ap: number
  grn_count: number
  return_value: number
  return_count: number
  return_rate_pct: number | null
  fulfilment_rate_pct: number | null
  pr_total: number
  pr_conversion_rate_pct: number | null
  acceptance_rate_pct: number | null
}

type TabKey =
  | 'overview' | 'spend' | 'trend' | 'cycle'
  | 'approvals' | 'scorecard' | 'funnel'
  | 'ppv' | 'match' | 'gst' | 'returns'

// ── Snap report descriptor ────────────────────────────────────────────────────

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
  tab: TabKey
  series: (snap: unknown) => CatDatum[]
  stat: (snap: unknown) => { label: string; value: string } | null
  csvHeaders: string[]
  csvRows: (snap: unknown) => (string | number | null | undefined)[][]
}

const SNAP_REPORTS: SnapReport[] = [
  {
    id: 'spend', title: 'Spend Analysis', desc: 'Top spending categories or suppliers',
    icon: TrendingUp, accent: 'text-emerald-600', bg: 'bg-emerald-50', chart: 'hbars', money: true,
    tab: 'spend',
    series: (s: unknown) => {
      const snap = s as { items?: { label: string; spend: number }[] }
      return (snap?.items ?? []).slice(0, 8).map(i => ({ label: i.label, value: i.spend }))
    },
    stat: (s: unknown) => {
      const snap = s as { total_spend?: number }
      return snap?.total_spend != null ? { label: 'Total spend', value: fmtMoney(snap.total_spend) } : null
    },
    csvHeaders: ['Group', 'POs', 'Spend', '% of Total', 'ABC Class'],
    csvRows: (s: unknown) => {
      const snap = s as { items?: { label: string; po_count: number; spend: number; pct_of_total: number; abc_class: string }[] }
      return (snap?.items ?? []).map(i => [i.label, i.po_count, i.spend, i.pct_of_total, i.abc_class])
    },
  },
  {
    id: 'scorecard', title: 'Supplier Scorecard', desc: 'Top suppliers by composite performance score',
    icon: Star, accent: 'text-amber-600', bg: 'bg-amber-50', chart: 'hbars', money: false,
    tab: 'scorecard',
    series: (s: unknown) => {
      const snap = s as { items?: { name: string; composite_score: number | null }[] }
      return (snap?.items ?? [])
        .filter(i => i.composite_score != null)
        .slice(0, 8)
        .map(i => ({ label: i.name, value: i.composite_score! }))
    },
    stat: (s: unknown) => {
      const snap = s as { total?: number }
      return snap?.total != null ? { label: 'Suppliers scored', value: fmtNum(snap.total) } : null
    },
    csvHeaders: ['Supplier', 'POs', 'On-Time %', 'Quality %', 'Match Rate %', 'Return Rate %', 'Score'],
    csvRows: (s: unknown) => {
      const snap = s as { items?: { name: string; po_count: number; on_time_delivery_pct: number | null; quality_acceptance_pct: number | null; invoice_match_rate_pct: number | null; return_rate_pct: number | null; composite_score: number | null }[] }
      return (snap?.items ?? []).map(i => [i.name, i.po_count, i.on_time_delivery_pct ?? '', i.quality_acceptance_pct ?? '', i.invoice_match_rate_pct ?? '', i.return_rate_pct ?? '', i.composite_score ?? ''])
    },
  },
  {
    id: 'funnel', title: 'Sourcing Funnel', desc: 'PR to PO conversion funnel stages',
    icon: GitMerge, accent: 'text-violet-600', bg: 'bg-violet-50', chart: 'hbars', money: false,
    tab: 'funnel',
    series: (s: unknown) => {
      const snap = s as { funnel?: { stage: string; count: number }[] }
      return (snap?.funnel ?? []).map(f => ({ label: f.stage, value: f.count }))
    },
    stat: (s: unknown) => {
      const snap = s as { pr_conversion_rate?: number | null; savings?: number }
      return snap?.pr_conversion_rate != null
        ? { label: 'PR → PO conversion', value: `${snap.pr_conversion_rate}%` }
        : snap?.savings != null ? { label: 'Realised savings', value: fmtMoney(snap.savings) } : null
    },
    csvHeaders: ['Stage', 'Count'],
    csvRows: (s: unknown) => {
      const snap = s as { funnel?: { stage: string; count: number }[] }
      return (snap?.funnel ?? []).map(f => [f.stage, f.count])
    },
  },
  {
    id: 'ppv', title: 'Price Variance', desc: 'Top products with PO vs invoice price gap',
    icon: AlertTriangle, accent: 'text-red-600', bg: 'bg-red-50', chart: 'hbars', money: true,
    tab: 'ppv',
    series: (s: unknown) => {
      const snap = s as { items?: { product_name: string; variance_value: number }[] }
      return (snap?.items ?? [])
        .filter(i => i.variance_value !== 0)
        .slice(0, 8)
        .map(i => ({ label: i.product_name.length > 20 ? `${i.product_name.slice(0, 18)}…` : i.product_name, value: Math.abs(i.variance_value) }))
    },
    stat: (s: unknown) => {
      const snap = s as { total_variance_value?: number }
      return snap?.total_variance_value != null ? { label: 'Total variance exposure', value: fmtMoney(snap.total_variance_value) } : null
    },
    csvHeaders: ['Product', 'Lines', 'Avg PO Price', 'Avg Inv Price', 'Avg Variance', 'Variance Value'],
    csvRows: (s: unknown) => {
      const snap = s as { items?: { product_name: string; line_count: number; avg_po_price: number; avg_inv_price: number; avg_variance: number; variance_value: number }[] }
      return (snap?.items ?? []).map(i => [i.product_name, i.line_count, i.avg_po_price, i.avg_inv_price, i.avg_variance, i.variance_value])
    },
  },
  {
    id: 'match', title: 'Match Exceptions', desc: 'Invoice matching blockers by type and value',
    icon: FileX, accent: 'text-orange-600', bg: 'bg-orange-50', chart: 'donut', money: true,
    tab: 'match',
    series: (s: unknown) => {
      const snap = s as { summary?: { match_status: string; count: number; value: number }[] }
      const labels: Record<string, string> = { blocked_qty: 'Qty Block', blocked_price: 'Price Block', partial: 'Partial' }
      return (snap?.summary ?? []).map(r => ({ label: labels[r.match_status] ?? r.match_status, value: r.value })).filter(d => d.value > 0)
    },
    stat: (s: unknown) => {
      const snap = s as { total?: number }
      return snap?.total != null ? { label: 'Total exceptions', value: fmtNum(snap.total) } : null
    },
    csvHeaders: ['Supplier', 'Exception Type', 'Invoice Value', 'Age (days)', 'Status'],
    csvRows: (s: unknown) => {
      const snap = s as { items?: { supplier_name: string; match_status: string; total: number; age_days: number; invoice_status: string }[] }
      return (snap?.items ?? []).map(i => [i.supplier_name, i.match_status, i.total, i.age_days, i.invoice_status])
    },
  },
  {
    id: 'returns', title: 'Purchase Returns', desc: 'Return value split by reason',
    icon: RotateCcw, accent: 'text-rose-600', bg: 'bg-rose-50', chart: 'donut', money: true,
    tab: 'returns',
    series: (s: unknown) => {
      const snap = s as { by_reason?: { reason: string; count: number; value: number }[] }
      return (snap?.by_reason ?? []).map(r => ({ label: r.reason, value: r.value })).filter(d => d.value > 0)
    },
    stat: (s: unknown) => {
      const snap = s as { total_value?: number; total?: number }
      return snap?.total_value != null ? { label: `${snap.total ?? 0} returns · value`, value: fmtMoney(snap.total_value) } : null
    },
    csvHeaders: ['Return Reason', 'Count', 'Value'],
    csvRows: (s: unknown) => {
      const snap = s as { by_reason?: { reason: string; count: number; value: number }[] }
      return (snap?.by_reason ?? []).map(r => [r.reason, r.count, r.value])
    },
  },
]

// ── MiniChart / DetailChart ───────────────────────────────────────────────────

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

// ── Report modal ──────────────────────────────────────────────────────────────

function ReportModal({
  report, snapData, onClose, onGoTab,
}: {
  report: SnapReport; snapData: unknown
  onClose: () => void; onGoTab: (tab: TabKey) => void
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
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')])
      const canvas = await html2canvas(contentRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [canvas.width / 2, canvas.height / 2] })
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2)
      pdf.save(`procurement-${report.id}.pdf`)
    } finally { setPdfLoading(false) }
  }

  function handlePrint() {
    if (!contentRef.current) return
    const rows = report.csvRows(snapData)
    const win = window.open('', '_blank', 'width=1000,height=800')
    if (!win) return
    win.document.write(`<html><head><title>${report.title}</title>
      <style>body{font-family:system-ui,sans-serif;font-size:13px;color:#111;padding:24px;}
      table{width:100%;border-collapse:collapse;margin-top:12px;}
      th{background:#f3f4f6;text-align:left;padding:8px 12px;font-size:11px;text-transform:uppercase;}
      td{padding:7px 12px;border-bottom:1px solid #e5e7eb;}
      h1{font-size:18px;margin:0 0 4px;}p{color:#6b7280;font-size:12px;margin:0 0 16px;}
      @media print{@page{margin:16mm;}}</style></head><body>
      <h1>${report.title}</h1><p>${report.desc}</p>
      <table><thead><tr>${report.csvHeaders.map(h => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c ?? '—'}</td>`).join('')}</tr>`).join('')}</tbody>
      </table></body></html>`)
    win.document.close(); win.focus()
    setTimeout(() => { win.print(); win.close() }, 400)
  }

  const Icon = report.icon
  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 p-4 sm:p-8 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-5xl rounded-xl border border-border bg-card shadow-xl my-4" onClick={e => e.stopPropagation()}>
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
            <button onClick={() => { onClose(); onGoTab(report.tab) }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-primary hover:bg-accent">
              <ExternalLink className="w-3.5 h-3.5" /> Full Tab
            </button>
            <button onClick={() => exportCSV(`procurement-${report.id}.csv`, report.csvHeaders, report.csvRows(snapData))}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-accent">
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
            <button onClick={handlePdf} disabled={pdfLoading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-accent disabled:opacity-50">
              <Download className="w-3.5 h-3.5" /> {pdfLoading ? 'Generating…' : 'PDF'}
            </button>
            <button onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-accent">
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
                  <tr>{report.csvHeaders.map(h => (
                    <th key={h} className="px-4 py-2.5 text-xs font-semibold text-gray-600 text-left">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {report.csvRows(snapData).map((row, i) => (
                    <tr key={i} className="hover:bg-accent/50">
                      {row.map((cell, j) => <td key={j} className="px-4 py-2.5 text-gray-700">{cell ?? '—'}</td>)}
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
  filters: ProcurementReportFilters
  refreshKey?: number
  onGoTab?: (tab: TabKey) => void
}) {
  const params = filtersToParams(filters)
  const [openReport, setOpenReport] = useState<string | null>(null)

  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ['vendor', 'proc-analytics-overview', params, refreshKey],
    queryFn: () => vendorApi.procurementAnalyticsOverview(params),
  })

  const { data: trendData } = useQuery({
    queryKey: ['vendor', 'proc-analytics-spend-trend-overview', params, refreshKey],
    queryFn: () => vendorApi.procurementAnalyticsSpendTrend({ ...params, bucket: 'day' }),
  })

  // Snapshot queries for report-card grid
  const snapParams = filtersToParams(filters, { limit: 100 })
  const { data: spendSnap }     = useQuery({ queryKey: ['vendor', 'proc-analytics-spend', snapParams, refreshKey],     queryFn: () => vendorApi.procurementAnalyticsSpend(snapParams) })
  const { data: scorecardSnap } = useQuery({ queryKey: ['vendor', 'proc-analytics-supplier-scorecard', snapParams, refreshKey], queryFn: () => vendorApi.procurementAnalyticsSupplierScorecard(snapParams) })
  const { data: funnelSnap }    = useQuery({ queryKey: ['vendor', 'proc-analytics-sourcing-funnel', snapParams, refreshKey],    queryFn: () => vendorApi.procurementAnalyticsSourcingFunnel(snapParams) })
  const { data: ppvSnap }       = useQuery({ queryKey: ['vendor', 'proc-analytics-price-variance', snapParams, refreshKey],     queryFn: () => vendorApi.procurementAnalyticsPriceVariance(snapParams) })
  const { data: matchSnap }     = useQuery({ queryKey: ['vendor', 'proc-analytics-match-exceptions', snapParams, refreshKey],   queryFn: () => vendorApi.procurementAnalyticsMatchExceptions(snapParams) })
  const { data: returnsSnap }   = useQuery({ queryKey: ['vendor', 'proc-analytics-returns', snapParams, refreshKey],             queryFn: () => vendorApi.procurementAnalyticsReturns(snapParams) })

  const snapByReportId: Record<string, unknown> = {
    spend:     spendSnap,
    scorecard: scorecardSnap,
    funnel:    funnelSnap,
    ppv:       ppvSnap,
    match:     matchSnap,
    returns:   returnsSnap,
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

  if (error || !data) {
    return (
      <div className="rounded-xl border border-border bg-card p-10 text-center space-y-3">
        <p className="text-gray-500">Failed to load overview. Please try again.</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-accent"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Retry
        </button>
      </div>
    )
  }

  const kpis = (data as { kpis: OverviewKpis }).kpis

  const KPIS: {
    key: string; label: string; value: string; delta?: number | null
    invert?: boolean; icon: React.ElementType; accent: string; tab?: TabKey
  }[] = [
    { key: 'po_value',    label: 'PO Committed',       value: fmtMoney(kpis.po_value.value), delta: kpis.po_value.delta_pct, icon: IndianRupee,    accent: 'text-emerald-600', tab: 'spend' },
    { key: 'po_count',    label: 'Purchase Orders',     value: fmtNum(kpis.po_count),                                         icon: ShoppingCart,   accent: 'text-blue-600',   tab: 'spend' },
    { key: 'invoiced',    label: 'Invoiced',             value: fmtMoney(kpis.invoiced_value),                                 icon: Receipt,        accent: 'text-indigo-600', tab: 'trend' },
    { key: 'paid',        label: 'Paid',                 value: fmtMoney(kpis.paid_value),                                     icon: Wallet,         accent: 'text-teal-600',   tab: 'trend' },
    { key: 'open_ap',     label: 'Outstanding AP',       value: fmtMoney(kpis.open_ap),       invert: true,                   icon: CreditCard,     accent: 'text-amber-600',  tab: 'match' },
    { key: 'grn',         label: 'GRNs Processed',       value: fmtNum(kpis.grn_count),                                       icon: Package,        accent: 'text-cyan-600',   tab: 'cycle' },
    { key: 'fulfilment',  label: 'PO Fulfilment Rate',   value: kpis.fulfilment_rate_pct != null ? `${kpis.fulfilment_rate_pct}%` : '—', icon: CheckCircle2, accent: 'text-pink-600', tab: 'cycle' },
    { key: 'returns',     label: 'Return Value',          value: fmtMoney(kpis.return_value),  invert: true,                  icon: RotateCcw,      accent: 'text-rose-600',   tab: 'returns' },
    { key: 'pr',          label: 'PR Conversion',         value: kpis.pr_conversion_rate_pct != null ? `${kpis.pr_conversion_rate_pct}%` : '—', icon: GitMerge, accent: 'text-violet-600', tab: 'funnel' },
    { key: 'acceptance',  label: 'GRN Acceptance',        value: kpis.acceptance_rate_pct != null ? `${kpis.acceptance_rate_pct}%` : '—',    icon: ThumbsUp, accent: 'text-lime-600', tab: 'cycle' },
  ]

  const trendSeries = ((trendData?.series ?? []) as { bucket: string; committed: number; invoiced: number }[]).map(p => ({
    date: p.bucket,
    revenue: p.committed,
    orders: p.invoiced,
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
            <button key={k.key} type="button" onClick={() => onGoTab(k.tab!)}
              className="rounded-xl border border-border bg-card p-4 text-left hover:border-primary/40 hover:shadow-sm transition-all">
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
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-600" /> Spend Trend
              </h2>
              <p className="text-xs text-gray-500">PO committed vs invoiced over the selected period</p>
            </div>
            {onGoTab && (
              <button onClick={() => onGoTab('trend')}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                <Maximize2 className="w-3.5 h-3.5" /> Detail
              </button>
            )}
          </div>
          {trendSeries.length === 0 ? (
            <div className="h-[240px] grid place-items-center text-sm text-gray-400">No spend data for this period</div>
          ) : (
            <TrendDual data={trendSeries} height={240} revLabel="Committed" countLabel="Invoiced" />
          )}
        </div>
      </div>

      {/* Report card grid — Sales Analytics style */}
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
              <div key={report.id}
                className="group rounded-xl border border-border bg-card p-4 hover:shadow-md hover:border-primary/30 transition-all">
                <div className="flex items-start justify-between mb-3">
                  <button onClick={() => setOpenReport(report.id)} className="flex items-center gap-2.5 min-w-0 text-left">
                    <div className={cn('w-9 h-9 rounded-lg grid place-items-center shrink-0', report.bg)}>
                      <Icon className={cn('w-5 h-5', report.accent)} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-foreground truncate">{report.title}</h3>
                      <p className="text-[11px] text-gray-500 truncate">{report.desc}</p>
                    </div>
                  </button>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <button onClick={() => setOpenReport(report.id)} className="rounded p-1 text-gray-300 hover:text-primary" title="Expand detail">
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                    {onGoTab && (
                      <button onClick={() => onGoTab(report.tab)} className="rounded p-1 text-gray-300 hover:text-primary" title="Open full tab">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <button onClick={() => setOpenReport(report.id)} className="w-full text-left min-h-[120px]">
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
          onGoTab={(tab) => { setOpenReport(null); onGoTab?.(tab) }}
        />
      )}
    </div>
  )
}
