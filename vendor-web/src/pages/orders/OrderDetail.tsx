import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { StaffPickerValue } from '@/components/commission/StaffPicker'
import { OrderHeaderCard } from '@/components/orders/OrderHeaderCard'
import { OrderItemsPanel } from '@/components/orders/OrderItemsPanel'
import { CustomerShippingPanel } from '@/components/orders/CustomerShippingPanel'
import { DeliveryStaffPanel } from '@/components/orders/DeliveryStaffPanel'
import { ShipModal } from '@/components/orders/ShipModal'
import { CancelOrderModal } from '@/components/orders/CancelOrderModal'
import { ResolveReturnModal } from '@/components/orders/ResolveReturnModal'
import { InitiateReturnModal } from '@/components/orders/InitiateReturnModal'
import {
  useOrder,
  useUpdateOrderStatus,
  useResolveReturn,
  useOrderInvoice,
  useRequestReturnExchange,
} from '@/hooks/useVendor'
import { vendorApi } from '@/api/vendor'
import type { OrderAttachmentRef } from '@/types'
import { Loader2, CheckCircle, XCircle, RotateCcw, Repeat, MessageSquare } from 'lucide-react'

const MAX_ORDER_MEDIA = 10

/** Narrow shape we rely on from the invoice-by-order lookup (full Invoice type lives in the finance module). */
interface OrderInvoiceRef {
  id: string
  invoice_number: string
}

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: order, isLoading } = useOrder(id!)
  const updateStatus = useUpdateOrderStatus()
  const resolveReturn = useResolveReturn()
  const requestReturnExchange = useRequestReturnExchange()
  const { data: invoice } = useOrderInvoice(id!) as { data: OrderInvoiceRef | undefined }

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
  const [initiateAttachments, setInitiateAttachments] = useState<OrderAttachmentRef[]>([])
  const [selectedDeliveryStaff, setSelectedDeliveryStaff] = useState<StaffPickerValue | null>(null)
  const [assigningDelivery, setAssigningDelivery] = useState(false)
  const [deliveryStaffExpanded, setDeliveryStaffExpanded] = useState(false)

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
  if (!order) return <p className="text-center py-20 text-gray-500">Order not found</p>

  const handleStatusUpdate = (status: string, extra?: Record<string, unknown>) => {
    updateStatus.mutate({ id: order.id, data: { status, ...extra } })
  }

  const isBooking = order.source === 'booking'
  const isTerminal = ['delivered', 'cancelled', 'refunded', 'returned', 'exchanged', 'return_requested', 'exchange_requested'].includes(order.status)
  const hasPendingReturn = order.return_status === 'requested'
  const hasReturnInfo = !!order.return_status
  const canInitiateReturn = order.status === 'delivered' && !isBooking && !['requested', 'approved'].includes(order.return_status || '')

  // Extract booking info from first item (set when booking created order)
  const bookingItem = isBooking ? order.items?.[0] : undefined
  const bookingId = bookingItem?.booking_id
  const bookingNumber = bookingItem?.booking_number
  const bookingDate = bookingItem?.booking_date

  const assignDeliveryStaff = async () => {
    if (!selectedDeliveryStaff) return
    setAssigningDelivery(true)
    try {
      await vendorApi.assignOrderDelivery(order.id, {
        staff_id: selectedDeliveryStaff.id,
        staff_name: selectedDeliveryStaff.full_name,
      })
      toast.success('Delivery staff assigned')
      setSelectedDeliveryStaff(null)
      setDeliveryStaffExpanded(false)
      qc.invalidateQueries({ queryKey: ['order', order.id] })
    } catch {
      toast.error('Could not assign delivery staff')
    } finally {
      setAssigningDelivery(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 max-w-full">
      <OrderHeaderCard
        order={order}
        invoice={invoice}
        isBooking={isBooking}
        isQuote={order.source === 'quote'}
        isTerminal={isTerminal}
        isCancelled={order.status === 'cancelled'}
        bookingId={bookingId}
        bookingNumber={bookingNumber}
        bookingDate={bookingDate}
        updateStatusPending={updateStatus.isPending}
        onBack={() => navigate('/orders')}
        onConfirm={() => handleStatusUpdate('confirmed')}
        onShip={() => setShowShipModal(true)}
        onDeliver={() => handleStatusUpdate('delivered')}
        onCancelClick={() => { setVendorCancelReason(''); setVendorCancelAttachments([]); setShowCancelConfirm(true) }}
        onViewInvoice={(invoiceId) => navigate(`/invoices/${invoiceId}`)}
        onViewBooking={(id) => navigate(`/bookings/${id}`)}
        onViewAuditHistory={() => navigate(`/orders/${order.id}/audit`)}
      />

      {/* Quote Request Banner */}
      {order.source === 'quote' && (
        <div className="shrink-0 rounded-lg border border-primary/30 bg-accent px-3 py-2 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0 text-xs text-primary">
            <MessageSquare className="w-4 h-4 shrink-0" />
            <span><strong>Quote:</strong> {order.items?.[0]?.name || 'Service'}{order.notes ? ` — ${order.notes.slice(0, 80)}${order.notes.length > 80 ? '…' : ''}` : ''}</span>
          </div>
          {order.status === 'quote_requested' && (
            <div className="flex gap-1.5 shrink-0">
              <Button size="sm" className="h-7 text-xs bg-primary hover:bg-primary/90 text-white" onClick={() => handleStatusUpdate('confirmed')}>
                Accept
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs"
                onClick={() => { setVendorCancelReason('Quote declined'); setShowCancelConfirm(true) }}>
                Decline
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Return / Exchange status banner */}
      {hasReturnInfo && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${
          order.return_status === 'requested' ? 'border-amber-300 bg-amber-50' :
          order.return_status === 'approved' ? 'border-green-300 bg-green-50' :
          order.return_status === 'rejected' ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-card'
        }`}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="font-semibold flex items-center gap-1.5">
              {order.return_type === 'exchange' ? <Repeat className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
              {order.return_type === 'exchange' ? 'Exchange' : 'Return'} request · <span className="capitalize">{order.return_status}</span>
            </span>
            {hasPendingReturn && (
              <div className="flex gap-2">
                <Button size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700" disabled={resolveReturn.isPending}
                  onClick={() => { setRefundAmount(String(order.total || 0)); setResolveNotes(''); setShowResolveModal('approve') }}>
                  <CheckCircle className="w-4 h-4" /> Approve
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5 text-red-600 border-red-200" disabled={resolveReturn.isPending}
                  onClick={() => { setResolveNotes(''); setShowResolveModal('reject') }}>
                  <XCircle className="w-4 h-4" /> Reject
                </Button>
              </div>
            )}
          </div>
          {order.return_reason && <p className="text-gray-700 mt-2">{order.return_reason}</p>}
        </div>
      )}

      {/* Initiate return/exchange CTA */}
      {canInitiateReturn && (
        <div className="flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-2.5 text-sm">
          <span className="text-gray-600">This order is eligible for a return or exchange.</span>
          <Button variant="outline" size="sm" className="gap-1.5 shrink-0" disabled={requestReturnExchange.isPending}
            onClick={() => { setInitiateType('return'); setInitiateReason(''); setInitiateAttachments([]); setShowInitiateModal(true) }}>
            <RotateCcw className="w-4 h-4" /> Initiate Return/Exchange
          </Button>
        </div>
      )}

      <Card className="shadow-sm overflow-hidden">
        <div className="grid grid-cols-1 xl:grid-cols-12 xl:divide-x xl:min-h-[280px]">
          <OrderItemsPanel order={order} />
          <CustomerShippingPanel order={order} />
          <DeliveryStaffPanel
            order={order}
            isBooking={isBooking}
            isTerminal={isTerminal}
            expanded={deliveryStaffExpanded}
            onToggleExpanded={() => setDeliveryStaffExpanded((v) => !v)}
            selectedStaff={selectedDeliveryStaff}
            onSelectStaff={setSelectedDeliveryStaff}
            assigning={assigningDelivery}
            onAssign={assignDeliveryStaff}
          />
        </div>
      </Card>

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

      {showCancelConfirm && (
        <CancelOrderModal
          orderId={order.id}
          orderNumber={order.order_number}
          reason={vendorCancelReason}
          onReasonChange={setVendorCancelReason}
          attachments={vendorCancelAttachments}
          onAttachmentsChange={setVendorCancelAttachments}
          maxAttachments={MAX_ORDER_MEDIA}
          isPending={updateStatus.isPending}
          onClose={() => { setShowCancelConfirm(false); setVendorCancelReason(''); setVendorCancelAttachments([]) }}
          onConfirm={() => {
            handleStatusUpdate('cancelled', {
              cancel_reason: vendorCancelReason.trim(),
              cancel_attachments: vendorCancelAttachments.length ? vendorCancelAttachments : undefined,
            })
            setShowCancelConfirm(false)
            setVendorCancelReason('')
            setVendorCancelAttachments([])
          }}
        />
      )}

      {showResolveModal && (
        <ResolveReturnModal
          action={showResolveModal}
          returnType={order.return_type}
          returnReason={order.return_reason}
          orderTotal={order.total}
          refundAmount={refundAmount}
          onRefundAmountChange={setRefundAmount}
          notes={resolveNotes}
          onNotesChange={setResolveNotes}
          isPending={resolveReturn.isPending}
          onClose={() => setShowResolveModal(null)}
          onSubmit={() => {
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
        />
      )}

      {showInitiateModal && (
        <InitiateReturnModal
          orderId={order.id}
          returnType={initiateType}
          onReturnTypeChange={setInitiateType}
          reason={initiateReason}
          onReasonChange={setInitiateReason}
          attachments={initiateAttachments}
          onAttachmentsChange={setInitiateAttachments}
          maxAttachments={MAX_ORDER_MEDIA}
          isPending={requestReturnExchange.isPending}
          onClose={() => { setShowInitiateModal(false); setInitiateReason(''); setInitiateAttachments([]) }}
          onSubmit={() => {
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
        />
      )}
    </div>
  )
}
