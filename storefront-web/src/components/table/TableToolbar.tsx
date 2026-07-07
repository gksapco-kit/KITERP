import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import type { SortDir } from '@/lib/tableList'

export type TableSortOption = { value: string; label: string }

type Props = {
  search: string
  onSearchChange: (v: string) => void
  searchPlaceholder?: string
  hideSearch?: boolean
  sortOptions: TableSortOption[]
  sortKey: string
  sortDir: SortDir
  onSortKeyChange: (k: string) => void
  onSortDirChange: (d: SortDir) => void
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
    'h-9 w-full min-w-0 rounded-md border border-gray-200 bg-white px-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-500'

  return (
    <div
      className={`flex flex-col gap-3 flex-wrap items-stretch border-b border-gray-100 bg-gray-50/90 px-3 py-3 sm:flex-row sm:items-center sm:px-4 rounded-t-xl ${className}`}
    >
      {!hideSearch && (
        <div className="relative w-full min-w-0 sm:flex-1 sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-10 h-9"
            aria-label="Filter list"
          />
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 w-full sm:flex sm:flex-wrap sm:items-center sm:gap-2 sm:ml-auto sm:w-auto">
        {hint && <span className="col-span-2 text-xs text-gray-400 hidden md:inline max-w-[14rem] sm:col-span-1">{hint}</span>}
        <span className="col-span-2 text-xs font-medium text-gray-500 sm:col-span-1 sm:inline hidden sm:inline">Sort</span>
        <div className="min-w-0">
          <select
            value={sortKey}
            onChange={(e) => onSortKeyChange(e.target.value)}
            className={selectCls}
            aria-label="Sort by"
          >
            {sortOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0">
          <select
            value={sortDir}
            onChange={(e) => onSortDirChange(e.target.value as SortDir)}
            className={selectCls}
            aria-label="Sort direction"
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </div>
        {extra}
      </div>
    </div>
  )
}
