import { useMemo, useState } from 'react'
import {
  Archive, Calendar, LayoutGrid, LayoutList, Layers, MapPin, Package,
  Pencil, Plus, Search, Table2, Tag, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { cn, formatCurrency, mediaUrl } from '@/lib/utils'
import { ASSET_STATUSES, RENTAL_ASSET_KINDS, type RentalAsset, type RentalBooking } from './rentalConstants'
import { assetCardAvailability } from './rentalDates'
import { CardGridSkeleton, RentalEmptyState, StatusBadge, CapacityBar } from './RentalPrimitives'

type ViewMode = 'cards' | 'list' | 'table'

const VIEW_STORAGE_KEY = 'kiterp:rental-assets:viewMode'

const VIEW_OPTIONS: { id: ViewMode; label: string; title: string; icon: typeof LayoutGrid }[] = [
  { id: 'cards', label: 'Cards', title: 'Card grid', icon: LayoutGrid },
  { id: 'list', label: 'List', title: 'Compact list', icon: LayoutList },
  { id: 'table', label: 'Table', title: 'Dense table', icon: Table2 },
]

type Props = {
  assets: RentalAsset[]
  allBookings: RentalBooking[]
  loading: boolean
  salesAreaLabelById: Map<string, string>
  q: string
  onQChange: (v: string) => void
  status: string
  onStatusChange: (v: string) => void
  category: string
  onCategoryChange: (v: string) => void
  onCreate: () => void
  /** Open master in display / view mode (card click). */
  onView?: (asset: RentalAsset) => void
  onEdit: (asset: RentalAsset) => void
}

function priceParts(a: RentalAsset) {
  const parts: string[] = []
  parts.push(`${formatCurrency(Number(a.daily_rate || 0))}/day`)
  if (Number(a.price_per_unit) > 0) {
    parts.push(`${formatCurrency(Number(a.price_per_unit))}/${a.pricing_uom || a.capacity_unit || 'unit'}`)
  }
  if (Number(a.monthly_rate) > 0) parts.push(`${formatCurrency(Number(a.monthly_rate))}/mo`)
  if (Number(a.deposit_amount) > 0) parts.push(`deposit ${formatCurrency(Number(a.deposit_amount))}`)
  return parts
}

function kindLabel(a: RentalAsset) {
  return [
    (a.category || '').replace(/_/g, ' '),
    a.asset_type ? String(a.asset_type).replace(/_/g, ' ') : '',
  ].filter(Boolean).join(' · ')
}

function readStoredView(): ViewMode {
  try {
    const v = localStorage.getItem(VIEW_STORAGE_KEY)
    if (v === 'cards' || v === 'list' || v === 'table') return v
  } catch { /* ignore */ }
  return 'cards'
}

function AssetThumb({ url, size = 'md' }: { url?: string | null; size?: 'sm' | 'md' }) {
  const box = size === 'sm' ? 'h-9 w-9' : 'h-14 w-14'
  const icon = size === 'sm' ? 'h-4 w-4' : 'h-6 w-6'
  return (
    <div className={cn('relative shrink-0 overflow-hidden rounded-lg border border-border bg-muted', box)}>
      {url ? (
        <img src={mediaUrl(url)} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground/50">
          <Package className={icon} />
        </div>
      )}
    </div>
  )
}

function capacityUnitLabel(unit?: string | null) {
  const u = (unit || '').trim()
  if (!u || u.toLowerCase() === 'units') return ''
  return u.toLowerCase()
}

function shortRouteLabel(label?: string): { primary: string; secondary: string } {
  if (!label) return { primary: '', secondary: '' }
  // Prefer "Name" without the trailing "(CODE)" when both are present.
  const m = label.match(/^(.*?)\s*\(([^)]+)\)\s*$/)
  if (m) return { primary: m[1].trim(), secondary: m[2].trim() }
  return { primary: label, secondary: '' }
}

