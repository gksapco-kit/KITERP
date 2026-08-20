import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeftRight, IndianRupee, Loader2, Truck } from 'lucide-react'
import RentalReturnHistoryPanel from './RentalReturnHistoryPanel'
import { toast } from 'sonner'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { FieldLabel } from '@/components/common/FieldLabel'
import { useConfirm } from '@/components/common/ConfirmProvider'
import { extractApiError } from '@/lib/errorMessages'
import { formatCurrency, formatDate } from '@/lib/utils'
import { rentalApi } from './api'
import { toDateInputValue } from './rentalDates'
import { DELIVERY_STATUSES, type RentalAssetUnit, type RentalBooking, type RentalBookingUnit } from './rentalConstants'
import { StatusBadge } from './RentalPrimitives'

type DeliveryForm = {
  delivery_status: string
  van_number: string
  van_driver_name: string
  van_driver_phone: string
  van_vehicle_type: string
  delivery_notes: string
}

function deliveryFromBooking(b: RentalBooking): DeliveryForm {
  return {
    delivery_status: b.delivery_status || 'assigned',
    van_number: b.van_number || '',
    van_driver_name: b.van_driver_name || '',
    van_driver_phone: b.van_driver_phone || '',
    van_vehicle_type: b.van_vehicle_type || 'Delivery Van',
    delivery_notes: b.delivery_notes || '',
  }
}

type ReassignState = {
  fromUnitId: string
  fromSerial: string
  toUnitId: string
  notes: string
}

type Props = {
  open: boolean
  booking: RentalBooking | null
  onClose: () => void
  onChanged: (b: RentalBooking) => void
  onRequestReturn: (booking: RentalBooking) => void
}

