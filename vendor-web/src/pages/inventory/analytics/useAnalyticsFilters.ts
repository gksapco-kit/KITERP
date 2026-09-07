/**
 * Shared filter state for Inventory Analytics, synced to URL search params
 * so report views are bookmarkable and shareable.
 */
import { useSearchParams } from 'react-router-dom'

export interface AnalyticsFilters {
  store_id: string | undefined
  category: string | undefined
  date_from: string | undefined
  date_to: string | undefined
  bucket: 'day' | 'week' | 'month'
  basis: 'all_outbound' | 'sales'
  group_by: string
}

function toUndefined(v: string | null): string | undefined {
  return v ? v : undefined
}

export function useAnalyticsFilters(): [AnalyticsFilters, (patch: Partial<AnalyticsFilters>) => void] {
  const [params, setParams] = useSearchParams()

  const filters: AnalyticsFilters = {
    store_id: toUndefined(params.get('store_id')),
    category: toUndefined(params.get('category')),
    date_from: toUndefined(params.get('date_from')),
    date_to: toUndefined(params.get('date_to')),
    bucket: (params.get('bucket') as AnalyticsFilters['bucket']) || 'day',
    basis: (params.get('basis') as AnalyticsFilters['basis']) || 'all_outbound',
    group_by: params.get('group_by') || 'category',
  }

  function setFilters(patch: Partial<AnalyticsFilters>) {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      Object.entries(patch).forEach(([k, v]) => {
        if (v === undefined || v === '' || v === null) {
          next.delete(k)
        } else {
          next.set(k, String(v))
        }
      })
      return next
    }, { replace: true })
  }

  return [filters, setFilters]
}

/** Build the API params object from filters, omitting undefined values. */
export function filtersToParams(
  filters: AnalyticsFilters,
  extras?: Record<string, string | number | undefined>,
): Record<string, string | number> {
  const out: Record<string, string | number> = {}
  if (filters.store_id) out.store_id = filters.store_id
  if (filters.category) out.category = filters.category
  if (filters.date_from) out.date_from = filters.date_from
  if (filters.date_to) out.date_to = filters.date_to
  if (extras) {
    Object.entries(extras).forEach(([k, v]) => {
      if (v !== undefined) out[k] = v
    })
  }
  return out
}
