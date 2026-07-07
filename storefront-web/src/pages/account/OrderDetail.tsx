import { useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useOrder, useCancelOrder, useRequestReturn, useOrderInvoice } from '@/hooks/useStore'
import { storeApi } from '@/api/store'
import type { OrderAttachmentRef } from '@/types'
import { formatCurrency, formatDate, imgUrl } from '@/lib/utils'
import {
  ClickableImageButton,
  ImageLightboxSession,
  urlsToLightboxItems,
} from '@/components/common/CatalogMediaLightbox'
import { Button } from '@/components/ui/button'
import { ChevronRight, Loader2, Package, Truck, CheckCircle, Clock, XCircle, ShoppingBag, ExternalLink, RotateCcw, Repeat, Info, Download, CalendarDays, AlertTriangle } from 'lucide-react'
import { useVendor } from '@/contexts/VendorContext'
import { toast } from 'sonner'
import { extractApiError } from '@/lib/errorMessages'

const MAX_ORDER_MEDIA = 10

const statusSteps = ['pending', 'confirmed', 'shipped', 'delivered']
const stepConfig = [
  { key: 'pending', label: 'Order Placed', icon: Clock },
  { key: 'confirmed', label: 'Confirmed', icon: Package },
  { key: 'shipped', label: 'Shipped', icon: Truck },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle },
]

const bookingStatusSteps = ['confirmed', 'in_progress', 'completed']
const bookingStepConfig = [
  { key: 'confirmed', label: 'Booked', icon: CalendarDays },
  { key: 'in_progress', label: 'In Progress', icon: Clock },
  { key: 'completed', label: 'Completed', icon: CheckCircle },
]