export default function RentalBookingSheet({ open, booking, onClose, onChanged, onRequestReturn }: Props) {
  const qc = useQueryClient()
  const confirm = useConfirm()
  const [subTab, setSubTab] = useState<'details' | 'delivery' | 'units' | 'timeline' | 'returns'>('details')
  const [reassign, setReassign] = useState<ReassignState | null>(null)
  const [deliveryForm, setDeliveryForm] = useState<DeliveryForm>(() => deliveryFromBooking(booking || ({} as RentalBooking)))
  const [extendDate, setExtendDate] = useState('')

  const showDeliveryTab = Boolean(
    booking && (
      (booking.delivery_address && String(booking.delivery_address).trim()) ||
      (booking.delivery_status && booking.delivery_status !== 'not_required')
    ),
  )

  useEffect(() => {
    if (booking) {
      setDeliveryForm(deliveryFromBooking(booking))
      setExtendDate('')
      setSubTab('details')
    }
  }, [booking?.id])

  useEffect(() => {
    if (!showDeliveryTab && subTab === 'delivery') setSubTab('details')
  }, [showDeliveryTab, subTab])

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['rental-dashboard'] })
    qc.invalidateQueries({ queryKey: ['rental-assets'] })
    qc.invalidateQueries({ queryKey: ['rental-bookings'] })
  }

  const updateBooking = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => rentalApi.updateBooking(id, body),
    onSuccess: (data, vars) => {
      if (vars.body?.status === 'approved') {
        toast.success('Booking approved. Asset display dates were checked/expanded to cover this rental period.')
      } else if (vars.body?.new_end_date) {
        toast.success(`Booking dates extended to ${String(vars.body.new_end_date)}`)
        setExtendDate('')
      } else {
        toast.success('Booking updated')
      }
      onChanged(data)
      invalidate()
    },
    onError: (e) => toast.error(extractApiError(e, 'Update booking')),
  })

  const recordPayment = useMutation({
    mutationFn: (id: string) =>
      rentalApi.recordPayment(id, { payment_status: 'paid', payment_method: 'manual', auto_confirm: true }),
    onSuccess: (data) => {
      toast.success('Payment recorded')
      onChanged(data)
      invalidate()
    },
    onError: (e) => toast.error(extractApiError(e, 'Record payment')),
  })

  const updateDelivery = useMutation({
    mutationFn: (id: string) => rentalApi.updateDelivery(id, deliveryForm),
    onSuccess: (data) => {
      toast.success('Delivery van details updated')
      onChanged(data)
      invalidate()
    },
    onError: (e) => toast.error(extractApiError(e, 'Update delivery')),
  })

  const deliveryDirty = useMemo(() => {
    if (!booking) return false
    const base = deliveryFromBooking(booking)
    return JSON.stringify(base) !== JSON.stringify(deliveryForm)
  }, [booking, deliveryForm])

  // ── Serialized unit assignment ──────────────────────────────────────
  const isSerializedAsset = booking?.unit_mode === 'serialized'
  const bookingId = booking?.id ?? ''

  const { data: assignedUnits = [], refetch: refetchUnits } = useQuery<RentalBookingUnit[]>({
    queryKey: ['rental-booking-units', bookingId],
    queryFn: () => rentalApi.getBookingUnits(bookingId),
    enabled: Boolean(bookingId) && subTab === 'units',
  })

  // All units for the asset (needed to pick a replacement in the reassign form)
  const { data: allAssetUnits = [] } = useQuery<RentalAssetUnit[]>({
    queryKey: ['rental-asset-units', booking?.asset_id],
    queryFn: () => rentalApi.listAssetUnits(booking!.asset_id),
    enabled: Boolean(booking?.asset_id) && reassign !== null,
  })
  const availableForReassign = allAssetUnits.filter((u) => u.status === 'available')

  const autoAssign = useMutation({
    mutationFn: () => rentalApi.assignUnitsToBooking(bookingId, { assigned_by: 'vendor' }),
    onSuccess: () => { toast.success('Units auto-assigned'); refetchUnits() },
    onError: (e) => toast.error(extractApiError(e, 'Assign units')),
  })

  const doReassign = useMutation({
    mutationFn: ({ fromUnitId, body }: { fromUnitId: string; body: Record<string, unknown> }) =>
      rentalApi.reassignBookingUnit(bookingId, fromUnitId, body),
    onSuccess: () => {
      toast.success('Unit reassigned')
      setReassign(null)
      refetchUnits()
      qc.invalidateQueries({ queryKey: ['rental-asset-units', booking?.asset_id] })
    },
    onError: (e) => toast.error(extractApiError(e, 'Reassign unit')),
  })

  if (!booking) return null

  const doCancelOrReject = async (status: 'cancelled' | 'rejected') => {
    const ok = await confirm({
      title: status === 'rejected' ? 'Reject this booking?' : 'Cancel this booking?',
      description: `${booking.booking_number || booking.id.slice(0, 8)} for ${booking.customer_name} will be marked as ${status}.`,
    })
    if (!ok) return
    updateBooking.mutate({ id: booking.id, body: { status } })
  }

  const doExtend = () => {
    const next = toDateInputValue(extendDate)
    if (!next) {
      toast.error('Select a new end date to extend this booking')
      return
    }
    const currentEnd = toDateInputValue(booking.end_date)
    if (currentEnd && next <= currentEnd) {
      toast.error('New end date must be after the current end date')
      return
    }
    updateBooking.mutate({ id: booking.id, body: { new_end_date: next } })
  }

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle>{booking.booking_number || `#${booking.id.slice(0, 6)}`}</SheetTitle>
          <SheetDescription>{booking.asset_name}</SheetDescription>
          <div className="flex flex-wrap gap-2 pt-1">
            <StatusBadge status={booking.status} />
            <StatusBadge status={booking.payment_status} />
            {showDeliveryTab ? <StatusBadge status={booking.delivery_status} /> : null}
          </div>
        </SheetHeader>

        <Tabs value={subTab} onValueChange={(v) => setSubTab(v as typeof subTab)} className="flex min-h-0 flex-1 flex-col">
          <div className="border-b border-border px-5 py-2">
            <TabsList>
              <TabsTrigger value="details">Details</TabsTrigger>
              {showDeliveryTab ? <TabsTrigger value="delivery">Delivery</TabsTrigger> : null}
              <TabsTrigger value="units">Units</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="returns">Returns</TabsTrigger>
            </TabsList>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
            <TabsContent value="details" className="mt-0 space-y-4">
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <div><dt className="text-xs text-muted-foreground">Customer</dt><dd>{booking.customer_name}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Phone</dt><dd>{booking.customer_phone || '—'}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Quantity</dt><dd>{booking.quantity} {booking.capacity_unit}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Plan</dt><dd className="capitalize">{booking.pricing_plan}</dd></div>
                <div className="col-span-2">
                  <dt className="text-xs text-muted-foreground">Rental period</dt>
                  <dd className="font-medium">{formatDate(booking.start_date)} → {formatDate(booking.end_date)}</dd>
                </div>
                <div><dt className="text-xs text-muted-foreground">Rental</dt><dd>{formatCurrency(Number(booking.rental_amount || 0))}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Deposit</dt><dd>{formatCurrency(Number(booking.deposit_amount || 0))}</dd></div>
                <div className="col-span-2"><dt className="text-xs text-muted-foreground">Total</dt><dd className="font-semibold">{formatCurrency(Number(booking.total_amount || 0))}</dd></div>
              </dl>

              {booking.registration && (
                <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-sm font-semibold">{booking.registration.form_name || 'Registration form'}</p>
                  <dl className="space-y-1 text-sm">
                    {(booking.registration.fields || []).map((field) => (
                      <div key={field.key} className="flex justify-between gap-3">
                        <dt className="text-muted-foreground">{field.label}</dt>
                        <dd className="text-right font-medium">
                          {String(booking.registration?.answers?.[field.key] ?? '—')}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}

              {booking.returned_at && (
                <div className="space-y-1 rounded-lg border border-emerald-200 bg-emerald-500/10 px-3 py-2 text-xs dark:border-emerald-800/60">
                  <p className="font-semibold text-emerald-800 dark:text-emerald-300">Return recorded</p>
                  <p className="text-emerald-700 dark:text-emerald-300">
                    Returned on {new Date(booking.returned_at).toLocaleString('en-IN')}
                    {booking.quantity_returned != null && ` · Qty: ${booking.quantity_returned}`}
                  </p>
                  {booking.return_condition && (
                    <p className="capitalize text-emerald-700 dark:text-emerald-300">Condition: {booking.return_condition}</p>
                  )}
                  {(Number(booking.late_fee) > 0 || Number(booking.damage_charge) > 0) && (
                    <p className="text-amber-700 dark:text-amber-300">
                      {Number(booking.late_fee) > 0 && `Late fee: ${formatCurrency(Number(booking.late_fee))}  `}
                      {Number(booking.damage_charge) > 0 && `Damage: ${formatCurrency(Number(booking.damage_charge))}`}
                    </p>
                  )}
                  <p className="text-emerald-700 dark:text-emerald-300">Deposit refunded: {formatCurrency(Number(booking.deposit_refunded || 0))}</p>
                  {booking.return_notes && <p className="text-muted-foreground">{booking.return_notes}</p>}
                </div>
              )}

              {['approved', 'confirmed', 'active'].includes(booking.status) && (
                <p className="rounded-lg border border-sky-200 bg-sky-500/10 px-3 py-2 text-xs text-sky-900 dark:border-sky-800/60 dark:text-sky-200">
                  This booking is <span className="font-medium capitalize">{booking.status.replace(/_/g, ' ')}</span>.
                  Asset display dates must cover {formatDate(booking.start_date)} → {formatDate(booking.end_date)}.
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                {booking.status === 'pending' && (
                  <>
                    <Button size="sm" onClick={() => updateBooking.mutate({ id: booking.id, body: { status: 'approved' } })}>Approve</Button>
                    <Button size="sm" variant="outline" onClick={() => doCancelOrReject('rejected')}>Reject</Button>
                  </>
                )}
                {['approved', 'confirmed'].includes(booking.status) && (
                  <Button size="sm" onClick={() => updateBooking.mutate({ id: booking.id, body: { status: 'active' } })}>Mark Active</Button>
                )}
                {booking.status === 'active' && (
                  <Button size="sm" onClick={() => updateBooking.mutate({ id: booking.id, body: { status: 'completed' } })}>Complete</Button>
                )}
                {['active', 'approved', 'confirmed'].includes(booking.status) && (
                  <Button size="sm" variant="outline" onClick={() => onRequestReturn(booking)}>Return Asset</Button>
                )}
                {!['cancelled', 'rejected', 'completed'].includes(booking.status) && (
                  <Button size="sm" variant="outline" onClick={() => doCancelOrReject('cancelled')}>Cancel</Button>
                )}
                {booking.payment_status !== 'paid' && (
                  <Button size="sm" variant="outline" onClick={() => recordPayment.mutate(booking.id)}>
                    <IndianRupee className="mr-1 h-3.5 w-3.5" /> Mark Paid
                  </Button>
                )}
              </div>

              {['approved', 'confirmed', 'active'].includes(booking.status) && (
                <div className="space-y-2 border-t border-border pt-3">
                  <h4 className="text-sm font-semibold">Extend end date</h4>
                  <p className="text-xs text-muted-foreground">
                    Only the end date can be moved later after approval, and it must stay within the asset display period.
                  </p>
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="min-w-[160px]">
                      <FieldLabel>New end date</FieldLabel>
                      <Input
                        type="date"
                        min={toDateInputValue(booking.end_date) || undefined}
                        value={extendDate}
                        onChange={(e) => setExtendDate(e.target.value)}
                      />
                    </div>
                    <Button size="sm" variant="outline" disabled={updateBooking.isPending || !extendDate} onClick={doExtend}>
                      Extend dates
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="delivery" className="mt-0 space-y-3">
              <h4 className="flex items-center gap-1.5 text-sm font-semibold">
                <Truck className="h-4 w-4" /> Delivery Van Tracking
              </h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <FieldLabel>Delivery status</FieldLabel>
                  <Select
                    value={deliveryForm.delivery_status}
                    onChange={(v) => setDeliveryForm((f) => ({ ...f, delivery_status: v }))}
                    options={DELIVERY_STATUSES}
                  />
                </div>
                <div>
                  <FieldLabel>Van number</FieldLabel>
                  <Input value={deliveryForm.van_number} onChange={(e) => setDeliveryForm((f) => ({ ...f, van_number: e.target.value }))} />
                </div>
                <div>
                  <FieldLabel>Vehicle type</FieldLabel>
                  <Input value={deliveryForm.van_vehicle_type} onChange={(e) => setDeliveryForm((f) => ({ ...f, van_vehicle_type: e.target.value }))} />
                </div>
                <div>
                  <FieldLabel>Driver name</FieldLabel>
                  <Input value={deliveryForm.van_driver_name} onChange={(e) => setDeliveryForm((f) => ({ ...f, van_driver_name: e.target.value }))} />
                </div>
                <div>
                  <FieldLabel>Driver phone</FieldLabel>
                  <Input value={deliveryForm.van_driver_phone} onChange={(e) => setDeliveryForm((f) => ({ ...f, van_driver_phone: e.target.value }))} />
                </div>
                <div className="sm:col-span-2">
                  <FieldLabel>Delivery notes</FieldLabel>
                  <Input value={deliveryForm.delivery_notes} onChange={(e) => setDeliveryForm((f) => ({ ...f, delivery_notes: e.target.value }))} />
                </div>
              </div>
              <Button size="sm" disabled={updateDelivery.isPending || !deliveryDirty} onClick={() => updateDelivery.mutate(booking.id)}>
                {updateDelivery.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update Delivery'}
              </Button>
            </TabsContent>

            <TabsContent value="units" className="mt-0 space-y-4">
              {!isSerializedAsset ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  This asset does not use serialized unit tracking. Enable it in the Asset master.
                </p>
              ) : (
                <>
                  {assignedUnits.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                      <p className="font-medium">No units assigned yet.</p>
                      <p className="mt-1 text-xs">Units are auto-assigned when the booking goes Active, or you can assign them manually below.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border rounded-lg border border-border text-sm">
                      {assignedUnits.map((u) => (
                        <div key={u.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
                          <div className="min-w-0">
                            <p className="font-mono font-semibold">{u.serial_no}</p>
                            {u.label && <p className="truncate text-xs text-muted-foreground">{u.label}</p>}
                            <p className="mt-0.5 text-xs text-muted-foreground capitalize">
                              {u.condition} · {u.status}
                              {u.assigned_at && <span> · Assigned {new Date(u.assigned_at).toLocaleString('en-IN')}</span>}
                            </p>
                          </div>
                          {['approved', 'confirmed', 'active'].includes(booking.status) && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="shrink-0"
                              onClick={() =>
                                setReassign({ fromUnitId: u.unit_id, fromSerial: u.serial_no, toUnitId: '', notes: '' })
                              }
                            >
                              <ArrowLeftRight className="mr-1 h-3.5 w-3.5" /> Reassign
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Reassign inline form */}
                  {reassign && (
                    <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-3 dark:border-amber-800/50 dark:bg-amber-950/30">
                      <p className="text-sm font-semibold">
                        Reassign <span className="font-mono">{reassign.fromSerial}</span>
                      </p>
                      <div>
                        <FieldLabel>Replacement unit</FieldLabel>
                        {availableForReassign.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No available units to swap to.</p>
                        ) : (
                          <Select
                            value={reassign.toUnitId}
                            onChange={(v) => setReassign((r) => r ? { ...r, toUnitId: v } : r)}
                            options={[
                              { value: '', label: '— select —' },
                              ...availableForReassign.map((u) => ({
                                value: u.id,
                                label: `${u.serial_no}${u.label ? ` (${u.label})` : ''}`,
                              })),
                            ]}
                          />
                        )}
                      </div>
                      <div>
                        <FieldLabel>Reason / notes (optional)</FieldLabel>
                        <Input
                          value={reassign.notes}
                          placeholder="e.g. damaged during delivery"
                          onChange={(e) => setReassign((r) => r ? { ...r, notes: e.target.value } : r)}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          disabled={!reassign.toUnitId || doReassign.isPending}
                          onClick={() =>
                            doReassign.mutate({
                              fromUnitId: reassign.fromUnitId,
                              body: { to_unit_id: reassign.toUnitId, notes: reassign.notes || undefined },
                            })
                          }
                        >
                          {doReassign.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm Reassign'}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setReassign(null)}>Cancel</Button>
                      </div>
                    </div>
                  )}

                  {/* Manual / auto assign button */}
                  {['approved', 'confirmed', 'active'].includes(booking.status) && !reassign && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={autoAssign.isPending}
                      onClick={() => autoAssign.mutate()}
                    >
                      {autoAssign.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Auto-assign available units'}
                    </Button>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="timeline" className="mt-0">
              {(booking.timeline || []).length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No timeline events yet.</p>
              ) : (
                <ol className="space-y-3">
                  {(booking.timeline || []).map((t, i) => (
                    <li key={i} className="flex gap-2 text-xs">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <div>
                        <p className="font-medium text-foreground">{t.event}</p>
                        {t.detail && <p className="text-muted-foreground">{t.detail}</p>}
                        {t.at && <p className="text-muted-foreground/70">{new Date(t.at).toLocaleString('en-IN')}</p>}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </TabsContent>

            <TabsContent value="returns" className="mt-0">
              <RentalReturnHistoryPanel
                bookingId={booking.id}
                totalQuantity={Number(booking.quantity ?? 1)}
              />
            </TabsContent>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
