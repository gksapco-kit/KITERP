import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ChefHat, Loader2, UtensilsCrossed } from 'lucide-react'
import { vendorApi } from '@/api/vendor'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'

const STATUSES = ['new', 'preparing', 'ready', 'done'] as const

export default function RestaurantKitchenPage() {
  const qc = useQueryClient()
  const [showDone, setShowDone] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['restaurant', 'kitchen', showDone],
    queryFn: () => vendorApi.restaurantKitchenTickets({ include_done: showDone }),
    refetchInterval: 12_000,
  })

  const mut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: typeof STATUSES[number] }) =>
      vendorApi.restaurantPatchKitchenTicket(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['restaurant', 'kitchen'] })
    },
    onError: () => toast.error('Could not update ticket'),
  })

  const items = data?.items ?? []

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ChefHat className="w-6 h-6 text-orange-600" /> Kitchen board
          </h1>
          <p className="text-sm text-gray-500 mt-1">Tickets from restaurant POS checkouts today (UTC day).</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <label className="flex items-center gap-2 text-xs text-gray-600">
            <input type="checkbox" checked={showDone} onChange={e => setShowDone(e.target.checked)} />
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

      {!isLoading && items.length === 0 && (
        <p className="text-sm text-gray-500 py-8 text-center border rounded-xl bg-gray-50">No active tickets.</p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {items.map(ticket => (
          <div
            key={ticket.transaction_id}
            className="rounded-xl border bg-white p-4 shadow-sm flex flex-col gap-3"
          >
            <div className="flex justify-between items-start gap-2">
              <div>
                <p className="font-mono text-xs text-gray-400">{ticket.transaction_number}</p>
                <p className="font-semibold text-gray-900">
                  {ticket.table_label ? `Table ${ticket.table_label}` : 'Takeaway / counter'}
                </p>
              </div>
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                ticket.kitchen_ticket_status === 'new' ? 'bg-blue-100 text-blue-700'
                  : ticket.kitchen_ticket_status === 'preparing' ? 'bg-amber-100 text-amber-800'
                  : ticket.kitchen_ticket_status === 'ready' ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {ticket.kitchen_ticket_status}
              </span>
            </div>
            <ul className="text-sm text-gray-700 space-y-1 border-t pt-2">
              {(ticket.items || []).map((line: Record<string, unknown>, i: number) => (
                <li key={i} className="flex justify-between gap-2">
                  <span>{String(line.qty ?? 1)}× {String(line.name ?? '')}</span>
                  <span className="text-gray-400 text-xs">{line.item_type ? String(line.item_type) : ''}</span>
                </li>
              ))}
            </ul>
            <div className="flex justify-between items-center text-sm border-t pt-2">
              <span className="text-gray-500">{ticket.created_at ? new Date(ticket.created_at).toLocaleTimeString() : ''}</span>
              <span className="font-semibold">{formatCurrency(ticket.total)}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {STATUSES.map(st => (
                <Button
                  key={st}
                  size="sm"
                  variant={ticket.kitchen_ticket_status === st ? 'default' : 'outline'}
                  className="text-xs capitalize h-8"
                  disabled={mut.isPending}
                  onClick={() => mut.mutate({ id: ticket.transaction_id, status: st })}
                >
                  {st}
                </Button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
