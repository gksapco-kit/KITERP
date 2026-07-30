import { useMemo, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { pharmaReportsApi, type PharmaReportsOverview, type PharmaKpi } from '@/api/pharma'
import { BarsChart, DonutChart, HBarsChart, CHART_COLORS } from '@/pages/sales/salesCharts'
import {
  AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import { cn } from '@/lib/utils'
import {
  FlaskConical, Package, ShieldAlert, TrendingUp, TrendingDown,
  ClipboardList, ClipboardCheck, AlertCircle, ListChecks, Workflow,
  MessageSquare, ThermometerSnowflake, QrCode, History, FileText,
  BarChart3, Maximize2, X, Download, Printer, RefreshCw, Calendar,
  ExternalLink, ChevronRight, Search, ArrowRight, Activity,
} from 'lucide-react'

// ── Date helpers ──────────────────────────────────────────────────────────────
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

function rangeToDates(key: RangeKey, cf: string, ct: string): { from: string; to: string } {
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
    case 'custom': return { from: cf || to, to: ct || to }
  }
}

function prettyDate(d: string) {
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return d
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtNum(n: number) { return (n || 0).toLocaleString('en-IN') }
function fmtPct(n: number) { return `${(n || 0).toFixed(1)}%` }

// ── Types ─────────────────────────────────────────────────────────────────────
type Tab = 'lots' | 'manufacturing' | 'qc' | 'qms' | 'gdp' | 'serialization'
type ChartKind = 'bars' | 'donut' | 'hbars' | 'trend' | 'stats'
type Col = { key: string; label: string; align?: 'right'; pct?: boolean }
type Row = Record<string, string | number | boolean | null | undefined>

interface PharmaReport {
  id: string
  tab: Tab
  title: string
  desc: string
  icon: React.ElementType
  accent: string
  bg: string
  chart: ChartKind
  series: (o: PharmaReportsOverview) => { label: string; value: number }[]
  trend?: (o: PharmaReportsOverview) => { date: string; value: number }[]
  columns: Col[]
  rows: (o: PharmaReportsOverview) => Row[]
  stat?: (o: PharmaReportsOverview) => { label: string; value: string }
  detailId?: string
  linkTo?: string
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

function shortDate(d: string) {
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return d
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

// Mini trend area for compact cards
function MiniTrend({ data }: { data: { date: string; value: number }[] }) {
  if (!data.length) return <div className="h-[80px] flex items-center justify-center text-xs text-gray-400">No data</div>
  return (
    <ResponsiveContainer width="100%" height={80}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
        <defs>
          <linearGradient id="mini-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CHART_COLORS[0]} stopOpacity={0.35} />
            <stop offset="95%" stopColor={CHART_COLORS[0]} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <Tooltip {...tooltipStyle} labelFormatter={(l) => shortDate(String(l))} formatter={(v: number) => [v, 'Count']} />
        <Area type="monotone" dataKey="value" stroke={CHART_COLORS[0]} strokeWidth={2} fill="url(#mini-grad)" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// Full-size trend for modal
function FullTrend({ data, label }: { data: { date: string; value: number }[]; label: string }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
        <defs>
          <linearGradient id="full-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CHART_COLORS[0]} stopOpacity={0.35} />
            <stop offset="95%" stopColor={CHART_COLORS[0]} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} tick={axisStyle} tickLine={false} axisLine={false} minTickGap={24} />
        <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={36} />
        <Tooltip {...tooltipStyle} labelFormatter={(l) => shortDate(String(l))} formatter={(v: number) => [v, label]} />
        <Area type="monotone" dataKey="value" stroke={CHART_COLORS[0]} strokeWidth={2} fill="url(#full-grad)" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ── Report catalogue ─────────────────────────────────────────────────────────
const REPORTS: PharmaReport[] = [
  // ─ LOT CONTROL ─────────────────────────────────────────────────────────────
  {
    id: 'batch_status',
    tab: 'lots',
    title: 'Batch Status Distribution',
    desc: 'Active lots split by quality status (unrestricted / QI / blocked)',
    icon: Package,
    accent: 'text-blue-600', bg: 'bg-blue-50',
    chart: 'donut',
    series: (o) => o.lots.status_dist,
    columns: [{ key: 'label', label: 'Status' }, { key: 'value', label: 'Lots', align: 'right' }],
    rows: (o) => o.lots.status_dist,
    stat: (o) => {
      const total = o.lots.status_dist.reduce((s, d) => s + d.value, 0)
      const unr = o.lots.status_dist.find(d => d.label === 'unrestricted')?.value ?? 0
      return { label: 'Total active lots', value: `${fmtNum(total)} (${fmtNum(unr)} unrestricted)` }
    },
    detailId: 'batch_register',
    linkTo: '/pharma/batches',
  },
  {
    id: 'expiry_buckets',
    tab: 'lots',
    title: 'Expiry Ageing',
    desc: 'Active lots segmented by days remaining to expiry',
    icon: Calendar,
    accent: 'text-orange-600', bg: 'bg-orange-50',
    chart: 'bars',
    series: (o) => o.lots.expiry_buckets,
    columns: [{ key: 'label', label: 'Bucket' }, { key: 'value', label: 'Lots', align: 'right' }],
    rows: (o) => o.lots.expiry_buckets,
    stat: (o) => {
      const expired = o.lots.expiry_buckets.find(d => d.label === 'Expired')?.value ?? 0
      const soon = o.lots.expiry_buckets.find(d => d.label === '0–30d')?.value ?? 0
      return { label: 'Expired + expiring ≤30d', value: `${fmtNum(expired + soon)} lots` }
    },
    detailId: 'expiry_register',
    linkTo: '/pharma/batches',
  },
  {
    id: 'txn_trend',
    tab: 'lots',
    title: 'Transaction Volume',
    desc: 'Daily batch movement transactions over the selected period',
    icon: Activity,
    accent: 'text-teal-600', bg: 'bg-teal-50',
    chart: 'trend',
    series: (o) => o.lots.txn_trend.map(t => ({ label: t.date, value: t.value })),
    trend: (o) => o.lots.txn_trend,
    columns: [{ key: 'date', label: 'Date' }, { key: 'value', label: 'Transactions', align: 'right' }],
    rows: (o) => o.lots.txn_trend.map(t => ({ date: prettyDate(t.date), value: t.value })),
    stat: (o) => ({
      label: 'Total transactions',
      value: fmtNum(o.lots.txn_trend.reduce((s, t) => s + t.value, 0)),
    }),
    detailId: 'txn_log',
    linkTo: '/pharma/movements',
  },
  {
    id: 'txn_by_type',
    tab: 'lots',
    title: 'Transactions by Type',
    desc: 'Receive / issue / produce / transfer / adjust breakdown',
    icon: ArrowRight,
    accent: 'text-indigo-600', bg: 'bg-indigo-50',
    chart: 'bars',
    series: (o) => o.lots.txn_by_type,
    columns: [{ key: 'label', label: 'Type' }, { key: 'value', label: 'Count', align: 'right' }],
    rows: (o) => o.lots.txn_by_type,
    detailId: 'txn_log',
    linkTo: '/pharma/movements',
  },
  {
    id: 'top_expiring',
    tab: 'lots',
    title: 'Lots Expiring Soonest',
    desc: 'Top 10 active lots with qty > 0 expiring within 90 days',
    icon: AlertCircle,
    accent: 'text-rose-600', bg: 'bg-rose-50',
    chart: 'hbars',
    series: (o) => o.lots.top_expiring.map(t => ({ label: t.label, value: t.value })),
    columns: [
      { key: 'label', label: 'Batch' },
      { key: 'value', label: 'Days left', align: 'right' },
      { key: 'qty', label: 'Qty', align: 'right' },
      { key: 'status', label: 'Status' },
    ],
    rows: (o) => o.lots.top_expiring,
    stat: (o) => ({ label: 'Lots needing attention', value: fmtNum(o.lots.top_expiring.length) }),
    detailId: 'expiry_register',
    linkTo: '/pharma/batches',
  },

  // ─ MANUFACTURING ────────────────────────────────────────────────────────────
  {
    id: 'bpr_status',
    tab: 'manufacturing',
    title: 'BPR Status',
    desc: 'Batch Production Records by workflow stage in the period',
    icon: ClipboardList,
    accent: 'text-violet-600', bg: 'bg-violet-50',
    chart: 'donut',
    series: (o) => o.manufacturing.bpr_status_dist,
    columns: [{ key: 'label', label: 'Status' }, { key: 'value', label: 'BPRs', align: 'right' }],
    rows: (o) => o.manufacturing.bpr_status_dist,
    stat: (o) => ({
      label: 'Total BPRs',
      value: fmtNum(o.manufacturing.bpr_status_dist.reduce((s, d) => s + d.value, 0)),
    }),
    detailId: 'bpr_list',
    linkTo: '/pharma/bpr',
  },
  {
    id: 'yield_trend',
    tab: 'manufacturing',
    title: 'Batch Yield Trend',
    desc: 'Daily average batch yield % for completed BPRs',
    icon: TrendingUp,
    accent: 'text-emerald-600', bg: 'bg-emerald-50',
    chart: 'trend',
    series: (o) => o.manufacturing.yield_trend.map(t => ({ label: t.date, value: t.value })),
    trend: (o) => o.manufacturing.yield_trend,
    columns: [
      { key: 'date', label: 'Date' },
      { key: 'value', label: 'Avg Yield %', align: 'right', pct: true },
      { key: 'count', label: 'BPRs', align: 'right' },
    ],
    rows: (o) => o.manufacturing.yield_trend.map(t => ({
      date: prettyDate(t.date),
      value: t.value,
      count: t.count ?? 0,
    })),
    stat: (o) => {
      const vals = o.manufacturing.yield_trend.map(t => t.value).filter(v => v > 0)
      const avg = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0
      return { label: 'Period avg yield', value: fmtPct(avg) }
    },
    detailId: 'bpr_yield',
    linkTo: '/pharma/bpr',
  },
  {
    id: 'mbr_status',
    tab: 'manufacturing',
    title: 'MBR Status',
    desc: 'Master Batch Record templates by approval status',
    icon: FileText,
    accent: 'text-cyan-600', bg: 'bg-cyan-50',
    chart: 'donut',
    series: (o) => o.manufacturing.mbr_status,
    columns: [{ key: 'label', label: 'Status' }, { key: 'value', label: 'MBRs', align: 'right' }],
    rows: (o) => o.manufacturing.mbr_status,
    stat: (o) => ({
      label: 'Total MBRs',
      value: fmtNum(o.manufacturing.mbr_status.reduce((s, d) => s + d.value, 0)),
    }),
    detailId: 'mbr_list',
    linkTo: '/pharma/mbr',
  },

  // ─ QUALITY CONTROL ──────────────────────────────────────────────────────────
  {
    id: 'inspection_decision',
    tab: 'qc',
    title: 'Inspection Decisions',
    desc: 'QC lot outcomes: released, rejected, pending, retest',
    icon: ClipboardCheck,
    accent: 'text-teal-600', bg: 'bg-teal-50',
    chart: 'donut',
    series: (o) => o.qc.inspection_decision,
    columns: [{ key: 'label', label: 'Decision' }, { key: 'value', label: 'Lots', align: 'right' }],
    rows: (o) => o.qc.inspection_decision,
    stat: (o) => {
      const total = o.qc.inspection_decision.reduce((s, d) => s + d.value, 0)
      const released = o.qc.inspection_decision.find(d => d.label === 'release')?.value ?? 0
      const rate = total ? Math.round((released / total) * 100) : 0
      return { label: 'Release rate', value: `${rate}%` }
    },
    detailId: 'inspection_list',
    linkTo: '/pharma/inspections',
  },
  {
    id: 'inspection_origin',
    tab: 'qc',
    title: 'Inspections by Origin',
    desc: 'Receipt vs production vs retest vs complaint origins',
    icon: FlaskConical,
    accent: 'text-blue-600', bg: 'bg-blue-50',
    chart: 'bars',
    series: (o) => o.qc.inspection_origin,
    columns: [{ key: 'label', label: 'Origin' }, { key: 'value', label: 'Count', align: 'right' }],
    rows: (o) => o.qc.inspection_origin,
    detailId: 'inspection_list',
    linkTo: '/pharma/inspections',
  },
  {
    id: 'inspection_trend',
    tab: 'qc',
    title: 'Inspection Volume Trend',
    desc: 'Daily QC inspection lots opened over the period',
    icon: TrendingUp,
    accent: 'text-indigo-600', bg: 'bg-indigo-50',
    chart: 'trend',
    series: (o) => o.qc.inspection_trend.map(t => ({ label: t.date, value: t.value })),
    trend: (o) => o.qc.inspection_trend,
    columns: [{ key: 'date', label: 'Date' }, { key: 'value', label: 'Inspections', align: 'right' }],
    rows: (o) => o.qc.inspection_trend.map(t => ({ date: prettyDate(t.date), value: t.value })),
    stat: (o) => ({
      label: 'Total inspections in period',
      value: fmtNum(o.qc.inspection_trend.reduce((s, t) => s + t.value, 0)),
    }),
    detailId: 'inspection_list',
    linkTo: '/pharma/inspections',
  },
  {
    id: 'oos_status',
    tab: 'qc',
    title: 'OOS Investigations',
    desc: 'Out-of-specification investigations by status',
    icon: AlertCircle,
    accent: 'text-rose-600', bg: 'bg-rose-50',
    chart: 'donut',
    series: (o) => o.qc.oos_status,
    columns: [{ key: 'label', label: 'OOS Status' }, { key: 'value', label: 'Count', align: 'right' }],
    rows: (o) => o.qc.oos_status,
    detailId: 'inspection_oos',
    linkTo: '/pharma/inspections',
  },

  // ─ QMS ──────────────────────────────────────────────────────────────────────
  {
    id: 'deviation_severity',
    tab: 'qms',
    title: 'Deviations by Severity',
    desc: 'Minor / major / critical deviation breakdown for the period',
    icon: ShieldAlert,
    accent: 'text-orange-600', bg: 'bg-orange-50',
    chart: 'donut',
    series: (o) => o.qms.deviation_severity,
    columns: [{ key: 'label', label: 'Severity' }, { key: 'value', label: 'Count', align: 'right' }],
    rows: (o) => o.qms.deviation_severity,
    stat: (o) => ({
      label: 'Total deviations in period',
      value: fmtNum(o.qms.deviation_severity.reduce((s, d) => s + d.value, 0)),
    }),
    detailId: 'deviation_list',
    linkTo: '/pharma/deviations',
  },
  {
    id: 'deviation_trend',
    tab: 'qms',
    title: 'Deviation Volume Trend',
    desc: 'Daily deviations opened during the period',
    icon: TrendingUp,
    accent: 'text-red-600', bg: 'bg-red-50',
    chart: 'trend',
    series: (o) => o.qms.deviation_trend.map(t => ({ label: t.date, value: t.value })),
    trend: (o) => o.qms.deviation_trend,
    columns: [{ key: 'date', label: 'Date' }, { key: 'value', label: 'Deviations', align: 'right' }],
    rows: (o) => o.qms.deviation_trend.map(t => ({ date: prettyDate(t.date), value: t.value })),
    detailId: 'deviation_list',
    linkTo: '/pharma/deviations',
  },
  {
    id: 'capa_status',
    tab: 'qms',
    title: 'CAPA Status',
    desc: 'All CAPAs by workflow status, including overdue count',
    icon: ListChecks,
    accent: 'text-amber-600', bg: 'bg-amber-50',
    chart: 'bars',
    series: (o) => o.qms.capa_status.filter(d => d.label !== 'overdue'),
    columns: [{ key: 'label', label: 'Status' }, { key: 'value', label: 'Count', align: 'right' }],
    rows: (o) => o.qms.capa_status,
    stat: (o) => {
      const overdue = o.qms.capa_status.find(d => d.label === 'overdue')?.value ?? 0
      return { label: 'Overdue CAPAs', value: fmtNum(overdue) }
    },
    detailId: 'capa_list',
    linkTo: '/pharma/capas',
  },
  {
    id: 'recall_status',
    tab: 'qms',
    title: 'Recall Register',
    desc: 'All recalls by current status',
    icon: AlertCircle,
    accent: 'text-rose-600', bg: 'bg-rose-50',
    chart: 'donut',
    series: (o) => o.qms.recall_status,
    columns: [{ key: 'label', label: 'Status' }, { key: 'value', label: 'Count', align: 'right' }],
    rows: (o) => o.qms.recall_status,
    stat: (o) => {
      const open = o.qms.recall_status
        .filter(d => ['open', 'investigating', 'notified'].includes(d.label))
        .reduce((s, d) => s + d.value, 0)
      return { label: 'Open / active recalls', value: fmtNum(open) }
    },
    detailId: 'recall_list',
    linkTo: '/pharma/recalls',
  },
  {
    id: 'complaint_type',
    tab: 'qms',
    title: 'Complaints by Type',
    desc: 'Customer / adverse event / product defect breakdown for the period',
    icon: MessageSquare,
    accent: 'text-pink-600', bg: 'bg-pink-50',
    chart: 'bars',
    series: (o) => o.qms.complaint_by_type,
    columns: [{ key: 'label', label: 'Type' }, { key: 'value', label: 'Count', align: 'right' }],
    rows: (o) => o.qms.complaint_by_type,
    stat: (o) => ({
      label: 'Complaints in period',
      value: fmtNum(o.qms.complaint_by_type.reduce((s, d) => s + d.value, 0)),
    }),
    detailId: 'complaint_list',
    linkTo: '/pharma/complaints',
  },
  {
    id: 'cc_status',
    tab: 'qms',
    title: 'Change Control Status',
    desc: 'Change controls by workflow stage',
    icon: Workflow,
    accent: 'text-slate-600', bg: 'bg-slate-50',
    chart: 'donut',
    series: (o) => o.qms.cc_status,
    columns: [{ key: 'label', label: 'Status' }, { key: 'value', label: 'Count', align: 'right' }],
    rows: (o) => o.qms.cc_status,
    stat: (o) => {
      const pending = o.qms.cc_status
        .filter(d => ['draft', 'in_review'].includes(d.label))
        .reduce((s, d) => s + d.value, 0)
      return { label: 'Pending CCs', value: fmtNum(pending) }
    },
    detailId: 'cc_list',
    linkTo: '/pharma/change-control',
  },

  // ─ GDP ──────────────────────────────────────────────────────────────────────
  {
    id: 'excursion_severity',
    tab: 'gdp',
    title: 'Excursions by Severity',
    desc: 'Temperature excursion minor / major / critical split for period',
    icon: ThermometerSnowflake,
    accent: 'text-cyan-600', bg: 'bg-cyan-50',
    chart: 'donut',
    series: (o) => o.gdp.excursion_severity,
    columns: [{ key: 'label', label: 'Severity' }, { key: 'value', label: 'Count', align: 'right' }],
    rows: (o) => o.gdp.excursion_severity,
    stat: (o) => ({
      label: 'Excursions in period',
      value: fmtNum(o.gdp.excursion_severity.reduce((s, d) => s + d.value, 0)),
    }),
    detailId: 'excursion_list',
    linkTo: '/pharma/gdp',
  },
  {
    id: 'excursion_trend',
    tab: 'gdp',
    title: 'Excursion Trend',
    desc: 'Daily temperature excursion events logged over the period',
    icon: TrendingUp,
    accent: 'text-sky-600', bg: 'bg-sky-50',
    chart: 'trend',
    series: (o) => o.gdp.excursion_trend.map(t => ({ label: t.date, value: t.value })),
    trend: (o) => o.gdp.excursion_trend,
    columns: [{ key: 'date', label: 'Date' }, { key: 'value', label: 'Excursions', align: 'right' }],
    rows: (o) => o.gdp.excursion_trend.map(t => ({ date: prettyDate(t.date), value: t.value })),
    detailId: 'excursion_list',
    linkTo: '/pharma/gdp',
  },
  {
    id: 'excursion_status',
    tab: 'gdp',
    title: 'Excursion Status',
    desc: 'All-time excursions by resolution status',
    icon: Activity,
    accent: 'text-blue-600', bg: 'bg-blue-50',
    chart: 'bars',
    series: (o) => o.gdp.excursion_status,
    columns: [{ key: 'label', label: 'Status' }, { key: 'value', label: 'Count', align: 'right' }],
    rows: (o) => o.gdp.excursion_status,
    detailId: 'excursion_list',
    linkTo: '/pharma/gdp',
  },

  // ─ SERIALIZATION ────────────────────────────────────────────────────────────
  {
    id: 'serial_status',
    tab: 'serialization',
    title: 'Serial Status',
    desc: 'All serialized units by status: active / shipped / recalled / destroyed',
    icon: QrCode,
    accent: 'text-violet-600', bg: 'bg-violet-50',
    chart: 'donut',
    series: (o) => o.serialization.serial_status,
    columns: [{ key: 'label', label: 'Status' }, { key: 'value', label: 'Units', align: 'right' }],
    rows: (o) => o.serialization.serial_status,
    stat: (o) => ({
      label: 'Total serial units',
      value: fmtNum(o.serialization.serial_status.reduce((s, d) => s + d.value, 0)),
    }),
    detailId: 'serial_list',
    linkTo: '/pharma/serialization',
  },
  {
    id: 'serial_by_level',
    tab: 'serialization',
    title: 'Serials by Hierarchy Level',
    desc: 'Unit / pack / case / pallet distribution',
    icon: Package,
    accent: 'text-blue-600', bg: 'bg-blue-50',
    chart: 'bars',
    series: (o) => o.serialization.serial_by_level,
    columns: [{ key: 'label', label: 'Level' }, { key: 'value', label: 'Count', align: 'right' }],
    rows: (o) => o.serialization.serial_by_level,
    detailId: 'serial_list',
    linkTo: '/pharma/serialization',
  },
  {
    id: 'serial_trend',
    tab: 'serialization',
    title: 'Commissioning Trend',
    desc: 'Daily serial units commissioned over the selected period',
    icon: TrendingUp,
    accent: 'text-emerald-600', bg: 'bg-emerald-50',
    chart: 'trend',
    series: (o) => o.serialization.serial_trend.map(t => ({ label: t.date, value: t.value })),
    trend: (o) => o.serialization.serial_trend,
    columns: [{ key: 'date', label: 'Date' }, { key: 'value', label: 'Commissioned', align: 'right' }],
    rows: (o) => o.serialization.serial_trend.map(t => ({ date: prettyDate(t.date), value: t.value })),
    stat: (o) => ({
      label: 'Commissioned in period',
      value: fmtNum(o.serialization.serial_trend.reduce((s, t) => s + t.value, 0)),
    }),
    detailId: 'serial_list',
    linkTo: '/pharma/serialization',
  },
]

const TABS: { key: Tab; label: string; icon: React.ElementType; color: string }[] = [
  { key: 'lots',          label: 'Lot Control',      icon: Package,              color: 'text-blue-600' },
  { key: 'manufacturing', label: 'Manufacturing',     icon: ClipboardList,        color: 'text-violet-600' },
  { key: 'qc',            label: 'Quality Control',   icon: FlaskConical,         color: 'text-teal-600' },
  { key: 'qms',           label: 'QMS',               icon: ShieldAlert,          color: 'text-orange-600' },
  { key: 'gdp',           label: 'GDP / Cold Chain',  icon: ThermometerSnowflake, color: 'text-cyan-600' },
  { key: 'serialization', label: 'Serialization',     icon: QrCode,               color: 'text-violet-600' },
]

// ── KPI config ────────────────────────────────────────────────────────────────
type KpiCfg = {
  key: keyof PharmaReportsOverview['kpis']
  label: string
  icon: React.ElementType
  accent: string
  invert?: boolean
  pct?: boolean
}

const KPIS: KpiCfg[] = [
  { key: 'lots_received',      label: 'Lots Received',       icon: Package,      accent: 'text-blue-600' },
  { key: 'qi_batches',         label: 'In QI',               icon: ShieldAlert,  accent: 'text-amber-600', invert: true },
  { key: 'inspections_opened', label: 'QC Inspections',      icon: FlaskConical, accent: 'text-teal-600' },
  { key: 'bpr_completed',      label: 'BPRs Completed',      icon: ClipboardList, accent: 'text-violet-600' },
  { key: 'avg_yield_pct',      label: 'Avg Batch Yield',     icon: TrendingUp,   accent: 'text-emerald-600', pct: true },
  { key: 'deviations_opened',  label: 'Deviations Opened',   icon: ShieldAlert,  accent: 'text-orange-600', invert: true },
  { key: 'capa_overdue',       label: 'CAPA Overdue',        icon: ListChecks,   accent: 'text-red-600', invert: true },
  { key: 'complaints_opened',  label: 'Complaints',          icon: MessageSquare,accent: 'text-pink-600', invert: true },
  { key: 'excursions',         label: 'Temp Excursions',     icon: ThermometerSnowflake, accent: 'text-cyan-600', invert: true },
  { key: 'open_recalls',       label: 'Open Recalls',        icon: AlertCircle,  accent: 'text-rose-600', invert: true },
]

// ── Delta badge ────────────────────────────────────────────────────────────────
function DeltaBadge({ kpi, invert }: { kpi: PharmaKpi; invert?: boolean }) {
  if (kpi.delta_pct === null) return null
  const positive = invert ? kpi.delta_pct < 0 : kpi.delta_pct > 0
  const neutral = kpi.delta_pct === 0
  const Icon = kpi.delta_pct > 0 ? TrendingUp : TrendingDown
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 text-[11px] font-medium px-1.5 py-0.5 rounded-full',
      neutral ? 'bg-gray-100 text-gray-500' :
      positive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700',
    )}>
      {!neutral && <Icon className="w-2.5 h-2.5" />}
      {Math.abs(kpi.delta_pct).toFixed(1)}%
    </span>
  )
}

// ── Mini chart for card ────────────────────────────────────────────────────────
function MiniChart({ report, data }: { report: PharmaReport; data: PharmaReportsOverview }) {
  const series = report.series(data)
  if (!series.length) {
    return <div className="h-[80px] flex items-center justify-center text-xs text-gray-400">No data</div>
  }
  if (report.chart === 'trend' && report.trend) {
    return <MiniTrend data={report.trend(data)} />
  }
  if (report.chart === 'donut') {
    return <DonutChart data={series} height={100} compact money={false} />
  }
  if (report.chart === 'hbars') {
    return <HBarsChart data={series.slice(0, 5)} height={100} money={false} />
  }
  return <BarsChart data={series.slice(0, 8)} height={100} compact money={false} />
}

// ── Export helpers ─────────────────────────────────────────────────────────────
function exportCsv(columns: Col[], rows: Row[], title: string) {
  const header = columns.map(c => c.label).join(',')
  const body = rows.map(r => columns.map(c => {
    const v = r[c.key]
    return typeof v === 'string' && v.includes(',') ? `"${v}"` : String(v ?? '')
  }).join(',')).join('\n')
  const blob = new Blob([`${header}\n${body}`], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${title.toLowerCase().replace(/\s+/g, '-')}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

// ── Detail Modal ──────────────────────────────────────────────────────────────
function DetailModal({
  report, data, rangeLabel, from, to, onClose,
}: {
  report: PharmaReport
  data: PharmaReportsOverview
  rangeLabel: string
  from: string
  to: string
  onClose: () => void
}) {
  const Icon = report.icon
  const rows = report.rows(data)
  const series = report.series(data)

  function handlePrint() {
    const w = window.open('', '_blank', 'width=900,height=700')
    if (!w) return
    const header = report.columns.map(c => `<th style="text-align:${c.align === 'right' ? 'right' : 'left'};padding:6px 10px;border-bottom:1px solid #e5e7eb">${c.label}</th>`).join('')
    const body = rows.map(r => `<tr>${report.columns.map(c => `<td style="text-align:${c.align === 'right' ? 'right' : 'left'};padding:5px 10px;border-bottom:1px solid #f3f4f6">${String(r[c.key] ?? '')}</td>`).join('')}</tr>`).join('')
    w.document.write(`<html><head><title>${report.title}</title><style>body{font-family:sans-serif;font-size:13px;padding:20px}table{width:100%;border-collapse:collapse}th{background:#f9fafb}</style></head><body><h2>${report.title}</h2><p style="color:#6b7280;font-size:12px">${rangeLabel}</p><table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table></body></html>`)
    w.document.close()
    w.print()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <div className={cn('w-9 h-9 rounded-lg grid place-items-center shrink-0', report.bg)}>
            <Icon className={cn('w-5 h-5', report.accent)} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-foreground">{report.title}</h2>
            <p className="text-xs text-gray-500">{rangeLabel}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => exportCsv(report.columns, rows, report.title)}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-accent">
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
            <button onClick={handlePrint}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-accent">
              <Printer className="w-3.5 h-3.5" /> Print
            </button>
            {report.linkTo && (
              <Link to={report.linkTo}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-accent">
                <ExternalLink className="w-3.5 h-3.5" /> Open
              </Link>
            )}
            <button onClick={onClose}
              className="ml-1 p-1.5 rounded-lg hover:bg-accent text-gray-500">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Chart */}
          <div className="px-5 pt-4">
            {report.chart === 'trend' && report.trend
              ? <FullTrend data={report.trend(data)} label={report.columns[1]?.label ?? 'Count'} />
              : report.chart === 'donut'
              ? <DonutChart data={series} height={240} money={false} />
              : report.chart === 'hbars'
              ? <HBarsChart data={series} height={Math.max(200, series.length * 36)} money={false} />
              : <BarsChart data={series} height={240} money={false} />
            }
          </div>

          {/* Table */}
          <div className="px-5 pb-5 mt-4">
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40">
                    {report.columns.map(c => (
                      <th key={c.key}
                        className={cn('px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide',
                          c.align === 'right' ? 'text-right' : 'text-left')}>
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={report.columns.length} className="px-3 py-8 text-center text-gray-400 text-sm">
                        No data for this period
                      </td>
                    </tr>
                  ) : rows.map((r, i) => (
                    <tr key={i} className="border-t border-border hover:bg-muted/30">
                      {report.columns.map(c => (
                        <td key={c.key}
                          className={cn('px-3 py-2 text-sm tabular-nums',
                            c.align === 'right' ? 'text-right' : 'text-left')}>
                          {c.pct ? fmtPct(Number(r[c.key] ?? 0)) : String(r[c.key] ?? '—')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-400 mt-2 text-right">{rows.length} row{rows.length !== 1 ? 's' : ''} shown (preview)</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function PharmaReportingManagerPage() {
  const [rangeKey, setRangeKey] = useState<RangeKey>('30d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('lots')
  const [openReport, setOpenReport] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const { from, to } = useMemo(
    () => rangeToDates(rangeKey, customFrom, customTo),
    [rangeKey, customFrom, customTo],
  )

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['pharma-reports-overview', from, to],
    queryFn: () => pharmaReportsApi.overview({ date_from: from, date_to: to }),
    staleTime: 30_000,
  })

  const rangeLabel = `${prettyDate(from)} – ${prettyDate(to)}`

  const tabReports = useMemo(() => {
    const filtered = REPORTS.filter(r => r.tab === activeTab)
    if (!search.trim()) return filtered
    const q = search.toLowerCase()
    return filtered.filter(r => r.title.toLowerCase().includes(q) || r.desc.toLowerCase().includes(q))
  }, [activeTab, search])

  const openReportDef = openReport ? REPORTS.find(r => r.id === openReport) : null

  return (
    <div className="space-y-5 max-w-[1500px]">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" /> Pharma Reporting Manager
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Comprehensive GxP analytics across lot control, manufacturing, quality, QMS, GDP and serialization.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/pharma" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
            <ChevronRight className="w-4 h-4" /> Pharma Overview
          </Link>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-accent"
          >
            <RefreshCw className={cn('w-4 h-4', isFetching && 'animate-spin')} /> Refresh
          </button>
        </div>
      </div>

      {/* Sticky filter bar */}
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
              <input type="date" value={customFrom} max={customTo || undefined}
                onChange={e => setCustomFrom(e.target.value)}
                className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs" />
              <span className="text-gray-400 text-xs">to</span>
              <input type="date" value={customTo} min={customFrom || undefined}
                onChange={e => setCustomTo(e.target.value)}
                className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs" />
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 text-xs text-gray-500 px-1">
          <span>
            Showing <strong className="text-foreground">{rangeLabel}</strong>
          </span>
          {data && (
            <span>vs prev. period {prettyDate(data.range.prev_from)} – {prettyDate(data.range.prev_to)}</span>
          )}
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
          Unable to load pharma data. Try refreshing.
        </div>
      ) : (
        <>
          {/* KPI strip */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
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
                    {k.pct ? fmtPct(kpi.value) : fmtNum(kpi.value)}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{k.label}</p>
                </div>
              )
            })}
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap items-center gap-1 border-b border-border pb-0">
            {TABS.map(t => {
              const TIcon = t.icon
              const count = REPORTS.filter(r => r.tab === t.key).length
              return (
                <button
                  key={t.key}
                  onClick={() => { setActiveTab(t.key); setSearch('') }}
                  className={cn(
                    'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
                    activeTab === t.key
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 hover:text-foreground hover:border-border',
                  )}
                >
                  <TIcon className={cn('w-4 h-4', activeTab === t.key ? t.color : '')} />
                  {t.label}
                  <span className={cn(
                    'text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                    activeTab === t.key ? 'bg-primary/10 text-primary' : 'bg-muted text-gray-400',
                  )}>
                    {count}
                  </span>
                </button>
              )
            })}
            <div className="ml-auto mb-1">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search reports…"
                  className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border bg-background w-44 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          {/* Report card grid */}
          {tabReports.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-10 text-center text-gray-400 text-sm">
              No reports match "{search}"
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {tabReports.map(report => {
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
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <button
                          onClick={() => setOpenReport(report.id)}
                          className="rounded p-1 text-gray-300 hover:text-primary"
                          title="Expand detail"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                        </button>
                        {report.linkTo && (
                          <Link
                            to={report.linkTo}
                            className="rounded p-1 text-gray-300 hover:text-primary"
                            title="Go to operational page"
                            onClick={e => e.stopPropagation()}
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => setOpenReport(report.id)}
                      className="w-full text-left"
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
          )}
        </>
      )}

      {openReportDef && data && (
        <DetailModal
          report={openReportDef}
          data={data}
          rangeLabel={rangeLabel}
          from={from}
          to={to}
          onClose={() => setOpenReport(null)}
        />
      )}
    </div>
  )
}
