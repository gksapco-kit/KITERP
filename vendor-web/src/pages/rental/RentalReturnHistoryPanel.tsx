import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, AlertTriangle, XCircle, Loader2, History } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { rentalApi } from './api'
import type { RentalReturn } from './rentalConstants'

function conditionIcon(condition: string) {
  if (condition === 'good') return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
  if (condition === 'damaged') return <AlertTriangle className="h-4 w-4 text-amber-500" />
  return <XCircle className="h-4 w-4 text-rose-500" />
}

function conditionLabel(condition: string) {
  if (condition === 'good') return 'Good condition'
  if (condition === 'damaged') return 'Damaged'
  return 'Missing / not returned'
}

function formatReturnedAt(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

type Props = {
  bookingId: string
  totalQuantity?: number
}

export default function RentalReturnHistoryPanel({ bookingId, totalQuantity }: Props) {
  const { data: returns = [], isLoading } = useQuery<RentalReturn[]>({
    queryKey: ['rental-return-history', bookingId],
    queryFn: () => rentalApi.listReturnHistory(bookingId),
    enabled: Boolean(bookingId),
  })

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading return history…
      </div>
    )
  }

  if (returns.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1.5 py-6 text-muted-foreground">
        <History className="h-8 w-8 opacity-30" />
        <p className="text-sm">No returns recorded yet.</p>
      </div>
    )
  }

  const totalReturned = returns.reduce((sum, r) => sum + r.quantity_returned, 0)

  return (
    <div className="space-y-2">
      {/* Summary pill */}
      {totalQuantity != null && (
        <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          <span>Total returned</span>
          <span className="font-semibold text-foreground">
            {totalReturned} / {totalQuantity}
          </span>
        </div>
      )}

      {/* Timeline */}
      <ol className="relative ml-3 border-l border-border space-y-0">
        {returns.map((r, idx) => (
          <li key={r.id} className="mb-0 ml-4">
            {/* Timeline dot */}
            <span
              className={[
                'absolute -left-1.5 flex h-3 w-3 items-center justify-center rounded-full ring-2 ring-background',
                r.return_condition === 'good'
                  ? 'bg-emerald-500'
                  : r.return_condition === 'damaged'
                    ? 'bg-amber-500'
                    : 'bg-rose-500',
              ].join(' ')}
            />
            <div className={`pb-4 ${idx === returns.length - 1 ? '' : ''}`}>
              <time className="mb-0.5 block text-[10px] text-muted-foreground">
                {formatReturnedAt(r.returned_at)}
              </time>

              <div className="rounded-lg border bg-card p-2.5 shadow-sm">
                <div className="flex items-center gap-1.5">
                  {conditionIcon(r.return_condition)}
                  <span className="text-sm font-medium">
                    {r.quantity_returned} unit{r.quantity_returned !== 1 ? 's' : ''} — {conditionLabel(r.return_condition)}
                  </span>
                </div>

                {(r.damage_charge > 0 || r.late_fee > 0 || r.deposit_refunded > 0) && (
                  <div className="mt-1.5 grid grid-cols-3 gap-1 text-[11px]">
                    {r.late_fee > 0 && (
                      <span className="text-rose-600 dark:text-rose-400">
                        Late fee: {formatCurrency(r.late_fee)}
                      </span>
                    )}
                    {r.damage_charge > 0 && (
                      <span className="text-amber-600 dark:text-amber-400">
                        Damage: {formatCurrency(r.damage_charge)}
                      </span>
                    )}
                    {r.deposit_refunded > 0 && (
                      <span className="text-emerald-600 dark:text-emerald-400">
                        Refunded: {formatCurrency(r.deposit_refunded)}
                      </span>
                    )}
                  </div>
                )}

                {r.return_notes && (
                  <p className="mt-1 text-[11px] text-muted-foreground">{r.return_notes}</p>
                )}

                {r.unit_ids.length > 0 && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {r.unit_ids.length} serialized unit{r.unit_ids.length !== 1 ? 's' : ''} checked in
                  </p>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
