import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { ThemeSelect } from '@/components/common/ThemeSelect'
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
  searchWrapperClassName = 'w-48 min-w-[9rem]',
}: Props) {
  return (
    <div
      className={`flex flex-nowrap items-center gap-3 overflow-x-auto border-b border-border bg-muted/40 px-4 py-3 ${className}`}
    >
      {leading && (
        <div className="flex flex-nowrap items-center gap-3 shrink-0">
          {leading}
        </div>
      )}
      {!hideSearch && (
        <div className={`relative shrink-0 ${searchWrapperClassName}`}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-10" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-10 h-9 w-full"
            aria-label="Filter table"
          />
        </div>
      )}
      <div className="flex flex-nowrap items-center gap-2 ml-auto shrink-0 pl-1">
        {hint && <span className="text-xs text-muted-foreground hidden xl:inline whitespace-nowrap">{hint}</span>}
        <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Sort</span>
        <ThemeSelect
          value={sortKey}
          onChange={onSortKeyChange}
          options={sortOptions.map((o) => ({ value: o.value, label: o.label }))}
          aria-label="Sort by column"
          wrapperClassName="w-[7.5rem] shrink-0"
        />
        <ThemeSelect
          value={sortDir}
          onChange={(v) => onSortDirChange(v as SortDir)}
          options={[
            { value: 'asc', label: 'Low → High' },
            { value: 'desc', label: 'High → Low' },
          ]}
          aria-label="Sort direction"
          wrapperClassName="w-[7.5rem] shrink-0"
        />
        {extra}
      </div>
    </div>
  )
}
