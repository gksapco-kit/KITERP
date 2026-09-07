import { useEffect, useMemo, useState } from 'react'
import {
  BarChart3, TrendingUp, Activity, Clock, CheckSquare,
  Star, GitMerge, AlertTriangle, FileX, Receipt, RotateCcw,
  FileText, Calendar, RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { OverflowTabBar } from '@/components/common/OverflowTabBar'
import { cn } from '@/lib/utils'
import { useProcurementReportFilters } from './useProcurementReportFilters'
import { exportPDF, today } from '@/pages/inventory/analytics/exportUtils'
import { OverviewTab }          from './tabs/OverviewTab'
import { SpendTab }             from './tabs/SpendTab'
import { SpendTrendTab }        from './tabs/SpendTrendTab'
import { CycleTimeTab }         from './tabs/CycleTimeTab'
import { ApprovalTurnaroundTab } from './tabs/ApprovalTurnaroundTab'
import { SupplierScorecardTab } from './tabs/SupplierScorecardTab'
import { SourcingFunnelTab }    from './tabs/SourcingFunnelTab'
import { PriceVarianceTab }     from './tabs/PriceVarianceTab'
import { MatchExceptionsTab }   from './tabs/MatchExceptionsTab'
import { GSTInputCreditTab }    from './tabs/GSTInputCreditTab'
import { ReturnsTab }           from './tabs/ReturnsTab'

// ── Tab config ────────────────────────────────────────────────────────────────

type TabKey =
  | 'overview' | 'spend' | 'trend' | 'cycle'
  | 'approvals' | 'scorecard' | 'funnel'
  | 'ppv' | 'match' | 'gst' | 'returns'

const TABS: { key: TabKey; label: string; icon: React.ElementType; group: string }[] = [
  { key: 'overview',  label: 'Overview',            icon: BarChart3,      group: '' },
  { key: 'spend',     label: 'Spend Analysis',      icon: TrendingUp,     group: 'Spend' },
  { key: 'trend',     label: 'Spend Trend',         icon: Activity,       group: 'Spend' },
  { key: 'cycle',     label: 'Cycle Time',          icon: Clock,          group: 'Operations' },
  { key: 'approvals', label: 'Approval Turnaround', icon: CheckSquare,    group: 'Operations' },
  { key: 'scorecard', label: 'Supplier Scorecard',  icon: Star,           group: 'Suppliers' },
  { key: 'funnel',    label: 'Sourcing Funnel',     icon: GitMerge,       group: 'Suppliers' },
  { key: 'ppv',       label: 'Price Variance',      icon: AlertTriangle,  group: 'Finance' },
  { key: 'match',     label: 'Match Exceptions',    icon: FileX,          group: 'Finance' },
  { key: 'gst',       label: 'GST Input Credit',    icon: Receipt,        group: 'Finance' },
  { key: 'returns',   label: 'Purchase Returns',    icon: RotateCcw,      group: 'Finance' },
]

// ── Date-range presets (Sales Report style) ───────────────────────────────────

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
  const now = new Date()
  const to = iso(now)
  const start = new Date(now)
  switch (key) {
    case 'today':
      return { from: to, to }
    case '7d':
      start.setDate(now.getDate() - 6); return { from: iso(start), to }
    case '30d':
      start.setDate(now.getDate() - 29); return { from: iso(start), to }
    case '90d':
      start.setDate(now.getDate() - 89); return { from: iso(start), to }
    case 'mtd':
      return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to }
    case 'qtd': {
      const q = Math.floor(now.getMonth() / 3) * 3
      return { from: iso(new Date(now.getFullYear(), q, 1)), to }
    }
    case 'fy': {
      const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
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

function detectRangeKey(from?: string, to?: string): RangeKey {
  if (!from || !to) return '30d'
  for (const key of ['today', '7d', '30d', '90d', 'mtd', 'qtd', 'fy'] as RangeKey[]) {
    const r = rangeToDates(key, '', '')
    if (r.from === from && r.to === to) return key
  }
  return 'custom'
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ProcurementReportsPage() {
  const [tab, setTab] = useState<TabKey>('overview')
  const [filters, setFilters] = useProcurementReportFilters()
  const [rangeKey, setRangeKey] = useState<RangeKey>(() => detectRangeKey(filters.date_from, filters.date_to))
  const [customFrom, setCustomFrom] = useState(filters.date_from || '')
  const [customTo, setCustomTo] = useState(filters.date_to || '')
  const [exporting, setExporting] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (!filters.date_from || !filters.date_to) {
      const { from, to } = rangeToDates('30d', '', '')
      setFilters({ date_from: from, date_to: to })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleRange(key: RangeKey) {
    setRangeKey(key)
    if (key !== 'custom') {
      const { from, to } = rangeToDates(key, '', '')
      setFilters({ date_from: from, date_to: to })
    }
  }

  function applyCustom() {
    const { from, to } = rangeToDates('custom', customFrom, customTo)
    setFilters({ date_from: from, date_to: to })
  }

  async function handlePDFExport() {
    setExporting(true)
    try {
      await exportPDF('proc-analytics-content', `procurement-report-${tab}-${today()}.pdf`)
    } finally {
      setExporting(false)
    }
  }

  const from = filters.date_from || rangeToDates('30d', '', '').from
  const to = filters.date_to || rangeToDates('30d', '', '').to
  const rangeLabel = `${prettyDate(from)} – ${prettyDate(to)}`

  const prevRange = useMemo(() => {
    const df = new Date(from)
    const dt = new Date(to)
    const days = Math.max(Math.round((dt.getTime() - df.getTime()) / 86400000) + 1, 1)
    const prevTo = new Date(df)
    prevTo.setDate(prevTo.getDate() - 1)
    const prevFrom = new Date(prevTo)
    prevFrom.setDate(prevFrom.getDate() - (days - 1))
    return { from: iso(prevFrom), to: iso(prevTo) }
  }, [from, to])

  return (
    <div className="p-6 max-w-[1500px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            Procurement Report Analytics
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Summary & detailed procurement reporting across spend, suppliers, operations and finance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setRefreshKey(k => k + 1)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-accent"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <Button variant="outline" size="sm" onClick={handlePDFExport} disabled={exporting}>
            <FileText className="h-4 w-4 mr-1.5" />
            {exporting ? 'Exporting…' : 'PDF'}
          </Button>
        </div>
      </div>

      {/* Period pill bar */}
      <div className="sticky top-0 z-20 rounded-xl border border-border bg-card/95 backdrop-blur p-3 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
            <Calendar className="w-4 h-4" /> Period
          </div>
          <div className="flex flex-wrap items-center gap-1 bg-muted p-1 rounded-xl">
            {RANGES.map(r => (
              <button
                key={r.key}
                onClick={() => handleRange(r.key)}
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
                type="date"
                value={customFrom}
                max={customTo || today()}
                onChange={e => setCustomFrom(e.target.value)}
                onBlur={applyCustom}
                className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs"
              />
              <span className="text-gray-400 text-xs">to</span>
              <input
                type="date"
                value={customTo}
                min={customFrom || undefined}
                max={today()}
                onChange={e => setCustomTo(e.target.value)}
                onBlur={applyCustom}
                className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs"
              />
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 text-xs text-gray-500 px-1">
          <span>Showing <strong className="text-foreground">{rangeLabel}</strong></span>
          <span>vs previous period {prettyDate(prevRange.from)} – {prettyDate(prevRange.to)}</span>
        </div>
      </div>

      <OverflowTabBar tabs={TABS} value={tab} onChange={setTab} />

      {/* Tab content */}
      <div id="proc-analytics-content">
        {tab === 'overview'  && <OverviewTab filters={filters} refreshKey={refreshKey} onGoTab={setTab} />}
        {tab === 'spend'     && <SpendTab filters={filters} setFilters={setFilters} refreshKey={refreshKey} />}
        {tab === 'trend'     && <SpendTrendTab filters={filters} setFilters={setFilters} refreshKey={refreshKey} />}
        {tab === 'cycle'     && <CycleTimeTab filters={filters} refreshKey={refreshKey} />}
        {tab === 'approvals' && <ApprovalTurnaroundTab filters={filters} refreshKey={refreshKey} />}
        {tab === 'scorecard' && <SupplierScorecardTab filters={filters} refreshKey={refreshKey} />}
        {tab === 'funnel'    && <SourcingFunnelTab filters={filters} refreshKey={refreshKey} />}
        {tab === 'ppv'       && <PriceVarianceTab filters={filters} refreshKey={refreshKey} />}
        {tab === 'match'     && <MatchExceptionsTab filters={filters} refreshKey={refreshKey} />}
        {tab === 'gst'       && <GSTInputCreditTab filters={filters} refreshKey={refreshKey} />}
        {tab === 'returns'   && <ReturnsTab filters={filters} setFilters={setFilters} refreshKey={refreshKey} />}
      </div>
    </div>
  )
}
