/**
 * BillingDocumentsPanel — Phase-5
 *
 * Shows billing documents (invoices) linked to the order.
 * Provides a "Create Invoice" button on each goods-issued delivery
 * that hasn't been billed yet.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  FileText, Plus, ExternalLink, Loader2, CheckCircle2,
  AlertCircle, Clock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import { vendorApi } from '@/api/vendor'
import type { Order, OrderDelivery } from '@/types'

interface Props {
  order: Order
  isTerminal: boolean
}

// ── helpers ───────────────────────────────────────────────────────────────────

interface BriefInvoice {
  id: string
  invoice_number: string
  invoice_type: string
  status: string
  total: number
  due_date?: string | null
  delivery_id?: string | null
  created_at: string
}

const INV_STATUS_BADGE: Record<string, string> = {
  draft:           'bg-muted text-muted-foreground',
  sent:            'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  paid:            'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  partially_paid:  'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  overdue:         'bg-destructive/10 text-destructive',
  cancelled:       'bg-muted text-muted-foreground line-through',
}

const BILLING_STATUS_STYLE: Record<string, { icon: React.ReactNode; label: string; cls: string }> = {
  open:            { icon: <Clock className="h-3.5 w-3.5" />, label: 'Not Billed', cls: 'text-muted-foreground' },
  partial:         { icon: <AlertCircle className="h-3.5 w-3.5" />, label: 'Partially Billed', cls: 'text-amber-600 dark:text-amber-400' },
  complete:        { icon: <CheckCircle2 className="h-3.5 w-3.5" />, label: 'Fully Billed', cls: 'text-emerald-600 dark:text-emerald-400' },
  not_relevant:    { icon: <CheckCircle2 className="h-3.5 w-3.5" />, label: 'Not Relevant', cls: 'text-muted-foreground' },
}

// ── Bill modal ────────────────────────────────────────────────────────────────

function BillModal({
  order,
  delivery,
  onClose,
  onCreated,
}: {
  order: Order
  delivery: OrderDelivery
  onClose: () => void
  onCreated: (inv: BriefInvoice) => void
}) {
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      vendorApi.billFromDelivery(order.id, delivery.id, {
        due_date: dueDate || undefined,
        notes: notes || undefined,
      }),
    onSuccess: (inv) => {
      toast.success(`Invoice ${inv.invoice_number} created`)
      onCreated(inv as unknown as BriefInvoice)
      onClose()
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Could not create billing document'
      toast.error(msg)
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card shadow-xl p-6">
        <h2 className="text-base font-semibold mb-1">Create Invoice</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Billing document for delivery <span className="font-medium">{delivery.delivery_number}</span>
        </p>
        <div className="space-y-3 mb-4">
          <div>
            <Label className="text-xs">Due Date</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-8 text-sm mt-1" />
          </div>
          <div>
            <Label className="text-xs">Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" className="h-8 text-sm mt-1" />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button size="sm" onClick={() => mutate()} disabled={isPending}>
            {isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Create Invoice
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export function BillingDocumentsPanel({ order, isTerminal }: Props) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [billDelivery, setBillDelivery] = useState<OrderDelivery | null>(null)

  const { data: invoices, isLoading } = useQuery<BriefInvoice[]>({
    queryKey: ['order-invoices', order.id],
    queryFn: async () => {
      const res = await vendorApi.getInvoiceByOrder(order.id)
      // API may return a single object or array; normalise to array
      if (Array.isArray(res)) return res as BriefInvoice[]
      if (res && (res as BriefInvoice).id) return [res as BriefInvoice]
      return []
    },
  })

  const billedDeliveryIds = new Set((invoices || []).map((inv) => inv.delivery_id).filter(Boolean))

  const issuedDeliveries = (order.deliveries || []).filter(
    (d) => d.status === 'goods_issued' && !billedDeliveryIds.has(d.id)
  )

  const billingStatusInfo =
    BILLING_STATUS_STYLE[order.billing_status || 'open'] || BILLING_STATUS_STYLE.open

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Billing</span>
          {order.billing_status && (
            <span className={cn('flex items-center gap-1 text-[11px]', billingStatusInfo.cls)}>
              {billingStatusInfo.icon}
              {billingStatusInfo.label}
            </span>
          )}
        </div>
        {/* Quick bill button — only show if there are goods-issued unbilled deliveries */}
        {!isTerminal && issuedDeliveries.length > 0 && (
          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setBillDelivery(issuedDeliveries[0])}>
            <Plus className="h-3.5 w-3.5" /> Bill Delivery
          </Button>
        )}
      </div>

      <div className="p-3 space-y-2">
        {/* Existing invoices */}
        {isLoading ? (
          <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
          </div>
        ) : (invoices || []).length === 0 ? (
          <p className="text-xs text-muted-foreground py-2 text-center">No billing documents yet.</p>
        ) : (
          (invoices || []).map((inv) => (
            <div
              key={inv.id}
              className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5"
            >
              <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="text-[13px] font-medium">{inv.invoice_number}</span>
              <Badge className={cn('text-[10px] px-1.5 py-0', INV_STATUS_BADGE[inv.status] || 'bg-muted text-muted-foreground')}>
                {inv.status.replace('_', ' ')}
              </Badge>
              <span className="text-[12px] font-semibold ml-1">{formatCurrency(inv.total)}</span>
              {inv.due_date && (
                <span className="text-[11px] text-muted-foreground">due {formatDate(inv.due_date)}</span>
              )}
              <button
                className="ml-auto text-muted-foreground hover:text-foreground"
                onClick={() => navigate(`/invoices/${inv.id}`)}
                title="Open invoice"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        )}

        {/* Goods-issued but un-billed deliveries */}
        {!isTerminal && issuedDeliveries.length > 1 && (
          <div className="space-y-1.5 pt-1">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Deliveries pending billing
            </p>
            {issuedDeliveries.map((d) => (
              <div key={d.id} className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-1.5">
                <span className="text-[12px] flex-1">{d.delivery_number}</span>
                {d.actual_gi_date && (
                  <span className="text-[11px] text-muted-foreground">GI {formatDate(d.actual_gi_date)}</span>
                )}
                <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" onClick={() => setBillDelivery(d)}>
                  <Plus className="h-3 w-3 mr-1" /> Bill
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {billDelivery && (
        <BillModal
          order={order}
          delivery={billDelivery}
          onClose={() => setBillDelivery(null)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ['order-invoices', order.id] })
            qc.invalidateQueries({ queryKey: ['order', order.id] })
            setBillDelivery(null)
          }}
        />
      )}
    </div>
  )
}
