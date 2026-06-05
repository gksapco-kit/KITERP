import { Link } from 'react-router-dom'
import { ChevronRight, Loader2, Repeat } from 'lucide-react'
import { useVendor } from '@/contexts/VendorContext'
import { useSubscriptions, useUpdateSubscription } from '@/hooks/useStore'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const STATUS_LABEL: Record<string, string> = {
  trialing: 'Trial',
  active: 'Active',
  paused: 'Paused',
  cancelled: 'Cancelled',
  expired: 'Expired',
}

export default function MySubscriptions() {
  const { storePath } = useVendor()
  const { data: subs = [], isLoading } = useSubscriptions()
  const updateSub = useUpdateSubscription()

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <nav className="text-sm text-gray-500 mb-6 flex items-center gap-1.5">
        <Link to={storePath('/account')} className="hover:text-primary">Account</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-gray-900 font-medium">Subscriptions</span>
      </nav>

      <div className="flex items-center gap-2 mb-6">
        <Repeat className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-bold text-gray-900">My subscriptions</h1>
      </div>

      {isLoading && (
        <div className="flex justify-center py-16">
          <Loader2 className="w-7 h-7 animate-spin text-gray-400" />
        </div>
      )}

      {!isLoading && subs.length === 0 && (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-gray-500">
          No active subscriptions yet.&nbsp;
          <Link to={storePath('/products')} className="text-primary font-medium">Browse products</Link>
        </div>
      )}

      <div className="space-y-3">
        {subs.map((s: Record<string, unknown>) => {
          const id = String(s.id)
          const status = String(s.status || 'active')
          return (
            <div key={id} className="rounded-xl border bg-white p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium text-gray-900">{String(s.item_name)}</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  {formatCurrency(Number(s.price_per_cycle || 0))} / {String(s.interval)}
                  <span className="mx-2">·</span>
                  <span className="capitalize">{STATUS_LABEL[status] || status}</span>
                </p>
                {s.next_billing_at && (
                  <p className="text-xs text-gray-400 mt-1">
                    Next billing: {new Date(String(s.next_billing_at)).toLocaleDateString()}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                {status === 'active' && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={updateSub.isPending}
                    onClick={() => updateSub.mutate({ id, status: 'paused' })}
                  >
                    Pause
                  </Button>
                )}
                {status === 'paused' && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={updateSub.isPending}
                    onClick={() => updateSub.mutate({ id, status: 'active' })}
                  >
                    Resume
                  </Button>
                )}
                {status !== 'cancelled' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600"
                    disabled={updateSub.isPending}
                    onClick={() => updateSub.mutate({ id, status: 'cancelled' })}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
