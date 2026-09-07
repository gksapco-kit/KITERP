/**
 * Shared filter state for Procurement Report Analytics, synced to URL
 * search params so report views are bookmarkable and shareable.
 */
import { useSearchParams } from 'react-router-dom'

export interface ProcurementReportFilters {
  supplier_id: string | undefined
  branch_id: string | undefined
  plant_id: string | undefined
  material_type: string | undefined
  item_category: string | undefined
  date_from: string | undefined
  date_to: string | undefined
  bucket: 'day' | 'week' | 'month'
  group_by: string
}

function toUndefined(v: string | null): string | undefined {
  return v ? v : undefined
}

export function useProcurementReportFilters(): [
  ProcurementReportFilters,
  (patch: Partial<ProcurementReportFilters>) => void,
] {
  const [params, setParams] = useSearchParams()

  const filters: ProcurementReportFilters = {
    supplier_id:   toUndefined(params.get('supplier_id')),
    branch_id:     toUndefined(params.get('branch_id')),
    plant_id:      toUndefined(params.get('plant_id')),
    material_type: toUndefined(params.get('material_type')),
    item_category: toUndefined(params.get('item_category')),
    date_from:     toUndefined(params.get('date_from')),
    date_to:       toUndefined(params.get('date_to')),
    bucket:        (params.get('bucket') as ProcurementReportFilters['bucket']) || 'month',
    group_by:      params.get('group_by') || 'supplier',
  }

  function setFilters(patch: Partial<ProcurementReportFilters>) {
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
  filters: ProcurementReportFilters,
  extras?: Record<string, string | number | undefined>,
): Record<string, string | number> {
  const out: Record<string, string | number> = {}
  if (filters.supplier_id)   out.supplier_id   = filters.supplier_id
  if (filters.branch_id)     out.branch_id      = filters.branch_id
  if (filters.plant_id)      out.plant_id       = filters.plant_id
  if (filters.material_type) out.material_type  = filters.material_type
  if (filters.item_category) out.item_category  = filters.item_category
  if (filters.date_from)     out.date_from      = filters.date_from
  if (filters.date_to)       out.date_to        = filters.date_to
  if (extras) {
    Object.entries(extras).forEach(([k, v]) => {
      if (v !== undefined) out[k] = v
    })
  }
  return out
}
