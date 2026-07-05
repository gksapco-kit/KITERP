import { useState } from 'react'
import { Search, SlidersHorizontal } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { ThemeSelect } from '@/components/common/ThemeSelect'
import { cn } from '@/lib/utils'
import type { SortDir } from '@/lib/tableList'

export type TableSortOption = { value: string; label: string }

type Props = {
  search: string
  onSearchChange: (v: string) => void
  searchPlaceholder?: string
  /** Hide search field (e.g. when parent already has API search) */
  hideSearch?: boolean
  sortOptions: TableSortOption[]
  sortKey: string
  sortDir: SortDir
  onSortKeyChange: (k: string) => void
  onSortDirChange: (d: SortDir) => void
  /** Shown next to sort controls */
  hint?: string
  className?: string
  extra?: React.ReactNode
  /** Filters or controls shown on the left (e.g. business unit, status) */
  leading?: React.ReactNode
  /** Width/layout classes for the search field wrapper */
  searchWrapperClassName?: string
  /** Secondary filters shown in a collapsible "More options" panel */
  moreOptions?: React.ReactNode
  /** Badge count for active filters inside moreOptions */
  moreOptionsActiveCount?: number
  /** Hide inline sort controls (e.g. when sort lives in moreOptions) */
  hideSort?: boolean
}

export function TableToolbar({
  search,
  onSearchChange,
  searchPlaceholder = 'Filter…',
  hideSearch = false,
  sortOptions,
  sortKey,
  sortDir,
  onSortKeyChange,
  onSortDirChange,
  hint,
  className = '',
  extra,
  leading,
  searchWrapperClassName = 'min-w-[10rem] flex-1 basis-full sm:basis-auto sm:flex-none sm:w-48 lg:w-56 max-w-full',
  moreOptions,
  moreOptionsActiveCount = 0,
  hideSort = false,
}: Props) {
  const [moreOpen, setMoreOpen] = useState(false)
  const hasMoreOptions = Boolean(moreOptions)

  const moreOptionsButton = hasMoreOptions ? (
    <button
      type="button"
      onClick={() => setMoreOpen((v) => !v)}
      aria-expanded={moreOpen}
      title="More filters"
      aria-label={
        moreOptionsActiveCount > 0
          ? `More filters (${moreOptionsActiveCount} active)`
          : 'More filters'
      }
      className={cn(
        'relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors',
        moreOpen || moreOptionsActiveCount > 0
          ? 'border-primary/40 bg-primary/10 text-primary'
          : 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:bg-accent/50 hover:text-foreground',
      )}
    >
      <SlidersHorizontal className="h-4 w-4 shrink-0" />
      {moreOptionsActiveCount > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-0.5 text-[9px] font-bold leading-none text-primary-foreground">
          {moreOptionsActiveCount}
        </span>
      )}
    </button>
  ) : null

  const sortControls = (
    <>
      {hint && <span className="text-xs text-muted-foreground hidden xl:inline whitespace-nowrap">{hint}</span>}
      <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Sort</span>
      <ThemeSelect
        value={sortKey}
        onChange={onSortKeyChange}
        options={sortOptions.map((o) => ({ value: o.value, label: o.label }))}
        aria-label="Sort by column"
        wrapperClassName="w-full min-w-[7rem] sm:w-[8rem]"
      />
      <ThemeSelect
        value={sortDir}
        onChange={(v) => onSortDirChange(v as SortDir)}
        options={[
          { value: 'asc', label: 'Low → High' },
          { value: 'desc', label: 'High → Low' },
        ]}
        aria-label="Sort direction"
        wrapperClassName="w-full min-w-[7rem] sm:w-[8.5rem]"
      />
      {extra}
    </>
  )

  return (
    <div className="border-b border-border bg-muted/40">
      <div className={`flex flex-wrap items-center gap-2 sm:gap-3 px-4 py-3 ${className}`}>
        {(leading || moreOptionsButton) && (
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-w-0 shrink-0">
            {leading}
            {moreOptionsButton}
          </div>
        )}
        {!hideSearch && (
          <div className={`relative min-w-0 ${searchWrapperClassName}`}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-10" />
            <Input
              data-kiterp-search-field
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="pl-10 h-9 w-full"
              aria-label="Filter table"
            />
          </div>
        )}
        {!hideSort && (
          <div className="flex items-center gap-2 shrink-0">
            {sortControls}
          </div>
        )}
      </div>
      {hasMoreOptions && moreOpen && (
        <div className="border-t border-border bg-muted/20 px-4 py-3">
          {moreOptions}
        </div>
      )}
    </div>
  )
}
