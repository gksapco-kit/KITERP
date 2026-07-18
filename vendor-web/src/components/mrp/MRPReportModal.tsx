import { useState, useEffect } from 'react'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { createPortal } from 'react-dom'
import {
  X, Loader2, CheckCircle, AlertTriangle, XCircle, Lock,
  Unlock, BarChart3, RefreshCw, Package, ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  useCalculateMRP, useOrderReservations, useCreateReservations, useReleaseAllReservations,
} from '@/hooks/useVendor'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MRPItem {
  product_id: string
  qty: number
  name?: string
}

interface MRPLine {
  component_id: string
  component_name: string
  component_sku: string | null
  component_uom: string | null
  required_qty: number
  in_stock: number
  reserved_by_others: number
  already_reserved_for_order: number
  available: number
  shortage: number
  status: 'ok' | 'partial' | 'short' | 'no_bom'
  source_items: string[]
}

interface ReservationRecord {
  id: string
  product_id: string
  product_name: string | null
  reserved_qty: number
  status: string
  order_type: string
  order_id: string
}

interface MRPReportModalProps {
  orderId: string
  orderType: 'production_order' | 'sales_order'
  orderRef?: string
  items: MRPItem[]
  onClose: () => void
  /** Business unit to check/reserve stock against — StoreInventory is the
   * source of truth once a store is known; omit to fall back to the global
   * Product.quantity rollup. */
  storeId?: string | null
  /** True once the order has passed 'confirmed' — materials are then
   * auto-reserved/consumed by the backend on status transitions, so manual
   * reserve/release here is disabled to avoid double-booking; the modal
   * still works as a live availability check. */
  autoManaged?: boolean
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_CFG = {
  ok: {
    label: 'In Stock',
    badge: 'bg-green-500/15 text-green-800 dark:text-green-300',
    icon: CheckCircle,
    dot: 'bg-green-500',
  },
  partial: {
    label: 'Partial',
    badge: 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
    icon: AlertTriangle,
    dot: 'bg-amber-500',
  },
  short: {
    label: 'Short',
    badge: 'bg-red-500/15 text-red-800 dark:text-red-300',
    icon: XCircle,
    dot: 'bg-red-500',
  },
  no_bom: {
    label: 'No BOM',
    badge: 'bg-muted text-muted-foreground',
    icon: Package,
    dot: 'bg-muted-foreground/50',
  },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status as keyof typeof STATUS_CFG] ?? STATUS_CFG.no_bom
  const Icon = cfg.icon
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', cfg.badge)}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  )
}

function fmt(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(4).replace(/\.?0+$/, '')
}

// ── Main component ─────────────────────────────────────────────────────────────

