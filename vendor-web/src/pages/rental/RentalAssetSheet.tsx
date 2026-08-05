import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CalendarRange, IndianRupee, Layers, Loader2, MapPin, Plus, Tag } from 'lucide-react'
import { toast } from 'sonner'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { FieldLabel } from '@/components/common/FieldLabel'
import { CollapsibleSection } from '@/components/common/CollapsibleSection'
import { extractApiError } from '@/lib/errorMessages'
import { formatDate } from '@/lib/utils'
import { rentalApi } from './api'
import { toDateInputValue, pickDisplayDates } from './rentalDates'
import {
  ASSET_STATUSES, AVAILABILITY_OPTIONS, RENTAL_CATEGORIES, emptyAssetForm, getCategoryConfig,
  type RentalAsset, type RentalBooking,
} from './rentalConstants'
import RentalAssetUnitsPanel from './RentalAssetUnitsPanel'

type AssetFormState = ReturnType<typeof emptyAssetForm>

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
    unit_mode: String(a.unit_mode || 'none'),
    parent_asset_id: String(a.parent_asset_id || ''),
    is_bookable: a.is_bookable !== false,
    price_per_unit: String(a.price_per_unit ?? 0),
    pricing_uom: String(a.pricing_uom || ''),
    hourly_rate: String(a.hourly_rate ?? 0),
    per_minute_rate: String(a.per_minute_rate ?? 0),
    yearly_rate: String(a.yearly_rate ?? 0),
  }
}

type SelectOpt = { value: string; label: string }

type Props = {
  open: boolean
  /** null = create new asset */
  assetId: string | null
  /** Optimistic fill from a list card while the fresh detail loads. */
  initialAsset?: RentalAsset | null
  /** When creating a child asset, pre-fill parent_asset_id and unit_mode=hierarchy. */
  initialParentId?: string | null
  salesAreaOptions: SelectOpt[]
  /** Approved / confirmed / active bookings for this asset — lock the display window. */
  lockedBookings: RentalBooking[]
  onClose: () => void
  onSaved: (asset: RentalAsset) => void
  /** Called when the user wants to add a child asset under this one. */
  onRequestAddChild?: (parentId: string) => void
}

