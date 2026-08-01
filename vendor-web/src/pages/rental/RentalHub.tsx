import { useEffect, useMemo, useState } from 'react'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Calendar, CheckCircle2, IndianRupee, Loader2, Package, Pencil, Plus, Search,
  Settings2, Truck, Wrench, X, Boxes, Clock, MapPin,
} from 'lucide-react'
import apiClient from '@/api/client'
import { crmApi } from '@/api/crm'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { toast } from 'sonner'
import { extractApiError } from '@/lib/errorMessages'
import { useCustomers, useSalesAreas } from '@/hooks/useVendor'
import {
  ASSET_STATUSES, AVAILABILITY_OPTIONS, BOOKING_STATUSES, DELIVERY_STATUSES,
  RENTAL_CATEGORIES, emptyAssetForm, getCategoryConfig, statusBadgeClass,
  type RentalAsset, type RentalBooking,
} from './rentalConstants'

type AssetFormState = ReturnType<typeof emptyAssetForm>

/** Normalize API/date values for `<input type="date" />` (yyyy-mm-dd). */
function toDateInputValue(value?: string | null | Date): string {
  if (value == null || value === '') return ''
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const yyyy = value.getFullYear()
    const mm = String(value.getMonth() + 1).padStart(2, '0')
    const dd = String(value.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }
  const raw = String(value).trim()
  // Accept already-normalized or ISO datetime values.
  const iso = raw.match(/^(\d{4}-\d{2}-\d{2})/)
  if (iso) return iso[1]
  // dd-mm-yyyy / dd/mm/yyyy (browser locale display leftovers)
  const dmy = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
  if (dmy) {
    const dd = dmy[1].padStart(2, '0')
    const mm = dmy[2].padStart(2, '0')
    return `${dmy[3]}-${mm}-${dd}`
  }
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return ''
  // Use UTC date parts for ISO-like strings to avoid timezone day-shift.
  if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) {
    return raw.slice(0, 10)
  }
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/** Read display window from API/list payloads (snake or camel). */
function pickDisplayDates(a: Partial<RentalAsset> & Record<string, unknown>) {
  const start = toDateInputValue(
    (a.display_start_date as string | null | undefined)
      ?? (a.displayStartDate as string | null | undefined)
      ?? (a.start_date as string | null | undefined)
      ?? null,
  )
  const end = toDateInputValue(
    (a.display_end_date as string | null | undefined)
      ?? (a.displayEndDate as string | null | undefined)
      ?? (a.end_date as string | null | undefined)
      ?? null,
  )
  return { start, end }
}

