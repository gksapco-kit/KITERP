import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, Boxes, Calendar, CheckCircle2, CreditCard, Loader2, MapPin,
  Package, Scale, Shield, Truck, X,
} from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { storeApi } from '@/api/store'
import { useStorefrontRental, useRentalRegistrationForm } from '@/hooks/useStore'
import { useAuthStore } from '@/stores/authStore'
import { useVendor } from '@/contexts/VendorContext'
import { useTheme } from '@/contexts/ThemeContext'
import { formatCurrency, mediaUrl } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { useDocumentSeo, vendorPageTitle } from '@/lib/documentSeo'
import { breadcrumbJsonLd, compactJsonLd, rentalJsonLd } from '@/lib/catalogSeo'
import {
  durationRateForPlan,
  formatDurationLabel,
  formatDurationSuffix,
  parseDurationPlanMinutes,
  periodRateForPlan,
  storefrontRateOptions,
} from '@/lib/rentalDurationRates'
import {
  applyAdditionalCharges,
  chargeLineAmounts,
  chargesForEstimate,
  formatAdditionalChargeValue,
  normalizeAdditionalCharges,
  splitAdditionalCharges,
} from '@/lib/rentalAdditionalCharges'
import { missingRequiredAnswers, StorefrontRegistrationFields } from './StorefrontRegistrationFields'
import { RegistrationFormLetterhead } from './RegistrationFormLetterhead'

type RentalAsset = {
  id: string
  name: string
  slug?: string
  asset_code?: string
  category?: string
  asset_type?: string
  short_description?: string | null
  description?: string
  capacity_max?: number
  capacity_unit?: string
  available_capacity?: number
  current_occupancy?: number
  max_weight?: number | null
  weight_unit?: string
  daily_rate?: number
  weekly_rate?: number
  monthly_rate?: number
  yearly_rate?: number
  hourly_rate?: number
  per_minute_rate?: number
  duration_rates?: { minutes: number; rate: number }[]
  period_rates?: { days: number; rate: number }[]
  deposit_amount?: number
  additional_charges?: { id?: string; name: string; description?: string; charge_type: 'amount' | 'percent'; show_mode?: 'independent' | 'together'; value: number }[]
  location?: string
  status?: string
  image_url?: string | null
  media?: { id?: string; url?: string; is_primary?: boolean }[]
  display_start_date?: string | null
  display_end_date?: string | null
  delivery_info?: string | null
  delivery_enabled?: boolean
  unit_mode?: string
  child_count?: number
  available_child_count?: number
  unit_count?: number
}

