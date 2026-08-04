import { useMemo } from 'react'
import { Calendar, MapPin, Package, Pencil, Plus, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { formatCurrency } from '@/lib/utils'
import { ASSET_STATUSES, RENTAL_CATEGORIES, type RentalAsset, type RentalBooking } from './rentalConstants'
import { assetCardAvailability } from './rentalDates'
import { CardGridSkeleton, RentalEmptyState, StatusBadge, CapacityBar } from './RentalPrimitives'

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
  onEdit: (asset: RentalAsset) => void
}

export default function RentalAssetsTab({
  assets, allBookings, loading, salesAreaLabelById,
  q, onQChange, status, onStatusChange, category, onCategoryChange,
  onCreate, onEdit,
}: Props) {
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
            options={[{ value: '__all__', label: 'All categories' }, ...RENTAL_CATEGORIES]}
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
        <Button size="sm" onClick={onCreate}>
          <Plus className="mr-1 h-4 w-4" /> Add Rental Asset
        </Button>
      </div>

      {!loading && (
        <p className="text-xs text-muted-foreground">
          {filtered.length} of {assets.length} asset{assets.length === 1 ? '' : 's'}
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
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((a) => {
            const availability = assetCardAvailability(a, allBookings)
            return (
              <div key={a.id} className="space-y-3 rounded-xl border border-border bg-card p-4">
                <div className="flex justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">{a.name}</p>
                    <p className="mt-0.5 text-xs capitalize text-muted-foreground">
                      {(a.category || '').replace(/_/g, ' ')}
                      {a.asset_type ? ` · ${String(a.asset_type).replace(/_/g, ' ')}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-start gap-2">
                    <StatusBadge status={a.status} />
                    <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => onEdit(a)} title="Edit asset">
                      <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                    </Button>
                  </div>
                </div>
                <CapacityBar
                  used={Number(a.current_occupancy || 0)}
                  max={Number(a.capacity_max || 0)}
                  unit={a.capacity_unit}
                />
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {a.max_weight != null && <span>⚖ {a.max_weight} {a.weight_unit}</span>}
                  {a.sales_area_id && salesAreaLabelById.get(a.sales_area_id) && (
                    <span>Route · {salesAreaLabelById.get(a.sales_area_id)}</span>
                  )}
                  {a.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{a.location}</span>}
                </div>
                <div className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs ${
                  availability.kind === 'range'
                    ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                    : 'bg-amber-500/10 text-amber-800 dark:text-amber-300'
                }`}>
                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                  {availability.kind === 'range' ? (
                    <span><span className="font-medium">{availability.label}</span>{' · '}{availability.detail}</span>
                  ) : (
                    <span>{availability.label}</span>
                  )}
                </div>
                <p className="text-sm text-foreground">
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
  )
}
