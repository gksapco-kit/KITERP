import { useEffect, useMemo } from 'react'
import { ThemeSelect, type ThemeSelectOption } from '@/components/common/ThemeSelect'
import { useBranches } from '@/hooks/useVendor'
import { BRANCH_LABEL } from '@/lib/businessUnitLabels'

interface BranchSelectProps {
  /** The business unit (Store with parent_id=null) this branch selector cascades from. */
  businessUnitId?: string | null
  value: string
  onChange: (branchId: string) => void
  /** Adds an "All branches" option (value ""). */
  allowAll?: boolean
  /** When true (default) and value is empty without allowAll, auto-selects the BU's default branch. */
  autoSelectDefault?: boolean
  className?: string
  triggerClassName?: string
  /**
   * When false (default), option hints stay in the menu only so the closed
   * trigger stays single-line and matches sibling inputs/selects.
   */
  showSelectedHint?: boolean
  disabled?: boolean
  id?: string
}

/**
 * Cascading branch selector — always scoped to a single business unit.
 * Disabled/empty until a business unit is chosen. Branch is optional: when a
 * business unit has no branches, or none is picked, callers should fall back
 * to treating the business unit itself as the effective location.
 */
export function BranchSelect({
  businessUnitId,
  value,
  onChange,
  allowAll = true,
  autoSelectDefault = false,
  className,
  triggerClassName,
  showSelectedHint = false,
  disabled,
  id,
}: BranchSelectProps) {
  const { data, isLoading } = useBranches(businessUnitId)
  const branches = useMemo(() => (data?.branches ?? []).filter((b) => b.is_active), [data])

  useEffect(() => {
    if (!businessUnitId) return
    if (!value && !allowAll && autoSelectDefault) {
      const flagged = branches.find((b) => b.is_default)
      if (flagged) onChange(flagged.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessUnitId, branches, value, allowAll, autoSelectDefault])

  const options = useMemo((): ThemeSelectOption[] => {
    const list: ThemeSelectOption[] = []
    if (allowAll) {
      list.push({ value: '', label: `All ${BRANCH_LABEL.toLowerCase()}es`, hint: 'No branch filter applied' })
    }
    for (const b of branches) {
      const label = b.code ? `${b.code} — ${b.name}` : b.name
      const suffix = b.is_default ? ' (default)' : ''
      list.push({ value: b.id, label: `${label}${suffix}`, hint: b.description || undefined })
    }
    return list
  }, [branches, allowAll])

  const isDisabled = disabled || !businessUnitId || (!isLoading && branches.length === 0)
  const placeholder = !businessUnitId
    ? `Select a business unit first…`
    : isLoading
      ? 'Loading branches…'
      : branches.length === 0
        ? `No ${BRANCH_LABEL.toLowerCase()}es for this unit`
        : allowAll
          ? `All ${BRANCH_LABEL.toLowerCase()}es`
          : `Select a ${BRANCH_LABEL.toLowerCase()}…`

  return (
    <ThemeSelect
      id={id}
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      disabled={isDisabled}
      className={className}
      triggerClassName={triggerClassName}
      showSelectedHint={showSelectedHint}
      aria-label={BRANCH_LABEL}
    />
  )
}
