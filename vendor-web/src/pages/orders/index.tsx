import { useCallback, useEffect, useMemo, useState } from 'react'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { useNavigate } from 'react-router-dom'
import { useVendorStore } from '@/stores/vendorStore'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, selectOptionsWithBlank } from '@/components/ui/select'
import { useOrders, useUpdateOrderStatus, useOrderReservations, useStores } from '@/hooks/useVendor'
import { MRPReportModal } from '@/components/mrp/MRPReportModal'
import type { MRPItem } from '@/components/mrp/MRPReportModal'
import { formatCurrency, formatDate } from '@/lib/utils'
import { TableToolbar } from '@/components/table/TableToolbar'
import { ResizableTable } from '@/components/table/ResizableTable'
import { processRows, type SortDir } from '@/lib/tableList'
import { onClickableTableRow } from '@/lib/clickableTableRow'
import type { Order } from '@/types'
import { Search, ChevronLeft, ChevronRight, Eye, Loader2, Globe, Monitor, CalendarDays, Download, X, MessageSquare, BarChart3, Lock, Store, Plus } from 'lucide-react'
import { CreateBookingModal } from '@/pages/bookings/CreateBookingModal'
const statusFilters = [
  { label: 'All', value: '' },
  { label: 'Quote Requests', value: 'quote_requested' },
  { label: 'Pending', value: 'pending' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'Processing', value: 'processing' },
  { label: 'Shipped', value: 'shipped' },
  { label: 'Delivered', value: 'delivered' },
  { label: 'Returns', value: 'return_requested' },
  { label: 'Returned', value: 'returned' },
  { label: 'Exchanges', value: 'exchange_requested' },
  { label: 'Exchanged', value: 'exchanged' },
  { label: 'Cancelled', value: 'cancelled' },
]

const statusStyle: Record<string, string> = {
  quote_requested: 'bg-primary/10 text-primary',
  pending: 'bg-yellow-500/15 text-yellow-800 dark:text-yellow-300',
  confirmed: 'bg-blue-500/15 text-blue-800 dark:text-blue-300',
  processing: 'bg-indigo-500/15 text-indigo-800 dark:text-indigo-300',
  shipped: 'bg-primary/12 text-primary',
  delivered: 'bg-green-500/15 text-green-800 dark:text-green-300',
  cancelled: 'bg-red-500/15 text-red-800 dark:text-red-300',
  return_requested: 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
  exchange_requested: 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
  returned: 'bg-orange-500/15 text-orange-800 dark:text-orange-300',
  exchanged: 'bg-indigo-500/15 text-indigo-800 dark:text-indigo-300',
  refunded: 'bg-muted text-muted-foreground',
}

/** Table row icon buttons — muted tile + clear icon on hover (all themes). */
const TABLE_ICON_BTN =
  'text-muted-foreground hover:bg-muted hover:text-foreground dark:hover:bg-muted/70 dark:hover:text-foreground'

const SOURCE_BADGE: Record<string, string> = {
  online: 'bg-blue-500/15 text-blue-800 dark:text-blue-300',
  pos: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300',
  booking: 'bg-primary/12 text-primary',
  quote: 'bg-primary/10 text-primary',
}

const statusLabel: Record<string, string> = {
  quote_requested: 'Quote Request',
  return_requested: 'Return Requested',
  exchange_requested: 'Exchange Requested',
}

const sourceFilters = [
  { label: 'All Sources', value: '', icon: Globe },
  { label: 'Online', value: 'online', icon: Globe },
  { label: 'POS', value: 'pos', icon: Monitor },
  { label: 'Booking', value: 'booking', icon: CalendarDays },
  { label: 'Quotes', value: 'quote', icon: MessageSquare },
]

const bulkStatusOptions = [
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'Processing', value: 'processing' },
  { label: 'Shipped', value: 'shipped' },
  { label: 'Delivered', value: 'delivered' },
  { label: 'Cancelled', value: 'cancelled' },
]

