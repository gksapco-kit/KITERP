import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { ModalOverlay, ModalPanel, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { FieldLabel } from '@/components/common/FieldLabel'
import { extractApiError } from '@/lib/errorMessages'
import { formatCurrency, formatDate } from '@/lib/utils'
import { rentalApi } from './api'
import { todayLocalYMD } from './rentalDates'
import type { RentalAsset, RentalBooking } from './rentalConstants'

type Props = {
  booking: RentalBooking
  asset?: RentalAsset | null
  onClose: () => void
  onDone: (booking: RentalBooking) => void
}

export default function ReturnAssetModal({ booking, asset, onClose, onDone }: Props) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    quantity_returned: String(booking.quantity ?? 1),
    return_condition: 'good',
    damage_charge: '0',
    return_notes: '',
  })

  const settlement = useMemo(() => {
    const dailyRate = Number(asset?.daily_rate || 0)
    const end = booking.end_date ? new Date(`${String(booking.end_date).slice(0, 10)}T00:00:00`) : null
    const today = new Date(`${todayLocalYMD()}T00:00:00`)
    const daysLate = end && !Number.isNaN(end.getTime()) ? Math.max(0, Math.round((today.getTime() - end.getTime()) / 86_400_000)) : 0
    const lateFee = Math.round(daysLate * dailyRate * 100) / 100
    const damageCharge = Number(form.damage_charge) || 0
    const deposit = Number(booking.deposit_amount || 0)
    const depositRefund = Math.max(0, Math.round((deposit - damageCharge - lateFee) * 100) / 100)
    return { daysLate, lateFee, depositRefund, dailyRateKnown: dailyRate > 0 || daysLate === 0 }
  }, [asset?.daily_rate, booking.end_date, booking.deposit_amount, form.damage_charge])

  const processReturn = useMutation({
    mutationFn: (body: Record<string, unknown>) => rentalApi.processReturn(booking.id, body),
    onSuccess: (data) => {
      const isPartial = data.status === 'active'
      toast.success(isPartial ? 'Partial return recorded — booking remains active for remaining quantity' : 'Asset returned and booking completed')
      qc.invalidateQueries({ queryKey: ['rental-dashboard'] })
      qc.invalidateQueries({ queryKey: ['rental-assets'] })
      qc.invalidateQueries({ queryKey: ['rental-bookings'] })
      onDone(data)
    },
    onError: (e) => toast.error(extractApiError(e, 'Process return')),
  })

  const qtyReturned = Number(form.quantity_returned)
  const isPartialQty = qtyReturned > 0 && qtyReturned < Number(booking.quantity ?? 1)

  const submit = () => {
    if (!qtyReturned || qtyReturned <= 0) {
      toast.error('Enter the quantity being returned')
      return
    }
    processReturn.mutate({
      quantity_returned: qtyReturned,
      return_condition: form.return_condition,
      damage_charge: Number(form.damage_charge) || 0,
      return_notes: form.return_notes || undefined,
    })
  }

  return (
    <ModalOverlay onClose={() => { if (!processReturn.isPending) onClose() }}>
      <ModalPanel className="max-w-md">
        <ModalHeader title={`Return Asset — ${booking.booking_number || `#${booking.id.slice(0, 6)}`}`} onClose={onClose} />
        <ModalBody>
          <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
            <span>Booked qty: <strong className="text-foreground">{booking.quantity}</strong></span>
            <span>Asset: <strong className="text-foreground">{booking.asset_name || '—'}</strong></span>
            <span>End date: <strong className="text-foreground">{formatDate(booking.end_date)}</strong></span>
            <span>Deposit: <strong className="text-foreground">{formatCurrency(Number(booking.deposit_amount || 0))}</strong></span>
          </div>

          <div>
            <FieldLabel>Quantity returned</FieldLabel>
            <Input
              type="number"
              min="0.01"
              max={String(booking.quantity ?? 1)}
              step="0.01"
              value={form.quantity_returned}
              onChange={(e) => setForm((f) => ({ ...f, quantity_returned: e.target.value }))}
            />
            {isPartialQty && (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                Partial return — {Number(booking.quantity ?? 1) - qtyReturned} unit(s) will remain active.
              </p>
            )}
          </div>

          <div>
            <FieldLabel>Return condition</FieldLabel>
            <Select
              value={form.return_condition}
              onChange={(v) => setForm((f) => ({ ...f, return_condition: v }))}
              options={[
                { value: 'good', label: 'Good — no issues' },
                { value: 'damaged', label: 'Damaged — charge applies' },
                { value: 'missing', label: 'Missing / not returned' },
              ]}
            />
          </div>

          <div>
            <FieldLabel>Damage charge (₹)</FieldLabel>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.damage_charge}
              onChange={(e) => setForm((f) => ({ ...f, damage_charge: e.target.value }))}
            />
          </div>

          <div>
            <FieldLabel>Return notes</FieldLabel>
            <Input
              placeholder="Any remarks about the return…"
              value={form.return_notes}
              onChange={(e) => setForm((f) => ({ ...f, return_notes: e.target.value }))}
            />
          </div>

          <div className="space-y-1 rounded-lg border border-sky-200 bg-sky-500/10 px-3 py-2 text-xs text-sky-900 dark:border-sky-800/60 dark:text-sky-200">
            <p className="font-medium">Settlement preview</p>
            {settlement.daysLate > 0 ? (
              <p>
                {settlement.dailyRateKnown
                  ? `Late by ${settlement.daysLate} day(s) · Est. late fee ${formatCurrency(settlement.lateFee)}`
                  : `Late by ${settlement.daysLate} day(s) · late fee calculated on save`}
              </p>
            ) : (
              <p>On time — no late fee.</p>
            )}
            <p>Est. deposit refund = {formatCurrency(settlement.depositRefund)} (deposit − damage − late fee)</p>
            <p className="text-sky-700/80 dark:text-sky-300/70">Final amounts are recalculated on the server when you confirm.</p>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" size="sm" disabled={processReturn.isPending} onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={processReturn.isPending || !form.quantity_returned} onClick={submit}>
            {processReturn.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm Return'}
          </Button>
        </ModalFooter>
      </ModalPanel>
    </ModalOverlay>
  )
}
