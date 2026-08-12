import type { ElementType, ReactNode } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { statusBadgeClass } from './rentalConstants'

export function StatusBadge({ status }: { status?: string }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap px-2 py-0.5 rounded-full text-[11px] font-medium border capitalize ${statusBadgeClass(status)}`}>
      {(status || '—').replace(/_/g, ' ')}
    </span>
  )
}

export function CapacityBar({
  used,
  max,
  unit,
  available,
}: {
  used: number
  max: number
  unit?: string
  /** Pre-computed available count from the backend (accounts for damaged/lost). Falls back to max - used. */
  available?: number
}) {
  const avail = available !== undefined ? available : Math.max(0, max - used)
  const pct = max > 0 ? Math.min(100, Math.round(((max - avail) / max) * 100)) : 0
  const unitLabel = unit && unit.trim() && unit.toLowerCase() !== 'units' ? unit : ''
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>
          <span className="font-medium text-foreground">{avail}</span>
          {' / '}
          {max} {unitLabel} available
        </span>
        <span>{pct}% used</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-rose-500' : pct > 60 ? 'bg-amber-500' : 'bg-emerald-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

/** Skeleton rows for a table while a query loads (keeps column widths steady). */
export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-3">
          {Array.from({ length: cols }).map((__, c) => (
            <Skeleton key={c} className="h-4 flex-1" style={{ maxWidth: c === 0 ? '9rem' : '6rem' }} />
          ))}
        </div>
      ))}
    </div>
  )
}

/** Skeleton cards while an asset grid loads. */
export function CardGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex gap-3 p-3 pb-2.5">
            <Skeleton className="h-14 w-14 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex justify-between gap-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <div className="space-y-2 px-3 pb-2.5">
            <Skeleton className="h-1.5 w-full rounded-full" />
            <Skeleton className="h-5 w-24 rounded-md" />
            <Skeleton className="h-5 w-32 rounded-md" />
          </div>
          <div className="border-t border-border/70 bg-muted/20 px-3 py-2">
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function RentalEmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: ElementType
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="h-5 w-5" />
      </span>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description ? <p className="max-w-sm text-xs text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}
