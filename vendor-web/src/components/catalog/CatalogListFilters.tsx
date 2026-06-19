import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const catalogFilterSelectClass =
  'h-9 min-w-[9.5rem] rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-shadow'

export type CatalogFilterOption = { value: string; label: string }

type CatalogFilterFieldProps = {
  label: string
  value: string
  onChange: (value: string) => void
  options: CatalogFilterOption[]
  placeholder?: string
}

export function CatalogFilterField({ label, value, onChange, options, placeholder = 'All' }: CatalogFilterFieldProps) {
  return (
    <div className="flex min-w-[9.5rem] flex-col gap-1.5">
      <label className="block text-xs font-medium leading-none text-gray-400 uppercase tracking-wider">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${catalogFilterSelectClass} w-full`}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value || opt.label} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}

export type CatalogActiveFilter = { key: string; label: string; onRemove: () => void }

type CatalogListFiltersPanelProps = {
  activeFilters: CatalogActiveFilter[]
  onClearAll: () => void
  children: React.ReactNode
}

export function CatalogListFiltersPanel({ activeFilters, onClearAll, children }: CatalogListFiltersPanelProps) {
  return (
    <div className="space-y-3 border-t pt-3">
      <div className="flex flex-wrap items-end gap-3">
        {children}
      </div>
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Active</span>
          {activeFilters.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={filter.onRemove}
              className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors"
            >
              {filter.label}
              <X className="w-3 h-3 text-gray-400" />
            </button>
          ))}
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-gray-500" onClick={onClearAll}>
            Clear all
          </Button>
        </div>
      )}
    </div>
  )
}

export const PRODUCT_STATUS_FILTER_OPTIONS: CatalogFilterOption[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
]

export const VISIBILITY_FILTER_OPTIONS: CatalogFilterOption[] = [
  { value: 'true', label: 'Visible on storefront' },
  { value: 'false', label: 'Hidden from storefront' },
]

export const PRODUCT_TYPE_FILTER_OPTIONS: CatalogFilterOption[] = [
  { value: 'physical', label: 'Physical' },
  { value: 'digital', label: 'Digital' },
  { value: 'subscription', label: 'Subscription' },
  { value: 'bundle', label: 'Bundle' },
]

export const PRODUCT_STOCK_FILTER_OPTIONS: CatalogFilterOption[] = [
  { value: 'in_stock', label: 'In stock' },
  { value: 'low_stock', label: 'Low stock' },
  { value: 'out_of_stock', label: 'Out of stock' },
]
