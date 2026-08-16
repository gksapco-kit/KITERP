import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useService, useRequestQuote } from '@/hooks/useStore'
import { useAuthStore } from '@/stores/authStore'
import { useIsCustomerLoggedIn } from '@/hooks/useAuthHydrated'
import { storeApi } from '@/api/store'
import { claimSessionTrack, getVisitorId } from '@/lib/visitorId'
import { formatCurrency, imgUrl } from '@/lib/utils'
import { isPricedAmount, servicePriceFallbackLabel, isPriceNotApplicable } from '@/lib/servicePricing'
import {
  Clock, Wrench, Loader2, ChevronLeft, ChevronRight, CheckCircle, XCircle,
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
import { CatalogShareButton } from '@/components/catalog/CatalogShareButton'
import SubscriptionConfigurator from '@/components/SubscriptionConfigurator'
import type { ServicePlan, ServiceAvailability } from '@/types'
import { isDisplayFieldEnabled } from '@/lib/storefrontDisplayFields'
import { serviceBookingLabel, serviceBookingCtaLabel, serviceSubscriptionLabel, serviceSubscriptionCtaLabel, serviceQuoteCtaLabel } from '@/lib/serviceStorefrontCta'
import { proceedSubscribeToCheckout } from '@/lib/subscribeCheckout'
import { resolveServiceThumbnailUrl } from '@/lib/productImageUtils'
import { useQueryClient } from '@tanstack/react-query'
import { useDocumentSeo, vendorPageTitle } from '@/lib/documentSeo'
import { breadcrumbJsonLd, compactJsonLd, seoKeywords, serviceJsonLd } from '@/lib/catalogSeo'

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

/** Pluralize duration units for clearer labels (e.g. "2 months", "1 month"). */
function pluralizeDurationUnit(unit: string, value: number) {
  if (value === 1) return unit
  const invariable = new Set(['kg', 'ml', 'sq.ft', 'sq.m', 'km'])
  if (invariable.has(unit.toLowerCase()) || unit.endsWith('s')) return unit
  return `${unit}s`
}

/** Duration label uses billing UOM when set (e.g. Time / Month → "2 months"), else minutes. */
function formatDurationLabel(value: number, uom?: string | null) {
  if (uom && uom !== 'fixed') {
    const unit = UOM_LABELS[uom] || uom.replace(/^per_/, '').replace(/_/g, ' ')
    return `${value} ${pluralizeDurationUnit(unit, value)}`
  }
  return value === 1 ? '1 min' : `${value} mins`
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
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
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

export function PlanSelector({
  plans, currency, selectedId, onSelect, hidePrice = false, compact = false, priceType,
}: {
  plans: ServicePlan[]; currency: string; selectedId: string | null; onSelect: (id: string) => void
  hidePrice?: boolean
  compact?: boolean
  /** Service-level price_type — hides plan prices when not_applicable; Free when free. */
  priceType?: string | null
}) {
  const activePlans = plans.filter(p => p.is_active)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const priceHidden = hidePrice || isPriceNotApplicable(priceType)
  const isCompact = compact || priceHidden

  const updateScrollState = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    const maxScroll = el.scrollWidth - el.clientWidth
    setCanScrollLeft(el.scrollLeft > 2)
    setCanScrollRight(maxScroll > 2 && el.scrollLeft < maxScroll - 2)
  }, [])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    updateScrollState()
    el.addEventListener('scroll', updateScrollState, { passive: true })
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateScrollState) : null
    ro?.observe(el)
    return () => {
      el.removeEventListener('scroll', updateScrollState)
      ro?.disconnect()
    }
  }, [activePlans.length, updateScrollState])

  const scrollByCard = (dir: -1 | 1) => {
    const el = scrollerRef.current
    if (!el) return
    const card = el.querySelector<HTMLElement>('[data-plan-card]')
    const step = card ? card.offsetWidth + 8 : Math.max(160, el.clientWidth * 0.7)
    el.scrollBy({ left: dir * step, behavior: 'smooth' })
  }

  if (activePlans.length === 0) return null

  const showArrows = canScrollLeft || canScrollRight

  return (
    <div>
      <p className={`font-bold uppercase tracking-wider flex items-center gap-1.5 ${themeUi.textPrimary} ${
        isCompact ? 'text-[10px] mb-2' : 'text-xs mb-2'
      }`}>
        <Repeat className="w-3 h-3" /> Choose
      </p>
      <div className="relative flex items-center gap-1">
        {showArrows && (
          <button
            type="button"
            aria-label="Previous plans"
            disabled={!canScrollLeft}
            onClick={() => scrollByCard(-1)}
            className={`shrink-0 flex h-8 w-8 items-center justify-center rounded-full border bg-white shadow-sm transition-opacity ${
              canScrollLeft
                ? 'border-gray-200 text-gray-700 hover:bg-gray-50'
                : 'border-gray-100 text-gray-300 cursor-default opacity-40'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
        <div
          ref={scrollerRef}
          className="flex min-w-0 flex-1 gap-2 overflow-x-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="radiogroup"
          aria-label="Choose a plan"
        >
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
              <button
                key={plan.id}
                type="button"
                data-plan-card
                onClick={() => onSelect(plan.id)}
                className={`w-52 shrink-0 overflow-hidden rounded-lg border-2 text-left transition-all duration-200 p-2.5 ${
                  isSelected
                    ? 'border-[color:var(--color-secondary)] bg-white shadow-sm ring-1 ring-[color:var(--color-secondary)]/20'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/80 bg-white'
                }`}
              >
                <div className="flex items-start gap-1.5 min-w-0">
                  <div
                    className={`mt-0.5 flex shrink-0 items-center justify-center rounded-full border-2 transition-colors h-3.5 w-3.5 ${
                      isSelected
                        ? 'border-[color:var(--color-secondary)] bg-[color:var(--color-secondary)]'
                        : 'border-gray-300 bg-white'
                    }`}
                    aria-hidden
                  >
                    {isSelected ? <CheckCircle className="w-2 h-2 text-white" strokeWidth={2.5} /> : null}
                  </div>
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <p className="font-bold text-gray-900 truncate text-xs leading-tight">{plan.name}</p>
                    {!priceHidden && (
                      <div className="mt-0.5 min-w-0">
                        {priceType === 'free' ? (
                          <p className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded inline-block">
                            Free
                          </p>
                        ) : isPricedAmount(plan.price) ? (
                          <div className="min-w-0">
                            <p className="text-sm font-extrabold text-gray-900 tabular-nums leading-snug break-all">
                              {formatCurrency(plan.price, currency)}
                            </p>
                            <p className="text-[10px] font-normal text-gray-500 leading-tight">{vShort}</p>
                          </div>
                        ) : (
                          <p className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded inline-block">
                            {servicePriceFallbackLabel(plan.price, priceType, 'Get a Quote')}
                          </p>
                        )}
                      </div>
                    )}
                    {hidePrice && !isPriceNotApplicable(priceType) && priceType !== 'free' && !isPricedAmount(plan.price) && (
                      <span className="mt-0.5 inline-block text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                        {servicePriceFallbackLabel(plan.price, priceType, 'Get a Quote')}
                      </span>
                    )}
                    {plan.description && (
                      <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-2 leading-snug break-words">{plan.description}</p>
                    )}
                  </div>
                </div>
                {(hasTrial || hasSetup || plan.duration_minutes) && (
                  <div className="flex flex-wrap gap-1 mt-1.5 ml-5 min-w-0">
                    {hasTrial && (
                      <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                        {plan.subscription_trial_days}d trial
                      </span>
                    )}
                    {hasSetup && (
                      <span className="max-w-full text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full truncate">
                        {formatCurrency(plan.subscription_setup_fee!, currency)} setup
                      </span>
                    )}
                    {plan.duration_minutes ? (
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${themeUi.pillDuration}`}>
                        <Clock className="w-2 h-2 shrink-0" />{formatDurationLabel(plan.duration_minutes, plan.uom)}
                      </span>
                    ) : null}
                  </div>
                )}
              </button>
            )
          })}
        </div>
        {showArrows && (
          <button
            type="button"
            aria-label="Next plans"
            disabled={!canScrollRight}
            onClick={() => scrollByCard(1)}
            className={`shrink-0 flex h-8 w-8 items-center justify-center rounded-full border bg-white shadow-sm transition-opacity ${
              canScrollRight
                ? 'border-gray-200 text-gray-700 hover:bg-gray-50'
                : 'border-gray-100 text-gray-300 cursor-default opacity-40'
            }`}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}

// ── Booking Modal ─────────────────────────────────────────────────

function clampTimeToBounds(time: string, bounds: { start: string; end: string } | null): string {
  if (!time || !bounds) return time
  if (time < bounds.start) return bounds.start
  if (time > bounds.end) return bounds.end
  return time
}

function BookingModal({
  serviceId, planId, serviceName, price, priceType, duration, availability, imageUrl, onClose,
}: {
  serviceId: string; planId?: string | null; serviceName: string; price: number
  priceType?: string | null
  duration?: number
  availability?: AvailSlot[]; imageUrl?: string; onClose: () => void
}) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { storePath, vendorSlug } = useVendor()
  const [bookingPending, setBookingPending] = useState(false)
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

  useEffect(() => {
    if (!timeBoundsForDate) return
    setStartTime((prev) => clampTimeToBounds(prev || nextSlotTime, timeBoundsForDate))
  }, [bookingDate, timeBoundsForDate, nextSlotTime])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!bookingDate || bookingPending) return
    const effectiveTime = startTime
      ? clampTimeToBounds(startTime, timeBoundsForDate)
      : undefined
    const slotLabel = effectiveTime ? `${bookingDate} ${effectiveTime}` : bookingDate
    const cartItem = {
      service_id: serviceId,
      item_type: 'service' as const,
      name: `${serviceName} (Booking · ${slotLabel})`,
      qty: 1,
      price,
      image_url: imageUrl,
    }
    setBookingPending(true)
    try {
      await proceedSubscribeToCheckout({
        intent: {
          kind: 'booking',
          vendorSlug,
          cartItem,
          payload: {
            service_id: serviceId,
            plan_id: planId || undefined,
            booking_date: bookingDate,
            start_time: effectiveTime,
            notes: notes || undefined,
          },
        },
        cartItem,
        vendorSlug,
        navigate,
        storePath,
        qc,
        onBeforeNavigate: onClose,
      })
    } finally {
      setBookingPending(false)
    }
  }

  const openSlots = useMemo(
    () => [...(availability || [])].filter(s => s.is_available).sort((a, b) => a.day_of_week - b.day_of_week),
    [availability],
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 sm:p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in zoom-in-95 fade-in-0 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-2.5 border-b">
          <div className="flex items-center gap-2 min-w-0">
            <CalendarDays className={`w-4 h-4 shrink-0 ${themeUi.iconPrimary}`} />
            <h2 className="text-base font-bold text-gray-900 truncate">Book Service</h2>
          </div>
          <button type="button" onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition-colors shrink-0">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-4 py-3 space-y-2.5">
          <div className={`rounded-lg px-3 py-2 border flex items-center justify-between gap-3 ${themeUi.gradientHero} ${themeUi.borderPrimaryMuted}`}>
            <p className="font-semibold text-sm text-gray-900 truncate min-w-0">{serviceName}</p>
            <div className="flex items-center gap-2 shrink-0 text-sm text-gray-600">
              {!isPriceNotApplicable(priceType) && (
                <span className={`text-base font-extrabold tabular-nums ${
                  priceType === 'free'
                    ? 'text-emerald-700'
                    : !isPricedAmount(price)
                      ? 'text-amber-700'
                      : 'text-gray-900'
                }`}>
                  {priceType === 'free'
                    ? 'Free'
                    : isPricedAmount(price)
                      ? formatCurrency(price)
                      : (servicePriceFallbackLabel(price, priceType, 'Get a Quote') ?? '')}
                </span>
              )}
              {duration != null && duration > 0 && (
                <span className="flex items-center gap-0.5 bg-white/80 px-1.5 py-0.5 rounded-full text-[11px]">
                  <Clock className="w-2.5 h-2.5" /> {duration} min
                </span>
              )}
            </div>
          </div>

          {openSlots.length > 0 && (
            <div className={`rounded-lg px-2.5 py-1.5 border ${themeUi.bgSoftPanel} ${themeUi.borderPrimarySoft}`}>
              <p className={`text-[10px] font-bold mb-1 uppercase tracking-wider ${themeUi.textPrimary}`}>Available days</p>
              <div className="flex gap-1 flex-wrap">
                {openSlots.map(s => (
                  <span
                    key={s.id ?? `${s.day_of_week}-${s.start_time}-${s.end_time}`}
                    className={`text-[10px] font-medium leading-tight px-1.5 py-0.5 rounded-md ${themeUi.dayChip}`}
                  >
                    {DAYS[s.day_of_week]} {s.start_time}–{s.end_time}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            <div className="min-w-0">
              <label className="block text-xs font-semibold text-gray-700 mb-1">Preferred Date *</label>
              <Input
                type="date"
                min={today}
                value={bookingDate}
                onChange={(e) => setBookingDate(e.target.value)}
                required
                className={`h-9 text-sm ${bookingDate && isDateUnavailable(bookingDate) ? 'border-amber-400 bg-amber-50' : ''}`}
              />
              {bookingDate && isDateUnavailable(bookingDate) ? (
                <p className="text-[10px] text-amber-600 mt-0.5 flex items-center gap-0.5">
                  <AlertTriangle className="w-2.5 h-2.5 shrink-0" /> May be unavailable
                </p>
              ) : timeBoundsForDate ? (
                <p className={`text-[10px] mt-0.5 font-medium truncate ${themeUi.textPrimary}`}>
                  {timeBoundsForDate.start}–{timeBoundsForDate.end}
                </p>
              ) : null}
            </div>
            <div className="min-w-0">
              <label className="block text-xs font-semibold text-gray-700 mb-1">Preferred Time</label>
              <Input
                type="time"
                value={startTime}
                min={timeBoundsForDate?.start}
                max={timeBoundsForDate?.end}
                onChange={(e) => setStartTime(e.target.value)}
                className="h-9 text-sm"
              />
              <p className="text-[10px] text-gray-400 mt-0.5">Optional</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Notes</label>
            <textarea
              rows={2}
              className={`flex w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm resize-none transition-shadow ${themeUi.focusRingInput}`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any special instructions..."
            />
          </div>

          <div className="flex gap-2 pt-0.5">
            <Button type="button" variant="cancel" className="flex-1 h-9 rounded-xl text-sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              className={`flex-1 h-9 rounded-xl font-bold text-sm ${themeUi.btnSolid}`}
              disabled={!bookingDate || bookingPending}
            >
              {bookingPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <CalendarDays className="w-3.5 h-3.5 mr-1.5" />}
              Continue to checkout
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
  serviceId, serviceName, formConfig, customerInfo, title, onClose,
}: {
  serviceId: string; serviceName: string; formConfig?: QuoteFormField[]
  customerInfo?: { name?: string; email?: string; phone?: string }
  title?: string
  onClose: () => void
}) {
  const requestQuote = useRequestQuote()
  const fields = (formConfig && formConfig.length > 0) ? formConfig.filter(f => f.enabled) : FALLBACK_QUOTE_FIELDS
  const modalTitle = title || 'Request a Quote'

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
            <h2 className="text-lg font-bold text-gray-900">{modalTitle}</h2>
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
  const { storePath, vendorSlug, vendor, displayFields } = useVendor()
  const sf = displayFields.service
  const { slug } = useParams<{ slug: string }>()
  const { data: service, isLoading } = useService(slug!)
  const { customer } = useAuthStore()
  const { isLoggedIn } = useIsCustomerLoggedIn()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [subscribePending, setSubscribePending] = useState(false)
  const [showBooking, setShowBooking] = useState(false)
  const [showQuote, setShowQuote] = useState(false)
  const [showSubscription, setShowSubscription] = useState(false)
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [selectedImage, setSelectedImage] = useState(0)
  const [sidebarMode, setSidebarMode] = useState<'booking' | 'subscription'>('subscription')

  useEffect(() => {
    if (sidebarMode === 'subscription') setShowBooking(false)
    if (sidebarMode === 'booking') setShowSubscription(false)
  }, [sidebarMode])

  // Unique service view (once per browser session; 24h server-side dedupe)
  useEffect(() => {
    if (!service?.slug) return
    if (!claimSessionTrack('service', service.slug)) return
    storeApi.recordServiceView(service.slug, getVisitorId()).catch(() => {})
  }, [service?.slug])

  const vendorName = vendor?.display_name || vendor?.business_name || vendorSlug
  const servicePath = storePath(`/services/${service?.slug || slug || ''}`)
  const serviceImage = service
    ? resolveServiceThumbnailUrl({ image_url: service.image_url, media: service.media, gallery: service.gallery })
    : null
  const serviceDescription = service?.meta_description || service?.short_description || service?.description
  useDocumentSeo({
    title: service
      ? (service.meta_title?.trim() || `${service.name} | ${vendorName}`)
      : vendorPageTitle('Service', vendorName),
    description: service
      ? (serviceDescription || `Book ${service.name} from ${vendorName} on KITERP.`)
      : undefined,
    keywords: seoKeywords(service?.meta_keywords) || service?.tags?.join(', '),
    canonicalPath: servicePath,
    ogType: 'website',
    ogImage: serviceImage || vendor?.logo_url || '/favicon-192.png',
    ogImageAlt: service?.name || vendorName,
    ogSiteName: vendorName,
    jsonLd: service
      ? compactJsonLd([
          serviceJsonLd({
            name: service.name,
            description: serviceDescription,
            image: serviceImage,
            serviceType: service.category || service.service_type,
            price: service.price,
            currency: service.currency,
            url: servicePath,
            providerName: vendorName,
          }),
          breadcrumbJsonLd([
            { name: vendorName, path: storePath('/') },
            { name: 'Services', path: storePath('/services') },
            { name: service.name, path: servicePath },
          ]),
        ])
      : null,
  })

  const activePlans = useMemo(() => (service?.plans || []).filter(p => p.is_active), [service])
  const selectedPlan = useMemo(
    () => activePlans.find(p => p.id === selectedPlanId) ?? activePlans[0] ?? null,
    [activePlans, selectedPlanId],
  )

  const isSubscription = !!service?.is_subscription
  const canBook = !!service?.requires_booking
  const bookingLabel = serviceBookingLabel(service?.booking_label)
  const bookingCtaLabel = serviceBookingCtaLabel(service?.booking_label)
  const subscriptionLabel = serviceSubscriptionLabel(service?.subscription_label)
  const subscriptionCtaLabel = serviceSubscriptionCtaLabel(service?.subscription_label)
  const quoteCtaLabel = serviceQuoteCtaLabel(service?.quote_request_label)
  const canQuote = !!service?.allow_quote_request && sf.quote_request !== false
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
  const subscriptionIsTaxable = selectedPlan?.is_taxable ?? service?.is_taxable
  const subscriptionTaxRate = selectedPlan?.gst_rate ?? selectedPlan?.tax_rate ?? service?.gst_rate ?? service?.tax_rate

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
  const showShare = isDisplayFieldEnabled(sf, 'share')
  const sharePriceLabel =
    typeof unitPrice === 'number' && unitPrice > 0 && !isPriceNotApplicable(service.price_type)
      ? formatCurrency(unitPrice, currency)
      : undefined
  // Show subscribe CTA whenever the service is a subscription with a price.
  // Do not hide behind display-field toggles — customers need a working pay path.
  const showSubscriptionPanel =
    ((hasBothModes && sidebarMode === 'subscription') || (isSubscription && !canBook))
    && subscriptionPrice > 0

  const handleSubscribe = async (config: {
    interval: string; cycles: number; total: number
    startDate: string; endDate: string
    selectedDates?: string[]; weeklyDay?: number
    recurrence?: { every: number; unit: 'day' | 'week' | 'month'; weekdays?: number[] }
  }) => {
    if (subscribePending) return
    const planPart =
      selectedPlan &&
      selectedPlan.name.trim().toLowerCase() !== service.name.trim().toLowerCase()
        ? ` — ${selectedPlan.name}`
        : ''
    const name = `${service.name}${planPart} (Subscription, ${config.cycles} cycle${config.cycles !== 1 ? 's' : ''})`
    const imageUrl = resolveServiceThumbnailUrl({
      image_url: service.image_url,
      media: service.media,
      gallery: service.gallery,
    }) || undefined
    const cartItem = {
      service_id: service.id,
      item_type: 'service' as const,
      name,
      qty: 1,
      price: config.total > 0 ? config.total : subscriptionPrice,
      image_url: imageUrl,
      variant_label: `${config.cycles} ${config.interval || subscriptionInterval} cycle${config.cycles !== 1 ? 's' : ''}`,
    }
    setSubscribePending(true)
    try {
      await proceedSubscribeToCheckout({
        intent: {
          kind: 'subscription',
          vendorSlug,
          cartItem,
          payload: {
            item_type: 'service',
            service_id: service.id,
            item_name: name,
            interval: config.interval || subscriptionInterval,
            price_per_cycle: subscriptionPrice,
            qty: 1,
            schedule_config: {
              ...config,
              ...(selectedPlan?.id ? { plan_id: selectedPlan.id, plan_name: selectedPlan.name } : {}),
            },
          },
        },
        cartItem,
        vendorSlug,
        navigate,
        storePath,
        qc,
        onBeforeNavigate: () => setShowSubscription(false),
      })
    } finally {
      setSubscribePending(false)
    }
  }

  return (
    <div className="max-w-[1440px] mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
      {/* Breadcrumb — stop before the service name (title is shown in the hero) */}
      <nav className={`text-sm mb-5 flex items-center gap-1.5 flex-wrap ${themeUi.pageTextMuted}`}>
        <Link to={storePath('/')} className={themeUi.linkOnPage}>Home</Link>
        <ChevronRight className="w-3 h-3 shrink-0" />
        <Link to={storePath('/services')} className={themeUi.linkOnPage}>Services</Link>
        {isDisplayFieldEnabled(sf, 'category') && service.category && (
          <>
            <ChevronRight className="w-3 h-3 shrink-0" />
            <Link to={storePath(`/services?category=${encodeURIComponent(service.category)}`)} className={themeUi.linkOnPage}>{service.category}</Link>
          </>
        )}
      </nav>

      {/* Hero — gallery, summary, pricing */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        <div className="lg:col-span-8 xl:col-span-8 min-w-0 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 items-start">
            {/* Media Gallery */}
            <div>
                {displayMedia.length > 0 ? (
                  <MediaViewer
                    items={displayMedia}
                    selectedIndex={selectedImage}
                    onSelect={setSelectedImage}
                    productName={service.name}
                    layout="fit"
                    topRightOverlay={
                      showShare ? (
                        <CatalogShareButton
                          title={service.name}
                          priceLabel={sharePriceLabel}
                          overlay
                          className="h-10 w-10 rounded-lg"
                        />
                      ) : undefined
                    }
                    badges={
                      <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                        {isSubscription && (
                          <span className="text-white text-xs font-bold px-2.5 py-1 rounded-lg shadow flex items-center gap-1 bg-[color:var(--color-primary)]">
                            <Repeat className="w-3 h-3" /> {subscriptionLabel}
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
                  <div className={`aspect-[4/3] w-full max-w-[640px] mx-auto lg:mx-0 rounded-2xl border border-gray-200/80 flex flex-col items-center justify-center ${themeUi.gradientHeroBr}`}>
                    <Wrench className={`w-14 h-14 mb-2 ${themeUi.iconPlaceholder}`} />
                    <p className="text-sm text-gray-400">No media available</p>
                  </div>
                )}
            </div>

            {/* Service header */}
            <div className="space-y-4">
              <header className="space-y-3">
              {/* Badges */}
              <div className="flex items-center gap-2 flex-wrap">
                {isDisplayFieldEnabled(sf, 'category') && service.category && (
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-lg uppercase tracking-wider ${themeUi.pillSecondary}`}>
                    {service.category}
                  </span>
                )}
                {isDisplayFieldEnabled(sf, 'subcategory') && service.subcategory && (
                  <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded-lg">{service.subcategory}</span>
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
                  <span className="text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 bg-[color:var(--color-primary)] text-white">
                    <Repeat className="w-3 h-3" /> {subscriptionLabel}
                  </span>
                )}
              </div>

              {/* Title */}
              <div className="flex items-start justify-between gap-3">
                <h1 className="text-base sm:text-lg font-semibold text-gray-900 leading-snug break-words">{service.name}</h1>
                {showShare && displayMedia.length === 0 && (
                  <CatalogShareButton
                    title={service.name}
                    priceLabel={sharePriceLabel}
                    className="h-9 w-9 rounded-lg"
                  />
                )}
              </div>

              {/* Rating */}
              {isDisplayFieldEnabled(sf, 'reviews') && (service.avg_rating ?? 0) > 0 && (
                <StarRating rating={service.avg_rating!} showValue reviewCount={service.review_count} />
              )}
              </header>

              {/* Duration only here — price lives in the right sidebar to avoid doubling */}
              {!isSubscription && isDisplayFieldEnabled(sf, 'duration') && (selectedPlan?.duration_minutes ?? service.duration_minutes) ? (
                <span className="inline-flex items-center gap-1.5 text-sm text-gray-600 bg-gray-100 px-3 py-1.5 rounded-full w-fit">
                  <Clock className={`w-4 h-4 ${themeUi.iconPrimary}`} />{' '}
                  {formatDurationLabel(
                    selectedPlan?.duration_minutes ?? service.duration_minutes!,
                    selectedPlan?.uom ?? service.uom,
                  )}
                </span>
              ) : null}

              {sf.short_description && service.short_description && (
                <p className="text-sm text-gray-600 leading-relaxed">{service.short_description}</p>
              )}
            </div>
          </div>
        </div>

        {/* Right — pricing card (content height) */}
        <div className="lg:col-span-4 xl:col-span-4 min-w-0 lg:sticky lg:top-4">
          <div className={`rounded-2xl border p-3.5 sm:p-4 space-y-3 shadow-sm ${themeUi.cardSurface} ${themeUi.cardBorder}`}>
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
                  <CalendarDays className="w-4 h-4" /> {bookingLabel}
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
                  <Repeat className="w-4 h-4" /> {subscriptionLabel}
                </button>
              </div>
            )}

            {/* Subscription summary — configurator opens in a popup on proceed */}
            {showSubscriptionPanel && (
              <>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide leading-tight truncate">
                    {subscriptionLabel}
                  </p>
                  {!isPriceNotApplicable(service.price_type) && (
                    <p className="text-base sm:text-lg font-bold text-gray-900 mt-0.5 tabular-nums leading-tight break-all">
                      {formatCurrency(subscriptionPrice, currency)}
                      <span className="ml-1 text-xs font-medium text-gray-500">
                        {subscriptionPriceType === 'per_unit'
                          ? `per ${UOM_LABELS[subscriptionUom] || subscriptionUom}`
                          : (intervalShort[subscriptionInterval] || `/${subscriptionInterval}`)}
                      </span>
                    </p>
                  )}
                </div>
                <Button
                  className={`w-full h-10 font-bold rounded-xl shadow-sm text-sm ${themeUi.btnSolid}`}
                  onClick={() => setShowSubscription(true)}
                >
                  <Repeat className="w-4 h-4 mr-1.5" /> {subscriptionCtaLabel}
                </Button>
                {canQuote && (
                  <Button variant="outline" className="w-full h-9 font-semibold rounded-lg text-sm"
                    onClick={() => { if (!isLoggedIn) { navigate(storePath('/login')); return }; setShowQuote(true) }}>
                    <MessageSquare className="w-4 h-4 mr-1.5" /> {quoteCtaLabel}
                  </Button>
                )}
              </>
            )}

            {/* Booking panel */}
            {((hasBothModes && sidebarMode === 'booking') || (canBook && !isSubscription)) && (
              <>
                {!isPriceNotApplicable(service.price_type) && (
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Price</p>
                    {service.price_type === 'free' ? (
                      <p className="text-2xl sm:text-3xl font-extrabold text-gray-900 mt-1">Free</p>
                    ) : isPricedAmount(unitPrice) ? (
                      <p className="text-2xl sm:text-3xl font-extrabold text-gray-900 mt-1">
                        {formatCurrency(unitPrice, currency)}
                        {isDisplayFieldEnabled(sf, 'uom') && (selectedPlan?.uom ?? service.uom) && (selectedPlan?.uom ?? service.uom) !== 'fixed' && (
                          <span className="text-base font-normal text-gray-500 ml-1">/{UOM_LABELS[selectedPlan?.uom ?? service.uom] || selectedPlan?.uom || service.uom}</span>
                        )}
                      </p>
                    ) : (
                      <p className="text-xl font-bold text-amber-600 mt-1">Get a Quote</p>
                    )}
                    {isDisplayFieldEnabled(sf, 'price_range') && service.price_min != null && service.price_max != null && service.price_min > 0 && (
                      <p className="text-xs text-gray-400 mt-1">
                        Range: {formatCurrency(service.price_min, currency)} – {formatCurrency(service.price_max, currency)}
                      </p>
                    )}
                  </div>
                )}

                {isDisplayFieldEnabled(sf, 'duration') && (selectedPlan?.duration_minutes ?? service.duration_minutes) ? (
                  <div className={`flex items-center gap-3 text-sm text-gray-600 rounded-xl p-3 border ${themeUi.bgBlueishPanel} ${themeUi.borderPrimarySoft}`}>
                    <Clock className={`w-5 h-5 ${themeUi.iconPrimary}`} />
                    <span>
                      Duration:{' '}
                      <strong>
                        {formatDurationLabel(
                          selectedPlan?.duration_minutes ?? service.duration_minutes!,
                          selectedPlan?.uom ?? service.uom,
                        )}
                      </strong>
                    </span>
                  </div>
                ) : null}

                <Button className={`w-full h-12 font-bold rounded-xl shadow-sm ${themeUi.btnSolid}`} size="lg"
                  onClick={() => setShowBooking(true)}>
                  <CalendarDays className="w-5 h-5 mr-2" /> {bookingCtaLabel}
                </Button>
                {canQuote && (
                  <Button variant="outline" className="w-full h-12 font-bold rounded-xl" size="lg"
                    onClick={() => { if (!isLoggedIn) { navigate(storePath('/login')); return }; setShowQuote(true) }}>
                    <MessageSquare className="w-5 h-5 mr-2" /> {quoteCtaLabel}
                  </Button>
                )}
              </>
            )}

            {/* Fallback — neither booking nor subscription enabled */}
            {!canBook && !isSubscription && (
              <>
                {!isPriceNotApplicable(service.price_type) && (
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Price</p>
                    {service.price_type === 'free' ? (
                      <p className="text-2xl sm:text-3xl font-extrabold text-gray-900 mt-1">Free</p>
                    ) : isPricedAmount(unitPrice) ? (
                      <p className="text-2xl sm:text-3xl font-extrabold text-gray-900 mt-1">
                        {formatCurrency(unitPrice, currency)}
                        {isDisplayFieldEnabled(sf, 'uom') && (selectedPlan?.uom ?? service.uom) && (selectedPlan?.uom ?? service.uom) !== 'fixed' && (
                          <span className="text-base font-normal text-gray-500 ml-1">/{UOM_LABELS[selectedPlan?.uom ?? service.uom] || selectedPlan?.uom || service.uom}</span>
                        )}
                      </p>
                    ) : (
                      <p className="text-xl font-bold text-amber-600 mt-1">Contact for Pricing</p>
                    )}
                  </div>
                )}
                {canQuote && (
                  <Button className={`w-full h-12 font-bold rounded-xl shadow-sm ${themeUi.btnSolid}`} size="lg"
                    onClick={() => { if (!isLoggedIn) { navigate(storePath('/login')); return }; setShowQuote(true) }}>
                    <MessageSquare className="w-5 h-5 mr-2" /> {quoteCtaLabel}
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

      {/* Details */}
      <div className="mt-6 space-y-6">
          {/* Plan Selector — above About */}
          {isDisplayFieldEnabled(sf, 'service_plans') && activePlans.length > 0 && (
            <PlanSelector
              plans={activePlans}
              currency={currency}
              selectedId={selectedPlanId ?? activePlans[0]?.id ?? null}
              onSelect={setSelectedPlanId}
              hidePrice={isSubscription && subscriptionPrice > 0 && !isPriceNotApplicable(service.price_type)}
              compact={isSubscription && subscriptionPrice > 0}
              priceType={service.price_type}
            />
          )}

          {/* Description */}
          {isDisplayFieldEnabled(sf, 'description') && service.description && (
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
              <div className="grid gap-2 sm:grid-cols-2">
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
              <div className="grid gap-2 sm:grid-cols-2">
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

          {isDisplayFieldEnabled(sf, 'features') && service.features && service.features.length > 0 && (
            <div className="pt-4 border-t border-gray-100">
              <h3 className="font-bold text-gray-900 mb-3 text-sm">Features</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {service.features.map((item) => (
                  <div key={item} className="flex items-center gap-2.5 text-sm text-gray-600">
                    <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" /> {item}
                  </div>
                ))}
              </div>
            </div>
          )}

          {((isDisplayFieldEnabled(sf, 'cancellation_policy') && service.cancellation_policy)
            || (isDisplayFieldEnabled(sf, 'rescheduling_policy') && service.rescheduling_policy)) && (
            <div className="pt-4 border-t border-gray-100">
              <h3 className="font-bold text-gray-900 mb-3 text-sm flex items-center gap-2">
                <Shield className="w-4 h-4 text-gray-400" /> Policies
              </h3>
              <div className="space-y-2 text-sm text-gray-600">
                {isDisplayFieldEnabled(sf, 'cancellation_policy') && service.cancellation_policy && (
                  <p><span className="font-semibold text-gray-700">Cancellation:</span> {service.cancellation_policy}
                    {service.cancellation_hours ? ` (${service.cancellation_hours}h notice)` : ''}</p>
                )}
                {isDisplayFieldEnabled(sf, 'rescheduling_policy') && service.rescheduling_policy && (
                  <p><span className="font-semibold text-gray-700">Rescheduling:</span> {service.rescheduling_policy}</p>
                )}
              </div>
            </div>
          )}
      </div>

      {(() => {
        const planAvail = selectedPlan?.availability && selectedPlan.availability.length > 0
          ? selectedPlan.availability
          : null
        const avail = planAvail ?? service.availability
        const showWeeklySlots = canBook && (!hasBothModes || sidebarMode === 'booking')
        return avail && avail.length > 0 && showWeeklySlots && isDisplayFieldEnabled(sf, 'availability') ? (
          <div className="mt-10">
            <BookingSlotsPanel availability={avail} />
          </div>
        ) : null
      })()}

      {/* Reviews */}
      {isDisplayFieldEnabled(sf, 'reviews') && (
      <div className={`mt-8 rounded-2xl border p-6 sm:p-8 ${themeUi.cardSurface} ${themeUi.cardBorder}`}>
        <ReviewSection reviewType="service" targetId={service.id} />
      </div>
      )}

      {showBooking && service && (
        <BookingModal
          serviceId={service.id}
          planId={selectedPlan?.id}
          serviceName={selectedPlan ? `${service.name} — ${selectedPlan.name}` : service.name}
          price={selectedPlan?.price ?? service.price ?? 0}
          priceType={service.price_type}
          duration={selectedPlan?.duration_minutes ?? service.duration_minutes}
          availability={
            selectedPlan?.availability && selectedPlan.availability.length > 0
              ? selectedPlan.availability
              : service.availability
          }
          imageUrl={resolveServiceThumbnailUrl({
            image_url: service.image_url,
            media: service.media,
            gallery: service.gallery,
          }) || undefined}
          onClose={() => setShowBooking(false)}
        />
      )}

      {showSubscription && service && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
          onClick={() => setShowSubscription(false)}
        >
          <div
            className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 fade-in-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b bg-white">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Subscription</p>
                <h2 className="text-sm sm:text-base font-bold text-gray-900 truncate leading-snug">{subscriptionCtaLabel}</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowSubscription(false)}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-3 sm:p-4">
              <SubscriptionConfigurator
                key={`${selectedPlanId || 'default'}-${subscriptionInterval}-modal`}
                layout="wide"
                embedded
                interval={subscriptionInterval}
                pricePerCycle={subscriptionPrice}
                currency={currency}
                priceType={subscriptionPriceType}
                uom={UOM_LABELS[subscriptionUom] || subscriptionUom}
                trialDays={subscriptionTrialDays}
                setupFee={subscriptionSetupFee}
                maxCycles={subscriptionBillingCycles}
                allowedModes={subscriptionScheduleModes}
                subscribeLabel={subscriptionCtaLabel}
                isTaxable={subscriptionIsTaxable}
                taxRate={subscriptionTaxRate}
                onSubscribe={handleSubscribe}
                subscribePending={subscribePending}
              />
            </div>
          </div>
        </div>
      )}

      {showQuote && service && (
        <QuoteRequestModal
          serviceId={service.id}
          serviceName={selectedPlan ? `${service.name} — ${selectedPlan.name}` : service.name}
          formConfig={service.quote_form_config}
          title={quoteCtaLabel}
          customerInfo={customer ? { name: customer.full_name, email: customer.email, phone: customer.phone } : undefined}
          onClose={() => setShowQuote(false)}
        />
      )}
    </div>
  )
}
