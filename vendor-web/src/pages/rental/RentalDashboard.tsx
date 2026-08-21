import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Boxes, CheckCircle2, Clock, IndianRupee, Package, Wrench } from 'lucide-react'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { cn, formatCurrency } from '@/lib/utils'
import { rentalApi } from './api'
import { assetCardAvailability, formatCardDate } from './rentalDates'
import { RentalEmptyState, StatusBadge } from './RentalPrimitives'
import { Skeleton } from '@/components/ui/skeleton'
import type { RentalAsset, RentalBooking } from './rentalConstants'

type Props = {
  allBookings: RentalBooking[]
  onGoToAssets: () => void
  onGoToBookings: (status?: string) => void
  onSelectBooking: (b: RentalBooking) => void
}

type KpiTone = 'slate' | 'emerald' | 'amber' | 'orange' | 'sky' | 'teal'

const KPI_TONES: Record<KpiTone, string> = {
  slate: 'text-slate-600 dark:text-slate-300',
  emerald: 'text-emerald-700 dark:text-emerald-400',
  amber: 'text-amber-700 dark:text-amber-400',
  orange: 'text-orange-700 dark:text-orange-400',
  sky: 'text-sky-700 dark:text-sky-400',
  teal: 'text-teal-700 dark:text-teal-400',
}