export default function Orders() {
  const navigate = useNavigate()
  const { selectedStore } = useVendorStore()
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [storeFilter, setStoreFilter] = useState(selectedStore?.id ?? '')

  // Sync with global store selection
  useEffect(() => {
    setStoreFilter(selectedStore?.id ?? '')
    setPage(1)
  }, [selectedStore?.id])
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [sortKey, setSortKey] = useState('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkStatus, setBulkStatus] = useState('')
  const [mrpOrder, setMrpOrder] = useState<{ id: string; order_number: string; items: MRPItem[] } | null>(null)
  const [showCreateBooking, setShowCreateBooking] = useState(false)

  const { data: storesData } = useStores()
  const stores = storesData?.stores ?? []

  const { data, isLoading } = useOrders({ page, size: 10, status: statusFilter || undefined, source: sourceFilter || undefined, search: search || undefined, store_id: storeFilter || undefined })
  const updateStatus = useUpdateOrderStatus()

  const displayOrders = useMemo(() => {
    if (!data?.items?.length) return []
    return processRows(
      data.items as Order[],
      '',
      () => [],
      sortKey,
      sortDir,
      {
        order_number: (o) => o.order_number,
        customer: (o) => `${o.customer_name || ''} ${o.customer_email || ''}`,
        item_count: (o) => o.item_count,
        total: (o) => o.total,
        source: (o) => o.source || 'online',
        status: (o) => o.status,
        created_at: (o) => o.created_at,
      },
    )
  }, [data?.items, sortKey, sortDir])

  const allSelected = displayOrders.length > 0 && displayOrders.every((o) => selectedIds.has(o.id))

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allSelected) {
        displayOrders.forEach((o) => next.delete(o.id))
      } else {
        displayOrders.forEach((o) => next.add(o.id))
      }
      return next
    })
  }, [allSelected, displayOrders])

  const toggleRow = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleDownloadCsv = useCallback(() => {
    const selected = displayOrders.filter((o) => selectedIds.has(o.id))
    if (!selected.length) return
    const csvEscape = (s: string) => `"${String(s).replace(/"/g, '""')}"`
    const header = ['Order #', 'Date', 'Customer', 'Items', 'Total', 'Status', 'Source'].map(csvEscape)
    const rows = selected.map((o) => [
      o.order_number,
      formatDate(o.created_at),
      o.customer_name || 'Unknown',
      String(o.item_count),
      String(o.total),
      o.status,
      o.source || 'online',
    ].map(csvEscape))
    const csv = [header, ...rows].map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }, [displayOrders, selectedIds])

  const handleBulkStatusChange = useCallback(async () => {
    if (!bulkStatus || !selectedIds.size) return
    const ids = Array.from(selectedIds)
    for (const id of ids) {
      await updateStatus.mutateAsync({ id, data: { status: bulkStatus } })
    }
    setSelectedIds(new Set())
    setBulkStatus('')
  }, [bulkStatus, selectedIds, updateStatus])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Button className="gap-1.5" onClick={() => navigate('/pos')}>
            <Plus className="w-4 h-4" /> Create Order
          </Button>
          <Button variant="outline" className="gap-1.5" onClick={() => navigate('/pos')}>
            <Monitor className="w-4 h-4" /> Open POS
          </Button>
          <Button variant="outline" className="gap-1.5" onClick={() => setShowCreateBooking(true)}>
            <CalendarDays className="w-4 h-4" /> Bookings
          </Button>
          <Button
            variant="outline"
            className="gap-1.5"
            onClick={() => navigate('/quotations')}
          >
            <MessageSquare className="w-4 h-4" /> Quotations
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex flex-col sm:flex-row gap-4">
            <form onSubmit={(e) => { e.preventDefault(); setSearch(searchInput); setPage(1) }} className="flex-1 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input data-kiterp-search-field placeholder="Search orders..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} className="pl-10" />
              </div>
              <Button type="submit" variant="outline">Search</Button>
            </form>
          </div>
          <div className="flex gap-1 flex-wrap items-center">
            <span className="text-xs font-medium text-gray-500 mr-1">Source:</span>
            {sourceFilters.map((f) => (
              <Button key={f.value} variant={sourceFilter === f.value ? 'default' : 'outline'} size="sm"
                onClick={() => { setSourceFilter(f.value); setPage(1) }} className="gap-1">
                <f.icon className="w-3.5 h-3.5" />{f.label}
              </Button>
            ))}
          </div>
          <div className="flex gap-1 flex-wrap items-center">
            <span className="text-xs font-medium text-gray-500 mr-1">Status:</span>
            {statusFilters.map((f) => (
              <Button key={f.value} variant={statusFilter === f.value ? 'default' : 'outline'} size="sm"
                onClick={() => { setStatusFilter(f.value); setPage(1) }}>{f.label}</Button>
            ))}
          </div>
          {stores.length > 0 && (
            <div className="flex gap-1 flex-wrap items-center">
              <span className="text-xs font-medium text-gray-500 mr-1 flex items-center gap-1"><Store className="w-3.5 h-3.5" />Store:</span>
              <Button variant={storeFilter === '' ? 'default' : 'outline'} size="sm" onClick={() => { setStoreFilter(''); setPage(1) }}>All Stores</Button>
              {stores.map(s => (
                <Button key={s.id} variant={storeFilter === s.id ? 'default' : 'outline'} size="sm" onClick={() => { setStoreFilter(s.id); setPage(1) }}>
                  {s.name}{s.code ? ` (${s.code})` : ''}
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 px-6 py-3 bg-blue-50 border-b">
              <span className="text-sm font-medium text-blue-700">{selectedIds.size} selected</span>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownloadCsv}>
                <Download className="w-3.5 h-3.5" />Download CSV
              </Button>
              <div className="flex items-center gap-1.5">
                <Select
                  value={bulkStatus}
                  onChange={setBulkStatus}
                  options={selectOptionsWithBlank('Change Status…', bulkStatusOptions)}
                  placeholder="Change Status…"
                  aria-label="Bulk status change"
                  className="h-8 min-w-[10rem]"
                />
                <Button
                  variant="default"
                  size="sm"
                  disabled={!bulkStatus || updateStatus.isPending}
                  onClick={handleBulkStatusChange}
                >
                  {updateStatus.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Apply'}
                </Button>
              </div>
              <Button variant="ghost" size="sm" className="ml-auto gap-1" onClick={() => setSelectedIds(new Set())}>
                <X className="w-3.5 h-3.5" />Clear
              </Button>
            </div>
          )}
          <TableToolbar
            search=""
            onSearchChange={() => {}}
            hideSearch
            hint="Sorting applies to the current page of results."
            sortOptions={[
              { value: 'created_at', label: 'Date' },
              { value: 'order_number', label: 'Order #' },
              { value: 'customer', label: 'Customer' },
              { value: 'total', label: 'Total' },
              { value: 'status', label: 'Status' },
              { value: 'source', label: 'Source' },
              { value: 'item_count', label: 'Items' },
            ]}
            sortKey={sortKey}
            sortDir={sortDir}
            onSortKeyChange={setSortKey}
            onSortDirChange={setSortDir}
          />
          <ResizableTable tableId="orders" defaultWidths={[40, 130, 150, 80, 90, 90, 100, 100, 80]}>
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-input accent-primary"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-muted-foreground"><TableColumnLabel>Order</TableColumnLabel></th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-muted-foreground"><TableColumnLabel>Customer</TableColumnLabel></th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-muted-foreground"><TableColumnLabel>Items</TableColumnLabel></th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-muted-foreground"><TableColumnLabel>Total</TableColumnLabel></th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-muted-foreground"><TableColumnLabel>Source</TableColumnLabel></th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-muted-foreground"><TableColumnLabel>Status</TableColumnLabel></th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-muted-foreground"><TableColumnLabel>Date</TableColumnLabel></th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase text-muted-foreground"><TableColumnLabel>Action</TableColumnLabel></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr><td colSpan={9} className="px-6 py-12 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></td></tr>
              ) : !data?.items?.length ? (
                <tr><td colSpan={9} className="px-6 py-12 text-center text-sm text-muted-foreground">No orders found</td></tr>
              ) : displayOrders.map((order) => {
                const src = order.source || 'online'
                return (
                <tr key={order.id} className="cursor-pointer transition-colors hover:bg-muted/40" onClick={onClickableTableRow(() => {
                    if (order.source === 'booking') {
                      const bookingId = (order.items?.[0] as unknown as Record<string, unknown>)?.booking_id as string | undefined
                      if (bookingId) { navigate(`/bookings/${bookingId}`); return }
                    }
                    navigate(`/orders/${order.id}`)
                  })}>
                  <td className="w-10 px-4 py-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(order.id)}
                      onChange={() => toggleRow(order.id)}
                      className="h-4 w-4 rounded border-input accent-primary"
                    />
                  </td>
                  <td className="px-6 py-4">
                    {order.source === 'booking' && (order.items?.[0] as unknown as Record<string, unknown>)?.booking_number ? (
                      <p className="font-mono text-sm font-medium text-primary">
                        {(order.items[0] as unknown as Record<string, unknown>).booking_number as string}
                      </p>
                    ) : (
                      <p className="text-sm font-medium text-foreground">{order.order_number}</p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-foreground">{order.customer_name || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">{order.customer_email || ''}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{order.item_count} items</td>
                  <td className="px-6 py-4 text-sm font-medium text-foreground">{formatCurrency(order.total)}</td>
                  <td className="px-6 py-4">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium uppercase ${SOURCE_BADGE[src] || 'bg-muted text-muted-foreground'}`}>{src}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusStyle[order.status] || 'bg-muted text-muted-foreground'}`}>{statusLabel[order.status] || order.status}</span>
                      <OrderReservationBadge orderId={order.id} />
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{formatDate(order.created_at)}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Material Requirement Plan"
                        onClick={() => {
                          const mrpItems: MRPItem[] = (order.items || [])
                            .filter((i: unknown) => (i as Record<string, unknown>).product_id)
                            .map((i: unknown) => {
                              const item = i as Record<string, unknown>
                              return { product_id: item.product_id as string, qty: Number(item.quantity || item.qty || 1), name: item.name as string }
                            })
                          setMrpOrder({ id: order.id, order_number: order.order_number, items: mrpItems })
                        }}
                        className={TABLE_ICON_BTN}
                      >
                        <BarChart3 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" className={TABLE_ICON_BTN}><Eye className="h-4 w-4" /></Button>
                    </div>
                  </td>
                </tr>
                )
              })}
            </tbody>
          </ResizableTable>

          {data && data.pages > 1 && (
            <div className="flex items-center justify-between border-t border-border bg-muted/25 px-6 py-4">
              <p className="text-sm text-muted-foreground">Page {data.page} of {data.pages}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="w-4 h-4 mr-1" />Prev</Button>
                <Button variant="outline" size="sm" disabled={page >= data.pages} onClick={() => setPage(p => p + 1)}>Next<ChevronRight className="w-4 h-4 ml-1" /></Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* MRP Report Modal */}
      {mrpOrder && (
        <MRPReportModal
          orderId={mrpOrder.id}
          orderType="sales_order"
          orderRef={mrpOrder.order_number}
          items={mrpOrder.items}
          onClose={() => setMrpOrder(null)}
        />
      )}

      {showCreateBooking && (
        <CreateBookingModal
          onClose={() => setShowCreateBooking(false)}
          onCreated={(bookingId) => {
            setShowCreateBooking(false)
            navigate(`/bookings/${bookingId}`)
          }}
        />
      )}
    </div>
  )
}

// ── OrderReservationBadge ─────────────────────────────────────────────────────

function OrderReservationBadge({ orderId }: { orderId: string }) {
  const { data } = useOrderReservations('sales_order', orderId)
  const active = ((data || []) as Array<{ status: string }>).filter(r => r.status === 'active')
  if (active.length === 0) return null
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
      <Lock className="w-2.5 h-2.5" /> Reserved
    </span>
  )
}
