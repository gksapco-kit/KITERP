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
import { Loader2, CheckCircle, XCircle, RotateCcw, Repeat, MessageSquare, X, ZoomIn, ShieldCheck } from 'lucide-react'

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
  const [paymentReviewNotes, setPaymentReviewNotes] = useState('')
  const [reviewingPayment, setReviewingPayment] = useState(false)
  const [showProofPreview, setShowProofPreview] = useState(false)
  const [showApproveConfirm, setShowApproveConfirm] = useState(false)
  const [approveConfirmText, setApproveConfirmText] = useState('')
  const [showPayLaterApproveConfirm, setShowPayLaterApproveConfirm] = useState(false)
  const [payLaterApproveText, setPayLaterApproveText] = useState('')
  const [approvingPayLater, setApprovingPayLater] = useState(false)

  const pendingUpiProof =
    order?.payment_method === 'upi'
    && order?.payment_status === 'pending_verification'
    && order?.payment_proof?.status === 'submitted'

  /** Kept after approve/reject — backend stores proof permanently; show for future reference. */
  const upiPaymentHistory =
    order?.payment_method === 'upi'
    && !!order?.payment_proof
    && !pendingUpiProof

  const pendingPayLater =
    order?.payment_method === 'pay_later'
    && order?.status === 'pending'

  const reviewPayment = async (action: 'approve' | 'reject') => {
    if (!order) return
    setReviewingPayment(true)
    try {
      if (action === 'approve') {
        await vendorApi.approveOrderPayment(order.id, paymentReviewNotes ? { notes: paymentReviewNotes } : undefined)
        toast.success('Payment approved — order confirmed')
      } else {
        await vendorApi.rejectOrderPayment(order.id, paymentReviewNotes ? { notes: paymentReviewNotes } : undefined)
        toast.success('Payment rejected')
      }
      setPaymentReviewNotes('')
      setShowApproveConfirm(false)
      setApproveConfirmText('')
      qc.invalidateQueries({ queryKey: ['order', order.id] })
    } catch {
      toast.error(action === 'approve' ? 'Could not approve payment' : 'Could not reject payment')
    } finally {
      setReviewingPayment(false)
    }
  }

  const approvePayLaterOrder = () => {
    if (!order) return
    setApprovingPayLater(true)
    updateStatus.mutate(
      { id: order.id, data: { status: 'confirmed', notes: 'Pay later order approved by vendor' } },
      {
        onSuccess: () => {
          setShowPayLaterApproveConfirm(false)
          setPayLaterApproveText('')
        },
        onSettled: () => setApprovingPayLater(false),
      },
    )
  }

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
        onConfirm={() => {
          if (pendingPayLater) {
            setPayLaterApproveText('')
            setShowPayLaterApproveConfirm(true)
            return
          }
          handleStatusUpdate('confirmed')
        }}
        onShip={() => setShowShipModal(true)}
        onDeliver={() => handleStatusUpdate('delivered')}
        onCancelClick={() => { setVendorCancelReason(''); setVendorCancelAttachments([]); setShowCancelConfirm(true) }}
        onViewInvoice={(invoiceId) => navigate(`/invoices/${invoiceId}`)}
        onViewBooking={(id) => navigate(`/bookings/${id}`)}
        onViewAuditHistory={() => navigate(`/orders/${order.id}/audit`)}
      />

      {pendingPayLater && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-semibold text-amber-900">Pay later order awaiting your approval</p>
              <p className="mt-1 text-amber-800">
                The customer placed this order with Pay later (no payment at checkout).
                Review the details below, then click <strong>Approve</strong>. The order is confirmed only after you approve.
              </p>
            </div>
            <Button
              size="sm"
              className="shrink-0 gap-1.5"
              disabled={approvingPayLater || updateStatus.isPending}
              onClick={() => { setPayLaterApproveText(''); setShowPayLaterApproveConfirm(true) }}
            >
              <ShieldCheck className="h-4 w-4" />
              Approve
            </Button>
          </div>
        </div>
      )}

      {pendingUpiProof && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm">
          <p className="font-semibold text-amber-900">UPI payment awaiting your approval</p>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-[auto_1fr]">
            {/* Screenshot thumbnail — click to enlarge */}
            {order.payment_proof?.screenshot_url ? (
              <button
                type="button"
                onClick={() => setShowProofPreview(true)}
                className="group relative h-28 w-28 shrink-0 overflow-hidden rounded-lg border border-amber-300 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                aria-label="View payment screenshot"
              >
                <img
                  src={order.payment_proof.screenshot_url}
                  alt="UPI payment screenshot"
                  className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                />
                <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/40">
                  <ZoomIn className="h-6 w-6 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                </span>
              </button>
            ) : (
              <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-lg border border-dashed border-amber-300 bg-white text-center text-xs text-amber-700">
                No screenshot
              </div>
            )}

            <div className="flex min-w-0 flex-col">
              <p className="text-amber-800">
                UTR: <strong>{order.payment_proof?.utr}</strong>
              </p>
              {order.payment_proof?.submitted_at && (
                <p className="mt-0.5 text-xs text-amber-700">
                  Submitted {new Date(order.payment_proof.submitted_at).toLocaleString()}
                </p>
              )}
              <div className="mt-auto flex flex-wrap items-end gap-2 pt-3">
                <input
                  value={paymentReviewNotes}
                  onChange={(e) => setPaymentReviewNotes(e.target.value)}
                  placeholder="Notes (optional)"
                  className="min-w-[200px] flex-1 rounded border px-2 py-1.5 text-sm"
                />
                <Button size="sm" disabled={reviewingPayment} onClick={() => { setApproveConfirmText(''); setShowApproveConfirm(true) }}>
                  Approve payment
                </Button>
                <Button size="sm" variant="outline" disabled={reviewingPayment} onClick={() => void reviewPayment('reject')}>
                  Reject
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Permanent UPI payment history — remains after approve/reject for future reference */}
      {upiPaymentHistory && order.payment_proof && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            order.payment_proof.status === 'approved'
              ? 'border-green-300 bg-green-50'
              : order.payment_proof.status === 'rejected'
                ? 'border-red-200 bg-red-50'
                : 'border-gray-200 bg-card'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p
              className={`font-semibold ${
                order.payment_proof.status === 'approved'
                  ? 'text-green-900'
                  : order.payment_proof.status === 'rejected'
                    ? 'text-red-900'
                    : 'text-gray-900'
              }`}
            >
              UPI payment details
            </p>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                order.payment_proof.status === 'approved'
                  ? 'bg-green-100 text-green-800'
                  : order.payment_proof.status === 'rejected'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-gray-100 text-gray-700'
              }`}
            >
              {order.payment_proof.status || 'recorded'}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-[auto_1fr]">
            {order.payment_proof.screenshot_url ? (
              <button
                type="button"
                onClick={() => setShowProofPreview(true)}
                className={`group relative h-28 w-28 shrink-0 overflow-hidden rounded-lg border bg-white shadow-sm focus:outline-none focus:ring-2 ${
                  order.payment_proof.status === 'approved'
                    ? 'border-green-300 focus:ring-green-400'
                    : order.payment_proof.status === 'rejected'
                      ? 'border-red-300 focus:ring-red-400'
                      : 'border-gray-300 focus:ring-gray-400'
                }`}
                aria-label="View payment screenshot"
              >
                <img
                  src={order.payment_proof.screenshot_url}
                  alt="UPI payment screenshot"
                  className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                />
                <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/40">
                  <ZoomIn className="h-6 w-6 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                </span>
              </button>
            ) : (
              <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white text-center text-xs text-gray-500">
                No screenshot
              </div>
            )}

            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-gray-800">
                UTR / Transaction ID:{' '}
                <strong className="font-mono">{order.payment_proof.utr || order.payment_reference || '—'}</strong>
              </p>
              {order.payment_proof.submitted_at && (
                <p className="text-xs text-gray-600">
                  Submitted {new Date(order.payment_proof.submitted_at).toLocaleString()}
                </p>
              )}
              {order.payment_proof.reviewed_at && (
                <p className="text-xs text-gray-600">
                  Reviewed {new Date(order.payment_proof.reviewed_at).toLocaleString()}
                </p>
              )}
              {order.payment_proof.review_notes && (
                <p className="mt-1 text-xs text-gray-700">
                  Notes: {order.payment_proof.review_notes}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

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

      {/* Payment screenshot lightbox */}
      {showProofPreview && order.payment_proof?.screenshot_url && (
        <div
          data-kiterp-modal
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setShowProofPreview(false)}
        >
          <button
            type="button"
            aria-label="Close preview"
            onClick={() => setShowProofPreview(false)}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <X className="h-6 w-6" />
          </button>
          <img
            src={order.payment_proof.screenshot_url}
            alt="UPI payment screenshot"
            className="max-h-[90vh] max-w-full rounded-lg object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Approve payment confirmation — requires typing "approved" */}
      {showApproveConfirm && (
        <div
          data-kiterp-modal
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50"
          onClick={() => { if (!reviewingPayment) { setShowApproveConfirm(false); setApproveConfirmText('') } }}
        >
          <div
            className="mx-4 w-full max-w-md overflow-y-auto rounded-xl border border-border bg-card text-foreground shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <ShieldCheck className="h-5 w-5 text-green-600" /> Confirm payment approval
              </h2>
              <button
                type="button"
                aria-label="Close"
                disabled={reviewingPayment}
                onClick={() => { setShowApproveConfirm(false); setApproveConfirmText('') }}
                className="rounded-lg p-1 hover:bg-gray-100 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 px-6 py-5">
              <p className="text-sm text-gray-600">
                Approving this payment will <strong>confirm the order</strong>. This action cannot be undone.
                To continue, type <strong>approved</strong> in the box below.
              </p>
              <input
                autoFocus
                value={approveConfirmText}
                onChange={(e) => setApproveConfirmText(e.target.value)}
                placeholder="Type approved"
                className="w-full rounded border px-3 py-2 text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && approveConfirmText.trim().toLowerCase() === 'approved' && !reviewingPayment) {
                    void reviewPayment('approve')
                  }
                }}
              />
              <div className="flex gap-3 pt-1">
                <Button
                  variant="cancel"
                  className="flex-1"
                  disabled={reviewingPayment}
                  onClick={() => { setShowApproveConfirm(false); setApproveConfirmText('') }}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 gap-2"
                  disabled={reviewingPayment || approveConfirmText.trim().toLowerCase() !== 'approved'}
                  onClick={() => void reviewPayment('approve')}
                >
                  {reviewingPayment && <Loader2 className="h-4 w-4 animate-spin" />}
                  OK, confirm order
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pay later approval confirmation — requires typing "approved" */}
      {showPayLaterApproveConfirm && (
        <div
          data-kiterp-modal
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50"
          onClick={() => {
            if (!approvingPayLater) {
              setShowPayLaterApproveConfirm(false)
              setPayLaterApproveText('')
            }
          }}
        >
          <div
            className="mx-4 w-full max-w-md overflow-y-auto rounded-xl border border-border bg-card text-foreground shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <ShieldCheck className="h-5 w-5 text-green-600" /> Approve Pay later order
              </h2>
              <button
                type="button"
                aria-label="Close"
                disabled={approvingPayLater}
                onClick={() => { setShowPayLaterApproveConfirm(false); setPayLaterApproveText('') }}
                className="rounded-lg p-1 hover:bg-gray-100 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 px-6 py-5">
              <p className="text-sm text-gray-600">
                Approving will <strong>confirm order {order.order_number}</strong>. Payment is still due later.
                This action cannot be undone. To continue, type <strong>approved</strong> below.
              </p>
              <input
                autoFocus
                value={payLaterApproveText}
                onChange={(e) => setPayLaterApproveText(e.target.value)}
                placeholder="Type approved"
                className="w-full rounded border px-3 py-2 text-sm"
                onKeyDown={(e) => {
                  if (
                    e.key === 'Enter'
                    && payLaterApproveText.trim().toLowerCase() === 'approved'
                    && !approvingPayLater
                  ) {
                    approvePayLaterOrder()
                  }
                }}
              />
              <div className="flex gap-3 pt-1">
                <Button
                  variant="cancel"
                  className="flex-1"
                  disabled={approvingPayLater}
                  onClick={() => { setShowPayLaterApproveConfirm(false); setPayLaterApproveText('') }}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 gap-2"
                  disabled={approvingPayLater || payLaterApproveText.trim().toLowerCase() !== 'approved'}
                  onClick={approvePayLaterOrder}
                >
                  {approvingPayLater && <Loader2 className="h-4 w-4 animate-spin" />}
                  Approve order
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
