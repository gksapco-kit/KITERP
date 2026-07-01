import { BusinessUnitSelect } from '@/components/common/BusinessUnitSelect'
import { BranchSelect } from '@/components/common/BranchSelect'

interface BusinessUnitBranchSelectProps {
  buValue: string
  onBuChange: (storeId: string) => void
  branchValue: string
  onBranchChange: (branchId: string) => void
  /** Adds "All business units" / "All branches" options. */
  allowAll?: boolean
  /** When true (default) and buValue is empty without allowAll, auto-selects the default BU. */
  autoSelectDefault?: boolean
  disabled?: boolean
  className?: string
  buClassName?: string
  branchClassName?: string
}

/**
 * Cascading Business Unit → Branch selector pair. Drop-in replacement for a
 * bare `BusinessUnitSelect` wherever the branch also needs to be captured —
 * changing the business unit resets the branch selection automatically.
 * Branch stays optional: leaving it blank means "the business unit as a
 * whole" (or, for scoped writes, its default branch — resolved server-side).
 */
export function BusinessUnitBranchSelect({
  buValue,
  onBuChange,
  branchValue,
  onBranchChange,
  allowAll = false,
  autoSelectDefault = true,
  disabled,
  className,
  buClassName,
  branchClassName,
}: BusinessUnitBranchSelectProps) {
  return (
    <div className={className ?? 'flex flex-wrap items-center gap-2'}>
      <BusinessUnitSelect
        value={buValue}
        onChange={(id) => {
          onBuChange(id)
          if (id !== buValue) onBranchChange('')
        }}
        allowAll={allowAll}
        autoSelectDefault={autoSelectDefault}
        disabled={disabled}
        className={buClassName}
      />
      <BranchSelect
        businessUnitId={buValue || null}
        value={branchValue}
        onChange={onBranchChange}
        allowAll
        disabled={disabled}
        className={branchClassName}
      />
    </div>
  )
}
