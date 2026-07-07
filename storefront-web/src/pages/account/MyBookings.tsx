import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useBookings, useCancelBooking } from '@/hooks/useStore'
import { useVendor } from '@/contexts/VendorContext'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ChevronRight, ChevronLeft, Clock, XCircle, Eye, CalendarDays, Loader2 } from 'lucide-react'
import { TableToolbar } from '@/components/table/TableToolbar'
import { processRows, type SortDir } from '@/lib/tableList'
import { TableSkeleton, EmptyBookings } from '@/kit/states/StateScreens'

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-yellow-50', text: 'text-yellow-700', label: 'Pending' },
  confirmed: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Confirmed' },
  in_progress: { bg: 'bg-indigo-50', text: 'text-indigo-700', label: 'In Progress' },
  completed: { bg: 'bg-green-50', text: 'text-green-700', label: 'Completed' },
  cancelled: { bg: 'bg-red-50', text: 'text-red-700', label: 'Cancelled' },
  no_show: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'No Show' },
}

export default function MyBookings() {
  const { storePath } = useVendor()
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const { data, isLoading } = useBookings({ page, size: 10 })
  const cancelBooking = useCancelBooking()
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('booking_date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const rawBookings = data?.items || []
  const pages = data?.pages || 0

  type BRow = (typeof rawBookings)[number]
  const bookings = useMemo(
    () =>
      processRows(
        rawBookings,
        search,
        (b: BRow) => [
          b.booking_number,
          b.service_name || '',
          b.status,
          String(b.total),
          b.booking_date,
        ],
        sortKey,
        sortDir,
        {
          booking_date: (b) => b.booking_date,
          booking_number: (b) => b.booking_number,
          service_name: (b) => b.service_name,
          status: (b) => b.status,
          total: (b) => b.total,
        },
      ),
    [rawBookings, search, sortKey, sortDir],
  )

  const handleCancel = (id: string) => {
    if (!confirm('Are you sure you want to cancel this booking?')) return
    setCancellingId(id)
    cancelBooking.mutate({ id, reason: 'Cancelled by customer' }, {
      onSettled: () => setCancellingId(null),
    })
  }

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
      <nav className="text-sm text-gray-500 mb-6">
        <Link to={storePath('/')} className="hover:text-blue-600">Home</Link>
        <ChevronRight className="inline w-3 h-3 mx-1.5" />
        <Link to={storePath('/account')} className="hover:text-blue-600">Account</Link>
        <ChevronRight className="inline w-3 h-3 mx-1.5" />
        <span className="text-gray-900 font-medium">My Bookings</span>
      </nav>

      <h1 className="text-2xl font-bold mb-6">My Bookings</h1>

      {isLoading ? (
        <TableSkeleton rows={5} />
      ) : !bookings.length ? (
        <EmptyBookings />
      ) : (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border overflow-hidden">
            <TableToolbar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search booking #, service, status…"
              sortOptions={[
                { value: 'booking_date', label: 'Date' },
                { value: 'booking_number', label: 'Booking #' },
                { value: 'service_name', label: 'Service' },
                { value: 'status', label: 'Status' },
                { value: 'total', label: 'Total' },
              ]}
              sortKey={sortKey}
              sortDir={sortDir}
              onSortKeyChange={setSortKey}
              onSortDirChange={setSortDir}
              hint="Applies to bookings on this page."
              className="rounded-t-xl border-0 border-b"
            />
          </div>
          {bookings.length === 0 ? (
            <div className="text-center py-12 text-sm text-gray-500 bg-white rounded-xl border">No bookings match your filter.</div>
          ) : bookings.map((b) => {
            const badge = STATUS_BADGE[b.status] || STATUS_BADGE.pending
            const canCancel = ['pending', 'confirmed'].includes(b.status)
            return (
              <div key={b.id} className="bg-white rounded-xl border p-5 hover:shadow-sm transition-shadow max-h-[90vh] overflow-y-auto">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-gray-400">{b.booking_number}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
                        {badge.label}
                      </span>
                    </div>
                    <h3 className="text-base font-semibold text-gray-900 mt-1">{b.service_name}</h3>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-600 flex-wrap">
                      <span className="flex items-center gap-1.5">
                        <CalendarDays className="w-4 h-4 text-gray-400" />
                        {new Date(b.booking_date).toLocaleDateString('en-IN', {
                          weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </span>
                      {b.start_time && (
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-gray-400" />
                          {b.start_time.substring(0, 5)}
                          {b.duration_minutes && ` (${b.duration_minutes} min)`}
                        </span>
                      )}
                    </div>
                    {b.cancel_reason && (
                      <p className="text-xs text-red-500 mt-2">Reason: {b.cancel_reason}</p>
                    )}
                  </div>
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:shrink-0 sm:items-end sm:text-right">
                    <p className="text-lg font-bold text-gray-900">{formatCurrency(b.total)}</p>
                    <p className="text-xs text-gray-400 capitalize">{b.payment_status}</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {b.order_id && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs gap-1"
                          onClick={() => navigate(storePath(`/account/orders/${b.order_id}`))}
                        >
                          <Eye className="w-3.5 h-3.5" /> View
                        </Button>
                      )}
                      {canCancel && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 text-xs"
                          onClick={() => handleCancel(b.id)}
                          disabled={cancellingId === b.id}
                        >
                          {cancellingId === b.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 mr-1" />
                          )}
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}

          {pages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-sm text-gray-500">Page {page} of {pages}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
