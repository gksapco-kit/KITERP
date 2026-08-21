import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle, Archive, ArrowLeft, CalendarRange, Clock, Copy, Eye, Image, IndianRupee,
  Layers, Link2, Loader2, MapPin, Package, Pencil, Plus, Star, Tag, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { FieldLabel } from '@/components/common/FieldLabel'
import { CatalogMediaUpload } from '@/components/common/ImageUpload'
import { extractApiError } from '@/lib/errorMessages'
import { formatCurrency, formatDate, formatDateTime, cn, mediaUrl } from '@/lib/utils'
import { filterCategoryTree, flattenCategoryTree } from '@/lib/categoryHierarchy'
import { useCategoryTree, useSalesAreas, useStores } from '@/hooks/useVendor'
import { useVendorStore } from '@/stores/vendorStore'
import { BusinessUnitScopePicker, type StoreScope } from '@/components/common/BusinessUnitScopePicker'
import { rentalApi } from './api'
import { toDateInputValue, pickDisplayDates } from './rentalDates'
import {
  AVAILABILITY_OPTIONS, UOM_SUGGESTIONS, ASSET_CATALOG_STATUSES,
  ASSET_KIND_SUGGESTIONS, ASSET_TYPE_SUGGESTIONS, toReadableValue, emptyAssetForm, getCategoryConfig,
  catalogStatusFromAsset, operationalStatusFromAsset, resolveAssetStatusForSave,
  isPendingRentalMediaId, makePendingRentalMedia, revokeRentalMediaUrls,
  DEFAULT_ASSET_CODE_PREFIX, previewAssetCode, currencySymbol,
  type RentalAsset, type RentalBooking, type RentalMediaItem,
} from './rentalConstants'
import { durationRowsFromAsset, durationRatesForSave, durationLegacyRates, formatDurationLabel } from './durationRates'
import { periodRowsFromAsset, periodRatesForSave, periodLegacyRates, formatPeriodLabel } from './periodRates'
import { additionalChargeRowsFromAsset, additionalChargesForSave, formatAdditionalChargeValue } from './additionalCharges'
import RentalAssetUnitsPanel from './RentalAssetUnitsPanel'
import RentalAssetPricingFields from './RentalAssetPricingFields'
import { RentalSuggestionCombobox } from './RentalSuggestionCombobox'
import { CapacityBar, StatusBadge } from './RentalPrimitives'
import type { VendorCategory } from '@/types'
import type { FormSectionDef } from '@/components/common/FormSectionNav'
import {
  FormPageWithNav,
  FormSectionTabs,
  formDisplayCompact,
  formEditLayout,
  formSectionSurfaceClass,
  useFormActiveSection,
} from '@/components/common/FormSectionNav'
import { CatalogEditStickyBar } from '@/components/common/CatalogEditStickyBar'

function DisplayField({ label, value }: { label: string; value?: React.ReactNode }) {
  if (value == null || value === '') {
    return (
      <div className="min-w-0 space-y-0">
        <p className="text-[0.62rem] font-medium uppercase leading-none tracking-wide text-muted-foreground/70">{label}</p>
        <p className="text-xs leading-snug text-muted-foreground/50 sm:text-sm">—</p>
      </div>
    )
  }
  return (
    <div className="min-w-0 space-y-0">
      <p className="text-[0.62rem] font-medium uppercase leading-none tracking-wide text-muted-foreground/70">{label}</p>
      <div className="text-xs leading-snug text-foreground sm:text-sm">{value}</div>
    </div>
  )
}

// ── Local helpers ──────────────────────────────────────────────────────────────

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
      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
      value={categoryId}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          checked ? 'bg-primary' : 'bg-muted-foreground/30',
        )}
      >
        <span
          className={cn(
            'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
            checked ? 'translate-x-4' : 'translate-x-0',
          )}
        />
      </button>
      <span className="font-medium text-foreground">{label}</span>
    </label>
  )
}

/** Card wrapper matching service/product section cards — hidden when not the active tab. */
function Section({
  sectionKey, active, title, icon: Icon, children, dense,
}: {
  sectionKey: string
  active: boolean
  title: string
  icon: React.ElementType
  children: React.ReactNode
  dense?: boolean
}) {
  const activeFormSection = useFormActiveSection()
  const scrollActive = !!sectionKey && activeFormSection === sectionKey
  if (!active) return null
  return (
    <Card
      id={`form-section-${sectionKey}`}
      className={cn('overflow-hidden shadow-sm', formDisplayCompact.scrollMarginEdit, formSectionSurfaceClass(scrollActive))}
    >
      <CardContent className={cn('bg-muted/20 dark:bg-black/20', dense ? 'p-2 sm:p-2.5' : 'p-4')}>
        <div className={cn('flex items-center gap-1.5 border-b border-border/60', dense ? 'mb-1.5 pb-1' : 'mb-3 pb-2')}>
          <Icon className="h-4 w-4 shrink-0 text-primary" strokeWidth={2} aria-hidden />
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        </div>
        {children}
      </CardContent>
    </Card>
  )
}

/** True when old/new are the same value (incl. numeric 36 vs 36.0) or a noop store_ids placeholder. */
function historyValuesEqual(oldVal: unknown, newVal: unknown): boolean {
  const a = String(oldVal ?? '')
  const b = String(newVal ?? '')
  if (a === b) return true
  if (a === '(previous)' && (b === 'updated' || b === '(unchanged)')) return true
  const na = Number(a)
  const nb = Number(b)
  return a !== '' && b !== '' && Number.isFinite(na) && Number.isFinite(nb) && na === nb
}

