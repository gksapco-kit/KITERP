import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import type { SortDir } from '@/lib/tableList'

const SORT_DIR_OPTIONS = [
  { value: 'asc', label: 'A → Z / Low → High' },
  { value: 'desc', label: 'Z → A / High → Low' },
]

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
    'h-9 w-full min-w-0 rounded-md border border-gray-200 bg-white px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary'

  return (
    <div
      className={`flex flex-col sm:flex-row gap-3 flex-wrap items-stretch sm:items-center border-b bg-muted/40 px-4 py-3 ${className}`}
    >
      {!hideSearch && (
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
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
        {hint && <span className="text-xs text-muted-foreground hidden md:inline max-w-[14rem]">{hint}</span>}
        <span className="text-xs font-medium text-muted-foreground">Sort</span>
        <div className="w-[8rem] shrink-0 overflow-hidden">
          <Select
            value={sortKey}
            onChange={onSortKeyChange}
            options={sortOptions}
            className={selectCls}
            aria-label="Sort by column"
          />
        </div>
        <div className="w-[10rem] shrink-0 overflow-hidden">
          <Select
            value={sortDir}
            onChange={(v) => onSortDirChange(v as SortDir)}
            options={SORT_DIR_OPTIONS}
            className={selectCls}
            aria-label="Sort direction"
          />
        </div>
        {extra}
      </div>
    </div>
  )
}
