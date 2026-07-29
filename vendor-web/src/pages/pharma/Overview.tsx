import { useEffect, useState, type ElementType } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  Beaker,
  CheckCircle2,
  Clock,
  ClipboardCheck,
  FileCheck2,
  FlaskConical,
  GitBranch,
  Globe2,
  History,
  Package,
  QrCode,
  Radio,
  RotateCcw,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Boxes,
} from 'lucide-react'
import { pharmaApi } from '@/api/pharma'
import { Button } from '@/components/ui/button'
import {
  PharmaPageHeader,
  PharmaProgress,
  PharmaStatusBadge,
} from './pharmaShared'

type Overview = {
  phases: { id: number; key: string; label: string; status: string; note?: string }[]
  stats: Record<string, number>
  alerts?: {
    expired: any[]
    expiring_soon: any[]
    retest_due: any[]
  }
}

const PHASE_LINKS: Record<number, string> = {
  0: '/pharma/settings',
  1: '/pharma/batches',
  2: '/pharma/fefo',
  3: '/pharma/mbr',
  4: '/pharma/inspections',
  5: '/pharma/genealogy',
  6: '/pharma/deviations',
  7: '/pharma/audit',
  8: '/pharma/serialization',
  9: '/pharma/gdp',
  10: '/pharma/track-trace',
}

const PHASE_ICONS: Record<number, ElementType> = {
  0: Settings2,
  1: Boxes,
  2: ShieldCheck,
  3: FileCheck2,
  4: FlaskConical,
  5: GitBranch,
  6: AlertTriangle,
  7: History,
  8: QrCode,
  9: Globe2,
  10: Radio,
}

const QUICK = [
  { to: '/pharma/batches', label: 'Batches', icon: Package },
  { to: '/pharma/inspections', label: 'Inspections', icon: FlaskConical },
  { to: '/pharma/release', label: 'Release', icon: ClipboardCheck },
  { to: '/pharma/bpr', label: 'BPR', icon: Beaker },
  { to: '/pharma/quarantine', label: 'Quarantine', icon: ShieldAlert },
  { to: '/pharma/deviations', label: 'Deviations', icon: AlertTriangle },
]

type Tone = 'primary' | 'info' | 'success' | 'warning' | 'destructive'

const TONE_CHIP: Record<Tone, string> = {
  primary: 'bg-primary/10 text-primary',
  info: 'bg-info/10 text-info',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/15 text-warning',
  destructive: 'bg-destructive/10 text-destructive',
}

const TONE_BAR: Record<Tone, string> = {
  primary: 'bg-primary',
  info: 'bg-info',
  success: 'bg-success',
  warning: 'bg-warning',
  destructive: 'bg-destructive',
}

const TONE_STROKE: Record<Tone, string> = {
  primary: 'hsl(var(--primary))',
  info: 'hsl(var(--info))',
  success: 'hsl(var(--success))',
  warning: 'hsl(var(--warning))',
  destructive: 'hsl(var(--destructive))',
}

const STATUS_TONE: Record<string, { chip: string; bar: string }> = {
  enforced: { chip: 'bg-success/10 text-success', bar: 'bg-success' },
  partial: { chip: 'bg-warning/15 text-warning', bar: 'bg-warning' },
  scaffold: { chip: 'bg-muted text-muted-foreground', bar: 'bg-muted-foreground/40' },
}

/** Compact sparkline bars scaled by value vs max */
function MiniBars({ value, max, tone }: { value: number; max: number; tone: Tone }) {
  const n = 7
  const scale = max > 0 ? Math.min(1, Math.max(value, 0.35) / max) : 0.2
  const heights = Array.from({ length: n }, (_, i) => {
    const t = (i + 1) / n
    if (value <= 0) {
      return 0.18 + (i % 3 === 1 ? 0.08 : 0)
    }
    const wobble = Math.sin((i + 1) * (value * 0.85 + 1.3)) * 0.18
    return Math.max(0.18, Math.min(1, t * scale * 0.85 + scale * 0.25 + wobble * scale))
  })
  return (
    <div className="flex h-8 items-end gap-0.5" aria-hidden>
      {heights.map((h, i) => (
        <div
          key={i}
          className={`w-1 rounded-sm ${TONE_BAR[tone]} ${value > 0 ? (i === n - 1 ? 'opacity-100' : 'opacity-55') : 'opacity-30'}`}
          style={{ height: `${Math.round(h * 100)}%` }}
        />
      ))}
    </div>
  )
}

