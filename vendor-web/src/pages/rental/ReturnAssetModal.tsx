import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
import type { RentalAsset, RentalAssetUnit, RentalBooking } from './rentalConstants'

type Props = {
  booking: RentalBooking
  asset?: RentalAsset | null
  onClose: () => void
  onDone: (booking: RentalBooking) => void
}

export default function ReturnAssetModal({ booking, asset, onClose, onDone }: Props) {
  const qc = useQueryClient()

  // outstanding = originally booked minus already returned (server provides this, but derive locally too)
  const outstandingQty = Math.max(
    0,
    Number(booking.outstanding_quantity ?? (Number(booking.quantity ?? 1) - Number(booking.quantity_returned ?? 0))),
  )

  const [form, setForm] = useState({
    quantity_returned: String(outstandingQty || 1),
    return_condition: 'good',
    damage_charge: '0',
    return_notes: '',
  })

  // For serialized assets: fetch all units and allow selecting which are being returned
  const isSerializedAsset = asset?.unit_mode === 'serialized'
  const { data: allUnits = [] } = useQuery<RentalAssetUnit[]>({
    queryKey: ['rental-asset-units', asset?.id],
    queryFn: () => rentalApi.listAssetUnits(asset!.id),
    enabled: isSerializedAsset && Boolean(asset?.id),
  })
  // Only show units that are currently rented (not available)
  const rentedUnits = allUnits.filter((u) => u.status === 'rented')
  const [selectedUnitIds, setSelectedUnitIds] = useState<Set<string>>(new Set())

  const toggleUnit = (unitId: string) =>
    setSelectedUnitIds((prev) => {
      const next = new Set(prev)
      if (next.has(unitId)) next.delete(unitId)
      else next.add(unitId)
      return next
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
  const isPartialQty = qtyReturned > 0 && qtyReturned < outstandingQty

  const submit = () => {
    if (!qtyReturned || qtyReturned <= 0) {
      toast.error('Enter the quantity being returned')
      return
    }
    if (qtyReturned > outstandingQty + 0.001) {
      toast.error(`Cannot return more than the outstanding quantity (${outstandingQty})`)
      return
    }
    processReturn.mutate({
      quantity_returned: qtyReturned,
      return_condition: form.return_condition,
      damage_charge: Number(form.damage_charge) || 0,
      return_notes: form.return_notes || undefined,
      unit_ids: selectedUnitIds.size > 0 ? Array.from(selectedUnitIds) : undefined,
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
            {Number(booking.quantity_returned ?? 0) > 0 && (
              <span className="col-span-2">
                Already returned:{' '}
                <strong className="text-foreground">{booking.quantity_returned}</strong>
                {' '}&mdash; outstanding:{' '}
                <strong className="text-amber-600 dark:text-amber-400">{outstandingQty}</strong>
              </span>
            )}
          </div>

          <div>
            <FieldLabel>Quantity returned</FieldLabel>
            <Input
              type="number"
              min="0.01"
              max={String(outstandingQty)}
              step="0.01"
              value={form.quantity_returned}
              onChange={(e) => setForm((f) => ({ ...f, quantity_returned: e.target.value }))}
            />
            {isPartialQty && (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                Partial return — {outstandingQty - qtyReturned} unit(s) will remain active.
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

          {/* Serialized unit selection */}
          {isSerializedAsset && (
            <div>
              <FieldLabel>
                Select units being returned
                {selectedUnitIds.size > 0 && (
                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                    ({selectedUnitIds.size} selected)
                  </span>
                )}
              </FieldLabel>
              {rentedUnits.length === 0 ? (
                <p className="text-xs text-muted-foreground">No rented units found for this asset.</p>
              ) : (
                <div className="divide-y divide-border rounded-lg border max-h-48 overflow-y-auto">
                  {rentedUnits.map((u) => (
                    <label
                      key={u.id}
                      className="flex cursor-pointer items-center gap-2.5 px-3 py-2 hover:bg-muted/40"
                    >
                      <input
                        type="checkbox"
                        checked={selectedUnitIds.has(u.id)}
                        onChange={() => toggleUnit(u.id)}
                        className="h-4 w-4 rounded border-border"
                      />
                      <span className="flex-1 text-sm font-medium">{u.serial_no}</span>
                      {u.label && <span className="text-xs text-muted-foreground">{u.label}</span>}
                    </label>
                  ))}
                </div>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                Optional — select units to update their status. Quantity above must still match what you select.
              </p>
            </div>
          )}

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
