import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Calendar, Loader2, Package, MapPin, Search, Scale, Boxes, Shield,
  ChevronRight, Truck, CreditCard, CheckCircle2, ChevronLeft,
} from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { storeApi } from '@/api/store'
import { useCatalogRentals } from '@/hooks/useStore'
import { useAuthStore } from '@/stores/authStore'
import { useVendor } from '@/contexts/VendorContext'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

type RentalAsset = {
  id: string
  name: string
  asset_code?: string
  category?: string
  asset_type?: string
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
  display_start_date?: string | null
  display_end_date?: string | null
}

type Step = 'browse' | 'book' | 'confirm'

function statusDot(status?: string) {
  if (status === 'available') return 'bg-emerald-500'
  if (status === 'partially_occupied') return 'bg-amber-500'
  return 'bg-gray-400'
}

function statusTone(status?: string) {
  if (status === 'available') return 'bg-emerald-50 text-emerald-800 border-emerald-100'
  if (status === 'partially_occupied') return 'bg-amber-50 text-amber-800 border-amber-100'
  return 'bg-gray-50 text-gray-600 border-gray-200'
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

export default function RentalsPage() {
  const { storePath } = useVendor()
  const { customer, isAuthenticated } = useAuthStore()
  const qc = useQueryClient()

  const [step, setStep] = useState<Step>('browse')
  const [query, setQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [category, setCategory] = useState('')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 12

  const [selected, setSelected] = useState<RentalAsset | null>(null)
  const [bookQty, setBookQty] = useState('1')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [pricingPlan, setPricingPlan] = useState('daily')
  const [notes, setNotes] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [needsDelivery, setNeedsDelivery] = useState(false)
  const [confirmedBooking, setConfirmedBooking] = useState<Record<string, unknown> | null>(null)
  const [payMethod, setPayMethod] = useState('upi')

  const rentalParams = useMemo(() => ({
    page,
    size: PAGE_SIZE,
    search: query || undefined,
    category: category || undefined,
  }), [page, query, category])

  const { data: rentalsData, isLoading } = useCatalogRentals(rentalParams)
  const filtered: RentalAsset[] = (rentalsData?.items ?? []) as RentalAsset[]
  const totalCount: number = rentalsData?.total ?? 0
  const totalPages: number = rentalsData?.pages ?? 0

  const book = useMutation({
    mutationFn: () =>
      storeApi.createRentalBooking({
        asset_id: selected!.id,
        start_date: startDate,
        end_date: endDate,
        quantity: Number(bookQty) || 1,
        pricing_plan: pricingPlan,
        notes: notes.trim() || undefined,
        delivery_address: needsDelivery ? deliveryAddress : undefined,
        needs_delivery: needsDelivery,
      }),
    onSuccess: (data) => {
      toast.success('Rental request submitted')
      setConfirmedBooking(data)
      setStep('confirm')
      qc.invalidateQueries({ queryKey: ['store-rentals'] })
      qc.invalidateQueries({ queryKey: ['my-rentals'] })
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
    onSuccess: (data) => {
      toast.success('Payment successful')
      setConfirmedBooking(data)
      qc.invalidateQueries({ queryKey: ['my-rentals'] })
    },
    onError: () => toast.error('Payment failed'),
  })

  const openBook = (asset: RentalAsset) => {
    setSelected(asset)
    setBookQty(String(Math.min(Number(asset.available_capacity || 1), Number(asset.capacity_max || 1)) || 1))
    setStartDate('')
    setEndDate('')
    setPricingPlan(Number(asset.monthly_rate) > 0 ? 'monthly' : 'daily')
    setNotes('')
    setNeedsDelivery(false)
    setDeliveryAddress('')
    setStep('book')
  }

  const price = selected ? estimateTotal(selected, startDate, endDate, pricingPlan) : null

  return (
    <div className="relative min-h-[70vh]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/12 via-primary/[0.04] to-transparent"
      />
      <div className="relative max-w-5xl mx-auto px-3 sm:px-6 py-6 sm:py-10">
        <nav className="text-sm text-gray-500 mb-5 flex flex-wrap items-center gap-1">
          <Link to={storePath('/')} className="hover:text-primary transition-colors">Home</Link>
          <ChevronRight className="w-3 h-3 opacity-50" />
          <span className="text-gray-900 font-medium">Rentals</span>
          {isAuthenticated && (
            <>
              <span className="mx-2 text-gray-300">|</span>
              <Link to={storePath('/account/rentals')} className="text-primary hover:underline">My Rentals</Link>
            </>
          )}
        </nav>

        {step === 'browse' && (
          <>
            <header className="mb-7 sm:mb-8">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary/80 mb-1.5">
                    Marketplace
                  </p>
                  <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">
                    Rentals
                  </h1>
                  <p className="text-sm sm:text-base text-gray-500 mt-2 max-w-xl leading-relaxed">
                    Find vehicles, equipment, and storage — book available slots in a few taps.
                  </p>
                </div>
                {!isLoading && (
                  <div className="rounded-2xl border border-white/70 bg-white/70 backdrop-blur px-4 py-2.5 shadow-sm">
                    <p className="text-[11px] uppercase tracking-wide text-gray-400">Listed now</p>
                    <p className="text-xl font-semibold text-gray-900 tabular-nums">{totalCount}</p>
                  </div>
                )}
              </div>

              <div className="relative mt-6 group">
                <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors" />
                <Input
                  className="pl-11 h-12 rounded-2xl border-gray-200/80 bg-white/90 shadow-sm focus-visible:ring-primary/30"
                  value={searchInput}
                  onChange={(e) => {
                    setSearchInput(e.target.value)
                    setQuery(e.target.value)
                    setPage(1)
                  }}
                  placeholder="Search by name, location, or type…"
                />
              </div>
            </header>

            {isLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary/40" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-gray-200 bg-white/60 px-6 py-16 text-center">
                <Package className="w-10 h-10 mx-auto text-gray-300 mb-3" />
                <p className="text-sm font-medium text-gray-700">
                  {query.trim() ? 'No rentals match your search.' : 'No rental items available right now.'}
                </p>
                <p className="text-xs text-gray-400 mt-1">Try another keyword or check back soon.</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filtered.map((a) => {
                  const avail = Number(a.available_capacity ?? 0)
                  const max = Number(a.capacity_max ?? 0)
                  const pct = max > 0 ? Math.min(100, Math.round(((max - avail) / max) * 100)) : 0
                  const hasDateWindow = Boolean(a.display_start_date || a.display_end_date)
                  const category = (a.category || '').replace(/_/g, ' ')
                  const assetType = (a.asset_type || '').replace(/_/g, ' ')
                  return (
                    <article
                      key={a.id}
                      className="group relative flex flex-col rounded-2xl border border-gray-200/80 bg-white shadow-sm hover:shadow-md hover:border-primary/25 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
                    >
                      <div className="h-0.5 w-full bg-gradient-to-r from-primary to-emerald-400" />
                      <div className="p-3.5 space-y-2.5 flex-1">
                        <div className="flex justify-between gap-2 items-start">
                          <div className="min-w-0">
                            <h3 className="font-semibold text-[15px] text-gray-900 tracking-tight truncate group-hover:text-primary transition-colors">
                              {a.name}
                            </h3>
                            <p className="text-[11px] text-gray-400 mt-0.5 capitalize truncate">
                              {[category, assetType].filter(Boolean).join(' · ')}
                            </p>
                          </div>
                          <span className={`shrink-0 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${statusTone(a.status)}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusDot(a.status)}`} />
                            {(a.status || 'available').replace(/_/g, ' ')}
                          </span>
                        </div>

                        <div
                          className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs ${
                            hasDateWindow
                              ? 'bg-emerald-50 text-emerald-800'
                              : 'bg-slate-50 text-slate-600'
                          }`}
                        >
                          <Calendar className={`w-3.5 h-3.5 shrink-0 ${hasDateWindow ? 'text-emerald-600' : 'text-slate-400'}`} />
                          <span className="font-medium truncate">
                            {hasDateWindow ? availabilityLabel(a) : 'Always available'}
                          </span>
                        </div>

                        {a.description?.trim() && (
                          <p className="text-xs text-gray-500 line-clamp-1">{a.description.trim()}</p>
                        )}

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500">
                          <span className="inline-flex items-center gap-1">
                            <Boxes className="w-3 h-3 text-primary/70" />
                            <span className="tabular-nums text-gray-700">{avail}/{max}</span>
                            <span>{a.capacity_unit}</span>
                          </span>
                          {a.location && (
                            <span className="inline-flex items-center gap-1 min-w-0">
                              <MapPin className="w-3 h-3 text-primary/70 shrink-0" />
                              <span className="truncate text-gray-700">{a.location}</span>
                            </span>
                          )}
                          {a.max_weight != null && (
                            <span className="inline-flex items-center gap-1">
                              <Scale className="w-3 h-3 text-primary/70" />
                              <span className="tabular-nums text-gray-700">{a.max_weight}{a.weight_unit}</span>
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1.5 ml-auto tabular-nums">
                            <span className="w-10 h-1 rounded-full bg-gray-100 overflow-hidden">
                              <span
                                className={`block h-full rounded-full ${
                                  pct >= 100 ? 'bg-rose-500' : pct > 60 ? 'bg-amber-400' : 'bg-primary'
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </span>
                            {pct}%
                          </span>
                        </div>
                      </div>

                      <div className="mt-auto border-t border-gray-100 px-3.5 py-2.5 flex items-center justify-between gap-2">
                        <div className="min-w-0 leading-tight">
                          {Number(a.daily_rate) > 0 && (
                            <p className="text-sm font-bold text-gray-900 tabular-nums">
                              {formatCurrency(Number(a.daily_rate))}
                              <span className="text-[11px] font-medium text-gray-400">/day</span>
                            </p>
                          )}
                          <p className="text-[10px] text-gray-400 truncate">
                            {Number(a.monthly_rate) > 0 && (
                              <span className="tabular-nums">{formatCurrency(Number(a.monthly_rate))}/mo · </span>
                            )}
                            <span className="inline-flex items-center gap-0.5">
                              <Shield className="w-2.5 h-2.5" />
                              {formatCurrency(Number(a.deposit_amount || 0))}
                            </span>
                          </p>
                        </div>
                        <Button
                          size="sm"
                          className="shrink-0 h-8 rounded-lg px-3 text-xs"
                          onClick={() => openBook(a)}
                        >
                          Book
                        </Button>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 rounded-lg"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                  Prev
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                  .reduce<(number | '…')[]>((acc, p, idx, arr) => {
                    if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('…')
                    acc.push(p)
                    return acc
                  }, [])
                  .map((p, i) =>
                    p === '…' ? (
                      <span key={`ellipsis-${i}`} className="px-1 text-gray-400 text-sm">…</span>
                    ) : (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPage(p as number)}
                        className={`h-8 min-w-[2rem] rounded-lg border px-2.5 text-sm font-medium transition-colors ${
                          p === page
                            ? 'bg-primary text-white border-primary'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-primary/40'
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 rounded-lg"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                  <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            )}
          </>
        )}

        {step === 'book' && selected && (
          <section className="rounded-3xl border border-gray-200/80 bg-white/95 shadow-[0_12px_40px_-20px_rgba(15,23,42,0.2)] p-5 sm:p-7 space-y-5 max-w-xl backdrop-blur">
            <button
              type="button"
              className="text-sm text-primary font-medium hover:underline"
              onClick={() => setStep('browse')}
            >
              ← Back to rentals
            </button>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/80">New booking</p>
              <h2 className="font-semibold text-xl sm:text-2xl tracking-tight text-gray-900 mt-1">
                {selected.name}
              </h2>
            </div>
            <div className="rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50/70 border border-emerald-100 px-3.5 py-3 text-sm text-emerald-950 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/80 flex items-center justify-center text-emerald-600 shrink-0">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700/70">Available dates</p>
                <p className="font-semibold">{availabilityLabel(selected)}</p>
              </div>
            </div>

            {!isAuthenticated ? (
              <p className="text-sm text-gray-600 rounded-2xl bg-gray-50 border px-4 py-3">
                <Link to={storePath('/login')} className="text-primary font-medium">Sign in</Link> to request this rental.
              </p>
            ) : (
              <>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500">Quantity ({selected.capacity_unit})</label>
                    <Input type="number" min={1} max={selected.available_capacity} value={bookQty} onChange={(e) => setBookQty(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Pricing plan</label>
                    <select
                      className="w-full h-10 rounded-md border px-2 text-sm bg-white"
                      value={pricingPlan}
                      onChange={(e) => setPricingPlan(e.target.value)}
                    >
                      <option value="daily">Daily</option>
                      {Number(selected.weekly_rate) > 0 && <option value="weekly">Weekly</option>}
                      {Number(selected.monthly_rate) > 0 && <option value="monthly">Monthly</option>}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Start date</label>
                    <Input
                      type="date"
                      value={startDate}
                      min={selected.display_start_date?.slice(0, 10) || undefined}
                      max={selected.display_end_date?.slice(0, 10) || undefined}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">End date</label>
                    <Input
                      type="date"
                      value={endDate}
                      min={startDate || selected.display_start_date?.slice(0, 10) || undefined}
                      max={selected.display_end_date?.slice(0, 10) || undefined}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>

                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" />

                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={needsDelivery} onChange={(e) => setNeedsDelivery(e.target.checked)} />
                  Need delivery van
                </label>
                {needsDelivery && (
                  <Input
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="Delivery address"
                  />
                )}

                {price && startDate && endDate && (
                  <div className="rounded-2xl bg-gray-50 border border-gray-100 p-4 text-sm space-y-1.5">
                    <div className="flex justify-between"><span className="text-gray-500">Rental ({price.days} days)</span><span className="tabular-nums">{formatCurrency(price.rental)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Security deposit</span><span className="tabular-nums">{formatCurrency(price.deposit)}</span></div>
                    <div className="flex justify-between font-semibold text-base pt-2 border-t border-gray-200/80">
                      <span>Total</span>
                      <span className="tabular-nums text-primary">{formatCurrency(price.total)}</span>
                    </div>
                  </div>
                )}

                <p className="text-xs text-gray-500">Booking as {customer?.full_name}</p>
                <Button
                  className="w-full h-11 rounded-xl"
                  disabled={!startDate || !endDate || book.isPending}
                  onClick={() => book.mutate()}
                >
                  {book.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Booking Request'}
                </Button>
              </>
            )}
          </section>
        )}

        {step === 'confirm' && confirmedBooking && (
          <section className="rounded-3xl border border-gray-200/80 bg-white/95 shadow-[0_12px_40px_-20px_rgba(15,23,42,0.2)] p-5 sm:p-7 space-y-5 max-w-xl backdrop-blur">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 flex items-center justify-center ring-4 ring-emerald-50/50">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h2 className="font-semibold text-xl tracking-tight">Booking submitted</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {String(confirmedBooking.booking_number || '')} · awaiting vendor approval
                </p>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-gray-50 px-3 py-2.5"><dt className="text-[11px] text-gray-400">Asset</dt><dd className="font-medium mt-0.5">{String(confirmedBooking.asset_name || selected?.name || '—')}</dd></div>
              <div className="rounded-xl bg-gray-50 px-3 py-2.5"><dt className="text-[11px] text-gray-400">Quantity</dt><dd className="font-medium mt-0.5">{String(confirmedBooking.quantity)} {String(confirmedBooking.capacity_unit || '')}</dd></div>
              <div className="rounded-xl bg-gray-50 px-3 py-2.5"><dt className="text-[11px] text-gray-400">Period</dt><dd className="font-medium mt-0.5">{String(confirmedBooking.start_date)} → {String(confirmedBooking.end_date)}</dd></div>
              <div className="rounded-xl bg-gray-50 px-3 py-2.5"><dt className="text-[11px] text-gray-400">Total</dt><dd className="font-semibold mt-0.5 text-primary tabular-nums">{formatCurrency(Number(confirmedBooking.total_amount || 0))}</dd></div>
              <div className="rounded-xl bg-gray-50 px-3 py-2.5"><dt className="text-[11px] text-gray-400">Payment</dt><dd className="font-medium mt-0.5 capitalize">{String(confirmedBooking.payment_status)}</dd></div>
              <div className="rounded-xl bg-gray-50 px-3 py-2.5"><dt className="text-[11px] text-gray-400">Delivery</dt><dd className="font-medium mt-0.5 capitalize">{String(confirmedBooking.delivery_status || '').replace(/_/g, ' ')}</dd></div>
            </dl>

            {confirmedBooking.payment_status !== 'paid' && (
              <div className="border-t border-gray-100 pt-4 space-y-3">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-primary" /> Pay now
                </h3>
                <select
                  className="w-full h-10 rounded-md border px-2 text-sm bg-white"
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                >
                  <option value="upi">UPI</option>
                  <option value="card">Card</option>
                  <option value="netbanking">Net Banking</option>
                  <option value="cod">Pay on delivery</option>
                </select>
                <Button
                  className="w-full h-11 rounded-xl"
                  disabled={pay.isPending}
                  onClick={() => pay.mutate(String(confirmedBooking.id))}
                >
                  {pay.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : `Pay ${formatCurrency(Number(confirmedBooking.total_amount || 0))}`}
                </Button>
              </div>
            )}

            {confirmedBooking.payment_status === 'paid' && (
              <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-2xl px-3.5 py-2.5">
                Payment received. Your booking will be confirmed after vendor approval if still pending.
              </p>
            )}

            {(confirmedBooking.delivery_status === 'pending' || confirmedBooking.van_number) && (
              <div className="border-t border-gray-100 pt-4 space-y-2">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Truck className="w-4 h-4 text-primary" /> Delivery van
                </h3>
                <p className="text-sm text-gray-600 capitalize">
                  Status: {String(confirmedBooking.delivery_status || '').replace(/_/g, ' ')}
                </p>
                {confirmedBooking.van_number ? (
                  <div className="text-sm text-gray-600 space-y-1 rounded-2xl bg-gray-50 border border-gray-100 p-3.5">
                    <p>Van: {String(confirmedBooking.van_number)}</p>
                    {!!confirmedBooking.van_driver_name && <p>Driver: {String(confirmedBooking.van_driver_name)}</p>}
                    {!!confirmedBooking.van_driver_phone && <p>Phone: {String(confirmedBooking.van_driver_phone)}</p>}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">Van details will appear once the vendor assigns a delivery vehicle.</p>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              <Button variant="outline" className="rounded-xl" onClick={() => { setStep('browse'); setConfirmedBooking(null); setSelected(null) }}>
                Browse rentals
              </Button>
              <Link to={storePath('/account/rentals')}>
                <Button variant="outline" className="rounded-xl">View My Rentals</Button>
              </Link>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
