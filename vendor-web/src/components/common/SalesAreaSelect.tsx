import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ThemeSelect, type ThemeSelectOption } from '@/components/common/ThemeSelect'
import { vendorApi, type SalesAreaRecord } from '@/api/vendor'
import { vendorKeys } from '@/hooks/useVendor'

interface SalesAreaSelectProps {
  businessUnitId?: string | null
  branchId?: string | null
  value: string
  onChange: (salesAreaId: string) => void
  allowAll?: boolean
  className?: string
  triggerClassName?: string
  /**
   * When false (default), option hints stay in the menu only so the closed
   * trigger stays single-line and matches sibling inputs/selects.
   */
  showSelectedHint?: boolean
  disabled?: boolean
  id?: string
  /** When false, the list is not locked to a business unit (invoice/order edit). */
  requireBusinessUnit?: boolean
  /**
   * When true, only areas for the selected BU/branch are listed (list-page filters).
   * Document pickers leave this false so a named area like GACHIBOWLI always appears.
   */
  restrictToScope?: boolean
}

function clean(value?: string | null): string {
  const v = (value || '').trim()
  return v && v.toLowerCase() !== 'null' ? v : ''
}

function salesAreaOptionLabel(a: SalesAreaRecord): string {
  const name = clean(a.name)
  const branch = clean(a.branch_name)
  const code = clean(a.code)
  const primary = name || branch
  if (primary && code && primary.toLowerCase() !== code.toLowerCase()) return `${primary} (${code})`
  return primary || code || 'Sales area'
}

/**
 * Sales area selector. Document forms show every active area (name first).
 * List filters can pass restrictToScope to keep the BU → branch cascade.
 */
export function SalesAreaSelect({
  businessUnitId,
  branchId,
  value,
  onChange,
  allowAll = true,
  className,
  triggerClassName,
  showSelectedHint = false,
  disabled,
  id,
  requireBusinessUnit = true,
  restrictToScope = false,
}: SalesAreaSelectProps) {
  const { data, isLoading, isFetching } = useQuery({
    queryKey: vendorKeys.salesAreas(),
    queryFn: () => vendorApi.listSalesAreas(),
    staleTime: 0,
    refetchOnMount: 'always',
  })

  const areas = useMemo(() => {
    const rows = (data?.sales_areas ?? []).filter((a) => a.is_active !== false || a.id === value)
    if (!restrictToScope) return rows
    if (!businessUnitId) return rows
    const forBu = rows.filter(
      (a) =>
        a.business_unit_id === businessUnitId ||
        a.store_id === businessUnitId ||
        a.branch_id === businessUnitId,
    )
    const scoped = forBu.length > 0 ? forBu : rows
    if (!branchId) return scoped
    const forBranch = scoped.filter((a) => !a.branch_id || a.branch_id === branchId || a.id === value)
    return forBranch.length > 0 ? forBranch : scoped
  }, [data?.sales_areas, businessUnitId, branchId, value, restrictToScope])

  useEffect(() => {
    // Don't clear while the list is still loading/refetching — otherwise a
    // just-selected value can be wiped when options briefly look empty.
    if (!value || isLoading || isFetching) return
    if (!areas.some((a) => a.id === value)) onChange('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areas, value, isLoading, isFetching])

  const options = useMemo((): ThemeSelectOption[] => {
    const list: ThemeSelectOption[] = areas.map((a) => ({
      value: a.id,
      label: salesAreaOptionLabel(a),
      hint: [
        a.branch_name,
        a.business_unit_code || a.business_unit_name,
        a.distribution_channel_name || a.distribution_channel_code,
        a.division_name || a.division_code,
      ].filter((part) => clean(part)).join(' · ') || undefined,
    }))
    if (allowAll) {
      list.unshift({ value: '', label: 'All sales areas', hint: 'No filter applied' })
    }
    return list
  }, [areas, allowAll])

  const noBu = requireBusinessUnit && !businessUnitId
  const empty = !isLoading && areas.length === 0
  const defaultPlaceholder = allowAll ? 'All sales areas' : 'Select sales area'

  return (
    <ThemeSelect
      id={id}
      value={value}
      onChange={onChange}
      options={options}
      disabled={disabled || noBu}
      searchable
      searchPlaceholder="Search sales area…"
      placeholder={
        noBu
          ? 'Select business unit first'
          : isLoading
            ? 'Loading sales areas…'
            : empty
              ? 'No sales areas'
              : defaultPlaceholder
      }
      aria-label="Sales area"
      wrapperClassName={className ?? 'w-full min-w-[8.5rem]'}
      triggerClassName={triggerClassName}
      showSelectedHint={showSelectedHint}
      menuZIndex={11000}
    />
  )
}