export default function RentalAssetSheet({
  open, assetId, initialAsset, initialParentId, salesAreaOptions, lockedBookings,
  onClose, onSaved, onRequestAddChild,
}: Props) {
  const qc = useQueryClient()
  const [form, setForm] = useState<AssetFormState>(emptyAssetForm())
  const [loading, setLoading] = useState(false)
  const [openSections, setOpenSections] = useState({
    basics: true, pricing: false, availability: false, location: false, subAssets: false,
  })
  // Tracks the unit_mode value that is actually saved on the server.
  // The units panel is only rendered when this matches 'serialized' so users
  // cannot attempt to add units before the mode change has been persisted.
  const [savedUnitMode, setSavedUnitMode] = useState<string>('none')

  useEffect(() => {
    if (!open) return
    if (!assetId) {
      const base = emptyAssetForm()
      setForm(
        initialParentId
          ? { ...base, parent_asset_id: initialParentId, unit_mode: 'hierarchy' }
          : base,
      )
      setSavedUnitMode('none')
      setOpenSections({
        basics: true, pricing: false, availability: false, location: false,
        subAssets: Boolean(initialParentId),
      })
      return
    }
    // Optimistic fill from the card, then refresh with an uncached read.
    if (initialAsset) {
      setForm(assetToForm(initialAsset as RentalAsset & Record<string, unknown>))
      setSavedUnitMode(initialAsset.unit_mode ?? 'none')
    }
    setLoading(true)
    rentalApi.getAsset(assetId)
      .then((fresh) => {
        setForm(assetToForm(fresh as RentalAsset & Record<string, unknown>))
        setSavedUnitMode(fresh.unit_mode ?? 'none')
      })
      .catch((e) => toast.error(extractApiError(e, 'Load asset for edit')))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, assetId])

  const set = (key: keyof AssetFormState, value: string) => setForm((f) => ({ ...f, [key]: value }))
  const toggleSection = (key: keyof typeof openSections) =>
    setOpenSections((s) => ({ ...s, [key]: !s[key] }))

  // Parent asset options for hierarchy mode (all assets of this vendor, minus self)
  const { data: allAssets = [] } = useQuery<RentalAsset[]>({
    queryKey: ['rental-assets'],
    queryFn: () => rentalApi.listAssets(),
    enabled: open,
    staleTime: 30_000,
  })
  const parentOptions = useMemo(() => {
    const opts = allAssets
      .filter((a) => a.id !== assetId && !a.parent_asset_id) // only top-level assets as parents
      .map((a) => ({ value: a.id, label: `${a.name}${a.asset_code ? ` (${a.asset_code})` : ''}` }))
    return [{ value: '', label: 'No parent (top-level asset)' }, ...opts]
  }, [allAssets, assetId])

  // Child assets for hierarchy view (only when editing an existing asset)
  const { data: childAssets = [] } = useQuery<RentalAsset[]>({
    queryKey: ['rental-asset-children', assetId],
    queryFn: () => rentalApi.listAssetChildren(assetId!),
    enabled: open && Boolean(assetId) && form.unit_mode === 'hierarchy',
  })

  const categoryConfig = getCategoryConfig(form.category)

  const assetTypeOptions = useMemo(() => {
    const opts = [...categoryConfig.assetTypes]
    if (form.asset_type && !opts.some((o) => o.value === form.asset_type)) {
      opts.push({ value: form.asset_type, label: form.asset_type.replace(/_/g, ' ') })
    }
    return opts
  }, [categoryConfig.assetTypes, form.asset_type])

  const onCategoryChange = (category: string) => {
    setForm((f) => {
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
        availability_mode: f.availability_mode,
        display_start_date: f.display_start_date,
        display_end_date: f.display_end_date,
      }
    })
  }

  const onAvailabilityModeChange = (mode: string) => {
    const nextMode = mode === 'date_range' ? 'date_range' : 'always'
    setForm((f) => ({
      ...f,
      availability_mode: nextMode,
      display_start_date: nextMode === 'always' ? '' : f.display_start_date,
      display_end_date: nextMode === 'always' ? '' : f.display_end_date,
    }))
  }

  const displayDateLockError = useMemo(() => {
    if (!assetId || lockedBookings.length === 0) return null
    if (form.availability_mode !== 'date_range') return null
    const start = toDateInputValue(form.display_start_date)
    const end = toDateInputValue(form.display_end_date)
    for (const b of lockedBookings) {
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
  }, [assetId, lockedBookings, form.availability_mode, form.display_start_date, form.display_end_date])

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
      unit_mode: form.unit_mode || 'none',
      parent_asset_id: form.parent_asset_id || null,
      is_bookable: form.is_bookable,
      price_per_unit: Number(form.price_per_unit) || 0,
      pricing_uom: form.pricing_uom.trim() || null,
      hourly_rate: Number(form.hourly_rate) || 0,
      per_minute_rate: Number(form.per_minute_rate) || 0,
      yearly_rate: Number(form.yearly_rate) || 0,
    }
  }

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['rental-dashboard'] })
    qc.invalidateQueries({ queryKey: ['rental-assets'] })
    qc.invalidateQueries({ queryKey: ['rental-bookings'] })
  }

  const createAsset = useMutation({
    mutationFn: (body: Record<string, unknown>) => rentalApi.createAsset(body),
    onSuccess: (data: RentalAsset) => {
      toast.success('Rental asset created')
      setSavedUnitMode(data.unit_mode ?? 'none')
      invalidate()
      onSaved(data)
    },
    onError: (e) => toast.error(extractApiError(e, 'Create rental asset')),
  })

  const updateAsset = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => rentalApi.updateAsset(id, body),
    onSuccess: (data: RentalAsset) => {
      const start = toDateInputValue(data.display_start_date)
      const end = toDateInputValue(data.display_end_date)
      toast.success(
        start || end
          ? `Asset updated · Available ${start || '…'} → ${end || '…'}`
          : 'Rental asset updated',
      )
      setSavedUnitMode(data.unit_mode ?? 'none')
      invalidate()
      onSaved(data)
    },
    onError: (e) => toast.error(extractApiError(e, 'Update rental asset')),
  })

  const saving = createAsset.isPending || updateAsset.isPending

  const save = () => {
    if (!form.name.trim()) {
      toast.error('Asset name is required')
      setOpenSections((s) => ({ ...s, basics: true }))
      return
    }
    if (displayDateLockError) {
      toast.error(displayDateLockError)
      setOpenSections((s) => ({ ...s, availability: true }))
      return
    }
    if (form.availability_mode === 'date_range') {
      const start = toDateInputValue(form.display_start_date)
      const end = toDateInputValue(form.display_end_date)
      if (!start || !end) {
        toast.error('Select both start date and end date for Date range availability')
        setOpenSections((s) => ({ ...s, availability: true }))
        return
      }
      if (end < start) {
        toast.error('Display end date must be on or after the start date')
        setOpenSections((s) => ({ ...s, availability: true }))
        return
      }
    }
    const body = assetPayload()
    if (assetId) {
      updateAsset.mutate({ id: assetId, body })
    } else {
      createAsset.mutate(body)
    }
  }

  const isEdit = !!assetId

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next && !saving) onClose() }}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle>{isEdit ? 'Edit Rental Asset' : 'Create Rental Asset'}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? 'Update capacity, pricing, and storefront availability for this asset.'
              : initialParentId
                ? 'Create a sub-asset. The parent is pre-filled — you can change it below.'
                : 'Add a new rack, unit, or item that customers can rent.'}
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-5 py-4">
          {loading ? (
            <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading asset…
            </p>
          ) : null}

          <CollapsibleSection
            title="Basics"
            icon={Tag}
            subtitle={form.name || undefined}
            open={openSections.basics}
            toggle={() => toggleSection('basics')}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <FieldLabel required>Asset Name</FieldLabel>
                <Input
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder={categoryConfig.labels.namePlaceholder}
                />
              </div>
              <div>
                <FieldLabel>Category</FieldLabel>
                <Select value={form.category} onChange={onCategoryChange} options={RENTAL_CATEGORIES} />
              </div>
              <div>
                <FieldLabel>Asset Type</FieldLabel>
                <Select value={form.asset_type} onChange={(v) => set('asset_type', v)} options={assetTypeOptions} />
              </div>
              <div className="sm:col-span-2">
                <FieldLabel>Description</FieldLabel>
                <Textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                  placeholder={categoryConfig.labels.descriptionPlaceholder}
                />
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            title="Pricing"
            icon={IndianRupee}
            subtitle={
              Number(form.price_per_unit) > 0
                ? `₹${form.daily_rate}/day · ₹${form.price_per_unit}/${form.pricing_uom.trim() || form.capacity_unit || 'unit'}`
                : Number(form.daily_rate) > 0
                  ? `₹${form.daily_rate}/day`
                  : undefined
            }
            open={openSections.pricing}
            toggle={() => toggleSection('pricing')}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <FieldLabel>Daily Rate (₹)</FieldLabel>
                <Input type="number" value={form.daily_rate} onChange={(e) => set('daily_rate', e.target.value)} />
              </div>
              <div>
                <FieldLabel>Weekly Rate (₹)</FieldLabel>
                <Input type="number" value={form.weekly_rate} onChange={(e) => set('weekly_rate', e.target.value)} />
              </div>
              <div>
                <FieldLabel>Monthly Rate (₹)</FieldLabel>
                <Input type="number" value={form.monthly_rate} onChange={(e) => set('monthly_rate', e.target.value)} />
              </div>
              <div>
                <FieldLabel>Security Deposit (₹)</FieldLabel>
                <Input type="number" value={form.deposit_amount} onChange={(e) => set('deposit_amount', e.target.value)} />
              </div>
              {categoryConfig.showExtraQtyCharge && (
                <div>
                  <FieldLabel>Extra Qty Charge</FieldLabel>
                  <Input type="number" value={form.extra_qty_charge} onChange={(e) => set('extra_qty_charge', e.target.value)} />
                </div>
              )}
              {categoryConfig.showExtraWeightCharge && (
                <div>
                  <FieldLabel>Extra Weight Charge</FieldLabel>
                  <Input type="number" value={form.extra_weight_charge} onChange={(e) => set('extra_weight_charge', e.target.value)} />
                </div>
              )}

              {/* ── Extended time-plan rates ── */}
              <div className="col-span-2 border-t border-border/60 pt-1">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
                  More time plans (optional)
                </p>
              </div>

              <div>
                <FieldLabel>Hourly Rate (₹)</FieldLabel>
                <Input
                  type="number" min={0} step="0.01" placeholder="0"
                  value={form.hourly_rate}
                  onChange={(e) => set('hourly_rate', e.target.value)}
                />
              </div>
              <div>
                <FieldLabel>Per-Minute Rate (₹)</FieldLabel>
                <Input
                  type="number" min={0} step="0.01" placeholder="0"
                  value={form.per_minute_rate}
                  onChange={(e) => set('per_minute_rate', e.target.value)}
                />
              </div>
              <div>
                <FieldLabel>Yearly Rate (₹)</FieldLabel>
                <Input
                  type="number" min={0} step="0.01" placeholder="0"
                  value={form.yearly_rate}
                  onChange={(e) => set('yearly_rate', e.target.value)}
                />
              </div>

              {/* ── Per-unit pricing ── */}
              <div className="col-span-2 border-t border-border/60 pt-1">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
                  Per-unit pricing
                </p>
              </div>

              <div>
                <FieldLabel>
                  Price per {form.pricing_uom.trim() || form.capacity_unit || 'unit'} (₹)
                </FieldLabel>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0"
                  value={form.price_per_unit}
                  onChange={(e) => set('price_per_unit', e.target.value)}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Charged per {form.pricing_uom.trim() || form.capacity_unit || 'unit'} per day. Leave 0 to use only the flat daily rate.
                </p>
              </div>

              <div>
                <FieldLabel>Pricing UOM</FieldLabel>
                <Input
                  placeholder={form.capacity_unit || 'e.g. packet, kg, unit'}
                  value={form.pricing_uom}
                  onChange={(e) => set('pricing_uom', e.target.value)}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Unit label for per-unit price. Leave blank to use the asset's capacity unit ({form.capacity_unit || '—'}).
                </p>
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            title="Storefront Availability"
            icon={CalendarRange}
            subtitle={form.availability_mode === 'always' ? 'Always available' : 'Date range'}
            open={openSections.availability}
            toggle={() => toggleSection('availability')}
          >
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Choose how this asset appears on the storefront. Use Date range and save — those dates are what customers see.
              </p>
              <div>
                <FieldLabel>Availability</FieldLabel>
                <Select value={form.availability_mode} onChange={onAvailabilityModeChange} options={AVAILABILITY_OPTIONS} />
              </div>

              {form.availability_mode === 'always' && (
                <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
                  Always available — customers can see this asset every day.
                </p>
              )}

              {form.availability_mode === 'date_range' && (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <FieldLabel required>Start date</FieldLabel>
                      <Input
                        type="date"
                        value={form.display_start_date}
                        onChange={(e) => set('display_start_date', e.target.value)}
                      />
                    </div>
                    <div>
                      <FieldLabel required>End date</FieldLabel>
                      <Input
                        type="date"
                        value={form.display_end_date}
                        min={form.display_start_date || undefined}
                        onChange={(e) => set('display_end_date', e.target.value)}
                      />
                    </div>
                  </div>
                  {(form.display_start_date || form.display_end_date) && (
                    <p className="text-xs text-emerald-700 dark:text-emerald-300">
                      Available {form.display_start_date || '…'} → {form.display_end_date || '…'}
                    </p>
                  )}
                </>
              )}

              {lockedBookings.length > 0 && form.availability_mode === 'date_range' && (
                <div className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
                  <p className="flex items-center gap-1.5 font-medium">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    Locked by {lockedBookings.length} approved booking{lockedBookings.length > 1 ? 's' : ''} — period must cover:
                  </p>
                  <ul className="list-disc space-y-0.5 pl-4">
                    {lockedBookings.map((b) => (
                      <li key={b.id}>
                        {b.booking_number || b.id.slice(0, 8)} · {formatDate(b.start_date)} → {formatDate(b.end_date)} ({b.status.replace(/_/g, ' ')})
                      </li>
                    ))}
                  </ul>
                  {displayDateLockError && <p className="pt-1 font-medium text-rose-700 dark:text-rose-400">{displayDateLockError}</p>}
                </div>
              )}
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            title="Location, Status & Notes"
            icon={MapPin}
            subtitle={form.location || undefined}
            open={openSections.location}
            toggle={() => toggleSection('location')}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <FieldLabel>Sales Area / Route</FieldLabel>
                <Select
                  value={form.sales_area_id || '__none__'}
                  onChange={(v) => set('sales_area_id', v === '__none__' ? '' : v)}
                  options={[{ value: '__none__', label: 'No sales area' }, ...salesAreaOptions]}
                />
              </div>
              <div>
                <FieldLabel>{categoryConfig.labels.location}</FieldLabel>
                <Input
                  value={form.location}
                  onChange={(e) => set('location', e.target.value)}
                  placeholder={categoryConfig.labels.locationPlaceholder}
                />
              </div>
              {categoryConfig.showRackLocation && (
                <>
                  <div>
                    <FieldLabel>Section</FieldLabel>
                    <Input value={form.section} onChange={(e) => set('section', e.target.value)} placeholder="Cold Storage – A" />
                  </div>
                  <div>
                    <FieldLabel>Row</FieldLabel>
                    <Input value={form.row_label} onChange={(e) => set('row_label', e.target.value)} placeholder="Row 01" />
                  </div>
                  <div>
                    <FieldLabel>Rack Number</FieldLabel>
                    <Input value={form.rack_number} onChange={(e) => set('rack_number', e.target.value)} placeholder="A-001" />
                  </div>
                </>
              )}
              <div>
                <FieldLabel>Status</FieldLabel>
                <Select value={form.status} onChange={(v) => set('status', v)} options={ASSET_STATUSES} />
              </div>
              <div className="sm:col-span-2">
                <FieldLabel>Internal Notes</FieldLabel>
                <Textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => set('notes', e.target.value)}
                  placeholder="Notes visible only to your team…"
                />
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            title="Sub-assets & Unit Tracking"
            icon={Layers}
            subtitle={form.unit_mode === 'none' ? 'Off' : form.unit_mode === 'hierarchy' ? 'Hierarchy' : 'Serialized units'}
            open={openSections.subAssets}
            toggle={() => toggleSection('subAssets')}
          >
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Choose how individual items within this asset are tracked. This can be changed later.
              </p>
              <div>
                <FieldLabel>Tracking mode</FieldLabel>
                <Select
                  value={form.unit_mode}
                  onChange={(v) => setForm((f) => ({ ...f, unit_mode: v }))}
                  options={[
                    { value: 'none', label: 'None — track only total capacity' },
                    { value: 'hierarchy', label: 'Hierarchy — child assets (e.g. van fleet → individual vans)' },
                    { value: 'serialized', label: 'Serialized units — individual serial numbers (e.g. cylinders, racks)' },
                  ]}
                />
              </div>

              {/* Is this a bookable asset or just a container? */}
              {form.unit_mode !== 'none' && (
                <div className="flex items-center gap-3 rounded-lg border px-3 py-2">
                  <input
                    id="is_bookable"
                    type="checkbox"
                    checked={form.is_bookable}
                    onChange={(e) => setForm((f) => ({ ...f, is_bookable: e.target.checked }))}
                    className="h-4 w-4 rounded border-border"
                  />
                  <label htmlFor="is_bookable" className="cursor-pointer text-sm">
                    This asset is directly bookable (uncheck for container-only assets like a fleet group)
                  </label>
                </div>
              )}

              {/* Hierarchy: parent picker */}
              {form.unit_mode === 'hierarchy' && (
                <div>
                  <FieldLabel>Parent asset</FieldLabel>
                  <Select
                    value={form.parent_asset_id || ''}
                    onChange={(v) => setForm((f) => ({ ...f, parent_asset_id: v }))}
                    options={parentOptions}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Assign this asset as a child of another (e.g. "Van 03" inside "City Fleet").
                  </p>
                </div>
              )}

              {/* Hierarchy: list of current children + add button (edit mode only) */}
              {form.unit_mode === 'hierarchy' && assetId && (
                <div className="space-y-2">
                  <FieldLabel>
                    Sub-assets{childAssets.length > 0 ? ` (${childAssets.length})` : ''}
                  </FieldLabel>

                  {childAssets.length > 0 ? (
                    <div className="divide-y divide-border rounded-lg border">
                      {childAssets.map((c) => (
                        <div key={c.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                          <span className="flex-1 truncate font-medium">{c.name}</span>
                          {c.asset_code && (
                            <span className="text-xs text-muted-foreground">{c.asset_code}</span>
                          )}
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] capitalize">
                            {c.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No sub-assets yet.</p>
                  )}

                  {onRequestAddChild && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => onRequestAddChild(assetId)}
                    >
                      <Plus className="mr-1.5 h-4 w-4" /> Add Sub-asset
                    </Button>
                  )}
                </div>
              )}

              {/* Serialized: unit management panel — only once the backend has the mode saved */}
              {form.unit_mode === 'serialized' && (
                savedUnitMode === 'serialized' && assetId ? (
                  <RentalAssetUnitsPanel assetId={assetId} />
                ) : (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                    {assetId
                      ? 'Click "Update Asset" to save this tracking mode, then you can add serialized units here.'
                      : 'Save the asset first, then come back here to add serialized units.'}
                  </p>
                )
              )}
            </div>
          </CollapsibleSection>
        </div>

        <SheetFooter className="border-t border-border px-5 py-3">
          <Button variant="outline" disabled={saving} onClick={onClose}>Cancel</Button>
          <Button disabled={!form.name.trim() || saving || !!displayDateLockError} onClick={save}>
            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            {isEdit ? 'Update Asset' : 'Save Asset'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