function AssetMetaChips({
  a,
  routeLabel,
  availability,
}: {
  a: RentalAsset
  routeLabel?: string
  availability: ReturnType<typeof assetCardAvailability>
}) {
  return (
    <>
      {a.max_weight != null && (
        <span className="inline-flex items-center rounded-md bg-muted/60 px-1.5 py-0.5 text-[11px] text-muted-foreground">
          {a.max_weight} {a.weight_unit || 'kg'}
        </span>
      )}
      {routeLabel && (
        <span
          className="inline-flex max-w-[14rem] items-center gap-1 truncate rounded-md bg-muted/60 px-1.5 py-0.5 text-[11px] text-muted-foreground"
          title={routeLabel}
        >
          <MapPin className="h-3 w-3 shrink-0 opacity-70" />
          <span className="truncate">{routeLabel}</span>
        </span>
      )}
      {a.location && !routeLabel && (
        <span className="inline-flex max-w-[10rem] items-center gap-1 truncate rounded-md bg-muted/60 px-1.5 py-0.5 text-[11px] text-muted-foreground">
          <MapPin className="h-3 w-3 shrink-0 opacity-70" />
          <span className="truncate">{a.location}</span>
        </span>
      )}
      {a.unit_mode === 'hierarchy' && (a.child_count ?? 0) > 0 && (
        <span className="inline-flex items-center gap-1 rounded-md bg-sky-500/10 px-1.5 py-0.5 text-[11px] font-medium text-sky-700 dark:text-sky-300">
          <Layers className="h-3 w-3" />
          {a.child_count} sub
        </span>
      )}
      {a.unit_mode === 'serialized' && (a.unit_count ?? 0) > 0 && (
        <span className="inline-flex items-center gap-1 rounded-md bg-violet-500/10 px-1.5 py-0.5 text-[11px] font-medium text-violet-700 dark:text-violet-300">
          <Tag className="h-3 w-3" />
          {a.unit_count} units
        </span>
      )}
      {a.is_bookable === false && (
        <span className="inline-flex items-center gap-1 rounded-md bg-slate-500/10 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-400">
          <Archive className="h-3 w-3" />
          Container
        </span>
      )}
      <span
        className={cn(
          'inline-flex max-w-full items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-[11px]',
          availability.kind === 'range'
            ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
            : 'bg-amber-500/10 text-amber-800 dark:text-amber-300',
        )}
      >
        <Calendar className="h-3 w-3 shrink-0" />
        {availability.kind === 'range' ? (
          <span className="truncate">
            <span className="font-medium">{availability.label}</span>
            {availability.detail ? ` · ${availability.detail}` : ''}
          </span>
        ) : (
          <span className="truncate">{availability.label}</span>
        )}
      </span>
    </>
  )
}