function AssetChangeHistoryPanel({
  asset,
}: {
  asset: Pick<RentalAsset, 'change_history' | 'version_number' | 'created_at' | 'updated_at' | 'deleted_at'> | null
}) {
  const history = asset?.change_history || []
  const version = asset?.version_number ?? 1
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {history.length} {history.length === 1 ? 'entry' : 'entries'} · v{version}
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <DisplayField
          label="Created"
          value={asset?.created_at ? formatDateTime(asset.created_at) : undefined}
        />
        <DisplayField
          label="Last updated"
          value={asset?.updated_at ? formatDateTime(asset.updated_at) : undefined}
        />
        <DisplayField
          label="Version"
          value={`v${version}`}
        />
      </div>
      {history.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
          No edits recorded yet. Changes appear here after you save this asset.
        </p>
      ) : (
        <div className="max-h-96 space-y-2 overflow-y-auto">
          {[...history].reverse().map((h, i) => {
            const changes = h.changes || {}
            const actionNew = changes._action?.new
            const changedFields = Object.keys(changes).filter((k) => {
              if (k === '_action') return false
              return !historyValuesEqual(changes[k]?.old, changes[k]?.new)
            })
            return (
              <div key={`${h.version}-${h.changed_at}-${i}`} className="rounded-lg border border-border bg-background/70 p-2.5 text-xs">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-foreground">v{h.version ?? '?'}</span>
                  <span className="text-muted-foreground">
                    {h.changed_at
                      ? new Date(h.changed_at).toLocaleString('en-IN', {
                          day: 'numeric', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })
                      : '—'}
                  </span>
                  {h.changed_by_name ? (
                    <span className="text-muted-foreground">by {h.changed_by_name}</span>
                  ) : null}
                </div>
                {actionNew ? (
                  <span className="font-medium text-emerald-700 dark:text-emerald-400">{String(actionNew)}</span>
                ) : null}
                {changedFields.length > 0 ? (
                  <div className="mt-1 space-y-1">
                    {changedFields.slice(0, 8).map((field) => (
                      <div key={field} className="flex flex-wrap gap-1.5 text-muted-foreground">
                        <span className="font-medium capitalize text-foreground">{field.replace(/_/g, ' ')}:</span>
                        <span className="max-w-[10rem] truncate text-red-500 line-through">
                          {String(changes[field]?.old ?? '(empty)')}
                        </span>
                        <span>→</span>
                        <span className="max-w-[10rem] truncate text-emerald-600 dark:text-emerald-400">
                          {String(changes[field]?.new ?? '(empty)')}
                        </span>
                      </div>
                    ))}
                    {changedFields.length > 8 ? (
                      <p className="italic text-muted-foreground">+{changedFields.length - 8} more fields</p>
                    ) : null}
                  </div>
                ) : !actionNew ? (
                  <span className="italic text-muted-foreground">No field changes recorded</span>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Form state ─────────────────────────────────────────────────────────────────

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
    additional_charges: additionalChargeRowsFromAsset(a),
    sales_area_id: String(a.sales_area_id || ''),
    location: String(a.location || ''),
    section: String(a.section || ''),
    row_label: String(a.row_label || ''),
    rack_number: String(a.rack_number || ''),
    status: catalogStatusFromAsset(a),
    operational_status: operationalStatusFromAsset(a),
    is_visible: a.is_visible !== false,
    store_scope: String(a.store_scope || 'all'),
    store_ids: Array.isArray(a.store_ids) ? a.store_ids.map(String) : [],
    availability_mode: hasRange ? 'date_range' : 'always',
    display_start_date: start,
    display_end_date: end,
    notes: String(a.notes || ''),
    delivery_info: String(a.delivery_info || ''),
    delivery_enabled: a.delivery_enabled === true,
    unit_mode: String(a.unit_mode || 'none'),
    parent_asset_id: String(a.parent_asset_id || ''),
    is_bookable: a.is_bookable !== false,
    price_per_unit: String(a.price_per_unit ?? 0),
    pricing_uom: String(a.pricing_uom || ''),
    hourly_rate: String(a.hourly_rate ?? 0),
    per_minute_rate: String(a.per_minute_rate ?? 0),
    yearly_rate: String(a.yearly_rate ?? 0),
    duration_rates: durationRowsFromAsset(a),
    period_rates: periodRowsFromAsset(a),
    tax_rate: String(Number(a.tax_rate ?? 0)),
  }
}

// ── Page ───────────────────────────────────────────────────────────────────────

const SECTIONS: FormSectionDef[] = [
  { key: 'basics',       label: 'Basics',       icon: Tag,          hint: 'Name, type, short description, description and media.' },
  { key: 'pricing',      label: 'Pricing',       icon: IndianRupee,  hint: 'Capacity, UOM, pricing model and rates.' },
  { key: 'availability', label: 'Availability',  icon: CalendarRange, hint: 'Storefront display window and booking dates.' },
  { key: 'location',     label: 'Location',      icon: MapPin,       hint: 'Sales area, warehouse location and status.' },
  { key: 'tracking',     label: 'Unit Tracking', icon: Layers,       hint: 'Sub-assets, serialized units and hierarchy.' },
  { key: 'history',      label: 'History',       icon: Clock,        hint: 'Who changed what on this asset and when.' },
]

export default function RentalAssetFormPage() {
  const { assetId } = useParams<{ assetId?: string }>()
  const [searchParams] = useSearchParams()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const isEdit = Boolean(assetId)
  /** Display mode: `/rental/assets/:id` (no `/edit`). Edit mode: `/edit` or create `/new`. */
  const isViewMode = Boolean(assetId) && !pathname.endsWith('/edit')
  const initialParentId = searchParams.get('parent') || null

  const [form, setForm] = useState<AssetFormState>(() => {
    const base = emptyAssetForm()
    return initialParentId ? { ...base, parent_asset_id: initialParentId, unit_mode: 'hierarchy' } : base
  })
  const [loading, setLoading] = useState(false)
  const [detailAsset, setDetailAsset] = useState<RentalAsset | null>(null)
  const [savedUnitMode, setSavedUnitMode] = useState<string>('none')
  const [savedMedia, setSavedMedia] = useState<RentalMediaItem[]>([])
  /** Files staged before the asset exists; keyed by pending media id. */
  const pendingFilesRef = useRef<Map<string, File>>(new Map())
  const savedMediaRef = useRef(savedMedia)
  savedMediaRef.current = savedMedia
  const [activeTab, setActiveTab] = useState('basics')
  /** Create only: auto Master ID by default; flip on to type a custom code before save. */
  const [manualMasterId, setManualMasterId] = useState(false)

  // ── Feature flags ──
  const { vendor } = useVendorStore()
  const rentalSettings = (vendor?.settings as Record<string, unknown> | undefined)?.rental_settings as Record<string, unknown> | undefined
  const featureCategories = rentalSettings?.feature_categories !== false
  const featureMediaGallery = rentalSettings?.feature_media_gallery !== false
  const featureCapacityTracking = rentalSettings?.feature_capacity_tracking !== false
  const featureUnitTracking = rentalSettings?.feature_unit_tracking !== false
  const featureExtendedRates = rentalSettings?.feature_extended_rates !== false
  const featurePerUnitPricing = rentalSettings?.feature_per_unit_pricing !== false
  const assetCodePrefix = String(rentalSettings?.asset_code_prefix || DEFAULT_ASSET_CODE_PREFIX)

  const sections = useMemo((): FormSectionDef[] =>
    SECTIONS.filter((s) => s.key !== 'tracking' || featureUnitTracking),
    [featureUnitTracking])

  useEffect(() => {
    const visible = sections.filter((s) => s.visible !== false)
    if (!visible.some((s) => s.key === activeTab)) setActiveTab(visible[0]?.key ?? 'basics')
  }, [sections, activeTab])

  // ── Data ──
  const { data: categoryTreeData } = useCategoryTree()
  const rentalCategoryTree = useMemo(() => {
    const raw = (categoryTreeData as { categories?: unknown[] } | undefined)?.categories ?? []
    return filterCategoryTree(raw as Parameters<typeof filterCategoryTree>[0], 'rental')
  }, [categoryTreeData])

  const { data: salesAreaData } = useSalesAreas({ is_active: true })
  const { data: storesData } = useStores()
  const businessUnits = storesData?.stores ?? []
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

  // ── Load asset for edit / display ──
  useEffect(() => {
    if (!assetId) {
      setDetailAsset(null)
      return
    }
    setLoading(true)
    rentalApi.getAsset(assetId)
      .then((fresh) => {
        setDetailAsset(fresh as RentalAsset)
        setForm(assetToForm(fresh as RentalAsset & Record<string, unknown>))
        setSavedUnitMode(fresh.unit_mode ?? 'none')
        setSavedMedia((fresh.media ?? []) as RentalMediaItem[])
        if (fresh.parent_asset_id) {
          setLinkType('asset')
          setLinkEnabled(true)
        } else if (fresh.product_id) {
          setLinkType('product')
          setLinkEnabled(true)
        } else {
          setLinkEnabled(false)
        }
      })
      .catch((e) => toast.error(extractApiError(e, 'Load asset')))
      .finally(() => setLoading(false))
  }, [assetId])

  const set = (key: keyof AssetFormState, value: AssetFormState[keyof AssetFormState]) =>
    setForm((f) => ({ ...f, [key]: value }))

  // ── Product search ──
  const [productSearch, setProductSearch] = useState('')
  const [productPickerOpen, setProductPickerOpen] = useState(false)
  const productPickerRef = useRef<HTMLDivElement>(null)
  const { data: productOptions = [] } = useQuery({
    queryKey: ['rental-products-for-link', productSearch],
    queryFn: () => rentalApi.listProductsForRental(productSearch || undefined),
    enabled: productPickerOpen,
    staleTime: 30_000,
  })
  useEffect(() => {
    if (!productPickerOpen) return
    const handler = (e: MouseEvent) => {
      if (productPickerRef.current && !productPickerRef.current.contains(e.target as Node)) setProductPickerOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [productPickerOpen])

  // ── Link type toggle (Product vs Asset) — shown only when linkEnabled ──
  const [linkEnabled, setLinkEnabled] = useState(() => Boolean(initialParentId))
  const [linkType, setLinkType] = useState<'product' | 'asset'>(initialParentId ? 'asset' : 'product')
  const [assetLinkSearch, setAssetLinkSearch] = useState('')
  const [assetLinkPickerOpen, setAssetLinkPickerOpen] = useState(false)
  const assetLinkPickerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!assetLinkPickerOpen) return
    const handler = (e: MouseEvent) => {
      if (assetLinkPickerRef.current && !assetLinkPickerRef.current.contains(e.target as Node)) setAssetLinkPickerOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [assetLinkPickerOpen])

  // ── Assets for hierarchy ──
  const { data: allAssets = [] } = useQuery<RentalAsset[]>({
    queryKey: ['rental-assets'],
    queryFn: () => rentalApi.listAssets(),
    staleTime: 30_000,
  })
  const nextAssetCodePreview = previewAssetCode(allAssets.length + 1, assetCodePrefix)
  const parentOptions = useMemo(() => {
    const opts = allAssets
      .filter((a) => a.id !== assetId && !a.parent_asset_id)
      .map((a) => ({ value: a.id, label: `${a.name}${a.asset_code ? ` (${a.asset_code})` : ''}` }))
    return [{ value: '', label: 'No parent (top-level asset)' }, ...opts]
  }, [allAssets, assetId])

  const assetLinkOptions = useMemo(() => {
    const q = assetLinkSearch.toLowerCase().trim()
    return allAssets.filter((a) =>
      a.id !== assetId &&
      (!q || (a.name ?? '').toLowerCase().includes(q) || (a.asset_code ?? '').toLowerCase().includes(q)),
    )
  }, [allAssets, assetId, assetLinkSearch])

  const { data: childAssets = [] } = useQuery<RentalAsset[]>({
    queryKey: ['rental-asset-children', assetId],
    queryFn: () => rentalApi.listAssetChildren(assetId!),
    enabled: Boolean(assetId) && form.unit_mode === 'hierarchy',
  })

  // ── Locked bookings for availability validation ──
  const { data: allBookings = [] } = useQuery({
    queryKey: ['rental-bookings', '__all__'],
    queryFn: () => rentalApi.listBookings(),
    staleTime: 20_000,
  })
  const lockedBookings = useMemo(() => {
    if (!assetId) return [] as RentalBooking[]
    const locked = new Set(['approved', 'confirmed', 'active'])
    return (allBookings as RentalBooking[]).filter((b) => b.asset_id === assetId && locked.has(b.status))
  }, [allBookings, assetId])

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
      if (start && bStart && bStart < start)
        return `Cannot update: approved booking ${ref} (${period}) starts before ${start}.`
      if (end && bEnd && bEnd > end)
        return `Cannot update: approved booking ${ref} (${period}) ends after ${end}.`
    }
    return null
  }, [assetId, lockedBookings, form.availability_mode, form.display_start_date, form.display_end_date])

  // ── Media callbacks (edit mode persists; create mode stages until save) ──
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

  // ── Payload / Mutations ──
  const assetPayload = () => {
    const cfg = getCategoryConfig(form.category)
    const useRange = form.availability_mode === 'date_range'
    const start = useRange ? toDateInputValue(form.display_start_date) : ''
    const end = useRange ? toDateInputValue(form.display_end_date) : ''
    return {
      name: form.name,
      asset_code: (isEdit || manualMasterId) ? ((form.asset_code || '').trim() || undefined) : undefined,
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
      deposit_amount: Number(form.deposit_amount) || 0,
      extra_qty_charge: 0,
      extra_weight_charge: Number(form.extra_weight_charge) || 0,
      additional_charges: additionalChargesForSave(form.additional_charges),
      sales_area_id: form.sales_area_id || null,
      location: form.location || undefined,
      section: form.section || undefined,
      row_label: form.row_label || undefined,
      rack_number: form.rack_number || undefined,
      ...resolveAssetStatusForSave(form.status, form.operational_status),
      is_visible: form.is_visible,
      store_scope: form.store_scope || 'all',
      store_ids: form.store_scope === 'selected' ? (form.store_ids || []) : [],
      display_start_date: useRange ? (start || null) : null,
      display_end_date: useRange ? (end || null) : null,
      notes: form.notes || undefined,
      delivery_info: (form.delivery_info || '').trim() || null,
      delivery_enabled: Boolean(form.delivery_enabled),
      unit_mode: form.unit_mode || 'none',
      parent_asset_id: form.parent_asset_id || null,
      is_bookable: form.is_bookable,
      price_per_unit: Number(form.price_per_unit) || 0,
      pricing_uom: (form.pricing_uom || '').trim() || null,
      ...(() => {
        const duration_rates = durationRatesForSave(form.duration_rates)
        const legacy = durationLegacyRates(duration_rates)
        const period_rates = periodRatesForSave(form.period_rates)
        const periodLegacy = periodLegacyRates(period_rates)
        return {
          duration_rates,
          hourly_rate: legacy.hourly_rate,
          per_minute_rate: legacy.per_minute_rate,
          period_rates,
          daily_rate: periodLegacy.daily_rate || Number(form.daily_rate) || 0,
          weekly_rate: periodLegacy.weekly_rate || Number(form.weekly_rate) || 0,
          monthly_rate: periodLegacy.monthly_rate || Number(form.monthly_rate) || 0,
          yearly_rate: periodLegacy.yearly_rate || Number(form.yearly_rate) || 0,
        }
      })(),
      tax_rate: Number(form.tax_rate) || 0,
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
      navigate(`/rental/assets/${data.id}/edit`, { replace: true })
    },
    onError: (e) => toast.error(extractApiError(e, 'Create rental asset')),
  })

  const updateAsset = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => rentalApi.updateAsset(id, body),
    onSuccess: (data: RentalAsset) => {
      const start = toDateInputValue(data.display_start_date)
      const end = toDateInputValue(data.display_end_date)
      toast.success(start || end ? `Asset updated · Available ${start || '…'} → ${end || '…'}` : 'Rental asset updated')
      setSavedUnitMode(data.unit_mode ?? 'none')
      setDetailAsset(data)
      invalidate()
    },
    onError: (e) => toast.error(extractApiError(e, 'Update rental asset')),
  })

  const deleteAsset = useMutation({
    mutationFn: (id: string) => rentalApi.deleteAsset(id),
    onSuccess: () => {
      toast.success('Asset moved to bin')
      invalidate()
      navigate('/rental/assets?bin=1')
    },
    onError: (e) => toast.error(extractApiError(e, 'Move asset to bin')),
  })

  const restoreAsset = useMutation({
    mutationFn: (id: string) => rentalApi.restoreAsset(id),
    onSuccess: (data: RentalAsset) => {
      toast.success('Asset restored from bin')
      setDetailAsset(data)
      invalidate()
      navigate(`/rental/assets/${data.id}/edit`, { replace: true })
    },
    onError: (e) => toast.error(extractApiError(e, 'Restore asset')),
  })

  const saving = createAsset.isPending || updateAsset.isPending
  const isInBin = Boolean(detailAsset?.deleted_at)

  const save = () => {
    if (!form.name.trim()) {
      toast.error('Asset name is required')
      setActiveTab('basics')
      return
    }
    if (displayDateLockError) {
      toast.error(displayDateLockError)
      setActiveTab('availability')
      return
    }
    if (form.availability_mode === 'date_range') {
      const start = toDateInputValue(form.display_start_date)
      const end = toDateInputValue(form.display_end_date)
      if (!start || !end) {
        toast.error('Select both start and end dates for Date range availability')
        setActiveTab('availability')
        return
      }
      if (end < start) {
        toast.error('Display end date must be on or after the start date')
        setActiveTab('availability')
        return
      }
    }
    if (form.store_scope === 'selected' && !(form.store_ids || []).length) {
      toast.error('Select at least one business unit')
      setActiveTab('location')
      return
    }
    try {
      const body = assetPayload()
      if (assetId) updateAsset.mutate({ id: assetId, body })
      else createAsset.mutate(body)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not prepare asset for save')
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (isViewMode) {
    if (loading) {
      return (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )
    }

    const catalogLabel = ASSET_CATALOG_STATUSES.find((s) => s.value === form.status)?.label || form.status
    const routeLabel = salesAreaOptions.find((o) => o.value === form.sales_area_id)?.label
    const linkedAsset = form.parent_asset_id
      ? allAssets.find((a) => a.id === form.parent_asset_id)
      : null
    const money = (n: string | number) => formatCurrency(Number(n || 0), form.currency || 'INR')
    const showTab = (key: string) => activeTab === key
    const mediaItems = savedMedia.length > 0
      ? savedMedia
      : detailAsset?.image_url
        ? [{ id: 'legacy', url: detailAsset.image_url, is_primary: true } as RentalMediaItem]
        : []
    const categoryPath = form.category_id
      ? flattenCategoryTree(rentalCategoryTree).find((o) => o.id === form.category_id)?.label
      : null
    const capacityMax = Number(detailAsset?.capacity_max ?? form.capacity_max ?? 0)
    const capacityUsed = Number(detailAsset?.current_occupancy ?? 0)
    const capacityAvail = detailAsset?.available_capacity !== undefined
      ? Number(detailAsset.available_capacity)
      : undefined
    const periodChips = (form.period_rates || [])
      .filter((r) => Number(r.rate) > 0)
      .map((r) => ({ label: formatPeriodLabel(r.days), value: money(r.rate) }))
    const durationChips = (form.duration_rates || [])
      .filter((r) => Number(r.rate) > 0)
      .map((r) => ({ label: formatDurationLabel(r.minutes), value: money(r.rate) }))
    const rateChips = [
      ...periodChips,
      ...durationChips,
      Number(form.price_per_unit) > 0 && {
        label: form.pricing_uom || form.capacity_unit || 'Unit',
        value: money(form.price_per_unit),
      },
    ].filter(Boolean) as { label: string; value: string }[]
    const viewCompleted = new Set<string>()
    if (form.name) viewCompleted.add('basics')
    if (rateChips.length > 0 || Number(form.deposit_amount) > 0) viewCompleted.add('pricing')
    viewCompleted.add('availability')
    if (form.sales_area_id || form.location || form.notes) viewCompleted.add('location')
    if (form.unit_mode && form.unit_mode !== 'none') viewCompleted.add('tracking')
    if ((detailAsset?.change_history?.length || 0) > 0) viewCompleted.add('history')

    return (
      <FormPageWithNav activeSectionKey={activeTab} nav={null}>
        <div className={formEditLayout.formStack}>
          <div className={formEditLayout.stickyBar}>
            <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
              <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
                <Button variant="ghost" size="sm" className="h-8 px-2 text-foreground" onClick={() => navigate(isInBin ? '/rental/assets?bin=1' : '/rental/assets')}>
                  <ArrowLeft className="mr-1 h-4 w-4" />Back
                </Button>
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <h1 className="truncate text-base font-bold text-foreground sm:text-xl">{form.name || 'Rental Asset'}</h1>
                    {form.asset_code ? (
                      <button
                        type="button"
                        title="Copy master ID"
                        className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 font-mono text-xs whitespace-nowrap text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
                        onClick={() => {
                          navigator.clipboard?.writeText(form.asset_code)
                          toast.success('Master ID copied')
                        }}
                      >
                        {form.asset_code}
                        <Copy className="h-3 w-3 opacity-60" />
                      </button>
                    ) : null}
                  </div>
                  <p className="mt-0.5 truncate text-xs capitalize text-muted-foreground">
                    {(form.category || '').replace(/_/g, ' ')}
                    {form.asset_type ? ` · ${form.asset_type}` : ''}
                  </p>
                </div>
                {isInBin ? (
                  <span className="inline-flex items-center rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:text-red-300">
                    In bin
                  </span>
                ) : (
                  <>
                    <StatusBadge status={form.operational_status} />
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      form.status === 'active' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' :
                      form.status === 'archived' ? 'bg-red-500/10 text-red-600 dark:text-red-300' :
                      'bg-muted text-muted-foreground'
                    }`}>{catalogLabel}</span>
                  </>
                )}
                {!form.is_visible && !isInBin && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                    <Eye className="h-3 w-3" />Hidden
                  </span>
                )}
                {form.is_bookable === false && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/10 px-2 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-400">
                    <Archive className="h-3 w-3" />Container only
                  </span>
                )}
              </div>
              {isInBin ? (
                <Button
                  size="sm"
                  className="h-8 shrink-0 gap-1.5"
                  disabled={restoreAsset.isPending || !assetId}
                  onClick={() => assetId && restoreAsset.mutate(assetId)}
                >
                  {restoreAsset.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Restore from bin
                </Button>
              ) : (
                <Button size="sm" className="h-8 shrink-0 gap-1.5" onClick={() => navigate(`/rental/assets/${assetId}/edit`)}>
                  <Pencil className="h-3.5 w-3.5" />Edit Asset
                </Button>
              )}
            </div>
          </div>

          <FormSectionTabs
            sections={sections}
            activeKey={activeTab}
            onChange={setActiveTab}
            completedSections={viewCompleted}
            hasErrorSections={new Set()}
          />

          <div className={formDisplayCompact.pageGap}>
            {showTab('basics') && (
              <>
                {mediaItems.length > 0 && (
                  <Card>
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex gap-2 overflow-x-auto sm:gap-3">
                        {mediaItems.map((m) => (
                          <div key={m.id} className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg border bg-muted sm:h-28 sm:w-28">
                            <img src={mediaUrl(m.url)} alt={form.name} className="h-full w-full object-cover" />
                            {m.is_primary && (
                              <span className="absolute left-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-amber-950 shadow-sm" aria-label="Primary">
                                <Star className="h-2.5 w-2.5 fill-current" />
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardContent className={formDisplayCompact.cardBody}>
                    <div className={formDisplayCompact.sectionHeader}>
                      <Package className={formDisplayCompact.sectionHeaderIcon} />
                      <span className={formDisplayCompact.sectionHeaderTitle}>Basic information</span>
                    </div>
                    <div className={formDisplayCompact.fieldGrid}>
                      <DisplayField label="Asset name" value={form.name} />
                      <DisplayField label="Master ID" value={form.asset_code ? <span className="font-mono tracking-wide">{form.asset_code}</span> : undefined} />
                      <DisplayField label="Kind" value={form.category} />
                      <DisplayField label="Type" value={form.asset_type} />
                      <DisplayField label="Category" value={categoryPath?.replace(/^\s+/, '').replace(/\s{2,}/g, ' · ')} />
                      <DisplayField
                        label="Linked to"
                        value={
                          linkedAsset ? (
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 text-left font-medium text-primary hover:underline"
                              onClick={() => navigate(`/rental/assets/${linkedAsset.id}`)}
                            >
                              <Link2 className="h-3.5 w-3.5" />
                              {linkedAsset.name}
                              {linkedAsset.asset_code ? ` (${linkedAsset.asset_code})` : ''}
                            </button>
                          ) : form.product_id ? (
                            <span className="inline-flex items-center gap-1">
                              <Link2 className="h-3.5 w-3.5" />
                              Product ({form.product_id.slice(0, 8)}…)
                            </span>
                          ) : undefined
                        }
                      />
                    </div>
                    {(form.short_description || form.description) && (
                      <div className="mt-2 space-y-1.5 border-t border-border/60 pt-2">
                        {form.short_description ? (
                          <DisplayField label="Short description" value={form.short_description} />
                        ) : null}
                        {form.description ? (
                          <DisplayField
                            label="Description"
                            value={<p className="whitespace-pre-line text-sm text-muted-foreground">{form.description}</p>}
                          />
                        ) : null}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {capacityMax > 0 && (
                  <Card>
                    <CardContent className={formDisplayCompact.cardBody}>
                      <div className={formDisplayCompact.sectionHeader}>
                        <Layers className={formDisplayCompact.sectionHeaderIcon} />
                        <span className={formDisplayCompact.sectionHeaderTitle}>Capacity snapshot</span>
                      </div>
                      <CapacityBar
                        used={capacityUsed}
                        max={capacityMax}
                        unit={form.capacity_unit || detailAsset?.capacity_unit}
                        available={capacityAvail}
                      />
                      {form.max_weight ? (
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          Max weight · {form.max_weight} {form.weight_unit || 'kg'}
                        </p>
                      ) : null}
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            {showTab('pricing') && (
              <Card>
                <CardContent className={formDisplayCompact.cardBody}>
                  <div className={formDisplayCompact.sectionHeader}>
                    <IndianRupee className={formDisplayCompact.sectionHeaderIcon} />
                    <span className={formDisplayCompact.sectionHeaderTitle}>Pricing</span>
                  </div>
                  {rateChips.length > 0 ? (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {rateChips.map((r) => (
                        <span
                          key={r.label}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 text-sm"
                        >
                          <span className="font-semibold text-foreground">{r.value}</span>
                          <span className="text-xs text-muted-foreground">/{r.label.toLowerCase()}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mb-2 text-sm text-muted-foreground">No rental rates set yet.</p>
                  )}
                  <div className={formDisplayCompact.fieldGrid}>
                    <DisplayField label="Currency" value={form.currency || 'INR'} />
                    <DisplayField
                      label={form.name.trim() ? `Max ${form.name.trim()}` : 'Max Quantity'}
                      value={`${form.capacity_max || '—'} ${form.capacity_unit || ''}`.trim()}
                    />
                    <DisplayField label="Max weight" value={form.max_weight ? `${form.max_weight} ${form.weight_unit || 'kg'}` : undefined} />
                    <DisplayField label="Deposit" value={Number(form.deposit_amount) > 0 ? money(form.deposit_amount) : undefined} />
                    <DisplayField
                      label="Tax %"
                      value={
                        Number(form.tax_rate) > 0 || form.tax_rate === '0'
                          ? `${form.tax_rate || 0}%`
                          : undefined
                      }
                    />
                    {(form.additional_charges || []).filter((c) => c.name.trim() && Number(c.value) > 0).map((c) => (
                      <DisplayField
                        key={c.id || c.name}
                        label={c.name.trim()}
                        value={(
                          <>
                            {formatAdditionalChargeValue({ charge_type: c.charge_type, value: Number(c.value), percent_of: c.percent_of || 'rental' }, currencySymbol(form.currency))}
                            <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">
                              {c.charge_type === 'percent' ? 'Formula' : 'Fixed amount'}
                              {' · '}
                              {c.show_mode === 'independent' ? 'Independent (optional)' : 'Together (included)'}
                            </span>
                            {c.description.trim() ? (
                              <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">{c.description.trim()}</span>
                            ) : null}
                          </>
                        )}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {showTab('availability') && (
              <Card>
                <CardContent className={formDisplayCompact.cardBody}>
                  <div className={formDisplayCompact.sectionHeader}>
                    <CalendarRange className={formDisplayCompact.sectionHeaderIcon} />
                    <span className={formDisplayCompact.sectionHeaderTitle}>Storefront availability</span>
                  </div>
                  <div
                    className={`mb-2 flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs sm:text-sm ${
                      form.availability_mode === 'date_range'
                        ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                        : 'bg-amber-500/10 text-amber-800 dark:text-amber-300'
                    }`}
                  >
                    <CalendarRange className="h-3.5 w-3.5 shrink-0" />
                    {form.availability_mode === 'date_range' ? (
                      <span>
                        <span className="font-medium">Booked period</span>
                        {' · '}
                        {form.display_start_date || '…'} → {form.display_end_date || '…'}
                      </span>
                    ) : (
                      <span className="font-medium">Always available</span>
                    )}
                  </div>
                  <div className={formDisplayCompact.fieldGrid}>
                    <DisplayField
                      label="Mode"
                      value={form.availability_mode === 'date_range' ? 'Date range' : 'Always available'}
                    />
                    {form.availability_mode === 'date_range' && (
                      <>
                        <DisplayField label="Start" value={form.display_start_date || undefined} />
                        <DisplayField label="End" value={form.display_end_date || undefined} />
                      </>
                    )}
                    <DisplayField label="Visible on storefront" value={form.is_visible ? 'Yes' : 'No'} />
                    <DisplayField label="Offer delivery" value={form.delivery_enabled ? 'Yes' : 'No'} />
                    {form.delivery_info ? (
                      <DisplayField label="Delivery / booking note" value={form.delivery_info} />
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            )}

            {showTab('location') && (
              <Card>
                <CardContent className={formDisplayCompact.cardBody}>
                  <div className={formDisplayCompact.sectionHeader}>
                    <MapPin className={formDisplayCompact.sectionHeaderIcon} />
                    <span className={formDisplayCompact.sectionHeaderTitle}>Location & status</span>
                  </div>
                  <div className={formDisplayCompact.fieldGrid}>
                    <DisplayField label="Sales area / route" value={routeLabel} />
                    <DisplayField label="Location" value={form.location || undefined} />
                    <DisplayField label="Store scope" value={form.store_scope === 'selected' ? 'Selected units only' : 'All business units'} />
                    {form.store_scope === 'selected' ? (
                      <DisplayField
                        label="Business units"
                        value={
                          (form.store_ids || []).length
                            ? (form.store_ids || []).map((id) => businessUnits.find((s) => s.id === id)?.name || id).join(', ')
                            : '—'
                        }
                      />
                    ) : null}
                    <DisplayField label="Section" value={form.section || undefined} />
                    <DisplayField label="Row" value={form.row_label || undefined} />
                    <DisplayField label="Rack number" value={form.rack_number || undefined} />
                    <DisplayField label="Operational status" value={<StatusBadge status={form.operational_status} />} />
                    <DisplayField label="Catalog status" value={catalogLabel} />
                  </div>
                  {form.notes ? (
                    <div className="mt-2 border-t border-border/60 pt-2">
                      <DisplayField
                        label="Internal notes"
                        value={<p className="whitespace-pre-wrap text-sm text-muted-foreground">{form.notes}</p>}
                      />
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            )}

            {showTab('tracking') && featureUnitTracking && (
              <Card>
                <CardContent className={formDisplayCompact.cardBody}>
                  <div className={formDisplayCompact.sectionHeader}>
                    <Layers className={formDisplayCompact.sectionHeaderIcon} />
                    <span className={formDisplayCompact.sectionHeaderTitle}>Unit tracking</span>
                  </div>
                  <div className={formDisplayCompact.fieldGrid}>
                    <DisplayField
                      label="Tracking mode"
                      value={
                        form.unit_mode === 'hierarchy' ? 'Sub-assets (hierarchy)'
                          : form.unit_mode === 'serialized' ? 'Serialized units'
                            : 'None'
                      }
                    />
                    <DisplayField
                      label="Bookable"
                      value={form.is_bookable ? 'Yes — customers can book' : 'No — container only'}
                    />
                    {form.unit_mode === 'hierarchy' && (
                      <DisplayField
                        label="Sub-assets"
                        value={String(detailAsset?.child_count ?? childAssets.length)}
                      />
                    )}
                    {form.unit_mode === 'serialized' && (
                      <DisplayField
                        label="Units"
                        value={String(detailAsset?.unit_count ?? 0)}
                      />
                    )}
                  </div>
                  {form.unit_mode === 'hierarchy' && childAssets.length > 0 && (
                    <ul className="mt-2 divide-y rounded-lg border border-border">
                      {childAssets.map((c) => (
                        <li key={c.id}>
                          <button
                            type="button"
                            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50"
                            onClick={() => navigate(`/rental/assets/${c.id}`)}
                          >
                            <span className="truncate font-medium text-foreground">{c.name}</span>
                            <span className="flex shrink-0 items-center gap-2">
                              {c.asset_code ? <span className="font-mono text-xs text-muted-foreground">{c.asset_code}</span> : null}
                              <StatusBadge status={c.status} />
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {form.unit_mode === 'serialized' && assetId && (
                    <div className="mt-3">
                      <RentalAssetUnitsPanel assetId={assetId} readOnly />
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {showTab('history') && (
              <Card>
                <CardContent className={formDisplayCompact.cardBody}>
                  <div className={formDisplayCompact.sectionHeader}>
                    <Clock className={formDisplayCompact.sectionHeaderIcon} />
                    <span className={formDisplayCompact.sectionHeaderTitle}>Change history</span>
                  </div>
                  <AssetChangeHistoryPanel asset={detailAsset} />
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </FormPageWithNav>
    )
  }

  return (
    <FormPageWithNav activeSectionKey={activeTab} nav={null}>
      <CatalogEditStickyBar
        backLabel="Rental Assets"
        onBack={() => navigate(isInBin ? '/rental/assets?bin=1' : '/rental/assets')}
        title={isEdit ? (form.name || 'Edit Rental Asset') : 'New Rental Asset'}
        badge={
          loading
            ? <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Loading…</span>
            : isInBin
              ? <span className="inline-flex items-center rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-300">In bin</span>
              : form.asset_code
                ? <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">{form.asset_code}</span>
                : null
        }
        status={form.status}
        onStatusChange={(v) => set('status', v)}
        visibleControl={
          <Toggle
            label="Visible"
            checked={form.is_visible}
            onChange={(v) => setForm((f) => ({ ...f, is_visible: v }))}
          />
        }
        onSave={isInBin ? () => {
          if (assetId) restoreAsset.mutate(assetId)
        } : save}
        saveLabel={isInBin ? 'Restore from bin' : isEdit ? 'Update Asset' : 'Save Asset'}
        saveLabelShort={isInBin ? 'Restore' : 'Save'}
        isSaving={isInBin ? restoreAsset.isPending : saving}
        isEdit={isEdit && !isInBin}
        onDelete={isEdit && assetId && !isInBin ? () => deleteAsset.mutate(assetId) : undefined}
        isDeleting={deleteAsset.isPending}
        deleteConfirmMessage="Move this asset to the bin? It stays in history and can be restored."
      />

      <FormSectionTabs
        sections={sections}
        activeKey={activeTab}
        onChange={setActiveTab}
      />

      <div className="flex flex-col gap-3">

        {/* ══════════════════════════════════════════════════════
            BASICS — compact: name → classify + link → describe → media
        ══════════════════════════════════════════════════════ */}
        <Section sectionKey="basics" active={activeTab === 'basics'} title="Basics" icon={Tag}>
          <div className="space-y-3">

            {/* Name + Master ID */}
            <div className="grid max-w-3xl items-start gap-3 sm:grid-cols-[minmax(0,1fr)_11.5rem]">
              <div>
                <FieldLabel required>Asset Name</FieldLabel>
                <Input
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder={categoryConfig.labels.namePlaceholder}
                  autoFocus={!isEdit}
                />
              </div>
              <div>
                <FieldLabel>Master ID</FieldLabel>
                {isEdit ? (
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
            </div>

            {/* Category · Type · Link To */}
            <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {featureCategories && rentalCategoryTree.length > 0 && (
                <div>
                  <FieldLabel>
                    <span className="flex items-center justify-between gap-2">
                      Category
                      {form.category_id && (
                        <button type="button" className="text-[11px] font-normal text-muted-foreground hover:text-destructive" onClick={() => set('category_id', '')}>
                          ✕ Clear
                        </button>
                      )}
                    </span>
                  </FieldLabel>
                  <RentalCategoryPicker
                    tree={rentalCategoryTree}
                    categoryId={form.category_id}
                    onChange={(id) => set('category_id', id)}
                  />
                </div>
              )}

              <div>
                <FieldLabel>Type</FieldLabel>
                <RentalSuggestionCombobox
                  value={form.asset_type}
                  onChange={(v) => set('asset_type', v)}
                  suggestions={ASSET_TYPE_SUGGESTIONS}
                  placeholder="Type or select…"
                />
              </div>

              <div className={cn(!(featureCategories && rentalCategoryTree.length > 0) && 'lg:col-start-3')}>
                <label className="mb-1.5 flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={linkEnabled}
                    onChange={(e) => {
                      const on = e.target.checked
                      setLinkEnabled(on)
                      if (!on) {
                        setForm((f) => ({ ...f, product_id: '', parent_asset_id: '' }))
                        setProductPickerOpen(false)
                        setAssetLinkPickerOpen(false)
                        setProductSearch('')
                        setAssetLinkSearch('')
                      }
                    }}
                    className="h-4 w-4 shrink-0 rounded accent-primary"
                  />
                  <span className="flex items-center gap-1 text-sm font-medium text-foreground">
                    <Link2 className="h-3.5 w-3.5" />
                    Link To <span className="ml-1 text-xs font-normal text-muted-foreground">(optional)</span>
                  </span>
                </label>
                {linkEnabled && (
                  <div className="flex items-stretch gap-1.5">
                    <div className="flex shrink-0 overflow-hidden rounded-md border border-border text-xs font-medium">
                      <button
                        type="button"
                        onClick={() => { setLinkType('product'); set('parent_asset_id', '') }}
                        className={cn(
                          'px-2.5 py-1.5 transition-colors',
                          linkType === 'product'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-background text-muted-foreground hover:bg-muted',
                        )}
                      >
                        Product
                      </button>
                      <button
                        type="button"
                        onClick={() => { setLinkType('asset'); set('product_id', '') }}
                        className={cn(
                          'border-l border-border px-2.5 py-1.5 transition-colors',
                          linkType === 'asset'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-background text-muted-foreground hover:bg-muted',
                        )}
                      >
                        Asset
                      </button>
                    </div>

                    <div className="min-w-0 flex-1">
                      {linkType === 'product' && (
                        form.product_id ? (
                          <div className="flex h-9 items-center gap-2 rounded-md border border-border bg-muted/40 px-2.5 text-sm">
                            <Link2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                            <span className="flex-1 truncate font-medium">
                              {productOptions.find((p) => p.id === form.product_id)?.name || `Product (${form.product_id.slice(0, 8)}…)`}
                            </span>
                            <button type="button" onClick={() => set('product_id', '')} className="text-muted-foreground hover:text-destructive" title="Unlink product">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div ref={productPickerRef} className="relative">
                            <Input
                              placeholder="Search products…"
                              value={productSearch}
                              onFocus={() => setProductPickerOpen(true)}
                              onChange={(e) => { setProductSearch(e.target.value); setProductPickerOpen(true) }}
                            />
                            {productPickerOpen && (
                              <div className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
                                {productOptions.length === 0 ? (
                                  <p className="px-3 py-2 text-xs text-muted-foreground">No products found</p>
                                ) : productOptions.map((p) => (
                                  <button key={p.id} type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => { set('product_id', p.id); setProductPickerOpen(false); setProductSearch('') }}>
                                    <span className="flex-1 truncate font-medium">{p.name}</span>
                                    {p.sku && <span className="text-xs text-muted-foreground">{p.sku}</span>}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      )}

                      {linkType === 'asset' && (
                        form.parent_asset_id ? (
                          <div className="flex h-9 items-center gap-2 rounded-md border border-border bg-muted/40 px-2.5 text-sm">
                            <Link2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                            <span className="flex-1 truncate font-medium">
                              {allAssets.find((a) => a.id === form.parent_asset_id)?.name || `Asset (${form.parent_asset_id.slice(0, 8)}…)`}
                            </span>
                            <button type="button" onClick={() => set('parent_asset_id', '')} className="text-muted-foreground hover:text-destructive" title="Unlink asset">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div ref={assetLinkPickerRef} className="relative">
                            <Input
                              placeholder="Search assets…"
                              value={assetLinkSearch}
                              onFocus={() => setAssetLinkPickerOpen(true)}
                              onChange={(e) => { setAssetLinkSearch(e.target.value); setAssetLinkPickerOpen(true) }}
                            />
                            {assetLinkPickerOpen && (
                              <div className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
                                {assetLinkOptions.length === 0 ? (
                                  <p className="px-3 py-2 text-xs text-muted-foreground">No assets found</p>
                                ) : assetLinkOptions.map((a) => (
                                  <button key={a.id} type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                                    onClick={() => { set('parent_asset_id', a.id); setAssetLinkPickerOpen(false); setAssetLinkSearch('') }}
                                  >
                                    <span className="flex-1 truncate font-medium">{a.name}</span>
                                    {a.asset_code && <span className="text-xs text-muted-foreground">{a.asset_code}</span>}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Short description · Description · Media — side by side */}
            <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <FieldLabel>Short Description</FieldLabel>
                <Textarea
                  rows={4}
                  maxLength={500}
                  value={form.short_description}
                  onChange={(e) => set('short_description', e.target.value)}
                  placeholder="Brief summary for listings (max 500 chars)"
                />
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {form.short_description.length}/500
                </p>
              </div>

              <div>
                <FieldLabel>Description</FieldLabel>
                <Textarea
                  rows={4}
                  value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                  placeholder={categoryConfig.labels.descriptionPlaceholder}
                />
              </div>

              {featureMediaGallery ? (
                <div className="sm:col-span-2 lg:col-span-1">
                  <FieldLabel>
                    <span className="flex items-center gap-1"><Image className="h-3.5 w-3.5" /> Photos &amp; Media</span>
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
                    <p className="mt-1 text-xs text-muted-foreground">
                      Saved when you create the asset.
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </Section>

        {/* ══════════════════════════════════════════════════════
            PRICING — 2-column grid
        ══════════════════════════════════════════════════════ */}
        <Section sectionKey="pricing" active={activeTab === 'pricing'} title="Pricing" icon={IndianRupee} dense>
          <RentalAssetPricingFields
            form={form}
            set={set}
            assetName={form.name}
            syncKey={assetId || 'new'}
            featureCapacityTracking={featureCapacityTracking}
            featureExtendedRates={featureExtendedRates}
            featurePerUnitPricing={featurePerUnitPricing}
          />
        </Section>

        {/* ══════════════════════════════════════════════════════
            AVAILABILITY — side-by-side: controls left, info right
        ══════════════════════════════════════════════════════ */}
        <Section sectionKey="availability" active={activeTab === 'availability'} title="Storefront Availability" icon={CalendarRange}>
          <div className="grid gap-5 lg:grid-cols-3">
            {/* Controls */}
            <div className="space-y-4 lg:col-span-2">
              <div className="max-w-xs">
                <FieldLabel>Availability mode</FieldLabel>
                <Select value={form.availability_mode} onChange={onAvailabilityModeChange} options={AVAILABILITY_OPTIONS} />
              </div>

              {form.availability_mode === 'date_range' && (
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <FieldLabel required>Start date</FieldLabel>
                      <Input type="date" value={form.display_start_date} onChange={(e) => set('display_start_date', e.target.value)} />
                    </div>
                    <div>
                      <FieldLabel required>End date</FieldLabel>
                      <Input type="date" value={form.display_end_date} min={form.display_start_date || undefined} onChange={(e) => set('display_end_date', e.target.value)} />
                    </div>
                  </div>
                  {(form.display_start_date || form.display_end_date) && (
                    <p className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                      Available {form.display_start_date || '…'} → {form.display_end_date || '…'}
                    </p>
                  )}
                </div>
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

              <div className="space-y-3">
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={form.delivery_enabled}
                    onChange={(e) => set('delivery_enabled', e.target.checked)}
                    className="mt-0.5 accent-primary"
                  />
                  <span>
                    <span className="block text-sm font-medium text-foreground">Offer delivery on storefront</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      Shows a “Need delivery” checkbox when customers book this asset.
                    </span>
                  </span>
                </label>
                <div>
                  <FieldLabel>Storefront delivery / booking note</FieldLabel>
                  <Input
                    value={form.delivery_info}
                    onChange={(e) => set('delivery_info', e.target.value.slice(0, 500))}
                    placeholder="e.g. Delivery can be requested when you book"
                    maxLength={500}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Shown on the public rental page under pricing. Leave blank to hide.
                    {form.delivery_info ? ` · ${form.delivery_info.length}/500` : ''}
                  </p>
                </div>
              </div>
            </div>

            {/* Info panel */}
            <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm space-y-3">
              <p className="font-medium text-foreground">How it works</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground">Always available</span> — the asset appears on the storefront every day with no date restriction.
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground">Date range</span> — only visible to customers between the start and end dates you set. Use this for seasonal or time-limited rentals.
              </p>
              {form.availability_mode === 'always' && (
                <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                  ✓ Always available — customers can see this asset every day.
                </p>
              )}
            </div>
          </div>
        </Section>

        {/* ══════════════════════════════════════════════════════
            LOCATION — 3-column grid for location fields
        ══════════════════════════════════════════════════════ */}
        <Section sectionKey="location" active={activeTab === 'location'} title="Location, Status & Notes" icon={MapPin} dense>
          <div className="space-y-3">
            <div className="flex flex-wrap items-end gap-x-2 gap-y-2">
              <div className="min-w-[10rem] flex-1 basis-[11rem]">
                <FieldLabel className="mb-1 block text-[11px] font-medium leading-none text-muted-foreground">
                  Sales Area / Route
                </FieldLabel>
                <Select
                  value={form.sales_area_id || '__none__'}
                  onChange={(v) => set('sales_area_id', v === '__none__' ? '' : v)}
                  options={[{ value: '__none__', label: 'No sales area' }, ...salesAreaOptions]}
                  className="h-9 py-0 text-sm"
                  showSelectedHint={false}
                />
              </div>
              <div className="min-w-[9rem] flex-1 basis-[10rem]">
                <FieldLabel className="mb-1 block text-[11px] font-medium leading-none text-muted-foreground">
                  {categoryConfig.labels.location}
                </FieldLabel>
                <Input
                  value={form.location}
                  onChange={(e) => set('location', e.target.value)}
                  placeholder={categoryConfig.labels.locationPlaceholder}
                  className="h-9 py-0 text-sm"
                />
              </div>
            </div>

            <div className="rounded-md border border-border/60 bg-background/70 p-2.5">
              <BusinessUnitScopePicker
                stores={businessUnits}
                scope={(form.store_scope === 'selected' ? 'selected' : 'all') as StoreScope}
                selectedIds={form.store_ids || []}
                onScopeChange={(scope) => setForm((f) => ({
                  ...f,
                  store_scope: scope,
                  store_ids: scope === 'all' ? [] : f.store_ids,
                }))}
                onSelectedChange={(ids) => set('store_ids', ids)}
                hideHeader
              />
            </div>

            {categoryConfig.showRackLocation && (
              <div className="rounded-md border border-border/60 bg-background/70 p-2.5">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Rack / shelf position
                </p>
                <div className="flex flex-wrap items-end gap-x-2 gap-y-2">
                  <div className="min-w-[10rem] flex-[1.4] basis-[12rem]">
                    <FieldLabel className="mb-1 block text-[11px] font-medium leading-none text-muted-foreground">
                      Section
                    </FieldLabel>
                    <Input
                      value={form.section}
                      onChange={(e) => set('section', e.target.value)}
                      placeholder="Cold Storage – A"
                      className="h-9 py-0 text-sm"
                    />
                  </div>
                  <div className="w-[7rem] shrink-0">
                    <FieldLabel className="mb-1 block text-[11px] font-medium leading-none text-muted-foreground">
                      Row
                    </FieldLabel>
                    <Input
                      value={form.row_label}
                      onChange={(e) => set('row_label', e.target.value)}
                      placeholder="Row 01"
                      className="h-9 py-0 text-sm"
                    />
                  </div>
                  <div className="w-[8rem] shrink-0">
                    <FieldLabel className="mb-1 block text-[11px] font-medium leading-none text-muted-foreground">
                      Rack Number
                    </FieldLabel>
                    <Input
                      value={form.rack_number}
                      onChange={(e) => set('rack_number', e.target.value)}
                      placeholder="A-001"
                      className="h-9 py-0 text-sm"
                    />
                  </div>
                </div>
              </div>
            )}

            <div>
              <FieldLabel className="mb-1 block text-[11px] font-medium leading-none text-muted-foreground">
                Internal Notes
              </FieldLabel>
              <Textarea
                rows={3}
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                placeholder="Notes visible only to your team…"
                className="min-h-[4.5rem] resize-y text-sm"
              />
            </div>
          </div>
        </Section>

        {/* ══════════════════════════════════════════════════════
            UNIT TRACKING — tracking mode + unit list
        ══════════════════════════════════════════════════════ */}
        {featureUnitTracking && (
          <Section sectionKey="tracking" active={activeTab === 'tracking'} title="Sub-assets & Unit Tracking" icon={Layers}>
            <div className="space-y-4">
              {/* Mode + bookable on one compact settings strip */}
              <div className="space-y-3">
                <div className="max-w-xl">
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
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                    <Toggle
                      label="Directly bookable"
                      checked={form.is_bookable}
                      onChange={(v) => setForm((f) => ({ ...f, is_bookable: v }))}
                    />
                    <p className="text-xs text-muted-foreground sm:border-l sm:border-border sm:pl-3">
                      Turn off for container-only assets (e.g. a fleet group that is not rented as a whole).
                    </p>
                  </div>
                )}
              </div>

              {/* None mode — friendly call-to-action */}
              {form.unit_mode === 'none' && (
                <div className="rounded-lg border border-dashed border-border bg-background/60 px-5 py-7 text-center">
                  <Layers className="mx-auto mb-2.5 h-7 w-7 text-muted-foreground/40" />
                  <p className="text-sm font-medium text-foreground">No unit tracking enabled</p>
                  <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
                    Choose <strong>Serialized</strong> for individual serial numbers, or <strong>Hierarchy</strong> for child assets under this one.
                  </p>
                </div>
              )}

              {/* Hierarchy: parent picker */}
              {form.unit_mode === 'hierarchy' && (
                <div className="max-w-xl">
                  <FieldLabel>Parent asset</FieldLabel>
                  <Select value={form.parent_asset_id || ''} onChange={(v) => setForm((f) => ({ ...f, parent_asset_id: v }))} options={parentOptions} />
                  <p className="mt-1 text-xs text-muted-foreground">Assign this asset as a child of another (e.g. &quot;Van 03&quot; inside &quot;City Fleet&quot;).</p>
                </div>
              )}

              {/* Hierarchy: child list */}
              {form.unit_mode === 'hierarchy' && assetId && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <FieldLabel>Sub-assets</FieldLabel>
                    {childAssets.length > 0 && (
                      <span className="tabular-nums text-xs text-muted-foreground">{childAssets.length}</span>
                    )}
                  </div>
                  {childAssets.length > 0 ? (
                    <div className="overflow-hidden rounded-lg border border-border bg-background">
                      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-1.5">
                        <span className="flex-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Name</span>
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Code</span>
                        <span className="w-16 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Status</span>
                      </div>
                      <div className="divide-y divide-border">
                        {childAssets.map((c) => (
                          <div key={c.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                            <span className="flex-1 truncate font-medium">{c.name}</span>
                            {c.asset_code && <span className="font-mono text-xs text-muted-foreground">{c.asset_code}</span>}
                            <span className="w-16 rounded bg-muted px-1.5 py-0.5 text-right text-[10px] capitalize">{c.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border py-5 text-center">
                      <p className="text-xs text-muted-foreground">No sub-assets yet.</p>
                    </div>
                  )}
                  <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => navigate(`/rental/assets/new?parent=${assetId}`)}>
                    <Plus className="mr-1.5 h-4 w-4" /> Add Sub-asset
                  </Button>
                </div>
              )}

              {/* Hierarchy: new asset — not saved yet */}
              {form.unit_mode === 'hierarchy' && !assetId && (
                <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                  Save the asset first, then you can add child sub-assets here.
                </p>
              )}

              {/* Serialized: units panel */}
              {form.unit_mode === 'serialized' && (
                savedUnitMode === 'serialized' && assetId ? (
                  <RentalAssetUnitsPanel assetId={assetId} />
                ) : assetId ? (
                  <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                    Click <strong>Update Asset</strong> above to save the tracking mode, then return here to add serialized units.
                  </p>
                ) : (
                  <div className="rounded-lg border border-dashed border-border bg-background/60 px-5 py-7 text-center">
                    <Layers className="mx-auto mb-2.5 h-7 w-7 text-muted-foreground/40" />
                    <p className="text-sm font-medium text-foreground">Units will be set up after saving</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Click <strong>Save Asset</strong> to create the asset, then come back here to add serial numbers.
                    </p>
                  </div>
                )
              )}
            </div>
          </Section>
        )}

        <Section sectionKey="history" active={activeTab === 'history'} title="Change History" icon={Clock}>
          {!isEdit ? (
            <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
              History starts after you save this asset for the first time.
            </p>
          ) : (
            <AssetChangeHistoryPanel asset={detailAsset} />
          )}
        </Section>

      </div>
    </FormPageWithNav>
  )
}
