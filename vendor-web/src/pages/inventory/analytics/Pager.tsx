import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export const PAGE_SIZE = 50

/** Client-side paging over an already-fetched list. Resets to page 1 when the list changes. */
export function usePaged<T>(items: T[], resetKey: unknown = items.length, pageSize = PAGE_SIZE) {
  const [page, setPage] = useState(0)
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))

  useEffect(() => { setPage(0) }, [resetKey])

  const safePage = Math.min(page, pageCount - 1)
  const rows = items.slice(safePage * pageSize, safePage * pageSize + pageSize)
  return { rows, page: safePage, setPage, pageCount, total: items.length, pageSize }
}

export function Pager({
  page, pageCount, total, pageSize = PAGE_SIZE, onChange, serverTotal,
}: {
  page: number
  pageCount: number
  total: number
  pageSize?: number
  onChange: (p: number) => void
  /** Total reported by the API; when larger than `total` the list was capped server-side. */
  serverTotal?: number
}) {
  if (total === 0) return null
  const from = page * pageSize + 1
  const to = Math.min(total, (page + 1) * pageSize)
  const capped = serverTotal != null && serverTotal > total
  return (
    <div className="flex items-center justify-between gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
      <span>
        Showing {from}–{to} of {total}
        {capped && ` (first ${total} of ${serverTotal} loaded — narrow filters to see the rest)`}
      </span>
      {pageCount > 1 && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => onChange(page - 1)}
            className="rounded border p-1 disabled:opacity-40 hover:bg-accent"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="px-1">Page {page + 1} / {pageCount}</span>
          <button
            type="button"
            disabled={page >= pageCount - 1}
            onClick={() => onChange(page + 1)}
            className="rounded border p-1 disabled:opacity-40 hover:bg-accent"
            aria-label="Next page"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