export default function RentalAssetsTab({
  assets, allBookings, loading, salesAreaLabelById,
  q, onQChange, status, onStatusChange, category, onCategoryChange,
  onCreate, onView, onEdit,
}: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>(readStoredView)

  const setViewModePersisted = (mode: ViewMode) => {
    setViewMode(mode)
    try { localStorage.setItem(VIEW_STORAGE_KEY, mode) } catch { /* ignore */ }
  }

  const filtered = useMemo(() => {
    return assets.filter((a) => {
      if (status && a.status !== status) return false
      if (category && a.category !== category) return false
      if (q) {
        const needle = q.toLowerCase()
        const hay = `${a.name} ${a.asset_code || ''} ${a.location || ''} ${a.rack_number || ''}`.toLowerCase()
        if (!hay.includes(needle)) return false
      }
      return true
    })
  }, [assets, q, status, category])

  const hasActiveFilters = Boolean(q || status || category)
  const clearFilters = () => {
    onQChange('')
    onStatusChange('')
    onCategoryChange('')
  }

  const openMaster = (a: RentalAsset) => (onView || onEdit)(a)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-8" placeholder="Search assets…" value={q} onChange={(e) => onQChange(e.target.value)} />
          </div>
          <Select
            value={category || '__all__'}
            onChange={(v) => onCategoryChange(v === '__all__' ? '' : v)}
            options={[{ value: '__all__', label: 'All kinds' }, ...RENTAL_ASSET_KINDS]}
            wrapperClassName="w-44"
          />
          <Select
            value={status || '__all__'}
            onChange={(v) => onStatusChange(v === '__all__' ? '' : v)}
            options={[{ value: '__all__', label: 'All statuses' }, ...ASSET_STATUSES]}
            wrapperClassName="w-48"
          />
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" /> Clear filters
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5 text-xs"
            role="group"
            aria-label="Show as"
          >
            {VIEW_OPTIONS.map(({ id, label, title, icon: Icon }) => (
              <button
                key={id}
                type="button"
                title={title}
                aria-pressed={viewMode === id}
                onClick={() => setViewModePersisted(id)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium transition-all',
                  viewMode === id
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
          <Button size="sm" onClick={onCreate}>
            <Plus className="mr-1 h-4 w-4" /> Add Rental Asset
          </Button>
        </div>
      </div>

      {!loading && (
        <p className="text-xs text-muted-foreground">
          {filtered.length} of {assets.length} asset{assets.length === 1 ? '' : 's'}
          <span className="text-muted-foreground/70"> · showing as {viewMode}</span>
        </p>
      )}

      {loading ? (
        <CardGridSkeleton count={4} />
      ) : filtered.length === 0 ? (
        <RentalEmptyState
          icon={Package}
          title={assets.length === 0 ? 'No rental assets yet' : 'No assets match these filters'}
          description={
            assets.length === 0
              ? 'Add your first rentable rack, unit, or item to get started.'
              : 'Try clearing filters or searching a different term.'
          }
          action={
            assets.length === 0 ? (
              <Button size="sm" onClick={onCreate}><Plus className="mr-1 h-4 w-4" /> Add Rental Asset</Button>
            ) : (
              <Button size="sm" variant="outline" onClick={clearFilters}>Clear filters</Button>
            )
          }
        />
      ) : viewMode === 'cards' ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((a) => {
            const availability = assetCardAvailability(a, allBookings)
            const routeLabel = a.sales_area_id ? salesAreaLabelById.get(a.sales_area_id) : undefined
            const prices = priceParts(a)
            const kind = kindLabel(a)

            return (
              <div
                key={a.id}
                role="button"
                tabIndex={0}
                onClick={() => openMaster(a)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    openMaster(a)
                  }
                }}
                className="group flex cursor-pointer flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/35 hover:bg-muted/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex gap-3 p-3 pb-2.5">
                  <AssetThumb url={a.image_url} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold leading-snug text-foreground">{a.name}</p>
                        <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
                          {a.asset_code ? (
                            <span className="inline-flex max-w-full truncate whitespace-nowrap rounded bg-muted px-1.5 py-px font-mono text-[10px] font-medium tracking-wide text-muted-foreground" title="Asset master ID">
                              {a.asset_code}
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground/60">No master ID</span>
                          )}
                          {kind ? <span className="truncate text-[11px] capitalize text-muted-foreground">{kind}</span> : null}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <StatusBadge status={a.status} />
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground opacity-70 hover:opacity-100" onClick={() => onEdit(a)} title="Edit asset">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-1 flex-col gap-2 px-3 pb-2.5">
                  <CapacityBar
                    used={Number(a.current_occupancy || 0)}
                    max={Number(a.capacity_max || 0)}
                    unit={a.capacity_unit}
                    available={a.available_capacity !== undefined ? Number(a.available_capacity) : undefined}
                  />
                  <div className="flex flex-wrap items-center gap-1">
                    <AssetMetaChips a={a} routeLabel={routeLabel} availability={availability} />
                  </div>
                </div>

                <div className="mt-auto border-t border-border/70 bg-muted/20 px-3 py-2">
                  <p className="truncate text-xs font-medium text-foreground sm:text-sm" title={prices.join(' · ')}>
                    {prices.join(' · ')}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      ) : viewMode === 'list' ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card divide-y divide-border">
          {filtered.map((a) => {
            const availability = assetCardAvailability(a, allBookings)
            const routeLabel = a.sales_area_id ? salesAreaLabelById.get(a.sales_area_id) : undefined
            const prices = priceParts(a)
            const kind = kindLabel(a)
            return (
              <div
                key={a.id}
                role="button"
                tabIndex={0}
                onClick={() => openMaster(a)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    openMaster(a)
                  }
                }}
                className="flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <AssetThumb url={a.image_url} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                    <p className="truncate font-semibold text-foreground">{a.name}</p>
                    {a.asset_code ? (
                      <span className="whitespace-nowrap rounded bg-muted px-1.5 py-px font-mono text-[10px] font-medium tracking-wide text-muted-foreground">
                        {a.asset_code}
                      </span>
                    ) : null}
                    <StatusBadge status={a.status} />
                  </div>
                  <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1">
                    {kind ? <span className="text-[11px] capitalize text-muted-foreground">{kind}</span> : null}
                    <AssetMetaChips a={a} routeLabel={routeLabel} availability={availability} />
                  </div>
                </div>
                <div className="hidden min-w-[7.5rem] shrink-0 text-right sm:block">
                  <p className="truncate text-xs font-medium text-foreground" title={prices[0]}>{prices[0]}</p>
                  {prices[1] ? <p className="truncate text-[11px] text-muted-foreground">{prices.slice(1).join(' · ')}</p> : null}
                </div>
                <div className="hidden w-28 shrink-0 md:block" onClick={(e) => e.stopPropagation()}>
                  <CapacityBar
                    used={Number(a.current_occupancy || 0)}
                    max={Number(a.capacity_max || 0)}
                    unit={a.capacity_unit}
                    available={a.available_capacity !== undefined ? Number(a.available_capacity) : undefined}
                  />
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 shrink-0 p-0 text-muted-foreground"
                  onClick={(e) => { e.stopPropagation(); onEdit(a) }}
                  title="Edit asset"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="sticky top-0 z-[1] whitespace-nowrap px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Asset</th>
                  <th className="sticky top-0 z-[1] whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Master ID</th>
                  <th className="sticky top-0 z-[1] whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                  <th className="sticky top-0 z-[1] min-w-[9rem] whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Capacity</th>
                  <th className="sticky top-0 z-[1] min-w-[11rem] whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Route</th>
                  <th className="sticky top-0 z-[1] min-w-[10rem] whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Availability</th>
                  <th className="sticky top-0 z-[1] min-w-[9rem] whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Pricing</th>
                  <th className="sticky top-0 z-[1] w-12 px-2 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a, idx) => {
                  const availability = assetCardAvailability(a, allBookings)
                  const routeRaw = a.sales_area_id ? salesAreaLabelById.get(a.sales_area_id) : undefined
                  const route = shortRouteLabel(routeRaw)
                  const prices = priceParts(a)
                  const kind = kindLabel(a)
                  const max = Number(a.capacity_max || 0)
                  const avail = a.available_capacity !== undefined
                    ? Number(a.available_capacity)
                    : Math.max(0, max - Number(a.current_occupancy || 0))
                  const usedPct = max > 0 ? Math.min(100, Math.round(((max - avail) / max) * 100)) : 0
                  const unit = capacityUnitLabel(a.capacity_unit)
                  return (
                    <tr
                      key={a.id}
                      className={cn(
                        'group cursor-pointer border-b border-border/80 transition-colors last:border-b-0 hover:bg-primary/[0.03]',
                        idx % 2 === 1 && 'bg-muted/15',
                      )}
                      onClick={() => openMaster(a)}
                    >
                      <td className="px-4 py-3 align-middle">
                        <div className="flex min-w-0 items-center gap-3">
                          <AssetThumb url={a.image_url} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate font-semibold leading-snug text-foreground">{a.name}</p>
                            {kind ? (
                              <p className="mt-0.5 truncate text-[11px] capitalize text-muted-foreground">{kind}</p>
                            ) : null}
                            {a.is_bookable === false && (
                              <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-slate-500">
                                <Archive className="h-2.5 w-2.5" /> Container
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 align-middle">
                        {a.asset_code ? (
                          <span className="inline-flex whitespace-nowrap rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] font-medium tracking-wide text-muted-foreground">
                            {a.asset_code}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground/45">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 align-middle">
                        <StatusBadge status={a.status} />
                      </td>
                      <td className="px-3 py-3 align-middle">
                        <div className="min-w-[8rem] space-y-1">
                          <p className="text-xs tabular-nums text-muted-foreground">
                            <span className="font-semibold text-foreground">{avail}</span>
                            {' / '}
                            {max}
                            {unit ? ` ${unit}` : ''}
                          </p>
                          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn(
                                'h-full rounded-full transition-all',
                                usedPct >= 100 ? 'bg-rose-500' : usedPct > 60 ? 'bg-amber-500' : 'bg-emerald-500',
                              )}
                              style={{ width: `${usedPct}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-muted-foreground">{usedPct}% used</p>
                        </div>
                      </td>
                      <td className="px-3 py-3 align-middle">
                        {route.primary || a.location ? (
                          <div className="min-w-0 max-w-[14rem]" title={routeRaw || a.location || undefined}>
                            <p className="truncate text-xs font-medium text-foreground">
                              {route.primary || a.location}
                            </p>
                            {route.secondary ? (
                              <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">{route.secondary}</p>
                            ) : a.location && route.primary ? (
                              <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{a.location}</p>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground/45">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 align-middle">
                        <div
                          className={cn(
                            'inline-flex max-w-[13rem] flex-col gap-0.5 rounded-lg px-2 py-1 text-[11px]',
                            availability.kind === 'range'
                              ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                              : 'bg-amber-500/10 text-amber-800 dark:text-amber-300',
                          )}
                        >
                          <span className="inline-flex items-center gap-1 font-medium">
                            <Calendar className="h-3 w-3 shrink-0" />
                            {availability.label}
                          </span>
                          {availability.kind === 'range' && availability.detail ? (
                            <span className="pl-4 text-[10px] leading-snug opacity-90">{availability.detail}</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-3 align-middle">
                        <div className="min-w-[8.5rem] space-y-0.5" title={prices.join(' · ')}>
                          <p className="text-xs font-semibold tabular-nums text-foreground">{prices[0]}</p>
                          {prices.length > 1 ? (
                            <p className="text-[11px] leading-snug text-muted-foreground">
                              {prices.slice(1).join(' · ')}
                            </p>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-2 py-3 text-right align-middle" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-muted-foreground opacity-60 transition-opacity group-hover:opacity-100"
                          onClick={() => onEdit(a)}
                          title="Edit asset"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