function CapacityMeter({ available, max, unit }: { available: number; max: number; unit?: string }) {
  const used = Math.max(0, max - available)
  const pct = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0
  const unitLabel = unit?.trim() || ''
  return (
    <div className="w-full min-w-0 max-w-[9rem] space-y-1">
      <p className="truncate text-xs tabular-nums text-foreground">
        <span className="font-medium">{available}</span>
        <span className="text-muted-foreground">/{max}</span>
        {unitLabel ? <span className="ml-1 text-muted-foreground">{unitLabel}</span> : null}
      </p>
      <div className="h-1.5 overflow-hidden rounded-sm bg-muted/80">
        <div
          className={cn(
            'h-full rounded-sm transition-all',
            pct >= 100 ? 'bg-rose-500' : pct > 60 ? 'bg-amber-500' : pct > 0 ? 'bg-emerald-500' : 'bg-transparent',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export default function RentalDashboard({ allBookings, onGoToAssets, onGoToBookings, onSelectBooking }: Props) {
  const { data: dash, isLoading } = useQuery({ queryKey: ['rental-dashboard'], queryFn: rentalApi.dashboard })

  const cards: Array<{
    label: string
    value: string | number
    icon: typeof Package
    tone: KpiTone
    onClick: () => void
  }> = [
    { label: 'Total Assets', value: dash?.total_assets ?? 0, icon: Package, tone: 'slate', onClick: onGoToAssets },
    { label: 'Available', value: dash?.available ?? 0, icon: CheckCircle2, tone: 'emerald', onClick: () => onGoToAssets() },
    { label: 'Occupied', value: dash?.occupied ?? 0, icon: Boxes, tone: 'amber', onClick: () => onGoToAssets() },
    { label: 'Maintenance', value: dash?.maintenance ?? 0, icon: Wrench, tone: 'orange', onClick: () => onGoToAssets() },
    { label: 'Pending Bookings', value: dash?.pending_bookings ?? 0, icon: Clock, tone: 'sky', onClick: () => onGoToBookings('pending') },
    { label: 'Rental Revenue', value: formatCurrency(Number(dash?.rental_revenue || 0)), icon: IndianRupee, tone: 'teal', onClick: () => onGoToBookings() },
  ]

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-border bg-card px-4 py-3.5">
              <Skeleton className="mb-2 h-3 w-20" />
              <Skeleton className="h-7 w-16" />
            </div>
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="min-h-[22rem] overflow-hidden rounded-lg border border-border bg-card">
              <div className="border-b border-border px-4 py-3">
                <Skeleton className="h-4 w-40" />
              </div>
              <div className="space-y-3 p-4">
                {Array.from({ length: 5 }).map((__, r) => (
                  <Skeleton key={r} className="h-9 w-full" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const recentAssets = (dash?.recent_assets || []) as RentalAsset[]
  const upcomingBookings = (dash?.upcoming_bookings || []) as RentalBooking[]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {cards.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={c.onClick}
            className="flex min-h-[5.25rem] flex-col justify-between rounded-lg border border-border bg-card px-4 py-3.5 text-left transition-colors hover:border-foreground/20 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className={cn('flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide', KPI_TONES[c.tone])}>
              <c.icon className="h-3.5 w-3.5 shrink-0 opacity-80" />
              <span className="truncate">{c.label}</span>
            </div>
            <p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight text-foreground">{c.value}</p>
          </button>
        ))}
      </div>

      <div className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <section className="flex min-h-[22rem] flex-col overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-2.5">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold tracking-tight text-foreground">Recent Rental Assets</h2>
              <p className="text-[11px] text-muted-foreground">Latest inventory and capacity</p>
            </div>
            <button
              type="button"
              className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              onClick={onGoToAssets}
            >
              View all
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
          {recentAssets.length === 0 ? (
            <div className="flex flex-1 items-center justify-center p-4">
              <RentalEmptyState icon={Package} title="No assets yet" description="Add your first rental rack to get started." />
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
              <div className="sticky top-0 z-10 grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_5.5rem_auto] gap-x-3 border-b border-border bg-muted/40 px-4 py-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                <span className="font-semibold"><TableColumnLabel>Asset</TableColumnLabel></span>
                <span className="font-semibold"><TableColumnLabel>Dates</TableColumnLabel></span>
                <span className="font-semibold"><TableColumnLabel>Capacity</TableColumnLabel></span>
                <span className="font-semibold text-right"><TableColumnLabel>Status</TableColumnLabel></span>
              </div>
              <ul className="divide-y divide-border">
                {recentAssets.map((a) => {
                  const av = assetCardAvailability(a, allBookings)
                  return (
                    <li
                      key={a.id}
                      className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_5.5rem_auto] items-center gap-x-3 px-4 py-3 transition-colors hover:bg-muted/25"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium leading-snug text-foreground">{a.name}</p>
                        <p className="mt-0.5 truncate text-[11px] capitalize text-muted-foreground">
                          {(a.category || '').replace(/_/g, ' ') || '—'}
                        </p>
                      </div>
                      <p className="min-w-0 text-xs leading-snug text-muted-foreground line-clamp-2">
                        {av.kind === 'range' ? av.detail : av.label}
                      </p>
                      <CapacityMeter
                        available={Number(a.available_capacity ?? 0)}
                        max={Number(a.capacity_max ?? 0)}
                        unit={a.capacity_unit}
                      />
                      <div className="shrink-0 justify-self-end">
                        <StatusBadge status={a.status} />
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </section>

        <section className="flex min-h-[22rem] flex-col overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-2.5">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold tracking-tight text-foreground">Upcoming Bookings</h2>
              <p className="text-[11px] text-muted-foreground">Next confirmed and active rentals</p>
            </div>
            <button
              type="button"
              className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => onGoToBookings()}
            >
              View all
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
          {upcomingBookings.length === 0 ? (
            <div className="flex flex-1 items-center justify-center p-4">
              <RentalEmptyState icon={Clock} title="No upcoming bookings" />
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
              <div className="sticky top-0 z-10 grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 border-b border-border bg-muted/40 px-4 py-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                <span className="font-semibold"><TableColumnLabel>Booking</TableColumnLabel></span>
                <span className="font-semibold text-right"><TableColumnLabel>Amount</TableColumnLabel></span>
                <span className="font-semibold text-right"><TableColumnLabel>Status</TableColumnLabel></span>
              </div>
              <ul className="divide-y divide-border">
                {upcomingBookings.map((b) => (
                  <li key={b.id}>
                    <button
                      type="button"
                      className="grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-start gap-x-3 px-4 py-3 text-left transition-colors hover:bg-muted/25"
                      onClick={() => onSelectBooking(b)}
                    >
                      <div className="min-w-0 space-y-0.5">
                        <p className="truncate font-mono text-[13px] font-semibold tracking-tight text-foreground">
                          {b.booking_number || b.id.slice(0, 8)}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {[b.customer_name, b.asset_name].filter(Boolean).join(' · ') || '—'}
                        </p>
                        <p className="text-[11px] tabular-nums text-muted-foreground">
                          {formatCardDate(b.start_date) || '—'}
                          <span className="mx-1 text-muted-foreground/60">→</span>
                          {formatCardDate(b.end_date) || '—'}
                        </p>
                      </div>
                      <p className="whitespace-nowrap pt-0.5 text-right text-xs font-medium tabular-nums text-foreground">
                        {formatCurrency(Number(b.total_amount ?? b.rental_amount ?? 0))}
                      </p>
                      <div className="shrink-0 justify-self-end pt-0.5">
                        <StatusBadge status={b.status} />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
