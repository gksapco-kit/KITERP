import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, Boxes, Calendar, CheckCircle2, CreditCard, Loader2, MapPin,
  Package, Scale, Shield, Truck,
} from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { storeApi } from '@/api/store'
import { useStorefrontRental } from '@/hooks/useStore'
import { useAuthStore } from '@/stores/authStore'
import { useVendor } from '@/contexts/VendorContext'
import { useTheme } from '@/contexts/ThemeContext'
import { formatCurrency, mediaUrl } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { useDocumentSeo, vendorPageTitle } from '@/lib/documentSeo'
import { breadcrumbJsonLd, compactJsonLd, rentalJsonLd } from '@/lib/catalogSeo'

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
  deposit_amount?: number
  location?: string
  status?: string
  image_url?: string | null
  media?: { id?: string; url?: string; is_primary?: boolean }[]
  display_start_date?: string | null
  display_end_date?: string | null
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
  return 'Always available'
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

function estimateTotal(asset: RentalAsset, start: string, end: string, plan: string) {
  if (!start || !end) return { rental: 0, deposit: Number(asset.deposit_amount || 0), total: Number(asset.deposit_amount || 0), days: 0 }
  const s = new Date(start)
  const e = new Date(end)
  const days = Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000) + 1)
  let rental = 0
  if (plan === 'monthly' && Number(asset.monthly_rate) > 0) {
    rental = Number(asset.monthly_rate) * Math.max(1, Math.ceil(days / 30))
  } else if (plan === 'weekly' && Number(asset.weekly_rate) > 0) {
    rental = Number(asset.weekly_rate) * Math.max(1, Math.ceil(days / 7))
  } else {
    rental = Number(asset.daily_rate || 0) * days
  }
  const deposit = Number(asset.deposit_amount || 0)
  return { rental, deposit, total: rental + deposit, days }
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
  const asset = data as RentalAsset | undefined

  const showBook = searchParams.get('book') === '1'
  const [activeMedia, setActiveMedia] = useState(0)
  const [bookQty, setBookQty] = useState('1')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [pricingPlan, setPricingPlan] = useState('daily')
  const [notes, setNotes] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [needsDelivery, setNeedsDelivery] = useState(false)
  const [confirmedBooking, setConfirmedBooking] = useState<Record<string, unknown> | null>(null)
  const [payMethod, setPayMethod] = useState('upi')

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

  const avail = Number(asset?.available_capacity ?? 0)
  const max = Number(asset?.capacity_max ?? 0)
  const pct = max > 0 ? Math.min(100, Math.round(((max - avail) / max) * 100)) : 0
  const price = asset ? estimateTotal(asset, startDate, endDate, pricingPlan) : null
  const activeUrl = mediaItems[Math.min(activeMedia, Math.max(0, mediaItems.length - 1))]?.url

  const openBookForm = () => {
    if (!asset) return
    setBookQty(String(Math.min(Number(asset.available_capacity || 1), Number(asset.capacity_max || 1)) || 1))
    setPricingPlan(Number(asset.monthly_rate) > 0 ? 'monthly' : 'daily')
    setStartDate('')
    setEndDate('')
    setNotes('')
    setNeedsDelivery(false)
    setDeliveryAddress('')
    setConfirmedBooking(null)
    setSearchParams({ book: '1' }, { replace: true })
  }

  const book = useMutation({
    mutationFn: () =>
      storeApi.createRentalBooking({
        asset_id: asset!.id,
        start_date: startDate,
        end_date: endDate,
        quantity: Number(bookQty) || 1,
        pricing_plan: pricingPlan,
        notes: notes.trim() || undefined,
        delivery_address: needsDelivery ? deliveryAddress : undefined,
        needs_delivery: needsDelivery,
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
  const hasWeekly = Number(asset.weekly_rate) > 0
  const hasMonthly = Number(asset.monthly_rate) > 0
  const hasDaily = Number(asset.daily_rate) > 0

  return (
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
                  {availabilityLabel(asset)}
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200/80">
                  <Boxes className="h-3.5 w-3.5 text-slate-400" />
                  <span className="tabular-nums">{avail}/{max}</span>
                  <span className="lowercase text-slate-500">{asset.capacity_unit || 'units'}</span>
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

              {max > 0 && (
                <div className="mt-4">
                  <div className="mb-1.5 flex items-center justify-between text-[11px] text-slate-500">
                    <span>Occupancy</span>
                    <span className="tabular-nums font-medium text-slate-700">{pct}% used</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full transition-all ${
                        pct >= 100 ? 'bg-rose-500' : pct > 60 ? 'bg-amber-400' : 'bg-primary'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )}

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

                {hasDaily && (
                  <p className="mt-2 text-3xl font-bold tracking-tight tabular-nums text-slate-900">
                    {formatCurrency(Number(asset.daily_rate))}
                    <span className="ml-1 text-base font-medium text-slate-400">/day</span>
                  </p>
                )}

                {(hasWeekly || hasMonthly) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {hasWeekly && (
                      <span className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs font-medium tabular-nums text-slate-700 ring-1 ring-slate-200/70">
                        {formatCurrency(Number(asset.weekly_rate))}
                        <span className="text-slate-400">/week</span>
                      </span>
                    )}
                    {hasMonthly && (
                      <span className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs font-medium tabular-nums text-slate-700 ring-1 ring-slate-200/70">
                        {formatCurrency(Number(asset.monthly_rate))}
                        <span className="text-slate-400">/mo</span>
                      </span>
                    )}
                  </div>
                )}

                <div className="mt-3 flex items-center gap-1.5 text-sm text-slate-500">
                  <Shield className="h-3.5 w-3.5 text-slate-400" />
                  Refundable deposit {formatCurrency(Number(asset.deposit_amount || 0))}
                </div>

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
                  <p className="flex items-start gap-2 text-xs text-slate-500">
                    <Truck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Delivery can be requested when you book
                  </p>
                </div>

                {!showBook && !confirmedBooking && (
                  <Button
                    className="mt-4 h-12 w-full rounded-xl text-[15px] font-semibold text-white shadow-sm transition hover:brightness-105"
                    style={{ backgroundColor: primaryColor }}
                    onClick={openBookForm}
                  >
                    Book this rental
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
            ) : showBook ? (
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
                          onChange={(e) => setPricingPlan(e.target.value)}
                        >
                          <option value="daily">Daily</option>
                          {hasWeekly && <option value="weekly">Weekly</option>}
                          {hasMonthly && <option value="monthly">Monthly</option>}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Start</label>
                        <Input
                          type="date"
                          value={startDate}
                          min={asset.display_start_date?.slice(0, 10) || undefined}
                          max={asset.display_end_date?.slice(0, 10) || undefined}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="h-10 rounded-lg"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium uppercase tracking-wide text-slate-400">End</label>
                        <Input
                          type="date"
                          value={endDate}
                          min={startDate || asset.display_start_date?.slice(0, 10) || undefined}
                          max={asset.display_end_date?.slice(0, 10) || undefined}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="h-10 rounded-lg"
                        />
                      </div>
                    </div>

                    <Input
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Notes (optional)"
                      className="h-10 rounded-lg"
                    />

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

                    {price && startDate && endDate && (
                      <div className="space-y-1.5 rounded-xl border border-slate-100 bg-slate-50 p-3.5 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Rental ({price.days} days)</span>
                          <span className="tabular-nums">{formatCurrency(price.rental)}</span>
                        </div>
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
                    <Button
                      className="h-11 w-full rounded-xl font-semibold text-white"
                      style={{ backgroundColor: primaryColor }}
                      disabled={!startDate || !endDate || book.isPending}
                      onClick={() => book.mutate()}
                    >
                      {book.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm booking request'}
                    </Button>
                  </>
                )}
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  )
}