function formatDisplayDate(value?: string | null) {
  if (!value) return null
  const d = new Date(`${String(value).slice(0, 10)}T00:00:00`)
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function availabilityLabel(asset: RentalAsset) {
  const start = formatDisplayDate(asset.display_start_date)
  const end = formatDisplayDate(asset.display_end_date)
  if (start && end) return `${start} – ${end}`
  if (start) return `From ${start}`
  if (end) return `Until ${end}`
  return null
}

/** Capacity chip numbers — prefer sub-asset counts when hierarchy is enabled. */
function capacityDisplay(asset: RentalAsset) {
  const unit = asset.capacity_unit || 'units'
  if (asset.unit_mode === 'hierarchy' && (asset.child_count ?? 0) > 0) {
    const max = Math.max(0, Math.floor(Number(asset.child_count ?? 0)))
    const avail = Math.max(
      0,
      Math.floor(Number(asset.available_child_count ?? asset.child_count ?? 0)),
    )
    return { avail: Math.min(avail, max), max, unit }
  }
  if (asset.unit_mode === 'serialized' && (asset.unit_count ?? 0) > 0) {
    const max = Math.max(0, Math.floor(Number(asset.unit_count ?? 0)))
    const avail = Math.max(0, Math.floor(Number(asset.available_capacity ?? 0)))
    return { avail: Math.min(avail, max || avail), max: max || avail, unit }
  }
  return {
    avail: Math.max(0, Number(asset.available_capacity ?? 0)),
    max: Math.max(0, Number(asset.capacity_max ?? 0)),
    unit,
  }
}

/** Capacity-based availability — if any unit is free, treat as available. */
function stockAvailabilityLabel(asset: RentalAsset) {
  const status = String(asset.status || '').toLowerCase()
  if (status === 'maintenance' || status === 'unavailable' || status === 'retired') {
    return status.replace(/_/g, ' ')
  }
  const { avail, max } = capacityDisplay(asset)
  if (max > 0) {
    if (avail <= 0) return 'Fully booked'
    if (avail >= max) return 'Available'
    return `${Math.floor(avail)} of ${Math.floor(max)} available`
  }
  return avail > 0 ? 'Available' : 'Fully booked'
}

function availabilityChipLabel(asset: RentalAsset) {
  return availabilityLabel(asset) || stockAvailabilityLabel(asset)
}

function statusTone(status?: string) {
  if (status === 'available') return 'bg-emerald-50 text-emerald-800 border-emerald-200/80'
  if (status === 'partially_occupied') return 'bg-amber-50 text-amber-800 border-amber-200/80'
  return 'bg-gray-50 text-gray-600 border-gray-200'
}

function statusDot(status?: string) {
  if (status === 'available') return 'bg-emerald-500'
  if (status === 'partially_occupied') return 'bg-amber-500'
  return 'bg-gray-400'
}

/** Local calendar YYYY-MM-DD (avoid UTC shift from toISOString). */
function localYmd(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseLocalYmd(value: string): Date | null {
  if (!value || value.length < 10) return null
  const d = new Date(`${value.slice(0, 10)}T00:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Default rental window for a pricing plan, starting from `fromYmd` (or today).
 * Inclusive date ranges match backend billing: daily = 1 day, weekly = 7 days, etc.
 */
function datesForPlan(
  plan: string,
  fromYmd?: string,
  window?: { min?: string | null; max?: string | null },
): { start: string; end: string } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let start = fromYmd ? parseLocalYmd(fromYmd) : new Date(today)
  if (!start || start < today) start = new Date(today)

  const minBound = window?.min ? parseLocalYmd(String(window.min).slice(0, 10)) : null
  const maxBound = window?.max ? parseLocalYmd(String(window.max).slice(0, 10)) : null
  if (minBound && start < minBound) start = new Date(minBound)

  const end = new Date(start)
  const p = (plan || 'daily').toLowerCase()
  if (p === 'weekly') {
    end.setDate(end.getDate() + 6)
  } else if (p === 'monthly') {
    end.setMonth(end.getMonth() + 1)
    end.setDate(end.getDate() - 1)
  } else if (p === 'yearly') {
    end.setFullYear(end.getFullYear() + 1)
    end.setDate(end.getDate() - 1)
  }
  // daily / hourly / per_minute → same calendar day

  if (maxBound && end > maxBound) end.setTime(maxBound.getTime())
  if (end < start) end.setTime(start.getTime())

  return { start: localYmd(start), end: localYmd(end) }
}

/** Default from/to times for a plan (24h HH:MM). End matches start (check-in / check-out clock). */
function timesForPlan(plan: string): { startTime: string; endTime: string } {
  const p = (plan || 'daily').toLowerCase()
  // Same clock time for start and end — period length comes from the dates (or user adjusts).
  if (p === 'hourly' || p === 'per_minute' || p.startsWith('dur_')) {
    return { startTime: '10:00', endTime: '10:00' }
  }
  return { startTime: '10:00', endTime: '10:00' }
}

function minutesBetween(
  startDate: string,
  endDate: string,
  startTime: string,
  endTime: string,
): number {
  const s = parseLocalYmd(startDate)
  const e = parseLocalYmd(endDate)
  if (!s || !e) return 0
  const [sh, sm] = (startTime || '00:00').split(':').map(Number)
  const [eh, em] = (endTime || '00:00').split(':').map(Number)
  s.setHours(sh || 0, sm || 0, 0, 0)
  e.setHours(eh || 0, em || 0, 0, 0)
  let ms = e.getTime() - s.getTime()
  if (ms <= 0) {
    // Same (or inverted) clock time — estimate at least 1 hour
    return 60
  }
  return Math.max(1, Math.round(ms / 60000))
}

function estimateTotal(
  asset: RentalAsset,
  start: string,
  end: string,
  plan: string,
  startTime = '10:00',
  endTime = '10:00',
  selectedIndependentIds: string[] = [],
) {
  if (!start || !end) {
    return {
      rental: 0,
      deposit: Number(asset.deposit_amount || 0),
      extras: normalizeAdditionalCharges(asset.additional_charges),
      total: Number(asset.deposit_amount || 0),
      days: 0,
      minutes: 0,
    }
  }
  const s = new Date(start)
  const e = new Date(end)
  const days = Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000) + 1)
  const minutes = minutesBetween(start, end, startTime, endTime)
  let rental = 0
  const periodSlot = periodRateForPlan(asset.period_rates, plan, {
    daily: Number(asset.daily_rate || 0),
    weekly: Number(asset.weekly_rate || 0),
    monthly: Number(asset.monthly_rate || 0),
    yearly: Number(asset.yearly_rate || 0),
  })
  if (periodSlot) {
    rental = periodSlot.rate * Math.max(1, Math.ceil(days / periodSlot.days))
  } else {
    const slot = durationRateForPlan(
      asset.duration_rates,
      plan,
      Number(asset.hourly_rate || 0),
      Number(asset.per_minute_rate || 0),
    )
    if (slot) {
      rental = slot.rate * Math.max(1, Math.ceil(minutes / slot.minutes))
    } else {
      rental = Number(asset.daily_rate || 0) * days
    }
  }
  const deposit = Number(asset.deposit_amount || 0)
  const extras = normalizeAdditionalCharges(asset.additional_charges)
  return {
    rental,
    deposit,
    extras,
    total: applyAdditionalCharges(rental, extras, selectedIndependentIds, deposit) + deposit,
    days,
    minutes,
  }
}

export default function RentalDetailPage() {
  const { slug = '' } = useParams<{ slug: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { storePath, vendor } = useVendor()
  const theme = useTheme()
  const { customer, isAuthenticated } = useAuthStore()
  const qc = useQueryClient()
  const { data, isLoading, isError, refetch } = useStorefrontRental(slug)
  const { data: registration } = useRentalRegistrationForm()
  const asset = data as RentalAsset | undefined
  const registrationForm = registration?.enabled ? registration.form : null

  const showBook = searchParams.get('book') === '1'
  const [bookStep, setBookStep] = useState<'register' | 'details'>('details')
  const [regModalOpen, setRegModalOpen] = useState(false)
  const [regAnswers, setRegAnswers] = useState<Record<string, string | boolean>>({})
  const [activeMedia, setActiveMedia] = useState(0)
  const [bookQty, setBookQty] = useState('1')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [startTime, setStartTime] = useState('10:00')
  const [endTime, setEndTime] = useState('10:00')
  const [pricingPlan, setPricingPlan] = useState('daily')
  const [notes, setNotes] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [needsDelivery, setNeedsDelivery] = useState(false)
  const [selectedExtras, setSelectedExtras] = useState<string[]>([])
  const [confirmedBooking, setConfirmedBooking] = useState<Record<string, unknown> | null>(null)
  const [payMethod, setPayMethod] = useState('upi')

  // Keep the selected plan in sync with rates configured on this asset
  useEffect(() => {
    if (!asset) return
    const options = storefrontRateOptions(asset)
    if (!options.length) return
    if (!options.some((o) => o.plan === pricingPlan)) {
      setPricingPlan(options[0].plan)
    }
  }, [asset, pricingPlan])

  const primaryColor = theme?.colors?.primary || '#64C3A0'
  const mediaItems = useMemo(() => {
    const raw = Array.isArray(asset?.media) ? asset!.media!.filter((m) => m?.url) : []
    const seen = new Set<string>()
    const unique: { id?: string; url: string; is_primary?: boolean }[] = []
    for (const m of raw) {
      const key = String(m.url)
      if (seen.has(key)) continue
      seen.add(key)
      unique.push({ id: m.id, url: key, is_primary: m.is_primary })
    }
    if (!unique.length && asset?.image_url) {
      unique.push({ url: asset.image_url, is_primary: true })
    }
    unique.sort((a, b) => Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary)))
    return unique
  }, [asset])

  const vendorName = vendor?.display_name || vendor?.business_name || 'Store'
  const rentalPath = storePath(`/rentals/${asset?.slug || slug}`)
  const rentalImage = mediaItems[0]?.url || asset?.image_url || vendor?.logo_url
  useDocumentSeo({
    title: asset ? `${asset.name} | ${vendorName}` : vendorPageTitle('Rental', vendorName),
    description: asset
      ? (asset.short_description || asset.description || `Rent ${asset.name} from ${vendorName}.`)
      : undefined,
    canonicalPath: rentalPath,
    ogImage: rentalImage || '/favicon-192.png',
    ogImageAlt: asset?.name || vendorName,
    ogSiteName: vendorName,
    jsonLd: asset
      ? compactJsonLd([
          rentalJsonLd({
            name: asset.name,
            description: asset.short_description || asset.description,
            image: rentalImage,
            url: rentalPath,
            dailyRate: asset.daily_rate,
          }),
          breadcrumbJsonLd([
            { name: vendorName, path: storePath('/') },
            { name: 'Rentals', path: storePath('/rentals') },
            { name: asset.name, path: rentalPath },
          ]),
        ])
      : null,
  })

  useEffect(() => {
    setActiveMedia(0)
  }, [asset?.id])

  // If the book form is open (e.g. deep link ?book=1) but dates are empty, fill from the selected plan
  useEffect(() => {
    if (!showBook || !asset) return
    if (startDate && endDate) return
    const range = datesForPlan(pricingPlan, startDate || undefined, {
      min: asset.display_start_date,
      max: asset.display_end_date,
    })
    if (!startDate) setStartDate(range.start)
    if (!endDate) setEndDate(range.end)
  }, [showBook, asset, pricingPlan, startDate, endDate])

  const { avail, max } = asset
    ? capacityDisplay(asset)
    : { avail: 0, max: 0, unit: 'units' }
  const price = asset ? estimateTotal(asset, startDate, endDate, pricingPlan, startTime, endTime, selectedExtras) : null
  const additionalCharges = useMemo(
    () => normalizeAdditionalCharges(asset?.additional_charges),
    [asset],
  )
  const { independent: independentExtras, together: togetherExtras } = useMemo(
    () => splitAdditionalCharges(additionalCharges),
    [additionalCharges],
  )
  const extraLines = useMemo(() => {
    const applied = chargesForEstimate(additionalCharges, selectedExtras)
    return chargeLineAmounts(price?.rental || 0, applied, price?.deposit || 0)
  }, [additionalCharges, selectedExtras, price?.rental, price?.deposit])
  const togetherExtraTotal = extraLines
    .filter((line) => line.charge.show_mode !== 'independent')
    .reduce((sum, line) => sum + line.amount, 0)
  const activeDuration = asset
    ? durationRateForPlan(asset.duration_rates, pricingPlan, Number(asset.hourly_rate || 0), Number(asset.per_minute_rate || 0))
    : null
  const headlineRate = pricingPlan === 'yearly'
    ? Number(asset?.yearly_rate || 0)
    : pricingPlan === 'monthly'
      ? Number(asset?.monthly_rate || 0)
      : pricingPlan === 'weekly'
        ? Number(asset?.weekly_rate || 0)
        : activeDuration
          ? activeDuration.rate
          : Number(asset?.daily_rate || 0)
  const headlineSuffix = pricingPlan === 'yearly'
    ? 'yr'
    : pricingPlan === 'monthly'
      ? 'mo'
      : pricingPlan === 'weekly'
        ? 'week'
        : activeDuration
          ? formatDurationSuffix(activeDuration.minutes)
          : 'day'
  const headlineLabel = activeDuration
    ? formatDurationLabel(activeDuration.minutes)
    : pricingPlan.charAt(0).toUpperCase() + pricingPlan.slice(1).replace('_', ' ')
  const isDurationPlan = Boolean(parseDurationPlanMinutes(pricingPlan))
  const activeUrl = mediaItems[Math.min(activeMedia, Math.max(0, mediaItems.length - 1))]?.url

  const seedRegAnswers = (current: Record<string, string | boolean> = {}) => {
    const next = { ...current }
    const fields = registrationForm?.fields || []
    const keys = new Set(fields.map((f) => f.key))
    if (keys.has('room_no') && !String(next.room_no ?? '').trim()) {
      next.room_no = String(asset?.asset_code || asset?.name || '').trim()
    }
    if (keys.has('check_in_date') && startDate) next.check_in_date = startDate
    if (keys.has('check_out_date') && endDate) next.check_out_date = endDate
    return next
  }

  const filledRegAnswers = seedRegAnswers(regAnswers)
  const missingRegFields = registrationForm
    ? missingRequiredAnswers(registrationForm.fields || [], filledRegAnswers)
    : []
  const registrationComplete = !registrationForm || missingRegFields.length === 0

  useEffect(() => {
    if (!registrationForm) return
    setRegAnswers((prev) => seedRegAnswers(prev))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registrationForm?.id, startDate, endDate, asset?.id])

  useEffect(() => {
    if (!showBook || !registrationForm || registrationComplete) return
    setRegModalOpen(true)
    setBookStep('register')
    setSearchParams({}, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showBook, registrationForm?.id])

  useEffect(() => {
    if (!regModalOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [regModalOpen])

  const openBookForm = () => {
    if (!asset) return
    setBookQty(String(Math.min(Number(asset.available_capacity || 1), Number(asset.capacity_max || 1)) || 1))
    const plan = pricingPlan
    const range = datesForPlan(plan, startDate || undefined, {
      min: asset.display_start_date,
      max: asset.display_end_date,
    })
    const times = timesForPlan(plan)
    setStartDate(range.start)
    setEndDate(range.end)
    setStartTime(times.startTime)
    setEndTime(times.endTime)
    setNotes('')
    setNeedsDelivery(false)
    setDeliveryAddress('')
    setSelectedExtras([])
    setConfirmedBooking(null)
    setRegAnswers(seedRegAnswers({}))
    if (registrationForm) {
      setBookStep('register')
      setRegModalOpen(true)
      return
    }
    setBookStep('details')
    setSearchParams({ book: '1' }, { replace: true })
  }

  const continueToBooking = () => {
    const answers = seedRegAnswers(regAnswers)
    setRegAnswers(answers)
    const missing = missingRequiredAnswers(registrationForm?.fields || [], answers)
    if (missing.length) {
      toast.error(`Please fill: ${missing.map((f) => f.label).join(', ')}`)
      return
    }
    setRegModalOpen(false)
    setBookStep('details')
    setSearchParams({ book: '1' }, { replace: true })
  }

  const selectPlan = (plan: string) => {
    setPricingPlan(plan)
    const range = datesForPlan(plan, startDate || undefined, {
      min: asset?.display_start_date,
      max: asset?.display_end_date,
    })
    const times = timesForPlan(plan)
    setStartDate(range.start)
    setEndDate(range.end)
    setStartTime(times.startTime)
    setEndTime(times.endTime)
  }

  const onStartDateChange = (value: string) => {
    setStartDate(value)
    const range = datesForPlan(pricingPlan, value || undefined, {
      min: asset?.display_start_date,
      max: asset?.display_end_date,
    })
    setEndDate(range.end)
  }

  const book = useMutation({
    mutationFn: (answers?: Record<string, string | boolean>) =>
      storeApi.createRentalBooking({
        asset_id: asset!.id,
        start_date: startDate,
        end_date: endDate,
        start_time: startTime || undefined,
        end_time: endTime || undefined,
        quantity: Number(bookQty) || 1,
        pricing_plan: pricingPlan,
        notes: notes.trim() || undefined,
        delivery_address: needsDelivery ? deliveryAddress : undefined,
        needs_delivery: needsDelivery,
        additional_charge_ids: selectedExtras,
        registration_form_id: registrationForm?.id,
        registration_answers: registrationForm ? (answers || regAnswers) : undefined,
      }),
    onSuccess: (res) => {
      toast.success('Rental request submitted')
      setConfirmedBooking(res)
      qc.invalidateQueries({ queryKey: ['store-rentals'] })
      qc.invalidateQueries({ queryKey: ['my-rentals'] })
      qc.invalidateQueries({ queryKey: ['catalog-rentals'] })
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(typeof msg === 'string' ? msg : 'Could not submit rental request')
    },
  })

  const pay = useMutation({
    mutationFn: (id: string) =>
      storeApi.payRentalBooking(id, {
        payment_method: payMethod,
        payment_reference: `SF-${Date.now()}`,
      }),
    onSuccess: (res) => {
      toast.success('Payment successful')
      setConfirmedBooking(res)
      qc.invalidateQueries({ queryKey: ['my-rentals'] })
    },
    onError: () => toast.error('Payment failed'),
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
      </div>
    )
  }

  if (isError || !asset) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <Package className="mx-auto mb-3 h-10 w-10 text-gray-300" />
        <h1 className="text-lg font-semibold text-gray-900">Rental not found</h1>
        <p className="mt-1 text-sm text-gray-500">This asset may be unavailable or no longer listed.</p>
        <div className="mt-4 flex justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void refetch()}>Retry</Button>
          <Button size="sm" onClick={() => navigate(storePath('/rentals'))}>Browse rentals</Button>
        </div>
      </div>
    )
  }

  const categoryLabel = (asset.category || '').replace(/_/g, ' ')
  const assetType = (asset.asset_type || '').replace(/_/g, ' ')
  const metaLine = [categoryLabel, assetType].filter(Boolean).join(' · ')
  const blurb = (asset.short_description || '').trim()
  const description = (asset.description || '').trim()
  const confirmedBookingId = confirmedBooking ? String(confirmedBooking.id ?? '') : ''

  return (
    <>
    <div className="relative min-h-[70vh] bg-gradient-to-b from-[#eef8f3] via-[#f5faf7] to-[#f8faf9]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/15 via-transparent to-transparent"
      />

      <div className="relative mx-auto max-w-6xl px-3 py-4 sm:px-6 sm:py-7">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <nav className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-gray-500 sm:text-sm">
            <Link to={storePath('/')} className="transition-colors hover:text-primary">Home</Link>
            <span className="opacity-30">/</span>
            <Link to={storePath('/rentals')} className="transition-colors hover:text-primary">Rentals</Link>
            <span className="opacity-30">/</span>
            <span className="truncate font-medium text-gray-800">{asset.name}</span>
          </nav>
          <button
            type="button"
            onClick={() => navigate(storePath('/rentals'))}
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-white/80 px-3 py-1.5 text-sm font-medium text-primary shadow-sm backdrop-blur transition hover:bg-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> All rentals
          </button>
        </div>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.85fr)] lg:gap-6">
          {/* Left: gallery + details */}
          <div className="space-y-4">
            <section className="overflow-hidden rounded-2xl border border-white/80 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.06)]">
              <div className="relative aspect-[16/10] bg-slate-100 sm:aspect-[16/9]">
                {activeUrl ? (
                  <img
                    src={mediaUrl(activeUrl)}
                    alt={asset.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-slate-300">
                    <Package className="h-16 w-16" />
                  </div>
                )}
                <div className="absolute left-3 top-3 flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full border bg-white/95 px-2.5 py-1 text-[11px] font-semibold capitalize shadow-sm backdrop-blur ${statusTone(asset.status)}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${statusDot(asset.status)}`} />
                    {(asset.status || 'available').replace(/_/g, ' ')}
                  </span>
                </div>
                {asset.asset_code ? (
                  <span className="absolute bottom-3 left-3 rounded-md bg-black/55 px-2 py-1 font-mono text-[11px] font-medium tracking-wide text-white backdrop-blur-sm">
                    {asset.asset_code}
                  </span>
                ) : null}
              </div>

              {mediaItems.length > 1 && (
                <div className="flex gap-2 overflow-x-auto border-t border-gray-100 bg-gray-50/60 p-2.5">
                  {mediaItems.map((m, i) => (
                    <button
                      key={m.id || m.url}
                      type="button"
                      onClick={() => setActiveMedia(i)}
                      className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition ${
                        i === activeMedia
                          ? 'border-primary shadow-sm'
                          : 'border-transparent opacity-80 hover:opacity-100'
                      }`}
                    >
                      <img src={mediaUrl(m.url)} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-white/80 bg-white p-4 shadow-[0_8px_30px_rgba(15,23,42,0.05)] sm:p-5">
              <div className="min-w-0">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[1.75rem]">
                  {asset.name}
                </h1>
                {metaLine ? (
                  <p className="mt-1 text-sm capitalize text-slate-500">{metaLine}</p>
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200/80">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  {availabilityChipLabel(asset)}
                </div>
                {asset.location ? (
                  <div className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200/80">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="truncate">{asset.location}</span>
                  </div>
                ) : null}
                {asset.max_weight != null ? (
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200/80">
                    <Scale className="h-3.5 w-3.5 text-slate-400" />
                    <span className="tabular-nums">{asset.max_weight} {asset.weight_unit || 'kg'}</span>
                  </div>
                ) : null}
              </div>

              {(blurb || description) && (
                <div className="mt-5 border-t border-slate-100 pt-4">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">About</h2>
                  {blurb ? (
                    <p className="mt-2 text-sm font-medium leading-relaxed text-slate-800">{blurb}</p>
                  ) : null}
                  {description && description !== blurb ? (
                    <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600">{description}</p>
                  ) : null}
                </div>
              )}
            </section>
          </div>

          {/* Right: sticky book panel */}
          <aside className="space-y-3 lg:sticky lg:top-4">
            <div className="overflow-hidden rounded-2xl border border-white/80 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.08)]">
              <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${primaryColor}, #34d399)` }} />
              <div className="p-4 sm:p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Pricing</p>

                <p className="mt-2 text-3xl font-bold tracking-tight tabular-nums text-slate-900">
                  {formatCurrency(headlineRate)}
                  <span className="ml-1 text-base font-medium text-slate-400">
                    /{headlineSuffix}
                  </span>
                </p>

                <div className="mt-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Pricing plan">
                  {storefrontRateOptions(asset).map(({ plan, rate, label, suffix }) => {
                      const active = pricingPlan === plan
                      return (
                        <button
                          key={plan}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => selectPlan(plan)}
                          className={`rounded-xl border px-3 py-2.5 text-left transition ${
                            active
                              ? 'border-primary bg-primary text-white shadow-sm'
                              : 'border-slate-200 bg-white text-slate-800 shadow-sm hover:border-primary/50 hover:bg-slate-50'
                          }`}
                        >
                          <span className={`block text-[10px] font-semibold uppercase tracking-wide ${active ? 'text-white/80' : 'text-slate-500'}`}>
                            {label}
                          </span>
                          <span className="mt-0.5 block text-sm font-semibold tabular-nums">
                            {formatCurrency(rate)}
                            <span className={`font-medium ${active ? 'text-white/75' : 'text-slate-400'}`}>/{suffix}</span>
                          </span>
                        </button>
                      )
                    })}
                </div>

                <div className="mt-3 flex items-center gap-1.5 text-sm text-slate-500">
                  <Shield className="h-3.5 w-3.5 text-slate-400" />
                  Refundable deposit {formatCurrency(Number(asset.deposit_amount || 0))}
                </div>
                {togetherExtras.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Included</p>
                    {togetherExtras.length === 1 ? (
                      <div className="flex items-start justify-between gap-3 text-sm text-slate-600">
                        <div className="min-w-0">
                          <p className="font-medium text-slate-800">{togetherExtras[0].name}</p>
                          {togetherExtras[0].description ? <p className="text-xs text-slate-500">{togetherExtras[0].description}</p> : null}
                        </div>
                        <span className="shrink-0 tabular-nums font-medium text-slate-800">
                          {formatAdditionalChargeValue(togetherExtras[0])}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3 text-sm text-slate-600">
                        <div className="min-w-0">
                          <p className="font-medium text-slate-800">Additional charges</p>
                          <p className="text-xs text-slate-500">{togetherExtras.map((c) => c.name).join(', ')}</p>
                        </div>
                        <span className="shrink-0 text-xs font-medium text-slate-500">Together</span>
                      </div>
                    )}
                  </div>
                )}
                {independentExtras.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Optional add-ons</p>
                    {independentExtras.map((c) => (
                      <div key={c.id || c.name} className="flex items-start justify-between gap-3 text-sm text-slate-600">
                        <div className="min-w-0">
                          <p className="font-medium text-slate-800">{c.name}</p>
                          {c.description ? <p className="text-xs text-slate-500">{c.description}</p> : null}
                        </div>
                        <span className="shrink-0 tabular-nums font-medium text-slate-800">
                          {formatAdditionalChargeValue(c)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4 space-y-2 rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-600 ring-1 ring-slate-100">
                  <p className="flex items-start gap-2">
                    <Boxes className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>
                      <span className="font-semibold tabular-nums text-slate-800">{avail}</span>
                      {' of '}
                      <span className="tabular-nums">{max}</span>
                      {' '}
                      {(asset.capacity_unit || 'units').toLowerCase()} available
                    </span>
                  </p>
                  {(asset.delivery_info || '').trim() ? (
                    <p className="flex items-start gap-2 text-xs text-slate-500">
                      <Truck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {(asset.delivery_info || '').trim()}
                    </p>
                  ) : null}
                </div>

                {!showBook && !confirmedBooking && (
                  <Button
                    className="mt-4 h-12 w-full rounded-xl text-[15px] font-semibold text-white shadow-sm transition hover:brightness-105"
                    style={{ backgroundColor: primaryColor }}
                    onClick={openBookForm}
                  >
                    {registrationForm ? 'Register and booking' : `Book this ${headlineLabel}`}
                  </Button>
                )}
              </div>
            </div>

            {confirmedBooking ? (
              <div className="space-y-3 rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
                  <div>
                    <h2 className="font-semibold text-gray-900">Booking submitted</h2>
                    <p className="text-sm text-gray-500">
                      {String(confirmedBooking.booking_number || '')} · awaiting vendor approval
                    </p>
                  </div>
                </div>
                {confirmedBooking.payment_status !== 'paid' ? (
                  <div className="space-y-2 border-t border-gray-100 pt-3">
                    <h3 className="flex items-center gap-2 text-sm font-semibold">
                      <CreditCard className="h-4 w-4 text-primary" /> Pay now
                    </h3>
                    <select
                      className="h-10 w-full rounded-lg border bg-white px-2.5 text-sm"
                      value={payMethod}
                      onChange={(e) => setPayMethod(e.target.value)}
                    >
                      <option value="upi">UPI</option>
                      <option value="card">Card</option>
                      <option value="netbanking">Net Banking</option>
                      <option value="cod">Pay on delivery</option>
                    </select>
                    <Button
                      className="h-10 w-full rounded-xl"
                      disabled={pay.isPending || !confirmedBookingId}
                      onClick={() => pay.mutate(confirmedBookingId)}
                    >
                      {pay.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : `Pay ${formatCurrency(Number(confirmedBooking.total_amount || 0))}`}
                    </Button>
                  </div>
                ) : (
                  <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                    Payment received.
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" className="rounded-xl" onClick={() => navigate(storePath('/rentals'))}>
                    Browse rentals
                  </Button>
                  <Link to={storePath('/account/rentals')}>
                    <Button variant="outline" className="rounded-xl">My Rentals</Button>
                  </Link>
                </div>
              </div>
            ) : showBook && bookStep === 'details' ? (
              <div className="space-y-3.5 rounded-2xl border border-white/80 bg-white p-4 shadow-[0_12px_40px_rgba(15,23,42,0.08)] sm:p-5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-base font-semibold text-slate-900">Request booking</h2>
                  <button
                    type="button"
                    className="text-xs font-medium text-slate-500 hover:text-slate-800"
                    onClick={() => setSearchParams({}, { replace: true })}
                  >
                    Cancel
                  </button>
                </div>

                {!isAuthenticated ? (
                  <p className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                    <Link to={storePath('/login')} className="font-semibold text-primary">Sign in</Link>
                    {' '}to request this rental.
                  </p>
                ) : (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                          Quantity ({asset.capacity_unit || 'units'})
                        </label>
                        <Input
                          type="number"
                          min={1}
                          max={asset.available_capacity}
                          value={bookQty}
                          onChange={(e) => setBookQty(e.target.value)}
                          className="h-10 rounded-lg"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Plan</label>
                        <select
                          className="h-10 w-full rounded-lg border bg-white px-2.5 text-sm"
                          value={pricingPlan}
                          onChange={(e) => selectPlan(e.target.value)}
                        >
                          {storefrontRateOptions(asset).map((opt) => (
                            <option key={opt.plan} value={opt.plan}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Rental period</p>
                      <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50/60">
                        <div className="grid grid-cols-[4.5rem_minmax(0,1.4fr)_minmax(5.5rem,0.9fr)] items-end gap-2 border-b border-slate-200/80 px-3 py-2.5">
                          <span className="pb-2 text-xs font-semibold text-slate-700">Start</span>
                          <div className="min-w-0 space-y-1">
                            <label className="block text-[10px] font-medium uppercase tracking-wide text-slate-400">Date</label>
                            <Input
                              type="date"
                              value={startDate}
                              min={asset.display_start_date?.slice(0, 10) || undefined}
                              max={asset.display_end_date?.slice(0, 10) || undefined}
                              onChange={(e) => onStartDateChange(e.target.value)}
                              className="h-10 w-full min-w-0 rounded-lg bg-white"
                            />
                          </div>
                          <div className="min-w-0 space-y-1">
                            <label className="block text-[10px] font-medium uppercase tracking-wide text-slate-400">Time</label>
                            <Input
                              type="time"
                              value={startTime}
                              onChange={(e) => {
                                const v = e.target.value
                                setStartTime(v)
                                setEndTime(v)
                              }}
                              className="h-10 w-full rounded-lg bg-white"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-[4.5rem_minmax(0,1.4fr)_minmax(5.5rem,0.9fr)] items-end gap-2 px-3 py-2.5">
                          <span className="pb-2 text-xs font-semibold text-slate-700">End</span>
                          <div className="min-w-0 space-y-1">
                            <label className="block text-[10px] font-medium uppercase tracking-wide text-slate-400">Date</label>
                            <Input
                              type="date"
                              value={endDate}
                              min={startDate || asset.display_start_date?.slice(0, 10) || undefined}
                              max={asset.display_end_date?.slice(0, 10) || undefined}
                              onChange={(e) => setEndDate(e.target.value)}
                              className="h-10 w-full min-w-0 rounded-lg bg-white"
                            />
                          </div>
                          <div className="min-w-0 space-y-1">
                            <label className="block text-[10px] font-medium uppercase tracking-wide text-slate-400">Time</label>
                            <Input
                              type="time"
                              value={endTime}
                              onChange={(e) => setEndTime(e.target.value)}
                              className="h-10 w-full rounded-lg bg-white"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <Input
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Notes (optional)"
                      className="h-10 rounded-lg"
                    />

                    {asset.delivery_enabled ? (
                      <>
                        <label className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={needsDelivery}
                            onChange={(e) => setNeedsDelivery(e.target.checked)}
                            className="rounded border-slate-300"
                          />
                          Need delivery
                        </label>
                        {needsDelivery && (
                          <Input
                            value={deliveryAddress}
                            onChange={(e) => setDeliveryAddress(e.target.value)}
                            placeholder="Delivery address"
                            className="h-10 rounded-lg"
                          />
                        )}
                      </>
                    ) : null}

                    {independentExtras.length > 0 ? (
                      <div className="space-y-1.5">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Add-ons</p>
                        {independentExtras.map((c) => {
                          const id = c.id || c.name
                          const checked = selectedExtras.includes(id)
                          return (
                            <label
                              key={id}
                              className="flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5 text-sm text-slate-700"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  setSelectedExtras((prev) =>
                                    e.target.checked ? [...prev, id] : prev.filter((x) => x !== id),
                                  )
                                }}
                                className="mt-0.5 rounded border-slate-300"
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block font-medium text-slate-800">{c.name}</span>
                                {c.description ? <span className="block text-xs text-slate-500">{c.description}</span> : null}
                              </span>
                              <span className="shrink-0 tabular-nums text-slate-700">
                                {formatAdditionalChargeValue(c)}
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    ) : null}

                    {price && startDate && endDate && (
                      <div className="space-y-1.5 rounded-xl border border-slate-100 bg-slate-50 p-3.5 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-500">
                            {isDurationPlan
                              ? `Rental (${price.minutes} min)`
                              : `Rental (${price.days} days)`}
                          </span>
                          <span className="tabular-nums">{formatCurrency(price.rental)}</span>
                        </div>
                        {togetherExtras.length === 1 ? (
                          <div className="flex justify-between gap-3" title={togetherExtras[0].description || undefined}>
                            <span className="text-slate-500">
                              {togetherExtras[0].name}
                              {togetherExtras[0].charge_type === 'percent' ? ` (${formatAdditionalChargeValue(togetherExtras[0])})` : ''}
                            </span>
                            <span className="tabular-nums">{formatCurrency(togetherExtraTotal)}</span>
                          </div>
                        ) : togetherExtras.length > 1 ? (
                          <div className="flex justify-between gap-3" title={togetherExtras.map((c) => c.name).join(', ')}>
                            <span className="text-slate-500">Additional charges</span>
                            <span className="tabular-nums">{formatCurrency(togetherExtraTotal)}</span>
                          </div>
                        ) : null}
                        {independentExtras.filter((c) => selectedExtras.includes(c.id) || selectedExtras.includes(c.name)).map((c) => {
                          const line = extraLines.find((l) => l.charge.id === c.id || l.charge.name === c.name)
                          return (
                          <div key={c.id || c.name} className="flex justify-between gap-3" title={c.description || undefined}>
                            <span className="text-slate-500">
                              {c.name}
                              {c.charge_type === 'percent' ? ` (${formatAdditionalChargeValue(c)})` : ''}
                            </span>
                            <span className="tabular-nums">{formatCurrency(line?.amount ?? 0)}</span>
                          </div>
                          )
                        })}
                        <div className="flex justify-between">
                          <span className="text-slate-500">Deposit</span>
                          <span className="tabular-nums">{formatCurrency(price.deposit)}</span>
                        </div>
                        <div className="flex justify-between border-t border-slate-200 pt-2 font-semibold">
                          <span>Total</span>
                          <span className="tabular-nums" style={{ color: primaryColor }}>{formatCurrency(price.total)}</span>
                        </div>
                      </div>
                    )}

                    <p className="text-xs text-slate-400">Booking as {customer?.full_name}</p>
                    {registrationForm && (
                      <button
                        type="button"
                        className="text-xs font-medium text-slate-500 hover:text-slate-800"
                        onClick={() => setRegModalOpen(true)}
                      >
                        ← Back to registration
                      </button>
                    )}
                    <Button
                      className="h-11 w-full rounded-xl font-semibold text-white"
                      style={{ backgroundColor: primaryColor }}
                      disabled={
                        !startDate
                        || !endDate
                        || !startTime
                        || !endTime
                        || book.isPending
                        || (startDate === endDate && endTime < startTime)
                      }
                      onClick={() => {
                        const answers = registrationForm ? seedRegAnswers(regAnswers) : undefined
                        if (registrationForm && answers) {
                          setRegAnswers(answers)
                          const missing = missingRequiredAnswers(registrationForm.fields || [], answers)
                          if (missing.length) {
                            toast.error(`Please fill: ${missing.map((f) => f.label).join(', ')}`)
                            setRegModalOpen(true)
                            return
                          }
                        }
                        book.mutate(answers)
                      }}
                    >
                      {book.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : (registrationForm ? 'Confirm registration & booking' : 'Confirm booking request')}
                    </Button>
                  </>
                )}
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    </div>
    {regModalOpen && registrationForm
      ? createPortal(
          <div
            className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rental-registration-title"
            onClick={() => setRegModalOpen(false)}
          >
            <div
              className="flex max-h-[100dvh] w-full max-w-2xl flex-col overflow-hidden bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <p id="rental-registration-title" className="text-base font-semibold text-slate-900">
                    Register and book
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Complete the registration form, then continue to booking.
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Close registration form"
                  onClick={() => setRegModalOpen(false)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
                <RegistrationFormLetterhead
                  theme={registrationForm.theme}
                  fallbackTitle={registrationForm.name}
                  fallbackSubtitle={registrationForm.description || 'Please complete all required details for check-in.'}
                />
                <div className="mt-4">
                  <StorefrontRegistrationFields
                    fields={registrationForm.fields || []}
                    values={regAnswers}
                    accent={registrationForm.theme?.accent}
                    onUploadImage={async (file) => {
                      const uploaded = await storeApi.uploadRentalRegistrationImage(file)
                      return uploaded.url
                    }}
                    onChange={(key, value) => setRegAnswers((prev) => ({ ...prev, [key]: value }))}
                  />
                </div>
              </div>
              <div className="border-t border-slate-100 bg-white px-4 py-3 sm:px-5">
                {registrationComplete ? (
                  <Button
                    className="h-11 w-full rounded-xl font-semibold text-white"
                    style={{ backgroundColor: primaryColor }}
                    onClick={continueToBooking}
                  >
                    Continue to booking
                  </Button>
                ) : (
                  <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-center text-xs text-slate-500">
                    Fill all required fields to continue to booking
                    {missingRegFields.length ? ` (${missingRegFields.length} remaining)` : ''}.
                  </p>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )
      : null}
    </>
  )
}
