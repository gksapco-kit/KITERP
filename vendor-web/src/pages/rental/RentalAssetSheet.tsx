import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CalendarRange, Image, IndianRupee, Layers, Link2, Loader2, MapPin, Plus, Tag, X } from 'lucide-react'
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
import { CatalogMediaUpload } from '@/components/common/ImageUpload'
import { extractApiError } from '@/lib/errorMessages'
import { formatDate } from '@/lib/utils'
import { filterCategoryTree } from '@/lib/categoryHierarchy'
import { useCategoryTree } from '@/hooks/useVendor'
import { useVendorStore } from '@/stores/vendorStore'
import { rentalApi } from './api'
import { toDateInputValue, pickDisplayDates } from './rentalDates'
import {
  ASSET_STATUSES, AVAILABILITY_OPTIONS, UOM_SUGGESTIONS,
  ASSET_KIND_SUGGESTIONS, ASSET_TYPE_SUGGESTIONS, toReadableValue, emptyAssetForm, getCategoryConfig,
  catalogStatusFromAsset, operationalStatusFromAsset,
  isPendingRentalMediaId, makePendingRentalMedia, revokeRentalMediaUrls, currencySymbol,
  DEFAULT_ASSET_CODE_PREFIX, previewAssetCode,
  type RentalAsset, type RentalBooking, type RentalMediaItem,
} from './rentalConstants'
import RentalAssetUnitsPanel from './RentalAssetUnitsPanel'
import RentalAssetPricingFields from './RentalAssetPricingFields'
import { RentalSuggestionCombobox } from './RentalSuggestionCombobox'
import type { VendorCategory } from '@/types'
import { flattenCategoryTree } from '@/lib/categoryHierarchy'

/**
 * A thin wrapper that maps category_id ↔ the tree for rental assets.
 * CategoryHierarchyPicker works by name/subcategory strings, but for rentals
 * we store the category UUID directly. This component bridges that.
 */
