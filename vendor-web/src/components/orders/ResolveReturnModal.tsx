import { Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn, formatCurrency } from '@/lib/utils'
import {
  dialogOverlayClass,
  dialogPanelClass,
  dialogHeaderClass,
  dialogBodyClass,
  dialogFooterClass,
} from '@/lib/modalUi'

interface ResolveReturnModalProps {
  action: 'approve' | 'reject'
  returnType?: string
  returnReason?: string
  orderTotal: number
  refundAmount: string
  onRefundAmountChange: (value: string) => void
  notes: string
  onNotesChange: (value: string) => void
  onClose: () => void
  onSubmit: () => void
  isPending: boolean
}

export function ResolveReturnModal({
  action, returnType, returnReason, orderTotal, refundAmount, onRefundAmountChange,
  notes, onNotesChange, onClose, onSubmit, isPending,
}: ResolveReturnModalProps) {
  const isApprove = action === 'approve'
  const label = returnType === 'exchange' ? 'Exchange' : 'Return'

  return (
    <div data-kiterp-modal className={dialogOverlayClass} onClick={onClose}>
      <div
        className={cn(dialogPanelClass, 'max-w-md')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={cn(dialogHeaderClass, 'flex items-center justify-between')}>
          <h2 className="text-lg font-semibold">
            {isApprove ? 'Approve' : 'Reject'} {label}
          </h2>
          <button type="button" aria-label="Close" onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" /></button>
        </div>
        <div className={cn(dialogBodyClass, 'space-y-4')}>
          <div className="bg-gray-50 rounded-lg p-3 text-sm">
            <p className="font-medium text-gray-700 mb-1">Customer's reason:</p>
            <p className="text-gray-600">{returnReason}</p>
          </div>

          {isApprove && returnType === 'return' && (
            <div className="space-y-1.5">
              <Label>Refund Amount</Label>
              <Input
                type="number"
                min="0"
                max={orderTotal}
                step="0.01"
                value={refundAmount}
                onChange={(e) => onRefundAmountChange(e.target.value)}
                placeholder={`Max: ${formatCurrency(orderTotal)}`}
              />
              <p className="text-xs text-gray-400">Order total: {formatCurrency(orderTotal)}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Notes to customer <span className="text-gray-400 font-normal">(optional)</span></Label>
            <textarea
              className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              rows={3}
              placeholder={isApprove
                ? 'e.g. Please ship the item back to our address...'
                : 'e.g. Return window has expired, item was used...'}
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
            />
          </div>
        </div>
        <div className={cn(dialogFooterClass, 'gap-3')}>
          <Button variant="cancel" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button
            className={`flex-1 gap-2 ${isApprove ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
            disabled={isPending}
            onClick={onSubmit}
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {isApprove ? 'Approve' : 'Reject'}
          </Button>
        </div>
      </div>
    </div>
  )
}
