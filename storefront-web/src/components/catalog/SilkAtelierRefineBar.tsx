import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { PriceBand } from '@/components/catalog/SilkAtelierCollectionHeader'

function RefinePill({
  label,
  children,
  primary,
}: {
  label: ReactNode
  children: ReactNode
  primary: string
}) {
  return (
    <div
      className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-full border px-3 py-1.5 text-sm"
      style={{ borderColor: `${primary}55`, color: primary }}
    >
      {label}
      {children}
    </div>
  )
}

/** “REFINE” row — price, collection, sort pills like boutique category pages. */
export function SilkAtelierRefineBar({
  count,
  primary,
  accent,
  bodyFont,
  headingFont,
  categories,
  selectedCategory,
  collectionLabel,
  onCategoryChange,
  priceBands,
  activeBandKey,
  onPickBand,
  sortBy,
  onSortChange,
}: {
  count: number
  primary: string
  accent: string
  bodyFont?: string
  headingFont?: string
  categories: { name: string; label: string }[]
  selectedCategory: string
  /** Banner title when it differs from the category filter (from ?collection=). */
  collectionLabel?: string
  onCategoryChange: (name: string) => void
  priceBands: PriceBand[]
  activeBandKey: string | null
  onPickBand: (band: PriceBand | null) => void
  sortBy: string
  onSortChange: (value: string) => void
}) {
  const sans = bodyFont ? `"${bodyFont}", system-ui, sans-serif` : 'system-ui, sans-serif'
  const serif = headingFont ? `"${headingFont}", Georgia, serif` : 'Georgia, serif'
  const activeBand = priceBands.find((b) => b.key === activeBandKey)

  return (
    <div
      className="mb-4 flex flex-col gap-3 border-b border-black/[0.06] pb-4 sm:flex-row sm:items-center sm:justify-between"
      style={{ fontFamily: sans }}
      data-testid="silk-refine-bar"
    >
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <span
          className="mr-1 text-[11px] font-semibold uppercase tracking-[0.28em]"
          style={{ color: accent, fontFamily: serif }}
        >
          Refine
        </span>

        {priceBands.length > 0 ? (
          <RefinePill primary={primary} label={<span className="shrink-0 whitespace-nowrap">Price Range</span>}>
            <Select
              value={activeBandKey || '__all__'}
              onValueChange={(v) => {
                if (v === '__all__') onPickBand(null)
                else onPickBand(priceBands.find((b) => b.key === v) || null)
              }}
            >
              <SelectTrigger
                className="h-7 min-w-[7rem] max-w-[11rem] border-0 bg-transparent p-0 text-sm font-normal shadow-none focus:ring-0"
                aria-label="Price range"
              >
                <SelectValue placeholder="All">{activeBand?.label || 'All'}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All prices</SelectItem>
                {priceBands.map((b) => (
                  <SelectItem key={b.key} value={b.key}>
                    {b.label} ({b.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
          </RefinePill>
        ) : null}

        {categories.length > 0 ? (
          <RefinePill primary={primary} label={<span className="shrink-0 whitespace-nowrap">Collection</span>}>
            <Select
              value={selectedCategory || '__all__'}
              onValueChange={(v) => onCategoryChange(v === '__all__' ? '' : v)}
            >
              <SelectTrigger
                className="h-7 min-w-[6rem] max-w-[12rem] border-0 bg-transparent p-0 text-sm font-normal shadow-none focus:ring-0"
                aria-label="Collection"
              >
                <SelectValue placeholder="All">{collectionLabel || selectedCategory || 'All'}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All collections</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.name} value={c.name}>
                    {c.label.trim() || c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
          </RefinePill>
        ) : null}

        <RefinePill primary={primary} label={<span className="shrink-0 whitespace-nowrap">Just Arrived</span>}>
          <Select
            value={sortBy === 'newest' ? 'newest' : '__any__'}
            onValueChange={(v) => onSortChange(v === 'newest' ? 'newest' : 'default')}
          >
            <SelectTrigger
              className="h-7 min-w-[5rem] border-0 bg-transparent p-0 text-sm font-normal shadow-none focus:ring-0"
              aria-label="Just arrived"
            >
              <SelectValue>{sortBy === 'newest' ? 'New first' : 'Any'}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__any__">Any</SelectItem>
              <SelectItem value="newest">New first</SelectItem>
            </SelectContent>
          </Select>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
        </RefinePill>
      </div>

      <p className="text-right text-sm italic tabular-nums" style={{ color: primary, fontFamily: serif }}>
        <strong className="font-semibold not-italic">{count.toLocaleString('en-IN')}</strong>{' '}
        {count === 1 ? 'piece' : 'pieces'}
      </p>
    </div>
  )
}