/** Local-safe date label for cards (avoids UTC day-shift on yyyy-mm-dd). */
function formatCardDate(value?: string | null) {
  const iso = toDateInputValue(value)
  if (!iso) return null
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function assetCardAvailability(
  asset: RentalAsset,
  bookings: RentalBooking[],
): { kind: 'range' | 'always'; label: string; detail?: string } {
  const { start, end } = pickDisplayDates(asset as RentalAsset & Record<string, unknown>)
  const startLabel = formatCardDate(start)
  const endLabel = formatCardDate(end)
  if (startLabel || endLabel) {
    return {
      kind: 'range',
      label: 'Date range',
      detail: `${startLabel || '…'} → ${endLabel || '…'}`,
    }
  }
  // Fall back to approved booking windows so the card still shows dates.
  const locked = new Set(['approved', 'confirmed', 'active'])
  const related = bookings.filter((b) => b.asset_id === asset.id && locked.has(b.status))
  if (related.length > 0) {
    const starts = related.map((b) => toDateInputValue(b.start_date)).filter(Boolean).sort()
    const ends = related.map((b) => toDateInputValue(b.end_date)).filter(Boolean).sort()
    const from = formatCardDate(starts[0])
    const to = formatCardDate(ends[ends.length - 1])
    return {
      kind: 'range',
      label: 'Booked period',
      detail: `${from || '…'} → ${to || '…'}`,
    }
  }
  return { kind: 'always', label: 'Always available' }
}

function assetToForm(a: Partial<RentalAsset> & Record<string, unknown>): AssetFormState {
  const { start, end } = pickDisplayDates(a)
  const hasRange = Boolean(start || end)
  return {
    name: String(a.name || ''),
    category: String(a.category || 'milk_dairy'),
    asset_type: String(a.asset_type || 'storage_rack'),
    description: String(a.description || ''),
    capacity_max: String(a.capacity_max ?? 1),
    capacity_unit: String(a.capacity_unit || 'units'),
    max_weight: a.max_weight != null ? String(a.max_weight) : '',
    weight_unit: String(a.weight_unit || 'kg'),
    daily_rate: String(a.daily_rate ?? 0),
    weekly_rate: String(a.weekly_rate ?? 0),
    monthly_rate: String(a.monthly_rate ?? 0),
    deposit_amount: String(a.deposit_amount ?? 0),
    extra_qty_charge: String(a.extra_qty_charge ?? 0),
    extra_weight_charge: String(a.extra_weight_charge ?? 0),
    sales_area_id: String(a.sales_area_id || ''),
    location: String(a.location || ''),
    section: String(a.section || ''),
    row_label: String(a.row_label || ''),
    rack_number: String(a.rack_number || ''),
    status: String(a.status || 'available'),
    availability_mode: hasRange ? 'date_range' : 'always',
    display_start_date: start,
    display_end_date: end,
    notes: String(a.notes || ''),
  }
}

const rentalApi = {
  dashboard: () => apiClient.get('/vendors/me/rentals/dashboard').then((r) => r.data),
  listAssets: (status?: string) =>
    apiClient.get('/vendors/me/rentals/assets', { params: status ? { status } : {} }).then((r) => r.data),
  getAsset: (id: string) =>
    apiClient.get(`/vendors/me/rentals/assets/${id}`).then((r) => r.data as RentalAsset),
  createAsset: (body: Record<string, unknown>) =>
    apiClient.post('/vendors/me/rentals/assets', body).then((r) => r.data),
  updateAsset: (id: string, body: Record<string, unknown>) =>
    apiClient.patch(`/vendors/me/rentals/assets/${id}`, body).then((r) => r.data),
  listBookings: (status?: string) =>
    apiClient.get('/vendors/me/rentals/bookings', { params: status ? { status } : {} }).then((r) => r.data),
  createBooking: (body: Record<string, unknown>) =>
    apiClient.post('/vendors/me/rentals/bookings', body).then((r) => r.data as RentalBooking),
  updateBooking: (id: string, body: Record<string, unknown>) =>
    apiClient.patch(`/vendors/me/rentals/bookings/${id}`, body).then((r) => r.data),
  recordPayment: (id: string, body: Record<string, unknown>) =>
    apiClient.post(`/vendors/me/rentals/bookings/${id}/payment`, body).then((r) => r.data),
  updateDelivery: (id: string, body: Record<string, unknown>) =>
    apiClient.patch(`/vendors/me/rentals/bookings/${id}/delivery`, body).then((r) => r.data),
  calendar: (assetId: string, from: string, to: string) =>
    apiClient.get(`/vendors/me/rentals/assets/${assetId}/calendar`, { params: { from, to } }).then((r) => r.data),
}

type Tab = 'dashboard' | 'assets' | 'bookings' | 'calendar'

function emptyBookingForm() {
  const today = new Date()
  const start = today.toISOString().slice(0, 10)
  const endDate = new Date(today)
  endDate.setDate(endDate.getDate() + 7)
  return {
    asset_id: '',
    customer_id: '',
    sales_area_id: '',
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    quantity: '1',
    start_date: start,
    end_date: endDate.toISOString().slice(0, 10),
    pricing_plan: 'daily',
    notes: '',
    needs_delivery: false,
    delivery_address: '',
    auto_approve: true,
  }
}

type BookingFormState = ReturnType<typeof emptyBookingForm>

function Badge({ status }: { status?: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border capitalize ${statusBadgeClass(status)}`}>
      {(status || '—').replace(/_/g, ' ')}
    </span>
  )
}

function CapacityBar({ used, max, unit }: { used: number; max: number; unit?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0
  const avail = Math.max(0, max - used)
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-500">
        <span>{avail} / {max} {unit || ''} available</span>
        <span>{pct}% used</span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-rose-500' : pct > 60 ? 'bg-amber-500' : 'bg-emerald-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export default function RentalHubPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('dashboard')
  const [showForm, setShowForm] = useState(false)
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null)
  const [form, setForm] = useState<AssetFormState>(emptyAssetForm())
  /** Bumps when edit/create loads so date inputs remount with fresh default/value. */
  const [dateFieldsEpoch, setDateFieldsEpoch] = useState(0)
  const [loadingAssetEdit, setLoadingAssetEdit] = useState(false)
  const [assetFilter, setAssetFilter] = useState('')
  const [assetStatus, setAssetStatus] = useState('')
  const [assetCategory, setAssetCategory] = useState('')
  const [bookingStatus, setBookingStatus] = useState('')
  const [selectedBooking, setSelectedBooking] = useState<RentalBooking | null>(null)
  const [showBookingForm, setShowBookingForm] = useState(false)
  const [bookingForm, setBookingForm] = useState<BookingFormState>(emptyBookingForm())
  const [calendarAssetId, setCalendarAssetId] = useState('')
  const [deliveryForm, setDeliveryForm] = useState({
    delivery_status: 'assigned',
    van_number: '',
    van_driver_name: '',
    van_driver_phone: '',
    van_vehicle_type: 'Delivery Van',
    delivery_notes: '',
  })

  const { data: dash, isLoading: ld } = useQuery({ queryKey: ['rental-dashboard'], queryFn: rentalApi.dashboard })
  const { data: assets = [], isLoading: la } = useQuery({
    queryKey: ['rental-assets'],
    queryFn: () => rentalApi.listAssets(),
    staleTime: 0,
    refetchOnMount: 'always',
  })
  const { data: bookings = [], isLoading: lb } = useQuery({
    queryKey: ['rental-bookings', bookingStatus],
    queryFn: () => rentalApi.listBookings(bookingStatus || undefined),
  })
  // Unfiltered list so asset date locks still work when Bookings tab has a status filter.
  const { data: allBookings = [] } = useQuery({
    queryKey: ['rental-bookings', '__all_for_locks__'],
    queryFn: () => rentalApi.listBookings(),
    staleTime: 15_000,
  })
  const { data: salesAreaData } = useSalesAreas({ is_active: true })
  const { data: customerData } = useCustomers({ limit: 200 })
  const salesAreaOptions = useMemo(
    () => (salesAreaData?.sales_areas ?? []).map((a) => {
      const name = String(a.name || '').trim()
      const code = String(a.code || '').trim()
      const safeName = name && name.toLowerCase() !== 'null' ? name : ''
      let label = safeName || code || 'Sales area'
      if (safeName && code) label = `${safeName} (${code})`
      return { value: a.id, label }
    }),
    [salesAreaData?.sales_areas],
  )
  const salesAreaLabelById = useMemo(() => {
    const m = new Map<string, string>()
    for (const o of salesAreaOptions) m.set(o.value, o.label)
    return m
  }, [salesAreaOptions])
  const customers = customerData?.items ?? []
  const [creditHint, setCreditHint] = useState<{ allowed: boolean; text: string } | null>(null)

  const today = new Date()
  const fromStr = today.toISOString().slice(0, 10)
  const toDate = new Date(today)
  toDate.setDate(toDate.getDate() + 30)
  const toStr = toDate.toISOString().slice(0, 10)

  const { data: calendarDays = [], isLoading: lc } = useQuery({
    queryKey: ['rental-calendar', calendarAssetId, fromStr, toStr],
    queryFn: () => rentalApi.calendar(calendarAssetId, fromStr, toStr),
    enabled: !!calendarAssetId && tab === 'calendar',
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['rental-dashboard'] })
    qc.invalidateQueries({ queryKey: ['rental-assets'] })
    qc.invalidateQueries({ queryKey: ['rental-bookings'] })
    qc.invalidateQueries({ queryKey: ['rental-bookings', '__all_for_locks__'] })
  }

  const categoryConfig = getCategoryConfig(form.category)

  const assetPayload = () => {
    const cfg = getCategoryConfig(form.category)
    const useRange = form.availability_mode === 'date_range'
    const start = useRange ? toDateInputValue(form.display_start_date) : ''
    const end = useRange ? toDateInputValue(form.display_end_date) : ''
    return {
      name: form.name,
      category: form.category,
      asset_type: form.asset_type,
      description: form.description || undefined,
      capacity_max: Number(form.capacity_max) || 1,
      capacity_unit: form.capacity_unit,
      max_weight: cfg.showWeight && form.max_weight ? Number(form.max_weight) : null,
      weight_unit: form.weight_unit,
      daily_rate: Number(form.daily_rate) || 0,
      weekly_rate: Number(form.weekly_rate) || 0,
      monthly_rate: Number(form.monthly_rate) || 0,
      deposit_amount: Number(form.deposit_amount) || 0,
      extra_qty_charge: Number(form.extra_qty_charge) || 0,
      extra_weight_charge: Number(form.extra_weight_charge) || 0,
      sales_area_id: form.sales_area_id || null,
      location: form.location || undefined,
      section: form.section || undefined,
      row_label: form.row_label || undefined,
      rack_number: form.rack_number || undefined,
      status: form.status,
      display_start_date: useRange ? (start || null) : null,
      display_end_date: useRange ? (end || null) : null,
      notes: form.notes || undefined,
    }
  }

  const applyAssetForm = (next: AssetFormState) => {
    setForm(next)
    setDateFieldsEpoch((n) => n + 1)
  }

  const resetAssetForm = () => {
    setShowForm(false)
    setEditingAssetId(null)
    setLoadingAssetEdit(false)
    setForm(emptyAssetForm())
    setDateFieldsEpoch((n) => n + 1)
  }

  const openCreateAsset = () => {
    setEditingAssetId(null)
    setLoadingAssetEdit(false)
    applyAssetForm(emptyAssetForm())
    setShowForm(true)
    setShowBookingForm(false)
    setTab('assets')
  }

  const openCreateBooking = () => {
    const list = assets as RentalAsset[]
    const first = list.find((a) => !['maintenance', 'unavailable', 'retired'].includes(a.status || ''))
    setBookingForm({
      ...emptyBookingForm(),
      asset_id: first?.id || '',
      quantity: '1',
      pricing_plan: Number(first?.monthly_rate) > 0 ? 'monthly' : 'daily',
    })
    setShowBookingForm(true)
    setShowForm(false)
    setSelectedBooking(null)
    setTab('bookings')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const resetBookingForm = () => {
    setShowBookingForm(false)
    setBookingForm(emptyBookingForm())
  }

  const openEditAsset = async (a: RentalAsset) => {
    setEditingAssetId(a.id)
    setShowForm(true)
    setTab('assets')
    setLoadingAssetEdit(true)
    // Optimistic fill from list card (may be stale / missing dates).
    applyAssetForm(assetToForm(a as RentalAsset & Record<string, unknown>))
    window.scrollTo({ top: 0, behavior: 'smooth' })
    try {
      // Force a fresh detail read (bypass any intermediate cache).
      const fresh = await apiClient
        .get(`/vendors/me/rentals/assets/${a.id}`, {
          params: { _ts: Date.now() },
          headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
        })
        .then((r) => r.data as RentalAsset & Record<string, unknown>)
      const next = assetToForm(fresh)
      applyAssetForm(next)
      // Keep list cache in sync so cards show the same dates.
      qc.setQueryData<RentalAsset[]>(['rental-assets'], (prev) => {
        if (!Array.isArray(prev)) return prev
        return prev.map((item) => (item.id === a.id ? { ...item, ...fresh } : item))
      })
    } catch (e) {
      toast.error(extractApiError(e, 'Load asset for edit'))
    } finally {
      setLoadingAssetEdit(false)
    }
  }

  const createAsset = useMutation({
    mutationFn: (body: Record<string, unknown>) => rentalApi.createAsset(body),
    onSuccess: () => {
      toast.success('Rental asset created')
      resetAssetForm()
      invalidate()
      setTab('assets')
    },
    onError: (e) => toast.error(extractApiError(e, 'Create rental asset')),
  })

  const updateAsset = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      rentalApi.updateAsset(id, body),
    onSuccess: (data: RentalAsset) => {
      const start = toDateInputValue(data.display_start_date)
      const end = toDateInputValue(data.display_end_date)
      toast.success(
        start || end
          ? `Asset updated · Available ${start || '…'} → ${end || '…'}`
          : 'Rental asset updated',
      )
      resetAssetForm()
      invalidate()
      setTab('assets')
    },
    onError: (e) => toast.error(extractApiError(e, 'Update rental asset')),
  })

  const savingAsset = createAsset.isPending || updateAsset.isPending

  const saveAsset = () => {
    if (displayDateLockError) {
      toast.error(displayDateLockError)
      return
    }
    if (form.availability_mode === 'date_range') {
      const start = toDateInputValue(form.display_start_date)
      const end = toDateInputValue(form.display_end_date)
      if (!start || !end) {
        toast.error('Select both start date and end date for Date range availability')
        return
      }
      if (end < start) {
        toast.error('Display end date must be on or after the start date')
        return
      }
    }
    const body = assetPayload()
    if (editingAssetId) {
      updateAsset.mutate({ id: editingAssetId, body })
    } else {
      createAsset.mutate(body)
    }
  }

  const onAvailabilityModeChange = (mode: string) => {
    const nextMode = mode === 'date_range' ? 'date_range' : 'always'
    setForm((f) => ({
      ...f,
      availability_mode: nextMode,
      // Keep existing dates when switching to range; clear when always available.
      display_start_date: nextMode === 'always' ? '' : f.display_start_date,
      display_end_date: nextMode === 'always' ? '' : f.display_end_date,
    }))
    setDateFieldsEpoch((n) => n + 1)
  }

  const createBooking = useMutation({
    mutationFn: (body: Record<string, unknown>) => rentalApi.createBooking(body),
    onSuccess: (data) => {
      toast.success(
        data.status === 'approved'
          ? `Booking ${data.booking_number || ''} created and approved`
          : `Booking ${data.booking_number || ''} created`,
      )
      resetBookingForm()
      setCreditHint(null)
      setSelectedBooking(data)
      invalidate()
      setTab('bookings')
    },
    onError: (e) => toast.error(extractApiError(e, 'Create booking')),
  })

  const updateBooking = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      rentalApi.updateBooking(id, body),
    onSuccess: (data, vars) => {
      if (vars.body?.status === 'approved') {
        toast.success(
          'Booking approved. Asset display dates were checked/expanded to cover this rental period.',
        )
      } else if (vars.body?.new_end_date) {
        toast.success(`Booking dates extended to ${String(vars.body.new_end_date)}`)
      } else {
        toast.success('Booking updated')
      }
      setSelectedBooking(data)
      invalidate()
    },
    onError: (e) => toast.error(extractApiError(e, 'Update booking')),
  })

  useEffect(() => {
    if (!showBookingForm || !bookingForm.customer_name.trim()) {
      setCreditHint(null)
      return
    }
    const asset = (assets as RentalAsset[]).find((a) => a.id === bookingForm.asset_id)
    const qty = Number(bookingForm.quantity) || 1
    const estimate = Math.max(
      1,
      (Number(asset?.daily_rate || 0) * qty) + Number(asset?.deposit_amount || 0),
    )
    let cancelled = false
    const t = window.setTimeout(() => {
      crmApi.checkCreditControl({
        customer_id: bookingForm.customer_id || undefined,
        party_name: bookingForm.customer_name.trim(),
        amount: estimate,
        require_zero_outstanding: true,
      }).then((res) => {
        if (cancelled) return
        const due = Number(res.current_outstanding || 0)
        if (!res.allowed) {
          setCreditHint({
            allowed: false,
            text: res.reason || (due > 0
              ? `₹${due.toLocaleString('en-IN')} DUE — clear before booking`
              : 'Not eligible'),
          })
        } else {
          setCreditHint({
            allowed: true,
            text: due > 0
              ? `₹${due.toLocaleString('en-IN')} outstanding`
              : '₹0 CLEAR — eligible to book',
          })
        }
      }).catch(() => {
        if (!cancelled) setCreditHint(null)
      })
    }, 350)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [
    showBookingForm,
    bookingForm.customer_id,
    bookingForm.customer_name,
    bookingForm.asset_id,
    bookingForm.quantity,
    assets,
  ])

  const saveBooking = () => {
    if (!bookingForm.asset_id) {
      toast.error('Select a rental asset')
      return
    }
    if (!bookingForm.customer_name.trim()) {
      toast.error('Customer name is required')
      return
    }
    if (creditHint && !creditHint.allowed) {
      toast.error(creditHint.text)
      return
    }
    const start = toDateInputValue(bookingForm.start_date)
    const end = toDateInputValue(bookingForm.end_date)
    if (!start || !end) {
      toast.error('Start and end dates are required')
      return
    }
    if (end < start) {
      toast.error('End date must be on or after start date')
      return
    }
    const qty = Number(bookingForm.quantity) || 0
    if (qty <= 0) {
      toast.error('Quantity must be greater than zero')
      return
    }
    const asset = (assets as RentalAsset[]).find((a) => a.id === bookingForm.asset_id)
    createBooking.mutate({
      asset_id: bookingForm.asset_id,
      customer_id: bookingForm.customer_id || undefined,
      sales_area_id: bookingForm.sales_area_id || asset?.sales_area_id || undefined,
      customer_name: bookingForm.customer_name.trim(),
      customer_phone: bookingForm.customer_phone.trim() || undefined,
      customer_email: bookingForm.customer_email.trim() || undefined,
      quantity: qty,
      start_date: start,
      end_date: end,
      pricing_plan: bookingForm.pricing_plan,
      notes: bookingForm.notes.trim() || undefined,
      needs_delivery: bookingForm.needs_delivery,
      delivery_address: bookingForm.needs_delivery ? bookingForm.delivery_address.trim() || undefined : undefined,
      created_by_vendor: true,
      auto_approve: bookingForm.auto_approve,
    })
  }

  const selectedBookingAsset = useMemo(() => {
    return (assets as RentalAsset[]).find((a) => a.id === bookingForm.asset_id) || null
  }, [assets, bookingForm.asset_id])

  const bookableAssetOptions = useMemo(() => {
    return (assets as RentalAsset[])
      .filter((a) => !['maintenance', 'unavailable', 'retired'].includes(a.status || ''))
      .map((a) => ({
        value: a.id,
        label: `${a.name}${a.location ? ` · ${a.location}` : ''}`,
      }))
  }, [assets])

  const recordPayment = useMutation({
    mutationFn: (id: string) =>
      rentalApi.recordPayment(id, { payment_status: 'paid', payment_method: 'manual', auto_confirm: true }),
    onSuccess: (data) => {
      toast.success('Payment recorded')
      setSelectedBooking(data)
      invalidate()
    },
    onError: (e) => toast.error(extractApiError(e, 'Record payment')),
  })

  const updateDelivery = useMutation({
    mutationFn: (id: string) => rentalApi.updateDelivery(id, deliveryForm),
    onSuccess: (data) => {
      toast.success('Delivery van details updated')
      setSelectedBooking(data)
      invalidate()
    },
    onError: (e) => toast.error(extractApiError(e, 'Update delivery')),
  })

  const filteredAssets = useMemo(() => {
    return (assets as RentalAsset[]).filter((a) => {
      if (assetStatus && a.status !== assetStatus) return false
      if (assetCategory && a.category !== assetCategory) return false
      if (assetFilter) {
        const q = assetFilter.toLowerCase()
        const hay = `${a.name} ${a.asset_code || ''} ${a.location || ''} ${a.rack_number || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [assets, assetFilter, assetStatus, assetCategory])

  /** Approved / confirmed / active bookings lock the asset display window. */
  const lockedBookingsForEdit = useMemo(() => {
    if (!editingAssetId) return [] as RentalBooking[]
    const locked = new Set(['approved', 'confirmed', 'active'])
    return (allBookings as RentalBooking[]).filter(
      (b) => b.asset_id === editingAssetId && locked.has(b.status),
    )
  }, [allBookings, editingAssetId])

  const displayDateLockError = useMemo(() => {
    if (!editingAssetId || lockedBookingsForEdit.length === 0) return null
    // Always available (no window) covers every booking — nothing to lock against.
    if (form.availability_mode !== 'date_range') return null
    const start = toDateInputValue(form.display_start_date)
    const end = toDateInputValue(form.display_end_date)
    for (const b of lockedBookingsForEdit) {
      const ref = b.booking_number || b.id.slice(0, 8)
      const bStart = toDateInputValue(b.start_date)
      const bEnd = toDateInputValue(b.end_date)
      const period = `${bStart || '—'} → ${bEnd || '—'}`
      if (start && bStart && bStart < start) {
        return `Cannot update dates: approved booking ${ref} (${period}) starts before ${start}. Use start on/before ${bStart}, or cancel/complete the booking.`
      }
      if (end && bEnd && bEnd > end) {
        return `Cannot update dates: approved booking ${ref} (${period}) ends after ${end}. Use end on/after ${bEnd}, or cancel/complete the booking.`
      }
    }
    return null
  }, [editingAssetId, lockedBookingsForEdit, form.availability_mode, form.display_start_date, form.display_end_date])

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }))

  const assetTypeOptions = useMemo(() => {
    const opts = [...categoryConfig.assetTypes]
    if (form.asset_type && !opts.some((o) => o.value === form.asset_type)) {
      opts.push({ value: form.asset_type, label: form.asset_type.replace(/_/g, ' ') })
    }
    return opts
  }, [categoryConfig.assetTypes, form.asset_type])

  const onCategoryChange = (category: string) => {
    setForm((f) => {
      // Ignore no-op changes (Select remounts must not wipe loaded edit values / dates).
      if (f.category === category) return f
      const cfg = getCategoryConfig(category)
      return {
        ...f,
        category,
        asset_type: cfg.defaults.asset_type,
        capacity_max: cfg.defaults.capacity_max,
        capacity_unit: cfg.defaults.capacity_unit,
        max_weight: cfg.defaults.max_weight,
        weight_unit: cfg.showWeight ? (f.weight_unit || 'kg') : '',
        extra_qty_charge: cfg.showExtraQtyCharge ? f.extra_qty_charge : '0',
        extra_weight_charge: cfg.showExtraWeightCharge ? f.extra_weight_charge : '0',
        section: cfg.showRackLocation ? f.section : '',
        row_label: cfg.showRackLocation ? f.row_label : '',
        rack_number: cfg.showRackLocation ? f.rack_number : '',
        // Keep availability / display dates when switching category
        availability_mode: f.availability_mode,
        display_start_date: f.display_start_date,
        display_end_date: f.display_end_date,
      }
    })
  }

  const cards = [
    { label: 'Total Assets', value: dash?.total_assets ?? 0, icon: Package, color: 'text-blue-600 bg-blue-50' },
    { label: 'Available', value: dash?.available ?? 0, icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Occupied', value: dash?.occupied ?? 0, icon: Boxes, color: 'text-amber-600 bg-amber-50' },
    { label: 'Maintenance', value: dash?.maintenance ?? 0, icon: Wrench, color: 'text-orange-600 bg-orange-50' },
    { label: 'Pending Bookings', value: dash?.pending_bookings ?? 0, icon: Clock, color: 'text-indigo-600 bg-indigo-50' },
    { label: 'Rental Revenue', value: formatCurrency(Number(dash?.rental_revenue || 0)), icon: IndianRupee, color: 'text-teal-600 bg-teal-50' },
  ]

  const tabs: { id: Tab; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'assets', label: 'Assets' },
    { id: 'bookings', label: 'Bookings' },
    { id: 'calendar', label: 'Availability Calendar' },
  ]

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap justify-between gap-4 items-start">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Rentals</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your rental assets, rack capacity, availability, bookings, and rental revenue.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setTab('calendar')}>
            <Calendar className="w-4 h-4 mr-1" /> View Calendar
          </Button>
          <Button size="sm" variant="outline" onClick={() => toast.message('Rental settings coming soon')}>
            <Settings2 className="w-4 h-4 mr-1" /> Rental Settings
          </Button>
          <Button size="sm" variant="outline" onClick={openCreateBooking}>
            <Plus className="w-4 h-4 mr-1" /> Add Booking
          </Button>
          <Button size="sm" onClick={openCreateAsset}>
            <Plus className="w-4 h-4 mr-1" /> Add Rental Asset
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Dashboard ── */}
      {tab === 'dashboard' && (
        <div className="space-y-6">
          {ld ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {cards.map((c) => (
                  <div key={c.label} className="rounded-xl border bg-white p-4">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${c.color}`}>
                      <c.icon className="w-4 h-4" />
                    </div>
                    <p className="text-xl font-bold text-gray-900">{c.value}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{c.label}</p>
                  </div>
                ))}
              </div>

              <div className="grid lg:grid-cols-2 gap-4">
                <section className="rounded-xl border bg-white overflow-hidden">
                  <div className="px-4 py-3 border-b flex justify-between items-center">
                    <h2 className="text-sm font-semibold">Recent Rental Assets</h2>
                    <button type="button" className="text-xs text-primary" onClick={() => setTab('assets')}>View all</button>
                  </div>
                  {(dash?.recent_assets || []).length === 0 ? (
                    <p className="text-sm text-gray-500 p-6">No assets yet. Add your first rental rack.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                          <tr>
                            <th className="px-4 py-2"><TableColumnLabel>Asset</TableColumnLabel></th>
                            <th className="px-4 py-2"><TableColumnLabel>Dates</TableColumnLabel></th>
                            <th className="px-4 py-2"><TableColumnLabel>Capacity</TableColumnLabel></th>
                            <th className="px-4 py-2"><TableColumnLabel>Status</TableColumnLabel></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {(dash.recent_assets as RentalAsset[]).map((a) => {
                            const av = assetCardAvailability(a, allBookings as RentalBooking[])
                            return (
                              <tr key={a.id}>
                                <td className="px-4 py-2.5">
                                  <p className="font-medium">{a.name}</p>
                                  <p className="text-xs text-gray-400 capitalize">
                                    {(a.category || '').replace(/_/g, ' ')}
                                  </p>
                                </td>
                                <td className="px-4 py-2.5 text-xs text-gray-600 whitespace-nowrap">
                                  {av.kind === 'range' ? av.detail : av.label}
                                </td>
                                <td className="px-4 py-2.5 text-gray-600">
                                  {a.available_capacity}/{a.capacity_max} {a.capacity_unit}
                                </td>
                                <td className="px-4 py-2.5"><Badge status={a.status} /></td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                <section className="rounded-xl border bg-white overflow-hidden">
                  <div className="px-4 py-3 border-b flex justify-between items-center">
                    <h2 className="text-sm font-semibold">Upcoming Bookings</h2>
                    <button type="button" className="text-xs text-primary" onClick={() => setTab('bookings')}>View all</button>
                  </div>
                  {(dash?.upcoming_bookings || []).length === 0 ? (
                    <p className="text-sm text-gray-500 p-6">No upcoming bookings.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                          <tr>
                            <th className="px-4 py-2"><TableColumnLabel>Booking</TableColumnLabel></th>
                            <th className="px-4 py-2"><TableColumnLabel>Customer</TableColumnLabel></th>
                            <th className="px-4 py-2"><TableColumnLabel>Status</TableColumnLabel></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {(dash.upcoming_bookings as RentalBooking[]).map((b) => (
                            <tr key={b.id} className="cursor-pointer hover:bg-gray-50" onClick={() => { setSelectedBooking(b); setTab('bookings') }}>
                              <td className="px-4 py-2.5">
                                <p className="font-medium">{b.booking_number || b.id.slice(0, 8)}</p>
                                <p className="text-xs text-gray-400">{b.asset_name}</p>
                              </td>
                              <td className="px-4 py-2.5">{b.customer_name}</td>
                              <td className="px-4 py-2.5"><Badge status={b.status} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Assets ── */}
      {tab === 'assets' && (
        <div className="space-y-4">
          {showForm && (
            <div key={editingAssetId || 'new-asset'} className="rounded-xl border bg-white p-5 space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="font-semibold text-gray-900">
                  {editingAssetId ? 'Edit Rental Asset' : 'Create New Rental Asset'}
                </h2>
                <button type="button" onClick={resetAssetForm} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Basic Information</p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-gray-500">Asset Name *</label>
                    <Input
                      value={form.name}
                      onChange={(e) => set('name', e.target.value)}
                      placeholder={categoryConfig.labels.namePlaceholder}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Category</label>
                    <Select value={form.category} onChange={onCategoryChange} options={RENTAL_CATEGORIES} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Asset Type</label>
                    <Select
                      value={form.asset_type}
                      onChange={(v) => set('asset_type', v)}
                      options={assetTypeOptions}
                    />
                  </div>
                  <div className="sm:col-span-2 lg:col-span-3">
                    <label className="text-xs text-gray-500">Description</label>
                    <Input
                      value={form.description}
                      onChange={(e) => set('description', e.target.value)}
                      placeholder={categoryConfig.labels.descriptionPlaceholder}
                    />
                  </div>
                </div>
              </div>

              {(categoryConfig.showCapacity || categoryConfig.showWeight) && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
                    {categoryConfig.capacitySectionTitle}
                  </p>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {categoryConfig.showCapacity && (
                      <>
                        <div>
                          <label className="text-xs text-gray-500">{categoryConfig.labels.capacity}</label>
                          <Input type="number" value={form.capacity_max} onChange={(e) => set('capacity_max', e.target.value)} />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">{categoryConfig.labels.unit}</label>
                          <Select
                            value={form.capacity_unit}
                            onChange={(v) => set('capacity_unit', v)}
                            options={categoryConfig.capacityUnits}
                          />
                        </div>
                      </>
                    )}
                    {categoryConfig.showWeight && (
                      <>
                        <div>
                          <label className="text-xs text-gray-500">Max Weight</label>
                          <Input type="number" value={form.max_weight} onChange={(e) => set('max_weight', e.target.value)} />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">Weight Unit</label>
                          <Input value={form.weight_unit} onChange={(e) => set('weight_unit', e.target.value)} placeholder="kg" />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Pricing</p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-gray-500">Daily Rate (₹)</label>
                    <Input type="number" value={form.daily_rate} onChange={(e) => set('daily_rate', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Weekly Rate (₹)</label>
                    <Input type="number" value={form.weekly_rate} onChange={(e) => set('weekly_rate', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Monthly Rate (₹)</label>
                    <Input type="number" value={form.monthly_rate} onChange={(e) => set('monthly_rate', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Security Deposit (₹)</label>
                    <Input type="number" value={form.deposit_amount} onChange={(e) => set('deposit_amount', e.target.value)} />
                  </div>
                  {categoryConfig.showExtraQtyCharge && (
                    <div>
                      <label className="text-xs text-gray-500">Extra Qty Charge</label>
                      <Input type="number" value={form.extra_qty_charge} onChange={(e) => set('extra_qty_charge', e.target.value)} />
                    </div>
                  )}
                  {categoryConfig.showExtraWeightCharge && (
                    <div>
                      <label className="text-xs text-gray-500">Extra Weight Charge</label>
                      <Input type="number" value={form.extra_weight_charge} onChange={(e) => set('extra_weight_charge', e.target.value)} />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Display Period (storefront)</p>
                <p className="text-xs text-gray-500 mb-2">
                  Choose how this asset appears on the storefront. Use <span className="font-medium">Date range</span> and
                  save — those dates are what customers see (not “Always available”).
                </p>
                {loadingAssetEdit ? (
                  <p className="text-xs text-gray-500 inline-flex items-center gap-1.5 mb-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading saved dates…
                  </p>
                ) : null}
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500">Availability</label>
                    <Select
                      value={form.availability_mode}
                      onChange={onAvailabilityModeChange}
                      options={AVAILABILITY_OPTIONS}
                    />
                  </div>
                </div>
                {form.availability_mode === 'always' && (
                  <p className="text-xs text-emerald-700 mt-2">
                    Always available — customers can see this asset every day.
                  </p>
                )}
                {form.availability_mode === 'date_range' && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs text-gray-500">
                      Customers only see this asset between these dates.
                    </p>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-500">Start date</label>
                        <Input
                          key={`display-start-${editingAssetId || 'new'}-${dateFieldsEpoch}`}
                          type="date"
                          value={form.display_start_date}
                          onChange={(e) => set('display_start_date', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">End date</label>
                        <Input
                          key={`display-end-${editingAssetId || 'new'}-${dateFieldsEpoch}`}
                          type="date"
                          value={form.display_end_date}
                          min={form.display_start_date || undefined}
                          onChange={(e) => set('display_end_date', e.target.value)}
                        />
                      </div>
                    </div>
                    {(form.display_start_date || form.display_end_date) && (
                      <p className="text-xs text-emerald-700">
                        Available {form.display_start_date || '…'} → {form.display_end_date || '…'}
                      </p>
                    )}
                  </div>
                )}
                {lockedBookingsForEdit.length > 0 && form.availability_mode === 'date_range' && (
                  <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 space-y-1">
                    <p className="font-medium">
                      Display dates are locked by {lockedBookingsForEdit.length} approved booking
                      {lockedBookingsForEdit.length > 1 ? 's' : ''}. The period must cover:
                    </p>
                    <ul className="list-disc pl-4 space-y-0.5">
                      {lockedBookingsForEdit.map((b) => (
                        <li key={b.id}>
                          {b.booking_number || b.id.slice(0, 8)} · {formatDate(b.start_date)} → {formatDate(b.end_date)}
                          {' '}({b.status.replace(/_/g, ' ')})
                        </li>
                      ))}
                    </ul>
                    {displayDateLockError && (
                      <p className="font-medium text-rose-700 pt-1">{displayDateLockError}</p>
                    )}
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Location & Status</p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-gray-500">Sales Area / Route</label>
                    <Select
                      value={form.sales_area_id || '__none__'}
                      onChange={(v) => set('sales_area_id', v === '__none__' ? '' : v)}
                      options={[
                        { value: '__none__', label: 'No sales area' },
                        ...salesAreaOptions,
                      ]}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">{categoryConfig.labels.location}</label>
                    <Input
                      value={form.location}
                      onChange={(e) => set('location', e.target.value)}
                      placeholder={categoryConfig.labels.locationPlaceholder}
                    />
                  </div>
                  {categoryConfig.showRackLocation && (
                    <>
                      <div>
                        <label className="text-xs text-gray-500">Section</label>
                        <Input value={form.section} onChange={(e) => set('section', e.target.value)} placeholder="Cold Storage – A" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Row</label>
                        <Input value={form.row_label} onChange={(e) => set('row_label', e.target.value)} placeholder="Row 01" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Rack Number</label>
                        <Input value={form.rack_number} onChange={(e) => set('rack_number', e.target.value)} placeholder="A-001" />
                      </div>
                    </>
                  )}
                  <div>
                    <label className="text-xs text-gray-500">Status</label>
                    <Select value={form.status} onChange={(v) => set('status', v)} options={ASSET_STATUSES} />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={!form.name.trim() || savingAsset || !!displayDateLockError}
                  onClick={saveAsset}
                >
                  {savingAsset ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                  {editingAssetId ? 'Update Asset' : 'Save Asset'}
                </Button>
                {editingAssetId && (
                  <Button variant="outline" disabled={savingAsset} onClick={resetAssetForm}>
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input className="pl-8" placeholder="Search assets…" value={assetFilter} onChange={(e) => setAssetFilter(e.target.value)} />
            </div>
            <Select
              value={assetCategory || '__all__'}
              onChange={(v) => setAssetCategory(v === '__all__' ? '' : v)}
              options={[{ value: '__all__', label: 'All categories' }, ...RENTAL_CATEGORIES]}
              wrapperClassName="w-44"
            />
            <Select
              value={assetStatus || '__all__'}
              onChange={(v) => setAssetStatus(v === '__all__' ? '' : v)}
              options={[{ value: '__all__', label: 'All statuses' }, ...ASSET_STATUSES]}
              wrapperClassName="w-48"
            />
          </div>

          {la ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
          ) : filteredAssets.length === 0 ? (
            <p className="text-sm text-gray-500 border border-dashed rounded-xl p-8 text-center">No rental assets found.</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {filteredAssets.map((a) => {
                const availability = assetCardAvailability(a, allBookings as RentalBooking[])
                return (
                  <div key={a.id} className="rounded-xl border bg-white p-4 space-y-3">
                    <div className="flex justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900">{a.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {(a.category || '').replace(/_/g, ' ')}
                          {a.asset_type ? ` · ${String(a.asset_type).replace(/_/g, ' ')}` : ''}
                        </p>
                      </div>
                      <div className="flex items-start gap-2 shrink-0">
                        <Badge status={a.status} />
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2"
                          onClick={() => openEditAsset(a)}
                          title="Edit asset"
                        >
                          <Pencil className="w-3.5 h-3.5 mr-1" />
                          Edit
                        </Button>
                      </div>
                    </div>
                    <CapacityBar
                      used={Number(a.current_occupancy || 0)}
                      max={Number(a.capacity_max || 0)}
                      unit={a.capacity_unit}
                    />
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                      {a.max_weight != null && <span>⚖ {a.max_weight} {a.weight_unit}</span>}
                      {a.sales_area_id && salesAreaLabelById.get(a.sales_area_id) && (
                        <span>Route · {salesAreaLabelById.get(a.sales_area_id)}</span>
                      )}
                      {a.location && <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{a.location}</span>}
                    </div>
                    <div className={`flex items-center gap-1.5 text-xs rounded-lg px-2.5 py-1.5 ${
                      availability.kind === 'range'
                        ? 'bg-emerald-50 text-emerald-800'
                        : 'bg-amber-50 text-amber-800'
                    }`}>
                      <Calendar className="w-3.5 h-3.5 shrink-0" />
                      {availability.kind === 'range' ? (
                        <span>
                          <span className="font-medium">{availability.label}</span>
                          {' · '}
                          {availability.detail}
                        </span>
                      ) : (
                        <span>{availability.label}</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700">
                      {formatCurrency(Number(a.daily_rate || 0))}/day
                      {Number(a.monthly_rate) > 0 && <> · {formatCurrency(Number(a.monthly_rate))}/mo</>}
                      {' · '}deposit {formatCurrency(Number(a.deposit_amount || 0))}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Bookings ── */}
      {tab === 'bookings' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <Select
              value={bookingStatus || '__all__'}
              onChange={(v) => setBookingStatus(v === '__all__' ? '' : v)}
              options={[{ value: '__all__', label: 'All bookings' }, ...BOOKING_STATUSES]}
              wrapperClassName="w-48"
            />
            <Button size="sm" onClick={openCreateBooking}>
              <Plus className="w-4 h-4 mr-1" /> Add Booking
            </Button>
          </div>

          {showBookingForm && (
            <div className="rounded-xl border bg-white p-5 space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="font-semibold text-gray-900">Add Booking</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Create a rental booking for a customer</p>
                </div>
                <button type="button" onClick={resetBookingForm} className="text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="sm:col-span-2 lg:col-span-1">
                  <label className="text-xs text-gray-500">Asset *</label>
                  <Select
                    value={bookingForm.asset_id || '__none__'}
                    onChange={(v) => {
                      const id = v === '__none__' ? '' : v
                      const asset = (assets as RentalAsset[]).find((a) => a.id === id)
                      setBookingForm((f) => ({
                        ...f,
                        asset_id: id,
                        sales_area_id: asset?.sales_area_id || f.sales_area_id,
                        pricing_plan: Number(asset?.monthly_rate) > 0 ? f.pricing_plan : 'daily',
                        quantity: f.quantity || '1',
                      }))
                    }}
                    options={[
                      { value: '__none__', label: 'Select rack / asset…' },
                      ...bookableAssetOptions,
                    ]}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Customer (outlet)</label>
                  <Select
                    value={bookingForm.customer_id || '__manual__'}
                    onChange={(v) => {
                      if (v === '__manual__') {
                        setBookingForm((f) => ({ ...f, customer_id: '' }))
                        return
                      }
                      const c = customers.find((x) => x.id === v)
                      if (!c) return
                      setBookingForm((f) => ({
                        ...f,
                        customer_id: c.id,
                        customer_name: c.full_name || '',
                        customer_phone: c.phone || '',
                        customer_email: c.email || '',
                      }))
                    }}
                    options={[
                      { value: '__manual__', label: 'Type manually / pick…' },
                      ...customers.map((c) => ({
                        value: c.id,
                        label: c.full_name + (c.phone ? ` · ${c.phone}` : ''),
                      })),
                    ]}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Customer name *</label>
                  <Input
                    value={bookingForm.customer_name}
                    onChange={(e) => setBookingForm((f) => ({
                      ...f,
                      customer_name: e.target.value,
                      customer_id: '',
                    }))}
                    placeholder="Customer / shop name"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Sales Area / Route</label>
                  <Select
                    value={bookingForm.sales_area_id || '__none__'}
                    onChange={(v) => setBookingForm((f) => ({
                      ...f,
                      sales_area_id: v === '__none__' ? '' : v,
                    }))}
                    options={[
                      { value: '__none__', label: 'From rack / none' },
                      ...salesAreaOptions,
                    ]}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Phone</label>
                  <Input
                    value={bookingForm.customer_phone}
                    onChange={(e) => setBookingForm((f) => ({ ...f, customer_phone: e.target.value }))}
                    placeholder="Mobile number"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Email</label>
                  <Input
                    type="email"
                    value={bookingForm.customer_email}
                    onChange={(e) => setBookingForm((f) => ({ ...f, customer_email: e.target.value }))}
                    placeholder="email@example.com"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">
                    Quantity {selectedBookingAsset ? `(${selectedBookingAsset.capacity_unit || 'units'})` : ''}
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={bookingForm.quantity}
                    onChange={(e) => setBookingForm((f) => ({ ...f, quantity: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Pricing plan</label>
                  <Select
                    value={bookingForm.pricing_plan}
                    onChange={(v) => setBookingForm((f) => ({ ...f, pricing_plan: v }))}
                    options={[
                      { value: 'daily', label: 'Daily' },
                      ...(Number(selectedBookingAsset?.weekly_rate) > 0
                        ? [{ value: 'weekly', label: 'Weekly' }]
                        : []),
                      ...(Number(selectedBookingAsset?.monthly_rate) > 0
                        ? [{ value: 'monthly', label: 'Monthly' }]
                        : []),
                    ]}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Start date *</label>
                  <Input
                    type="date"
                    value={bookingForm.start_date}
                    min={fromStr}
                    onChange={(e) => setBookingForm((f) => ({ ...f, start_date: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">End date *</label>
                  <Input
                    type="date"
                    value={bookingForm.end_date}
                    min={bookingForm.start_date || fromStr}
                    onChange={(e) => setBookingForm((f) => ({ ...f, end_date: e.target.value }))}
                  />
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <label className="text-xs text-gray-500">Notes</label>
                  <Input
                    value={bookingForm.notes}
                    onChange={(e) => setBookingForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="Optional notes"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={bookingForm.needs_delivery}
                  onChange={(e) => setBookingForm((f) => ({ ...f, needs_delivery: e.target.checked }))}
                />
                Needs delivery
              </label>
              {bookingForm.needs_delivery && (
                <Input
                  value={bookingForm.delivery_address}
                  onChange={(e) => setBookingForm((f) => ({ ...f, delivery_address: e.target.value }))}
                  placeholder="Delivery address"
                />
              )}

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={bookingForm.auto_approve}
                  onChange={(e) => setBookingForm((f) => ({ ...f, auto_approve: e.target.checked }))}
                />
                Approve immediately
              </label>

              {selectedBookingAsset && (
                <p className="text-xs text-gray-500 rounded-lg bg-gray-50 border px-3 py-2">
                  {selectedBookingAsset.name}
                  {selectedBookingAsset.sales_area_id && salesAreaLabelById.get(selectedBookingAsset.sales_area_id)
                    ? ` · ${salesAreaLabelById.get(selectedBookingAsset.sales_area_id)}`
                    : ''}
                  {' · '}
                  {formatCurrency(Number(selectedBookingAsset.daily_rate || 0))}/day
                  {Number(selectedBookingAsset.monthly_rate) > 0 && (
                    <> · {formatCurrency(Number(selectedBookingAsset.monthly_rate))}/mo</>
                  )}
                  {' · '}deposit {formatCurrency(Number(selectedBookingAsset.deposit_amount || 0))}
                  {(selectedBookingAsset.display_start_date || selectedBookingAsset.display_end_date) && (
                    <>
                      {' · '}available{' '}
                      {formatCardDate(selectedBookingAsset.display_start_date) || '…'}
                      {' → '}
                      {formatCardDate(selectedBookingAsset.display_end_date) || '…'}
                    </>
                  )}
                </p>
              )}

              {creditHint && (
                <p className={`text-sm rounded-lg border px-3 py-2 ${
                  creditHint.allowed
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-700'
                }`}>
                  {creditHint.text}
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={createBooking.isPending || (!!creditHint && !creditHint.allowed)}
                  onClick={saveBooking}
                >
                  {createBooking.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                  Create Booking
                </Button>
                <Button variant="outline" disabled={createBooking.isPending} onClick={resetBookingForm}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          <div className="grid lg:grid-cols-5 gap-4">
            <div className={`${selectedBooking ? 'lg:col-span-3' : 'lg:col-span-5'} rounded-xl border bg-white overflow-hidden`}>
              {lb ? (
                <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
              ) : (bookings as RentalBooking[]).length === 0 ? (
                <p className="text-sm text-gray-500 p-8 text-center">No rental bookings yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                      <tr>
                        <th className="px-4 py-3"><TableColumnLabel>Booking</TableColumnLabel></th>
                        <th className="px-4 py-3"><TableColumnLabel>Customer</TableColumnLabel></th>
                        <th className="px-4 py-3"><TableColumnLabel>Asset</TableColumnLabel></th>
                        <th className="px-4 py-3"><TableColumnLabel>Qty</TableColumnLabel></th>
                        <th className="px-4 py-3"><TableColumnLabel>Dates</TableColumnLabel></th>
                        <th className="px-4 py-3 text-right"><TableColumnLabel>Total</TableColumnLabel></th>
                        <th className="px-4 py-3"><TableColumnLabel>Status</TableColumnLabel></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {(bookings as RentalBooking[]).map((b) => (
                        <tr
                          key={b.id}
                          className={`cursor-pointer hover:bg-gray-50 ${selectedBooking?.id === b.id ? 'bg-primary/5' : ''}`}
                          onClick={() => {
                            setSelectedBooking(b)
                            setDeliveryForm({
                              delivery_status: b.delivery_status || 'assigned',
                              van_number: b.van_number || '',
                              van_driver_name: b.van_driver_name || '',
                              van_driver_phone: b.van_driver_phone || '',
                              van_vehicle_type: b.van_vehicle_type || 'Delivery Van',
                              delivery_notes: b.delivery_notes || '',
                            })
                          }}
                        >
                          <td className="px-4 py-3 font-medium">{b.booking_number || `#${b.id.slice(0, 6)}`}</td>
                          <td className="px-4 py-3">{b.customer_name}</td>
                          <td className="px-4 py-3 text-gray-600">{b.asset_name || b.asset_code || '—'}</td>
                          <td className="px-4 py-3">{b.quantity} {b.capacity_unit || ''}</td>
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                            {formatDate(b.start_date)} → {formatDate(b.end_date)}
                          </td>
                          <td className="px-4 py-3 text-right">{formatCurrency(Number(b.total_amount || 0))}</td>
                          <td className="px-4 py-3"><Badge status={b.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {selectedBooking && (
              <div className="lg:col-span-2 rounded-xl border bg-white p-4 space-y-4 max-h-[80vh] overflow-y-auto">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <h3 className="font-semibold">{selectedBooking.booking_number}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{selectedBooking.asset_name}</p>
                  </div>
                  <button type="button" onClick={() => setSelectedBooking(null)} className="text-gray-400"><X className="w-4 h-4" /></button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge status={selectedBooking.status} />
                  <Badge status={selectedBooking.payment_status} />
                  <Badge status={selectedBooking.delivery_status} />
                </div>

                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <div><dt className="text-xs text-gray-400">Customer</dt><dd>{selectedBooking.customer_name}</dd></div>
                  <div><dt className="text-xs text-gray-400">Phone</dt><dd>{selectedBooking.customer_phone || '—'}</dd></div>
                  <div><dt className="text-xs text-gray-400">Quantity</dt><dd>{selectedBooking.quantity} {selectedBooking.capacity_unit}</dd></div>
                  <div><dt className="text-xs text-gray-400">Plan</dt><dd className="capitalize">{selectedBooking.pricing_plan}</dd></div>
                  <div className="col-span-2">
                    <dt className="text-xs text-gray-400">Rental period</dt>
                    <dd className="font-medium">
                      {formatDate(selectedBooking.start_date)} → {formatDate(selectedBooking.end_date)}
                    </dd>
                  </div>
                  <div><dt className="text-xs text-gray-400">Rental</dt><dd>{formatCurrency(Number(selectedBooking.rental_amount || 0))}</dd></div>
                  <div><dt className="text-xs text-gray-400">Deposit</dt><dd>{formatCurrency(Number(selectedBooking.deposit_amount || 0))}</dd></div>
                  <div className="col-span-2"><dt className="text-xs text-gray-400">Total</dt><dd className="font-semibold">{formatCurrency(Number(selectedBooking.total_amount || 0))}</dd></div>
                </dl>

                {['approved', 'confirmed', 'active'].includes(selectedBooking.status) && (
                  <p className="text-xs rounded-lg border border-sky-200 bg-sky-50 text-sky-900 px-3 py-2">
                    This booking is <span className="font-medium capitalize">{selectedBooking.status.replace(/_/g, ' ')}</span>.
                    Asset display dates must cover {formatDate(selectedBooking.start_date)} → {formatDate(selectedBooking.end_date)}.
                    Narrowing those dates will show an error until the booking is cancelled or completed.
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  {selectedBooking.status === 'pending' && (
                    <>
                      <Button size="sm" onClick={() => updateBooking.mutate({ id: selectedBooking.id, body: { status: 'approved' } })}>Approve</Button>
                      <Button size="sm" variant="outline" onClick={() => updateBooking.mutate({ id: selectedBooking.id, body: { status: 'rejected' } })}>Reject</Button>
                    </>
                  )}
                  {['approved', 'confirmed'].includes(selectedBooking.status) && (
                    <Button size="sm" onClick={() => updateBooking.mutate({ id: selectedBooking.id, body: { status: 'active' } })}>Mark Active</Button>
                  )}
                  {selectedBooking.status === 'active' && (
                    <Button size="sm" onClick={() => updateBooking.mutate({ id: selectedBooking.id, body: { status: 'completed' } })}>Complete</Button>
                  )}
                  {!['cancelled', 'rejected', 'completed'].includes(selectedBooking.status) && (
                    <Button size="sm" variant="outline" onClick={() => updateBooking.mutate({ id: selectedBooking.id, body: { status: 'cancelled' } })}>Cancel</Button>
                  )}
                  {selectedBooking.payment_status !== 'paid' && (
                    <Button size="sm" variant="outline" onClick={() => recordPayment.mutate(selectedBooking.id)}>
                      <IndianRupee className="w-3.5 h-3.5 mr-1" /> Mark Paid
                    </Button>
                  )}
                </div>

                {['approved', 'confirmed', 'active'].includes(selectedBooking.status) && (
                  <div className="border-t pt-3 space-y-2">
                    <h4 className="text-sm font-semibold">Extend end date</h4>
                    <p className="text-xs text-gray-500">
                      Only the end date can be moved later after approval. It must stay within the asset display period.
                    </p>
                    <div className="flex flex-wrap gap-2 items-end">
                      <div className="min-w-[160px]">
                        <label className="text-xs text-gray-500">New end date</label>
                        <Input
                          type="date"
                          min={toDateInputValue(selectedBooking.end_date) || undefined}
                          defaultValue=""
                          id={`extend-end-${selectedBooking.id}`}
                        />
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={updateBooking.isPending}
                        onClick={() => {
                          const el = document.getElementById(`extend-end-${selectedBooking.id}`) as HTMLInputElement | null
                          const next = toDateInputValue(el?.value)
                          if (!next) {
                            toast.error('Select a new end date to extend this booking')
                            return
                          }
                          const currentEnd = toDateInputValue(selectedBooking.end_date)
                          if (currentEnd && next <= currentEnd) {
                            toast.error('New end date must be after the current end date')
                            return
                          }
                          updateBooking.mutate({ id: selectedBooking.id, body: { new_end_date: next } })
                        }}
                      >
                        Extend dates
                      </Button>
                    </div>
                  </div>
                )}

                <div className="border-t pt-3 space-y-2">
                  <h4 className="text-sm font-semibold flex items-center gap-1.5">
                    <Truck className="w-4 h-4" /> Delivery Van Tracking
                  </h4>
                  <Select
                    value={deliveryForm.delivery_status}
                    onChange={(v) => setDeliveryForm((f) => ({ ...f, delivery_status: v }))}
                    options={DELIVERY_STATUSES}
                  />
                  <Input placeholder="Van number" value={deliveryForm.van_number} onChange={(e) => setDeliveryForm((f) => ({ ...f, van_number: e.target.value }))} />
                  <Input placeholder="Driver name" value={deliveryForm.van_driver_name} onChange={(e) => setDeliveryForm((f) => ({ ...f, van_driver_name: e.target.value }))} />
                  <Input placeholder="Driver phone" value={deliveryForm.van_driver_phone} onChange={(e) => setDeliveryForm((f) => ({ ...f, van_driver_phone: e.target.value }))} />
                  <Input placeholder="Vehicle type" value={deliveryForm.van_vehicle_type} onChange={(e) => setDeliveryForm((f) => ({ ...f, van_vehicle_type: e.target.value }))} />
                  <Input placeholder="Delivery notes" value={deliveryForm.delivery_notes} onChange={(e) => setDeliveryForm((f) => ({ ...f, delivery_notes: e.target.value }))} />
                  <Button size="sm" disabled={updateDelivery.isPending} onClick={() => updateDelivery.mutate(selectedBooking.id)}>
                    {updateDelivery.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update Delivery'}
                  </Button>
                </div>

                {(selectedBooking.timeline || []).length > 0 && (
                  <div className="border-t pt-3">
                    <h4 className="text-sm font-semibold mb-2">Booking Timeline</h4>
                    <ol className="space-y-2">
                      {(selectedBooking.timeline || []).map((t, i) => (
                        <li key={i} className="text-xs flex gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                          <div>
                            <p className="font-medium text-gray-800">{t.event}</p>
                            {t.detail && <p className="text-gray-500">{t.detail}</p>}
                            {t.at && <p className="text-gray-400">{new Date(t.at).toLocaleString('en-IN')}</p>}
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Calendar ── */}
      {tab === 'calendar' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="min-w-[240px]">
              <label className="text-xs text-gray-500">Select asset</label>
              <Select
                value={calendarAssetId || '__none__'}
                onChange={(v) => setCalendarAssetId(v === '__none__' ? '' : v)}
                options={[
                  { value: '__none__', label: 'Choose an asset…' },
                  ...(assets as RentalAsset[]).map((a) => ({
                    value: a.id,
                    label: `${a.name}${a.asset_code ? ` (${a.asset_code})` : ''}`,
                  })),
                ]}
              />
            </div>
            <p className="text-xs text-gray-500 pb-2">Showing next 30 days</p>
          </div>

          {!calendarAssetId ? (
            <p className="text-sm text-gray-500 border border-dashed rounded-xl p-8 text-center">Select an asset to view availability.</p>
          ) : lc ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
          ) : (
            <div className="rounded-xl border bg-white overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3"><TableColumnLabel>Date</TableColumnLabel></th>
                    <th className="px-4 py-3"><TableColumnLabel>Status</TableColumnLabel></th>
                    <th className="px-4 py-3"><TableColumnLabel>Reserved</TableColumnLabel></th>
                    <th className="px-4 py-3"><TableColumnLabel>Available</TableColumnLabel></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(calendarDays as Array<{ date: string; status: string; reserved_qty: number; available_capacity: number }>).map((d) => (
                    <tr key={d.date}>
                      <td className="px-4 py-2.5">{formatDate(d.date)}</td>
                      <td className="px-4 py-2.5"><Badge status={d.status === 'booked' ? 'fully_occupied' : d.status === 'partial' ? 'partially_occupied' : d.status} /></td>
                      <td className="px-4 py-2.5">{d.reserved_qty}</td>
                      <td className="px-4 py-2.5">{d.available_capacity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
