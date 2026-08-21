import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowLeftRight, Check, IndianRupee, Loader2, Pencil, Plus, RefreshCw, RotateCcw, Trash2, Truck } from 'lucide-react'
import { toast } from 'sonner'
import RentalReturnHistoryPanel from './RentalReturnHistoryPanel'
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
import {
  DELIVERY_STATUSES,
  type RentalAsset,
  type RentalAssetUnit,
  type RentalBooking,
  type RentalBookingRegistration,
  type RentalBookingUnit,
} from './rentalConstants'
import { StatusBadge, TableSkeleton } from './RentalPrimitives'
import ReturnAssetModal from './ReturnAssetModal'
import { RegistrationAnswersPanel } from './RegistrationAnswersPanel'
import { RegistrationFormFields } from './RegistrationFormFields'
import type { RegistrationField, RegistrationFormRecord, RegistrationTheme } from './registrationFormTemplates'

function answersToFormValues(answers?: Record<string, unknown> | null): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {}
  if (!answers) return out
  for (const [key, raw] of Object.entries(answers)) {
    if (typeof raw === 'boolean') out[key] = raw
    else if (raw == null) out[key] = ''
    else out[key] = String(raw)
  }
  return out
}

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

export default function RentalBookingDetailPage() {
  const { bookingId = '' } = useParams<{ bookingId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const confirm = useConfirm()
  const [subTab, setSubTab] = useState<'details' | 'delivery' | 'units' | 'registration' | 'timeline' | 'returns'>('details')
  const [reassign, setReassign] = useState<ReassignState | null>(null)
  const [extendDate, setExtendDate] = useState('')
  const [returnOpen, setReturnOpen] = useState(false)
  const [editingRegistration, setEditingRegistration] = useState(false)
  const [regAnswers, setRegAnswers] = useState<Record<string, string | boolean>>({})
  const [regFormId, setRegFormId] = useState<string | null>(null)

  const { data: booking, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['rental-booking', bookingId],
    queryFn: () => rentalApi.getBooking(bookingId),
    enabled: Boolean(bookingId),
  })

  const { data: assets = [] } = useQuery({
    queryKey: ['rental-assets'],
    queryFn: () => rentalApi.listAssets(),
    staleTime: 30_000,
    enabled: returnOpen,
  })

  const [deliveryForm, setDeliveryForm] = useState<DeliveryForm>(() => deliveryFromBooking({} as RentalBooking))

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
      setReassign(null)
      const regParam = searchParams.get('registration')
      const fromId = searchParams.get('from')
      if (regParam) {
        setSubTab('registration')
        const discarded = fromId
          ? (booking.discarded_registrations || []).find((r) => r.id === fromId)
          : null
        if (regParam === 'edit' && discarded) {
          setRegFormId(discarded.form_id)
          setRegAnswers(answersToFormValues(discarded.answers))
          setEditingRegistration(true)
        } else if (regParam === 'edit' && booking.registration) {
          setRegFormId(booking.registration.form_id || null)
          setRegAnswers(answersToFormValues(booking.registration.answers))
          setEditingRegistration(true)
        } else {
          setEditingRegistration(false)
          setRegAnswers({})
          setRegFormId(null)
        }
      } else {
        setSubTab('details')
        setEditingRegistration(false)
        setRegAnswers({})
        setRegFormId(null)
      }
    }
  }, [booking?.id])

  useEffect(() => {
    if (!showDeliveryTab && subTab === 'delivery') setSubTab('details')
  }, [showDeliveryTab, subTab])

  const registrationFormId = regFormId || booking?.registration?.form_id || ''

  const { data: registrationForm, isLoading: loadingRegForm, isError: registrationFormMissing } = useQuery({
    queryKey: ['rental-registration-form', registrationFormId],
    queryFn: () => rentalApi.getRegistrationForm(registrationFormId) as Promise<RegistrationFormRecord>,
    enabled: editingRegistration && Boolean(registrationFormId),
    retry: false,
  })

  const needFallbackForm = editingRegistration && (!registrationFormId || registrationFormMissing)

  const { data: staffReg } = useQuery({
    queryKey: ['rental-registration-form-staff'],
    queryFn: () => rentalApi.getActiveRegistrationForm('staff'),
    enabled: needFallbackForm,
  })
  const { data: storefrontReg } = useQuery({
    queryKey: ['rental-registration-form-storefront'],
    queryFn: () => rentalApi.getActiveRegistrationForm('storefront'),
    enabled: needFallbackForm && staffReg !== undefined && !staffReg?.enabled,
  })

  const activeEditForm = useMemo(() => {
    if (registrationForm && !registrationFormMissing) return registrationForm
    if (staffReg?.enabled && staffReg.form) return staffReg.form as unknown as RegistrationFormRecord
    if (storefrontReg?.enabled && storefrontReg.form) return storefrontReg.form as unknown as RegistrationFormRecord
    return null
  }, [registrationForm, registrationFormMissing, staffReg, storefrontReg])

  const startEditRegistration = (opts?: { blank?: boolean; from?: RentalBookingRegistration | null }) => {
    const existing = opts?.from || booking?.registration
    const nextFormId = existing?.form_id || null
    setRegFormId(nextFormId)
    setRegAnswers(opts?.blank ? {} : answersToFormValues(existing?.answers))
    setEditingRegistration(true)
  }

  const cancelEditRegistration = () => {
    setEditingRegistration(false)
    setRegAnswers({})
    setRegFormId(null)
  }

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['rental-dashboard'] })
    qc.invalidateQueries({ queryKey: ['rental-assets'] })
    qc.invalidateQueries({ queryKey: ['rental-bookings'] })
    qc.invalidateQueries({ queryKey: ['rental-booking', bookingId] })
  }

  const updateBooking = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => rentalApi.updateBooking(id, body),
    onSuccess: (_data, vars) => {
      if (vars.body?.status === 'approved') {
        toast.success('Booking approved. Asset display dates were checked/expanded to cover this rental period.')
      } else if (vars.body?.new_end_date) {
        toast.success(`Booking dates extended to ${String(vars.body.new_end_date)}`)
        setExtendDate('')
      } else {
        toast.success('Booking updated')
      }
      invalidate()
      void refetch()
    },
    onError: (e) => toast.error(extractApiError(e, 'Update booking')),
  })

  const recordPayment = useMutation({
    mutationFn: (id: string) =>
      rentalApi.recordPayment(id, { payment_status: 'paid', payment_method: 'manual', auto_confirm: true }),
    onSuccess: () => {
      toast.success('Payment recorded')
      invalidate()
      void refetch()
    },
    onError: (e) => toast.error(extractApiError(e, 'Record payment')),
  })

  const updateDelivery = useMutation({
    mutationFn: (id: string) => rentalApi.updateDelivery(id, deliveryForm),
    onSuccess: () => {
      toast.success('Delivery van details updated')
      invalidate()
      void refetch()
    },
    onError: (e) => toast.error(extractApiError(e, 'Update delivery')),
  })

  const saveRegistration = useMutation({
    mutationFn: async () => {
      const form = activeEditForm
      if (!form?.id) throw new Error('No registration form available')
      const fields = (form.fields || []) as RegistrationField[]
      const missing = fields.filter((f) => {
        if (f.type === 'heading' || !f.required) return false
        const v = regAnswers[f.key]
        return f.type === 'checkbox' || f.type === 'terms' ? v !== true : !String(v ?? '').trim()
      })
      if (missing.length) throw new Error(`Please fill: ${missing.map((f) => f.label).join(', ')}`)
      return rentalApi.replaceBookingRegistration(bookingId, {
        form_id: form.id,
        answers: regAnswers,
        customer_name: booking?.customer_name || undefined,
      })
    },
    onSuccess: () => {
      toast.success(booking?.registration ? 'Registration replaced' : 'Registration saved')
      cancelEditRegistration()
      invalidate()
      qc.invalidateQueries({ queryKey: ['rental-registration-submissions'] })
      void refetch()
    },
    onError: (e) => toast.error(extractApiError(e, e instanceof Error ? e.message : 'Could not save registration')),
  })

  const discardRegistration = useMutation({
    mutationFn: () => rentalApi.discardBookingRegistration(bookingId),
    onSuccess: () => {
      toast.success('Registration moved to Discarded')
      cancelEditRegistration()
      invalidate()
      qc.invalidateQueries({ queryKey: ['rental-registration-submissions'] })
      void refetch()
    },
    onError: (e) => toast.error(extractApiError(e, 'Discard registration')),
  })

  const restoreRegistration = useMutation({
    mutationFn: (id: string) => rentalApi.restoreRegistrationSubmission(id),
    onSuccess: () => {
      toast.success('Registration restored on this booking')
      cancelEditRegistration()
      invalidate()
      qc.invalidateQueries({ queryKey: ['rental-registration-submissions'] })
      void refetch()
    },
    onError: (e) => toast.error(extractApiError(e, 'Restore registration')),
  })

  const confirmDiscardRegistration = async () => {
    const ok = await confirm({
      title: 'Discard registration?',
      description:
        'This moves the guest registration to Discarded on this booking and under Filled Registrations. You can restore or edit it later.',
      confirmLabel: 'Discard',
      variant: 'danger',
    })
    if (ok) discardRegistration.mutate()
  }

  const deliveryDirty = useMemo(() => {
    if (!booking) return false
    const base = deliveryFromBooking(booking)
    return JSON.stringify(base) !== JSON.stringify(deliveryForm)
  }, [booking, deliveryForm])

  const isSerializedAsset = booking?.unit_mode === 'serialized'

  const { data: assignedUnits = [], refetch: refetchUnits } = useQuery<RentalBookingUnit[]>({
    queryKey: ['rental-booking-units', bookingId],
    queryFn: () => rentalApi.getBookingUnits(bookingId),
    enabled: Boolean(bookingId) && subTab === 'units',
  })

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

  const returnAsset = useMemo(
    () => (booking ? (assets as RentalAsset[]).find((a) => a.id === booking.asset_id) || null : null),
    [assets, booking],
  )

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/rental/bookings"><ArrowLeft className="mr-1 h-4 w-4" /> Bookings</Link>
        </Button>
        <TableSkeleton rows={6} />
      </div>
    )
  }

  if (isError || !booking) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/rental/bookings"><ArrowLeft className="mr-1 h-4 w-4" /> Bookings</Link>
        </Button>
        <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center">
          <p className="text-sm font-medium text-foreground">Booking not found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {extractApiError(error, 'This booking may have been removed or you do not have access.')}
          </p>
          <Button className="mt-4" variant="outline" onClick={() => navigate('/rental/bookings')}>
            Back to bookings
          </Button>
        </div>
      </div>
    )
  }

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
    <div className="mx-auto max-w-5xl space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <Button variant="ghost" size="sm" className="-ml-2 h-7 px-2 text-muted-foreground" asChild>
            <Link to="/rental/bookings"><ArrowLeft className="mr-1 h-3.5 w-3.5" /> Bookings</Link>
          </Button>
          <h1 className="text-lg font-bold leading-tight text-foreground">
            {booking.booking_number || `#${booking.id.slice(0, 6)}`}
          </h1>
          <p className="text-sm text-muted-foreground">{booking.asset_name}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <StatusBadge status={booking.status} />
            <StatusBadge status={booking.payment_status} />
            {showDeliveryTab ? <StatusBadge status={booking.delivery_status} /> : null}
          </div>
        </div>
      </div>

      <Tabs value={subTab} onValueChange={(v) => setSubTab(v as typeof subTab)} className="space-y-2">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          {showDeliveryTab ? <TabsTrigger value="delivery">Delivery</TabsTrigger> : null}
          <TabsTrigger value="units">Units</TabsTrigger>
          <TabsTrigger value="registration">
            Registration
            {(booking.discarded_registrations || []).length > 0 ? (
              <span className="ml-1 rounded-full bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground">
                {(booking.discarded_registrations || []).length}
              </span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="returns">Returns</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-0 space-y-5">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Booking summary</p>
            <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-muted-foreground">Customer</dt>
                <dd className="mt-0.5 font-medium text-foreground">{booking.customer_name}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Phone</dt>
                <dd className="mt-0.5 text-foreground">{booking.customer_phone || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Quantity</dt>
                <dd className="mt-0.5 text-foreground">{booking.quantity} {booking.capacity_unit}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Plan</dt>
                <dd className="mt-0.5 capitalize text-foreground">{booking.pricing_plan}</dd>
              </div>
              <div className="col-span-2 sm:col-span-3">
                <dt className="text-xs text-muted-foreground">Rental period</dt>
                <dd className="mt-0.5 font-medium text-foreground">{formatDate(booking.start_date)} → {formatDate(booking.end_date)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Rental</dt>
                <dd className="mt-0.5 text-foreground">{formatCurrency(Number(booking.rental_amount || 0))}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Deposit</dt>
                <dd className="mt-0.5 text-foreground">{formatCurrency(Number(booking.deposit_amount || 0))}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Total</dt>
                <dd className="mt-0.5 text-base font-semibold text-foreground">{formatCurrency(Number(booking.total_amount || 0))}</dd>
              </div>
            </dl>
          </div>

          {booking.returned_at && (
            <div className="space-y-1.5 rounded-xl border border-emerald-200/80 bg-emerald-500/10 px-4 py-3 text-sm dark:border-emerald-800/60">
              <p className="font-semibold text-emerald-800 dark:text-emerald-300">Return recorded</p>
              <p className="text-emerald-800/90 dark:text-emerald-300/90">
                Returned on {new Date(booking.returned_at).toLocaleString('en-IN')}
                {booking.quantity_returned != null && ` · Qty: ${booking.quantity_returned}`}
              </p>
              {booking.return_condition && (
                <p className="capitalize text-emerald-800/90 dark:text-emerald-300/90">Condition: {booking.return_condition}</p>
              )}
              {(Number(booking.late_fee) > 0 || Number(booking.damage_charge) > 0) && (
                <p className="text-amber-800 dark:text-amber-300">
                  {Number(booking.late_fee) > 0 && `Late fee: ${formatCurrency(Number(booking.late_fee))}  `}
                  {Number(booking.damage_charge) > 0 && `Damage: ${formatCurrency(Number(booking.damage_charge))}`}
                </p>
              )}
              <p className="font-medium text-emerald-800 dark:text-emerald-300">
                Deposit refunded: {formatCurrency(Number(booking.deposit_refunded || 0))}
              </p>
              {booking.return_notes && <p className="text-muted-foreground">{booking.return_notes}</p>}
            </div>
          )}

          {['approved', 'confirmed', 'active'].includes(booking.status) && (
            <p className="rounded-xl border border-sky-200 bg-sky-500/10 px-4 py-3 text-sm text-sky-900 dark:border-sky-800/60 dark:text-sky-200">
              This booking is <span className="font-medium capitalize">{booking.status.replace(/_/g, ' ')}</span>.
              Asset display dates must cover {formatDate(booking.start_date)} → {formatDate(booking.end_date)}.
            </p>
          )}

          <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-card p-4 shadow-sm">
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
              <Button size="sm" variant="outline" onClick={() => setReturnOpen(true)}>Return Asset</Button>
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
            <div className="space-y-2 rounded-xl border border-border bg-card p-5 shadow-sm">
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

        <TabsContent value="delivery" className="mt-0 space-y-3 rounded-xl border border-border bg-card p-5">
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

        <TabsContent value="units" className="mt-0 space-y-4 rounded-xl border border-border bg-card p-5">
          {!isSerializedAsset ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              This asset does not use serialized unit tracking. Enable it in the Asset master.
            </p>
          ) : (
            <>
              {assignedUnits.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                  <p className="font-medium">No units assigned yet.</p>
                  <p className="mt-1 text-xs">
                    Units are reserved when the booking is approved (or when you pick a unit from the calendar).
                    You can auto-assign or reassign anytime below.
                  </p>
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

        <TabsContent value="registration" className="mt-0 space-y-3">
          {editingRegistration ? (
            <div className="space-y-3 rounded-lg border border-border bg-card p-3 sm:p-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  {booking.registration ? 'Replace registration' : 'Fill registration'}
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {booking.registration
                    ? 'Saving replaces and discards the previous answers for this booking.'
                    : 'Answers will be linked to this booking.'}
                </p>
              </div>

              {loadingRegForm && registrationFormId ? (
                <p className="text-sm text-muted-foreground">Loading form…</p>
              ) : !activeEditForm ? (
                <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                  No registration form is available. Enable a staff or storefront form under Registration Forms.
                </div>
              ) : (
                <RegistrationFormFields
                  fields={(activeEditForm.fields || []) as RegistrationField[]}
                  values={regAnswers}
                  theme={(activeEditForm.theme || { accent: '#0f766e', layout: 'card' }) as RegistrationTheme}
                  onUploadImage={async (file) => (await rentalApi.uploadRegistrationImage(file)).url}
                  onChange={(key, value) => setRegAnswers((prev) => ({ ...prev, [key]: value }))}
                />
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => saveRegistration.mutate()}
                  disabled={saveRegistration.isPending || !activeEditForm}
                >
                  {saveRegistration.isPending ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-1.5 h-4 w-4" />
                  )}
                  {booking.registration ? 'Save & replace' : 'Save registration'}
                </Button>
                <Button size="sm" variant="outline" onClick={cancelEditRegistration} disabled={saveRegistration.isPending}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : booking.registration ? (
            <RegistrationAnswersPanel
              formName={booking.registration.form_name}
              fields={booking.registration.fields}
              answers={booking.registration.answers}
              channel={booking.registration.channel}
              actions={
                <>
                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => startEditRegistration()}>
                    <Pencil className="mr-1 h-3 w-3" />
                    Edit
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => startEditRegistration({ blank: true })}>
                    <RefreshCw className="mr-1 h-3 w-3" />
                    Resubmit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={discardRegistration.isPending}
                    onClick={() => void confirmDiscardRegistration()}
                  >
                    {discardRegistration.isPending ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="mr-1 h-3 w-3" />
                    )}
                    Discard
                  </Button>
                </>
              }
            />
          ) : (
            <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center">
              <p className="text-sm font-medium text-foreground">No guest registration</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {(booking.discarded_registrations || []).length
                  ? 'A discarded form for this booking is listed below — restore it, edit the answers, or fill a new form.'
                  : 'Fill a registration form here, or answers appear when collected on storefront or staff booking.'}
              </p>
              <Button size="sm" className="mt-3" onClick={() => startEditRegistration({ blank: true })}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Fill registration
              </Button>
            </div>
          )}

          {(booking.discarded_registrations || []).length > 0 ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Discarded registrations</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Soft-discarded answers kept for this booking. Restore to make one active, or edit then save.
                  </p>
                </div>
                <Button size="sm" variant="ghost" className="h-7 text-xs" asChild>
                  <Link to="/rental/filled-registrations?discarded=1">View all discarded</Link>
                </Button>
              </div>
              {(booking.discarded_registrations || []).map((row) => (
                <RegistrationAnswersPanel
                  key={row.id}
                  formName={row.form_name}
                  fields={row.fields}
                  answers={row.answers}
                  channel={row.deleted_at
                    ? `discarded${row.channel ? ` · ${row.channel}` : ''} · ${new Date(row.deleted_at).toLocaleString('en-IN')}`
                    : row.channel}
                  actions={
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs"
                        disabled={restoreRegistration.isPending && restoreRegistration.variables === row.id}
                        onClick={() => restoreRegistration.mutate(row.id)}
                      >
                        {restoreRegistration.isPending && restoreRegistration.variables === row.id ? (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : (
                          <RotateCcw className="mr-1 h-3 w-3" />
                        )}
                        Restore
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs"
                        onClick={() => startEditRegistration({ from: row })}
                      >
                        <Pencil className="mr-1 h-3 w-3" />
                        Edit
                      </Button>
                    </>
                  }
                />
              ))}
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="timeline" className="mt-0 rounded-xl border border-border bg-card p-5">
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

        <TabsContent value="returns" className="mt-0 rounded-xl border border-border bg-card p-5">
          <RentalReturnHistoryPanel
            bookingId={booking.id}
            totalQuantity={Number(booking.quantity ?? 1)}
          />
        </TabsContent>
      </Tabs>

      {returnOpen && (
        <ReturnAssetModal
          booking={booking}
          asset={returnAsset}
          onClose={() => setReturnOpen(false)}
          onDone={() => {
            setReturnOpen(false)
            invalidate()
            void refetch()
          }}
        />
      )}
    </div>
  )
}
