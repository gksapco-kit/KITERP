import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ChefHat, Loader2, UtensilsCrossed, Clock } from 'lucide-react'
import { vendorApi } from '@/api/vendor'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const KOT_STATUSES = ['new', 'preparing', 'ready', 'done'] as const
type KOTStatus = typeof KOT_STATUSES[number]

const STATUS_CONFIG: Record<KOTStatus, { label: string; badge: string }> = {
  new:       { label: 'New',       badge: 'bg-blue-100 text-blue-700' },
  preparing: { label: 'Preparing', badge: 'bg-amber-100 text-amber-800' },
  ready:     { label: 'Ready',     badge: 'bg-emerald-100 text-emerald-800' },
  done:      { label: 'Done',      badge: 'bg-gray-100 text-gray-500' },
}

function elapsed(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

export default function RestaurantKitchenPage() {
  const qc = useQueryClient()
  const [showDone, setShowDone] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['restaurant', 'kots', showDone],
    queryFn: () => vendorApi.restaurantListKOTs({ include_done: showDone }),
    refetchInterval: 5_000,
  })

  const mut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: KOTStatus }) =>
      vendorApi.restaurantPatchKOT(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['restaurant', 'kots'] })
      qc.invalidateQueries({ queryKey: ['restaurant', 'tables'] })
    },
    onError: () => toast.error('Could not update ticket'),
  })

  const kots = data?.items ?? []

  // Sort: new first, then preparing, then ready, then done
  const statusOrder: Record<string, number> = { new: 0, preparing: 1, ready: 2, done: 3 }
  const sorted = [...kots].sort((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9))

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ChefHat className="w-6 h-6 text-orange-600" /> Kitchen Board
          </h1>
          <p className="text-sm text-gray-500 mt-1">Live KOT tickets — refreshes every 8 seconds.</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <label className="flex items-center gap-2 text-xs text-gray-600 select-none cursor-pointer">
            <input
              type="checkbox"
              checked={showDone}
              onChange={e => setShowDone(e.target.checked)}
              className="accent-primary"
            />
            Show served
          </label>
          <Button variant="outline" size="sm" asChild>
            <Link to="/restaurant/floor"><UtensilsCrossed className="w-4 h-4 mr-1 inline" />Floor</Link>
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center py-16 text-gray-400"><Loader2 className="w-8 h-8 animate-spin" /></div>
      )}

      {!isLoading && sorted.length === 0 && (
        <p className="text-sm text-gray-500 py-8 text-center border rounded-xl bg-gray-50">
          No active KOT tickets.
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sorted.map(kot => {
          const cfg = STATUS_CONFIG[kot.status as KOTStatus] ?? STATUS_CONFIG.new
          return (
            <div
              key={kot.id}
              className={cn(
                'rounded-xl border bg-white p-4 shadow-sm flex flex-col gap-3',
                kot.status === 'ready' && 'border-emerald-300 shadow-emerald-100',
                kot.status === 'new' && 'border-blue-200',
                kot.order_status === 'voided' && 'opacity-75 border-red-200 border-dashed',
              )}
            >
              {/* Ticket header */}
              <div className="flex justify-between items-start gap-2">
                <div>
                  <p className="font-mono text-xs text-gray-400">KOT #{kot.kot_number}</p>
                  <p className="font-semibold text-gray-900 text-base">
                    {kot.table_label ? `Table ${kot.table_label}` : 'Counter'}
                  </p>
                  {kot.covers != null && (
                    <p className="text-xs text-gray-500">{kot.covers} cover{kot.covers !== 1 ? 's' : ''}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {kot.order_status === 'voided' && (
                    <span className="text-xs font-bold uppercase px-2 py-0.5 rounded-full border border-red-300 text-red-700 bg-red-50">
                      Order voided
                    </span>
                  )}
                  <span className={cn('text-xs font-bold uppercase px-2 py-0.5 rounded-full', cfg.badge)}>
                    {cfg.label}
                  </span>
                  <span className="text-xs text-gray-400 flex items-center gap-0.5">
                    <Clock className="w-3 h-3" />{elapsed(kot.created_at)}
                  </span>
                </div>
              </div>

              {/* Items */}
              <ul className="text-sm text-gray-700 space-y-1 border-t pt-2">
                {(kot.items ?? []).map((line, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span className="font-medium">{line.qty}× {line.name}</span>
                    {line.notes && (
                      <span className="text-xs text-gray-400 italic truncate max-w-[100px]">{line.notes}</span>
                    )}
                  </li>
                ))}
              </ul>

              {kot.notes && (
                <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1 italic">{kot.notes}</p>
              )}

              {/* Order link */}
              <Link
                to={`/restaurant/order/${kot.order_id}`}
                className="text-xs text-primary hover:underline"
              >
                View full order →
              </Link>

              {/* Status buttons */}
              <div className="flex flex-wrap gap-1.5 border-t pt-2">
                {KOT_STATUSES.map(st => (
                  <Button
                    key={st}
                    size="sm"
                    variant={kot.status === st ? 'default' : 'outline'}
                    className="text-xs capitalize h-8 flex-1"
                    disabled={mut.isPending}
                    onClick={() => mut.mutate({ id: kot.id, status: st })}
                  >
                    {STATUS_CONFIG[st].label}
                  </Button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
