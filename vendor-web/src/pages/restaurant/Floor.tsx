import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import {
  UtensilsCrossed, Settings, ChefHat, Loader2, Users, CheckCircle2,
  AlertCircle, Sparkles, Calendar, BarChart3, X, RefreshCw,
} from 'lucide-react'
import { vendorApi } from '@/api/vendor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type TableStatus = 'free' | 'seated' | 'ordering' | 'billed' | 'dirty'

const STATUS_CONFIG: Record<TableStatus, { label: string; className: string; dot: string }> = {
  free:     { label: 'Free',        className: 'border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100', dot: 'bg-emerald-500' },
  seated:   { label: 'Seated',      className: 'border-blue-200 bg-blue-50/60 hover:bg-blue-100',          dot: 'bg-blue-500' },
  ordering: { label: 'Ordering',    className: 'border-amber-200 bg-amber-50/60 hover:bg-amber-100',       dot: 'bg-amber-500' },
  billed:   { label: 'Billed',      className: 'border-red-200 bg-red-50/60 hover:bg-red-100',             dot: 'bg-red-500' },
  dirty:    { label: 'Needs clear', className: 'border-gray-200 bg-gray-50/60 hover:bg-gray-100',          dot: 'bg-gray-400' },
}

/** Small modal to capture covers + optional server name before seating a table */
function SeatTableDialog({
  tableLabel,
  onConfirm,
  onCancel,
  loading,
}: {
  tableLabel: string
  onConfirm: (covers: number, serverName: string) => void
  onCancel: () => void
  loading: boolean
}) {
  const [covers, setCovers] = useState(2)
  const [serverName, setServerName] = useState('')
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-xs p-6 space-y-5"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-gray-900 text-lg">Seat Table {tableLabel}</h2>
          <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">
              Covers (guests)
            </label>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5, 6, 8, 10].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCovers(n)}
                  className={cn(
                    'w-10 h-10 rounded-xl border text-sm font-bold transition-colors',
                    covers === n
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-amber-300',
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">
              Server / waiter (optional)
            </label>
            <Input
              value={serverName}
              onChange={e => setServerName(e.target.value)}
              placeholder="Server name"
              className="h-9 text-sm"
            />
          </div>
        </div>

        <Button
          className="w-full gap-2"
          disabled={loading}
          onClick={() => onConfirm(covers, serverName.trim())}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UtensilsCrossed className="w-4 h-4" />}
          Seat table
        </Button>
      </div>
    </div>
  )
}

