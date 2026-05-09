import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  useOrder,
  useUpdateOrderStatus,
  useResolveReturn,
  useOrderInvoice,
  useRequestReturnExchange,
} from '@/hooks/useVendor'
import { vendorApi } from '@/api/vendor'
import type { OrderAttachmentRef } from '@/types'
import { formatCurrency, formatDateTime, formatDate, mediaUrl } from '@/lib/utils'
import {
  ArrowLeft, Loader2, Package, Truck, CheckCircle, User, Mail, Phone,
  XCircle, X, Clock, MapPin, CreditCard, FileText, RotateCcw, Repeat, FileDown, MessageSquare,
  CalendarDays, Play, ExternalLink,
} from 'lucide-react'

const statusTimeline = [
  { key: 'pending', label: 'Pending', icon: Clock, color: 'yellow' },
  { key: 'confirmed', label: 'Confirmed', icon: Package, color: 'blue' },
  { key: 'processing', label: 'Processing', icon: Play, color: 'indigo' },
  { key: 'shipped', label: 'Shipped', icon: Truck, color: 'purple' },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle, color: 'green' },
]

const bookingTimeline = [
  { key: 'confirmed', label: 'Booked', icon: CalendarDays },
  { key: 'processing', label: 'In Progress', icon: Play },
  { key: 'delivered', label: 'Completed', icon: CheckCircle },
]

