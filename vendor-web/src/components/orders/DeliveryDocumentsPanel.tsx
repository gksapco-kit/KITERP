/**
 * DeliveryDocumentsPanel — Phase-4
 *
 * Displays outbound delivery documents on the order detail page.
 * Allows creating a new delivery and posting goods issue.
 */
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Truck, Plus, CheckCircle2, Clock, PackageCheck,
  ChevronDown, ChevronUp, Loader2, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { cn, formatDate } from '@/lib/utils'
import { vendorApi } from '@/api/vendor'
import type { Order, OrderDelivery, OrderLine } from '@/types'

interface Props {
  order: Order
  isTerminal: boolean
}

// ── status helpers ────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  draft:        'bg-muted text-muted-foreground',
  picking:      'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  packed:       'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  goods_issued: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  cancelled:    'bg-destructive/10 text-destructive',
}
const STATUS_LABEL: Record<string, string> = {
  draft:        'Draft',
  picking:      'Picking',
  packed:       'Packed',
  goods_issued: 'Goods Issued',
  cancelled:    'Cancelled',
}

// ── Create delivery modal ─────────────────────────────────────────────────────

interface CreateDeliveryModalProps {
  order: Order
  onClose: () => void
  onCreated: () => void
}

function CreateDeliveryModal({ order, onClose, onCreated }: CreateDeliveryModalProps) {
  const lines = order.order_lines || []
  const [qtys, setQtys] = useState<Record<string, string>>(() =>
    Object.fromEntries(lines.map((l) => [l.id, String(l.ordered_qty - (l.shipped_qty || 0))]))
  )
  const [plannedDate, setPlannedDate] = useState('')
  const [carrier, setCarrier] = useState('')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [notes, setNotes] = useState('')

  const { mutate, isPending } = useMutation({
    mutationFn: () => {
      const items = lines
        .map((l) => ({ order_line_id: l.id, planned_qty: parseFloat(qtys[l.id] || '0') }))
        .filter((i) => i.planned_qty > 0)
      return vendorApi.createDelivery(order.id, {
        items,
        planned_gi_date: plannedDate || undefined,
        carrier: carrier || undefined,
        tracking_number: trackingNumber || undefined,
        notes: notes || undefined,
      })
    },
    onSuccess: () => {
      toast.success('Delivery created')
      onCreated()
      onClose()
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Could not create delivery'
      toast.error(msg)
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">Create Delivery</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {lines.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No order lines available yet.</p>
        ) : (
          <div className="space-y-2 mb-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Lines to deliver</p>
            {lines.map((l) => {
              const open = l.ordered_qty - (l.shipped_qty || 0)
              return (
                <div key={l.id} className="flex items-center gap-3">
                  <span className="flex-1 text-sm truncate">{l.product_name || `Line ${l.line_no}`}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">open: {open}</span>
                  <Input
                    type="number"
                    min={0}
                    max={open}
                    step="any"
                    value={qtys[l.id] ?? ''}
                    onChange={(e) => setQtys((prev) => ({ ...prev, [l.id]: e.target.value }))}
                    className="w-20 h-7 text-sm"
                  />
                </div>
              )
            })}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <Label className="text-xs">Planned GI Date</Label>
            <Input type="date" value={plannedDate} onChange={(e) => setPlannedDate(e.target.value)} className="h-8 text-sm mt-1" />
          </div>
          <div>
            <Label className="text-xs">Carrier</Label>
            <Input value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="e.g. FedEx" className="h-8 text-sm mt-1" />
          </div>
          <div>
            <Label className="text-xs">Tracking Number</Label>
            <Input value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} className="h-8 text-sm mt-1" />
          </div>
          <div>
            <Label className="text-xs">Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="h-8 text-sm mt-1" />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button size="sm" onClick={() => mutate()} disabled={isPending}>
            {isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Create
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Single delivery row ───────────────────────────────────────────────────────

function DeliveryRow({ delivery, orderId, isTerminal }: { delivery: OrderDelivery; orderId: string; isTerminal: boolean }) {
  const qc = useQueryClient()
  const [expanded, setExpanded] = useState(false)

  const { mutate: postGI, isPending: isPosting } = useMutation({
    mutationFn: () => vendorApi.postGoodsIssue(orderId, delivery.id),
    onSuccess: () => {
      toast.success('Goods issue posted')
      qc.invalidateQueries({ queryKey: ['order', orderId] })
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Could not post goods issue'
      toast.error(msg)
    },
  })

  const { mutate: cancel, isPending: isCancelling } = useMutation({
    mutationFn: () => vendorApi.cancelDelivery(orderId, delivery.id),
    onSuccess: () => {
      toast.success('Delivery cancelled')
      qc.invalidateQueries({ queryKey: ['order', orderId] })
    },
    onError: () => toast.error('Could not cancel delivery'),
  })

  const canGI = !isTerminal && delivery.status !== 'goods_issued' && delivery.status !== 'cancelled'
  const canCancel = !isTerminal && delivery.status !== 'goods_issued' && delivery.status !== 'cancelled'

  return (
    <div className="rounded-lg border border-border bg-background">
      {/* Header row */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <Truck className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="text-[13px] font-medium">{delivery.delivery_number}</span>
        <Badge className={cn('text-[10px] px-1.5 py-0 ml-0.5', STATUS_BADGE[delivery.status] || STATUS_BADGE.draft)}>
          {STATUS_LABEL[delivery.status] || delivery.status}
        </Badge>
        {delivery.planned_gi_date && (
          <span className="text-[11px] text-muted-foreground ml-1">
            Planned {formatDate(delivery.planned_gi_date)}
          </span>
        )}
        {delivery.actual_gi_date && (
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 ml-1">
            GI {formatDate(delivery.actual_gi_date)}
          </span>
        )}
        {delivery.carrier && (
          <span className="text-[11px] text-muted-foreground truncate">{delivery.carrier}</span>
        )}
        {delivery.tracking_number && (
          <span className="text-[11px] text-blue-600 dark:text-blue-400 truncate">{delivery.tracking_number}</span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          {canGI && (
            <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" onClick={() => postGI()} disabled={isPosting}>
              {isPosting ? <Loader2 className="h-3 w-3 animate-spin" /> : <PackageCheck className="h-3 w-3 mr-1" />}
              Post GI
            </Button>
          )}
          {canCancel && (
            <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px] text-destructive hover:text-destructive" onClick={() => cancel()} disabled={isCancelling}>
              Cancel
            </Button>
          )}
          <button onClick={() => setExpanded((v) => !v)} className="text-muted-foreground hover:text-foreground ml-1">
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Lines */}
      {expanded && (
        <div className="border-t border-border px-3 pb-2.5 pt-2 space-y-1">
          {delivery.lines.length === 0 ? (
            <p className="text-xs text-muted-foreground">No lines.</p>
          ) : (
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-4 gap-y-1 text-[11px]">
              <span className="text-muted-foreground font-medium">Item</span>
              <span className="text-muted-foreground font-medium text-right">Planned</span>
              <span className="text-muted-foreground font-medium text-right">Picked</span>
              <span className="text-muted-foreground font-medium text-right">Packed</span>
              <span className="text-muted-foreground font-medium text-right">Issued</span>
              {delivery.lines.map((dl) => (
                <>
                  <span key={`n-${dl.id}`} className="truncate">{dl.product_name || `Line ${dl.line_no}`}</span>
                  <span key={`p-${dl.id}`} className="tabular-nums text-right">{dl.planned_qty}</span>
                  <span key={`pk-${dl.id}`} className="tabular-nums text-right">{dl.picked_qty}</span>
                  <span key={`pa-${dl.id}`} className="tabular-nums text-right">{dl.packed_qty}</span>
                  <span key={`i-${dl.id}`} className={cn('tabular-nums text-right', dl.issued_qty > 0 ? 'text-emerald-600 dark:text-emerald-400 font-medium' : '')}>
                    {dl.issued_qty}
                  </span>
                </>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export function DeliveryDocumentsPanel({ order, isTerminal }: Props) {
  const [showCreate, setShowCreate] = useState(false)
  const qc = useQueryClient()
  const deliveries = order.deliveries ?? []

  const canCreate = !isTerminal
    && !order.fulfillment_block
    && !['cancelled', 'refunded', 'returned'].includes(order.status)

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Deliveries</span>
          {deliveries.length > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{deliveries.length}</Badge>
          )}
        </div>
        {canCreate && (
          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setShowCreate(true)}>
            <Plus className="h-3.5 w-3.5" /> New Delivery
          </Button>
        )}
      </div>

      <div className="p-3 space-y-2">
        {deliveries.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2 text-center">No deliveries yet.</p>
        ) : (
          deliveries.map((d) => (
            <DeliveryRow key={d.id} delivery={d} orderId={order.id} isTerminal={isTerminal} />
          ))
        )}
      </div>

      {showCreate && (
        <CreateDeliveryModal
          order={order}
          onClose={() => setShowCreate(false)}
          onCreated={() => qc.invalidateQueries({ queryKey: ['order', order.id] })}
        />
      )}
    </div>
  )
}
