import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import type { OrderAttachmentRef } from '@/types'
import { OrderMediaUploader } from './OrderMediaUploader'

interface CancelOrderModalProps {
  orderId: string
  orderNumber: string
  reason: string
  onReasonChange: (reason: string) => void
  attachments: OrderAttachmentRef[]
  onAttachmentsChange: (attachments: OrderAttachmentRef[]) => void
  onClose: () => void
  onConfirm: () => void
  isPending: boolean
  maxAttachments?: number
}

export function CancelOrderModal({
  orderId, orderNumber, reason, onReasonChange, attachments, onAttachmentsChange,
  onClose, onConfirm, isPending, maxAttachments = 10,
}: CancelOrderModalProps) {
  return (
    <div data-kiterp-modal
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto"
      onClick={onClose}
    >
      <div className="bg-card border border-border text-foreground rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-2">Cancel Order?</h3>
        <p className="text-sm text-gray-600 mb-4">This will cancel order {orderNumber} and restore inventory. This action cannot be undone.</p>
        <div className="space-y-3 mb-4">
          <div>
            <Label>Reason for cancellation</Label>
            <textarea
              className="w-full mt-1 rounded-lg border border-gray-300 p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              rows={3}
              placeholder="Minimum 5 characters"
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
            />
          </div>
          <OrderMediaUploader
            orderId={orderId}
            attachments={attachments}
            onChange={onAttachmentsChange}
            max={maxAttachments}
          />
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Keep Order
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            disabled={isPending || reason.trim().length < 5}
            onClick={onConfirm}
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Cancel Order
          </Button>
        </div>
      </div>
    </div>
  )
}
