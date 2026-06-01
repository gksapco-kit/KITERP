import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useOrders } from '@/hooks/useStore'
import { formatCurrency, formatDate, imgUrl } from '@/lib/utils'
import { ChevronRight, ChevronLeft, CalendarDays, MessageSquare, ShoppingBag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useVendor } from '@/contexts/VendorContext'
import { TableToolbar } from '@/components/table/TableToolbar'
import { processRows, type SortDir } from '@/lib/tableList'
import type { Order } from '@/types'
import { TableSkeleton, EmptyOrders } from '@/kit/states/StateScreens'

const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  pending: { bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-500' },
  confirmed: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  shipped: { bg: 'bg-accent', text: 'text-primary', dot: 'bg-primary' },
  delivered: { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' },
  cancelled: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  return_requested: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  exchange_requested: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  returned: { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
  exchanged: { bg: 'bg-indigo-50', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  refunded: { bg: 'bg-gray-50', text: 'text-gray-700', dot: 'bg-gray-500' },
}

const statusLabel: Record<string, string> = {
  return_requested: 'Return Requested',
  exchange_requested: 'Exchange Requested',
  quote_requested: 'Quote Requested',
}

const sourceIcon: Record<string, React.ReactNode> = {
  booking: <CalendarDays className="w-3 h-3" />,
  quote: <MessageSquare className="w-3 h-3" />,
}

export default function MyOrders() {
  const [page, setPage] = useState(1)
  const { data, isLoading } = useOrders({ page, size: 10 })
  const { storePath } = useVendor()
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const orderRows = useMemo(() => {
    if (!data?.items?.length) return []
    return processRows(
      data.items as Order[],
      search,
      (o) => [o.order_number, o.status, String(o.total), formatDate(o.created_at)],
      sortKey,
      sortDir,
      {
        created_at: (o) => o.created_at,
        order_number: (o) => o.order_number,
        status: (o) => o.status,
        total: (o) => o.total,
        item_count: (o) => o.item_count,
      },
    )
  }, [data?.items, search, sortKey, sortDir])

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <nav className="text-sm text-gray-500 mb-6">
        <Link to={storePath('/')} className="hover:text-blue-600">Home</Link>
        <ChevronRight className="inline w-3 h-3 mx-1.5" />
        <Link to={storePath('/account')} className="hover:text-blue-600">Account</Link>
        <ChevronRight className="inline w-3 h-3 mx-1.5" />
        <span className="text-gray-900 font-medium">Your Orders</span>
      </nav>

      <h1 className="text-2xl font-bold mb-6">Your Orders</h1>

      {isLoading ? (
        <TableSkeleton rows={6} />
      ) : !data?.items?.length ? (
        <EmptyOrders />
      ) : (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border overflow-hidden">
            <TableToolbar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search order #, status…"
              sortOptions={[
                { value: 'created_at', label: 'Date' },
                { value: 'order_number', label: 'Order #' },
                { value: 'status', label: 'Status' },
                { value: 'total', label: 'Total' },
                { value: 'item_count', label: 'Items' },
              ]}
              sortKey={sortKey}
              sortDir={sortDir}
              onSortKeyChange={setSortKey}
              onSortDirChange={setSortDir}
              hint="Filter & sort apply to this page of orders."
              className="rounded-t-xl border-0 border-b"
            />
          </div>
          {orderRows.length === 0 ? (
            <div className="text-center py-12 text-sm text-gray-500 bg-white rounded-xl border">No orders match your filter.</div>
          ) : orderRows.map((order) => {
            const status = statusConfig[order.status] || statusConfig.pending
            return (
              <Link key={order.id} to={storePath(`/account/orders/${order.id}`)}
                className="block bg-white rounded-xl border hover:shadow-md transition-all group overflow-hidden max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="bg-gray-50 px-5 py-3 border-b flex items-center justify-between flex-wrap gap-2 text-sm">
                  <div className="flex gap-6 flex-wrap">
                    <div>
                      <span className="text-gray-500">Order placed: </span>
                      <span className="font-medium">{formatDate(order.created_at)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Total: </span>
                      <span className="font-bold">{formatCurrency(order.total)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {order.source && order.source !== 'online' && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        order.source === 'booking' ? 'bg-indigo-100 text-indigo-700' :
                        order.source === 'quote' ? 'bg-primary/10 text-primary' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {sourceIcon[order.source]}
                        {order.source.charAt(0).toUpperCase() + order.source.slice(1)}
                      </span>
                    )}
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${status.bg} ${status.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                      {statusLabel[order.status] || order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </span>
                    <span className="text-gray-400 text-xs">{order.order_number}</span>
                  </div>
                </div>

                {/* Items preview */}
                <div className="px-5 py-4 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 overflow-hidden">
                      {order.items.slice(0, 3).map((item, i) => (
                        <div key={i} className="w-14 h-14 bg-gray-50 rounded-lg border overflow-hidden shrink-0">
                          {item.image_url ? (
                            <img src={imgUrl(item.image_url)} alt="" className="w-full h-full object-cover" />
                          ) : <ShoppingBag className="w-full h-full p-2 text-gray-200" />}
                        </div>
                      ))}
                      {order.items.length > 3 && (
                        <span className="text-sm text-gray-400 shrink-0">+{order.items.length - 3} more</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-2">{order.item_count} item{order.item_count !== 1 ? 's' : ''}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-600 transition-colors shrink-0" />
                </div>
              </Link>
            )
          })}

          {/* Pagination */}
          {data.pages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-6">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="gap-1">
                <ChevronLeft className="w-4 h-4" /> Previous
              </Button>
              <span className="text-sm text-gray-500">Page {data.page} of {data.pages}</span>
              <Button variant="outline" size="sm" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)} className="gap-1">
                Next <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
