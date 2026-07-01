import {
  ArrowLeft, Package, Truck, CheckCircle, User, XCircle, Clock, FileText,
  MessageSquare, CalendarDays, Globe, Monitor, FileDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDateTime, formatDate, mediaUrl } from '@/lib/utils'
import type { Order } from '@/types'
import { MetricTile } from './OrderDetailPrimitives'

const statusTimeline = [
  { key: 'pending', label: 'Pending', icon: Clock },
  { key: 'confirmed', label: 'Confirmed', icon: Package },
  { key: 'processing', label: 'Processing', icon: Truck },
  { key: 'shipped', label: 'Shipped', icon: Truck },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle },
]

const bookingTimeline = [
  { key: 'confirmed', label: 'Booked', icon: CalendarDays },
  { key: 'processing', label: 'In Progress', icon: Truck },
  { key: 'delivered', label: 'Completed', icon: CheckCircle },
]

const statusBadge: Record<string, string> = {
  quote_requested: 'bg-primary/10 text-primary',
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-blue-100 text-blue-700',
  processing: 'bg-indigo-100 text-indigo-700',
  shipped: 'bg-primary/12 text-primary',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  return_requested: 'bg-amber-100 text-amber-700',
  exchange_requested: 'bg-amber-100 text-amber-700',
  returned: 'bg-orange-100 text-orange-700',
  exchanged: 'bg-indigo-100 text-indigo-700',
  refunded: 'bg-gray-100 text-gray-700',
}

const statusLabel: Record<string, string> = {
  quote_requested: 'Quote Request',
  return_requested: 'Return Requested',
  exchange_requested: 'Exchange Requested',
}

const SOURCE_LABEL: Record<string, string> = {
  online: 'Online Store',
  pos: 'Point of Sale',
  booking: 'Booking',
  quote: 'Quote Request',
}

const PLACED_BY_LABEL: Record<string, string> = {
  customer: 'Customer',
  staff: 'Sales staff',
  cashier: 'Cashier',
}

function orderSourceLabel(source?: string) {
  return SOURCE_LABEL[source || 'online'] || (source ? source.charAt(0).toUpperCase() + source.slice(1) : 'Online Store')
}

function orderSourceIcon(source?: string) {
  switch (source) {
    case 'pos': return Monitor
    case 'booking': return CalendarDays
    case 'quote': return MessageSquare
    default: return Globe
  }
}

function resolvePlacedBy(order: Pick<Order, 'placed_by_name' | 'placed_by_type' | 'customer_name' | 'source'>) {
  const name = order.placed_by_name || order.customer_name || '—'
  const type = order.placed_by_type
    || (['online', 'quote'].includes(order.source || '') ? 'customer' : undefined)
  return { name, typeLabel: type ? PLACED_BY_LABEL[type] : undefined }
}

interface OrderHeaderCardProps {
  order: Order
  invoice?: { id: string; invoice_number: string }
  isBooking: boolean
  isQuote: boolean
  isTerminal: boolean
  isCancelled: boolean
  bookingId?: string
  bookingNumber?: string
  bookingDate?: string
  updateStatusPending: boolean
  onBack: () => void
  onConfirm: () => void
  onShip: () => void
  onDeliver: () => void
  onCancelClick: () => void
  onViewInvoice: (invoiceId: string) => void
  onViewBooking: (bookingId: string) => void
  onViewAuditHistory: () => void
}