export function MRPReportModal({
 orderId, orderType, orderRef, items, onClose, storeId, autoManaged }: MRPReportModalProps) {
  useEscapeToClose(onClose)

  const calculateMRP = useCalculateMRP()
  const { data: reservationsRaw, refetch: refetchReservations } = useOrderReservations(orderType, orderId)
  const createReservations = useCreateReservations()
  const releaseAll = useReleaseAllReservations()

  const [lines, setLines] = useState<MRPLine[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const reservations = (reservationsRaw || []) as unknown as ReservationRecord[]
  const activeReservations = reservations.filter(r => r.status === 'active')
  const hasReservations = activeReservations.length > 0

  const runMRP = async () => {
    const result = await calculateMRP.mutateAsync({
      items: items.map(i => ({ product_id: i.product_id, qty: i.qty, name: i.name })),
      order_type: orderType,
      order_id: orderId,
      store_id: storeId || undefined,
    })
    const mrpLines = result as unknown as MRPLine[]
    setLines(mrpLines)
    const reservable = new Set(
      mrpLines
        .filter(l => l.status !== 'no_bom' && l.available > 0)
        .map(l => l.component_id)
    )
    setSelected(reservable)
  }

  useEffect(() => {
    if (items.length > 0) { runMRP() }
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSelect = (id: string) => {
    setSelected(s => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  const toggleExpand = (id: string) => {
    setExpanded(s => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  const handleReserve = async () => {
    const toReserve = lines
      .filter(l => selected.has(l.component_id) && l.available > 0)
      .map(l => ({
        product_id: l.component_id,
        reserved_qty: Math.min(l.available, l.required_qty - l.already_reserved_for_order),
        notes: `Reserved for ${orderType === 'production_order' ? 'Production' : 'Sales'} Order ${orderRef || orderId}`,
      }))

    if (toReserve.length === 0) return

    await createReservations.mutateAsync({
      order_type: orderType,
      order_id: orderId,
      store_id: storeId || undefined,
      items: toReserve,
    })
    await refetchReservations()
    await runMRP()
  }

  const handleReleaseAll = async () => {
    await releaseAll.mutateAsync({ order_type: orderType, order_id: orderId })
    await refetchReservations()
    await runMRP()
  }

  const isBusy = calculateMRP.isPending || createReservations.isPending || releaseAll.isPending

  const summary = {
    ok:      lines.filter(l => l.status === 'ok').length,
    partial: lines.filter(l => l.status === 'partial').length,
    short:   lines.filter(l => l.status === 'short').length,
    no_bom:  lines.filter(l => l.status === 'no_bom').length,
  }

  const modal = (
    <div data-kiterp-modal className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 overflow-y-auto" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-muted/30 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <BarChart3 className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Material Requirement Plan</h2>
              <p className="text-xs text-muted-foreground">
                {orderType === 'production_order' ? 'Production Order' : 'Sales Order'}
                {orderRef ? ` · ${orderRef}` : ''} · {items.length} item{items.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={runMRP}
              disabled={isBusy}
              className="gap-1.5"
            >
              {calculateMRP.isPending
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <RefreshCw className="w-3.5 h-3.5" />
              }
              Recalculate
            </Button>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Auto-managed notice */}
        {autoManaged && (
          <div className="flex items-center gap-2 border-b border-primary/20 bg-primary/5 px-6 py-2.5">
            <Lock className="h-4 w-4 text-primary" />
            <span className="text-sm text-foreground">
              Materials for this order are reserved and consumed automatically as it moves through confirmed → completed.
              This view is read-only.
            </span>
          </div>
        )}

        {/* Active reservations strip */}
        {hasReservations && (
          <div className="flex items-center justify-between gap-3 border-b border-green-500/25 bg-green-500/10 px-6 py-2.5">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className="text-sm font-medium text-green-800 dark:text-green-300">
                {activeReservations.length} material{activeReservations.length !== 1 ? 's' : ''} reserved for this order
              </span>
            </div>
            {!autoManaged && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleReleaseAll}
                disabled={isBusy}
                className="gap-1.5 border-green-500/35 text-green-700 hover:bg-green-500/15 hover:text-green-800 dark:text-green-300 dark:hover:bg-green-500/20 dark:hover:text-green-200"
              >
                {releaseAll.isPending
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Unlock className="w-3.5 h-3.5" />
                }
                Release All
              </Button>
            )}
          </div>
        )}

        {/* Summary pills */}
        {lines.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-b border-border px-6 py-3">
            {summary.ok > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2.5 py-1 text-xs font-medium text-green-800 dark:text-green-300">
                <CheckCircle className="h-3 w-3" /> {summary.ok} In Stock
              </span>
            )}
            {summary.partial > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-800 dark:text-amber-300">
                <AlertTriangle className="h-3 w-3" /> {summary.partial} Partial
              </span>
            )}
            {summary.short > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-1 text-xs font-medium text-red-800 dark:text-red-300">
                <XCircle className="h-3 w-3" /> {summary.short} Short
              </span>
            )}
            {summary.no_bom > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                <Package className="h-3 w-3" /> {summary.no_bom} No BOM
              </span>
            )}
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {calculateMRP.isPending && lines.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">Calculating material requirements…</p>
            </div>
          ) : lines.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
              <Package className="h-10 w-10 opacity-50" />
              <p className="text-sm font-medium text-foreground">No materials found</p>
              <p className="text-xs">Make sure the order has items and products have BOMs defined</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="w-8 px-4 py-3">
                    {!autoManaged && (
                      <input
                        type="checkbox"
                        checked={selected.size > 0 && lines.filter(l => l.available > 0).every(l => selected.has(l.component_id))}
                        onChange={() => {
                          const reservable = lines.filter(l => l.available > 0).map(l => l.component_id)
                          setSelected(s => s.size === reservable.length ? new Set() : new Set(reservable))
                        }}
                        className="rounded border-input"
                      />
                    )}
                  </th>
                  <th className="px-4 py-3 text-left font-semibold"><TableColumnLabel>Material</TableColumnLabel></th>
                  <th className="px-4 py-3 text-right font-semibold"><TableColumnLabel>Required</TableColumnLabel></th>
                  <th className="px-4 py-3 text-right font-semibold"><TableColumnLabel>In Stock</TableColumnLabel></th>
                  <th className="px-4 py-3 text-right font-semibold"><TableColumnLabel>Reserved (Others)</TableColumnLabel></th>
                  <th className="px-4 py-3 text-right font-semibold"><TableColumnLabel>This Order</TableColumnLabel></th>
                  <th className="px-4 py-3 text-right font-semibold"><TableColumnLabel>Available</TableColumnLabel></th>
                  <th className="px-4 py-3 text-center font-semibold"><TableColumnLabel>Status</TableColumnLabel></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lines.map(line => {
                  const isExpanded = expanded.has(line.component_id)
                  const alreadyReserved = activeReservations.some(r => r.product_id === line.component_id)
                  return (
                    <>
                      <tr
                        key={line.component_id}
                        className={cn(
                          'transition-colors hover:bg-muted/45',
                          line.status === 'short' && 'bg-red-500/5 dark:bg-red-500/10',
                        )}
                      >
                        <td className="px-4 py-3">
                          {!autoManaged && (
                            <input
                              type="checkbox"
                              checked={selected.has(line.component_id)}
                              onChange={() => toggleSelect(line.component_id)}
                              disabled={line.available <= 0}
                              className="rounded border-input"
                            />
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className={cn('h-2 w-2 shrink-0 rounded-full', STATUS_CFG[line.status as keyof typeof STATUS_CFG]?.dot ?? 'bg-muted-foreground/50')} />
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium text-foreground">{line.component_name}</span>
                                {alreadyReserved && (
                                  <span title="Already reserved for this order">
                                    <Lock className="h-3 w-3 text-green-600 dark:text-green-400" />
                                  </span>
                                )}
                              </div>
                              {line.component_sku && <span className="text-xs text-muted-foreground">SKU: {line.component_sku}</span>}
                            </div>
                            {line.source_items.length > 0 && (
                              <button
                                type="button"
                                onClick={() => toggleExpand(line.component_id)}
                                className="ml-auto text-muted-foreground transition-colors hover:text-foreground"
                              >
                                <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', isExpanded && 'rotate-180')} />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm text-foreground">
                          {fmt(line.required_qty)}
                          {line.component_uom && <span className="ml-1 text-xs text-muted-foreground">{line.component_uom}</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm text-foreground">{fmt(line.in_stock)}</td>
                        <td className="px-4 py-3 text-right font-mono text-sm text-orange-600 dark:text-orange-400">
                          {line.reserved_by_others > 0 ? `−${fmt(line.reserved_by_others)}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm text-green-700 dark:text-green-400">
                          {line.already_reserved_for_order > 0 ? fmt(line.already_reserved_for_order) : '—'}
                        </td>
                        <td className={cn(
                          'px-4 py-3 text-right font-mono text-sm font-semibold',
                          line.available >= line.required_qty ? 'text-green-700 dark:text-green-400' :
                          line.available > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-red-700 dark:text-red-400',
                        )}>
                          {fmt(line.available)}
                          {line.shortage > 0 && (
                            <div className="text-xs font-normal text-red-600 dark:text-red-400">short {fmt(line.shortage)}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <StatusBadge status={line.status} />
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${line.component_id}-expanded`} className="bg-primary/5 dark:bg-primary/10">
                          <td />
                          <td colSpan={7} className="px-6 py-2 text-xs text-muted-foreground">
                            <span className="font-medium text-primary">Used in: </span>
                            {line.source_items.join(', ')}
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/25 px-6 py-4">
          <div className="text-xs text-muted-foreground">
            {selected.size > 0 && `${selected.size} material${selected.size !== 1 ? 's' : ''} selected for reservation`}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
            {!autoManaged && (
              <Button
                size="sm"
                onClick={handleReserve}
                disabled={isBusy || selected.size === 0 || lines.length === 0}
                className="gap-1.5"
              >
                {createReservations.isPending
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Lock className="w-3.5 h-3.5" />
                }
                Reserve Selected ({selected.size})
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
