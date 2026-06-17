import { useState, useMemo, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useService, useCreateBooking, useRequestQuote, useAddToCart } from '@/hooks/useStore'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency, imgUrl } from '@/lib/utils'
import {
  Clock, Wrench, Loader2, ChevronRight, CheckCircle, XCircle,
  Phone, Mail, Tag, MapPin, AlertTriangle, Monitor, CalendarDays, X,
  Repeat, Calendar, Shield, Info, Sparkles, Users, Star, MessageSquare, Send,
} from 'lucide-react'
import { useVendor } from '@/contexts/VendorContext'
import { themeUi } from '@/lib/themeColors'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import StarRating from '@/components/StarRating'
import ReviewSection from '@/components/ReviewSection'
import MediaViewer from '@/components/MediaViewer'
import SubscriptionConfigurator from '@/components/SubscriptionConfigurator'
import type { ServicePlan, ServiceAvailability } from '@/types'

const SERVICE_MODE_LABELS: Record<string, string> = {
  in_store: 'In-Store', on_site: 'On-Site', remote: 'Remote',
  online: 'Online', hybrid: 'Hybrid', home_visit: 'Home Visit', both: 'In-Store & Home',
  clinic: 'Clinic', office: 'Office', warehouse: 'Warehouse',
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const UOM_LABELS: Record<string, string> = {
  fixed: 'One-time', per_session: 'session', per_visit: 'visit', hourly: 'hour',
  daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year', per_task: 'task',
  per_km: 'km', event: 'event', milestone: 'milestone', per_unit: 'unit',
  piece: 'piece', kg: 'kg', gram: 'gram', litre: 'litre', ml: 'ml',
  meter: 'meter', sqft: 'sq.ft', sqmt: 'sq.m', pack: 'pack', box: 'box',
  pair: 'pair', set: 'set', dozen: 'dozen', bundle: 'bundle',
}

const intervalShort: Record<string, string> = {
  daily: '/day', weekly: '/wk', biweekly: '/2wk', monthly: '/mo',
  quarterly: '/qtr', biannual: '/6mo', yearly: '/yr',
}
const intervalLabel: Record<string, string> = {
  daily: 'Daily', weekly: 'Weekly', biweekly: 'Bi-Weekly', monthly: 'Monthly',
  quarterly: 'Quarterly', biannual: 'Half-Yearly', yearly: 'Yearly',
}

type AvailSlot = { id?: string; day_of_week: number; start_time: string; end_time: string; is_available: boolean }

// ── Weekly Availability Panel ─────────────────────────────────────

function BookingSlotsPanel({ availability }: { availability: AvailSlot[] }) {
  if (!availability || availability.length === 0) return null
  if (!availability.some(s => s.is_available)) return null

  const byDay = new Map<number, AvailSlot[]>()
  for (const s of availability) {
    const list = byDay.get(s.day_of_week) || []
    list.push(s)
    byDay.set(s.day_of_week, list)
  }
  const allDays = Array.from({ length: 7 }, (_, i) => i)

  return (
    <div className={`rounded-2xl border-2 p-6 ${themeUi.cardSurface} ${themeUi.cardBorder} ${themeUi.cardShadow}`}>
      <h3 className={`font-bold mb-4 flex items-center gap-2 text-sm ${themeUi.textPrimary}`}>
        <Calendar className={`w-4 h-4 ${themeUi.iconPrimary}`} /> Weekly Availability
      </h3>
      <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
        {allDays.map(day => {
          const label = DAYS[day] ?? `Day ${day}`
          const slots = (byDay.get(day) || []).filter(s => s.is_available)
          const isOpen = slots.length > 0
          return (
            <div key={day}
              className={`rounded-xl p-2.5 text-center text-xs transition-all ${
                isOpen
                  ? themeUi.gradientDayOpen
                  : themeUi.dayClosed
              }`}>
              <p className="font-bold text-xs">{label}</p>
              {isOpen ? (
                <div className="mt-1 space-y-1">
                  {slots.map((slot, si) => (
                    <div key={si}>
                      <p className="font-semibold">{slot.start_time}</p>
                      <p className={`text-xs ${themeUi.textSecondaryTone}`}>to</p>
                      <p className="font-semibold">{slot.end_time}</p>
                      {si < slots.length - 1 && <div className={`border-t ${themeUi.mutedLine} my-1`} />}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-1.5 text-xs">Closed</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Plan Selector ─────────────────────────────────────────────────

function PlanSelector({
  plans, currency, selectedId, onSelect,
}: {
  plans: ServicePlan[]; currency: string; selectedId: string | null; onSelect: (id: string) => void
}) {
  const activePlans = plans.filter(p => p.is_active)
  if (activePlans.length === 0) return null

  return (
    <div>
      <p className={`text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-1.5 ${themeUi.textPrimary}`}>
        <Repeat className="w-3.5 h-3.5" /> Choose a Plan
      </p>
      <div className="space-y-2.5">
        {activePlans.map(plan => {
          const isSelected = selectedId === plan.id
          const vInterval = plan.subscription_interval || 'monthly'
          const vPriceType = plan.price_type || 'per_cycle'
          const vShort = vPriceType === 'per_unit'
            ? `/${UOM_LABELS[plan.uom] || plan.uom || 'unit'}`
            : (intervalShort[vInterval] || '/mo')
          const hasTrial = plan.subscription_trial_days && plan.subscription_trial_days > 0
          const hasSetup = plan.subscription_setup_fee && plan.subscription_setup_fee > 0

          return (
            <button key={plan.id} type="button" onClick={() => onSelect(plan.id)}
              className={`w-full p-4 sm:p-5 rounded-xl border-2 text-left transition-all duration-200 ${
                isSelected
                  ? 'border-[color:var(--color-secondary)] bg-white shadow-md ring-1 ring-[color:var(--color-secondary)]/20'
                  : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50/80 bg-white'
              }`}>
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                    isSelected
                      ? 'border-[color:var(--color-secondary)] bg-[color:var(--color-secondary)]'
                      : 'border-gray-300 bg-white'
                  }`}
                  aria-hidden
                >
                  {isSelected ? <CheckCircle className="w-3.5 h-3.5 text-white" strokeWidth={2.5} /> : null}
                </div>
                <div className="flex flex-1 items-start justify-between gap-4 min-w-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-bold text-gray-900 truncate">{plan.name}</p>
                    <p className="text-sm mt-0.5 text-gray-600">
                      {intervalLabel[vInterval] || vInterval}
                      {vPriceType === 'per_unit' && ` · per ${UOM_LABELS[plan.uom] || plan.uom || 'unit'}`}
                    </p>
                    {plan.description && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{plan.description}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0 min-w-[5rem] pl-2">
                    {plan.price != null ? (
                      <>
                        <p className="text-xl font-extrabold text-gray-900">
                          {formatCurrency(plan.price, currency)}
                        </p>
                        <p className="text-sm text-gray-500">{vShort}</p>
                      </>
                    ) : (
                      <p className="text-base font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                        Quote
                      </p>
                    )}
                  </div>
                </div>
              </div>
              {(hasTrial || hasSetup || plan.duration_minutes) && (
                <div className="flex flex-wrap gap-1.5 mt-3 ml-8">
                  {hasTrial && (
                    <span className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                      {plan.subscription_trial_days}d free trial
                    </span>
                  )}
                  {hasSetup && (
                    <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                      {formatCurrency(plan.subscription_setup_fee!, currency)} setup
                    </span>
                  )}
                  {plan.duration_minutes ? (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-0.5 ${themeUi.pillDuration}`}>
                      <Clock className="w-2.5 h-2.5" />{plan.duration_minutes}m
                    </span>
                  ) : null}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Booking Modal ─────────────────────────────────────────────────

function BookingModal({
  serviceId, serviceName, price, duration, availability, onClose,
}: {
  serviceId: string; serviceName: string; price: number; duration?: number
  availability?: AvailSlot[]; onClose: () => void
}) {
  const createBooking = useCreateBooking()
  const today = useMemo(() => new Date().toISOString().split('T')[0], [])
  const nextSlotTime = useMemo(() => {
    const now = new Date()
    const next = new Date(now)
    next.setMinutes(now.getMinutes() < 30 ? 30 : 60, 0, 0)
    return next.toTimeString().slice(0, 5)
  }, [])
  const [bookingDate, setBookingDate] = useState(today)
  const [startTime, setStartTime] = useState(nextSlotTime)
  const [notes, setNotes] = useState('')

  const availableDays = useMemo(() => {
    if (!availability?.length) return new Set<number>()
    return new Set(availability.filter(s => s.is_available).map(s => s.day_of_week))
  }, [availability])

  const timeBoundsForDate = useMemo(() => {
    if (!bookingDate || !availability?.length) return null
    const jsDay = new Date(bookingDate + 'T00:00:00').getDay()
    const modelDay = jsDay === 0 ? 6 : jsDay - 1
    const slot = availability.find(s => s.day_of_week === modelDay && s.is_available)
    return slot ? { start: slot.start_time, end: slot.end_time } : null
  }, [bookingDate, availability])

  const isDateUnavailable = (dateStr: string) => {
    if (!availableDays.size) return false
    const jsDay = new Date(dateStr + 'T00:00:00').getDay()
    const modelDay = jsDay === 0 ? 6 : jsDay - 1
    return !availableDays.has(modelDay)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!bookingDate) return
    createBooking.mutate(
      { service_id: serviceId, booking_date: bookingDate, start_time: startTime || undefined, notes: notes || undefined, payment_method: 'cod' },
      { onSuccess: () => onClose() },
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in zoom-in-95 fade-in-0 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <CalendarDays className={`w-5 h-5 ${themeUi.iconPrimary}`} />
            <h2 className="text-lg font-bold text-gray-900">Book Service</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className={`rounded-xl p-4 border ${themeUi.gradientHero} ${themeUi.borderPrimaryMuted}`}>
            <p className="font-bold text-gray-900">{serviceName}</p>
            <div className="flex items-center gap-3 mt-1.5 text-sm text-gray-600">
              <span className="text-xl font-extrabold text-gray-900">{formatCurrency(price)}</span>
              {duration && (
                <span className="flex items-center gap-1 bg-white/80 px-2 py-0.5 rounded-full text-xs">
                  <Clock className="w-3 h-3" /> {duration} min
                </span>
              )}
            </div>
          </div>

          {availability && availability.some(s => s.is_available) && (
            <div className={`rounded-xl p-3 border ${themeUi.bgSoftPanel} ${themeUi.borderPrimarySoft}`}>
              <p className={`text-xs font-bold mb-1.5 uppercase tracking-wider ${themeUi.textPrimary}`}>Available days</p>
              <div className="flex gap-1.5 flex-wrap">
                {[...availability].filter(s => s.is_available).sort((a, b) => a.day_of_week - b.day_of_week).map(s => (
                  <span key={s.id ?? `${s.day_of_week}-${s.start_time}-${s.end_time}`} className={`text-xs font-medium px-2 py-0.5 rounded-full ${themeUi.dayChip}`}>
                    {DAYS[s.day_of_week]} {s.start_time}–{s.end_time}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Preferred Date *</label>
            <Input type="date" min={today} value={bookingDate}
              onChange={(e) => { setBookingDate(e.target.value); setStartTime('') }} required
              className={`h-11 ${bookingDate && isDateUnavailable(bookingDate) ? 'border-amber-400 bg-amber-50' : ''}`} />
            {bookingDate && isDateUnavailable(bookingDate) && (
              <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> This day may not be available.
              </p>
            )}
            {timeBoundsForDate && (
              <p className={`text-xs mt-1 font-medium ${themeUi.textPrimary}`}>Available: {timeBoundsForDate.start} – {timeBoundsForDate.end}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Preferred Time</label>
            <Input type="time" value={startTime} min={timeBoundsForDate?.start} max={timeBoundsForDate?.end}
              onChange={(e) => setStartTime(e.target.value)} className="h-11" />
            <p className="text-xs text-gray-400 mt-1">Leave blank if no preference</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Notes</label>
            <textarea className={`flex w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm min-h-[60px] resize-none transition-shadow ${themeUi.focusRingInput}`}
              value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any special instructions..." />
          </div>

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="cancel" className="flex-1 h-11 rounded-xl" onClick={onClose}>Cancel</Button>
            <Button type="submit" className={`flex-1 h-11 rounded-xl font-bold ${themeUi.btnSolid}`}
              disabled={!bookingDate || createBooking.isPending}>
              {createBooking.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CalendarDays className="w-4 h-4 mr-2" />}
              Confirm Booking
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Quote Request Modal ───────────────────────────────────────────

import type { QuoteFormField } from '@/types'
import { QuoteFormFieldInput } from '@/components/quote/QuoteFormFieldInput'
import { isQuoteFieldEmpty } from '@/components/quote/quoteFieldHelpers'

const FALLBACK_QUOTE_FIELDS: QuoteFormField[] = [
  { key: 'name', label: 'Full Name', type: 'text', required: true, enabled: true, placeholder: 'Your name' },
  { key: 'email', label: 'Email', type: 'email', required: true, enabled: true, placeholder: 'Email address' },
  { key: 'message', label: 'Message', type: 'textarea', required: true, enabled: true, placeholder: 'Describe your requirements...' },
  { key: 'preferred_date', label: 'Preferred Date', type: 'date', required: false, enabled: true },
  { key: 'preferred_time', label: 'Preferred Time', type: 'time', required: false, enabled: true },
]

function QuoteRequestModal({
  serviceId, serviceName, formConfig, customerInfo, onClose,
}: {
  serviceId: string; serviceName: string; formConfig?: QuoteFormField[]
  customerInfo?: { name?: string; email?: string; phone?: string }
  onClose: () => void
}) {
  const requestQuote = useRequestQuote()
  const fields = (formConfig && formConfig.length > 0) ? formConfig.filter(f => f.enabled) : FALLBACK_QUOTE_FIELDS

  const initialData: Record<string, string> = {}
  if (customerInfo?.name) initialData.name = customerInfo.name
  if (customerInfo?.email) initialData.email = customerInfo.email
  if (customerInfo?.phone) initialData.phone = customerInfo.phone

  const [formData, setFormData] = useState<Record<string, string>>(initialData)
  const [errors, setErrors] = useState<Record<string, boolean>>({})
  const today = new Date().toISOString().split('T')[0]

  const updateField = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: false }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const newErrors: Record<string, boolean> = {}
    for (const f of fields) {
      if (f.required && isQuoteFieldEmpty(f, formData[f.key] || '')) newErrors[f.key] = true
    }
    if (Object.keys(newErrors).length) { setErrors(newErrors); return }

    requestQuote.mutate(
      { service_id: serviceId, service_name: serviceName, form_data: formData },
      { onSuccess: () => onClose() },
    )
  }

  const inputCls = (key: string) =>
    `w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors ${
      errors[key] ? 'border-red-400 ring-2 ring-red-100' : `border-gray-300 ${themeUi.focusRingInput}`
    }`

  const autoFilledKeys = new Set(Object.keys(initialData).filter(k => initialData[k]))
  const isAutoFilled = (key: string) => autoFilledKeys.has(key)
  const readOnlyCls = 'bg-gray-50 text-gray-500 cursor-not-allowed'

  const renderField = (f: QuoteFormField) => (
    <QuoteFormFieldInput
      field={f}
      value={formData[f.key] || ''}
      onChange={(v) => updateField(f.key, v)}
      inputClassName={inputCls}
      readOnly={isAutoFilled(f.key)}
      readOnlyClassName={readOnlyCls}
      today={today}
    />
  )

  const dateTimeFields = fields.filter((f) => f.type === 'date' || f.type === 'time')
  const otherFields = fields.filter((f) => f.type !== 'date' && f.type !== 'time')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in zoom-in-95 fade-in-0 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white rounded-t-2xl z-10">
          <div className="flex items-center gap-2">
            <MessageSquare className={`w-5 h-5 ${themeUi.iconPrimary}`} />
            <h2 className="text-lg font-bold text-gray-900">Request a Quote</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className={`rounded-xl p-3 border ${themeUi.bgSoftPanel} ${themeUi.borderPrimaryMuted}`}>
            <p className={`text-sm font-medium ${themeUi.textOnPrimaryMuted}`}>{serviceName}</p>
            <p className={`text-xs mt-0.5 ${themeUi.textPrimary}`}>The vendor will review your request and respond with pricing.</p>
          </div>

          {otherFields.map(f => (
            <div key={f.key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {f.label}{f.required && <span className="text-red-500 ml-0.5">*</span>}
              </label>
              {renderField(f)}
              {errors[f.key] && <p className="text-xs text-red-500 mt-1">{f.label} is required</p>}
            </div>
          ))}

          {dateTimeFields.length > 0 && (
            <div className={`grid gap-3 ${dateTimeFields.length >= 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {dateTimeFields.map(f => (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {f.label}{f.required && <span className="text-red-500 ml-0.5">*</span>}
                  </label>
                  {renderField(f)}
                  {errors[f.key] && <p className="text-xs text-red-500 mt-1">{f.label} is required</p>}
                </div>
              ))}
            </div>
          )}

          <Button type="submit" disabled={requestQuote.isPending}
            className={`w-full h-11 font-bold rounded-xl ${themeUi.btnSolid}`} size="lg">
            {requestQuote.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            Submit Quote Request
          </Button>
        </form>
      </div>
    </div>
  )
}

// ── Main ServiceDetail ────────────────────────────────────────────

export default function ServiceDetail() {
  const { storePath, vendor, displayFields } = useVendor()
  const sf = displayFields.service
  const { slug } = useParams<{ slug: string }>()
  const { data: service, isLoading } = useService(slug!)
  const { isAuthenticated, customer } = useAuthStore()
  const navigate = useNavigate()
  const addToCart = useAddToCart()
  const [showBooking, setShowBooking] = useState(false)
  const [showQuote, setShowQuote] = useState(false)
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [selectedImage, setSelectedImage] = useState(0)
  const [sidebarMode, setSidebarMode] = useState<'booking' | 'subscription'>('subscription')

  useEffect(() => {
    if (sidebarMode === 'subscription') setShowBooking(false)
  }, [sidebarMode])

  const activePlans = useMemo(() => (service?.plans || []).filter(p => p.is_active), [service])
  const selectedPlan = useMemo(
    () => activePlans.find(p => p.id === selectedPlanId) ?? activePlans[0] ?? null,
    [activePlans, selectedPlanId],
  )

  const isSubscription = !!service?.is_subscription
  const canBook = !!service?.requires_booking
  const canQuote = !!service?.allow_quote_request
  const hasBothModes = isSubscription && canBook
  const currency = service?.currency || 'INR'

  const subscriptionInterval = selectedPlan?.subscription_interval ?? service?.subscription_interval ?? 'monthly'
  const subscriptionPrice = selectedPlan?.price ?? service?.subscription_price ?? service?.price ?? 0
  const subscriptionPriceType = selectedPlan?.price_type ?? service?.subscription_price_type ?? 'per_cycle'
  const subscriptionUom = selectedPlan?.uom ?? service?.uom ?? 'session'
  const subscriptionTrialDays = selectedPlan?.subscription_trial_days ?? service?.subscription_trial_days
  const subscriptionSetupFee = selectedPlan?.subscription_setup_fee ?? service?.subscription_setup_fee
  const subscriptionBillingCycles = selectedPlan?.subscription_billing_cycles ?? service?.subscription_billing_cycles
  const subscriptionScheduleModes = selectedPlan?.subscription_schedule_modes ?? service?.subscription_schedule_modes ?? []

  // Build media items for MediaViewer
  const displayMedia = useMemo(() => {
    if (service?.media && service.media.length > 0) {
      return service.media.map((m: any) => ({
        id: m.id || m.url,
        url: m.url,
        alt_text: m.alt_text,
        is_primary: m.is_primary,
        media_type: m.media_type || 'image',
      }))
    }
    if (service?.gallery && service.gallery.length > 0) {
      return service.gallery.map((url: string, i: number) => ({
        id: `gallery-${i}`, url, alt_text: service.name, is_primary: i === 0, media_type: 'image' as const,
      }))
    }
    if (service?.image_url) {
      return [{ id: 'hero', url: service.image_url, alt_text: service.name, is_primary: true, media_type: 'image' as const }]
    }
    return []
  }, [service])

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-gray-300" /></div>
  if (!service) {
    return (
      <div className="text-center py-20">
        <Wrench className="w-16 h-16 text-gray-200 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-1">Service not found</h2>
        <p className="text-gray-500 text-sm">This service may have been removed or is no longer available.</p>
      </div>
    )
  }

  const hasWhatsIncluded = sf.whats_included && service.whats_included && service.whats_included.length > 0
  const hasWhatsNotIncluded = sf.whats_not_included && service.whats_not_included && service.whats_not_included.length > 0
  const unitPrice = selectedPlan?.price ?? service.price

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Breadcrumb */}
      <nav className={`text-sm mb-5 flex items-center gap-1 flex-wrap ${themeUi.pageTextMuted}`}>
        <Link to={storePath('/')} className={themeUi.linkOnPage}>Home</Link>
        <ChevronRight className="w-3 h-3" />
        <Link to={storePath('/services')} className={themeUi.linkOnPage}>Services</Link>
        {service.category && (
          <>
            <ChevronRight className="w-3 h-3" />
            <Link to={storePath(`/services?category=${encodeURIComponent(service.category)}`)} className={themeUi.linkOnPage}>{service.category}</Link>
          </>
        )}
        <ChevronRight className="w-3 h-3" />
        <span className={`font-medium ${themeUi.pageText}`}>{service.name}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Left — Media Gallery (sticky) */}
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-4">
            {displayMedia.length > 0 ? (
              <MediaViewer
                items={displayMedia}
                selectedIndex={selectedImage}
                onSelect={setSelectedImage}
                productName={service.name}
                layout="detail"
                badges={
                  <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                    {isSubscription && (
                      <span className="text-white text-xs font-bold px-2.5 py-1 rounded-lg shadow flex items-center gap-1 bg-[color:var(--color-primary)]">
                        <Repeat className="w-3 h-3" /> Subscription
                      </span>
                    )}
                    {sf.offer_label && service.offer_label && (
                      <span className="bg-amber-500 text-white text-xs font-bold px-2.5 py-1 rounded-lg shadow flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> {service.offer_label}
                      </span>
                    )}
                  </div>
                }
              />
            ) : (
              <div className={`aspect-[4/3] max-h-[min(420px,55vw)] w-full max-w-[560px] mx-auto lg:mx-0 rounded-2xl border border-gray-200/80 flex flex-col items-center justify-center ${themeUi.gradientHeroBr}`}>
                <Wrench className={`w-14 h-14 mb-2 ${themeUi.iconPlaceholder}`} />
                <p className="text-sm text-gray-400">No media available</p>
              </div>
            )}
          </div>
        </div>

        {/* Center — Service Info */}
        <div className="lg:col-span-5 space-y-6">
          <header className="space-y-3">
          {/* Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            {service.category && (
              <span className={`text-xs font-bold px-2.5 py-1 rounded-lg uppercase tracking-wider ${themeUi.pillSecondary}`}>
                {service.category}
              </span>
            )}
            {sf.brand && service.brand && (
              <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded-lg">{service.brand}</span>
            )}
            {sf.service_mode && service.service_mode && (
              <span className={`text-xs font-medium px-2 py-1 rounded-lg flex items-center gap-1 ${themeUi.pillPrimary}`}>
                <Monitor className="w-3 h-3" /> {SERVICE_MODE_LABELS[service.service_mode] || service.service_mode.replace(/_/g, ' ')}
              </span>
            )}
            {isSubscription && (
              <span className={`text-xs font-bold px-2 py-1 rounded-lg flex items-center gap-1 ${themeUi.pillAccentBold}`}>
                <Repeat className="w-3 h-3" /> Subscription
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight">{service.name}</h1>

          {/* Rating */}
          {(service.avg_rating ?? 0) > 0 && (
            <StarRating rating={service.avg_rating!} showValue reviewCount={service.review_count} />
          )}
          </header>

          {/* Pricing */}
          {isSubscription && selectedPlan ? (
            <div className={`rounded-xl p-4 border ${themeUi.gradientHero} ${themeUi.borderPrimaryMuted}`}>
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-3xl font-extrabold text-gray-900">
                  {formatCurrency(subscriptionPrice, currency)}
                </span>
                <span className="text-sm text-gray-500">
                  {subscriptionPriceType === 'per_unit'
                    ? `/${UOM_LABELS[subscriptionUom] || subscriptionUom || 'unit'}`
                    : (intervalShort[subscriptionInterval] || `/${subscriptionInterval}`)}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Billed {intervalLabel[subscriptionInterval] || subscriptionInterval} · Inclusive of all taxes
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-3 flex-wrap">
              {unitPrice != null && (
                <span className="text-3xl font-extrabold text-gray-900">
                  {formatCurrency(unitPrice, currency)}
                  {(selectedPlan?.uom ?? service.uom) && (selectedPlan?.uom ?? service.uom) !== 'fixed' && (
                    <span className="text-sm font-normal text-gray-500 ml-1">/{UOM_LABELS[selectedPlan?.uom ?? service.uom] || selectedPlan?.uom || service.uom}</span>
                  )}
                </span>
              )}
              {(selectedPlan?.duration_minutes ?? service.duration_minutes) ? (
                <span className="flex items-center gap-1.5 text-sm text-gray-600 bg-gray-100 px-3 py-1.5 rounded-full">
                  <Clock className={`w-4 h-4 ${themeUi.iconPrimary}`} /> {selectedPlan?.duration_minutes ?? service.duration_minutes} min
                </span>
              ) : null}
            </div>
          )}

          {sf.short_description && service.short_description && (
            <p className="text-sm text-gray-600 leading-relaxed">{service.short_description}</p>
          )}

          {/* Plan Selector — always shown when plans exist */}
          {activePlans.length > 0 && (
            <div className="pt-2">
              <PlanSelector
                plans={activePlans}
                currency={currency}
                selectedId={selectedPlanId ?? activePlans[0]?.id ?? null}
                onSelect={setSelectedPlanId}
              />
            </div>
          )}

          {/* Description */}
          {service.description && (
            <div className="pt-4 border-t border-gray-100">
              <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2 text-sm">
                <Info className="w-4 h-4 text-gray-400" /> About This Service
              </h3>
              <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{service.description}</p>
            </div>
          )}

          {/* Tags */}
          {sf.tags && service.tags && service.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {service.tags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
                  <Tag className="w-3 h-3" />{tag}
                </span>
              ))}
            </div>
          )}

          {/* What's Included */}
          {hasWhatsIncluded && (
            <div className="pt-4 border-t border-gray-100">
              <h3 className="font-bold text-gray-900 mb-3 text-sm">What's Included</h3>
              <div className="grid gap-2">
                {service.whats_included!.map((item) => (
                  <div key={item} className="flex items-center gap-2.5 text-sm text-gray-600">
                    <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" /> {item}
                  </div>
                ))}
              </div>
            </div>
          )}

          {hasWhatsNotIncluded && (
            <div className="pt-4 border-t border-gray-100">
              <h3 className="font-bold text-gray-900 mb-3 text-sm">What's Not Included</h3>
              <div className="grid gap-2">
                {service.whats_not_included!.map((item) => (
                  <div key={item} className="flex items-center gap-2.5 text-sm text-gray-500">
                    <XCircle className="w-4 h-4 text-red-400 shrink-0" /> {item}
                  </div>
                ))}
              </div>
            </div>
          )}

          {sf.prerequisites && service.prerequisites && (
            <div className="pt-4 border-t border-gray-100">
              <h3 className="font-bold text-gray-900 mb-3 text-sm">Prerequisites</h3>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{service.prerequisites}</p>
            </div>
          )}

          {sf.service_areas && service.service_areas && service.service_areas.length > 0 && (
            <div className="pt-4 border-t border-gray-100">
              <h3 className="font-bold text-gray-900 mb-3 text-sm flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gray-400" /> Service Areas
              </h3>
              <div className="flex flex-wrap gap-2">
                {service.service_areas.map((area) => (
                  <span key={area} className="text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded-full">{area}</span>
                ))}
              </div>
            </div>
          )}

          {sf.cancellation_policy && (service.cancellation_policy || service.rescheduling_policy) && (
            <div className="pt-4 border-t border-gray-100">
              <h3 className="font-bold text-gray-900 mb-3 text-sm flex items-center gap-2">
                <Shield className="w-4 h-4 text-gray-400" /> Policies
              </h3>
              <div className="space-y-2 text-sm text-gray-600">
                {service.cancellation_policy && (
                  <p><span className="font-semibold text-gray-700">Cancellation:</span> {service.cancellation_policy}
                    {service.cancellation_hours ? ` (${service.cancellation_hours}h notice)` : ''}</p>
                )}
                {service.rescheduling_policy && (
                  <p><span className="font-semibold text-gray-700">Rescheduling:</span> {service.rescheduling_policy}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right — Sidebar */}
        <div className="lg:col-span-3 min-w-0">
          <div className={`rounded-2xl border-2 p-5 sm:p-7 sticky top-4 space-y-6 shadow-md max-h-[90vh] overflow-y-auto ${themeUi.cardSurface} ${themeUi.cardBorder}`}>
            {/* Mode toggle — shown when vendor enabled both booking & subscription */}
            {hasBothModes && (
              <div className="flex rounded-xl bg-gray-100/90 p-1 gap-1 ring-1 ring-gray-200/70">
                <button
                  type="button"
                  onClick={() => setSidebarMode('booking')}
                  className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold py-2.5 rounded-lg transition-all ${
                    sidebarMode === 'booking'
                      ? themeUi.toggleActive
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <CalendarDays className="w-4 h-4" /> Booking
                </button>
                <button
                  type="button"
                  onClick={() => setSidebarMode('subscription')}
                  className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold py-2.5 rounded-lg transition-all ${
                    sidebarMode === 'subscription'
                      ? themeUi.toggleActive
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Repeat className="w-4 h-4" /> Subscription
                </button>
              </div>
            )}

            {/* Subscription panel */}
            {((hasBothModes && sidebarMode === 'subscription') || (isSubscription && !canBook)) && subscriptionPrice > 0 && (
              <>
                <SubscriptionConfigurator
                  key={`${selectedPlanId || 'default'}-${subscriptionInterval}`}
                  interval={subscriptionInterval}
                  pricePerCycle={subscriptionPrice}
                  currency={currency}
                  priceType={subscriptionPriceType}
                  uom={UOM_LABELS[subscriptionUom] || subscriptionUom}
                  trialDays={subscriptionTrialDays}
                  setupFee={subscriptionSetupFee}
                  maxCycles={subscriptionBillingCycles}
                  allowedModes={subscriptionScheduleModes}
                  onSubscribe={(config) => {
                    if (!isAuthenticated) { navigate(storePath('/login')); return }
                    if (!service) return
                    const imageUrl =
                      displayMedia[0]?.url || service.image_url || service.gallery?.[0] || ''
                    const planPart =
                      selectedPlan &&
                      selectedPlan.name.trim().toLowerCase() !== service.name.trim().toLowerCase()
                        ? ` — ${selectedPlan.name}`
                        : ''
                    const name = `${service.name}${planPart} (Subscription, ${config.cycles} cycle${config.cycles !== 1 ? 's' : ''})`
                    addToCart.mutate(
                      {
                        product_id: service.id,
                        name,
                        qty: 1,
                        price: config.total,
                        image_url: imageUrl || undefined,
                      },
                      { onSuccess: () => navigate(storePath('/checkout')) },
                    )
                  }}
                  subscribePending={addToCart.isPending}
                />
                {canQuote && (
                  <Button variant="outline" className="w-full h-12 font-bold rounded-xl" size="lg"
                    onClick={() => { if (!isAuthenticated) { navigate(storePath('/login')); return }; setShowQuote(true) }}>
                    <MessageSquare className="w-5 h-5 mr-2" /> Request a Quote
                  </Button>
                )}
              </>
            )}

            {/* Booking panel */}
            {((hasBothModes && sidebarMode === 'booking') || (canBook && !isSubscription)) && (
              <>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Price</p>
                  {unitPrice != null ? (
                    <p className="text-3xl font-extrabold text-gray-900 mt-1">
                      {formatCurrency(unitPrice, currency)}
                      {(selectedPlan?.uom ?? service.uom) && (selectedPlan?.uom ?? service.uom) !== 'fixed' && (
                        <span className="text-base font-normal text-gray-500 ml-1">/{UOM_LABELS[selectedPlan?.uom ?? service.uom] || selectedPlan?.uom || service.uom}</span>
                      )}
                    </p>
                  ) : (
                    <p className="text-xl font-bold text-amber-600 mt-1">Get a Quote</p>
                  )}
                  {service.price_min != null && service.price_max != null && (
                    <p className="text-xs text-gray-400 mt-1">
                      Range: {formatCurrency(service.price_min, currency)} – {formatCurrency(service.price_max, currency)}
                    </p>
                  )}
                </div>

                {(selectedPlan?.duration_minutes ?? service.duration_minutes) ? (
                  <div className={`flex items-center gap-3 text-sm text-gray-600 rounded-xl p-3 border ${themeUi.bgBlueishPanel} ${themeUi.borderPrimarySoft}`}>
                    <Clock className={`w-5 h-5 ${themeUi.iconPrimary}`} />
                    <span>Duration: <strong>{selectedPlan?.duration_minutes ?? service.duration_minutes} min</strong></span>
                  </div>
                ) : null}

                <Button className={`w-full h-12 font-bold rounded-xl shadow-sm ${themeUi.btnSolid}`} size="lg"
                  onClick={() => { if (!isAuthenticated) { navigate(storePath('/login')); return }; setShowBooking(true) }}>
                  <CalendarDays className="w-5 h-5 mr-2" /> Book This Service
                </Button>
                {canQuote && (
                  <Button variant="outline" className="w-full h-12 font-bold rounded-xl" size="lg"
                    onClick={() => { if (!isAuthenticated) { navigate(storePath('/login')); return }; setShowQuote(true) }}>
                    <MessageSquare className="w-5 h-5 mr-2" /> Request a Quote
                  </Button>
                )}
              </>
            )}

            {/* Fallback — neither booking nor subscription enabled */}
            {!canBook && !isSubscription && (
              <>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Price</p>
                  {unitPrice != null ? (
                    <p className="text-3xl font-extrabold text-gray-900 mt-1">
                      {formatCurrency(unitPrice, currency)}
                      {(selectedPlan?.uom ?? service.uom) && (selectedPlan?.uom ?? service.uom) !== 'fixed' && (
                        <span className="text-base font-normal text-gray-500 ml-1">/{UOM_LABELS[selectedPlan?.uom ?? service.uom] || selectedPlan?.uom || service.uom}</span>
                      )}
                    </p>
                  ) : (
                    <p className="text-xl font-bold text-amber-600 mt-1">Contact for Pricing</p>
                  )}
                </div>
                {canQuote && (
                  <Button className={`w-full h-12 font-bold rounded-xl shadow-sm ${themeUi.btnSolid}`} size="lg"
                    onClick={() => { if (!isAuthenticated) { navigate(storePath('/login')); return }; setShowQuote(true) }}>
                    <MessageSquare className="w-5 h-5 mr-2" /> Request a Quote
                  </Button>
                )}
              </>
            )}

            {/* Trust badges */}
            <div className={`grid grid-cols-2 gap-2 pt-3 border-t ${themeUi.borderPrimaryMuted}`}>
              <div className={`flex items-center gap-2 text-xs ${themeUi.textSecondaryTone}`}>
                <Shield className={`w-3.5 h-3.5 ${themeUi.trustIcon}`} /> Verified Vendor
              </div>
              <div className={`flex items-center gap-2 text-xs ${themeUi.textSecondaryTone}`}>
                <Star className={`w-3.5 h-3.5 ${themeUi.trustIconAccent}`} /> Quality Assured
              </div>
            </div>

            {/* Contact */}
            <div className={`border-t pt-4 space-y-2.5 ${themeUi.borderPrimaryMuted}`}>
              <h4 className={`text-xs font-bold uppercase tracking-wider ${themeUi.textSecondaryTone}`}>Contact</h4>
              {vendor?.primary_phone && (
                <a href={`tel:${vendor.primary_phone}`} className={`flex items-center gap-2.5 text-sm ${themeUi.textPrimary} ${themeUi.linkHover}`}>
                  <Phone className={`w-4 h-4 ${themeUi.iconPrimary}`} /> {vendor.primary_phone}
                </a>
              )}
              {vendor?.primary_email && (
                <a href={`mailto:${vendor.primary_email}`} className={`flex items-center gap-2.5 text-sm ${themeUi.textPrimary} ${themeUi.linkHover}`}>
                  <Mail className={`w-4 h-4 ${themeUi.iconPrimary}`} /> {vendor.primary_email}
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Weekly Availability — hidden while subscription flow is active (no parallel booking) */}
      {(() => {
        const planAvail = selectedPlan?.availability && selectedPlan.availability.length > 0
          ? selectedPlan.availability
          : null
        const avail = planAvail ?? service.availability
        const showWeeklySlots = canBook && (!hasBothModes || sidebarMode === 'booking')
        return avail && avail.length > 0 && showWeeklySlots ? (
          <div className="mt-10">
            <BookingSlotsPanel availability={avail} />
          </div>
        ) : null
      })()}

      {/* Reviews */}
      <div className={`mt-8 rounded-2xl border p-6 sm:p-8 ${themeUi.cardSurface} ${themeUi.cardBorder}`}>
        <ReviewSection reviewType="service" targetId={service.id} />
      </div>

      {showBooking && service && (
        <BookingModal
          serviceId={service.id}
          serviceName={selectedPlan ? `${service.name} — ${selectedPlan.name}` : service.name}
          price={selectedPlan?.price ?? service.price ?? 0}
          duration={selectedPlan?.duration_minutes ?? service.duration_minutes}
          availability={
            selectedPlan?.availability && selectedPlan.availability.length > 0
              ? selectedPlan.availability
              : service.availability
          }
          onClose={() => setShowBooking(false)}
        />
      )}

      {showQuote && service && (
        <QuoteRequestModal
          serviceId={service.id}
          serviceName={selectedPlan ? `${service.name} — ${selectedPlan.name}` : service.name}
          formConfig={service.quote_form_config}
          customerInfo={customer ? { name: customer.full_name, email: customer.email, phone: customer.phone } : undefined}
          onClose={() => setShowQuote(false)}
        />
      )}
    </div>
  )
}
