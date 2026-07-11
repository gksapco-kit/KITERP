import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'

export const TABLE_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const

export type TablePaginationProps = {
  page: number
  /** Total pages (minimum treated as 1). */
  pages: number
  total: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  /** Plural noun used in the default count, e.g. "products", "orders". */
  itemLabel?: string
  /** Override the left-side count text entirely. */
  countLabel?: ReactNode
  /** Extra text after the default count (e.g. " · 6 variant rows"). */
  countSuffix?: ReactNode
  pageSizeOptions?: number[]
  rowsPerPageLabel?: string
  className?: string
}

function defaultCountLabel(page: number, pageSize: number, total: number, itemLabel: string) {
  if (total <= 0) return `0 ${itemLabel}`
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  return `${from}–${to} of ${total} ${itemLabel}`
}

/**
 * Shared table footer: count · rows-per-page (menu opens upward) · prev/next.
 * Matches the Products list pagination UX across vendor-web tables.
 */
export function TablePagination({
  page,
  pages,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange,
  itemLabel = 'items',
  countLabel,
  countSuffix,
  pageSizeOptions = [...TABLE_PAGE_SIZE_OPTIONS],
  rowsPerPageLabel = 'Rows per page',
  className,
}: TablePaginationProps) {
  const totalPages = Math.max(1, pages || 1)
  const sizeOptions = pageSizeOptions.includes(pageSize)
    ? pageSizeOptions
    : [...pageSizeOptions, pageSize].sort((a, b) => a - b)

  return (
    <div
      className={cn(
        'flex flex-col gap-3 border-t bg-gray-50/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5',
        className,
      )}
    >
      <span className="min-w-0 text-[13px] leading-snug text-gray-500">
        {countLabel ?? defaultCountLabel(page, pageSize, total, itemLabel)}
        {countSuffix}
      </span>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 sm:justify-end sm:gap-x-5">
        <div className="flex items-center gap-1.5 shrink-0">
          <Select
            value={String(pageSize)}
            onChange={(v) => {
              onPageSizeChange(Number(v))
              onPageChange(1)
            }}
            options={sizeOptions.map((n) => ({ value: String(n), label: String(n) }))}
            aria-label={rowsPerPageLabel}
            menuPlacement="top"
            wrapperClassName="w-auto"
            className="h-7 w-[4.25rem] text-xs"
          />
          <span className="text-[12px] text-gray-400 whitespace-nowrap">{rowsPerPageLabel}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-[12px] text-gray-500 px-2 tabular-nums whitespace-nowrap">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            aria-label="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
