import { useState } from 'react'
import { Loader2, Truck, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface ShipModalProps {
  onClose: () => void
  onSubmit: (trackingNumber: string, trackingUrl: string) => void
  isPending: boolean
}

export function ShipModal({ onClose, onSubmit, isPending }: ShipModalProps) {
  const [trackingNumber, setTrackingNumber] = useState('')
  const [trackingUrl, setTrackingUrl] = useState('')

  return (
    <div data-kiterp-modal className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto" onClick={onClose}>
      <div className="bg-card border border-border text-foreground rounded-xl shadow-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Mark as Shipped</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
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
            <Button variant="cancel" className="flex-1" onClick={onClose}>Cancel</Button>
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
