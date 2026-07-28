import { useState } from 'react'
import { Search, SlidersHorizontal, Info } from 'lucide-react'
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
      {hint ? (
        <button
          type="button"
          className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground sm:inline-flex"
          title={hint}
          aria-label={hint}
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      ) : null}
      <span className="shrink-0 text-[11px] font-medium text-muted-foreground">Sort</span>
      {/* Stay in a 2-col grid until lg — dashboard cards are half-width from lg and overflow with fixed select widths */}
      <div className="grid min-w-0 w-full flex-1 grid-cols-2 gap-1.5 lg:flex lg:w-auto lg:flex-none lg:items-center">
        <ThemeSelect
          value={sortKey}
          onChange={onSortKeyChange}
          options={sortOptions.map((o) => ({ value: o.value, label: o.label }))}
          aria-label="Sort by column"
          className="h-8 text-xs"
          wrapperClassName="min-w-0 w-full lg:w-[7.5rem]"
        />
        <ThemeSelect
          value={sortDir}
          onChange={(v) => onSortDirChange(v as SortDir)}
          options={[
            { value: 'asc', label: 'Asc' },
            { value: 'desc', label: 'Desc' },
          ]}
          aria-label="Sort direction"
          className="h-8 text-xs"
          wrapperClassName="min-w-0 w-full lg:w-[5.5rem]"
          menuMinWidth={100}
        />
      </div>
      {extra ? <div className="w-full min-w-0 lg:w-auto">{extra}</div> : null}
    </>
  )

  const pushSortRight = hideSearch && !leading && !hasMoreOptions

  return (
    <div className="min-w-0 max-w-full overflow-hidden border-b border-border/60 bg-muted/25">
      <div className={cn('flex min-w-0 max-w-full flex-wrap items-center gap-1.5 px-3 py-2 sm:gap-2', className)}>
        {(leading || moreOptionsButton) && (
          <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-2">
            {leading}
            {moreOptionsButton}
          </div>
        )}
        {!hideSearch && (
          <div className={`relative min-w-0 max-w-full ${searchWrapperClassName}`}>
            <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              data-kiterp-search-field
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-8 w-full pl-10"
              aria-label="Filter table"
            />
          </div>
        )}
        {!hideSort && (
          <div
            className={cn(
              'flex min-w-0 w-full max-w-full items-center gap-1.5 lg:w-auto lg:shrink-0',
              pushSortRight && 'lg:ml-auto',
            )}
          >
            {sortControls}
          </div>
        )}
      </div>
      {hasMoreOptions && moreOpen && (
        <div className="border-t border-border/60 bg-muted/15 px-3 py-2">
          {moreOptions}
        </div>
      )}
    </div>
  )
}
