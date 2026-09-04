import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { vendorApi } from '@/api/vendor'
import { apiError } from '@/lib/errorMessages'
import { askConfirm } from '@/components/common/ConfirmProvider'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Lock, Loader2, RefreshCw, Unlock, Package,
  ShoppingCart, Factory, AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useStores } from '@/hooks/useVendor'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReservationRecord {
  id: string
  vendor_id: string
  order_type: string
  order_id: string
  store_id: string | null
  storage_location_id: string | null
  product_id: string
  product_name?: string | null
  variant_id: string | null
  reserved_qty: number
  status: 'active' | 'released' | 'consumed'
  notes: string | null
  created_at: string
  released_at: string | null
  consumed_at: string | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  active: { label: 'Active', variant: 'default' },
  released: { label: 'Released', variant: 'secondary' },
  consumed: { label: 'Consumed', variant: 'outline' },
}

const ORDER_TYPE_ICON: Record<string, React.ElementType> = {
  sales_order: ShoppingCart,
  production_order: Factory,
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'released', label: 'Released' },
  { value: 'consumed', label: 'Consumed' },
]

const ORDER_TYPE_OPTIONS = [
  { value: '', label: 'All Order Types' },
  { value: 'sales_order', label: 'Sales Order' },
  { value: 'production_order', label: 'Production Order' },
]

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtOrderType(t: string) {
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

// ── Summary cards ─────────────────────────────────────────────────────────────

function StatCard({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn('text-2xl font-bold', warn && value > 0 ? 'text-amber-600' : '')}>{value}</p>
      </CardContent>
    </Card>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ReservationsPage() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('active')
  const [orderTypeFilter, setOrderTypeFilter] = useState('')
  const [search, setSearch] = useState('')

  const { data: storesData } = useStores()
  const storeMap = useMemo(() => {
    const m: Record<string, string> = {}
    ;(storesData?.stores ?? []).forEach((s: { id: string; name: string }) => { m[s.id] = s.name })
    return m
  }, [storesData])

  const { data, isLoading, refetch } = useQuery<ReservationRecord[]>({
    queryKey: ['vendor', 'stock-reservations', statusFilter, orderTypeFilter],
    queryFn: () => vendorApi.listReservations({
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(orderTypeFilter ? { order_type: orderTypeFilter } : {}),
    }),
    staleTime: 30 * 1000,
  })

  const items: ReservationRecord[] = Array.isArray(data) ? data : []

  const filtered = useMemo(() => {
    if (!search.trim()) return items
    const q = search.toLowerCase()
    return items.filter((r) =>
      (r.product_name ?? '').toLowerCase().includes(q) ||
      r.order_id.toLowerCase().includes(q) ||
      r.order_type.toLowerCase().includes(q),
    )
  }, [items, search])

  const activeCount = items.filter((r) => r.status === 'active').length
  const releasedCount = items.filter((r) => r.status === 'released').length
  const totalReservedQty = items
    .filter((r) => r.status === 'active')
    .reduce((s, r) => s + Number(r.reserved_qty), 0)

  const releaseOne = useMutation({
    mutationFn: (id: string) => vendorApi.releaseReservation(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor', 'stock-reservations'] })
      toast.success('Reservation released')
    },
    onError: apiError('Release reservation'),
  })

  async function handleRelease(r: ReservationRecord) {
    const name = r.product_name ?? r.product_id.slice(0, 8)
    const confirmed = await askConfirm(
      `Release reservation for "${name}" (${Number(r.reserved_qty)} units)? The held quantity will be freed for other orders.`
    )
    if (confirmed) releaseOne.mutate(r.id)
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Lock className="h-6 w-6" />
            Inventory Reservations
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            View and manage stock holds for sales orders, production, and manual reservations
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard label="Active Reservations" value={activeCount} warn />
        <StatCard label="Total Reserved Qty" value={totalReservedQty} />
        <StatCard label="Released (this view)" value={releasedCount} />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Select
          value={statusFilter}
          onChange={setStatusFilter}
          options={STATUS_OPTIONS}
          className="w-36"
        />
        <Select
          value={orderTypeFilter}
          onChange={setOrderTypeFilter}
          options={ORDER_TYPE_OPTIONS}
          className="w-44"
        />
        <Input
          placeholder="Search product, order ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-56 text-sm"
        />
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">
            Reservations
            {filtered.length > 0 && (
              <span className="ml-2 font-normal text-muted-foreground">({filtered.length})</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-14 gap-2 text-center">
              <Lock className="h-10 w-10 text-muted-foreground opacity-30" />
              <p className="font-medium text-muted-foreground">No reservations found</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                Stock reservations are created automatically when sales orders or production orders are placed.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="py-2 px-3 text-left font-medium text-muted-foreground text-xs">Product</th>
                    <th className="py-2 px-3 text-left font-medium text-muted-foreground text-xs">Order</th>
                    <th className="py-2 px-3 text-center font-medium text-muted-foreground text-xs">Reserved Qty</th>
                    <th className="py-2 px-3 text-left font-medium text-muted-foreground text-xs">Location</th>
                    <th className="py-2 px-3 text-center font-medium text-muted-foreground text-xs">Status</th>
                    <th className="py-2 px-3 text-center font-medium text-muted-foreground text-xs">Created</th>
                    <th className="py-2 px-3 text-right font-medium text-muted-foreground text-xs w-28">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const TypeIcon = ORDER_TYPE_ICON[r.order_type] ?? Package
                    const statusCfg = STATUS_CFG[r.status] ?? STATUS_CFG.active
                    return (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="py-2 px-3">
                          <div className="font-medium">{r.product_name ?? r.product_id.slice(0, 8)}</div>
                          {r.variant_id && <div className="text-xs text-muted-foreground">Variant</div>}
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1.5">
                            <TypeIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <div>
                              <div className="text-xs font-medium">{fmtOrderType(r.order_type)}</div>
                              <div
                                className="text-xs text-muted-foreground font-mono truncate max-w-[120px]"
                                title={r.order_id}
                              >
                                {r.order_id.length > 16 ? r.order_id.slice(0, 8) + '…' : r.order_id}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-center font-mono font-semibold text-sm">
                          {Number(r.reserved_qty)}
                        </td>
                        <td className="py-2 px-3 text-xs text-muted-foreground">
                          {r.store_id && storeMap[r.store_id] ? storeMap[r.store_id] : '—'}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <Badge variant={statusCfg.variant} className="text-xs capitalize">
                            {statusCfg.label}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-center text-xs text-muted-foreground">
                          {fmtDate(r.created_at)}
                        </td>
                        <td className="py-2 px-3 text-right">
                          {r.status === 'active' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs"
                              onClick={() => handleRelease(r)}
                              disabled={releaseOne.isPending}
                            >
                              <Unlock className="mr-1 h-3 w-3" />
                              Release
                            </Button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info callout */}
      <div className="flex items-start gap-2 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" />
        <span>
          Releasing a reservation frees up the held quantity for other orders. Reserved stock is automatically
          consumed when an order is fulfilled or a production order is completed.
        </span>
      </div>
    </div>
  )
}