/** Compact SVG sparkline curve */
function MiniSpark({ value, max, tone }: { value: number; max: number; tone: Tone }) {
  const W = 56
  const H = 28
  const n = 8
  const scale = max > 0 ? Math.min(1, Math.max(value, 0.4) / max) : 0.25
  const pts = Array.from({ length: n }, (_, i) => {
    const x = (i / (n - 1)) * W
    if (value <= 0) {
      const y = H - 6 - Math.sin(i * 0.9) * 2
      return `${x.toFixed(1)},${y.toFixed(1)}`
    }
    const t = i / (n - 1)
    const wobble = Math.sin(i * 1.1 + value) * 0.12
    const yNorm = Math.max(0.12, Math.min(1, t * scale + wobble * scale + scale * 0.15))
    const y = H - 2 - yNorm * (H - 6)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const d = `M${pts.join(' L')}`
  const area = `M0,${H} L${pts.join(' L')} L${W},${H} Z`
  const stroke = TONE_STROKE[tone]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-7 w-14 shrink-0" fill="none" aria-hidden>
      <path d={area} fill={stroke} opacity={value > 0 ? 0.12 : 0.06} />
      <path
        d={d}
        stroke={stroke}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={value > 0 ? 1 : 0.45}
      />
    </svg>
  )
}

export default function PharmaOverviewPage() {
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    pharmaApi
      .overview()
      .then((d) => { setData(d); setError('') })
      .catch((e) => setError(e?.response?.data?.detail || e.message || 'Failed to load'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const openRetest = async (batchId: string) => {
    setBusyId(batchId)
    try {
      await pharmaApi.openRetest(batchId)
      toast.success('Retest inspection opened')
      load()
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Retest failed')
    } finally {
      setBusyId(null)
    }
  }

  const stats = data?.stats || {}
  const alerts = data?.alerts || { expired: [], expiring_soon: [], retest_due: [] }
  const hasAlerts = alerts.expired.length || alerts.expiring_soon.length || alerts.retest_due.length
  const phases = data?.phases || []
  const enforcedCount = phases.filter((p) => p.status === 'enforced').length

  const STAT_CARDS: { label: string; value: number | undefined; href: string; icon: ElementType; tone: Tone; chart: 'spark' | 'bars' }[] = [
    { label: 'Batch-managed products', value: stats.batch_managed_products, href: '/pharma/settings', icon: Package, tone: 'primary', chart: 'spark' },
    { label: 'In QI / quarantine', value: stats.batches_qi, href: '/pharma/quarantine', icon: ShieldAlert, tone: 'warning', chart: 'bars' },
    { label: 'Blocked lots', value: stats.batches_blocked, href: '/pharma/batches', icon: Ban, tone: 'destructive', chart: 'bars' },
    { label: 'Open inspections', value: stats.open_inspections, href: '/pharma/inspections', icon: FlaskConical, tone: 'info', chart: 'spark' },
    { label: 'Expired lots', value: stats.expired_lots, href: '/pharma/batches', icon: AlertTriangle, tone: 'destructive', chart: 'bars' },
    { label: 'Expiring ≤30d', value: stats.expiring_soon, href: '/pharma/batches', icon: Clock, tone: 'warning', chart: 'spark' },
    { label: 'Retest due', value: stats.retest_due, href: '/pharma/inspections', icon: RotateCcw, tone: 'warning', chart: 'bars' },
    { label: 'CAPA eff. overdue', value: stats.capa_effectiveness_overdue, href: '/pharma/capas', icon: ClipboardCheck, tone: 'destructive', chart: 'spark' },
    { label: 'Active serials', value: stats.active_serials, href: '/pharma/serialization', icon: QrCode, tone: 'primary', chart: 'spark' },
    { label: 'Open excursions', value: stats.open_excursions, href: '/pharma/gdp', icon: Globe2, tone: 'destructive', chart: 'bars' },
    { label: 'EPCIS events', value: stats.epcis_events, href: '/pharma/track-trace', icon: Radio, tone: 'info', chart: 'spark' },
    { label: 'Unrestricted lots', value: stats.batches_unrestricted, href: '/pharma/batches', icon: CheckCircle2, tone: 'success', chart: 'bars' },
  ]

  const maxStat = Math.max(1, ...STAT_CARDS.map((s) => s.value ?? 0))

  return (
    <div className="space-y-4 p-6">
      <PharmaPageHeader
        title="Pharma overview"
        subtitle="Batch control, QC release, eBMR, QMS, and lot traceability."
      />

      {error ? (
        <div className="rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {/* Stat cards */}
      {loading && !data ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {STAT_CARDS.map((s) => {
            const Icon = s.icon
            const val = s.value ?? 0
            return (
              <Link
                key={s.label}
                to={s.href}
                title={s.label}
                className="group flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-2 transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-sm"
              >
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${TONE_CHIP[s.tone]}`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-medium leading-tight text-muted-foreground">
                    {s.label}
                  </p>
                  <p className="text-lg font-bold leading-tight tabular-nums text-card-foreground">
                    {s.value ?? '—'}
                  </p>
                </div>
                <div className="shrink-0 opacity-90">
                  {s.chart === 'spark' ? (
                    <MiniSpark value={val} max={maxStat} tone={s.tone} />
                  ) : (
                    <MiniBars value={val} max={maxStat} tone={s.tone} />
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* Alerts */}
      {hasAlerts ? (
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-destructive">
                <AlertTriangle className="h-4 w-4" />
                Expired
              </h2>
              <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
                {alerts.expired.length}
              </span>
            </div>
            {alerts.expired.length === 0 ? (
              <p className="text-xs text-muted-foreground">None</p>
            ) : (
              <ul className="space-y-1.5 text-xs">
                {alerts.expired.map((a) => (
                  <li key={a.batch_id} className="flex items-center justify-between gap-2 rounded-lg bg-card px-2.5 py-1.5 shadow-sm">
                    <Link className="font-mono font-medium hover:underline" to={`/pharma/batches/${a.batch_id}`}>
                      {a.batch_number}
                    </Link>
                    <span className="text-muted-foreground">{a.expiry_date}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-warning/25 bg-warning/5 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-warning">
                <Clock className="h-4 w-4" />
                Expiring soon
              </h2>
              <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-semibold text-warning">
                {alerts.expiring_soon.length}
              </span>
            </div>
            {alerts.expiring_soon.length === 0 ? (
              <p className="text-xs text-muted-foreground">None</p>
            ) : (
              <ul className="space-y-1.5 text-xs">
                {alerts.expiring_soon.map((a) => (
                  <li key={a.batch_id} className="flex items-center justify-between gap-2 rounded-lg bg-card px-2.5 py-1.5 shadow-sm">
                    <Link className="font-mono font-medium hover:underline" to={`/pharma/batches/${a.batch_id}`}>
                      {a.batch_number}
                    </Link>
                    <span className="font-medium text-warning">{a.days_remaining}d</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-info/25 bg-info/5 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-info">
                <RotateCcw className="h-4 w-4" />
                Retest due
              </h2>
              <span className="rounded-full bg-info/10 px-2 py-0.5 text-xs font-semibold text-info">
                {alerts.retest_due.length}
              </span>
            </div>
            {alerts.retest_due.length === 0 ? (
              <p className="text-xs text-muted-foreground">None</p>
            ) : (
              <ul className="space-y-2 text-xs">
                {alerts.retest_due.map((a) => (
                  <li key={a.batch_id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-card px-2.5 py-2 shadow-sm">
                    <div>
                      <Link className="font-mono font-medium hover:underline" to={`/pharma/batches/${a.batch_id}`}>
                        {a.batch_number}
                      </Link>
                      <div className="text-muted-foreground">{a.retest_due_date}</div>
                    </div>
                    <Button
                      size="sm"
                      disabled={busyId === a.batch_id}
                      onClick={() => openRetest(a.batch_id)}
                    >
                      {busyId === a.batch_id ? '…' : 'Open retest'}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      {/* Capability map */}
      <div className="rounded-xl border border-border bg-card p-2.5 shadow-sm sm:p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 text-xs font-semibold text-foreground sm:text-sm">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Capability map
          </h2>
          {phases.length > 0 ? (
            <PharmaProgress done={enforcedCount} total={phases.length} label="Rollout maturity" />
          ) : null}
        </div>

        <div className="mb-2 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
          {QUICK.map((q, i) => {
            const Icon = q.icon
            return (
              <Link
                key={q.to}
                to={q.to}
                className="group relative flex items-center gap-1.5 overflow-hidden rounded-md border border-border bg-card px-1.5 py-1.5 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-sm"
              >
                <span className="absolute inset-x-0 top-0 h-0.5 bg-primary" />
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
                  <Icon className="h-3 w-3" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Q{i + 1}
                    </span>
                    <span className="inline-flex items-center rounded px-1 py-0 text-[9px] font-medium leading-none text-primary ring-1 ring-inset ring-primary/20 bg-primary/10">
                      Open
                    </span>
                  </div>
                  <div className="truncate text-[11px] font-semibold leading-tight text-foreground">
                    {q.label}
                  </div>
                </div>
                <ArrowRight className="h-2.5 w-2.5 shrink-0 text-primary opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
              </Link>
            )
          })}
        </div>

        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-6">
          {phases.map((p) => {
            const Icon = PHASE_ICONS[p.id] || Package
            const tone = STATUS_TONE[(p.status || '').toLowerCase()] || STATUS_TONE.scaffold
            return (
              <Link
                key={p.id}
                to={PHASE_LINKS[p.id] || '/pharma'}
                title={p.note || p.label}
                className="group relative flex items-center gap-1.5 overflow-hidden rounded-md border border-border bg-card px-1.5 py-1.5 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-sm"
              >
                <span className={`absolute inset-x-0 top-0 h-0.5 ${tone.bar}`} />
                <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded ${tone.chip}`}>
                  <Icon className="h-3 w-3" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                      P{p.id}
                    </span>
                    <PharmaStatusBadge status={p.status} className="px-1 py-0 text-[9px] leading-none" />
                  </div>
                  <div className="truncate text-[11px] font-semibold leading-tight text-foreground">
                    {p.label}
                  </div>
                </div>
                <ArrowRight className="h-2.5 w-2.5 shrink-0 text-primary opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
              </Link>
            )
          })}
          {phases.length > 0 ? (
            <div className="relative flex items-center gap-1.5 overflow-hidden rounded-md border border-dashed border-primary/30 bg-primary/5 px-1.5 py-1.5">
              <span className="absolute inset-x-0 top-0 h-0.5 bg-primary" />
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary/15 text-primary">
                <Sparkles className="h-3 w-3" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Remaining
                </div>
                <div className="truncate text-[11px] font-semibold leading-tight text-foreground">
                  {phases.length - enforcedCount === 0
                    ? 'All enforced'
                    : `${phases.length - enforcedCount} of ${phases.length} left`}
                </div>
              </div>
              <div className="shrink-0 text-[10px] font-bold tabular-nums text-primary">
                {Math.round((enforcedCount / Math.max(1, phases.length)) * 100)}%
              </div>
            </div>
          ) : null}
          {phases.length === 0 && !loading ? (
            <div className="col-span-full rounded-lg border border-border py-3 text-center text-xs text-muted-foreground">
              No capability data yet.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
