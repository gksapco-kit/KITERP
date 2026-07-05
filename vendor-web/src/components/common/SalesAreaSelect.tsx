import { useEffect, useMemo } from 'react'
import { ThemeSelect, type ThemeSelectOption } from '@/components/common/ThemeSelect'
import { useSalesAreas } from '@/hooks/useVendor'

interface SalesAreaSelectProps {
  businessUnitId?: string | null
  branchId?: string | null
  value: string
  onChange: (salesAreaId: string) => void
  allowAll?: boolean
  className?: string
  triggerClassName?: string
  disabled?: boolean
  id?: string
}

function salesAreaLabel(code?: string | null, name?: string | null): string {
  const c = (code || '').trim()
  const n = (name || '').trim()
  if (n && c) return `${n} (${c})`
  return n || c || 'Sales area'
}

/**
 * Sales area selector scoped to the selected business unit (and optionally branch).
 */
export function SalesAreaSelect({
  businessUnitId,
  branchId,
  value,
  onChange,
  allowAll = true,
  className,
  triggerClassName,
  disabled,
  id,
}: SalesAreaSelectProps) {
  const { data, isLoading } = useSalesAreas(
    businessUnitId ? { business_unit_id: businessUnitId, is_active: true } : undefined,
  )

  const areas = useMemo(() => {
    const rows = (data?.sales_areas ?? []).filter((a) => a.is_active)
    if (!branchId) return rows
    return rows.filter((a) => !a.branch_id || a.branch_id === branchId)
  }, [data?.sales_areas, branchId])

  useEffect(() => {
    if (!value) return
    if (!areas.some((a) => a.id === value)) onChange('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areas, value])

  const options = useMemo((): ThemeSelectOption[] => {
    const list: ThemeSelectOption[] = areas.map((a) => ({
      value: a.id,
      label: salesAreaLabel(a.code, a.name),
      hint: [a.distribution_channel_code, a.division_code].filter(Boolean).join(' · ') || undefined,
    }))
    if (allowAll) {
      list.unshift({ value: '', label: 'All sales areas', hint: 'No filter applied' })
    }
    return list
  }, [areas, allowAll])

  const noBu = !businessUnitId
  const empty = !isLoading && areas.length === 0
  const defaultPlaceholder = allowAll ? 'All sales areas' : 'Select sales area'

  return (
    <ThemeSelect
      id={id}
      value={value}
      onChange={onChange}
      options={options}
      disabled={disabled || noBu}
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
    />
  )
}
