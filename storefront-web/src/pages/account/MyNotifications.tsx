import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { storeApi } from '@/api/store'
import { storeKeys } from '@/hooks/useStore'
import { useVendor } from '@/contexts/VendorContext'
import { cn } from '@/lib/utils'

export default function MyNotifications() {
  const { storePath } = useVendor()
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: storeKeys.notifications({ limit: 100, unread_only: false }),
    queryFn: () => storeApi.listNotifications({ limit: 100 }),
  })

  const markAll = useMutation({
    mutationFn: storeApi.markAllNotificationsRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: storeKeys.notificationStats })
      qc.invalidateQueries({ queryKey: ['store-notifications'] })
    },
  })

  const markOne = useMutation({
    mutationFn: storeApi.markNotificationRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: storeKeys.notificationStats })
      qc.invalidateQueries({ queryKey: ['store-notifications'] })
    },
  })

  const items = data?.items ?? []
  const hasUnread = items.some((n) => !n.is_read)

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <nav className="text-sm text-gray-500 mb-6">
        <Link to={storePath('/')} className="hover:text-blue-600">Home</Link>
        <ChevronRight className="inline w-3 h-3 mx-1.5" />
        <Link to={storePath('/account')} className="hover:text-blue-600">Your Account</Link>
        <ChevronRight className="inline w-3 h-3 mx-1.5" />
        <span className="text-gray-900 font-medium">Notifications</span>
      </nav>

      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
        {hasUnread && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={markAll.isPending}
            onClick={() => markAll.mutate()}
          >
            Mark all read
          </Button>
        )}
      </div>

      {isLoading && <p className="text-sm text-gray-500">Loading…</p>}

      {!isLoading && items.length === 0 && (
        <p className="text-sm text-gray-500 py-8 text-center border rounded-xl bg-white">
          You do not have any notifications yet. Updates to your orders will appear here.
        </p>
      )}

      <ul className="space-y-2">
        {items.map((n) => (
          <li
            key={n.id}
            className={cn(
              'rounded-xl border bg-white p-4 transition-shadow',
              !n.is_read && 'border-blue-200 shadow-sm',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900">{n.title}</p>
                {n.message && <p className="text-sm text-gray-600 mt-1">{n.message}</p>}
                {n.created_at && (
                  <p className="text-xs text-gray-400 mt-2">{new Date(n.created_at).toLocaleString()}</p>
                )}
                {n.reference_type === 'order' && n.reference_id && (
                  <Link
                    to={storePath(`/account/orders/${n.reference_id}`)}
                    className="text-sm text-blue-600 hover:underline mt-2 inline-block"
                  >
                    View order
                  </Link>
                )}
              </div>
              {!n.is_read && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-xs"
                  disabled={markOne.isPending}
                  onClick={() => markOne.mutate(n.id)}
                >
                  Mark read
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
