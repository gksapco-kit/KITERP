import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
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
}: Props) {
  const selectCls =
    'h-9 rounded-md border border-input bg-background px-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring min-w-[8rem]'

  return (
    <div
      className={`flex flex-col sm:flex-row gap-3 flex-wrap items-stretch sm:items-center border-b border-border bg-muted/40 px-4 py-3 ${className}`}
    >
      {!hideSearch && (
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-10 h-9"
            aria-label="Filter table"
          />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
        {hint && <span className="text-[11px] text-muted-foreground hidden md:inline max-w-[14rem]">{hint}</span>}
        <span className="text-xs font-medium text-muted-foreground">Sort</span>
        <select
          value={sortKey}
          onChange={(e) => onSortKeyChange(e.target.value)}
          className={selectCls}
          aria-label="Sort by column"
        >
          {sortOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          value={sortDir}
          onChange={(e) => onSortDirChange(e.target.value as SortDir)}
          className={selectCls}
          aria-label="Sort direction"
        >
          <option value="asc">A → Z / Low → High</option>
          <option value="desc">Z → A / High → Low</option>
        </select>
        {extra}
      </div>
    </div>
  )
}