function RentalCategoryPicker({
  tree, categoryId, onChange,
}: {
  tree: VendorCategory[]
  categoryId: string
  onChange: (id: string) => void
}) {
  const flatOptions = useMemo(() => flattenCategoryTree(tree), [tree])
  const options = useMemo(() => [
    { value: '', label: 'Select category (optional)…' },
    ...flatOptions.map((o) => ({ value: o.id, label: o.label.replace(/^\s+/, '').replace(/\s{2,}/g, ' · ') })),
  ], [flatOptions])

  return (
    <select
      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
      value={categoryId}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

type AssetFormState = ReturnType<typeof emptyAssetForm>

function assetToForm(a: Partial<RentalAsset> & Record<string, unknown>): AssetFormState {
  const { start, end } = pickDisplayDates(a)
  const hasRange = Boolean(start || end)
  return {
    name: String(a.name || ''),
    category: toReadableValue(String(a.category || 'Other'), ASSET_KIND_SUGGESTIONS),
    category_id: String(a.category_id || ''),
    asset_type: toReadableValue(String(a.asset_type || 'Other'), ASSET_TYPE_SUGGESTIONS),
    short_description: String(a.short_description || ''),
    description: String(a.description || ''),
    asset_code: String(a.asset_code || ''),
    product_id: String(a.product_id || ''),
    capacity_max: String(a.capacity_max ?? 1),
    capacity_unit: toReadableValue(String(a.capacity_unit || 'Units'), UOM_SUGGESTIONS),
    max_weight: a.max_weight != null ? String(a.max_weight) : '',
    weight_unit: String(a.weight_unit || 'kg'),
    currency: String(a.currency || 'INR').toUpperCase(),
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
    status: catalogStatusFromAsset(a),
    operational_status: operationalStatusFromAsset(a),
    is_visible: a.is_visible !== false,
    store_scope: String(a.store_scope || 'all'),
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
  const [manualMasterId, setManualMasterId] = useState(false)
  const [openSections, setOpenSections] = useState({
    basics: true, pricing: false, availability: false, location: false, subAssets: false,
  })
  // Tracks the unit_mode value that is actually saved on the server.
  // The units panel is only rendered when this matches 'serialized' so users
  // cannot attempt to add units before the mode change has been persisted.
  const [savedUnitMode, setSavedUnitMode] = useState<string>('none')

  // ── Media state ──────────────────────────────────────────────────────────
  // savedMedia: gallery for an existing asset, or locally staged items for create
  const [savedMedia, setSavedMedia] = useState<RentalMediaItem[]>([])
  const pendingFilesRef = useRef<Map<string, File>>(new Map())
  const savedMediaRef = useRef(savedMedia)
  savedMediaRef.current = savedMedia

  // ── Feature flags from vendor settings ───────────────────────────────────
  const { vendor } = useVendorStore()
  const rentalSettings = (vendor?.settings as Record<string, unknown> | undefined)?.rental_settings as Record<string, unknown> | undefined
  const featureCategories = rentalSettings?.feature_categories !== false
  const featureMediaGallery = rentalSettings?.feature_media_gallery !== false
  const featureCapacityTracking = rentalSettings?.feature_capacity_tracking !== false
  const featureUnitTracking = rentalSettings?.feature_unit_tracking !== false
  const featureExtendedRates = rentalSettings?.feature_extended_rates !== false
  const featurePerUnitPricing = rentalSettings?.feature_per_unit_pricing !== false
  const assetCodePrefix = String(rentalSettings?.asset_code_prefix || DEFAULT_ASSET_CODE_PREFIX)

  // ── Category tree ─────────────────────────────────────────────────────────
  const { data: categoryTreeData } = useCategoryTree()
  const rentalCategoryTree = useMemo(() => {
    const raw = (categoryTreeData as { categories?: unknown[] } | undefined)?.categories ?? []
    return filterCategoryTree(raw as Parameters<typeof filterCategoryTree>[0], 'rental')
  }, [categoryTreeData])

  useEffect(() => {
    if (!open) return
    if (!assetId) {
      const base = emptyAssetForm()
      setForm(
        initialParentId
          ? { ...base, parent_asset_id: initialParentId, unit_mode: 'hierarchy' }
          : base,
      )
      setManualMasterId(false)
      setSavedUnitMode('none')
      revokeRentalMediaUrls(savedMediaRef.current)
      pendingFilesRef.current.clear()
      setSavedMedia([])
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
      setSavedMedia((initialAsset.media ?? []) as RentalMediaItem[])
    }
    setLoading(true)
    rentalApi.getAsset(assetId)
      .then((fresh) => {
        setForm(assetToForm(fresh as RentalAsset & Record<string, unknown>))
        setSavedUnitMode(fresh.unit_mode ?? 'none')
        setSavedMedia((fresh.media ?? []) as RentalMediaItem[])
      })
      .catch((e) => toast.error(extractApiError(e, 'Load asset for edit')))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, assetId])

  const set = (key: keyof AssetFormState, value: string) => setForm((f) => ({ ...f, [key]: value }))
  const toggleSection = (key: keyof typeof openSections) =>
    setOpenSections((s) => ({ ...s, [key]: !s[key] }))

  // Product search state for the "Link to Product" picker
  const [productSearch, setProductSearch] = useState('')
  const [productPickerOpen, setProductPickerOpen] = useState(false)
  const productPickerRef = useRef<HTMLDivElement>(null)

  const { data: productOptions = [] } = useQuery({
    queryKey: ['rental-products-for-link', productSearch],
    queryFn: () => rentalApi.listProductsForRental(productSearch || undefined),
    enabled: open && productPickerOpen,
    staleTime: 30_000,
  })

  // Close product picker when clicking outside
  useEffect(() => {
    if (!productPickerOpen) return
    const handler = (e: MouseEvent) => {
      if (productPickerRef.current && !productPickerRef.current.contains(e.target as Node)) {
        setProductPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [productPickerOpen])

  // Parent asset options for hierarchy mode (all assets of this vendor, minus self)
  const { data: allAssets = [] } = useQuery<RentalAsset[]>({
    queryKey: ['rental-assets'],
    queryFn: () => rentalApi.listAssets(),
    enabled: open,
    staleTime: 30_000,
  })
  const nextAssetCodePreview = previewAssetCode(allAssets.length + 1, assetCodePrefix)
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

  // ── Media callbacks (persist when editing; stage locally when creating) ──
  const handleUploadMedia = useCallback(async (file: File) => {
    if (assetId) {
      try {
        const res = await rentalApi.uploadAssetMedia(assetId, file)
        setSavedMedia(res.media)
      } catch (e) {
        toast.error(extractApiError(e, 'Upload media'))
      }
      return
    }
    setSavedMedia((prev) => {
      const item = makePendingRentalMedia(
        file,
        prev.length,
        !prev.some((m) => m.is_primary),
      )
      if (item.media_type !== 'image') item.is_primary = false
      pendingFilesRef.current.set(item.id, file)
      return [...prev, item]
    })
  }, [assetId])

  const handleDeleteMedia = useCallback(async (mediaId: string) => {
    if (assetId && !isPendingRentalMediaId(mediaId)) {
      try {
        const res = await rentalApi.deleteAssetMedia(assetId, mediaId)
        setSavedMedia(res.media)
      } catch (e) {
        toast.error(extractApiError(e, 'Delete media'))
      }
      return
    }
    setSavedMedia((prev) => {
      const target = prev.find((m) => m.id === mediaId)
      if (target) revokeRentalMediaUrls([target])
      pendingFilesRef.current.delete(mediaId)
      const next = prev.filter((m) => m.id !== mediaId).map((m, i) => ({ ...m, position: i }))
      if (target?.is_primary) {
        const firstImage = next.find((m) => m.media_type === 'image')
        if (firstImage) {
          return next.map((m) => ({ ...m, is_primary: m.id === firstImage.id }))
        }
      }
      return next
    })
  }, [assetId])

  const handleSetPrimaryMedia = useCallback(async (mediaId: string) => {
    if (assetId && !isPendingRentalMediaId(mediaId)) {
      try {
        const res = await rentalApi.setAssetMediaPrimary(assetId, mediaId)
        setSavedMedia(res.media)
      } catch (e) {
        toast.error(extractApiError(e, 'Set primary media'))
      }
      return
    }
    setSavedMedia((prev) => prev.map((m) => ({ ...m, is_primary: m.id === mediaId })))
  }, [assetId])

  const handleReorderMedia = useCallback(async (mediaIds: string[]) => {
    if (assetId && mediaIds.every((id) => !isPendingRentalMediaId(id))) {
      try {
        const res = await rentalApi.reorderAssetMedia(assetId, mediaIds)
        setSavedMedia(res.media)
      } catch (e) {
        toast.error(extractApiError(e, 'Reorder media'))
      }
      return
    }
    setSavedMedia((prev) => {
      const byId = new Map(prev.map((m) => [m.id, m]))
      return mediaIds
        .map((id, position) => {
          const item = byId.get(id)
          return item ? { ...item, position } : null
        })
        .filter((m): m is RentalMediaItem => Boolean(m))
    })
  }, [assetId])

  const flushPendingMedia = useCallback(async (newAssetId: string) => {
    const pending = pendingFilesRef.current
    if (pending.size === 0) return
    const ordered = [...savedMediaRef.current]
      .sort((a, b) => a.position - b.position)
      .filter((m) => isPendingRentalMediaId(m.id) && pending.has(m.id))
    const primaryPendingId = ordered.find((m) => m.is_primary)?.id
    for (const item of ordered) {
      const file = pending.get(item.id)
      if (!file) continue
      try {
        const res = await rentalApi.uploadAssetMedia(newAssetId, file)
        if (item.id === primaryPendingId && res.item?.id && !res.item.is_primary) {
          await rentalApi.setAssetMediaPrimary(newAssetId, res.item.id)
        }
      } catch (e) {
        toast.error(extractApiError(e, 'Upload media'))
      }
    }
    revokeRentalMediaUrls(ordered)
    pending.clear()
  }, [])

  const assetPayload = () => {
    const cfg = getCategoryConfig(form.category)
    const useRange = form.availability_mode === 'date_range'
    const start = useRange ? toDateInputValue(form.display_start_date) : ''
    const end = useRange ? toDateInputValue(form.display_end_date) : ''
    return {
      name: form.name,
      asset_code: (assetId || manualMasterId) ? ((form.asset_code || '').trim() || undefined) : undefined,
      category: form.category,
      category_id: form.category_id || null,
      asset_type: form.asset_type,
      short_description: (form.short_description || '').trim() || undefined,
      description: form.description || undefined,
      product_id: form.product_id || null,
      capacity_max: Number(form.capacity_max) || 1,
      capacity_unit: form.capacity_unit,
      max_weight: cfg.showWeight && form.max_weight ? Number(form.max_weight) : null,
      weight_unit: form.weight_unit,
      currency: (form.currency || 'INR').toUpperCase(),
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
      status: form.operational_status || 'available',
      is_visible: form.is_visible,
      store_scope: form.store_scope || 'all',
      display_start_date: useRange ? (start || null) : null,
      display_end_date: useRange ? (end || null) : null,
      notes: form.notes || undefined,
      unit_mode: form.unit_mode || 'none',
      parent_asset_id: form.parent_asset_id || null,
      is_bookable: form.is_bookable,
      price_per_unit: Number(form.price_per_unit) || 0,
      pricing_uom: (form.pricing_uom || '').trim() || null,
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
    onSuccess: async (data: RentalAsset) => {
      setSavedUnitMode(data.unit_mode ?? 'none')
      await flushPendingMedia(data.id)
      setSavedMedia([])
      invalidate()
      toast.success('Rental asset created')
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
    try {
      const body = assetPayload()
      if (assetId) {
        updateAsset.mutate({ id: assetId, body })
      } else {
        createAsset.mutate(body)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not prepare asset for save')
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
              <div>
                <FieldLabel required>Asset Name</FieldLabel>
                <Input
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder={categoryConfig.labels.namePlaceholder}
                />
              </div>
              <div>
                <FieldLabel>Master ID</FieldLabel>
                {assetId ? (
                  <>
                    <Input
                      value={form.asset_code}
                      readOnly
                      title="Assigned master ID"
                      className="cursor-default bg-muted/40 font-mono tracking-wide"
                    />
                    <p className="mt-0.5 text-[11px] text-muted-foreground">Asset master ID</p>
                  </>
                ) : manualMasterId ? (
                  <>
                    <Input
                      value={form.asset_code}
                      onChange={(e) => set('asset_code', e.target.value.toUpperCase())}
                      placeholder={`e.g. ${nextAssetCodePreview}`}
                      className="font-mono tracking-wide"
                      autoFocus
                    />
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Manual ID ·{' '}
                      <button
                        type="button"
                        className="font-medium text-primary hover:underline"
                        onClick={() => {
                          setManualMasterId(false)
                          set('asset_code', '')
                        }}
                      >
                        Use auto instead
                      </button>
                    </p>
                  </>
                ) : (
                  <>
                    <Input
                      value=""
                      readOnly
                      title="Unique master ID, assigned automatically on save"
                      placeholder={`Auto · ${nextAssetCodePreview}`}
                      className="cursor-default bg-muted/40 font-mono tracking-wide text-muted-foreground"
                    />
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Auto-created on save ·{' '}
                      <button
                        type="button"
                        className="font-medium text-primary hover:underline"
                        onClick={() => setManualMasterId(true)}
                      >
                        Enter manually
                      </button>
                    </p>
                  </>
                )}
              </div>

              {/* ── Category (merchandising tree) ── */}
              {featureCategories && rentalCategoryTree.length > 0 && (
                <div className="sm:col-span-2">
                  <FieldLabel>Category</FieldLabel>
                  <RentalCategoryPicker
                    tree={rentalCategoryTree}
                    categoryId={form.category_id}
                    onChange={(id) => set('category_id', id)}
                  />
                  {form.category_id && (
                    <button
                      type="button"
                      className="mt-1 text-xs text-muted-foreground hover:text-destructive"
                      onClick={() => set('category_id', '')}
                    >
                      ✕ Clear category
                    </button>
                  )}
                </div>
              )}

              {/* Type — pick a suggestion or type a custom value */}
              <div className="sm:col-span-2">
                <FieldLabel>Type</FieldLabel>
                <RentalSuggestionCombobox
                  value={form.asset_type}
                  onChange={(v) => set('asset_type', v)}
                  suggestions={ASSET_TYPE_SUGGESTIONS}
                  placeholder="Type or select… e.g. Chair, Generator"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Choose from the list or type your own type name.
                </p>
              </div>
              <div>
                <FieldLabel>Short Description</FieldLabel>
                <Textarea
                  rows={2}
                  maxLength={500}
                  value={form.short_description}
                  onChange={(e) => set('short_description', e.target.value)}
                  placeholder="Brief summary for listings (max 500 chars)"
                />
              </div>
              <div>
                <FieldLabel>Description</FieldLabel>
                <Textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                  placeholder={categoryConfig.labels.descriptionPlaceholder}
                />
              </div>

              {/* ── Link to existing product ── */}
              <div className="sm:col-span-2">
                <FieldLabel>
                  <span className="flex items-center gap-1">
                    <Link2 className="h-3.5 w-3.5" />
                    Link to Product <span className="ml-1 text-xs font-normal text-muted-foreground">(optional)</span>
                  </span>
                </FieldLabel>

                {form.product_id ? (
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
                    <Link2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    <span className="flex-1 truncate font-medium">
                      {productOptions.find((p) => p.id === form.product_id)?.name
                        || `Product linked (ID: ${form.product_id.slice(0, 8)}…)`}
                    </span>
                    <button
                      type="button"
                      onClick={() => set('product_id', '')}
                      className="ml-auto text-muted-foreground hover:text-destructive"
                      title="Unlink product"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div ref={productPickerRef} className="relative">
                    <Input
                      placeholder="Search products to link…"
                      value={productSearch}
                      onFocus={() => setProductPickerOpen(true)}
                      onChange={(e) => {
                        setProductSearch(e.target.value)
                        setProductPickerOpen(true)
                      }}
                    />
                    {productPickerOpen && (
                      <div className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
                        {productOptions.length === 0 ? (
                          <p className="px-3 py-2 text-xs text-muted-foreground">No products found</p>
                        ) : (
                          productOptions.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                              onClick={() => {
                                set('product_id', p.id)
                                setProductPickerOpen(false)
                                setProductSearch('')
                              }}
                            >
                              <span className="flex-1 truncate font-medium">{p.name}</span>
                              {p.sku && <span className="text-xs text-muted-foreground">{p.sku}</span>}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  Associate this rental asset with a product in your catalog. This converts/links the product as a rentable item.
                </p>
              </div>

              {/* ── Media gallery ── */}
              {featureMediaGallery && <div className="sm:col-span-2">
                <FieldLabel>
                  <span className="flex items-center gap-1">
                    <Image className="h-3.5 w-3.5" /> Photos &amp; Media
                  </span>
                </FieldLabel>
                <CatalogMediaUpload
                  media={savedMedia}
                  pickerTitle="Rental asset media"
                  onUpload={handleUploadMedia}
                  onDelete={handleDeleteMedia}
                  onSetPrimary={handleSetPrimaryMedia}
                  onReorder={handleReorderMedia}
                />
                {!assetId && savedMedia.length > 0 && (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Photos are kept until you save the asset, then uploaded automatically.
                  </p>
                )}
              </div>}

            </div>
          </CollapsibleSection>

          <CollapsibleSection
            title="Pricing"
            icon={IndianRupee}
            subtitle={
              Number(form.price_per_unit) > 0
                ? `${currencySymbol(form.currency)}${form.daily_rate}/day · ${currencySymbol(form.currency)}${form.price_per_unit}/${(form.pricing_uom || '').trim() || form.capacity_unit || 'unit'}`
                : Number(form.daily_rate) > 0
                  ? `${currencySymbol(form.currency)}${form.daily_rate}/day`
                  : undefined
            }
            open={openSections.pricing}
            toggle={() => toggleSection('pricing')}
          >
            <RentalAssetPricingFields
              form={form}
              set={set}
              compact
              syncKey={assetId || 'new'}
              featureCapacityTracking={featureCapacityTracking}
              featureExtendedRates={featureExtendedRates}
              featurePerUnitPricing={featurePerUnitPricing}
            />
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
                <Select
                  value={form.operational_status}
                  onChange={(v) => setForm((f) => ({ ...f, operational_status: v }))}
                  options={ASSET_STATUSES}
                />
              </div>

              {/* ── Storefront visibility ── */}
              <div className="sm:col-span-2">
                <div className="flex items-center gap-3 rounded-lg border px-3 py-2">
                  <input
                    id="is_visible"
                    type="checkbox"
                    checked={form.is_visible}
                    onChange={(e) => setForm((f) => ({ ...f, is_visible: e.target.checked }))}
                    className="h-4 w-4 rounded border-border"
                  />
                  <label htmlFor="is_visible" className="cursor-pointer text-sm">
                    Visible on storefront
                  </label>
                </div>
              </div>

              <div>
                <FieldLabel>Store Scope</FieldLabel>
                <Select
                  value={form.store_scope}
                  onChange={(v) => set('store_scope', v)}
                  options={[
                    { value: 'all', label: 'All business units' },
                    { value: 'selected', label: 'Selected units only' },
                  ]}
                />
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

          {featureUnitTracking && <CollapsibleSection
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

              {form.unit_mode !== 'none' && (
                <label className="flex cursor-pointer items-start gap-2.5 text-sm select-none">
                  <input
                    id="is_bookable"
                    type="checkbox"
                    checked={form.is_bookable}
                    onChange={(e) => setForm((f) => ({ ...f, is_bookable: e.target.checked }))}
                    className="mt-0.5 h-4 w-4 rounded border-border"
                  />
                  <span>
                    <span className="font-medium">Directly bookable</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      Uncheck for container-only assets (e.g. a fleet group that is not rented as a whole).
                    </span>
                  </span>
                </label>
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
          </CollapsibleSection>}
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