/** Header card: title, quick actions, key metrics, and fulfillment timeline. */
export function OrderHeaderCard({
  order, invoice, isBooking, isQuote, isTerminal, isCancelled,
  bookingId, bookingNumber, bookingDate, updateStatusPending,
  onBack, onConfirm, onShip, onDeliver, onCancelClick, onViewInvoice, onViewBooking, onViewAuditHistory,
}: OrderHeaderCardProps) {
  const activeTimeline = isBooking ? bookingTimeline : statusTimeline
  const currentStepIdx = activeTimeline.findIndex((s) => s.key === order.status)
  const SourceIcon = orderSourceIcon(order.source)
  const placedBy = resolvePlacedBy(order)

  return (
    <div className="rounded-xl border bg-card shadow-sm shrink-0 overflow-hidden">
      <div className="flex items-start justify-between gap-4 px-4 py-3 border-b bg-muted/30">
        <div className="flex items-start gap-3 min-w-0">
          <Button variant="ghost" size="sm" className="shrink-0 mt-0.5 h-8 px-2" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold text-gray-900">Order {order.order_number}</h1>
              {isBooking && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-medium">
                  <CalendarDays className="w-3 h-3" /> Booking
                </span>
              )}
              {isQuote && (
                <span className="inline-flex px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">Quote</span>
              )}
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusBadge[order.status] || 'bg-gray-100'}`}>
                {statusLabel[order.status] || order.status}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-gray-500">
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDateTime(order.created_at)}</span>
              {isBooking && bookingNumber && (
                <span className="font-mono bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded">{bookingNumber}</span>
              )}
              {isBooking && bookingDate && (
                <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />{bookingDate}</span>
              )}
              {order.status_history && order.status_history.length > 0 && (
                <button type="button" onClick={onViewAuditHistory}
                  className="inline-flex items-center gap-1 text-primary hover:underline font-medium">
                  <FileDown className="w-3 h-3" />View status history ({order.status_history.length})
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {!isTerminal && order.status === 'pending' && (
            <Button size="sm" className="gap-1.5" onClick={onConfirm} disabled={updateStatusPending}>
              <Package className="w-4 h-4" /> Confirm Order
            </Button>
          )}
          {!isTerminal && order.status === 'confirmed' && (
            <Button size="sm" className="gap-1.5" onClick={onShip} disabled={updateStatusPending}>
              <Truck className="w-4 h-4" /> Mark Shipped
            </Button>
          )}
          {!isTerminal && order.status === 'shipped' && (
            <Button size="sm" className="gap-1.5" onClick={onDeliver} disabled={updateStatusPending}>
              <CheckCircle className="w-4 h-4" /> Mark Delivered
            </Button>
          )}
          {invoice && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onViewInvoice(invoice.id)}>
              <FileText className="w-4 h-4" /> {invoice.invoice_number}
            </Button>
          )}
          {!isTerminal && ['pending', 'confirmed'].includes(order.status) && (
            <Button variant="outline" size="sm" className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
              disabled={updateStatusPending} onClick={onCancelClick}>
              <XCircle className="w-4 h-4" /> Cancel
            </Button>
          )}
          {isBooking && bookingId && (
            <Button variant="outline" size="sm" className="gap-1.5 text-indigo-600 border-indigo-200" onClick={() => onViewBooking(bookingId)}>
              <CalendarDays className="w-4 h-4" /> View Booking
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 px-4 py-2.5 border-b">
        <MetricTile label="Order total" value={formatCurrency(order.total)} />
        <MetricTile label="Payment" value={order.payment_method?.toUpperCase() || '—'} sub={order.payment_status} />
        <MetricTile label="Items" value={`${order.item_count} item${order.item_count !== 1 ? 's' : ''}`} />
        <MetricTile
          label="Source"
          value={orderSourceLabel(order.source)}
          sub={order.store_name || undefined}
          icon={SourceIcon}
        />
        <MetricTile
          label="Placed by"
          value={placedBy.name}
          sub={placedBy.typeLabel}
          icon={User}
        />
      </div>

      <div className="px-4 py-3">
        {isCancelled ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <XCircle className="w-8 h-8 text-red-500 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-red-700">Order Cancelled</p>
              {order.cancel_reason && <p className="text-sm text-red-600 mt-0.5">{order.cancel_reason}</p>}
              {order.cancel_attachments && order.cancel_attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {order.cancel_attachments.map((a, i) => (
                    a.kind === 'image' ? (
                      <a key={i} href={mediaUrl(a.url)} target="_blank" rel="noopener noreferrer" className="block">
                        <img src={mediaUrl(a.url)} alt="" className="h-20 w-20 object-cover rounded-lg border border-red-200" />
                      </a>
                    ) : (
                      <video key={i} src={mediaUrl(a.url)} controls className="max-h-32 max-w-full rounded-lg border border-red-200" />
                    )
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between relative px-1" role="list" aria-label="Order fulfillment progress">
            <div className="absolute top-4 left-4 right-4 h-0.5 bg-gray-200 z-0 rounded-full">
              <div className={`h-full transition-all duration-500 rounded-full ${isBooking ? 'bg-indigo-500' : 'bg-primary'}`}
                style={{ width: `${currentStepIdx >= 0 ? (currentStepIdx / (activeTimeline.length - 1)) * 100 : 0}%` }} />
            </div>
            {activeTimeline.map((step, i) => (
              <div key={step.key} role="listitem" aria-current={i === currentStepIdx ? 'step' : undefined}
                className="flex flex-col items-center z-10 relative flex-1 min-w-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                  i <= currentStepIdx
                    ? isBooking ? 'bg-indigo-600 text-white ring-2 ring-indigo-100' : 'bg-primary text-white ring-2 ring-primary/20'
                    : 'bg-white border-2 border-gray-200 text-gray-400'
                }`}>
                  <step.icon className="w-3.5 h-3.5" />
                </div>
                <span className={`text-xs mt-1.5 font-medium text-center ${
                  i <= currentStepIdx ? (isBooking ? 'text-indigo-600' : 'text-primary') : 'text-gray-400'
                }`}>
                  {step.label}
                </span>
                {step.key === 'confirmed' && order.confirmed_at && (
                  <span className="text-[10px] text-gray-400">{formatDate(order.confirmed_at)}</span>
                )}
                {step.key === 'shipped' && order.shipped_at && (
                  <span className="text-[10px] text-gray-400">{formatDate(order.shipped_at)}</span>
                )}
                {step.key === 'delivered' && order.delivered_at && (
                  <span className="text-[10px] text-gray-400">{formatDate(order.delivered_at)}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
