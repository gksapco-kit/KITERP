import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  X, Loader2, CheckCircle, AlertTriangle, XCircle, Lock,
  Unlock, BarChart3, RefreshCw, Package, ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
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
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_CFG = {
  ok:     { label: 'In Stock',  bg: 'bg-green-100',  text: 'text-green-700',  icon: CheckCircle,     dot: 'bg-green-500' },
  partial:{ label: 'Partial',   bg: 'bg-amber-100',  text: 'text-amber-700',  icon: AlertTriangle,   dot: 'bg-amber-500' },
  short:  { label: 'Short',     bg: 'bg-red-100',    text: 'text-red-700',    icon: XCircle,         dot: 'bg-red-500' },
  no_bom: { label: 'No BOM',    bg: 'bg-gray-100',   text: 'text-gray-500',   icon: Package,         dot: 'bg-gray-400' },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status as keyof typeof STATUS_CFG] ?? STATUS_CFG.no_bom
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  )
}

function fmt(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(4).replace(/\.?0+$/, '')
}

// ── Main component ─────────────────────────────────────────────────────────────

export function MRPReportModal({ orderId, orderType, orderRef, items, onClose }: MRPReportModalProps) {
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
    })
    const mrpLines = result as unknown as MRPLine[]
    setLines(mrpLines)
    // Auto-select lines that are ok or partial (can be reserved)
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

  // Aggregate summary
  const summary = {
    ok:      lines.filter(l => l.status === 'ok').length,
    partial: lines.filter(l => l.status === 'partial').length,
    short:   lines.filter(l => l.status === 'short').length,
    no_bom:  lines.filter(l => l.status === 'no_bom').length,
  }

  const modal = (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-indigo-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Material Requirement Plan</h2>
              <p className="text-xs text-gray-500">
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
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Active reservations strip */}
        {hasReservations && (
          <div className="px-6 py-2.5 bg-green-50 border-b border-green-100 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-green-600" />
              <span className="text-sm text-green-800 font-medium">
                {activeReservations.length} material{activeReservations.length !== 1 ? 's' : ''} reserved for this order
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleReleaseAll}
              disabled={isBusy}
              className="gap-1.5 border-green-300 text-green-700 hover:bg-green-100 hover:text-green-900"
            >
              {releaseAll.isPending
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Unlock className="w-3.5 h-3.5" />
              }
              Release All
            </Button>
          </div>
        )}

        {/* Summary pills */}
        {lines.length > 0 && (
          <div className="px-6 py-3 border-b flex items-center gap-3 flex-wrap">
            {summary.ok > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                <CheckCircle className="w-3 h-3" /> {summary.ok} In Stock
              </span>
            )}
            {summary.partial > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                <AlertTriangle className="w-3 h-3" /> {summary.partial} Partial
              </span>
            )}
            {summary.short > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                <XCircle className="w-3 h-3" /> {summary.short} Short
              </span>
            )}
            {summary.no_bom > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                <Package className="w-3 h-3" /> {summary.no_bom} No BOM
              </span>
            )}
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {calculateMRP.isPending && lines.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
              <Loader2 className="w-8 h-8 animate-spin" />
              <p className="text-sm">Calculating material requirements…</p>
            </div>
          ) : lines.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
              <Package className="w-10 h-10" />
              <p className="text-sm font-medium">No materials found</p>
              <p className="text-xs text-gray-400">Make sure the order has items and products have BOMs defined</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0 z-10 text-xs text-gray-500 uppercase tracking-wide border-b">
                <tr>
                  <th className="px-4 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={selected.size > 0 && lines.filter(l => l.available > 0).every(l => selected.has(l.component_id))}
                      onChange={() => {
                        const reservable = lines.filter(l => l.available > 0).map(l => l.component_id)
                        setSelected(s => s.size === reservable.length ? new Set() : new Set(reservable))
                      }}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">Material</th>
                  <th className="px-4 py-3 text-right font-semibold">Required</th>
                  <th className="px-4 py-3 text-right font-semibold">In Stock</th>
                  <th className="px-4 py-3 text-right font-semibold">Reserved (Others)</th>
                  <th className="px-4 py-3 text-right font-semibold">This Order</th>
                  <th className="px-4 py-3 text-right font-semibold">Available</th>
                  <th className="px-4 py-3 text-center font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lines.map(line => {
                  const isExpanded = expanded.has(line.component_id)
                  const alreadyReserved = activeReservations.some(r => r.product_id === line.component_id)
                  return (
                    <>
                      <tr
                        key={line.component_id}
                        className={`hover:bg-gray-50 transition-colors ${line.status === 'short' ? 'bg-red-50/30' : ''}`}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selected.has(line.component_id)}
                            onChange={() => toggleSelect(line.component_id)}
                            disabled={line.available <= 0}
                            className="rounded border-gray-300"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full shrink-0 ${STATUS_CFG[line.status as keyof typeof STATUS_CFG]?.dot ?? 'bg-gray-400'}`} />
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium text-gray-900">{line.component_name}</span>
                                {alreadyReserved && (
                                  <span title="Already reserved for this order">
                                    <Lock className="w-3 h-3 text-green-600" />
                                  </span>
                                )}
                              </div>
                              {line.component_sku && <span className="text-[11px] text-gray-400">SKU: {line.component_sku}</span>}
                            </div>
                            {line.source_items.length > 0 && (
                              <button
                                type="button"
                                onClick={() => toggleExpand(line.component_id)}
                                className="ml-auto text-gray-400 hover:text-gray-600"
                              >
                                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm">
                          {fmt(line.required_qty)}
                          {line.component_uom && <span className="text-xs text-gray-400 ml-1">{line.component_uom}</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm text-gray-700">{fmt(line.in_stock)}</td>
                        <td className="px-4 py-3 text-right font-mono text-sm text-orange-600">
                          {line.reserved_by_others > 0 ? `−${fmt(line.reserved_by_others)}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm text-green-700">
                          {line.already_reserved_for_order > 0 ? fmt(line.already_reserved_for_order) : '—'}
                        </td>
                        <td className={`px-4 py-3 text-right font-mono text-sm font-semibold ${
                          line.available >= line.required_qty ? 'text-green-700' :
                          line.available > 0 ? 'text-amber-700' : 'text-red-700'
                        }`}>
                          {fmt(line.available)}
                          {line.shortage > 0 && (
                            <div className="text-[11px] text-red-500 font-normal">short {fmt(line.shortage)}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <StatusBadge status={line.status} />
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${line.component_id}-expanded`} className="bg-indigo-50/40">
                          <td />
                          <td colSpan={7} className="px-6 py-2 text-xs text-gray-500">
                            <span className="font-medium text-indigo-700">Used in: </span>
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
        <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between gap-3">
          <div className="text-xs text-gray-400">
            {selected.size > 0 && `${selected.size} material${selected.size !== 1 ? 's' : ''} selected for reservation`}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
            <Button
              size="sm"
              onClick={handleReserve}
              disabled={isBusy || selected.size === 0 || lines.length === 0}
              className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {createReservations.isPending
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Lock className="w-3.5 h-3.5" />
              }
              Reserve Selected ({selected.size})
            </Button>
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
