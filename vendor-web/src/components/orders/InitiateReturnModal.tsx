import { Loader2, RotateCcw, Repeat, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import type { OrderAttachmentRef } from '@/types'
import { OrderMediaUploader } from './OrderMediaUploader'

interface InitiateReturnModalProps {
  orderId: string
  returnType: 'return' | 'exchange'
  onReturnTypeChange: (type: 'return' | 'exchange') => void
  reason: string
  onReasonChange: (reason: string) => void
  attachments: OrderAttachmentRef[]
  onAttachmentsChange: (attachments: OrderAttachmentRef[]) => void
  onClose: () => void
  onSubmit: () => void
  isPending: boolean
  maxAttachments?: number
}

export function InitiateReturnModal({
  orderId, returnType, onReturnTypeChange, reason, onReasonChange,
  attachments, onAttachmentsChange, onClose, onSubmit, isPending, maxAttachments = 10,
}: InitiateReturnModalProps) {
  return (
    <div data-kiterp-modal
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto"
      onClick={onClose}
    >
      <div className="bg-card border border-border text-foreground rounded-xl shadow-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Initiate Return/Exchange</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="space-y-1.5">
            <Label>Request Type</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={returnType === 'return' ? 'default' : 'outline'}
                className="gap-2"
                onClick={() => onReturnTypeChange('return')}
              >
                <RotateCcw className="w-4 h-4" /> Return
              </Button>
              <Button
                type="button"
                variant={returnType === 'exchange' ? 'default' : 'outline'}
                className="gap-2"
                onClick={() => onReturnTypeChange('exchange')}
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

          <div className="flex gap-3 pt-2">
            <Button variant="cancel" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button
              className="flex-1 gap-2"
              disabled={isPending || reason.trim().length < 5}
              onClick={onSubmit}
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Submit Request
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
