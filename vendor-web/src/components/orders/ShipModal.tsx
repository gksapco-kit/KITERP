import { useState } from 'react'
import { Loader2, Truck, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  dialogOverlayClass,
  dialogPanelClass,
  dialogHeaderClass,
  dialogBodyClass,
  dialogFooterClass,
} from '@/lib/modalUi'

interface ShipModalProps {
  onClose: () => void
  onSubmit: (trackingNumber: string, trackingUrl: string) => void
  isPending: boolean
}

export function ShipModal({ onClose, onSubmit, isPending }: ShipModalProps) {
  const [trackingNumber, setTrackingNumber] = useState('')
  const [trackingUrl, setTrackingUrl] = useState('')

  return (
    <div data-kiterp-modal className={dialogOverlayClass} onClick={onClose}>
      <div
        className={cn(dialogPanelClass, 'max-w-md')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={cn(dialogHeaderClass, 'flex items-center justify-between')}>
          <h2 className="text-lg font-semibold">Mark as Shipped</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>
        <div className={cn(dialogBodyClass, 'space-y-4')}>
          <div className="space-y-1.5">
            <Label>Tracking Number <span className="text-gray-400 font-normal">(optional)</span></Label>
            <Input value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="e.g. AWB1234567890" />
          </div>
          <div className="space-y-1.5">
            <Label>Tracking URL <span className="text-gray-400 font-normal">(optional)</span></Label>
            <Input value={trackingUrl} onChange={(e) => setTrackingUrl(e.target.value)} placeholder="https://..." />
          </div>
        </div>
        <div className={cn(dialogFooterClass, 'gap-3')}>
          <Button variant="cancel" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1 gap-2" disabled={isPending} onClick={() => onSubmit(trackingNumber, trackingUrl)}>
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            <Truck className="w-4 h-4" /> Confirm Shipment
          </Button>
        </div>
      </div>
    </div>
  )
}
