import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { reApi } from '@/api/realestate'
import type { FieldMeta, REMeta } from '@/api/realestate'

export function useREMeta() {
  return useQuery<REMeta>({ queryKey: ['re-meta'], queryFn: reApi.meta, staleTime: 5 * 60_000 })
}

export function humanize(v: unknown): string {
  return String(v ?? '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })
const inrWhole = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })

export function fmtMoney(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  const n = Number(v)
  return Number.isFinite(n) ? `₹${inr.format(n)}` : String(v)
}

/** Compact Indian formatting (Cr / L) for dashboard tiles. */
export function fmtCompact(v: unknown): string {
  const n = Number(v ?? 0)
  if (!Number.isFinite(n)) return '—'
  const a = Math.abs(n)
  if (a >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`
  if (a >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`
  return `₹${inrWhole.format(n)}`
}

export function fmtDate(v: unknown, withTime = false): string {
  if (!v) return '—'
  const d = new Date(String(v))
  if (Number.isNaN(d.getTime())) return String(v)
  return withTime
    ? d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : d.toLocaleDateString('en-IN', { dateStyle: 'medium' })
}

const GOOD = new Set([
  'active', 'available', 'approved', 'verified', 'paid', 'completed', 'confirmed', 'registered', 'signed',
  'converted', 'booked', 'sold', 'handed_over', 'issued', 'acknowledged', 'accepted', 'ok', 'won', 'cleared',
  'closed', 'resolved', 'done',
])
const WARN = new Set([
  'hold', 'pending', 'pending_approval', 'draft', 'submitted', 'sent', 'scheduled', 'in_progress', 'partial',
  'open', 'requested', 'planned', 'proposed', 'under_review', 'missing_config', 'qualified', 'negotiation',
  'site_visit', 'contacted', 'new', 'warning', 'demanded', 'due', 'received', 'scheduled',
])
const BAD = new Set([
  'rejected', 'cancelled', 'canceled', 'lost', 'expired', 'overdue', 'failed', 'blocked', 'high', 'forfeited',
  'defaulted', 'terminated', 'withdrawn', 'critical', 'bounced',
])

export function statusVariant(s: unknown): 'success' | 'warning' | 'destructive' | 'secondary' {
  const v = String(s ?? '').toLowerCase()
  if (GOOD.has(v)) return 'success'
  if (BAD.has(v)) return 'destructive'
  if (WARN.has(v)) return 'warning'
  return 'secondary'
}

export function StatusBadge({ value }: { value: unknown }) {
  if (!value) return <span className="text-muted-foreground">—</span>
  return <Badge variant={statusVariant(value)}>{humanize(value)}</Badge>
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-bold text-foreground">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

export const fieldClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50'

/** Render a cell for the generic table. */
export function renderCell(field: FieldMeta | undefined, row: Record<string, any>, name: string): ReactNode {
  const v = row[name]
  if (!field) return v === null || v === undefined || v === '' ? '—' : String(v)
  if (field.type === 'ref') return row._refs?.[name] ?? (v ? '…' : '—')
  if (v === null || v === undefined || v === '') return '—'
  switch (field.type) {
    case 'money':
      return fmtMoney(v)
    case 'percent':
      return `${Number(v)}%`
    case 'number':
    case 'decimal':
      return Number(v).toLocaleString('en-IN', { maximumFractionDigits: 3 })
    case 'date':
      return fmtDate(v)
    case 'datetime':
      return fmtDate(v, true)
    case 'boolean':
      return v ? 'Yes' : 'No'
    case 'json':
      if (field.shape === 'list' && Array.isArray(v)) {
        if (!v.length) return <span className="text-muted-foreground">—</span>
        return (
          <span className="inline-flex flex-wrap gap-1">
            {(v as unknown[]).slice(0, 4).map((it, i) => (
              <span key={i} className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">{String(it)}</span>
            ))}
            {v.length > 4 && <span className="text-[11px] text-muted-foreground">+{v.length - 4}</span>}
          </span>
        )
      }
      if (field.shape === 'map' && v && typeof v === 'object' && !Array.isArray(v)) {
        const entries = Object.entries(v as Record<string, unknown>).slice(0, 3)
        if (!entries.length) return <span className="text-muted-foreground">—</span>
        return (
          <span className="text-[11px] text-muted-foreground">
            {entries.map(([k, val]) => `${k}: ${val}`).join(', ')}
          </span>
        )
      }
      return <span className="font-mono text-[11px] text-muted-foreground">{JSON.stringify(v).slice(0, 40)}</span>
    case 'select':
      return field.name.includes('status') || field.name === 'stage' ? <StatusBadge value={v} /> : humanize(v)
    default:
      return String(v)
  }
}