const statusBadge: Record<string, string> = {
  quote_requested: 'bg-violet-100 text-violet-700',
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-blue-100 text-blue-700',
  processing: 'bg-indigo-100 text-indigo-700',
  shipped: 'bg-purple-100 text-purple-700',
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

const MAX_ORDER_MEDIA = 10

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: order, isLoading } = useOrder(id!)
  const updateStatus = useUpdateOrderStatus()
  const resolveReturn = useResolveReturn()
  const requestReturnExchange = useRequestReturnExchange()
  const { data: invoice } = useOrderInvoice(id!)

  const [showShipModal, setShowShipModal] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [showResolveModal, setShowResolveModal] = useState<'approve' | 'reject' | null>(null)
  const [showInitiateModal, setShowInitiateModal] = useState(false)
  const [resolveNotes, setResolveNotes] = useState('')
  const [refundAmount, setRefundAmount] = useState('')
  const [initiateType, setInitiateType] = useState<'return' | 'exchange'>('return')
  const [initiateReason, setInitiateReason] = useState('')
  const [vendorCancelReason, setVendorCancelReason] = useState('')
  const [vendorCancelAttachments, setVendorCancelAttachments] = useState<OrderAttachmentRef[]>([])
  const [vendorCancelUploading, setVendorCancelUploading] = useState(false)
  const [initiateAttachments, setInitiateAttachments] = useState<OrderAttachmentRef[]>([])
  const [initiateUploading, setInitiateUploading] = useState(false)

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
  if (!order) return <p className="text-center py-20 text-gray-500">Order not found</p>

  const handleStatusUpdate = (status: string, extra?: Record<string, unknown>) => {
    updateStatus.mutate({ id: order.id, data: { status, ...extra } })
  }

  const isBooking = order.source === 'booking'
  const isQuote = order.source === 'quote'
  const activeTimeline = isBooking ? bookingTimeline : statusTimeline
  const currentStepIdx = activeTimeline.findIndex(s => s.key === order.status)
  const isCancelled = order.status === 'cancelled'
  const isTerminal = ['delivered', 'cancelled', 'refunded', 'returned', 'exchanged', 'return_requested', 'exchange_requested'].includes(order.status)
  const hasPendingReturn = order.return_status === 'requested'
  const hasReturnInfo = !!order.return_status
  const canInitiateReturn = order.status === 'delivered' && !isBooking && !['requested', 'approved'].includes(order.return_status || '')

  // Extract booking info from first item (set when booking created order)
  const bookingItem = isBooking ? (order.items?.[0] as unknown as Record<string, unknown>) : null
  const bookingId = bookingItem?.booking_id as string | undefined
  const bookingNumber = bookingItem?.booking_number as string | undefined
  const bookingDate = bookingItem?.booking_date as string | undefined

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/orders')}><ArrowLeft className="w-4 h-4 mr-1" />Back</Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold">Order {order.order_number}</h1>
              {isBooking && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold">
                  <CalendarDays className="w-3 h-3" /> Booking
                </span>
              )}
              {isQuote && (
                <span className="inline-flex px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 text-xs font-semibold">Quote</span>
              )}
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${statusBadge[order.status] || 'bg-gray-100'}`}>
                {statusLabel[order.status] || order.status}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <p className="text-gray-500 text-sm">{formatDateTime(order.created_at)}</p>
              {isBooking && bookingNumber && (
                <span className="text-xs text-indigo-600 font-mono bg-indigo-50 px-2 py-0.5 rounded">
                  {bookingNumber}
                </span>
              )}
              {isBooking && bookingDate && (
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <CalendarDays className="w-3 h-3" /> {bookingDate}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isBooking && bookingId && (
            <Button variant="outline" size="sm" className="gap-2 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
              onClick={() => navigate(`/bookings/${bookingId}`)}>
              <CalendarDays className="w-4 h-4" /> View Booking
            </Button>
          )}
          {invoice && (
            <Button variant="outline" size="sm" className="gap-2"
              onClick={() => navigate(`/invoices/${(invoice as Record<string, string>).id}`)}>
              <FileText className="w-4 h-4" /> {(invoice as Record<string, string>).invoice_number}
            </Button>
          )}
        </div>
      </div>

      {/* Status Timeline */}
      <Card>
        <CardContent className="py-6">
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
            <div className="flex items-center justify-between relative">
              <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200 z-0">
                <div className={`h-full transition-all duration-500 ${isBooking ? 'bg-indigo-500' : 'bg-blue-600'}`}
                  style={{ width: `${currentStepIdx >= 0 ? (currentStepIdx / (activeTimeline.length - 1)) * 100 : 0}%` }} />
              </div>
              {activeTimeline.map((step, i) => (
                <div key={step.key} className="flex flex-col items-center z-10 relative">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    i <= currentStepIdx
                      ? isBooking ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                      : 'bg-white border-2 border-gray-200 text-gray-400'
                  }`}>
                    <step.icon className="w-5 h-5" />
                  </div>
                  <span className={`text-xs mt-2 font-medium ${
                    i <= currentStepIdx ? (isBooking ? 'text-indigo-600' : 'text-blue-600') : 'text-gray-400'
                  }`}>
                    {step.label}
                  </span>
                  {step.key === 'confirmed' && order.confirmed_at && (
                    <span className="text-[10px] text-gray-400 mt-0.5">{formatDate(order.confirmed_at)}</span>
                  )}
                  {step.key === 'shipped' && order.shipped_at && (
                    <span className="text-[10px] text-gray-400 mt-0.5">{formatDate(order.shipped_at)}</span>
                  )}
                  {step.key === 'delivered' && order.delivered_at && (
                    <span className="text-[10px] text-gray-400 mt-0.5">{formatDate(order.delivered_at)}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quote Request Banner */}
      {order.source === 'quote' && (
        <Card className="border-violet-200 bg-violet-50">
          <CardContent className="py-5">
            <div className="flex items-start gap-3">
              <MessageSquare className="w-6 h-6 text-violet-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-violet-800">Quote Request</h3>
                <p className="text-sm text-violet-700 mt-1">
                  Customer requested a quote for: <strong>{order.items?.[0]?.name || 'Service'}</strong>
                </p>
                {order.notes && (
                  <div className="mt-3 bg-white/70 rounded-lg p-3 border border-violet-200">
                    <p className="text-xs font-medium text-violet-600 mb-1">Customer Message</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{order.notes}</p>
                  </div>
                )}
                {order.status === 'quote_requested' && (
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white"
                      onClick={() => handleStatusUpdate('confirmed')}>
                      Accept & Convert to Order
                    </Button>
                    <Button size="sm" variant="outline"
                      onClick={() => { setVendorCancelReason('Quote declined'); setShowCancelConfirm(true) }}>
                      Decline
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <InfoCard icon={CreditCard} label="Total" value={formatCurrency(order.total)} />
        <InfoCard icon={CreditCard} label="Payment" value={order.payment_method?.toUpperCase() || '-'} sub={order.payment_status} />
        <InfoCard icon={Package} label="Items" value={`${order.item_count} item${order.item_count !== 1 ? 's' : ''}`} />
        <InfoCard icon={Clock} label="Order Date" value={formatDate(order.created_at)} />
      </div>

      {/* Return / Exchange Request Card */}
      {hasReturnInfo && (
        <Card className={
          order.return_status === 'requested' ? 'border-amber-300 bg-amber-50' :
          order.return_status === 'approved' ? 'border-green-300 bg-green-50' :
          order.return_status === 'rejected' ? 'border-red-200 bg-red-50' :
          'border-gray-200'
        }>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              {order.return_type === 'exchange' ? <Repeat className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
              {order.return_type === 'exchange' ? 'Exchange' : 'Return'} Request
              <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${
                order.return_status === 'requested' ? 'bg-amber-200 text-amber-800' :
                order.return_status === 'approved' ? 'bg-green-200 text-green-800' :
                order.return_status === 'rejected' ? 'bg-red-200 text-red-800' : 'bg-gray-200'
              }`}>
                {order.return_status}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs text-gray-500 font-medium mb-0.5">Customer Reason</p>
              <p className="text-sm text-gray-800">{order.return_reason}</p>
            </div>
            {order.return_attachments && order.return_attachments.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 font-medium mb-1.5">Attached evidence</p>
                <div className="flex flex-wrap gap-2">
                  {order.return_attachments.map((a, i) => (
                    a.kind === 'image' ? (
                      <a key={i} href={mediaUrl(a.url)} target="_blank" rel="noopener noreferrer" className="block">
                        <img src={mediaUrl(a.url)} alt="" className="h-20 w-20 object-cover rounded-lg border" />
                      </a>
                    ) : (
                      <video key={i} src={mediaUrl(a.url)} controls className="max-h-32 max-w-full rounded-lg border" />
                    )
                  ))}
                </div>
              </div>
            )}
            {order.return_notes && (
              <div>
                <p className="text-xs text-gray-500 font-medium mb-0.5">Your Response</p>
                <p className="text-sm text-gray-800">{order.return_notes}</p>
              </div>
            )}
            {order.return_status === 'approved' && order.return_type === 'return' && (order.refund_amount ?? 0) > 0 && (
              <div>
                <p className="text-xs text-gray-500 font-medium mb-0.5">Refund Amount</p>
                <p className="text-sm font-bold text-green-700">{formatCurrency(order.refund_amount!)}</p>
              </div>
            )}
            {(order.return_tracking_number || order.return_tracking_url) && (
              <div className="bg-white rounded-lg border p-3 space-y-1">
                <p className="text-xs text-gray-500 font-medium">Return Tracking</p>
                {order.return_tracking_number && <p className="text-sm font-mono">{order.return_tracking_number}</p>}
                {order.return_tracking_url && (
                  <a href={order.return_tracking_url} target="_blank" rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1">
                    Track Return Shipment
                  </a>
                )}
              </div>
            )}
            <div className="flex gap-4 text-xs text-gray-500">
              {order.return_requested_at && <span>Requested: {formatDate(order.return_requested_at)}</span>}
              {order.return_resolved_at && <span>Resolved: {formatDate(order.return_resolved_at)}</span>}
            </div>

            {hasPendingReturn && (
              <div className="flex gap-3 pt-3 border-t">
                <Button
                  className="gap-2 bg-green-600 hover:bg-green-700"
                  disabled={resolveReturn.isPending}
                  onClick={() => {
                    setRefundAmount(String(order.total || 0))
                    setResolveNotes('')
                    setShowResolveModal('approve')
                  }}
                >
                  <CheckCircle className="w-4 h-4" /> Approve
                </Button>
                <Button
                  variant="outline"
                  className="gap-2 text-red-600 border-red-200 hover:bg-red-50"
                  disabled={resolveReturn.isPending}
                  onClick={() => {
                    setResolveNotes('')
                    setShowResolveModal('reject')
                  }}
                >
                  <XCircle className="w-4 h-4" /> Reject
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Vendor Initiate Return/Exchange */}
      {canInitiateReturn && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Return / Exchange</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-3">
            <p className="text-sm text-gray-600">
              Initiate a return or exchange request for this delivered order.
            </p>
            <Button
              variant="outline"
              className="gap-2"
              disabled={requestReturnExchange.isPending}
              onClick={() => {
                setInitiateType('return')
                setInitiateReason('')
                setInitiateAttachments([])
                setShowInitiateModal(true)
              }}
            >
              <RotateCcw className="w-4 h-4" /> Initiate Return/Exchange
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      {!isTerminal && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Update Status</CardTitle></CardHeader>
          <CardContent className="flex gap-3 flex-wrap">
            {order.status === 'pending' && (
              <Button onClick={() => handleStatusUpdate('confirmed')} disabled={updateStatus.isPending} className="gap-2">
                <Package className="w-4 h-4" /> Confirm Order
              </Button>
            )}
            {order.status === 'confirmed' && (
              <Button onClick={() => setShowShipModal(true)} disabled={updateStatus.isPending} className="gap-2">
                <Truck className="w-4 h-4" /> Mark Shipped
              </Button>
            )}
            {order.status === 'shipped' && (
              <Button onClick={() => handleStatusUpdate('delivered')} disabled={updateStatus.isPending} className="gap-2">
                <CheckCircle className="w-4 h-4" /> Mark Delivered
              </Button>
            )}
            {['pending', 'confirmed'].includes(order.status) && (
              <Button
                variant="outline"
                className="gap-2 text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50"
                disabled={updateStatus.isPending}
                onClick={() => {
                  setVendorCancelReason('')
                  setVendorCancelAttachments([])
                  setShowCancelConfirm(true)
                }}
              >
                <XCircle className="w-4 h-4" /> Cancel Order
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Customer Info */}
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><User className="w-4 h-4" /> Customer</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 text-blue-600 shrink-0">
              <User className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold">{order.customer_name || 'Unknown Customer'}</p>
              {order.customer_email && (
                <p className="text-sm text-gray-500 flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" />{order.customer_email}</p>
              )}
              {order.customer_phone && (
                <p className="text-sm text-gray-500 flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />{order.customer_phone}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Items ({order.item_count})</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {order.items.map((item: { image_url?: string; name: string; qty: number; price: number }, i: number) => (
              <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="flex items-center gap-3">
                  {item.image_url && <img src={mediaUrl(item.image_url)} alt={item.name} className="w-12 h-12 rounded object-cover" />}
                  <div>
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-gray-500">Qty: {item.qty} x {formatCurrency(item.price)}</p>
                  </div>
                </div>
                <p className="text-sm font-medium">{formatCurrency(item.price * item.qty)}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{formatCurrency(order.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Tax</span><span>{formatCurrency(order.tax_amount)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Shipping</span><span>{formatCurrency(order.shipping_amount)}</span></div>
            {order.discount_amount > 0 && <div className="flex justify-between"><span className="text-gray-500">Discount</span><span>-{formatCurrency(order.discount_amount)}</span></div>}
            <div className="flex justify-between font-bold text-base pt-2 border-t"><span>Total</span><span>{formatCurrency(order.total)}</span></div>
          </div>
        </CardContent>
      </Card>

      {/* Shipping & Tracking */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {order.shipping_address && (
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><MapPin className="w-4 h-4" /> Shipping Address</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm">{order.shipping_address.street_address}</p>
              <p className="text-sm">{order.shipping_address.city}, {order.shipping_address.state} {order.shipping_address.postal_code}</p>
              <p className="text-sm">{order.shipping_address.country}</p>
            </CardContent>
          </Card>
        )}

        {(order.tracking_number || order.tracking_url) && (
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Truck className="w-4 h-4" /> Tracking Info</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {order.tracking_number && (
                <div>
                  <p className="text-xs text-gray-500">Tracking Number</p>
                  <p className="text-sm font-medium">{order.tracking_number}</p>
                </div>
              )}
              {order.tracking_url && (
                <a href={order.tracking_url} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline">Track Shipment</a>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {order.notes && (
        <Card>
          <CardContent className="py-3 px-6">
            <p className="text-sm text-gray-600"><span className="font-medium">Notes:</span> {order.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Audit Log / Status History */}
      {order.status_history && order.status_history.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-gray-500" />
                <div>
                  <span className="font-semibold text-gray-900">Status History</span>
                  <span className="text-xs text-gray-400 ml-2">{order.status_history.length} changes</span>
                </div>
              </div>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate(`/orders/${order.id}/audit`)}>
                <FileDown className="w-4 h-4" />View Full Report
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ship Modal */}
      {showShipModal && (
        <ShipModal
          onClose={() => setShowShipModal(false)}
          onSubmit={(trackingNumber, trackingUrl) => {
            handleStatusUpdate('shipped', {
              tracking_number: trackingNumber || undefined,
              tracking_url: trackingUrl || undefined,
            })
            setShowShipModal(false)
          }}
          isPending={updateStatus.isPending}
        />
      )}

      {/* Cancel Confirm */}
      {showCancelConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => { setShowCancelConfirm(false); setVendorCancelReason(''); setVendorCancelAttachments([]) }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-2">Cancel Order?</h3>
            <p className="text-sm text-gray-600 mb-4">This will cancel order {order.order_number} and restore inventory. This action cannot be undone.</p>
            <div className="space-y-3 mb-4">
              <div>
                <Label>Reason for cancellation</Label>
                <textarea
                  className="w-full mt-1 rounded-lg border border-gray-300 p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  rows={3}
                  placeholder="Minimum 5 characters"
                  value={vendorCancelReason}
                  onChange={(e) => setVendorCancelReason(e.target.value)}
                />
              </div>
              <div>
                <Label>Photos or videos (optional, max {MAX_ORDER_MEDIA})</Label>
                <input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  disabled={vendorCancelUploading || vendorCancelAttachments.length >= MAX_ORDER_MEDIA}
                  className="mt-1 block w-full text-sm text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm"
                  onChange={async (e) => {
                    const files = e.target.files
                    if (!files?.length) return
                    setVendorCancelUploading(true)
                    try {
                      let n = vendorCancelAttachments.length
                      for (const file of Array.from(files)) {
                        if (n >= MAX_ORDER_MEDIA) break
                        const { url, kind } = await vendorApi.uploadOrderMedia(order.id, file)
                        setVendorCancelAttachments((prev) =>
                          prev.length >= MAX_ORDER_MEDIA ? prev : [...prev, { url, kind }],
                        )
                        n++
                      }
                    } finally {
                      setVendorCancelUploading(false)
                      e.target.value = ''
                    }
                  }}
                />
                {vendorCancelAttachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {vendorCancelAttachments.map((a, i) => (
                      <div key={`${a.url}-${i}`} className="relative">
                        {a.kind === 'image' ? (
                          <img src={mediaUrl(a.url)} alt="" className="h-16 w-16 object-cover rounded-lg border" />
                        ) : (
                          <video src={mediaUrl(a.url)} className="h-16 w-24 object-cover rounded-lg border" muted />
                        )}
                        <button
                          type="button"
                          className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full w-5 h-5 text-xs leading-5"
                          onClick={() => setVendorCancelAttachments((prev) => prev.filter((_, j) => j !== i))}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {vendorCancelUploading && <p className="text-xs text-gray-500 mt-1">Uploading…</p>}
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { setShowCancelConfirm(false); setVendorCancelReason(''); setVendorCancelAttachments([]) }}
              >
                Keep Order
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                disabled={
                  updateStatus.isPending ||
                  vendorCancelUploading ||
                  vendorCancelReason.trim().length < 5
                }
                onClick={() => {
                  handleStatusUpdate('cancelled', {
                    cancel_reason: vendorCancelReason.trim(),
                    cancel_attachments: vendorCancelAttachments.length ? vendorCancelAttachments : undefined,
                  })
                  setShowCancelConfirm(false)
                  setVendorCancelReason('')
                  setVendorCancelAttachments([])
                }}
              >
                {updateStatus.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Cancel Order
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Resolve Return/Exchange Modal */}
      {showResolveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowResolveModal(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">
                {showResolveModal === 'approve' ? 'Approve' : 'Reject'} {order.return_type === 'exchange' ? 'Exchange' : 'Return'}
              </h2>
              <button onClick={() => setShowResolveModal(null)} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <p className="font-medium text-gray-700 mb-1">Customer's reason:</p>
                <p className="text-gray-600">{order.return_reason}</p>
              </div>

              {showResolveModal === 'approve' && order.return_type === 'return' && (
                <div className="space-y-1.5">
                  <Label>Refund Amount</Label>
                  <Input
                    type="number"
                    min="0"
                    max={order.total}
                    step="0.01"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    placeholder={`Max: ${formatCurrency(order.total)}`}
                  />
                  <p className="text-xs text-gray-400">Order total: {formatCurrency(order.total)}</p>
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Notes to customer <span className="text-gray-400 font-normal">(optional)</span></Label>
                <textarea
                  className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  rows={3}
                  placeholder={showResolveModal === 'approve'
                    ? 'e.g. Please ship the item back to our address...'
                    : 'e.g. Return window has expired, item was used...'}
                  value={resolveNotes}
                  onChange={(e) => setResolveNotes(e.target.value)}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowResolveModal(null)}>Cancel</Button>
                <Button
                  className={`flex-1 gap-2 ${showResolveModal === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
                  disabled={resolveReturn.isPending}
                  onClick={() => {
                    resolveReturn.mutate({
                      id: order.id,
                      data: {
                        action: showResolveModal,
                        notes: resolveNotes.trim() || undefined,
                        refund_amount: showResolveModal === 'approve' && order.return_type === 'return' && refundAmount
                          ? parseFloat(refundAmount) : undefined,
                      },
                    }, { onSuccess: () => setShowResolveModal(null) })
                  }}
                >
                  {resolveReturn.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  {showResolveModal === 'approve' ? 'Approve' : 'Reject'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Initiate Return/Exchange Modal */}
      {showInitiateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => { setShowInitiateModal(false); setInitiateReason(''); setInitiateAttachments([]) }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">Initiate Return/Exchange</h2>
              <button
                type="button"
                onClick={() => { setShowInitiateModal(false); setInitiateReason(''); setInitiateAttachments([]) }}
                className="p-1 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="space-y-1.5">
                <Label>Request Type</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={initiateType === 'return' ? 'default' : 'outline'}
                    className="gap-2"
                    onClick={() => setInitiateType('return')}
                  >
                    <RotateCcw className="w-4 h-4" /> Return
                  </Button>
                  <Button
                    type="button"
                    variant={initiateType === 'exchange' ? 'default' : 'outline'}
                    className="gap-2"
                    onClick={() => setInitiateType('exchange')}
                  >
                    <Repeat className="w-4 h-4" /> Exchange
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Reason</Label>
                <textarea
                  className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  rows={4}
                  placeholder="Enter reason (minimum 5 characters)"
                  value={initiateReason}
                  onChange={(e) => setInitiateReason(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Photos or videos (optional, max {MAX_ORDER_MEDIA})</Label>
                <input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  disabled={initiateUploading || initiateAttachments.length >= MAX_ORDER_MEDIA}
                  className="block w-full text-sm text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm"
                  onChange={async (e) => {
                    const files = e.target.files
                    if (!files?.length) return
                    setInitiateUploading(true)
                    try {
                      let n = initiateAttachments.length
                      for (const file of Array.from(files)) {
                        if (n >= MAX_ORDER_MEDIA) break
                        const { url, kind } = await vendorApi.uploadOrderMedia(order.id, file)
                        setInitiateAttachments((prev) =>
                          prev.length >= MAX_ORDER_MEDIA ? prev : [...prev, { url, kind }],
                        )
                        n++
                      }
                    } finally {
                      setInitiateUploading(false)
                      e.target.value = ''
                    }
                  }}
                />
                {initiateAttachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {initiateAttachments.map((a, i) => (
                      <div key={`${a.url}-${i}`} className="relative">
                        {a.kind === 'image' ? (
                          <img src={mediaUrl(a.url)} alt="" className="h-16 w-16 object-cover rounded-lg border" />
                        ) : (
                          <video src={mediaUrl(a.url)} className="h-16 w-24 object-cover rounded-lg border" muted />
                        )}
                        <button
                          type="button"
                          className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full w-5 h-5 text-xs leading-5"
                          onClick={() => setInitiateAttachments((prev) => prev.filter((_, j) => j !== i))}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {initiateUploading && <p className="text-xs text-gray-500">Uploading…</p>}
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => { setShowInitiateModal(false); setInitiateReason(''); setInitiateAttachments([]) }}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 gap-2"
                  disabled={
                    requestReturnExchange.isPending ||
                    initiateReason.trim().length < 5 ||
                    initiateUploading
                  }
                  onClick={() => {
                    requestReturnExchange.mutate(
                      {
                        id: order.id,
                        data: {
                          return_type: initiateType,
                          reason: initiateReason.trim(),
                          attachments: initiateAttachments.length ? initiateAttachments : undefined,
                        },
                      },
                      {
                        onSuccess: () => {
                          setShowInitiateModal(false)
                          setInitiateReason('')
                          setInitiateAttachments([])
                        },
                      },
                    )
                  }}
                >
                  {requestReturnExchange.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Submit Request
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function InfoCard({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border p-4">
      <div className="flex items-center gap-2 text-gray-500 mb-1">
        <Icon className="w-4 h-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-sm font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-500 capitalize mt-0.5">{sub}</p>}
    </div>
  )
}

function ShipModal({ onClose, onSubmit, isPending }: {
  onClose: () => void
  onSubmit: (trackingNumber: string, trackingUrl: string) => void
  isPending: boolean
}) {
  const [trackingNumber, setTrackingNumber] = useState('')
  const [trackingUrl, setTrackingUrl] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Mark as Shipped</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="space-y-1.5">
            <Label>Tracking Number <span className="text-gray-400 font-normal">(optional)</span></Label>
            <Input value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="e.g. AWB1234567890" />
          </div>
          <div className="space-y-1.5">
            <Label>Tracking URL <span className="text-gray-400 font-normal">(optional)</span></Label>
            <Input value={trackingUrl} onChange={(e) => setTrackingUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-1 gap-2" disabled={isPending} onClick={() => onSubmit(trackingNumber, trackingUrl)}>
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              <Truck className="w-4 h-4" /> Confirm Shipment
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
