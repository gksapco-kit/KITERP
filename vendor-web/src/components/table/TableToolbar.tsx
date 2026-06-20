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
  return (
    <div
      className={`flex flex-col sm:flex-row gap-3 flex-wrap items-stretch sm:items-center border-b border-border bg-muted/40 px-4 py-3 ${className}`}
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
        <ThemeSelect
          value={sortKey}
          onChange={onSortKeyChange}
          options={sortOptions.map((o) => ({ value: o.value, label: o.label }))}
          aria-label="Sort by column"
          className="min-w-[8rem]"
        />
        <ThemeSelect
          value={sortDir}
          onChange={(v) => onSortDirChange(v as SortDir)}
          options={[
            { value: 'asc', label: 'A → Z / Low → High' },
            { value: 'desc', label: 'Z → A / High → Low' },
          ]}
          aria-label="Sort direction"
          className="min-w-[8rem]"
        />
        {extra}
      </div>
    </div>
  )
}
