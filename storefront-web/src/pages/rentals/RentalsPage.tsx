import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Calendar, Loader2, Package, MapPin, Search, Scale, Boxes, Shield,
  ChevronRight, Truck, CreditCard, CheckCircle2, ChevronLeft, X,
  Grid3X3, LayoutList,
} from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { storeApi } from '@/api/store'
import { useCatalogRentals } from '@/hooks/useStore'
import { useAuthStore } from '@/stores/authStore'
import { useVendor } from '@/contexts/VendorContext'
import { useTheme } from '@/contexts/ThemeContext'
import { formatCurrency, mediaUrl } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

const RENTAL_CATEGORIES = [
  { value: 'all', label: 'All categories' },
  { value: 'vehicles', label: 'Vehicles' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'storage', label: 'Storage' },
  { value: 'furniture', label: 'Furniture' },
  { value: 'milk_dairy', label: 'Milk & dairy' },
  { value: 'other', label: 'Other' },
] as const

type SortKey = 'name' | 'daily_rate' | 'status'
type SortDir = 'asc' | 'desc'
type ViewMode = 'grid' | 'list'

const selectTriggerCls =
  'h-7 w-full min-w-0 rounded-lg border-gray-200 bg-white px-2.5 text-sm text-gray-700 font-normal'

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
  const navigate = useNavigate()
  const theme = useTheme()
  const { customer, isAuthenticated } = useAuthStore()
  const qc = useQueryClient()

  const rentalDetailPath = (a: RentalAsset) => storePath(`/rentals/${a.slug || a.id}`)
  const openDetail = (a: RentalAsset) => navigate(rentalDetailPath(a))
  const openBookDetail = (a: RentalAsset) => navigate(`${rentalDetailPath(a)}?book=1`)

  const [step, setStep] = useState<Step>('browse')
  const [query, setQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [category, setCategory] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
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

  const confirmedBookingId = confirmedBooking ? String(confirmedBooking.id ?? '') : ''
  const confirmedTotalLabel = formatCurrency(Number(confirmedBooking?.total_amount ?? 0))
  const confirmedPayLabel = `Pay ${confirmedTotalLabel}`

  const rentalParams = useMemo(() => ({
    page,
    size: PAGE_SIZE,
    search: query || undefined,
    category: category || undefined,
  }), [page, query, category])

  const { data: rentalsData, isLoading, isError, refetch, isFetching } = useCatalogRentals(rentalParams)
  const filtered: RentalAsset[] = useMemo(() => {
    const raw = rentalsData?.items
    const list = Array.isArray(raw) ? (raw as RentalAsset[]) : []
    const items = list.filter((a) =>
      statusFilter === 'all' ? true : (a.status || 'available') === statusFilter
    )
    const dir = sortDir === 'asc' ? 1 : -1
    return [...items].sort((a, b) => {
      if (sortKey === 'daily_rate') {
        return (Number(a.daily_rate || 0) - Number(b.daily_rate || 0)) * dir
      }
      if (sortKey === 'status') {
        return String(a.status || '').localeCompare(String(b.status || '')) * dir
      }
      return String(a.name || '').localeCompare(String(b.name || '')) * dir
    })
  }, [rentalsData?.items, statusFilter, sortKey, sortDir])
  const totalCount: number = Number(rentalsData?.total ?? 0)
  const totalPages: number = Number(rentalsData?.pages ?? 0)
  const primaryColor = theme?.colors?.primary || '#64C3A0'
  const hasActiveFilters = Boolean(query.trim() || category || statusFilter !== 'all')

  const applySearch = () => {
    setQuery(searchInput.trim())
    setPage(1)
  }

  const clearSearch = () => {
    setSearchInput('')
    setQuery('')
    setPage(1)
  }

  const clearFilters = () => {
    clearSearch()
    setCategory('')
    setStatusFilter('all')
    setSortKey('name')
    setSortDir('asc')
  }

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

  const price = selected ? estimateTotal(selected, startDate, endDate, pricingPlan) : null

  return (
    <div className="relative min-h-[70vh]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/8 via-primary/[0.02] to-transparent"
      />
      <div className="relative max-w-6xl mx-auto px-3 sm:px-6 py-2 sm:py-3">
        <nav className="text-xs sm:text-sm text-gray-500 mb-1 flex flex-wrap items-center gap-1 leading-none">
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
            <header className="mb-2 flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-gray-900 leading-none">
                Rentals
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 leading-snug">
                Browse available rentals and book slots in a few taps.
              </p>
            </header>

            <div className="mb-3 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="flex flex-col gap-2 p-2.5 sm:p-3">
                <div className="flex flex-col lg:flex-row lg:items-center gap-2">
                  <form
                    className="flex flex-1 min-w-0 flex-col gap-2 sm:flex-row sm:items-center"
                    onSubmit={(e) => {
                      e.preventDefault()
                      applySearch()
                    }}
                  >
                    <div className="relative flex-1 min-w-0 max-w-2xl">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                      <Input
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder="Search by name, location, or type…"
                        className="h-8 pl-9 pr-9 text-sm border-gray-200 bg-gray-50/80 focus:bg-white"
                        aria-label="Search rentals"
                      />
                      {searchInput ? (
                        <button
                          type="button"
                          onClick={clearSearch}
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                          aria-label="Clear search"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </div>
                    <Button
                      type="submit"
                      size="sm"
                      className="shrink-0 h-8 w-full px-4 text-white hover:opacity-95 sm:w-auto"
                      style={{ backgroundColor: primaryColor }}
                    >
                      Search
                    </Button>
                  </form>

                  <div className="grid grid-cols-2 gap-1.5 w-full sm:flex sm:flex-wrap sm:items-center sm:gap-2 lg:justify-end lg:shrink-0 lg:w-auto">
                    <span className="col-span-2 hidden text-xs font-medium uppercase tracking-wide text-gray-400 sm:col-span-1 sm:inline">
                      Sort
                    </span>
                    <div className="min-w-0">
                      <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
                        <SelectTrigger className={selectTriggerCls} aria-label="Sort by">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="name">Name</SelectItem>
                          <SelectItem value="daily_rate">Daily rate</SelectItem>
                          <SelectItem value="status">Status</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="min-w-0">
                      <Select value={sortDir} onValueChange={(v) => setSortDir(v as SortDir)}>
                        <SelectTrigger className={selectTriggerCls} aria-label="Sort direction">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="asc">Ascending</SelectItem>
                          <SelectItem value="desc">Descending</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="col-span-2 flex items-center justify-between gap-2 sm:col-span-1 sm:contents">
                      <div className="mx-1 hidden h-6 w-px bg-gray-200 sm:block" aria-hidden />
                      <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-gray-50/80">
                        <button
                          type="button"
                          onClick={() => setViewMode('grid')}
                          className={`rounded-md p-1.5 transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-800'}`}
                          aria-pressed={viewMode === 'grid'}
                          aria-label="Grid view"
                        >
                          <Grid3X3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewMode('list')}
                          className={`rounded-md p-1.5 transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-800'}`}
                          aria-pressed={viewMode === 'list'}
                          aria-label="List view"
                        >
                          <LayoutList className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div
                        className="inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 shadow-sm"
                        style={{
                          borderColor: `${primaryColor}22`,
                          background: `linear-gradient(145deg, ${primaryColor}0c 0%, ${primaryColor}04 100%)`,
                        }}
                        aria-live="polite"
                        aria-label={`${totalCount} rentals`}
                      >
                        <div
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                          style={{ backgroundColor: `${primaryColor}18`, color: primaryColor }}
                        >
                          <Package className="h-3.5 w-3.5" aria-hidden />
                        </div>
                        <div className="min-w-[2.5rem] text-left">
                          <span className="block text-base font-bold leading-none tabular-nums tracking-tight text-gray-900">
                            {totalCount.toLocaleString()}
                          </span>
                          <span className="mt-0.5 block text-[10px] font-medium capitalize leading-none text-gray-500">
                            {totalCount === 1 ? 'rental' : 'rentals'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 border-t border-gray-100 pt-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Refine</span>
                    <div className="min-w-0 w-full sm:w-[11rem]">
                      <Select
                        value={category || 'all'}
                        onValueChange={(v) => {
                          setCategory(v === 'all' ? '' : v)
                          setPage(1)
                        }}
                      >
                        <SelectTrigger className={selectTriggerCls} aria-label="Filter by category">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {RENTAL_CATEGORIES.map((c) => (
                            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="min-w-0 w-full sm:w-[10rem]">
                      <Select
                        value={statusFilter}
                        onValueChange={(v) => {
                          setStatusFilter(v)
                          setPage(1)
                        }}
                      >
                        <SelectTrigger className={selectTriggerCls} aria-label="Filter by status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All statuses</SelectItem>
                          <SelectItem value="available">Available</SelectItem>
                          <SelectItem value="partially_occupied">Partially occupied</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {hasActiveFilters && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-gray-500"
                        onClick={clearFilters}
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">
                    Refine by category or status to find the right rental faster.
                  </p>
                </div>
              </div>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary/40" />
              </div>
            ) : isError ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-white/60 px-6 py-10 text-center">
                <Package className="w-9 h-9 mx-auto text-gray-300 mb-2" />
                <p className="text-sm font-medium text-gray-700">Could not load rentals.</p>
                <p className="text-xs text-gray-400 mt-1 mb-3">Please try again in a moment.</p>
                <Button size="sm" variant="outline" disabled={isFetching} onClick={() => void refetch()}>
                  {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Retry'}
                </Button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-white/60 px-6 py-10 text-center">
                <Package className="w-9 h-9 mx-auto text-gray-300 mb-2" />
                <p className="text-sm font-medium text-gray-700">
                  {query.trim() || hasActiveFilters ? 'No rentals match your search.' : 'No rental items available right now.'}
                </p>
                <p className="text-xs text-gray-400 mt-1">Try another keyword or check back soon.</p>
              </div>
            ) : viewMode === 'list' ? (
              <div className="space-y-2">
                {filtered.map((a) => {
                  const categoryLabel = (a.category || '').replace(/_/g, ' ')
                  const assetType = (a.asset_type || '').replace(/_/g, ' ')
                  return (
                    <article
                      key={a.id}
                      role="link"
                      tabIndex={0}
                      onClick={() => openDetail(a)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          openDetail(a)
                        }
                      }}
                      className="flex cursor-pointer flex-col gap-3 rounded-xl border border-gray-200/80 bg-white px-3.5 py-3 shadow-sm transition-colors hover:border-primary/30 hover:bg-primary/[0.02] sm:flex-row sm:items-center"
                    >
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
                        {a.image_url ? (
                          <img src={mediaUrl(a.image_url)} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-gray-300">
                            <Package className="h-5 w-5" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-sm font-semibold text-gray-900">{a.name}</h3>
                          {a.asset_code ? (
                            <span className="rounded bg-gray-100 px-1.5 py-px font-mono text-[10px] font-medium tracking-wide text-gray-500">
                              {a.asset_code}
                            </span>
                          ) : null}
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${statusTone(a.status)}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${statusDot(a.status)}`} />
                            {(a.status || 'available').replace(/_/g, ' ')}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-[11px] capitalize text-gray-400">
                          {[categoryLabel, assetType, a.location].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                        {Number(a.daily_rate) > 0 && (
                          <p className="text-sm font-bold tabular-nums text-gray-900">
                            {formatCurrency(Number(a.daily_rate))}
                            <span className="text-[11px] font-medium text-gray-400">/day</span>
                          </p>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 rounded-lg px-2.5 text-xs"
                          onClick={(e) => { e.stopPropagation(); openDetail(a) }}
                        >
                          Details
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 rounded-lg px-3 text-xs"
                          onClick={(e) => { e.stopPropagation(); openBookDetail(a) }}
                        >
                          Book
                        </Button>
                      </div>
                    </article>
                  )
                })}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((a) => {
                  const avail = Number(a.available_capacity ?? 0)
                  const max = Number(a.capacity_max ?? 0)
                  const pct = max > 0 ? Math.min(100, Math.round(((max - avail) / max) * 100)) : 0
                  const hasDateWindow = Boolean(a.display_start_date || a.display_end_date)
                  const categoryLabel = (a.category || '').replace(/_/g, ' ')
                  const assetType = (a.asset_type || '').replace(/_/g, ' ')
                  const blurb = (a.short_description || a.description || '').trim()
                  return (
                    <article
                      key={a.id}
                      role="link"
                      tabIndex={0}
                      onClick={() => openDetail(a)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          openDetail(a)
                        }
                      }}
                      className="group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      <div className="h-0.5 w-full bg-gradient-to-r from-primary to-emerald-400" />
                      <div className="relative aspect-[16/10] bg-gray-50">
                        {a.image_url ? (
                          <img
                            src={mediaUrl(a.image_url)}
                            alt=""
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-gray-300">
                            <Package className="h-10 w-10" />
                          </div>
                        )}
                        <span className={`absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full border bg-white/95 px-2 py-0.5 text-[10px] font-semibold capitalize shadow-sm backdrop-blur ${statusTone(a.status)}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${statusDot(a.status)}`} />
                          {(a.status || 'available').replace(/_/g, ' ')}
                        </span>
                      </div>

                      <div className="flex flex-1 flex-col space-y-2.5 p-3.5">
                        <div className="min-w-0">
                          <h3 className="truncate text-[15px] font-semibold tracking-tight text-gray-900 transition-colors group-hover:text-primary">
                            {a.name}
                          </h3>
                          <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
                            {a.asset_code ? (
                              <span className="rounded bg-gray-100 px-1.5 py-px font-mono text-[10px] font-medium tracking-wide text-gray-500">
                                {a.asset_code}
                              </span>
                            ) : null}
                            <span className="truncate text-[11px] capitalize text-gray-400">
                              {[categoryLabel, assetType].filter(Boolean).join(' · ')}
                            </span>
                          </div>
                        </div>

                        <div
                          className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs ${
                            hasDateWindow ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-50 text-slate-600'
                          }`}
                        >
                          <Calendar className={`h-3.5 w-3.5 shrink-0 ${hasDateWindow ? 'text-emerald-600' : 'text-slate-400'}`} />
                          <span className="truncate font-medium">
                            {hasDateWindow ? availabilityLabel(a) : 'Always available'}
                          </span>
                        </div>

                        {blurb ? (
                          <p className="line-clamp-2 text-xs leading-relaxed text-gray-500">{blurb}</p>
                        ) : null}

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500">
                          <span className="inline-flex items-center gap-1">
                            <Boxes className="h-3 w-3 text-primary/70" />
                            <span className="tabular-nums text-gray-700">{avail}/{max}</span>
                            <span className="lowercase">{a.capacity_unit}</span>
                          </span>
                          {a.location && (
                            <span className="inline-flex min-w-0 items-center gap-1">
                              <MapPin className="h-3 w-3 shrink-0 text-primary/70" />
                              <span className="truncate text-gray-700">{a.location}</span>
                            </span>
                          )}
                          {a.max_weight != null && (
                            <span className="inline-flex items-center gap-1">
                              <Scale className="h-3 w-3 text-primary/70" />
                              <span className="tabular-nums text-gray-700">{a.max_weight}{a.weight_unit}</span>
                            </span>
                          )}
                          <span className="ml-auto inline-flex items-center gap-1.5 tabular-nums">
                            <span className="h-1 w-10 overflow-hidden rounded-full bg-gray-100">
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

                      <div className="mt-auto flex items-center justify-between gap-2 border-t border-gray-100 px-3.5 py-2.5">
                        <div className="min-w-0 leading-tight">
                          {Number(a.daily_rate) > 0 && (
                            <p className="text-sm font-bold tabular-nums text-gray-900">
                              {formatCurrency(Number(a.daily_rate))}
                              <span className="text-[11px] font-medium text-gray-400">/day</span>
                            </p>
                          )}
                          <p className="truncate text-[10px] text-gray-400">
                            {Number(a.monthly_rate) > 0 && (
                              <span className="tabular-nums">{formatCurrency(Number(a.monthly_rate))}/mo · </span>
                            )}
                            <span className="inline-flex items-center gap-0.5">
                              <Shield className="h-2.5 w-2.5" />
                              {formatCurrency(Number(a.deposit_amount || 0))}
                            </span>
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 gap-0.5 rounded-lg px-2 text-xs text-gray-600"
                            onClick={() => openDetail(a)}
                          >
                            Details
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            className="h-8 rounded-lg px-3 text-xs"
                            onClick={() => openBookDetail(a)}
                          >
                            Book
                          </Button>
                        </div>
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

            {confirmedBooking.payment_status !== 'paid' ? (
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
                  disabled={pay.isPending || !confirmedBookingId}
                  onClick={() => pay.mutate(confirmedBookingId)}
                >
                  {pay.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : confirmedPayLabel}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-2xl px-3.5 py-2.5">
                Payment received. Your booking will be confirmed after vendor approval if still pending.
              </p>
            )}

            {(confirmedBooking.delivery_status === 'pending' || Boolean(confirmedBooking.van_number)) ? (
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
                    {Boolean(confirmedBooking.van_driver_name) && <p>Driver: {String(confirmedBooking.van_driver_name)}</p>}
                    {Boolean(confirmedBooking.van_driver_phone) && <p>Phone: {String(confirmedBooking.van_driver_phone)}</p>}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">Van details will appear once the vendor assigns a delivery vehicle.</p>
                )}
              </div>
            ) : null}

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