function downloadInvoice(invoice: Record<string, unknown>, order: { order_number: string; created_at: string; booking_number?: string }) {
  const fmt = (n: unknown) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
  const items: Array<Record<string, unknown>> = (invoice.items as Array<Record<string, unknown>>) || []
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Invoice ${invoice.invoice_number}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 13px; color: #222; margin: 0; padding: 0 }
    .page { max-width: 760px; margin: 0 auto; padding: 32px }
    h1 { font-size: 22px; margin: 0 0 4px }
    .meta { color: #666; font-size: 12px; margin-bottom: 24px }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px }
    .label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 4px }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px }
    th { background: #f5f5f5; text-align: left; padding: 8px 10px; font-size: 12px }
    td { padding: 8px 10px; border-bottom: 1px solid #f0f0f0 }
    .total-row td { font-weight: bold; border-top: 2px solid #222; border-bottom: none; font-size: 14px }
    .right { text-align: right }
    .badge { display: inline-block; padding: 2px 10px; border-radius: 20px; font-size: 11px; background: #e8f5e9; color: #2e7d32 }
    @media print { body { -webkit-print-color-adjust: exact } }
  </style>
</head>
<body>
<div class="page">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px">
    <div>
      <h1>TAX INVOICE</h1>
      <div class="meta">Invoice # <strong>${invoice.invoice_number}</strong> &nbsp;|&nbsp; ${order.booking_number ? `Booking # <strong>${order.booking_number}</strong> &nbsp;|&nbsp; ` : ''}Order # <strong>${order.order_number}</strong></div>
      <div class="meta">Date: ${new Date(order.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
    </div>
    <span class="badge">${String(invoice.status || 'issued').toUpperCase()}</span>
  </div>
  <div class="grid">
    <div>
      <div class="label">From</div>
      <strong>${invoice.vendor_name || ''}</strong><br />
      ${invoice.vendor_gstin ? `GSTIN: ${invoice.vendor_gstin}` : ''}
    </div>
    <div>
      <div class="label">Bill To</div>
      <strong>${invoice.customer_name || ''}</strong><br />
      ${invoice.billing_address ? Object.values(invoice.billing_address as Record<string, string>).filter(Boolean).join(', ') : ''}
    </div>
  </div>
  <table>
    <thead><tr><th>#</th><th>Item</th><th class="right">Qty</th><th class="right">Rate</th><th class="right">Tax</th><th class="right">Amount</th></tr></thead>
    <tbody>
      ${items.map((it, i) => `<tr>
        <td>${i + 1}</td>
        <td>${it.name || it.description || ''}</td>
        <td class="right">${it.qty ?? it.quantity ?? 1}</td>
        <td class="right">${fmt(it.rate || it.price)}</td>
        <td class="right">${fmt((Number(it.cgst_amount || 0) + Number(it.sgst_amount || 0) + Number(it.igst_amount || 0)))}</td>
        <td class="right">${fmt(it.total_amount || it.total)}</td>
      </tr>`).join('')}
    </tbody>
    <tfoot>
      ${Number(invoice.discount_amount || 0) > 0 ? `<tr><td colspan="5" class="right">Discount</td><td class="right">-${fmt(invoice.discount_amount)}</td></tr>` : ''}
      ${Number(invoice.cgst_amount || 0) > 0 ? `<tr><td colspan="5" class="right">CGST</td><td class="right">${fmt(invoice.cgst_amount)}</td></tr>` : ''}
      ${Number(invoice.sgst_amount || 0) > 0 ? `<tr><td colspan="5" class="right">SGST</td><td class="right">${fmt(invoice.sgst_amount)}</td></tr>` : ''}
      ${Number(invoice.igst_amount || 0) > 0 ? `<tr><td colspan="5" class="right">IGST</td><td class="right">${fmt(invoice.igst_amount)}</td></tr>` : ''}
      <tr class="total-row"><td colspan="5" class="right">Total</td><td class="right">${fmt(invoice.total)}</td></tr>
    </tfoot>
  </table>
  ${Number(invoice.balance_due || 0) > 0 ? `<p style="color:#c62828;font-weight:600">Balance Due: ${fmt(invoice.balance_due)}</p>` : '<p style="color:#2e7d32;font-weight:600">Paid in Full</p>'}
  <p style="font-size:11px;color:#aaa;margin-top:32px;border-top:1px solid #eee;padding-top:12px">This is a computer-generated invoice and does not require a signature.</p>
</div>
</body>
</html>`

  const w = window.open('', '_blank')
  if (!w) return
  w.document.write(html)
  w.document.close()
  setTimeout(() => { w.focus(); w.print() }, 400)
}

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>()
  const { data: order, isLoading } = useOrder(id!)
  const cancelMut = useCancelOrder()
  const returnMut = useRequestReturn()
  const { data: invoice } = useOrderInvoice(id!)
  const { storePath } = useVendor()

  const [showCancel, setShowCancel] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelAttachments, setCancelAttachments] = useState<OrderAttachmentRef[]>([])
  const [cancelUploading, setCancelUploading] = useState(false)
  const [showReturn, setShowReturn] = useState(false)
  const [returnType, setReturnType] = useState<'return' | 'exchange'>('return')
  const [returnReason, setReturnReason] = useState('')
  const [returnAttachments, setReturnAttachments] = useState<OrderAttachmentRef[]>([])
  const [returnUploading, setReturnUploading] = useState(false)
  const [cancelLightboxIndex, setCancelLightboxIndex] = useState<number | null>(null)
  const [returnLightboxIndex, setReturnLightboxIndex] = useState<number | null>(null)
  const [showDispute, setShowDispute] = useState(false)
  const [disputeReason, setDisputeReason] = useState('')
  const [disputeSubmitting, setDisputeSubmitting] = useState(false)
  const [disputeFiled, setDisputeFiled] = useState(false)

  const cancelImageItems = useMemo(
    () => urlsToLightboxItems(
      cancelAttachments.filter((a) => a.kind === 'image').map((a) => a.url),
      { idPrefix: 'cancel' },
    ),
    [cancelAttachments],
  )

  const returnImageItems = useMemo(
    () => urlsToLightboxItems(
      returnAttachments.filter((a) => a.kind === 'image').map((a) => a.url),
      { idPrefix: 'return' },
    ),
    [returnAttachments],
  )

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-gray-300" /></div>
  if (!order) {
    return (
      <div className="text-center py-20">
        <Package className="w-16 h-16 text-gray-200 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-1">Order not found</h2>
      </div>
    )
  }

  const isBooking = order.source === 'booking'
  const isQuote = order.source === 'quote'
  const currentStep = isBooking
    ? bookingStatusSteps.indexOf(order.status)
    : statusSteps.indexOf(order.status)
  const isCancelled = order.status === 'cancelled'
  const canCancel = !isBooking && ['pending', 'confirmed'].includes(order.status)
  const isDelivered = order.status === 'delivered'
  const canRequestReturn = isDelivered && !order.return_status
  const canFileDispute = !isBooking && !isQuote && !isCancelled && ['pending', 'confirmed', 'shipped', 'delivered'].includes(order.status) && !disputeFiled
  const hasReturnRequest = !!order.return_status
  const isReturnOrExchange = ['return_requested', 'exchange_requested', 'returned', 'exchanged', 'refunded'].includes(order.status)

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 mb-6">
        <Link to={storePath('/')} className="hover:text-blue-600">Home</Link>
        <ChevronRight className="inline w-3 h-3 mx-1.5" />
        <Link to={storePath('/account/orders')} className="hover:text-blue-600">Orders</Link>
        <ChevronRight className="inline w-3 h-3 mx-1.5" />
        <span className="text-gray-900">{order.order_number}</span>
      </nav>

      {/* Order header */}
      <div className="bg-white rounded-xl border overflow-hidden mb-6">
        <div className="bg-gray-50 px-5 sm:px-6 py-4 border-b">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between flex-wrap">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-gray-900">
                  {isBooking ? 'Booking' : isQuote ? 'Quote Request' : 'Order'} {order.order_number}
                </h1>
                {isBooking && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-medium">
                    <CalendarDays className="w-3 h-3" /> Booking
                  </span>
                )}
                {isQuote && (
                  <span className="inline-flex px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">Quote</span>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-0.5">Placed on {formatDate(order.created_at)}</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center w-full sm:w-auto">
              {invoice && (
                <Button
                  variant="outline" size="sm"
                  className="gap-1.5 text-blue-700 border-blue-200 hover:bg-blue-50"
                  onClick={() => downloadInvoice(invoice as Record<string, unknown>, {
                    ...order,
                    booking_number: isBooking ? (order.items?.[0] as unknown as Record<string, unknown>)?.booking_number as string | undefined : undefined,
                  })}
                >
                  <Download className="w-4 h-4" /> Download Invoice
                </Button>
              )}
              <span className="text-lg font-bold text-gray-900">{formatCurrency(order.total)}</span>
              {canCancel && (
                <Button variant="outline" size="sm"
                  className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                  onClick={() => setShowCancel(true)}>
                  Cancel Order
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Status Timeline */}
        <div className="px-5 sm:px-6 py-6">
          {isCancelled ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <XCircle className="w-8 h-8 text-red-500 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-red-700">Cancelled</p>
                {order.cancel_reason && <p className="text-sm text-red-600 mt-0.5">{order.cancel_reason}</p>}
                {order.cancel_attachments && order.cancel_attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {order.cancel_attachments.map((a, i) => (
                      a.kind === 'image' ? (
                        <a key={i} href={imgUrl(a.url)} target="_blank" rel="noopener noreferrer" className="block">
                          <img src={imgUrl(a.url)} alt="" className="h-20 w-20 object-cover rounded-lg border border-red-200" />
                        </a>
                      ) : (
                        <video key={i} src={imgUrl(a.url)} controls className="max-h-32 max-w-full rounded-lg border border-red-200" />
                      )
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : isQuote ? (
            <div className="bg-accent border border-primary/30 rounded-xl p-4">
              <p className="font-semibold text-primary">Quote Request Submitted</p>
              <p className="text-sm text-primary mt-1">The vendor will review your request and get back to you.</p>
              {order.notes && <p className="text-sm text-gray-600 mt-2 border-t border-primary/30 pt-2">{order.notes}</p>}
            </div>
          ) : (
            <div className="overflow-x-auto -mx-1 px-1 pb-2 sm:overflow-visible sm:mx-0 sm:px-0 sm:pb-0">
            <div className="flex items-center justify-between relative min-w-[280px] sm:min-w-0">
              {(() => {
                const steps = isBooking ? bookingStepConfig : stepConfig
                const stepCount = steps.length
                return (
                  <>
                    <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200 z-0">
                      <div className="h-full bg-primary transition-all duration-500"
                        style={{ width: `${currentStep >= 0 ? (currentStep / (stepCount - 1)) * 100 : 0}%` }} />
                    </div>
                    {steps.map((step, i) => (
                      <div key={step.key} className="flex flex-col items-center z-10 relative">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                          i <= currentStep
                            ? 'bg-primary text-white shadow-lg shadow-blue-200'
                            : 'bg-white border-2 border-gray-200 text-gray-400'
                        }`}>
                          <step.icon className="w-5 h-5" />
                        </div>
                        <span className={`text-xs mt-2 font-medium ${i <= currentStep ? 'text-blue-600' : 'text-gray-400'}`}>
                          {step.label}
                        </span>
                        {step.key === 'confirmed' && order.confirmed_at && (
                          <span className="text-xs text-gray-400 mt-0.5">{formatDate(order.confirmed_at)}</span>
                        )}
                        {step.key === 'shipped' && order.shipped_at && (
                          <span className="text-xs text-gray-400 mt-0.5">{formatDate(order.shipped_at)}</span>
                        )}
                        {step.key === 'delivered' && order.delivered_at && (
                          <span className="text-xs text-gray-400 mt-0.5">{formatDate(order.delivered_at)}</span>
                        )}
                      </div>
                    ))}
                  </>
                )
              })()}
            </div>
            </div>
          )}
        </div>
      </div>

      {/* Return / Exchange Status Banner */}
      {hasReturnRequest && (
        <div className={`rounded-xl border p-5 ${
          order.return_status === 'requested' ? 'bg-amber-50 border-amber-200' :
          order.return_status === 'approved' ? 'bg-green-50 border-green-200' :
          order.return_status === 'rejected' ? 'bg-red-50 border-red-200' :
          'bg-gray-50 border-gray-200'
        }`}>
          <div className="flex items-start gap-3">
            {order.return_type === 'exchange' ? (
              <Repeat className={`w-6 h-6 shrink-0 ${
                order.return_status === 'requested' ? 'text-amber-600' :
                order.return_status === 'approved' ? 'text-green-600' : 'text-red-600'
              }`} />
            ) : (
              <RotateCcw className={`w-6 h-6 shrink-0 ${
                order.return_status === 'requested' ? 'text-amber-600' :
                order.return_status === 'approved' ? 'text-green-600' : 'text-red-600'
              }`} />
            )}
            <div className="flex-1 min-w-0">
              <p className={`font-semibold ${
                order.return_status === 'requested' ? 'text-amber-800' :
                order.return_status === 'approved' ? 'text-green-800' : 'text-red-800'
              }`}>
                {order.return_type === 'exchange' ? 'Exchange' : 'Return'}{' '}
                {order.return_status === 'requested' ? 'Requested' :
                 order.return_status === 'approved' ? 'Approved' :
                 order.return_status === 'rejected' ? 'Rejected' :
                 order.return_status === 'completed' ? 'Completed' : order.return_status}
              </p>
              <p className="text-sm mt-1 text-gray-700"><span className="font-medium">Reason:</span> {order.return_reason}</p>
              {order.return_attachments && order.return_attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {order.return_attachments.map((a, i) => (
                    a.kind === 'image' ? (
                      <a key={i} href={imgUrl(a.url)} target="_blank" rel="noopener noreferrer" className="block">
                        <img src={imgUrl(a.url)} alt="" className="h-20 w-20 object-cover rounded-lg border border-gray-200" />
                      </a>
                    ) : (
                      <video key={i} src={imgUrl(a.url)} controls className="max-h-32 max-w-full rounded-lg border border-gray-200" />
                    )
                  ))}
                </div>
              )}
              {order.return_notes && <p className="text-sm mt-1 text-gray-600"><span className="font-medium">Vendor response:</span> {order.return_notes}</p>}
              {order.return_status === 'approved' && order.return_type === 'return' && (order.refund_amount ?? 0) > 0 && (
                <p className="text-sm mt-1 font-medium text-green-700">Refund: {formatCurrency(order.refund_amount!)}</p>
              )}
              {order.return_requested_at && <p className="text-xs text-gray-500 mt-2">Requested on {formatDate(order.return_requested_at)}</p>}
              {order.return_resolved_at && <p className="text-xs text-gray-500">Resolved on {formatDate(order.return_resolved_at)}</p>}
            </div>
          </div>
        </div>
      )}

      {canFileDispute && (
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center gap-3 mb-3">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <p className="text-sm font-medium text-gray-700">Issue with this order?</p>
          </div>
          <Button
            variant="outline"
            className="gap-2 text-amber-700 border-amber-200 hover:bg-amber-50"
            onClick={() => setShowDispute(true)}
          >
            File a dispute
          </Button>
        </div>
      )}

      {/* Return / Exchange action for delivered orders */}
      {canRequestReturn && (
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center gap-3 mb-3">
            <Info className="w-5 h-5 text-blue-500" />
            <p className="text-sm font-medium text-gray-700">Not satisfied with your order?</p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="gap-2 text-orange-600 border-orange-200 hover:bg-orange-50"
              onClick={() => { setReturnType('return'); setShowReturn(true) }}
            >
              <RotateCcw className="w-4 h-4" /> Request Return
            </Button>
            <Button
              variant="outline"
              className="gap-2 text-blue-600 border-blue-200 hover:bg-blue-50"
              onClick={() => { setReturnType('exchange'); setShowReturn(true) }}
            >
              <Repeat className="w-4 h-4" /> Request Exchange
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Items */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b">
              <h3 className="font-bold text-sm">
                {isBooking ? 'Booked Service' : isQuote ? 'Requested Item' : 'Items Ordered'} ({order.item_count})
              </h3>
            </div>
            <div className="divide-y">
              {order.items.map((item, i) => {
                const extItem = item as unknown as Record<string, unknown>
                return (
                  <div key={i} className="flex items-center gap-4 px-5 py-4">
                    <div className="w-16 h-16 bg-gray-50 rounded-lg border overflow-hidden shrink-0 flex items-center justify-center">
                      {item.image_url ? (
                        <img src={imgUrl(item.image_url)} alt="" className="w-full h-full object-cover" />
                      ) : isBooking ? (
                        <CalendarDays className="w-8 h-8 text-indigo-300" />
                      ) : (
                        <ShoppingBag className="w-8 h-8 text-gray-200" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-900">{item.name}</p>
                      {!!extItem.booking_date && (
                        <p className="text-xs text-indigo-600 mt-0.5 flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" /> {String(extItem.booking_date)}
                        </p>
                      )}
                      {!!extItem.booking_number && (
                        <p className="text-xs text-gray-400 mt-0.5 font-mono">{String(extItem.booking_number)}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-0.5">Qty: {item.qty} × {formatCurrency(item.price)}</p>
                    </div>
                    <p className="font-bold text-sm shrink-0">{formatCurrency(item.price * item.qty)}</p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Tracking card (shown when shipped) */}
          {order.status === 'shipped' && order.tracking_number && (
            <div className="bg-accent border border-primary/30 rounded-xl p-5">
              <div className="flex items-center gap-3">
                <Truck className="w-6 h-6 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-primary">Your order is on the way!</p>
                  <p className="text-sm text-primary mt-1">Tracking: <span className="font-mono font-medium">{order.tracking_number}</span></p>
                </div>
                {order.tracking_url && (
                  <a href={order.tracking_url} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline" className="gap-1.5 border-primary/40 text-primary hover:bg-primary/12">
                      <ExternalLink className="w-3.5 h-3.5" /> Track
                    </Button>
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Summary sidebar */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border p-5">
            <h3 className="font-bold text-sm mb-3">Payment Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{formatCurrency(order.subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Tax</span><span>{formatCurrency(order.tax_amount)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Shipping</span><span>{formatCurrency(order.shipping_amount)}</span></div>
              {order.discount_amount > 0 && (
                <div className="flex justify-between"><span className="text-gray-500">Discount</span><span className="text-green-600">-{formatCurrency(order.discount_amount)}</span></div>
              )}
              <div className="flex justify-between pt-3 border-t">
                <span className="font-bold">Order Total</span>
                <span className="font-bold text-lg text-red-600">{formatCurrency(order.total)}</span>
              </div>
            </div>
          </div>

          {order.shipping_address && (
            <div className="bg-white rounded-xl border p-5">
              <h3 className="font-bold text-sm mb-3">Shipping Address</h3>
              <div className="text-sm text-gray-600 space-y-0.5">
                <p>{order.shipping_address.street_address}</p>
                <p>{order.shipping_address.city}, {order.shipping_address.state}</p>
                <p>{order.shipping_address.postal_code}</p>
              </div>
              {order.tracking_number && order.status !== 'shipped' && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-xs text-gray-500">Tracking Number</p>
                  <p className="text-sm font-medium text-blue-600">{order.tracking_number}</p>
                </div>
              )}
            </div>
          )}

          {order.payment_method && (
            <div className="bg-white rounded-xl border p-5">
              <h3 className="font-bold text-sm mb-2">Payment</h3>
              <p className="text-sm text-gray-600 capitalize">{order.payment_method.replace('_', ' ')}</p>
              <p className="text-xs text-gray-400 capitalize mt-1">Status: {order.payment_status}</p>
            </div>
          )}

          {invoice && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
              <h3 className="font-bold text-sm mb-2 text-blue-900">Invoice</h3>
              <p className="text-sm text-blue-700 font-mono">{(invoice as Record<string, string>).invoice_number}</p>
              <div className="text-xs text-blue-600 mt-2 space-y-1">
                <p>Total: {formatCurrency(Number((invoice as Record<string, unknown>).total))}</p>
                <p className="capitalize">Status: {(invoice as Record<string, string>).status}</p>
              </div>
              <Button
                size="sm"
                className="mt-3 w-full gap-2 bg-primary hover:bg-primary/90 text-white"
                onClick={() => downloadInvoice(invoice as Record<string, unknown>, {
                  ...order,
                  booking_number: isBooking ? (order.items?.[0] as unknown as Record<string, unknown>)?.booking_number as string | undefined : undefined,
                })}
              >
                <Download className="w-4 h-4" /> Download PDF
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Order Timeline / Status History */}
      {order.status_history && order.status_history.length > 0 && (
        <div className="bg-white rounded-xl border p-5">
          <h3 className="font-bold text-sm mb-4 flex items-center gap-2"><Clock className="w-4 h-4" /> Order Timeline</h3>
          <div className="relative pl-6 space-y-4">
            <div className="absolute left-[9px] top-1 bottom-1 w-0.5 bg-gray-200" />
            {order.status_history.map((h) => (
              <div key={h.id} className="relative flex items-start gap-3">
                <div className="absolute left-[-18px] top-1.5 w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-white ring-2 ring-blue-100" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium capitalize">{h.to_status.replace(/_/g, ' ')}</span>
                  <p className="text-xs text-gray-500 mt-0.5">{formatDate(h.timestamp)}</p>
                  {h.notes && <p className="text-xs text-gray-400 mt-0.5">{h.notes}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {showCancel && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto"
          onClick={() => { setShowCancel(false); setCancelReason(''); setCancelAttachments([]) }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-1">Cancel Order</h3>
            <p className="text-sm text-gray-500 mb-4">Please tell us why you want to cancel order {order.order_number}.</p>
            <textarea
              className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              rows={3}
              placeholder="Reason for cancellation (min 5 characters)"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
            <div className="mt-3">
              <label className="text-xs font-medium text-gray-600">Photos or videos (optional, max {MAX_ORDER_MEDIA})</label>
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                disabled={cancelUploading || cancelAttachments.length >= MAX_ORDER_MEDIA}
                className="mt-1 block w-full text-sm text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm"
                onChange={async (e) => {
                  const files = e.target.files
                  if (!files?.length) return
                  setCancelUploading(true)
                  try {
                    let n = cancelAttachments.length
                    for (const file of Array.from(files)) {
                      if (n >= MAX_ORDER_MEDIA) break
                      const { url, kind } = await storeApi.uploadOrderMedia(order.id, file)
                      setCancelAttachments((prev) => (prev.length >= MAX_ORDER_MEDIA ? prev : [...prev, { url, kind }]))
                      n++
                    }
                  } finally {
                    setCancelUploading(false)
                    e.target.value = ''
                  }
                }}
              />
              {cancelAttachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {cancelAttachments.map((a, i) => (
                    <div key={`${a.url}-${i}`} className="relative group">
                      {a.kind === 'image' ? (
                        <ClickableImageButton
                          src={imgUrl(a.url)}
                          alt={`Evidence ${i + 1}`}
                          title="View image"
                          className="h-16 w-16 rounded-lg border"
                          imgClassName="h-16 w-16 object-cover rounded-lg"
                          onClick={() => setCancelLightboxIndex(
                            cancelAttachments.slice(0, i).filter((x) => x.kind === 'image').length,
                          )}
                        />
                      ) : (
                        <video src={imgUrl(a.url)} className="h-16 w-24 object-cover rounded-lg border" muted />
                      )}
                      <button
                        type="button"
                        className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full w-5 h-5 text-xs leading-5"
                        onClick={(e) => { e.stopPropagation(); setCancelAttachments((prev) => prev.filter((_, j) => j !== i)) }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <ImageLightboxSession
                items={cancelImageItems}
                openIndex={cancelLightboxIndex}
                onClose={() => setCancelLightboxIndex(null)}
              />
              {cancelUploading && <p className="text-xs text-gray-500 mt-1">Uploading…</p>}
            </div>
            <div className="flex gap-3 mt-4">
              <Button variant="outline" className="flex-1" onClick={() => { setShowCancel(false); setCancelReason(''); setCancelAttachments([]) }}>
                Keep Order
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                disabled={cancelReason.trim().length < 5 || cancelMut.isPending || cancelUploading}
                onClick={() => {
                  cancelMut.mutate(
                    {
                      id: order.id,
                      reason: cancelReason.trim(),
                      attachments: cancelAttachments.length ? cancelAttachments : undefined,
                    },
                    {
                      onSuccess: () => {
                        setShowCancel(false)
                        setCancelReason('')
                        setCancelAttachments([])
                      },
                    },
                  )
                }}
              >
                {cancelMut.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Cancel Order
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Return / Exchange Modal */}
      {showReturn && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto"
          onClick={() => { setShowReturn(false); setReturnReason(''); setReturnAttachments([]) }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-1">
              {returnType === 'exchange' ? (
                <Repeat className="w-6 h-6 text-blue-600" />
              ) : (
                <RotateCcw className="w-6 h-6 text-orange-600" />
              )}
              <h3 className="text-lg font-semibold">
                Request {returnType === 'exchange' ? 'Exchange' : 'Return'}
              </h3>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              {returnType === 'exchange'
                ? 'Tell us why you want to exchange this order. The vendor will review your request.'
                : 'Tell us why you want to return this order. Once approved, a refund will be initiated.'}
            </p>

            <div className="flex gap-2 mb-4">
              <button
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                  returnType === 'return'
                    ? 'bg-orange-50 border-orange-300 text-orange-700'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
                onClick={() => setReturnType('return')}
              >
                <RotateCcw className="w-4 h-4 inline mr-1.5" />Return
              </button>
              <button
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                  returnType === 'exchange'
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
                onClick={() => setReturnType('exchange')}
              >
                <Repeat className="w-4 h-4 inline mr-1.5" />Exchange
              </button>
            </div>

            <textarea
              className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              rows={4}
              placeholder={returnType === 'exchange'
                ? 'e.g. Wrong size, want a different colour...'
                : 'e.g. Product defective, not as described...'}
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1">Minimum 5 characters</p>

            <div className="mt-3">
              <label className="text-xs font-medium text-gray-600">Photos or videos (optional, max {MAX_ORDER_MEDIA})</label>
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                disabled={returnUploading || returnAttachments.length >= MAX_ORDER_MEDIA}
                className="mt-1 block w-full text-sm text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm"
                onChange={async (e) => {
                  const files = e.target.files
                  if (!files?.length) return
                  setReturnUploading(true)
                  try {
                    let n = returnAttachments.length
                    for (const file of Array.from(files)) {
                      if (n >= MAX_ORDER_MEDIA) break
                      const { url, kind } = await storeApi.uploadOrderMedia(order.id, file)
                      setReturnAttachments((prev) => (prev.length >= MAX_ORDER_MEDIA ? prev : [...prev, { url, kind }]))
                      n++
                    }
                  } finally {
                    setReturnUploading(false)
                    e.target.value = ''
                  }
                }}
              />
              {returnAttachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {returnAttachments.map((a, i) => (
                    <div key={`${a.url}-${i}`} className="relative group">
                      {a.kind === 'image' ? (
                        <ClickableImageButton
                          src={imgUrl(a.url)}
                          alt={`Evidence ${i + 1}`}
                          title="View image"
                          className="h-16 w-16 rounded-lg border"
                          imgClassName="h-16 w-16 object-cover rounded-lg"
                          onClick={() => setReturnLightboxIndex(
                            returnAttachments.slice(0, i).filter((x) => x.kind === 'image').length,
                          )}
                        />
                      ) : (
                        <video src={imgUrl(a.url)} className="h-16 w-24 object-cover rounded-lg border" muted />
                      )}
                      <button
                        type="button"
                        className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full w-5 h-5 text-xs leading-5"
                        onClick={(e) => { e.stopPropagation(); setReturnAttachments((prev) => prev.filter((_, j) => j !== i)) }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <ImageLightboxSession
                items={returnImageItems}
                openIndex={returnLightboxIndex}
                onClose={() => setReturnLightboxIndex(null)}
              />
              {returnUploading && <p className="text-xs text-gray-500 mt-1">Uploading…</p>}
            </div>

            <div className="flex gap-3 mt-4">
              <Button variant="cancel" className="flex-1" onClick={() => { setShowReturn(false); setReturnReason(''); setReturnAttachments([]) }}>Cancel</Button>
              <Button
                className={`flex-1 gap-2 ${returnType === 'exchange' ? 'bg-primary hover:bg-primary/90' : 'bg-orange-600 hover:bg-orange-700'}`}
                disabled={returnReason.trim().length < 5 || returnMut.isPending || returnUploading}
                onClick={() => {
                  returnMut.mutate(
                    {
                      id: order.id,
                      return_type: returnType,
                      reason: returnReason.trim(),
                      attachments: returnAttachments.length ? returnAttachments : undefined,
                    },
                    {
                      onSuccess: () => {
                        setShowReturn(false)
                        setReturnReason('')
                        setReturnAttachments([])
                      },
                    },
                  )
                }}
              >
                {returnMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Submit Request
              </Button>
            </div>
          </div>
        </div>
      )}

      {showDispute && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto"
          onClick={() => { setShowDispute(false); setDisputeReason('') }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-1">File a dispute</h3>
            <p className="text-sm text-gray-500 mb-4">
              Describe the issue with order {order.order_number}. Our platform team will review it.
            </p>
            <textarea
              className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-none"
              rows={4}
              placeholder="What went wrong? (min 10 characters)"
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
            />
            <div className="flex gap-3 mt-4">
              <Button variant="outline" className="flex-1" onClick={() => { setShowDispute(false); setDisputeReason('') }}>
                Cancel
              </Button>
              <Button
                className="flex-1 bg-amber-600 hover:bg-amber-700"
                disabled={disputeReason.trim().length < 10 || disputeSubmitting}
                onClick={async () => {
                  setDisputeSubmitting(true)
                  try {
                    await storeApi.fileOrderDispute(order.id, { reason: disputeReason.trim() })
                    setDisputeFiled(true)
                    setShowDispute(false)
                    setDisputeReason('')
                    toast.success('Dispute submitted — we will review it shortly')
                  } catch (err) {
                    toast.error(extractApiError(err, 'Could not file dispute'))
                  } finally {
                    setDisputeSubmitting(false)
                  }
                }}
              >
                {disputeSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Submit dispute
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