export default function RestaurantFloorPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [seatDialog, setSeatDialog] = useState<{ tableId: string; tableLabel: string } | null>(null)

  const tablesQ = useQuery({
    queryKey: ['restaurant', 'tables'],
    queryFn: () => vendorApi.restaurantListTables(),
    refetchInterval: 15_000,
  })

  const ordersQ = useQuery({
    queryKey: ['restaurant', 'orders', 'open'],
    queryFn: () => vendorApi.restaurantListOrders({ status: undefined }),
    refetchInterval: 15_000,
  })

  const createOrder = useMutation({
    mutationFn: ({ tableId, covers, serverName }: { tableId: string; covers: number; serverName: string }) =>
      vendorApi.restaurantCreateOrder({
        table_id: tableId,
        covers,
        server_name: serverName || undefined,
      }),
    onSuccess: (order) => {
      qc.invalidateQueries({ queryKey: ['restaurant'] })
      setSeatDialog(null)
      navigate(`/restaurant/order/${order.id}`)
    },
    onError: () => {
      setSeatDialog(null)
      toast.error('Could not seat table')
    },
  })

  const clearTable = useMutation({
    mutationFn: (tableId: string) => vendorApi.restaurantSetTableStatus(tableId, 'free'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['restaurant', 'tables'] })
      toast.success('Table cleared')
    },
    onError: () => toast.error('Could not clear table'),
  })

  const tables = (tablesQ.data?.items ?? []).filter(t => t.is_active !== false)
  const openOrders = ordersQ.data?.items ?? []

  const tableOrderMap = new Map(openOrders.map(o => [o.table_id ?? '', o.id]))

  function handleTableClick(table: (typeof tables)[0]) {
    const status = (table.status as TableStatus) || 'free'
    const orderId = tableOrderMap.get(table.id)

    if (orderId) {
      navigate(`/restaurant/order/${orderId}`)
      return
    }
    if (status === 'dirty') {
      clearTable.mutate(table.id)
      return
    }
    if (status === 'free') {
      setSeatDialog({ tableId: table.id, tableLabel: table.label })
      return
    }
    navigate(`/pos?table=${encodeURIComponent(table.id)}`)
  }

  function handleRefresh() {
    qc.invalidateQueries({ queryKey: ['restaurant', 'tables'] })
    qc.invalidateQueries({ queryKey: ['restaurant', 'orders'] })
  }

  const groupedByZone = tables.reduce<Record<string, typeof tables>>((acc, t) => {
    const zone = t.zone_name || '—'
    ;(acc[zone] ??= []).push(t)
    return acc
  }, {})

  const isLoading = tablesQ.isLoading

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Seat dialog */}
      {seatDialog && (
        <SeatTableDialog
          tableLabel={seatDialog.tableLabel}
          loading={createOrder.isPending}
          onConfirm={(covers, serverName) =>
            createOrder.mutate({ tableId: seatDialog.tableId, covers, serverName })
          }
          onCancel={() => setSeatDialog(null)}
        />
      )}

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <UtensilsCrossed className="w-6 h-6 text-amber-600" /> Restaurant Floor
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Tap a free table to seat guests · tap an occupied table to manage the order.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} title="Refresh floor">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/restaurant/kitchen" className="gap-1"><ChefHat className="w-4 h-4" /> Kitchen</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/restaurant/reservations" className="gap-1"><Calendar className="w-4 h-4" /> Reservations</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/restaurant/reports" className="gap-1"><BarChart3 className="w-4 h-4" /> Reports</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/restaurant/setup" className="gap-1"><Settings className="w-4 h-4" /> Setup</Link>
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-gray-600">
        {(Object.entries(STATUS_CONFIG) as [TableStatus, typeof STATUS_CONFIG[TableStatus]][]).map(([key, cfg]) => (
          <span key={key} className="flex items-center gap-1.5">
            <span className={cn('w-2 h-2 rounded-full', cfg.dot)} />
            {cfg.label}
          </span>
        ))}
      </div>

      {isLoading && (
        <div className="flex justify-center py-16 text-gray-400"><Loader2 className="w-8 h-8 animate-spin" /></div>
      )}
      {tablesQ.isError && (
        <p className="text-sm text-red-600">Could not load tables. Configure zones and tables first.</p>
      )}
      {!isLoading && !tables.length && (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-gray-500 text-sm">
          No tables yet.&nbsp;
          <Link to="/restaurant/setup" className="text-primary font-medium hover:underline">Add tables in Setup</Link>
        </div>
      )}

      {Object.entries(groupedByZone).map(([zone, zoneTables]) => (
        <section key={zone} className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">{zone}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {zoneTables.map(t => {
              const status = (t.status as TableStatus) || 'free'
              const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.free
              const orderId = tableOrderMap.get(t.id)
              const isClearing = clearTable.isPending

              return (
                <button
                  key={t.id}
                  type="button"
                  disabled={isClearing}
                  onClick={() => handleTableClick(t)}
                  className={cn(
                    'rounded-xl border p-4 text-left shadow-sm transition-colors relative',
                    cfg.className,
                    isClearing && 'opacity-60 cursor-wait',
                  )}
                >
                  <span className={cn('absolute top-3 right-3 w-2.5 h-2.5 rounded-full', cfg.dot)} />

                  <p className="text-xs font-medium uppercase tracking-wide text-gray-400 pr-4">
                    {t.zone_name || 'Floor'}
                  </p>
                  <p className="text-lg font-bold text-gray-900 mt-1">{t.label}</p>

                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Users className="w-3 h-3" /> {t.capacity} seats
                    </span>
                    <span className={cn('text-xs font-semibold', {
                      'text-emerald-600': status === 'free',
                      'text-blue-600': status === 'seated',
                      'text-amber-700': status === 'ordering',
                      'text-red-600': status === 'billed',
                      'text-gray-500': status === 'dirty',
                    })}>
                      {cfg.label}
                    </span>
                  </div>

                  {orderId && (
                    <div className="mt-2 pt-2 border-t border-current/10 text-xs text-gray-500 flex items-center gap-1">
                      {status === 'billed'
                        ? <><AlertCircle className="w-3 h-3 text-red-500" /> Bill requested</>
                        : <><Sparkles className="w-3 h-3 text-amber-500" /> Open order</>
                      }
                    </div>
                  )}
                  {status === 'dirty' && !orderId && (
                    <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Tap to mark free
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
